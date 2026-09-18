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
     - IT SHRINKS BEFORE IT OVERPRINTS. The whole set is placed, measured, and
       if any two boxes overlap the whole set is placed again one text step
       smaller, twice. A note is never dropped and never printed on top of
       another one while making it smaller would have fitted.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapNotes = { draw(...), report(), check(mapId, shape) }

   `check` is the SELF-CHECK FOR BOTH answers to the notes, not only this one:
   it repaints the picture through the ordinary export path and measures the
   rectangles that landed, reading DossierMapKey's report for a `key: "panel"`
   map and this file's for a `key: "callouts"` one. One entry point, because
   the two pictures are twins and a verifier should not have to know which.
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
  function pass(ctx, p, P, u, ts, list, taken, W, H, size, scale) {
    var R = D(), kit = K();
    var noteSize = size * 0.8 * scale;
    var maxW = kit.NOTE_W * u * ts * scale;
    var leaders = [], mine = [], bars = taken.slice(), queue = [], cut = 0;
    var rim = RIM * u;
    bars.push({ x0: 0, y0: 0, x1: W, y1: rim });
    bars.push({ x0: 0, y0: H - rim, x1: W, y1: H });
    bars.push({ x0: 0, y0: 0, x1: rim, y1: H });
    bars.push({ x0: W - rim, y0: 0, x1: W, y1: H });
    list.forEach(function (n) { bars.push(shapeAt(n.q, u)); });
    list.slice().sort(function (a, b) {
      return kit.edgeness(shapeAt(b.q, u), W, H) - kit.edgeness(shapeAt(a.q, u), W, H);
    }).forEach(function (n) {
      /* THE DISC IS SIZED TO THE SENTENCE BESIDE IT, by the panel ROW's own
         formula and not the panel MAP's: a number inside a box is read with the
         words it opens, and at the map disc's full size it added 104px to every
         box on a slide - which pushed the twelve heat callouts a text step
         down and their leaders through seven of each other, measured. */
      var s = shapeAt(n.q, u);
      var r = N().discR(u, 1, n.n) * Math.max(0.8, scale) * 0.8;
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
      var g = kit.leaderSeg(box, s);
      if (kit.segLen(g) >= 4 * u) leaders.push(g);
      bars.push(box); mine.push(box);
      queue.push({ box: box, g: g, lines: lines, lineH: lineH, size: noteSize,
                   n: n.n, r: r });
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
    return { queue: queue, over: over, cross: cross, cut: cut };
  }

  /* Does a leader touch a box? The number painter's own test, borrowed: both
     leaders on this picture ask the same question and one answer is enough. */
  function segBox(g, b) { return N().segBox(g, b); }

  /* Painted AFTER the map's own labels, so `taken` already holds every name,
     the legend box and the title band: a callout goes where nothing else is. */
  function draw(ctx, p, P, u, ts, map, taken, W, H, size) {
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
       that fits the boxes by ellipsising the words is not clean at all. */
    var best = null, i, try_, cost, low = Infinity;
    for (i = 0; i < STEPS.length; i++) {
      try_ = pass(ctx, p, P, u, ts, list, taken, W, H, size, STEPS[i]);
      try_.scale = STEPS[i];
      /* A CUT COUNTS ONLY WHILE THE TEXT CAN STILL BE READ. Under READ_MIN no
         step is legible, so shrinking further to save an ellipsis buys nothing
         and costs the size - measured on the twelve heat callouts at a 325px
         canvas, where chasing the cuts took the note from 13px to 6px. */
      cost = try_.over * 100 +
        (size * 0.8 * STEPS[i] >= READ_MIN ? try_.cut : 0);
      if (cost < low) { low = cost; best = try_; }
      if (!cost) break;
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
      return N().discs(ctx, p, P, u, ts, map, taken, W, H);
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
      crossings: best.cross, cut: best.cut, size: Math.round(best.queue[0].size),
      notes: best.queue.length, maxDist: far, maxDistPct: Math.round(far / W * 100),
      list: best.queue.map(function (q) { return { n: q.n, box: q.box }; }) };
    return REPORT;
  }
  function kitLen(g, u) { return K().segLen(g) >= 4 * u; }
  function leaderOf(ctx, P, u, g) { K().leader(ctx, P, u, g); }

  /* ---- the self-check, for BOTH answers to the notes ------------------------ */

  /* PAINT A PICTURE AND MEASURE WHAT LANDED:

       DossierMapNotes.check("marib_objectives", "wide")            // the panel
       DossierMapNotes.check("marib_objectives_arrows", "square")   // the boxes
       DossierMapNotes.check("marib_objectives", 390)               // ON A PHONE
       DossierMapNotes.check()                                      // last paint

     A STRING IS A SLIDE AND A NUMBER IS A PAGE (2026-09-18). "wide" and
     "square" repaint through DossierMap.exportPng at 2560x1440 and 2048x2048,
     where the painting unit is a bitmap pixel; a NUMBER repaints through
     DossierMap.draw onto a canvas of that many CSS pixels, where the painting
     unit is a CSS pixel and the measurements below are therefore the size the
     reader's eye gets. Nothing is saved and nothing is added to the document -
     the canvas is detached, the same reason `?png=dry` exists.

     What must hold, and what `ok` is: `intersect` empty, no two painted
     rectangles of different items meeting (a number's disc and its own name
     count as two, so a disc printed over its name shows up here too, and a
     number joined to NOTHING is listed there as well); `markOver` empty, no
     place's own square printed through another place's NAME - that one is a
     fault of the label's authored `anchor` and not of these painters, so the
     check only names it; `cut` 0, no sentence ellipsised out of a box or a row;
     and on a page paint the text at least 11 CSS px, which is what sent the
     panel and the boxes off the picture under 700px in the first place.
     `loose` is not a fault - it names the numbers the canvas would not let
     touch their name and which are therefore tied to it by a hairline. Neither
     is `behind`: a hairline that meets another name is clipped out of it and
     passes under the text. */
  var SHAPES = { wide: [2560, 1440], square: [2048, 2048] };

  function check(mapId, shape) {
    var R = D(), pageW = typeof shape === "number" ? Math.round(shape) : 0;
    var sq = shape === "square", wh = SHAPES[sq ? "square" : "wide"], c;
    if (mapId && pageW) {
      c = document.createElement("canvas");
      window.DossierMap.draw(c, mapId, "light", pageW, null);
    } else if (mapId) {
      window.DossierMap.exportPng(mapId, "light", wh[0], wh[1], null,
                                  sq ? "square" : "wide");
    }
    /* WHICH PICTURE THIS IS comes off the RECORD, never off which painter left
       a report behind: both painters keep their last paint, so after a callouts
       map the panel's discs are still sitting there from an earlier one. With
       no mapId - the caller painted it themselves and knows - this file's own
       report wins. `DOSSIER` is a page-scope const and not a window property,
       exactly as dossier_map.js reads it. */
    var doc = (typeof DOSSIER !== "undefined" && DOSSIER) ? DOSSIER : null;
    var rec = mapId && doc ? (doc.maps || []).filter(function (m) {
      return m.id === mapId; })[0] : null;
    var K2 = window.DossierMapKey, key = K2 && K2.report();
    var kind = rec ? (rec.key === "panel" ? "panel" : "callouts")
                   : (REPORT ? "callouts" : "panel");
    /* WAS THE TEXT PAINTED AT ALL? Off the painters' own reports and never off
       the width: each of them clears its report when it measures the words too
       small and paints the numbers alone instead. */
    var bare = !(kind === "panel" ? (key && key.panel) : REPORT);
    var discs = key && key.discs, box = kind === "callouts" && !bare ? REPORT : null;
    var parts = [], bad = [], loose = [], behind = [], cut = 0, size = 0;
    if (box) {
      box.list.forEach(function (e) { parts.push({ tag: String(e.n), box: e.box }); });
      cut = box.cut || 0;
      size = box.size;
    }
    if (discs && (kind === "panel" || bare)) {
      discs.list.forEach(function (e) {
        parts.push({ tag: String(e.n), box: e.box });
        if (e.name) parts.push({ tag: e.n + "name", box: e.name, name: true });
        /* A number the canvas would not let touch its name is TIED to it by a
           hairline; it is still joined, so it is listed here and not a fault. */
        /* A NUMBER WITH NO NAME TO JOIN is not the same fault as a number
           that missed one: a narrow canvas drops second-rank names, and the
           disc then sits on the place itself with its name in the HTML list
           under the picture. `gap` is -1 when the map painted no name. */
        if (!e.glued) loose.push(e.n + " " + e.place +
          (e.gap < 0 ? " NONAME" : " @" + e.gap + (e.led ? " led" : " LOOSE")));
        if (!e.glued && !e.led && e.gap >= 0) bad.push(e.n + " unjoined");
      });
      (discs.leads || []).forEach(function (l) {
        (l.behind || []).forEach(function (q) { behind.push(l.n + " under " + q); });
      });
      /* THE DIGIT IS THE ONLY TEXT LEFT ON A BARE PICTURE, so it is the size
         that has to clear the floor - the disc's own r*1.35, read back off the
         box the report kept. */
      if (bare) {
        size = Math.round(Math.min.apply(null, discs.list.map(function (e) {
          return (e.box.x1 - e.box.x0) / 2 * 1.35;
        }).concat([999])));
      } else if (kind === "panel") {
        cut = (key.panel && key.panel.cut) || 0;
        size = key.panel && key.panel.noteSize;
      }
    }
    parts.forEach(function (a, i) {
      parts.forEach(function (b, k) {
        /* Two NAMES touching is the map's own business, not this painter's. */
        if (k > i && !(a.name && b.name) && R.overlaps(a.box, b.box)) {
          bad.push(a.tag + "x" + b.tag);
        }
      });
    });
    var mark = (key && key.audit && key.audit.hits) || [];
    if (pageW && size && size < READ_MIN) bad.push("text " + size + "px");
    /* AND THE PAGE WAS TOLD THE TRUTH. `data-notes` is what docs\maps_tab.js
       shows or hides the HTML list on, so a picture that painted its words
       while the attribute said "list" would print them twice, and the other way
       round would lose them - this is the assertion that the two cannot part. */
    var notes = c ? c.getAttribute("data-notes") : null;
    if (pageW && notes !== (bare ? "list" : "painted")) {
      bad.push("data-notes=" + notes);
    }
    if (!pageW && exportMarked()) bad.push("data-notes on an export");
    /* A MARK OVER SOMEBODY ELSE'S NAME FAILS THE SLIDE and is only reported on
       the page. The authored `anchor` that fixes one is chosen for the picture
       that gets downloaded; the label engine re-solves at every page width and
       a 340px canvas will always crowd somewhere. */
    return { map: mapId || null,
             shape: pageW ? pageW + "px page" : (sq ? "square" : "wide"),
             kind: bare ? kind + "/bare" : kind,
             items: parts.filter(function (a) { return !a.name; }).length,
             intersect: bad, markOver: mark, loose: loose, behind: behind,
             cut: cut, size: size, notes: notes,
             crossings: box ? box.crossings : null,
             ok: !bad.length && !cut && (!!pageW || !mark.length) };
  }

  /* An export's canvas has no CSS size of its own, and that is what stops the
     attribute being written on one. Asked here rather than assumed, because
     nothing else on the page would ever notice if it changed. */
  function exportMarked() {
    var c = document.createElement("canvas");
    N().mark(c.getContext("2d"), "painted");
    return c.getAttribute("data-notes") !== null;
  }

  return { draw: draw, check: check, report: function () { return REPORT; } };
})();

window.DossierMapNotes = DossierMapNotes;
