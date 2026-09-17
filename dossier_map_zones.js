/* The reported and assessed ZONES on a dossier map - a sea mine, a line of
   trenches - their colours, their hatch, their centre glyph and their legend
   rows.

   Split out of dossier_map_routes.js on 2026-09-17, when a colour and a glyph
   per TYPE would have taken that file past its 500-line cap. It owns the
   drawing and the key; the routes file still owns where a zone's NAME is
   placed, because that search shares its helpers with the route labels.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapZones = { draw, radius, legendRows }

   NO RINGS. THESE ARE MAP SIGNS NOW (2026-09-17, the third pass at this
   picture). Ziv: *"the second picture needs a redo, the signs of the digging
   and stuff, I don't like how it looks."* A hatched ring said "somewhere in
   this circle", which is both vaguer and louder than the sources are: a trench
   line is a LINE along a ridge, and one recovered mine is a POINT in the water.
   So each type is drawn as the sign cartography already has for it:

     fort - a fortified line ALONG the ridge, ochre with a black edge and small
            black teeth on the sea-facing side; `radius_km` is its LENGTH in
            kilometres and `bearing` its compass direction, the teeth on the
            LEFT of that heading. An assessed line is dashed.
     mine - the naval-mine sign at the spot: a black circle with six spikes
            and a thin red ring outside it. No area, no hatch.

   The two colours stay (they came from his previous pass, when both kinds were
   the same muted ink): neither may be read as the fighting red - the diamond
   every active front carries - or as the violet of captured ground, and the
   ochre holds against the terrain's own browns because of the black under it.
   Both signs sit on a halo, exactly as every other mark on these maps does. */
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
  var RAD = Math.PI / 180;

  /* HOW MUCH ROOM THE SIGN TAKES, in pixels, which is what the name placement
     in dossier_map_routes.js keeps clear of. For a fort that is half the drawn
     line; for a mine the sign's own outer ring, never the report's reach - a
     15 km circle would push the mine's name right out of the strait. */
  function radius(z, per, u) {
    if (typeOf(z) === "mine") return mineR(u) * 1.6;
    return Math.max(7 * u, (z.radius_km || 0) * per / 2);
  }
  function mineR(u) { return Math.max(7, 9.5 * u); }
  /* REPORTED takes a solid line and ASSESSED a dashed one: a dated open report
     with a link is a different claim from an analyst's reading, and the line
     style says which without spending the colour, which says WHAT it is. */
  function dashOf(z, u) {
    return z.kind === "assessed" ? [6 * u, 4.5 * u] : null;
  }

  /* ---- the naval mine -------------------------------------------------------- */

  /* THE SIGN, not a symbol of our own: a moored contact mine is drawn as a
     black disc with its horns, and the thin ring outside it in the type's red
     is what says this one is a REPORT on this board rather than a chart
     feature. Six spikes, as Ziv asked. */
  function mineSign(ctx, P, x, y, u, c) {
    var R = D(), i, a, r = mineR(u);
    R.ringMark(ctx, x, y, r * 1.75, { fill: P.halo });
    ctx.beginPath();
    for (i = 0; i < 6; i++) {
      a = -Math.PI / 2 + i * Math.PI / 3;
      ctx.moveTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85);
      ctx.lineTo(x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45);
    }
    R.paintShape(ctx, { stroke: P.ink, width: Math.max(1.4, 1.9 * u) });
    R.ringMark(ctx, x, y, r * 0.86, { fill: P.ink });
    R.ringMark(ctx, x, y, r * 1.62, { stroke: c.ink, width: Math.max(1.1, 1.5 * u) });
  }

  /* ---- the fortified line ---------------------------------------------------- */

  /* THE LINE IS LAID OUT IN LON/LAT AND THEN PROJECTED, never drawn at an angle
     on the canvas: longitude and latitude do not share a scale, so a bearing
     turned into a canvas angle would be wrong by a few degrees at this latitude
     and wrong by more on a wider frame. The ends are the authored bearing and
     half the authored length from the centre; the teeth side comes from a THIRD
     projected point, 1 km to the left of the heading, so the side survives the
     projection too. */
  function ends(p, z) {
    var half = Math.max(1, z.radius_km || 10) / 2, b = (z.bearing || 0) * RAD;
    var dLat = Math.cos(b) * half / 111.0;
    var dLon = Math.sin(b) * half / (111.32 * Math.cos(z.lat * RAD));
    var lb = b - Math.PI / 2;                       /* the teeth side */
    return { a: p(z.lon - dLon, z.lat - dLat), b: p(z.lon + dLon, z.lat + dLat),
             side: p(z.lon + Math.sin(lb) / (111.32 * Math.cos(z.lat * RAD)),
                     z.lat + Math.cos(lb) / 111.0) };
  }
  function fortSign(ctx, p, P, u, z, c) {
    var R = D(), e = ends(p, z), dash = dashOf(z, u);
    var dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1];
    var len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    var mid = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
    /* which perpendicular points at the seaward point */
    var sx = e.side[0] - mid[0], sy = e.side[1] - mid[1];
    var nx = -uy, ny = ux;
    if (nx * sx + ny * sy < 0) { nx = uy; ny = -ux; }
    /* The teeth start at the OUTER edge of the line and stand clear of it - a
       tooth beginning on the centreline is swallowed by the line drawn over it
       and the sign reads as a ladder instead of a fortification. */
    var w = Math.max(3.4, 4.6 * u), tooth = Math.max(4.6, 6 * u);
    var base = w / 2 + 0.9 * u;
    var i, n = Math.max(3, Math.round(len / Math.max(11, 15 * u))), t, bx, by;
    var line = function (style) {
      ctx.beginPath();
      ctx.moveTo(e.a[0], e.a[1]); ctx.lineTo(e.b[0], e.b[1]);
      R.paintShape(ctx, style);
    };
    var teeth = function (style) {
      ctx.beginPath();
      for (i = 0; i <= n; i++) {
        t = i / n;
        bx = e.a[0] + dx * t + nx * base; by = e.a[1] + dy * t + ny * base;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + nx * tooth, by + ny * tooth);
      }
      R.paintShape(ctx, style);
    };
    line({ stroke: P.halo, width: w + 3.4 * u });
    teeth({ stroke: P.halo, width: Math.max(2.8, 3.6 * u) });
    teeth({ stroke: c.edge, width: Math.max(1.5, 2 * u) });
    line({ stroke: c.edge, width: w + 1.8 * u, dash: dash });
    line({ stroke: c.ink, width: w, dash: dash });
  }

  /* ---- the marks ------------------------------------------------------------- */

  /* Drawn WITH the ground, under every pin and every name: a town beside a
     trench line still has to be findable. */
  function draw(ctx, p, P, u, map, per) {
    var list = (map || {}).zones || [];
    list.forEach(function (z) {
      var type = typeOf(z), q = p(z.lon, z.lat), c = skin(P, type);
      if (type === "mine") mineSign(ctx, P, q[0], q[1], u, c);
      else fortSign(ctx, p, P, u, z, c);
    });
  }

  /* ---- the key --------------------------------------------------------------- */

  /* ONE ROW PER TYPE, plus one row for the dashed line when the map carries an
     assessed zone. The type's row says what it is and whether it was reported -
     `מוקש ימי - דיווח` - and the dashed row explains the other style once,
     rather than doubling every type. EVERY SWATCH IS THE SIGN ITSELF, drawn by
     the same code the map draws: a swatch that only resembles the mark is a key
     to a picture nobody has. */
  function swatchLine(c, Q, uu, x, cy, sw, dash) {
    var R = D(), i, n = 3, x0 = x + 2 * uu, x1 = x + sw - 2 * uu;
    var w = Math.max(2.6, 3.2 * uu), tooth = Math.max(3.6, 4.6 * uu);
    var k = skin(Q, "fort"), top = cy - w / 2 - 0.8 * uu;
    var seg = function (style) {
      c.beginPath(); c.moveTo(x0, cy); c.lineTo(x1, cy); R.paintShape(c, style);
    };
    c.beginPath();
    for (i = 0; i <= n; i++) {
      c.moveTo(x0 + (x1 - x0) * i / n, top);
      c.lineTo(x0 + (x1 - x0) * i / n, top - tooth);
    }
    R.paintShape(c, { stroke: k.edge, width: Math.max(1.2, 1.6 * uu) });
    seg({ stroke: k.edge, width: w + 1.6 * uu, dash: dash });
    seg({ stroke: k.ink, width: w, dash: dash });
  }
  /* THE ROWS AS WORDS, in one list, so the two keys can never disagree. The
     canvas key below and the HTML key under the canvas (dossier_map_block.js)
     are both built from this - one row per TYPE on the picture plus the dashed
     row, each with the `key` its swatch is chosen by. A second copy of these
     strings would read the same until the first day one of them changed.

     IT IS WHAT LETS `legend: false` KEEP ITS EXPLANATION (2026-09-17). Ziv
     asked the strait picture for *"marks only, no text on the map"* - no zone
     names, no key box - and a sign nobody can read is not an improvement, so
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
        /* 0.62 of the map's own scale: the sign is drawn by the same code,
           and a swatch box is smaller than the sea it stands on. */
        if (key === "mine") mineSign(c, Q, x + sw / 2, cy, uu * 0.62, skin(Q, "mine"));
        else swatchLine(c, Q, uu, x, cy, sw,
          key === "dotted" ? [5 * uu, 4 * uu] : null);
      } };
    });
  }
  /* THE COLOUR AN HTML SWATCH TAKES, out of the same table the sign is painted
     from and for the theme the canvas beside it was drawn in - never a hex
     copied into a stylesheet, which is how a key ends up naming a colour the
     picture does not use. `dotted` is the fort's line in another style, so it
     asks for the fort's ink. */
  function ink(type, theme) { return skin({ theme: theme }, type).ink; }

  return { draw: draw, radius: radius, legendRows: legendRows,
           legendWords: rowWords, ink: ink };
})();

window.DossierMapZones = DossierMapZones;
