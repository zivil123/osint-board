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
      asked.
   4. THE LENGTH CALLOUT - `length_callout`, the same authored point carrying
      the kilometres alone (Ziv, 2026-09-18: "a little line to kind of in the
      middle of the route, to the right, and just write the amount of
      kilometers"). Placement 3 with one difference: it may be NUDGED off a
      name or a coastline, because a number moved a few pixels still says the
      same thing while one printed over a name says nothing.

   Three things joined them on 2026-09-18, all of them WORDS on a picture and
   all of them pressed out of dossier_map_routes.js by the 500-line rule: the
   ZONE NAMES (which had always borrowed boxAt and free from here), the SCALE
   BAR and its caption, and the SELF-CHECK at the foot of the file, which
   stashes what the route layer actually painted so a verifier can read the
   clearances as numbers instead of squinting at a PNG. */
"use strict";

var DossierMapRouteLabel = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_route_label: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }
  /* The zone names came here with the rest of the words; the rings they name
     are still drawn by the file that owns them, and its `radius` is what a name
     has to clear. Looked up on each call, so the files may load in any order. */
  function Z() {
    if (!window.DossierMapZones) {
      throw new Error("dossier_map_route_label: dossier_map_zones.js is not on the page");
    }
    return window.DossierMapZones;
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

  /* THE CALLOUT MAY BE NUDGED, THE NAME MAY NOT (2026-09-18). `label_at` is a
     place somebody chose for a whole block and is left exactly there; the
     length callout is one number, and a number pushed half a line off a
     coastline or off a port's name still says the same thing while one printed
     over either says nothing. The offsets are in the block's own widths and
     heights, they start at the authored point, and they never cross the route:
     east and north-east only, the side the point was chosen on. */
  var NUDGE = [[0, 0], [0, -1], [0, 1], [0.6, 0], [0.6, -1], [0.6, 1],
               [0, -2], [1.2, 0], [0, 2]];

  function anchored(ctx, R, P, u, lines, pts, size, W, H, p, at, taken) {
    var q = p(at.lon, at.lat), b = measure(ctx, R, u, lines, size), pad = 14 * u;
    /* Clamped onto the canvas, never moved for company: the point is authored
       and the build has already checked it is inside BOTH shapes of the frame
       (scripts\dossier_maps_frames.py), so the only thing left to guard against
       is a block wider than the room its own point leaves at the rim. */
    var cx = Math.min(Math.max(q[0], b.w / 2 + pad), W - b.w / 2 - pad);
    var cy = Math.min(Math.max(q[1], b.h / 2 + pad), H - b.h / 2 - pad);
    var spot = boxAt(cx, cy, b.w, b.h), clear = !taken;
    if (taken) {
      NUDGE.some(function (n) {
        var s = boxAt(Math.min(Math.max(cx + n[0] * b.w, b.w / 2 + pad), W - b.w / 2 - pad),
                      Math.min(Math.max(cy + n[1] * b.h, b.h / 2 + pad), H - b.h / 2 - pad),
                      b.w, b.h);
        if (free(s.box, taken, W, H, pad)) { spot = s; clear = true; }
        return clear;
      });
      cx = spot.x; cy = spot.y;
    }
    /* WHERE THE LEADER MEETS THE LINE - `lead_from` in the record (2026-09-18).
       "near" is the nearest point of the drawn line, which is what every block
       here has pointed at since leaders arrived; "mid" is the point halfway
       along it BY LENGTH, and on a bent route those are two different places.
       Ziv asked for the line to come off the MIDDLE of the crossing, so the
       record says so rather than the painter guessing from the geometry. */
    var tgt = at.lead_from === "mid" ? along(pts, 0.5) : nearestOn(pts, cx, cy);
    if (tgt && tgt.d === undefined) tgt.d = Math.hypot(tgt.x - cx, tgt.y - cy);
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
    return { spot: spot, lineH: b.lineH, clear: clear,
             lead: tgt ? [tgt.x, tgt.y] : null };
  }

  /* ---- the block itself ------------------------------------------------------ */

  /* Hands back WHAT IT PAINTED - the box, whether that box stood clear of
     everything already placed, and where its leader met the line - so the route
     layer can stash it for the self-check without measuring the picture twice. */
  function pathLabel(ctx, P, u, lines, pts, size, taken, W, H, side, p, at, nudge) {
    var R = D(), spot, lineH, clear = true, lead = null;
    lines = lines.filter(Boolean);
    if (!lines.length || pts.length < 2) return null;
    if (at && p) {
      var fixed = anchored(ctx, R, P, u, lines, pts, size, W, H, p, at,
        nudge ? taken : null);
      spot = fixed.spot; lineH = fixed.lineH;
      clear = fixed.clear; lead = fixed.lead;
      /* THE LENGTH CALLOUT IS THE ONE BLOCK HERE THAT MAY BE DROPPED. Measured
         at 360px, where the whole crossing is 50px long and a port's name is
         17px tall: every nudge was taken and the number came down on the route
         between the two ports. The HTML caption under the picture carries the
         same figure, so a reader loses nothing - and the board's own rule for
         a name that cannot stand clear has always been to drop it. */
      if (nudge && !clear) return { dropped: true };
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
    return { box: spot.box, clear: clear, lead: lead, text: lines.join(" "),
             dropped: false,
             linePx: probing() ? shapeGap(boxRing(spot.box), [pts]) : null };
  }

  /* ---- the zone names ---------------------------------------------------------- */

  /* A zone names itself INSIDE its ring when the ring can hold the name and
     beside it when it cannot - the same bargain the plain picture's fighting
     zones make (dossier_map_legend.js). Three rings of four sides are tried
     before it is dropped, and dropping is honest here: the hatch and the legend
     still say what the shape is. `per` is pixels per kilometre, measured by the
     file that draws the lines, so the radius a name clears is the radius that
     was drawn. */
  function zoneLabels(ctx, p, P, u, list, taken, W, H, size, per) {
    var R = D();
    (list || []).forEach(function (z) {
      if (!z.label_he) return;
      var q = p(z.lon, z.lat), r = Z().radius(z, per, u), spot = null;
      var w = R.width(ctx, z.label_he, size, 500) + 6 * u, h = size * 1.3, cands = [];
      if (2 * r >= w * 1.05) cands.push([q[0], q[1]]);
      [0, 1, 2, 3, 4].forEach(function (ring) {
        var d = r + (5 + ring * 20) * u, k = 0.72;
        cands.push([q[0], q[1] - d - h / 2], [q[0], q[1] + d + h / 2],
                   [q[0] + d + w / 2, q[1]], [q[0] - d - w / 2, q[1]],
                   [q[0] + (d + w / 2) * k, q[1] - (d + h / 2) * k],
                   [q[0] - (d + w / 2) * k, q[1] - (d + h / 2) * k],
                   [q[0] + (d + w / 2) * k, q[1] + (d + h / 2) * k],
                   [q[0] - (d + w / 2) * k, q[1] + (d + h / 2) * k]);
      });
      cands.some(function (c) {
        var s = boxAt(c[0], c[1], w, h);
        if (free(s.box, taken, W, H)) spot = s;
        return !!spot;
      });
      if (!spot) return;
      R.text(ctx, P, z.label_he, spot.x, spot.y, { size: size, weight: 500, halo: 3 * u });
      taken.push(spot.box);
    });
  }

  /* ---- the scale bar ----------------------------------------------------------- */

  /* A terrain map is read for DISTANCE - how far the crossing is, how close the
     ridge stands to the channel - so it says how far a centimetre is. Round
     numbers only, about a sixth of the canvas, and in the corner OPPOSITE the
     legend, which chooses its own corner per render. `unit` is handed in with
     the words, so the one Hebrew spelling of the kilometre lives in one place.

     It goes down FIRST and reserves its own box (2026-09-17). It used to be
     painted last, after every name, and nothing had told the names it was
     coming: measured on the crossing's whole-area frame, the route's block took
     the corner the legend had left free and the bar was drawn straight through
     it. The bar cannot move - it is pinned to the corner opposite the legend -
     so it is the one that must be placed while the ground is still empty. */
  var NICE = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  var OPPOSITE = { tr: "bl", br: "tl", tl: "br", bl: "tr" };

  function scaleBar(ctx, P, u, W, H, size, per, legend, taken, unit) {
    var R = D(), want = W / 6, km = NICE[0], i;
    for (i = 0; i < NICE.length; i++) { if (NICE[i] * per <= want) km = NICE[i]; }
    var len = km * per;
    if (!(len > 12 * u)) return;
    var at = OPPOSITE[(legend && legend.at) || "tr"] || "bl", inset = 16 * u;
    var x0 = at[1] === "r" ? W - inset - len : inset;
    var y = at[0] === "t" ? inset + size * 2.1 : H - inset;
    var cap = Math.max(4, 5 * u), w = Math.max(2, 2.6 * u);
    var draw = function (style) {
      ctx.beginPath();
      ctx.moveTo(x0, y - cap); ctx.lineTo(x0, y); ctx.lineTo(x0 + len, y);
      ctx.lineTo(x0 + len, y - cap);
      R.paintShape(ctx, style);
    };
    draw({ stroke: P.halo, width: w + 3 * u });
    draw({ stroke: P.ink, width: w });
    var caption = km + " " + unit;
    R.text(ctx, P, caption, x0 + len / 2, y - cap - 3 * u,
      { size: size * 0.9, weight: 500, halo: 3 * u, align: "center", baseline: "bottom" });
    if (!taken) return;
    var tw = Math.max(len, R.width(ctx, caption, size * 0.9, 500));
    taken.push({ x0: x0 + len / 2 - tw / 2 - 4 * u, x1: x0 + len / 2 + tw / 2 + 4 * u,
                 y0: y - cap - 3 * u - size * 1.2, y1: y + 4 * u });
  }

  /* ---- the self-check the verifier reads --------------------------------------- */

  /* Under `?png=dry` - or after DossierMapRouteLabel.probing(true) - every route
     map stashes what it actually painted: the kilometre text and the box it
     stands in, the arrowhead's three corners, and the clearances the head was
     drawn with. check() turns that into a pass or a fail per picture, so "the
     whole arrow shows" is a number somebody can read rather than a squint at a
     PNG. Nothing here paints, and nothing here runs unless it is asked for. */
  var probe = {}, forced = false;
  var DRY = /[?&]png=dry(&|$)/.test(location.search);

  function probing(on) {
    if (on !== undefined) {
      forced = !!on;
      Object.keys(probe).forEach(function (k) { delete probe[k]; });
    }
    return DRY || forced;
  }
  function note(id, u, patch) {
    if (!probing()) return null;
    var W = Math.round(u * 1280), key = (id || "?") + "@" + W;
    var r = probe[key] || (probe[key] = { id: id || null, canvasW: W });
    Object.keys(patch).forEach(function (k) { r[k] = patch[k]; });
    return r;
  }

  /* ---- and the geometry it measures with ---------------------------------------- */

  function boxRing(b) {
    return [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1], [b.x0, b.y0]];
  }
  function ptSeg(x, y, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    var t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
    return Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y);
  }
  function turn(a, b, c) {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  }
  /* Two segments that CROSS are zero apart although none of their four ends is
     near the other segment, so the crossing is tested before the distances. */
  function segGap(a, b, c, d) {
    if (turn(a, b, c) * turn(a, b, d) < 0 && turn(c, d, a) * turn(c, d, b) < 0) return 0;
    return Math.min(ptSeg(a[0], a[1], c, d), ptSeg(b[0], b[1], c, d),
                    ptSeg(c[0], c[1], a, b), ptSeg(d[0], d[1], a, b));
  }
  /* The smallest gap in CANVAS PIXELS between one closed shape and a list of
     open or closed lines. `near` keeps the walk short: a coastline is tens of
     thousands of points and only the stretch round the shape can be closest. */
  function shapeGap(shape, lines, near) {
    var best = Infinity, cx = 0, cy = 0, n = shape.length;
    shape.forEach(function (q) { cx += q[0] / n; cy += q[1] / n; });
    (lines || []).forEach(function (line) {
      for (var i = 1; i < line.length; i++) {
        var a = line[i - 1], b = line[i];
        if (near && Math.hypot(a[0] - cx, a[1] - cy) > near &&
            Math.hypot(b[0] - cx, b[1] - cy) > near) continue;
        for (var j = 1; j < shape.length; j++) {
          best = Math.min(best, segGap(shape[j - 1], shape[j], a, b));
        }
      }
    });
    return isFinite(best) ? best : null;
  }
  /* The COASTLINE of the frame, projected: the same three land collections
     dossier_map_draw.js strokes the shoreline from, and no other line - a
     governorate edge is not a coast and an arrowhead may sit on one. */
  function coastGap(p, shape, near) {
    var G = (typeof GEO !== "undefined" && GEO) ? GEO : null, lines = [];
    if (!G) return null;
    [G.sau_adm0, G.yem_adm0, G.nbr_adm0].forEach(function (fc) {
      ((fc && fc.features) || []).forEach(function (f) {
        var g = f.geometry || {}, polys = g.type === "Polygon" ? [g.coordinates]
          : g.type === "MultiPolygon" ? g.coordinates : [];
        polys.forEach(function (poly) {
          poly.forEach(function (ring) {
            lines.push(ring.map(function (c) { return p(c[0], c[1]); }));
          });
        });
      });
    });
    return shapeGap(shape, lines, near);
  }

  /* One record per picture, and what each of them has to be able to say. */
  function check(key) {
    var items = Object.keys(probe).filter(function (k) { return !key || k === key; })
      .map(function (k) {
        var r = probe[k], bad = [], slack = 0.5;   /* px: rounding, never a gap */
        /* The head's own length, straight off the shape that was painted. A
           canvas too small to hold it is too small to hold its clearance too -
           on a 360px phone the crossing is 50px long - so the coast test is not
           asked there, and the number is reported rather than judged. */
        var reach = !r.head ? 0
          : Math.hypot(r.head[0][0] - (r.head[1][0] + r.head[2][0]) / 2,
                       r.head[0][1] - (r.head[1][1] + r.head[2][1]) / 2);
        if (!r.head) bad.push("no arrowhead was painted");
        else if (r.tipPx < r.tipNeedPx - slack) bad.push("the head's tip stands " +
          Math.round(r.tipPx) + "px off the route's last point, under " + r.tipNeedPx);
        if (r.head && r.tipPx >= reach && r.coastPx !== null && r.coastPx < r.coastNeedPx) {
          bad.push("the head is " + Math.round(r.coastPx) + "px from the coast stroke, under "
            + Math.round(r.coastNeedPx));
        }
        if (r.wantsCallout && !r.dropped) {
          if (!r.text || !r.box) bad.push("the length callout painted nothing");
          else if (!r.clear) bad.push("the callout box sits on something already placed");
          else if (r.linePx !== null && r.linePx < r.lineNeedPx) {
            bad.push("the callout box is " + Math.round(r.linePx) +
              "px from the route, under " + Math.round(r.lineNeedPx));
          } else if (r.coastBoxPx !== null && r.coastBoxPx < r.lineNeedPx) {
            bad.push("the callout box is " + Math.round(r.coastBoxPx) +
              "px from the coastline, under " + Math.round(r.lineNeedPx));
          }
        }
        r.ok = !bad.length;
        r.why = bad.join("; ") || "ok";
        return r;
      });
    return { ok: items.length > 0 && items.every(function (r) { return r.ok; }),
             items: items };
  }

  return { pathLabel: pathLabel, boxAt: boxAt, free: free, zoneLabels: zoneLabels,
           scaleBar: scaleBar, probing: probing, note: note, check: check,
           probe: probe, coastGap: coastGap, shapeGap: shapeGap, boxRing: boxRing };
})();

window.DossierMapRouteLabel = DossierMapRouteLabel;
