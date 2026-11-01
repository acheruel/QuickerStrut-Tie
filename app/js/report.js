// SPDX-License-Identifier: GPL-3.0-or-later
/* QuickerStrut&Tie — printable calculation report (browser print → PDF) and CSV export. */
(function () {
  'use strict';
  var QST = window.QST, App = QST.App;

  function deg(r) { return r * 180 / Math.PI; }

  App.buildReport = function () {
    var t = App.t, fmt = App.fmt, esc = App.esc, m = App.model, r = App.result, c = App.checks;
    var code = QST.csa.CODES[m.code], mat = m.material, meta = window.QST_META || {};
    var today = new Date().toLocaleDateString(App.locale(), { year: 'numeric', month: 'long', day: 'numeric' });
    var ok = function (u) { return App.statusOf(u) === 'bad' ? '<span class="rp-bad">' + fmt(u, 2) + ' ✕</span>' : '<span class="rp-ok">' + fmt(u, 2) + ' ✓</span>'; };
    var h = '';
    h += '<div class="rp-head"><div><div class="rp-brand">Quicker<span>Strut&amp;Tie</span></div><h1>' + esc(m.name || t('untitled')) + '</h1><div>' + t('reportTitle') + ' · ' + code.name + '</div></div>' +
      '<div class="rp-meta">' + today + '<br>v' + (meta.version || '') + ' · ' + (meta.date || '') + '<br>' + t('reportSigned') + '</div></div>';

    h += '<h2>1. ' + t('rpInputs') + '</h2><div class="rp-grid">' +
      '<div>' + t('designCode') + ' : <b>' + code.name + '</b> (' + t('code_' + m.code) + ')</div>' +
      '<div>φc = ' + fmt(c.phiC || QST.csa.factors(m).phiC, 2) + ' · φs = ' + fmt(c.phiS || QST.csa.factors(m).phiS, 2) + '</div>' +
      "<div>f′c = " + fmt(mat.fc, 1) + ' MPa · fy = ' + fmt(mat.fy, 0) + ' MPa · Es = ' + fmt(mat.Es, 0) + ' MPa</div>' +
      '<div>' + t('thickness') + ' b = ' + fmt(mat.b, 0) + ' mm · Ec = ' + fmt(QST.solver.concreteModulus(m.code, mat.fc), 0) + ' MPa</div>' +
      '<div>εs : ' + (mat.epsMode === 'yield' ? t('epsYield') : t('epsComputed')) + '</div>' +
      '<div>' + t('crackControl') + ' : ρh = ' + fmt(mat.rhoH, 4) + ' · ρv = ' + fmt(mat.rhoV, 4) + ' · s = ' + fmt(mat.spacing, 0) + ' mm</div></div>';

    h += '<h2>2. ' + t('rpModel') + '</h2><div class="rp-figure">' + App.staticSVG({ mode: 'forces', width: 1000 }) + '</div>';

    h += '<table><thead><tr><th>' + t('node') + '</th><th>x (m)</th><th>y (m)</th><th>' + t('support') + '</th><th>Fx (kN)</th><th>Fy (kN)</th><th>' + t('bearingShort') + ' (mm)</th></tr></thead><tbody>';
    m.nodes.forEach(function (n) { h += '<tr><td>' + n.id + '</td><td>' + fmt(n.x, 3) + '</td><td>' + fmt(n.y, 3) + '</td><td>' + t('sup_' + n.support) + '</td><td>' + fmt(n.fx, 1) + '</td><td>' + fmt(n.fy, 1) + '</td><td>' + fmt(n.bearing, 0) + '</td></tr>'; });
    h += '</tbody></table>';

    if (!r || !r.ok) {
      h += '<h2>3. ' + t('rpResults') + '</h2><p class="rp-bad">' + (r && r.error === 'mechanism' ? t('mechanism') + ' — ' + t('mechanismMsg').replace('{node}', r.mechanismNode).replace('{dir}', r.mechanismDir) : t('noResults')) + '</p>';
    } else {
      h += '<h2>3. ' + t('rpForces') + '</h2><table><thead><tr><th>' + t('member') + '</th><th>' + t('nodesCol') + '</th><th>L (m)</th><th>' + t('angle') + ' (°)</th><th>N (kN)</th><th>' + t('type') + '</th><th>w (mm)</th><th>As (mm²)</th></tr></thead><tbody>';
      r.forces.forEach(function (f) {
        var b = App.member(f.id);
        h += '<tr><td>' + f.id + '</td><td>' + b.i + ' – ' + b.j + '</td><td>' + fmt(f.L, 3) + '</td><td>' + fmt(deg(Math.atan2(f.s, f.c)), 1) + '</td><td>' + fmt(f.N, 1) + '</td><td>' + t('kind_' + f.kind) + '</td><td>' + fmt(b.w, 0) + '</td><td>' + fmt(QST.csa.memberArea(b), 0) + '</td></tr>';
      });
      h += '</tbody></table>';
      var sx = 0, sy = 0;
      h += '<table style="margin-top:8px"><thead><tr><th>' + t('node') + '</th><th>Rx (kN)</th><th>Ry (kN)</th></tr></thead><tbody>';
      r.reactions.forEach(function (R) { sx += R.rx; sy += R.ry; h += '<tr><td>' + R.node + '</td><td>' + fmt(R.rx, 1) + '</td><td>' + fmt(R.ry, 1) + '</td></tr>'; });
      h += '<tr><td>Σ ' + t('reactions') + ' / Σ ' + t('loads') + '</td><td>' + fmt(sx, 1) + ' / ' + fmt(r.sumLoads.fx, 1) + '</td><td>' + fmt(sy, 1) + ' / ' + fmt(r.sumLoads.fy, 1) + '</td></tr></tbody></table>';
      h += '<p>' + (r.indeterminacy === 0 ? t('determinate') : t('indeterminate') + ' (r = ' + r.indeterminacy + ')') + ' · ' + t('residual') + ' ' + r.globalResidual.toExponential(1) + ' kN</p>';

      h += '<h2>4. ' + t('rpChecks') + '</h2><div class="rp-figure">' + App.staticSVG({ mode: 'util', width: 1000, grid: false }) + '</div>';
      h += '<table class="rp-calc"><thead><tr><th>' + t('element') + '</th><th>' + t('calc') + '</th><th>' + t('utilShort') + '</th></tr></thead><tbody>';
      c.members.forEach(function (e) {
        if (e.kind === 'zero') return;
        var calc;
        if (e.kind === 'tie') {
          calc = '<span class="rp-eq">Tr = φs fy As = ' + fmt(c.phiS, 2) + ' × ' + fmt(mat.fy, 0) + ' × ' + fmt(e.As, 0) + ' = ' + fmt(e.capacity, 0) + ' kN ≥ Tf = ' + fmt(e.demand, 0) + ' kN</span> <small>(' + code.clause.tie + ')</small>';
        } else {
          var g = e.ends.filter(function (x) { return x.node === e.governingEnd; })[0];
          calc = (g.tie ? '<span class="rp-eq">ε1 = ' + fmt(g.epsS * 1000, 3) + '‰ + (' + fmt(g.epsS * 1000, 3) + '‰ + 2‰) cot²(' + fmt(deg(g.theta), 1) + '°) = ' + fmt(g.eps1 * 1000, 3) + '‰ ; fcu = ' + fmt(mat.fc, 1) + ' / (' + App.dl('0,8') + ' + 170 ε1) = ' + fmt(g.fcuRaw, 2) + (g.capped ? ' → ' + App.capLabel() : '') + ' = ' + fmt(g.fcu, 2) + ' MPa</span><br>' : t('noTieAtEnd') + ' → fcu = ' + App.capLabel() + ' = ' + fmt(g.fcu, 2) + ' MPa<br>') +
            '<span class="rp-eq">Cr = φc fcu w b = ' + fmt(c.phiC, 2) + ' × ' + fmt(e.fcu, 2) + ' × ' + fmt(e.w, 0) + ' × ' + fmt(mat.b, 0) + ' = ' + fmt(e.capacity, 0) + ' kN ≥ Cf = ' + fmt(e.demand, 0) + ' kN</span> <small>(' + code.clause.strut + ', ' + t('end') + ' ' + e.governingEnd + ')</small>';
        }
        h += '<tr><td>' + e.id + '<br><small>' + t('kind_' + e.kind) + '</small></td><td>' + calc + '</td><td>' + ok(e.util) + '</td></tr>';
      });
      c.nodes.forEach(function (e) {
        var g = e.governingFace;
        var calc = '<span class="rp-eq">' + e.type + ' : f<sub>lim</sub> = ' + App.nodeFactorText(e.type) + ' φc f′c = ' + fmt(e.limit, 2) + ' MPa' + (g ? ' ; σ = ' + fmt(g.force, 0) + ' kN / (' + fmt(g.width, 0) + ' × ' + fmt(mat.b, 0) + ') = ' + fmt(g.stress, 2) + ' MPa (' + t('face_' + g.kind) + (g.kind === 'strut' || g.kind === 'tie' ? ' ' + g.ref : '') + ')' : '') + '</span> <small>(' + code.clause.node + ')</small>';
        h += '<tr><td>' + e.id + '<br><small>' + t('nodalZone') + '</small></td><td>' + calc + '</td><td>' + ok(e.util) + '</td></tr>';
      });
      c.anchors.forEach(function (a) {
        var calc = a.mechanical ? t('anchor_' + a.type) + ' — ' + t('mechanicalNote') : a.na ? t('dbUnknown') :
          '<span class="rp-eq">l<sub>a</sub> = ' + fmt(a.dc, 0) + ' + ' + fmt(a.e, 0) + ' = ' + fmt(a.la, 0) + ' mm ≥ ' + (a.type === 'hook' ? 'l<sub>dh</sub>' : 'l<sub>d</sub>') + ' = ' + fmt(a.req, 0) + ' mm (d<sub>b</sub> = ' + fmt(a.db, 1) + ' mm' + (a.top ? ', k1 = 1,3' : '') + ')</span>';
        h += '<tr><td>' + a.member + ' · ' + a.node + '<br><small>' + t('anchorage') + '</small></td><td>' + calc + ' <small>(' + a.clause + ')</small></td><td>' + (a.mechanical || a.na ? '—' : ok(a.util)) + '</td></tr>';
      });
      var ck = c.crack;
      h += '<tr><td>' + t('crackControl') + '</td><td>ρh = ' + fmt(ck.rhoH, 4) + ', ρv = ' + fmt(ck.rhoV, 4) + ' ≥ ' + fmt(ck.rhoMin, 4) + ' ; s = ' + fmt(ck.spacing, 0) + ' ≤ ' + fmt(ck.sMax, 0) + ' mm <small>(' + ck.clause + ')</small></td><td>' + ok(ck.util) + '</td></tr>';
      h += '</tbody></table>';
      h += '<p><b>' + t('mUtil') + ' : ' + fmt(c.maxUtil, 2) + '</b> (' + (c.governing.kind === 'node' ? t('node') : c.governing.kind === 'anchor' ? t('anchorage') : t('kind_' + c.governing.kind)) + ' ' + c.governing.id + ')</p>';
      var zones = c.nodes.filter(function (e) { return e.zone; });
      if (zones.length) {
        h += '<h2>5. ' + t('hydroZones') + '</h2><table><thead><tr><th>' + t('node') + '</th><th>σ<sub>h</sub> (MPa)</th><th>' + t('face') + ' : F (kN) · w → w<sub>h</sub> (mm)</th></tr></thead><tbody>';
        zones.forEach(function (e) {
          h += '<tr><td>' + e.id + ' (' + e.type + ')</td><td>' + fmt(e.zone.sigma, 2) + '</td><td>' + e.zone.faces.map(function (fa) { return t('face_' + fa.kind) + (fa.kind === 'strut' || fa.kind === 'tie' ? ' ' + fa.ref : '') + ' : ' + fmt(fa.force, 0) + ' · ' + (fa.wGiven > 0 ? fmt(fa.wGiven, 0) : '—') + ' → ' + fmt(fa.wHydro, 0); }).join(' ; ') + (e.zone.outside ? ' <span class="rp-bad">' + t('zoneOutside') + '</span>' : '') + '</td></tr>';
        });
        h += '</tbody></table>';
      }
      var pl = QST.templates.pileLoads(App.model, r, window.QST_META);
      if (pl && App.model.meta && App.model.meta.pileMap) {
        h += '<h2>6. ' + t('pileLoadsTitle') + '</h2><table><thead><tr><th>' + t('pile') + '</th><th>N (kN)</th><th>H (kN)</th></tr></thead><tbody>';
        pl.piles.forEach(function (q) { h += '<tr><td>' + q.id + '</td><td>' + fmt(q.N, 1) + '</td><td>' + fmt(q.H, 1) + '</td></tr>'; });
        h += '</tbody></table><p>' + t('pileNote') + '</p>';
      }
      if (App.warnings.length) h += '<p class="rp-bad">' + t('outsideMsg') + ' ' + App.warnings.map(function (w) { return w.id; }).join(', ') + '</p>';
    }
    h += '<div class="rp-disclaimer"><b>' + t('warning') + '</b><br>' + t('reportDisclaimer') + '</div>';
    return h;
  };

  App.printReport = function () {
    document.getElementById('report').innerHTML = App.buildReport();
    setTimeout(function () { window.print(); }, 60);
  };

  App.exportPileLoads = function () {
    var data = QST.templates.pileLoads(App.model, App.result, window.QST_META);
    if (!data || !data.piles.length) { App.toast(App.t('noPiles')); return; }
    App.download(App.fileBase() + '-quickerpile.json', JSON.stringify(data, null, 2), 'application/json');
    App.toast(App.t('pileExported').replace('{n}', data.piles.length));
  };

  App.exportCSV = function () {
    var t = App.t, r = App.result, c = App.checks, sep = App.lang === 'fr' ? ';' : ',';
    var num = function (v, d) { return isFinite(v) ? Number(v).toFixed(d).replace('.', App.lang === 'fr' ? ',' : '.') : ''; };
    var rows = [[t('element'), t('type'), 'N (kN)', t('resistance') + ' (kN | MPa)', t('utilShort'), t('clause')]];
    if (r && r.ok) {
      c.members.forEach(function (e) { rows.push([e.id, t('kind_' + e.kind), num(e.kind === 'strut' ? -e.demand : e.demand, 1), num(e.capacity, 1), num(e.util, 3), e.clause]); });
      c.nodes.forEach(function (e) { rows.push([e.id, e.type, e.governingFace ? num(e.governingFace.stress, 2) + ' MPa' : '', num(e.limit, 2), num(e.util, 3), e.clause]); });
    }
    var text = '﻿' + rows.map(function (row) { return row.map(function (v) { v = String(v); return /[";,\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(sep); }).join('\r\n');
    App.download(App.fileBase() + '-checks.csv', text, 'text/csv;charset=utf-8');
  };
})();
