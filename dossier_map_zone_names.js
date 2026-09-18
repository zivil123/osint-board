/* THE PLAIN PICTURE'S ZONE NAMES: the Hebrew name of every active-fighting
   zone, set inside its band where the band can hold it and beside it where it
   cannot.

   It came out of dossier_map_extra.js into dossier_map_legend.js on 2026-09-16
   and out of that file on 2026-09-17, when the legend's hard-block corner
   scoring and the road swatch took it past the 500-line cap. It has always been
   one self-contained search with one caller, which is why it is the piece that
   travels.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapZoneNames = { zoneNames }

   dossier_map.js merges it into the one painter object the paint pass is
   handed, so `R.zoneNames(...)` there reads exactly as it did before the split.
   The shared helpers come from DossierMapDraw at call time. */
"use strict";

var DossierMapZoneNames = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_zone_names: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  var SIDES = ["n", "s", "e", "w"];
  function box(x0, y0, x1, y1) { return { x0: x0, y0: y0, x1: x1, y1: y1 }; }

  /* Heights across a shape, tried widest-run first. A name is allowed to reach a
     little past the ground it names (FIT) - cartography does that everywhere -
     but a run much narrower than the word means the shape is too small to hold
     it at this scale, and then this returns null and the caller sets the name
     beside the shape instead. */
  var LEVELS = [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65], FIT = 0.8;

  /* The widest run of the shape's OWN ground at one height, and the midpoint of
     it - an interior point by construction, so the name lands inside the shape
     however bent it is (a centroid does not: a crescent's is outside it). */
  function fitInRing(ring, w, h, W, H, taken) {
    var R = D();
    var ys = ring.map(function (q) { return q[1]; });
    var top = Math.min.apply(null, ys), bottom = Math.max.apply(null, ys);
    return LEVELS.map(function (t) {
      var y = top + (bottom - top) * t, xs = [];
      for (var i = 0; i < ring.length - 1; i++) {
        var a = ring[i], b = ring[i + 1];
        if ((a[1] > y) !== (b[1] > y)) {
          xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
        }
      }
      xs.sort(function (m, n) { return m - n; });
      var span = 0, cx = 0;
      for (var k = 0; k + 1 < xs.length; k += 2) {
        if (xs[k + 1] - xs[k] > span) { span = xs[k + 1] - xs[k]; cx = (xs[k] + xs[k + 1]) / 2; }
      }
      return { x: cx, y: y, span: span, box: box(cx - w / 2, y - h / 2, cx + w / 2, y + h / 2) };
    }).sort(function (a, b) { return b.span - a.span; }).filter(function (s) {
      return s.span >= w * FIT && s.box.x0 >= 0 && s.box.x1 <= W &&
        s.box.y0 >= 0 && s.box.y1 <= H &&
        !taken.some(function (t) { return R.overlaps(s.box, t); });
    })[0] || null;
  }

  /* The zones the legend calls שטח לחימה פעיל carry their own names, read from
     GEO.fronts (data\fronts.json) at paint time - never from a label list, so
     whatever that file says is what gets named and nobody has to remember to
     edit a second one.

     Every front carries a REAL HEBREW NAME as a required field, which is why
     this has no "unnamed" branch. It used to read a contested DISTRICT's
     name_he and fall back to a dossier gain's, leaving a contested district that
     was not also a gain with no name at all - geo.js carries geoBoundaries'
     English shapeName, and there is no English on this map ever (CLAUDE.md).

     No dot: this names an area, exactly as a country name does, and it is set a
     weight lighter than a town so the two never read as the same kind of thing.

     A name goes INSIDE its shape when the shape can hold it, and BESIDE it when
     it cannot. The inside-only version was written when a front was a whole
     district; since 2026-09-14 a front is a narrow band of sourced contact about
     12 km wide sitting on the control line, and no Hebrew name fits inside a
     band that thin at any scale this map is drawn at.

     And a shape whose projected bounding box is under 40*u across its diagonal
     keeps quiet: on the overview the frame spans 14 degrees of longitude, where
     the smaller bands are a few pixels of hatching and a name on them would
     shout louder than the thing it names.

     This is the PLAIN picture's treatment. The notes variant in
     dossier_map_extra.js replaces it outright - there the name is the heading of
     a callout and the shape is named whatever its size, because a front with
     nothing written at it is the one thing that picture exists to prevent.

     AND `zone_text: false` SILENCES THIS TOO (2026-09-17). Ziv asked the strait
     picture for marks only, no text on the map except place names, and a front
     name is not a place name: "front of al-Qadhah" is a description of what is
     happening on ground the map already names. The flag came in for the map's
     own zone labels (dossier_map_routes.js) and reached only those, so three
     front names stayed on the picture - one of them clipped by the right rim at
     2560. One flag, every painted name that is not a place: the diamonds and
     the hatching stay, because a mark is not a word. */
  function zoneNames(ctx, p, P, u, W, H, G, size, taken, map) {
    if (map && map.zone_text === false) return;
    var R = D();
    ((G.fronts && G.fronts.features) || []).forEach(function (f) {
      var name = (f.properties || {}).name_he;
      if (!name) return;
      var geom = f.geometry || {}, ring = null, area = 0;
      var polys = geom.type === "Polygon" ? [geom.coordinates]
        : geom.type === "MultiPolygon" ? geom.coordinates : [];
      polys.forEach(function (poly) {
        var r = poly[0].map(function (c) { return p(c[0], c[1]); }), a = 0;
        for (var i = 0; i < r.length - 1; i++) {
          a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
        }
        a = Math.abs(a) / 2;
        if (a > area) { area = a; ring = r; }
      });
      if (!ring) return;
      var xs = ring.map(function (q) { return q[0]; });
      var ys = ring.map(function (q) { return q[1]; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      var bw = x1 - x0, bh = y1 - y0;
      if (Math.sqrt(bw * bw + bh * bh) < 40 * u) return;
      var spot = fitInRing(ring, R.width(ctx, name, size, 500), size * 1.25, W, H, taken);
      if (spot) {
        R.text(ctx, P, name, spot.x, spot.y, { size: size, weight: 500, halo: 3 * u });
        taken.push(spot.box);
        return;
      }
      /* Beside the band: from the middle of its bounding box, cleared by half
         that box on the axis it is leaving, so the name sits off the hatching
         rather than along it. A side that runs off the canvas or lands on a name
         already placed is passed over, and a name with no free side is dropped -
         the same bargain the town names make. */
      var mx = (x0 + x1) / 2, my = (y0 + y1) / 2, spec = null;
      SIDES.some(function (a) {
        var clear = (a === "n" || a === "s") ? bh / 2 : bw / 2;
        var s = R.place(ctx, name, mx, my, a, size, clear, u, W, H), b = s.box;
        var free = !taken.some(function (t) { return R.overlaps(b, t); }) &&
          b.x0 >= 0 && b.x1 <= W && b.y0 >= 0 && b.y1 <= H;
        if (free) spec = s;
        return free;
      });
      if (!spec) return;
      R.text(ctx, P, spec.str, spec.x, spec.y, { size: size, weight: 500,
        halo: 3 * u, align: spec.align, baseline: spec.baseline });
      taken.push(spec.box);
    });
  }

  return { zoneNames: zoneNames };
})();

window.DossierMapZoneNames = DossierMapZoneNames;
