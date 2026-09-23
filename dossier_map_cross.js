/* THE LINES THAT CROSS A FRONT DIAMOND, put back on top of it on the editable
   slide (2026-09-23).

   ground() (dossier_map_draw.js) paints the red fighting diamonds BEFORE the
   governorate lines, the coast, the borders, the dashed line of contact and
   the seam, so in the picture those lines run OVER the diamonds. In overlay
   mode (DossierMap.exportLayers) the diamonds are slide objects laid on the
   base picture, and there they COVERED the lines: the dashes Ziv sees crossing
   every red mark were gone on the slide.

   So while ground() finishes, this watches the paths built on the ctx and, at
   each stroke, records the stretches that pass over a diamond as `line` items
   AFTER the diamonds. The base keeps the whole line; an item only puts back
   what a diamond object would hide.

   A DASHED LINE IS RECORDED DASH BY DASH, each dash a SOLID line cut at the
   canvas's own dash phase. PowerPoint's preset dashes are multiples of the
   line width and have no phase: the line of contact's 12/8 px under a 4 px
   line is no preset, so one dashed item would put ink where the picture has a
   gap. No `dash` key on these items (= solid).

   Normal painting never arms it (no recorder, no watch): not one pixel moves. */
var DossierMapCross = (function () {
  "use strict";

  var M = ["beginPath", "moveTo", "lineTo", "closePath", "stroke"];
  var SIDES = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  var AA = 1;          /* px of anti-aliasing kept round a diamond's edge */
  var MIN_PIECE = 0.3; /* px: a shorter stretch paints nothing worth an object */

  /* The diamonds recorded since `n0`, one per centre at its widest (the halo
     diamond under the red one). */
  function diamonds(list, n0) {
    var by = {}, out = [];
    for (var i = n0; i < list.length; i++) {
      var o = list[i];
      if (!o || o.kind !== "diamond" || !(o.r > 0)) continue;
      var k = Math.round(o.x * 4) + "," + Math.round(o.y * 4);
      if (!by[k]) { by[k] = { x: o.x, y: o.y, r: o.r }; out.push(by[k]); }
      else if (o.r > by[k].r) by[k].r = o.r;
    }
    return out;
  }

  /* The part [t0, t1] of segment a->b inside |x-cx| + |y-cy| <= R: the four
     sides of the diamond as half-planes, Liang-Barsky. */
  function clip(a, b, d, R) {
    var t0 = 0, t1 = 1, dx = b[0] - a[0], dy = b[1] - a[1];
    var ax = a[0] - d.x, ay = a[1] - d.y;
    for (var i = 0; i < 4; i++) {
      var s = SIDES[i], p = s[0] * dx + s[1] * dy, q = R - (s[0] * ax + s[1] * ay);
      if (p === 0) { if (q < 0) return null; continue; }
      var t = q / p;
      if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
      else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    return t0 < t1 ? [t0, t1] : null;
  }

  /* Arc-length stretches [s0, s1] of polyline `pts` (lengths `len`, starts
     `at`) inside any diamond grown by `grow` px, merged. */
  function inside(pts, at, len, ds, grow) {
    var iv = [];
    for (var i = 0; i + 1 < pts.length; i++) {
      if (!(len[i] > 0)) continue;
      var a = pts[i], b = pts[i + 1];
      for (var j = 0; j < ds.length; j++) {
        var d = ds[j], R = d.r + grow;
        if (Math.max(a[0], b[0]) < d.x - R || Math.min(a[0], b[0]) > d.x + R ||
            Math.max(a[1], b[1]) < d.y - R || Math.min(a[1], b[1]) > d.y + R) continue;
        var c = clip(a, b, d, R);
        if (c) iv.push([at[i] + c[0] * len[i], at[i] + c[1] * len[i]]);
      }
    }
    iv.sort(function (x, y) { return x[0] - y[0]; });
    var out = [];
    iv.forEach(function (v) {
      var last = out[out.length - 1];
      if (last && v[0] <= last[1] + 1e-6) last[1] = Math.max(last[1], v[1]);
      else out.push([v[0], v[1]]);
    });
    return out;
  }

  /* The ON parts of the canvas dash pattern inside [A, B]. The phase restarts
     at every subpath, as the canvas does it; an odd list is doubled, as the
     canvas does it. */
  function dashed(iv, dash, off) {
    if (!dash || !dash.length) return iv;
    var pat = dash.length % 2 ? dash.concat(dash) : dash, T = 0, out = [];
    pat.forEach(function (n) { T += n; });
    if (!(T > 0)) return iv;
    iv.forEach(function (v) {
      var k = Math.floor((v[0] + off) / T);
      for (var P = k * T - off; P < v[1]; P += T) {
        for (var i = 0, c = P; i < pat.length; c += pat[i], i++) {
          if (i % 2) continue;
          var s0 = Math.max(c, v[0]), s1 = Math.min(c + pat[i], v[1]);
          if (s1 > s0) out.push([s0, s1, s0 === c, s1 === c + pat[i]]);
        }
      }
    });
    return out;
  }

  /* The polyline between arc lengths s0 and s1. */
  function cut(pts, at, len, s0, s1) {
    var out = [], pt = function (i, s) {
      var t = len[i] > 0 ? (s - at[i]) / len[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
    };
    for (var i = 0; i + 1 < pts.length; i++) {
      var e = at[i] + len[i];
      if (e <= s0 || at[i] > s1) continue;
      if (!out.length) out.push(pt(i, Math.max(s0, at[i])));
      if (e < s1) out.push(pts[i + 1]);
      else { out.push(pt(i, s1)); break; }
    }
    return out;
  }

  /* Watch `ctx` until the returned function is called. Stretches go on `list`
     (the recorder's own), after whatever it holds now. */
  function watch(ctx, list) {
    var n0 = list.length, subs = [], cur = null, start = null, m = null, own = {};
    var map = function (x, y) {
      return m ? [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f] : [x, y];
    };
    var matrix = function () {
      var t = ctx.getTransform ? ctx.getTransform() : null;
      m = t && !t.isIdentity ? t : null;
    };
    var hook = {
      beginPath: function () { subs = []; cur = null; start = null; },
      moveTo: function (x, y) {
        matrix(); cur = [map(x, y)]; cur.closed = false; subs.push(cur); start = cur[0];
      },
      lineTo: function (x, y) {
        if (!cur) { matrix(); cur = start ? [start] : []; cur.closed = false; subs.push(cur); }
        cur.push(map(x, y));
      },
      closePath: function () { if (cur) { cur.closed = true; cur = null; } },
      stroke: function () {
        if (arguments.length || ctx.globalAlpha !== 1 || typeof ctx.strokeStyle !== "string") return;
        var ds = diamonds(list, n0);
        if (!ds.length || !(ctx.lineWidth > 0)) return;
        var t = ctx.getTransform ? ctx.getTransform() : null, k = t ? Math.hypot(t.a, t.b) : 1;
        var w = ctx.lineWidth * k, grow = (w / 2 + AA) * Math.SQRT2;
        var dash = ctx.getLineDash().map(function (n) { return n * k; });
        var off = (ctx.lineDashOffset || 0) * k;
        subs.forEach(function (sp) { piecesOf(sp, ds, grow, dash, off, w); });
      }
    };
    function piecesOf(sp, ds, grow, dash, off, w) {
      var pts = sp.closed && sp.length > 1 ? sp.concat([sp[0]]) : sp;
      if (pts.length < 2) return;
      var at = [0], len = [];
      for (var i = 0; i + 1 < pts.length; i++) {
        len.push(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]));
        at.push(at[i] + len[i]);
      }
      /* A dash's own END carries the canvas cap (round: w/2 past the end);
         PowerPoint draws these items flat, so the piece is lengthened by it
         along the path. A cut at the diamond's edge is no end: none there. */
      var e = ctx.lineCap === "butt" ? 0 : w / 2, S = at[at.length - 1];
      dashed(inside(pts, at, len, ds, grow), dash, off).forEach(function (v) {
        if (v[1] - v[0] < MIN_PIECE) return;
        var s0 = v[2] ? Math.max(0, v[0] - e) : v[0], s1 = v[3] ? Math.min(S, v[1] + e) : v[1];
        list.push({ kind: "line", pts: cut(pts, at, len, s0, s1),
          stroke: ctx.strokeStyle, width: w });
      });
    }
    M.forEach(function (name) {
      var mine = Object.prototype.hasOwnProperty.call(ctx, name), orig = ctx[name];
      own[name] = mine ? orig : null;
      ctx[name] = function () {
        hook[name].apply(null, arguments);
        return orig.apply(ctx, arguments);
      };
    });
    return function () {
      M.forEach(function (name) {
        if (own[name]) ctx[name] = own[name]; else delete ctx[name];
      });
    };
  }

  return { watch: watch, diamonds: diamonds, clip: clip, dashed: dashed };
})();

window.DossierMapCross = DossierMapCross;
