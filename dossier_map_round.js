/* THE WAY ROUND, when a straight line, an elbow and a staircase are all
   blocked - the last thing a leader is offered before the picture is told it
   has a fault.

   MAP_RULES.md rule 4: *"The line goes around, with one bend if that is what it
   takes; if no clean path exists, the picture fails and is not shipped."*
   dossier_map_leader.js offers a line three shapes - straight, one elbow (out of
   an edge, along, in), one staircase (out, along, across, in) - and every one of
   them is a CORRIDOR BETWEEN THE BOX AND ITS MARK. Measured 2026-09-22 on the
   four red leaders left on the board: a grid flood from the box to the mark
   found a clean way through in all four, 58 to 180 px long, and not one of the
   eighty-one shapes could express it, because every one of them went round the
   near side of a word that had to be passed on the far side.

   So this file answers the question the three shapes cannot: is there ANY clean
   way, and what is the shortest one. The corners of the words in the way are the
   only places a line ever needs to turn, so those corners - pushed PAD out - plus
   the eight ways off the box and the mark itself are a graph, and the shortest
   clean walk through it is the route. It subsumes the three shapes: where one of
   them is clean this file is never asked, and where it is asked the answer is at
   most as long as any of them would have been.

   IT IS THE LAST RESORT AND IT IS NOT FREE - a hundred nodes is five thousand
   segment tests - so dossier_map_leader.js asks it only where everything else
   failed, and for a handful of candidate boxes rather than the nine hundred the
   elbows get. A picture that never had a blocked leader never runs a line of it.

   AND IT REFUSES A WILD DETOUR. A leader is read as "this box belongs to that
   mark"; a line four times the straight run long is no longer read that way, so
   DETOUR is a ceiling and a route over it is no route - the picture then fails
   and says so, which is rule 4's own answer.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapRound = { path(box, s, avoid, leaders, W, H) }

   The route it returns is dossier_map_leader.js's own shape - {pts, segs, bend,
   len} - built with that file's `segsOf` and `lengthOf`, and every "does this
   line touch that rectangle" is that file's `segBox`. There is one answer to
   that question on this board and it is not in here. */
"use strict";

