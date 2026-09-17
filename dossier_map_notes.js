/* PLACE NOTES: one short line about a named place, in a callout box with an
   ARROW to the place itself.

   Ziv, 2026-09-17, of the Marib objectives map: *"in the first map do an arrow
   and explain shortly about each of the places in the goals of the Houthis, why
   it is."* The picture already named nine objectives; it did not say what any of
   them IS, so the reader had nine place names and no reason for any of them.

   A NEW FILE, not a new function in dossier_map_extra.js: that file sits at the
   500-line cap every authored file here keeps. What it does NOT hold is the
   search - `DossierMapExtra.kit` hands this file the very same ring search,
   wrap, leader and box helpers the fighting notes use, so a note beside a place
   and a note beside a belt cannot be placed by two different rules.

   Three things differ from the fighting notes, and each is a decision:
     - THE BOX CARRIES THE LINE ALONE, no heading. The place's own label is
       already painted two pixels away with a pin under it; a callout repeating
       it would print every name twice.
     - THE LEADER ENDS IN AN ARROWHEAD at the place. He asked for an arrow. It
       also earns its keep: nine boxes on one frame sit further from their
       places than a fighting note does from its belt, and a plain line at that
       length reads as a border rather than as a pointer.
     - IT SHRINKS BEFORE IT OVERPRINTS. The whole set is placed, measured, and
       if any two boxes overlap the whole set is placed again one text step
       smaller, twice. A note is never dropped and never printed on top of
       another one while making it smaller would have fitted.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapNotes = { draw(ctx, p, P, u, ts, map, taken, W, H, size) }
*/
"use strict";

var DossierMapNotes = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_notes: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }
  function K() {
    var X = window.DossierMapExtra;
    if (!X || !X.kit) {
      throw new Error("dossier_map_notes: dossier_map_extra.js is not on the page");
    }
    return X.kit;
  }

  /* The place's own mark: ground the box may not take and the point the arrow
     aims at. Wider than the pin, because the pin carries a NAME beside it and
     that name is already in `taken` - this is only the dot's own room. */
  var MARK = 7;
  /* Text steps tried, in order, before overprinting is accepted. 1.0 is the
     fighting notes' own note size; two steps down is still legible at the
     17px floor, which is what a 400px phone canvas paints at. */
  var STEPS = [1, 0.88, 0.78];
  var ARROW = 7.5;         /* arrowhead length in u */

  function shapeAt(q, u) {
    var m = MARK * u;
    return { x0: q[0] - m, y0: q[1] - m, x1: q[0] + m, y1: q[1] + m,
             cx: q[0], cy: q[1] };
  }

  /* The arrowhead, at the PLACE end of the leader: two strokes back along the
     line, halo under ink exactly as the line itself is drawn. */
  function head(ctx, P, u, g) {
    var R = D(), dx = g[2] - g[0], dy = g[3] - g[1];
    var len = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx);
    var back = Math.min(ARROW * u, len * 0.4), spread = 0.42;
    var path = function () {
      ctx.beginPath();
      ctx.moveTo(g[2] - Math.cos(a - spread) * back, g[3] - Math.sin(a - spread) * back);
      ctx.lineTo(g[2], g[3]);
      ctx.lineTo(g[2] - Math.cos(a + spread) * back, g[3] - Math.sin(a + spread) * back);
    };
    path(); R.paintShape(ctx, { stroke: P.halo, width: Math.max(3, 3.5 * u) });
    path(); R.paintShape(ctx, { stroke: P.ink, width: Math.max(1.5, 1.8 * u) });
  }

  /* One placement pass at one text size. Returns what it placed and how many
     pairs of boxes overlap, so draw() can decide to try again smaller. Nothing
     is painted here: a pass that loses must leave no ink. */
  function pass(ctx, p, P, u, ts, list, taken, W, H, size, scale) {
    var R = D(), kit = K();
    var noteSize = size * 0.8 * scale;
    var maxW = kit.NOTE_W * u * ts * scale;
    var leaders = [], mine = [], bars = taken.slice(), queue = [];
    list.forEach(function (n) { bars.push(shapeAt(n.q, u)); });
    list.slice().sort(function (a, b) {
      return kit.edgeness(shapeAt(b.q, u), W, H) - kit.edgeness(shapeAt(a.q, u), W, H);
    }).forEach(function (n) {
      var s = shapeAt(n.q, u);
      var lines = kit.wrap(ctx, n.note_he, noteSize, maxW, kit.NOTE_LINES);
      var w = 0, lineH = noteSize * 1.22;
      lines.forEach(function (ln) {
        w = Math.max(w, R.width(ctx, ln, noteSize, 400));
      });
      w += 9 * u;
      var box = kit.findSpot(s, "n", w, lines.length * lineH + noteSize * 0.5,
                             u, bars, taken, mine, leaders, W, H);
      var g = kit.leaderSeg(box, s);
      if (kit.segLen(g) >= 4 * u) leaders.push(g);
      bars.push(box); mine.push(box);
      queue.push({ box: box, g: g, lines: lines, lineH: lineH, size: noteSize });
    });
    var over = 0, i, k;
    for (i = 0; i < queue.length; i++) {
      for (k = i + 1; k < queue.length; k++) {
        if (R.overlaps(queue[i].box, queue[k].box)) over++;
      }
    }
    return { queue: queue, over: over };
  }

  /* Painted AFTER the map's own labels, so `taken` already holds every name,
     the legend box and the title band: a callout goes where nothing else is. */
  function draw(ctx, p, P, u, ts, map, taken, W, H, size) {
    var R = D(), list = ((map || {}).notes || []).map(function (n) {
      return { note_he: n.note_he, q: p(n.lon, n.lat) };
    });
    if (!list.length) return null;
    var best = null, i;
    for (i = 0; i < STEPS.length; i++) {
      best = pass(ctx, p, P, u, ts, list, taken, W, H, size, STEPS[i]);
      if (!best.over) break;
    }
    best.queue.forEach(function (q) {
      if (kitLen(q.g, u)) { leaderOf(ctx, P, u, q.g); head(ctx, P, u, q.g); }
    });
    best.queue.forEach(function (q) {
      var cx = (q.box.x0 + q.box.x1) / 2;
      q.lines.forEach(function (ln, k) {
        R.text(ctx, P, ln, cx, q.box.y0 + q.size * 0.25 + (k + 0.5) * q.lineH,
          { size: q.size, weight: 400, halo: 4 * u, color: P.ink });
      });
      taken.push(q.box);
    });
    return { notes: best.queue.length, overlaps: best.over };
  }
  function kitLen(g, u) { return K().segLen(g) >= 4 * u; }
  function leaderOf(ctx, P, u, g) { K().leader(ctx, P, u, g); }

  return { draw: draw };
})();

window.DossierMapNotes = DossierMapNotes;
