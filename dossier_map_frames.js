/* THE FRAMES OF THE DOSSIER MAPS: which record a map id names, the shapes a
   frame may author, the rectangle each of those shapes cuts, and the pictures a
   frame can be drawn as.

   Split out of dossier_map.js on 2026-09-22, when the tribal layer needed its
   flag read there and that file stood at 499 of the 500 lines every authored
   file on this board keeps. Nothing about the frames changed in the move: the
   same lookups, the same fallback, the same comments. It leaves dossier_map.js
   holding the PAINT PASS - the projection, the palette and the public API -
   which is what every caller reaches for, while this is the one question
   ("which rectangle, at which aspect") that several of them ask first.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapFrames = { mapOf, frameOf, frameAspect, aspect,
                                 variantsOf, SHAPES }

   dossier_map.js reaches it BY NAME at call time, the way it reaches
   DossierMapGains and DossierMapKey, so the two files may load in any order.
   FRAMES ARE AUTHORED, in data\dossier_maps.json, and reach here as
   DOSSIER.frames; the rubric is DOSSIER_LAYERS.md, "Frames". */
"use strict";

var DossierMapFrames = (function () {
  function dossier() {
    return (typeof DOSSIER !== "undefined" && DOSSIER) ? DOSSIER : null;
  }

  function mapOf(mapId) {
    var D = dossier();
    return (D && (D.maps || []).filter(function (m) { return m.id === mapId; })[0]) || null;
  }
  /* THE SHAPES OF EVERY PICTURE: the WIDE one for a slide, a SQUARE one to sit
     beside text (2026-09-17), a TALL 3:4 one for a subject taller than it is
     wide, a LAND 4:3 one - that ground opened at the sides - and a STRETCH 4:3
     one, the TALL shape's own ground pulled sideways instead, the only shape
     that adds no land (2026-09-22). None is derived, each losing a different
     end of the story, and a frame without the shape asked for falls back to the
     wide one; `page_frame` takes that shape on the PAGE too. LAYERS.md. */
  var SHAPES = { square: [1, 1], tall: [3, 4], land: [4, 3], stretch: [4, 3] };
  function frameOf(mapId, shape) {
    var D = dossier(), m = mapOf(mapId);
    var f = (D && m && D.frames && D.frames[m.frame]) || null;
    if (!f) return null;
    var want = shape === "screen" ? m.page_frame : shape, alt = SHAPES[want];
    if (!alt || !f[want] || !f[want].lat) return f;
    return { lat: f[want].lat, aspect: alt, legend: f.legend,
             gov: f.gov, lon: f[want].lon || null,
             lonMid: typeof f[want].lonMid === "number" ? f[want].lonMid : f.lonMid };
  }
  /* A caller cutting the map's own rectangle asks `frameAspect`; one sizing the
     PAGE's canvas asks `aspect`, which asks with the screen's shape, so a
     `page_frame` map is given the box that shape wants (DOSSIER_MAPS.md on why
     a canvas and its frame may never disagree). */
  function frameAspect(mapId, shape) {
    var f = frameOf(mapId, shape);
    return (f && f.aspect && f.aspect[1]) ? f.aspect[0] / f.aspect[1] : 16 / 9;
  }
  function aspect(mapId) { return frameAspect(mapId, "screen"); }
  /* The pictures this painter can draw for a frame, PLAIN FIRST. The page and
     the deck both ask, so a variant added to the record reaches both without a
     line of code. A relief-ground map IS its picture - the terrain is the base, not
     a second view of the same frame - so it offers none. */
  function variantsOf(mapId) {
    var m = mapOf(mapId);
    /* ... and so IS a `ground: "streets"` map: the street raster is that
       picture's base, not a second view of the frame. */
    if (m && (m.ground === "relief" || m.ground === "streets")) return ["plain"];
    return ["plain"].concat(Object.keys((m && m.variants) || {}));
  }

  return { mapOf: mapOf, frameOf: frameOf, frameAspect: frameAspect,
           aspect: aspect, variantsOf: variantsOf, SHAPES: SHAPES };
})();

window.DossierMapFrames = DossierMapFrames;
