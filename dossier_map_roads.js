/* ROAD AXES - an assessed axis drawn ON the road it would actually travel.

   The four Aden axes were straight-ish curves through a handful of gazetteer
   towns, damped so they could not bow off their own chord (DOSSIER_MAPS.md,
   "Arrows - the assessment map"). An axis of advance on the ground moves on the
   road network or it does not move, so the record now carries the ROUTED path -
   a hundred-odd points snapped to the OSM roads - and a `road: true` flag. A
   routed path must be drawn AS IT IS: the quadratic damping that saved a
   hand-authored chord from crossing a bay would now pull the line off the very
   road it was routed along, so nothing here bows anything.

   What a road axis looks like, and why:

     DOTS, not a line. A solid red band over a road reads as a road the map is
     drawing; a string of dots reads as movement ALONG something already there.
     Two dashed passes, halo under red, the same red the fighting diamonds and
     the older axes take - this answers the same question one step into the
     future and is not a new hue.
     A FULL HEAD at the end (the Aden end for three of them; the Kirsh axis
     stops at al-Anad and feeds the Lahj one), and small heads along the way so
     a reader entering the picture in the middle still knows which way it runs.
     A NAME PLATE at an authored point, with a leader back to the road. The old
     perpendicular `axisLabel` rode the middle of its own line; on a routed path
     the middle of the line is wherever the road happens to bend, and the name
     has to stand where the frame has room - so the record says where, the same
     way a sea route's name does (dossier_map_route_label.js, placement 3).

   NO ES modules - the page runs from file://. One global:

     window.DossierMapRoads = { arrows }

   It is listed LAST in dossier_map.js's painters, so this `arrows` is the one
   the map calls, with the SAME signature DossierMapExtra.arrows has. An arrow
   WITHOUT `road` is handed straight back to that file: the older axes are
   unchanged, down to the pixel, because they are still drawn by the code that
   drew them. Every string painted here is Hebrew and comes from the data. */
"use strict";

