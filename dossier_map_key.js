/* THE KEY PANEL: numbers on the map, and what each number means printed beside
   it, inside the same picture.

   Ziv, 2026-09-17, of the Marib objectives map: the nine callout boxes were
   "too much text" on the map itself. So the second answer is the one an atlas
   gives - a numbered disc at each place and a numbered list beside the map. The
   picture keeps its ground and its names, and the reading moves off it.

   `key: "panel"` on the map record picks this; `key: "callouts"` picks
   dossier_map_notes.js, which paints the same notes as boxes with arrows. One
   field, two pictures, and the record says which.

   WHAT THIS FILE OWNS IS THE SPLIT OF THE CANVAS. The canvas becomes a card
   carrying a MAP AREA and a PANEL. dossier_map.js translates and clips the
   context to the map area and paints the whole map into it at that area's own
   size, so the projector, the legend's corner search, the label placement and
   every measurement in pixels are done on the rectangle the map really occupies
   - never on the canvas. That is what keeps the frame honoured exactly: a frame
   is a latitude range and a longitude centre, the longitude span follows from
   the rectangle's aspect, and the rectangle is cut to the FRAME'S OWN aspect
   (`fitRect`) so a panel picture shows exactly the longitude the plain wide one
   does. Nothing is cropped and no point the build passed falls off an edge.

   The two shapes, as asked for:
     wide   - THREE BANDS: the map on the left at the FULL canvas height, a
              plain gutter, then the panel as a full-height column (2026-09-19;
              until then the map took the gutter's share too and the connectors
              arrived on the panel's own edge).
     square - the map on top, 16:9 of the full width; the panel below it, in
              TWO columns, because nine rows in one column at 2048 wide would
              be a column of air.

   NO EMPTY BANDS, AND THAT IS WHY EACH SHAPE READS A DIFFERENT LAT RANGE. A
   16:9 cut of the wide map area left a 230px mat above and below it, a third of
   the picture's height empty; so the area keeps the whole canvas height and is
   projected with the frame's SQUARE range (`square.lat`, `square.lonMid`),
   authored for a 1:1 area, and the square shape's own 16:9 area reads the wide
   frame for the same reason. The gutter left the wide area at 0.91:1, slightly
   NARROWER than the range it reads and so showing slightly less longitude: both
   panel maps were measured on 2026-09-19 with every authored point still well
   inside, and `dropped_required` is what says so if a frame is ever tightened.

   NO PANEL ON A PHONE (2026-09-18). Under PANEL_MIN_W the panel is not small,
   it is INVISIBLE: measured at 390 CSS px, nine rows drove the step to 0.22 and
   painted the notes at 3 CSS px, and the owner reads this board on his phone.
   So `area` returns nothing under that width, the map takes the whole canvas
   with its discs on it, and the sentences move to an HTML list under it built
   from `DossierMapNumber.listFor(map)`. The threshold is EXPORTED, because
   docs\maps_tab.js switches to that list at exactly the width this stops
   painting one; two literals would show the notes twice or nowhere.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapKey = { modeOf, area, card, discs, panel, listFor,
       marks, splitOf, report, PANEL_MIN_W }

   `discs` is a pass-through to dossier_map_number.js, which owns the numbered
   disc and its glue; dossier_map.js calls it through here. The SELF-CHECK for
   this picture is `DossierMapNotes.check(id, shape)`: one entry point for both
   answers to the same notes, reading report() here.

   THE LINE FROM A MARK TO ITS ROW is dossier_map_link.js and the geometry it
   calls, dossier_map_fan.js - added 2026-09-18 on Ziv's ask and rebuilt as a
   gutter fan on 2026-09-19, files of their own because this one is at the
   500-line cap. This file hands them the rows it painted and the rectangles the
   map reserved; a page WITHOUT them draws numbers and no lines, and counts
   every missing one so the check cannot read the absence as a clean picture.
   `splitOf` is how dossier_map.js knows, while it is painting
   the MAP, that this picture will carry connectors and must reserve their lanes
   before it places a single name.
*/
"use strict";

