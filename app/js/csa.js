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
      clause: { phi: '8.4.6', strut: '8.10.3', fcu: '8.10.3.3', tie: '8.10.4.1', node: '8.10.5.1', crack: '8.10.5' }
    },
    A23: {
      name: 'CSA A23.3',
      phiC: 0.65, phiS: 0.85,
      strutCap: function () { return 0.85; },
      node: function (type) { return { CCC: 0.85, CCT: 0.75, CTT: 0.65 }[type]; },
      nodeText: { CCC: '0,85', CCT: '0,75', CTT: '0,65' },
      rhoMin: 0.002, sMax: 300, maxFaceArea: null,
      clause: { phi: '8.4.2 / 8.4.3', strut: '11.4.2', fcu: '11.4.2.3', tie: '11.4.3.1', node: '11.4.4.1', crack: '11.4.5' }
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

    // --- Governing element ----------------------------------------------------
    var all = out.members.concat(out.nodes);
    all.forEach(function (e) { if (!out.governing || e.util > out.governing.util) out.governing = e; });
    out.maxUtil = out.governing ? out.governing.util : 0;
    out.phiC = F.phiC; out.phiS = F.phiS; out.code = model.code; out.strutCap = cap;
    out.ok = true;
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

  function insideOrOn(x, y, poly) {
    if (pointInPolygon(x, y, poly)) return true;
    for (var i = 0; i < poly.length; i++) if (distToSegment(x, y, poly[i], poly[(i + 1) % poly.length]) < 1e-6) return true;
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
    pointInPolygon: pointInPolygon, acuteAngle: acuteAngle
  };
  root.QST = root.QST || {};
  root.QST.csa = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
