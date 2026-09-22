/* THE SHIPPING LANES of the dossier maps: the dashed sea route a record authors
   in `lanes[]`, and its Hebrew name laid along the longest free stretch of it.

   Split out of dossier_map_draw.js on 2026-09-22, when the tribal map needed a
   hook in that file and it stood at 499 of the 500 lines every authored file on
   this board keeps. Nothing about the lanes changed in the move: the same three
   functions, the same comments, the same widths. It leaves draw.js holding the
   GROUND and the primitives every painter draws with, which is what every map
   needs, while this is what only a map with a sea route needs.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapLanes = { lanes }

   dossier_map.js registers it beside the other painters and merges them into the
   one object the paint pass is handed, so `R.lanes(...)` there reads exactly as
   it did before the split. The shared helpers come from DossierMapDraw, looked
   up on each call so the files may load in any order. */
"use strict";

var DossierMapLanes = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_lanes: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  /* The part of segment a-b inside the canvas (Liang-Barsky), or null. */
  function clip(a, b, W, H) {
    var dx = b[0] - a[0], dy = b[1] - a[1], t0 = 0, t1 = 1;
    var edges = [[-dx, a[0]], [dx, W - a[0]], [-dy, a[1]], [dy, H - a[1]]];
    for (var i = 0; i < 4; i++) {
      var q = edges[i][0], r = edges[i][1];
      if (q === 0) { if (r < 0) return null; continue; }
      var t = r / q;
      if (q < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
      else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
  }

  function segLen(seg) {
    return seg ? Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]) : 0;
  }

  function lanes(ctx, p, P, u, W, H, list, size, taken, legend) {
    var R = D();
    (list || []).forEach(function (lane) {
      var pts = (lane.path || []).map(function (c) { return p(c[0], c[1]); });
      if (pts.length < 2) return;
      ctx.beginPath();
      pts.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      R.paintShape(ctx, { stroke: P.lane, width: 2 * u, dash: [8 * u, 6 * u] });
      if (!lane.label_he) return;
      /* The name rides the segment with the most FREE length: on screen and
         not under the legend box. On the close-up the Gulf of Aden leg runs
         mostly off the canvas and then under the legend, so the leg through
         the strait wins there; on the overview the Gulf leg is the long one. */
      var best = null, len = -1;
      for (var i = 1; i < pts.length; i++) {
        var seg = clip(pts[i - 1], pts[i], W, H), d = segLen(seg);
        if (seg && legend) {
          var under = clip([seg[0][0] - legend.x0, seg[0][1] - legend.y0],
            [seg[1][0] - legend.x0, seg[1][1] - legend.y0], legend.x1 - legend.x0, legend.y1 - legend.y0);
          d -= segLen(under);
        }
        if (seg && d > len) { len = d; best = seg; }
      }
      if (!best) return;
      var a = best[0], b = best[1], w = R.width(ctx, lane.label_he, size, 500);
      var ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (Math.cos(ang) < 0) ang += Math.PI;         /* never upside down */
      /* Slide along the visible part until the name lands inside the canvas
         and clear of every place label and the legend box. */
      var spot = [0.5, 0.35, 0.65, 0.2, 0.8].map(function (t) {
        var x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        return { x: x, y: y, box: { x0: x - w / 2, y0: y - size * 1.6, x1: x + w / 2, y1: y + 2 * u } };
      }).filter(function (s) {
        return s.box.x0 >= 0 && s.box.x1 <= W && s.box.y0 >= 0 && s.box.y1 <= H &&
          !taken.some(function (t) { return R.overlaps(s.box, t); });
      })[0];
      if (!spot) return;
      ctx.save(); ctx.translate(spot.x, spot.y); ctx.rotate(ang);
      R.text(ctx, P, lane.label_he, 0, -6 * u, { size: size, color: P.muted, halo: 3 * u,
        align: "center", baseline: "bottom" });
      ctx.restore();
      taken.push(spot.box);
    });
  }

  return { lanes: lanes };
})();

window.DossierMapLanes = DossierMapLanes;