var DossierMapKey = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_key: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }
  /* The numbered disc, its glue and the list under the picture. */
  function num() {
    if (!window.DossierMapNumber) {
      throw new Error("dossier_map_key: dossier_map_number.js is not on the page");
    }
    return window.DossierMapNumber;
  }
  function kit() {
    var X = window.DossierMapExtra;
    if (!X || !X.kit) {
      throw new Error("dossier_map_key: dossier_map_extra.js is not on the page");
    }
    return X.kit;
  }

  /* THREE BANDS ON THE WIDE SHAPE: map, gutter, list. The panel's 0.44 is what
     2026-09-18 measured and must not move - at 0.68 the note came out 11 CSS px
     on Ziv's 1230px canvas ("make the text that is on the right bigger...  if
     you do stuff like this, make it big"), 0.58 and 0.57 stopped at 15.5, 0.56
     reached 16.3, and 0.55 bought no further rung while filling 98% of the
     panel's height. So the GUTTER (2026-09-19) is taken from the map's share
     alone and the list reads at exactly the size it read at yesterday: a plain
     5% strip in the list's own ground, between the map's right edge and the
     first letter of a row, which is where every connector's last segment fans
     out. Why the connectors need one is at the head of dossier_map_fan.js. */
  var MAP_FRAC = 0.51, GUT_FRAC = 0.05;
  /* The map area's own shape on the square canvas: 16:9 of the full width, so
     the wide FRAME is what is drawn there. The square frame exists for a 1:1
     map area and this is not one. */
  var SQ_ASPECT = 16 / 9;
  var PAD = 16, COL_GAP = 20;
  /* THE ROW'S OWN MEASUREMENTS, and every one of them is a share of the height
     the text does not get. ROW_GAP was 9 (18*u between rows, 324px of a 1440px
     slide over nine rows) and the line and name steps were 1.26 and 1.28;
     tightening them to 4 and 1.20 bought about 250px at 2560, a step and a half
     of text size. `NAME_TEXT` stays above `NOTE_TEXT` - the place's name is
     what the eye finds the row by. */
  var ROW_GAP = 4, LINE_H = 1.2, NAME_H = 1.2;
  var NAME_TEXT = 0.92, NOTE_TEXT = 0.8;
  /* THE PANEL IS DRAWN ONLY WHERE IT CAN BE READ, and that is MEASURED, not
     guessed at a width (2026-09-18, round 3). The first answer was "no panel
     under 700 canvas px"; measuring the note the panel would actually paint
     showed 6px at 700, 8px at 814 and 11px only at about 1200 - and the maps tab
     gives the canvas 814px on a 1024 laptop. So `area` lays the panel out on a
     scratch canvas before the picture is touched and refuses it whenever the
     note lands under READ_MIN. PANEL_MIN_W is what that measurement comes to on
     today's notes; it is published for a caller who wants a number and is NOT
     the gate, so the two cannot drift. What the PAGE keys off is `data-notes`
     on the canvas, set by every page paint. */
  var PANEL_MIN_W = 1200;
  /* BASE_W and the page's text factor, mirrored from dossier_map.js because
     `area` is handed neither `u` nor `ts` - it runs before the caller computes
     them. The PAGE factor is used for both page and export probes on purpose:
     it under-states an export's text, and an export is 2048px and up where the
     note lands at 18-33px either way, so the gate can only ever err towards
     drawing the panel that is already known to be readable. */
  var BASE_W = 1280, TS_PAGE = 1.15;
  /* Text steps the panel tries, largest first; which one it settles on is the
     three-tier decision in `choose`. Finely spaced from 1 down to 0.7, the band
     the FLOOR leaves open on a slide, where a coarse ladder throws away a whole
     step of size for nothing; coarse below it, where the steps only decide how a
     picture fails. The old ladder reached 0.22, an illegible size kept so a
     narrow canvas still got SOME key - the HTML list is that answer now. */
  var SCALES = [1, 0.96, 0.92, 0.88, 0.84, 0.8, 0.76, 0.72, 0.7, 0.62, 0.56,
                0.5, 0.42, 0.34];
  /* FOUR LINES, NOT THREE, since 2026-09-18: a `note_he` is two sentences and up
     to 160 characters now, and a wrap capped at three does not fail - it CUTS
     the sentence at an ellipsis, silently, the one thing a key may not do. The
     cap is the backstop; `panel` prefers a step with no cut. */
  var NOTE_LINES = 4, NOTE_WANT = 3;
  /* THE TWO FLOORS, AND NEITHER MAY BE SHRUNK PAST (2026-09-18). A panel that
     does not fit at them is NOT drawn smaller and is never clipped: the split is
     refused, the picture keeps its numbers and the sentences move to the HTML
     list under it - and where a panel was expected the picture says so through
     `text_overflow` and a console error, so a dump can never come back quietly
     unreadable. FLOOR is 15 CSS px on a 1280-wide canvas, the board's smallest
     legible text (dossier_map_check.js owns the number, so check and painter
     cannot drift), and what the DOWNLOAD keeps at its own scale. READ_MIN is 13
     ACTUAL px, what the READER's screen shows: a normalised floor alone passes
     an 814px pane painting 9.5px text, because 9.5px there IS 15 CSS px at 1280.
     It was 11 until today, and 11 is the size Ziv called too small to read. */
  var FLOOR = 15, READ_MIN = 13;
  var REPORT = null, LINKS = null, MAP = null, SPLIT = null;

  /* ---- which picture this is ---------------------------------------------- */

  function modeOf(map) {
    var k = map && map.key;
    return (k === "panel" || k === "callouts") ? k : null;
  }
  /* The largest rectangle of aspect `ar` inside a region, centred in it - the
     square shape's map area, where the region already is 16:9. */
  function fitRect(x, y, w, h, ar) {
    var rw = w, rh = w / ar;
    if (rh > h) { rh = h; rw = h * ar; }
    return { x: x + (w - rw) / 2, y: y + (h - rh) / 2, w: rw, h: rh };
  }

  /* The split, or null when this map is not a panel one - the caller then
     paints the canvas exactly as it always has. `ar` is the FRAME's aspect,
     handed in because the frames live in dossier_map.js. `frame` is the SHAPE
     the caller must project the map area with, and it is the OPPOSITE of the
     canvas's on each: see the head of this file. */
  function area(map, W, H, shape, ar) {
    SPLIT = null;      /* never last picture's: paintMap reads it for the lanes */
    if (modeOf(map) !== "panel") return null;
    var a = split(map, W, H, shape, ar);
    /* NO PANEL WHERE IT CANNOT BE READ - and the last one's measurements go
       with it, or the self-check would read a report about a picture that is no
       longer on the screen and pass a panel nobody drew. */
    if (a && !readable(map, a, W)) { REPORT = null; SPLIT = null; return null; }
    /* Kept because `discs` runs inside the map's own paint and is handed no
       split, and the key box only moves where the connector lines are. */
    SPLIT = a;
    return a;
  }

  /* Would the panel this split leaves be readable? The very layout `panel`
     will choose, run on a scratch canvas that is never on the page and never
     painted into - so the answer is the measurement itself and not a model of
     it. A browser that will not give a 2d context answers yes: the panel is
     then drawn exactly as it was before this gate existed.
     `choose` now returns NOTHING below the floors, so a null here is the whole
     answer and there is no second size test to keep in step with it. */
  var PROBE = null;
  function readable(map, a, W) {
    if (!PROBE) {
      try { PROBE = document.createElement("canvas").getContext("2d"); }
      catch (e) { PROBE = null; }
    }
    if (!PROBE) return true;
    if (choose(PROBE, map, W / BASE_W, TS_PAGE, a)) return true;
    overflow(map, W);
    return false;
  }
  /* SAID OUT LOUD WHERE A PANEL WAS EXPECTED. Under PANEL_MIN_W the HTML list
     is the designed answer and nothing is wrong; at or above it a refusal means
     the notes have outgrown the column, and the picture reports the fault by
     name rather than shipping a key nobody can read. */
  function overflow(map, W) {
    if (W < PANEL_MIN_W) return;
    if (window.DossierMapCheck) DossierMapCheck.add("text_overflow", 1);
    console.error("dossier_map_key: " + ((map && map.id) || "?") + " - " +
      (((map && map.notes) || []).length) + " notes will not fit the key panel" +
      " at " + FLOOR + " CSS px on a " + Math.round(W) + "px canvas");
  }

  function split(map, W, H, shape, ar) {
    var a = ar > 0 ? ar : SQ_ASPECT, top = Math.round(W / SQ_ASPECT);
    /* A square canvas puts the panel underneath; a wide one puts it beside.
       The fallback is the wide split, for a canvas too short to hold a row of
       panel under a 16:9 map - a picture with a panel two rows tall is worse
       than one with a narrow column. */
    if (shape === "square" && H - top > H * 0.2) {
      return { map: fitRect(0, 0, W, top, a), frame: null,
               panel: { x: 0, y: top, w: W, h: H - top, cols: 2 } };
    }
    /* THE FULL CANVAS HEIGHT, never a 16:9 cut of it: the band a cut leaves
       above and below the map is a third of the picture's height empty. */
    var mw = Math.round(W * MAP_FRAC), px = mw + Math.round(W * GUT_FRAC);
    return { map: { x: 0, y: 0, w: mw, h: H }, frame: "square",
             panel: { x: px, y: 0, w: W - px, h: H, cols: 1 } };
  }

  /* ---- the card the two areas sit on --------------------------------------- */

  /* A PLAIN LIGHT GROUND under the whole canvas, painted before the map. The
     map fills its own rectangle with the sea, so this shows only where the
     panel is and in the band a frame whose aspect is not the region's leaves
     above and below the map - which then reads as a mat around the picture
     rather than as a hole in it. */
  function card(ctx, P, u, a, W, H) {
    var R = D();
    ctx.beginPath(); ctx.rect(0, 0, W, H); R.paintShape(ctx, { fill: P.box });
    /* A hairline round the map, so the picture has an edge where it ends. */
    ctx.beginPath();
    ctx.rect(a.map.x, a.map.y, a.map.w, a.map.h);
    R.paintShape(ctx, { stroke: P.boxLine, width: Math.max(1, u) });
  }

  /* ---- the panel ----------------------------------------------------------- */

  /* The place's own Hebrew name, from the map's LABEL for the same place: the
     gazetteer name is resolved into the labels by the build, and a note carries
     the place key alone. A note whose place the map does not label prints its
     number and its line, which is still a complete row. */
  function nameOf(map, note) {
    var hit = ((map && map.labels) || []).filter(function (l) {
      return l.place === note.place;
    })[0];
    return (hit && hit.he) || note.he || note.name_he || "";
  }

  /* The smallest note this canvas may print, in ACTUAL pixels: the larger of
     the reader's screen floor and the picture's own normalised one. The
     normalised number comes from dossier_map_check.js where there is one, so
     the painter and the check that judges it read the same constant. */
  function minNote(u) {
    var C = window.DossierMapCheck;
    var css = (C && typeof C.floor === "number") ? C.floor : FLOOR;
    return Math.max(READ_MIN, css * u);
  }

  /* WHICH TEXT STEP THE PANEL SETTLES ON, measured and nothing painted - so
     `area` can ask the same question before the canvas is touched and get the
     same answer `panel` will act on. THREE TIERS, AND A CUT SENTENCE LOSES TO A
     SMALLER ONE (2026-09-18): the step was the largest whose rows fitted, the
     wrap's own ellipsis quietly swallowing what the column could not hold -
     harmless while a note was one short line, not harmless now it is two
     sentences. So: the first step where nothing overflows and nothing is cut
     wins, and failing that the largest with nothing CUT.
     THE LADDER STOPS AT THE FLOOR and does not walk past it. Every step below
     it is a picture the reader cannot use, so "the largest that fits" can never
     again mean "too small to read": no step, no panel. */
  function choose(ctx, map, u, ts, a) {
    var rect = a.panel, list = (map && map.notes) || [];
    if (!list.length) return null;
    var pad = PAD * u, gap = COL_GAP * u, cols = rect.cols || 1;
    var colW = (rect.w - 2 * pad - (cols - 1) * gap) / cols;
    var avail = rect.h - 2 * pad;
    var base = Math.max(17, 17 * u * ts), min = minNote(u);
    var pick = null, whole = null, i, s;
    for (i = 0; i < SCALES.length; i++) {
      if (base * NOTE_TEXT * SCALES[i] < min) break;   /* below the floor */
      s = layout(ctx, map, u, base, SCALES[i], colW, avail, cols);
      if (!s) continue;                     /* the rows do not fit at all */
      if (!pick) pick = s;                  /* the largest step that fits */
      if (!whole && !s.cut) whole = s;      /* the largest with nothing cut */
      if (s.want) { pick = s; break; }      /* and where nothing overflows */
    }
    if (!pick) return null;
    if (!pick.want && whole) pick = whole;
    return pick;
  }

  /* THE PANEL, RTL: a number, the place name in bold, the note under it, rows
     stacked with a thin divider between and no painted title - the picture's
     heading is printed above the canvas.
     `taken` is every rectangle the map area reserved, handed down by
     dossier_map.js as the map painted it - the array itself, so a connector's
     own disc box is the same object the router lets it out of. It falls back to
     `marks()`, which is the same array reached through the back door, for a
     caller written before this argument existed. */
  function panel(ctx, P, u, ts, map, a, W, taken) {
    var R = D(), rect = a.panel;
    var list = (map && map.notes) || [];
    var pad = PAD * u, gap = COL_GAP * u, cols = rect.cols || 1;
    var colW = (rect.w - 2 * pad - (cols - 1) * gap) / cols;
    var avail = rect.h - 2 * pad;
    var pick = choose(ctx, map, u, ts, a);
    if (!pick) return null;
    /* CLIPPED TO ITS OWN RECTANGLE, always: the panel is measured to fit, and
       this is the backstop that keeps a row from ever reaching the map if it
       does not. A canvas path is not part of the state save() keeps, so the
       clip is pushed and popped. */
    ctx.save();
    /* THE DATE MUST READ FIRST (2026-09-17). A row opening "15.9 — " is laid
       out by the canvas in the base direction, and the panel is painted AFTER
       the map area's own save/restore - which put `direction` back to the
       canvas default and sent every date to the far end of its line. Set here,
       inside this file's own save, so the panel cannot inherit the wrong one. */
    ctx.direction = "rtl";
    ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
    /* A DIVIDER ONLY WHERE THE PANEL SITS UNDER THE MAP. Beside it there is a
       gutter now, and a rule down the panel's left edge would cut every
       connector's last segment exactly where it arrives - the bar this whole
       pass exists to get rid of. The map keeps its own hairline from `card`. */
    if (cols > 1) {
      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y); ctx.lineTo(rect.x + rect.w, rect.y);
      R.paintShape(ctx, { stroke: P.boxLine, width: Math.max(1, u) });
    }
    /* WHERE EVERY ROW SAT, kept as the connector lines are drawn to: the left
       edge of the row and its vertical middle, in CANVAS pixels. Collected here
       rather than measured again afterwards, so a line can never point at a row
       the painter did not actually put there. */
    var seats = [];
    pick.cols.forEach(function (col, ci) {
      var x1 = rect.x + pad + (cols - 1 - ci) * (colW + gap) + colW;  /* RTL */
      var y = rect.y + pad;
      col.forEach(function (row, ri) {
        var r = row.r, cy = y + row.nameH / 2;
        seats.push({ n: row.n, x: x1 - colW, y: y + (row.h - row.pad) / 2,
                     box: { x0: x1 - colW, y0: y, x1: x1, y1: y + row.h } });
        num().disc(ctx, P, x1 - r, cy, r, row.n, u);
        if (row.name) {
          R.text(ctx, P, row.name, x1 - 2 * r - 7 * u, cy,
            { size: row.nameSize, weight: 700, halo: 0, align: "right" });
        }
        var ty = y + row.nameH;
        row.lines.forEach(function (ln, k) {
          R.text(ctx, P, ln, x1 - 2 * r - 7 * u, ty + (k + 0.5) * row.lineH,
            { size: row.noteSize, weight: 400, halo: 0, align: "right",
              color: P.muted });
        });
        y += row.h;
        if (ri < col.length - 1) {
          ctx.beginPath();
          ctx.moveTo(x1 - colW, y - row.pad / 2); ctx.lineTo(x1, y - row.pad / 2);
          R.paintShape(ctx, { stroke: P.boxLine, width: Math.max(1, 0.8 * u) });
        }
      });
    });
    ctx.restore();
    /* THE LINE FROM EACH NUMBER ON THE MAP TO ITS ROW HERE (Ziv, 2026-09-18),
       and only where the panel sits BESIDE the map: on the square shape it sits
       under it, and a line to a lower row would have to cross the rows above.
       Drawn after the clip is lifted, because it belongs to both halves of the
       picture; dossier_map_link.js routes it round every word. */
    /* AND A PAGE WITHOUT THAT FILE SAYS SO IN NUMBERS: left off index.html on
       2026-09-18, the panel drew and zero counters read like a clean picture. */
    if (cols === 1 && !window.DossierMapLink && window.DossierMapCheck) {
      DossierMapCheck.add("leader_crossings", seats.length);
    }
    LINKS = cols === 1 && window.DossierMapLink
      ? DossierMapLink.draw(ctx, P, u, map, seats, a, W, a.map.h, taken) : null;
    /* The note size this picture actually painted, as the check reads sizes:
       CSS pixels on a 1280-wide canvas, so one floor covers every shape. */
    if (window.DossierMapLeader) DossierMapLeader.size(pick.noteSize, W);
    /* THE PAGE IS TOLD THE WORDS ARE ON THE PICTURE. Set last, after the panel
       is actually on the canvas: the discs painted before it said "list", which
       is what stands wherever this function returns early or is never called. */
    num().mark(ctx, "painted");
    REPORT = { scale: pick.scale, noteSize: Math.round(pick.noteSize),
               cssNote: Math.round(pick.noteSize * BASE_W / W * 10) / 10,
               rows: list.length, cols: cols, used: Math.round(pick.used),
               avail: Math.round(avail), tall: pick.tall, cut: pick.cut,
               links: LINKS, panel: rect, map: a.map, width: W };
    return REPORT;
  }

  /* One candidate layout: wrap every note to the column width at this step,
     measure the rows, and pack them into the columns in order. Null when they
     do not fit; `tall` says a note needed more than two lines, which a larger
     step would only make worse and a smaller one may fix. */
  function layout(ctx, map, u, base, scale, colW, avail, cols) {
    var R = D(), K = kit();
    var nameSize = base * NAME_TEXT * scale, noteSize = base * NOTE_TEXT * scale;
    var list = (map && map.notes) || [], rows = [], tall = false, total = 0;
    var cut = 0;
    list.forEach(function (n, i) {
      /* 0.9, not 0.8: at 0.8 the row digit was 13.0 px on a 1280 canvas, the
         one number under the map-name floor on 2026-09-19 (MAP_RULES.md). */
      var r = num().discR(u, 1, i + 1) * Math.max(0.9, scale);
      var textW = colW - 2 * r - 7 * u;
      var lines = K.wrap(ctx, n.note_he, noteSize, textW, NOTE_LINES);
      /* WAS ANYTHING CUT? The wrap ends an overrun in an ellipsis, so asking it
         for the note UNCAPPED and comparing line counts is the honest test -
         reading the last line for a "…" also catches a note that ends in one. */
      if (K.wrap(ctx, n.note_he, noteSize, textW, 99).length > lines.length) cut++;
      if (lines.length > NOTE_WANT) tall = true;
      /* The name's own band is the disc's band too, so a big number can never
         print into the first line of its note - which is what `nameSize` alone
         allowed once the rows were tightened. */
      var lineH = noteSize * LINE_H, pad = ROW_GAP * u * 2;
      var nameH = Math.max(nameSize * NAME_H, 2 * r + 3 * u);
      var h = nameH + lines.length * lineH + pad;
      rows.push({ n: i + 1, name: nameOf(map, list[i]), r: r, lines: lines,
                  nameSize: nameSize, noteSize: noteSize, lineH: lineH,
                  nameH: nameH, h: h, pad: pad });
      total += h;
    });
    /* Packed in order, a column at a time: the numbers must read down one
       column and on to the next, never snake. */
    var per = Math.ceil(rows.length / cols), out = [], k;
    for (k = 0; k < cols; k++) out.push(rows.slice(k * per, (k + 1) * per));
    var used = Math.max.apply(null, out.map(function (c) {
      return c.reduce(function (t, r) { return t + r.h; }, 0);
    }).concat([0]));
    if (used > avail) return null;
    var namesFit = rows.every(function (r) {
      return R.width(ctx, r.name, r.nameSize, 700) <= colW - 2 * r.r - 7 * u;
    });
    return { cols: out, scale: scale, used: used, tall: tall, cut: cut,
             noteSize: noteSize, want: !tall && namesFit && !cut };
  }

  /* dossier_map.js asks this file for the discs because the record's `key` is
     this file's field; dossier_map_number.js paints them. A pass-through keeps
     that call site and every other caller pointed at one door.
     IT IS ALSO THE ONE MOMENT THE PANEL CAN SEE THE MAP. `panel` is called from
     dossier_map.js's outer paint and is handed no rect registry; this is called
     from inside the map's own paint, after every name, zone name, governorate
     name and the key box are in `taken` and before the key is painted. So the
     registry is kept here for the connector lines to be routed against, and the
     key box is moved out of their way while it still can be. */
  function discs(ctx, p, P, u, ts, map, taken, W, H, pinR, numbersOnly) {
    /* LINKED means this picture draws connectors, and then a number that cannot
       be glued to its own name is not drawn at all: the line already leads to
       the numbered row, and a loose disc beside a neighbour's mark is the thing
       it would be read as belonging to. */
    var wide = !!(SPLIT && SPLIT.panel && (SPLIT.panel.cols || 1) === 1);
    var out = num().discs(ctx, p, P, u, ts, map, taken, W, H,
                          wide && !!window.DossierMapFan, pinR, numbersOnly);
    if (window.DossierMapLink) DossierMapLink.keyMove(u, taken, W, H, wide);
    MAP = { taken: taken, W: W, H: H };
    return out;
  }
  /* The map area's own rect registry, as `discs` left it, and the split as
     `area` last decided it - dossier_map.js reads that to lay the lanes. */
  function marks() { return MAP; }
  function splitOf() { return SPLIT; }
  /* THE NUMBERS AS WORDS, for the HTML list docs\maps_tab.js puts under the
     picture wherever the canvas is too narrow for a panel. Same door as the
     discs, and the same painted order. */
  function listFor(map) {
    return num().listFor(map);
  }

  return { modeOf: modeOf, area: area, card: card, discs: discs, panel: panel,
           listFor: listFor, marks: marks, splitOf: splitOf,
           PANEL_MIN_W: PANEL_MIN_W,
           report: function () {
             return { panel: REPORT, discs: num().report().discs,
                      audit: num().report().audit, links: LINKS };
           } };
})();

window.DossierMapKey = DossierMapKey;
