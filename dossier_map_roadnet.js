/* THE MAIN ROADS - `roads: "main"` on a record (2026-09-26).

   Ziv, on the Word report's maps: the main roads on every one, "even if it's
   not part of the story"; then, the same day: "put the actual roads in the
   maps... I don't see the roads, roads should be in yellow". So the network is
   YELLOW on a thin dark edge (a road atlas's main roads), trunk heaviest, then
   primary, then secondary. On a country-wide frame (more than WIDE_DEG of
   longitude, i.e. report_overview) secondary is left off: at that scale it is
   a mesh, not a road.

   Where it sits: registered into DossierMapUnder (dossier_map_under.js) at
   order 20 (the city patches take 10), which paintMap calls right after the
   ground and the gains - over the terrain, the control fills and the belts'
   hatch, under the zones, pins, arrows, notes and every word. A word's halo
   covers it, and it never enters the ink registry or a leader's `taken` list,
   so no counter reads it as "a line over a word". The story road
   (`arrows[].head: false`, dossier_map_pins.js) is deeper orange and about
   twice a trunk's width, so it still reads first.

   Print size: the Word report paints the page call at 58 CSS px per printed
   cm, about 11 cm wide, so u (= W / 1280) is ~0.5 there. Every width has a
   floor in CSS px so a secondary road is still a clear yellow line on paper
   (1.5 px ink ~0.26 mm, plus its edge) and grows with u on the slides.

   Data: ROADS_MAP_GEO (docs\roads_map_geo.js, made by
   scripts\roads_map_prep.py from the HOTOSM OSM export, ODbL) - lines of
   {c: "t"|"p"|"s", p: [lon, lat, lon, lat, ...]}. Not the Roads tab's file. */
(function () {
  "use strict";

  /* Per class: ink width in u, its CSS px floor. Drawn secondary first. */
  var CLASSES = { s: [2.2, 1.5], p: [2.8, 1.8], t: [3.5, 2.2] };
  var ORDER = ["s", "p", "t"], WIDE_DEG = 4;
  var EDGE_W = 1.4, EDGE_FLOOR = 1.0;          /* dark edge: added to the ink, both sides */
  /* Ink tuned on the sand relief: a pure #FFD23F washed out on the pale
     plains (worst on the grey hills), so a touch deeper; the classes read by width. */
  var INK = {
    light: { t: "#FFC20E", p: "#FFCA2A", s: "#FFD23F" },
    dark: { t: "#FFD23F", p: "#FFD84F", s: "#F2D570" }
  };
  var EDGE = { light: "rgba(58,44,20,0.78)", dark: "rgba(4,12,22,0.80)" };

  var cache = null;
  /* The lines, each with its lon/lat box, built once. */
  function lines() {
    if (cache) return cache;
    /* A top-level `const`, so it is NOT a window property: read it by name. */
    var G = typeof ROADS_MAP_GEO !== "undefined" ? ROADS_MAP_GEO : null;
    cache = [];
    if (!G || !G.lines) return cache;
    G.lines.forEach(function (l) {
      if (!CLASSES[l.c] || !l.p || l.p.length < 4) return;
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (var i = 0; i < l.p.length; i += 2) {
        x0 = Math.min(x0, l.p[i]); x1 = Math.max(x1, l.p[i]);
        y0 = Math.min(y0, l.p[i + 1]); y1 = Math.max(y1, l.p[i + 1]);
      }
      cache.push({ c: l.c, p: l.p, box: [x0, y0, x1, y1] });
    });
    return cache;
  }

  /* Lines whose box, projected, touches the band (a little margin for the
     edge). The projector is monotone in lon and lat, so the box's corners
     bound the line. */
  function inFrame(p, W, H, pad) {
    return lines().filter(function (l) {
      var a = p(l.box[0], l.box[1]), b = p(l.box[2], l.box[3]);
      var xa = Math.min(a[0], b[0]), xb = Math.max(a[0], b[0]);
      var ya = Math.min(a[1], b[1]), yb = Math.max(a[1], b[1]);
      return xb >= -pad && xa <= W + pad && yb >= -pad && ya <= H + pad;
    });
  }

  function stroke(ctx, p, list, c, colour, width) {
    ctx.beginPath();
    list.forEach(function (l) {
      if (l.c !== c) return;
      for (var i = 0; i < l.p.length; i += 2) {
        var q = p(l.p[i], l.p[i + 1]);
        if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
      }
    });
    ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke();
  }

  /* Degrees of longitude the canvas spans, from the projector itself. */
  function spanDeg(p, W) {
    var a = p(45, 15), b = p(46, 15), per = Math.abs(b[0] - a[0]);
    return per > 0 ? W / per : 0;
  }

  function paint(ctx, p, P, u, map, W, H) {
    if (!map || map.roads !== "main") return;
    var theme = P && P.theme === "dark" ? "dark" : "light";
    var ink = {}, edge = Math.max(EDGE_FLOOR, EDGE_W * u);
    ORDER.forEach(function (c) { ink[c] = Math.max(CLASSES[c][1], CLASSES[c][0] * u); });
    var list = inFrame(p, W, H, 4 * ink.t);
    if (W && spanDeg(p, W) > WIDE_DEG) list = list.filter(function (l) { return l.c !== "s"; });
    if (!list.length) return;
    if (W && H) { ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); }
    ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.setLineDash([]);
    /* Every edge first, then every ink, so where two roads meet the edge of
       one never cuts the other. Secondary under primary under trunk. */
    ORDER.forEach(function (c) { stroke(ctx, p, list, c, EDGE[theme], ink[c] + edge); });
    ORDER.forEach(function (c) { stroke(ctx, p, list, c, INK[theme][c], ink[c]); });
    /* The drawn lines register, so words stand off them (dossier_map_road_words.js). */
    var RW = window.DossierMapRoadWords;
    if (RW) list.forEach(function (l) {
      var pts = [];
      for (var i = 0; i < l.p.length; i += 2) pts.push(p(l.p[i], l.p[i + 1]));
      RW.add(pts, (ink[l.c] + edge) / 2, "road " + l.c);
    });
  }

  if (window.DossierMapUnder) DossierMapUnder.add("roads", 20, paint);
  window.DossierMapRoadnet = { paint: paint, lines: lines };
}());
