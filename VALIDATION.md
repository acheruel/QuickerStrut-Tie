# Validation

*QuickerStrut&Tie v0.2 · 2026-11-01*

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
| α1 (S6) | 0.85 − 0.0015 × 35 = 0.7975 | 0.7975 |
| Node N3 (CCC) | α1 × 0.75 × 35 = 20.93 MPa; plate 2000e3 / (300 × 400) = 16.67 MPa | 0.80 |
| Node N1 (CCT) | 0.88 α1 × 0.75 × 35 = 18.42 MPa; strut 1414.2e3 / (300 × 400) = 11.79 MPa | 0.64 |

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

## 4. Published examples (literature)

### 4.1 FHWA-NHI-17-071, *Strut-and-Tie Modeling (STM) for Concrete Structures — Design Examples*, Design Example 1

Simply supported deep beam, h = 72 in, b = 48 in, span 27 ft, two factored loads of
600 kips at 9 ft from the bearings, truss height 64 in (tie centroid 5 in above the
soffit, top nodes 3 in below the top). Built-in example **Deep beam · FHWA manual, ex. 1**
(converted to SI). The manual's truss is a mechanism for any other load case; a bracing
diagonal BF is added and carries no force.

| Member | Manual, Table 1-1 (kips) | App (kips) |
| --- | --- | --- |
| AB | +506 | +506.3 |
| BC | +1,013 | +1,012.5 |
| BD | +600 | +600.0 |
| AD | −785 | −785.0 |
| BE | −785 | −785.0 |
| CF | −1,177 | −1,176.9 |
| DE | −506 | −506.2 |
| EF | −1,013 | −1,012.5 |

In its first iteration the manual finds the inclined strut CF (at node F) and the top
strut EF insufficient, then lengthens the plates to 14 in and reinforces the top strut.
With the same initial geometry, the CSA S6 check flags exactly these two struts
(CF and EF > 1.0, every other bar ≤ 1.0). CF is even more critical under CSA because of
the ε1-based limit (θs = 30.7°, fcu = 11.9 MPa), which the manual's specification
replaces by fixed efficiency factors.

### 4.2 NCHRP Project 20-07, Task 217 (2007), *Verification and Implementation of Strut-and-Tie Model in LRFD Bridge Design*, example 4.2.1.1

Deep beam test specimen, f′c = 4.13 ksi, 6 No. 8 bars, t = 12 in, αs = 37.376°.

| Quantity | Report | App |
| --- | --- | --- |
| T1 / C1 / C2 for R = 220.7 kips | 288.9 / 363.5 / 288.9 kips | 288.9 / 363.5 / 288.9 kips |
| ε1 for εs = 0.00105 | 0.0063 | 0.00627 |
| fcu | 0.53 f′c | 0.536 f′c |
| Pn of C1 (w = 13.73 in) | 363.5 kips | 364.8 kips (0.4 %) |

The report also tabulates the CSA provisions used here: A23.3 strut limit 0.85 f′c,
nodes 0.85 / 0.75 / 0.65 f′c, crack control ρ ≥ 0.002; S6 strut limit α1 f′c with
α1 = 0.85 − 0.0015 f′c, nodes α1 / 0.88 α1 φc f′c for CCC / CCT, crack control
ρ ≥ 0.003 (not more than 1500 mm²/m per face). These values replaced the A23.3 limits
that version 0.1 applied to S6 as well. The CTT factor 0.76 α1 is not legible in the
report and must be confirmed against the standard.

### 4.3 Half-joint seat (appui en chaise)

Orthogonal half-joint model (hanger at the re-entrant corner, horizontal nib
reinforcement extended into the full-depth section) as described in the half-joint
literature (e.g. Desnerck, Lees & Morley, *Strut-and-tie models for deteriorated
reinforced concrete half-joints*, Engineering Structures 161, 2018, Fig. 3). Built-in
example **Half-joint seat (dapped end)**: 1 m strip, h = 1.2 m, nib 0.6 m deep and
0.45 m long, reaction R = 600 kN at the bearing (0.20; 0.68).

| Quantity | Classical relation | App |
| --- | --- | --- |
| Nib strut angle α | atan(0.44 / 0.35) = 51.5° | 51.5° |
| Hanger (vertical ties at the dap) | R = 600.0 kN | 600.0 kN |
| Nib horizontal tie | R cot α = 477.3 kN | 477.3 kN |
| Inclined nib strut | R / sin α = 766.7 kN | 766.7 kN |
| Top chord at the dap | R cot α = 477.3 kN | 477.3 kN |

Hanger 6-20M: Tr = 0.90 × 400 × 1800 = 648 kN (0.93); nib tie 5-20M: 540 kN (0.88).

## 5. Other automated checks

- Linear solver against an exact 2 × 2 system; singular matrix detection.
- Mechanism detection when a support is removed; zero-length and missing-node members.
- Zero force in a hanger on a split tie; two-pin deep beam (indeterminate, r = 1):
  equilibrium, symmetry, thrust taken by the rigid pins.
- φ overrides, εs = fy / Es option, fcu cap at 0.85 f′c.
- Node classification (collinear ties count once).
- Every example: stable, determinate, nodal and global equilibrium residual < 10⁻⁶ kN,
  every node and member inside the concrete outline, maximum utilization ≤ 1 (except
  the FHWA example, kept with the manual's initial geometry).
- S6 α1 limits and the 1500 mm²/m crack control cap; a tie collinear with a strut does
  not reduce its strength.
- Hydrostatic zones: force polygon closure < 10⁻⁹, every face perpendicular to its force,
  uniform stress, symmetric CCC node widths (300 / √2 mm for 45° struts and a 300 mm plate),
  tie as a back-face push at CCT nodes.
- Development lengths (straight, top bar, hook, 300 mm minimum, √f′c ≤ 8 MPa) and the
  available anchorage length (cover, strut edge `w/2 / sin θ`); no check at a symmetry
  plane or where a tie continues.
- Templates (nine parameter sets): stable, equilibrium < 10⁻⁶ kN, inside the outline,
  sized to utilization ≤ 1; bent cap indeterminacy `r = ncol − 2`; dapped end hanger = R and
  nib tie = R cot α; pile head loads P/2, P/3, P/4 and the 4-pile tie
  `(P/2)(s/2)/z`; 3D tie factors 0.5 and 1/√3.
- Every interface string exists in French and English.
