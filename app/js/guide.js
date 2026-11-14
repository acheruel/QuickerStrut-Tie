// SPDX-License-Identifier: GPL-3.0-or-later
/* QuickerStrut&Tie — design guide window and interactive tutorial.
 *
 * The tutorial is a strip above the canvas (#coach). Each step names the tool
 * to use and a condition on the model that completes it; the user builds a
 * small deep beam from an empty outline.
 */
(function () {
  'use strict';
  var QST = window.QST, App = QST.App;
  var $ = function (s) { return document.querySelector(s); };
  var STORE_WELCOME = 'qst-welcome-v1';
  var tut = null;       // { step, base, timer } while the tutorial runs
  var welcome = false;  // first-visit invitation shown

  function store(fn) { try { return fn(window.localStorage); } catch (e) { return null; } }
  function geometry(m) { return m.nodes.map(function (n) { return n.x + ',' + n.y; }).join(';'); }

  // tool: tool selected when the step starts; target: control to point at;
  // done: condition that completes the step.
  var STEPS = [
    { tool: 'node', target: '[data-tool="node"]', done: function (m) { return m.nodes.length >= 3; } },
    { tool: 'member', target: '[data-tool="member"]', done: function (m) {
      return m.nodes.filter(function (n) {
        return m.members.filter(function (b) { return b.i === n.id || b.j === n.id; }).length >= 2;
      }).length >= 3;
    } },
    { tool: 'support', target: '[data-tool="support"]', done: function (m) {
      return m.nodes.some(function (n) { return n.support === 'pin'; }) && m.nodes.some(function (n) { return n.support === 'ry'; });
    } },
    { tool: 'load', target: '[data-tool="load"]', done: function (m) {
      return m.nodes.some(function (n) { return n.fy === -1500; }) && App.result.ok && App.result.forces.some(function (f) { return f.kind === 'tie'; });
    } },
    { tool: 'select', target: '[data-mode="util"]', done: function () { return App.display.mode === 'util'; } },
    { tool: 'select', target: '#auto-size', panel: 'params', done: function () { return App.checks.ok && App.checks.maxUtil <= 1; } },
    { tool: 'select', target: '[data-tool="select"]', done: function (m) { return geometry(m) !== tut.base; } },
    { tool: 'select', target: null, done: function () { return false; } }
  ];

  function render() {
    var el = $('#coach'), t = App.t;
    document.querySelectorAll('.coach-target').forEach(function (x) { x.classList.remove('coach-target'); });
    if (!tut) {
      if (!welcome) { el.classList.add('hidden'); el.innerHTML = ''; return; }
      el.className = 'coach';
      el.innerHTML = '<span class="coach-n">?</span><div class="coach-text"><b>' + t('welcomeTitle') + '</b><span>' + t('welcomeText') + '</span></div>' +
        '<div class="coach-actions"><button type="button" class="primary" data-coach="start">' + t('tutStart') + '</button><button type="button" data-coach="guide">' + t('welcomeGuide') + '</button><button type="button" class="coach-x" data-coach="dismiss" aria-label="' + t('close') + '">×</button></div>';
      return;
    }
    var n = tut.step, last = n === STEPS.length - 1, done = STEPS[n].done(App.model);
    el.className = 'coach' + (done ? ' done' : '');
    el.innerHTML = '<span class="coach-n">' + (n + 1) + '/' + STEPS.length + '</span>' +
      '<div class="coach-text"><b>' + t('tut' + (n + 1) + 'T') + '</b><span>' + t('tut' + (n + 1)) + '</span></div>' +
      '<div class="coach-actions">' + (done ? '<span class="coach-ok">✓ ' + t('tutDone') + '</span>' : '') +
      (n > 0 ? '<button type="button" data-coach="prev">' + t('tutPrev') + '</button>' : '') +
      '<button type="button" class="' + (done || last ? 'primary' : '') + '" data-coach="' + (last ? 'quit' : 'next') + '">' + t(last ? 'tutFinish' : 'tutNext') + '</button>' +
      (last ? '' : '<button type="button" class="coach-x" data-coach="quit" aria-label="' + t('tutQuit') + '" title="' + t('tutQuit') + '">×</button>') + '</div>';
    var target = STEPS[n].target && !done ? $(STEPS[n].target) : null;
    if (target) target.classList.add('coach-target');
  }

  function enter(step) {
    clearTimeout(tut.timer); tut.timer = null;
    tut.step = step;
    tut.base = geometry(App.model);
    App.sel = null;
    App.emitSelection();
    var s = STEPS[step];
    if (s.panel && App.panel !== s.panel) { App.panel = s.panel; App.update({ inputs: true }); }
    if (s.tool && App.tool !== s.tool) App.setTool(s.tool);
    render();
  }

  // Called after every change: a step completed by the user moves on by itself.
  function watch(o) {
    // Another model was opened (example, file, template): the tutorial ends.
    if (tut && o && o.fit) { quit(); return; }
    if (!tut || (o && o.drag)) return;
    if (tut.step < 3 && App.sel) { App.sel = null; App.emitSelection(); }
    if (!STEPS[tut.step].done(App.model)) { clearTimeout(tut.timer); tut.timer = null; }
    else if (!tut.timer && tut.step < STEPS.length - 1) {
      var at = tut.step;
      tut.timer = setTimeout(function () {
        tut.timer = null;
        if (STEPS[at].done(App.model)) enter(at + 1);
      }, 1300);
    }
    render();
  }

  function quit() {
    if (tut) clearTimeout(tut.timer);
    tut = null;
    render();
  }

  function start() {
    App.guard().then(function (go) {
      if (!go) return;
      dismissWelcome();
      var d = $('#guide-dialog');
      if (d.open) d.close();
      var m = QST.examples.blank();
      m.outline = [[0, 0], [4, 0], [4, 2], [0, 2]];
      m.name = App.t('tutName');
      App.display.mode = 'forces';
      App.load(m);
      tut = { step: 0, timer: null };
      enter(0);
    });
  }

  function dismissWelcome() {
    welcome = false;
    store(function (ls) { ls.setItem(STORE_WELCOME, '1'); });
  }

  App.initGuide = function () {
    $('#guide-open').addEventListener('click', function () { $('#guide-dialog').showModal(); });
    $('#guide-dialog').addEventListener('click', function (e) { if (e.target === e.currentTarget) e.currentTarget.close(); });
    $('#tut-start').addEventListener('click', start);
    $('#coach').addEventListener('click', function (e) {
      var b = e.target.closest('[data-coach]'); if (!b) return;
      var a = b.dataset.coach;
      if (a === 'start') start();
      else if (a === 'guide') { dismissWelcome(); render(); $('#guide-dialog').showModal(); }
      else if (a === 'dismiss') { dismissWelcome(); render(); }
      else if (a === 'next') enter(tut.step + 1);
      else if (a === 'prev') enter(tut.step - 1);
      else if (a === 'quit') quit();
    });
    welcome = !store(function (ls) { return ls.getItem(STORE_WELCOME); });
    App.on(watch);
    render();
  };
  App.renderGuide = function () {
    $('#guide-body').innerHTML = App.t('guideHtml');
    render();
  };
})();
