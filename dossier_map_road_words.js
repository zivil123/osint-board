/* dossier_map_road_words.js - NO WORD ON A ROAD (2026-09-26, MAP_CHECK.md
   rule 12, `word_on_road`).

   Ziv's standing ask: no word on a map may sit on anything else. The main
   roads went YELLOW (dossier_map_roadnet.js, an under-layer) and on
   report_taiz_kadaha one ran straight through the pin name "Jabal Habashi"
   while the check said over_text 0: the drawn road lines never registered, so
   neither a placer nor the check could see them.

     window.DossierMapRoadWords = { start, add, push, count, list }

   start  dossier_map_belt_words.js `start`, once per picture before the ground.
   add    every road line as it is DRAWN, in canvas px, with its half-width
          (ink plus its dark edge): the network (roadnet `paint`, only the
          classes that frame draws) and the story road (pins `line`).
   push   the lines as small `mark: true` boxes in `taken`, from the axis labels
          until the labels are painted (belt_words `push` / `pull`, tag
          `beltWord: "road"`), so every word placed in between picks a side off
          them - pin names, place names, notes, zone and region names, route
          labels. A town's grey patch is ground, not a line: a word may sit on it.
   count  the counter, from dossier_map_check.js `textPairs` at the end of the
          ink audit: every registered word box against every drawn road line,
          exact segment geometry. Filed at zero on every picture that drew a
          road, so the line is the evidence the rule RAN. */
"use strict";

var DossierMapRoadWords = (function () {
  var CUR = { u: 1, W: 0, H: 0, lines: [] };

  function start(u, W, H) { CUR = { u: u || 1, W: W || 0, H: H || 0, lines: [] }; }
  /* pts: [[x, y], ...] in canvas px; hw: half the drawn width, edge included. */
  function add(pts, hw, what) {
    if (pts && pts.length >= 2) CUR.lines.push({ pts: pts, hw: hw || 1, what: what || "road" });
  }
  function list() { return CUR.lines; }

  /* Does the segment a-b, thickened by hw, touch the box? Liang-Barsky
     against the box grown by hw (a square cap: a hair stricter at the corners). */
  function segHits(a, b, hw, t) {
    var x0 = t.x0 - hw, y0 = t.y0 - hw, x1 = t.x1 + hw, y1 = t.y1 + hw;
    var dx = b[0] - a[0], dy = b[1] - a[1], lo = 0, hi = 1;
    var P = [-dx, dx, -dy, dy], Q = [a[0] - x0, x1 - a[0], a[1] - y0, y1 - a[1]];
    for (var i = 0; i < 4; i++) {
      if (P[i] === 0) { if (Q[i] < 0) return false; continue; }
      var r = Q[i] / P[i];
      if (P[i] < 0) { if (r > hi) return false; if (r > lo) lo = r; }
      else { if (r < lo) return false; if (r < hi) hi = r; }
    }
    return lo <= hi;
  }
  function hits(box) {
    if (!box) return [];
    /* A word's box edge that only grazes the line is not a road through it. */
    var t = { x0: box.x0 + 1, y0: box.y0 + 1, x1: box.x1 - 1, y1: box.y1 - 1 };
    return CUR.lines.filter(function (l) {
      for (var i = 1; i < l.pts.length; i++) if (segHits(l.pts[i - 1], l.pts[i], l.hw, t)) return true;
      return false;
    });
  }

  /* Chunks of each segment, each chunk's box grown by the half-width, kept to
     the canvas. A chunk no longer than ~3 half-widths keeps a diagonal's box
     from claiming much ground beside the line. */
  function push(taken) {
    if (!taken || !CUR.lines.length) return taken;
    var W = CUR.W, H = CUR.H, m = 20 * CUR.u;
    CUR.lines.forEach(function (l) {
      var hw = l.hw, step = Math.max(3 * hw, 4);
      for (var i = 1; i < l.pts.length; i++) {
        var a = l.pts[i - 1], b = l.pts[i];
        if (W && H && (Math.max(a[0], b[0]) < -m || Math.min(a[0], b[0]) > W + m ||
            Math.max(a[1], b[1]) < -m || Math.min(a[1], b[1]) > H + m)) continue;
        var n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
        for (var k = 0; k < n; k++) {
          var xa = a[0] + (b[0] - a[0]) * k / n, ya = a[1] + (b[1] - a[1]) * k / n;
          var xb = a[0] + (b[0] - a[0]) * (k + 1) / n, yb = a[1] + (b[1] - a[1]) * (k + 1) / n;
          taken.push({ mark: true, beltWord: "road", road: true,  /* no `ink`: not a registry mark */
            x0: Math.min(xa, xb) - hw, y0: Math.min(ya, yb) - hw,
            x1: Math.max(xa, xb) + hw, y1: Math.max(ya, yb) + hw });
        }
      }
    });
    return taken;
  }

  function count(mapId, words) {
    var C = window.DossierMapCheck;
    if (!C || !CUR.lines.length) return 0;
    var bad = [];
    (words || []).forEach(function (w) {
      var h = hits(w.box);
      if (h.length) bad.push(w.tag + " on " + h.map(function (l) { return l.what; })
        .filter(function (s, i, a) { return a.indexOf(s) === i; }).join("+"));
    });
    C.add("word_on_road", bad.length);
    if (bad.length) console.error("dossier map " + (mapId || "?") + ": word_on_road " + bad.join("; "));
    return bad.length;
  }

  return { start: start, add: add, push: push, count: count, list: list, hits: hits };
})();

window.DossierMapRoadWords = DossierMapRoadWords;
