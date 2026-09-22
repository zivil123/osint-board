/* WHERE A REGION NAME STANDS - derived from the map's own shapes, never
   authored for fit.

   Written 2026-09-22, after Ziv looked at the tall picture of west_fronts:
   "the names of the counties are in the wrong place - fix it so they are in the
   right position, and make sure it NEVER happens again that they are in wrong
   places." He was looking at al-Hudaydah printed in the sea beside the islands,
   Hajjah in the water off Midi, Jazan at sea, Taiz on the Mocha strip at the
   far edge of its own ground and Sanaa out by the Marib border. Every one of
   those was a HAND anchor authored to make a name FIT - the rim margin, a
   collision - and fit is not truth.

   So the anchor is computed, per frame shape, from the governorate polygon the
   picture already draws: clip it to what the frame shows, take the part with
   the most room in it, and stand the name at that part's POLE OF
   INACCESSIBILITY - the point furthest from any edge. Not the centroid: a
   governorate is a concave thing and its centroid is regularly outside it,
   which is how a name ends up in the sea in the first place.

   The search is a coarse grid over the visible part, refined round the best few
   cells; the distance the point is scored by is the distance to the polygon's
   own edges AND to the frame rim, so a name is never pushed against the edge of
   the picture. Every candidate it returns is a real spot on that governorate's
   ground, best first, which is what lets dossier_map_gov.js NUDGE a name along
   its own land to clear another name instead of moving it off its land.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapGovPoint = { spots, ground, onFill, note, reset, placed }

   dossier_map_gov.js is the only caller; the picture check reaches the result
   through DossierMapGov.placed(mapId, shape). */
"use strict";

