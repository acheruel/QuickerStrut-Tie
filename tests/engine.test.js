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
  // Nodes: N3 is CCC (0.85 φc f'c), N1 is CCT (0.75 φc f'c).
  const n3 = byId(c.nodes, 'N3'), n1 = byId(c.nodes, 'N1');
  assert.equal(n3.type, 'CCC'); assert.equal(n1.type, 'CCT');
  close(n3.limit, 0.85 * 0.75 * 35, 1e-12); close(n1.limit, 0.75 * 0.75 * 35, 1e-12);
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
    assert.equal(r.indeterminacy, 0, ex.key + ' determinate');
    assert.deepEqual(csa.geometryWarnings(m), [], ex.key + ' inside outline');
    assert.ok(c.maxUtil > 0.2 && c.maxUtil <= 1, ex.key + ' designed: ' + c.maxUtil);
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
