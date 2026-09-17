/* The marks painted OVER the roads map (the כבישים tab): attack counts, flow
   arrows along their corridors, and every label - city names, corridor names and
   flow figures - placed so none covers another or a road it does not name.

   Split out of roads_map.js, which paints the ground, the roads and the layers
   and calls these in order. Reads DossierMapDraw and RoadsMap at call time.

     window.RoadsMarks = { samples, attackMarks, flowArrows, flowLabels,
                           placeLabels, corridorLabels }

   No ES modules - the page runs from file://. */
"use strict";

var RoadsMarks = (function () {
  function attackMarks(ctx, p, P, C, u, list, state, size) {
    var groups = {}, seen = {};
    list.forEach(function (c) {
      if (state.selected && state.selected !== c.key) return;
      RoadsMap.attacksIn(c, state.win).forEach(function (a) {
        /* One attack near two corridors is still one attack. */
        if (seen[a.event_key]) return;
        seen[a.event_key] = true;
        var g = groups[a.place_key] = groups[a.place_key] || { a: a, n: 0 };
        g.n += 1;
      });
    });
    /* Sized so the digit reads on a half-scale picture: a bold number in a
       disc wide enough for two digits, with a dark edge round the digit. */
    Object.keys(groups).forEach(function (k) {
      var g = groups[k], q = p(g.a.lon, g.a.lat), r = Math.max(11, 16 * u);
      ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
      ctx.fillStyle = C.fire; ctx.fill();
      ctx.lineWidth = Math.max(2, 2.5 * u); ctx.strokeStyle = "#fff"; ctx.stroke();
      ctx.font = "700 " + Math.round(Math.max(12, r * 1.25)) + "px Heebo, Segoe UI, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineJoin = "round"; ctx.lineWidth = Math.max(2, 2.4 * u);
      ctx.strokeStyle = "rgba(60,0,0,0.85)";
      ctx.strokeText(String(g.n), q[0], q[1] + r * 0.06);
      ctx.fillStyle = "#fff"; ctx.fillText(String(g.n), q[0], q[1] + r * 0.06);
    });
  }

  /* Every corridor sampled on screen every few pixels, so a label can be kept
     off the lines it does not name. */
  function samples(p, list) {
    return list.map(function (c) {
      var pts = [];
      for (var i = 0; i + 3 < c.p.length; i += 2) {
        var a = p(c.p[i], c.p[i + 1]), b = p(c.p[i + 2], c.p[i + 3]);
        var n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5));
        for (var k = 0; k < n; k++) {
          pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
        }
      }
      return { key: c.key, pts: pts };
    });
  }
  function boxFree(R, box, taken, lines, own, W, H) {
    if (box.x0 < 2 || box.y0 < 2 || box.x1 > W - 2 || box.y1 > H - 2) return false;
    if (taken.some(function (t) { return R.overlaps(box, t); })) return false;
    return !lines.some(function (l) {
      if (l.key === own) return false;
      return l.pts.some(function (q) {
        return q[0] > box.x0 - 3 && q[0] < box.x1 + 3 && q[1] > box.y0 - 3 && q[1] < box.y1 + 3;
      });
    });
  }
  /* The point `t` of the way along a corridor, by length on screen. */
  function along(line, t) {
    var pts = line.pts, total = 0, run = 0, i, d;
    for (i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    for (i = 1; i < pts.length; i++) {
      d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (run + d >= total * t) return pts[i - 1];
      run += d;
    }
    return pts[pts.length - 1] || [0, 0];
  }

  /* The unit normal at point i of a screen polyline, from a few points either
     side so a jagged road does not swing it. */
  function normalAt(pts, i) {
    var a = pts[Math.max(0, i - 6)], b = pts[Math.min(pts.length - 1, i + 6)];
    var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  }
  /* A moving average, so an arrow beside a twisting mountain road reads as one
     calm stroke instead of looping on every hairpin. */
  function smooth(pts, r) {
    return pts.map(function (q, i) {
      var x = 0, y = 0, n = 0;
      for (var j = Math.max(0, i - r); j <= Math.min(pts.length - 1, i + r); j++) {
        x += pts[j][0]; y += pts[j][1]; n++;
      }
      return [x / n, y / n];
    });
  }
  function nearest(pts, q) {
    var best = 0, bd = Infinity;
    pts.forEach(function (s, i) {
      var d = Math.hypot(s[0] - q[0], s[1] - q[1]);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  /* Every flow follows its OWN corridor's road, drawn a little beside it with
     the head at the destination - never a straight arc, which would carry the
     cargo across ground the road does not cross. */
  function flowArrows(ctx, p, P, C, u, list, state, size, lines) {
    var all = [], pending = [], max = {}, seen = {}, drawn = [];
    list.forEach(function (c) {
      (c.flows || []).forEach(function (f) { all.push({ f: f, c: c }); });
    });
    all.forEach(function (o) {
      if (typeof o.f.amount === "number") {
        max[o.f.unit_he] = Math.max(max[o.f.unit_he] || 0, o.f.amount);
      }
    });
    all.forEach(function (o) {
      var f = o.f, line = lines.filter(function (l) { return l.key === o.c.key; })[0];
      if (!line || line.pts.length < 2) return;
      var ia = nearest(line.pts, p(f.a[0], f.a[1])), ib = nearest(line.pts, p(f.b[0], f.b[1]));
      var run = ia <= ib ? line.pts.slice(ia, ib + 1) : line.pts.slice(ib, ia + 1).reverse();
      if (run.length < 2) return;
      run = smooth(run, 6);
      var known = typeof f.amount === "number";
      var w = Math.max(2.5, known ? (2.5 + 5.5 * Math.sqrt(f.amount / max[f.unit_he])) * u : 3 * u);
      var key = o.c.key, stack = seen[key] || 0;
      var off = stack + 6 * u + w / 2;
      seen[key] = off + w / 2 + 2 * u;
      var pts = run.map(function (q, i) {
        var n = normalAt(run, i);
        return [q[0] + n[0] * off, q[1] + n[1] * off];
      });
      var hs = Math.max(9, w * 2.4 + 6 * u), end = pts[pts.length - 1];
      /* Stop the shaft one head-length short, so the head carries the tip. */
      var k = pts.length - 1;
      while (k > 1 && Math.hypot(pts[k][0] - end[0], pts[k][1] - end[1]) < hs * 0.8) k--;
      var dim = state.selected && state.selected !== key;
      ctx.globalAlpha = dim ? 0.35 : 1;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i <= k; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.strokeStyle = C.flow; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.setLineDash(known ? [] : [8 * u, 6 * u]); ctx.stroke(); ctx.setLineDash([]);
      var tx = end[0] - pts[k][0], ty = end[1] - pts[k][1], tl = Math.hypot(tx, ty) || 1;
      var hx = tx / tl, hy = ty / tl;
      ctx.beginPath(); ctx.moveTo(end[0], end[1]);
      ctx.lineTo(end[0] - hx * hs - hy * hs * 0.55, end[1] - hy * hs + hx * hs * 0.55);
      ctx.lineTo(end[0] - hx * hs + hy * hs * 0.55, end[1] - hy * hs - hx * hs * 0.55);
      ctx.closePath(); ctx.fillStyle = C.flow; ctx.fill();
      ctx.globalAlpha = 1;
      drawn.push({ key: "flow:" + key + ":" + pending.length, pts: pts });
      var label = f.label_he || (known ? Number(f.amount).toLocaleString("he-IL") + " " +
        f.unit_he : "אין נתון");
      /* Candidate spots along the arrow, outward from the road first. */
      var spots = [];
      [0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85].forEach(function (t) {
        var j = Math.round(t * (pts.length - 1)), n = normalAt(pts, j), q = pts[j];
        [1.2, 2.4, 3.6, 4.8, -1.2, -2.4, -3.6].forEach(function (m) {
          spots.push([q[0] + n[0] * size * m, q[1] + n[1] * size * m]);
        });
      });
      pending.push({ label: label, spots: spots, dim: dim });
    });
    return { pending: pending, lines: drawn };
  }

  function flowLabels(ctx, P, u, W, H, pending, size, taken, lines) {
    var R = window.DossierMapDraw, fs = size * 0.85;
    pending.forEach(function (o) {
      var half = R.width(ctx, o.label, fs, 600) / 2, h = fs * 0.65;
      var boxAt = function (q) {
        return { x0: q[0] - half, y0: q[1] - h, x1: q[0] + half, y1: q[1] + h };
      };
      var spot = o.spots.filter(function (q) {
        return boxFree(R, boxAt(q), taken, lines, "", W, H);
      })[0] || o.spots.filter(function (q) {
        return boxFree(R, boxAt(q), taken, [], "", W, H);
      })[0] || o.spots[0];
      taken.push(boxAt(spot));
      ctx.globalAlpha = o.dim ? 0.45 : 1;
      R.text(ctx, P, o.label, spot[0], spot[1], { size: fs, weight: 600, halo: 4 * u,
                                                  color: P.ink });
      ctx.globalAlpha = 1;
    });
  }

  /* City names by PRIORITY: the two ends of every corridor first, the towns
     between them second - and on a phone-width canvas only the ends, because
     six names on a 330px map cover the roads they name. */
  function placeLabels(ctx, p, P, u, W, H, list, state, size, taken, lines) {
    var R = window.DossierMapDraw, done = {}, cities = [];
    var pinR = Math.max(3, 3.4 * u);
    list.forEach(function (c) {
      var n = (c.waypoints || []).length;
      (c.waypoints || []).forEach(function (wp, i) {
        var rank = (i === 0 || i === n - 1) ? 1 : 2;
        if (done[wp.key]) { done[wp.key].rank = Math.min(done[wp.key].rank, rank); return; }
        done[wp.key] = { wp: wp, rank: rank };
        cities.push(done[wp.key]);
      });
    });
    cities.sort(function (a, b) { return a.rank - b.rank; });
    cities.forEach(function (o) {
      var q = p(o.wp.lon, o.wp.lat);
      ctx.beginPath(); ctx.arc(q[0], q[1], pinR + 1.5 * u, 0, Math.PI * 2);
      ctx.fillStyle = P.halo; ctx.fill();
      ctx.beginPath(); ctx.arc(q[0], q[1], pinR, 0, Math.PI * 2);
      ctx.fillStyle = P.ink; ctx.fill();
    });
    cities.forEach(function (o) {
      if (W < 700 && o.rank > 1) return;
      var q = p(o.wp.lon, o.wp.lat);
      ["n", "s", "e", "w"].some(function (anchor) {
        var l = R.place(ctx, o.wp.he, q[0], q[1], anchor, size, pinR, u, W, H);
        if (!boxFree(R, l.box, taken, [], "", W, H)) return false;
        taken.push(l.box);
        R.text(ctx, P, l.str, l.x, l.y, { size: size, weight: 600, halo: 4 * u,
                                           align: l.align, baseline: l.baseline });
        return true;
      });
    });
  }

  function corridorLabels(ctx, P, u, W, H, list, state, size, taken, lines) {
    var R = window.DossierMapDraw;
    /* A corridor's own name on its OWN line: the middle first, then further
       along, on any side, only where the box is clear of every name and every
       OTHER corridor. Every road on a wide canvas, the selected one on a phone. */
    list.forEach(function (c) {
      if (W < 700 && state.selected !== c.key) return;
      var line = lines.filter(function (l) { return l.key === c.key; })[0];
      if (!line || !line.pts.length) return;
      var fs = size * 0.95;
      [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8].some(function (t) {
        var q = along(line, t);
        return ["n", "s", "e", "w"].some(function (anchor) {
          var l = R.place(ctx, c.name_he, q[0], q[1], anchor, fs, 10 * u, u, W, H);
          /* On the flows layer a name keeps a wide berth from arrows and figures,
             and is left off rather than crowd them. */
          var g = state.layer === "flows" ? size * 0.9 : 0, bx = l.box;
          var pad = { x0: bx.x0 - g, y0: bx.y0 - g, x1: bx.x1 + g, y1: bx.y1 + g };
          if (!boxFree(R, bx, taken, lines, c.key, W, H) ||
              !boxFree(R, pad, taken, lines.filter(function (x) {
                return x.key.indexOf("flow:") === 0;
              }), c.key, W + 2 * g, H + 2 * g)) return false;
          taken.push(bx);
          R.text(ctx, P, l.str, l.x, l.y, { size: fs, weight: 500, halo: 4 * u,
                                             align: l.align, baseline: l.baseline,
                                             color: P.muted });
          return true;
        });
      });
    });
  }

  return { samples: samples, attackMarks: attackMarks, flowArrows: flowArrows,
           flowLabels: flowLabels, placeLabels: placeLabels, corridorLabels: corridorLabels };
})();

window.RoadsMarks = RoadsMarks;
