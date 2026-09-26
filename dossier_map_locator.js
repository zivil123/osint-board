/* THE LOCATOR INSET on a report front close-up (2026-09-26).
   Ziv, of the Word report's front maps: "where is this?" - a close-up of a
   few tens of kilometres gives a reader nothing to find it by in Yemen. So
   every report picture cut CLOSE carries, in a free corner, a small plain
   Yemen: the sea, the neighbours as faint land, Yemen's own outline, and a
   red box where this picture's frame lies (a red dot when the box would be
   too small to read as one). No words.

   WHICH PICTURES: a VALUE read, no record field - `tab: "report"` AND a
   frame narrower than CLOSE_DEG of longitude. report_overview is the whole
   country (~10 degrees) and gets nothing; any new report front gets it free.

   HOW IT IS HOOKED, touching no capped file: the under-layer registry
   (dossier_map_under.js) hands this file the picture's projector `p` while
   the ground is painted; the credit painter (dossier_map_credit.js) calls
   `paint` straight after, with the `taken` list every later placer walks
   round. Both run inside the same synchronous paintMap call, so the stash
   is always this picture's; a stash from another map is ignored.

   WHERE IT GOES: the four corners (left ones first, the key box prefers the
   right) scored like the key box's (dossier_map_corner.js): a pin, a label
   point, a note's place, a clash dot, a drawn line or a belt outline under
   the box is a HARD hit; fewest hard hits wins, then the lightest; a corner
   with none is taken at once; the drawn main roads only break a tie, so a
   clean corner over open sea beats one over a road. Pads are floored in CSS
   px (a pin does not shrink on the ~0.5u print canvas). Nothing else is
   placed yet except the credit.
   The box goes into `taken` with an `ink` tag, so the reservation registers
   it as a MARK (dossier_map_ink.js) - any word later painted on it is
   counted - and the key's corner search scores it as an obstacle.

   NO ES modules - the page runs from file://. One global:
     window.DossierMapLocator = { paint(ctx, P, u, W, H, map, taken) }       */
