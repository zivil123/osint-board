/* THE KEY PANEL'S CONNECTORS, and the key box moved out of their way.

   Ziv, 2026-09-18, looking at the Marib objectives picture: *"I want you to
   draw a line from the black cube of each one of them, or from the number, into
   the left side of the text on the right side, so people can follow the line
   and see the explanation. But make sure that you don't cut anything off and
   you don't cut any text off with arrows... lines that are on actual text, that
   is not good."*

   THE GEOMETRY IS NOT HERE. It is dossier_map_fan.js: three bands across the
   canvas, one lane per row rising in row order, one fan segment each across the
   gutter. This file is the two things that are about the PICTURE rather than
   about the shape - where the key box goes, and what the picture tells the
   check - plus the door dossier_map_key.js calls to draw.

   Why the routed answer this replaced was thrown away, and what each of its
   three failures was, is written at the head of dossier_map_fan.js. One of
   them belongs here: the key box used to be shoved into the left half because
   "the connectors all sweep the right-hand side", which was true of a router
   that fanned out from the panel edge and is not true of lanes. The lanes are
   RESERVED in `taken` before the legend is laid out now, so the legend's own
   corner search - which already keeps off whatever the caller reserved - picks
   a corner no lane crosses, by its own rules, with nothing about its scoring
   copied here. `keyMove` is only the backstop, and it now knows what it is
   avoiding: it acts when the box it can see actually sits on a lane.

   A LINE THAT CANNOT BE DRAWN IS COUNTED, NEVER HIDDEN. A row whose place falls
   outside the frame has no mark to leave from; it is counted in
   `leader_crossings` and named in the console, so the dump refuses the batch
   exactly as a crossing line would make it.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapLink = { guard, keyMove, lanes, draw, key, report }
*/
"use strict";

