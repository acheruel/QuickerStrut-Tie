# Validation

*QuickerStrut&Tie v0.1 · 2026-11-01*

The engine (`app/js/solver.js`, `app/js/csa.js`) is checked against hand calculations by
the automated tests in `tests/engine.test.js` (`node --test`). The cases below are
the built-in examples; the values match the application to the displayed precision.

## 1. Deep beam, central load — CSA S6

Outline 3.6 × 1.8 m, b = 400 mm, f′c = 35 MPa, fy = 400 MPa. Supports at (0.30; 0.15) and
(3.30; 0.15), load P = 2000 kN at (1.80; 1.65). Struts w = 300 mm, tie 6-25M
(As = 3000 mm²), plates 300 mm.

| Quantity | Hand calculation | App |
| --- | --- | --- |
| Strut angle | atan(1.5 / 1.5) = 45° | 45.0° |
| Strut force | P / (2 sin 45°) = 1414.2 kN | 1414.2 kN |
| Tie force | P / (2 tan 45°) = 1000.0 kN | 1000.0 kN |
| Tr | 0.90 × 400 × 3000 = 1080 kN | 1080 kN, 0.93 |
| εs | 1000e3 / (200 000 × 3000) = 1.667 ‰ | 1.667 ‰ |
| ε1 | 1.667 + (1.667 + 2)·cot²45° = 5.333 ‰ | 5.333 ‰ |
| fcu | 35 / (0.8 + 170 × 0.005333) = 20.51 MPa | 20.51 MPa |
| Cr | 0.75 × 20.51 × 300 × 400 = 1846 kN | 1846 kN, 0.77 |
| Node N3 (CCC) | 0.85 × 0.75 × 35 = 22.31 MPa; plate 2000e3 / (300 × 400) = 16.67 MPa | 0.75 |
| Node N1 (CCT) | 0.75 × 0.75 × 35 = 19.69 MPa; strut 1414.2e3 / (300 × 400) = 11.79 MPa | 0.60 |

## 2. Double corbel — CSA A23.3

b = 400 mm, f′c = 40 MPa. Loads 600 kN at (±0.45; 1.00), column nodes at (±0.15; 0.40) and
(±0.15; 0.00). Top tie 4-20M (As = 1200 mm²), inclined struts w = 150 mm.

| Quantity | Hand calculation | App |
| --- | --- | --- |
| Inclined strut | 600 × √(0.3² + 0.6²) / 0.6 = 670.8 kN | 670.8 kN |
| Tie | 600 × 0.3 / 0.6 = 300.0 kN | 300.0 kN |
| Horizontal strut between column nodes | 300.0 kN | 300.0 kN |
| Tr | 0.85 × 400 × 1200 = 408 kN | 408 kN, 0.74 |
| ε1 | 1.25 + (1.25 + 2)·cot²63.43° = 2.063 ‰ | 2.063 ‰ |
| fcu | 40 / (0.8 + 0.3506) = 34.76 → 0.85 f′c = 34.00 MPa | 34.00 MPa |
| Cr | 0.65 × 34.00 × 150 × 400 = 1326 kN | 1326 kN, 0.51 |
| Node N1 (CCT) | 0.75 × 0.65 × 40 = 19.50 MPa; strut 670.8e3 / (150 × 400) = 11.18 MPa | 0.57 |

The two diagonals that brace the model carry no force under the symmetric loading.

## 3. Hammerhead pier cap — statics

Four girder loads of 2500 kN at x = ±1.50 and ±3.30 m (y = 1.85 m), column nodes at
(±0.45; 0.20).

| Quantity | Hand calculation | App |
| --- | --- | --- |
| Outer tie | 2500 × 2.85 / 1.65 = 4318.2 kN | 4318.2 kN |
| Central tie | 4318.2 + 2500 × 1.05 / 1.65 = 5909.1 kN | 5909.1 kN |
| Bottom strut | equal to the central tie = 5909.1 kN | 5909.1 kN |
| Outer strut | 2500 × √(2.85² + 1.65²) / 1.65 = 4989.7 kN | 4989.7 kN |
| Reactions | 2 × 2500 = 5000 kN each | 5000 kN |

## 4. Other automated checks

- Linear solver against an exact 2 × 2 system; singular matrix detection.
- Mechanism detection when a support is removed; zero-length and missing-node members.
- Zero force in a hanger on a split tie; two-pin deep beam (indeterminate, r = 1):
  equilibrium, symmetry, thrust taken by the rigid pins.
- φ overrides, εs = fy / Es option, fcu cap at 0.85 f′c.
- Node classification (collinear ties count once).
- Every example: stable, determinate, nodal and global equilibrium residual < 10⁻⁶ kN,
  every node and member inside the concrete outline, maximum utilization ≤ 1.
- Every interface string exists in French and English.
