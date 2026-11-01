// SPDX-License-Identifier: GPL-3.0-or-later
/* QuickerStrut&Tie — parametric bridge templates, automatic sizing and pile
 * head loads export.
 *
 * Templates (geometry in m, loads in kN, factored):
 *   dappedEnd   about réduit / demi-joint, orthogonal model, half span with symmetry
 *   bentCap     multi-column bent cap, truss with diagonals towards the columns
 *   pileCap     pile cap on 2, 3 or 4 piles, 2D elevation (see pileMap / tie3D)
 */
(function (root) {
  'use strict';
  var Q = root.QST || {};
  var solver = Q.solver || (typeof require !== 'undefined' ? require('./solver.js') : null);
  var csa = Q.csa || (typeof require !== 'undefined' ? require('./csa.js') : null);
  var examples = Q.examples || (typeof require !== 'undefined' ? require('./examples.js') : null);

  function r6(v) { return Math.round(v * 1e6) / 1e6; }
  function node(id, x, y, o) {
    o = o || {};
    return { id: id, x: r6(x), y: r6(y), support: o.support || null, fx: o.fx || 0, fy: r6(o.fy || 0), bearing: o.bearing || 0 };
  }
  function bar(id, i, j, o) {
    o = o || {};
    return { id: id, i: i, j: j, role: 'auto', w: o.w || 200, bars: o.tie ? { n: 4, size: '20M' } : null, As: 0, anchor: o.anchor || 'hook', db: 0 };
  }

  var DEFAULTS = {
    dappedEnd: { h: 1.2, hn: 0.6, ln: 0.45, a: 0.2, half: 3.0, R: 600, n: 3, b: 1000, fc: 35 },
    bentCap: { ncol: 3, spacing: 6.0, overhang: 1.8, h: 1.5, colWidth: 1.0, nGirders: 5, girderSpacing: 3.2, P: 1500, b: 1200, fc: 35 },
    pileCap: { np: 4, s: 2.7, edge: 0.75, h: 1.6, colWidth: 1.0, pileD: 0.6, P: 8000, fc: 30 }
  };

  // ---------------------------------------------------------------- about réduit
  function dappedEnd(p) {
    p = Object.assign({}, DEFAULTS.dappedEnd, p || {});
    var h = p.h, hn = p.hn, ln = p.ln, c = Math.min(0.1, 0.07 * h), yNib = h - hn + c;
    var xh = ln + Math.max(0.1, 0.08 * h), n = Math.max(1, Math.round(p.n));
    var errors = [];
    if (!(hn > 0.2 * h && hn < 0.9 * h)) errors.push('hn');
    if (!(p.a > 0 && p.a < ln)) errors.push('a');
    if (!(p.half > xh + 0.3)) errors.push('half');
    var xs = [];
    for (var i = 1; i <= n; i++) xs.push(xh + i * (p.half - xh) / n);
    var P = p.R / (n - 0.5);
    var nodes = [
      node('N1', p.a, yNib, { support: 'ry', bearing: 250 }),
      node('N2', xh, h - c), node('N3', xh, c), node('N4', xs[0], yNib)
    ];
    var T = [], B = [];
    xs.forEach(function (x, k) {
      var last = k === n - 1;
      T.push('N' + (5 + 2 * k)); B.push('N' + (6 + 2 * k));
      nodes.push(node(T[k], x, h - c, { fy: -(last ? P / 2 : P), bearing: last ? 0 : 300, support: last ? 'rx' : null }));
      nodes.push(node(B[k], x, c, { support: last ? 'rx' : null }));
    });
    var mem = [], id = 0;
    function add(i, j, o) { mem.push(bar('M' + (++id), i, j, o)); }
    add('N1', 'N2', { w: 300 });
    add('N1', 'N4', { tie: true, w: 150, anchor: 'plate' });
    add('N2', 'N3', { tie: true, w: 150, anchor: 'stirrup' });
    add('N2', T[0], { w: 150 });
    add('N3', 'N4', { w: 250 });
    add('N3', T[0], { w: 300 });
    add('N3', B[0], { tie: true, w: 150, anchor: 'plate' });
    add(T[0], 'N4', { w: 150, anchor: 'stirrup' });
    add('N4', B[0], { tie: true, w: 150, anchor: 'stirrup' });
    for (var k = 0; k < n - 1; k++) {
      add(T[k], T[k + 1], { w: 150 });
      add(B[k], B[k + 1], { tie: true, w: 150, anchor: 'hook' });
      add(B[k], T[k + 1], { w: 250 });
      add(T[k + 1], B[k + 1], { tie: true, w: 150, anchor: 'stirrup' });
    }
    return {
      errors: errors,
      model: {
        schema: 1, code: 'S6', material: examples.material({ fc: p.fc, b: p.b }),
        outline: [[0, h - hn], [ln, h - hn], [ln, 0], [p.half, 0], [p.half, h], [0, h]].map(function (q) { return [r6(q[0]), r6(q[1])]; }),
        nodes: nodes, members: mem, meta: { template: 'dappedEnd', params: p }
      }
    };
  }

  // ------------------------------------------------------- chevêtre multicolonne
  function bentCap(p) {
    p = Object.assign({}, DEFAULTS.bentCap, p || {});
    var ncol = Math.max(2, Math.min(4, Math.round(p.ncol))), ng = Math.max(1, Math.round(p.nGirders));
    var h = p.h, c = Math.max(0.1, 0.08 * h), errors = [];
    var cols = [], girders = [];
    for (var i = 0; i < ncol; i++) cols.push((i - (ncol - 1) / 2) * p.spacing);
    for (var g = 0; g < ng; g++) girders.push((g - (ng - 1) / 2) * p.girderSpacing);
    var x0 = cols[0] - p.overhang, x1 = cols[ncol - 1] + p.overhang;
    girders.forEach(function (x) { if (x < x0 + 0.2 || x > x1 - 0.2) errors.push('girders'); });
    var xs = cols.concat(girders).sort(function (a, b) { return a - b; });
    xs = xs.filter(function (x, k) { return k === 0 || x - xs[k - 1] > 1e-3; });
    var nodes = [], T = [], B = [];
    xs.forEach(function (x, k) {
      var load = girders.some(function (gx) { return Math.abs(gx - x) < 1e-3; });
      var col = cols.findIndex(function (cx) { return Math.abs(cx - x) < 1e-3; });
      T.push('N' + (2 * k + 1)); B.push('N' + (2 * k + 2));
      nodes.push(node(T[k], x, h - c, { fy: load ? -p.P : 0, bearing: load ? 500 : 0 }));
      nodes.push(node(B[k], x, c, { support: col < 0 ? null : col === 0 ? 'pin' : 'ry', bearing: col < 0 ? 0 : p.colWidth * 1000 }));
    });
    var mem = [], id = 0;
    function add(i, j, o) { mem.push(bar('M' + (++id), i, j, o)); }
    for (var k = 0; k < xs.length; k++) {
      add(T[k], B[k], { tie: true, w: 150, anchor: 'stirrup' });
      if (k === xs.length - 1) break;
      add(T[k], T[k + 1], { tie: true, w: 200, anchor: 'hook' });
      add(B[k], B[k + 1], { tie: true, w: 200, anchor: 'hook' });
      // Diagonal strut falls towards the nearest column.
      var mid = (xs[k] + xs[k + 1]) / 2, near = cols.reduce(function (a, b) { return Math.abs(b - mid) < Math.abs(a - mid) ? b : a; });
      if (near > mid) add(T[k], B[k + 1], { w: 350 }); else add(T[k + 1], B[k], { w: 350 });
    }
    var cw = p.colWidth / 2, stub = Math.min(1.2, h);
    var outline = [[x0, 0]];
    cols.forEach(function (cx) { outline.push([cx - cw, 0], [cx - cw, -stub], [cx + cw, -stub], [cx + cw, 0]); });
    outline.push([x1, 0], [x1, h], [x0, h]);
    return {
      errors: errors,
      model: {
        schema: 1, code: 'S6', material: examples.material({ fc: p.fc, b: p.b }),
        outline: outline.map(function (q) { return [r6(q[0]), r6(q[1])]; }),
        nodes: nodes, members: mem, meta: { template: 'bentCap', params: p }
      }
    };
  }

  // ------------------------------------------------------- semelle sur pieux
  // 2D elevation. 2 piles: as drawn. 4 piles (square, side s): each pile line
  // stands for two piles; the 2D tie is shared by two parallel ties. 3 piles
  // (equilateral triangle, side s): section through pile A and the B–C line;
  // the side ties of the triangle carry T2D / √3.
  function pileCap(p) {
    p = Object.assign({}, DEFAULTS.pileCap, p || {});
    var np = [2, 3, 4].indexOf(Math.round(p.np)) >= 0 ? Math.round(p.np) : 4;
    var h = p.h, c = 0.15, ytop = h - 0.15, errors = [];
    var s = p.s, e = p.edge, d = p.pileD, cw = p.colWidth, stub = 0.6;
    if (!(e >= d / 2 + 0.15)) errors.push('edge');
    if (!(s >= 2.5 * d)) errors.push('s');
    var nodes, mem, xa, xb, b, pileMap, tie3D;
    // Plate lengths over the full width b giving the real bearing areas
    // (square pile of equal area 0.886 d, square column cw × cw).
    var bmm = (np === 3 ? s + 2 * e : np === 4 ? s + 2 * e : 2 * e) * 1000, sq = 0.886 * d * 1000;
    var plate1 = Math.round(sq * sq / bmm), colPlate = Math.round(cw * cw * 1e6 / bmm);
    if (np === 3) {
      var r = s / Math.sqrt(3);
      xa = -r / 2; xb = r;
      b = s + 2 * e;
      nodes = [
        node('N1', 0, ytop, { fy: -p.P, bearing: colPlate }),
        node('N2', xa, c, { support: 'pin', bearing: 2 * plate1 }),
        node('N3', xb, c, { support: 'ry', bearing: plate1 })
      ];
      mem = [bar('M1', 'N2', 'N3', { tie: true, w: 250, anchor: 'hook' }), bar('M2', 'N1', 'N2', { w: 400 }), bar('M3', 'N1', 'N3', { w: 400 })];
      pileMap = { N2: [{ pile: 'P2', share: 0.5 }, { pile: 'P3', share: 0.5 }], N3: [{ pile: 'P1', share: 1 }] };
      tie3D = { factor: 1 / Math.sqrt(3), ties: 3 };
    } else {
      xa = -s / 2; xb = s / 2;
      b = np === 4 ? s + 2 * e : 2 * e;
      nodes = [
        node('N1', -cw / 4, ytop, { fy: -p.P / 2, bearing: Math.round(colPlate / 2) }),
        node('N2', cw / 4, ytop, { fy: -p.P / 2, bearing: Math.round(colPlate / 2) }),
        node('N3', xa, c, { support: 'pin', bearing: plate1 * (np === 4 ? 2 : 1) }),
        node('N4', xb, c, { support: 'ry', bearing: plate1 * (np === 4 ? 2 : 1) })
      ];
      mem = [bar('M1', 'N3', 'N4', { tie: true, w: 250, anchor: 'hook' }), bar('M2', 'N1', 'N3', { w: 400 }), bar('M3', 'N2', 'N4', { w: 400 }),
        bar('M4', 'N1', 'N2', { w: 250 }), bar('M5', 'N1', 'N4', { w: 150 })];
      pileMap = np === 4
        ? { N3: [{ pile: 'P1', share: 0.5 }, { pile: 'P3', share: 0.5 }], N4: [{ pile: 'P2', share: 0.5 }, { pile: 'P4', share: 0.5 }] }
        : { N3: [{ pile: 'P1', share: 1 }], N4: [{ pile: 'P2', share: 1 }] };
      tie3D = np === 4 ? { factor: 0.5, ties: 4 } : { factor: 1, ties: 1 };
    }
    var L0 = xa - e, L1 = xb + e;
    var outline = [[L0, 0], [xa - d / 2, 0], [xa - d / 2, -stub], [xa + d / 2, -stub], [xa + d / 2, 0],
      [xb - d / 2, 0], [xb - d / 2, -stub], [xb + d / 2, -stub], [xb + d / 2, 0], [L1, 0],
      [L1, h], [cw / 2, h], [cw / 2, h + stub], [-cw / 2, h + stub], [-cw / 2, h], [L0, h]];
    return {
      errors: errors,
      model: {
        schema: 1, code: 'S6', material: examples.material({ fc: p.fc, b: Math.round(b * 1000) }),
        outline: outline.map(function (q) { return [r6(q[0]), r6(q[1])]; }),
        nodes: nodes, members: mem, meta: { template: 'pileCap', params: Object.assign({}, p, { np: np }), pileMap: pileMap, tie3D: tie3D }
      }
    };
  }

  // ------------------------------------------------------- automatic sizing
  // Picks tie bars, strut widths and missing plates so that every check is at
  // or below the target utilization (three passes: strut strength depends on
  // the tie strains, which depend on the bars).
  var SIZES = ['15M', '20M', '25M', '30M', '35M'];
  function autoSize(model, opt) {
    opt = opt || {};
    var target = opt.target || 0.85;
    var info = { passes: 0 };
    for (var pass = 0; pass < 4; pass++) {
      csa.normalize(model);
      var r = solver.solve(model);
      if (!r.ok) { info.error = r.error; return info; }
      var c = csa.check(model, r), F = csa.factors(model), fy = model.material.fy, b = model.material.b;
      info.passes = pass + 1;
      model.members.forEach(function (m) {
        var f = r.forces.filter(function (x) { return x.id === m.id; })[0];
        if (f.kind === 'tie') {
          var T = f.N, size = T < 250 ? '15M' : T < 700 ? '20M' : T < 1800 ? '25M' : T < 3500 ? '30M' : '35M';
          var A = csa.BARS[size].A, n = Math.max(2, Math.ceil(T * 1000 / (target * F.phiS * fy * A)));
          while (n > 16 && SIZES.indexOf(size) < SIZES.length - 1) { size = SIZES[SIZES.indexOf(size) + 1]; A = csa.BARS[size].A; n = Math.max(2, Math.ceil(T * 1000 / (target * F.phiS * fy * A))); }
          m.bars = { n: n, size: size };
        } else if (f.kind === 'strut') {
          var ck = c.members.filter(function (x) { return x.id === m.id; })[0];
          if (ck && isFinite(ck.wReq)) m.w = Math.max(100, Math.ceil(ck.wReq / target / 10) * 10);
        }
      });
      // Anchorage: upgrade straight → hook → plate where the length is short.
      c.anchors.forEach(function (a) {
        if (a.na || a.mechanical || a.util <= target) return;
        var m = model.members.filter(function (x) { return x.id === a.member; })[0];
        m.anchor = a.type === 'straight' ? 'hook' : 'plate';
      });
      // Plates on loaded or supported nodes: at least the width giving the
      // target stress on the bearing face.
      c.nodes.forEach(function (nc) {
        var n = model.nodes.filter(function (x) { return x.id === nc.id; })[0];
        nc.faces.forEach(function (fa) {
          if ((fa.kind === 'support' || fa.kind === 'load') && fa.util > target) n.bearing = Math.ceil(fa.force * 1000 / (target * nc.limit * b) / 10) * 10;
        });
      });
    }
    csa.normalize(model);
    return info;
  }

  // ------------------------------------------------------- QuickerPile export
  // Factored pile head loads (N > 0 compression, H along x, M = 0 pinned head).
  function pileLoads(model, result, meta) {
    if (!result || !result.ok) return null;
    var map = model.meta && model.meta.pileMap, piles = [];
    result.reactions.forEach(function (R) {
      var n = model.nodes.filter(function (x) { return x.id === R.node; })[0];
      var list = map && map[R.node] ? map[R.node] : [{ pile: 'P' + (piles.length + 1), share: 1 }];
      list.forEach(function (it) {
        piles.push({ id: it.pile, node: R.node, x: n.x, N: r6(R.ry * it.share), H: r6(R.rx * it.share), M: 0 });
      });
    });
    piles.sort(function (a, b) { return a.id.localeCompare(b.id, undefined, { numeric: true }); });
    return {
      format: 'quickerpile-head-loads', version: 1,
      source: 'QuickerStrut&Tie' + (meta && meta.version ? ' v' + meta.version : ''),
      project: model.name || '', code: model.code, limitState: 'ULS (factored)',
      units: { force: 'kN', moment: 'kN·m', length: 'm' },
      convention: 'N > 0 compression at the pile head; H along the model x axis; M = 0 (pinned head in the strut-and-tie model)',
      piles: piles
    };
  }

  var api = { DEFAULTS: DEFAULTS, dappedEnd: dappedEnd, bentCap: bentCap, pileCap: pileCap, autoSize: autoSize, pileLoads: pileLoads };
  root.QST = root.QST || {};
  root.QST.templates = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
