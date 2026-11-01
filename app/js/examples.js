/* QuickerStrut&Tie — example models (ULS factored loads, kN; geometry in m). */
(function (root) {
  'use strict';

  function material(over) {
    var m = { fc: 35, fy: 400, Es: 200000, b: 400, phiC: 0, phiS: 0, epsMode: 'computed', rhoH: 0.003, rhoV: 0.003, spacing: 300, tieFaces: true };
    for (var k in over) m[k] = over[k];
    return m;
  }
  function N(id, x, y, o) {
    o = o || {};
    return { id: id, x: x, y: y, support: o.support || null, fx: o.fx || 0, fy: o.fy || 0, bearing: o.bearing || 0 };
  }
  function S(id, i, j, w) { return { id: id, i: i, j: j, role: 'auto', w: w, bars: null, As: 0 }; }
  function T(id, i, j, n, size, w) { return { id: id, i: i, j: j, role: 'auto', w: w || 0, bars: { n: n, size: size }, As: 0 }; }

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
          T('M1', 'N1', 'N2', 4, '20M', 120),
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
