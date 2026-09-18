/* The reported and assessed ZONES on a dossier map - a sea mine, a line of
   trenches - their colours, their line style and their legend rows.

   Split out of dossier_map_routes.js on 2026-09-17, when a colour and a glyph
   per TYPE would have taken that file past its 500-line cap. It owns the
   drawing and the key; the routes file still owns where a zone's NAME is
   placed, because that search shares its helpers with the route labels.

   NO ICONS. THESE ARE PLAIN MARKS (2026-09-18, the fourth and last pass at
   this picture). Four styles were drawn and put in front of Ziv in one sheet -
   the sign this file had carried since 2026-09-17, a chart-and-APP-6 set, a
   pictogram set and a flat-badge set - and he turned down every one of them:
   *"None of them are good, don't use icons, just mark the spots you think they
   did it."* So nothing is drawn that has to be READ as a symbol. A mark says
   WHERE, the colour says WHAT, the line style says HOW WELL KNOWN, and the
   caption under the picture says all three in words:

     mine - a plain red dot at the spot. No area, no glyph, nothing inside it.
            `radius_km` stays in the record as the reach the report covers and
            is not painted: the statement gives no coordinate, and a ring over
            the whole waist said "mined water" where the source says "one
            device found".
     fort - a plain thick brown stretch along the ridge, laid out on the
            authored `bearing` for the authored `radius_km` of length. SOLID
            for a dated open report, DASHED for our own assessment. No teeth,
            no blocks, no icon standing on it - those were the three rejected
            sets and the sign before them.

   The two colours stay, and they are the ones Ziv chose on 2026-09-17, when
   both kinds were still drawn in one ink: neither may be read as the fighting
   red - the diamond every active front carries - or as the violet of captured
   ground. Both marks sit on a halo, exactly as every other mark on these maps
   does, which is what lets the brown hold against the terrain and the coast.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapZones = { draw, radius, legendRows } */
"use strict";

