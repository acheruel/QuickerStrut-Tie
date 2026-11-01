# QuickerStrut&Tie

**Interactive 2D strut-and-tie models checked to CSA S6 and CSA A23.3, in your browser.**
Draw the concrete outline, place nodes and members, drag them around and watch the
forces, strut and tie resistances and nodal zone stresses update live.
No installation, no server, no data leaves your computer.

**▶ Open the app: https://acheruel.github.io/QuickerStrut-Tie/**

![QuickerStrut&Tie — hammerhead pier cap, forces view](docs/screenshots/forces.png)

*Version 0.1 · 2026-11-01 · Anthony Chéruel · [Version history](CHANGELOG.md) · [Français](#en-français)*

## What it does

- **Interactive editor:** select, node, member, support, load, outline and erase tools;
  drag nodes, members or outline vertices with grid snapping; zoom, pan, undo/redo,
  keyboard shortcuts, touch support.
- **Live analysis:** pin-jointed truss solved by the direct stiffness method at every
  change (a few milliseconds); struts and ties identified from the force sign; mechanism
  detection with the free node named; determinate and indeterminate models.
- **CSA checks:** strut crushing with the ε1-based limit fcu = f′c / (0.8 + 170 ε1) ≤ 0.85 f′c,
  tie yielding, CCC / CCT / CTT nodal zone stresses on strut, bearing and anchorage faces,
  crack control reinforcement; CSA S6 (bridges) or CSA A23.3 (buildings) factors,
  overridable.
- **Readable results:** forces and utilization views drawn with the real strut and tie
  widths, colour **and** line style (dashed struts, solid ties) with value labels; an
  inspector showing every step of each calculation; checks, forces and reactions tables.
- **Outputs:** printable calculation note (PDF through the browser), SVG drawing, CSV
  table, `.quickerstrut.json` projects, automatic local save.
- **Examples:** deep beams, double corbel, hammerhead pier cap, two-pile cap.
- **French and English** interface.

![Utilization view and inspector (French interface)](docs/screenshots/utilization-fr.png)

## Use it

- **Web:** open the link above in a recent Chrome, Edge, Firefox or Safari.
- **Offline:** download `QuickerStrut-Tie-v<version>-<date>.html` from the repository root
  and double-click it. Everything is inside this single file; no Internet connection is
  needed.

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `V` | Select / drag | `C` | Edit the concrete outline |
| `N` | Add a node (on a member: split it) | `E` | Erase |
| `B` | Draw members (chain, `Esc` to stop) | `1` `2` `3` | Geometry / forces / utilization |
| `S` | Cycle the support type | `F` | Fit the view |
| `L` | Load a node | arrows | Nudge the selection by one grid step |
| `Ctrl Z` / `Ctrl Y` | Undo / redo | `Ctrl S` / `Ctrl O` / `Ctrl P` | Save / open / report |

Hold `Alt` while dragging to disable snapping; hold `Space` or use the middle button to pan
in any tool.

> **Indicative preliminary values only — not a substitute for detailed design.**
> The model geometry is the engineer's judgement. Clause numbers and factors must be
> confirmed against the edition of the standard that applies to the project. The author
> cannot be held liable for the results.

Method: [METHOD.md](METHOD.md) · Validation: [VALIDATION.md](VALIDATION.md)

## Development

Plain HTML, CSS and JavaScript with no dependencies and no build step for the web version.

```text
app/index.html        page and intro animation
app/css/app.css       styles (screen and printed report)
app/js/solver.js      truss solver (stiffness method)          ← unit tested
app/js/csa.js         CSA S6 / A23.3 checks, bar sizes         ← unit tested
app/js/examples.js    example models
app/js/i18n.js        French / English strings and method text
app/js/app.js         state, history, storage, formatting
app/js/canvas.js      SVG editor, drawing and interactions
app/js/panels.js      side panel, inspector, metrics, tables
app/js/report.js      printable report and CSV export
app/js/main.js        start-up, menus, files, shortcuts
tests/                node --test suites
build.py              builds the portable single-file HTML
```

```bash
node --test                 # engine and translation tests
python3 -m http.server -d app      # serve the app at http://localhost:8000
python3 build.py                   # rebuild QuickerStrut-Tie-v<version>-<date>.html
```

GitHub Pages publishes the `app/` folder (workflow *Publish GitHub Pages*; in
**Settings → Pages**, choose **GitHub Actions** as the source).

---

## En français

**Modèles bielles-tirants 2D interactifs, vérifiés selon CSA S6 et CSA A23.3, dans le navigateur.**
Dessinez le contour du béton, placez les nœuds et les barres, déplacez-les à la souris :
efforts, résistances des bielles et tirants et contraintes des zones nodales se mettent à
jour en direct. Aucune installation, aucun serveur, aucune donnée transmise.

- **Éditeur :** outils sélection, nœud, barre, appui, charge, contour et effacer ;
  aimantation à la grille, zoom, déplacement, annuler/rétablir, raccourcis clavier, tactile.
- **Calcul en direct :** treillis articulé résolu par la méthode des rigidités à chaque
  modification ; bielles et tirants identifiés par le signe de l’effort ; détection des
  mécanismes ; modèles isostatiques ou hyperstatiques.
- **Vérifications CSA :** écrasement des bielles (fcu basé sur ε1), plastification des
  tirants, zones nodales CCC / CCT / CTT, armature de contrôle de la fissuration ;
  coefficients S6 (ponts) ou A23.3 (bâtiments), modifiables.
- **Résultats lisibles :** largeurs réelles des bielles et tirants, couleur **et** type de
  trait, étiquettes de valeurs ; inspecteur détaillant chaque étape de calcul ; tableaux.
- **Sorties :** note de calcul imprimable (PDF), dessin SVG, tableau CSV, projets
  `.quickerstrut.json`, sauvegarde locale automatique.
- **Utilisation hors ligne :** téléchargez `QuickerStrut-Tie-v<version>-<date>.html` et
  ouvrez-le ; tout est dans ce fichier.

> **Valeurs préliminaires indicatives — ne remplace pas la conception détaillée.**
> La géométrie du modèle relève du jugement de l’ingénieur. Les numéros d’article et
> coefficients sont à confirmer avec l’édition de la norme applicable. L’auteur ne peut
> être tenu responsable des résultats.

© 2026 Anthony Chéruel
