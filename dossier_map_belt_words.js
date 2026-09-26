/* dossier_map_belt_words.js - NO WORD ON A BELT (2026-09-26, MAP_CHECK.md
   rule 12, `word_on_belt`).

   Ziv, of the printed report maps: "no word on a map may sit on anything
   else". The notes already stood off the belts (`note_clash`), but a pin's
   name, a context name, a region or front name and a route label still landed
   on a hatched fighting belt - its fill, its outline, the halo round the
   outline or the heat glow - and every counter said ok, because a belt was
   not ground a word had to walk round.

     window.DossierMapBeltWords = { start, on, push, pull, count, lead,
                                    claimLed, slide, slideHeart, lineBars }

   start      dossier_map.js, just before the ground: this picture's belts in
              canvas px, each with its PAD - the heat glow (GLOW_W 22u / 2 + 1)
              on a scored belt, the outline and its casing on every other one.
   count      the counter, asked by dossier_map_check.js `textPairs` at the
              end of the ink audit: every registered word against every belt,
              exact geometry. On EVERY picture that draws belts.
   push/pull  the belts as rectangles in `taken` (`mark: true`, a strict
              test), from the axis labels (dossier_map_pins.js `lines`) until
              the notes, which keep their own belt bars (dossier_map_notes.js).
   lead       a name whose every near side is on a belt stands just outside
              it with the notes' thin leader to its pin (zone_names oneLabel).
   slide      a belt's diamond and chip that would sit on a route arrow move
              along the belt off the line (legend, ink, heat).

   THE PLACEMENT IS ON FOR THE REPORT MAPS ONLY (`tab: "report"`), the ten
   pictures of the Word report; the counter runs everywhere, so the dump names
   every other picture still to be moved (the brief of 2026-09-26). */
"use strict";

