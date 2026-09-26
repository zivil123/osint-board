/* THE LINES A NOTE MAY NOT STAND ON (2026-09-26).

   Ziv, of the Word report maps: *"you see how the text is on other stuff. Make
   sure that it's not on other stuff."* Rule 12 made the callout notes
   (dossier_map_notes.js) stand off marks, words, the key box and the belt
   hatching - but a LINE was still free ground: on report_taiz_kadaha a note
   lay on the amber story road, on report_jawf_hazm_east note 1's disc sat on
   the dashed line of contact. Nothing measured it, so every counter said ok.

   This file turns the picture's drawn lines into what the note search already
   understands - rectangles - and answers the counter's exact question.

   HARD lines (a note's box and disc never stand on them): the story road and
   every arrow (`map.arrows`, the arrow's bow sampled as the painter bends it),
   the line of contact and the gains seam (the dashed territory lines) and the
   coast / country edge. A belt's outline is inside the belt bars already
   (DossierMapFocus.beltBars pads over its stroke).
   SOFT lines (a note may stand on them only where no clear spot is within
   reach, and then they pass behind its halo): the quiet main roads
   (`map.roads: "main"`, dossier_map_roadnet.js) and the governorate borders.

   READ FROM THE GEOMETRY, NOT FROM THE PAINTERS: the lines are projected here
   off GEO and the record exactly as ground(), the pins painter and the roads
   layer draw them, so no painter had to change and the notes' search holds
   the same line whichever order the picture is painted in.

   THE BARS ARE STRIPS, THE COUNTER IS EXACT. The search takes each line as
   thin boxes round its stroke and a unit of air (`strips`) - conservative, so
   a box the search calls clean really is.
   `hits` asks the painted note box against the sampled line itself, half its
   stroke width off, so the count never fires on a near miss.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapNoteLines = { build(p, u, G, map, W, H), FAIL }
*/
"use strict";

