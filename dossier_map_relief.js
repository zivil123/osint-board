/* The terrain pictures the dossier maps are drawn on: which frames need one,
   loading them once per theme, and handing the painter what ground() needs.

   Split out of dossier_map.js on 2026-09-17, when the two picture SHAPES (wide
   for a full slide, square for a slide with text beside it) and the per-map
   `clean` ground pushed that file past its 500-line cap - the same way
   dossier_map_legend.js and dossier_map_extra.js left dossier_map_draw.js.
   Nothing about the loading changed in the move; only its address did.

   NO ES modules - the page runs from file://. One global, loaded BEFORE
   dossier_map.js so the painter can find it at first paint:

     window.DossierMapRelief = { ready(theme), optFor(map, theme, variant) }

   GEO.relief is written by geo_prep.py from relief_prep.py's output: one entry
   per frame, each with its lon/lat bounds, a light and a dark file and a
   content hash to bust the cache with. Nothing draws until the picture for the
   theme has landed, which is what ready() is for. Since 2026-09-17 a raster
   covers the union of its frame's WIDE and SQUARE extents, so the same picture
   serves both shapes and the painter still places it by its own bounds. */
"use strict";

var DossierMapRelief = (function () {
  /* The territory fills are washed back under the relief picture, on the light
     deck only: the dark palette's fills already carry their own alpha, and an
     opaque fill would erase the terrain it is drawn over. */
  var RELIEF_FADE = 0.66;
  /* `terrain: "strong"` ON ONE MAP (2026-09-17). Ziv asked to "show the
     topography more". Two things were hiding it and both are here: the
     territory wash sits ON TOP of the hillshade, and the hillshade itself is a
     gentle grey. So a strong map washes the fills much further back and lifts
     the picture's own contrast as it is laid down - the terrain is not redrawn,
     it is simply less covered and less flat. Every other map keeps 0.66 and no
     filter, so nothing else moves by a pixel.
     Measured on the aden frame, in the Yafa highlands (lon 44.9-45.4, lat
     13.6-14.0), luminance spread over the terrain's own pixels: 26.5 at 0.66
     with no filter, 31.6 here - an 18% rise, and the knee of the curve. Pushing
     the wash below 0.35 buys another 0.2 and starts costing the reader who
     holds what, which is the other thing the picture is for. The brightness
     step is not decoration: the hillshade is a LIGHT hypsometric tint, and
     contrast() alone pushes it into white and loses the very detail it was
     raised to show. */
  var STRONG_FADE = 0.40,
      STRONG_FILTER = "brightness(0.93) contrast(1.6) saturate(1.15)";
  /* ROUND 9 (2026-09-26): on the two Word-report story frames the strong wash
     let the hills' tint pass for the Houthi fill - Ziv could not tell who holds
     what. There, and only on a strong map, the fills go back to near the house
     wash; whichever ground look relief_frames.GROUND_LOOK names, the same. */
  var REPORT_FADE = { bf_lahj_madaribah_north: 0.58, bf_marib_jubah: 0.58 };

  /* Loaded ONCE per theme and kept: the deck exports every map at 2560, the
     PNG button exports two shapes of each, and the page redraws on every
     resize - re-fetching a 200 KB picture each time would make all three
     stutter. */
  var img = {}, wait = {};

  /* THE GROUNDS THAT ARE A PICTURE, by the record's own word. "relief" is the
     shaded terrain; "streets" (2026-09-22) is the same raster slot filled with
     basemap tiles for a city close-up, built by scripts\relief_streets.py off
     the frame's `source`. Everything below treats them alike - the picture is
     loaded, placed and washed back the same way, and only what is IN it
     differs - so a value read is the one thing that must never become a
     truthiness test here. */
  var PICTURE = { relief: true, streets: true };

  function geo() { return (typeof GEO !== "undefined" && GEO) ? GEO : null; }
  function dossier() { return (typeof DOSSIER !== "undefined" && DOSSIER) ? DOSSIER : null; }

  function meta() {
    var G = geo();
    return (G && G.relief && typeof G.relief === "object") ? G.relief : null;
  }
  /* Only the frames a map actually asks for terrain on - there is no point
     fetching a picture for a frame no variant draws. */
  function frames() {
    var D = dossier(), seen = {};
    (D && D.maps || []).forEach(function (m) {
      /* A `ground: "relief"` map has no variant to ask with, and the terrain is
         the only ground it ever draws - so it asks by the flag instead. */
      var wants = (m.variants && m.variants.relief) || PICTURE[m.ground] === true;
      if (m.frame && wants) seen[m.frame] = true;
    });
    return Object.keys(seen);
  }
  function loadOne(store, name, file, hash) {
    return new Promise(function (resolve) {
      var pic = new Image();
      pic.onload = function () { store[name] = pic; resolve(); };
      /* A picture that will not load costs the terrain and nothing else: the
         map is painted without it rather than not at all. */
      pic.onerror = function () {
        console.warn("dossier_map_relief: the relief picture did not load: " + file);
        resolve();
      };
      pic.src = file + (hash ? "?v=" + hash : "");
    });
  }
  /* Resolves when every relief picture this theme needs is in memory - or at
     once when there are none, or when the page is on file://, where an image
     TAINTS the canvas and toDataURL() throws, which would take the whole deck
     down for a background layer. */
  function ready(theme) {
    var key = theme === "light" ? "light" : "dark";
    if (wait[key]) return wait[key];
    var all = meta(), names = all ? frames() : [];
    if (!names.length || location.protocol === "file:") {
      wait[key] = Promise.resolve(false);
      return wait[key];
    }
    var store = img[key] = img[key] || {};
    wait[key] = Promise.all(names.map(function (name) {
      var m = all[name];
      if (!m || !m.file || !m.file[key]) return Promise.resolve();
      return loadOne(store, name, m.file[key], m.hash && m.hash[key]);
    })).then(function () { return true; });
    return wait[key];
  }
  /* What ground() needs for this map, or null: the picture, where it goes, and
     how far back to wash the territory fills over it. */
  function optFor(map, theme, variant) {
    if (variant !== "relief" && PICTURE[(map || {}).ground] !== true) return null;
    var key = theme === "light" ? "light" : "dark";
    var all = meta(), m = all && all[map.frame];
    var pic = (img[key] || {})[map.frame];
    if (!m || !m.bounds || !pic) return null;
    /* A STREET picture is laid as built - already toned for print by
       relief_streets.py `tone()` (2026-09-23) - so no terrain filter ever
       touches it; `fade` is the territory fills' wash, not the picture's. */
    var strong = (map || {}).terrain === "strong" && map.ground !== "streets";
    return { img: pic, bounds: m.bounds,
             fade: key !== "light" ? 0 : !strong ? RELIEF_FADE : REPORT_FADE[map.frame] || STRONG_FADE,
             filter: strong ? STRONG_FILTER : null };
  }

  return { ready: ready, optFor: optFor };
})();

window.DossierMapRelief = DossierMapRelief;