var DossierMapBeltWords = (function () {
  var CELL = 6, EDGE = 3, GLOW = 12;      /* in u: bar cell, outline pad, glow pad */
  var CUR = null, BARS = null, SLID = {};

  function D() { return window.DossierMapDraw; }
  function on() { return !!(CUR && CUR.map.tab === "report" && CUR.belts.length); }

  function polys(g) {
    g = g || {};
    return g.type === "Polygon" ? [g.coordinates]
      : g.type === "MultiPolygon" ? g.coordinates : [];
  }
  /* An arrow as the shared painter bends it (the same sampling as
     dossier_map_note_lines.js `bowed`; that file is not this one's to call). */
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

  function start(map, p, u, G, W, H) {
    CUR = { map: map || {}, p: p, u: u, W: W, H: H, belts: [], arrows: [] };
    BARS = null; SLID = {};
    if (window.DossierMapRoadWords) DossierMapRoadWords.start(u, W, H);  /* the drawn roads, rule 12 */
    if (!map || map.clean || map.fronts === false || !G || !G.fronts || !D()) return;
    var hot = {};
    ((map.heat && map.heat.fronts) || []).forEach(function (r) {
      if (r && r.front && Math.round(r.level) >= 1) hot[r.front] = true;
    });
    D().eachFeature(G.fronts, function (f) {
      var id = (f.properties || {}).id || "?";
      polys(f.geometry).forEach(function (poly) {
        var rings = poly.map(function (r) { return r.map(function (q) { return p(q[0], q[1]); }); });
        var xs = rings[0].map(function (q) { return q[0]; });
        var ys = rings[0].map(function (q) { return q[1]; });
        CUR.belts.push({ id: id, rings: rings, pad: (hot[id] ? GLOW : EDGE) * u,
          bb: { x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys),
                x1: Math.max.apply(null, xs), y1: Math.max.apply(null, ys) } });
      });
    });
    (map.arrows || []).forEach(function (a) {
      var pts = (a.path || []).map(function (c) { return p(c[0], c[1]); });
      if (pts.length >= 2) CUR.arrows.push(a.head === false ? pts : bowed(pts));
    });
  }

  /* ---- geometry ------------------------------------------------------------ */
  function inside(rings, x, y) {
    var ins = false;
    rings.forEach(function (r) {
      for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
        if ((r[i][1] > y) !== (r[j][1] > y) &&
            x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) ins = !ins;
      }
    });
    return ins;
  }
  function segPt(ax, ay, bx, by, x, y) {
    var dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    var t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
    return Math.hypot(ax + t * dx - x, ay + t * dy - y);
  }
  function ptBox(x, y, b) {
    return Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1));
  }
  /* The distance from a segment to a rectangle: 0 when it crosses it. */
  function segBoxDist(a, c, b) {
    if (ptBox(a[0], a[1], b) === 0 || ptBox(c[0], c[1], b) === 0) return 0;
    var L = window.DossierMapLeader;
    if (L && L.segBox && L.segBox([a[0], a[1], c[0], c[1]],
        { x0: b.x0 - 1, y0: b.y0 - 1, x1: b.x1 + 1, y1: b.y1 + 1 })) return 0;
    return Math.min(ptBox(a[0], a[1], b), ptBox(c[0], c[1], b),
      segPt(a[0], a[1], c[0], c[1], b.x0, b.y0), segPt(a[0], a[1], c[0], c[1], b.x1, b.y0),
      segPt(a[0], a[1], c[0], c[1], b.x0, b.y1), segPt(a[0], a[1], c[0], c[1], b.x1, b.y1));
  }
  /* Does this box lie on the belt, its outline or its halo? A pixel of
     shared edge is not a collision (dossier_map_ink.js BITE). */
  function touches(b, bt, extra) {
    var pad = bt.pad + (extra || 0) - 1, k = bt.bb;
    if (b.x0 > k.x1 + pad || b.x1 < k.x0 - pad || b.y0 > k.y1 + pad || b.y1 < k.y0 - pad) return false;
    var cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    if ([[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1], [cx, cy]]
        .some(function (q) { return inside(bt.rings, q[0], q[1]); })) return true;
    return bt.rings.some(function (r) {
      for (var i = 1; i < r.length; i++) if (segBoxDist(r[i - 1], r[i], b) < pad) return true;
      return false;
    });
  }
  function hits(b, extra) {
    return !CUR || !b ? [] : CUR.belts.filter(function (bt) { return touches(b, bt, extra); });
  }

  /* ---- the counter ---------------------------------------------------------- */
  function count(mapId, words) {
    var C = window.DossierMapCheck;
    if (!C || !CUR || !CUR.belts.length) return;
    var bad = [];
    (words || []).forEach(function (w) {
      var h = hits(w.box);
      if (h.length) bad.push(w.tag + " on belt " + h.map(function (bt) { return bt.id; }).join("+"));
    });
    C.add("word_on_belt", bad.length);
    if (bad.length) console.error("dossier map " + (mapId || "?") + ": word_on_belt " + bad.join("; "));
  }

  /* ---- the placement -------------------------------------------------------- */
  /* Every belt as rows of padded cells (dossier_map_focus.js beltBars, with
     the glow's pad), clipped to the canvas. */
  function bars() {
    if (BARS) return BARS;
    BARS = [];
    var u = CUR.u, c = CELL * u, W = CUR.W, H = CUR.H;
    CUR.belts.forEach(function (bt) {
      var k = bt.bb, pad = bt.pad;
      var y0 = Math.max(k.y0 - c, -pad - c), y1 = Math.min(k.y1 + c, H + pad);
      var xa = Math.max(k.x0 - c, -pad - c), xb = Math.min(k.x1 + 2 * c, W + pad + c);
      for (var y = y0; y < y1; y += c) {
        var run = null;
        for (var x = xa; x < xb; x += c) {
          var hit = x < k.x1 + c && [[.5, .5], [0, 0], [1, 0], [0, 1], [1, 1]]
            .some(function (q) { return inside(bt.rings, x + q[0] * c, y + q[1] * c); });
          if (hit && !run) run = { mark: true, belt: true, beltWord: bt.id,
            x0: x - pad, y0: y - pad, x1: x + c + pad, y1: y + c + pad };
          else if (hit) run.x1 = x + c + pad;
          else if (run) { BARS.push(run); run = null; }
        }
        if (run) BARS.push(run);
      }
    });
    return BARS;
  }
  function push(taken) {
    /* the drawn roads first, on every picture that drew one (dossier_map_road_words.js) */
    if (window.DossierMapRoadWords && taken) DossierMapRoadWords.push(taken);
    if (!on() || !taken) return taken;
    bars().forEach(function (b) { taken.push(b); });
    /* and the story road and the route arrows under them: a name moved off a
       belt must not land on the line (hayfan on the amber road, 2026-09-26) */
    lineBars().forEach(function (b) { b.beltWord = "line"; taken.push(b); });
    return taken;
  }
  function pull(taken) {
    for (var i = (taken || []).length - 1; i >= 0; i--) if (taken[i] && taken[i].beltWord) taken.splice(i, 1);
    return taken;
  }

  /* A NAME THAT HAS NO NEAR SIDE OFF THE BELT stands just outside it, with the
     notes' thin leader to its pin (dossier_map_leader.js `paint`). Only for a
     mark within reach of a belt; anything else keeps the old verdict. The
     search walks out from the mark, sixteen directions a ring, and takes the
     first box clear of everything in `taken` whose leader crosses no word. */
  /* Its own pin's boxes (head and stem, on the line from head to tip). */
  function mine(t, a, q) { return t.x0 <= q[0] && q[0] <= t.x1 && t.y1 >= a[1] && t.y0 <= q[1]; }
  /* Diagonals first: a level leader running into the side of a word reads as
     a hyphen in it (seen on al-Zahir, report_bayda_zahir, 2026-09-26). */
  var DIRS = [45, 135, 315, 225, 22, 158, 338, 202, 68, 112, 292, 248, 90, 270, 0, 180];
  function lead(ctx, P, R, l, q, size, clear, o) {
    /* and a report name boxed in by the drawn roads (dossier_map_road_words.js) */
    var RW = window.DossierMapRoadWords, roads = !!(CUR && CUR.map.tab === "report" && RW && RW.list().length);
    if (!(on() || roads) || !l || !l.he || !o || !o.taken) return null;
    var u = CUR.u, W = o.W, H = o.H, Pins = window.DossierMapPins, L = window.DossierMapLeader;
    var g = Pins && Pins.head ? Pins.head(q[0], q[1]) : null;
    var a = g ? [g.cx, g.cy] : q, rim = g ? g.rh + g.out : clear;
    var reach = { x0: a[0] - rim - 30 * u, y0: a[1] - rim - 30 * u, x1: a[0] + rim + 30 * u, y1: q[1] + 30 * u };
    if (!(hits(reach).length || roads && RW.hits(reach).length) || !L) return null;
    var s0 = (l.style && Pins ? Pins : R).place(ctx, l.he, q[0], q[1], "c", size, clear, u, W, H, 0);
    if (!s0 || !s0.box) return null;
    var w = s0.box.x1 - s0.box.x0, h = s0.box.y1 - s0.box.y0, Gap = window.DossierMapGap;
    var words = o.taken.filter(function (t) { return t && !t.mark; });
    var marks = o.taken.filter(function (t) { return t && t.mark && !t.beltWord; });
    /* a town's roads leave fewer sides than a belt: a road-boxed name may walk further */
    for (var r = 8 * u, far = (roads ? 300 : 140) * u; r <= far; r += 3 * u) {
      for (var i = 0; i < DIRS.length; i++) {
        var th = DIRS[i] * Math.PI / 180, dx = Math.cos(th), dy = -Math.sin(th);
        var cx = a[0] + dx * (rim + r + w / 2), cy = a[1] + dy * (rim + r + h / 2);
        var b = { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
        if (b.x0 < 0 || b.y0 < 0 || b.x1 > W || b.y1 > H) continue;
        /* never level with the head: the leader must slope or stand, or it
           reads as a hyphen in the word (al-Zahir, report_bayda_zahir) */
        if (b.y1 > a[1] - rim * 0.6 && b.y0 < a[1] + rim * 0.6) continue;
        if (o.taken.some(function (t) { return Gap ? Gap.clash(R, b, t) : R.overlaps(b, t); })) continue;
        var from = [Math.max(b.x0, Math.min(a[0], b.x1)), Math.max(b.y0, Math.min(a[1], b.y1))];
        var d = Math.hypot(a[0] - from[0], a[1] - from[1]) || 1;
        var to = [a[0] + (from[0] - a[0]) / d * rim, a[1] + (from[1] - a[1]) / d * rim];
        var seg = [from[0], from[1], to[0], to[1]];
        if (words.some(function (t) { return L.segBox(seg, t); })) continue;
        if (marks.some(function (t) { return !mine(t, a, q) && L.segBox(seg, t); })) continue;
        var rt = { pts: [from, to], segs: L.segsOf([from, to]), bend: 0, len: L.lengthOf([from, to]) };
        if (rt.len >= 3 * u) L.paint(ctx, P, u, rt);
        for (var k = 0; k <= 1; k += 0.25) {
          var x = from[0] + (to[0] - from[0]) * k, y = from[1] + (to[1] - from[1]) * k;
          o.taken.push({ mark: true, x0: x - 2 * u, y0: y - 2 * u, x1: x + 2 * u, y1: y + 2 * u });
        }
        return { x: cx, y: cy, align: "center", baseline: "middle", box: b,
                 str: s0.str, size: s0.size, spacing: s0.spacing, led: true };
      }
    }
    return null;
  }
  /* A LED NAME IS NOT BESIDE ITS MARK, so it is not held to adjacency; its
     leader ends on the mark, which claims it as a callout's arrow does. */
  function claimLed(labels) {
    var I = window.DossierMapInk;
    (labels || []).forEach(function (l) {
      if (!l || !l.spec || !l.spec.led) return;
      l.markRect = null;
      if (I && I.numbered) I.numbered(l.pt[0], l.pt[1], false);
    });
  }

  /* ---- the diamond and the chip off a route arrow --------------------------- */
  function arrowDist(x, y) {
    var best = Infinity;
    CUR.arrows.forEach(function (pts) {
      for (var i = 1; i < pts.length; i++) {
        best = Math.min(best, segPt(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], x, y));
      }
    });
    return best;
  }
  function edgeDist(rings, x, y) {
    var best = Infinity;
    rings.forEach(function (r) {
      for (var i = 1; i < r.length; i++) best = Math.min(best, segPt(r[i - 1][0], r[i - 1][1], r[i][0], r[i][1], x, y));
    });
    return best;
  }
  function slide(pt, f) {
    if (!pt || !on() || !CUR.arrows.length) return pt;
    var id = ((f && f.properties) || {}).id || "?", key = id + ":" + Math.round(pt[0]) + ":" + Math.round(pt[1]);
    if (SLID[key]) return SLID[key];
    var u = CUR.u, dr = (window.DossierMapLegend ? DossierMapLegend.markR(u) : 11 * u) + 2 * u;
    var clr = dr + 6 * u;
    if (arrowDist(pt[0], pt[1]) >= clr) { SLID[key] = pt; return pt; }
    var rings = null, area = 0;
    polys((f || {}).geometry).forEach(function (poly) {
      var rs = poly.map(function (r) { return r.map(function (q) { return CUR.p(q[0], q[1]); }); });
      var a = 0, r0 = rs[0];
      for (var i = 0; i < r0.length - 1; i++) a += r0[i][0] * r0[i + 1][1] - r0[i + 1][0] * r0[i][1];
      if (Math.abs(a) > area) { area = Math.abs(a); rings = rs; }
    });
    if (!rings) return pt;
    var xs = rings[0].map(function (q) { return q[0]; }), ys = rings[0].map(function (q) { return q[1]; });
    var st = 2 * u, best = null, bestD = Infinity, loose = null, looseD = Infinity;
    for (var x = Math.min.apply(null, xs); x <= Math.max.apply(null, xs); x += st) {
      for (var y = Math.min.apply(null, ys); y <= Math.max.apply(null, ys); y += st) {
        if (x < dr || y < dr || x > CUR.W - dr || y > CUR.H - dr) continue;
        if (!inside(rings, x, y) || arrowDist(x, y) < clr) continue;
        var d = Math.hypot(x - pt[0], y - pt[1]);
        if (edgeDist(rings, x, y) >= dr * 0.7) { if (d < bestD) { bestD = d; best = [x, y]; } }
        else if (d < looseD) { looseD = d; loose = [x, y]; }
      }
    }
    SLID[key] = best || loose || pt;
    return SLID[key];
  }
  function slideHeart(s, f) {
    if (!s || !on()) return s;
    var c = slide([s.cx, s.cy], f);
    s.cx = c[0]; s.cy = c[1];
    return s;
  }
  /* The route arrows as small boxes, for the chip search (dossier_map_heat.js). */
  function lineBars() {
    var out = [];
    if (!on()) return out;
    var u = CUR.u, half = 6 * u;
    CUR.arrows.forEach(function (pts) {
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (3 * u)));
        for (var k = 0; k <= n; k++) {
          var x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n;
          out.push({ mark: true, x0: x - half, y0: y - half, x1: x + half, y1: y + half });
        }
      }
    });
    return out;
  }

  return { start: start, on: on, push: push, pull: pull, count: count, hits: hits,
           lead: lead, claimLed: claimLed, slide: slide, slideHeart: slideHeart,
           lineBars: lineBars };
})();

window.DossierMapBeltWords = DossierMapBeltWords;
