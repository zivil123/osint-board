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

  /* Loaded ONCE per theme and kept: the deck exports every map at 2560, the
     PNG button exports two shapes of each, and the page redraws on every
     resize - re-fetching a 200 KB picture each time would make all three
     stutter. */
  var img = {}, wait = {};

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
      var wants = (m.variants && m.variants.relief) || m.ground === "relief";
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
    if (variant !== "relief" && (map || {}).ground !== "relief") return null;
    var key = theme === "light" ? "light" : "dark";
    var all = meta(), m = all && all[map.frame];
    var pic = (img[key] || {})[map.frame];
    if (!m || !m.bounds || !pic) return null;
    return { img: pic, bounds: m.bounds, fade: key === "light" ? RELIEF_FADE : 0 };
  }

  return { ready: ready, optFor: optFor };
})();

window.DossierMapRelief = DossierMapRelief;