var DossierMapNoteLines = (function () {
  var STRIP = 12;          /* a strip's short side, in u */
  var WIN = 0.4;           /* strips kept this far (of the long side) from a note */
  var STEP = 1.5;          /* sampling step along a line, in u */
  /* Half the painted width of each kind, in u, with a unit of air. */
  var HALF = { road: 5, arrow: 4.5, contact: 2, seam: 2,
               coast: 1.5, roadnet: 2.5, border: 1.2 };
  /* What the note_clash counter fails a note for (MAP_CHECK.md rule 12). */
  var FAIL = { road: 1, arrow: 1, contact: 1, seam: 1 };

  function D() { return window.DossierMapDraw; }

  /* Every ring or line of a feature collection, as lon/lat point arrays. */
  function paths(fc) {
    var out = [];
    if (!fc || !D()) return out;
    D().eachFeature(fc, function (f) {
      var g = f.geometry || {}, c = g.coordinates || [];
      if (g.type === "LineString") out.push(c);
      else if (g.type === "MultiLineString" || g.type === "Polygon") c.forEach(function (r) { out.push(r); });
      else if (g.type === "MultiPolygon") c.forEach(function (poly) { poly.forEach(function (r) { out.push(r); }); });
    });
    return out;
  }

  /* An arrow as the shared painter bends it (dossier_map_extra.js axisPath):
     quadratic pieces from midpoint to midpoint, each pulled towards its
     vertex. Sampled with the vertex itself as the control - the painter
     clamps the bow, so the true curve lies between this and the chord, and
     the pad covers the difference. */
  function bowed(pts) {
    if (pts.length < 3) return pts;
    var out = [pts[0]], from = pts[0], i, t;
    for (i = 1; i < pts.length - 1; i++) {
      var c = pts[i], to = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
      for (t = 0.125; t <= 1.0001; t += 0.125) {
        var a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t;
        out.push([a * from[0] + b * c[0] + d * to[0], a * from[1] + b * c[1] + d * to[1]]);
      }
      from = to;
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function build(p, u, G, map, W, H) {
    map = map || {};
    var lines = [];    /* { kind, pts (canvas px), half } */
    function add(kind, pts) {
      if (pts && pts.length >= 2) lines.push({ kind: kind, pts: pts, half: HALF[kind] * u });
    }
    function geo(kind, ring) { add(kind, ring.map(function (q) { return p(q[0], q[1]); })); }
    (map.arrows || []).forEach(function (a) {
      var pts = (a.path || []).map(function (c) { return p(c[0], c[1]); });
      if (a.head === false) add("road", pts); else add("arrow", bowed(pts));
    });
    if (G) {
      var merged = map.control === "merged", clean = !!map.clean;
      if (!clean || merged) paths(G.control_line).forEach(function (r) { geo("contact", r); });
      var gm = map.gains || (merged ? "seam" : map.gains_fill === true ? "tint" : "none");
      if (gm !== "none") paths(G.gains_seam).forEach(function (r) { geo("seam", r); });
      /* THE COAST is hard, a LAND border soft: the country outlines carry
         both, so their samples on a land border (nbr_borders) are dropped
         below and the land border itself goes in as a soft line. */
      paths(G.yem_adm0).concat(paths(G.sau_adm0),
        paths(G.nbr_coasts || G.nbr_adm0)).forEach(function (r) { geo("coast", r); });
      paths(G.nbr_borders).forEach(function (r) {
        var n = lines.length; geo("border", r); if (lines[n]) lines[n].land = true;
      });
      paths(G.yem_adm1).concat(paths(G.sau_adm1)).forEach(function (r) { geo("border", r); });
    }
    var RN = window.DossierMapRoadnet;
    if (map.roads === "main" && RN && RN.lines) {
      RN.lines().forEach(function (l) {
        var pts = [];
        for (var i = 0; i < l.p.length; i += 2) pts.push(p(l.p[i], l.p[i + 1]));
        add("roadnet", pts);
      });
    }
    /* Sample every line once, off-canvas pieces dropped. */
    var margin = 20 * u, step = STEP * u;
    lines.forEach(function (ln) {
      var s = [];
      for (var i = 1; i < ln.pts.length; i++) {
        var a = ln.pts[i - 1], b = ln.pts[i];
        var n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
        for (var k = i === 1 ? 0 : 1; k <= n; k++) {
          var x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n;
          if (x > -margin && y > -margin && x < W + margin && y < H + margin) s.push(x, y);
        }
      }
      ln.s = s;
    });
    var land = {}, lc = 4 * u;
    lines.forEach(function (ln) {
      if (!ln.land) return;
      for (var i = 0; i < ln.s.length; i += 2) land[Math.floor(ln.s[i] / lc) + ":" + Math.floor(ln.s[i + 1] / lc)] = 1;
    });
    lines.forEach(function (ln) {
      if (ln.kind !== "coast") return;
      var keep = [];
      for (var i = 0; i < ln.s.length; i += 2) {
        var gx = Math.floor(ln.s[i] / lc), gy = Math.floor(ln.s[i + 1] / lc), on = false;
        for (var dx = -1; dx <= 1 && !on; dx++) for (var dy = -1; dy <= 1 && !on; dy++) on = land[(gx + dx) + ":" + (gy + dy)];
        if (!on) keep.push(ln.s[i], ln.s[i + 1]);
      }
      ln.s = keep;
    });
    var hard = lines.filter(function (l) { return HALF[l.kind] && l.kind !== "roadnet" && l.kind !== "border"; });
    var soft = lines.filter(function (l) { return l.kind === "roadnet" || l.kind === "border"; });
    var near = (map.notes || []).filter(function (n) { return n.lon != null; })
      .map(function (n) { return p(n.lon, n.lat); });
    return { hard: strips(hard, u, near, W, H), soft: strips(soft, u, near, W, H),
             hits: function (box) { return hits(lines, box); }, count: lines.length };
  }

  /* Each line as STRIPS: samples gathered while their box stays thin (its
     short side at most STRIP u), then padded by half the stroke. A straight
     run is one long bar, a diagonal one a chain of small squares - a few
     hundred bars a picture, where one per grid cell was thousands and the
     search tries every bar at every spot (16 s a phone draw, measured).
     Only strips within WIN of a note's place are kept: the search looks near
     its place first, and a far spot on a line is still counted. */
  function strips(lines, u, near, W, H) {
    var out = [], k = STRIP * u, gap = 3 * STEP * u, win = WIN * Math.max(W, H);
    function flush(c, ln) {
      if (!c) return;
      var b = { line: ln.kind, x0: c.x0 - ln.half, y0: c.y0 - ln.half,
                x1: c.x1 + ln.half, y1: c.y1 + ln.half };
      var cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      if (!near.length || near.some(function (q) { return Math.hypot(q[0] - cx, q[1] - cy) < win; })) out.push(b);
    }
    lines.forEach(function (ln) {
      var s = ln.s, c = null, px, py;
      for (var i = 0; i < s.length; i += 2) {
        var x = s[i], y = s[i + 1];
        if (c && Math.hypot(x - px, y - py) <= gap) {
          var x0 = Math.min(c.x0, x), x1 = Math.max(c.x1, x), y0 = Math.min(c.y0, y), y1 = Math.max(c.y1, y);
          if (Math.min(x1 - x0, y1 - y0) <= k) { c = { x0: x0, y0: y0, x1: x1, y1: y1 }; px = x; py = y; continue; }
          flush(c, ln);   /* the new strip starts at the last sample */
          c = { x0: Math.min(px, x), y0: Math.min(py, y), x1: Math.max(px, x), y1: Math.max(py, y) };
        } else {
          flush(c, ln); c = { x0: x, y0: y, x1: x, y1: y };
        }
        px = x; py = y;
      }
      flush(c, ln);
    });
    return out;
  }

  /* The kinds of line that run through a box: a sample within half the
     stroke of it. Exact enough for a count, and it never fires on air. */
  function hits(lines, box) {
    var out = [];
    lines.forEach(function (ln) {
      if (out.indexOf(ln.kind) >= 0) return;
      var h = ln.half - 1, s = ln.s;
      for (var i = 0; i < s.length; i += 2) {
        if (s[i] > box.x0 - h && s[i] < box.x1 + h && s[i + 1] > box.y0 - h && s[i + 1] < box.y1 + h) {
          out.push(ln.kind); return;
        }
      }
    });
    return out;
  }

  return { build: build, FAIL: FAIL };
})();

window.DossierMapNoteLines = DossierMapNoteLines;
