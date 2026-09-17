/* WHERE A ROUTE'S NAME GOES - on its line, beside it, or at a point the author
   wrote down and a leader line joins back to the route.

   Split out of dossier_map_routes.js on 2026-09-17, when the authored anchor
   below would have taken that file over the 500-line rule every authored file
   on this board keeps. The split is along a real seam: dossier_map_routes.js
   draws the LINES (a route, a measure, the scale bar, a place's mark) and this
   file decides where their WORDS stand. The zone names stayed with the rings
   they belong to and borrow `boxAt` and `free` from here, so one definition of
   "does this box fit" serves every name on the picture.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapRouteLabel = { pathLabel, boxAt, free }

   The three placements, in the order they were asked for:

   1. ON THE LINE, where a route's name has sat since routes arrived: searched
      along the line and across it, and clamped onto the canvas if nothing is
      free, because the distance IS what these maps are for.
   2. BESIDE THE LINE - `label_side`, "w" or "e" (Ziv, 2026-09-17: "move that
      text that you put in the line to the side"). No leader; the block steps
      DOWN in size until it fits rather than flipping sides or falling back.
   3. AT AN AUTHORED POINT - `label_at`, {lon, lat, why} (Ziv, 2026-09-17, of
      the crossing: "put it more like in the Red Sea... a line that shows that
      it points to the naval route"). The block is centred on that point and a
      thin leader runs from the block's own rim to the NEAREST point of the
      route, so a block standing half a frame away still says which line it
      names. The size is not stepped down: the point was chosen for the block
      at the size the map sets, and shrinking it would answer a question nobody
      asked. */
"use strict";

