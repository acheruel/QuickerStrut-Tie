# Validation

*QuickerStrut&Tie v0.2.5 · 2026-11-01*

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

### 4.4 Paultre (2011), *Structures en béton armé*, example 13.2 — double corbel (CSA A23.3)

Column 350 mm, corbels 200 + 200 mm deep, b = 350 mm, f′c = 40 MPa, fy = 400 MPa,
Vf = 1.25 × 100 + 1.5 × 150 = 350 kN, Nf = 0.2 Vf = 70 kN per corbel. Full double corbel
(the book draws half of it): A at 330 mm from the axis and 28 mm under the top, C at
350 / 4 = 87.5 mm from the axis and hc / 2 = 15.5 mm above the corbel base. Strut AC width
76 mm = A_b at A (26 587 mm²) / b; CC strut width hc = 31 mm; 5-15M welded to the angle.

| Quantity | Paultre | App |
| --- | --- | --- |
| θ | tan θ = 1.47 → 55.8° | 55.8° |
| Strut AC | 350 / sin 55.8° = 423 kN | 423.3 kN |
| Tie AB | 423 cos 55.8° + 70 = 308 kN | 308.1 kN |
| Strut CC (hc = 31 mm) | 0.85 × 0.65 × 40 × 350 × 31 = 240 kN | 238.1 kN, 0.99 |
| As required | 308e3 / (0.85 × 400) = 906 mm² | 906 mm² (5-15M: 0.91) |
| f_c at A (CCT) | 423e3 / 26 587 = 15.9 ≤ 0.75 × 0.65 × 40 = 19.5 MPa | 15.9 / 19.5 = 0.82 |
| Bearing at C (CCC) | 350e3 / (350 × 175) = 5.7 ≤ 22.1 MPa | 5.71 MPa |
| fcu of AC (course note: εs = εy) | 0.687 f′c = 27.5 MPa | 29.8 MPa (εs = 1.54 ‰ computed) |

The node at A uses b = 350 mm where the book takes the 270 mm angle length: the app is
slightly less conservative on that face.

### 4.5 CAC *Concrete Design Handbook*, 4th ed., example 4.10 — beam with dapped end (CSA A23.3)

Beam 700 × 400 mm, span 6.3 m, wf = 127 kN/m, Nf = 80 kN (tension), f′c = 40 MPa,
fy = 400 MPa, precast plant φc = 0.70. Half beam with the published truss: bearing A
25 mm above the nib soffit (325 mm), chords at 637 and 60 mm, B–C hanger 250 mm from A,
D at 461 mm (from the 56° and 51° angles), panels 460 / 660 / 660 / 660 / 460 mm, top
loads 61, 71, 84, 84, 71 and 29 kN, symmetry at midspan.

| Member | Handbook (kN) | App (kN) | Member | Handbook (kN) | App (kN) |
| --- | --- | --- | --- | --- | --- |
| AB | −513 | −512.6 | GH | 184 | 184.0 |
| DB | −328 | −328.9 | GI | −713 | −713.4 |
| AD | 401 | 400.5 | HI | −280 | −279.6 |
| CB | 611 | 611.4 | HJ | 1004 | 1003.8 |
| CD | −781 | −781.6 | IJ | 100 | 100.0 |
| DE | −434 | −433.7 | IK | −924 | −923.8 |
| BE | −137 | −136.3 | JK | −152 | −151.9 |
| CF | 487 | 486.8 | JL | 1118 | 1118.2 |
| EF | 268 | 268.0 | KL | 29 | 29.0 |
| EG | −407 | −406.8 | KM | −1038 | −1038.2 |
| FG | −407 | −407.2 | LM | −37 | −37.1 |
| FH | 794 | 793.4 | LN | 1141 | 1141.4 |

All 24 forces within 1 kN (the handbook rounds its geometry). Further results:

| Quantity | Handbook / course correction | App |
| --- | --- | --- |
| As AD, CB, CF | 1179, 1797, 1432 mm² | 1178, 1798, 1432 mm² |
| Back face of C (CTT), 2 × 60 mm | Pnr = 0.65 × 0.70 × 40 × 48 000 = 873.6 kN ≥ 487 kN | 487 / 873.6 = 0.557 |
| Anchorage of CF at C, straight 30M | ld = 854 mm, 215 mm available → 300 kN < 487 kN | ld = 851 mm, la = 178 mm → 4.79 |

The anchorage of CF at node C governs, as in the handbook, which adds two 15M U-bars;
the course correction notes that these U-bars are not fully anchored either and checks
the back face of the node instead. The example keeps the straight 30M bars so that the
problem is visible.

### 4.6 Bridge examples (statics)

- **Bridge pier corbel** (CSA S6): Vf = 1400 kN, Hf = 0.2 Vf = 280 kN on a 400 mm bearing,
  column 1.0 m cut 1.4 m below the corbel. Reactions balance the loads (ΣRy = 1400 kN,
  ΣRx = −280 kN); the corbel tie carries the same force from the load to the column face
  and to the far face (891.5 kN), where it is bent down into the far-face column bars
  (continuous anchorage, 923 kN).
- **Integral abutment end diaphragm** (CSA S6): deck cut 1.8 m from the abutment face with
  M = 200 kN·m/m (hogging) and V = 300 kN/m, earth pressure 30 + 120 kN/m on the back
  face, abutment wall cut 1.5 m below the soffit. Closing frame corner: deck top bars
  (492 kN/m) bent down into the back-face bars (1114 kN/m), corner diagonal strut
  (1110 kN/m); ΣRy = 300 kN/m, ΣRx = −150 kN/m.

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