var DossierMapZones = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_zones: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  /* One entry per type per theme. The light values are the DECK's, where the
     picture is printed or projected and everything must hold 3:1 on a near
     white ground; the dark ones are the board's own page. `edge` is the fine
     outline the dot carries, so a red mark on red-brown terrain still has a
     rim; the stretch needs none, its casing does that job.

     THE MINE IS A TRUE RED because the caption calls it one (2026-09-18). It
     was #D2530A, which is orange however it is labelled - a reader told that a
     red dot marks the mine and handed an orange one is being asked to trust
     the wrong thing. Measured on the light picture, #B3121B holds 4.9:1 on the
     sea, 4.4:1 on the terrain's tan and 6.5:1 on the pale land - every one
     past the 3:1 a graphical mark needs. AND IT IS TOLD FROM THE BROWN
     STRETCH BY LIGHTNESS, NOT HUE: red against ochre is the one pair a
     red-green reader cannot separate, so the dot is 1.75 times darker than
     #A8761F, a step that survives any colour blindness and a greyscale print.
     It stays a step off the fighting diamond's own red as well - 1.44 against
     #E01B0F - and that mark is a diamond where this one is a dot. */
  var TYPES = {
    mine: { dark: { ink: "#FF4D4D", edge: "#7A0A12" },
            light: { ink: "#B3121B", edge: "#4A070C" } },
    fort: { dark: { ink: "#D8A64A", edge: "#7A551A" },
            light: { ink: "#A8761F", edge: "#4A3208" } }
  };
  var HE = { mine: "מוקש ימי", fort: "תעלות וביצורים",
             reported: "דיווח", assessed: "הערכה",
             dotted: "הערכה (קו מקווקו)" };

  function skin(P, type) {
    var t = TYPES[type] || TYPES.fort;
    return t[P && P.theme === "light" ? "light" : "dark"];
  }
  function typeOf(z) { return (z && z.type === "mine") ? "mine" : "fort"; }
  var RAD = Math.PI / 180;

  /* THE DOT, written for BASE_W and floored the way every other mark here is:
     a mark that shrinks with the canvas stops being a mark. 12 puts it beside
     the numbered disc of the Marib maps rather than above it. */
  function dotR(u) { return Math.max(9, 12 * u); }
  /* THE STRETCH's own weight. Thicker than the line the old sign drew, because
     the teeth that used to say what it was are gone and the stretch is now the
     whole statement. */
  function lineW(u) { return Math.max(4.5, 6 * u); }

  /* HOW MUCH ROOM THE MARK TAKES, in pixels, which is what the name placement
     in dossier_map_routes.js keeps clear of. For a fort that is half the drawn
     stretch; for a mine the dot and its ring, never the report's reach - a
     15 km circle would push the mine's name right out of the strait. */
  function radius(z, per, u) {
    if (typeOf(z) === "mine") return dotR(u) * 1.45;
    return Math.max(7 * u, (z.radius_km || 0) * per / 2);
  }
  /* REPORTED takes a solid stretch and ASSESSED a dashed one: a dated open
     report with a link is a different claim from an analyst's reading, and the
     line style says which without spending the colour, which says WHAT it is.
     The pair is measured in the stretch's own width and every cap is round, so
     a round cap hands half a width back to the dash at each end - the same
     arithmetic the dotted route keeps in DOSSIER_ROUTES.md. */
  function dashOf(z, w) {
    return z.kind === "assessed" ? [w * 1.5, w * 2.2] : null;
  }

  /* ---- the mine's dot --------------------------------------------------------- */

  /* A filled dot, a thin ring of the map's own halo around it so it lifts off
     the water, and a fine dark rim. The ring is the halo rather than a written
     white: this picture and the deck are drawn light, where the halo IS white,
     and on the board's dark theme the same call gives the dark separation that
     every other mark there takes. */
  function mineMark(ctx, P, x, y, u, c) {
    var R = D(), r = dotR(u);
    R.ringMark(ctx, x, y, r + 3.4 * u, { fill: P.halo });
    R.ringMark(ctx, x, y, r, { fill: c.ink });
    R.ringMark(ctx, x, y, r + 1.1 * u, { stroke: P.halo, width: Math.max(1.6, 2.2 * u) });
    R.ringMark(ctx, x, y, r + 2.4 * u, { stroke: c.edge, width: Math.max(1, 1.3 * u) });
  }

  /* ---- the fortified stretch --------------------------------------------------- */

  /* THE LINE IS LAID OUT IN LON/LAT AND THEN PROJECTED, never drawn at an angle
     on the canvas: longitude and latitude do not share a scale, so a bearing
     turned into a canvas angle would be wrong by a few degrees at this latitude
     and wrong by more on a wider frame. The ends are the authored bearing and
     half the authored length from the centre. */
  function ends(p, z) {
    var half = Math.max(1, z.radius_km || 10) / 2, b = (z.bearing || 0) * RAD;
    var dLat = Math.cos(b) * half / 111.0;
    var dLon = Math.sin(b) * half / (111.32 * Math.cos(z.lat * RAD));
    return { a: p(z.lon - dLon, z.lat - dLat), b: p(z.lon + dLon, z.lat + dLat) };
  }
  function seg(ctx, a, b, style) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    D().paintShape(ctx, style);
  }
  function fortMark(ctx, p, P, u, z, c) {
    var e = ends(p, z), w = lineW(u);
    seg(ctx, e.a, e.b, { stroke: P.halo, width: w + 5 * u });
    seg(ctx, e.a, e.b, { stroke: c.ink, width: w, dash: dashOf(z, w) });
  }

  /* ---- the marks ------------------------------------------------------------- */

  /* Drawn WITH the ground, under every pin and every name: a town beside a
     fortified stretch still has to be findable. */
  function draw(ctx, p, P, u, map, per) {
    var list = (map || {}).zones || [];
    list.forEach(function (z) {
      var type = typeOf(z), c = skin(P, type), q;
      if (type === "mine") { q = p(z.lon, z.lat); mineMark(ctx, P, q[0], q[1], u, c); }
      else fortMark(ctx, p, P, u, z, c);
    });
  }

  /* ---- the key --------------------------------------------------------------- */

  /* ONE ROW PER TYPE, plus one row for the dashed stretch when the map carries
     an assessed zone. The type's row says what it is and whether it was
     reported - `מוקש ימי - דיווח` - and the dashed row explains the other style
     once, rather than doubling every type. EVERY SWATCH IS THE MARK ITSELF,
     drawn by the same code the map draws: a swatch that only resembles the mark
     is a key to a picture nobody has. */
  function swatchLine(c, Q, uu, x, cy, dash) {
    var k = skin(Q, "fort"), w = Math.max(3, 3.8 * uu);
    var a = [x + 2 * uu, cy], b = [x + 26 * uu, cy];
    seg(c, a, b, { stroke: Q.halo, width: w + 3 * uu });
    seg(c, a, b, { stroke: k.ink, width: w,
                   dash: dash ? [w * 1.5, w * 2.2] : null });
  }
  /* THE ROWS AS WORDS, in one list, so the two keys can never disagree. The
     canvas key below and the HTML key under the canvas (dossier_map_block.js)
     are both built from this - one row per TYPE on the picture plus the dashed
     row, each with the `key` its swatch is chosen by. A second copy of these
     strings would read the same until the first day one of them changed.

     IT IS WHAT LETS `legend: false` KEEP ITS EXPLANATION (2026-09-17). Ziv
     asked the strait picture for *"marks only, no text on the map"* - no zone
     names, no key box - and a mark nobody can read is not an improvement, so
     the words move UNDER the picture instead of going away. */
  function rowWords(map) {
    var list = (map || {}).zones || [], out = [], seen = {}, dashed = false;
    list.forEach(function (z) {
      var type = typeOf(z);
      if (z.kind === "assessed") dashed = true;
      if (seen[type]) return;
      seen[type] = true;
      var reported = list.some(function (o) {
        return typeOf(o) === type && o.kind !== "assessed";
      });
      out.push({ key: type,
        label: HE[type] + " - " + (reported ? HE.reported : HE.assessed) });
    });
    if (dashed) out.push({ key: "dotted", label: HE.dotted });
    return out;
  }
  function legendRows(ctx, P, u, map) {
    return rowWords(map).map(function (r) {
      var key = r.key;
      return { label: r.label, draw: function (c, Q, uu, x, cy, sw) {
        /* 0.62 of the map's own scale: the mark is drawn by the same code, and
           a swatch box is smaller than the sea it stands on. */
        if (key === "mine") mineMark(c, Q, x + sw / 2, cy, uu * 0.62, skin(Q, "mine"));
        else swatchLine(c, Q, uu, x, cy, key === "dotted");
      } };
    });
  }
  /* THE COLOUR AN HTML SWATCH TAKES, out of the same table the mark is painted
     from and for the theme the canvas beside it was drawn in - never a hex
     copied into a stylesheet, which is how a key ends up naming a colour the
     picture does not use. `dotted` is the fort's stretch in another style, so
     it asks for the fort's ink. */
  function ink(type, theme) { return skin({ theme: theme }, type).ink; }

  return { draw: draw, radius: radius, legendRows: legendRows,
           legendWords: rowWords, ink: ink };
})();

window.DossierMapZones = DossierMapZones;