var DossierMapRouteLabel = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_route_label: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  /* ---- boxes ---------------------------------------------------------------- */

  function boxAt(cx, cy, w, h) {
    return { x: cx, y: cy,
             box: { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 } };
  }
  /* `pad` is a margin off the canvas rim, and only a placed block asks for one:
     a name that ends 2% from the edge of a 2048px picture is not cut, but it
     reads as though the picture were trimmed. */
  function free(b, taken, W, H, pad) {
    var R = D(), m = pad || 0;
    return b.x0 >= m && b.x1 <= W - m && b.y0 >= m && b.y1 <= H - m &&
      !taken.some(function (t) { return R.overlaps(b, t); });
  }
  /* The block's own size, once the text size has settled. */
  function measure(ctx, R, u, lines, size) {
    var w = 0;
    lines.forEach(function (s) { w = Math.max(w, R.width(ctx, s, size, 600)); });
    return { w: w + 8 * u, h: lines.length * size * 1.28, lineH: size * 1.28 };
  }

  /* A point at fraction `t` of the path's OWN length, with the unit normal of
     the leg it lands on. By length and not by vertex index: a route's waypoints
     sit wherever the channel bends, so the middle vertex is rarely the middle
     of the line. */
  function along(pts, t) {
    var d = [0], total = 0, i, k, dx, dy, run = 0;
    for (i = 1; i < pts.length; i++) {
      d[i] = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      total += d[i];
    }
    for (i = 1; i < pts.length; i++) {
      if (run + d[i] >= total * t || i === pts.length - 1) {
        k = d[i] ? Math.max(0, Math.min(1, (total * t - run) / d[i])) : 0;
        dx = pts[i][0] - pts[i - 1][0]; dy = pts[i][1] - pts[i - 1][1];
        return { x: pts[i - 1][0] + dx * k, y: pts[i - 1][1] + dy * k,
                 nx: -dy / (d[i] || 1), ny: dx / (d[i] || 1) };
      }
      run += d[i];
    }
    return { x: pts[0][0], y: pts[0][1], nx: 0, ny: -1 };
  }

  /* ---- 1. on the line ------------------------------------------------------- */

  /* Searched ALONG the line as well as across it. Across alone was measured on
     the first fixture: a route and the straight line beside it share a
     midpoint, six perpendicular offsets were all taken, and both fell through
     to the clamp and printed over each other and over a town name. */
  var ALONG = [0.5, 0.38, 0.62, 0.26, 0.74, 0.14, 0.86, 0.06, 0.94];
  var ACROSS = [1, -1, 2, -2, 3.2, -3.2, 4.6, -4.6, 6.4, -6.4, 8.6, -8.6, 11, -11];

  function lineSpot(pts, taken, W, H, u, w, h) {
    var spot = null, off = 17 * u;
    ALONG.some(function (t) {
      var a = along(pts, t);
      return ACROSS.some(function (k) {
        var s = boxAt(a.x + a.nx * off * k, a.y + a.ny * off * k, w, h);
        if (free(s.box, taken, W, H)) spot = s;
        return !!spot;
      });
    });
    if (spot) return spot;
    var a0 = along(pts, 0.5);
    return boxAt(Math.min(Math.max(a0.x + a0.nx * off, w / 2), W - w / 2),
                 Math.min(Math.max(a0.y + a0.ny * off, h / 2), H - h / 2), w, h);
  }

  /* ---- 2. beside the line --------------------------------------------------- */

  /* The gap is measured from the line to the EDGE of the block (the box's own
     reach along the leg's normal) and never to its centre, so a two-line block
     at slide size cannot come down half on top of the route it names. A wide
     frame can leave too little room on the chosen side, so the block STEPS DOWN
     in size until it fits. */
  var SIDE_GAP = [11, 17, 26, 38, 54], SIDE_SIZE = [1, 0.88, 0.76, 0.66, 0.58];
  var SIDE_ALONG = [0.5, 0.44, 0.56, 0.38, 0.62, 0.3, 0.7];

  function sideSpot(ctx, R, u, lines, pts, size, taken, W, H, side) {
    var found = null;
    SIDE_SIZE.some(function (k) {
      var s = size * k, b = measure(ctx, R, u, lines, s);
      SIDE_ALONG.some(function (t) {
        var a = along(pts, t);
        /* The box's own reach along the normal, so the gap is a real gap. */
        var ext = Math.abs(a.nx) * b.w / 2 + Math.abs(a.ny) * b.h / 2;
        var sign = (a.nx < 0) === (side === "w") ? 1 : -1;
        return SIDE_GAP.some(function (g) {
          var d = ext + g * u;
          var box = boxAt(a.x + a.nx * sign * d, a.y + a.ny * sign * d, b.w, b.h);
          if (free(box.box, taken, W, H, 14 * u)) found = { spot: box, size: s };
          return !!found;
        });
      });
      return !!found;
    });
    return found;
  }

  /* ---- 3. at an authored point, with a leader ------------------------------- */

  var LEAD_PAD = 7;               /* px at BASE_W between the block and its leader */

  /* The nearest point of the drawn line to (x, y) - along the segments, not at
     the vertices, so a leader meets the route where it actually passes closest
     rather than at whichever bend happens to be nearby. */
  function nearestOn(pts, x, y) {
    var best = null, i, a, b, dx, dy, l2, t, qx, qy, d;
    for (i = 1; i < pts.length; i++) {
      a = pts[i - 1]; b = pts[i];
      dx = b[0] - a[0]; dy = b[1] - a[1]; l2 = dx * dx + dy * dy;
      t = l2 ? ((x - a[0]) * dx + (y - a[1]) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      qx = a[0] + dx * t; qy = a[1] + dy * t;
      d = Math.hypot(qx - x, qy - y);
      if (!best || d < best.d) best = { x: qx, y: qy, d: d };
    }
    return best;
  }
  /* Where the ray from the block's centre towards the route leaves the block's
     own rim, plus a small gap: the leader starts at the edge of the words and
     never under them. */
  function rimPoint(box, cx, cy, tx, ty, pad) {
    var dx = tx - cx, dy = ty - cy, t = Infinity;
    if (!dx && !dy) return { x: cx, y: cy, d: 0 };
    var hw = (box.x1 - box.x0) / 2 + pad, hh = (box.y1 - box.y0) / 2 + pad;
    if (dx) t = Math.min(t, hw / Math.abs(dx));
    if (dy) t = Math.min(t, hh / Math.abs(dy));
    return { x: cx + dx * t, y: cy + dy * t, d: t * Math.hypot(dx, dy) };
  }

  function anchored(ctx, R, P, u, lines, pts, size, W, H, p, at) {
    var q = p(at.lon, at.lat), b = measure(ctx, R, u, lines, size), pad = 14 * u;
    /* Clamped onto the canvas, never moved for company: the point is authored
       and the build has already checked it is inside BOTH shapes of the frame
       (scripts\dossier_maps_frames.py), so the only thing left to guard against
       is a block wider than the room its own point leaves at the rim. */
    var cx = Math.min(Math.max(q[0], b.w / 2 + pad), W - b.w / 2 - pad);
    var cy = Math.min(Math.max(q[1], b.h / 2 + pad), H - b.h / 2 - pad);
    var spot = boxAt(cx, cy, b.w, b.h), tgt = nearestOn(pts, cx, cy);
    if (tgt) {
      var rim = rimPoint(spot.box, cx, cy, tgt.x, tgt.y, LEAD_PAD * u);
      /* A route passing under the block needs no leader - the words are already
         on it, and a stub drawn inside its own box reads as a stray mark. */
      if (tgt.d > rim.d) {
        var draw = function (style) {
          ctx.beginPath();
          ctx.moveTo(rim.x, rim.y); ctx.lineTo(tgt.x, tgt.y);
          R.paintShape(ctx, style);
        };
        /* Thicker than a hairline and far thinner than the route: the leader
           has to be seen at a glance on a slide - it is the whole of what was
           asked for - without ever being mistaken for a second sea lane. */
        draw({ stroke: P.halo, width: Math.max(5, 5.6 * u) });
        draw({ stroke: P.ink, width: Math.max(1.6, 2.2 * u) });
      }
    }
    return { spot: spot, lineH: b.lineH };
  }

  /* ---- the block itself ------------------------------------------------------ */

  function pathLabel(ctx, P, u, lines, pts, size, taken, W, H, side, p, at) {
    var R = D(), spot, lineH;
    lines = lines.filter(Boolean);
    if (!lines.length || pts.length < 2) return;
    if (at && p) {
      var fixed = anchored(ctx, R, P, u, lines, pts, size, W, H, p, at);
      spot = fixed.spot; lineH = fixed.lineH;
    } else {
      var fit = side ? sideSpot(ctx, R, u, lines, pts, size, taken, W, H, side) : null;
      if (fit) size = fit.size;
      var b = measure(ctx, R, u, lines, size);
      lineH = b.lineH;
      spot = (fit && fit.spot) || lineSpot(pts, taken, W, H, u, b.w, b.h);
    }
    lines.forEach(function (s, i) {
      R.text(ctx, P, s, spot.x, spot.box.y0 + (i + 0.5) * lineH,
        { size: size, weight: i ? 500 : 600, halo: 4 * u, color: i ? P.muted : null });
    });
    taken.push(spot.box);
  }

  return { pathLabel: pathLabel, boxAt: boxAt, free: free };
})();

window.DossierMapRouteLabel = DossierMapRouteLabel;
