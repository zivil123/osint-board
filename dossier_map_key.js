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
   context to the map area and paints the whole map into it at the map area's
   own size, so the projector, the legend's corner search, the label placement
   and every measurement in pixels are all done on the rectangle the map really
   occupies - never on the canvas. That is what keeps the frame honoured
   exactly: a frame is a latitude range and a longitude centre, the longitude
   span follows from the rectangle's aspect, and the rectangle is cut to the
   FRAME'S OWN aspect (`fitRect`) so a panel picture shows exactly the longitude
   the plain wide picture does. Nothing is cropped and no point that passed the
   build's in-frame rule falls off the edge here.

   The two shapes, as asked for:
     wide   - the map on the left, about 68% of the width and the FULL canvas
              height; the panel a full-height column on the right.
     square - the map on top, 16:9 of the full width; the panel below it, in
              TWO columns, because nine rows in one column at 2048 wide would
              be a column of air.

   NO EMPTY BANDS, AND THAT IS WHY EACH SHAPE READS A DIFFERENT LAT RANGE. The
   wide map area is 1741x1440 - about 1.2:1 - and cutting a 16:9 rectangle into
   it left a 230px white mat above and below, a third of the picture's height
   empty. So the area keeps the whole canvas height and is projected with the
   frame's SQUARE range (`square.lat`, `square.lonMid`), which is authored and
   validated for a 1:1 area: an area WIDER than 1:1 shows more longitude of it
   and cannot cut anything the build passed. The square shape's own map area is
   16:9, so it reads the wide frame for exactly the same reason.

   NO PANEL ON A PHONE (2026-09-18). Under PANEL_MIN_W the panel is not small,
   it is INVISIBLE: measured on the page at 390 CSS px, nine rows drove the step
   to 0.22 and painted the notes at 3 CSS px, and the owner reads this board on
   his phone. So `area` returns nothing under that width, the map takes the
   whole canvas with its numbered discs still on it, and the sentences move to
   an HTML list under the picture built from `DossierMapNumber.listFor(map)`.
   The threshold is EXPORTED, because docs\maps_tab.js has to switch to that
   list at exactly the width this stops painting one - two literals would
   sooner or later show the notes twice or nowhere. An export is 2048px and up
   and can never be under it.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapKey =
       { modeOf, area, card, discs, panel, report, PANEL_MIN_W }

   `discs` is a straight pass-through to dossier_map_number.js, which owns the
   numbered disc and its glue; dossier_map.js calls it through here. The
   SELF-CHECK for this picture is `DossierMapNotes.check(id, shape)`: one entry
   point for both answers to the same notes, reading report() here.
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

  /* The map's share of the width on the wide shape. 0.68 leaves the panel a
     third of the canvas, which at 2560 is 819px - room for a 90-character note
     on two lines at a size the height can afford nine times over. */
  var MAP_FRAC = 0.68;
  /* The map area's own shape on the square canvas: 16:9 of the full width, so
     the wide FRAME is what is drawn there. The square frame exists for a 1:1
     map area and this is not one. */
  var SQ_ASPECT = 16 / 9;
  var PAD = 16, COL_GAP = 20, ROW_GAP = 9;
  /* THE PANEL IS DRAWN ONLY WHERE IT CAN BE READ, and that is MEASURED, not
     guessed at a width (2026-09-18, round 3). The first answer was "no panel
     under 700 canvas px"; measuring the note the panel would actually paint
     showed 6px at 700, 8px at 814 and 11px only at about 1200 - and the maps
     tab gives the canvas 814px on a 1024 laptop. So `area` lays the panel out
     on a scratch canvas before the picture is touched and refuses it whenever
     the note lands under READ_MIN. PANEL_MIN_W is what that measurement comes
     to on today's notes; it is published for a caller who wants a number, and
     it is NOT the gate - the gate is the measurement, so the two cannot drift.
     What the PAGE must key off is `data-notes` on the canvas, which every page
     paint sets. */
  var PANEL_MIN_W = 1200;
  /* BASE_W and the page's text factor, mirrored from dossier_map.js because
     `area` is handed neither `u` nor `ts` - it runs before the caller computes
     them. The PAGE factor is used for both page and export probes on purpose:
     it under-states an export's text, and an export is 2048px and up where the
     note lands at 18-33px either way, so the gate can only ever err towards
     drawing the panel that is already known to be readable. */
  var BASE_W = 1280, TS_PAGE = 1.15;
  /* Text steps the panel tries, largest first; which one it settles on is the
     three-tier decision in `panel`. Nine notes of 90 characters in a third of a
     slide need about half the map's own size, and which half is measurement.
     AND THE STEPS REACH DOWN TO 0.22, which is not a legible size and is there
     anyway: a phone canvas is 345px, nine rows of anything will not be read on
     it, and the one thing that must never happen is a picture carrying nine
     numbers and no key to them. Measured 2026-09-17 with the steps stopping at
     0.32: nothing fitted a 400px canvas, the panel was not drawn at all and the
     discs still were. The download is 2048px and up, where the step lands at
     0.76-1.0 and the note is 31-33px; the page is the preview of it. */
  var SCALES = [1, 0.92, 0.84, 0.76, 0.68, 0.62, 0.56, 0.5, 0.45, 0.4, 0.36,
                0.32, 0.28, 0.25, 0.22];
  /* FOUR LINES, NOT THREE, since 2026-09-18: a `note_he` is two sentences and
     up to 160 characters now, and a wrap capped at three does not fail - it
     CUTS the sentence at an ellipsis, silently, which is the one thing a key
     may not do. The cap is the backstop; `panel` prefers a step with no cut. */
  /* Under READ_MIN the panel is not being read at any step, so a whole sentence
     is worth no more than a cut one: 11px is the size DOSSIER_MAPS.md names as
     the measured too-small point the 2026-09-17 pass fixed. */
  var NOTE_LINES = 4, NOTE_WANT = 3, READ_MIN = 11;
  var REPORT = null;

  /* ---- which picture this is ---------------------------------------------- */

  function modeOf(map) {
    var k = map && map.key;
    return (k === "panel" || k === "callouts") ? k : null;
  }
  /* There is NO canvas-widening helper here any more, and that is the point. It
     returned the map's share of the width so `DossierMap.aspect` could hand the
     page a 2.61:1 canvas on which the map area came out 16:9 - so the page drew
     a picture shaped like nothing the PNG buttons save, while the panel,
     squeezed into a third of a 470px canvas, dropped its note to 11px against
     this board's 17px floor. See the head of this file. */

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
    if (modeOf(map) !== "panel") return null;
    var a = split(map, W, H, shape, ar);
    /* NO PANEL WHERE IT CANNOT BE READ - and the last one's measurements go
       with it, or the self-check would read a report about a picture that is no
       longer on the screen and pass a panel nobody drew. */
    if (a && !readable(map, a, W)) { REPORT = null; return null; }
    return a;
  }

  /* Would the panel this split leaves be readable? The very layout `panel`
     will choose, run on a scratch canvas that is never on the page and never
     painted into - so the answer is the measurement itself and not a model of
     it. A browser that will not give a 2d context answers yes: the panel is
     then drawn exactly as it was before this gate existed. */
  var PROBE = null;
  function readable(map, a, W) {
    if (!PROBE) {
      try { PROBE = document.createElement("canvas").getContext("2d"); }
      catch (e) { PROBE = null; }
    }
    if (!PROBE) return true;
    var pick = choose(PROBE, map, W / BASE_W, TS_PAGE, a);
    return !pick || pick.noteSize >= READ_MIN;
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
    var mw = Math.round(W * MAP_FRAC);
    return { map: { x: 0, y: 0, w: mw, h: H }, frame: "square",
             panel: { x: mw, y: 0, w: W - mw, h: H, cols: 1 } };
  }

  /* ---- the card the two areas sit on --------------------------------------- */

  /* A PLAIN LIGHT GROUND under the whole canvas, painted before the map. The
     map fills its own rectangle with the sea, so this shows only where the
     panel is and in the band a frame whose aspect is not the region's leaves
     above and below the map - which then reads as a mat around the picture
     rather than as a hole in it. */
  function card(ctx, P, u, a, W, H) {
    var R = D();
    ctx.beginPath(); ctx.rect(0, 0, W, H);
    R.paintShape(ctx, { fill: P.box });
    /* One hairline between the two areas, and one round the map, so the
       picture has an edge where the panel begins. */
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

  /* The panel, RTL: a number, the place name in bold, and the note on one line
     (two when it needs them), rows stacked with a thin divider between. No
     title - the picture's own heading is printed above the canvas and saying it
     twice in one image is what the painted title was struck for. */
  /* WHICH TEXT STEP THE PANEL SETTLES ON, measured and nothing painted - so
     `area` can ask the same question before the canvas is touched and get the
     same answer `panel` will act on. THREE TIERS, AND A CUT SENTENCE LOSES TO A
     SMALLER ONE (2026-09-18): the step was the largest whose rows fitted, the
     wrap's own ellipsis quietly swallowing what the column could not hold -
     harmless while a note was one short line, not harmless now it is two
     sentences. So: the first step where nothing overflows and nothing is cut
     wins, failing that the largest with nothing CUT - but only while that is
     still READ_MIN or bigger, below which neither answer can be read and the
     largest merely-fitting step stands. */
  function choose(ctx, map, u, ts, a) {
    var rect = a.panel, list = (map && map.notes) || [];
    if (!list.length) return null;
    var pad = PAD * u, gap = COL_GAP * u, cols = rect.cols || 1;
    var colW = (rect.w - 2 * pad - (cols - 1) * gap) / cols;
    var avail = rect.h - 2 * pad;
    var base = Math.max(17, 17 * u * ts);
    var pick = null, whole = null, i, s;
    for (i = 0; i < SCALES.length; i++) {
      s = layout(ctx, map, u, base, SCALES[i], colW, avail, cols);
      if (!s) continue;                     /* the rows do not fit at all */
      if (!pick) pick = s;                  /* the largest step that fits */
      if (!whole && !s.cut) whole = s;      /* the largest with nothing cut */
      if (s.want) { pick = s; break; }      /* and where nothing overflows */
    }
    if (!pick) return null;
    if (!pick.want && whole && whole.noteSize >= READ_MIN) pick = whole;
    return pick;
  }

  function panel(ctx, P, u, ts, map, a, W) {
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
    /* The divider between the map and the panel, on the side the panel sits. */
    ctx.beginPath();
    if (cols > 1) { ctx.moveTo(rect.x, rect.y); ctx.lineTo(rect.x + rect.w, rect.y); }
    else { ctx.moveTo(rect.x, rect.y); ctx.lineTo(rect.x, rect.y + rect.h); }
    R.paintShape(ctx, { stroke: P.boxLine, width: Math.max(1, u) });
    pick.cols.forEach(function (col, ci) {
      var x1 = rect.x + pad + (cols - 1 - ci) * (colW + gap) + colW;  /* RTL */
      var y = rect.y + pad;
      col.forEach(function (row, ri) {
        var r = row.r, cy = y + row.nameSize * 0.62;
        num().disc(ctx, P, x1 - r, cy, r, row.n, u);
        if (row.name) {
          R.text(ctx, P, row.name, x1 - 2 * r - 7 * u, cy,
            { size: row.nameSize, weight: 700, halo: 0, align: "right" });
        }
        var ty = y + row.nameSize * 1.28;
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
    /* THE PAGE IS TOLD THE WORDS ARE ON THE PICTURE. Set last, after the panel
       is actually on the canvas: the discs painted before it said "list", which
       is what stands wherever this function returns early or is never called. */
    num().mark(ctx, "painted");
    REPORT = { scale: pick.scale, noteSize: Math.round(pick.noteSize),
               rows: list.length, cols: cols, used: Math.round(pick.used),
               avail: Math.round(avail), tall: pick.tall, cut: pick.cut,
               panel: rect, map: a.map, width: W };
    return REPORT;
  }

  /* One candidate layout: wrap every note to the column width at this step,
     measure the rows, and pack them into the columns in order. Null when they
     do not fit; `tall` says a note needed more than two lines, which a larger
     step would only make worse and a smaller one may fix. */
  function layout(ctx, map, u, base, scale, colW, avail, cols) {
    var R = D(), K = kit();
    var nameSize = base * 0.92 * scale, noteSize = base * 0.8 * scale;
    var list = (map && map.notes) || [], rows = [], tall = false, total = 0;
    var cut = 0;
    list.forEach(function (n, i) {
      var r = num().discR(u, 1, i + 1) * Math.max(0.8, scale);
      var textW = colW - 2 * r - 7 * u;
      var lines = K.wrap(ctx, n.note_he, noteSize, textW, NOTE_LINES);
      /* WAS ANYTHING CUT? The wrap ends an overrun in an ellipsis, so asking it
         for the note UNCAPPED and comparing line counts is the honest test -
         reading the last line for a "…" also catches a note that ends in one. */
      if (K.wrap(ctx, n.note_he, noteSize, textW, 99).length > lines.length) cut++;
      if (lines.length > NOTE_WANT) tall = true;
      var lineH = noteSize * 1.26, pad = ROW_GAP * u * 2;
      var h = nameSize * 1.28 + lines.length * lineH + pad;
      rows.push({ n: i + 1, name: nameOf(map, list[i]), r: r, lines: lines,
                  nameSize: nameSize, noteSize: noteSize, lineH: lineH,
                  h: h, pad: pad });
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
     that call site and every other caller pointed at one door. */
  function discs() {
    return num().discs.apply(null, arguments);
  }
  /* THE NUMBERS AS WORDS, for the HTML list docs\maps_tab.js puts under the
     picture wherever the canvas is too narrow for a panel. Same door as the
     discs, and the same painted order. */
  function listFor(map) {
    return num().listFor(map);
  }

  return { modeOf: modeOf, area: area, card: card, discs: discs, panel: panel,
           listFor: listFor, PANEL_MIN_W: PANEL_MIN_W,
           report: function () {
             return { panel: REPORT, discs: num().report().discs,
                      audit: num().report().audit };
           } };
})();

window.DossierMapKey = DossierMapKey;
