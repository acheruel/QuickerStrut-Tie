# Method and assumptions · Méthode et hypothèses

*QuickerStrut&Tie v0.2.6 · 2026-11-01*

## Units and sign convention

Coordinates in m, forces in kN, widths and thickness in mm, areas in mm², stresses in MPa.
Loads are factored (ULS) and act at the nodes; `Fy < 0` points down. The axial force
`N > 0` is tension (tie), `N < 0` compression (strut).

## Analysis

The strut-and-tie model is a plane pin-jointed truss solved with the direct stiffness
method. Each bar has an axial stiffness `EA / L`:

| Bar | EA |
| --- | --- |
| Strut | `Ec · w · b` |
| Tie | `Es · As` |

with `Ec = 3000 √f′c + 6900` (S6) or `Ec = 4500 √f′c` (A23.3). The forces of a statically
determinate model (`r = m + reactions − 2·nodes = 0`) do not depend on these stiffnesses.
For an indeterminate model the role of each bar (strut or tie, from the sign of its force)
is iterated until it no longer changes; the force distribution then depends on the widths
and areas entered. A bar can also be forced to act as a strut or a tie.

Supports: pin (`Rx`, `Ry`), roller with a vertical reaction (`Ry`) or a horizontal
reaction (`Rx`). A singular stiffness matrix is reported as a mechanism and the first
free node and direction are named. Reactions are `K·u − F` at restrained degrees of
freedom; the global equilibrium residual is displayed.

Bars whose force is below 0.05 kN are reported as zero-force members.

## Checks

| | CSA S6 | CSA A23.3 |
| --- | --- | --- |
| φc (concrete) | 0.75 | 0.65 |
| φs (reinforcement) | 0.90 | 0.85 |
| Strut stress limit | α1 f′c, 8.10.3.3 | 0.85 f′c, 11.4.2.3 |
| Ties | 8.10.4.1 | 11.4.3.1 |
| Nodal zones CCC / CCT / CTT (× φc f′c) | α1 / 0.88 α1 / 0.76 α1, 8.10.5.1 | 0.85 / 0.75 / 0.65, 11.4.4.1 |
| Crack control, ρmin | 0.003, ≤ 1500 mm²/m per face | 0.002, 11.4.5 |

with α1 = 0.85 − 0.0015 f′c ≥ 0.67 for S6.

The φ factors can be overridden (precast concrete, other edition). Clause numbers and
factors are kept in one table (`CODES` in `app/js/csa.js`) and must be confirmed against
the edition of the standard that applies to the project.

### Struts

```
Cr  = φc · fcu · Acs,        Acs = w · b
fcu = f′c / (0.8 + 170 ε1) ≤ 0.85 f′c (A23.3) or α1 f′c (S6)
ε1  = εs + (εs + 0.002) · cot²θs
```

`θs` is the angle between the strut and an adjoining tie at the same node. Both ends of
the strut are evaluated with every adjoining tie, and the lowest `fcu` governs (smallest
angle, largest tie strain). `εs` is the tie strain `Tf / (Es · As)` or, as an option,
`fy / Es`. A tie in line with the strut (within 5°) does not cross it and is ignored.
With no adjoining tie at either end, `fcu` equals the upper limit.

### Ties

```
Tr = φs · fy · Ast
```

The reinforcement is entered as a number of CSA G30.18 bars (10M to 55M). Anchorage is
not checked: the tie must develop its full strength where it leaves the extended nodal
zone.

### Nodal zones

Node type from the distinct tie directions anchored at the node (collinear ties passing
through count once): none → **CCC**, one → **CCT**, more → **CTT**.

```
            A23.3              S6
f_lim = 0.85 · φc · f′c    α1 · φc · f′c        (CCC)
        0.75 · φc · f′c    0.88 α1 · φc · f′c   (CCT)
        0.65 · φc · f′c    0.76 α1 · φc · f′c   (CTT)
```

Face stresses compared with `f_lim`:

- each strut: `C / (w · b)`;
- bearing plate of a support: `|R| / (lb · b)`;
- load plate: `|F| / (lb · b)`;
- optionally, the anchorage face of a tie that ends at the node: `T / (w · b)` (not at a
  symmetry plane, where the reaction in line with the tie stands for its continuation).

