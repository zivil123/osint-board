/* The reported and assessed ZONES on a dossier map - a sea mine, a line of
   trenches - their colours, their hatch, their centre glyph and their legend
   rows.

   Split out of dossier_map_routes.js on 2026-09-17, when a colour and a glyph
   per TYPE would have taken that file past its 500-line cap. It owns the
   drawing and the key; the routes file still owns where a zone's NAME is
   placed, because that search shares its helpers with the route labels.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapZones = { draw, radius, legendRows }

   TWO COLOURS, AND THAT IS A CHANGE (2026-09-17). Until today both kinds of
   zone were the muted ink and were told apart by their EDGE alone - solid for
   a dated report, dotted for an analyst's reading. Ziv, on the strait picture:
   *"it's not good"*, and asked for the mines and the fortifications in
   different colours, with smaller and lighter areas. So `type` picks the
   colour and the glyph and `kind` keeps the edge:

     mine - a saturated red-orange, and a spiked circle at the centre
     fort - a saturated ochre with a dark edge, and a short zigzag

   Neither may be read as the fighting red (--geo-front-mark, the diamond every
   active front carries) or as the violet of captured ground, and the ochre has
   to hold against the terrain's own browns - which is what the dark edge under
   it is for. The hatch is a THIRD of the weight it used to carry, at a wider
   pitch, so a ring reads as a marked area rather than as a painted one. */
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
     white ground; the dark ones are the board's own page. */
  var TYPES = {
    mine: { dark: { ink: "#FF7A33", edge: "#FF7A33" },
            light: { ink: "#D2530A", edge: "#8A3405" } },
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

  /* A THIRD of the old hatch: the lines are drawn at 0.34 alpha on a pitch half
     again as wide, so the ring says "this area" without painting over the
     terrain under it. Still 135 degrees, which the fighting zones' 45 can never
     be confused with. */
  function hatch(ctx, color, u) {
    var R = D(), n = Math.max(13, Math.round(26 * u));
    var c = document.createElement("canvas");
    c.width = c.height = n;
    var g = c.getContext("2d");
    g.strokeStyle = R.alpha(color, 0.34); g.lineWidth = Math.max(1, 1.1 * u);
    g.lineCap = "square";
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
  function radius(z, per, u) {
    return Math.max(7 * u, (z.radius_km || 0) * per);
  }
  /* REPORTED takes a solid edge and ASSESSED a dotted one: a dated open report
     with a link is a different claim from an analyst's view, and the edge says
     which without spending the colour, which now says WHAT the zone is. Thinner
     than it was, with the colour doing the work the weight used to do. */
  function edge(z, P, u) {
    return { stroke: skin(P, typeOf(z)).edge, width: Math.max(1.1, 1.4 * u),
             dash: z.kind === "assessed" ? [2.5 * u, 3.5 * u] : [] };
  }

  /* ---- the centre glyphs ----------------------------------------------------- */

  /* A GLYPH AT THE CENTRE, because colour may never carry meaning alone
     (design-law) and because a lighter hatch needs a mark that finds the eye.
     Each draws what it names: a moored contact mine with its horns, and a cut
     trench line. Both sit on a halo disc, exactly as every other mark on these
     maps does, so they read over terrain, over sea and over either fill. */
  function mineGlyph(ctx, P, x, y, r, u, c) {
    var R = D(), i, a;
    R.ringMark(ctx, x, y, r * 1.5, { fill: P.halo });
    ctx.beginPath();
    for (i = 0; i < 8; i++) {
      a = i * Math.PI / 4;
      ctx.moveTo(x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72);
      ctx.lineTo(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35);
    }
    R.paintShape(ctx, { stroke: c.edge, width: Math.max(1.2, 1.6 * u) });
    R.ringMark(ctx, x, y, r * 0.78, { fill: c.ink, stroke: c.edge,
      width: Math.max(1, 1.2 * u) });
  }
  function fortGlyph(ctx, P, x, y, r, u, c) {
    var R = D(), i, step = r * 0.62;
    R.ringMark(ctx, x, y, r * 1.35, { fill: P.halo });
    ctx.beginPath();
    ctx.moveTo(x - step * 2, y + r * 0.45);
    for (i = 0; i < 4; i++) {
      ctx.lineTo(x - step * 2 + step * (i + 0.5), y + (i % 2 ? r * 0.45 : -r * 0.55));
    }
    ctx.lineTo(x + step * 2, y + r * 0.45);
    R.paintShape(ctx, { stroke: P.halo, width: Math.max(3, 4 * u) });
    ctx.beginPath();
    ctx.moveTo(x - step * 2, y + r * 0.45);
    for (i = 0; i < 4; i++) {
      ctx.lineTo(x - step * 2 + step * (i + 0.5), y + (i % 2 ? r * 0.45 : -r * 0.55));
    }
    ctx.lineTo(x + step * 2, y + r * 0.45);
    R.paintShape(ctx, { stroke: c.ink, width: Math.max(1.8, 2.4 * u) });
  }
  function glyph(ctx, P, type, x, y, r, u) {
    var c = skin(P, type);
    if (type === "mine") mineGlyph(ctx, P, x, y, r, u, c);
    else fortGlyph(ctx, P, x, y, r, u, c);
  }

  /* ---- the rings ------------------------------------------------------------- */

  /* Drawn WITH the ground, under every pin and every name: a zone is an area,
     and a town inside it still has to be findable. */
  function draw(ctx, p, P, u, map, per) {
    var R = D(), list = (map || {}).zones || [];
    list.forEach(function (z) {
      var type = typeOf(z), q = p(z.lon, z.lat), r = radius(z, per, u);
      R.ringMark(ctx, q[0], q[1], r, { fill: hatch(ctx, skin(P, type).ink, u) });
      R.ringMark(ctx, q[0], q[1], r, edge(z, P, u));
      glyph(ctx, P, type, q[0], q[1], Math.min(r * 0.42, Math.max(6, 9 * u)), u);
    });
  }

  /* ---- the key --------------------------------------------------------------- */

  /* ONE ROW PER TYPE, plus one row for the dotted edge when the map carries an
     assessed zone. The type's row says what it is and whether it was reported -
     `מוקש ימי - דיווח` - and the dotted row explains the other edge once,
     rather than doubling every type. */
  function legendRows(ctx, P, u, map) {
    var R = D(), list = (map || {}).zones || [], rows = [], seen = {}, dotted = false;
    list.forEach(function (z) {
      var type = typeOf(z);
      if (z.kind === "assessed") dotted = true;
      if (seen[type]) return;
      seen[type] = true;
      var reported = list.some(function (o) {
        return typeOf(o) === type && o.kind !== "assessed";
      });
      rows.push({ label: HE[type] + " - " + (reported ? HE.reported : HE.assessed),
        draw: function (c, Q, uu, x, cy, sw, sh) {
          var r = sh * 0.46;
          R.ringMark(c, x + sw / 2, cy, r, { fill: hatch(c, skin(Q, type).ink, uu) });
          R.ringMark(c, x + sw / 2, cy, r,
            { stroke: skin(Q, type).edge, width: Math.max(1.1, 1.4 * uu) });
          glyph(c, Q, type, x + sw / 2, cy, r * 0.62, uu);
        } });
    });
    if (dotted) {
      rows.push({ label: HE.dotted, draw: function (c, Q, uu, x, cy, sw, sh) {
        R.ringMark(c, x + sw / 2, cy, sh * 0.46, { stroke: Q.muted,
          width: Math.max(1.1, 1.4 * uu), dash: [2.5 * uu, 3.5 * uu] });
      } });
    }
    return rows;
  }

  return { draw: draw, radius: radius, legendRows: legendRows };
})();

window.DossierMapZones = DossierMapZones;
