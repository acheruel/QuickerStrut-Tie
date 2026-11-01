// SPDX-License-Identifier: GPL-3.0-or-later
/* QuickerStrut&Tie — side panel, inspector, metrics, result tables, toolbar. */
(function () {
  'use strict';
  var QST = window.QST, App = QST.App, t = App.t, fmt = App.fmt, esc = App.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var ICONS = {
    select: '<path d="M5 3l10 7-4.3 1 2.6 5-2 1-2.6-5L5 15z" fill="currentColor"/>',
    node: '<circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15 3.5v4M13 5.5h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    member: '<path d="M4.5 15.5L15.5 4.5" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2.2"/><circle cx="4.5" cy="15.5" r="2.4" fill="currentColor"/><circle cx="15.5" cy="4.5" r="2.4" fill="currentColor"/>',
    support: '<path d="M10 4l-6 9h12z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M3 16h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    load: '<path d="M10 2.5v11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5.5 10l4.5 5.5 4.5-5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',
    outline: '<path d="M3.5 5.5l9-2 4 6-3 7.5h-8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><rect x="2" y="4" width="3" height="3" fill="currentColor"/><rect x="11" y="2" width="3" height="3" fill="currentColor"/><rect x="15" y="8" width="3" height="3" fill="currentColor"/>',
    erase: '<path d="M8 16.5h8.5M3.5 12l7-7.5 5.5 5.5-7 7H6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
  };
  var TOOLS = [['select', 'V'], ['node', 'N'], ['member', 'B'], ['support', 'S'], ['load', 'L'], ['outline', 'C'], ['erase', 'E']];

  function numInput(value, attrs) {
    return '<input class="num" inputmode="decimal" autocomplete="off" spellcheck="false" value="' + esc(App.fmtInput(value)) + '" ' + attrs + '>';
  }
  function unitField(label, key, value, unit, extra) {
    return '<label class="field"><span>' + label + (extra || '') + '</span><span class="unit-wrap">' + numInput(value, 'data-k="' + key + '"') + '<i>' + unit + '</i></span></label>';
  }

  // ---------------------------------------------------------- toolbox ---
  function renderToolbox() {
    $('#toolbox').innerHTML = TOOLS.map(function (tl) {
      return '<button type="button" class="tool' + (App.tool === tl[0] ? ' active' : '') + '" data-tool="' + tl[0] + '" title="' + esc(t('tool_' + tl[0]) + ' (' + tl[1] + ')') + '" aria-pressed="' + (App.tool === tl[0]) + '"><svg viewBox="0 0 20 20" aria-hidden="true">' + ICONS[tl[0]] + '</svg><span class="tl">' + t('tool_' + tl[0]) + '</span><span class="k">' + tl[1] + '</span></button>';
    }).join('');
    $('#display-mode').innerHTML = ['geometry', 'forces', 'util'].map(function (m) {
      return '<button type="button" data-mode="' + m + '" class="' + (App.display.mode === m ? 'active' : '') + '">' + t('mode_' + m) + '</button>';
    }).join('');
    var chips = { bands: 'chipBands', zones: 'chipZones', ids: 'chipIds', snap: 'chipSnap' };
    Object.keys(chips).forEach(function (k) {
      var el = $('#toggle-' + k);
      el.setAttribute('aria-pressed', String(!!App.display[k]));
      el.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true">' + (App.display[k] ? '<path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' : '<circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/>') + '</svg><span class="cl">' + t(chips[k]) + '</span>';
      el.title = t(chips[k]);
    });
    $('#undo').disabled = !App.history.length;
    $('#redo').disabled = !App.future.length;
  }

  function renderLegend() {
    var el = $('#legend');
    if (App.display.mode === 'util') {
      el.innerHTML = '<span>0</span><span class="grad"></span><span>≥ 1,0</span>'.replace('1,0', fmt(1, 1));
      return;
    }
    el.innerHTML =
      '<span><svg width="26" height="8"><line x1="1" y1="4" x2="25" y2="4" stroke="#7cb4ff" stroke-width="2.4" stroke-dasharray="7 4"/></svg>' + t('legendStrut') + '</span>' +
      '<span><svg width="26" height="8"><line x1="1" y1="4" x2="25" y2="4" stroke="#ffc978" stroke-width="3.2"/></svg>' + t('legendTie') + '</span>' +
      '<span><svg width="26" height="8"><line x1="1" y1="4" x2="25" y2="4" stroke="#6f8a99" stroke-width="1.4" stroke-dasharray="2 4"/></svg>' + t('legendZero') + '</span>' +
      (App.display.mode === 'forces' ? '<span><svg width="18" height="10"><path d="M1 5h11" stroke="#56e0bb" stroke-width="2"/><path d="M17 5l-6-4v8z" fill="#56e0bb"/></svg>' + t('legendReaction') + '</span>' : '');
  }

  // --------------------------------------------------------- inputs ---
  function renderInputs() {
    var box = $('#input-content'), active = document.activeElement, key = active && box.contains(active) ? active.dataset.k : null;
    var scroll = box.scrollTop;
    $$('.input-tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.panel === App.panel); });
    $('#count-nodes').textContent = App.model.nodes.length;
    $('#count-members').textContent = App.model.members.length;
    if (App.panel === 'params') box.innerHTML = paramsPanel();
    else if (App.panel === 'nodes') box.innerHTML = nodesPanel();
    else box.innerHTML = membersPanel();
    box.scrollTop = scroll;
    if (key) { var el = box.querySelector('[data-k="' + key + '"]'); if (el) { el.focus(); if (el.select) try { el.select(); } catch (e) {} } }
    $('#project-name').value = App.model.name || '';
    $('#dirty').textContent = App.dirty ? '● ' + t('unsaved') : '';
  }

  function paramsPanel() {
    var m = App.model, mat = m.material, code = QST.csa.CODES[m.code], F = QST.csa.factors(m);
    var h = '';
    h += '<div class="section-label">' + t('designCode') + '</div>';
    h += '<div class="segmented full" role="group">' + ['S6', 'A23'].map(function (c) {
      return '<button type="button" class="code-card' + (m.code === c ? ' active' : '') + '" data-code="' + c + '"><b>' + QST.csa.CODES[c].name + '</b><small>' + t('code_' + c) + '</small></button>';
    }).join('') + '</div>';
    h += '<div class="section-label">' + t('materials') + '</div>';
    h += '<div class="field-row">' + unitField("f'c", 'mat.fc', mat.fc, 'MPa') + unitField('fy', 'mat.fy', mat.fy, 'MPa') + '</div>';
    h += '<div class="field-row">' + unitField('Es', 'mat.Es', mat.Es, 'MPa') + unitField(t('thickness') + ' b', 'mat.b', mat.b, 'mm') + '</div>';
    h += '<div class="field-row">' +
      '<label class="field"><span>φc <em>' + t('auto') + ' ' + fmt(code.phiC, 2) + '</em></span>' + numInput(mat.phiC || '', 'data-k="mat.phiC" placeholder="' + fmt(code.phiC, 2) + '"') + '</label>' +
      '<label class="field"><span>φs <em>' + t('auto') + ' ' + fmt(code.phiS, 2) + '</em></span>' + numInput(mat.phiS || '', 'data-k="mat.phiS" placeholder="' + fmt(code.phiS, 2) + '"') + '</label></div>';
    h += '<label class="field"><span>' + t('epsMode') + '</span><select data-k="mat.epsMode"><option value="computed"' + (mat.epsMode !== 'yield' ? ' selected' : '') + '>' + t('epsComputed') + '</option><option value="yield"' + (mat.epsMode === 'yield' ? ' selected' : '') + '>' + t('epsYield') + '</option></select></label>';
    h += '<label class="toggle-row"><input type="checkbox" data-k="mat.tieFaces"' + (mat.tieFaces !== false ? ' checked' : '') + '>' + t('tieFaces') + '</label>';
    h += '<div class="note">' + (m.code === 'S6' ? t('alphaNote').replace('{a}', fmt(QST.csa.alpha1(mat.fc), 3)) + ' ' : '') + t('factorsNote').replace('{phiC}', fmt(F.phiC, 2)).replace('{phiS}', fmt(F.phiS, 2)).replace('{Ec}', fmt(QST.solver.concreteModulus(m.code, mat.fc), 0)) + '</div>';
    h += '<div class="section-label">' + t('crackControl') + '<span style="font-weight:500;letter-spacing:0;text-transform:none">' + t('clause') + ' ' + code.clause.crack + '</span></div>';
    h += '<div class="field-row three">' +
      '<label class="field"><span>ρh</span>' + numInput(mat.rhoH, 'data-k="mat.rhoH"') + '</label>' +
      '<label class="field"><span>ρv</span>' + numInput(mat.rhoV, 'data-k="mat.rhoV"') + '</label>' +
      '<label class="field"><span>s (mm)</span>' + numInput(mat.spacing, 'data-k="mat.spacing"') + '</label></div>';
    h += '<p class="note">' + t('crackNote').replace('{rho}', fmt(code.rhoMin, 3)).replace('{s}', fmt(code.sMax, 0)) + (code.maxFaceArea ? ' ' + t('crackCapNote').replace('{a}', fmt(code.maxFaceArea, 0)) : '') + '</p>';
    h += '<div class="section-label">' + t('outline') + '<span style="font-weight:500;letter-spacing:0;text-transform:none">' + m.outline.length + ' ' + t('vertices') + '</span></div>';
    var b = bounds(m.outline);
    h += '<div class="field-row">' + unitField(t('width'), 'rect.w', App.round(b.x1 - b.x0), 'm') + unitField(t('height'), 'rect.h', App.round(b.y1 - b.y0), 'm') + '</div>';
    h += '<button type="button" class="add-button" id="apply-rect">' + t('applyRect') + '</button>';
    h += '<p class="note">' + t('outlineNote') + '</p>';
    h += '<div class="section-label">' + t('anchorage') + '<span style="font-weight:500;letter-spacing:0;text-transform:none">' + t('clause') + ' ' + code.clause.anchor.split(' · ')[0] + '</span></div>';
    h += '<div class="field-row">' + unitField(t('cover'), 'mat.cover', mat.cover, 'mm') +
      '<label class="field"><span>' + t('ldFactor') + '</span><select data-k="mat.ldFactor"><option value="0.45"' + (Number(mat.ldFactor) !== 0.6 ? ' selected' : '') + '>0,45 · ' + t('ldFav') + '</option><option value="0.6"' + (Number(mat.ldFactor) === 0.6 ? ' selected' : '') + '>0,6 · ' + t('ldOther') + '</option></select></label></div>';
    h += '<p class="note">' + t('anchorNote') + '</p>';
    h += '<div class="section-label">' + t('autoSizeTitle') + '</div>';
    h += '<button type="button" class="add-button" id="auto-size">⚙ ' + t('autoSize') + '</button><p class="note">' + t('autoSizeNote') + '</p>';
    return h;
  }
  function bounds(pts) {
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys) };
  }

  function supportOptions(v) {
    return [['', t('sup_none')], ['pin', t('sup_pin')], ['ry', t('sup_ry')], ['rx', t('sup_rx')]].map(function (o) {
      return '<option value="' + o[0] + '"' + ((v || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('');
  }
  function nodesPanel() {
    var h = '<div class="rows">';
    if (!App.model.nodes.length) h += '<p class="note">' + t('noNodes') + '</p>';
    App.model.nodes.forEach(function (n) {
      var sel = App.sel && App.sel.type === 'node' && App.sel.id === n.id;
      h += '<div class="row-card' + (sel ? ' selected' : '') + '" data-row-node="' + n.id + '">' +
        '<div class="row-line row-node-1"><span class="tag" data-pick-node="' + n.id + '">' + n.id + '</span>' +
        '<label><span class="mini">x (m)</span>' + numInput(n.x, 'data-k="n.' + n.id + '.x"') + '</label>' +
        '<label><span class="mini">y (m)</span>' + numInput(n.y, 'data-k="n.' + n.id + '.y"') + '</label>' +
        '<button type="button" class="del" data-del-node="' + n.id + '" title="' + t('delete') + '">×</button></div>' +
        '<div class="row-line row-node-2"><label><span class="mini">' + t('support') + '</span><select data-k="n.' + n.id + '.support">' + supportOptions(n.support) + '</select></label>' +
        '<label><span class="mini">Fx (kN)</span>' + numInput(n.fx, 'data-k="n.' + n.id + '.fx"') + '</label>' +
        '<label><span class="mini">Fy (kN)</span>' + numInput(n.fy, 'data-k="n.' + n.id + '.fy"') + '</label>' +
        '<label><span class="mini">' + t('bearingShort') + ' (mm)</span>' + numInput(n.bearing, 'data-k="n.' + n.id + '.bearing"') + '</label></div></div>';
    });
    h += '</div><button type="button" class="add-button" id="add-node">+ ' + t('addNode') + '</button>';
    h += '<p class="note">' + t('nodesNote') + '</p>';
    return h;
  }
  function barOptions(size) {
    return Object.keys(QST.csa.BARS).map(function (k) { return '<option' + (k === size ? ' selected' : '') + '>' + k + '</option>'; }).join('');
  }
  function nodeOptions(v) { return App.model.nodes.map(function (n) { return '<option' + (n.id === v ? ' selected' : '') + '>' + n.id + '</option>'; }).join(''); }
  function membersPanel() {
    var h = '<div class="rows">';
    if (!App.model.members.length) h += '<p class="note">' + t('noMembers') + '</p>';
    App.model.members.forEach(function (m) {
      var sel = App.sel && App.sel.type === 'member' && App.sel.id === m.id, f = App.force(m.id), kind = f ? f.kind : 'zero';
      h += '<div class="row-card' + (sel ? ' selected' : '') + '" data-row-member="' + m.id + '">' +
        '<div class="row-line row-mem-1"><span class="tag ' + kind + '" data-pick-member="' + m.id + '" title="' + t('kind_' + kind) + '">' + m.id + '</span>' +
        '<label><span class="mini">' + t('from') + '</span><select data-k="m.' + m.id + '.i">' + nodeOptions(m.i) + '</select></label>' +
        '<label><span class="mini">' + t('to') + '</span><select data-k="m.' + m.id + '.j">' + nodeOptions(m.j) + '</select></label>' +
        '<label><span class="mini">' + t('role') + '</span><select data-k="m.' + m.id + '.role"><option value="auto"' + (m.role === 'auto' ? ' selected' : '') + '>' + t('role_auto') + '</option><option value="strut"' + (m.role === 'strut' ? ' selected' : '') + '>' + t('kind_strut') + '</option><option value="tie"' + (m.role === 'tie' ? ' selected' : '') + '>' + t('kind_tie') + '</option></select></label>' +
        '<button type="button" class="del" data-del-member="' + m.id + '" title="' + t('delete') + '">×</button></div>' +
        '<div class="row-line row-mem-2"><label><span class="mini">w (mm)</span>' + numInput(m.w, 'data-k="m.' + m.id + '.w"') + '</label>' +
        '<label><span class="mini">' + t('bars') + '</span><span class="bars-pick">' + numInput(m.bars ? m.bars.n : 0, 'data-k="m.' + m.id + '.barsN"') + '<b>×</b><select data-k="m.' + m.id + '.barsSize">' + barOptions(m.bars ? m.bars.size : '20M') + '</select></span></label>' +
        '<label><span class="mini">N (kN)</span><input disabled class="num" value="' + (f ? fmt(f.N, 1) : '—') + '"></label></div></div>';
    });
    h += '</div>';
    h += '<p class="note">' + t('membersNote') + '</p>';
    return h;
  }

  // Apply one edited field (data-k) to the model.
  function applyField(el) {
    var k = el.dataset.k; if (!k) return;
    var parts = k.split('.'), m = App.model;
    var isNum = el.classList.contains('num');
    var val = el.type === 'checkbox' ? el.checked : isNum ? App.parse(el.value) : el.value;
    if (isNum && (val === null && !/phi/.test(k))) { el.classList.add('num-err'); return; }
    if (isNum && Number.isNaN(val)) { el.classList.add('num-err'); return; }
    el.classList.remove('num-err');
    App.commit();
    if (parts[0] === 'mat') {
      var key = parts[1];
      if (key === 'epsMode') m.material.epsMode = val;
      else if (key === 'ldFactor') m.material.ldFactor = Number(val);
      else if (key === 'tieFaces') m.material.tieFaces = !!val;
      else m.material[key] = val === null ? 0 : Math.max(0, val);
    } else if (parts[0] === 'n') {
      var n = App.node(parts[1]); if (!n) return;
      if (parts[2] === 'support') n.support = val || null;
      else if (parts[2] === 'bearing') n.bearing = Math.max(0, val);
      else n[parts[2]] = val;
    } else if (parts[0] === 'm') {
      var b = App.member(parts[1]); if (!b) return;
      var f = parts[2];
      if (f === 'i' || f === 'j') {
        var other = f === 'i' ? b.j : b.i;
        if (val === other) { App.history.pop(); App.toast(t('memberSelf')); renderInputs(); return; }
        b[f] = val;
      } else if (f === 'role') b.role = val;
      else if (f === 'w') b.w = Math.max(0, val);
      else if (f === 'barsN') { var nb = Math.max(0, Math.round(val)); b.bars = nb > 0 ? { n: nb, size: b.bars ? b.bars.size : '20M' } : null; if (!nb) b.As = 0; }
      else if (f === 'barsSize') { b.bars = { n: b.bars && b.bars.n > 0 ? b.bars.n : 2, size: val }; }
      else if (f === 'As') { b.bars = null; b.As = Math.max(0, val); }
      else if (f === 'anchor') b.anchor = val;
      App.lastMemberProto = { role: 'auto', w: b.w, bars: b.bars, As: b.As };
    } else if (parts[0] === 'rect') {
      App.history.pop();
      return; // applied with the button
    }
    App.update({ inputs: true });
  }

  // -------------------------------------------------------- inspector ---
  function renderInspector(opts) {
    var el = $('#inspector'), s = App.sel;
    if (!s || s.type === 'vertex' && !App.model.outline[s.index]) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    var focusKey = document.activeElement && el.contains(document.activeElement) ? document.activeElement.dataset.k : null;
    var h = '';
    if (s.type === 'node') h = nodeInspector(App.node(s.id));
    else if (s.type === 'member') h = memberInspector(App.member(s.id));
    else if (s.type === 'vertex') h = vertexInspector(s.index);
    if (!h) { el.classList.add('hidden'); return; }
    var wasHidden = el.classList.contains('hidden');
    el.innerHTML = h;
    el.classList.remove('hidden');
    if (wasHidden) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
    var fk = (opts && opts.focus) ? 'n.' + s.id + '.' + opts.focus : focusKey;
    if (fk) { var f = el.querySelector('[data-k="' + fk + '"]'); if (f) { f.focus(); try { f.select(); } catch (e) {} } }
  }
  function head(badge, cls, title, sub) {
    return '<div class="ins-head"><span class="ins-badge ' + (cls || '') + '">' + badge + '</span><div class="ins-title"><b>' + title + '</b><small>' + sub + '</small></div><button type="button" class="ins-close" data-ins-close aria-label="' + t('close') + '">×</button></div>';
  }
  function ubar(u) { var w = Math.min(100, (isFinite(u) ? u : 1.2) * 100 / 1.2); return '<div class="ubar"><i style="width:' + w + '%;background:' + App.utilColor(u) + '"></i></div>'; }
  function statusBadge(u) {
    var s = App.statusOf(u);
    return '<span class="status ' + s + '">' + (s === 'bad' ? '✕ ' + t('statusBad') : s === 'warn' ? '! ' + t('statusWarn') : '✓ ' + t('statusOk')) + '</span>';
  }
  function deg(r) { return r * 180 / Math.PI; }

  function nodeInspector(n) {
    if (!n) return '';
    var nc = App.nodeCheck(n.id), R = App.reaction(n.id);
    var h = head(n.id, '', t('node') + ' ' + n.id, nc ? t('nodeType_' + nc.type) : t('nodeFree'));
    h += '<div class="ins-body">';
    h += '<div class="field-row"><label class="field"><span>x (m)</span>' + numInput(n.x, 'data-k="n.' + n.id + '.x"') + '</label><label class="field"><span>y (m)</span>' + numInput(n.y, 'data-k="n.' + n.id + '.y"') + '</label></div>';
    h += '<label class="field"><span>' + t('support') + '</span><select data-k="n.' + n.id + '.support">' + supportOptions(n.support) + '</select></label>';
    h += '<div class="field-row three"><label class="field"><span>Fx (kN)</span>' + numInput(n.fx, 'data-k="n.' + n.id + '.fx"') + '</label><label class="field"><span>Fy (kN)</span>' + numInput(n.fy, 'data-k="n.' + n.id + '.fy"') + '</label><label class="field"><span>' + t('bearingShort') + ' (mm)</span>' + numInput(n.bearing, 'data-k="n.' + n.id + '.bearing"') + '</label></div>';
    if (R) h += '<div class="ins-result"><div class="kv"><span>Rx</span><span>' + fmt(R.rx, 1) + ' kN</span><span>Ry</span><span>' + fmt(R.ry, 1) + ' kN</span></div></div>';
    if (nc) {
      var code = QST.csa.CODES[App.model.code];
      h += '<div class="ins-result"><div class="big"><div><small>' + t('nodalZone') + ' ' + nc.type + '</small><br><b style="color:' + App.utilInk(nc.util) + '">' + fmt(nc.util, 2) + '</b></div>' + statusBadge(nc.util) + '</div>' + ubar(nc.util);
      h += '<div class="kv"><span>' + t('stressLimit') + '</span><span>' + fmt(nc.limit, 2) + ' MPa</span>';
      nc.faces.forEach(function (fa) {
        h += '<span>σ ' + t('face_' + fa.kind) + ' ' + (fa.kind === 'strut' || fa.kind === 'tie' ? fa.ref : '') + '</span><span style="color:' + App.utilInk(fa.util) + '">' + fmt(fa.stress, 2) + ' MPa</span>';
      });
      h += '</div><div class="steps"><span class="cl">' + code.name + ' ' + nc.clause + '</span><div class="eq">f<sub>lim</sub> = ' + fmt(nc.factor, 2) + ' · φc · f′c = ' + fmt(nc.factor, 2) + ' × ' + fmt(App.checks.phiC, 2) + ' × ' + fmt(App.model.material.fc, 1) + ' = ' + fmt(nc.limit, 2) + ' MPa</div>';
      if (nc.governingFace) { var g = nc.governingFace; h += '<div class="eq">σ = F / (w · b) = ' + fmt(g.force, 0) + ' kN / (' + fmt(g.width, 0) + ' × ' + fmt(App.model.material.b, 0) + ') = ' + fmt(g.stress, 2) + ' MPa</div>'; }
      h += '</div></div>';
    }
    if (nc && nc.zone) {
      var z = nc.zone;
      h += '<div class="ins-result"><div class="big"><div><small>' + t('hydroZone') + '</small><br><b style="color:' + App.utilInk(z.util) + '">' + fmt(z.sigma, 2) + ' <small>MPa</small></b></div><div style="text-align:right"><small>' + t('utilShort') + '</small><br><b style="color:' + App.utilInk(z.util) + '">' + fmt(z.util, 2) + '</b></div></div>';
      h += '<div class="kv"><span><b>' + t('face') + '</b></span><span><b>F · w → w<sub>h</sub></b></span>';
      z.faces.forEach(function (fa) { h += '<span>' + t('face_' + fa.kind) + ' ' + (fa.kind === 'strut' || fa.kind === 'tie' ? fa.ref : '') + '</span><span>' + fmt(fa.force, 0) + ' kN · ' + (fa.wGiven > 0 ? fmt(fa.wGiven, 0) : '—') + ' → ' + fmt(fa.wHydro, 0) + ' mm</span>'; });
      h += '</div><div class="steps">' + t(z.scaled === 'face' ? 'hydroNoteFace' : 'hydroNoteLimit') + (z.outside ? '<div style="color:var(--bad)">⚠ ' + t('zoneOutside') + '</div>' : '') + '</div></div>';
    }
    h += '<p class="ins-hint">' + t('nodeHint') + '</p></div>';
    return h;
  }

  function memberInspector(m) {
    if (!m) return '';
    var f = App.force(m.id), c = App.memberCheck(m.id), kind = f ? f.kind : 'zero';
    var A = App.node(m.i), B = App.node(m.j), L = Math.hypot(B.x - A.x, B.y - A.y), ang = deg(Math.atan2(B.y - A.y, B.x - A.x));
    var code = QST.csa.CODES[App.model.code], mat = App.model.material;
    var h = head(m.id, kind, t('kind_' + kind) + ' ' + m.id, m.i + ' → ' + m.j + ' · L = ' + fmt(L, 3) + ' m · ' + fmt(ang, 1) + '°');
    h += '<div class="ins-body">';
    h += '<div class="field-row"><label class="field"><span>' + t('role') + '</span><select data-k="m.' + m.id + '.role"><option value="auto"' + (m.role === 'auto' ? ' selected' : '') + '>' + t('role_auto') + '</option><option value="strut"' + (m.role === 'strut' ? ' selected' : '') + '>' + t('kind_strut') + '</option><option value="tie"' + (m.role === 'tie' ? ' selected' : '') + '>' + t('kind_tie') + '</option></select></label>' +
      '<label class="field"><span>' + t('effWidth') + ' w (mm)</span>' + numInput(m.w, 'data-k="m.' + m.id + '.w"') + '</label></div>';
    h += '<div class="field-row bars-row"><label class="field"><span>' + t('bars') + '</span><span class="bars-pick" style="grid-template-columns:56px 12px 1fr">' + numInput(m.bars ? m.bars.n : 0, 'data-k="m.' + m.id + '.barsN"') + '<b>×</b><select data-k="m.' + m.id + '.barsSize">' + barOptions(m.bars ? m.bars.size : '20M') + '</select></span></label>' +
      '<label class="field"><span>As (mm²)</span>' + numInput(QST.csa.memberArea(m), 'data-k="m.' + m.id + '.As"') + '</label></div>';
    if (f) {
      h += '<div class="ins-result"><div class="big"><div><small>' + (kind === 'tie' ? t('tension') : kind === 'strut' ? t('compression') : t('zeroForce')) + '</small><br><b>' + fmt(Math.abs(f.N), 1) + ' <small>kN</small></b></div>' + (c && kind !== 'zero' ? '<div style="text-align:right"><small>' + t('utilShort') + '</small><br><b style="color:' + App.utilInk(c.util) + '">' + fmt(c.util, 2) + '</b></div>' : '') + '</div>';
      if (c && kind !== 'zero') {
        h += ubar(c.util) + '<div style="padding:0 12px 6px">' + statusBadge(c.util) + '</div>';
        if (kind === 'tie') {
          h += '<div class="kv"><span>Tr</span><span>' + fmt(c.capacity, 0) + ' kN</span><span>As</span><span>' + fmt(c.As, 0) + ' mm²</span><span>As,req</span><span>' + fmt(c.asReq, 0) + ' mm²</span><span>εs</span><span>' + fmt(c.epsS * 1000, 3) + ' ‰</span></div>';
          h += '<div class="steps"><span class="cl">' + code.name + ' ' + c.clause + '</span><div class="eq">Tr = φs · fy · As = ' + fmt(App.checks.phiS, 2) + ' × ' + fmt(mat.fy, 0) + ' × ' + fmt(c.As, 0) + ' = ' + fmt(c.capacity, 0) + ' kN</div></div>';
        } else {
          h += '<div class="kv"><span>Cr</span><span>' + fmt(c.capacity, 0) + ' kN</span><span>fcu</span><span>' + fmt(c.fcu, 2) + ' MPa</span><span>w / w,req</span><span>' + fmt(c.w, 0) + ' / ' + fmt(c.wReq, 0) + ' mm</span>' +
            (c.theta !== null ? '<span>θs (' + t('withTie') + ')</span><span>' + fmt(deg(c.theta), 1) + '°</span><span>ε1</span><span>' + fmt(c.eps1 * 1000, 3) + ' ‰</span>' : '') + '</div>';
          h += '<div class="steps"><span class="cl">' + code.name + ' ' + c.clause + '</span>';
          c.ends.forEach(function (e) {
            var gov = e.node === c.governingEnd;
            h += '<div style="' + (gov ? '' : 'opacity:.6') + '"><b>' + t('end') + ' ' + e.node + '</b>' + (gov ? ' · ' + t('governs') : '') + '</div>';
            if (e.tie) {
              h += '<div class="eq">ε1 = εs + (εs + ' + App.dl('0,002') + ') cot²θs = ' + fmt(e.epsS * 1000, 3) + '‰ + (' + fmt(e.epsS * 1000, 3) + '‰ + 2‰) · cot²(' + fmt(deg(e.theta), 1) + '°) = ' + fmt(e.eps1 * 1000, 3) + ' ‰</div>';
              h += '<div class="eq">fcu = f′c / (' + App.dl('0,8') + ' + 170 ε1) = ' + fmt(mat.fc, 1) + ' / (' + App.dl('0,8') + ' + 170 × ' + fmt(e.eps1, 5) + ') = ' + fmt(e.fcuRaw, 2) + (e.capped ? ' → ' + App.capLabel() + ' = ' + fmt(e.fcu, 2) : '') + ' MPa</div>';
            } else {
              h += '<div class="eq">' + t('noTieAtEnd') + ' → fcu = ' + App.capLabel() + ' = ' + fmt(e.fcu, 2) + ' MPa</div>';
            }
          });
          h += '<div class="eq">Cr = φc · fcu · w · b = ' + fmt(App.checks.phiC, 2) + ' × ' + fmt(c.fcu, 2) + ' × ' + fmt(c.w, 0) + ' × ' + fmt(mat.b, 0) + ' = ' + fmt(c.capacity, 0) + ' kN</div></div>';
        }
      }
      h += '</div>';
    }
    h += '<label class="field" style="margin-top:10px"><span>' + t('anchorType') + '</span><select data-k="m.' + m.id + '.anchor">' + ['straight', 'hook', 'plate', 'stirrup'].map(function (a) { return '<option value="' + a + '"' + ((m.anchor || 'hook') === a ? ' selected' : '') + '>' + t('anchor_' + a) + '</option>'; }).join('') + '</select></label>';
    var ans = App.checks && App.checks.ok ? App.checks.anchors.filter(function (a) { return a.member === m.id; }) : [];
    if (ans.length) {
      h += '<div class="ins-result"><div class="kv">';
      ans.forEach(function (a) {
        h += '<span><b>' + t('anchorage') + ' ' + a.node + '</b>' + (a.top ? ' · k1 = 1,3' : '') + '</span><span>' + (a.mechanical ? '<span class="status ok">' + t('anchor_' + a.type) + '</span>' : a.na ? '<span class="status na">db ?</span>' : '<b style="color:' + App.utilInk(a.util) + '">' + fmt(a.util, 2) + '</b>') + '</span>';
        h += '<span>l<sub>a</sub> = ' + fmt(a.dc, 0) + ' + ' + fmt(a.e, 0) + '</span><span>' + fmt(a.la, 0) + ' mm</span>';
        if (!a.mechanical && !a.na) h += '<span>' + (a.type === 'hook' ? 'l<sub>dh</sub>' : 'l<sub>d</sub>') + ' (d<sub>b</sub> ' + fmt(a.db, 1) + ')</span><span>' + fmt(a.req, 0) + ' mm</span>';
      });
      h += '</div><div class="steps">' + t('anchorSteps') + '<span class="cl">' + QST.csa.CODES[App.model.code].name + ' ' + QST.csa.CODES[App.model.code].clause.anchor + '</span></div></div>';
    }
    h += '<p class="ins-hint">' + t('memberHint') + '</p></div>';
    return h;
  }
  function vertexInspector(k) {
    var p = App.model.outline[k]; if (!p) return '';
    var h = head('◇', '', t('vertex') + ' ' + (k + 1), t('outline'));
    h += '<div class="ins-body"><div class="field-row"><label class="field"><span>x (m)</span>' + numInput(p[0], 'data-k="v.' + k + '.0"') + '</label><label class="field"><span>y (m)</span>' + numInput(p[1], 'data-k="v.' + k + '.1"') + '</label></div>';
    h += '<button type="button" class="add-button" data-del-vertex="' + k + '"' + (App.model.outline.length <= 3 ? ' disabled' : '') + '>' + t('deleteVertex') + '</button><p class="ins-hint">' + t('vertexHint') + '</p></div>';
    return h;
  }

  // ---------------------------------------------------------- metrics ---
  function renderMetrics() {
    var el = $('#metrics'), r = App.result, c = App.checks;
    if (!r || !r.ok) {
      el.innerHTML = metric(t('mUtil'), '—', '', '', null) + metric(t('mStrut'), '—', 'kN', '', null) + metric(t('mTie'), '—', 'kN', '', null) +
        metric(t('mModel'), '<span style="color:var(--bad)">' + (r && r.error === 'mechanism' ? t('mechanism') : r && r.error === 'empty' ? t('emptyModel') : t('invalidModel')) + '</span>', '', App.model.nodes.length + ' ' + t('nodesLc') + ' · ' + App.model.members.length + ' ' + t('membersLc'), null);
      return;
    }
    var gov = c.governing, maxS = null, maxT = null;
    r.forces.forEach(function (f) { if (f.kind === 'strut' && (!maxS || -f.N > -maxS.N)) maxS = f; if (f.kind === 'tie' && (!maxT || f.N > maxT.N)) maxT = f; });
    var r0 = r.indeterminacy;
    var stat = r0 === 0 ? t('determinate') : r0 > 0 ? t('indeterminate') + ' (r = ' + r0 + ')' : t('mechanism');
    el.innerHTML =
      metric(t('mUtil'), gov ? '<span style="color:' + App.utilInk(c.maxUtil) + '">' + fmt(c.maxUtil, 2) + '</span>' : '—', '', gov ? (gov.kind === 'node' ? t('node') + ' ' + gov.id + ' · ' + gov.type : gov.kind === 'anchor' ? t('anchorage') + ' ' + gov.member + ' · ' + gov.node : t('kind_' + gov.kind) + ' ' + gov.id) + ' · ' + statusText(c.maxUtil) : '', gov ? (gov.kind === 'node' ? 'node:' + gov.id : gov.kind === 'anchor' ? 'member:' + gov.member : 'member:' + gov.id) : null) +
      metric(t('mStrut'), maxS ? '<span style="color:var(--blue)">' + fmt(-maxS.N, 0) + '</span>' : '—', 'kN', maxS ? maxS.id : t('none'), maxS ? 'member:' + maxS.id : null) +
      metric(t('mTie'), maxT ? '<span style="color:var(--amber)">' + fmt(maxT.N, 0) + '</span>' : '—', 'kN', maxT ? maxT.id : t('none'), maxT ? 'member:' + maxT.id : null) +
      metric(t('mModel'), '<span style="font-size:1.1rem">' + stat + '</span>', '', App.model.nodes.length + ' ' + t('nodesLc') + ' · ' + App.model.members.length + ' ' + t('membersLc') + ' · ΣF ' + fmt(r.globalResidual, 3) + ' kN · ' + fmt(App.computeMs, 1) + ' ms', null);
  }
  function statusText(u) { var s = App.statusOf(u); return s === 'bad' ? t('statusBad') : s === 'warn' ? t('statusWarn') : t('statusOk'); }
  function metric(label, value, unit, loc, target) {
    var tag = target ? 'button type="button" data-target="' + target + '"' : 'div';
    return '<' + tag + ' class="metric"><div class="metric-label">' + label + '</div><div class="metric-value">' + value + (unit ? '<small>' + unit + '</small>' : '') + '</div><div class="metric-location">' + loc + '</div></' + (target ? 'button' : 'div') + '>';
  }

  // ----------------------------------------------------------- banner ---
  function renderBanner() {
    var el = $('#banner'), r = App.result, msg = null, cls = 'bad';
    if (r && !r.ok && r.error === 'mechanism') msg = '<span>⚠</span><span><b>' + t('mechanism') + '</b> — ' + t('mechanismMsg').replace('{node}', r.mechanismNode).replace('{dir}', r.mechanismDir) + '</span>';
    else if (r && !r.ok && r.error && r.error !== 'empty') msg = '<span>⚠</span><span><b>' + t('invalidModel') + '</b> — ' + t('err_' + r.error) + (r.member ? ' (' + r.member + ')' : '') + '</span>';
    else if (r && r.ok && !r.converged) { msg = '<span>!</span><span>' + t('notConverged') + '</span>'; cls = 'warn'; }
    else if (App.warnings.length) {
      cls = 'warn';
      msg = '<span>!</span><span>' + t('outsideMsg') + ' ' + App.warnings.map(function (w) { return w.id; }).join(', ') + '</span>';
    }
    if (!msg) { el.classList.add('hidden'); return; }
    el.className = 'banner ' + cls; el.innerHTML = msg;
  }
  function renderEmpty() {
    var el = $('#empty-hint');
    if (App.model.nodes.length) { el.classList.add('hidden'); return; }
    el.innerHTML = '<div>' + t('emptyHint') + '</div>';
    el.classList.remove('hidden');
  }

  // ---------------------------------------------------------- results ---
  function cellU(u) {
    var w = Math.min(100, (isFinite(u) ? u : 1.2) * 100 / 1.2);
    return '<span class="cell-ubar"><i style="width:' + w + '%;background:' + App.utilColor(u) + '"></i></span><b style="color:' + App.utilInk(u) + '">' + fmt(u, 2) + '</b>';
  }
  function isSel(type, id) { return App.sel && App.sel.type === type && App.sel.id === id ? ' class="selected"' : ''; }
  function renderResults() {
    var el = $('#result-view'), r = App.result, c = App.checks;
    $$('#view-tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === App.view); });
    if (!r || !r.ok) { el.innerHTML = '<p class="table-note">' + t('noResults') + '</p>'; return; }
    var code = QST.csa.CODES[App.model.code], h = '';
    if (App.view === 'checks') {
      h += '<div class="table-scroll"><table><thead><tr><th>' + t('element') + '</th><th class="l">' + t('type') + '</th><th>' + t('demand') + '</th><th>' + t('resistance') + '</th><th>' + t('details') + '</th><th class="l">' + t('utilShort') + '</th><th class="l">' + t('clause') + '</th></tr></thead><tbody>';
      var struts = c.members.filter(function (e) { return e.kind === 'strut'; }), ties = c.members.filter(function (e) { return e.kind === 'tie'; });
      if (struts.length) h += '<tr class="group"><td colspan="7">' + t('struts') + ' · Cr = φc fcu w b</td></tr>';
      struts.forEach(function (e) {
        h += '<tr data-target="member:' + e.id + '"' + isSel('member', e.id) + '><td>' + e.id + '</td><td class="l">' + t('kind_strut') + '</td><td>' + fmt(e.demand, 0) + ' kN</td><td>' + fmt(e.capacity, 0) + ' kN</td><td>fcu ' + fmt(e.fcu, 2) + ' MPa' + (e.theta !== null ? ' · θs ' + fmt(deg(e.theta), 1) + '°' : '') + ' · w ' + fmt(e.w, 0) + '</td><td class="l">' + cellU(e.util) + '</td><td class="l">' + code.clause.strut + '</td></tr>';
      });
      if (ties.length) h += '<tr class="group"><td colspan="7">' + t('ties') + ' · Tr = φs fy As</td></tr>';
      ties.forEach(function (e) {
        h += '<tr data-target="member:' + e.id + '"' + isSel('member', e.id) + '><td>' + e.id + '</td><td class="l">' + t('kind_tie') + '</td><td>' + fmt(e.demand, 0) + ' kN</td><td>' + fmt(e.capacity, 0) + ' kN</td><td>As ' + fmt(e.As, 0) + ' / ' + fmt(e.asReq, 0) + ' mm² · εs ' + fmt(e.epsS * 1000, 2) + '‰</td><td class="l">' + cellU(e.util) + '</td><td class="l">' + code.clause.tie + '</td></tr>';
      });
      if (c.nodes.length) h += '<tr class="group"><td colspan="7">' + t('nodalZones') + '</td></tr>';
      c.nodes.forEach(function (e) {
        var g = e.governingFace;
        h += '<tr data-target="node:' + e.id + '"' + isSel('node', e.id) + '><td>' + e.id + '</td><td class="l">' + e.type + '</td><td>' + (g ? fmt(g.stress, 2) + ' MPa' : '—') + '</td><td>' + fmt(e.limit, 2) + ' MPa</td><td>' + (g ? t('face_' + g.kind) + (g.kind === 'strut' || g.kind === 'tie' ? ' ' + g.ref : '') + ' · w ' + fmt(g.width, 0) : '') + '</td><td class="l">' + cellU(e.util) + '</td><td class="l">' + code.clause.node + '</td></tr>';
      });
      if (c.anchors.length) h += '<tr class="group"><td colspan="7">' + t('anchorages') + ' · l<sub>a</sub> ≥ l<sub>d</sub></td></tr>';
      c.anchors.forEach(function (a) {
        h += '<tr data-target="member:' + a.member + '"' + isSel('member', a.member) + '><td>' + a.member + ' · ' + a.node + '</td><td class="l">' + t('anchor_' + a.type) + '</td><td>' + (a.mechanical || a.na ? '—' : fmt(a.req, 0) + ' mm') + '</td><td>' + fmt(a.la, 0) + ' mm</td><td>' + (a.na ? t('dbUnknown') : a.mechanical ? t('mechanicalNote') : 'd<sub>b</sub> ' + fmt(a.db, 1) + (a.top ? ' · k1 1,3' : '')) + '</td><td class="l">' + (a.mechanical || a.na ? '<span class="status ' + (a.na ? 'na' : 'ok') + '">' + (a.na ? '?' : '✓') + '</span>' : cellU(a.util)) + '</td><td class="l">' + a.clause.split(' · ')[0] + '</td></tr>';
      });
      var ck = c.crack;
      h += '<tr class="group"><td colspan="7">' + t('crackControl') + '</td></tr>';
      h += '<tr><td>ρh · ρv</td><td class="l">' + t('grid') + '</td><td>' + fmt(ck.rhoH, 4) + ' · ' + fmt(ck.rhoV, 4) + '</td><td>≥ ' + fmt(ck.rhoMin, 4) + '</td><td>s = ' + fmt(ck.spacing, 0) + ' ≤ ' + fmt(ck.sMax, 0) + ' mm</td><td class="l">' + cellU(ck.util) + '</td><td class="l">' + ck.clause + '</td></tr>';
      h += '</tbody></table></div><p class="table-note">' + t('checksNote').replace('{code}', code.name).replace('{phiC}', fmt(c.phiC, 2)).replace('{phiS}', fmt(c.phiS, 2)) + '</p>';
    } else if (App.view === 'forces') {
      h += '<div class="table-scroll"><table><thead><tr><th>' + t('member') + '</th><th class="l">' + t('nodesCol') + '</th><th>L (m)</th><th>' + t('angle') + ' (°)</th><th>N (kN)</th><th class="l">' + t('type') + '</th><th>w (mm)</th><th>As (mm²)</th></tr></thead><tbody>';
      r.forces.forEach(function (f) {
        var m = App.member(f.id);
        h += '<tr data-target="member:' + f.id + '"' + isSel('member', f.id) + '><td>' + f.id + '</td><td class="l">' + m.i + ' – ' + m.j + '</td><td>' + fmt(f.L, 3) + '</td><td>' + fmt(deg(Math.atan2(f.s, f.c)), 1) + '</td><td><b style="color:' + (f.kind === 'tie' ? 'var(--amber)' : f.kind === 'strut' ? 'var(--blue)' : 'var(--muted)') + '">' + fmt(f.N, 1) + '</b></td><td class="l">' + t('kind_' + f.kind) + '</td><td>' + fmt(m.w, 0) + '</td><td>' + fmt(QST.csa.memberArea(m), 0) + '</td></tr>';
      });
      h += '</tbody></table></div><p class="table-note">' + t('forcesNote') + '</p>';
    } else {
      h += '<div class="table-scroll"><table><thead><tr><th>' + t('node') + '</th><th class="l">' + t('support') + '</th><th>Rx (kN)</th><th>Ry (kN)</th><th>|R| (kN)</th></tr></thead><tbody>';
      r.reactions.forEach(function (R) {
        var n = App.node(R.node);
        h += '<tr data-target="node:' + R.node + '"' + isSel('node', R.node) + '><td>' + R.node + '</td><td class="l">' + t('sup_' + n.support) + '</td><td>' + fmt(R.rx, 1) + '</td><td>' + fmt(R.ry, 1) + '</td><td>' + fmt(Math.hypot(R.rx, R.ry), 1) + '</td></tr>';
      });
      var sx = 0, sy = 0; r.reactions.forEach(function (R) { sx += R.rx; sy += R.ry; });
      h += '<tr class="group"><td colspan="5">' + t('equilibrium') + '</td></tr>';
      h += '<tr><td>Σ ' + t('loads') + '</td><td></td><td>' + fmt(r.sumLoads.fx, 1) + '</td><td>' + fmt(r.sumLoads.fy, 1) + '</td><td></td></tr>';
      h += '<tr><td>Σ ' + t('reactions') + '</td><td></td><td>' + fmt(sx, 1) + '</td><td>' + fmt(sy, 1) + '</td><td></td></tr>';
      h += '<tr><td>' + t('residual') + '</td><td></td><td colspan="3">' + r.globalResidual.toExponential(1) + ' kN</td></tr>';
      h += '</tbody></table></div>';
      var pl = QST.templates.pileLoads(App.model, r, window.QST_META);
      if (pl && pl.piles.length && App.model.meta && App.model.meta.pileMap) {
        h += '<div class="table-scroll" style="margin-top:12px"><table><thead><tr><th>' + t('pile') + '</th><th class="l">' + t('node') + '</th><th>x (m)</th><th>N (kN)</th><th>H (kN)</th><th>M (kN·m)</th></tr></thead><tbody>';
        pl.piles.forEach(function (q) { h += '<tr data-target="node:' + q.node + '"><td>' + q.id + '</td><td class="l">' + q.node + '</td><td>' + fmt(q.x, 3) + '</td><td>' + fmt(q.N, 1) + '</td><td>' + fmt(q.H, 1) + '</td><td>0</td></tr>'; });
        h += '</tbody></table></div><p class="table-note">' + t('pileNote') + (App.model.meta && App.model.meta.tie3D && App.model.meta.tie3D.factor !== 1 ? ' ' + t('tie3D').replace('{f}', App.model.meta.tie3D.factor === 0.5 ? (App.lang === 'fr' ? '0,5 (deux tirants parallèles)' : '0.5 (two parallel ties)') : '1/√3') : '') + '</p>';
        h += '<button type="button" class="add-button" id="export-pile" style="max-width:340px">↗ ' + t('exportPile') + '</button>';
      }
    }
    el.innerHTML = h;
  }

  // ------------------------------------------------------- examples ---
  function renderExamples() {
    $('#examples-list').innerHTML = QST.examples.EXAMPLES.map(function (ex) {
      return '<button type="button" role="menuitem" data-example="' + ex.key + '"><svg class="ex-thumb" viewBox="0 0 58 34" aria-hidden="true">' + thumb(ex.model) + '</svg><span class="mi-text"><b>' + ex.title[App.lang] + '</b><small>' + ex.sub[App.lang] + '</small></span></button>';
    }).join('');
  }
  function thumb(m) {
    var xs = m.outline.map(function (p) { return p[0]; }).concat(m.nodes.map(function (n) { return n.x; }));
    var ys = m.outline.map(function (p) { return p[1]; }).concat(m.nodes.map(function (n) { return n.y; }));
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var k = Math.min(50 / (x1 - x0), 26 / (y1 - y0)), ox = 29 - (x0 + x1) / 2 * k, oy = 17 + (y0 + y1) / 2 * k;
    var P = function (x, y) { return (ox + x * k).toFixed(1) + ',' + (oy - y * k).toFixed(1); };
    var s = '<polygon points="' + m.outline.map(function (p) { return P(p[0], p[1]); }).join(' ') + '" fill="#9fc3d2" fill-opacity=".15" stroke="#88b3c6" stroke-width=".7"/>';
    var nm = {}; m.nodes.forEach(function (n) { nm[n.id] = n; });
    m.members.forEach(function (b) {
      var A = nm[b.i], B = nm[b.j], tie = !!b.bars || b.As > 0;
      s += '<polyline points="' + P(A.x, A.y) + ' ' + P(B.x, B.y) + '" stroke="' + (tie ? '#ffc978' : '#7cb4ff') + '" stroke-width="' + (tie ? 1.4 : 1) + '"' + (tie ? '' : ' stroke-dasharray="2 1.3"') + '/>';
    });
    return s;
  }

  // ---------------------------------------------------------- binding ---
  function bind() {
    $('#toolbox').addEventListener('click', function (e) { var b = e.target.closest('[data-tool]'); if (b) App.setTool(b.dataset.tool); });
    $('#display-mode').addEventListener('click', function (e) { var b = e.target.closest('[data-mode]'); if (!b) return; App.display.mode = b.dataset.mode; App.saveUi(); renderToolbox(); renderLegend(); App.renderCanvas(); });
    ['bands', 'zones', 'ids', 'snap'].forEach(function (k) { $('#toggle-' + k).addEventListener('click', function () { App.display[k] = !App.display[k]; App.saveUi(); renderToolbox(); App.renderCanvas(); }); });
    $('#undo').addEventListener('click', App.undo);
    $('#redo').addEventListener('click', App.redo);
    $('#fit').addEventListener('click', App.fit);
    $$('.input-tabs button').forEach(function (b) { b.addEventListener('click', function () { App.panel = b.dataset.panel; App.saveUi(); renderInputs(); }); });
    $('#view-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-view]'); if (!b) return; App.view = b.dataset.view; App.saveUi(); renderResults(); });

    var box = $('#input-content'), ins = $('#inspector');
    [box, ins].forEach(function (root) {
      root.addEventListener('change', function (e) {
        var el = e.target; if (!el.dataset.k) return;
        // Deferred so that Tab moves the focus first; the re-render restores it.
        setTimeout(function () { if (el.dataset.k.indexOf('v.') === 0) applyVertex(el); else applyField(el); }, 0);
      });
      root.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.classList.contains('num')) { e.preventDefault(); e.target.blur(); }
        if (e.key === 'Escape' && root === ins) { App.sel = null; App.emitSelection(); }
      });
      root.addEventListener('input', function (e) { if (e.target.classList.contains('num')) { var v = App.parse(e.target.value); e.target.classList.toggle('num-err', Number.isNaN(v)); } });
    });
    box.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-code]'))) { App.commit(); App.model.code = b.dataset.code; App.update({ inputs: true }); return; }
      if ((b = e.target.closest('#auto-size'))) {
        App.commit();
        var info = QST.templates.autoSize(App.model);
        App.update({ inputs: true });
        App.toast(info.error ? t('autoSizeFail') : t('autoSizeDone'));
        return;
      }
      if ((b = e.target.closest('#apply-rect'))) {
        var w = App.parse($('[data-k="rect.w"]').value), hgt = App.parse($('[data-k="rect.h"]').value);
        if (!(w > 0 && hgt > 0)) return;
        var bb = bounds(App.model.outline);
        App.commit(); App.model.outline = [[bb.x0, bb.y0], [bb.x0 + w, bb.y0], [bb.x0 + w, bb.y0 + hgt], [bb.x0, bb.y0 + hgt]];
        App.update({ inputs: true }); return;
      }
      if ((b = e.target.closest('#add-node'))) {
        var bb2 = bounds(App.model.outline);
        App.commit(); var id = App.addNode((bb2.x0 + bb2.x1) / 2, (bb2.y0 + bb2.y1) / 2); App.sel = { type: 'node', id: id };
        App.update({ inputs: true }); return;
      }
      if ((b = e.target.closest('[data-del-node]'))) { App.commit(); App.deleteNode(b.dataset.delNode); App.validateSel(); App.update({ inputs: true }); return; }
      if ((b = e.target.closest('[data-del-member]'))) { App.commit(); App.deleteMember(b.dataset.delMember); App.validateSel(); App.update({ inputs: true }); return; }
      if ((b = e.target.closest('[data-pick-node]'))) { App.sel = { type: 'node', id: b.dataset.pickNode }; App.emitSelection(); return; }
      if ((b = e.target.closest('[data-pick-member]'))) { App.sel = { type: 'member', id: b.dataset.pickMember }; App.emitSelection(); }
    });
    box.addEventListener('focusin', function (e) {
      var row = e.target.closest('[data-row-node],[data-row-member]');
      if (!row) return;
      var s = row.dataset.rowNode ? { type: 'node', id: row.dataset.rowNode } : { type: 'member', id: row.dataset.rowMember };
      if (!App.sel || App.sel.type !== s.type || App.sel.id !== s.id) { App.sel = s; App.renderCanvas(); renderInspector(); $$('.row-card').forEach(function (r) { r.classList.toggle('selected', r === row); }); }
    });
    ins.addEventListener('click', function (e) {
      if (e.target.closest('[data-ins-close]')) { App.sel = null; App.emitSelection(); return; }
      var b = e.target.closest('[data-del-vertex]');
      if (b && App.model.outline.length > 3) { App.commit(); App.model.outline.splice(+b.dataset.delVertex, 1); App.sel = null; App.update({ inputs: true }); }
    });
    ins.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    ins.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
    $('#metrics').addEventListener('click', function (e) { var b = e.target.closest('[data-target]'); if (b) pick(b.dataset.target); });
    $('#result-view').addEventListener('click', function (e) {
      if (e.target.closest('#export-pile')) { App.exportPileLoads(); return; }
      var b = e.target.closest('[data-target]'); if (b) pick(b.dataset.target);
    });
    $('#project-name').addEventListener('change', function (e) { App.commit(); App.model.name = e.target.value.trim(); App.update({ inputs: true }); });
  }
  function applyVertex(el) {
    var parts = el.dataset.k.split('.'), v = App.parse(el.value);
    if (!isFinite(v) || v === null) { el.classList.add('num-err'); return; }
    App.commit(); App.model.outline[+parts[1]][+parts[2]] = v; App.update({ inputs: true });
  }
  function pick(target) {
    var p = target.split(':');
    App.sel = { type: p[0], id: p[1] };
    App.emitSelection();
  }

  App.initPanels = function () {
    bind();
    App.on(function (o) {
      if (o.tool) { renderToolbox(); return; }
      if (o.selection) {
        renderInspector(); renderResults();
        if (App.panel !== 'params') $$('.row-card').forEach(function (r) { var id = r.dataset.rowNode || r.dataset.rowMember; r.classList.toggle('selected', !!App.sel && App.sel.id === id); });
        App.renderCanvas();
        return;
      }
      renderToolbox(); renderLegend(); renderMetrics(); renderBanner(); renderEmpty();
      renderResults();
      if (!o.drag || App.panel !== 'params') { if (!o.drag) renderInputs(); }
      renderInspector(o);
    });
  };
  App.renderAllText = function () { renderToolbox(); renderLegend(); renderExamples(); renderInputs(); renderMetrics(); renderBanner(); renderEmpty(); renderResults(); renderInspector(); };
})();
