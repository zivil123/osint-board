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
   may load in any order. The zones' own rings, colours, glyphs and key rows
   left for dossier_map_zones.js on 2026-09-17, when a colour per type would
   have taken this file over its cap; it is looked up the same way. WHERE A
   ROUTE'S NAME GOES left for dossier_map_route_label.js the same day, when the
   authored anchor and its leader line would have done the same - this file
   draws the LINES, that one places their WORDS.

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

  /* The rings themselves - their two colours, their hatch, their centre glyph
     and their legend rows - moved to dossier_map_zones.js on 2026-09-17, when
     `type` started choosing a colour and a glyph and this file was 48 lines
     under its cap. What stays here is where a zone's NAME goes, because that
     search shares `boxAt` and `free` with the route labels. */
  function Z() {
    if (!window.DossierMapZones) {
      throw new Error("dossier_map_routes: dossier_map_zones.js is not on the page");
    }
    return window.DossierMapZones;
  }
  /* Where a name STANDS - on a line, beside it, or at an authored point with a
     leader back to the route. Split out the same day and looked up the same
     way; `boxAt` and `free` come back from it so one definition of "does this
     box fit" serves the zone names here and every route name there. */
  function L() {
    if (!window.DossierMapRouteLabel) {
      throw new Error("dossier_map_routes: dossier_map_route_label.js is not on the page");
    }
    return window.DossierMapRouteLabel;
  }

  /* ---- routes and measures -------------------------------------------------- */

  /* A LANE is the through route and a COASTAL one the small-boat passage, and
     the only difference drawn is weight: both are the ink over a halo, because
     a second colour here would be a hue nobody asked for and the legend already
     names them. */
  var ROUTE_W = { lane: 3.4, coastal: 2.0 };
  var HEAD_GAP = 100;             /* px at BASE_W between arrowheads along a route */
  /* A CLEAN MAP DRAWS ITS ROUTE TWICE AS THICK (2026-09-17). Ziv, of the
     Mocha-Djibouti picture: *"make the naval route look bigger."* A plain map
     carries belts, arrows and a line of contact and a route has to sit among
     them; a clean one carries the route and two port names, and at whole-area
     reach - the crossing frame spans twelve degrees of latitude - the line it
     is entirely about was a hairline. The heads, the halo under the line and
     the legend's own swatch all take the same factor, so the key never shows a
     weight the picture does not draw. One number, read by mapUnder and by
     legendRows. */
  var CLEAN_ROUTE = 2;

  function routeK(m) { return m && m.clean ? CLEAN_ROUTE : 1; }
  function routeW(kind, u, k) { return (ROUTE_W[kind] || 2.4) * k * u; }
  function headW(kind, u, k) {
    return Math.max(6 * k, (kind === "lane" ? 10 : 8) * k * u);
  }

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
    if ((m.zones || []).length) Z().draw(ctx, p, P, u, m, per);
    (m.measure || []).forEach(function (mm) {
      var pts = (mm.path || []).map(function (c) { return p(c[0], c[1]); });
      if (pts.length < 2) return;
      poly(ctx, pts);
      R.paintShape(ctx, { stroke: P.halo, width: Math.max(4, 5 * u) });
      poly(ctx, pts);
      R.paintShape(ctx, { stroke: P.muted, width: Math.max(1.2, 1.7 * u),
        dash: [7 * u, 5 * u] });
    });
    var k = routeK(m);
    (m.routes || []).forEach(function (rt) {
      var pts = (rt.path || []).map(function (c) { return p(c[0], c[1]); });
      if (pts.length < 2) return;
      var w = routeW(rt.kind, u, k);
      poly(ctx, pts);
      R.paintShape(ctx, { stroke: P.halo, width: w + 4 * u * k });
      poly(ctx, pts);
      R.paintShape(ctx, { stroke: P.ink, width: w });
      heads(ctx, P, u, pts, headW(rt.kind, u, k));
    });
  }

  /* ---- what goes OVER them --------------------------------------------------- */

  /* A zone names itself INSIDE its ring when the ring can hold the name and
     beside it when it cannot - the same bargain the plain picture's fighting
     zones make (dossier_map_legend.js). Three rings of four sides are tried
     before it is dropped, and dropping is honest here: the hatch and the legend
     still say what the shape is. */
  function zoneLabels(ctx, p, P, u, list, taken, W, H, size) {
    var R = D(), boxAt = L().boxAt, free = L().free, per = kmPx(p);
    (list || []).forEach(function (z) {
      if (!z.label_he) return;
      var q = p(z.lon, z.lat), r = Z().radius(z, per, u), spot = null;
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

  /* It goes down FIRST and reserves its own box (2026-09-17). It used to be
     painted last, after every name, and nothing had told the names it was
     coming: measured on the crossing's whole-area frame, the route's block took
     the corner the legend had left free and the bar was drawn straight through
     it. The bar cannot move - it is pinned to the corner opposite the legend -
     so it is the one that must be placed while the ground is still empty. */
  function scaleBar(ctx, P, u, W, H, size, per, legend, taken) {
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
    var caption = km + " " + HE.km;
    R.text(ctx, P, caption, x0 + len / 2, y - cap - 3 * u,
      { size: size * 0.9, weight: 500, halo: 3 * u, align: "center", baseline: "bottom" });
    if (!taken) return;
    var tw = Math.max(len, R.width(ctx, caption, size * 0.9, 500));
    taken.push({ x0: x0 + len / 2 - tw / 2 - 4 * u, x1: x0 + len / 2 + tw / 2 + 4 * u,
                 y0: y - cap - 3 * u - size * 1.2, y1: y + 4 * u });
  }

  /* ZONE NAMES GO DOWN FIRST. A zone has one anchor and a ring of candidates
     round it; a route's name has the whole length of its line to slide along,
     so whoever has fewer choices is placed while the ground is still free -
     the same order the painter already gives the governorate names against the
     fighting zones (dossier_map.js). */
  function mapOver(ctx, p, P, u, map, taken, W, H, size, legend) {
    var m = map || {}, per = kmPx(p), routes = m.routes || [];
    /* A MAP OF ONE CROSSING SAYS HOW FAR IT IS, once and large. Ziv asked for
       the Mocha-Djibouti picture stripped to a single line with its length
       (2026-09-17), and a lone distance set at the same size as a town name
       reads as a caption to nothing. With two routes on one frame the label is
       kept at the map's own size: there the question is which line is which,
       and two large blocks would be the loudest thing on the picture. */
    var only = routes.length === 1 && !(m.measure || []).length;
    /* A CLEAN map's few names are set larger, by the one factor the place names
       take (dossier_map_draw.js), so the route's own block grows with them
       rather than shrinking beside them. The scale bar and a zone's name are
       left at the map's own size: they are the map's furniture, not its
       subject. */
    var big = m.clean ? D().CLEAN_TEXT : 1;
    if (m.ground) scaleBar(ctx, P, u, W, H, size, per, legend, taken);
    zoneLabels(ctx, p, P, u, m.zones, taken, W, H, size);
    routes.forEach(function (rt) {
      var pts = (rt.path || []).map(function (c) { return p(c[0], c[1]); });
      if (pts.length >= 2) {
        /* `label_at` is an authored point and beats `label_side`; the build
           refuses a route carrying both, so the painter never has to choose. */
        L().pathLabel(ctx, P, u, [rt.label_he, distLabel(pathKm(rt.path))], pts,
          (only ? size * 1.3 : size) * big, taken, W, H, rt.label_side, p,
          rt.label_at);
      }
    });
    (m.measure || []).forEach(function (mm) {
      var pts = (mm.path || []).map(function (c) { return p(c[0], c[1]); });
      if (pts.length >= 2) {
        L().pathLabel(ctx, P, u, [(mm.label_he ? mm.label_he + ": " : "") +
          distLabel(pathKm(mm.path))], pts, size * big, taken, W, H);
      }
    });
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
    /* The zones' own rows - one per TYPE plus the dotted-edge line - are built
       by the file that paints them, for the same reason this file builds these:
       a row carries its own swatch, so nobody has to learn a mark they do not
       own. */
    if ((m.zones || []).length) rows = rows.concat(Z().legendRows(ctx, P, u, m));
    (m.routes || []).forEach(function (rt) {
      var kind = rt.kind === "coastal" ? "coastal" : "lane";
      if (seen[kind]) return;
      seen[kind] = true;
      /* The swatch takes the map's own route weight, clean factor included, so
         the key can never show a thinner line than the picture draws. The head
         follows it but is capped at the swatch's own width: a doubled head in a
         26px box would be a triangle with a stub behind it. */
      rows.push({ label: HE[kind], draw: function (c, Q, uu, x, cy, sw) {
        var kk = routeK(m);
        var head = Math.min(sw * 0.45, Math.max(5 * kk, 8 * kk * uu));
        c.beginPath(); c.moveTo(x, cy); c.lineTo(x + sw - head, cy);
        R.paintShape(c, { stroke: Q.ink, width: routeW(kind, uu, kk) });
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
