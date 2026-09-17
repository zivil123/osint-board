/* Sea routes, straight-line measures, reported and assessed zones, the place
   markers a label may choose, and the scale bar every terrain map carries.

   Added 2026-09-17 with the first maps drawn ON the terrain: the crossing from
   the port of Mocha to Djibouti, the threats reported at the strait, and the
   objectives a Houthi officer declared in Marib. Those three needed four things
   no dossier map had ever drawn - a sailing route with its length, a straight
   line with the direct distance, a hatched area that says "reported" or
   "assessed", and a bar saying how far a centimetre is - so they live here
   rather than growing dossier_map_extra.js past its cap.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapRoutes = { mapUnder, mapOver, mark, markClear, legendRows }

   dossier_map.js owns the frames, the projection and the palette and calls in
   here at paint time, exactly as it calls the other three painter files; the
   shared helpers come from DossierMapDraw, looked up on each call so the files
   may load in any order.

   EVERY PAINTED STRING IS HEBREW AND DIGITS. A distance reads
   'כ-192 ק"מ / 104 מייל ימי' - the build refuses a Latin letter in any map
   string, so there is no "km" and no "NM" on a canvas anywhere. And the numbers
   are COMPUTED here, by haversine along the authored path, never authored: a
   distance typed into the record is a distance nobody can check, and the path
   it is meant to describe is right there. */
"use strict";

