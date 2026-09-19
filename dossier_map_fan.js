/* THE GUTTER FAN - how a mark on the map reaches its row in the key panel.

   Ziv, 2026-09-18: *"draw a line from the black cube of each one of them, or
   from the number, into the left side of the text on the right side, so people
   can follow the line and see the explanation."*

   THE FIRST ANSWER WAS ROUTED AND IT FAILED THAT SENTENCE. Every connector was
   given to a maze router that found the cheapest clean way to its row, and the
   three things it did are all the same fault seen from three sides: five lines
   arrived at the panel's edge and then ran DOWN it, merging into one bar nobody
   could follow to a row; two lines on the Marib picture and three on the heat
   one took a lap of the whole map to get round a name; and a number that could
   not be glued to its own name was parked beside a neighbour's. A reader who
   cannot tell which line is theirs has exactly what they had with no lines.

   SO THE SHAPE IS FIXED AND NOTHING SEARCHES FOR IT. Three bands across the
   canvas - map, gutter, list - and every connector is the same three parts:

     a STUB   - out of the mark at 45 degrees or flatter, as short as the shift
                to its lane allows, and nothing at all when the lane is already
                at the mark's own height;
     a LANE   - one horizontal run east, across the map, to the map's right edge;
     a FAN    - one straight segment across the gutter to the left edge of its
                row's text, ending in a filled dot.

   Two properties come out of that and they are the whole point. The lanes are
   ordered: lane_y rises strictly with the row index and never by less than
   LANE_GAP, so no lane can cross another. Both ends of every fan segment are
   then in the same order - x is the same at each end for all of them - so the
   fan cannot cross itself either. Nothing runs along the panel border because
   nothing in the shape is vertical.

   AND THE LANES ARE RESERVED BEFORE THE NAMES ARE PLACED. `plan` runs inside
   dossier_map.js's paintMap before the legend is laid out and before a single
   town name, governorate name, front name, disc or heat badge has chosen its
   spot, and pushes every stub and lane into `taken` as thin rectangles. So the
   WORDS move out of the line's way, which is the right way round: a line that
   dodges is a line that detours, and a detour was the fault. A lane may cross
   terrain, borders, a hatched zone and the line of contact - none of those is
   read - but never a word, and never another note's own mark, which is the one
   obstacle that exists this early and the one `plan` searches around.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapFan = { plan, get, forget, paint, LANE_GAP }

   The key box's own move out of the lanes' way is dossier_map_link.js, which is
   also what dossier_map_key.js calls to draw; this file owns the geometry and
   the three accusations it files into dossier_map_check.js. */
"use strict";

