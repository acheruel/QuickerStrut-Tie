// SPDX-License-Identifier: GPL-3.0-or-later
/* QuickerStrut&Tie — 2D pin-jointed truss solver (direct stiffness method).
 *
 * Units: coordinates in m, forces in kN, widths/thickness in mm, areas in mm²,
 * stresses in MPa. Axial force N > 0 is tension (tie), N < 0 compression (strut).
 *
 * Axial stiffness of each bar: struts EA = Ec·w·b, ties EA = Es·As. For a
 * statically determinate model the forces do not depend on EA; for an
 * indeterminate model the bar roles (strut/tie) are iterated until stable.
 *
 * A singular truss can still give an equilibrium solution for its given
 * loads. Its mechanism displacements are arbitrary and have no design use.
 */
(function (root) {
  'use strict';

  var ZERO_FORCE_KN = 0.05; // |N| below this is reported as a zero-force member

  function concreteModulus(code, fc) {
    // A23.3 8.6.2.3 / S6 8.4.1.7 simplified expressions for normal-density concrete.
    if (code === 'S6') return 3000 * Math.sqrt(fc) + 6900;
    return 4500 * Math.sqrt(fc);
  }

  function supportDofs(type) {
    if (type === 'pin') return [true, true];
    if (type === 'ry') return [false, true];
    if (type === 'rx') return [true, false];
    return [false, false];
  }

  function memberGeometry(model) {
    var index = {};
    model.nodes.forEach(function (n, k) { index[n.id] = k; });
    return model.members.map(function (m) {
      var a = index[m.i], b = index[m.j];
      if (a === undefined || b === undefined) return { error: 'missingNode', member: m.id };
      var A = model.nodes[a], B = model.nodes[b];
      var dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy);
      if (!(L > 1e-6)) return { error: 'zeroLength', member: m.id };
      return { a: a, b: b, L: L, c: dx / L, s: dy / L };
    });
  }

  // Gaussian elimination with partial pivoting. For a singular equilibrium
  // solve, leave nonpivot coordinates at zero and check the original equations.
  // The arbitrary mechanism displacements do not strain the bars.
  function linearSolve(K, F, allowSingular) {
    var n = F.length, A = K.map(function (r) { return r.slice(); }), rhs = F.slice();
    var scale = 0;
    for (var d = 0; d < n; d++) scale = Math.max(scale, Math.abs(A[d][d]));
    var tol = Math.max(scale, 1e-30) * 1e-10;
    var pivots = [];
    for (var k = 0; k < n; k++) {
      var row = pivots.length, piv = row, best = Math.abs(A[row][k]);
      for (var r = row + 1; r < n; r++) if (Math.abs(A[r][k]) > best) { best = Math.abs(A[r][k]); piv = r; }
      if (best < tol) {
        if (!allowSingular) return { singular: k };
        continue;
      }
      pivots.push(k);
      if (piv !== row) {
        var t = A[row]; A[row] = A[piv]; A[piv] = t;
        var tx = rhs[row]; rhs[row] = rhs[piv]; rhs[piv] = tx;
      }
      for (var i = row + 1; i < n; i++) {
        var f = A[i][k] / A[row][k];
        if (f === 0) continue;
        for (var j = k + 1; j < n; j++) A[i][j] -= f * A[row][j];
        rhs[i] -= f * rhs[row];
      }
    }
    var x = new Array(n).fill(0);
    for (var i2 = pivots.length - 1; i2 >= 0; i2--) {
      var col = pivots[i2], sum = rhs[i2];
      for (var j2 = col + 1; j2 < n; j2++) sum -= A[i2][j2] * x[j2];
      x[col] = sum / A[i2][col];
    }
    if (pivots.length === n) return { x: x };
    var worst = 0, dof = 0, fmax = 0;
    for (var a = 0; a < n; a++) {
      fmax = Math.max(fmax, Math.abs(F[a]));
      var residual = F[a];
      for (var b = 0; b < n; b++) residual -= K[a][b] * x[b];
      if (Math.abs(residual) > worst) { worst = Math.abs(residual); dof = a; }
    }
    return worst <= 1e-8 * fmax ? { x: x, unbraced: true } : { singular: dof };
  }

  function axialStiffness(model, m, isTie, Ec) {
    var mat = model.material, b = mat.b;
    if (isTie) {
      var As = m.As > 0 ? m.As : 1000;
      return mat.Es * As / 1000; // kN
    }
    var w = m.w > 0 ? m.w : 100;
    return Ec * w * b / 1000; // kN
  }

  function solve(model, zeroForceKN) {
    if (zeroForceKN === undefined) zeroForceKN = ZERO_FORCE_KN;
    var nodes = model.nodes, members = model.members, nn = nodes.length, nd = nn * 2;
    var out = { ok: false, nodes: nn, members: members.length };
    if (!nn) { out.error = 'empty'; return out; }
    var geo = memberGeometry(model);
    for (var g = 0; g < geo.length; g++) if (geo[g].error) { out.error = geo[g].error; out.member = geo[g].member; return out; }

    var fixed = [], nReactions = 0;
    nodes.forEach(function (n) {
      var f = supportDofs(n.support);
      fixed.push(f[0], f[1]);
      nReactions += (f[0] ? 1 : 0) + (f[1] ? 1 : 0);
    });
    var F = new Array(nd).fill(0);
    nodes.forEach(function (n, k) { F[2 * k] = Number(n.fx) || 0; F[2 * k + 1] = Number(n.fy) || 0; });
    out.indeterminacy = members.length + nReactions - 2 * nn;
    var free = [];
    for (var d = 0; d < nd; d++) if (!fixed[d]) free.push(d);
    var Ec = concreteModulus(model.code, model.material.fc);
    out.Ec = Ec;

    // Initial roles: explicit roles, otherwise strut.
    var tie = members.map(function (m) { return m.role === 'tie'; });
    var N, u, EA, iter = 0, converged = false, K, unbraced = false;
    while (iter < 12) {
      iter++;
      EA = members.map(function (m, k) { return axialStiffness(model, m, tie[k], Ec); });
      K = [];
      for (var r = 0; r < nd; r++) K.push(new Array(nd).fill(0));
      members.forEach(function (m, k) {
        var G = geo[k], kk = EA[k] / G.L, c = G.c, s = G.s;
        var e = [[c * c, c * s], [c * s, s * s]];
        var dofs = [2 * G.a, 2 * G.a + 1, 2 * G.b, 2 * G.b + 1];
        for (var p = 0; p < 4; p++) for (var q = 0; q < 4; q++) {
          var sign = (p < 2) === (q < 2) ? 1 : -1;
          K[dofs[p]][dofs[q]] += sign * kk * e[p % 2][q % 2];
        }
      });
      var Kr = free.map(function (i) { return free.map(function (j) { return K[i][j]; }); });
      var Fr = free.map(function (i) { return F[i]; });
      u = new Array(nd).fill(0);
      if (free.length) {
        var sol = linearSolve(Kr, Fr, true);
        if (sol.singular !== undefined) {
          var dof = free[sol.singular];
          out.error = 'mechanism';
          out.mechanismNode = nodes[Math.floor(dof / 2)].id;
          out.mechanismDir = dof % 2 ? 'y' : 'x';
          return out;
        }
        unbraced = !!sol.unbraced;
        free.forEach(function (dd, k2) { u[dd] = sol.x[k2]; });
      }
      N = members.map(function (m, k) {
        var G = geo[k];
        var du = u[2 * G.b] - u[2 * G.a], dv = u[2 * G.b + 1] - u[2 * G.a + 1];
        return EA[k] / G.L * (G.c * du + G.s * dv);
      });
      var next = members.map(function (m, k) {
        if (m.role === 'tie') return true;
        if (m.role === 'strut') return false;
        return N[k] > ZERO_FORCE_KN;
      });
      var same = next.every(function (v, k) { return v === tie[k]; });
      tie = next;
      if (same) { converged = true; break; }
    }

    // Reactions R = K·u − F at restrained dofs; residual at free dofs.
    var Ku = new Array(nd).fill(0);
    for (var i = 0; i < nd; i++) { var sum = 0; for (var j = 0; j < nd; j++) sum += K[i][j] * u[j]; Ku[i] = sum; }
    var reactions = [], residual = 0, sumFx = 0, sumFy = 0, loadScale = 0;
    nodes.forEach(function (n, k) {
      sumFx += F[2 * k]; sumFy += F[2 * k + 1];
      loadScale = Math.max(loadScale, Math.abs(F[2 * k]), Math.abs(F[2 * k + 1]));
      var rx = fixed[2 * k] ? Ku[2 * k] - F[2 * k] : 0, ry = fixed[2 * k + 1] ? Ku[2 * k + 1] - F[2 * k + 1] : 0;
      if (!fixed[2 * k]) residual = Math.max(residual, Math.abs(Ku[2 * k] - F[2 * k]));
      if (!fixed[2 * k + 1]) residual = Math.max(residual, Math.abs(Ku[2 * k + 1] - F[2 * k + 1]));
      if (fixed[2 * k] || fixed[2 * k + 1]) reactions.push({ node: n.id, rx: rx, ry: ry, fixedX: fixed[2 * k], fixedY: fixed[2 * k + 1] });
    });
    var sumRx = 0, sumRy = 0;
    reactions.forEach(function (R) { sumRx += R.rx; sumRy += R.ry; });

    out.ok = true;
    // true: compatible loads on a kinematically unstable truss.
    out.unbraced = unbraced;
    out.converged = converged;
    out.iterations = iter;
    out.u = u;
    out.reactions = reactions;
    out.residual = residual;
    out.globalResidual = Math.hypot(sumFx + sumRx, sumFy + sumRy);
    out.loadScale = loadScale;
    out.sumLoads = { fx: sumFx, fy: sumFy };
    out.forces = members.map(function (m, k) {
      var n = Math.abs(N[k]) < zeroForceKN ? 0 : N[k];
      return {
        id: m.id, N: n, L: geo[k].L, c: geo[k].c, s: geo[k].s, EA: EA[k],
        kind: n > 0 ? 'tie' : n < 0 ? 'strut' : 'zero'
      };
    });
    return out;
  }

  var api = { solve: solve, concreteModulus: concreteModulus, linearSolve: linearSolve, supportDofs: supportDofs, ZERO_FORCE_KN: ZERO_FORCE_KN };
  root.QST = root.QST || {};
  root.QST.solver = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