var DossierMapRoutes = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_routes: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  var R_EARTH = 6371.0088;        /* mean radius, km */
  var KM_PER_DEG = 111.32;        /* one degree of LATITUDE - the projector's scale */
  var KM_PER_NM = 1.852;
  /* The words this layer prints in the legend. They live beside the drawings
     they name, the way dossier_map.js keeps its own words beside the palette. */
  var HE = {
    km: 'ק"מ', nm: "מייל ימי",
    objective: "יעד שהוכרז", heights: "רכס הררי", port: "נמל",
    lane: "נתיב שיט ראשי", coastal: "נתיב חופי", measure: "מרחק בקו ישר",
    reported: "אזור שדווח", assessed: "אזור משוער (הערכה)",
    claim: "טענה, ללא אימות עצמאי"
  };

  /* ---- distance ------------------------------------------------------------ */

  function haversine(a, b) {
    var rad = Math.PI / 180;
    var dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a[1] * rad) * Math.cos(b[1] * rad) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function pathKm(path) {
    var km = 0;
    for (var i = 1; i < (path || []).length; i++) km += haversine(path[i - 1], path[i]);
    return km;
  }
  /* Both units, because this map answers a sailing question and a map question
     at once: kilometres for the reader and nautical miles for the sea. */
  function distLabel(km) {
    return "כ-" + Math.round(km) + " " + HE.km + " / " +
      Math.round(km / KM_PER_NM) + " " + HE.nm;
  }
  /* Pixels per kilometre on this canvas. The projector is linear in latitude,
     so one degree of it IS the scale, and every length written in kilometres -
     a zone's radius, the scale bar - means the same thing on a 640px pane and
     on a 2560px slide. Same conversion the arrows' bow cap uses. */
  function kmPx(p) { return Math.abs(p(0, 0)[1] - p(0, 1)[1]) / KM_PER_DEG; }

  /* ---- the marker a label may ask for -------------------------------------- */

  /* A label may name what KIND of place it is, and the mark follows: a declared
     objective is a filled square, a ridge a summit triangle, a port a ring, and
     anything else keeps the town dot exactly as it has been drawn since
     2026-09-14. No new hue - every one of these is the ink over a halo disc, and
     the legend says in words which is which (design-law: colour, and shape, never
     carry meaning alone). A dark plate behind the NAME was the other candidate
     and was not taken: nine filled boxes over terrain is a painted field, which
     design-law bans, and the halo the names already carry does the same work. */
  var SCALE = { objective: 1.7, heights: 1.9, port: 1.7 };

  function markClear(pinR, kind) { return pinR * (SCALE[kind] || 1); }

  function square(ctx, x, y, r, style) {
    ctx.beginPath();
    ctx.rect(x - r, y - r, r * 2, r * 2);
    D().paintShape(ctx, style);
  }
  function triangle(ctx, x, y, r, style) {
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.15);
    ctx.lineTo(x + r * 1.1, y + r * 0.8);
    ctx.lineTo(x - r * 1.1, y + r * 0.8);
    ctx.closePath();
    D().paintShape(ctx, style);
  }
  /* `r` is the FINAL radius - dossier_map.js has already run it through
     markClear, so the name's own gap and the mark can never disagree. */
  function mark(ctx, P, x, y, r, u, kind) {
    var R = D(), lift = Math.max(1, 1.2 * u);
    if (kind === "heights") {
      triangle(ctx, x, y, r + lift, { fill: P.halo });
      triangle(ctx, x, y, r, { fill: P.ink });
    } else if (kind === "port") {
      R.ringMark(ctx, x, y, r + lift, { fill: P.halo });
      R.ringMark(ctx, x, y, r * 0.8, { stroke: P.ink, width: Math.max(1.4, 1.5 * u) });
    } else if (kind === "objective") {
      square(ctx, x, y, r + lift, { fill: P.halo });
      square(ctx, x, y, r, { fill: P.ink });
    } else {
      R.ringMark(ctx, x, y, r, { fill: P.halo });
      R.ringMark(ctx, x, y, r * 0.62, { fill: P.ink });
    }
  }

  /* ---- zones --------------------------------------------------------------- */

  /* A SECOND hatch, and it may never be read as the fighting one. The fronts
     take 45-degree lines in the contested stroke; this takes 135 degrees at a
     wider pitch in the muted ink, so the two are told apart by ANGLE, PITCH and
     shade at once - texture again, never a new hue (DOSSIER_MAPS.md). */
  function zoneHatch(ctx, color, u) {
    var n = Math.max(9, Math.round(17 * u)), c = document.createElement("canvas");
    c.width = c.height = n;
    var g = c.getContext("2d");
    g.strokeStyle = color; g.lineWidth = Math.max(1, 1.2 * u); g.lineCap = "square";
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(n, n);
    g.moveTo(-1, n - 1); g.lineTo(1, n + 1);
    g.moveTo(n - 1, -1); g.lineTo(n + 1, 1);
    g.stroke();
    return ctx.createPattern(c, "repeat");
  }
  /* The ring's radius is the AUTHORED one in kilometres - the explicit
     radius_km if the record carries it, otherwise the gazetteer's own for that
     area key. A floor keeps a small area visible on the country frame. */
  function zoneR(z, per, u) {
    return Math.max(7 * u, (z.radius_km || 0) * per);
  }
  /* REPORTED takes a solid edge and ASSESSED a dotted one: a dated open report
     with a link is a different claim from an analyst's view, and the map says
     which without a second colour. */
  function zoneEdge(z, P, u) {
    return { stroke: P.muted, width: Math.max(1.4, 2 * u),
             dash: z.kind === "assessed" ? [2.5 * u, 3.5 * u] : [] };
  }

  /* ---- routes and measures -------------------------------------------------- */

  /* A LANE is the through route and a COASTAL one the small-boat passage, and
     the only difference drawn is weight: both are the ink over a halo, because
     a second colour here would be a hue nobody asked for and the legend already
     names them. */
  var ROUTE_W = { lane: 3.4, coastal: 2.0 };
  var HEAD_GAP = 100;             /* px at BASE_W between arrowheads along a route */

  function poly(ctx, pts) {
    ctx.beginPath();
    pts.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
  }
  function arrowHead(ctx, P, u, from, to, size) {
    var ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
    ctx.save();
    ctx.translate(to[0], to[1]); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-size, -size * 0.52); ctx.lineTo(-size, size * 0.52);
    ctx.closePath();
    D().paintShape(ctx, { fill: P.ink, stroke: P.halo, width: Math.max(1, 1.2 * u) });
    ctx.restore();
  }
  /* Heads AT A FIXED PIXEL PITCH along the drawn line, not one per authored
     leg: a route's waypoints are wherever the channel bends, so one head per leg
     would cluster them at the bends and leave the long stretches bare. */
  function heads(ctx, P, u, pts, size) {
    var gap = HEAD_GAP * u, run = gap, i, seg, len, t;
    for (i = 1; i < pts.length; i++) {
      seg = [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]];
      len = Math.hypot(seg[0], seg[1]);
      while (run <= len) {
        t = run / len;
        arrowHead(ctx, P, u, pts[i - 1],
          [pts[i - 1][0] + seg[0] * t, pts[i - 1][1] + seg[1] * t], size);
        run += gap;
      }
      run -= len;
    }
    arrowHead(ctx, P, u, pts[pts.length - 2], pts[pts.length - 1], size);
  }

  /* ---- what goes UNDER the pins --------------------------------------------- */

  /* The shapes, drawn with the ground: a zone's hatch, a route's line and a
     measure's dashed line all belong under the town dots and under every name,
     so a pin is never buried by a line that merely passes through its port. */
  function mapUnder(ctx, p, P, u, map) {
    var R = D(), m = map || {}, per = kmPx(p);
    var zones = m.zones || [], hatch = zones.length ? zoneHatch(ctx, P.muted, u) : null;
    zones.forEach(function (z) {
      var q = p(z.lon, z.lat), r = zoneR(z, per, u);
      R.ringMark(ctx, q[0], q[1], r, { fill: hatch });
      R.ringMark(ctx, q[0], q[1], r, zoneEdge(z, P, u));
    });
    (m.measure || []).forEach(function (mm) {
      var pts = (mm.path || []).map(function (c) { return p(c[0], c[1]); });
      if (pts.length < 2) return;
      poly(ctx, pts);
      R.paintShape(ctx, { stroke: P.halo, width: Math.max(4, 5 * u) });
      poly(ctx, pts);
      R.paintShape(ctx, { stroke: P.muted, width: Math.max(1.2, 1.7 * u),
        dash: [7 * u, 5 * u] });
    });
    (m.routes || []).forEach(function (rt) {
      var pts = (rt.path || []).map(function (c) { return p(c[0], c[1]); });
      if (pts.length < 2) return;
      var w = (ROUTE_W[rt.kind] || 2.4) * u;
      poly(ctx, pts);
      R.paintShape(ctx, { stroke: P.halo, width: w + 4 * u });
      poly(ctx, pts);
      R.paintShape(ctx, { stroke: P.ink, width: w });
      heads(ctx, P, u, pts, Math.max(6, (rt.kind === "lane" ? 10 : 8) * u));
    });
  }

  /* ---- what goes OVER them --------------------------------------------------- */

  function boxAt(cx, cy, w, h) {
    return { x: cx, y: cy,
             box: { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 } };
  }
  function free(b, taken, W, H) {
    var R = D();
    return b.x0 >= 0 && b.x1 <= W && b.y0 >= 0 && b.y1 <= H &&
      !taken.some(function (t) { return R.overlaps(b, t); });
  }
  /* A point at fraction `t` of the path's OWN length, with the unit normal of
     the leg it lands on. By length and not by vertex index: a route's waypoints
     sit wherever the channel bends, so the middle vertex is rarely the middle
     of the line. */
  function along(pts, t) {
    var d = [0], total = 0, i, k, dx, dy, run = 0;
    for (i = 1; i < pts.length; i++) {
      d[i] = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      total += d[i];
    }
    for (i = 1; i < pts.length; i++) {
      if (run + d[i] >= total * t || i === pts.length - 1) {
        k = d[i] ? Math.max(0, Math.min(1, (total * t - run) / d[i])) : 0;
        dx = pts[i][0] - pts[i - 1][0]; dy = pts[i][1] - pts[i - 1][1];
        return { x: pts[i - 1][0] + dx * k, y: pts[i - 1][1] + dy * k,
                 nx: -dy / (d[i] || 1), ny: dx / (d[i] || 1) };
      }
      run += d[i];
    }
    return { x: pts[0][0], y: pts[0][1], nx: 0, ny: -1 };
  }

  /* A block of one or two lines beside the path, pushed off it on whichever
     side is free - the arrows' own bargain (dossier_map_extra.js), but searched
     ALONG the line as well as across it. Across alone was measured on the first
     fixture: a route and the straight line beside it share a midpoint, six
     perpendicular offsets were all taken, and both fell through to the clamp and
     printed over each other and over a town name. A clamp rather than a drop is
     still right at the end - the distance IS what this map is for. */
  var ALONG = [0.5, 0.38, 0.62, 0.26, 0.74, 0.14, 0.86, 0.06, 0.94];
  var ACROSS = [1, -1, 2, -2, 3.2, -3.2, 4.6, -4.6, 6.4, -6.4, 8.6, -8.6, 11, -11];

  function pathLabel(ctx, P, u, lines, pts, size, taken, W, H) {
    var R = D();
    lines = lines.filter(Boolean);
    if (!lines.length || pts.length < 2) return;
    var lineH = size * 1.28, w = 0, spot = null, off = 17 * u;
    lines.forEach(function (s) { w = Math.max(w, R.width(ctx, s, size, 600)); });
    w += 8 * u;
    var h = lines.length * lineH;
    ALONG.some(function (t) {
      var a = along(pts, t);
      return ACROSS.some(function (k) {
        var s = boxAt(a.x + a.nx * off * k, a.y + a.ny * off * k, w, h);
        if (free(s.box, taken, W, H)) spot = s;
        return !!spot;
      });
    });
    if (!spot) {
      var a0 = along(pts, 0.5);
      spot = boxAt(Math.min(Math.max(a0.x + a0.nx * off, w / 2), W - w / 2),
                   Math.min(Math.max(a0.y + a0.ny * off, h / 2), H - h / 2), w, h);
    }
    lines.forEach(function (s, i) {
      R.text(ctx, P, s, spot.x, spot.box.y0 + (i + 0.5) * lineH,
        { size: size, weight: i ? 500 : 600, halo: 4 * u, color: i ? P.muted : null });
    });
    taken.push(spot.box);
  }

  /* A zone names itself INSIDE its ring when the ring can hold the name and
     beside it when it cannot - the same bargain the plain picture's fighting
     zones make (dossier_map_legend.js). Three rings of four sides are tried
     before it is dropped, and dropping is honest here: the hatch and the legend
     still say what the shape is. */
  function zoneLabels(ctx, p, P, u, list, taken, W, H, size) {
    var R = D(), per = kmPx(p);
    (list || []).forEach(function (z) {
      if (!z.label_he) return;
      var q = p(z.lon, z.lat), r = zoneR(z, per, u), spot = null;
      var w = R.width(ctx, z.label_he, size, 500) + 6 * u, h = size * 1.3, cands = [];
      if (2 * r >= w * 1.05) cands.push([q[0], q[1]]);
      [0, 1, 2, 3, 4].forEach(function (ring) {
        var d = r + (5 + ring * 20) * u, k = 0.72;
        cands.push([q[0], q[1] - d - h / 2], [q[0], q[1] + d + h / 2],
                   [q[0] + d + w / 2, q[1]], [q[0] - d - w / 2, q[1]],
                   [q[0] + (d + w / 2) * k, q[1] - (d + h / 2) * k],
                   [q[0] - (d + w / 2) * k, q[1] - (d + h / 2) * k],
                   [q[0] + (d + w / 2) * k, q[1] + (d + h / 2) * k],
                   [q[0] - (d + w / 2) * k, q[1] + (d + h / 2) * k]);
      });
      cands.some(function (c) {
        var s = boxAt(c[0], c[1], w, h);
        if (free(s.box, taken, W, H)) spot = s;
        return !!spot;
      });
      if (!spot) return;
      R.text(ctx, P, z.label_he, spot.x, spot.y, { size: size, weight: 500, halo: 3 * u });
      taken.push(spot.box);
    });
  }

  /* ---- the scale bar ---------------------------------------------------------- */

  /* A terrain map is read for DISTANCE - how far the crossing is, how close the
     ridge stands to the channel - so it says how far a centimetre is. Round
     numbers only, about a sixth of the canvas, and in the corner OPPOSITE the
     legend, which chooses its own corner per render. */
  var NICE = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  var OPPOSITE = { tr: "bl", br: "tl", tl: "br", bl: "tr" };

  function scaleBar(ctx, P, u, W, H, size, per, legend) {
    var R = D(), want = W / 6, km = NICE[0], i;
    for (i = 0; i < NICE.length; i++) { if (NICE[i] * per <= want) km = NICE[i]; }
    var len = km * per;
    if (!(len > 12 * u)) return;
    var at = OPPOSITE[(legend && legend.at) || "tr"] || "bl", inset = 16 * u;
    var x0 = at[1] === "r" ? W - inset - len : inset;
    var y = at[0] === "t" ? inset + size * 2.1 : H - inset;
    var cap = Math.max(4, 5 * u), w = Math.max(2, 2.6 * u);
    var draw = function (style) {
      ctx.beginPath();
      ctx.moveTo(x0, y - cap); ctx.lineTo(x0, y); ctx.lineTo(x0 + len, y);
      ctx.lineTo(x0 + len, y - cap);
      R.paintShape(ctx, style);
    };
    draw({ stroke: P.halo, width: w + 3 * u });
    draw({ stroke: P.ink, width: w });
    R.text(ctx, P, km + " " + HE.km, x0 + len / 2, y - cap - 3 * u,
      { size: size * 0.9, weight: 500, halo: 3 * u, align: "center", baseline: "bottom" });
  }

  /* ZONE NAMES GO DOWN FIRST. A zone has one anchor and a ring of candidates
     round it; a route's name has the whole length of its line to slide along,
     so whoever has fewer choices is placed while the ground is still free -
     the same order the painter already gives the governorate names against the
     fighting zones (dossier_map.js). */
  function mapOver(ctx, p, P, u, map, taken, W, H, size, legend) {
    var m = map || {}, per = kmPx(p);
    zoneLabels(ctx, p, P, u, m.zones, taken, W, H, size);
    (m.routes || []).forEach(function (rt) {
      var pts = (rt.path || []).map(function (c) { return p(c[0], c[1]); });
      if (pts.length >= 2) {
        pathLabel(ctx, P, u, [rt.label_he, distLabel(pathKm(rt.path))], pts, size,
          taken, W, H);
      }
    });
    (m.measure || []).forEach(function (mm) {
      var pts = (mm.path || []).map(function (c) { return p(c[0], c[1]); });
      if (pts.length >= 2) {
        pathLabel(ctx, P, u, [(mm.label_he ? mm.label_he + ": " : "") +
          distLabel(pathKm(mm.path))], pts, size, taken, W, H);
      }
    });
    if (m.ground) scaleBar(ctx, P, u, W, H, size, per, legend);
  }

  /* ---- the legend rows this layer owns ----------------------------------------- */

  /* Handed back to dossier_map_legend.js, which measures the box from them and
     paints each row's own `draw`. A row appears only when the map carries the
     thing it names - a key to something that is not on the picture is noise. */
  function legendRows(ctx, P, u, map) {
    var R = D(), m = map || {}, rows = [], kinds = {}, seen = {};
    (m.labels || []).forEach(function (l) {
      if (l.kind && l.kind !== "town") kinds[l.kind] = true;
    });
    var glyph = function (kind) {
      return function (c, Q, uu, x, cy, sw, sh) {
        mark(c, Q, x + sw / 2, cy, sh * 0.34, uu, kind);
      };
    };
    ["objective", "heights", "port"].forEach(function (k) {
      if (kinds[k]) rows.push({ draw: glyph(k), label: HE[k] });
    });
    (m.zones || []).forEach(function (z) {
      var kind = z.kind === "assessed" ? "assessed" : "reported";
      if (seen[kind]) return;
      seen[kind] = true;
      rows.push({ label: HE[kind], draw: function (c, Q, uu, x, cy, sw, sh) {
        var r = sh * 0.46;
        R.ringMark(c, x + sw / 2, cy, r, { fill: zoneHatch(c, Q.muted, uu) });
        R.ringMark(c, x + sw / 2, cy, r, zoneEdge(z, Q, uu));
      } });
    });
    (m.routes || []).forEach(function (rt) {
      var kind = rt.kind === "coastal" ? "coastal" : "lane";
      if (seen[kind]) return;
      seen[kind] = true;
      rows.push({ label: HE[kind], draw: function (c, Q, uu, x, cy, sw) {
        var head = Math.max(5, 8 * uu);
        c.beginPath(); c.moveTo(x, cy); c.lineTo(x + sw - head, cy);
        R.paintShape(c, { stroke: Q.ink, width: (ROUTE_W[kind] || 2.4) * uu });
        arrowHead(c, Q, uu, [x, cy], [x + sw, cy], head);
      } });
    });
    if ((m.measure || []).length) {
      rows.push({ label: HE.measure, draw: function (c, Q, uu, x, cy, sw) {
        c.beginPath(); c.moveTo(x, cy); c.lineTo(x + sw, cy);
        R.paintShape(c, { stroke: Q.muted, width: Math.max(1.2, 1.7 * uu),
          dash: [7 * uu, 5 * uu] });
      } });
    }
    /* A CLAIM SAYS SO IN THE KEY, not only in the caption. The mark is the
       board's own vocabulary for a claim nobody else carried - hollow and
       dashed, exactly as an uncorroborated pin is drawn on the board map - so
       nothing new has to be learned to read it. */
    if (m.claim) {
      rows.push({ label: HE.claim, draw: function (c, Q, uu, x, cy, sw, sh) {
        R.ringMark(c, x + sw / 2, cy, sh * 0.42,
          { stroke: Q.muted, width: Math.max(1.2, 1.6 * uu), dash: [3 * uu, 3 * uu] });
      } });
    }
    return rows;
  }

  return { mapUnder: mapUnder, mapOver: mapOver, mark: mark,
           markClear: markClear, legendRows: legendRows };
})();

window.DossierMapRoutes = DossierMapRoutes;
