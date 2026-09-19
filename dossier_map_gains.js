/* THE GAINS OVERLAY of the dossier maps: the ground taken inside the window,
   drawn in violet over the territory, and - on a `control: "merged"` map -
   folded into the Houthi fill so a gain and the ground it has joined read as
   one colour.

   Split out of dossier_map_draw.js on 2026-09-17, when the heat painter's hook
   in ground() took that file to its 500-line cap. Nothing about the overlay
   changed in the move: the same three functions, the same comments, the same
   colours. It leaves draw.js holding the GROUND - sea, land, territory,
   boundaries, the line of contact - which is what every map draws, while this
   is what only the dossier's maps draw.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapGains = { gains, mergedGains, gainStyle }

   dossier_map.js registers it beside the other painters and merges them into
   the one object the paint pass is handed, so `R.gains(...)` there reads
   exactly as it did before the split; ground() and the legend reach for the
   global by name. The shared helpers come from DossierMapDraw, looked up on
   each call so the files may load in any order. */
"use strict";

var DossierMapGains = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_gains: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  var adm2Index = null;
  function district(G, id) {
    if (!adm2Index) {
      adm2Index = {};
      D().eachFeature(G.yem_adm2, function (f) { adm2Index[f.properties.shapeID] = f; });
    }
    return adm2Index[id] || null;
  }
  /* ONE style for every gain, whatever its status: Ziv asked for captured and
     contested to read as one, "נכבש בידי החות'ים (מאומת + משוער)" (2026-09-11).
     The status still travels in the data and the text says which were
     confirmed; the map no longer draws the difference. */
  function gainStyle(P, u) {
    return { fill: D().alpha(P.violetFill, 0.5), stroke: P.violet, width: 2 * u, dash: [] };
  }
  /* There is ONE gain style and no second one. A heavier edge once set the last
     day's ground apart; Ziv struck that on 2026-09-13 ("remove what was conquered
     in the last day"), as he struck the captured/contested split on 2026-09-11.
     WHEN a place fell is said in the text under the map, never by a second style. */
  /* A district and an island BOTH paint only `coordinates[part_index]` of their
     ADM2 feature, never the whole district: the islands live inside mainland
     districts (Perim in Dhubab, Hanish and Zuqar in Al Khukhah), so a whole
     district would colour an island with its mainland's status. `kind` decides
     only the overview treatment - there an island is five pixels and takes a
     ring mark like a port or a town. */
  function gainPart(G, g) {
    var f = g.district_id ? district(G, g.district_id) : null;
    if (!f || typeof g.part_index !== "number") return null;
    var geom = f.geometry, c = geom.coordinates;
    var part = geom.type === "MultiPolygon" ? c[g.part_index]
      : (geom.type === "Polygon" && g.part_index === 0) ? c : null;
    return part ? { type: "Polygon", coordinates: part } : null;
  }
  /* THE SAME GROUND, IN THE SAME COLOUR (2026-09-17). On a `control: "merged"`
     map a gain is not a third thing on the picture: Ziv asked for the new
     ground to be "just part of the Houthis", so it is painted with the Houthi
     control fill and nothing else - no violet, no stroke, and none of the plain
     land the violet needs underneath it. Called from ground() between the two
     control fills and the alpha reset, so it is washed back with them on the
     light deck and a reader cannot tell a gain from the ground beside it.
     Which places were taken, and when, is still said in the text under the map;
     this picture is about one boundary and does not answer that. */
  function mergedGains(ctx, p, P, u, D0, G) {
    var R = D();
    ((D0 && D0.gains) || []).forEach(function (g) {
      var geom = gainPart(G, g);
      if (geom) {
        ctx.beginPath(); R.polyPath(ctx, p, geom);
        R.paintShape(ctx, { fill: P.houthi });
      } else if (typeof g.lon === "number") {
        var q = p(g.lon, g.lat);
        R.ringMark(ctx, q[0], q[1], 7 * u, { fill: P.houthi });
      }
    });
  }
  /* ---- the seam: where the new ground meets the old ------------------------- */

  /* A LINE ROUND THE NEW GROUND, THOUGH IT IS THE SAME COLOUR (2026-09-18).
     Ziv, having asked for the gains to be painted flush into the Houthi fill
     and then looked at the crossing picture: *"it's okay that you did all of
     them in the same colour, but still make a line that separates the new
     territories that they conquered so we know what they are."* Two things at
     once, and both are kept: the ground reads as one holder, and the reader can
     still see which part of it is new.

     The line is `GEO.gains_seam` - authored upstream as the edges BETWEEN a
     district taken since 10 September and Houthi ground that is not a gain, so
     the coast and the line of contact are already left out of it and nothing on
     this picture is drawn twice.

     WHAT IT LOOKS LIKE, and why. Beside it runs the line of contact: pale,
     dashed, 2px. So this one is SOLID and BROWN - a different hue, a different
     rhythm, no chance of reading one as the other - over a casing in the
     map's own halo colour, which is how every line on these maps survives
     terrain shading (the black country borders on the crossing do the same).
     The brown is authored per theme rather than taken from a token: on the
     light deck it is a near-black earth brown on pale ground, and on the dark
     board that same hue would be a black line on a black sea, so there it is
     the warm tan the brown becomes when the ground under it is dark.

     AND IT IS THE LOUDEST LINE IN ITS NEIGHBOURHOOD (2026-09-19). The first
     version was 2.8u of mid-brown, and at half scale on the crossing picture
     Ziv had to hunt for it: a thin light-brown thread over tan ground, beside
     a dashed line of the same weight. It exists so a reader SEES which ground
     is new, so it is now darker to near-black and never thinner than
     SEAM_OVER times the line of contact - the width is read off the palette's
     own `controlW` rather than written down twice, so the two can never drift
     apart. It scales with the canvas and is floored like every other line
     here, so a small canvas still shows it. */
  var SEAM = { light: "#2A1707", dark: "#F5B45C" };
  var SEAM_W = 4.2, SEAM_MIN = 3, SEAM_CASE = 3.5, SEAM_OVER = 1.9;

  function seamInk(P) { return SEAM[P.theme] || SEAM.light; }
  function seamWidth(P, u) {
    var contact = (P && P.controlW) || 2;
    return Math.max(SEAM_MIN, Math.max(SEAM_W, contact * SEAM_OVER) * u);
  }
  /* True when there is a seam to draw at all: the key asks before it prints a
     row for it, because a row naming a line that is not on the picture is the
     one thing every rule about this key forbids. */
  function hasSeam(G) {
    return !!(G && G.gains_seam && (G.gains_seam.features || []).length);
  }
  function seam(ctx, p, P, u, G) {
    if (!hasSeam(G)) return;
    var R = D(), w = seamWidth(P, u);
    R.strokeLines(ctx, p, G.gains_seam, { stroke: P.halo, width: w + SEAM_CASE * u });
    R.strokeLines(ctx, p, G.gains_seam, { stroke: seamInk(P), width: w });
  }
  /* The key's own swatch, drawn by the same two strokes at the same widths, so
     the mark in the box is the mark on the map and not a description of it. */
  function seamSwatch(ctx, P, u, x, cy, sw) {
    var R = D(), w = seamWidth(P, u);
    var line = function (style) {
      ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + sw, cy);
      R.paintShape(ctx, style);
    };
    line({ stroke: P.halo, width: w + SEAM_CASE * u });
    line({ stroke: seamInk(P), width: w });
  }

  function gains(ctx, p, P, u, D0, G, mapId) {
    var R = D();
    (D0.gains || []).forEach(function (g) {
      var geom = null;
      if (g.kind === "district" || (g.kind === "island" && mapId !== "overview")) geom = gainPart(G, g);
      /* Plain land under the violet, exactly as the legend swatch does, so a
         gain on Houthi ground and one on government ground are the same
         colour - measured on the light slide, the see-through wash read as
         two tones, which is the very separation Ziv asked to remove. */
      if (geom) {
        ctx.beginPath(); R.polyPath(ctx, p, geom);
        R.paintShape(ctx, { fill: P.land });
        R.paintShape(ctx, gainStyle(P, u));
      } else {
        var q = p(g.lon, g.lat);
        R.ringMark(ctx, q[0], q[1], 7 * u, { fill: P.land });
        R.ringMark(ctx, q[0], q[1], 7 * u, gainStyle(P, u));
      }
    });
  }

  return { gains: gains, mergedGains: mergedGains, gainStyle: gainStyle,
           seam: seam, seamSwatch: seamSwatch, seamInk: seamInk,
           hasSeam: hasSeam };
})();

window.DossierMapGains = DossierMapGains;