var DossierMapRoads = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_roads: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }
  /* The plain axes stay with their own painter, and the callout leader is
     borrowed from it rather than copied - one halo-under-ink leader serves the
     fighting notes and these plates alike. */
  function X() {
    if (!window.DossierMapExtra) {
      throw new Error("dossier_map_roads: dossier_map_extra.js is not on the page");
    }
    return window.DossierMapExtra;
  }
  /* One definition of "does this box fit", shared with every route name and
     every zone name on the picture. */
  function L() {
    if (!window.DossierMapRouteLabel) {
      throw new Error("dossier_map_roads: dossier_map_route_label.js is not on the page");
    }
    return window.DossierMapRouteLabel;
  }

  /* ---- the dots ------------------------------------------------------------- */

  /* paintShape rounds every cap, so a dash of very nearly no length paints a
     round dot of exactly the stroke's width: 5u of red over 8u of halo is a
     10px dot inside a 16px casing on a 2560px slide, and 8px inside 13px on the
     2048px square. The gap is the PERIOD - 13u, so 26px and 21px - which on the
     Mocha-Aden road puts about eleven dots in every 100 km. Close enough to
     read as one axis, open enough that it never fills in as a line. */
  var DOT_W = 5, DOT_HALO = 8, DOT_GAP = 13;
  /* A head every 140px at BASE_W: on the widest frame that is a direction mark
     roughly every fifth dot, and on the 640px pane about every third. */
  var HEAD_EVERY = 140;
  /* How far back along the road the angle is read. A routed path has segments
     of a pixel or two, so the previous VERTEX says which way that one bend
     went, not which way the axis is going: the older painter could take its
     angle from the last segment because its segments were legs between towns.
     8u is about a third of a dot period - short enough to follow a real corner,
     long enough that surveying noise cannot turn a head round. */
  var HEAD_BACK = 8;
  var HEAD_LEN = 14, HEAD_HALF = 7;
  /* A mid-path head says direction; it must not read as an endpoint, so it is
     drawn smaller than the one that ends the axis. */
  var MID_HEAD = 0.62;
  /* The last stretch belongs to the full head - a small head crowding it would
     read as a double arrow. */
  var HEAD_CLEAR = 30;

  function poly(ctx, pts) {
    ctx.beginPath();
    pts.forEach(function (q, i) {
      if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
    });
  }

  /* The projected path with its zero-length steps dropped: a routed path
     repeats a point wherever two legs were stitched, and a repeat is a segment
     with no direction at all. */
  function project(p, path) {
    var out = [];
    (path || []).forEach(function (c) {
      if (!c || c.length < 2) return;
      var q = p(c[0], c[1]);
      var last = out[out.length - 1];
      if (last && Math.abs(last[0] - q[0]) < 0.01 && Math.abs(last[1] - q[1]) < 0.01) return;
      out.push(q);
    });
    return out;
  }

  /* Cumulative pixel length at every vertex, so a distance along the drawn line
     can be turned into a point without walking the path again each time. */
  function runs(pts) {
    var d = [0], i;
    for (i = 1; i < pts.length; i++) {
      d[i] = d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return d;
  }
  function atDist(pts, d, s) {
    var total = d[d.length - 1];
    if (!(total > 0)) return pts[0];
    s = Math.max(0, Math.min(total, s));
    var lo = 0, hi = pts.length - 1, mid;
    while (lo < hi - 1) {
      mid = (lo + hi) >> 1;
      if (d[mid] <= s) lo = mid; else hi = mid;
    }
    var leg = d[hi] - d[lo], t = leg ? (s - d[lo]) / leg : 0;
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t,
            pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t];
  }

  /* A filled head at distance `s` along the road, pointing the way the road
     runs there - read from a point HEAD_BACK*u behind it, never from the
     previous vertex. */
  function head(ctx, P, u, pts, d, s, k) {
    var to = atDist(pts, d, s), from = atDist(pts, d, s - HEAD_BACK * u);
    var dx = to[0] - from[0], dy = to[1] - from[1];
    if (!dx && !dy) return;
    var len = HEAD_LEN * u * k, half = HEAD_HALF * u * k;
    ctx.save();
    ctx.translate(to[0], to[1]);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-len, -half); ctx.lineTo(-len, half);
    ctx.closePath();
    D().paintShape(ctx, { fill: P.frontMark, stroke: P.halo,
      width: Math.max(1, 1.2 * u) });
    ctx.restore();
  }

  function road(ctx, P, u, pts) {
    var R = D(), dash = [0.01, DOT_GAP * u];
    poly(ctx, pts);
    R.paintShape(ctx, { stroke: P.halo, width: DOT_HALO * u, dash: dash });
    poly(ctx, pts);
    R.paintShape(ctx, { stroke: P.frontMark, width: DOT_W * u, dash: dash });
    var d = runs(pts), total = d[d.length - 1];
    var step = HEAD_EVERY * u, s;
    for (s = step; s < total - HEAD_CLEAR * u; s += step) head(ctx, P, u, pts, d, s, MID_HEAD);
    head(ctx, P, u, pts, d, total, 1);
  }

  /* ---- the name plate ------------------------------------------------------- */

  var PLATE_R = 6, PAD_X = 8, PAD_Y = 5, PLATE_LINE = 1.2, PLATE_H = 1.28;
  /* Where the plate may go when its own point is taken: the authored point
     first, then rings out from it. The rings are px at BASE_W. */
  var RING = [0, 26, 44, 66, 92, 124], DIRS = 12;

  function roundRect(ctx, b, r) {
    var w = b.x1 - b.x0, h = b.y1 - b.y0;
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(b.x0 + r, b.y0);
    ctx.lineTo(b.x1 - r, b.y0); ctx.quadraticCurveTo(b.x1, b.y0, b.x1, b.y0 + r);
    ctx.lineTo(b.x1, b.y1 - r); ctx.quadraticCurveTo(b.x1, b.y1, b.x1 - r, b.y1);
    ctx.lineTo(b.x0 + r, b.y1); ctx.quadraticCurveTo(b.x0, b.y1, b.x0, b.y1 - r);
    ctx.lineTo(b.x0, b.y0 + r); ctx.quadraticCurveTo(b.x0, b.y0, b.x0, b.y0 + r);
    ctx.closePath();
  }

  /* The nearest point of the drawn road to (x, y) - along the segments and not
     at the vertices, so the leader meets the road where it actually passes
     closest. */
  function nearestOn(pts, x, y) {
    var best = null, i, a, b, dx, dy, l2, t, qx, qy, dd;
    for (i = 1; i < pts.length; i++) {
      a = pts[i - 1]; b = pts[i];
      dx = b[0] - a[0]; dy = b[1] - a[1]; l2 = dx * dx + dy * dy;
      t = l2 ? ((x - a[0]) * dx + (y - a[1]) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      qx = a[0] + dx * t; qy = a[1] + dy * t;
      dd = Math.hypot(qx - x, qy - y);
      if (!best || dd < best.d) best = { x: qx, y: qy, d: dd };
    }
    return best;
  }

  function spotFor(q, w, h, u, taken, W, H) {
    var Lb = L(), pad = 10 * u, found = null;
    var clamp = function (cx, cy) {
      return Lb.boxAt(Math.min(Math.max(cx, w / 2 + pad), W - w / 2 - pad),
                      Math.min(Math.max(cy, h / 2 + pad), H - h / 2 - pad), w, h);
    };
    RING.some(function (r) {
      var n = r ? DIRS : 1, i, a, s;
      for (i = 0; i < n; i++) {
        a = (i / n) * Math.PI * 2;
        s = clamp(q[0] + Math.cos(a) * r * u, q[1] + Math.sin(a) * r * u);
        if (Lb.free(s.box, taken, W, H, pad)) { found = s; return true; }
      }
      return false;
    });
    /* Clamped and printed anyway if every ring is taken: the plate is the only
       word saying which road this is, and a name nobody can place is still
       worth more than an unnamed axis. */
    return found || clamp(q[0], q[1]);
  }

  function plate(ctx, P, u, str, at, pts, size, taken, W, H, p) {
    var R = D(), q = p(at.lon, at.lat);
    var w = R.width(ctx, str, size, 700) + 2 * PAD_X * u;
    var h = size * PLATE_H + 2 * PAD_Y * u;
    var spot = spotFor(q, w, h, u, taken, W, H);
    var tgt = nearestOn(pts, spot.x, spot.y);
    /* A road passing under the plate needs no leader - the words are already on
       it, and a stub drawn inside its own box reads as a stray mark. */
    if (tgt && !(tgt.x >= spot.box.x0 && tgt.x <= spot.box.x1 &&
                 tgt.y >= spot.box.y0 && tgt.y <= spot.box.y1)) {
      var g = [Math.max(spot.box.x0, Math.min(tgt.x, spot.box.x1)),
               Math.max(spot.box.y0, Math.min(tgt.y, spot.box.y1)), tgt.x, tgt.y];
      var kit = X().kit;
      if (kit && kit.leader) {
        kit.leader(ctx, P, u, g);
      } else {
        ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(g[2], g[3]);
        R.paintShape(ctx, { stroke: P.halo, width: Math.max(3, 3.5 * u) });
        ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(g[2], g[3]);
        R.paintShape(ctx, { stroke: P.ink, width: Math.max(1.5, 1.5 * u) });
      }
    }
    roundRect(ctx, spot.box, PLATE_R * u);
    R.paintShape(ctx, { fill: P.halo, stroke: P.frontMark,
      width: Math.max(1, PLATE_LINE * u) });
    /* The plate IS the halo, so the text carries none of its own. */
    ctx.direction = "rtl";
    R.text(ctx, P, str, spot.x, spot.y, { size: size, weight: 700, halo: 0 });
    taken.push(spot.box);
  }

  /* ---- the painter ---------------------------------------------------------- */

  /* The same signature DossierMapExtra.arrows has, because dossier_map.js calls
     whichever of the two the painter merge left on top and must not know which.
     Order of the three passes: the roads' dots go down first, then the plain
     axes with their own names (which register their boxes), then the plates,
     which are the biggest blocks on the picture and so are placed against
     everything already standing. */
  function arrows(ctx, p, P, u, ts, map, taken, W, H) {
    var list = (map && map.arrows) || [];
    if (!list.length) return;
    var roads = list.filter(function (a) { return !!a.road; });
    var plain = list.filter(function (a) { return !a.road; });
    var drawn = [];
    roads.forEach(function (a) {
      var pts = project(p, a.path);
      if (pts.length < 2) return;
      road(ctx, P, u, pts);
      drawn.push({ a: a, pts: pts });
    });
    if (plain.length) {
      var sub = {};
      Object.keys(map).forEach(function (k) { sub[k] = map[k]; });
      sub.arrows = plain;
      X().arrows(ctx, p, P, u, ts, sub, taken, W, H);
    }
    /* The reading floor every name on these maps keeps, and NOT the 0.85 the
       old perpendicular axis label took: that factor bought room beside a line
       the name had to dodge, and a plate stands in its own box. */
    var size = Math.max(17, 17 * u * ts);
    drawn.forEach(function (r) {
      if (r.a.plate_he && r.a.plate_at) {
        plate(ctx, P, u, r.a.plate_he, r.a.plate_at, r.pts, size, taken, W, H, p);
      }
    });
  }

  return { arrows: arrows };
})();

window.DossierMapRoads = DossierMapRoads;
