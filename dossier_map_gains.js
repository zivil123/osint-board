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
  /* ---- the ground taken in THIS round, in its own tone ---------------------- */

  /* A DIFFERENT COLOUR WHERE THEY TOOK, AND NOWHERE ELSE (2026-09-22). Ziv, on
     a picture whose whole Houthi side had been restyled to make the two sides
     of the war easier to tell apart: *"Why did you change how the colours look?
     They should look exactly the same as the map before. I only said put a
     different colour where the Houthis conquered in the RECENT fights... Don't
     change the whole map. Not a border - where they took."*

     So this fills ONE layer and touches nothing else on the picture. The layer
     is `GEO.recent_gains` - the districts that changed hands inside the window,
     dissolved upstream into one shape - and `GEO.recent_gains_list` says who
     took each of them: all six are `to: "houthi"` today, which is why the fill
     can be one tone and be true. A government gain would need the layer split
     upstream first, because a dissolved shape cannot be filled two ways.

     WHY IT IS NOT THE VIOLET the dossier's own gains overlay uses: that one
     paints plain land underneath and so ERASES the terrain, and it answers a
     different question (which places the dossier's text is about). This is the
     control map's own layer, laid at the same wash as the control fills - the
     hillshade still reads through it.

     VIOLET, AND SEE-THROUGH (2026-09-22). It was a flat red, and Ziv, looking
     at it: low quality. So it is now a LIGHT VIOLET TINT - a hue neither the
     warm grey of Houthi ground nor the cool grey of government ground can be
     mistaken for - laid thin enough that the terrain reads straight through it
     and the seam line below does the work of saying where the new ground ends.
     Authored per theme, like the seam: the board's own dark ground needs the
     lighter step of the same violet.

     The alpha is set HERE rather than taken from the caller, because this tint
     only works at one strength: too heavy and it erases the hillshade, too
     light and the reader stops seeing it at half scale. It hands back at 1,
     because the line that follows is a line and no line on these maps is
     washed back. */
  var NEW_GROUND = { light: "#6E46AA", dark: "#A886E8" };
  var NEW_GROUND_ALPHA = 0.32;

  function newGround(ctx, p, P, u, G) {
    var R = D();
    if (!G || !G.recent_gains) return;
    ctx.beginPath();
    R.eachFeature(G.recent_gains, function (f) { R.polyPath(ctx, p, f.geometry); });
    ctx.globalAlpha = NEW_GROUND_ALPHA;
    R.paintShape(ctx, { fill: NEW_GROUND[P.theme] || NEW_GROUND.light });
    ctx.globalAlpha = 1;
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

     WHAT IT LOOKED LIKE UNTIL 2026-09-22, and why it does not any more. It was
     SOLID and heavy - 2.8u of mid-brown at first, then 4.2u near-black, then
     4.2u of violet when the ground it edged went violet - on the reasoning
     that a reader had to HUNT for the first version at half scale, so the
     line had to shout. Two things ended that: the violet fill went back (Ziv,
     2026-09-22 morning), so there is no fill for the hue to follow; and the
     ask itself was "just a little border", not a second boundary. The casing
     in the map's own halo colour is the one thing kept from all of it - it is
     how every line on these maps survives terrain shading. The style that
     stands is below; it scales with the canvas and is floored like every
     other line here, so a small canvas still shows it. */
  /* JUST A LITTLE BORDER (2026-09-22). Ziv sent the violet wash back and asked
     for the new ground to keep the Houthi colour exactly - the same colour,
     "with just a little border" between what they held and what they newly
     conquered. So the heavy violet rope is gone, and what is left is the
     thinnest line on this picture that can still be seen at half scale: about
     1.6u of the map's OWN control-line ink, dashed, over a 1u casing in the
     halo colour so it survives the terrain shading.
     NO COLOUR OF ITS OWN, in either deck: it reads `P.control`, authored once
     per palette (dossier_map_light.js, or the --geo tokens on the board). A
     border between two parts of ONE holder's ground is not a third party on
     the map and may not bring a third hue to it. It is told from the line of
     contact beside it - same ink, 2u, a long 6/4 dash - by being half that
     weight on a finer rhythm; and the two never touch, the seam being authored
     with the coast and the line of contact already cut out of it. */
  var SEAM_W = 1.6, SEAM_MIN = 1.1, SEAM_CASE = 1, SEAM_DASH = [3.2, 2.4];

  function seamInk(P) { return (P && P.control) || "#1F2D3D"; }
  function seamWidth(P, u) { return Math.max(SEAM_MIN, SEAM_W * u); }
  function seamDash(u) { return [SEAM_DASH[0] * u, SEAM_DASH[1] * u]; }
  /* True when there is a seam to draw at all: the key asks before it prints a
     row for it, because a row naming a line that is not on the picture is the
     one thing every rule about this key forbids. */
  function hasSeam(G) {
    return !!(G && G.gains_seam && (G.gains_seam.features || []).length);
  }
  function seam(ctx, p, P, u, G) {
    if (!hasSeam(G)) return;
    var R = D(), w = seamWidth(P, u), dash = seamDash(u);
    R.strokeLines(ctx, p, G.gains_seam, { stroke: P.halo, width: w + SEAM_CASE * u, dash: dash });
    R.strokeLines(ctx, p, G.gains_seam, { stroke: seamInk(P), width: w, dash: dash });
  }
  /* The key's own swatch, drawn by the same two strokes at the same widths, so
     the mark in the box is the mark on the map and not a description of it. */
  function seamSwatch(ctx, P, u, x, cy, sw) {
    var R = D(), w = seamWidth(P, u), dash = seamDash(u);
    var line = function (style) {
      ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + sw, cy);
      R.paintShape(ctx, style);
    };
    line({ stroke: P.halo, width: w + SEAM_CASE * u, dash: dash });
    line({ stroke: seamInk(P), width: w, dash: dash });
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
           hasSeam: hasSeam, newGround: newGround };
})();

window.DossierMapGains = DossierMapGains;
