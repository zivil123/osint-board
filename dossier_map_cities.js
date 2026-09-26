/* THE CITY PATCHES - `city_streets: true` on a record (2026-09-26).

   Ziv, of the al-Jawf front map: "El Khazem, it looks like completely desert,
   you know, but like it's a city there. So maybe put... like what we did with
   the Najran, maybe put like kind of the cities so you can see them." And
   then: "when you put cities, put how they actually look." So each town the
   report maps name is its REAL outline and streets, in the look the record
   picks with `city_look`: "plan" (light grey, white streets - the default),
   "photo" (the satellite town, lifted) or "photo_streets" (photo + streets).

   The picture is BUILT, not drawn here: scripts\relief_cities.py writes
   docs\relief\cities\<frame>_<look>.webp (a sub-folder: relief_prep.py
   prunes any docs\relief\*.webp that is not a frame) from data\city_patches.json,
   data\city_shapes.json and the Esri imagery - transparent except the towns,
   on EXACTLY the frame's terrain grid - and lists each file with its hash in
   docs\relief\cities.json as {frame: {look: {file, hash}}}. So this file only loads it and draws
   it into a copy of the terrain picture, pixel for pixel.

   Where it sits: INSIDE THE TERRAIN (2026-09-26, second pass). Laid over the
   ground as an under-layer (order 10) it covered what ground() had already
   painted - the line of contact through Taiz, the belt hatching, a front's
   diamond. So DossierMapRelief.optFor is wrapped here: for a record with the
   field it hands ground() the terrain picture with the patches already drawn
   into it (one offscreen copy per frame, same grid, kept). The town is then
   ground like the relief: clipped to the coast, washed by the control fills,
   and under every belt, line, mark and word. Light theme only: the tint is
   chosen for the light terrain; the dark one draws without it.

   Loading: DossierMap.ready(theme) asks window.DossierMapRelief.ready at call
   time, so it is wrapped here to wait for the patch pictures too - the same
   "load once, keep" rule, and the same file:// skip (an image taints the
   canvas there). A picture that will not load costs the patches, never the
   map. A record without the field moves no pixel. */
