/* The ground that changed hands inside the board's window, ringed on the map.

   The one thing a control map cannot say on its own: a district taken last week
   and a district held since 2014 are painted the identical colour, so a reader
   looking for "what did they just conquer" has nothing to look at. This layer is
   that answer - the recently taken ground, outlined and dated.

   Split into its own file because map.js sits on its 500-line ceiling, the same
   reason filters.js, cluster.js and icons.js came out of it. NO ES modules - this
   page runs from file://, where they are blocked - so the contract is one global:

     window.MapGains = {
       build({ map, geo, add })   // returns the layer, already added, or null
     }

   `add` is map.js's own addGeo, so the shape is built with the same canvas
   renderer and the same interactive:false as every other geography layer -
   geography must never swallow a marker click. The shape comes from geo.js,
   where geo_prep.py has already dissolved the gains into ONE outline.

   Told apart by density, never by a new hue: every colour on this board is
   spoken for by a front or a verdict. The international border is a solid heavy
   line and the front line is a 6-4 dash, so this takes the free texture - a fine
   dot - over a fill one step brighter than the ground it sits on.

   `esc`, `ltr` come from app.js and are only read inside build(), which map.js
   calls after every script has loaded. */
"use strict";

var MapGains = (function () {
  var PANE = "geoGain";
  var labelMark = null;
  var host = null;

  function cssVar(name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim();
  }
  function cssNum(name, fallback) {
    var n = parseFloat(cssVar(name));
    return isNaN(n) ? fallback : n;
  }

  function style() {
    return {
      stroke: true,
      color: cssVar("--geo-gain-line") || "#E6EDF5",
      weight: cssNum("--geo-gain-w", 2.6),
      dashArray: cssVar("--geo-gain-dash") || "3 4",
      fill: true,
      fillColor: cssVar("--geo-gain-fill") || "rgba(233, 240, 248, 0.22)",
      fillOpacity: 1
    };
  }

  /* The anchor is the WEST edge of the biggest piece, level with its middle, and
     the label hangs westward from it out over the water (map.css pins its right
     edge to the point). Printed on the ground it names, it is covered by the first
     attack cluster that lands near it - the pins are drawn above every label pane
     on this map, and this coast is where the pins are. Hanging it seaward keeps
     the ring it belongs to touching its start, with nothing on top. */
  function anchor(fc) {
    var best = null, bestSize = -1;
    fc.features.forEach(function (feature) {
      var geom = feature.geometry;
      var polygons = geom.type === "MultiPolygon"
        ? geom.coordinates : [geom.coordinates];
      polygons.forEach(function (polygon) {
        var ring = polygon[0];
        var west = ring[0][0], east = west, south = ring[0][1], north = south;
        ring.forEach(function (point) {
          west = Math.min(west, point[0]); east = Math.max(east, point[0]);
          south = Math.min(south, point[1]); north = Math.max(north, point[1]);
        });
        var size = (east - west) * (north - south);
        if (size > bestSize) {
          bestSize = size;
          best = [(south + north) / 2,
                  west - Math.max(0.12, (east - west) * 0.18)];
        }
      });
    });
    return best;
  }

  function dayMonth(iso) {
    var parts = String(iso).split("-");
    return Number(parts[2]) + "." + Number(parts[1]);
  }

  /* "Taken" plus WHEN, because the date is the whole claim - a ring with no date
     on it says only that something is different, not that it is new. */
  function labelHtml(list) {
    var dates = list.map(function (gain) { return gain.date; })
      .filter(Boolean).sort();
    if (!dates.length) return "";
    var first = dayMonth(dates[0]);
    var last = dayMonth(dates[dates.length - 1]);
    return "<b>" + esc("נכבש ") +
      ltr(first === last ? first : first + "–" + last) + "</b>";
  }

  function labelText() {
    var el = labelMark && labelMark.getElement();
    return el ? el.querySelector("b") : null;
  }

  /* Bounded by the pane, like everything else that floats inside it. The label
     hangs out to sea from the coast, and on a phone the whole country is 345px
     wide - there is no sea left in the pane to hang it over, so it ran off the
     edge and printed half a word. A label that cannot sit clear of all four edges
     is not drawn; zoom in and the room appears, so it comes back on its own. */
  function fits(box, pane) {
    return box.left >= pane.left + 6 && box.right <= pane.right - 6 &&
           box.top >= pane.top + 6 && box.bottom <= pane.bottom - 6;
  }

  function place() {
    var text = labelText();
    if (!text || !host) return;
    var el = text.parentElement;
    el.style.visibility = "";
    var pane = host.getContainer().getBoundingClientRect();
    if (fits(text.getBoundingClientRect(), pane)) return;
    /* Out of room to seaward, and there is nowhere else for it to go. Hung inland
       instead it lands on the far side of the country - measured on a phone, the
       date printed over Aden while the ring it belongs to was on the west coast,
       which points at the wrong place rather than saying nothing. */
    el.style.visibility = "hidden";
  }

  /* The box the label occupies, for labels.js to keep clear. Empty whenever the
     layer is switched off or the label does not fit, so room is never held for
     something nobody can see. */
  function boxes() {
    var text = labelText();
    if (!text) return [];
    place();
    if (text.parentElement.style.visibility === "hidden") return [];
    var box = text.getBoundingClientRect();
    return [{ left: box.left - 4, right: box.right + 4,
              top: box.top - 3, bottom: box.bottom + 3 }];
  }

  /* The pane is created here rather than in map.js's PANE_Z table, which has no
     free integer left between the territory fill and the district lines. It
     takes the fill's own z-index and is created later, so it lands after it in
     the DOM and draws on top of it - and still UNDER every boundary line and
     under the front line, which stay the last word about where a side ends. */
  function build(ctx) {
    var fc = ctx.geo && ctx.geo.recent_gains;
    if (!fc || !fc.features || !fc.features.length) return null;
    if (!ctx.map.getPane(PANE)) {
      ctx.map.createPane(PANE).style.zIndex = "351";
    }
    var shape = ctx.add(fc, PANE, style);
    if (!shape) return null;
    var parts = [shape];
    var point = anchor(fc);
    var html = labelHtml(ctx.geo.recent_gains_list || []);
    if (point && html) {
      labelMark = L.marker(point, {
        pane: "geoLabel",
        icon: L.divIcon({ className: "gain-label", html: html, iconSize: [0, 0] }),
        interactive: false,
        keyboard: false
      });
      parts.push(labelMark);
      /* The governorate names give way to this one, not the other way round: it
         is the new information and they are the background. Registered here so
         map.js needs no line for it - labels.js only reads the getter at draw
         time, so the order the two layers are built in does not matter. */
      if (window.MapLabels && MapLabels.reserve) MapLabels.reserve(boxes);
      /* Its own handler, so map.js needs no line for it - and so the fit is
         re-checked even when the governorate names are switched off and
         labels.js's own pass returns early. */
      host = ctx.map;
      ctx.map.on("zoomend moveend resize", place);
      setTimeout(place, 0);
    }
    /* One group, so the legend's single switch takes the ring and its date
       together - a dated label floating over ground with no ring around it would
       be the map saying something it no longer shows. */
    return L.layerGroup(parts).addTo(ctx.map);
  }

  return { build: build, boxes: boxes, place: place };
})();

window.MapGains = MapGains;
