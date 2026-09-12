/* The governorate names printed on the map, and the collision pass that decides
   which of them fit at the current zoom.

   Split out of map.js when that file reached its 500-line ceiling. NO ES modules -
   this page runs from file://, where they are blocked - so the contract is one global:

     window.MapLabels = {
       build({ map, geo, pane }),   // returns the layer, already added to the map
       place(),                     // re-run the fit after a zoom or a resize
       reserve(getter)              // boxes another layer has already claimed
     }

   The names and their anchor points are baked into geo.js by scripts/geo_prep.py.
   `esc` comes from app.js and is only read inside build(), which map.js calls after
   every script has loaded. */
"use strict";

var MapLabels = (function () {
  var map = null;
  var layer = null;
  var marks = [];
  var claimed = null;

  /* One Hebrew name per governorate (and per Saudi region in the frame), on the
     anchor point geo_prep.py placed - checked to lie inside the area itself, so a
     crescent-shaped governorate never wears its name in its neighbour's ground.
     With the sub-district mesh gone, this is what a reader orients by. */
  function build(context) {
    map = context.map;
    var fc = context.geo && context.geo.labels;
    if (!fc || !fc.features || !fc.features.length) return null;
    marks = fc.features.map(function (feature) {
      var point = feature.geometry.coordinates;
      return {
        span: feature.properties.span || 0,
        home: feature.properties.set === "yem_adm1" ? 0 : 1,
        marker: L.marker([point[1], point[0]], {
          pane: context.pane,
          icon: L.divIcon({
            className: "gov-label",
            html: "<b>" + esc(feature.properties.name_he) + "</b>",
            iconSize: [0, 0]
          }),
          interactive: false,
          keyboard: false
        })
      };
    });
    /* Yemen first, then biggest area first: the board is about Yemen, so a Saudi
       region never takes the room a governorate needed, and inside each country the
       greedy pass below gives it to Hadhramaut before Raymah rather than to
       whichever happened to be listed first. */
    marks.sort(function (a, b) {
      return a.home - b.home || b.span - a.span;
    });
    layer = L.layerGroup(marks.map(function (m) { return m.marker; })).addTo(map);
    return layer;
  }

  /* Room another layer has already taken on the map. A governorate name is the
     background and the label over the recently taken ground is the new
     information, so the name is the one that gives way. The getter is read at
     draw time, never stored as boxes, because a stale rectangle would hold room
     the label has since left. */
  function reserve(getter) {
    claimed = (typeof getter === "function") ? getter : null;
  }

  function boxesOverlap(a, b) {
    return !(a.right < b.left || b.right < a.left ||
             a.bottom < b.top || b.bottom < a.top);
  }

  /* Leaflet has no label engine, so this is the whole of it: show every name,
     measure the boxes, and hide any that lands on a name already kept. Eight
     governorates share three degrees in the western highlands - without this they
     print on top of each other at the opening zoom. Zooming in makes room, and the
     ones that were dropped come back on their own. */
  function place() {
    if (!layer || !map || !map.hasLayer(layer)) return;
    var kept = (claimed ? claimed() : []) || [];
    marks.forEach(function (mark) {
      var el = mark.marker.getElement();
      var text = el && el.querySelector("b");
      if (!text) return;
      el.style.visibility = "";
      /* The icon itself is a zero-size anchor - the name is the absolutely
         positioned <b> inside it, so that is what has a box to measure. */
      var box = text.getBoundingClientRect();
      box = { left: box.left - 3, right: box.right + 3,
              top: box.top - 2, bottom: box.bottom + 2 };
      var clash = kept.some(function (other) { return boxesOverlap(box, other); });
      if (clash) el.style.visibility = "hidden";
      else kept.push(box);
    });
  }

  return { build: build, place: place, reserve: reserve };
})();

window.MapLabels = MapLabels;
