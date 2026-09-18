/* The dossier maps' KEY and the marks that must be read at any scale: the
   legend box (measured before anything is placed, painted after everything
   else), the red diamond every active-fighting zone carries, and the plain
   picture's zone names.

   Split out of dossier_map_draw.js on 2026-09-15, when the relief raster, the
   fighting notes and the assessment arrows took that file past its 500-line
   cap. Same bargain as the first split: dossier_map.js owns the frames, the
   projection and the palette, and looks this file up at paint time, so the
   three painter files may load in any order as long as all of them are on the
   page before the view draws. `zoneNames` came across from dossier_map_extra.js
   on 2026-09-16 and went on to dossier_map_zone_names.js on 2026-09-17, when
   the hard-block corner scoring and the road swatch took this file to its cap.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapLegend = { legendLayout, paintLegend, frontMarks,
                                 diamond, markR }

   It reaches back into DossierMapDraw at call time for the shared helpers
   (hatch, width, setFont, paintShape, dashOf, eachFeature), into
   DossierMapGains for the gains swatch and into DossierMapHeat for the
   fighting scale that replaces the one fighting-zone row on a heat map; the
   Hebrew words it prints are handed in by dossier_map.js, which is where they
   are authored beside the palette. */
"use strict";

var DossierMapLegend = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_legend: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  function box(x0, y0, x1, y1) { return { x0: x0, y0: y0, x1: x1, y1: y1 }; }

  /* ---- the fighting-zone mark ---------------------------------------------- */

  /* A DIAMOND ON EVERY FIGHTING ZONE (2026-09-15). A belt is 12 km wide, which
     is five pixels once the whole country is on one canvas, and Ziv could not
     find them: "make the fighting places more like marked or something because
     it's hard to see them on a big map." So each zone also carries a mark that
     does NOT shrink with the geography - a diamond, floored so it reads at any
     scale. Diamond and not a dot, because a dot on this board is a town.
     RED, and the one place this board takes a new hue: every other colour
     answers which front or how well confirmed, this one answers where it is
     happening now. The first pass obeyed the no-new-hue rule and Ziv came back
     with "make it a color that stands out... so people see it fast".

     6.6 (floor 7) on the day it was built and 11 (floor 11) since 2026-09-15:
     he asked for the red marks bigger again, having seen them on the whole
     country. The legend's own swatch follows at 0.8 of it, so the key and the
     map keep showing the same mark.

     Drawn at the average of the shape's own vertices, which for a belt sits on
     its centreline - the one point certainly ON the line rather than beside it. */
  var MARK_R = 11, MARK_MIN = 11;

  function markR(u) { return Math.max(MARK_MIN, MARK_R * u); }

  function diamond(ctx, x, y, r, style) {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath();
    D().paintShape(ctx, style);
  }

  /* The centre of a front's biggest ring, in canvas pixels, or null. */
  function centre(p, geom) {
    var polys = geom.type === "Polygon" ? [geom.coordinates]
      : geom.type === "MultiPolygon" ? geom.coordinates : [];
    var best = null, area = 0;
    polys.forEach(function (poly) {
      var ring = poly[0], sx = 0, sy = 0, a = 0, i;
      for (i = 0; i < ring.length - 1; i++) {
        var q = p(ring[i][0], ring[i][1]), n = p(ring[i + 1][0], ring[i + 1][1]);
        a += q[0] * n[1] - n[0] * q[1];
        sx += q[0]; sy += q[1];
      }
      a = Math.abs(a) / 2;
      if (a > area && i) { area = a; best = [sx / i, sy / i]; }
    });
    return best;
  }

  function frontMarks(ctx, p, P, u, G) {
    var r = markR(u);
    D().eachFeature(G.fronts, function (f) {
      var best = centre(p, f.geometry || {});
      if (!best) return;
      diamond(ctx, best[0], best[1], r + Math.max(2, 2 * u), { fill: P.halo });
      diamond(ctx, best[0], best[1], r, { fill: P.frontMark,
        stroke: P.halo, width: Math.max(1.5, 1.5 * u) });
    });
  }

  /* ---- which corner the legend takes ---------------------------------------- */

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
    (map.labels || []).forEach(function (l) {
      if (typeof l.lon !== "number" || !p.inside(l.lon, l.lat, 0)) return;
      var q = p(l.lon, l.lat), g = 10 * u;
      out.push({ w: W_LABEL, box: box(q[0] - g, q[1] - g, q[0] + g, q[1] + g) });
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
        if (s.hard) continue;
        if (!slid || s.score < slid.score) slid = s;
      }
    });
    return slid || best;
  }

  /* ---- the legend box ------------------------------------------------------- */

  /* NO GAINS, NO GAINS ROW (2026-09-18). The dossier's window is the last five
     days, so a window in which nothing changed hands carries an EMPTY `gains`
     list and the painter draws no violet anywhere - while the key went on
     naming it, which is the one thing every rule about this key forbids: a row
     naming a colour that is not on the picture sends the reader hunting for it.
     Same rule the merged map and the heat scale already keep, now kept against
     the data instead of against a flag on the record.

     Read off the DOSSIER global at call time, the way dossier_map_relief.js
     reads it, so nothing had to be threaded through the opt the caller builds.
     `gains` is the whole dossier's list and not this frame's: a gain off the
     frame is a gain the map does not draw either, but it is also one the reader
     may find on the picture beside it, and the key is the same key on all of
     them. Empty is the case this answers, and empty is empty everywhere. */
  function hasGains() {
    var D0 = (typeof DOSSIER !== "undefined" && DOSSIER) ? DOSSIER : null;
    return !!(D0 && D0.gains && D0.gains.length);
  }

  /* MEASURED before any label is placed, so its box counts as taken ground for
     the governorate names and the lane name, and PAINTED last so it sits over
     everything. Its CORNER is chosen here too, by the scoring above - `opt.top`
     is the y a top corner takes (the line under the painted title) and
     `opt.pref` is the frame's own preference, which now only breaks a tie. A
     key and nothing else: the strait-width notes that once sat under it were
     "not relevant" (Ziv, 2026-09-11), and the build now refuses a map note.
     Everything scales with the row text.

     `opt.arrows` adds the assessment row, and only the Aden map has it. The
     RELIEF variant adds no row at all: terrain under the same picture is said
     by the caption under the canvas, and a legend that grows for a second
     picture of the same ground would be a key to the paper, not to the map. */
  function legendLayout(ctx, P, u, W, H, hasLanes, words, opt) {
    var R = D(), k = opt.size / 17;
    var L = { size: opt.size, k: k, pad: 12 * k, sw: 26 * k, gap: 9 * k };
    L.rowH = L.size * 1.55;
    /* A CLEAN map draws no territory, no fighting belts and no line of contact,
       so it is given none of their rows: a key to something that is not on the
       picture is noise, and on the crossing map it would be five rows of it.
       What is left is what this layer's own painters hand back below - the
       route and the ports.

       A MERGED one draws three of those five again and takes back exactly three
       rows (2026-09-17): the two territories and the boundary between them.
       There is no GAINS row on it and that is the point - Ziv asked for the new
       ground to read as "just part of the Houthis", so a row telling the reader
       to look for a separate colour would name a colour that is not there. */
    var control = [
      { fill: P.houthi, label: words.houthi },
      { fill: P.gov, label: words.gov },
      { line: P.control, dash: R.dashOf(P.controlDash, u), width: P.controlW * u,
        label: words.front }
    ];
    var gained = hasGains()
      ? [{ gain: window.DossierMapGains.gainStyle(P, u), label: words.gained }] : [];
    L.rows = !opt.clean ? [
      control[0], control[1],
      { fill: P.contested, hatch: R.hatch(ctx, P.contestedStroke, u),
        stroke: P.contestedStroke,
        dash: [3 * u, 3 * u], width: u, mark: true, label: words.contested }
    ].concat(gained, [control[2]]) : opt.control === "merged" ? control : [];
    if (hasLanes) {
      L.rows.push({ line: P.lane, dash: [8 * u, 6 * u], width: 2 * u, label: words.lane });
    }
    /* THE SWATCH SHOWS THE MARK THAT IS ON THE MAP (2026-09-17). An axis drawn
       along a road is a DOTTED run of beads, not a solid shaft, so a solid
       swatch beside it sends the reader looking for a line that is not there.
       All-or-nothing on purpose: a map mixing the two keeps the plain swatch,
       because a key cannot show two marks on one row. */
    if (opt.arrows) {
      var ax = (opt.map && opt.map.arrows) || [];
      L.rows.push({ arrow: true, label: words.axis,
        dots: ax.length > 0 && ax.every(function (a) { return !!a.road; }) });
    }
    /* Routes, measures, zones, the marker a label chose and a map that says it
       is a CLAIM each bring their own row, built by the file that paints them
       (dossier_map_routes.js) - a row carries its own `draw`, so nothing here
       has to learn a swatch it does not own. A row appears only when the map
       carries the thing it names. */
    if (window.DossierMapRoutes) {
      L.rows = L.rows.concat(DossierMapRoutes.legendRows(ctx, P, u, opt.map));
    }
    /* A HEAT map's key is a SCALE: dossier_map_heat.js takes the one fighting-
       zone row out and puts its five steps in the same place, because on that
       picture the belts are not one colour and a key must never name a colour
       that is not on the map. Nothing else about the key changes. */
    if (opt.map && opt.map.heat && window.DossierMapHeat) {
      L.rows = DossierMapHeat.legendRows(P, u, opt.map, L.rows);
    }
    /* No rows, no box. Only a clean map can reach this, and an empty key drawn
       anyway would be a white rectangle floating in a corner. */
    if (!L.rows.length) return null;
    var textW = Math.max.apply(null, L.rows.map(function (r) {
      return R.width(ctx, r.label, L.size, 500);
    }));
    L.w = Math.min(W * 0.44, Math.max(textW + L.sw + L.gap, 220 * u) + 2 * L.pad);
    L.h = 2 * L.pad + L.rows.length * L.rowH;
    var pick = corner(L, u, W, H, opt);
    L.at = pick.at; L.cover = pick.score; L.hard = pick.hard;
    L.x0 = pick.box.x0; L.x1 = pick.box.x1; L.y0 = pick.box.y0;
    L.box = pick.box;
    return L;
  }

  /* The swatch for the assessment row: the same halo-under-red stroke and the
     same filled head the axes are drawn with, laid flat across the swatch box,
     so the key shows the mark rather than describing it. */
  function arrowSwatch(ctx, P, u, x, y, w, dots) {
    var R = D(), head = Math.min(9 * u, w * 0.45), half = head * 0.5;
    if (dots) {
      /* THREE BEADS AND THE HEAD, the road axis's own mark. */
      var r = Math.max(1.6, 2.1 * u), run = w - head, i;
      for (i = 0; i < 3; i++) {
        R.ringMark(ctx, x + run * (i + 0.5) / 3, y, r + Math.max(1, u),
          { fill: P.halo });
        R.ringMark(ctx, x + run * (i + 0.5) / 3, y, r, { fill: P.frontMark });
      }
    } else {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w - head, y);
      R.paintShape(ctx, { stroke: P.halo, width: Math.max(3, 5 * u) });
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w - head, y);
      R.paintShape(ctx, { stroke: P.frontMark, width: Math.max(2, 3 * u) });
    }
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w - head, y - half);
    ctx.lineTo(x + w - head, y + half);
    ctx.closePath();
    R.paintShape(ctx, { fill: P.frontMark });
  }

  function paintLegend(ctx, P, u, L) {
    var R = D();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(L.x0, L.y0, L.w, L.h, 10 * L.k);
    else ctx.rect(L.x0, L.y0, L.w, L.h);
    R.paintShape(ctx, { fill: P.box, stroke: P.boxLine, width: Math.max(1, u) });
    var y = L.y0 + L.pad, sh = 16 * L.k;
    L.rows.forEach(function (r) {
      var cy = y + L.rowH / 2, sx = L.x1 - L.pad - L.sw, sy = cy - sh / 2;
      if (r.draw) {
        r.draw(ctx, P, u, sx, cy, L.sw, sh);
      } else if (r.arrow) {
        arrowSwatch(ctx, P, u, sx, cy, L.sw, r.dots);
      } else if (r.line) {
        ctx.beginPath(); ctx.moveTo(sx, cy); ctx.lineTo(sx + L.sw, cy);
        R.paintShape(ctx, { stroke: r.line, width: r.width, dash: r.dash });
      } else {
        /* Land under the fill, so the swatch is the colour the map shows; a
           hairline edge, because the government wash is a dark step that
           would otherwise vanish into the box. */
        ctx.beginPath(); ctx.rect(sx, sy, L.sw, sh);
        R.paintShape(ctx, { fill: P.land });
        if (r.hatch) {
          R.paintShape(ctx, { fill: r.fill });
          R.paintShape(ctx, { fill: r.hatch });
        }
        ctx.beginPath(); ctx.rect(sx, sy, L.sw, sh);
        R.paintShape(ctx, r.gain || { fill: r.hatch ? null : r.fill,
          stroke: r.stroke || P.boxLine,
          width: r.width || Math.max(1, u), dash: r.dash });
        if (r.mark) {
          diamond(ctx, sx + L.sw / 2, cy, markR(u) * 0.8,
            { fill: P.frontMark, stroke: P.halo, width: Math.max(1, u) });
        }
      }
      R.setFont(ctx, L.size, 500);
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillStyle = P.ink; ctx.fillText(r.label, sx - L.gap, cy);
      y += L.rowH;
    });
  }

  /* ---- MOVED OUT ------------------------------------------------------------
     The plain picture's zone names left for dossier_map_zone_names.js on
     2026-09-17, when the hard-block corner scoring and the road swatch took
     this file past the 500-line cap. Nothing about the search changed.
     ------------------------------------------------------------------------ */

  return { legendLayout: legendLayout, paintLegend: paintLegend,
           frontMarks: frontMarks, diamond: diamond, markR: markR };
})();

window.DossierMapLegend = DossierMapLegend;
