/* THE UNDER-LAYERS - a registry for layers painted with the GROUND (2026-09-26).

   paintMap (dossier_map.js) calls DossierMapUnder.draw once per picture, right
   after the ground (terrain, control fills, belts, borders, line of contact)
   and the gains, and BEFORE the zones, sea routes, marks, pins, arrows, notes
   and every word. So whatever registers here sits under all the ink: a word's
   halo covers it, and no counter treats it as "a line over a word" - those
   counters measure only the leaders, connectors and routes that route round
   text. It is ground: overlay mode (exportLayers) keeps it in the base.

   Register once, at load:
       DossierMapUnder.add("roads", 20, function (ctx, p, P, u, map, W, H) {...});
   `order` sorts the calls, low first (city patches 10, main roads 20). Each fn
   decides from `map` (the record) whether it draws at all - a record without
   its field must not move one pixel. `p(lon, lat)` -> [x, y] in band px; `u`
   is the band width / 1280; W, H the band. A fn that throws is logged and
   skipped, so one broken layer never blanks a picture. */
var DossierMapUnder = (function () {
  "use strict";

  var layers = [];

  function add(name, order, fn) {
    if (typeof fn !== "function") throw new Error("DossierMapUnder.add: " + name + " has no fn");
    layers = layers.filter(function (l) { return l.name !== name; });
    layers.push({ name: name, order: +order || 0, fn: fn, seq: layers.length });
    layers.sort(function (a, b) { return a.order - b.order || a.seq - b.seq; });
  }

  function draw(ctx, p, P, u, map, W, H) {
    if (!map) return;
    layers.forEach(function (l) {
      ctx.save();
      try { l.fn(ctx, p, P, u, map, W, H); } catch (e) {
        if (window.console) console.warn("DossierMapUnder: " + l.name + " failed: " + e);
      }
      ctx.restore();
    });
  }

  function names() { return layers.map(function (l) { return l.name; }); }

  return { add: add, draw: draw, names: names };
}());
