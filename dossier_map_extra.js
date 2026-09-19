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
   plain picture's `zoneNames` moved to dossier_map_legend.js on 2026-09-16,
   beside the diamond it explains; the room it freed is the callouts' search.

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
  /* WHERE A LEADER MAY RUN is dossier_map_leader.js (2026-09-18): the box
     arithmetic, the one-bend elbows and the refusal that replaced a scored
     penalty. Looked up at call time, so the painter files may load in any
     order, and named when missing for the same reason DossierMapDraw is. */
  function L() {
    if (!window.DossierMapLeader) {
      throw new Error("dossier_map_extra: dossier_map_leader.js is not on the page");
    }
    return window.DossierMapLeader;
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
     A tainted or broken image throws on draw rather than on load; the map is worth more than the terrain, so it is skipped and the paint goes on - `ready()` in dossier_map.js keeps that from being the normal case.
     `filter` is `terrain: "strong"` (dossier_map_relief.js): the hillshade is LIFTED as it is laid, and restore() puts the drawing state back. */
  function relief(ctx, p, img, bounds, filter) {
    if (!img || !bounds || bounds.length < 4) return;
    var a = p(bounds[0], bounds[3]);            /* west, north  -> top-left */
    var b = p(bounds[2], bounds[1]);            /* east, south  -> bottom-right */
    ctx.save(); ctx.clip("evenodd");
    if (filter && "filter" in ctx) ctx.filter = filter;
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
  var SIDES = ["n", "s", "e", "w"];
  var REPORT = null;       /* what the last notes() paint measured - read in console */

  /* The leading word a reader can already see from the hatch under the name. */
  function shortName(str) {
    return String(str || "").replace(/^(?:חזית|שולי)\s+/, "");
  }

  /* THE BOX SEARCH, THE WRAP AND THE BOX ARITHMETIC ARE ALL IN
     dossier_map_leader.js since 2026-09-18, with the leader test that now
     refuses a spot instead of pricing it. Named here so the rest of this
     file reads as it did, and re-exported as `kit` at the foot. */
  function wrap(ctx, str, size, maxW, max) { return L().wrap(ctx, str, size, maxW, max); }
  function fits(box, taken, W, H) { return L().fits(box, taken, W, H); }
  function boxAt(cx, cy, w, h) { return L().boxAt(cx, cy, w, h); }
  function findSpot(s, f, w, h, u, bars, taken, mine, leaders, W, H) {
    return L().findSpot(s, f, w, h, u, bars, taken, mine, leaders, W, H);
  }
  function edgeness(s, W, H) { return L().edgeness(s, W, H); }

  /* THE WORDS OUT OF A `taken` LIST, and nothing else (2026-09-19). Since every
     mark on a picture reserves its own rectangle in `taken`
     (dossier_map_ink.js), that one list now holds two kinds of thing, and the
     two questions asked of it have different answers: a BOX may not be placed
     on a pin, a diamond or a level badge, while a LEADER crossing one of them
     is nothing at all - rule 4 forbids a line over a WORD. Filtered here rather
     than in the leader itself, so the leader file keeps one job. Every caller
     that hands a list to findSpot, overText or best goes through this. */
  function words(list) {
    return (list || []).filter(function (b) { return b && !b.mark; });
  }


  /* ONE PLACEMENT PASS AT ONE TEXT SIZE, painting nothing: a pass that loses
     must leave no ink. One callout per front, its NAME over its NOTE, both
     read off GEO.fronts; until data\fronts.json carries the notes this prints
     the name alone, the picture degrading to the plain one rather than
     throwing.

     `note_side` is the authored first choice and a preference, not an
     instruction: a side free when the note was written is not free at every
     canvas width, so the other sides, the corners and the angles between are
     scored against it. */
  function layout(ctx, p, u, ts, G, taken, W, H, size, scale, prio) {
    var R = D(), nameSize = size * 0.9 * scale, noteSize = size * 0.8 * scale;
    var maxW = NOTE_W * u * ts * scale, leaders = [], mine = [], queue = [];
    var rank = {};
    (prio || []).forEach(function (id, i) { rank[id] = i; });
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
       `bars` is those marks plus everything already placed, plus the canvas
       rim so no box is painted with its halo cut; the leader tests read
       `taken`, so a note is never barred by its own mark. */
    var m = window.DossierMapLegend ? window.DossierMapLegend.markR(u) : 11 * u;
    var bars = words(taken).concat(L().rimBars(W, H, u));
    list.forEach(function (it) {
      bars.push({ x0: it.s.cx - m, y0: it.s.cy - m,
                  x1: it.s.cx + m, y1: it.s.cy + m });
    });
    /* WHOEVER IS PLACED LAST TAKES WHAT IS LEFT, so the edge belts go first
       (measured 2026-09-16: with this sort removed the furthest callout went
       from 40% of the slide away to 68%) - and `prio` jumps the queue ahead of
       even them. It carries the fronts a previous pass could not place
       cleanly: given first refusal of the canvas, a front that had nowhere to
       go usually has somewhere, and whoever it displaces has more room to lose. */
    list.sort(function (a, b) {
      var ra = rank[a.props.id], rb = rank[b.props.id];
      if (ra !== undefined || rb !== undefined) {
        return (ra === undefined ? 99 : ra) - (rb === undefined ? 99 : rb);
      }
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
      /* The route the search TESTED is the route that gets painted. A box the
         search could only place dirty comes back with none, and then the
         straight line is drawn and counted as a fault rather than hidden. */
      var rt = box.route || L().straight(box, s);
      if (rt.len >= 4 * u) leaders.push(rt);
      mine.push(box); bars.push(box);
      queue.push({ box: box, s: s, rt: rt, name: name, lines: lines,
                   lineH: lineH, id: props.id });
    });
    var boxes = queue.map(function (q) { return q.box; });
    var over = 0, laps = 0;
    queue.forEach(function (q, k) {
      over += L().overText(q.rt, taken.concat(boxes), q.box, q.s);
      queue.forEach(function (o, i) { if (i > k && R.overlaps(q.box, o.box)) laps++; });
    });
    return { queue: queue, over: over, laps: laps, scale: scale,
             cross: L().crossings(queue.map(function (q) { return q.rt; })),
             stuck: queue.filter(function (q) { return q.box.pass === 0; }).length,
             nameSize: nameSize, noteSize: noteSize };
  }

  /* THE WHOLE SET IS PLACED AT EACH LEGAL TEXT SIZE AND THE BEST PASS WINS
     (2026-09-18). It used to be placed once, at one size, and whatever could
     not find a clean spot had its line painted across somebody's sentence -
     which is the fault Ziv photographed. Shrinking the words is the lever that
     frees the room, so it is pulled; the 15 CSS px floor on a 1280 canvas is
     what stops it being pulled too far, and a set that will not lay out even
     at the floor is painted there and REPORTED, never shrunk on quietly.
     Placed first and painted second: every leader goes down before any
     callout's text, so a line never crosses a sentence. */
  var STEPS = [1, 0.94, 0.88, 0.82, 0.78, 0.74], TEXT_MIN = 15;

  /* WHAT A PASS COSTS, worst first: a box on top of a box, then a line across
     a word - the thing Ziv photographed - then two lines crossing, and last a
     spot the search had to give up on, which is only a warning sign once the
     three faults above are zero. */
  function score(t) {
    return t.laps * 1000 + t.over * 100 + t.cross * 20 + t.stuck * 3;
  }

  /* `mapId` is carried only so a fault can NAME the picture it happened on: it
     read "?" until 2026-09-18, which is a report nobody can act on. */
  function notes(ctx, p, P, u, ts, G, taken, W, H, size, mapId) {
    var R = D(), floor = TEXT_MIN * W / (1280 * size * 0.8);
    var best = null, low = Infinity, i, k, t, c, t2, prio;
    for (i = 0; i < STEPS.length; i++) {
      if (i && STEPS[i] < floor) break;
      t = layout(ctx, p, u, ts, G, taken, W, H, size, STEPS[i]);
      c = score(t);
      prio = [];
      /* AND UP TO THREE MORE GOES AT THE SAME SIZE, each with whatever could
         not be placed given first refusal of the canvas (`prio`, which keeps
         the earlier rounds' names too). It is the cheapest fix there is for a
         callout boxed in by neighbours that were only there because they went
         first, and it is what took the wide overview notes from three lines
         over words to none. */
      for (k = 0; c && k < 3; k++) {
        prio = prio.concat(t.queue.filter(function (q) {
          return q.box.pass === 0; }).map(function (q) { return q.id; }));
        t2 = layout(ctx, p, u, ts, G, taken, W, H, size, STEPS[i], prio);
        if (score(t2) < c) { t = t2; c = score(t2); }
        else break;
      }
      if (c < low) { low = c; best = t; }
      if (!c) break;
    }
    if (!best) return;
    best.queue.forEach(function (q) {
      if (q.rt.len >= 4 * u) L().paint(ctx, P, u, q.rt);
    });
    best.queue.forEach(function (q) {
      var y = q.box.y0 + best.nameSize * 0.65, cx = (q.box.x0 + q.box.x1) / 2;
      R.text(ctx, P, q.name, cx, y,
        { size: best.nameSize, weight: 700, halo: 4 * u });
      q.lines.forEach(function (ln, k) {
        R.text(ctx, P, ln, cx, y + best.nameSize * 0.72 + (k + 0.5) * q.lineH,
          { size: best.noteSize, weight: 400, halo: 4 * u, color: P.muted });
      });
      taken.push(q.box);
    });
    /* What this paint achieved, MEASURED FROM THE FINISHED PICTURE and never
       from the search's own optimism. Both numbers must be zero, both go to
       the shared check, and a fault names itself in the console.
       DossierMapExtra.report(). */
    var far = 0, bad = [];
    best.queue.forEach(function (q) {
      if (L().overText(q.rt, taken, q.box, q.s)) bad.push(q.name);
      q.dist = Math.round(Math.hypot((q.box.x0 + q.box.x1) / 2 - q.s.cx,
                                     (q.box.y0 + q.box.y1) / 2 - q.s.cy));
      far = Math.max(far, q.dist);
    });
    L().size(best.noteSize, W);
    L().fault(mapId, "front notes " + W + "x" + H +
      (bad.length ? " (" + bad.join(", ") + ")" : ""), best.over, best.cross);
    REPORT = { width: W, height: H, scale: best.scale, maxDist: far,
      maxDistPct: Math.round(far / W * 100), line_over_text: best.over,
      crossings: best.cross, overlaps: best.laps, stuck: best.stuck,
      css: Math.round(best.noteSize * 1280 / W),
      callouts: best.queue.map(function (q) {
        return { name: q.name, dist: q.dist, pass: q.box.pass, box: q.box }; }) };
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

  /* `kit` IS THE NAME THE OTHER PAINTERS KNOW THE SEARCH BY - the place notes
     of 2026-09-17 (dossier_map_notes.js) and the panel's numbered discs
     (dossier_map_number.js) run the same search rather than a copy of it. The
     search itself moved into dossier_map_leader.js on 2026-09-18 and is handed
     straight through here, so those two files did not have to change and there
     is still one answer to "does this line touch that rectangle" wherever it
     is asked. `route` and `paint` are the new half: a caller that wants the
     one-bend router for a line of its own asks for them by name. */
  function via(name) {
    return function (a, b, c, d2, e, f, g, h, i, j, k) {
      return L()[name](a, b, c, d2, e, f, g, h, i, j, k);
    };
  }
  return { relief: relief, notes: notes, arrows: arrows,
           kit: { findSpot: findSpot, wrap: wrap, boxAt: boxAt, fits: fits,
                  edgeness: edgeness, words: words,
                  NOTE_W: NOTE_W, NOTE_LINES: NOTE_LINES,
                  leaderSeg: via("leaderSeg"), segLen: via("segLen"),
                  segBox: via("segBox"), segCross: via("segCross"),
                  leader: via("line"), paint: via("paint"), tip: via("tip"),
                  route: via("best"), straight: via("straight"),
                  rimBars: via("rimBars"), crossings: via("crossings"),
                  overText: via("overText"), tell: via("tell"),
                  size: via("size"), fault: via("fault") },
           report: function () { return REPORT; } };
})();

window.DossierMapExtra = DossierMapExtra;