var DossierMapGovPoint = (function () {
  /* How far off the canvas rim a derived point is kept, in the 1280-wide units
     every size here is written in. A name may still be wider than the room the
     rim leaves - that is what the coverage test below is for. */
  var RIM = 10;
  /* THE BOX GRID IS THE CHECK'S OWN (scripts\dossier_png_tall.py, GOV_GRID and
     GOV_OWN_MIN, 2026-09-22). The painter and the tool that judges it must
     measure the same thing the same way, or a name passes here and fails there
     for a reason nobody can see. */
  var GRID = [9, 5];
  var OWN_MIN = 0.85;

  var POLY = null;      /* shapeID -> [[ring, hole...], ...] in lon/lat */
  var CACHE = {};       /* projected polygon + candidate spots, per picture */
  var ORDER = [];       /* cache keys, oldest first - the cache is capped */
  var PLACED = {};      /* mapId -> {shape: [...placed names...]} */
  var LAST = {};        /* mapId -> the shape painted last */

  /* ---- the polygons the picture already draws -------------------------- */

  function polys(G) {
    if (POLY) return POLY;
    POLY = {};
    ["yem_adm1", "sau_adm1"].forEach(function (k) {
      var fc = G && G[k];
      ((fc && fc.features) || []).forEach(function (f) {
        var q = f.properties || {}, g = f.geometry || {};
        var parts = g.type === "Polygon" ? [g.coordinates]
          : g.type === "MultiPolygon" ? g.coordinates : [];
        if (q.shapeID) POLY[q.shapeID] = parts;
      });
    });
    return POLY;
  }

  /* One key per PICTURE: the frame it projects and the rectangle it paints
     into. Two shapes of the same map are two different pictures here. */
  function sig(p, W, H) {
    var e = p.extent;
    return Math.round(W) + "x" + Math.round(H) + "|" + e.lon[0].toFixed(3) +
      "|" + e.lat[0].toFixed(3) + "|" + e.lat[1].toFixed(3);
  }
  function keep(k, v) {
    CACHE[k] = v; ORDER.push(k);
    while (ORDER.length > 400) { delete CACHE[ORDER.shift()]; }
    return v;
  }

  /* The rings in PIXELS, each with its own box so a point test can skip the
     islands it can never be in - an admin-1 unit here carries up to 3,245
     points and most of them are somebody else's coast. */
  function projected(G, sid, p, W, H) {
    var k = "g:" + sid + "|" + sig(p, W, H);
    if (CACHE[k]) return CACHE[k];
    var parts = polys(G)[sid];
    if (!parts) return keep(k, null);
    var out = { parts: [], segs: [], x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    parts.forEach(function (poly) {
      var rings = [];
      poly.forEach(function (r) {
        var pts = [], bb = [1e9, 1e9, -1e9, -1e9];
        for (var i = 0; i < r.length; i++) {
          var q = p(r[i][0], r[i][1]);
          pts.push(q);
          if (q[0] < bb[0]) bb[0] = q[0];
          if (q[1] < bb[1]) bb[1] = q[1];
          if (q[0] > bb[2]) bb[2] = q[0];
          if (q[1] > bb[3]) bb[3] = q[1];
        }
        rings.push({ pts: pts, bb: bb });
        if (bb[0] < out.x0) out.x0 = bb[0];
        if (bb[1] < out.y0) out.y0 = bb[1];
        if (bb[2] > out.x1) out.x1 = bb[2];
        if (bb[3] > out.y1) out.y1 = bb[3];
      });
      out.parts.push(rings);
    });
    /* The edges a clearance is measured against. An edge further from the
       canvas than half its width can never be the nearest one to a point
       inside it, and dropping those is what keeps the Saudi regions cheap. */
    var m = Math.max(W, H);
    out.parts.forEach(function (rings) {
      rings.forEach(function (r) {
        if (r.bb[2] < -m || r.bb[0] > W + m || r.bb[3] < -m || r.bb[1] > H + m) return;
        var pts = r.pts;
        for (var i = 0; i < pts.length; i++) {
          var a = pts[i], b = pts[(i + 1) % pts.length];
          out.segs.push(a[0], a[1], b[0], b[1]);
        }
      });
    });
    return keep(k, out);
  }

  function inRing(r, x, y) {
    var bb = r.bb;
    if (y < bb[1] || y > bb[3] || x > bb[2]) return false;
    var pts = r.pts, c = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  /* Inside the unit itself: inside some part's outer ring and in none of that
     part's holes - the same sum the check makes out in the dump. */
  function onLand(S, x, y) {
    if (!S) return false;
    for (var i = 0; i < S.parts.length; i++) {
      var rings = S.parts[i];
      if (!rings.length || !inRing(rings[0], x, y)) continue;
      var hole = false;
      for (var h = 1; h < rings.length && !hole; h++) hole = inRing(rings[h], x, y);
      if (!hole) return true;
    }
    return false;
  }
  function segDist(x, y, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = 0;
    if (L > 0) {
      t = ((x - ax) * dx + (y - ay) * dy) / L;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
    }
    var qx = ax + t * dx - x, qy = ay + t * dy - y;
    return Math.sqrt(qx * qx + qy * qy);
  }

  /* ---- the spots, best first ------------------------------------------- */

  /* How much room a point has: the distance to the nearest edge of its own
     ground, never more than its distance to the frame rim. A point outside the
     ground scores nothing at all. */
  function room(S, x, y, rim, W, H) {
    if (!onLand(S, x, y)) return -1;
    var d = Math.min(x - rim, W - rim - x, y - rim, H - rim - y);
    if (d <= 0) return 0;
    var s = S.segs;
    for (var i = 0; i < s.length; i += 4) {
      var e = segDist(x, y, s[i], s[i + 1], s[i + 2], s[i + 3]);
      if (e < d) { d = e; if (d <= 0) return 0; }
    }
    return d;
  }

  /* EVERY SPOT ON THIS GOVERNORATE'S VISIBLE GROUND, most room first.
     A coarse walk of the part of the polygon box the frame shows, then a hill
     climb round the best few cells. The first of them IS the derived anchor -
     the pole of inaccessibility of the piece with the most room in it, which on
     every picture measured is the largest visible piece; the rest are what a
     name nudges along when the first is taken. */
  function spots(G, sid, p, u, W, H) {
    var k = "s:" + sid + "|" + sig(p, W, H);
    if (CACHE[k]) return CACHE[k];
    var S = projected(G, sid, p, W, H);
    if (!S) return keep(k, []);
    var rim = RIM * u;
    var x0 = Math.max(rim, S.x0), x1 = Math.min(W - rim, S.x1);
    var y0 = Math.max(rim, S.y0), y1 = Math.min(H - rim, S.y1);
    if (x1 <= x0 || y1 <= y0) return keep(k, []);
    var out = [], step = Math.max(3 * u, Math.max(x1 - x0, y1 - y0) / 22);
    for (var pass = 0; pass < 3 && !out.length; pass++) {
      for (var y = y0; y <= y1; y += step) {
        for (var x = x0; x <= x1; x += step) {
          var r = room(S, x, y, rim, W, H);
          if (r > 0) out.push({ x: x, y: y, r: r });
        }
      }
      if (!out.length) step /= 3;         /* a sliver of ground, finer walk */
    }
    out.sort(function (a, b) { return b.r - a.r; });
    out.slice(0, 5).forEach(function (c) {
      var st = step / 2;
      for (var n = 0; n < 5; n++) {
        for (var dx = -1; dx <= 1; dx++) {
          for (var dy = -1; dy <= 1; dy++) {
            var nx = c.x + dx * st, ny = c.y + dy * st;
            var r2 = room(S, nx, ny, rim, W, H);
            if (r2 > c.r) { c.x = nx; c.y = ny; c.r = r2; }
          }
        }
        st /= 2;
      }
    });
    out.sort(function (a, b) { return b.r - a.r; });
    /* Spread them out: twenty candidates 4px apart are one candidate. IN TWO
       TIERS (2026-09-22), because one tier at the grid step was still one
       candidate: the room score falls away from the pole, so the best 24 cells
       all sat within a hundred pixels of it and ONE 31px box over that middle
       took every one of them - measured on the square west picture, 25 spots
       and 50 of 50 tries under something already placed. So a few FINE spots
       round the pole, for the small move that clears a neighbouring word, and
       then a COARSE spread over the rest of the visible ground, which is what
       lets a name cross to the other end of its own governorate. */
    var far = [];
    [[step, 8], [step * 3, 28]].forEach(function (t) {
      out.forEach(function (c) {
        if (far.length >= t[1]) return;
        var near = far.some(function (f) {
          return Math.hypot(f.x - c.x, f.y - c.y) < t[0];
        });
        if (!near) far.push(c);
      });
    });
    return keep(k, far);
  }

  /* ---- is this box on its own ground ----------------------------------- */

  /* The check's own test, so the painter can never place what the dump then
     fails: the centre of the box on the governorate's own land, and at least
     85% of a 9x5 grid across the box on it as well. Sea, a neighbour and the
     ground outside the picture all count the same - not its own. */
  function ground(G, sid, p, W, H, box) {
    var S = projected(G, sid, p, W, H);
    if (!S) return { mid: false, frac: 0 };
    var hit = 0, tot = 0;
    for (var i = 0; i < GRID[0]; i++) {
      for (var j = 0; j < GRID[1]; j++) {
        var x = box.x0 + (i + 0.5) * (box.x1 - box.x0) / GRID[0];
        var y = box.y0 + (j + 0.5) * (box.y1 - box.y0) / GRID[1];
        tot++;
        if (x >= 0 && x <= W && y >= 0 && y <= H && onLand(S, x, y)) hit++;
      }
    }
    var cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
    return { mid: cx >= 0 && cx <= W && cy >= 0 && cy <= H && onLand(S, cx, cy),
             frac: tot ? hit / tot : 0, ok: false };
  }
  function good(g) { return !!g && g.mid && g.frac >= OWN_MIN; }

  /* THE GROUND TAKEN THIS ROUND IS SOMEBODY ELSE'S FILL. `gains_fill` paints
     GEO.recent_gains in a tone of its own, and it is not the governorate's - a
     region name standing in it reads as the name of the captured strip. It is
     not a refusal (the name's own land is the rule), only a preference: a name
     with anywhere else to go goes there. */
  function onFill(G, p, W, H, box) {
    var k = "f:" + sig(p, W, H);
    var S = CACHE[k];
    if (!S) {
      var fc = G && G.recent_gains;
      var out = { parts: [], segs: [] };
      ((fc && fc.features) || []).forEach(function (f) {
        var g = f.geometry || {};
        var parts = g.type === "Polygon" ? [g.coordinates]
          : g.type === "MultiPolygon" ? g.coordinates : [];
        parts.forEach(function (poly) {
          out.parts.push(poly.map(function (r) {
            var pts = [], bb = [1e9, 1e9, -1e9, -1e9];
            r.forEach(function (c) {
              var q = p(c[0], c[1]);
              pts.push(q);
              if (q[0] < bb[0]) bb[0] = q[0];
              if (q[1] < bb[1]) bb[1] = q[1];
              if (q[0] > bb[2]) bb[2] = q[0];
              if (q[1] > bb[3]) bb[3] = q[1];
            });
            return { pts: pts, bb: bb };
          }));
        });
      });
      S = keep(k, out);
    }
    if (!S.parts.length) return 0;
    var hit = 0, tot = 0;
    for (var i = 0; i < GRID[0]; i++) {
      for (var j = 0; j < GRID[1]; j++) {
        var x = box.x0 + (i + 0.5) * (box.x1 - box.x0) / GRID[0];
        var y = box.y0 + (j + 0.5) * (box.y1 - box.y0) / GRID[1];
        tot++;
        if (onLand(S, x, y)) hit++;
      }
    }
    return tot ? hit / tot : 0;
  }

  /* ---- what this picture placed, for the check ------------------------- */

  /* scripts\dossier_png_tall.py repaints one picture and then asks the painter
     which boxes it placed and whose ground each belongs on. It asks the PAGE
     shape by the name "screen" while the painter is told the frame's own name,
     so the store answers the exact shape when it has it and the LAST paint of
     that map when it does not - the tool repaints immediately before it asks. */
  function reset(mapId, shape) {
    if (!mapId) return;
    PLACED[mapId] = PLACED[mapId] || {};
    PLACED[mapId][shape || "-"] = [];
    LAST[mapId] = shape || "-";
  }
  function note(mapId, shape, row) {
    if (!mapId) return;
    var per = PLACED[mapId] || (PLACED[mapId] = {});
    (per[shape || "-"] = per[shape || "-"] || []).push(row);
  }
  function placed(mapId, shape) {
    var per = PLACED[mapId];
    if (!per) return [];
    if (shape && per[shape]) return per[shape];
    return per[LAST[mapId]] || [];
  }

  return { spots: spots, ground: ground, good: good, onFill: onFill,
           reset: reset, note: note, placed: placed,
           OWN_MIN: OWN_MIN, RIM: RIM };
})();

window.DossierMapGovPoint = DossierMapGovPoint;
