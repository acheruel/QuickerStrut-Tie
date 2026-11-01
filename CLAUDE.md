# QuickerStrut&Tie — notes for Claude

Interactive 2D strut-and-tie models checked to CSA S6 (bridges) and CSA A23.3 (buildings),
running entirely in the browser. Plain HTML / CSS / JavaScript, no dependencies, no bundler.
Author: Anthony Chéruel. Licence GPL-3.0-or-later (keep the SPDX header on every source file).

## Layout

- `app/index.html` + `app/css/app.css` + `app/js/*.js` — the application (classic scripts,
  `defer`, order matters; each file is an IIFE that sets `window.QST.*` and also
  `module.exports` so the engine runs under Node).
- Engine (unit tested): `solver.js` (direct stiffness truss), `csa.js` (S6 / A23.3 checks,
  nodal zones, anchorage; clauses and factors in `CODES`), `templates.js` (parametric bridge
  templates, `autoSize`, QuickerPile pile loads), `examples.js` (built-in models).
- UI: `app.js` (state, history, storage), `canvas.js` (SVG editor), `panels.js` (side panel,
  inspector, tables), `report.js` (print / CSV), `main.js` (start-up, menus, shortcuts),
  `i18n.js` (FR / EN strings and method text — every key in both languages).
- `version.js` — version and date; bump it for each release with `CHANGELOG.md`, the headers
  of `METHOD.md` / `VALIDATION.md` and the version line in `README.md`.

## Commands

```bash
node --test tests/*.test.js     # engine + translation tests (must stay green)
python build.py                 # writes QuickerStrut-Tie-v<version>-<date>.html AND index.html
python build.py --check         # fails if either built file is stale
python -m http.server 8765 --directory app   # dev server
```

Always run `python build.py` before committing: CI (`.github/workflows/ci.yml`) runs the
tests and `build.py --check`. Pages is deployed by `.github/workflows/pages.yml` from `app/`;
the root `index.html` (+ `.nojekyll`) is the fallback if Pages is set to deploy from the branch.

## Conventions

- Units: geometry in m, forces in kN, widths / bearing / `b` in mm, stresses in MPa.
- Model: `nodes {id,x,y,support,fx,fy,bearing}`, `members {id,i,j,role,w,bars{n,size}|As,anchor}`;
  anchor types `straight | hook | plate | stirrup | continuous`.
- Examples marked `literature: true` reproduce published results; each needs a test in
  `tests/engine.test.js` and a section in `VALIDATION.md`. Designed (non-literature)
  examples must solve determinately with max utilization in (0.2, 1].
- Code-facing text in English; the UI and many docs are bilingual (FR first in the app).
- Overlays inside `.stage` are isolated (`isolation: isolate`); the side panel `.inputs`
  has `z-index: 20` so its menus drop over the canvas — keep it that way.
- Results are indicative only; never present them as a final design.
