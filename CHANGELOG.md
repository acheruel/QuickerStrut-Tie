# Version history

## 0.2.8 — 2026-11-16

- **Four bridge examples calibrated on *fib* Bulletin 61** (*Design examples for
  strut-and-tie models*, 2011): box girder diaphragm on a pier (indirect support,
  ex. 1-4), cross-beam diaphragm of a cable-stayed pylon under a 42 MN bearing and
  the pylon diaphragm at its 10 MN horizontal bearing (ex. 13), pile cap on two
  precast piles (ex. 1-3, model A). The published forces and node stresses are
  reproduced and tested; see `VALIDATION.md` §4.7.
- **DXF export** of the model for CAD: outline, struts, ties, nodes, loads and
  reactions on separate layers, forces as text.
- **Tracing underlay**: an image of a drawing shown under the model, scaled by its
  real width (session only, neither saved nor printed).
- **Load scaling**: multiply every load by a factor (undoable).
- **Σ T·L** of the ties shown with the largest tie force, to compare alternative models.

## 0.2.7 — 2026-11-13

- White drawing canvas and clearer strut, tie, load and reaction colours. Node drags
  show alignment guides and a merge preview. Escape or an interrupted drag restores the
  previous geometry and preserves undo and redo history.
- Bilingual design guide, eight-step tutorial in the editor and an external link to Awatif.
- Added a 20 m bent cap on four columns and extended the bridge corbel outline to show
  the full backwall. Published examples use their load-carrying members.
- The solver checks equilibrium under the entered loads even when the truss has free
  mechanism modes. It flags the affected joint and direction when a load cannot be
  balanced. Templates discard members carrying numerically zero force where equilibrium
  is preserved.

## 0.2.6 — 2026-11-01

- **Loads and reactions drawn straight**: each component is its own vertical or horizontal
  arrow on the node's axis, labelled with its own value, instead of one inclined arrow
  (loads) or an arrow shifted beside the support (reactions). A small horizontal load
  component gets a proportionally shorter arrow; a component whose side is taken by a
  member is drawn leaving the node instead of pointing at it. The view leaves room below
  the supports for the reaction arrows.
- **New logo**: a deep-beam panel with two bottle-shaped struts, a tie anchored by end
  plates, a bearing plate and three nodes (no arrow); header, favicon and `docs/logo.svg`.
- Listed on https://acheruel.github.io with the other tools.

## 0.2.5 — 2026-11-01

- **GitHub Pages fixed**: the repository address https://acheruel.github.io/QuickerStrut-Tie/
  showed the README. `build.py` now also writes `index.html` (same page as the dated
  portable file) and `.nojekyll` is added, so Pages serves the application at an address
  without version or date.
- **Menus no longer hidden**: the side panel now stacks above the canvas, so the
  *Examples* and *File* menus are no longer covered by the drawing, the inspector or the
  banner; long menus scroll within the screen height (Galaxy Z Fold).
- **New examples**: bridge pier corbel (CSA S6) and integral abutment end diaphragm
  (deck–abutment corner under hogging moment, CSA S6); published examples **Paultre (2011)
  ex. 13.2** double corbel and **CAC Handbook ex. 4.10** dapped-end beam (24 forces,
  required steel areas, back face of node C and anchorage of CF reproduced).
- **Continuous or bent bar** anchorage type: no anchorage needed where the bars bend into
  another tie (frame corners) or leave the D-region; checked as a straight bar elsewhere.
- **Correction**: a tie crossing a symmetry plane no longer gets an anchorage face in the
  nodal zone check at that plane (it already had no anchorage check there).
- Concise `CLAUDE.md` for contributors.

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
