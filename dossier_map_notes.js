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

   A NEW FILE, not a new function in dossier_map_extra.js, which sits at the
   500-line cap - but NOT a second search: `DossierMapExtra.kit` hands this file
   the very ring search, wrap, leader and box helpers the fighting notes use, so
   a note beside a place and one beside a belt cannot be placed by two rules.

   Three things differ from the fighting notes, and each is a decision:
     - THE BOX CARRIES THE LINE AND ITS NUMBER, no heading. The place's own
       label is already painted two pixels away with a pin under it; a callout
       repeating it would print every name twice. The NUMBER arrived on
       2026-09-18 with Ziv's *"make sure in the map that the name is next to
       the number"*: it is the same disc, at the same index, that the panel
       picture puts on the map, drawn by dossier_map_key.js so the two pictures
       cannot number one set of notes two ways - and it rides INSIDE the box,
       on the RTL reading side, so the number and its sentence are one unit.
     - THE LEADER ENDS IN AN ARROWHEAD at the place. He asked for an arrow. It
       also earns its keep: nine boxes on one frame sit further from their
       places than a fighting note does from its belt, and a plain line at that
       length reads as a border rather than as a pointer.
     - IT SHRINKS BEFORE IT OVERPRINTS. The whole set is placed and measured,
       and if anything clashes it is placed again - from the other end, then a
       text step smaller (STEPS below). A note is never dropped and never
       printed over another one while a smaller set would have fitted.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapNotes = { draw(...), report(), check(mapId, shape) }

   `check` is the SELF-CHECK FOR BOTH answers to the notes: it repaints the
   picture through the ordinary export path and measures what landed, reading
   DossierMapKey's report for a `key: "panel"` map and this file's for a
   `key: "callouts"` one - one entry point, because the two pictures are twins
   and a verifier should not have to know which it is looking at.
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
  /* The numbered disc is the PANEL picture's own, borrowed rather than copied:
     one shape, one size rule, one digit, whichever of the two pictures is being
     drawn. Two copies of it would drift on the first change to either. */
  function N() {
    if (!window.DossierMapNumber) {
      throw new Error("dossier_map_notes: dossier_map_number.js is not on the page");
    }
    return window.DossierMapNumber;
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
     a step that happens to be worse can never be what gets painted.
     AND EACH STEP IS TRIED FROM BOTH ENDS (2026-09-19). Boxes are placed one
     after another and every one takes room from the rest, so WHICH IS FIRST
     decides the set: reserving the pins ahead of the names (dossier_map_ink.js)
     moved two names, and the twelve heat callouts could then only place note 5
     with its line across a sentence - while the very same set, placed from the
     middle outwards, laid out clean. Outside-in is still tried first and a tie
     keeps it, so the other order only ever wins by being measurably better. */
  var STEPS = [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.45];
  /* AND NO STEP MAY TAKE THE WORDS UNDER THIS, in CSS pixels on a 1280-wide
     canvas (2026-09-18). Ziv's standing rule for anything written on a map:
     *"if you do stuff like this, make it big."* Shrinking is how this painter
     stops boxes overprinting, so the two pull against each other - and the
     floor wins. A set that will not fit at the smallest legal step is placed
     at it anyway and REPORTED, never quietly shrunk to 6px, which is what a
     390px viewport was doing. */
  var TEXT_MIN = 15;
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
  /* The gutter between the number and its sentence, and the box's own padding,
     both in u. FOUR LINES, not the kit's three, for the same reason the panel
     took a fourth on 2026-09-18: a note is two sentences now and a wrap that
     runs out of lines CUTS at an ellipsis instead of failing. The on-map
     picture prints `short_he` where the record has one, which is a single line
     of at most 55 characters and needs none of that room - the four lines are
     for the fallback, a map whose notes carry the long form only. */
  var NUM_GAP = 5, PAD = 6, NOTE_LINES = 4;
  /* Under this a callout is not being read at any step - the same 11px the
     panel uses, and for the same reason. */
  var READ_MIN = 11;
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
  function pass(ctx, p, P, u, ts, list, taken, W, H, size, scale, dir) {
    var R = D(), kit = K();
    var noteSize = size * 0.8 * scale;
    var maxW = kit.NOTE_W * u * ts * scale;
    var leaders = [], mine = [], queue = [], cut = 0;
    /* `kit.words(taken)`: `taken` also carries every MARK's rectangle, reserved
       before the names (dossier_map_ink.js) so that a NAME never lands on a
       pin. A callout box is placed exactly as it was: making twelve 650px
       boxes dodge the marks as well only moved them onto each other. */
    var bars = kit.words(taken).concat(kit.rimBars(W, H, u, RIM));
    list.forEach(function (n) { bars.push(shapeAt(n.q, u)); });
    list.slice().sort(function (a, b) {
      var d = kit.edgeness(shapeAt(b.q, u), W, H) -
              kit.edgeness(shapeAt(a.q, u), W, H);
      return dir < 0 ? -d : d;
    }).forEach(function (n) {
      /* THE DISC IS SIZED TO THE SENTENCE BESIDE IT, by the panel ROW's own
         formula and not the panel MAP's: a number inside a box is read with the
         words it opens, and at the map disc's full size it added 104px to every
         box on a slide - which pushed the twelve heat callouts a text step
         down and their leaders through seven of each other, measured.
         BUT THE DIGIT IS TEXT, AND THE FLOOR IS THE SAME (2026-09-18). The disc
         prints its number at r*1.35, so following the note's own step took it
         to 10.4 CSS px on the wide heat picture - smaller than the sentence it
         opens and under the floor everything written on a map now keeps. The
         disc therefore stops shrinking at the size that leaves the digit on the
         floor, which costs the box about seven pixels of width on a slide. */
      var s = shapeAt(n.q, u);
      var r = Math.max(TEXT_MIN * u / 1.34,
                       N().discR(u, 1, n.n) * Math.max(0.8, scale) * 0.8);
      var lines = kit.wrap(ctx, n.text, noteSize, maxW, NOTE_LINES);
      /* WAS THE SENTENCE CUT? The wrap ends an overrun in an ellipsis rather
         than failing, so the honest test is to ask it again uncapped. */
      if (kit.wrap(ctx, n.text, noteSize, maxW, 99).length > lines.length) cut++;
      var tw = 0, lineH = noteSize * 1.22;
      lines.forEach(function (ln) {
        tw = Math.max(tw, R.width(ctx, ln, noteSize, 400));
      });
      var w = tw + 2 * r + (NUM_GAP + PAD) * u;
      var h = Math.max(lines.length * lineH + noteSize * 0.5, 2 * r + 4 * u);
      var box = kit.findSpot(s, "n", w, h, u, bars, taken, mine, leaders, W, H);
      /* THE ROUTE THE SEARCH TESTED IS THE ROUTE THAT GETS PAINTED - straight,
         or with the one bend that got it round somebody's sentence. A box the
         search could only place dirty comes back with none, and the straight
         line is then drawn and COUNTED rather than hidden under a clip. */
      var rt = box.route || kit.straight(box, s);
      if (rt.len >= 4 * u) leaders.push(rt);
      bars.push(box); mine.push(box);
      queue.push({ box: box, g: kit.leaderSeg(box, s), rt: rt, lines: lines,
                   lineH: lineH, size: noteSize, n: n.n, r: r });
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
      cross += kit.overText(queue[i].rt, boxesOf(queue), queue[i].box, null);
    }
    /* AND HOW MANY HAD NO CLEAN SPOT AT ALL - the search's own `pass: 0`, the
       one number that says this text size will not lay out. It is what makes
       draw() step down instead of settling on a size whose boxes happen not to
       overlap while three of its lines run across sentences. */
    var stuck = queue.filter(function (q) { return q.box.pass === 0; }).length;
    return { queue: queue, over: over, cross: cross, cut: cut, stuck: stuck };
  }
  function boxesOf(queue) {
    return queue.map(function (q) { return q.box; });
  }

  /* Painted AFTER the map's own labels, so `taken` already holds every name,
     the legend box and the title band: a callout goes where nothing else is. */
  function draw(ctx, p, P, u, ts, map, taken, W, H, size, only, pinR) {
    /* EVERY LABEL'S NAME AND MARK MEASURED FIRST, before a single box is
       pushed into `taken`. The panel picture gets this from its disc pass; this
       one has no disc pass when it paints its boxes, and without the call the
       self-check would read whatever the last OTHER picture left behind and
       report a fault of that one against this. */
    N().audit(p, u, map, taken);
    var R = D(), list = ((map || {}).notes || []).map(function (n, i) {
      /* `short_he` IS THE ON-MAP FORM AND `note_he` THE PANEL'S (2026-09-18).
         The two pictures are twins and their notes are identical by build rule,
         so the difference is which FIELD each paints: the panel has a column to
         read in and takes the two sentences, the map has terrain under it and
         takes the one short line. A record with no `short_he` falls back to
         `note_he`, which is where every map stood before the field existed. */
      return { text: n.short_he || n.note_he, q: p(n.lon, n.lat), n: i + 1 };
    });
    if (!list.length) return null;
    /* The step is chosen on OVERLAPS AND CUT SENTENCES, and the first clean one
       wins: which text size the set settles at is a measured decision (STEPS
       above), a leader is not a reason to shrink nine sentences - and a step
       that fits the boxes by ellipsising the words is not clean at all.
       AND IT STOPS AT THE TEXT FLOOR (2026-09-18): `floor` is the smallest
       step that still leaves TEXT_MIN CSS pixels on a 1280-wide canvas, and
       the first step is always tried so a canvas too narrow for even that
       still gets a picture - reported, not silently shrunk. */
    var floor = TEXT_MIN * W / (1280 * size * 0.8);
    var best = null, i, d, try_, cost, low = Infinity;
    for (i = 0; i < STEPS.length && low; i++) {
      if (i && STEPS[i] < floor) break;
      for (d = 0; d < 2 && low; d++) {
        try_ = pass(ctx, p, P, u, ts, list, taken, W, H, size, STEPS[i],
                    d ? -1 : 1);
        try_.scale = STEPS[i]; try_.dir = d ? -1 : 1;
        /* WHAT A PASS IS JUDGED ON, worst first: boxes on top of each other,
           then lines with nowhere clean to run, then lines across a sentence,
           then a sentence cut at an ellipsis. Before 2026-09-18 only the first
           and the last counted, so a size whose boxes just fitted was kept even
           when three of its leaders had to be painted over words. A CUT COUNTS
           ONLY WHILE THE TEXT CAN STILL BE READ: under READ_MIN no step is
           legible, so shrinking further to save an ellipsis buys nothing and
           costs the size - measured on the twelve heat callouts at a 325px
           canvas, where chasing the cuts took the note from 13px to 6px. */
        cost = try_.over * 1000 + try_.stuck * 100 + try_.cross * 10 +
          (size * 0.8 * STEPS[i] >= READ_MIN ? try_.cut : 0);
        if (cost < low) { low = cost; best = try_; }
      }
    }
    /* AND IF THE WORDS CAME OUT TOO SMALL TO READ, THEY DO NOT GO ON THE
       PICTURE AT ALL (2026-09-18, round 3). Measured at a 390px viewport: the
       callouts settled at 6 painting pixels with most of them ellipsised, which
       is text nobody can read printed over the terrain. The whole set is placed
       before this is known - `pass` paints nothing - so the picture is simply
       given the numbered discs instead, glued to their names exactly as on the
       slide, and the sentences go to the HTML list under it (the canvas then
       says data-notes="list"). The DOWNLOADS never reach this: 2560 and 2048
       land the same notes at 33-41 painting pixels. */
    if (Math.round(best.queue[0].size) < READ_MIN) {
      REPORT = null;
      /* `only` is the places the map printed no NAME for (MAP_RULES.md rule 8):
         their discs glue to the MARK instead of to a name that is not there.
         Without it a phone's callouts fell back to nine discs loose on the
         terrain, and dossier_map_ink.js counted every one of those marks as
         unlabelled - which is exactly what a reader would have found. */
      return N().discs(ctx, p, P, u, ts, map, taken, W, H, false, pinR, only);
    }
    /* EVERY LEADER FIRST, AND EVERY LEADER ROUND EVERY BOX (2026-09-18). It
       used to be "behind": a leader was CLIPPED out of the other callouts'
       boxes, so where it met one it passed under the text. Ziv saw that answer
       on a heat map and called it a line on the words. It is not clipped now -
       the search would not have given the box to a line with nowhere to go, and
       what it gives back is the route itself, with one bend where a straight
       run was blocked. A line that still has to cross something is drawn plain
       and counted below, because a fault that hides is a fault that ships. */
    best.queue.forEach(function (q) {
      /* THE ARROW IS WHAT NAMES THIS MARK on a callouts picture, exactly as a
         glued number does on a panel one (MAP_RULES.md rule 8): it ends ON the
         place and the sentence it came from explains it. So the mark is
         claimed here, and dossier_map_ink.js accuses only a mark that neither
         a name, a number nor an arrow reached. */
      if (window.DossierMapInk) DossierMapInk.numbered(q.g[2], q.g[3]);
      if (!kitLen(q.g, u)) return;
      K().paint(ctx, P, u, q.rt);
      head(ctx, P, u, K().tip ? K().tip(q.rt) : q.g);
    });
    /* THE DATE MUST READ FIRST (2026-09-17). A note opening "15.9 — " is laid
       out in the canvas's base direction; set it here rather than trusting
       whatever the caller left, and put it back after, because this painter is
       called from two places and one of them paints a panel afterwards. */
    var dir0 = ctx.direction;
    ctx.direction = "rtl";
    best.queue.forEach(function (q) {
      /* THE NUMBER OPENS THE BOX, the sentence runs leftwards from it: the
         panel picture's row reads number-then-name, and a reader holding the
         two pictures side by side must not meet the same nine notes numbered
         from two different ends. The text is therefore right-ALIGNED off the
         disc rather than centred in the box, so every line starts under the
         number instead of drifting under it. */
      var x1 = q.box.x1 - PAD * u / 2, cy = (q.box.y0 + q.box.y1) / 2;
      var top = cy - q.lines.length * q.lineH / 2;
      N().disc(ctx, P, x1 - q.r, cy, q.r, q.n, u);
      q.lines.forEach(function (ln, k) {
        R.text(ctx, P, ln, x1 - 2 * q.r - NUM_GAP * u, top + (k + 0.5) * q.lineH,
          { size: q.size, weight: 400, halo: 4 * u, color: P.ink,
            align: "right" });
      });
      taken.push(q.box);
    });
    ctx.direction = dir0;
    /* The words are on the picture, so the page must not repeat them. */
    N().mark(ctx, "painted");
    /* What this paint achieved, MEASURED OFF THE FINISHED PICTURE: every route
       against every rectangle that ended up on the canvas (`taken` now holds
       the callout boxes too), and every route against every other. Both must
       be zero; both go to the shared check, and a fault names the map and the
       note numbers in the console rather than waiting to be noticed.
       DossierMapNotes.report(). */
    var far = 0, over = 0, bad = [];
    best.queue.forEach(function (q) {
      var n = K().overText(q.rt, taken, q.box, { cx: q.g[2], cy: q.g[3] });
      if (n) { over += n; bad.push(q.n); }
      q.dist = Math.round(Math.hypot((q.box.x0 + q.box.x1) / 2 - q.g[2],
                                     (q.box.y0 + q.box.y1) / 2 - q.g[3]));
      far = Math.max(far, q.dist);
    });
    var cross = K().crossings(best.queue.map(function (q) { return q.rt; }));
    var px = K().size(best.queue[0].size, W);
    K().fault((map || {}).id, "callout notes " + W + "x" + H +
      (bad.length ? " at note " + bad.join(", ") : ""), over, cross);
    if (px < TEXT_MIN) {
      console.error("dossier map notes: " + ((map || {}).id || "?") + " " + W +
        "x" + H + " - note text " + Math.round(px) + " css px, floor " + TEXT_MIN);
    }
    REPORT = { width: W, height: H, scale: best.scale, overlaps: best.over,
      line_over_text: over, crossings: cross, cut: best.cut, order: best.dir,
      size: Math.round(best.queue[0].size), css: Math.round(px),
      notes: best.queue.length, maxDist: far, maxDistPct: Math.round(far / W * 100),
      routes: best.queue.map(function (q) { return q.rt; }),
      boxes: best.queue.map(function (q) { return q.box; }),
      list: best.queue.map(function (q) { return { n: q.n, box: q.box }; }) };
    return REPORT;
  }
  function kitLen(g, u) { return K().segLen(g) >= 4 * u; }

  /* THE SELF-CHECK IS ITS OWN FILE (dossier_map_notes_check.js): it paints
     nothing, and this one needed the room. The documented name still answers. */
  function check(mapId, shape) {
    var C = window.DossierMapNotesCheck;
    if (!C) {
      throw new Error("dossier_map_notes: dossier_map_notes_check.js is missing");
    }
    return C.check(mapId, shape);
  }

  return { draw: draw, check: check, READ_MIN: READ_MIN,
           report: function () { return REPORT; } };
})();

window.DossierMapNotes = DossierMapNotes;
