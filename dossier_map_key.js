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
   carrying two things: a MAP AREA and a PANEL. dossier_map.js translates and
   clips the context to the map area and paints the whole map into it at the map
   area's own size, so the projector, the legend's corner search, the label
   placement and every measurement in pixels are all done on the rectangle the
   map actually occupies - never on the canvas. That is what keeps the frame
   honoured exactly: a frame is a latitude range and a longitude centre, the
   longitude span follows from the rectangle's aspect, and the rectangle is cut
   to the FRAME'S OWN aspect (`fitRect`) so a panel picture shows exactly the
   longitude the plain wide picture does. Nothing is cropped and no point that
   passed the build's in-frame rule falls off the edge here.

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

   NO ES modules - the page runs from file://. One global:

     window.DossierMapKey = { modeOf, area, card, discs, panel, report }
*/
"use strict";

var DossierMapKey = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_key: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
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
  /* The disc, written for BASE_W and floored like every other mark here: a
     number that shrinks with the canvas stops being readable, and this one has
     to be matched to a row in the panel by eye. */
  var DISC_R = 12, DISC_MIN = 10;
  /* Text steps the panel tries, largest first. It stops at the first one where
     every note fits on at most NOTE_WANT lines AND all the rows fit the panel;
     failing that, at the first where the rows merely fit. Nine notes of 90
     characters in a third of a slide need about half the map's own size, and
     which half is measurement, not a guess. */
  /* AND THE STEPS REACH DOWN TO 0.22, which is not a legible size and is there
     anyway: a phone canvas is 345px, nine rows of anything will not be read on
     it, and the one thing that must never happen is a picture carrying nine
     numbers and no key to them. Measured 2026-09-17 with the steps stopping at
     0.32: nothing fitted a 400px canvas, the panel was not drawn at all and the
     discs still were. The download is 2048px and up, where the step lands at
     0.76-1.0 and the note is 31-33px; the page is the preview of it. */
  var SCALES = [1, 0.92, 0.84, 0.76, 0.68, 0.62, 0.56, 0.5, 0.45, 0.4, 0.36,
                0.32, 0.28, 0.25, 0.22];
  var NOTE_LINES = 3, NOTE_WANT = 2;
  var REPORT = null, DISCS = null;

  /* ---- which picture this is ---------------------------------------------- */

  function modeOf(map) {
    var k = map && map.key;
    return (k === "panel" || k === "callouts") ? k : null;
  }
  /* There is NO canvas-widening helper here any more, and that is the point.
     It returned the map's share of the width so `DossierMap.aspect` could hand
     the page a 2.61:1 canvas on which the map area came out 16:9 - and the page
     then drew a picture shaped like nothing the PNG buttons save, while the
     panel, squeezed into a third of a 470px canvas, dropped its note to 11px
     against this board's 17px floor. The canvas is the download's shape now,
     and the map area is NOT cut to 16:9 inside it: see the head of this file. */

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

  /* ---- the numbered disc --------------------------------------------------- */

  /* BLACK ON WHITE, and the only mark on this board that carries a digit: the
     ink on a white disc with an ink ring, so it reads over the terrain, over
     either side's territory and over the sea without adding a hue - every hue
     here is spoken for by a front, a zone or a route. */
  function disc(ctx, P, x, y, r, n, u) {
    var R = D(), str = String(n);
    ctx.beginPath(); ctx.arc(x, y, r + Math.max(1.5, 1.5 * u), 0, Math.PI * 2);
    R.paintShape(ctx, { fill: P.halo });
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    R.paintShape(ctx, { fill: "#FFFFFF", stroke: P.ink,
      width: Math.max(1.2, 1.4 * u) });
    R.text(ctx, P, str, x, y + r * 0.04, { size: r * 1.35, weight: 700, halo: 0,
      color: P.ink });
  }
  function discR(u, ts, n) {
    var r = Math.max(DISC_MIN, DISC_R * u * ts);
    return n >= 10 ? r * 1.18 : r;
  }
  function boxAt(x, y, r) {
    return { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
  }

  /* One disc beside every note's place, numbered in `notes[]` order - the same
     order the panel prints, so the two cannot disagree however either is laid
     out. Placed like a label: the free sides first, stepping out; and NEVER
     DROPPED, because a row in the panel with no number on the map is a row
     about nothing. A spot with nothing under it wins; if there is none the
     fewest-overlaps one is taken. */
  var DIRS = [[0, -1], [1, 0], [-1, 0], [0, 1], [0.71, -0.71], [-0.71, -0.71],
              [0.71, 0.71], [-0.71, 0.71]];

  function spotFor(q, r, u, taken, W, H) {
    var R = D(), base = r + 8 * u, step = Math.max(6 * u, r * 0.9);
    var best = null, bestHit = Infinity, ring, k, x, y, b, hit;
    for (ring = 0; ring < 6; ring++) {
      for (k = 0; k < DIRS.length; k++) {
        x = q[0] + DIRS[k][0] * (base + ring * step);
        y = q[1] + DIRS[k][1] * (base + ring * step);
        b = boxAt(x, y, r);
        if (b.x0 < 0 || b.x1 > W || b.y0 < 0 || b.y1 > H) continue;
        hit = taken.filter(function (t) { return R.overlaps(b, t); }).length;
        if (hit < bestHit) { bestHit = hit; best = { x: x, y: y, box: b }; }
        if (!hit) return best;
      }
    }
    if (best) return best;
    x = Math.min(Math.max(q[0], r), W - r); y = Math.min(Math.max(q[1], r), H - r);
    return { x: x, y: y, box: boxAt(x, y, r) };
  }

  /* What the last paint placed, for the console and never for the page: the two
     rectangles, the panel's text step, and every disc with the place it stands
     beside. DossierMapKey.report(). */
  function discs(ctx, p, P, u, ts, map, taken, W, H) {
    var list = (map && map.notes) || [], out = [], over = 0;
    list.forEach(function (n, i) {
      if (typeof n.lon !== "number" || typeof n.lat !== "number") return;
      if (!p.inside(n.lon, n.lat, 0)) return;
      var q = p(n.lon, n.lat), r = discR(u, ts, i + 1);
      var s = spotFor(q, r, u, taken, W, H);
      disc(ctx, P, s.x, s.y, r, i + 1, u);
      taken.push(s.box);
      out.push({ n: i + 1, place: n.place, box: s.box });
    });
    out.forEach(function (a, i) {
      out.forEach(function (b, k) {
        if (k > i && D().overlaps(a.box, b.box)) over++;
      });
    });
    DISCS = { placed: out.length, of: list.length, overlaps: over,
              area: { w: W, h: H }, list: out };
    return DISCS;
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
  function panel(ctx, P, u, ts, map, a, W) {
    var R = D(), X = window.DossierMapExtra, rect = a.panel;
    var list = (map && map.notes) || [];
    if (!list.length) return null;
    var pad = PAD * u, gap = COL_GAP * u, cols = rect.cols || 1;
    var colW = (rect.w - 2 * pad - (cols - 1) * gap) / cols;
    var avail = rect.h - 2 * pad;
    var base = Math.max(17, 17 * u * ts);
    var pick = null, i, s;
    for (i = 0; i < SCALES.length; i++) {
      s = layout(ctx, map, u, base, SCALES[i], colW, avail, cols);
      if (!s) continue;                     /* the rows do not fit at all */
      if (!pick) pick = s;                  /* the largest step that fits */
      if (s.want) { pick = s; break; }      /* and where nothing overflows */
    }
    if (!pick) return null;
    /* CLIPPED TO ITS OWN RECTANGLE, always: the panel is measured to fit, and
       this is the backstop that keeps a row from ever reaching the map if it
       does not. A canvas path is not part of the state save() keeps, so the
       clip is pushed and popped. */
    ctx.save();
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
        disc(ctx, P, x1 - r, cy, r, row.n, u);
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
    REPORT = { scale: pick.scale, noteSize: Math.round(pick.noteSize),
               rows: list.length, cols: cols, used: Math.round(pick.used),
               avail: Math.round(avail), tall: pick.tall,
               panel: rect, map: a.map, width: W };
    return REPORT;
  }

  /* One candidate layout: wrap every note to the column width at this step,
     measure the rows, and pack them into the columns in order. Null when they
     do not fit; `tall` says a note needed more than two lines, which a larger
     step would only make worse and a smaller one may fix. */
  function layout(ctx, map, u, base, scale, colW, avail, cols) {
    var R = D(), X = window.DossierMapExtra;
    var nameSize = base * 0.92 * scale, noteSize = base * 0.8 * scale;
    var list = (map && map.notes) || [], rows = [], tall = false, total = 0;
    list.forEach(function (n, i) {
      var r = discR(u, 1, i + 1) * Math.max(0.8, scale);
      var textW = colW - 2 * r - 7 * u;
      var lines = X && X.kit
        ? X.kit.wrap(ctx, n.note_he, noteSize, textW, NOTE_LINES)
        : [String(n.note_he || "")];
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
    return { cols: out, scale: scale, used: used, tall: tall,
             noteSize: noteSize, want: !tall && namesFit };
  }

  return { modeOf: modeOf, area: area, card: card,
           discs: discs, panel: panel,
           report: function () {
             return { panel: REPORT, discs: DISCS };
           } };
})();

window.DossierMapKey = DossierMapKey;
