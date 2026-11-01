# Version history

## 0.2 — 2026-11-01

- **Hydrostatic nodal zones**, built graphically from the force polygon rotated by 90°:
  drawn on the canvas and in the report, hydrostatic face widths compared with the widths
  entered, warning when a zone leaves the concrete; toggle *Nodal zones*.
- **Tie anchorage check** at every node where a tie ends: available length (critical
  section at the edge of the extended nodal zone + bar extension to the concrete face −
  cover) against the straight-bar or standard-hook development length (A23.3 12.2.3 /
  12.5, simplified; k1 = 1.3 for top bars); plates, welded bars and closed stirrups as
  mechanical anchorages; no check at symmetry planes or through ties. Bar extensions,
  hooks, plates and critical sections are drawn.
- **Parametric bridge templates** (*Templates* button): dapped end (half-joint),
  multi-column bent cap (2–4 columns, r = n − 2) and pile cap on 2, 3 or 4 piles (2D
  section with 3D tie factors), with live preview.
- **Automatic sizing** of tie bars, strut widths, missing plates and anchorage type
  (target utilization 0.85), used by the templates and available for any model.
- **QuickerPile link**: pile head loads (N, H, M per pile) exported as a
  `quickerpile-head-loads` JSON file; pile table in the reactions view and the report.
- Licence **GPL-3.0-or-later** (LICENSE file, SPDX headers).
- Intro animation removed: the application opens directly.

## 0.1.1 — 2026-11-01

- **CSA S6 limits corrected** after comparison with the literature: strut stress capped at
  α1 f′c (α1 = 0.85 − 0.0015 f′c ≥ 0.67) instead of 0.85 f′c; nodal limits α1, 0.88 α1
  and 0.76 α1 × φc f′c; crack control grid need not exceed 1500 mm²/m per face.
  A23.3 is unchanged.
- A tie in line with a strut (within 5°) no longer reduces the strut strength.
- New examples: half-joint seat (*appui en chaise*, dapped end) and the FHWA manual
  deep beam (published forces reproduced); validation against published examples in
  VALIDATION.md and the test suite.
- New logo (header, favicon, intro).
- Layout for the Galaxy Z Fold 8 unfolded in landscape and other wide, short screens:
  slim header, vertical tool column in the canvas, canvas sized from the screen height,
  compact inspector, larger touch targets.
- Direct As (mm²) input in the member inspector; formulas shown with the code's limits
  and the interface decimal separator.

## 0.1 — 2026-11-01

First version.

- Interactive 2D editor: select, node (with member split), member (chained), support,
  load, outline and erase tools; drag nodes, members and outline vertices with grid snap;
  zoom, pan, pinch, undo/redo, keyboard shortcuts.
- Live truss analysis by the direct stiffness method; automatic strut/tie roles with
  iteration for indeterminate models; mechanism detection; reactions and equilibrium.
- CSA S6 and CSA A23.3 checks: struts (ε1-based fcu), ties, CCC/CCT/CTT nodal zones,
  crack control reinforcement; overridable φ factors; CSA bar sizes.
- Geometry, forces and utilization views with real strut and tie widths; inspector with
  step-by-step calculations; checks, forces and reactions tables.
- Printable calculation note, SVG drawing, CSV table, `.quickerstrut.json` projects,
  automatic local save, portable single-file HTML.
- Five examples; French and English interface.
