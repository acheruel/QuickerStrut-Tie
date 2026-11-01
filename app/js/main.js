/* QuickerStrut&Tie — start-up, language, menus, files and keyboard shortcuts. */
(function () {
  'use strict';
  var QST = window.QST, App = QST.App;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  function applyLanguage() {
    document.documentElement.lang = App.lang;
    $$('[data-i18n]').forEach(function (el) { el.textContent = App.t(el.dataset.i18n); });
    $$('[data-i18n-title]').forEach(function (el) { el.title = App.t(el.dataset.i18nTitle); el.setAttribute('aria-label', App.t(el.dataset.i18nTitle)); });
    $('#lang-fr').classList.toggle('selected', App.lang === 'fr');
    $('#lang-en').classList.toggle('selected', App.lang === 'en');
    var meta = window.QST_META || {};
    $('#release-version').textContent = 'v' + meta.version + ' · ' + meta.author;
    $('#release-date').textContent = App.t('released') + ' ' + meta.date;
    $('#footer-version').textContent = 'QuickerStrut&Tie v' + meta.version + ' · ' + meta.date;
    $('#method-body').innerHTML = App.t('methodHtml');
    $('#project-name').placeholder = App.t('untitled');
    $('#autosave-state').textContent = App.t('autosaved');
    App.renderAllText();
    App.renderCanvas();
  }

  function closeMenus(except) {
    $$('.qst-menu.open').forEach(function (m) { if (m !== except) { m.classList.remove('open'); m.querySelector('[data-menu-toggle]').setAttribute('aria-expanded', 'false'); } });
  }

  function confirmDialog(title, body, okLabel) {
    return new Promise(function (resolve) {
      var d = $('#confirm-dialog');
      $('#confirm-title').textContent = title; $('#confirm-body').textContent = body; $('#confirm-ok').textContent = okLabel;
      d.returnValue = '';
      d.onclose = function () { resolve(d.returnValue === 'ok'); };
      d.showModal();
    });
  }
  function guard(action) {
    if (!App.dirty) return Promise.resolve(true);
    return confirmDialog(App.t('unsavedTitle'), App.t('unsavedBody'), App.t('discard'));
  }

  function saveProject() {
    var data = { app: 'QuickerStrut&Tie', version: (window.QST_META || {}).version, schema: 1, savedAt: new Date().toISOString(), model: App.model };
    App.download(App.fileBase() + '.quickerstrut.json', JSON.stringify(data, null, 1), 'application/json');
    App.dirty = false; App.update({ inputs: true });
    App.toast(App.t('saved'));
  }
  function openFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var o = JSON.parse(reader.result), model = o.model || o;
        if (!model || !Array.isArray(model.nodes)) throw new Error('format');
        App.load(model);
        App.toast(App.t('opened') + ' · ' + file.name);
      } catch (e) { App.toast(App.t('openError')); }
    };
    reader.readAsText(file);
  }

  function bind() {
    $('#lang-fr').addEventListener('click', function () { App.setLang('fr'); applyLanguage(); });
    $('#lang-en').addEventListener('click', function () { App.setLang('en'); applyLanguage(); });
    $$('[data-menu-toggle]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var menu = b.closest('.qst-menu'), open = !menu.classList.contains('open');
        closeMenus(menu); menu.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open));
      });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.qst-menu')) closeMenus(); });
    $('#examples-list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-example]'); if (!b) return;
      closeMenus();
      guard().then(function (go) { if (go) { App.load(QST.examples.build(b.dataset.example, App.lang)); App.toast(App.t('exampleLoaded')); } });
    });
    $('#new-project').addEventListener('click', function () {
      closeMenus();
      guard().then(function (go) { if (go) { var m = QST.examples.blank(); m.name = ''; App.load(m); App.setTool('node'); } });
    });
    $('#reset').addEventListener('click', function () {
      confirmDialog(App.t('resetTitle'), App.t('resetBody'), App.t('reset')).then(function (go) { if (go) App.load(QST.examples.build('deep-beam-1', App.lang)); });
    });
    $('#open-project').addEventListener('click', function () { closeMenus(); guard().then(function (go) { if (go) $('#project-file').click(); }); });
    $('#project-file').addEventListener('change', function (e) { var f = e.target.files[0]; if (f) openFile(f); e.target.value = ''; });
    $('#save-project').addEventListener('click', function () { closeMenus(); saveProject(); });
    $('#print-report').addEventListener('click', function () { closeMenus(); App.printReport(); });
    $('#export-svg').addEventListener('click', function () { closeMenus(); App.download(App.fileBase() + '-' + App.display.mode + '.svg', App.staticSVG({ mode: App.display.mode === 'geometry' ? 'forces' : App.display.mode }), 'image/svg+xml'); });
    $('#export-csv').addEventListener('click', function () { closeMenus(); App.exportCSV(); });
    $('#method-open').addEventListener('click', function () { $('#method-dialog').showModal(); });
    $$('dialog [data-close]').forEach(function (b) { b.addEventListener('click', function () { b.closest('dialog').close(); }); });
    $('#method-dialog').addEventListener('click', function (e) { if (e.target === e.currentTarget) e.currentTarget.close(); });
    window.addEventListener('beforeprint', function () { var r = $('#report'); if (!r.innerHTML) r.innerHTML = App.buildReport(); });
    window.addEventListener('afterprint', function () { $('#report').innerHTML = ''; });
    // Drop a project file anywhere on the page.
    document.addEventListener('dragover', function (e) { e.preventDefault(); });
    document.addEventListener('drop', function (e) { e.preventDefault(); var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) guard().then(function (go) { if (go) openFile(f); }); });

    document.addEventListener('keydown', function (e) {
      var tag = document.activeElement && document.activeElement.tagName;
      var typing = /INPUT|SELECT|TEXTAREA/.test(tag) || document.querySelector('dialog[open]');
      var mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); return; }
      if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); $('#open-project').click(); return; }
      if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); App.printReport(); return; }
      if (typing) return;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) App.redo(); else App.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); App.redo(); return; }
      if (mod) return;
      var tools = { v: 'select', n: 'node', b: 'member', s: 'support', l: 'load', c: 'outline', e: 'erase' };
      var k = e.key.toLowerCase();
      if (tools[k]) { App.setTool(tools[k]); return; }
      if (k === 'f') { App.fit(); return; }
      if (k === '1') { App.display.mode = 'geometry'; App.saveUi(); App.update(); return; }
      if (k === '2') { App.display.mode = 'forces'; App.saveUi(); App.update(); return; }
      if (k === '3') { App.display.mode = 'util'; App.saveUi(); App.update(); return; }
      if (k === '+' || k === '=') { App.zoom(1.2); return; }
      if (k === '-') { App.zoom(1 / 1.2); return; }
      if (e.key === 'Escape') { App.cancelPending(); if (App.tool !== 'select') App.setTool('select'); else { App.sel = null; App.emitSelection(); } return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && App.sel) {
        e.preventDefault();
        App.commit();
        if (App.sel.type === 'node') App.deleteNode(App.sel.id);
        else if (App.sel.type === 'member') App.deleteMember(App.sel.id);
        else if (App.sel.type === 'vertex' && App.model.outline.length > 3) App.model.outline.splice(App.sel.index, 1);
        App.sel = null; App.update({ inputs: true }); return;
      }
      var arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
      if (arrows[e.key] && App.sel) { e.preventDefault(); App.nudge(arrows[e.key][0], arrows[e.key][1]); }
    });
  }

  function start() {
    App.restoreUi();
    if (!App.restore()) App.model = App.sanitize(QST.examples.build('deep-beam-1', App.lang));
    App.compute();
    App.initPanels();
    App.initCanvas();
    bind();
    applyLanguage();
    App.update({ inputs: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