var DossierMapRound = (function () {
  function L() { return window.DossierMapLeader || null; }

  /* How far off a word's corner the line turns. Two would graze it: `segBox`
     pulls a rectangle in by a pixel, so a path exactly on the corner is already
     "not touching" and looks it. Three reads as deliberate at every width. */
  var PAD = 3;
  /* The graph's ceiling. Ninety-six corners is twenty-two words in the way,
     which no picture on this board has ever had; past that the nearest are
     kept, so the router stays fast and never simply gives up on a crowd. */
  var MAX_NODES = 96;
  /* The longest way round, as a multiple of the straight run. */
  var DETOUR = 4;

  /* What rule 4 does NOT ask a leader to avoid: its own box, a MARK (an arrow
     must reach a place whose dot is under it), and any rectangle the mark
     itself sits inside - the name a pointer is pointing at. The same three
     `holds` excuses in dossier_map_leader.js. */
  function excused(t, box, s) {
    return !t || t === box || !!t.mark ||
      (s.cx >= t.x0 && s.cx <= t.x1 && s.cy >= t.y0 && s.cy <= t.y1);
  }
  function segsIn(l) {
    return (l && l.segs) ? l.segs : (l ? [l] : []);
  }
  function hits(LD, g, rects) {
    var i;
    for (i = 0; i < rects.length; i++) {
      if (LD.segBox(g, rects[i])) return true;
    }
    return false;
  }
  function crosses(LD, g, ls) {
    var i, k;
    for (i = 0; i < ls.length; i++) {
      for (k = 0; k < ls[i].length; k++) {
        if (LD.segCross(g, ls[i][k])) return true;
      }
    }
    return false;
  }
  /* The eight ways off a box: the middle of each edge, then the corners. A
     point ON the edge is outside the box as `segBox` reads it, so a line
     leaving one of these never registers as crossing the box it came from. */
  function exits(b) {
    var mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
    return [[mx, b.y0], [mx, b.y1], [b.x0, my], [b.x1, my],
            [b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]];
  }
  function near(a, b) {
    return Math.abs(a[0] - b[0]) < 0.5 && Math.abs(a[1] - b[1]) < 0.5;
  }
  /* Three points on one line are one leg, not two: a corner the walk turned no
     corner at would be counted as a bend and drawn as a notch. */
  function tidy(pts) {
    var out = [pts[0]], i, a, b, c;
    for (i = 1; i < pts.length - 1; i++) {
      a = out[out.length - 1]; b = pts[i]; c = pts[i + 1];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) -
                   (b[1] - a[1]) * (c[0] - a[0])) > 0.5) out.push(b);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  /* The shortest clean way from this box to this mark, or null when there is
     none - and a null here is the picture's fault, not a licence to paint over
     a word. `avoid` is every rectangle already on the canvas, `leaders` the
     routes already drawn; W and H keep the walk on the picture. */
  function path(box, s, avoid, leaders, W, H) {
    var LD = L();
    if (!LD || !box || !s) return null;
    var ls = (leaders || []).map(segsIn).filter(function (g) {
      return g.length;
    });
    var i, k, g;
    /* A LEADER ALREADY THROUGH THIS BOX IS NOT A ROUTING PROBLEM - no way out
       of it is clean - so the box is refused, exactly as `clear` refuses it. */
    for (i = 0; i < ls.length; i++) {
      for (k = 0; k < ls[i].length; k++) {
        if (LD.segBox(ls[i][k], box)) return null;
      }
    }
    var rects = (avoid || []).filter(function (t) {
      return !excused(t, box, s);
    });
    var straight = Math.hypot(
      Math.max(box.x0, Math.min(s.cx, box.x1)) - s.cx,
      Math.max(box.y0, Math.min(s.cy, box.y1)) - s.cy);
    var cap = DETOUR * straight;
    /* ONLY THE WORDS THAT COULD POSSIBLY BE IN THE WAY, and only their corners:
       a rectangle outside the box-and-mark region, grown by the straight run,
       can neither block a walk inside it nor offer a corner worth turning at. */
    var x0 = Math.min(box.x0, s.cx) - straight, x1 = Math.max(box.x1, s.cx) + straight;
    var y0 = Math.min(box.y0, s.cy) - straight, y1 = Math.max(box.y1, s.cy) + straight;
    rects = rects.filter(function (t) {
      return t.x1 >= x0 && t.x0 <= x1 && t.y1 >= y0 && t.y0 <= y1;
    });
    rects.push(box);
    var pts = exits(box), mid = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];
    var ends = pts.length, corner = [];
    rects.forEach(function (t) {
      if (t === box) return;
      corner.push([t.x0 - PAD, t.y0 - PAD], [t.x1 + PAD, t.y0 - PAD],
                  [t.x0 - PAD, t.y1 + PAD], [t.x1 + PAD, t.y1 + PAD]);
    });
    corner = corner.filter(function (c) {
      return c[0] >= 0 && c[1] >= 0 && (!W || c[0] <= W) && (!H || c[1] <= H);
    });
    corner.sort(function (a, b) {
      return Math.hypot(a[0] - mid[0], a[1] - mid[1]) -
             Math.hypot(b[0] - mid[0], b[1] - mid[1]);
    });
    pts = pts.concat(corner.slice(0, MAX_NODES));
    var goal = pts.length;
    pts.push([s.cx, s.cy]);
    /* Dijkstra, the legs measured as they are asked for: a walk that reaches
       the mark early never pays for the corners behind it. */
    var n = pts.length, dist = [], from = [], done = [];
    for (i = 0; i < n; i++) { dist.push(Infinity); from.push(-1); done.push(false); }
    for (i = 0; i < ends; i++) dist[i] = 0;
    var at, low, d;
    for (;;) {
      at = -1; low = Infinity;
      for (i = 0; i < n; i++) {
        if (!done[i] && dist[i] < low) { low = dist[i]; at = i; }
      }
      if (at < 0 || low > cap) return null;
      if (at === goal) break;
      done[at] = true;
      for (i = 0; i < n; i++) {
        if (done[i] || i === at || near(pts[at], pts[i])) continue;
        d = low + Math.hypot(pts[i][0] - pts[at][0], pts[i][1] - pts[at][1]);
        if (d >= dist[i] || d > cap) continue;
        g = [pts[at][0], pts[at][1], pts[i][0], pts[i][1]];
        if (hits(LD, g, rects) || crosses(LD, g, ls)) continue;
        dist[i] = d; from[i] = at;
      }
    }
    var walk = [], j = goal;
    while (j >= 0) { walk.unshift(pts[j]); j = from[j]; }
    if (walk.length < 2) return null;
    walk = tidy(walk);
    return { pts: walk, segs: LD.segsOf(walk),
             bend: Math.max(0, walk.length - 2), len: LD.lengthOf(walk) };
  }

  return { path: path, PAD: PAD, DETOUR: DETOUR };
})();

window.DossierMapRound = DossierMapRound;
