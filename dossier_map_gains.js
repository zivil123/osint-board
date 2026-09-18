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

  return { gains: gains, mergedGains: mergedGains, gainStyle: gainStyle };
})();

window.DossierMapGains = DossierMapGains;
