/* WHERE A LEADER LINE MAY RUN - and, since 2026-09-18, where it may NOT.

   Ziv, with a screenshot of a heat map whose leader ran straight through a
   front's name: *"you have lines that are on actual text, so that is not
   good... make sure that you don't cut any text off with arrows."*

   Until today a line over a word was a SCORED PENALTY in the callout search
   (dossier_map_extra.js `clean`): a candidate that crossed a name simply cost
   more, so when nothing better turned up the crossing was painted. It is now a
   HARD REFUSAL - a spot whose line cannot reach its mark without touching
   somebody else's text is not a spot at all - and to keep "never dropped" true
   at the same time, a line that cannot get there straight is allowed ONE BEND,
   or two, and goes AROUND the words instead. Since 2026-09-22 there is a
   fourth answer under those three, dossier_map_round.js, asked only where
   all three were blocked: see `best` and the end of `findSpot`.

   CLIPPING IS NOT THE ANSWER and was the old one: a hairline clipped out of a
   label passes behind the text, which reads as a line broken in two and still
   says the line had nowhere to go. The line goes around, or the picture reports
   a fault by name. Nothing is drawn under a word to hide it.

   A NEW FILE because dossier_map_extra.js sits at the 500-line cap; THE WHOLE
   BOX SEARCH came here with the refusal, and `DossierMapExtra.kit` hands it out
   under the names its callers already use, so there is ONE answer on this board
   to "does this line touch that rectangle". NO ES modules. One global:

     window.DossierMapLeader = { segBox, segCross, straight, options, best,
       findSpot, wrap, boxAt, fits, leaderSeg, segLen, edgeness, rimBars, paint,
       line, tip, segsOf, lengthOf, overText, crossings, tell, size, fault,
       SIDES }

   A page without this file draws no dossier map at all, and says so by name
   rather than by an undefined function out of a canvas paint. */
"use strict";

