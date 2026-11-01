// SPDX-License-Identifier: GPL-3.0-or-later
/* QuickerStrut&Tie — example models (ULS factored loads, kN; geometry in m). */
(function (root) {
  'use strict';

  function material(over) {
    var m = { fc: 35, fy: 400, Es: 200000, b: 400, phiC: 0, phiS: 0, epsMode: 'computed', rhoH: 0.003, rhoV: 0.003, spacing: 300, tieFaces: true, cover: 50, ldFactor: 0.45 };
    for (var k in over) m[k] = over[k];
    return m;
  }
  function N(id, x, y, o) {
    o = o || {};
    return { id: id, x: x, y: y, support: o.support || null, fx: o.fx || 0, fy: o.fy || 0, bearing: o.bearing || 0 };
  }
  function S(id, i, j, w) { return { id: id, i: i, j: j, role: 'auto', w: w, bars: null, As: 0 }; }
  function T(id, i, j, n, size, w, anchor) { return { id: id, i: i, j: j, role: 'auto', w: w || 0, bars: { n: n, size: size }, As: 0, anchor: anchor || 'hook' }; }
  function TA(id, i, j, As, w, db, anchor) { return { id: id, i: i, j: j, role: 'auto', w: w || 0, bars: null, As: As, db: db, anchor: anchor || 'hook' }; }
  var IN = 0.0254, KIP = 4.448222;

  var EXAMPLES = [
    {
      key: 'deep-beam-1',
      title: { fr: 'Poutre-cloison · charge centrée', en: 'Deep beam · central load' },
      sub: { fr: 'Treillis triangulaire, 1 tirant inférieur', en: 'Triangular truss, one bottom tie' },
      model: {
        code: 'S6',
        material: material({ fc: 35, b: 400 }),
        outline: [[0, 0], [3.6, 0], [3.6, 1.8], [0, 1.8]],
        nodes: [
          N('N1', 0.3, 0.15, { support: 'pin', bearing: 300 }),
          N('N2', 3.3, 0.15, { support: 'ry', bearing: 300 }),
          N('N3', 1.8, 1.65, { fy: -2000, bearing: 300 })
        ],
        members: [S('M1', 'N1', 'N3', 300), S('M2', 'N3', 'N2', 300), T('M3', 'N1', 'N2', 6, '25M', 300)]
      }
    },
    {
      key: 'deep-beam-2',
      title: { fr: 'Poutre-cloison · deux charges', en: 'Deep beam · two point loads' },
      sub: { fr: 'Bielle supérieure, montants à effort nul', en: 'Top strut, zero-force web members' },
      model: {
        code: 'S6',
        material: material({ fc: 35, b: 450 }),
        outline: [[0, 0], [4.6, 0], [4.6, 2.15], [0, 2.15]],
        nodes: [
          N('N1', 0.35, 0.15, { support: 'pin', bearing: 350 }),
          N('N2', 4.25, 0.15, { support: 'ry', bearing: 350 }),
          N('N3', 1.65, 2.0, { fy: -1800, bearing: 350 }),
          N('N4', 2.95, 2.0, { fy: -1800, bearing: 350 }),
          N('N5', 1.65, 0.15),
          N('N6', 2.95, 0.15)
        ],
        members: [
          S('M1', 'N1', 'N3', 350), S('M2', 'N3', 'N4', 250), S('M3', 'N4', 'N2', 350),
          T('M4', 'N1', 'N5', 6, '30M', 300), T('M5', 'N5', 'N6', 6, '30M', 300), T('M6', 'N6', 'N2', 6, '30M', 300),
          S('M7', 'N3', 'N5', 200), S('M8', 'N4', 'N6', 200), S('M9', 'N3', 'N6', 200)
        ]
      }
    },
    {
      key: 'double-corbel',
      title: { fr: 'Corbeau double', en: 'Double corbel' },
      sub: { fr: 'Tirant supérieur ancré aux charges', en: 'Top tie anchored under the loads' },
      model: {
        code: 'A23',
        material: material({ fc: 40, b: 400 }),
        outline: [[-0.25, 0], [0.25, 0], [0.25, 0.45], [0.6, 0.8], [0.6, 1.1], [-0.6, 1.1], [-0.6, 0.8], [-0.25, 0.45]],
        nodes: [
          N('N1', -0.45, 1.0, { fy: -600, bearing: 150 }),
          N('N2', 0.45, 1.0, { fy: -600, bearing: 150 }),
          N('N3', -0.15, 0.4),
          N('N4', 0.15, 0.4),
          N('N5', -0.15, 0.0, { support: 'pin', bearing: 200 }),
          N('N6', 0.15, 0.0, { support: 'pin', bearing: 200 })
        ],
        members: [
          T('M1', 'N1', 'N2', 4, '20M', 120, 'plate'),
          S('M2', 'N1', 'N3', 150), S('M3', 'N2', 'N4', 150),
          S('M4', 'N3', 'N4', 120), S('M5', 'N3', 'N5', 200), S('M6', 'N4', 'N6', 200),
          S('M7', 'N3', 'N2', 100), S('M8', 'N3', 'N6', 100)
        ]
      }
    },
    {
      key: 'hammerhead',
      title: { fr: 'Chevêtre en porte-à-faux', en: 'Hammerhead pier cap' },
      sub: { fr: '4 poutres, tirant supérieur continu', en: '4 girders, continuous top tie' },
      model: {
        code: 'S6',
        material: material({ fc: 35, b: 1500 }),
        outline: [[-0.75, -1.2], [0.75, -1.2], [0.75, 0], [4, 1.0], [4, 2.0], [-4, 2.0], [-4, 1.0], [-0.75, 0]],
        nodes: [
          N('N1', -3.3, 1.85, { fy: -2500, bearing: 600 }),
          N('N2', -1.5, 1.85, { fy: -2500, bearing: 600 }),
          N('N3', 1.5, 1.85, { fy: -2500, bearing: 600 }),
          N('N4', 3.3, 1.85, { fy: -2500, bearing: 600 }),
          N('N5', -0.45, 0.2, { support: 'pin', bearing: 600 }),
          N('N6', 0.45, 0.2, { support: 'ry', bearing: 600 })
        ],
        members: [
          T('M1', 'N1', 'N2', 16, '35M', 200), T('M2', 'N2', 'N3', 20, '35M', 200), T('M3', 'N3', 'N4', 16, '35M', 200),
          S('M4', 'N1', 'N5', 450), S('M5', 'N2', 'N5', 350), S('M6', 'N3', 'N6', 350), S('M7', 'N4', 'N6', 450),
          S('M8', 'N5', 'N6', 300), S('M9', 'N2', 'N6', 200)
        ]
      }
    },
    {
      key: 'half-joint',
      title: { fr: 'Appui en chaise (demi-joint)', en: 'Half-joint seat (dapped end)' },
      sub: { fr: 'Travée suspendue sur chaise · bande de 1 m', en: 'Suspended span on a seat · 1 m strip' },
      model: {
        code: 'S6',
        material: material({ fc: 35, b: 1000 }),
        outline: [[0, 0.6], [0.45, 0.6], [0.45, 0], [3.0, 0], [3.0, 1.2], [0, 1.2]],
        nodes: [
          N('N1', 0.2, 0.68, { support: 'ry', bearing: 250 }),
          N('N2', 0.55, 1.12),
          N('N3', 0.55, 0.08),
          N('N4', 1.3, 0.68),
          N('N5', 1.3, 1.12, { fy: -330, bearing: 300 }),
          N('N6', 1.3, 0.08),
          N('N7', 2.15, 1.12, { fy: -190, bearing: 300 }),
          N('N8', 2.15, 0.08),
          N('N9', 3.0, 1.12, { support: 'rx', fy: -80 }),
          N('N10', 3.0, 0.08, { support: 'rx' })
        ],
        members: [
          S('M1', 'N1', 'N2', 300), T('M2', 'N1', 'N4', 5, '20M', 150, 'plate'), T('M3', 'N2', 'N3', 6, '20M', 150, 'stirrup'),
          S('M4', 'N2', 'N5', 150), S('M5', 'N3', 'N4', 250), S('M6', 'N3', 'N5', 300), T('M7', 'N3', 'N6', 6, '25M', 150, 'plate'),
          S('M8', 'N5', 'N4', 150), T('M9', 'N4', 'N6', 5, '15M', 150, 'stirrup'), S('M10', 'N5', 'N7', 150), T('M11', 'N6', 'N8', 6, '25M', 150),
          S('M12', 'N6', 'N7', 250), T('M13', 'N7', 'N8', 4, '15M', 150, 'stirrup'), S('M14', 'N7', 'N9', 150), T('M15', 'N8', 'N10', 6, '25M', 150),
          S('M16', 'N8', 'N9', 250), T('M17', 'N9', 'N10', 4, '15M', 150, 'stirrup')
        ]
      }
    },
    {
      key: 'bridge-corbel',
      title: { fr: 'Corbeau de pile de pont', en: 'Bridge pier corbel' },
      sub: { fr: 'Corbeau simple sous appareil d’appui, H = 0,2 V', en: 'Single corbel under a girder bearing, H = 0.2 V' },
      model: {
        code: 'S6',
        material: material({ fc: 35, b: 900 }),
        // Column 1.0 m deep (far face at x = 0), corbel projecting 0.6 m; the
        // column is cut 1.4 m below the corbel, where the supports stand for it.
        outline: [[0, -2.4], [1.0, -2.4], [1.0, -0.9], [1.6, -0.5], [1.6, 0], [0, 0]],
        nodes: [
          N('N1', 1.3, -0.08, { fy: -1400, fx: 280, bearing: 400 }),
          N('N2', 0.08, -0.08),
          N('N3', 0.92, -0.95),
          N('N4', 0.08, -0.95),
          N('N5', 0.92, -2.3, { support: 'pin', bearing: 200 }),
          N('N6', 0.08, -2.3, { support: 'ry' }),
          N('N7', 0.92, -0.08)
        ],
        members: [
          T('M1', 'N1', 'N7', 8, '25M', 160, 'plate'), T('M2', 'N7', 'N2', 8, '25M', 160, 'continuous'),
          S('M3', 'N1', 'N3', 350), S('M4', 'N2', 'N3', 300), S('M5', 'N7', 'N3', 150),
          T('M6', 'N2', 'N4', 10, '25M', 160, 'continuous'), T('M7', 'N3', 'N4', 6, '15M', 0, 'stirrup'),
          S('M8', 'N3', 'N5', 250), T('M9', 'N4', 'N6', 10, '25M', 160, 'continuous'), S('M10', 'N4', 'N5', 250),
          S('M11', 'N5', 'N6', 200)
        ]
      }
    },
    {
      key: 'integral-abutment',
      title: { fr: 'Culée intégrale · diaphragme d’about', en: 'Integral abutment · end diaphragm' },
      sub: { fr: 'Coin tablier–culée sous moment négatif · bande de 1 m', en: 'Deck–abutment corner under hogging moment · 1 m strip' },
      model: {
        code: 'S6',
        material: material({ fc: 35, b: 1000 }),
        // Longitudinal section: abutment 1.0 m thick (backfill side at x = 0),
        // superstructure 1.8 m deep cut 1.8 m from the abutment face, abutment
        // wall cut 1.5 m below the soffit. Cut forces from the frame analysis:
        // M = 200 kN·m/m and V = 300 kN/m at the deck cut, earth pressure on
        // the back face.
        outline: [[0, 0], [1.0, 0], [1.0, 1.5], [2.8, 1.5], [2.8, 3.3], [0, 3.3]],
        nodes: [
          N('D1', 2.8, 3.2, { fx: 127, fy: -300 }),
          N('D2', 2.8, 1.62, { fx: -127 }),
          N('K1', 0.1, 3.2, { fx: 30 }),
          N('K2', 0.88, 1.62),
          N('B3', 0.1, 1.1, { fx: 120 }),
          N('B1', 0.1, 0.12, { support: 'ry' }),
          N('B2', 0.88, 0.12, { support: 'pin', bearing: 240 })
        ],
        members: [
          T('M1', 'D1', 'K1', 8, '20M', 200, 'continuous'), S('M2', 'D2', 'K2', 240), S('M3', 'D1', 'K2', 300),
          S('M4', 'D1', 'D2', 200), S('M5', 'K1', 'K2', 300),
          T('M6', 'K1', 'B3', 8, '25M', 200, 'continuous'), T('M7', 'B3', 'B1', 8, '25M', 200, 'continuous'),
          S('M8', 'K2', 'B2', 240), S('M9', 'B1', 'B2', 200), S('M10', 'K1', 'B2', 250), S('M11', 'B3', 'B2', 250)
        ]
      }
    },
    {
      key: 'paultre-corbel',
      literature: true,
      title: { fr: 'Console courte double · Paultre, ex. 13.2', en: 'Double corbel · Paultre, ex. 13.2' },
      sub: { fr: 'Efforts et contraintes publiés (A23.3)', en: 'Published forces and stresses (A23.3)' },
      model: {
        code: 'A23',
        material: material({ fc: 40, fy: 400, b: 350 }),
        // Column 350 mm, corbels 200 mm (200 mm square + 200 mm sloped). Tie
        // 28 mm under the top, node C at hc / 2 = 15.5 mm above the corbel base.
        // AC width 76 mm = A_b at A (26 587 mm²) / b.
        outline: [[-0.175, -0.3], [0.175, -0.3], [0.175, 0], [0.375, 0.2], [0.375, 0.4], [0.175, 0.4], [0.175, 0.7],
          [-0.175, 0.7], [-0.175, 0.4], [-0.375, 0.4], [-0.375, 0.2], [-0.175, 0]],
        nodes: [
          N('A', -0.33, 0.372, { fx: -70, fy: -350, bearing: 100 }),
          N('A2', 0.33, 0.372, { fx: 70, fy: -350, bearing: 100 }),
          N('C', -0.0875, 0.0155, { support: 'pin', bearing: 175 }),
          N('C2', 0.0875, 0.0155, { support: 'ry', bearing: 175 })
        ],
        members: [
          T('AB', 'A', 'A2', 5, '15M', 56, 'plate'), S('AC', 'A', 'C', 76), S('A2C2', 'A2', 'C2', 76), S('CC2', 'C', 'C2', 31),
          // Bracing diagonal (zero force under the symmetric loads).
          S('AC2', 'A', 'C2', 100)
        ]
      }
    },
    {
      key: 'cac-dapped-end',
      literature: true,
      title: { fr: 'Poutre à about réduit · CAC, ex. 4.10', en: 'Dapped-end beam · CAC Handbook, ex. 4.10' },
      sub: { fr: '24 efforts publiés reproduits · demi-poutre', en: '24 published forces reproduced · half beam' },
      model: {
        code: 'A23',
        // Precast plant: φc = 0.70 as in the handbook.
        material: material({ fc: 40, fy: 400, b: 400, phiC: 0.70 }),
        // Beam 700 mm, nib 400 mm over a 300 mm dap; bearing A 25 mm above the
        // nib soffit; chords 63 mm and 60 mm from the faces; midspan at x = 3.15 m.
        outline: [[-0.1, 0.3], [0.15, 0.3], [0.15, 0], [3.15, 0], [3.15, 0.7], [-0.1, 0.7]],
        nodes: [
          N('A', 0, 0.325, { support: 'ry', fx: -80, bearing: 100 }),
          N('B', 0.25, 0.637, { fy: -61 }), N('C', 0.25, 0.06), N('D', 0.461, 0.325),
          N('E', 0.71, 0.637, { fy: -71 }), N('F', 0.71, 0.06),
          N('G', 1.37, 0.637, { fy: -84 }), N('H', 1.37, 0.06),
          N('I', 2.03, 0.637, { fy: -84 }), N('J', 2.03, 0.06),
          N('K', 2.69, 0.637, { fy: -71 }), N('L', 2.69, 0.06),
          N('M', 3.15, 0.637, { fy: -29, support: 'rx' }), N('N', 3.15, 0.06, { support: 'rx' })
        ],
        members: [
          S('AB', 'A', 'B', 150), S('DB', 'D', 'B', 150), T('AD', 'A', 'D', 5, '20M', 100, 'plate'),
          T('CB', 'C', 'B', 10, '15M', 215, 'stirrup'), S('CD', 'C', 'D', 200), S('DE', 'D', 'E', 150),
          S('BE', 'B', 'E', 125), T('CF', 'C', 'F', 5, '30M', 120, 'straight'), T('EF', 'E', 'F', 8, '10M', 0, 'stirrup'),
          S('EG', 'E', 'G', 125), S('FG', 'F', 'G', 150), T('FH', 'F', 'H', 5, '30M', 120, 'straight'),
          T('GH', 'G', 'H', 6, '10M', 0, 'stirrup'), S('GI', 'G', 'I', 125), S('HI', 'H', 'I', 150),
          T('HJ', 'H', 'J', 5, '30M', 120, 'straight'), T('IJ', 'I', 'J', 4, '10M', 0, 'stirrup'), S('IK', 'I', 'K', 125),
          S('JK', 'J', 'K', 150), T('JL', 'J', 'L', 5, '30M', 120, 'straight'), T('KL', 'K', 'L', 4, '10M', 0, 'stirrup'),
          S('KM', 'K', 'M', 125), S('LM', 'L', 'M', 150), T('LN', 'L', 'N', 5, '30M', 120, 'straight'),
          // Zero-force post that holds N vertically (symmetry plane).
          S('MN', 'M', 'N', 100)
        ]
      }
    },
    {
      key: 'fhwa-deep-beam',
      literature: true,
      title: { fr: 'Poutre-cloison · manuel FHWA, ex. 1', en: 'Deep beam · FHWA manual, ex. 1' },
      sub: { fr: 'Géométrie et efforts publiés (conversion SI)', en: 'Published geometry and forces (SI units)' },
      model: {
        code: 'S6',
        material: material({ fc: 34.5, fy: 414, b: 48 * IN * 1000 }),
        outline: [[0, 0], [29 * 12 * IN, 0], [29 * 12 * IN, 72 * IN], [0, 72 * IN]],
        nodes: [
          N('A', 12 * IN, 5 * IN, { support: 'pin', bearing: 12 * IN * 1000 }),
          N('B', 66 * IN, 5 * IN),
          N('C', 336 * IN, 5 * IN, { support: 'ry', bearing: 12 * IN * 1000 }),
          N('D', 66 * IN, 69 * IN),
          N('E', 120 * IN, 69 * IN, { fy: -600 * KIP, bearing: 12 * IN * 1000 }),
          N('F', 228 * IN, 69 * IN, { fy: -600 * KIP, bearing: 12 * IN * 1000 })
        ],
        members: [
          TA('AB', 'A', 'B', 16 * 1.27 * IN * IN * 1e6, 10 * IN * 1000, 1.27 * IN * 1000), TA('BC', 'B', 'C', 16 * 1.27 * IN * IN * 1e6, 10 * IN * 1000, 1.27 * IN * 1000),
          S('AD', 'A', 'D', 400), T('BD', 'B', 'D', 26, '20M', 0, 'stirrup'), S('BE', 'B', 'E', 400), S('CF', 'C', 'F', 287),
          S('DE', 'D', 'E', 6 * IN * 1000), S('EF', 'E', 'F', 6 * IN * 1000),
          // Bracing diagonal (zero force) so that the stiffness matrix is regular.
          S('BF', 'B', 'F', 150)
        ]
      }
    },
    {
      key: 'pile-cap',
      title: { fr: 'Semelle sur deux pieux', en: 'Two-pile cap' },
      sub: { fr: 'Colonne centrée, tirant entre les pieux', en: 'Centred column, tie between piles' },
      model: {
        code: 'S6',
        material: material({ fc: 30, b: 1200 }),
        outline: [[-1.5, 0], [-1.3, 0], [-1.3, -0.6], [-0.7, -0.6], [-0.7, 0], [0.7, 0], [0.7, -0.6], [1.3, -0.6], [1.3, 0], [1.5, 0],
          [1.5, 1.5], [0.3, 1.5], [0.3, 2.3], [-0.3, 2.3], [-0.3, 1.5], [-1.5, 1.5]],
        nodes: [
          N('N1', -0.2, 1.35, { fy: -1500, bearing: 300 }),
          N('N2', 0.2, 1.35, { fy: -1500, bearing: 300 }),
          N('N3', -1.0, 0.15, { support: 'pin', bearing: 500 }),
          N('N4', 1.0, 0.15, { support: 'ry', bearing: 500 })
        ],
        members: [
          T('M1', 'N3', 'N4', 8, '25M', 250), S('M2', 'N1', 'N3', 300), S('M3', 'N2', 'N4', 300),
          S('M4', 'N1', 'N2', 250), S('M5', 'N1', 'N4', 200)
        ]
      }
    }
  ];

  function blank() {
    return {
      code: 'S6', material: material({}),
      outline: [[0, 0], [3, 0], [3, 1.5], [0, 1.5]], nodes: [], members: []
    };
  }

  function build(key, lang) {
    var ex = EXAMPLES.filter(function (e) { return e.key === key; })[0];
    if (!ex) return null;
    var m = JSON.parse(JSON.stringify(ex.model));
    m.schema = 1;
    m.name = ex.title[lang || 'fr'];
    return m;
  }

  var api = { EXAMPLES: EXAMPLES, build: build, blank: blank, material: material };
  root.QST = root.QST || {};
  root.QST.examples = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
