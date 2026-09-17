/* What gets written ON a dossier map beyond its own place names, and the
   terrain it is written over:

     notes   - the notes picture: each fighting zone's name plus what is
               happening there, in a callout beside the belt
     relief  - the terrain, laid under everything the map already draws
     arrows  - the assessed axes of advance on the Aden map

   All three arrived on 2026-09-15, in one message from Ziv: "at every fighting
   zone write a few words so you can see everything on the map", topography
   "that looks presentable, with everything else still on it", and a zoom-in on
   Aden with arrows for where the Houthis could push - "an assessment". The
   plain picture's `zoneNames` sat here beside `notes` until 2026-09-16 and now
   lives in dossier_map_legend.js beside the diamond it explains; the room it
   freed is the callouts' own search.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapExtra = { relief, notes, arrows, report }

   dossier_map.js owns the frames, the projection and the palette and calls in
   here at paint time; the shared helpers come from DossierMapDraw, looked up
   on each call so the painter files may load in any order. Every string
   painted here is Hebrew and comes from the data. */
"use strict";

var DossierMapExtra = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_extra: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  /* ---- relief ------------------------------------------------------------- */

  /* ONE RECTANGLE, exact rather than approximate: the projector is linear in
     longitude and in latitude, so the raster's lon/lat box maps to a rectangle
     on the canvas and a single drawImage puts every pixel where it belongs -
     no resampling, no tiles, no per-row work.
     CLIPPED TO THE CURRENT PATH, which ground() has just filled as the
     coastline: a hypsometric tint spilling into the sea would draw a second,
     wrong coastline over the real one. A canvas path is not part of the state
     save() keeps, so the clip is pushed and popped and the land path is still
     there for the caller.
     A tainted or broken image throws on draw rather than on load; the map is
     worth more than the terrain, so it is skipped and the paint goes on.
     `ready()` in dossier_map.js keeps that from being the normal case. */
  function relief(ctx, p, img, bounds) {
    if (!img || !bounds || bounds.length < 4) return;
    var a = p(bounds[0], bounds[3]);            /* west, north  -> top-left */
    var b = p(bounds[2], bounds[1]);            /* east, south  -> bottom-right */
    ctx.save();
    ctx.clip("evenodd");
    try {
      ctx.drawImage(img, a[0], a[1], b[0] - a[0], b[1] - a[1]);
    } catch (err) {
      console.warn("dossier_map_extra: the relief picture would not draw", err);
    }
    ctx.restore();
  }

  /* ---- geometry of a front ------------------------------------------------ */

  /* The biggest ring of a front, in canvas pixels: its bounding box, and the
     average of its own vertices - which for a 12 km belt lands on the
     centreline, the one point certainly ON the contact rather than beside it.
     That is the same point the red diamond is drawn at, so a leader line drawn
     to it points at the mark the reader can already see. */
  function shapeOf(p, geom) {
    var polys = (geom || {}).type === "Polygon" ? [geom.coordinates]
      : (geom || {}).type === "MultiPolygon" ? geom.coordinates : [];
    var best = null, area = 0;
    polys.forEach(function (poly) {
      var ring = poly[0].map(function (c) { return p(c[0], c[1]); });
      var a = 0, i;
      for (i = 0; i < ring.length - 1; i++) {
        a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      }
      a = Math.abs(a) / 2;
      if (a > area || !best) { area = a; best = ring; }
    });
    if (!best || !best.length) return null;
    var xs = best.map(function (q) { return q[0]; });
    var ys = best.map(function (q) { return q[1]; });
    var sx = 0, sy = 0;
    for (var k = 0; k < best.length - 1; k++) { sx += best[k][0]; sy += best[k][1]; }
    var n = Math.max(1, best.length - 1);
    return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs),
             y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys),
             cx: sx / n, cy: sy / n };
  }

  /* ---- the fighting notes -------------------------------------------------- */

  /* The callout's text width at BASE_W, and how many lines the note may take.
     BOTH are set by the note itself: `note_he` is capped at 70 characters in
     data\fronts.json, Hebrew runs about two characters to the em, and the note
     is drawn at 0.8 of the map's text size. The first pass was 190 over two
     lines, which fits 28 characters on a slide - so every note came out cut at
     an ellipsis (2026-09-15) and the picture Ziv asked for ("a few words
     saying what is going on") printed a few words of a few words. At 230 over
     three lines a 70-character note fits whole at every width, the 814px pane
     included, where the 17px floor makes the text proportionally largest. */
  var NOTE_W = 230, NOTE_LINES = 3;
  /* Under this canvas width the callout prints the front's NAME ALONE. Twelve
     notes four lines deep need room, and the 17px floor grows them relative to
     a narrow map, so below some width they cannot all be placed and the losers
     overprint - a note is never dropped. Measured 2026-09-15, boxes
     overlapping across the twelve: ZERO at 814px and up to 2560, then 4 at 720,
     14 at 640, 35 at 400. The break is 800, where the painted legend stands
     down too - the two agree by measurement, not by copying. */
  var NOTE_MIN_W = 800;
  /* And under THIS width the name is shortened to its distinguishing half
     (2026-09-16). At a 325px canvas - the notes map on a 375px phone - three
     pairs of full names overprinted each other (שולי מרח'ה against אל-כדחה,
     against חיפאן, against אל-ג'ובה). A leading חזית or שולי is a word the
     reader can supply from the hatching, so it is the word that goes. */
  var NOTE_SHORT_W = 350;
  var NOTE_GAP = 26;       /* how far off the belt's own box the nearest ring sits */
  var RINGS = 16;          /* how many rings out the search reaches before the grid */
  var ANGLES = 16;         /* directions tried between the eight box-relative ones */
  var SIDES = ["n", "s", "e", "w"];
  var DIAG = ["ne", "nw", "se", "sw"];
  var REPORT = null;       /* what the last notes() paint measured - read in console */
  /* What a crossed leader costs when a candidate is scored against how far it
     sits from its belt, as a fraction of the canvas width; indexed by how clean
     the leader is - [crosses a callout, crosses a town name, clean]. Tuned
     2026-09-16 at 2560, callouts covering about 48% of the slide: always buying
     a clean leader flung notes 53% away, never buying one left nine crossings. */
  var PEN = [0.16, 0.06, 0];

  /* The leading word a reader can already see from the hatch under the name. */
  function shortName(str) {
    return String(str || "").replace(/^(?:חזית|שולי)\s+/, "");
  }

  /* Greedy wrap to at most `max` lines; an overrun is cut with an ellipsis, not
     allowed to run, because the box is measured from these lines and an extra
     one would sit on whatever is under the callout. A backstop, not the path. */
  function wrap(ctx, str, size, maxW, max) {
    var R = D(), words = String(str || "").split(/\s+/).filter(Boolean);
    var lines = [], line = "";
    words.forEach(function (w) {
      var next = line ? line + " " + w : w;
      if (line && R.width(ctx, next, size, 400) > maxW) { lines.push(line); line = w; }
      else line = next;
    });
    if (line) lines.push(line);
    if (lines.length > max) {
      lines = lines.slice(0, max);
      lines[max - 1] = lines[max - 1].replace(/\s+\S*$/, "") + "…";
    }
    return lines;
  }

  function fits(box, taken, W, H) {
    var R = D();
    return box.x0 >= 0 && box.x1 <= W && box.y0 >= 0 && box.y1 <= H &&
      !taken.some(function (t) { return R.overlaps(box, t); });
  }
  function boxAt(cx, cy, w, h) {
    return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
  }
  /* The callout's centre for one side or corner of the belt's box, `off` out. */
  function sideSpot(s, side, w, h, off) {
    var mx = (s.x0 + s.x1) / 2, my = (s.y0 + s.y1) / 2;
    return [side.indexOf("e") >= 0 ? s.x1 + off + w / 2
          : side.indexOf("w") >= 0 ? s.x0 - off - w / 2 : mx,
            side.indexOf("n") >= 0 ? s.y0 - off - h / 2
          : side.indexOf("s") >= 0 ? s.y1 + off + h / 2 : my];
  }
  /* The leader: the callout box's nearest point to the belt's centreline mark,
     and the mark itself. */
  function leaderSeg(b, s) {
    return [Math.max(b.x0, Math.min(s.cx, b.x1)),
            Math.max(b.y0, Math.min(s.cy, b.y1)), s.cx, s.cy];
  }
  function segLen(g) { return Math.hypot(g[2] - g[0], g[3] - g[1]); }
  /* Does a segment touch a box? Liang-Barsky, the box pulled in a pixel so a
     leader that merely starts on a neighbour's edge is not read as crossing it. */
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
  function turn(g, x, y) {
    return (g[2] - g[0]) * (y - g[1]) - (g[3] - g[1]) * (x - g[0]);
  }
  function segCross(a, b) {
    return ((turn(b, a[0], a[1]) > 0) !== (turn(b, a[2], a[3]) > 0)) &&
           ((turn(a, b[0], b[1]) > 0) !== (turn(a, b[2], b[3]) > 0));
  }

  /* Is this box's LEADER clean, and how clean? `strict` 2 keeps the line off
     everything on the map, town names and legend included; 1 off the other
     callouts alone - a hairline through a two-word label's halo is a blemish,
     the same line through a three-line sentence is unreadable. Either way a
     box an earlier leader runs through is refused. Measured 2026-09-16 with no
     leader test at all, at 2560: 24 leaders crossed other callouts' text. */
  function clean(box, s, taken, mine, leaders, strict) {
    var g = leaderSeg(box, s);
    if (segLen(g) < 1) return true;
    if ((strict > 1 ? taken : mine).some(function (t) { return segBox(g, t); })) return false;
    if (leaders.some(function (l) { return segBox(l, box); })) return false;
    return !leaders.some(function (l) { return segCross(g, l); });
  }

  /* A NOTE IS NEVER DROPPED, AND IT IS PLACED NEAR THE BELT IT NAMES. A town
     name that cannot be placed is dropped, because the pin still says where
     the town is; a note is the only thing saying what is happening at that
     front, and a front with no note reads as a quiet one.

     The old search was four sides, four rings, a spiral, then a coarse grid
     whose nearest free cell wins - and the grid is what put the callouts a
     long way off: it was reached often, the rings above it being too few and
     too tight to reach past the callout's own width. Measured at 2560:
     חזית חרד sat 1,771px from its belt, 69% of the slide, four more over 1,100.

     So the rings ARE the search: twenty-four directions at every ring (the
     authored side, the other three, the corners, sixteen angles between),
     stepping by the wider of the old gap and a twenty-fourth of the canvas,
     every candidate SCORED on distance plus what its leader crosses - so the
     winner is the nearest good spot and not the first merely legal one.
     `bars` is ground a BOX may not take, `taken` and `mine` what a LEADER may
     not cross. The grid stays as the backstop. */
  function findSpot(s, first, w, h, u, bars, taken, mine, leaders, W, H) {
    var order = [first].concat(SIDES.filter(function (a) { return a !== first; }))
      .concat(DIAG);
    var step = Math.max(NOTE_GAP * u, Math.min(W, H) / 24);
    var rad0 = Math.hypot(w, h) / 2 + Math.hypot(s.x1 - s.x0, s.y1 - s.y0) / 2;
    var best = null, cost = Infinity, ring, off, k, ang, spot, b, q, d, c;
    for (ring = 1; ring <= RINGS; ring++) {
      off = NOTE_GAP * u + step * (ring - 1);
      if (off >= cost) break;          /* nothing further out can win now */
      for (k = 0; k < order.length + ANGLES; k++) {
        if (k < order.length) { spot = sideSpot(s, order[k], w, h, off); }
        else {
          ang = (k - order.length + 0.5) * 2 * Math.PI / ANGLES;
          spot = [s.cx + Math.cos(ang) * (rad0 + off),
                  s.cy + Math.sin(ang) * (rad0 + off)];
        }
        b = boxAt(spot[0], spot[1], w, h);
        if (!fits(b, bars, W, H)) continue;
        q = clean(b, s, taken, mine, leaders, 2) ? 2
          : clean(b, s, taken, mine, leaders, 1) ? 1 : 0;
        d = Math.hypot(spot[0] - s.cx, spot[1] - s.cy);
        c = d + PEN[q] * W;
        if (c < cost) { cost = c; best = b; best.pass = q; }
      }
    }
    if (best) return best;
    /* The backstop: every position on a coarse grid, the free one nearest the
       belt wins. It is what makes "never dropped" also mean "never overprinted
       while there was room somewhere", and it costs 0-3 ms. */
    var best = null, bestD = Infinity, gx, gy;
    for (gx = 0; gx <= 48 && W - w >= 0; gx++) {
      for (gy = 0; gy <= 30 && H - h >= 0; gy++) {
        var cx = w / 2 + (W - w) * gx / 48, cy = h / 2 + (H - h) * gy / 30;
        b = boxAt(cx, cy, w, h);
        var d = Math.hypot(cx - s.cx, cy - s.cy);
        if (d < bestD && fits(b, bars, W, H)) { bestD = d; best = b; }
      }
    }
    if (best) return best;
    spot = sideSpot(s, first, w, h, NOTE_GAP * u);
    return boxAt(Math.min(Math.max(spot[0], w / 2), W - w / 2),
                 Math.min(Math.max(spot[1], h / 2), H - h / 2), w, h);
  }

  /* A leader from the callout's nearest edge to the belt's centreline point, so
     a note placed three rings out still says which shape it belongs to. Halo
     under ink, exactly as the text is drawn, because it crosses whatever the
     callout was pushed off. */
  function leader(ctx, P, u, g) {
    var R = D();
    ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(g[2], g[3]);
    R.paintShape(ctx, { stroke: P.halo, width: Math.max(3, 3.5 * u) });
    ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(g[2], g[3]);
    R.paintShape(ctx, { stroke: P.ink, width: Math.max(1.5, 1.5 * u) });
  }

  /* A belt on the edge of the canvas has fewer free directions than one in
     the middle, and whoever is placed last takes what is left - so the edge
     ones go first. Measured 2026-09-16 at 2560 with this sort removed: the
     furthest callout went from 40% of the slide away to 68%. */
  function edgeness(s, W, H) {
    return Math.max(Math.abs(s.cx - W / 2) / W, Math.abs(s.cy - H / 2) / H);
  }

  /* One callout per front: its NAME over its NOTE, both read off GEO.fronts.
     Until data\fronts.json carries the notes this prints the name alone - the
     picture degrades to the plain one rather than throwing.

     `note_side` is the authored first choice and a preference, not an
     instruction: a side free when the note was written is not free at every
     canvas width, so the other sides, the corners and sixteen angles between
     are scored against it. Placed first and painted second: every leader goes
     down before any callout's text, so a line never crosses a sentence. */
  function notes(ctx, p, P, u, ts, G, taken, W, H, size) {
    var R = D(), nameSize = size * 0.9, noteSize = size * 0.8;
    var maxW = NOTE_W * u * ts, leaders = [], mine = [], queue = [];
    var list = ((G.fronts && G.fronts.features) || []).map(function (f) {
      return { props: f.properties || {}, s: shapeOf(p, f.geometry) };
    }).filter(function (it) {
      return it.s && it.props.name_he;
    });
    /* EVERY BELT'S OWN MARK IS GROUND A CALLOUT MAY NOT TAKE. The diamond
       says a fight is happening there, and a callout box is 650px wide on a
       slide: measured 2026-09-16, one box sat over three other fronts'
       diamonds - which also made those three unplaceable, because a leader
       ENDING inside somebody else's box can never come out of the crossing
       test clean, so all three were flung to the far side of the canvas.
       `bars` is those marks plus everything already placed; the leader tests
       read `taken`, so a note is never barred by its own mark. */
    var m = window.DossierMapLegend ? window.DossierMapLegend.markR(u) : 11 * u;
    var bars = taken.slice();
    list.forEach(function (it) {
      bars.push({ x0: it.s.cx - m, y0: it.s.cy - m,
                  x1: it.s.cx + m, y1: it.s.cy + m });
    });
    list.sort(function (a, b) {
      return edgeness(b.s, W, H) - edgeness(a.s, W, H);
    }).forEach(function (it) {
      var s = it.s, props = it.props;
      var name = W < NOTE_SHORT_W ? shortName(props.name_he) : props.name_he;
      var lines = (props.note_he && W >= NOTE_MIN_W)
        ? wrap(ctx, props.note_he, noteSize, maxW, NOTE_LINES) : [];
      var w = R.width(ctx, name, nameSize, 700);
      lines.forEach(function (ln) {
        w = Math.max(w, R.width(ctx, ln, noteSize, 400));
      });
      /* No FLOOR on this gutter, and that was tried: two boxes that merely
         fail to overlap read as one sentence when they touch at a 325px
         canvas, where 8*u is 2px - but growing every box to fix it pushed
         three of the twelve past the search and onto the clamp, and the
         clamp overprints. Adjacent beats overprinted. */
      w += 8 * u;
      var lineH = noteSize * 1.22, h = nameSize * 1.3 + lines.length * lineH;
      var side = SIDES.indexOf(props.note_side) >= 0 ? props.note_side : "n";
      var box = findSpot(s, side, w, h, u, bars, taken, mine, leaders, W, H);
      var g = leaderSeg(box, s);
      if (segLen(g) >= 4 * u) leaders.push(g);
      taken.push(box); mine.push(box); bars.push(box);
      queue.push({ box: box, s: s, name: name, lines: lines, lineH: lineH });
    });
    leaders.forEach(function (g) { leader(ctx, P, u, g); });
    queue.forEach(function (q) {
      var y = q.box.y0 + nameSize * 0.65, cx = (q.box.x0 + q.box.x1) / 2;
      R.text(ctx, P, q.name, cx, y, { size: nameSize, weight: 700, halo: 4 * u });
      q.lines.forEach(function (ln, k) {
        R.text(ctx, P, ln, cx, y + nameSize * 0.72 + (k + 0.5) * q.lineH,
          { size: noteSize, weight: 400, halo: 4 * u, color: P.muted });
      });
    });
    /* What this paint achieved, for the console and never for the page: how
       far each callout ended from its belt, how many leaders run through
       somebody else's text, how many boxes overlap. DossierMapExtra.report(). */
    var cross = 0, over = 0, far = 0;
    queue.forEach(function (q, k) {
      var g = leaderSeg(q.box, q.s);
      queue.forEach(function (o, m) {
        if (k !== m && segBox(g, o.box)) cross++;
        if (m > k && R.overlaps(q.box, o.box)) over++;
      });
      q.dist = Math.round(Math.hypot((q.box.x0 + q.box.x1) / 2 - q.s.cx,
                                     (q.box.y0 + q.box.y1) / 2 - q.s.cy));
      far = Math.max(far, q.dist);
    });
    REPORT = { width: W, height: H, maxDist: far, maxDistPct: Math.round(far / W * 100),
      crossings: cross, overlaps: over, callouts: queue.map(function (q) {
        return { name: q.name, dist: q.dist, pass: q.box.pass, box: q.box };
      }) };
  }

  /* ---- the assessment arrows ------------------------------------------------ */

  /* A quadratic through the MIDPOINTS of the polyline: each authored vertex
     becomes a control point, so the axis bends through its towns instead of
     turning a corner on each one. An axis drawn as straight segments reads as a
     measured route; this is an assessment and should look like a sweep.

     DAMPED, since 2026-09-16, so the sweep can never leave the ground. A pure
     quadratic bows off its chord by half the distance from the vertex to the
     chord's midpoint, which on a long leg is kilometres: between Ras al-Ara
     and al-Buraiqah the coast axis bowed across the bay for a third of its
     length, and a ground axis on water reads as an amphibious landing. The
     control point is pulled back toward the chord until the bow is at most
     MAX_BOW_KM - under the arrow's own stroke at slide scale. Short legs are
     untouched, their natural bow being well inside the cap. WHERE an axis runs
     is authored in data\dossier_maps.json; this only stops the drawing from
     disagreeing with it. */
  var MAX_BOW_KM = 3.5, KM_PER_DEG = 111.32;

  function control(a, b, v, maxBow) {
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    var dx = v[0] - mx, dy = v[1] - my, d = Math.hypot(dx, dy);
    var t = d > 0 ? Math.min(1, 2 * maxBow / d) : 1;
    return [mx + dx * t, my + dy * t];
  }

  function axisPath(ctx, pts, maxBow) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 2) { ctx.lineTo(pts[1][0], pts[1][1]); return; }
    var from = pts[0];
    for (var i = 1; i < pts.length - 1; i++) {
      var to = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
      var c = control(from, to, pts[i], maxBow);
      ctx.quadraticCurveTo(c[0], c[1], to[0], to[1]);
      from = to;
    }
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  }

  function head(ctx, P, u, from, to) {
    var ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
    var len = 14 * u, half = 7 * u;
    ctx.save();
    ctx.translate(to[0], to[1]); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-len, -half); ctx.lineTo(-len, half);
    ctx.closePath();
    D().paintShape(ctx, { fill: P.frontMark, stroke: P.halo,
      width: Math.max(1, 1.2 * u) });
    ctx.restore();
  }

  /* The name rides beside the middle of the axis, pushed off it on whichever
     side is free, so it never sits on the line it names. Bold and haloed like a
     town name, because it is the only word saying what the arrow means. */
  function axisLabel(ctx, P, u, str, pts, size, taken, W, H) {
    var R = D(), mid = Math.max(1, Math.floor(pts.length / 2));
    var a = pts[mid - 1], b = pts[mid];
    var x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2;
    var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len, ny = dx / len, off = 14 * u;
    var w = R.width(ctx, str, size, 700) + 6 * u, h = size * 1.3;
    var spot = null;
    [1, -1, 2, -2].some(function (k) {
      var cx = x + nx * off * k, cy = y + ny * off * k;
      var box = boxAt(cx, cy, w, h);
      if (fits(box, taken, W, H)) { spot = { x: cx, y: cy, box: box }; return true; }
      return false;
    });
    if (!spot) {
      var cx0 = Math.min(Math.max(x + nx * off, w / 2), W - w / 2);
      var cy0 = Math.min(Math.max(y + ny * off, h / 2), H - h / 2);
      spot = { x: cx0, y: cy0, box: boxAt(cx0, cy0, w, h) };
    }
    R.text(ctx, P, str, spot.x, spot.y, { size: size, weight: 700, halo: 4 * u });
    taken.push(spot.box);
  }

  /* Every arrow on a map, drawn after the gains and before the pins and the
     names: the axes are the point of the Aden frame, and a town name may sit
     on one rather than be dropped for it. Halo under red, the same red the
     fighting diamonds take - it answers the same question, one step into the
     future. The build refuses an arrow with no `why` and no source. */
  function arrows(ctx, p, P, u, ts, map, taken, W, H) {
    var R = D(), list = (map && map.arrows) || [];
    if (!list.length) return;
    var size = Math.max(17, 17 * u * ts) * 0.85;
    /* The projector is linear in latitude, so one degree of it is the scale
       bar this canvas is drawn at: the bow cap is written in kilometres and
       converted here, and it therefore means the same thing on a 640px pane
       and on a 2560px slide. */
    var perDeg = Math.abs(p(0, 0)[1] - p(0, 1)[1]) || 1;
    var maxBow = MAX_BOW_KM * perDeg / KM_PER_DEG;
    list.forEach(function (a) {
      var pts = (a.path || []).map(function (c) { return p(c[0], c[1]); });
      if (pts.length < 2) return;
      axisPath(ctx, pts, maxBow);
      R.paintShape(ctx, { stroke: P.halo, width: 7 * u });
      axisPath(ctx, pts, maxBow);
      R.paintShape(ctx, { stroke: P.frontMark, width: 4 * u });
      head(ctx, P, u, pts[pts.length - 2], pts[pts.length - 1]);
      if (a.label_he) axisLabel(ctx, P, u, a.label_he, pts, size, taken, W, H);
    });
  }

  /* `kit` is this file's callout SEARCH, handed out so the place notes of
     2026-09-17 (dossier_map_notes.js, which had to be a new file - this one is
     at the 500-line cap) run the same search rather than a copy of it. */
  return { relief: relief, notes: notes, arrows: arrows,
           kit: { findSpot: findSpot, wrap: wrap, leaderSeg: leaderSeg,
                  leader: leader, boxAt: boxAt, segLen: segLen,
                  edgeness: edgeness, NOTE_W: NOTE_W, NOTE_LINES: NOTE_LINES },
           report: function () { return REPORT; } };
})();

window.DossierMapExtra = DossierMapExtra;