var DossierMapFan = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_fan: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  /* Every number is written for a 1280-wide canvas and scaled by u, the way
     every other size on these maps is. */
  var LINE_W = 1.6;        /* the connector's own weight */
  var LANE_GAP = 9;        /* the smallest step between two lanes */
  /* HOW MUCH CLEAR AIR A LANE RESERVES EITHER SIDE, and it is deliberately
     thin. A reservation runs the whole width of the map, so six lanes through a
     cluster take six full-width strips out of the ground the names in that
     cluster have to stand on; at 5 it cost the Marib picture its Tadween label
     and the heat picture its Hayfan, which is rule 6 traded for rule 4 and not
     a trade this may make. The honest clearance comes from `settle`, which
     moves a lane to the roomiest height that is clean once every name is down. */
  var LANE_PAD = 2;
  var DOT_R = 2.6;         /* the filled dot at the row end */
  var EDGE = 10;           /* how far off the map's top and bottom a lane stays */
  var TAIL = 12;           /* the shortest horizontal run a lane keeps */
  var PORT = 3;            /* the gap the dot leaves before the row's first letter */
  var STEPS = 30;          /* offsets a blocked lane tries inside its own band */
  /* HOW MUCH LONGER THAN THE STRAIGHT LINE A CONNECTOR MAY BE. A stub plus a
     lane plus a fan is never much more than the diagonal it replaces; 1.35 is
     loose enough for a mark directly above its row and tight enough that the
     lap-of-the-map routes this file replaced would all have failed it. */
  var DETOUR = 1.35;

  var PLAN = null;

  /* ---- the marks this picture has to join --------------------------------- */

  /* The mark's own radius, read from the same table the map drew it with
     (dossier_map_routes.js), so the line starts exactly clear of the square and
     not at a number copied over here. */
  function radius(pinR, place, map) {
    var R = window.DossierMapRoutes;
    var hit = ((map && map.labels) || []).filter(function (l) {
      return l.place === place;
    })[0];
    return R && R.markClear ? R.markClear(pinR, hit && hit.kind) : pinR;
  }
  /* One entry per note, in NOTE ORDER - which is row order, and which the build
     guarantees runs north to south (`check_order`, scripts\dossier_maps_notes.py).
     A note whose place falls outside this frame has no mark and gets no
     connector; `paint` counts it as a row that was not joined. */
  function marksOf(p, map, pinR) {
    var out = [];
    ((map && map.notes) || []).forEach(function (n, i) {
      if (typeof n.lon !== "number" || typeof n.lat !== "number") return;
      if (!p.inside(n.lon, n.lat, 0)) return;
      var q = p(n.lon, n.lat);
      out.push({ n: i + 1, place: n.place, mx: q[0], my: q[1],
                 r: radius(pinR, n.place, map) });
    });
    return out;
  }

  /* ---- where each lane sits ------------------------------------------------ */

  /* THE NEAREST NON-DECREASING SEQUENCE, in least squares - pool adjacent
     violators. Every lane wants to sit at its own mark's height and the set has
     to rise with the row index; this is the assignment that moves them the least
     in total, so a lane is shifted only as far as the order really forces. */
  function isotonic(want) {
    var v = [], w = [], out = [], i, k, a, wa, b, wb;
    for (i = 0; i < want.length; i++) {
      v.push(want[i]); w.push(1);
      while (v.length > 1 && v[v.length - 2] > v[v.length - 1]) {
        a = v.pop(); wa = w.pop(); b = v.pop(); wb = w.pop();
        v.push((a * wa + b * wb) / (wa + wb)); w.push(wa + wb);
      }
    }
    for (i = 0; i < v.length; i++) {
      for (k = 0; k < w[i]; k++) out.push(v[i]);
    }
    return out;
  }
  /* The lanes' heights before anything is dodged: each mark's own y, pulled into
     a strictly rising set with LANE_GAP between neighbours, then held inside the
     picture with room left below for everyone still to come. */
  function heights(marks, gap, H, u) {
    var n = marks.length, top = EDGE * u, bot = H - EDGE * u, i;
    var want = marks.map(function (m, i2) { return m.my - i2 * gap; });
    var got = isotonic(want).map(function (v, i2) { return v + i2 * gap; });
    for (i = n - 1; i >= 0; i--) {
      got[i] = Math.min(got[i], bot - (n - 1 - i) * gap);
    }
    for (i = 0; i < n; i++) {
      got[i] = Math.max(got[i], i ? got[i - 1] + gap : top);
    }
    return got;
  }

  /* ---- one connector's map half -------------------------------------------- */

  function rectsOf(pts, hh) {
    var out = [], i, k, a, b, n, t0, t1, x0, y0, x1, y1;
    for (i = 1; i < pts.length; i++) {
      a = pts[i - 1]; b = pts[i];
      /* A diagonal is reserved in three pieces rather than as one bounding box:
         the box of a long 45-degree run is a square the size of the shift, and
         reserving that much would push names that the line never goes near. */
      n = Math.abs(b[1] - a[1]) > 1 ? 3 : 1;
      for (k = 0; k < n; k++) {
        t0 = k / n; t1 = (k + 1) / n;
        x0 = a[0] + (b[0] - a[0]) * t0; y0 = a[1] + (b[1] - a[1]) * t0;
        x1 = a[0] + (b[0] - a[0]) * t1; y1 = a[1] + (b[1] - a[1]) * t1;
        /* `lane` MARKS THESE AS NOT-A-LABEL. They go into the same `taken` list
           the names do, and dossier_map_number.js finds a place's name box by
           looking there for the one rectangle centred on the place's own axis a
           short gap out - which a lane leaving that very mark is, exactly. With
           no flag the first Marib number glued itself to its own lane and sat
           600px east of the name it was meant to be part of. */
        out.push({ lane: 1,
                   x0: Math.min(x0, x1) - hh, y0: Math.min(y0, y1) - hh,
                   x1: Math.max(x0, x1) + hh, y1: Math.max(y0, y1) + hh });
      }
    }
    return out;
  }
  /* The stub and the lane for one mark at one lane height. The stub leaves the
     mark along the ray that reaches lane_y at 45 degrees, so it is as short as a
     45-degree stub can be; where the shift is smaller than the mark's own
     clearance the same formula simply lays the line flatter. */
  function runOf(m, y, W, u, hh) {
    var gap = m.r + 3 * u, ad = Math.abs(y - m.my);
    var sx = Math.min(m.mx + Math.max(gap, ad), W - TAIL * u);
    var ex = sx - m.mx, ey = y - m.my, L = Math.hypot(ex, ey) || 1;
    var pts = [[m.mx + ex / L * gap, m.my + ey / L * gap]];
    if (Math.hypot(sx - pts[0][0], y - pts[0][1]) > 0.5) pts.push([sx, y]);
    pts.push([W, y]);
    return { pts: pts, rects: rectsOf(pts, hh) };
  }
  /* Does this run touch somebody else's mark? The only thing on the canvas when
     the lanes are laid out - every word is placed after them, and moves. */
  function hits(m, run, marks, u) {
    var R = D();
    return marks.some(function (o) {
      if (o === m) return false;
      var b = { x0: o.mx - o.r - 2 * u, y0: o.my - o.r - 2 * u,
                x1: o.mx + o.r + 2 * u, y1: o.my + o.r + 2 * u };
      return run.rects.some(function (t) { return R.overlaps(t, b); });
    });
  }
  /* ---- the plan ------------------------------------------------------------ */

  /* Called from dossier_map.js's paintMap, BEFORE the legend is laid out and
     before any name is placed, with the map area's own width and height. It
     returns null - and forgets the last plan - for every picture that draws no
     connectors: a map that is not a key panel, the SQUARE download (its panel
     sits under the map, where a line to a lower row would cross the rows above
     it), and a canvas too narrow for a panel at all. */
  function plan(p, mu, map, W, H, taken, pinR, split) {
    PLAN = null;
    if (!map || map.key !== "panel" || !p) return null;
    if (!split || !split.panel || (split.panel.cols || 1) !== 1) return null;
    var marks = marksOf(p, map, pinR);
    if (!marks.length) return null;
    /* EVERY SIZE HERE IS THE CANVAS'S, NOT THE MAP AREA'S. paintMap is handed
       the map area's own width and its `u` is that rectangle's - about half the
       canvas's on this split - and a lane gap or a line weight written for a
       1280 CANVAS has to be scaled by the canvas. The positions need no
       conversion at all: the wide split puts the map area at the origin, so a
       map-area pixel IS a canvas pixel. */
    var u = (split.panel.x + split.panel.w) / 1280;
    var gap = LANE_GAP * u, hh = (LINE_W / 2 + LANE_PAD) * u;
    var want = heights(marks, gap, H, u), rects = [];
    var top = EDGE * u, bot = H - EDGE * u, n = marks.length;
    marks.forEach(function (m, i) {
      /* THE BAND THIS LANE MAY MOVE IN, and it is closed on both sides: above
         by the lane already decided, below by the room the rows still to come
         need. So dodging a mark can never break the order the whole shape rests
         on, and it can never push the last lane off the picture. */
      var lo = i ? marks[i - 1].y + gap : top;
      var hi = bot - (n - 1 - i) * gap;
      /* THE CLEAN HEIGHT NEAREST THE MARK'S OWN, not the first clean one found.
         The band is scanned outwards from where the order wants this lane and
         every clean height in it is measured back to the MARK, so the lane that
         is taken is the one with the shortest stub - the whole band is looked
         at before anything is chosen. Taking the first clean height instead
         cost the Marib picture two of its objective names on screen. */
      var y0 = Math.min(Math.max(want[i], lo), hi), best = null;
      var k, t, tryY, run, d;
      for (k = 0; k <= STEPS; k++) {
        for (t = k ? -1 : 1; t <= 1; t += 2) {
          tryY = y0 + t * k * 2 * u;
          if (tryY < lo - 0.01 || tryY > hi + 0.01) continue;
          run = runOf(m, tryY, W, u, hh);
          if (hits(m, run, marks, u)) continue;
          d = Math.abs(tryY - m.my);
          if (!best || d < best.d) best = { d: d, y: tryY, run: run };
        }
      }
      /* Nothing clean inside the band: the lane is drawn where it wants to be
         and `paint` counts the crossing, so the dump refuses the picture rather
         than a reader meeting a line through a mark nobody explained. */
      if (!best) best = { y: y0, run: runOf(m, y0, W, u, hh) };
      var y = best.y; run = best.run;
      m.y = y; m.pts = run.pts; m.rects = run.rects;
      run.rects.forEach(function (t2) { taken.push(t2); rects.push(t2); });
    });
    PLAN = { mapId: (map && map.id) || "?", W: W, H: H, u: u,
             marks: marks, rects: rects };
    return PLAN;
  }
  function get() { return PLAN; }
  function forget() { PLAN = null; }

  /* ---- one nudge, with everything down ------------------------------------- */

  /* THE LANES ARE LAID OUT BEFORE A WORD IS PLACED, WHICH IS WHAT GETS THE
     WORDS OFF THEM - but some ink on a map does not move at all and is not
     reserved until later: a front's red diamond, a town's own dot, another
     note's square (dossier_map_ink.js `reserve`, called from placeLabels). So
     before anything is painted each lane is offered a small move inside its own
     band, and takes one only where the new height is clean against EVERY
     rectangle on the finished picture. It can therefore never buy itself a
     dodge at the price of a line over a name: when nothing is clean it stays
     exactly where it was planned and `line_over_text` counts the crossing.
     Its own mark is excepted, the way every leader on this board excepts the
     thing it has to start from. */
  function holds(t, x, y) {
    return x >= t.x0 && x <= t.x1 && y >= t.y0 && y <= t.y1;
  }
  function clean(run, bars, pad) {
    var R = D();
    return !bars.some(function (t) {
      return run.rects.some(function (b) {
        return R.overlaps({ x0: b.x0 + pad, y0: b.y0 + pad,
                            x1: b.x1 - pad, y1: b.y1 - pad }, t);
      });
    });
  }
  function settle(avoid) {
    if (!PLAN) return;
    var u = PLAN.u, W = PLAN.W, H = PLAN.H, ms = PLAN.marks, n = ms.length;
    var gap = LANE_GAP * u, hh = (LINE_W / 2 + LANE_PAD) * u;
    /* Two passes: first keeping the lane's full clear air, then hugging the
       line itself, which is the margin the picture check actually measures. */
    var PADS = [0, hh - (LINE_W / 2 + 1) * u];
    ms.forEach(function (m, i) {
      var lo = i ? ms[i - 1].y + gap : EDGE * u;
      var hi = H - EDGE * u - (n - 1 - i) * gap;
      var bars = avoid.filter(function (t) { return !holds(t, m.mx, m.my); });
      var y = Math.min(Math.max(m.y, lo), hi), got = null, k, t, pad, run;
      PADS.forEach(function (px) {
        if (got !== null) return;
        pad = px;
        if (clean(runOf(m, y, W, u, hh), bars, pad)) { got = y; return; }
        for (k = 1; k <= STEPS && got === null; k++) {
          for (t = -1; t <= 1 && got === null; t += 2) {
            var tryY = y + t * k * 2 * u;
            if (tryY < lo || tryY > hi) continue;
            if (clean(runOf(m, tryY, W, u, hh), bars, pad)) got = tryY;
          }
        }
      });
      m.y = got === null ? y : got;
      run = runOf(m, m.y, W, u, hh);
      m.pts = run.pts;
    });
  }

  /* ---- painting ------------------------------------------------------------ */

  function stroke(ctx, P, u, pts, cased) {
    var R = D(), i;
    if (!pts || pts.length < 2) return;
    var j0 = ctx.lineJoin, c0 = ctx.lineCap;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    function trace() {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    }
    /* A CASING ON THE MAP HALF ONLY. The line crosses terrain, territory colour
       and hatching there and would be lost in it without one; in the gutter it
       runs on the list's own flat ground, where a halo round it only reads as a
       smudge. */
    if (cased) {
      trace();
      R.paintShape(ctx, { stroke: P.halo, width: Math.max(3.4, 3.6 * u) });
    }
    trace();
    R.paintShape(ctx, { stroke: P.ink, width: Math.max(1.6, LINE_W * u) });
    ctx.lineJoin = j0; ctx.lineCap = c0;
  }
  function segsOf(pts) {
    var out = [], i;
    for (i = 1; i < pts.length; i++) {
      if (Math.hypot(pts[i][0] - pts[i - 1][0],
                     pts[i][1] - pts[i - 1][1]) >= 0.5) {
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

  /* ---- the three accusations ----------------------------------------------- */

  /* DO TWO RUNS LIE ON TOP OF EACH OTHER? Parallel, within a line's width of the
     same line, and overlapping along it by more than a hair. This is the test
     the old router had no answer to: five connectors sharing the panel's edge
     were five clean routes by every rule it knew. */
  function collinear(a, b, u) {
    var ax = a[2] - a[0], ay = a[3] - a[1], bx = b[2] - b[0], by = b[3] - b[1];
    var la = Math.hypot(ax, ay), lb = Math.hypot(bx, by), s0, s1, sw;
    if (la < 1 || lb < 1) return false;
    if (Math.abs(ax * by - ay * bx) / (la * lb) > 0.02) return false;
    if (Math.max(Math.abs((b[0] - a[0]) * ay - (b[1] - a[1]) * ax),
                 Math.abs((b[2] - a[0]) * ay - (b[3] - a[1]) * ax)) / la >
        Math.max(1.5, 1.5 * u)) return false;
    s0 = ((b[0] - a[0]) * ax + (b[1] - a[1]) * ay) / la;
    s1 = ((b[2] - a[0]) * ax + (b[3] - a[1]) * ay) / la;
    if (s0 > s1) { sw = s0; s0 = s1; s1 = sw; }
    return Math.min(la, s1) - Math.max(0, s0) > Math.max(4, 4 * u);
  }
  function merges(routes, u) {
    var n = 0, i, k;
    for (i = 0; i < routes.length; i++) {
      for (k = i + 1; k < routes.length; k++) {
        if (routes[i].segs.some(function (g) {
          return routes[k].segs.some(function (q) { return collinear(g, q, u); });
        })) n++;
      }
    }
    return n;
  }

  /* ---- drawing the set ------------------------------------------------------ */

  /* `seats` is what the panel painted: one per ROW, with the row's own left edge
     and vertical middle. `mapW` is the map area's right edge, which on the wide
     split is also the gutter's left edge. Everything is in canvas pixels, which
     the map area's are too on this split - dossier_map_link.js asserts that
     before calling. */
  function paint(ctx, P, u, map, seats, mapW, avoid) {
    var L = window.DossierMapLeader;
    var out = { lines: 0, blocked: 0, crossings: 0, over: 0, merges: 0,
                detours: 0, of: seats.length, miss: [] };
    var by = {}, routes = [];
    if (!PLAN || PLAN.mapId !== ((map && map.id) || "?")) return out;
    settle(avoid);
    PLAN.marks.forEach(function (m) { by[m.n] = m; });
    seats.forEach(function (s) {
      var m = by[s.n];
      if (!m) { out.miss.push(s.n); return; }
      var port = [s.x - PORT * u, s.y];
      var pts = m.pts.concat([port]);
      var rt = { n: s.n, m: m, port: port, pts: pts, segs: segsOf(pts),
                 len: lengthOf(pts), box: null,
                 s: { cx: port[0], cy: port[1] } };
      rt.straight = Math.hypot(port[0] - m.mx, port[1] - m.my);
      routes.push(rt);
    });
    routes.forEach(function (rt) {
      stroke(ctx, P, u, rt.m.pts, true);
      stroke(ctx, P, u, [rt.m.pts[rt.m.pts.length - 1], rt.port], false);
      /* The claim that this line NAMES its mark (MAP_RULES.md rule 8) is made
         from the lane plan in dossier_map.js, not here: this runs after the
         map's own audit, which the panel is painted downstream of. */
      ctx.beginPath();
      ctx.arc(rt.port[0], rt.port[1], Math.max(2.2, DOT_R * u), 0, Math.PI * 2);
      D().paintShape(ctx, { fill: P.ink });
      out.lines++;
      if (rt.straight > 0 && rt.len > DETOUR * rt.straight) out.detours++;
      if (L) out.over += L.overText(rt, avoid, null, rt.s);
    });
    out.merges = merges(routes, u);
    out.blocked = out.miss.length;
    if (L) out.crossings = L.crossings(routes);
    out.routes = routes.length;
    return out;
  }

  return { plan: plan, get: get, forget: forget, paint: paint,
           LANE_GAP: LANE_GAP };
})();

window.DossierMapFan = DossierMapFan;