(function () {
  "use strict";

  var INDEX = "relief/cities.json";
  var img = {}, wait = null;

  /* TEST HOOK: `?city_streets=id,id` sets the field IN MEMORY on those records,
     so a picture can be proved before any record carries it (the data file is
     another helper's). Nothing on the board passes it. */
  var asked = (/[?&]city_streets=([^&#]*)/.exec(location.search) || [])[1];
  function lookOf(m) { return m.city_look || "plan"; }
  function wanted() {
    var D = typeof DOSSIER !== "undefined" && DOSSIER ? DOSSIER : null, seen = {};
    if (asked && D) {
      decodeURIComponent(asked).split(",").forEach(function (id) {
        (D.maps || []).forEach(function (m) { if (m.id === id) m.city_streets = true; });
      });
    }
    (D && D.maps || []).forEach(function (m) {
      if (m.frame && m.city_streets === true) seen[m.frame + "|" + lookOf(m)] = true;
    });
    return Object.keys(seen);
  }

  function loadOne(key, entry) {
    return new Promise(function (resolve) {
      var pic = new Image();
      pic.onload = function () { img[key] = pic; resolve(); };
      pic.onerror = function () {
        console.warn("dossier_map_cities: the patch picture did not load: " + entry.file);
        resolve();
      };
      pic.src = entry.file + (entry.hash ? "?v=" + entry.hash : "");
    });
  }

  /* `force` lets a test that sets city_streets in memory after page load ask
     again: the first call found no record carrying the field. */
  function load(force) {
    if (wait && !force) return wait;
    var frames = wanted();
    if (!frames.length || location.protocol === "file:" || typeof fetch !== "function") {
      wait = Promise.resolve(false);
      return wait;
    }
    wait = fetch(INDEX, { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (index) {
        return Promise.all(frames.map(function (key) {
          var fl = key.split("|"), entry = index[fl[0]] && index[fl[0]][fl[1]];
          return entry && entry.file && !img[key] ? loadOne(key, entry) : null;
        }));
      })
      .then(function () { return true; })
      .catch(function (e) {
        console.warn("dossier_map_cities: no patch index: " + e);
        return false;
      });
    return wait;
  }

  var R = window.DossierMapRelief;
  if (R && typeof R.ready === "function") {
    var inner = R.ready;
    R.ready = function (theme) {
      return Promise.all([inner.call(R, theme), load(false)])
        .then(function (both) { return both[0]; });
    };
  }

  /* The terrain with the patches in it, one per frame and wash; null if either
     picture is missing.
     COUNTER-WASH: ground() lays the control fills over the terrain at `fade`
     (0.66 on a report map), which would cut the town plan's contrast to a third
     and leave a ghost. So each patch pixel c is pre-set to (c - w*F) / (1 - w),
     F the light control fill that pixel will be washed with, and after the wash
     it lands on the colour relief_cities.py chose. F is read per pixel off the
     Houthi zones laid on the terrain grid (a mean of the two left Taiz's
     government half a cold blue and its Houthi half brown). A map that paints
     no fill gets w = 0. After a 0.66 wash nothing lands darker than about 140
     or lighter than about 227: the builder keeps every colour in that band. */
  var FILL = { houthi: [198, 188, 174], gov: [227, 232, 237] };  /* light #C6BCAE, #E3E8ED */
  function houthiGrid(W, H, b) {
    var m = document.createElement("canvas"), mg, G = typeof GEO !== "undefined" ? GEO : null;
    m.width = W; m.height = H; mg = m.getContext("2d");
    var sx = W / (b[2] - b[0]), sy = H / (b[3] - b[1]);
    mg.fillStyle = "#000";
    ((G && G.control_zones && G.control_zones.features) || []).forEach(function (f) {
      if (!f.geometry || (f.properties || {}).control !== "houthi") return;
      var polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates]
        : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
      mg.beginPath();
      polys.forEach(function (poly) {
        poly.forEach(function (ring) {
          ring.forEach(function (c, i) {
            var x = (c[0] - b[0]) * sx, y = (b[3] - c[1]) * sy;
            if (i) mg.lineTo(x, y); else mg.moveTo(x, y);
          });
          mg.closePath();
        });
      });
      mg.fill("evenodd");
    });
    return mg.getImageData(0, 0, W, H).data;
  }
  var baked = {};
  function bake(fl, terrain, w, bounds) {
    var pic = img[fl], key = fl + "@" + w;
    if (!pic || !terrain || !terrain.width) return null;
    var hit = baked[key];
    if (hit && hit.src === terrain) return hit.canvas;
    var c = document.createElement("canvas");
    c.width = terrain.naturalWidth || terrain.width;
    c.height = terrain.naturalHeight || terrain.height;
    var g = c.getContext("2d"), t = document.createElement("canvas");
    t.width = c.width; t.height = c.height;
    var tg = t.getContext("2d");
    tg.drawImage(pic, 0, 0, t.width, t.height);    /* same bounds, same grid */
    if (w > 0 && w < 1) {
      var d = tg.getImageData(0, 0, t.width, t.height), a = d.data, i, k, F;
      var hz = bounds && bounds.length > 3 ? houthiGrid(t.width, t.height, bounds) : null;
      for (i = 0; i < a.length; i += 4) {
        if (!a[i + 3]) continue;
        F = hz && hz[i + 3] > 127 ? FILL.houthi : FILL.gov;
        for (k = 0; k < 3; k++) a[i + k] = (a[i + k] - w * F[k]) / (1 - w);
      }
      tg.putImageData(d, 0, 0);
    }
    g.drawImage(terrain, 0, 0, c.width, c.height);
    g.drawImage(t, 0, 0);
    baked[key] = { src: terrain, canvas: c };
    return c;
  }

  if (R && typeof R.optFor === "function") {
    var innerOpt = R.optFor;
    R.optFor = function (map, theme, variant) {
      var o = innerOpt.call(R, map, theme, variant);
      if (!o || !o.img || !map || map.city_streets !== true || theme !== "light") return o;
      /* the wash ground() will lay: none where it paints no holder fill */
      var bare = map.tribes === true || (map.clean && map.control !== "merged");
      var c = bake(map.frame + "|" + lookOf(map), o.img, bare ? 0 : (o.fade || 0), o.bounds);
      if (c) o.img = c;
      return o;
    };
  }

  window.DossierMapCities = { load: load, loaded: function () { return Object.keys(img); } };
}());
