/* WHERE THE KEY BOX GOES: the four corners, what each of them would cover, and
   the slide along an edge when none of them is free.

   Split out of dossier_map_legend.js on 2026-09-19, when the key learned to
   shrink its own words rather than let a narrow map band clip them and that
   file reached its 500-line cap. The seam is the one this codebase always
   uses, and it is a real one: that file says what the key IS and paints it,
   this one answers only where it may stand. Nothing here was rewritten in the
   move - every measurement and every date below was paid for by a picture that
   had to be looked at.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapCorner = { corner }

   It reaches back into DossierMapDraw for `overlaps` and `eachFeature` and
   into DossierMapLegend for `markR` and `centre` at call time, so the two
   files may load in either order. */
"use strict";

var DossierMapCorner = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_corner: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }
  function L() {
    if (!window.DossierMapLegend) {
      throw new Error("dossier_map_corner: dossier_map_legend.js is not on the page");
    }
    return window.DossierMapLegend;
  }
  function markR(u) { return L().markR(u); }
  function centre(p, geom) { return L().centre(p, geom); }
  function box(x0, y0, x1, y1) { return { x0: x0, y0: y0, x1: x1, y1: y1 }; }

  /* THE LEGEND NEVER COVERS A NAMED PLACE (DOSSIER_LAYERS.md, "Frames"), and a corner
     written into the frame cannot keep that promise: one authored frame is
     drawn at 3:2 on the page and at 16:9 on every slide, and the slide's extra
     longitude moves the ground under a box that does not move with it.
     Measured 2026-09-16, the close-up at 2560x1440: the top-right box spanned
     x 1545-2421, y 68-533; bayda_zahir's belt centre landed at (2375, 515)
     inside it and dali_mareis at (2058, 534) on its lower edge - two hatched
     belts sliced and their red diamonds hidden. The same frame at 3:2 was
     clean, which is why nobody saw it on the page.

     So the corner is chosen PER RENDER: each of the four is scored by what its
     box would cover, and the lowest score wins. The frame's authored `legend`
     only ORDERS the four, so it still decides whenever nothing is covered
     anywhere - the overview keeps bottom-right, the corner its own latitude
     floor was cut for so that Socotra sits wholly under the box.

     What is scored, and what deliberately is not. The fighting belts and their
     diamonds, the assessment arrows and the map's own place labels are named
     places and may never be covered. The shipping lane is NOT scored: it is a
     dashed line over open water, its own name already dodges the box, and
     scoring it would push the legend off the one corner the overview frame was
     cut for.

     THE TITLE IS NO LONGER ONE OF THEM (2026-09-17). It used to be scored
     heaviest of all - a box over the painted heading is not a map problem but
     a broken picture - but no heading is painted into a picture any more: it
     sits above the canvas, as HTML on the page and as a text box on the slide.
     Whatever the caller has already reserved still comes in as `taken` and is
     scored like a place. */
  var CORNERS = { top: ["tr", "br", "tl", "bl"], bottom: ["br", "tr", "bl", "tl"] };
  var W_FRONT = 100, W_ARROW = 80, W_LABEL = 60;

  function inBox(b, q) {
    return q[0] >= b.x0 && q[0] <= b.x1 && q[1] >= b.y0 && q[1] <= b.y1;
  }

  /* Everything the legend box must keep off, as weighted boxes.

     A place label is scored at its POINT and not over its name, because that
     is exactly what the painter can and cannot rescue: a name whose authored
     side falls under the box flips to another side and survives, while a name
     whose own point is under the box has no free side left and is DROPPED, and
     its pin is painted over. Scored over the name instead, the close-up's
     legend read Hodeidah as covered when only the halo of its text grazed the
     corner. */
  function obstacles(u, opt) {
    var R = D(), p = opt.p, G = opt.G || {}, map = opt.map || {}, r = markR(u);
    var out = (opt.taken || []).map(function (b) { return { w: W_FRONT, box: b }; });
    if (!p) return out;
    /* A belt is scored by its own OUTLINE, vertex by vertex, and not by its
       bounding box: a belt is a long thin band lying at whatever angle the
       contact line runs at, so its box can reach into a corner the belt itself
       is nowhere near - which read as a cover and moved the legend for nothing.
       The vertices are a few kilometres apart along a 12 km band, so they
       sample it finely against a box tens of kilometres across. */
    R.eachFeature(G.fronts, function (f) {
      var g = f.geometry || {};
      var polys = g.type === "Polygon" ? [g.coordinates]
        : g.type === "MultiPolygon" ? g.coordinates : [];
      var pts = [];
      polys.forEach(function (poly) {
        poly[0].forEach(function (c) { pts.push(p(c[0], c[1])); });
      });
      if (pts.length) out.push({ w: W_FRONT, hard: true, pts: pts });
      var c = centre(p, g);
      if (c) out.push({ w: W_FRONT, hard: true,
        box: box(c[0] - r, c[1] - r, c[0] + r, c[1] + r) });
    });
    /* A CALLOUT'S OWN PLACE is a hard block too (2026-09-17). The notes are
       placed long after the legend is measured, so the box cannot be scored
       against them - but their POINTS are on the record, and a point under the
       box is a callout that will have to be pushed somewhere worse. */
    (map.notes || []).forEach(function (n) {
      if (typeof n.lon !== "number" || !p.inside(n.lon, n.lat, 0)) return;
      var q = p(n.lon, n.lat), g = 12 * u;
      out.push({ w: W_LABEL, hard: true, box: box(q[0] - g, q[1] - g, q[0] + g, q[1] + g) });
    });
    /* A REQUIRED label's point is a HARD block, the way a callout's is
       (2026-09-19). The key buried Harad's mark on the heat-report picture and
       the picture still read clean: the name was counted as shown because its
       connector names it, and the mark the connector points at was under the
       box. A place the prose promises is a place the reader must be able to
       find, so the key moves off it or the slide says no corner is free. */
    (map.labels || []).forEach(function (l) {
      if (typeof l.lon !== "number" || !p.inside(l.lon, l.lat, 0)) return;
      var q = p(l.lon, l.lat), g = 10 * u;
      out.push({ w: W_LABEL, hard: !!l.req,
                 box: box(q[0] - g, q[1] - g, q[0] + g, q[1] + g) });
    });
    (map.arrows || []).forEach(function (a) {
      var pts = (a.path || []).map(function (c) { return p(c[0], c[1]); });
      for (var i = 1; i < pts.length; i++) {
        for (var t = 0; t <= 8; t++) {
          var x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t / 8;
          var y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t / 8;
          out.push({ w: W_ARROW, box: box(x - 6 * u, y - 6 * u, x + 6 * u, y + 6 * u) });
        }
      }
    });
    return out;
  }

  /* A BELT OR A CALLOUT UNDER THE BOX IS A HARD BLOCK (2026-09-17). Weighing
     them was not enough: on the square heat frame every corner carried some
     cost, the weights came out close, and the box settled on top-left with the
     Harad belt under it - the one thing the scoring exists to prevent, on the
     picture that is about the belts. So a corner covering a named thing loses
     to any corner that covers none, whatever the weights say, and the weights
     then break the tie among equals. If EVERY corner covers something, the one
     covering the fewest wins and the scoring decides between those - the box
     has to go somewhere, and "fewest, then lightest" is the honest order. */
  function corner(L, u, W, H, opt) {
    var R = D(), items = obstacles(u, opt), inset = 14 * u, best = null;
    var top = Math.max(inset, opt.top);
    function at(x0, y0, name) {
      var b = box(x0, y0, x0 + L.w, y0 + L.h), score = 0, hard = 0;
      items.forEach(function (it) {
        var hit = it.pts ? it.pts.some(function (q) { return inBox(b, q); })
          : R.overlaps(b, it.box);
        if (hit) { score += it.w; if (it.hard) hard++; }
      });
      return { box: b, score: score, hard: hard, at: name };
    }
    CORNERS[opt.pref === "top" ? "top" : "bottom"].forEach(function (c) {
      var s = at(c[1] === "r" ? W - inset - L.w : inset,
                 c[0] === "t" ? opt.top : H - inset - L.h, c);
      if (!best || s.hard < best.hard || (s.hard === best.hard && s.score < best.score)) {
        best = s;
      }
    });
    /* AND WHEN NO CORNER IS FREE, THE BOX SLIDES ALONG AN EDGE (2026-09-17).
       A heat key is twelve rows - five of them the scale - and on the square
       country frame that box is 771 x 816 of 2048: measured, all four corners
       cover a belt, so "the least bad corner" still buried Harad under the key
       on the one picture that is about the belts. Sliding it down the left edge
       finds fifteen positions covering nothing at all. This runs ONLY when the
       best corner is not already clean, so every map whose key is clean today
       is untouched to the pixel; a slid box is still pinned to an edge, never
       floating in the middle of the picture. */
    if (!best.hard) return best;
    var slid = null;
    [["l", 0], ["r", 0], ["t", 1], ["b", 1]].forEach(function (e) {
      for (var t = 0; t <= 1.0001; t += 0.05) {
        var x0 = e[1] ? inset + (W - 2 * inset - L.w) * t
          : (e[0] === "r" ? W - inset - L.w : inset);
        var y0 = e[1] ? (e[0] === "b" ? H - inset - L.h : top)
          : top + (H - inset - L.h - top) * t;
        var s = at(x0, y0, best.at);
        /* THE FEWEST HARD HITS, not only a clean one (2026-09-19). On the
           heat-report panel picture nothing along any edge is clean - twelve
           belts and twelve note points on a band 1306 wide - and the search
           therefore gave up and left the key on top of Harad's mark. Fewest
           first, then least covered, so "no clean spot" now means the least bad
           spot instead of the first one tried. */
        if (!slid || s.hard < slid.hard
            || (s.hard === slid.hard && s.score < slid.score)) slid = s;
      }
    });
    if (!slid) return best;
    return (slid.hard < best.hard
            || (slid.hard === best.hard && slid.score < best.score))
      ? slid : best;
  }

  return { corner: corner };
})();

window.DossierMapCorner = DossierMapCorner;
