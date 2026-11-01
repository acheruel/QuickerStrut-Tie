# Version history

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