"use strict";
var DossierMapLocator = (function () {
  var CLOSE_DEG = 4;                         /* frame lon span that is a close-up */
  var VIEW = { lon: [41.9, 53.7], lat: [11.9, 19.3] };   /* mainland + a rim */
  var FRAC = 0.2, MIN_W = 110;               /* a fifth of the picture's width */
  var DOT_MIN = 7;                           /* box side (CSS px) under which a dot */
  var RED = "#D0021B", YEM = "#E4D7BC", YEM_LINE = "#4A4034",
      NBR_LINE = "rgba(74, 90, 106, 0.35)";
  var CUR = null;

  function geo() { return (typeof GEO !== "undefined" && GEO) ? GEO : null; }
  function stash(ctx, p, P, u, map) { CUR = { map: map, p: p }; }
  if (window.DossierMapUnder) DossierMapUnder.add("locator_stash", 99, stash);

  function box(x0, y0, x1, y1) { return { x0: x0, y0: y0, x1: x1, y1: y1 }; }
  function hit(a, b) { return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1; }
  function inBox(b, q) { return q[0] >= b.x0 && q[0] <= b.x1 && q[1] >= b.y0 && q[1] <= b.y1; }

  /* Everything the inset must keep off, in picture px. */
  function obstacles(p, u, map, taken, G) {
    var out = (taken || []).map(function (b) { return { box: b, w: 100 }; });
    var byPlace = {};
    function pt(o, gx, gyUp, gyDown, w) {
      if (!o || typeof o.lon !== "number" || !p.inside(o.lon, o.lat, 0)) return;
      var q = p(o.lon, o.lat);
      out.push({ w: w, box: box(q[0] - gx, q[1] - gyUp, q[0] + gx, q[1] + gyDown) });
    }
    /* A story pin is a teardrop standing ON its point: most of it is above. */
    (map.pins || []).forEach(function (o) { byPlace[o.place] = o; pt(o, 16 * u, 36 * u, 8 * u, 100); });
    (map.labels || []).forEach(function (o) { byPlace[o.place] = byPlace[o.place] || o; pt(o, 22 * u, 22 * u, 22 * u, 60); });
    (map.notes || []).forEach(function (o) { pt(o, 14 * u, 14 * u, 14 * u, 60); });
    (map.clashes || []).forEach(function (c) { pt(byPlace[c.place], 14 * u, 14 * u, 14 * u, 100); });
    (map.arrows || []).forEach(function (a) {
      var pts = (a.path || []).map(function (c) { return p(c[0], c[1]); }), s = [];
      for (var i = 1; i < pts.length; i++) {
        for (var t = 0; t <= 4; t++) {
          s.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t / 4,
                  pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t / 4]);
        }
      }
      if (s.length) out.push({ w: 80, pts: s, pad: 6 * u });
    });
    if (map.fronts !== false && G && G.fronts) {
      (G.fronts.features || []).forEach(function (f) {
        var g = f.geometry || {}, s = [];
        var polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
        polys.forEach(function (poly) {
          s = s.concat(dense((poly[0] || []).map(function (c) { return p(c[0], c[1]); })));
        });
        if (s.length) out.push({ w: 100, pts: s, pad: 4 * u });
      });
    }
    /* The drawn main roads are ground, not marks: SOFT, so they only break a
       tie - between two clean corners the one over open sea or bare ground. */
    var RW = window.DossierMapRoadWords, lines = RW && RW.list ? RW.list() || [] : [];
    lines.forEach(function (l) { if (l.pts && l.pts.length) out.push({ w: 5, soft: true, pts: dense(l.pts), pad: 2 * u }); });
    return out;
  }

  /* A line's vertices can be far apart in px: sample each segment ~6px apart. */
  function dense(pts) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      if (i) {
        var a = pts[i - 1], b = pts[i];
        var n = Math.min(60, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6));
        for (var t = 1; t < n; t++) out.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]);
      }
      out.push(pts[i]);
    }
    return out;
  }

  function score(b, items) {
    var hard = 0, sc = 0;
    items.forEach(function (it) {
      var on = it.pts
        ? it.pts.some(function (q) {
            return inBox(box(b.x0 - it.pad, b.y0 - it.pad, b.x1 + it.pad, b.y1 + it.pad), q);
          })
        : hit(b, it.box);
      if (on) { if (!it.soft) hard++; sc += it.w; }
    });
    return { box: b, hard: hard, score: sc };
  }

  function place(w, h, u, W, H, items) {
    var e = 14 * u, top = 16 * u, best = null;
    function take(s) {
      if (!best || s.hard < best.hard || (s.hard === best.hard && s.score < best.score)) best = s;
    }
    [["b", "l"], ["t", "l"], ["b", "r"], ["t", "r"]].forEach(function (c) {
      var x0 = c[1] === "l" ? e : W - e - w, y0 = c[0] === "t" ? top : H - e - h;
      take(score(box(x0, y0, x0 + w, y0 + h), items));
    });
    if (!best.hard) return best;
    /* No clean corner: slide along each edge, as the key box does. */
    for (var t = 0; t <= 1.0001; t += 0.05) {
      var xs = e + (W - 2 * e - w) * t, ys = top + (H - e - h - top) * t;
      take(score(box(xs, top, xs + w, top + h), items));
      take(score(box(xs, H - e - h, xs + w, H - e), items));
      take(score(box(e, ys, e + w, ys + h), items));
      take(score(box(W - e - w, ys, W - e, ys + h), items));
    }
    return best;
  }

  function path(ctx, geom, q) {
    var polys = geom.type === "Polygon" ? [geom.coordinates]
      : geom.type === "MultiPolygon" ? geom.coordinates : [];
    polys.forEach(function (poly) {
      poly.forEach(function (ring) {
        ring.forEach(function (c, i) {
          var v = q(c[0], c[1]);
          if (i) ctx.lineTo(v[0], v[1]); else ctx.moveTo(v[0], v[1]);
        });
        ctx.closePath();
      });
    });
  }
  function each(fc, fn) { ((fc && fc.features) || []).forEach(function (f) { if (f && f.geometry) fn(f.geometry); }); }

  function paint(ctx, P, u, W, H, map, taken) {
    var G = geo();
    if (!map || map.tab !== "report" || !CUR || CUR.map !== map || !G || !G.yem_adm0) return null;
    var p = CUR.p, ext = p && p.extent;
    if (!ext || ext.lon[1] - ext.lon[0] >= CLOSE_DEG) return null;
    var k = u > 0 ? u : 1;
    var cos = Math.cos((VIEW.lat[0] + VIEW.lat[1]) / 2 * Math.PI / 180);
    var w = Math.max(MIN_W, FRAC * W);
    var s = w / ((VIEW.lon[1] - VIEW.lon[0]) * cos), h = (VIEW.lat[1] - VIEW.lat[0]) * s;
    /* Marks are floored in CSS px (a pin does not shrink with the canvas). */
    var at = place(w, h, k, W, H, obstacles(p, Math.max(k, 1), map, taken, G));
    var b = at.box;
    if (at.hard) {
      console.warn("dossier map locator: " + (map.id || "?") + " at " + Math.round(W) +
        "px found no free spot; the least covered one covers " + at.hard);
    }
    function q(lon, lat) { return [b.x0 + (lon - VIEW.lon[0]) * cos * s, b.y0 + (VIEW.lat[1] - lat) * s]; }
    var r = 5 * k;
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(b.x0, b.y0, w, h, r); else ctx.rect(b.x0, b.y0, w, h);
    ctx.fillStyle = P.sea || "#C9DAEA";
    ctx.fill();
    ctx.clip();
    ctx.beginPath();
    path(ctx, G.sau_adm0.features[0].geometry, q);
    each(G.nbr_adm0, function (g) { path(ctx, g, q); });
    ctx.fillStyle = P.land || "#F4F7FA";
    ctx.fill();
    ctx.lineWidth = Math.max(0.6, 0.6 * k);
    ctx.strokeStyle = NBR_LINE;
    ctx.stroke();
    ctx.beginPath();
    each(G.yem_adm0, function (g) { path(ctx, g, q); });
    ctx.fillStyle = YEM;
    ctx.fill();
    ctx.lineWidth = Math.max(1, 1.1 * k);
    ctx.lineJoin = "round";
    ctx.strokeStyle = YEM_LINE;
    ctx.stroke();
    /* This picture's frame. */
    var a = q(ext.lon[0], ext.lat[1]), z = q(ext.lon[1], ext.lat[0]);
    ctx.strokeStyle = RED;
    ctx.fillStyle = RED;
    if (Math.min(z[0] - a[0], z[1] - a[1]) < DOT_MIN * k) {
      ctx.beginPath();
      ctx.arc((a[0] + z[0]) / 2, (a[1] + z[1]) / 2, 4 * k, 0, 2 * Math.PI);
      ctx.fill();
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(208, 2, 27, 0.14)";
      ctx.fillRect(a[0], a[1], z[0] - a[0], z[1] - a[1]);
      ctx.lineWidth = Math.max(1.5, 2 * k);
      ctx.strokeRect(a[0], a[1], z[0] - a[0], z[1] - a[1]);
    }
    ctx.restore();
    /* The inset's own frame: a light rim and a thin line, so it reads as an inset. */
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(b.x0, b.y0, w, h, r); else ctx.rect(b.x0, b.y0, w, h);
    ctx.lineWidth = Math.max(3, 3 * k);
    ctx.strokeStyle = P.box || "#FFFFFF";
    ctx.stroke();
    ctx.lineWidth = Math.max(1, 1 * k);
    ctx.strokeStyle = P.boxLine || "rgba(20, 40, 60, 0.30)";
    ctx.stroke();
    ctx.restore();
    var pad = 2 * k;
    var out = box(b.x0 - pad, b.y0 - pad, b.x1 + pad, b.y1 + pad);
    out.ink = "locator inset";
    if (taken) taken.push(out);
    return out;
  }
  return { paint: paint };
})();
window.DossierMapLocator = DossierMapLocator;
