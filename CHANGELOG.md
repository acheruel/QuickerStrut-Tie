# Version history

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
