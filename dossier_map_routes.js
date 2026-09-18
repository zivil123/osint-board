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
  /* AND THE KILOMETRES ALONE, for a callout that carries nothing else - the
     record asks for it with `units: "km"` (2026-09-18). Ziv, of the crossing:
     *"just write the amount of kilometers."* The same rounded number as the
     line above and as the caption under the picture, never a second one. */
  function kmLabel(km) { return "כ-" + Math.round(km) + " " + HE.km; }
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
  /* Where every WORD on this layer stands - a route's name on its line, beside
     it or at an authored point, the length callout, a zone's name and the scale
     bar's caption - and, since 2026-09-18, the self-check they all report to. */
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
  /* A CLEAN MAP DRAWS ITS ROUTE THICKER (2026-09-17). Ziv, of the
     Mocha-Djibouti picture: *"make the naval route look bigger."* A plain map
     carries belts, arrows and a line of contact and a route has to sit among
     them; a clean one carries the route and two port names, and the line it is
     entirely about was a hairline. The heads, the halo under the line and the
     legend's own swatch all take the same factor, so the key never shows a
     weight the picture does not draw. One number, read by mapUnder and by
     legendRows.

     IT WAS 2 FOR SIX HOURS AND THE LINE THEN TOUCHED THE LAND. Ziv, the same
     day, on the zoomed-in frame: *"show the naval route better, right now it
     touches the land all the way."* At 2 the halo casing is (3.4*2 + 4)*u wide
     - 14.8 px either side of the centre on a 2560 px slide - and the western
     channel between Perim and Ras Siyyan leaves only 13.3 px of water at its
     narrowest, so the casing crossed both shores. At 1.4 it is 10.4 px and the
     line reads as a line IN the water. The path was never the problem: it is
     sampled every kilometre against the coastline and its narrowest open-water
     clearance is 5.9 km. */
  var CLEAN_ROUTE = 1.4;

  /* A DOTTED ROUTE (2026-09-17). Ziv, of the crossing: *"make the naval route
     dotted instead"*, and then, of the string of beads that made: *"make the
     dotted thing less dotted, fewer dots, right now there are too many."* So it
     is a SPARSE DASH - about three stroke widths of ink and two of water. The
     pair written here is [2w, 3w] and not [3w, 2w] because paintShape rounds
     every cap, and a round cap hands half a width back to the dash at each end:
     drawn 2w and 3w, the eye gets 3w of line and 2w of gap. The value is still
     called `dotted` - it is what he calls it. The legend swatch reads this same
     helper, so a key is never solid over a broken line. */
  function dashOf(rt, w) {
    return rt && rt.stroke === "dotted" ? [w * 2, w * 3] : null;
  }
  /* THE LENGTH CALLOUT IS SET SMALLER THAN THE MAP'S OTHER CLEAN TEXT, and that
     is measurement, not taste. At CLEAN_TEXT the one-line block measures 890 px
     on a 2560 px slide - 4.06 deg of an 11.68 deg frame - and the two things it
     must do cross each other: to clear the route to its west it must stand east
     of 45.88E, to stay off the square picture's eastern rim it must stand west
     of 45.30E. At 1.15 the block is 2.92 deg and does both with about 90 px to
     spare, and still reads at arm's length on a slide (59 px). */
  var CALLOUT_TEXT = 1.15;

  function routeK(m) { return m && m.clean ? CLEAN_ROUTE : 1; }
  function routeW(kind, u, k) { return (ROUTE_W[kind] || 2.4) * k * u; }
  function headW(kind, u, k) {
    return Math.max(6 * k, (kind === "lane" ? 10 : 8) * k * u);
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    pts.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
  }
  /* The head's three corners in CANVAS coordinates rather than a rotated
     context: the shape is then something that can be handed back and measured -
     the self-check asks how far it stands off the coast - and not only a mark
     that has already been painted somewhere.
     THE CASING GROWS WITH THE HEAD (2026-09-18): a hairline of halo round a
     28px arrowhead on a slide is nothing, and this head has to read over the
     sea, over the coast stroke and over a port's own white ring. Same device as
     the casing under the line, set off the head's own size, so the legend's
     small swatch keeps its hairline. */
  function headPoly(from, to, size) {
    var a = Math.atan2(to[1] - from[1], to[0] - from[0]), c = Math.cos(a), s = Math.sin(a);
    var at = function (x, y) { return [to[0] + x * c - y * s, to[1] + x * s + y * c]; };
    return [at(0, 0), at(-size, -size * 0.52), at(-size, size * 0.52)];
  }
  function arrowHead(ctx, P, u, from, to, size) {
    var pts = headPoly(from, to, size);
    poly(ctx, pts);
    ctx.closePath();
    D().paintShape(ctx, { fill: P.ink, stroke: P.halo,
      width: Math.max(1, Math.min(3.2, size * 0.09)) });
    return pts;
  }
  /* Heads AT A FIXED PIXEL PITCH along the drawn line, not one per authored leg:
     a route's waypoints are wherever the channel bends, so one head per leg
     would cluster them at the bends and leave the long stretches bare.
     A CLEAN MAP'S ROUTE CARRIES ONE HEAD, AT THE END (2026-09-17). Ziv, of the
     crossing: *"don't put 2 arrows on the route."* A thin route among belts and
     axes needs the repeated head to say which way it runs; a thick line that is
     the whole picture says it once, where it arrives - so `single` skips the
     pitched heads and leaves the final one, handed back for the self-check. */
  function heads(ctx, P, u, pts, size, single) {
    var gap = HEAD_GAP * u, run = gap, i, seg, len, t;
    for (i = 1; !single && i < pts.length; i++) {
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
    return arrowHead(ctx, P, u, pts[pts.length - 2], pts[pts.length - 1], size);
  }

  /* THE WHOLE HEAD SHOWS, AND IT STOPS OFFSHORE (2026-09-18). Ziv, of the
     crossing: *"make that the arrow is not like going straight into the white
     line in Djibouti, make it show the whole arrow."* A route's last point is a
     PORT and a port is ON the coast, so a head drawn at it landed under three
     things painted after the route - the coast stroke, the port's own white pin
     ring and the halo of its name - and what was left read as half an arrow. So
     the head's tip stops this far short of the last point and looks at the port
     across open water. The floor is what the pin needs on a small canvas: a
     port mark is 1.7 pin radii, and that radius has a 3px floor (dossier_map.js). */
  var TIP_CLEAR = 16;

  function tipShort(pts, back) {
    var out = pts.slice(), q, d, i;
    for (i = out.length - 1; i > 0; i--) {
      q = [out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]];
      d = Math.hypot(q[0], q[1]);
      if (d > back) {
        out[i] = [out[i][0] - q[0] * back / d, out[i][1] - q[1] * back / d];
        return out;
      }
      back -= d;
      out.pop();
    }
    return pts;
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
      var w = routeW(rt.kind, u, k), dash = dashOf(rt, w);
      /* Two cuts, not one: the HEAD's tip stops `clear` short of the port and
         the INK a stroke width further back, because a round cap hands half a
         width back and drawn to the tip it poked out of the point as a whisker.
         Both cuts land inside the head, so no gap shows. And the tip never
         passes the last BEND - pulled round the corner onto the leg before it,
         the arrow stops pointing at the place it arrives at. */
      var end = pts[pts.length - 1], was = pts[pts.length - 2];
      var clear = Math.min(Math.max(9, TIP_CLEAR * u),
        0.9 * Math.hypot(end[0] - was[0], end[1] - was[1]));
      var tip = tipShort(pts, clear);
      pts = tipShort(pts, clear + w);
      poly(ctx, pts);
      /* THE CASING DOES NOT TAKE THE CLEAN FACTOR (2026-09-17). It is there so
         the line reads over terrain, and 4*u either side does that at any
         weight; multiplying it by the clean factor as well put 14.8 px of white
         either side of the centre on a 2560 px slide, and the western channel
         at its narrowest leaves 13.3 px of water - so the casing, not the line,
         was what sat on both shores. Ziv: *"right now it touches the land all
         the way."* A DOTTED line takes a thinner casing still: at 4*u the white
         blobs almost meet and close the gaps the dots are there for. */
      R.paintShape(ctx, { stroke: P.halo, width: w + (dash ? 2.5 : 4) * u,
        dash: dash });
      poly(ctx, pts);
      R.paintShape(ctx, { stroke: P.ink, width: w, dash: dash });
      var head = heads(ctx, P, u, tip, headW(rt.kind, u, k), !!m.clean);
      if (L().probing()) {
        L().note(m.id, u, { head: head, tipNeedPx: clear, lineNeedPx: 2 * u,
          coastNeedPx: Math.max(2, 1.6 * u), coastPx: L().coastGap(p, head, 400 * u),
          tipPx: Math.hypot(head[0][0] - end[0], head[0][1] - end[1]),
          wantsCallout: !!rt.length_callout });
      }
    });
  }

  /* ---- what goes OVER them --------------------------------------------------- */

  /* THE ZONE NAMES AND THE SCALE BAR LEFT ON 2026-09-18, for
     dossier_map_route_label.js, when the length callout and its self-check
     would have taken this file past the 500-line rule. Both are WORDS on the
     picture, which is that file's whole job since the split of 2026-09-17, and
     the zone names had always borrowed its `boxAt` and `free`. Two things are
     handed in rather than looked up: `per`, measured here, and the kilometre's
     one Hebrew spelling, which stays in HE above. */

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
    /* A map that draws NO legend box (`legend: false`) still puts the bar where
       the box would have sent it - opposite the corner the legend prefers - so
       taking the key off the picture does not move the furniture as well. */
    /* THE SCALE BAR IS OFF UNLESS A MAP ASKS FOR IT (2026-09-17). Ziv, having
       seen it on all nine pictures: *"remove the 200 from the maps and stuff
       like that."* It used to go on every terrain map; now `scale: true` in the
       record turns it on and nothing carries one. The code is untouched below
       and still reserves its corner first, so a map that wants it is one JSON
       line away. */
    if (m.scale === true) {
      L().scaleBar(ctx, P, u, W, H, size, per,
        legend || (m.legend === false ? { at: "tl" } : null), taken, HE.km);
    }
    /* MARKS ONLY, NO TEXT ON THE MAP - `zone_text: false` (2026-09-17, Ziv of
       the strait picture). Every SIGN still paints with the ground in mapUnder,
       and every place name too; what comes off is the five zone names, stacked
       two deep over the channel the picture is about. Absent means true, and
       the key under the canvas names all three signs (dossier_map_block.js). */
    if (m.zone_text !== false) L().zoneLabels(ctx, p, P, u, m.zones, taken, W, H, size, per);
    routes.forEach(function (rt) {
      var pts = (rt.path || []).map(function (c) { return p(c[0], c[1]); });
      /* A SILENT ROUTE - `label: false` in the record (Ziv, 2026-09-17:
         *"remove the text completely"*). No name, no distance, no leader: the
         line is the whole statement. The legend row still names what the line
         is, and the HTML caption under the picture still carries the length,
         because neither of those is painted on the map. */
      /* THE LENGTH ON ITS OWN, at an authored point (2026-09-17, and back on
         the crossing 2026-09-18). Ziv: *"a little line to kind of in the middle
         of the route, to the right, and just write the amount of kilometers."*
         So a route may carry `length_callout`: a point the build has checked is
         inside both shapes, `lead_from` saying where its leader meets the line
         and `units` saying how much of the distance it says. The painter writes
         the measured figure there and nothing else - no route name, one line -
         and the number is measured from the drawn path, never authored. */
      var lc = rt.length_callout;
      if (lc && pts.length >= 2) {
        var km = pathKm(rt.path), one = lc.units === "km";
        var at = L().pathLabel(ctx, P, u, [one ? kmLabel(km) : distLabel(km)], pts,
          size * CALLOUT_TEXT, taken, W, H, null, p, lc, true) || {};
        at.km = Math.round(km * 10) / 10;
        if (at.box && L().probing()) {
          at.coastBoxPx = L().coastGap(p, L().boxRing(at.box), 900 * u);
        }
        L().note(m.id, u, at);
      }
      if (rt.label === false) return;
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
        var lw = routeW(kind, uu, kk);
        c.beginPath(); c.moveTo(x, cy); c.lineTo(x + sw - head, cy);
        R.paintShape(c, { stroke: Q.ink, width: lw, dash: dashOf(rt, lw) });
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