### Hydrostatic nodal zones (graphical construction)

Every force on the node is represented as a push on one face: a strut on its own side, the
net force of the ties on one line as a push on the back face, a load or reaction on its
plate. Because the node is in equilibrium the force polygon closes; rotated by 90° and
scaled by `1 / (σh · b)` it becomes the node outline, each face perpendicular to its force
with width `wh,i = Fi / (σh · b)`, so that all faces carry the same stress `σh`
(hydrostatic node). `σh` is the highest stress `Fi / (wi · b)` among the faces with an
entered width, which makes every hydrostatic width `wh,i ≤ wi`; without any entered width
the zone is sized at the node limit (smallest admissible node). The polygon is centred on
the node; a zone that leaves the concrete outline is flagged.

### Tie anchorage

At every node where a tie ends (not where it continues on the same line, and not where a
support reaction in line with the tie represents its continuation, e.g. a symmetry
plane), the bars must develop `fy` where the tie leaves the extended nodal zone:

```
la = dc + e
dc = max( w_strut / 2 / sin θ  ,  extent of the hydrostatic zone along the tie )
e  = distance from the node to the concrete face beyond it − cover
```

Required length (A23.3, simplified, also used with S6 pending a check against S6 8.15):

```
straight: ld  = k · k1 · k4 · fy / √f′c · db ≥ 300 mm   (k = 0.45 or 0.6, k1 = 1.3 if more than
                                                         300 mm of concrete below, k4 = 0.8 up to 20M,
                                                         √f′c ≤ 8 MPa)          A23.3 12.2.3
hook:     ldh = 100 · db / √f′c · fy / 400 ≥ max(8 db, 150 mm)                 A23.3 12.5
```

Anchor plates, welded transverse bars and closed stirrups are taken as mechanical
anchorages (the tie back-face stress is then checked in the nodal zone).

A **continuous or bent bar** needs no anchorage at a node where it carries on: bent into
another tie (frame corner, corbel bars turned down into the column) or extended past the
edge of the D-region (node with a load or a reaction standing for the cut). At any other
node it is checked as a straight bar. The bend diameter and the laps remain to be checked.

### Crack control reinforcement

Orthogonal grid near each face, ratio `ρ ≥ ρmin` in each direction, spacing ≤ 300 mm.
For S6 the required grid is limited to 1500 mm²/m on each face, i.e.
`ρ ≥ min(0.003, 3000 / (b · 1000))`. The ratios entered apply to the whole model.

## Parametric templates

- **Dapped end:** orthogonal half-joint model, half span with a symmetry plane (horizontal
  rollers at mid-span), reaction `R` spread over the top nodes.
- **Multi-column bent cap:** top and bottom chords, a vertical at every girder and column,
  one compression diagonal per panel falling towards the nearest column; first column
  pinned, others on rollers; indeterminate for 3 and 4 columns (`r = ncol − 2`).
- **Pile cap:** 2D section. Four piles (square): each pile line stands for two piles, the
  2D tie is shared by two parallel ties (factor 0.5). Three piles (equilateral triangle):
  section through one pile and the line of the other two, side ties `T2D / √3`. Bearing
  plates are equivalent to the real pile and column areas over the width `b`.
- **Automatic sizing:** tie bars, strut widths (`wReq / 0.85`), plates and anchorage type
  (straight → hook → plate), three to four passes because strut strength depends on the
  tie strains.

## QuickerPile export

`quickerpile-head-loads` JSON (version 1): project, code, limit state, units (kN, kN·m,
m), and per pile `id`, `node`, `x`, `N` (> 0 compression), `H` (along x), `M` (0, pinned
head). For the pile cap templates the 2D reactions are expanded to the real piles.

## Limits of version 0.2.6

- 2D model with a constant thickness `b`; one factored load case.
- No automatic self-weight, no automatic model generation, no stress fields.
- Development lengths use the simplified A23.3 expressions for both codes.
- 3- and 4-pile caps are handled as 2D sections.
- The model geometry, the choice of widths and the load path remain the engineer's
  judgement.
