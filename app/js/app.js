/* QuickerStrut&Tie — application state, model operations, history, storage. */
(function () {
  'use strict';
  var QST = window.QST;
  var STORE_MODEL = 'qst-autosave-v1', STORE_LANG = 'qst-lang', STORE_UI = 'qst-ui-v1';

  function store(fn) { try { return fn(window.localStorage); } catch (e) { return null; } }

  var App = {
    model: null, result: null, checks: null, warnings: [],
    sel: null, hover: null, tool: 'select',
    display: { mode: 'forces', bands: true, ids: true, snap: true },
    panel: 'params', view: 'checks',
    history: [], future: [], dirty: false,
    listeners: []
  };
  QST.App = App;

  // ---------- Language and number formatting ----------
  App.lang = (function () {
    var s = store(function (ls) { return ls.getItem(STORE_LANG); });
    if (s === 'fr' || s === 'en') return s;
    return /^fr/i.test(navigator.language || 'fr') ? 'fr' : 'en';
  })();
  App.t = function (k) { return QST.i18n.t(App.lang, k); };
  App.locale = function () { return App.lang === 'fr' ? 'fr-CA' : 'en-CA'; };
  App.fmt = function (v, dec, opts) {
    if (v === null || v === undefined || !isFinite(v)) return v === Infinity ? '∞' : '—';
    dec = dec === undefined ? 0 : dec;
    if (Math.abs(v) < 0.5 * Math.pow(10, -dec)) v = 0;
    var s = Number(v).toLocaleString(App.locale(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
    if (opts && opts.sign && v > 0) s = '+' + s;
    return s.replace(/^-/, '−');
  };
  App.fmtInput = function (v) {
    if (v === null || v === undefined || v === '' || !isFinite(v)) return '';
    return Number(v).toLocaleString(App.locale(), { maximumFractionDigits: 6, useGrouping: Math.abs(v) >= 1e4 });
  };
  // Accepts "1 234,5", "1,234.5", "2*17,4", "(3+4)/2", "1,2e3".
  App.parse = function (raw) {
    var s = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!s) return null;
    s = s.replace(/[\s  ']/g, '').replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/');
    s = App.lang === 'fr' ? s.replace(/,/g, '.') : s.replace(/,/g, '');
    var i = 0;
    function peek() { return s[i]; }
    function num() { var m = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(s.slice(i)); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); }
    function primary() { if (peek() === '(') { i++; var v = expr(); if (peek() !== ')') throw 0; i++; return v; } return num(); }
    function unary() { if (peek() === '-') { i++; return -unary(); } if (peek() === '+') { i++; return unary(); } return primary(); }
    function term() { var v = unary(); while (peek() === '*' || peek() === '/') { var op = s[i++], r = unary(); v = op === '*' ? v * r : v / r; } return v; }
    function expr() { var v = term(); while (peek() === '+' || peek() === '-') { var op = s[i++], r = term(); v = op === '+' ? v + r : v - r; } return v; }
    try { var v = expr(); return i === s.length && isFinite(v) ? v : NaN; } catch (e) { return NaN; }
  };
  App.esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  // ---------- Model helpers ----------
  App.node = function (id) { return App.model.nodes.filter(function (n) { return n.id === id; })[0] || null; };
  App.member = function (id) { return App.model.members.filter(function (m) { return m.id === id; })[0] || null; };
  App.nextId = function (prefix, list) {
    var max = 0;
    list.forEach(function (o) { var m = new RegExp('^' + prefix + '(\\d+)$').exec(o.id); if (m) max = Math.max(max, +m[1]); });
    return prefix + (max + 1);
  };
  App.force = function (id) {
    if (!App.result || !App.result.ok) return null;
    return App.result.forces.filter(function (f) { return f.id === id; })[0] || null;
  };
  App.memberCheck = function (id) { return App.checks && App.checks.members.filter(function (c) { return c.id === id; })[0] || null; };
  App.nodeCheck = function (id) { return App.checks && App.checks.nodes.filter(function (c) { return c.id === id; })[0] || null; };
  App.reaction = function (id) { return App.result && App.result.ok ? App.result.reactions.filter(function (r) { return r.node === id; })[0] || null : null; };

  App.addNode = function (x, y) {
    var id = App.nextId('N', App.model.nodes);
    App.model.nodes.push({ id: id, x: round(x), y: round(y), support: null, fx: 0, fy: 0, bearing: 0 });
    return id;
  };
  App.addMember = function (i, j, proto) {
    if (i === j) return null;
    var dup = App.model.members.some(function (m) { return (m.i === i && m.j === j) || (m.i === j && m.j === i); });
    if (dup) return null;
    var id = App.nextId('M', App.model.members);
    var m = { id: id, i: i, j: j, role: 'auto', w: 200, bars: { n: 4, size: '20M' }, As: 0 };
    if (proto) { m.role = proto.role; m.w = proto.w; m.bars = proto.bars ? { n: proto.bars.n, size: proto.bars.size } : null; m.As = proto.As; }
    App.model.members.push(m);
    return id;
  };
  App.deleteNode = function (id) {
    App.model.nodes = App.model.nodes.filter(function (n) { return n.id !== id; });
    App.model.members = App.model.members.filter(function (m) { return m.i !== id && m.j !== id; });
  };
  App.deleteMember = function (id) { App.model.members = App.model.members.filter(function (m) { return m.id !== id; }); };
  App.splitMember = function (id, x, y) {
    var m = App.member(id); if (!m) return null;
    var nid = App.addNode(x, y), j = m.j;
    m.j = nid;
    App.addMember(nid, j, m);
    return nid;
  };
  function round(v) { return Math.round(v * 1e6) / 1e6; }
  App.round = round;

  // ---------- History ----------
  App.snapshot = function () { return JSON.stringify(App.model); };
  App.commit = function () {
    App.history.push(App.snapshot());
    if (App.history.length > 300) App.history.shift();
    App.future = [];
    App.dirty = true;
  };
  App.undo = function () {
    if (!App.history.length) return;
    App.future.push(App.snapshot());
    App.model = JSON.parse(App.history.pop());
    App.dirty = true; App.validateSel(); App.update({ inputs: true });
  };
  App.redo = function () {
    if (!App.future.length) return;
    App.history.push(App.snapshot());
    App.model = JSON.parse(App.future.pop());
    App.dirty = true; App.validateSel(); App.update({ inputs: true });
  };
  App.validateSel = function () {
    var s = App.sel; if (!s) return;
    if (s.type === 'node' && !App.node(s.id)) App.sel = null;
    if (s.type === 'member' && !App.member(s.id)) App.sel = null;
    if (s.type === 'vertex' && !(App.model.outline && App.model.outline[s.index])) App.sel = null;
  };

  // ---------- Compute pipeline ----------
  App.compute = function () {
    QST.csa.normalize(App.model);
    var t0 = performance.now();
    App.result = QST.solver.solve(App.model);
    App.checks = QST.csa.check(App.model, App.result);
    App.warnings = QST.csa.geometryWarnings(App.model);
    App.computeMs = performance.now() - t0;
  };
  App.on = function (fn) { App.listeners.push(fn); };
  App.update = function (opts) {
    App.compute();
    App.listeners.forEach(function (fn) { fn(opts || {}); });
    App.autosave();
  };

  // ---------- Storage ----------
  var saveTimer = null;
  App.autosave = function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      store(function (ls) { ls.setItem(STORE_MODEL, JSON.stringify({ model: App.model, dirty: App.dirty, at: Date.now() })); });
      var el = document.getElementById('autosave-state');
      if (el) el.textContent = App.t('autosaved');
    }, 400);
  };
  App.restore = function () {
    var raw = store(function (ls) { return ls.getItem(STORE_MODEL); });
    if (!raw) return false;
    try {
      var o = JSON.parse(raw);
      if (!o || !o.model || !Array.isArray(o.model.nodes)) return false;
      App.model = App.sanitize(o.model);
      App.dirty = !!o.dirty;
      return true;
    } catch (e) { return false; }
  };
  App.saveUi = function () { store(function (ls) { ls.setItem(STORE_UI, JSON.stringify({ display: App.display, panel: App.panel, view: App.view })); }); };
  App.restoreUi = function () {
    var raw = store(function (ls) { return ls.getItem(STORE_UI); });
    try { var o = JSON.parse(raw); if (o && o.display) { for (var k in o.display) App.display[k] = o.display[k]; App.panel = o.panel || App.panel; App.view = o.view || App.view; } } catch (e) {}
  };
  App.setLang = function (l) {
    App.lang = l;
    store(function (ls) { ls.setItem(STORE_LANG, l); });
  };

  // Accepts a loose object (file, storage) and returns a clean model.
  App.sanitize = function (m) {
    var base = QST.examples.blank();
    var out = {
      schema: 1,
      name: typeof m.name === 'string' ? m.name.slice(0, 120) : '',
      code: m.code === 'A23' ? 'A23' : 'S6',
      material: base.material,
      outline: Array.isArray(m.outline) ? m.outline.filter(function (p) { return Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]); }).map(function (p) { return [+p[0], +p[1]]; }) : base.outline,
      nodes: [], members: []
    };
    if (m.material) for (var k in base.material) if (m.material[k] !== undefined) out.material[k] = k === 'epsMode' ? (m.material[k] === 'yield' ? 'yield' : 'computed') : k === 'tieFaces' ? m.material[k] !== false : Number(m.material[k]) || 0;
    var ids = {};
    (m.nodes || []).forEach(function (n) {
      if (!n || !isFinite(n.x) || !isFinite(n.y) || ids[n.id]) return;
      var id = String(n.id || App.nextId('N', out.nodes));
      ids[id] = 1;
      out.nodes.push({ id: id, x: +n.x, y: +n.y, support: ['pin', 'rx', 'ry'].indexOf(n.support) >= 0 ? n.support : null, fx: +n.fx || 0, fy: +n.fy || 0, bearing: Math.max(0, +n.bearing || 0) });
    });
    var mids = {};
    (m.members || []).forEach(function (b) {
      if (!b || !ids[b.i] || !ids[b.j] || b.i === b.j || mids[b.id]) return;
      var id = String(b.id || App.nextId('M', out.members));
      mids[id] = 1;
      var bars = b.bars && b.bars.n > 0 && QST.csa.BARS[b.bars.size] ? { n: Math.round(+b.bars.n), size: b.bars.size } : null;
      out.members.push({ id: id, i: b.i, j: b.j, role: ['auto', 'strut', 'tie'].indexOf(b.role) >= 0 ? b.role : 'auto', w: Math.max(0, +b.w || 0), bars: bars, As: Math.max(0, +b.As || 0) });
    });
    if (out.outline.length < 3) out.outline = base.outline;
    return out;
  };

  App.load = function (model, opts) {
    App.model = App.sanitize(model);
    App.history = []; App.future = []; App.sel = null; App.hover = null;
    App.dirty = !!(opts && opts.dirty);
    App.update({ inputs: true, fit: true });
  };

  // ---------- UI helpers shared by modules ----------
  App.toast = function (msg) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(App._toast); App._toast = setTimeout(function () { el.classList.remove('show'); }, 2200);
  };
  App.download = function (name, text, type) {
    var blob = new Blob([text], { type: type || 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  App.fileBase = function () {
    var n = (App.model.name || 'quickerstrut').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '');
    return n || 'quickerstrut';
  };
  App.utilColor = function (u) {
    if (!isFinite(u)) return '#ff5d5d';
    var stops = [[0, [86, 224, 187]], [0.4, [166, 227, 107]], [0.7, [255, 209, 102]], [0.9, [255, 159, 67]], [1.0, [255, 93, 93]]];
    if (u > 1.0005) return 'rgb(255,93,93)';
    if (u >= 1) return 'rgb(255,127,80)';
    for (var i = 1; i < stops.length; i++) {
      if (u <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i], f = (u - a[0]) / (b[0] - a[0]);
        return 'rgb(' + a[1].map(function (c, k) { return Math.round(c + f * (b[1][k] - c)); }).join(',') + ')';
      }
    }
    return 'rgb(255,93,93)';
  };
  // Ink colour for utilisation on a light background (bars, tables).
  App.utilInk = function (u) { return !isFinite(u) || u > 1 ? '#b23a2a' : u > 0.9 ? '#b0641a' : u > 0.7 ? '#8a6d12' : '#1f7a5a'; };
  App.statusOf = function (u) { return !isFinite(u) || u > 1.0005 ? 'bad' : u > 0.95 ? 'warn' : 'ok'; };
})();