var DossierMapLeader = (function () {
  function R() { return window.DossierMapDraw || null; }

  /* Does a segment touch a box? Liang-Barsky, the box pulled in a pixel so a
     leader that merely starts on a neighbour's edge is not read as crossing. */
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

  /* How far along a box's edge a bend may leave it. The middle first, so a free
     middle looks deliberate rather than nudged; the outer pairs get a line past
     a neighbour squarely in front. Five positions by four edges, twenty. */
  var ALONG = [0.5, 0.28, 0.72, 0.12, 0.88];
  /* What a bend costs against a straight line of the same length, in pixels: a
     nudge, not a rule - it only orders the elbows and keeps a straight line
     when both would do. */
  var BEND = 8;

  function segsOf(pts) {
    var out = [], i;
    for (i = 1; i < pts.length; i++) {
      if (Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) >= 0.5) {
        out.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
      }
    }
    return out;
  }
  function lengthOf(pts) {
    var d = 0, i;
    for (i = 1; i < pts.length; i++) {
      d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return d;
  }
  function route(pts, bend) {
    return { pts: pts, segs: segsOf(pts), bend: bend || 0, len: lengthOf(pts) };
  }
  /* The straight leader: the box's nearest point to the mark, and the mark. The
     same line `DossierMapExtra.kit.leaderSeg` has always drawn. */
  function straight(box, s) {
    return route([[Math.max(box.x0, Math.min(s.cx, box.x1)),
                   Math.max(box.y0, Math.min(s.cy, box.y1))], [s.cx, s.cy]], 0);
  }

  /* EVERY WAY A LEADER COULD RUN from this box to this mark: the straight one,
     then twenty one-bend elbows - four edges by five positions along each. The
     first leg always leaves its edge FACE ON, so no elbow runs back through the
     box it came out of or slides along its own edge. */
  function options(box, s) {
    var out = [straight(box, s)], w = box.x1 - box.x0, h = box.y1 - box.y0;
    ALONG.forEach(function (t) {
      var y = box.y0 + h * t, x = box.x0 + w * t;
      if (s.cx > box.x1) out.push(route([[box.x1, y], [s.cx, y], [s.cx, s.cy]], 1));
      if (s.cx < box.x0) out.push(route([[box.x0, y], [s.cx, y], [s.cx, s.cy]], 1));
      if (s.cy < box.y0) out.push(route([[x, box.y0], [x, s.cy], [s.cx, s.cy]], 1));
      if (s.cy > box.y1) out.push(route([[x, box.y1], [x, s.cy], [s.cx, s.cy]], 1));
    });
    return out;
  }
  /* AND, WHEN EVEN THE ELBOWS ARE BLOCKED, A STAIRCASE. Two bends: out of the
     edge, along a corridor part of the way across, then in to the mark - what
     gets a line out of a cluster where the box and its mark are penned in from
     the same side. Tried only where the elbows failed. */
  var MID = [0.5, 0.32, 0.68];
  function stairs(box, s) {
    var out = [], w = box.x1 - box.x0, h = box.y1 - box.y0;
    ALONG.forEach(function (t) {
      var y = box.y0 + h * t, x = box.x0 + w * t;
      MID.forEach(function (f) {
        var mx, my;
        if (s.cx > box.x1) {
          mx = box.x1 + (s.cx - box.x1) * f;
          out.push(route([[box.x1, y], [mx, y], [mx, s.cy], [s.cx, s.cy]], 2));
        }
        if (s.cx < box.x0) {
          mx = box.x0 - (box.x0 - s.cx) * f;
          out.push(route([[box.x0, y], [mx, y], [mx, s.cy], [s.cx, s.cy]], 2));
        }
        if (s.cy < box.y0) {
          my = box.y0 - (box.y0 - s.cy) * f;
          out.push(route([[x, box.y0], [x, my], [s.cx, my], [s.cx, s.cy]], 2));
        }
        if (s.cy > box.y1) {
          my = box.y1 + (s.cy - box.y1) * f;
          out.push(route([[x, box.y1], [x, my], [s.cx, my], [s.cx, s.cy]], 2));
        }
      });
    });
    return out;
  }

  /* A leader already drawn: a route, or (older callers) a bare segment. */
  function asLeader(l) {
    return (l && l.segs) ? l : { segs: [l], box: null };
  }
  /* NEITHER THE MARK'S OWN NEIGHBOURS NOR A MARK ITSELF IS A FAULT: an arrow
     must reach its place. A rect the mark sits inside is skipped, and so is one
     flagged `mark` - rule 4 is about WORDS. */
  function holds(t, s) {
    return !!t.mark || (!!s && s.cx >= t.x0 && s.cx <= t.x1 &&
      s.cy >= t.y0 && s.cy <= t.y1);
  }
  /* Which of `avoid` this route runs through (`holds` says what is excused),
     COUNTED, so a report can say how bad and not only that. */
  function overText(rt, avoid, box, s) {
    var n = 0;
    if (!rt) return 0;
    (avoid || []).forEach(function (t) {
      if (!t || t === box || holds(t, s)) return;
      if (rt.segs.some(function (g) { return segBox(g, t); })) n++;
    });
    return n;
  }
  /* The same question for a yes or a no, stopping at the first hit: the search
     asks it thousands of times a picture; the count matters once. */
  function anyText(rt, avoid, box, s) {
    var i, t;
    for (i = 0; i < avoid.length; i++) {
      t = avoid[i];
      if (!t || t === box || holds(t, s)) continue;
      if (rt.segs.some(function (g) { return segBox(g, t); })) return true;
    }
    return false;
  }
  /* Clean against everything already on the canvas? Three tests, each a failure
     once: no running through anybody's text, no crossing a leader already
     drawn, and no leader already drawn through the box it comes out of. */
  function clear(rt, box, s, avoid, leaders) {
    var i, ls = leaders;
    if (!rt.segs.length) return true;
    if (anyText(rt, avoid, box, s)) return false;
    for (i = 0; i < ls.length; i++) {
      if (ls[i].segs.some(function (q) { return segBox(q, box); })) return false;
      if (ls[i].segs.some(function (q) {
        return rt.segs.some(function (g) { return segCross(g, q); });
      })) return false;
    }
    return true;
  }

  /* The cheapest CLEAN route from this box to this mark, or null when there is
     none - which is the whole point: a null here refuses the box, and the
     search moves to the next candidate spot rather than painting a line across
     a sentence. `only` picks one stage - 1 the straight line, 2 the elbows, 3
     the staircases, 4 the way round - so the search asks the cheap question at
     every one of its hundreds of candidates and comes back for the dear ones
     only where a straight run was blocked. */
  function best(box, s, avoid, leaders, only, W, H) {
    var ls = (leaders || []).map(asLeader), out = null, cost = Infinity;
    var list = only === 1 ? [straight(box, s)]
             : only === 2 ? options(box, s).slice(1)
             : only === 3 ? stairs(box, s)
             : only === 4 ? []
             : options(box, s).concat(stairs(box, s));
    list.forEach(function (rt) {
      if (!clear(rt, box, s, avoid, ls)) return;
      var c = rt.len + rt.bend * BEND;
      if (c < cost) { cost = c; out = rt; }
    });
    /* AND THE WAY ROUND when all three shapes were blocked: every one of them
       is a corridor BETWEEN the box and its mark, so a word that has to be
       passed on its far side defeats all eighty-one. dossier_map_round.js walks
       the corners instead. `only` 4 asks for that answer alone. */
    if (!out && (!only || only === 4) && window.DossierMapRound) {
      out = DossierMapRound.path(box, s, avoid, ls, W, H);
    }
    return out;
  }

  /* ---- where a callout BOX may stand ---------------------------------------- */

  /* THE SEARCH CAME HERE WITH THE REFUSAL (2026-09-18): a search that throws
     away every spot whose LINE is dirty is one thing with the line test. */
  var NOTE_GAP = 26;       /* how far off the belt's own box the nearest ring sits */
  var RINGS = 34;          /* rings out before the grid backstop */
  var ANGLES = 48;         /* directions between the eight box-relative ones */
  var RIM = 6;             /* how far off the canvas rim a box must stay */
  /* WHAT AN ELBOW COSTS against a straight spot further out, as a fraction of
     canvas width: a bend is a blemish, a long haul is worse, and both must be
     CLEAN. REACH RAISED 2026-09-19: put these back at 26/36/400/200 and the
     overview's notes picture crosses two of its own leaders at 1230px. */
  var BEND_PEN = 0.03, ELBOW_TRIES = 900, STAIR_TRIES = 450, ROUND_TRIES = 60;
  var SIDES = ["n", "s", "e", "w"], DIAG = ["ne", "nw", "se", "sw"];

  function boxAt(cx, cy, w, h) {
    return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
  }
  function fits(box, taken, W, H) {
    var D = R();
    return box.x0 >= 0 && box.x1 <= W && box.y0 >= 0 && box.y1 <= H &&
      !taken.some(function (t) { return D.overlaps(box, t); });
  }
  /* The callout's centre for one side or corner of the mark's box, `off` out. */
  function sideSpot(s, side, w, h, off) {
    var mx = (s.x0 + s.x1) / 2, my = (s.y0 + s.y1) / 2;
    return [side.indexOf("e") >= 0 ? s.x1 + off + w / 2
          : side.indexOf("w") >= 0 ? s.x0 - off - w / 2 : mx,
            side.indexOf("n") >= 0 ? s.y0 - off - h / 2
          : side.indexOf("s") >= 0 ? s.y1 + off + h / 2 : my];
  }
  function leaderSeg(b, s) {
    return [Math.max(b.x0, Math.min(s.cx, b.x1)),
            Math.max(b.y0, Math.min(s.cy, b.y1)), s.cx, s.cy];
  }
  function segLen(g) { return Math.hypot(g[2] - g[0], g[3] - g[1]); }
  /* A mark on the canvas edge has fewer free directions than one in the middle,
     and whoever is placed last takes what is left - so the edge ones go first.
     Without this sort (2560, 2026-09-16) the furthest callout went 40% -> 68%. */
  function edgeness(s, W, H) {
    return Math.max(Math.abs(s.cx - W / 2) / W, Math.abs(s.cy - H / 2) / H);
  }
  /* THE CANVAS RIM IS GROUND TOO. `fits` only asks that a box be inside the
     picture, which let two of the nine Marib callouts sit flush against an edge
     with the halo cut in half (2026-09-17). Four bars, so nothing is clipped. */
  function rimBars(W, H, u, inset) {
    var r = (inset || RIM) * u;
    return [{ x0: 0, y0: 0, x1: W, y1: r }, { x0: 0, y0: H - r, x1: W, y1: H },
            { x0: 0, y0: 0, x1: r, y1: H }, { x0: W - r, y0: 0, x1: W, y1: H }];
  }
  /* Greedy wrap to at most `max` lines; an overrun is cut with an ellipsis,
     because the box is measured from these lines and an extra one would sit on
     whatever is under the callout. A backstop. */
  function wrap(ctx, str, size, maxW, max) {
    var D = R(), words = String(str || "").split(/\s+/).filter(Boolean);
    var lines = [], line = "";
    words.forEach(function (w) {
      var next = line ? line + " " + w : w;
      if (line && D.width(ctx, next, size, 400) > maxW) { lines.push(line); line = w; }
      else line = next;
    });
    if (line) lines.push(line);
    if (lines.length > max) {
      lines = lines.slice(0, max);
      lines[max - 1] = lines[max - 1].replace(/\s+\S*$/, "") + "…";
    }
    return lines;
  }

  /* A NOTE IS NEVER DROPPED, AND IT IS PLACED NEAR THE MARK IT NAMES: a town
     name that cannot be placed is dropped, because the pin still says where the
     town is, but a note is the only thing saying what is happening there.

     The old search ended in a coarse grid whose nearest free cell wins, and the
     grid is what put the callouts a long way off (2560: חזית חרד 1,771px from
     its belt, 69% of the slide). So the RINGS are the search: fifty-six
     directions at every one (the authored side, the other three, the corners,
     forty-eight angles between), rings out to RINGS, stepping by the wider of
     the old gap and a twenty-fourth of the canvas - wide, because a candidate
     whose leader would cross a word is thrown away now, not scored down.
     `bars` is ground a BOX may not take, `taken` and `mine` what a LEADER may
     not cross. The grid stays as the backstop.

     FOUR STAGES, and that is a cost decision. Every candidate is asked the
     cheap question - is the STRAIGHT line clean - and the ones that say no are
     kept on a list, nearest first. Only then the twenty elbows, then the sixty
     staircases, and only for the nearest sixty the way round. Asking all of
     them at every one of a thousand candidates was thirty times the work.

     The winner carries its own `route` - the polyline the leader is to be drawn
     along - so the caller paints exactly the line that was tested. `pass` is 2
     for a straight leader, 1 for a bent one and 0 for the least-bad box, which
     comes back only when nothing anywhere had a clean way out; `route` is null
     there and the caller must report it rather than paint quietly. */
  function findSpot(s, first, w, h, u, bars, taken, mine, leaders, W, H) {
    var order = [first].concat(SIDES.filter(function (a) { return a !== first; }))
      .concat(DIAG);
    var avoid = taken === mine ? taken : taken.concat(mine);
    var step = Math.max(NOTE_GAP * u, Math.min(W, H) / 24);
    var rad0 = Math.hypot(w, h) / 2 + Math.hypot(s.x1 - s.x0, s.y1 - s.y0) / 2;
    var pick = null, cost = Infinity, pend = [], dirty = null, dirtyD = Infinity;
    var ring, off, k, i, ang, spot, b, d, rt;
    function weigh(box, cx, cy) {
      d = Math.hypot(cx - s.cx, cy - s.cy);
      if (d < dirtyD) { dirtyD = d; dirty = box; }
      if (d >= cost) return;                /* it could not win even if clean */
      rt = best(box, s, avoid, leaders, 1);
      if (rt) { cost = d; pick = box; pick.route = rt; pick.pass = 2; return; }
      pend.push({ box: box, d: d });
    }
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
        weigh(b, spot[0], spot[1]);
      }
    }
    /* The backstop: every position on a coarse grid - "never dropped" also
       meaning "never overprinted while there was room". 0-3 ms. */
    var gx, gy, cx, cy;
    for (gx = 0; gx <= 64 && W - w >= 0 && !pick; gx++) {
      for (gy = 0; gy <= 40 && H - h >= 0; gy++) {
        cx = w / 2 + (W - w) * gx / 64; cy = h / 2 + (H - h) * gy / 40;
        b = boxAt(cx, cy, w, h);
        if (fits(b, bars, W, H)) weigh(b, cx, cy);
      }
    }
    pend.sort(function (a, q) { return a.d - q.d; });
    var lim = Math.min(pend.length, ELBOW_TRIES);
    for (i = 0; i < lim; i++) {
      if (pend[i].d + BEND_PEN * W >= cost) break;
      rt = best(pend[i].box, s, avoid, leaders, 2);
      if (rt) {
        b = pend[i].box; b.route = rt; b.pass = 1;
        return b;
      }
    }
    /* AND A STAIRCASE IF EVEN THE ELBOWS WERE BLOCKED - two bends, sixty of
       them, and only for the boxes that got this far. */
    for (i = 0; i < lim && i < STAIR_TRIES; i++) {
      if (pend[i].d + 2 * BEND_PEN * W >= cost) break;
      rt = best(pend[i].box, s, avoid, leaders, 3);
      if (rt) {
        b = pend[i].box; b.route = rt; b.pass = 1;
        return b;
      }
    }
    if (pick) return pick;
    /* AND THE WAY ROUND, for the nearest sixty only: it is the dearest question
       on the page, and it is asked where no spot ANYWHERE had a clean line -
       the case that used to end in a fault. Twelve was not enough: the 1230 px
       callouts picture still crossed two of its own leaders, measured. */
    for (i = 0; i < lim && i < ROUND_TRIES; i++) {
      rt = best(pend[i].box, s, avoid, leaders, 4, W, H);
      if (rt) { b = pend[i].box; b.route = rt; b.pass = 1; return b; }
    }
    /* NOTHING CLEAN ANYWHERE, so take the LEAST BAD and say so. Still painted -
       a blank space hides a fault a line would show - but the box chosen is the
       one whose line touches the fewest words and crosses the fewest leaders,
       and `pass: 0` makes the caller report it. */
    var worst = null, low = Infinity, n2;
    var ls = (leaders || []).map(asLeader);
    for (i = 0; i < lim; i++) {
      (function (box) {
        options(box, s).concat(stairs(box, s)).forEach(function (r2) {
          n2 = overText(r2, avoid, box, s) + r2.bend * 0.25 +
            ls.filter(function (l) {
              return l.segs.some(function (q) {
                return segBox(q, box) ||
                  r2.segs.some(function (g) { return segCross(g, q); });
              });
            }).length;
          if (n2 < low) { low = n2; worst = { box: box, rt: r2 }; }
        });
      }(pend[i].box));
      if (low < 1) break;
    }
    if (worst) {
      worst.box.pass = 0; worst.box.route = worst.rt;
      return worst.box;
    }
    if (dirty) { dirty.pass = 0; dirty.route = null; return dirty; }
    spot = sideSpot(s, first, w, h, NOTE_GAP * u);
    b = boxAt(Math.min(Math.max(spot[0], w / 2), W - w / 2),
              Math.min(Math.max(spot[1], h / 2), H - h / 2), w, h);
    b.pass = 0; b.route = null;
    return b;
  }

  /* ---- painting ------------------------------------------------------------- */

  function trace(ctx, pts) {
    var i;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  }
  /* Halo under ink, as a town name is set, because a leader crosses terrain and
     territory colours on its way. ONE stroke for the whole polyline: two haloes
     meeting at a bend would print a pale notch through the corner. */
  function paint(ctx, P, u, rt) {
    var D = R();
    if (!D || !rt || rt.pts.length < 2 || !rt.segs.length) return;
    var j0 = ctx.lineJoin;
    ctx.lineJoin = "round";
    trace(ctx, rt.pts);
    D.paintShape(ctx, { stroke: P.halo, width: Math.max(3, 3.5 * u) });
    trace(ctx, rt.pts);
    D.paintShape(ctx, { stroke: P.ink, width: Math.max(1.5, 1.5 * u) });
    ctx.lineJoin = j0;
  }
  /* The last leg, for a caller that ends its leader in an arrowhead. */
  function tip(rt) {
    return (rt && rt.segs.length) ? rt.segs[rt.segs.length - 1] : null;
  }
  /* ONE SEGMENT, for hairlines not routed at all: two rectangles a few pixels
     apart with nowhere to bend to. Re-exported as `kit.leader`. */
  function line(ctx, P, u, g) {
    paint(ctx, P, u, { pts: [[g[0], g[1]], [g[2], g[3]]], segs: [g] });
  }

  /* ---- what the picture is telling the check --------------------------------- */

  /* How many PAIRS of these routes cross each other; zero on every map today. */
  function crossings(routes) {
    var n = 0, i, k;
    for (i = 0; i < routes.length; i++) {
      for (k = i + 1; k < routes.length; k++) {
        if (!routes[i] || !routes[k]) continue;
        if (routes[i].segs.some(function (g) {
          return routes[k].segs.some(function (q) { return segCross(g, q); });
        })) n++;
      }
    }
    return n;
  }
  /* The shared counters (dossier_map_check.js), guarded: the board draws
     without a verifier on the page. */
  function tell(key, n) {
    if (n && window.DossierMapCheck && DossierMapCheck.add) {
      DossierMapCheck.add(key, n);
    }
  }
  /* A painted text size in CSS px on a 1280-wide canvas - the width these
     painters are written for - so one floor means the same everywhere. */
  function size(px, W) {
    var css = W ? px * 1280 / W : px;
    if (window.DossierMapCheck && DossierMapCheck.text) DossierMapCheck.text(css);
    return css;
  }
  /* AND IT IS SAID OUT LOUD: a picture that could not place a line cleanly is
     still painted, but names the map and the note in the console. */
  function fault(mapId, what, over, cross) {
    if (!over && !cross) return;
    tell("line_over_text", over);
    tell("leader_crossings", cross);
    console.error("dossier map leader: " + (mapId || "?") + " - " + what +
      " - over text " + over + ", crossing " + cross);
  }

  return { segBox: segBox, segCross: segCross, straight: straight, best: best,
           options: options, paint: paint, line: line, tip: tip,
           segsOf: segsOf, lengthOf: lengthOf, overText: overText,
           crossings: crossings, tell: tell, size: size, fault: fault,
           findSpot: findSpot, wrap: wrap, boxAt: boxAt, fits: fits,
           leaderSeg: leaderSeg, segLen: segLen, edgeness: edgeness,
           rimBars: rimBars, SIDES: SIDES };
})();

window.DossierMapLeader = DossierMapLeader;
