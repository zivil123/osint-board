/* PLACE NOTES: one short line about a named place, in a callout box with an
   ARROW to the place itself.

   Ziv, 2026-09-17, of the Marib objectives map: *"in the first map do an arrow
   and explain shortly about each of the places in the goals of the Houthis, why
   it is."* The picture already named nine objectives; it did not say what any of
   them IS, so the reader had nine place names and no reason for any of them.

   THIS IS THE PICTURE THE RECORD CALLS `key: "callouts"`. Ziv saw the nine
   boxes on the map and answered "too much text", so the notes now come two
   ways and the map record says which: `key: "panel"` puts a numbered disc at
   each place and the reading in a panel beside the map
   (dossier_map_key.js), and `key: "callouts"` is this file. The field replaced
   a `note_arrows` bool that nothing ever set - one field, two pictures, and no
   flag that can be true for both.

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
     fighting notes' own note size - one step under the map's own place names,
     which is what a callout beside a named place should be.
     EIGHT STEPS AND NOT THREE (2026-09-17): the step also narrows the wrap
     width, so a smaller box is smaller in both directions and the ring search
     has more room at every one. Nine callouts on the Marib frame overlapped at
     three steps on the SQUARE picture, where the map area is 2048 wide against
     a 16:9 height and the nine objectives cluster in its middle; the whole set
     is placed again at each step and the BEST pass wins, not the last one, so
     a step that happens to be worse can never be what gets painted. */
  var STEPS = [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.45];
  var ARROW = 7.5;         /* arrowhead length in u */
  /* HOW FAR OFF THE CANVAS RIM A BOX MUST STAY (2026-09-17). `fits` in the
     shared kit only asks that a box be INSIDE the canvas, which put two of the
     nine Marib callouts flush against the top edge - 7px of 1440 on the slide
     and 3.6px of 692 on the page, so the halo was cut and the top-right one
     read as a heading painted into the picture, which is the one thing Ziv
     asked those maps not to have. The inset is fed to the search as four edge
     BARS, local to this painter, so the fighting notes' own measured placement
     is untouched. 14 at BASE_W is 36px on a slide: clear of the 4u halo and
     under the 16u inset the legend and the scale bar already keep. */
  var RIM = 14;
  var REPORT = null;       /* what the last draw() measured - read in console */

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
    var rim = RIM * u;
    bars.push({ x0: 0, y0: 0, x1: W, y1: rim });
    bars.push({ x0: 0, y0: H - rim, x1: W, y1: H });
    bars.push({ x0: 0, y0: 0, x1: rim, y1: H });
    bars.push({ x0: W - rim, y0: 0, x1: W, y1: H });
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
    var over = 0, cross = 0, i, k;
    for (i = 0; i < queue.length; i++) {
      for (k = i + 1; k < queue.length; k++) {
        if (R.overlaps(queue[i].box, queue[k].box)) over++;
      }
      /* AND HOW MANY LEADERS RUN THROUGH SOMEBODY ELSE'S TEXT (2026-09-17).
         The search already refuses a box whose own leader crosses a box placed
         BEFORE it, and a box that an earlier leader would cross - but the ones
         placed after it are not yet known, so the last callouts' leaders could
         still be drawn across the first ones' sentences. Nothing here can fix
         that inside one pass; what it can do is COUNT it, so draw() can keep
         the text step whose whole set reads cleanly instead of the first step
         that merely stopped the boxes overlapping. */
      for (k = 0; k < queue.length; k++) {
        if (k !== i && segBox(queue[i].g, queue[k].box)) cross++;
      }
    }
    return { queue: queue, over: over, cross: cross };
  }

  /* Does a leader touch a box? Liang-Barsky, the box pulled in a pixel so a
     leader that merely leaves its own edge is not read as crossing it. */
  function segBox(g, b) {
    var x = g[0], y = g[1], dx = g[2] - x, dy = g[3] - y, t0 = 0, t1 = 1, i, q, r, t;
    var e = [[-dx, x - b.x0 - 1], [dx, b.x1 - 1 - x],
             [-dy, y - b.y0 - 1], [dy, b.y1 - 1 - y]];
    for (i = 0; i < 4; i++) {
      q = e[i][0]; r = e[i][1];
      if (q === 0) { if (r < 0) return false; continue; }
      t = r / q;
      if (q < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  }

  /* Painted AFTER the map's own labels, so `taken` already holds every name,
     the legend box and the title band: a callout goes where nothing else is. */
  function draw(ctx, p, P, u, ts, map, taken, W, H, size) {
    var R = D(), list = ((map || {}).notes || []).map(function (n) {
      return { note_he: n.note_he, q: p(n.lon, n.lat) };
    });
    if (!list.length) return null;
    /* The step is still chosen on OVERLAPS alone, and the first clean one
       still wins: which text size the set settles at is a measured decision
       (STEPS above) and a leader is not a reason to shrink nine sentences. */
    var best = null, i, try_;
    for (i = 0; i < STEPS.length; i++) {
      try_ = pass(ctx, p, P, u, ts, list, taken, W, H, size, STEPS[i]);
      try_.scale = STEPS[i];
      if (!best || try_.over < best.over) best = try_;
      if (!best.over) break;
    }
    /* EVERY LEADER FIRST, AND EVERY LEADER BEHIND EVERY BOX (2026-09-17). The
       search refuses a leader across a box already placed, but the boxes placed
       AFTER it are not yet known, so the last callouts' leaders were being
       drawn straight through the first ones' sentences - three of them in the
       wide picture's top-left cluster. The placement is right and is not
       touched: what changes is that a leader is CLIPPED out of every other
       callout's box, so where it meets one it passes behind the text instead of
       through it. Nothing moves, and a leader that crosses nothing is drawn
       exactly as it was. */
    var boxes = best.queue.map(function (q) { return q.box; });
    best.queue.forEach(function (q, n) {
      if (!kitLen(q.g, u)) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      boxes.forEach(function (b, k) {
        if (k !== n) ctx.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      });
      ctx.clip("evenodd");
      leaderOf(ctx, P, u, q.g); head(ctx, P, u, q.g);
      ctx.restore();
    });
    /* THE DATE MUST READ FIRST (2026-09-17). A note opening "15.9 — " is laid
       out in the canvas's base direction; set it here rather than trusting
       whatever the caller left, and put it back after, because this painter is
       called from two places and one of them paints a panel afterwards. */
    var dir0 = ctx.direction;
    ctx.direction = "rtl";
    best.queue.forEach(function (q) {
      var cx = (q.box.x0 + q.box.x1) / 2;
      q.lines.forEach(function (ln, k) {
        R.text(ctx, P, ln, cx, q.box.y0 + q.size * 0.25 + (k + 0.5) * q.lineH,
          { size: q.size, weight: 400, halo: 4 * u, color: P.ink });
      });
      taken.push(q.box);
    });
    ctx.direction = dir0;
    /* What this paint achieved, for the console and never for the page: the
       step it settled on, how far each callout ended from its place, and how
       many boxes overlap - which is the number that must be zero.
       DossierMapNotes.report(). */
    var far = 0;
    best.queue.forEach(function (q) {
      q.dist = Math.round(Math.hypot((q.box.x0 + q.box.x1) / 2 - q.g[2],
                                     (q.box.y0 + q.box.y1) / 2 - q.g[3]));
      far = Math.max(far, q.dist);
    });
    REPORT = { width: W, height: H, scale: best.scale, overlaps: best.over,
      crossings: best.cross,
      notes: best.queue.length, maxDist: far, maxDistPct: Math.round(far / W * 100),
      boxes: best.queue.map(function (q) { return q.box; }) };
    return REPORT;
  }
  function kitLen(g, u) { return K().segLen(g) >= 4 * u; }
  function leaderOf(ctx, P, u, g) { K().leader(ctx, P, u, g); }

  return { draw: draw, report: function () { return REPORT; } };
})();

window.DossierMapNotes = DossierMapNotes;
