'use strict';
// Engine tests: truss solver, CSA checks and example models.
// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const solver = require('../app/js/solver.js');
const csa = require('../app/js/csa.js');
const examples = require('../app/js/examples.js');

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b}, got ${a}`);

function run(key) {
  const m = csa.normalize(examples.build(key, 'fr'));
  const r = solver.solve(m);
  return { m, r, c: csa.check(m, r) };
}
const byId = (list, id) => list.find((e) => e.id === id);

test('linearSolve solves a small system and flags a singular one', () => {
  const s = solver.linearSolve([[4, 1], [1, 3]], [1, 2]);
  close(s.x[0], 1 / 11, 1e-12); close(s.x[1], 7 / 11, 1e-12);
  assert.equal(solver.linearSolve([[1, 2], [2, 4]], [1, 2]).singular, 1);
});

test('triangle truss matches statics (deep beam, central load)', () => {
  const { r } = run('deep-beam-1');
  assert.ok(r.ok);
  assert.equal(r.indeterminacy, 0);
  // P = 2000 kN, 45° struts: C = P / (2 sin 45°), T = P / 2.
  close(-byId(r.forces, 'M1').N, 2000 / (2 * Math.SQRT1_2), 1e-6, 'strut');
  close(byId(r.forces, 'M3').N, 1000, 1e-6, 'tie');
  const R1 = r.reactions.find((x) => x.node === 'N1'), R2 = r.reactions.find((x) => x.node === 'N2');
  close(R1.ry, 1000, 1e-6); close(R2.ry, 1000, 1e-6); close(R1.rx, 0, 1e-6);
  assert.ok(r.globalResidual < 1e-6);
});

test('CSA S6 strut, tie and node checks (hand calculation)', () => {
  const { c } = run('deep-beam-1');
  // Tie: Tr = 0.90 × 400 × 3000 = 1080 kN.
  const tie = byId(c.members, 'M3');
  close(tie.capacity, 1080, 1e-9); close(tie.util, 1000 / 1080, 1e-9);
  // Strut: εs = 1000e3 / (200000 × 3000); ε1 = εs + (εs + 0.002)·cot²45°.
  const es = 1000e3 / (200000 * 3000), e1 = es + (es + 0.002);
  const fcu = 35 / (0.8 + 170 * e1);
  const strut = byId(c.members, 'M1');
  close(strut.eps1, e1, 1e-12); close(strut.fcu, fcu, 1e-9);
  close(strut.capacity, 0.75 * fcu * 300 * 400 / 1000, 1e-9);
  // S6 nodes: N3 is CCC (α1 φc f'c), N1 is CCT (0.88 α1 φc f'c), α1 = 0.85 − 0.0015 f'c.
  const a1 = 0.85 - 0.0015 * 35;
  const n3 = byId(c.nodes, 'N3'), n1 = byId(c.nodes, 'N1');
  assert.equal(n3.type, 'CCC'); assert.equal(n1.type, 'CCT');
  close(n3.limit, a1 * 0.75 * 35, 1e-12); close(n1.limit, 0.88 * a1 * 0.75 * 35, 1e-12);
  // Load plate 300 mm: σ = 2000e3 / (300 × 400) governs N3.
  close(n3.util, (2000e3 / (300 * 400)) / n3.limit, 1e-9);
});

test('fcu formula and 0.85 f\'c cap', () => {
  const r = csa.strutFcu(35, 0.002, Math.PI / 2); // cot 90° = 0 → ε1 = εs
  close(r.eps1, 0.002, 1e-15); close(r.fcu, Math.min(35 / (0.8 + 0.34), 0.85 * 35), 1e-12);
  const capped = csa.strutFcu(40, 0, Math.PI / 2);
  assert.equal(capped.fcu, 0.85 * 40); assert.ok(capped.capped);
});

test('A23.3 factors and crack control minimum', () => {
  const { c, m } = run('double-corbel');
  assert.equal(m.code, 'A23');
  close(c.phiC, 0.65, 0); close(c.phiS, 0.85, 0);
  close(c.crack.rhoMin, 0.002, 0);
  // Tie: Tr = 0.85 × 400 × 1200 = 408 kN for T = 300 kN.
  close(byId(c.members, 'M1').capacity, 408, 1e-9);
  close(byId(c.members, 'M1').demand, 300, 1e-6);
});

test('phi overrides replace the code values', () => {
  const m = csa.normalize(examples.build('deep-beam-1'));
  m.material.phiC = 0.8; m.material.phiS = 0.95;
  const c = csa.check(m, solver.solve(m));
  close(c.phiC, 0.8, 0); close(c.phiS, 0.95, 0);
  close(byId(c.members, 'M3').capacity, 0.95 * 400 * 3000 / 1000, 1e-9);
});

test('yield strain option uses fy / Es', () => {
  const m = csa.normalize(examples.build('deep-beam-1'));
  m.material.epsMode = 'yield';
  const c = csa.check(m, solver.solve(m));
  close(byId(c.members, 'M1').epsS, 400 / 200000, 1e-15);
});

test('a mechanism is detected and the free node reported', () => {
  const m = csa.normalize(examples.build('deep-beam-1'));
  m.nodes.find((n) => n.id === 'N2').support = null;
  const r = solver.solve(m);
  assert.equal(r.ok, false); assert.equal(r.error, 'mechanism');
  assert.ok(['N1', 'N2', 'N3'].includes(r.mechanismNode));
});

test('zero-length and missing-node members are rejected', () => {
  const m = csa.normalize(examples.build('deep-beam-1'));
  m.nodes.push({ id: 'N9', x: 0.3, y: 0.15 });
  m.members.push({ id: 'M9', i: 'N1', j: 'N9', role: 'auto', w: 100, As: 0 });
  assert.equal(solver.solve(m).error, 'zeroLength');
  m.members[3].j = 'N99';
  assert.equal(solver.solve(m).error, 'missingNode');
});

test('a hanger on a split tie carries no force', () => {
  const m = csa.normalize(examples.build('deep-beam-1'));
  m.nodes.push({ id: 'N4', x: 1.8, y: 0.15, support: null, fx: 0, fy: 0, bearing: 0 });
  m.members = m.members.filter((b) => b.id !== 'M3');
  m.members.push({ id: 'M3', i: 'N1', j: 'N4', role: 'auto', w: 300, bars: { n: 6, size: '25M' }, As: 0 });
  m.members.push({ id: 'M4', i: 'N4', j: 'N2', role: 'auto', w: 300, bars: { n: 6, size: '25M' }, As: 0 });
  m.members.push({ id: 'M5', i: 'N3', j: 'N4', role: 'auto', w: 300, bars: { n: 4, size: '20M' }, As: 0 });
  csa.normalize(m);
  const r = solver.solve(m);
  assert.ok(r.ok); assert.equal(r.indeterminacy, 0);
  assert.equal(byId(r.forces, 'M5').kind, 'zero');
  close(byId(r.forces, 'M3').N, 1000, 1e-6);
});

test('indeterminate truss (two pins): equilibrium, symmetry and rigid pins take the thrust', () => {
  const m = csa.normalize(examples.build('deep-beam-1'));
  m.nodes.find((n) => n.id === 'N2').support = 'pin';
  const r = solver.solve(m);
  assert.ok(r.ok); assert.equal(r.indeterminacy, 1);
  assert.ok(r.residual < 1e-6 && r.globalResidual < 1e-6, 'equilibrium');
  close(byId(r.forces, 'M1').N, byId(r.forces, 'M2').N, 1e-6, 'symmetry');
  // Rigid pins are infinitely stiff: they take the whole thrust, the tie none.
  const R1 = r.reactions.find((x) => x.node === 'N1');
  close(R1.rx, 1000, 1e-6, 'thrust taken by the pins');
  assert.equal(byId(r.forces, 'M3').kind, 'zero');
});

test('every example solves, is in equilibrium and lies inside its outline', () => {
  for (const ex of examples.EXAMPLES) {
    const { m, r, c } = run(ex.key);
    assert.ok(r.ok, ex.key + ' solves');
    assert.ok(r.residual < 1e-6 && r.globalResidual < 1e-6, ex.key + ' equilibrium');
    assert.ok(r.indeterminacy <= 0 && r.converged, ex.key + ' has no redundant bar');
    assert.deepEqual(r.forces.filter((f) => f.kind === 'zero'), [], ex.key + ' has no bar without force');
    assert.deepEqual(csa.geometryWarnings(m), [], ex.key + ' inside outline');
    if (!ex.literature) assert.ok(c.maxUtil > 0.2 && c.maxUtil <= 1, ex.key + ' designed: ' + c.maxUtil);
  }
});

test('hammerhead pier cap matches statics', () => {
  const { r } = run('hammerhead');
  // Tip strut N4–N6: dx = 2.85, dy = 1.65; T = P·dx/dy.
  close(byId(r.forces, 'M3').N, 2500 * 2.85 / 1.65, 1e-6);
  close(byId(r.forces, 'M2').N, 2500 * 2.85 / 1.65 + 2500 * 1.05 / 1.65, 1e-6);
  close(-byId(r.forces, 'M8').N, byId(r.forces, 'M2').N, 1e-6, 'bottom strut balances top tie');
});

test('node classification: collinear ties count as one direction', () => {
  const { c } = run('hammerhead');
  assert.equal(byId(c.nodes, 'N2').type, 'CCT');
  assert.equal(byId(c.nodes, 'N5').type, 'CCC');
});

// ---------------------------------------------------------------- literature
test('FHWA-NHI-17-071, design example 1: published truss forces are reproduced', () => {
  const { r, c } = run('fhwa-deep-beam');
  const kips = (id) => byId(r.forces, id).N / 4.448222;
  // Table 1-1 of the manual (kips, + tension): AB +506, BC +1013, BD +600,
  // AD −785, BE −785, CF −1177, DE −506, EF −1013.
  const published = { AB: 506, BC: 1013, BD: 600, AD: -785, BE: -785, CF: -1177, DE: -506, EF: -1013 };
  for (const [id, v] of Object.entries(published)) close(kips(id), v, 0.6, id);
  // As published: no bracing diagonal in the panel B–E–F–C (in equilibrium under these loads).
  assert.ok(r.unbraced && r.residual < 1e-6);
  // The manual's first iteration finds strut CF (node F) and the top strut EF
  // insufficient; the CSA S6 check flags the same two struts.
  assert.ok(byId(c.members, 'CF').util > 1 && byId(c.members, 'EF').util > 1);
  for (const id of ['AB', 'BC', 'BD', 'AD', 'BE', 'DE']) assert.ok(byId(c.members, id).util <= 1, id);
});

test('NCHRP 20-07/217 deep beam: ε1 = 0.0063 and fcu = 0.53 f\'c (εs = 0.00105, αs = 37.376°)', () => {
  const r = csa.strutFcu(4.13, 0.00105, 37.376 * Math.PI / 180);
  close(r.eps1, 0.0063, 0.00005, 'ε1');
  close(r.fcu / 4.13, 0.53, 0.01, 'fcu / f\'c');
  // Strut C1: Pn = fcu · w · t with w = 13.73 in, t = 12 in → 363.5 kips (published).
  close(r.fcu * 13.73 * 12, 363.5, 363.5 * 0.006, 'Pn');
});

test('NCHRP 20-07/217 deep beam: forces for αs = 37.376° and T1 = 288.9 kips', () => {
  const m = csa.normalize(examples.build('deep-beam-2'));
  // Same two-load layout; rise / run chosen for αs = 37.376°.
  const a = 1.0, rise = Math.tan(37.376 * Math.PI / 180) * a;
  const P = 220.7 * 4.448222;
  const nodes = { N1: [0, 0], N2: [3 * a, 0], N3: [a, rise], N4: [2 * a, rise] };
  m.nodes.forEach((n) => { [n.x, n.y] = nodes[n.id]; n.fy = n.id === 'N3' || n.id === 'N4' ? -P : 0; });
  const r = solver.solve(m);
  close(byId(r.forces, 'M4').N / 4.448222, 288.9, 0.2, 'T1');
  close(-byId(r.forces, 'M1').N / 4.448222, 363.5, 0.2, 'C1');
  close(-byId(r.forces, 'M2').N / 4.448222, 288.9, 0.2, 'C2');
});

test('Paultre (2011) ex. 13.2, double corbel: published forces, stresses and steel area', () => {
  const { r, c } = run('paultre-corbel');
  close(byId(r.forces, 'AB').N, 308, 1, 'tie AB');
  close(-byId(r.forces, 'AC').N, 423, 1, 'strut AC');
  // Horizontal strut between the two C nodes: 0.85 φc f'c b hc with hc = 31 mm.
  close(-byId(r.forces, 'CC2').N, 0.85 * 0.65 * 40 * 350 * 31 / 1000, 2, 'strut CC');
  close(byId(c.members, 'AB').asReq, 906, 1, 'As required');
  const A = byId(c.nodes, 'A'), C = byId(c.nodes, 'C');
  assert.equal(A.type, 'CCT'); assert.equal(C.type, 'CCC');
  close(A.faces.find((f) => f.ref === 'AC').stress, 15.9, 0.05, 'f_c at A');
  close(A.limit, 19.5, 0.05, 'CCT limit');
  close(C.faces.find((f) => f.kind === 'support').stress, 5.7, 0.05, 'bearing stress at C');
});

test('CAC Concrete Design Handbook ex. 4.10, dapped-end beam: the 24 published forces', () => {
  const { r, c } = run('cac-dapped-end');
  const pub = { AB: -513, DB: -328, AD: 401, CB: 611, CD: -781, DE: -434, BE: -137, CF: 487, EF: 268, EG: -407, FG: -407, FH: 794,
    GH: 184, GI: -713, HI: -280, HJ: 1004, IJ: 100, IK: -924, JK: -152, JL: 1118, KL: 29, KM: -1038, LM: -37, LN: 1141 };
  for (const [id, N] of Object.entries(pub)) close(byId(r.forces, id).N, N, 1, id);
  close(r.reactions.find((x) => x.node === 'M').rx, -1061, 1, 'top chord at midspan');
  // Back face of node C (CTT, φc = 0.70): Pnr = 0.65 × 0.70 × 40 × (2 × 60) × 400 = 873.6 kN.
  const C = byId(c.nodes, 'C');
  assert.equal(C.type, 'CTT');
  close(C.faces.find((f) => f.ref === 'CF').util, 487 / 873.6, 0.002, 'back face of C');
  // Straight 30M bars at C: la ≈ 180 mm against ld ≈ 854 mm, as in the handbook (U-bars added there).
  const an = c.anchors.find((x) => x.id === 'CF@C');
  close(an.req, 854, 5, 'ld'); assert.ok(an.util > 1);
});

test('half-joint seat: classical relations (hanger = R, nib tie = R cot α, strut = R / sin α)', () => {
  const { r, c } = run('half-joint');
  const R = r.reactions.find((x) => x.node === 'N1').ry;
  close(R, 600, 1e-6);
  const alpha = Math.atan2(1.12 - 0.68, 0.55 - 0.2);
  close(byId(r.forces, 'M3').N, R, 1e-6, 'hanger');
  close(byId(r.forces, 'M2').N, R / Math.tan(alpha), 1e-6, 'nib tie');
  close(-byId(r.forces, 'M1').N, R / Math.sin(alpha), 1e-6, 'nib strut');
  close(-byId(r.forces, 'M4').N, R / Math.tan(alpha), 1e-6, 'top chord at the dap');
  assert.ok(c.maxUtil <= 1);
});

test('CSA S6: α1 caps fcu and sets the nodal limits; A23.3 keeps 0.85 / 0.75 / 0.65', () => {
  close(csa.alpha1(35), 0.7975, 1e-12); close(csa.alpha1(150), 0.67, 1e-12);
  const S6 = csa.CODES.S6, A23 = csa.CODES.A23;
  close(S6.node('CCT', 35), 0.88 * 0.7975, 1e-12); close(S6.node('CTT', 35), 0.76 * 0.7975, 1e-12);
  close(A23.node('CTT', 35), 0.65, 0);
  // Strut without adjoining tie: fcu = α1 f'c (S6), 0.85 f'c (A23.3).
  const m = csa.normalize(examples.build('deep-beam-2'));
  let c = csa.check(m, solver.solve(m));
  close(byId(c.members, 'M2').fcu, 0.7975 * 35, 1e-9);
  m.code = 'A23';
  c = csa.check(m, solver.solve(m));
  close(byId(c.members, 'M2').fcu, 0.85 * 35, 1e-9);
});

test('CSA S6 crack control: the grid need not exceed 1500 mm²/m per face', () => {
  const { c } = run('hammerhead'); // b = 1500 mm → 2 × 1500 / (1500 × 1000) = 0.002
  close(c.crack.rhoMin, 0.002, 1e-12); assert.ok(c.crack.capped);
  const { c: c2 } = run('deep-beam-1'); // b = 400 mm → 0.003 governs
  close(c2.crack.rhoMin, 0.003, 1e-12);
});

test('a tie collinear with a strut does not reduce the strut strength', () => {
  const { c } = run('half-joint');
  const m8 = byId(c.members, 'M8'); // strut N5–N4 above the stirrup tie N4–N6
  assert.ok(m8.ends.every((e) => e.tie !== 'M9'));
  assert.ok(m8.util < 1 && isFinite(m8.util));
});

// ------------------------------------------------- hydrostatic nodal zones
test('hydrostatic zone: closed polygon, faces ⟂ forces, uniform stress, widths ∝ forces', () => {
  const { c, m } = run('deep-beam-1');
  const z = byId(c.nodes, 'N3').zone; // CCC: two struts + load plate 300 mm
  assert.ok(z && z.poly.length === 3);
  assert.ok(z.closure < 1e-9, 'force polygon closes');
  close(z.sigma, 2000e3 / (300 * 400), 1e-9, 'σh set by the load plate');
  for (const fa of z.faces) {
    const ex = fa.b[0] - fa.a[0], ey = fa.b[1] - fa.a[1], L = Math.hypot(ex, ey);
    close(L * 1000, fa.wHydro, 1e-6, 'face length');
    close((ex * fa.ux + ey * fa.uy) / L, 0, 1e-9, 'face ⟂ force');
    close(fa.force * 1000 / (fa.wHydro * m.material.b), z.sigma, 1e-9, 'uniform stress');
  }
  // Symmetric node: both strut faces equal; load face = 2 cos45° × strut face.
  const s = z.faces.filter((f) => f.kind === 'strut');
  close(s[0].wHydro, s[1].wHydro, 1e-9);
  close(z.faces.find((f) => f.kind === 'load').wHydro, 300, 1e-9);
  close(s[0].wHydro, 300 / Math.SQRT2, 1e-6);
});

test('hydrostatic zone: a CCT node uses the tie as a back-face push', () => {
  const { c } = run('deep-beam-1');
  const z = byId(c.nodes, 'N1').zone;
  assert.deepEqual(z.faces.map((f) => f.kind).sort(), ['strut', 'support', 'tie']);
  const tie = z.faces.find((f) => f.kind === 'tie');
  close(tie.ux, -1, 1e-12, 'back face normal points away from the tie');
  for (const n of c.nodes) if (n.zone) assert.ok(n.zone.closure < 1e-9, n.id);
});

// ------------------------------------------------------------ anchorage
test('development lengths (A23.3 12.2.3 / 12.5, simplified)', () => {
  // 25M (db 25.2), fy 400, f'c 35: ld = 0.45 × 1.0 × 400 / √35 × 25.2
  close(csa.developmentLength('straight', 25.2, 400, 35, {}), 0.45 * 400 / Math.sqrt(35) * 25.2, 1e-9);
  close(csa.developmentLength('straight', 19.5, 400, 35, { top: true }), 0.45 * 1.3 * 0.8 * 400 / Math.sqrt(35) * 19.5, 1e-9);
  close(csa.developmentLength('hook', 25.2, 400, 35, {}), 100 * 25.2 / Math.sqrt(35), 1e-9);
  close(csa.developmentLength('straight', 10, 400, 80, {}), 300, 0, 'minimum 300 mm, √f\'c ≤ 8');
});

test('anchorage: available length = critical section + extension − cover', () => {
  const { c } = run('deep-beam-1');
  const a = c.anchors.find((x) => x.member === 'M3' && x.node === 'N1');
  close(a.e, 300 - 50, 1e-6, 'node 0.30 m from the end, 50 mm cover');
  close(a.dc, Math.max(150 / Math.sin(Math.PI / 4), 0), 0.5, 'strut edge on the tie axis (w/2 / sin θ)');
  close(a.la, a.dc + a.e, 1e-9);
  close(a.req, 100 * 25.2 / Math.sqrt(35), 1e-9, 'standard hook');
  close(a.util, a.req / a.la, 1e-12);
  // No anchorage check at a symmetry plane or where a tie continues.
  const hj = run('half-joint').c;
  assert.ok(!hj.anchors.some((x) => x.node === 'N10'));
  assert.ok(!hj.anchors.some((x) => x.id === 'M11@N6' || x.id === 'M11@N8'), 'the bottom chord continues through N6 and N8');
});

test('continuous bars: no anchorage where they bend into another tie or leave the D-region, straight bar elsewhere', () => {
  const ia = run('integral-abutment').c;
  for (const id of ['M1@D1', 'M1@K1', 'M5@K1']) {
    const a = ia.anchors.find((x) => x.id === id);
    assert.ok(a && a.mechanical && a.type === 'continuous', id);
  }
  // Corbel column ties M5: N4 has the far-face bars to continue into, N3 (free,
  // unloaded, struts only) has nothing, so the bars are checked as straight bars there.
  const m = csa.normalize(examples.build('bridge-corbel', 'fr'));
  m.members.find((x) => x.id === 'M5').anchor = 'continuous';
  const c = csa.check(m, solver.solve(m));
  assert.ok(c.anchors.find((x) => x.id === 'M5@N4').mechanical, 'bent into the far-face bars');
  const a = c.anchors.find((x) => x.id === 'M5@N3');
  assert.equal(a.type, 'straight'); assert.ok(!a.mechanical && a.req >= 300);
});

test('every anchorage type used by the examples is a known type (the loader resets unknown ones)', () => {
  for (const ex of examples.EXAMPLES) for (const m of ex.model.members) if (m.anchor) assert.ok(csa.ANCHORS.includes(m.anchor), ex.key + ' ' + m.id);
});

test('a tie crossing a symmetry plane has no anchorage face at the plane', () => {
  const c = run('cac-dapped-end').c;
  assert.ok(!c.nodes.some((n) => n.id === 'N' && n.faces.some((f) => f.kind === 'tie')));
});

test('bridge examples: corbel and integral abutment balance their loads', () => {
  const co = run('bridge-corbel');
  close(co.r.reactions.reduce((s, R) => s + R.ry, 0), 1400, 1e-6);
  close(co.r.reactions.reduce((s, R) => s + R.rx, 0), -280, 1e-6);
  // Corbel tie = horizontal load + horizontal component of the strut N1–N3 (dx 0.38, dy 0.87).
  close(byId(co.r.forces, 'M1').N, 280 + 1400 * 0.38 / 0.87, 1e-6);
  const ia = run('integral-abutment');
  close(ia.r.reactions.reduce((s, R) => s + R.ry, 0), 300, 1e-6);
  close(ia.r.reactions.reduce((s, R) => s + R.rx, 0), -(30 + 120), 1e-6);
  // Closing corner: deck top bars and back-face bars in tension, corner diagonal in compression.
  assert.ok(byId(ia.r.forces, 'M1').N > 0 && byId(ia.r.forces, 'M5').N > 0 && byId(ia.r.forces, 'M4').N < 0);
});

// ------------------------------------------------------------ templates
const templates = require('../app/js/templates.js');
function solveTpl(kind, p) {
  const g = templates[kind](p);
  templates.autoSize(g.model);
  const r = solver.solve(g.model);
  return { g, r, c: csa.check(g.model, r) };
}

test('templates generate stable, sized models inside their outline', () => {
  const cases = [['dappedEnd', {}], ['dappedEnd', { n: 1 }], ['dappedEnd', { n: 5, h: 1.5, hn: 0.7 }],
    ['bentCap', {}], ['bentCap', { ncol: 2, nGirders: 4, girderSpacing: 2.4 }], ['bentCap', { ncol: 4, nGirders: 6, spacing: 5 }],
    ['pileCap', { np: 2 }], ['pileCap', { np: 3 }], ['pileCap', { np: 4 }]];
  for (const [k, p] of cases) {
    const { g, r, c } = solveTpl(k, p);
    const tag = k + ' ' + JSON.stringify(p);
    assert.deepEqual(g.errors, [], tag + ' parameters');
    assert.ok(r.ok && r.converged, tag + ' solves');
    assert.ok(r.residual < 1e-6 && r.globalResidual < 1e-6, tag + ' equilibrium');
    assert.deepEqual(csa.geometryWarnings(g.model), [], tag + ' inside outline');
    assert.ok(c.maxUtil <= 1.0, tag + ' sized: ' + c.maxUtil.toFixed(2) + ' ' + c.governing.id);
  }
});

test('bent cap: reactions balance the girders', () => {
  for (const ncol of [2, 3, 4]) {
    const { r } = solveTpl('bentCap', { ncol, nGirders: 5, spacing: 5, overhang: 1.8, girderSpacing: 3.0, P: 1000 });
    close(r.reactions.reduce((s, R) => s + R.ry, 0), 5000, 1e-6);
  }
});

test('templates keep no bar without force and number their nodes and bars without gaps', () => {
  for (const [k, p] of [['dappedEnd', {}], ['bentCap', {}], ['bentCap', { ncol: 4, nGirders: 6, spacing: 5 }], ['pileCap', { np: 4 }]]) {
    const g = templates[k](p), r = solver.solve(csa.normalize(g.model));
    assert.deepEqual(r.forces.filter((f) => f.kind === 'zero'), [], k);
    assert.deepEqual(g.model.nodes.map((n) => n.id), g.model.nodes.map((n, i) => 'N' + (i + 1)), k);
    assert.deepEqual(g.model.members.map((m) => m.id), g.model.members.map((m, i) => 'M' + (i + 1)), k);
  }
});

// ------------------------------------------------- models without bracing bars
test('a model in equilibrium under its loads needs no bracing bar; other loads make it a mechanism', () => {
  // Trapezoid deep beam: 4 nodes, 4 bars, 3 reactions: one mechanism mode (sway of the top strut).
  const m = csa.normalize(examples.build('deep-beam-2'));
  let r = solver.solve(m);
  assert.ok(r.ok && r.unbraced && r.indeterminacy === -1);
  // a = 1.3 m, z = 1.85 m: T = P a / z, inclined strut = P √(a² + z²) / z, top strut = T.
  close(byId(r.forces, 'M4').N, 1800 * 1.3 / 1.85, 1e-6, 'tie');
  close(-byId(r.forces, 'M2').N, 1800 * 1.3 / 1.85, 1e-6, 'top strut');
  close(-byId(r.forces, 'M1').N, 1800 * Math.hypot(1.3, 1.85) / 1.85, 1e-6, 'inclined strut');
  assert.ok(r.residual < 1e-6 && r.globalResidual < 1e-6);
  // Unequal loads set the trapezoid in motion: mechanism.
  m.nodes.find((n) => n.id === 'N4').fy = -900;
  r = solver.solve(m);
  assert.equal(r.ok, false); assert.equal(r.error, 'mechanism');
  // A node without any bar or load does not make the model invalid.
  m.nodes.find((n) => n.id === 'N4').fy = -1800;
  m.nodes.push({ id: 'N9', x: 2, y: 1, support: null, fx: 0, fy: 0, bearing: 0 });
  assert.ok(solver.solve(m).ok);
});

test('a stable truss is not reported as unbraced', () => {
  assert.equal(run('deep-beam-1').r.unbraced, false);
  assert.equal(run('bent-cap-20m').r.unbraced, false);
});

test('singular equilibrium preserves a weak loaded direction and identifies incompatible loads', () => {
  const K = [[0, 0, 0], [0, 1, 0], [0, 0, 1e9]];
  assert.deepEqual(solver.linearSolve(K, [0, 2, 1000], true), { x: [0, 2, 1e-6], unbraced: true });
  assert.deepEqual(solver.linearSolve(K, [0.001, 2, 1000], true), { singular: 0 });
});

test('template pruning keeps members that carry small loads', () => {
  const { model } = templates.pileCap({ np: 2, P: 0.01 });
  const r = solver.solve(model, 0);
  assert.ok(r.ok);
  assert.equal(model.members.length, 4);
  assert.ok(r.forces.every((f) => Math.abs(f.N) > 0 && Math.abs(f.N) < solver.ZERO_FORCE_KN));
  close(r.reactions.reduce((sum, reaction) => sum + reaction.ry, 0), 0.01, 1e-12);
});

test('20 m bent cap on 4 columns: statics of the direct-strut model', () => {
  const { r, c } = run('bent-cap-20m');
  assert.equal(r.indeterminacy, 0);
  const z = 1.7, P = 2000;
  close(byId(r.forces, 'M11').N, P * 0.6 / z, 1e-6, 'top tie over the outer column');
  close(byId(r.forces, 'M16').N, 0.5 * P * 2.6 / z, 1e-6, 'bottom tie of the central span');
  close(r.reactions.reduce((s, R) => s + R.ry, 0), 7 * P, 1e-6);
  const R = Object.fromEntries(r.reactions.map((x) => [x.node, x.ry]));
  close(R.B1, R.B4, 1e-6); close(R.B2, R.B3, 1e-6);
  assert.ok(Math.abs(R.B1 - R.B2) < 0.05 * R.B1, 'columns share the load almost equally');
  assert.ok(c.maxUtil <= 1);
});

test('dapped-end template: hanger = R and nib tie = R cot α', () => {
  const { g, r } = solveTpl('dappedEnd', { R: 800 });
  const n = (id) => g.model.nodes.find((x) => x.id === id);
  const A = n('N1'), D = n('N2'), alpha = Math.atan2(D.y - A.y, D.x - A.x);
  close(r.reactions.find((x) => x.node === 'N1').ry, 800, 1e-6);
  close(byId(r.forces, 'M3').N, 800, 1e-6, 'hanger');
  close(byId(r.forces, 'M2').N, 800 / Math.tan(alpha), 1e-6, 'nib tie');
});

test('pile caps: pile head loads and 3D tie factors', () => {
  const P = 9000;
  for (const [np, each] of [[2, P / 2], [3, P / 3], [4, P / 4]]) {
    const { g, r } = solveTpl('pileCap', { np, P });
    const pl = templates.pileLoads(g.model, r, { version: 'test' });
    assert.equal(pl.format, 'quickerpile-head-loads');
    assert.equal(pl.piles.length, np);
    for (const p of pl.piles) close(p.N, each, 1e-6, np + ' piles');
    close(pl.piles.reduce((s, p) => s + p.N, 0), P, 1e-6);
  }
  // 4-pile cap: 2D tie = R2D·(s/2)/z with R2D = P/2; each real tie carries half.
  const { g, r } = solveTpl('pileCap', { np: 4, P, s: 2.7 });
  const z = g.model.nodes.find((x) => x.id === 'N1').y - g.model.nodes.find((x) => x.id === 'N3').y;
  const xa = g.model.nodes.find((x) => x.id === 'N3').x, xc = g.model.nodes.find((x) => x.id === 'N1').x;
  close(byId(r.forces, 'M1').N, (P / 2) * (xc - xa) / z, 1e-6);
  assert.equal(g.model.meta.tie3D.factor, 0.5);
  close(solveTpl('pileCap', { np: 3 }).g.model.meta.tie3D.factor, 1 / Math.sqrt(3), 1e-12);
});

// ------------------------------------------------- fib Bulletin 61 (bridges)
test('fib Bulletin 61 ex. 1-4, box girder diaphragm: published forces (Rd = 6750 kN, 46°, webs at 10°)', () => {
  const { r } = run('fib-box-diaphragm');
  close(-byId(r.forces, 'C12').N, 4692, 1, 'strut 1-2');
  close(-byId(r.forces, 'C11').N, 3259, 1, 'strut 1-1\'');
  close(byId(r.forces, 'T22').N, 2664, 1, 'top tie 2-2\'');
  close(byId(r.forces, 'T1').N, 3427, 1, 'hanger = Vd');
  close(r.reactions.find((R) => R.node === 'N1').ry, 3375, 1e-6, 'bearing reaction');
});

test('fib Bulletin 61 ex. 13, pylon cross-beam diaphragm: published forces and stresses (V = 42 MN, 48.3°)', () => {
  const { r, c } = run('fib-pylon-crossbeam');
  close(byId(r.forces, 'T1').N, 18710, 5, 'T1');
  close(byId(r.forces, 'T2').N, 21000, 1e-6, 'T2');
  close(-byId(r.forces, 'C1').N, 28130, 5, 'C1');
  close(byId(c.nodes, 'N1').faces.find((f) => f.kind === 'load').stress, 9.52, 0.01, 'bearing stress on the 2.1 m diaphragm');
  close(byId(c.nodes, 'N2').faces.find((f) => f.ref === 'C1').stress, 8.66, 0.03, 'strut C1 at node N2');
  assert.equal(byId(c.nodes, 'N2').type, 'CTT');
});

test('fib Bulletin 61 ex. 13, pylon horizontal bearing: published forces (10 MN, 55° and 35°)', () => {
  const { r, c } = run('fib-pylon-bearing');
  close(byId(r.forces, 'T1').N, 1750, 5, 'T1');
  close(byId(r.forces, 'T2').N, 3570, 5, 'T2');
  close(-byId(r.forces, 'C1').N, 3050, 5, 'C1');
  close(-byId(r.forces, 'C2').N, 4360, 5, 'C2');
  close(r.reactions.find((R) => R.node === 'N').ry, -10000, 1e-6, 'bearing force');
  close(byId(c.nodes, 'N').faces.find((f) => f.kind === 'support').stress, 14.3, 0.05, 'bearing stress');
});

test('fib Bulletin 61 ex. 1-3, pile cap model A: published forces and the overstressed column node', () => {
  const { r, c } = run('fib-pile-cap');
  close(-byId(r.forces, 'C12').N, 2459, 2, 'strut 1-2');
  close(byId(r.forces, 'T11').N, 1192, 1, 'tie 1-1\'');
  close(-byId(r.forces, 'C22').N, 1194, 3, 'strut 2-2\'');
  const N2 = byId(c.nodes, 'N2');
  close(N2.faces.find((f) => f.kind === 'load').stress, 26.88, 0.01, 'column stress');
  close(N2.faces.find((f) => f.ref === 'C12').stress, 19.21, 0.02, 'strut 1-2 at node 2');
  close(N2.faces.find((f) => f.ref === 'C22').stress, 9.95, 0.03, 'strut 2-2\' at node 2');
  assert.ok(N2.util > 1, 'node 2 is overstressed in model A, as the bulletin finds');
});
