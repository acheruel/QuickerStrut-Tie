# Method and assumptions · Méthode et hypothèses

*QuickerStrut&Tie v0.1 · 2026-11-01*

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
| Struts | 8.10.3 | 11.4.2 |
| Ties | 8.10.4 | 11.4.3 |
| Nodal zones | 8.10.5.1 | 11.4.4.1 |
| Crack control, ρmin | 8.10.6, 0.003 | 11.4.5, 0.002 |

The φ factors can be overridden (precast concrete, other edition). Clause numbers and
factors are kept in one table (`CODES` in `app/js/csa.js`) and must be confirmed against
the edition of the standard that applies to the project.

### Struts

```
Cr  = φc · fcu · Acs,        Acs = w · b
fcu = f′c / (0.8 + 170 ε1) ≤ 0.85 f′c
ε1  = εs + (εs + 0.002) · cot²θs
```

`θs` is the angle between the strut and an adjoining tie at the same node. Both ends of
the strut are evaluated with every adjoining tie, and the lowest `fcu` governs (smallest
angle, largest tie strain). `εs` is the tie strain `Tf / (Es · As)` or, as an option,
`fy / Es`. With no adjoining tie at either end, `fcu = 0.85 f′c`.

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
f_lim = 0.85 · φc · f′c  (CCC)
        0.75 · φc · f′c  (CCT)
        0.65 · φc · f′c  (CTT)
```

Face stresses compared with `f_lim`:

- each strut: `C / (w · b)`;
- bearing plate of a support: `|R| / (lb · b)`;
- load plate: `|F| / (lb · b)`;
- optionally, the anchorage face of a tie that ends at the node: `T / (w · b)`.

### Crack control reinforcement

Orthogonal grid near each face, ratio `ρ ≥ ρmin` in each direction, spacing ≤ 300 mm.
The ratios entered apply to the whole model.

## Limits of version 0.1

- 2D model with a constant thickness `b`; one factored load case.
- No automatic self-weight, no automatic model generation, no stress fields.
- No anchorage, development length or bearing-on-plate (back face) detailing checks.
- Node geometry (hydrostatic or extended nodal zones) is not constructed; the checks
  use the widths entered.
- The model geometry, the choice of widths and the load path remain the engineer's
  judgement.
