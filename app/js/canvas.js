// SPDX-License-Identifier: GPL-3.0-or-later
/* QuickerStrut&Tie — interactive SVG model editor and static drawings. */
(function () {
  'use strict';
  var QST = window.QST, App = QST.App;

  var PAL = {
    dark: {
      bg: null, gridMinor: '#163a4f', gridMajor: '#215069', axis: '#3d7896', gridText: '#6f98ab',
      concrete: '#9fc3d2', concreteOp: 0.085, concreteStroke: '#88b3c6',
      strut: '#7cb4ff', tie: '#ffc978', zero: '#6f8a99', neutral: '#cfe6ef',
      nodeFill: '#e8fff8', nodeStroke: '#0b2436', load: '#ff9b85', react: '#56e0bb', support: '#cfe6ef', ground: '#6f98ab',
      pill: '#0a2131', pillOp: 0.86, pillText: '#e6f3f7', idText: '#9fc3d2', sel: '#56e0bb', bandOp: 0.17, tieBandOp: 0.2, warn: '#ff7a6b'
    },
    light: {
      bg: '#ffffff', gridMinor: '#f1f5f7', gridMajor: '#e1e9ee', axis: '#c5d3db', gridText: '#8aa0ad',
      concrete: '#c9d8e1', concreteOp: 0.45, concreteStroke: '#6f8c9c',
      strut: '#2f64b0', tie: '#b66c16', zero: '#9aa9b2', neutral: '#5d7684',
      nodeFill: '#ffffff', nodeStroke: '#17374b', load: '#c4513a', react: '#007f78', support: '#5d7684', ground: '#8aa0ad',
      pill: '#ffffff', pillOp: 0.92, pillText: '#17374b', idText: '#566e7c', sel: '#007f78', bandOp: 0.16, tieBandOp: 0.22, warn: '#b23a2a'
    }
  };

  var svg, wrap, W = 0, H = 0;
  var view = { ox: 0, oy: 0, k: 120 };
  var cursor = null;        // world coordinates of the pointer (snapped)
  var cursorRaw = null;
  var pending = null;       // first node of a member being drawn
  var drag = null;          // current drag operation
  var pointers = {};        // active pointers (pinch zoom)
  var spaceDown = false;
  var raf = 0;

  function n2(v) { return Math.round(v * 10) / 10; }
  function toScreen(v, x, y) { return [v.ox + x * v.k, v.oy - y * v.k]; }
  function toWorld(px, py) { return [(px - view.ox) / view.k, (view.oy - py) / view.k]; }

  function bbox(model) {
    var xs = [], ys = [];
    (model.outline || []).forEach(function (p) { xs.push(p[0]); ys.push(p[1]); });
    model.nodes.forEach(function (n) { xs.push(n.x); ys.push(n.y); });
    if (!xs.length) return { x0: 0, y0: 0, x1: 3, y1: 1.5 };
    return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys) };
  }
  function fitView(model, w, h, pad) {
    var b = bbox(model), bw = Math.max(b.x1 - b.x0, 0.2), bh = Math.max(b.y1 - b.y0, 0.2);
    var k = Math.min((w - pad.l - pad.r) / bw, (h - pad.t - pad.b) / bh);
    k = Math.max(5, Math.min(k, 4000));
    var cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    return { k: k, ox: pad.l + (w - pad.l - pad.r) / 2 - cx * k, oy: pad.t + (h - pad.t - pad.b) / 2 + cy * k };
  }
  function niceStep(k) {
    var c = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50];
    for (var i = 0; i < c.length; i++) if (c[i] * k >= 16) return c[i];
    return 100;
  }
  App.gridStep = function () { return niceStep(view.k); };

  function nodeMap(model) { var o = {}; model.nodes.forEach(function (n) { o[n.id] = n; }); return o; }

  function label(x, y, angle, text, pal, opt) {
    opt = opt || {};
    var w = text.length * (opt.small ? 5.6 : 6.5) + (opt.small ? 10 : 14), h = opt.small ? 15 : 18;
    var a = angle; if (a > 90) a -= 180; if (a < -90) a += 180;
    var fill = opt.fill || pal.pill, color = opt.color || pal.pillText;
    return '<g transform="translate(' + n2(x) + ' ' + n2(y) + ') rotate(' + n2(a) + ')" class="lbl">' +
      '<rect x="' + n2(-w / 2) + '" y="' + n2(-h / 2) + '" width="' + n2(w) + '" height="' + h + '" rx="' + h / 2 + '" fill="' + fill + '" fill-opacity="' + (opt.op || pal.pillOp) + '"' + (opt.stroke ? ' stroke="' + opt.stroke + '" stroke-width="1.2"' : '') + '/>' +
      '<text x="0" y="' + (opt.small ? 3.8 : 4.3) + '" text-anchor="middle" font-size="' + (opt.small ? 10 : 11.5) + '" font-weight="650" fill="' + color + '">' + App.esc(text) + '</text></g>';
  }

  function arrow(x1, y1, x2, y2, color, width, id) {
    // Line from (x1,y1) to (x2,y2) with an arrow head at the end.
    var dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, hl = 9, hw = 4.8;
    var bx = x2 - ux * hl, by = y2 - uy * hl;
    return '<g' + (id ? ' ' + id : '') + '><line x1="' + n2(x1) + '" y1="' + n2(y1) + '" x2="' + n2(bx) + '" y2="' + n2(by) + '" stroke="' + color + '" stroke-width="' + width + '" stroke-linecap="round"/>' +
      '<path d="M' + n2(x2) + ' ' + n2(y2) + 'L' + n2(bx - uy * hw) + ' ' + n2(by + ux * hw) + 'L' + n2(bx + uy * hw) + ' ' + n2(by - ux * hw) + 'Z" fill="' + color + '"/></g>';
  }

  function supportGlyph(x, y, type, pal) {
    var g = '<g transform="translate(' + n2(x) + ' ' + n2(y) + ')' + (type === 'rx' ? ' rotate(90)' : '') + '">';
    g += '<path d="M0 6l-10 16h20Z" fill="' + pal.support + '" fill-opacity=".9" stroke="' + pal.nodeStroke + '" stroke-opacity=".35"/>';
    var gy = 22;
    if (type !== 'pin') { g += '<circle cx="-5.5" cy="25.5" r="3" fill="none" stroke="' + pal.support + '" stroke-width="1.4"/><circle cx="5.5" cy="25.5" r="3" fill="none" stroke="' + pal.support + '" stroke-width="1.4"/>'; gy = 29.5; }
    g += '<line x1="-15" x2="15" y1="' + gy + '" y2="' + gy + '" stroke="' + pal.ground + '" stroke-width="1.6"/>';
    for (var h = -13; h <= 11; h += 6) g += '<line x1="' + h + '" x2="' + (h + 4.5) + '" y1="' + (gy + 1) + '" y2="' + (gy + 6) + '" stroke="' + pal.ground + '" stroke-width="1"/>';
    return g + '</g>';
  }

  // ---------------------------------------------------------------- draw ---
  function draw(model, result, checks, o) {
    var pal = PAL[o.palette || 'dark'], v = o.view, mode = o.mode || 'forces';
    var nm = nodeMap(model), ok = result && result.ok;
    var forces = {}, mchk = {}, nchk = {}, react = {};
    if (ok) result.forces.forEach(function (f) { forces[f.id] = f; });
    if (ok && result.reactions) result.reactions.forEach(function (r) { react[r.node] = r; });
    if (checks && checks.ok) { checks.members.forEach(function (c) { mchk[c.id] = c; }); checks.nodes.forEach(function (c) { nchk[c.id] = c; }); }
    var warnIds = {};
    (o.warnings || []).forEach(function (w) { warnIds[w.id] = 1; });
    var sel = o.sel || null, hov = o.hover || null;
    var out = [];
    var clipId = 'clip-' + (o.palette || 'dark');

    // Outline path
    var poly = (model.outline || []).map(function (p) { var s = toScreen(v, p[0], p[1]); return n2(s[0]) + ',' + n2(s[1]); }).join(' ');
    out.push('<defs><clipPath id="' + clipId + '"><polygon points="' + poly + '"/></clipPath></defs>');
    if (pal.bg) out.push('<rect x="0" y="0" width="' + o.w + '" height="' + o.h + '" fill="' + pal.bg + '"/>');

    // Grid
    if (o.grid !== false) {
      var step = niceStep(v.k), major = step * ([0.025, 0.25, 25].indexOf(step) >= 0 ? 4 : 5);
      var x0 = (0 - v.ox) / v.k, x1 = (o.w - v.ox) / v.k, y1 = (v.oy - 0) / v.k, y0 = (v.oy - o.h) / v.k;
      var gm = [], gM = [], txt = [];
      var count = (x1 - x0) / step + (y1 - y0) / step;
      if (count < 900) {
        for (var gx = Math.ceil(x0 / step) * step; gx <= x1; gx += step) {
          var isM = Math.abs(gx / major - Math.round(gx / major)) < 1e-6, sx = n2(v.ox + gx * v.k);
          (isM ? gM : gm).push('M' + sx + ' 0V' + o.h);
          if (isM && o.interactive) txt.push('<text x="' + (sx + 3) + '" y="' + (o.h - 30) + '" font-size="9.5" fill="' + pal.gridText + '">' + App.fmt(gx, decimalsFor(major)) + '</text>');
        }
        for (var gy = Math.ceil(y0 / step) * step; gy <= y1; gy += step) {
          var isMy = Math.abs(gy / major - Math.round(gy / major)) < 1e-6, sy = n2(v.oy - gy * v.k);
          (isMy ? gM : gm).push('M0 ' + sy + 'H' + o.w);
          if (isMy && o.interactive) txt.push('<text x="4" y="' + (sy - 3) + '" font-size="9.5" fill="' + pal.gridText + '">' + App.fmt(gy, decimalsFor(major)) + '</text>');
        }
      }
      out.push('<path d="' + gm.join('') + '" stroke="' + pal.gridMinor + '" stroke-width="1" fill="none"/>');
      out.push('<path d="' + gM.join('') + '" stroke="' + pal.gridMajor + '" stroke-width="1" fill="none"/>');
      var ax = toScreen(v, 0, 0);
      out.push('<path d="M' + n2(ax[0]) + ' 0V' + o.h + 'M0 ' + n2(ax[1]) + 'H' + o.w + '" stroke="' + pal.axis + '" stroke-width="1" stroke-dasharray="2 4" fill="none"/>');
      out.push(txt.join(''));
    }

    // Concrete region
    out.push('<polygon points="' + poly + '" fill="' + pal.concrete + '" fill-opacity="' + pal.concreteOp + '" stroke="' + pal.concreteStroke + '" stroke-width="1.5" stroke-linejoin="round"/>');

    // Member geometry in screen space
    var geo = {};
    model.members.forEach(function (m) {
      var A = nm[m.i], B = nm[m.j]; if (!A || !B) return;
      var a = toScreen(v, A.x, A.y), b = toScreen(v, B.x, B.y);
      var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      geo[m.id] = { a: a, b: b, ux: dx / L, uy: dy / L, L: L, ang: Math.atan2(dy, dx) * 180 / Math.PI };
    });
    function kindOf(m) {
      var f = forces[m.id];
      if (f) return f.kind;
      return m.role === 'tie' ? 'tie' : m.role === 'strut' ? 'strut' : 'zero';
    }
    function colorOf(m) {
      var kind = kindOf(m);
      if (mode === 'geometry') return m.role === 'tie' ? pal.tie : m.role === 'strut' ? pal.strut : pal.neutral;
      if (mode === 'util' && mchk[m.id] && kind !== 'zero') return App.utilColor(mchk[m.id].util);
      return kind === 'strut' ? pal.strut : kind === 'tie' ? pal.tie : pal.zero;
    }

    // Bands (real widths), clipped to the concrete
    if (o.bands !== false) {
      var bands = [];
      model.members.forEach(function (m) {
        var g = geo[m.id]; if (!g) return;
        var kind = kindOf(m);
        if (kind === 'zero' && mode !== 'geometry') return;
        var wpx = (Number(m.w) || 0) / 1000 * v.k;
        if (wpx < 1) return;
        var nx = -g.uy * wpx / 2, ny = g.ux * wpx / 2, c = colorOf(m);
        var op = kind === 'tie' ? pal.tieBandOp : pal.bandOp;
        if (mode === 'util') op = (o.palette === 'light' ? 0.42 : 0.26);
        bands.push('<path d="M' + n2(g.a[0] + nx) + ' ' + n2(g.a[1] + ny) + 'L' + n2(g.b[0] + nx) + ' ' + n2(g.b[1] + ny) + 'L' + n2(g.b[0] - nx) + ' ' + n2(g.b[1] - ny) + 'L' + n2(g.a[0] - nx) + ' ' + n2(g.a[1] - ny) + 'Z" fill="' + c + '" fill-opacity="' + op + '"/>');
      });
      out.push('<g clip-path="url(#' + clipId + ')">' + bands.join('') + '</g>');
    }

    // Member axes
    model.members.forEach(function (m) {
      var g = geo[m.id]; if (!g) return;
      var kind = kindOf(m), c = colorOf(m);
      var isSel = sel && sel.type === 'member' && sel.id === m.id, isHov = hov && hov.type === 'member' && hov.id === m.id;
      if (isSel || isHov) out.push('<line x1="' + n2(g.a[0]) + '" y1="' + n2(g.a[1]) + '" x2="' + n2(g.b[0]) + '" y2="' + n2(g.b[1]) + '" stroke="' + pal.sel + '" stroke-opacity="' + (isSel ? 0.55 : 0.3) + '" stroke-width="' + (isSel ? 11 : 9) + '" stroke-linecap="round"/>');
      if (warnIds[m.id]) out.push('<line x1="' + n2(g.a[0]) + '" y1="' + n2(g.a[1]) + '" x2="' + n2(g.b[0]) + '" y2="' + n2(g.b[1]) + '" stroke="' + pal.warn + '" stroke-opacity=".45" stroke-width="8"/>');
      var dash = kind === 'strut' ? ' stroke-dasharray="9 5"' : kind === 'zero' ? ' stroke-dasharray="2 4"' : '';
      if (mode === 'geometry') dash = m.role === 'tie' ? '' : m.role === 'strut' ? ' stroke-dasharray="9 5"' : ' stroke-dasharray="5 3"';
      var sw = kind === 'tie' ? 3.2 : kind === 'strut' ? 2.4 : 1.4;
      out.push('<line x1="' + n2(g.a[0]) + '" y1="' + n2(g.a[1]) + '" x2="' + n2(g.b[0]) + '" y2="' + n2(g.b[1]) + '" stroke="' + c + '" stroke-width="' + sw + '"' + dash + ' stroke-linecap="round"/>');
    });

    // Hydrostatic nodal zones and tie anchorages
    if (o.zones !== false && checks && checks.ok) {
      var zs = [];
      checks.nodes.forEach(function (nc) {
        var z = nc.zone; if (!z) return;
        var pts = z.poly.map(function (q) { var sp = toScreen(v, q[0], q[1]); return n2(sp[0]) + ',' + n2(sp[1]); }).join(' ');
        var fillZ = mode === 'util' ? App.utilColor(z.util) : (o.palette === 'light' ? '#dfe9ef' : '#e8fff8');
        zs.push('<polygon points="' + pts + '" fill="' + fillZ + '" fill-opacity="' + (mode === 'util' ? 0.45 : (o.palette === 'light' ? 0.7 : 0.16)) + '" stroke="' + (z.outside ? pal.warn : (o.palette === 'light' ? '#5d7684' : '#cfe6ef')) + '" stroke-width="1.2" stroke-linejoin="round"' + (z.outside ? ' stroke-dasharray="3 2"' : '') + '/>');
        z.faces.forEach(function (fa) {
          var A = toScreen(v, fa.a[0], fa.a[1]), Bp = toScreen(v, fa.b[0], fa.b[1]);
          var col = fa.kind === 'strut' ? pal.strut : fa.kind === 'tie' ? pal.tie : fa.kind === 'load' ? pal.load : pal.react;
          zs.push('<line x1="' + n2(A[0]) + '" y1="' + n2(A[1]) + '" x2="' + n2(Bp[0]) + '" y2="' + n2(Bp[1]) + '" stroke="' + col + '" stroke-width="2.4" stroke-linecap="round"/>');
        });
      });
      var opl = model.outline || [], cen = [0, 0];
      opl.forEach(function (q) { cen[0] += q[0] / opl.length; cen[1] += q[1] / opl.length; });
      (checks.anchors || []).forEach(function (an) {
        var nn = nm[an.node]; if (!nn) return;
        var s0 = toScreen(v, nn.x, nn.y), s1 = toScreen(v, an.end[0], an.end[1]);
        var col = mode === 'util' && !an.na && !an.mechanical ? App.utilColor(an.util) : pal.tie;
        zs.push('<line x1="' + n2(s0[0]) + '" y1="' + n2(s0[1]) + '" x2="' + n2(s1[0]) + '" y2="' + n2(s1[1]) + '" stroke="' + col + '" stroke-width="2" stroke-dasharray="1 0" opacity=".9"/>');
        var ux = an.dir[0], uy = -an.dir[1];
        if (an.type === 'hook') {
          // 90° hook turned towards the inside of the concrete (away from the nearest face)
          var px = -an.dir[1], py = an.dir[0];
          if (px * (cen[0] - nn.x) + py * (cen[1] - nn.y) < 0) { px = -px; py = -py; }
          var hx = px, hy = -py;
          var hl = Math.min(18, Math.max(8, 0.012 * v.k * 10));
          zs.push('<path d="M' + n2(s1[0]) + ' ' + n2(s1[1]) + 'q' + n2(ux * 5) + ' ' + n2(uy * 5) + ' ' + n2(ux * 5 + hx * 6) + ' ' + n2(uy * 5 + hy * 6) + 'l' + n2(hx * hl) + ' ' + n2(hy * hl) + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linecap="round"/>');
        } else if (an.type === 'plate') {
          zs.push('<line x1="' + n2(s1[0] - uy * 9) + '" y1="' + n2(s1[1] + ux * 9) + '" x2="' + n2(s1[0] + uy * 9) + '" y2="' + n2(s1[1] - ux * 9) + '" stroke="' + col + '" stroke-width="4" stroke-linecap="round"/>');
        } else if (an.type === 'straight') {
          zs.push('<circle cx="' + n2(s1[0]) + '" cy="' + n2(s1[1]) + '" r="2.4" fill="' + col + '"/>');
        }
        // Critical section (edge of the extended nodal zone)
        var cx0 = nn.x - an.dir[0] * an.dc / 1000, cy0 = nn.y - an.dir[1] * an.dc / 1000, cs = toScreen(v, cx0, cy0);
        zs.push('<line x1="' + n2(cs[0] - uy * 7) + '" y1="' + n2(cs[1] + ux * 7) + '" x2="' + n2(cs[0] + uy * 7) + '" y2="' + n2(cs[1] - ux * 7) + '" stroke="' + col + '" stroke-width="1.4" opacity=".8"/>');
      });
      out.push('<g class="zones">' + zs.join('') + '</g>');
    }

    // Supports
    model.nodes.forEach(function (n) {
      if (!n.support) return;
      var s = toScreen(v, n.x, n.y);
      out.push(supportGlyph(s[0], s[1], n.support, pal));
    });

    // Reactions and loads are drawn as straight components on the node axes:
    // vertical arrows on the node's vertical, horizontal ones on its horizontal,
    // each labelled with its own value.
    // True when a member leaves node n within 25° of the screen direction (dx, dy).
    function occupied(n, dx, dy) {
      return model.members.some(function (m) {
        if (m.i !== n.id && m.j !== n.id) return false;
        var o = nm[m.i === n.id ? m.j : m.i]; if (!o) return false;
        var ex = o.x - n.x, ey = -(o.y - n.y), L = Math.hypot(ex, ey) || 1;
        return (ex * dx + ey * dy) / L > Math.cos(25 * Math.PI / 180);
      });
    }
    function arrowText(x, y, text, color, anchor) {
      return '<text x="' + n2(x) + '" y="' + n2(y) + '" text-anchor="' + (anchor || 'middle') + '" font-size="11" font-weight="650" fill="' + color + '">' + text + '</text>';
    }
    // Reactions: on the support side (below the glyph, or beside it for an x
    // roller), pointing the way the reaction acts on the structure.
    if (ok && mode !== 'geometry') {
      result.reactions.forEach(function (R) {
        var n = nm[R.node]; if (!n) return;
        var s = toScreen(v, n.x, n.y), len = 44;
        if (R.fixedY && Math.abs(R.ry) > 0.05) {
          var base = s[1] + (n.support === 'rx' ? 12 : n.support === 'pin' ? 30 : 38);
          var up = R.ry > 0, ya = up ? base + len : base, yb = up ? base : base + len;
          out.push(arrow(s[0], ya, s[0], yb, pal.react, 2.2));
          out.push(arrowText(s[0] + 7, base + len / 2 + 4, App.fmt(Math.abs(R.ry), 0), pal.react, 'start'));
        }
        if (R.fixedX && Math.abs(R.rx) > 0.05) {
          var right = R.rx > 0, xa, xb, ly = s[1] - 7;
          if (n.support === 'rx') {
            // Glyph on the left of the node: the arrow sits beyond it.
            var edge = s[0] - 38;
            xa = right ? edge - len : edge; xb = right ? edge : edge - len;
          } else {
            // Pointing at the node from the free side, or leaving it when a
            // member already occupies that side.
            var gap = 12, push = !occupied(n, right ? -1 : 1, 0);
            var sd = push ? (right ? -1 : 1) : (right ? 1 : -1);
            var near = s[0] + sd * gap, far = s[0] + sd * (gap + len);
            xa = push ? far : near; xb = push ? near : far;
          }
          out.push(arrow(xa, s[1], xb, s[1], pal.react, 2.2));
          out.push(arrowText((xa + xb) / 2, ly, App.fmt(Math.abs(R.rx), 0), pal.react));
        }
      });
    }

    // Loads: each component points at the node from the outside; a small
    // horizontal component gets a proportionally shorter arrow (≥ 26 px).
    model.nodes.forEach(function (n) {
      var fx = Number(n.fx) || 0, fy = Number(n.fy) || 0;
      if (!fx && !fy) return;
      var s = toScreen(v, n.x, n.y), len = 56, gap = 9;
      // sd: side of the node where the arrow sits (screen axis sign); the
      // arrow points at the node (push) unless a member occupies that side.
      if (fy) {
        var dirY = fy < 0 ? 1 : -1, pushY = !occupied(n, 0, -dirY), sy = pushY ? -dirY : dirY;
        var nearY = s[1] + sy * gap, farY = s[1] + sy * (gap + len);
        out.push(arrow(s[0], pushY ? farY : nearY, s[0], pushY ? nearY : farY, pal.load, 2.6));
        out.push('<text x="' + n2(s[0]) + '" y="' + n2(sy < 0 ? farY - 6 : farY + 15) + '" text-anchor="middle" font-size="11.5" font-weight="700" fill="' + pal.load + '">' + App.fmt(Math.abs(fy), 0) + ' kN</text>');
      }
      if (fx) {
        var lh = fy ? Math.max(26, Math.min(len, len * Math.abs(fx) / Math.abs(fy))) : len;
        var dirX = fx > 0 ? 1 : -1, pushX = !occupied(n, -dirX, 0), sx = pushX ? -dirX : dirX;
        var nearX = s[0] + sx * gap, farX = s[0] + sx * (gap + lh);
        out.push(arrow(pushX ? farX : nearX, s[1], pushX ? nearX : farX, s[1], pal.load, 2.4));
        out.push('<text x="' + n2(farX + sx * 5) + '" y="' + n2(s[1] + 4) + '" text-anchor="' + (sx < 0 ? 'end' : 'start') + '" font-size="11.5" font-weight="700" fill="' + pal.load + '">' + App.fmt(Math.abs(fx), 0) + ' kN</text>');
      }
    });

    // Nodes
    model.nodes.forEach(function (n) {
      var s = toScreen(v, n.x, n.y);
      var isSel = sel && sel.type === 'node' && sel.id === n.id, isHov = hov && hov.type === 'node' && hov.id === n.id;
      var isPending = pending === n.id && o.interactive;
      if (isSel || isHov || isPending) out.push('<circle cx="' + n2(s[0]) + '" cy="' + n2(s[1]) + '" r="' + (isSel || isPending ? 12 : 10) + '" fill="' + pal.sel + '" fill-opacity="' + (isSel || isPending ? 0.35 : 0.22) + '"/>');
      if (mode === 'util' && nchk[n.id]) {
        out.push('<circle cx="' + n2(s[0]) + '" cy="' + n2(s[1]) + '" r="10" fill="none" stroke="' + App.utilColor(nchk[n.id].util) + '" stroke-width="3"/>');
      }
      if (warnIds[n.id]) out.push('<circle cx="' + n2(s[0]) + '" cy="' + n2(s[1]) + '" r="11" fill="none" stroke="' + pal.warn + '" stroke-width="2" stroke-dasharray="3 2"/>');
      out.push('<circle cx="' + n2(s[0]) + '" cy="' + n2(s[1]) + '" r="5.5" fill="' + pal.nodeFill + '" stroke="' + pal.nodeStroke + '" stroke-width="2"/>');
    });

    // Labels: member values and ids
    model.members.forEach(function (m) {
      var g = geo[m.id]; if (!g || g.L < 26) return;
      var mx = (g.a[0] + g.b[0]) / 2, my = (g.a[1] + g.b[1]) / 2, f = forces[m.id], c = mchk[m.id];
      var text = null, opt = {};
      if (mode === 'geometry') {
        text = (o.ids !== false ? m.id + ' · ' : '') + App.fmt(m.w, 0);
        opt.small = true;
      } else if (mode === 'forces' && f) {
        text = f.kind === 'zero' ? '0' : (f.kind === 'strut' ? 'C ' : 'T ') + App.fmt(Math.abs(f.N), 0);
        opt.color = f.kind === 'strut' ? (o.palette === 'light' ? '#244f8e' : '#cfe2ff') : f.kind === 'tie' ? (o.palette === 'light' ? '#7a4a0c' : '#ffe2ae') : pal.idText;
        opt.stroke = f.kind === 'zero' ? null : colorOf(m);
        opt.small = f.kind === 'zero';
      } else if (mode === 'util' && c && f && f.kind !== 'zero') {
        text = App.fmt(c.util, 2);
        opt.color = o.palette === 'light' ? App.utilInk(c.util) : App.utilColor(c.util);
        opt.stroke = App.utilColor(c.util);
      }
      if (text) out.push(label(mx, my, g.ang, text, pal, opt));
      if (o.ids !== false && mode !== 'geometry') {
        var off = 15, px = -g.uy * off, py = g.ux * off;
        if (py > 0) { px = -px; py = -py; }
        out.push('<text x="' + n2(mx + px) + '" y="' + n2(my + py + 3) + '" text-anchor="middle" font-size="9.5" fill="' + pal.idText + '" opacity=".85">' + m.id + '</text>');
      }
    });
    model.nodes.forEach(function (n) {
      var s = toScreen(v, n.x, n.y), nc = nchk[n.id];
      var parts = [];
      if (o.ids !== false) parts.push(n.id);
      if (mode === 'util' && nc) parts.push(nc.type + ' ' + App.fmt(nc.util, 2));
      if (!parts.length) return;
      out.push('<text x="' + n2(s[0] - 10) + '" y="' + n2(s[1] - 10) + '" text-anchor="end" font-size="10.5" font-weight="650" fill="' + (mode === 'util' && nc ? (o.palette === 'light' ? App.utilInk(nc.util) : App.utilColor(nc.util)) : pal.idText) + '">' + parts.join(' · ') + '</text>');
    });

    // Interactive overlays: outline handles, preview, hit areas
    if (o.interactive) {
      if (App.tool === 'outline') {
        var pts = model.outline || [];
        pts.forEach(function (p, k) {
          var s = toScreen(v, p[0], p[1]), q = pts[(k + 1) % pts.length], t = toScreen(v, q[0], q[1]);
          var mx = (s[0] + t[0]) / 2, my = (s[1] + t[1]) / 2;
          out.push('<g class="hit-edge" data-edge="' + k + '" style="cursor:copy"><circle cx="' + n2(mx) + '" cy="' + n2(my) + '" r="9" fill="transparent"/><circle cx="' + n2(mx) + '" cy="' + n2(my) + '" r="4.5" fill="#0a2131" stroke="' + pal.sel + '" stroke-width="1.3"/><path d="M' + n2(mx - 2.5) + ' ' + n2(my) + 'h5M' + n2(mx) + ' ' + n2(my - 2.5) + 'v5" stroke="' + pal.sel + '" stroke-width="1.2"/></g>');
        });
        pts.forEach(function (p, k) {
          var s = toScreen(v, p[0], p[1]), isS = sel && sel.type === 'vertex' && sel.index === k;
          out.push('<g class="hit-vertex" data-vertex="' + k + '" style="cursor:move"><rect x="' + n2(s[0] - 10) + '" y="' + n2(s[1] - 10) + '" width="20" height="20" fill="transparent"/><rect x="' + n2(s[0] - 5) + '" y="' + n2(s[1] - 5) + '" width="10" height="10" rx="2" fill="' + (isS ? pal.sel : '#e8fff8') + '" stroke="#0b2436" stroke-width="1.5"/></g>');
        });
      }
      if (App.tool === 'member' && pending && cursor) {
        var pn = nm[pending];
        if (pn) {
          var a = toScreen(v, pn.x, pn.y), target = hov && hov.type === 'node' ? nm[hov.id] : null;
          var b = target ? toScreen(v, target.x, target.y) : toScreen(v, cursor[0], cursor[1]);
          out.push('<line x1="' + n2(a[0]) + '" y1="' + n2(a[1]) + '" x2="' + n2(b[0]) + '" y2="' + n2(b[1]) + '" stroke="' + pal.sel + '" stroke-width="2" stroke-dasharray="6 4"/>');
          var Lm = Math.hypot((b[0] - a[0]) / v.k, (b[1] - a[1]) / v.k);
          out.push(label((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 14, 0, App.fmt(Lm, 3) + ' m', pal, { small: true, color: pal.sel }));
        }
      }
      if ((App.tool === 'node' || App.tool === 'member') && cursor && !(hov && hov.type === 'node')) {
        var c2 = toScreen(v, cursor[0], cursor[1]);
        out.push('<g pointer-events="none"><circle cx="' + n2(c2[0]) + '" cy="' + n2(c2[1]) + '" r="5" fill="none" stroke="' + pal.sel + '" stroke-width="1.5"/><path d="M' + n2(c2[0] - 11) + ' ' + n2(c2[1]) + 'h7M' + n2(c2[0] + 4) + ' ' + n2(c2[1]) + 'h7M' + n2(c2[0]) + ' ' + n2(c2[1] - 11) + 'v7M' + n2(c2[0]) + ' ' + n2(c2[1] + 4) + 'v7" stroke="' + pal.sel + '" stroke-width="1.2"/></g>');
      }
      if (App.tool !== 'outline') {
        model.members.forEach(function (m) {
          var g = geo[m.id]; if (!g) return;
          out.push('<line class="hit-member" data-member="' + m.id + '" x1="' + n2(g.a[0]) + '" y1="' + n2(g.a[1]) + '" x2="' + n2(g.b[0]) + '" y2="' + n2(g.b[1]) + '" stroke="transparent" stroke-width="' + (App.coarse ? 24 : 14) + '"/>');
        });
        model.nodes.forEach(function (n) {
          var s = toScreen(v, n.x, n.y);
          out.push('<circle class="hit-node" data-node="' + n.id + '" cx="' + n2(s[0]) + '" cy="' + n2(s[1]) + '" r="' + (App.coarse ? 19 : 12) + '" fill="transparent"/>');
        });
      }
    }
    return out.join('');
  }
  function decimalsFor(step) { for (var d = 0; d < 4; d++) { var x = step * Math.pow(10, d); if (Math.abs(x - Math.round(x)) < 1e-9) return d; } return 4; }

  // ------------------------------------------------------------- render ---
  function render() {
    if (!svg || !App.model) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('class', 'tool-' + App.tool + (drag && drag.kind === 'pan' ? ' panning' : '') + (drag && drag.moved && drag.kind !== 'pan' ? ' dragging' : ''));
      svg.innerHTML = draw(App.model, App.result, App.checks, {
        view: view, w: W, h: H, palette: 'dark', mode: App.display.mode, bands: App.display.bands, ids: App.display.ids, zones: App.display.zones,
        interactive: true, sel: App.sel, hover: App.hover, warnings: App.warnings
      });
      hud();
    });
  }

  function hud() {
    var el = document.getElementById('hud'); if (!el) return;
    var parts = [];
    if (cursorRaw) parts.push('<span>x <b>' + App.fmt(cursorRaw[0], 3) + '</b> · y <b>' + App.fmt(cursorRaw[1], 3) + '</b> m</span>');
    parts.push('<span class="sep"></span><span>' + App.t('grid') + ' <b>' + App.fmt(niceStep(view.k) * 1000, 0) + '</b> mm</span>');
    parts.push('<span class="sep"></span><span class="hint">' + App.t('hint_' + App.tool) + (pending ? ' · ' + App.t('hintChain') : '') + '</span>');
    el.innerHTML = parts.join('');
  }

  // ------------------------------------------------------------ helpers ---
  function localPoint(e) { var r = svg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function snapWorld(p, e) {
    var w = toWorld(p[0], p[1]);
    if (!App.display.snap || (e && e.altKey)) return [App.round(w[0]), App.round(w[1])];
    var s = niceStep(view.k);
    return [App.round(Math.round(w[0] / s) * s), App.round(Math.round(w[1] / s) * s)];
  }
  function hitOf(e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-node],[data-member],[data-vertex],[data-edge]') : null;
    if (!t) return null;
    if (t.dataset.node) return { type: 'node', id: t.dataset.node };
    if (t.dataset.member) return { type: 'member', id: t.dataset.member };
    if (t.dataset.vertex !== undefined) return { type: 'vertex', index: +t.dataset.vertex };
    if (t.dataset.edge !== undefined) return { type: 'edge', index: +t.dataset.edge };
    return null;
  }
  function select(s) { App.sel = s; App.emitSelection(); }
  App.emitSelection = function () { App.listeners.forEach(function (fn) { fn({ selection: true }); }); };
  function changed(opts) { App.update(opts || {}); }
  App.cancelPending = function () { if (pending) { pending = null; render(); } };

  function projectOnMember(m, w) {
    var A = App.node(m.i), B = App.node(m.j);
    var dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy;
    var t = Math.max(0.05, Math.min(0.95, ((w[0] - A.x) * dx + (w[1] - A.y) * dy) / L2));
    return [A.x + t * dx, A.y + t * dy];
  }

  // ------------------------------------------------------------- events ---
  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button === 2) return;
    svg.setPointerCapture(e.pointerId);
    var p = localPoint(e);
    pointers[e.pointerId] = p;
    hideTooltip();
    if (Object.keys(pointers).length === 2) { startPinch(); return; }
    var hit = hitOf(e), w = snapWorld(p, e);
    if (e.button === 1 || spaceDown) { drag = { kind: 'pan', start: p, view: { ox: view.ox, oy: view.oy }, moved: false }; render(); return; }
    var tool = App.tool;
    if (tool === 'select') {
      if (hit && hit.type === 'node') {
        var n = App.node(hit.id);
        select({ type: 'node', id: hit.id });
        drag = { kind: 'node', id: hit.id, start: p, orig: [n.x, n.y], moved: false };
      } else if (hit && hit.type === 'member') {
        var m = App.member(hit.id), A = App.node(m.i), B = App.node(m.j);
        select({ type: 'member', id: hit.id });
        drag = { kind: 'member', id: hit.id, start: p, origA: [A.x, A.y], origB: [B.x, B.y], moved: false };
      } else {
        drag = { kind: 'pan', start: p, view: { ox: view.ox, oy: view.oy }, moved: false, clear: true };
      }
    } else if (tool === 'node') {
      App.commit();
      if (hit && hit.type === 'node') { select({ type: 'node', id: hit.id }); App.history.pop(); return; }
      var id;
      if (hit && hit.type === 'member') { var pr = projectOnMember(App.member(hit.id), w); id = App.splitMember(hit.id, pr[0], pr[1]); }
      else id = App.addNode(w[0], w[1]);
      App.sel = { type: 'node', id: id };
      changed({ inputs: true });
    } else if (tool === 'member') {
      var nid = null;
      if (hit && hit.type === 'node') nid = hit.id;
      else { App.commit(); nid = App.addNode(w[0], w[1]); App.update({ inputs: true }); }
      if (!pending) { pending = nid; App.sel = { type: 'node', id: nid }; App.emitSelection(); render(); return; }
      if (pending === nid) { pending = null; render(); return; }
      App.commit();
      var mid = App.addMember(pending, nid, App.lastMemberProto);
      if (!mid) { App.history.pop(); App.toast(App.t('memberExists')); }
      else App.sel = { type: 'member', id: mid };
      pending = nid;
      changed({ inputs: true });
    } else if (tool === 'support') {
      if (hit && hit.type === 'node') {
        App.commit();
        var nd = App.node(hit.id), order = [null, 'pin', 'ry', 'rx'];
        nd.support = order[(order.indexOf(nd.support) + 1) % order.length];
        App.sel = { type: 'node', id: hit.id };
        changed({ inputs: true });
      }
    } else if (tool === 'load') {
      if (hit && hit.type === 'node') {
        var nl = App.node(hit.id);
        if (!nl.fx && !nl.fy) { App.commit(); nl.fy = -100; }
        App.sel = { type: 'node', id: hit.id };
        changed({ inputs: true, focus: 'fy' });
      }
    } else if (tool === 'outline') {
      if (hit && hit.type === 'vertex') {
        var pt = App.model.outline[hit.index];
        select({ type: 'vertex', index: hit.index });
        drag = { kind: 'vertex', index: hit.index, start: p, orig: [pt[0], pt[1]], moved: false };
      } else if (hit && hit.type === 'edge') {
        App.commit();
        App.model.outline.splice(hit.index + 1, 0, [w[0], w[1]]);
        select({ type: 'vertex', index: hit.index + 1 });
        drag = { kind: 'vertex', index: hit.index + 1, start: p, orig: [w[0], w[1]], moved: true, committed: true };
        changed({ inputs: true });
      } else {
        drag = { kind: 'pan', start: p, view: { ox: view.ox, oy: view.oy }, moved: false, clear: true };
      }
    } else if (tool === 'erase') {
      if (hit) {
        App.commit();
        if (hit.type === 'node') App.deleteNode(hit.id);
        else if (hit.type === 'member') App.deleteMember(hit.id);
        else if (hit.type === 'vertex') { if (App.model.outline.length > 3) App.model.outline.splice(hit.index, 1); else App.history.pop(); }
        App.validateSel();
        changed({ inputs: true });
      } else {
        drag = { kind: 'pan', start: p, view: { ox: view.ox, oy: view.oy }, moved: false };
      }
    }
  }

  function onMove(e) {
    var p = localPoint(e);
    if (pointers[e.pointerId]) pointers[e.pointerId] = p;
    if (pinch && Object.keys(pointers).length === 2) { movePinch(); return; }
    cursorRaw = toWorld(p[0], p[1]);
    cursor = snapWorld(p, e);
    var hit = hitOf(e);
    if (drag) {
      var dx = p[0] - drag.start[0], dy = p[1] - drag.start[1];
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      if (drag.kind === 'pan') {
        drag.moved = true;
        view.ox = drag.view.ox + dx; view.oy = drag.view.oy + dy; render(); return;
      }
      if (!drag.committed) { App.commit(); drag.committed = true; }
      drag.moved = true;
      var s = App.display.snap && !e.altKey ? niceStep(view.k) : 0;
      var snap = function (v) { return s ? App.round(Math.round(v / s) * s) : App.round(v); };
      var dwx = dx / view.k, dwy = -dy / view.k;
      if (drag.kind === 'node') {
        var n = App.node(drag.id);
        n.x = snap(drag.orig[0] + dwx); n.y = snap(drag.orig[1] + dwy);
      } else if (drag.kind === 'member') {
        var m = App.member(drag.id), A = App.node(m.i), B = App.node(m.j);
        var ddx = snap(drag.origA[0] + dwx) - drag.origA[0], ddy = snap(drag.origA[1] + dwy) - drag.origA[1];
        A.x = App.round(drag.origA[0] + ddx); A.y = App.round(drag.origA[1] + ddy);
        B.x = App.round(drag.origB[0] + ddx); B.y = App.round(drag.origB[1] + ddy);
      } else if (drag.kind === 'vertex') {
        App.model.outline[drag.index] = [snap(drag.orig[0] + dwx), snap(drag.orig[1] + dwy)];
      }
      changed({ drag: true });
      return;
    }
    var key = hit ? hit.type + ':' + (hit.id || hit.index) : '';
    var prev = App.hover ? App.hover.type + ':' + (App.hover.id || App.hover.index) : '';
    if (key !== prev) { App.hover = hit && (hit.type === 'node' || hit.type === 'member') ? hit : null; render(); }
    else if (App.tool === 'member' || App.tool === 'node') render();
    else hud();
    showTooltip(hit, p);
  }

  function onUp(e) {
    delete pointers[e.pointerId];
    if (pinch) { if (Object.keys(pointers).length < 2) pinch = null; return; }
    if (!drag) return;
    var d = drag; drag = null;
    if (d.kind === 'pan' && !d.moved && d.clear) { pending = null; select(null); }
    if (d.kind !== 'pan' && d.moved) changed({ inputs: true });
    render();
  }

  function onWheel(e) {
    e.preventDefault();
    var p = localPoint(e), f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016));
    zoomAt(p, f);
  }
  function zoomAt(p, f) {
    var k = Math.max(5, Math.min(view.k * f, 6000));
    f = k / view.k;
    view.ox = p[0] - (p[0] - view.ox) * f; view.oy = p[1] - (p[1] - view.oy) * f; view.k = k;
    render();
  }
  App.zoom = function (f) { zoomAt([W / 2, H / 2], f); };

  var pinch = null;
  function startPinch() {
    var ids = Object.keys(pointers), a = pointers[ids[0]], b = pointers[ids[1]];
    drag = null;
    pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
  }
  function movePinch() {
    var ids = Object.keys(pointers), a = pointers[ids[0]], b = pointers[ids[1]];
    var d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    view.ox += m[0] - pinch.m[0]; view.oy += m[1] - pinch.m[1];
    zoomAt(m, d / pinch.d);
    pinch = { d: d, m: m };
  }

  // ------------------------------------------------------------ tooltip ---
  function hideTooltip() { var t = document.getElementById('tooltip'); if (t) t.classList.add('hidden'); }
  function showTooltip(hit, p) {
    var t = document.getElementById('tooltip');
    if (!t) return;
    if (!hit || (hit.type !== 'node' && hit.type !== 'member') || drag) { t.classList.add('hidden'); return; }
    var html = '';
    if (hit.type === 'member') {
      var m = App.member(hit.id), f = App.force(hit.id), c = App.memberCheck(hit.id);
      if (!m) return;
      var kind = f ? f.kind : 'zero';
      html = '<div class="tt-head"><b>' + m.id + ' · ' + App.t('kind_' + kind) + '</b><span>' + m.i + '–' + m.j + '</span></div>';
      if (f) html += '<div class="tt-row"><span>N</span><span>' + App.fmt(f.N, 1) + ' kN</span></div><div class="tt-row"><span>L</span><span>' + App.fmt(f.L, 3) + ' m</span></div>';
      if (c && c.capacity !== null) html += '<div class="tt-row"><span>' + (kind === 'tie' ? 'Tr' : 'Cr') + '</span><span>' + App.fmt(c.capacity, 0) + ' kN</span></div><div class="tt-row"><span>' + App.t('utilShort') + '</span><span style="color:' + App.utilInk(c.util) + '">' + App.fmt(c.util, 2) + '</span></div>';
    } else {
      var n = App.node(hit.id), nc = App.nodeCheck(hit.id), R = App.reaction(hit.id);
      if (!n) return;
      html = '<div class="tt-head"><b>' + n.id + (nc ? ' · ' + nc.type : '') + '</b><span>(' + App.fmt(n.x, 3) + ' ; ' + App.fmt(n.y, 3) + ')</span></div>';
      if (n.fx || n.fy) html += '<div class="tt-row"><span>F</span><span>' + App.fmt(n.fx, 0) + ' ; ' + App.fmt(n.fy, 0) + ' kN</span></div>';
      if (R) html += '<div class="tt-row"><span>R</span><span>' + App.fmt(R.rx, 0) + ' ; ' + App.fmt(R.ry, 0) + ' kN</span></div>';
      if (nc) html += '<div class="tt-row"><span>' + App.t('utilShort') + '</span><span style="color:' + App.utilInk(nc.util) + '">' + App.fmt(nc.util, 2) + '</span></div>';
    }
    t.innerHTML = html;
    t.classList.remove('hidden');
    var x = p[0] + 16, y = p[1] + 14, tw = t.offsetWidth, th = t.offsetHeight;
    if (x + tw > W - 8) x = p[0] - tw - 12;
    if (y + th > H - 8) y = p[1] - th - 10;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }

  // --------------------------------------------------------------- public ---
  App.fit = function () {
    if (!App.model) return;
    var ins = document.getElementById('inspector');
    var right = ins && !ins.classList.contains('hidden') && W > 900 ? 340 : 70;
    var v = fitView(App.model, W, H, { l: 90, r: right, t: 95, b: 120 });
    view.ox = v.ox; view.oy = v.oy; view.k = v.k;
    render();
  };
  App.setTool = function (t) {
    App.tool = t; pending = null;
    if (t !== 'outline' && App.sel && App.sel.type === 'vertex') App.sel = null;
    App.listeners.forEach(function (fn) { fn({ tool: true }); });
    render();
  };
  App.nudge = function (dx, dy) {
    if (!App.sel) return;
    var s = niceStep(view.k);
    App.commit();
    if (App.sel.type === 'node') { var n = App.node(App.sel.id); n.x = App.round(n.x + dx * s); n.y = App.round(n.y + dy * s); }
    else if (App.sel.type === 'vertex') { var p = App.model.outline[App.sel.index]; p[0] = App.round(p[0] + dx * s); p[1] = App.round(p[1] + dy * s); }
    else if (App.sel.type === 'member') { var m = App.member(App.sel.id);[App.node(m.i), App.node(m.j)].forEach(function (nn) { nn.x = App.round(nn.x + dx * s); nn.y = App.round(nn.y + dy * s); }); }
    changed({ inputs: true });
  };

  // Light drawing for reports and SVG export.
  App.staticSVG = function (opts) {
    opts = opts || {};
    var model = opts.model || App.model, result = opts.result || App.result, checks = opts.checks || App.checks;
    var w = opts.width || 1000;
    var b = bbox(model), bw = Math.max(b.x1 - b.x0, 0.2), bh = Math.max(b.y1 - b.y0, 0.2);
    var h = opts.height || Math.round(Math.max(340, Math.min(720, (w - 140) * bh / bw + 150)));
    var pad = opts.pad || { l: 90, r: 90, t: 85, b: 110 };
    var v = fitView(model, w, h, pad);
    var body = draw(model, result, checks, { view: v, w: w, h: h, palette: opts.palette || 'light', mode: opts.mode || 'forces', bands: true, ids: opts.ids !== false, zones: opts.zones !== false, grid: opts.grid !== false, interactive: false });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" font-family="Segoe UI, Inter, Roboto, Arial, sans-serif">' + body + '</svg>';
  };

  App.initCanvas = function () {
    svg = document.getElementById('canvas');
    wrap = document.getElementById('canvas-wrap');
    var first = true;
    var ro = new ResizeObserver(function () {
      var r = wrap.getBoundingClientRect();
      var cx = W ? (W / 2 - view.ox) / view.k : 0, cy = H ? (view.oy - H / 2) / view.k : 0;
      W = Math.max(200, Math.round(r.width)); H = Math.max(200, Math.round(r.height));
      if (first) { first = false; App.fit(); return; }
      view.ox = W / 2 - cx * view.k; view.oy = H / 2 + cy * view.k;
      render();
    });
    ro.observe(wrap);
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('pointerleave', function () { cursor = null; cursorRaw = null; if (App.hover) { App.hover = null; render(); } hideTooltip(); hud(); });
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('dblclick', function (e) { if (!hitOf(e) && App.tool === 'select') App.fit(); });
    svg.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (pending) { pending = null; render(); return; }
      var hit = hitOf(e);
      if (App.tool === 'outline' && hit && hit.type === 'vertex' && App.model.outline.length > 3) {
        App.commit(); App.model.outline.splice(hit.index, 1); App.sel = null; changed({ inputs: true });
      }
    });
    window.addEventListener('keydown', function (e) { if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) { spaceDown = true; e.preventDefault(); } });
    window.addEventListener('keyup', function (e) { if (e.code === 'Space') spaceDown = false; });
    App.on(function (o) { if (o.fit) App.fit(); else render(); });
  };
  App.renderCanvas = render;
  App.canvasView = function () { return view; };
})();