var DossierMapLink = (function () {
  function fan() { return window.DossierMapFan || null; }
  function overlaps(a, b) {
    return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  }

  /* ---- the key box --------------------------------------------------------- */

  var SLIDE = 20;          /* positions tried down each edge */
  var KEY = null;

  /* Wrapped once, at load, and only to KEEP the legend's own answer: this file
     no longer reserves anything for it, because the lanes are in `taken` by the
     time the search runs. dossier_map.js caches its painters on the FIRST
     paint, so the wrap has to be in place before then, which a script tag on
     the page guarantees. */
  function guard() {
    var G = window.DossierMapLegend;
    if (!G || G.linkGuard) return false;
    var was = G.legendLayout;
    G.legendLayout = function () {
      KEY = null;
      KEY = was.apply(null, arguments);
      return KEY;
    };
    G.linkGuard = true;
    return true;
  }

  /* THE BACKSTOP, on better information than the search had. The corner is
     chosen before a single name is placed; this runs after every name, number
     and hairline is in `taken`, so it can see what the box would really cover.
     It only ever acts when the box is actually sitting on a lane, and it only
     ever slides the box down one of the two edges - a moved box is still pinned
     to an edge, never floating in the middle of the picture. A box that is not
     in THIS picture's `taken` is last picture's and is left alone. */
  function keyMove(u, taken, W, H, wide) {
    var L = KEY, plan = fan() && fan().get();
    guard();          /* idempotent: a page that loaded this file before the
                         legend's still gets the wrap from here on */
    if (!wide || !L || !L.box || taken.indexOf(L.box) < 0) return null;
    var lanes = (plan && plan.rects) || [];
    if (!lanes.length) return null;
    if (!lanes.some(function (t) { return overlaps(L.box, t); })) return null;
    var inset = 14 * u, best = null, i, e, x0, y0, b, c;
    for (e = 0; e < 2; e++) {
      x0 = e ? W - inset - L.w : inset;
      for (i = 0; i <= SLIDE; i++) {
        y0 = inset + Math.max(0, H - 2 * inset - L.h) * i / SLIDE;
        b = { x0: x0, y0: y0, x1: x0 + L.w, y1: y0 + L.h };
        /* A LANE COSTS A THOUSAND NAMES. Both are things the box must not sit
           on, but a name can be re-placed at the next paint and a lane is the
           one line in the picture a reader is meant to follow to its row. */
        c = 0;
        lanes.forEach(function (t) { if (overlaps(b, t)) c += 1000; });
        taken.forEach(function (t) {
          if (t !== L.box && lanes.indexOf(t) < 0 && overlaps(b, t)) c++;
        });
        if (!best || c < best.c) best = { b: b, c: c };
        if (!c) break;
      }
      if (best && !best.c) break;
    }
    L.x0 = best.b.x0; L.x1 = best.b.x1; L.y0 = best.b.y0;
    L.box.x0 = best.b.x0; L.box.y0 = best.b.y0;
    L.box.x1 = best.b.x1; L.box.y1 = best.b.y1;
    return L;
  }

  /* ---- the connectors ------------------------------------------------------ */

  var REPORT = null;

  /* Everything a connector may not touch: every rectangle the map area reserved
     - names, numbers, the key box, the scale bar, the heat badges - plus the
     panel's own rows. THE LANES THEMSELVES COME OUT, and they have to: they are
     in `taken` because the words had to move off them, they are not words, and
     a lane that could not run down its own reservation could not be drawn at
     all. Neighbouring lanes come out with them - the reservations are wider
     than the gap between two lanes, on purpose. */
  function avoidOf(seats, rects) {
    var K, m, plan = fan() && fan().get();
    if (!rects) {
      K = window.DossierMapKey; m = K && K.marks();
      rects = (m && m.taken) || [];
    }
    var mine = (plan && plan.rects) || [];
    var out = rects.filter(function (t) { return mine.indexOf(t) < 0; });
    seats.forEach(function (s) { out.push(s.box); });
    return out;
  }

  /* One connector per row, in row order. `seats` is what the panel painted: the
     row's number, its left edge, its vertical middle and its own box. */
  function draw(ctx, P, u, map, seats, a, W, H, rects) {
    var F = fan(), plan = F && F.get();
    var out = { lines: 0, blocked: seats.length, crossings: 0, over: 0,
                merges: 0, detours: 0, of: seats.length, miss: [] };
    REPORT = out;
    if (!seats.length) { out.blocked = 0; return out; }
    if (!F || !window.DossierMapLeader) {
      console.error("dossier_map_link: dossier_map_fan.js (or" +
        " dossier_map_leader.js) is not on the page - the key panel has its" +
        " numbers and no lines");
      return fault(map, out);
    }
    /* THE MAP AREA'S PIXELS ARE THE CANVAS'S ON THIS SHAPE and the connectors
       are drawn in canvas pixels, so a split that moved the map off the origin
       would silently draw every line in the wrong place. It never does - the
       wide split is x 0, y 0 - and this says so rather than trusting it. */
    if (a.map.x || a.map.y) {
      console.error("dossier_map_link: the map area is not at the canvas" +
        " origin (" + a.map.x + "," + a.map.y + ") - no lines drawn");
      return fault(map, out);
    }
    if (!plan || plan.W !== a.map.w) {
      console.error("dossier_map_link: " + ((map && map.id) || "?") +
        " - no lane plan for this picture (the map painted " +
        (plan ? plan.W : "none") + ", the panel expected " + a.map.w + ")");
      return fault(map, out);
    }
    out = F.paint(ctx, P, u, map, seats, a.map.w, avoidOf(seats, rects));
    REPORT = out;
    out.miss.forEach(function (n) {
      console.error("dossier_map_link: " + ((map && map.id) || "?") +
        " - row " + n + " has no mark on this frame, so no line to it");
    });
    return fault(map, out);
  }

  /* WHAT THE PICTURE TELLS THE CHECK. The two older counters keep their
     meaning; the two new ones are the faults the routed answer could not see,
     and they are filed even at zero so the dump's own line is the evidence that
     the rules ran at all (dossier_map_check.js treats any counter it was not
     told is inventory as an accusation, so a zero passes and a one fails). */
  function fault(map, out) {
    var C = window.DossierMapCheck, L = window.DossierMapLeader;
    if (L) L.fault((map && map.id) || "?", "key panel connectors",
                   out.over, out.crossings + out.blocked);
    if (C) {
      C.add("connector_merge", out.merges || 0);
      C.add("connector_detour", out.detours || 0);
    }
    if (out.merges || out.detours) {
      console.error("dossier map connectors: " + ((map && map.id) || "?") +
        " - merged runs " + out.merges + ", detours " + out.detours);
    }
    return out;
  }

  var Link = { guard: guard, keyMove: keyMove, draw: draw,
               key: function () { return KEY; },
               report: function () { return REPORT; } };
  guard();
  return Link;
})();

window.DossierMapLink = DossierMapLink;
