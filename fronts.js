/* A MARK ON EVERY ACTIVE FIGHTING ZONE, for the board map.

   A zone is a belt on the line of contact, about 12 km wide. That is honest and
   it is also nearly invisible once the whole country is in the window: at the
   default view the belt is a few pixels of hatch. Ziv, 2026-09-15: "make the
   fighting places more like marked or something because it's hard to see them
   on a big map." So each zone also carries a MARK that does not shrink with the
   geography - a diamond, the same one the dossier maps paint, so the board and
   the dossier read as one map.

   Diamond and not a dot, because a dot on this board is a town, and a ring is a
   place with an uncertain position. No new hue: every colour here is spoken for
   by a front, a verdict or a side, so the mark takes the fighting zone's own
   stroke colour and is told apart by SHAPE.

   Split into its own file for the same reason gains.js and labels.js were:
   map.js sits on the 500-line ceiling. NO ES modules - this page runs from
   file:// where they are blocked - so the contract is one global:

     window.MapFronts = {
       wrap(map, geo, layer)   // the fighting layer plus its marks, as one layer
     }

   One layer, because the legend's fighting switch must turn both off together:
   a mark still showing over a hidden belt would point at nothing. */
"use strict";

var MapFronts = (function () {
  /* The centre of a shape's own vertices. For a belt that lands on its
     centreline, which is where the line of contact runs - the one point on the
     shape that is certainly ON the front rather than beside it. */
  function centre(feature) {
    var geom = feature.geometry || {}, best = null, most = 0;
    var polys = geom.type === "Polygon" ? [geom.coordinates]
      : geom.type === "MultiPolygon" ? geom.coordinates : [];
    polys.forEach(function (poly) {
      var ring = poly[0], lon = 0, lat = 0, area = 0, i;
      for (i = 0; i < ring.length - 1; i++) {
        area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
        lon += ring[i][0];
        lat += ring[i][1];
      }
      area = Math.abs(area) / 2;
      if (i && area > most) { most = area; best = [lat / i, lon / i]; }
    });
    return best;
  }

  function wrap(map, geo, layer) {
    var fc = geo && geo.fronts;
    var features = (fc && fc.features) || [];
    if (!features.length) return layer;
    var parts = layer ? [layer] : [];
    features.forEach(function (feature) {
      var point = centre(feature);
      if (!point) return;
      parts.push(L.marker(point, {
        pane: "geoLabel",
        /* The diamond is an INNER element: Leaflet writes its own transform on
           the icon container to position it, which would overwrite a rotate. */
        icon: L.divIcon({ className: "front-mark", html: "<i></i>",
                          iconSize: [12, 12], iconAnchor: [6, 6] }),
        interactive: false,
        keyboard: false
      }));
    });
    return parts.length > 1 ? L.layerGroup(parts) : layer;
  }

  return { wrap: wrap };
})();

window.MapFronts = MapFronts;
