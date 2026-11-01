// SPDX-License-Identifier: GPL-3.0-or-later
/* QuickerStrut&Tie — strut-and-tie verification to CSA S6 (bridges) and
 * CSA A23.3 (buildings).
 *
 * Struts : Cr = φc·fcu·Acs, fcu = f'c / (0.8 + 170·ε1) ≤ 0.85·f'c (A23.3) or α1·f'c (S6),
 *          ε1 = εs + (εs + 0.002)·cot²θs  (θs = smallest strut–tie angle).
 * Ties   : Tr = φs·fy·Ast.
 * Nodes  : face stresses ≤ 0.85 / 0.75 / 0.65 ·φc·f'c (A23.3) or
 *          α1 / 0.88 α1 / 0.76 α1 ·φc·f'c (S6), for CCC / CCT / CTT.
 * Crack control: orthogonal grid, ρ ≥ ρmin each way, spacing ≤ 300 mm.
 *
 * Clause numbers and factors live in CODES so they can be checked and
 * corrected in one place.
 */
(function (root) {
  'use strict';

  // S6: α1 = 0.85 − 0.0015 f′c ≥ 0.67 caps the strut stress (α1 f′c) and sets the
  // nodal limits α1, 0.88 α1 and 0.76 α1 (× φc f′c). A23.3: 0.85 f′c, 0.85/0.75/0.65.
  function alpha1(fc) { return Math.max(0.67, 0.85 - 0.0015 * fc); }
  var CODES = {
    S6: {
      name: 'CSA S6',
      phiC: 0.75, phiS: 0.90,
      strutCap: function (fc) { return alpha1(fc); },
      node: function (type, fc) { var a = alpha1(fc); return { CCC: a, CCT: 0.88 * a, CTT: 0.76 * a }[type]; },
      nodeText: { CCC: 'α1', CCT: '0,88 α1', CTT: '0,76 α1' },
      rhoMin: 0.003, sMax: 300, maxFaceArea: 1500,
      clause: { phi: '8.4.6', strut: '8.10.3', fcu: '8.10.3.3', tie: '8.10.4.1', node: '8.10.5.1', crack: '8.10.5', anchor: '8.10.4.2 · A23.3 12.2.3 / 12.5' }
    },
    A23: {
      name: 'CSA A23.3',
      phiC: 0.65, phiS: 0.85,
      strutCap: function () { return 0.85; },
      node: function (type) { return { CCC: 0.85, CCT: 0.75, CTT: 0.65 }[type]; },
      nodeText: { CCC: '0,85', CCT: '0,75', CTT: '0,65' },
      rhoMin: 0.002, sMax: 300, maxFaceArea: null,
      clause: { phi: '8.4.2 / 8.4.3', strut: '11.4.2', fcu: '11.4.2.3', tie: '11.4.3.1', node: '11.4.4.1', crack: '11.4.5', anchor: '11.4.3.2 · 12.2.3 / 12.5' }
    }
  };

  // CSA G30.18 bar designations: nominal area (mm²) and diameter (mm).
  var BARS = {
    '10M': { A: 100, d: 11.3 }, '15M': { A: 200, d: 16.0 }, '20M': { A: 300, d: 19.5 },
    '25M': { A: 500, d: 25.2 }, '30M': { A: 700, d: 29.9 }, '35M': { A: 1000, d: 35.7 },
    '45M': { A: 1500, d: 43.7 }, '55M': { A: 2500, d: 56.4 }
  };

  function factors(model) {
    var c = CODES[model.code] || CODES.S6, m = model.material;
    return {
      code: c,
      phiC: m.phiC > 0 ? Number(m.phiC) : c.phiC,
      phiS: m.phiS > 0 ? Number(m.phiS) : c.phiS
    };
  }

  function memberArea(m) {
    if (m.bars && m.bars.n > 0 && BARS[m.bars.size]) return m.bars.n * BARS[m.bars.size].A;
    return Number(m.As) || 0;
  }

  // Effective area used by the solver and the checks (bars override As).
  function normalize(model) {
    model.members.forEach(function (m) { m.As = memberArea(m); });
    return model;
  }

  function strutFcu(fc, epsS, theta, cap) {
    // theta in radians, acute angle between the strut and the adjoining tie;
    // cap: limiting ratio fcu / f′c (0.85 for A23.3, α1 for S6).
    cap = cap === undefined ? 0.85 : cap;
    var cot = 1 / Math.tan(theta);
    var eps1 = epsS + (epsS + 0.002) * cot * cot;
    var raw = fc / (0.8 + 170 * eps1);
    return { eps1: eps1, raw: raw, fcu: Math.min(raw, cap * fc), capped: raw >= cap * fc, cap: cap };
  }

  function acuteAngle(fa, fb) {
    var dot = Math.abs(fa.c * fb.c + fa.s * fb.s);
    return Math.acos(Math.min(1, dot));
  }

  function check(model, result) {
    var out = { ok: false, members: [], nodes: [], crack: null, governing: null, maxUtil: 0, warnings: [] };
    if (!result || !result.ok) return out;
    var mat = model.material, fc = Number(mat.fc), fy = Number(mat.fy), Es = Number(mat.Es), b = Number(mat.b);
    var F = factors(model), code = F.code, cap = code.strutCap(fc);
    var byId = {}, memberById = {}, nodeById = {};
    result.forces.forEach(function (f) { byId[f.id] = f; });
    model.members.forEach(function (m) { memberById[m.id] = m; });
    model.nodes.forEach(function (n) { nodeById[n.id] = n; });
    var atNode = {};
    model.nodes.forEach(function (n) { atNode[n.id] = []; });
    model.members.forEach(function (m) { atNode[m.i].push(m); atNode[m.j].push(m); });

    function tieStrain(m, f) {
      var As = memberArea(m);
      if (mat.epsMode === 'yield') return fy / Es;
      if (!(As > 0)) return fy / Es;
      return f.N * 1000 / (Es * As);
    }

    // --- Ties ---------------------------------------------------------------
    var tieInfo = {};
    model.members.forEach(function (m) {
      var f = byId[m.id];
      if (f.kind !== 'tie') return;
      var As = memberArea(m), Tr = F.phiS * fy * As / 1000;
      var util = As > 0 ? f.N / Tr : Infinity;
      var eps = tieStrain(m, f);
      tieInfo[m.id] = { eps: eps };
      out.members.push({
        id: m.id, kind: 'tie', demand: f.N, capacity: Tr, util: util, As: As,
        asReq: f.N * 1000 / (F.phiS * fy), epsS: eps, clause: code.clause.tie
      });
    });

    // --- Struts -------------------------------------------------------------
    model.members.forEach(function (m) {
      var f = byId[m.id];
      if (f.kind !== 'strut') return;
      var C = -f.N, w = Number(m.w) || 0, ends = [];
      [m.i, m.j].forEach(function (nid) {
        var best = null;
        atNode[nid].forEach(function (o) {
          if (o.id === m.id) return;
          var fo = byId[o.id];
          if (fo.kind !== 'tie') return;
          // A tie on the strut's line (within 5°) does not cross it.
          if (acuteAngle(f, fo) < 5 * Math.PI / 180) return;
          // Each adjoining tie is evaluated; the lowest fcu (smallest angle,
          // largest tie strain) governs.
          var th = acuteAngle(f, fo), eps = tieInfo[o.id].eps;
          var r = strutFcu(fc, eps, th, cap);
          var cand = { tie: o.id, theta: th, epsS: eps, eps1: r.eps1, fcuRaw: r.raw, fcu: r.fcu, capped: r.capped };
          if (!best || cand.fcu < best.fcu - 1e-9 || (Math.abs(cand.fcu - best.fcu) <= 1e-9 && th < best.theta)) best = cand;
        });
        if (best) {
          ends.push({ node: nid, tie: best.tie, theta: best.theta, epsS: best.epsS, eps1: best.eps1, fcuRaw: best.fcuRaw, fcu: best.fcu, capped: best.capped });
        } else {
          ends.push({ node: nid, tie: null, theta: null, epsS: 0, eps1: 0, fcuRaw: fc / 0.8, fcu: cap * fc, capped: true });
        }
      });
      var gov = ends[0].fcu <= ends[1].fcu ? ends[0] : ends[1];
      var Cr = F.phiC * gov.fcu * w * b / 1000;
      out.members.push({
        id: m.id, kind: 'strut', demand: C, capacity: Cr, util: Cr > 0 ? C / Cr : Infinity,
        w: w, wReq: gov.fcu > 0 ? C * 1000 / (F.phiC * gov.fcu * b) : Infinity,
        ends: ends, governingEnd: gov.node, fcu: gov.fcu, eps1: gov.eps1, theta: gov.theta, epsS: gov.epsS,
        clause: code.clause.strut + ' · ' + code.clause.fcu
      });
    });
    model.members.forEach(function (m) {
      if (byId[m.id].kind === 'zero') out.members.push({ id: m.id, kind: 'zero', demand: 0, capacity: null, util: 0, clause: '' });
    });

    // --- Nodal zones --------------------------------------------------------
    var reactionById = {};
    result.reactions.forEach(function (R) { reactionById[R.node] = R; });
    model.nodes.forEach(function (n) {
      var ties = [], faces = [];
      atNode[n.id].forEach(function (m) {
        var f = byId[m.id];
        if (f.kind === 'tie') ties.push({ m: m, f: f });
        if (f.kind === 'strut') {
          var w = Number(m.w) || 0;
          faces.push({ kind: 'strut', ref: m.id, force: -f.N, width: w, stress: w > 0 ? -f.N * 1000 / (w * b) : Infinity });
        }
      });
      // Distinct tie directions (collinear ties through a node count once).
      var dirs = [];
      ties.forEach(function (t) {
        var same = dirs.some(function (d) { return acuteAngle(d, t.f) < 5 * Math.PI / 180; });
        if (!same) dirs.push(t.f);
      });
      var type = dirs.length === 0 ? 'CCC' : dirs.length === 1 ? 'CCT' : 'CTT';
      var lb = Number(n.bearing) || 0;
      var R = reactionById[n.id];
      if (R && lb > 0) {
        var Rm = Math.hypot(R.rx, R.ry);
        if (Rm > 0) faces.push({ kind: 'support', ref: n.id, force: Rm, width: lb, stress: Rm * 1000 / (lb * b) });
      }
      var P = Math.hypot(Number(n.fx) || 0, Number(n.fy) || 0);
      if (P > 0 && lb > 0) faces.push({ kind: 'load', ref: n.id, force: P, width: lb, stress: P * 1000 / (lb * b) });
      // Anchorage face of a tie that ends here (a tie continuing through the
      // node on the same line is not anchored and has no bearing face).
      ties.forEach(function (t) {
        var w = Number(t.m.w) || 0;
        var continues = ties.some(function (o) { return o !== t && acuteAngle(o.f, t.f) < 5 * Math.PI / 180; });
        if (w > 0 && !continues && mat.tieFaces !== false) faces.push({ kind: 'tie', ref: t.m.id, force: t.f.N, width: w, stress: t.f.N * 1000 / (w * b) });
      });
      if (!faces.length) return;
      var factor = code.node(type, fc), limit = factor * F.phiC * fc;
      var maxFace = null;
      faces.forEach(function (fa) { fa.util = fa.stress / limit; if (!maxFace || fa.util > maxFace.util) maxFace = fa; });
      out.nodes.push({
        id: n.id, kind: 'node', type: type, factor: factor, limit: limit, faces: faces,
        util: maxFace ? maxFace.util : 0, governingFace: maxFace, ties: ties.length,
        zone: hydrostaticZone(n, atNode[n.id], byId, R, b, limit, model.outline),
        clause: code.clause.node
      });
    });

    // --- Crack control reinforcement -----------------------------------------
    var rh = Number(mat.rhoH) || 0, rv = Number(mat.rhoV) || 0, sp = Number(mat.spacing) || 0;
    // S6: the grid need not exceed maxFaceArea mm²/m on each face (two faces).
    var rhoReq = code.maxFaceArea ? Math.min(code.rhoMin, 2 * code.maxFaceArea / (b * 1000)) : code.rhoMin;
    out.crack = {
      rhoMin: rhoReq, rhoCode: code.rhoMin, capped: rhoReq < code.rhoMin, sMax: code.sMax, rhoH: rh, rhoV: rv, spacing: sp,
      okH: rh >= rhoReq - 1e-12, okV: rv >= rhoReq - 1e-12, okS: sp > 0 && sp <= code.sMax,
      util: Math.max(rh > 0 ? rhoReq / rh : Infinity, rv > 0 ? rhoReq / rv : Infinity, sp > 0 ? sp / code.sMax : Infinity),
      clause: code.clause.crack
    };

    // --- Anchorage of ties -----------------------------------------------------
    out.anchors = anchorageChecks(model, byId, atNode, out.nodes, { fc: fc, fy: fy, b: b, code: code, mat: mat, reactions: reactionById });

    // --- Governing element ----------------------------------------------------
    var all = out.members.concat(out.nodes).concat(out.anchors.filter(function (a) { return !a.na; }));
    all.forEach(function (e) { if (!out.governing || e.util > out.governing.util) out.governing = e; });
    out.maxUtil = out.governing ? out.governing.util : 0;
    out.phiC = F.phiC; out.phiS = F.phiS; out.code = model.code; out.strutCap = cap;
    out.ok = true;
    return out;
  }


  // ---------------------------------------------------------------------------
  // Hydrostatic nodal zone. Every force on the node is represented as a push on
  // one face: struts on their own side, ties as a push on the back face (net
  // force of collinear ties), loads and reactions on their plate. The closed
  // force polygon rotated by 90° and scaled by 1 / (σ·b) is the node outline:
  // each face is perpendicular to its force and all faces carry the same
  // stress σ. σ is the largest stress on a face with a given width (so every
  // hydrostatic width ≤ the width entered), or the node limit if no width is
  // given (smallest admissible node).
  function hydrostaticZone(n, members, byId, R, b, limit, outline) {
    var faces = [], tieGroups = [];
    members.forEach(function (m) {
      var f = byId[m.id];
      if (!f || f.kind === 'zero') return;
      var sgn = m.i === n.id ? 1 : -1, ux = sgn * f.c, uy = sgn * f.s;
      if (f.kind === 'strut') faces.push({ kind: 'strut', ref: m.id, force: -f.N, ux: ux, uy: uy, wGiven: Number(m.w) || 0 });
      else {
        var g = tieGroups.filter(function (t) { return Math.abs(t.dx * uy - t.dy * ux) < Math.sin(5 * Math.PI / 180); })[0];
        if (!g) { g = { dx: ux, dy: uy, px: 0, py: 0, refs: [], w: 0 }; tieGroups.push(g); }
        g.px += f.N * ux; g.py += f.N * uy; g.refs.push(m.id); g.w = Math.max(g.w, Number(m.w) || 0);
      }
    });
    tieGroups.forEach(function (g) {
      var T = Math.hypot(g.px, g.py);
      if (T > 0.05) faces.push({ kind: 'tie', ref: g.refs.join('+'), force: T, ux: -g.px / T, uy: -g.py / T, wGiven: g.w });
    });
    var lb = Number(n.bearing) || 0;
    var P = Math.hypot(Number(n.fx) || 0, Number(n.fy) || 0);
    if (P > 0.05) faces.push({ kind: 'load', ref: n.id, force: P, ux: -(Number(n.fx) || 0) / P, uy: -(Number(n.fy) || 0) / P, wGiven: lb });
    if (R) {
      var Rm = Math.hypot(R.rx, R.ry);
      if (Rm > 0.05) faces.push({ kind: 'support', ref: n.id, force: Rm, ux: -R.rx / Rm, uy: -R.ry / Rm, wGiven: lb });
    }
    if (faces.length < 3) return null;
    var sigma = 0;
    faces.forEach(function (fa) { if (fa.wGiven > 0) sigma = Math.max(sigma, fa.force * 1000 / (fa.wGiven * b)); });
    var scaled = sigma > 0 ? 'face' : 'limit';
    if (!(sigma > 0)) sigma = limit;
    faces.forEach(function (fa) { fa.angle = Math.atan2(fa.uy, fa.ux); fa.wHydro = fa.force * 1000 / (sigma * b); });
    faces.sort(function (a, c) { return a.angle - c.angle; });
    var pts = [[0, 0]];
    faces.forEach(function (fa) {
      var L = fa.wHydro / 1000, last = pts[pts.length - 1];
      pts.push([last[0] - fa.uy * L, last[1] + fa.ux * L]);
    });
    var end = pts.pop(), closure = Math.hypot(end[0], end[1]);
    // Area and centroid (shoelace), then centre the polygon on the node.
    var A = 0, cx = 0, cy = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length], cr = p[0] * q[1] - q[0] * p[1];
      A += cr; cx += (p[0] + q[0]) * cr; cy += (p[1] + q[1]) * cr;
    }
    A /= 2;
    if (Math.abs(A) < 1e-8) return null;
    cx /= 6 * A; cy /= 6 * A;
    var poly = pts.map(function (p) { return [n.x + p[0] - cx, n.y + p[1] - cy]; });
    // Faces as segments (for drawing): face k joins vertex k and k+1.
    faces.forEach(function (fa, k) { fa.a = poly[k]; fa.b = poly[(k + 1) % poly.length]; });
    var outside = outline && outline.length >= 3 ? poly.some(function (p) { return !insideOrOn(p[0], p[1], outline, 0.005); }) : false;
    return { sigma: sigma, scaled: scaled, util: sigma / limit, faces: faces, poly: poly, area: Math.abs(A), closure: closure, outside: outside };
  }

  // Distance (m) from (x, y) along the unit direction (dx, dy) to the outline.
  function rayToOutline(x, y, dx, dy, poly) {
    var best = Infinity;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], c = poly[(i + 1) % poly.length], ex = c[0] - a[0], ey = c[1] - a[1];
      var den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      var t = ((a[0] - x) * ey - (a[1] - y) * ex) / den, u = ((a[0] - x) * dy - (a[1] - y) * dx) / den;
      if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
    }
    return best;
  }

  // Development length of a straight bar (A23.3 12.2.3, simplified) and of a
  // standard hook (A23.3 12.5.2, basic length × fy / 400).
  function developmentLength(type, db, fy, fc, opts) {
    var sq = Math.min(Math.sqrt(fc), 8);
    if (type === 'hook') return Math.max(100 * db / sq * fy / 400, 8 * db, 150);
    var k = opts.k || 0.45, k1 = opts.top ? 1.3 : 1.0, k4 = db <= 20 ? 0.8 : 1.0;
    return Math.max(k * k1 * k4 * fy / sq * db, 300);
  }

  // Tie anchorage: at each node where a tie ends, the bars must develop fy at
  // the edge of the extended nodal zone. Available length la = critical-section
  // offset (strut edge or hydrostatic zone crossing the tie axis) + extension of
  // the bars beyond the node to the concrete face, less the cover.
  function anchorageChecks(model, byId, atNode, nodeChecks, o) {
    var out = [], poly = model.outline || [], zoneOf = {};
    nodeChecks.forEach(function (c) { zoneOf[c.id] = c.zone; });
    var cover = Number(o.mat.cover) >= 0 ? Number(o.mat.cover) : 50;
    model.members.forEach(function (m) {
      var f = byId[m.id];
      if (!f || f.kind !== 'tie') return;
      [m.i, m.j].forEach(function (nid) {
        var sgn = m.i === nid ? 1 : -1, dx = sgn * f.c, dy = sgn * f.s;
        var continues = atNode[nid].some(function (o2) {
          if (o2.id === m.id) return false;
          var g = byId[o2.id];
          return g && g.kind === 'tie' && Math.abs(g.c * f.s - g.s * f.c) < Math.sin(5 * Math.PI / 180);
        });
        if (continues) return;
        var n = model.nodes.filter(function (x) { return x.id === nid; })[0];
        // A support reaction in line with the tie stands for its continuation
        // (symmetry plane, continuous member): no anchorage there.
        var Rn = o.reactions[nid];
        if (Rn && Math.abs(Rn.rx * dx + Rn.ry * dy) >= 0.9 * f.N) return;
        var dc = 0;
        atNode[nid].forEach(function (o2) {
          var g = byId[o2.id];
          if (!g || g.kind !== 'strut') return;
          var th = acuteAngle(f, g);
          if (th > 5 * Math.PI / 180) dc = Math.max(dc, (Number(o2.w) || 0) / 2 / Math.sin(th));
        });
        var z = zoneOf[nid];
        if (z) z.poly.forEach(function (p) { dc = Math.max(dc, ((p[0] - n.x) * dx + (p[1] - n.y) * dy) * 1000); });
        var ray = poly.length >= 3 ? rayToOutline(n.x, n.y, -dx, -dy, poly) : 0;
        var e = isFinite(ray) ? Math.max(0, ray * 1000 - cover) : 0;
        var la = dc + e, type = m.anchor || 'straight';
        var db = m.bars && BARS[m.bars.size] ? BARS[m.bars.size].d : (Number(m.db) > 0 ? Number(m.db) : null);
        // Top bars: more than 300 mm of concrete below them (k1 = 1.3).
        var below = poly.length >= 3 ? rayToOutline(n.x, n.y, 0, -1, poly) : 0;
        var top = isFinite(below) && below > 0.3;
        var rec = { id: m.id + '@' + nid, kind: 'anchor', member: m.id, node: nid, type: type, la: la, e: e, dc: dc, db: db, top: top, clause: o.code.clause.anchor, end: [n.x - dx * e / 1000, n.y - dy * e / 1000], dir: [-dx, -dy] };
        if (type === 'plate' || type === 'stirrup') { rec.req = 0; rec.util = 0; rec.mechanical = true; }
        else if (!db) { rec.na = true; rec.util = 0; }
        else { rec.req = developmentLength(type, db, o.fy, o.fc, { k: Number(o.mat.ldFactor) || 0.45, top: top }); rec.util = la > 0 ? rec.req / la : Infinity; }
        out.push(rec);
      });
    });
    return out;
  }

  // Geometric sanity checks: nodes and bars outside the concrete outline.
  function pointInPolygon(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function distToSegment(x, y, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    var t = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0;
    return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
  }

  function insideOrOn(x, y, poly, tol) {
    if (pointInPolygon(x, y, poly)) return true;
    for (var i = 0; i < poly.length; i++) if (distToSegment(x, y, poly[i], poly[(i + 1) % poly.length]) < (tol || 1e-6)) return true;
    return false;
  }

  function geometryWarnings(model) {
    var poly = model.outline || [], warn = [];
    if (poly.length < 3) return warn;
    var nodeById = {};
    model.nodes.forEach(function (n) {
      nodeById[n.id] = n;
      if (!insideOrOn(n.x, n.y, poly)) warn.push({ kind: 'nodeOutside', id: n.id });
    });
    model.members.forEach(function (m) {
      var A = nodeById[m.i], B = nodeById[m.j];
      if (!A || !B) return;
      for (var k = 1; k < 10; k++) {
        var t = k / 10, x = A.x + t * (B.x - A.x), y = A.y + t * (B.y - A.y);
        if (!insideOrOn(x, y, poly)) { warn.push({ kind: 'memberOutside', id: m.id }); break; }
      }
    });
    return warn;
  }

  var api = {
    CODES: CODES, BARS: BARS, alpha1: alpha1, check: check, strutFcu: strutFcu, factors: factors,
    memberArea: memberArea, normalize: normalize, geometryWarnings: geometryWarnings,
    pointInPolygon: pointInPolygon, acuteAngle: acuteAngle, hydrostaticZone: hydrostaticZone,
    developmentLength: developmentLength, rayToOutline: rayToOutline
  };
  root.QST = root.QST || {};
  root.QST.csa = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
