/* HOW HARD EACH FRONT IS BEING FOUGHT, as a colour on the belt itself.

   A dossier map record may carry `heat`:

     map.heat = { window: {from, to},
                  fronts: [{front, level, date, src}, ...] }   // 12 entries

   `front` is a GEO.fronts feature's `properties.id` and `level` is 1..5. The
   build guarantees all twelve are there; a belt this file cannot find a level
   for is painted the ordinary contested wash rather than left blank or guessed
   at, so a data gap shows as "no reading" and never as "quiet".

   WHY A COLOUR AND NOT A WIDTH. A belt's width is already spoken for - it is
   12 km of sourced contact either side of the line (UI.md, "A front is a BELT
   ON THE LINE") - so thickening one would say the fighting covers more ground
   than the source said. A rank on this board is a colour scale with a key, and
   nothing else.

   EACH BELT IS FILLED ON ITS OWN, one beginPath/fill per feature, which the
   single even-odd path in draw.js could not do. That is only safe because the
   build refuses a front shape that is not a simple ring and refuses any two
   that overlap (UI.md L174-219): no fill here can punch a hole in another.

   AND THE SAME NUMBER, WRITTEN ON THE BELT (2026-09-18). Ziv: *"mark on the
   map, on the fronts, the number of how much fighting there is, so we can
   understand from the start how much fighting there is. And also show what
   dates the information is from."* A colour has to be carried to the key and
   back before it says anything - so badges() writes every belt's level on it
   as a digit and stamps the window beside the key, both LAST so nothing can
   cover them.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapHeat = { fronts, legendRows, ramp, words,
                               badges, report, audit, windowText }

   ground() in dossier_map_draw.js calls fronts() in place of the one contested
   fill and then paints its hatch, its outline and its red diamond on top,
   unchanged; the legend calls legendRows(); dossier_map.js calls badges() as
   the last thing on a heat map. The shared helpers come from DossierMapDraw at
   call time, so the files may load in any order. The Hebrew words of the scale
   are authored HERE, the way dossier_map_zones.js owns its own - they name this
   layer's five steps and no other file has a use for them. */
"use strict";

var DossierMapHeat = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_heat: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  /* FIVE STEPS, MONOTONE IN LIGHTNESS, one set per ground. On the light deck
     the scale runs pale to deep, the ordinary reading of "more"; on the dark
     board it must run the other way - a near-black step 5 would vanish into the
     board instead of shouting - so it runs deep to bright. Neither end is the
     red of the fighting-zone diamond (#E01B0F light): the deepest light step
     #A50F15 is darker and far less orange, so a mark still reads on top of the
     ground it marks. */
  var RAMP = {
    light: ["#FEE5D9", "#FCAE91", "#FB6A4A", "#DE2D26", "#A50F15"],
    dark: ["#4A1512", "#7E2318", "#B1301C", "#DC5A2A", "#F59A4B"]
  };
  /* THE DIGIT ON A CHIP IS MEASURED, NEVER PICKED BY EYE. The chip is the
     step's own colour, so one ink cannot serve five - the dark ink holds 15.6:1
     on the light ramp's step 1 and 3.5:1 on its step 4, and the dark ramp runs
     the other way up. Each step takes whichever reads better ON it; audit()
     asserts all ten clear 4.5:1, the dark ink being a shade under #14202C,
     which measured 4.35:1 on dark step 4. */
  var INK_D = "#0B121A", INK_L = "#FFFFFF";

  function lum(hex) {
    var i, c, v = 0, w = [0.2126, 0.7152, 0.0722];
    for (i = 0; i < 3; i++) {
      c = parseInt(String(hex).slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
      v += w[i] * (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    }
    return v;
  }
  function ratio(a, b) {
    var x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function digitInk(step) {
    return ratio(INK_D, step) >= ratio(INK_L, step) ? INK_D : INK_L;
  }
  /* The key's five rows. A number AND a word on every one: the number is what
     the reader matches against the colour, the word is what it means. */
  var WORDS = ["1 — שקט יחסית", "2 — לחימה מועטה", "3 — לחימה מתונה",
               "4 — לחימה כבדה", "5 — הלחימה הכבדה ביותר"];

  /* A GLOW UNDER THE BELTS (2026-09-17). A belt is 12 km of sourced contact on
     a frame 500 km across, which is three pixels: the scale was right and
     unreadable, and a reader had to hunt for the colour before it could tell
     them anything. So every belt's ring is stroked in its own level colour,
     wide and soft, before the fills go down - the fighting is not spread any
     wider (the fill, the hatch and the outline still say exactly where it is),
     but the ATTENTION is. Ascending level, so where two glows meet the hotter
     one is on top and the eye is not sent to the quieter front. */
  var GLOW_W = 22, GLOW_A = 0.32;

  /* Takes a palette or a bare theme name, because the HTML key under the
     picture (dossier_map_block.js) has only the name. */
  function ramp(P) {
    var t = typeof P === "string" ? P : (P && P.theme);
    return RAMP[t === "light" ? "light" : "dark"];
  }

  /* front id -> level, keeping only a whole number inside the scale. Anything
     else is dropped here rather than clamped: a level the build did not write
     is a data fault, and painting it as a 5 would be an invention. */
  function levels(heat) {
    var out = {};
    ((heat && heat.fronts) || []).forEach(function (r) {
      if (!r || !r.front) return;
      var n = Math.round(r.level);
      if (isFinite(n) && n >= 1 && n <= 5) out[r.front] = n;
    });
    return out;
  }

  /* Painted at the SAME fade the contested wash uses, so a heat map over the
     terrain keeps the relief readable exactly as the plain one does; the hatch,
     the outline and the diamond that follow in ground() are never washed back
     and are not this function's business. */
  function fronts(ctx, p, P, u, G, heat, opt) {
    var R = D(), o = opt || {}, colors = ramp(P), lv = levels(heat), list = [];
    R.eachFeature(G.fronts, function (f) {
      list.push({ f: f, n: lv[(f.properties || {}).id] || 0 });
    });
    /* The glow first, coolest to hottest, at its own alpha - never the
       territory wash's: it is what makes the scale visible at a glance and a
       terrain picture underneath is no reason to say it more quietly. */
    ctx.globalAlpha = GLOW_A;
    list.slice().sort(function (a, b) { return a.n - b.n; }).forEach(function (it) {
      if (!it.n) return;
      ctx.beginPath();
      R.polyPath(ctx, p, it.f.geometry);
      R.paintShape(ctx, { stroke: colors[it.n - 1], width: GLOW_W * u });
    });
    ctx.globalAlpha = 1;
    if (o.fade) ctx.globalAlpha = o.fade;
    list.forEach(function (it) {
      ctx.beginPath();
      R.polyPath(ctx, p, it.f.geometry);
      R.paintShape(ctx, { fill: it.n ? colors[it.n - 1] : P.contested });
    });
    ctx.globalAlpha = 1;
  }

  /* THE KEY BECOMES A SCALE. The one שטח לחימה פעיל row leaves and the five
     steps take its place, in its place in the list - so the key never names a
     colour that is not on the picture, and never leaves one on the picture
     unnamed. The row that leaves is carrying the hatch pattern the belts are
     drawn with, built against the canvas the legend was measured on, so each
     scale row reuses it and a swatch still reads as a fighting zone rather than
     as a plain square. */
  function legendRows(P, u, map, rows) {
    var list = (rows || []).slice(), at = -1, i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].mark && list[i].hatch) { at = i; break; }
    }
    if (at < 0) return list;
    var old = list[at];
    var scale = ramp(P).map(function (c, n) {
      return { fill: c, label: WORDS[n],
        draw: function (cx2, P2, u2, sx, cy, sw, sh) {
          badge(cx2, P2, sx + sw / 2, cy, Math.min(sw, sh) / 2, n + 1, u2, c);
        } };
    });
    /* AND ONE ROW FOR THE MARK, under the scale. Every belt still carries the
       red diamond, whatever its level, and a mark on the map with no row in the
       key is a mark nobody can read - so the row the scale replaced hands its
       own words and its own swatch straight back, minus the one fill that is no
       longer on this picture. Once, never per level: the diamond says the same
       thing on all five. */
    scale.push({ hatch: old.hatch, stroke: old.stroke, dash: old.dash,
                 width: old.width, mark: true, label: old.label });
    return list.slice(0, at).concat(scale, list.slice(at + 1));
  }

  /* ---- the level digit, written on the belt -------------------------------- */

  /* A COLOURED CHIP, NOT A WHITE DISC, and both halves are one decision. The
     key panel's objectives are numbered white DISCS (dossier_map_key.js) and on
     fronts_heat_reports they stand a few pixels from these: identical marks, a
     row number and a level. So a level is a rounded SQUARE filled with ITS OWN
     STEP - its belt's colour, its key row's - and white circles stay the notes'. */
  var BADGE_R = 12, BADGE_MIN = 10;
  /* How finely a belt is sampled: the chip is WIDER than a 12 km band. */
  var SPOTS = 40;
  var GAP = 2;          /* how far a badge keeps off a diamond and its neighbours */
  var REPORTS = [], REPORT_MAX = 40;
  /* The date stamp, in the board's day.month form (docs\gains.js). PAINTED AS
     TWO RUNS AND NOT ONE STRING (`parts()`): in an rtl run the dash between two
     numbers is a neutral BETWEEN NUMBERS, which the bidi algorithm resolves as
     if numbers were right-to-left. Chromium renders one marked string forwards
     (measured 2026-09-18) - but a range reading backwards on another engine is
     a WRONG DATE, so nothing depends on it. */
  var WINDOW_HE = "תקופת הדיווחים:";
  function dayMonth(iso) {
    var s = String(iso || "").split("-");
    return s.length === 3 ? Number(s[2]) + "." + Number(s[1]) : String(iso || "");
  }
  function parts(heat) {
    var w = heat && heat.window;
    if (!w || !w.from || !w.to) return null;
    var a = dayMonth(w.from), b = dayMonth(w.to);
    return { label: WINDOW_HE, range: a === b ? a : a + " – " + b };
  }
  function windowText(h) { var q = parts(h); return q ? q.label + " " + q.range : ""; }

  /* Every ring in canvas pixels, holes included; the test below is even-odd. */
  function ringsOf(p, geom) {
    var g = geom || {}, out = [];
    (g.type === "Polygon" ? [g.coordinates]
      : g.type === "MultiPolygon" ? g.coordinates : []).forEach(function (poly) {
      poly.forEach(function (ring) {
        out.push(ring.map(function (c) { return p(c[0], c[1]); }));
      });
    });
    return out;
  }
  function inside(rings, x, y) {
    var hit = false;
    rings.forEach(function (r) {
      for (var i = 0, k = r.length - 1; i < r.length; k = i++) {
        if ((r[i][1] > y) !== (r[k][1] > y) && x < (r[k][0] - r[i][0]) *
            (y - r[i][1]) / (r[k][1] - r[i][1]) + r[i][0]) hit = !hit;
      }
    });
    return hit;
  }
  /* The belt's centreline point - the average of its biggest ring's vertices,
     which lands on the contact line and is where the red diamond goes. */
  function heart(rings) {
    var best = null, area = 0;
    rings.forEach(function (r) {
      var a = 0, i;
      for (i = 0; i < r.length - 1; i++) {
        a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
      }
      if (Math.abs(a) / 2 > area || !best) { area = Math.abs(a) / 2; best = r; }
    });
    if (!best || best.length < 3) return null;
    var n = best.length - 1, sx = 0, sy = 0, k;
    for (k = 0; k < n; k++) { sx += best[k][0]; sy += best[k][1]; }
    var xs = best.map(function (q) { return q[0]; });
    var ys = best.map(function (q) { return q[1]; });
    return { cx: sx / n, cy: sy / n,
             x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys),
             x1: Math.max.apply(null, xs), y1: Math.max.apply(null, ys) };
  }
  /* On the belt's own EDGE - within `d` of its outline? A belt is a buffered
     stretch of contact line, so measuring to its vertices measures to it. */
  function near(rings, x, y, d) {
    return rings.some(function (r) {
      return r.some(function (q) {
        return (q[0] - x) * (q[0] - x) + (q[1] - y) * (q[1] - y) <= d * d;
      });
    });
  }
  /* Somewhere on the belt to stand, NEAREST FIRST, so a digit never wanders off
     down the band. The grid reaches `pad` past the belt's box, for pass two. */
  function spotsOn(s, pad) {
    var out = [{ x: s.cx, y: s.cy, d: 0 }], i, k, x, y;
    var x0 = s.x0 - pad, y0 = s.y0 - pad;
    var dx = (s.x1 - s.x0 + 2 * pad) / SPOTS, dy = (s.y1 - s.y0 + 2 * pad) / SPOTS;
    for (i = 0; i <= SPOTS; i++) {
      for (k = 0; k <= SPOTS; k++) {
        x = x0 + dx * i; y = y0 + dy * k;
        out.push({ x: x, y: y, d: Math.hypot(x - s.cx, y - s.cy) });
      }
    }
    return out.sort(function (a, b) { return a.d - b.d; });
  }
  function boxAt(x, y, r) { return { x0: x - r, y0: y - r, x1: x + r, y1: y + r }; }
  /* Does a leader touch a box? Liang-Barsky, as extra.js and notes.js keep. */
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
  /* THE CALLOUT LEADERS OF A `key: "callouts"` PICTURE, drawn before this
     painter runs and NOT in `taken` - only the boxes are. Rebuilt from what
     dossier_map_notes.js reports plus the notes' points: each place takes the
     box its leader is shortest to. Read only when the report is this canvas's. */
  function leadersOf(p, u, map, W, H) {
    if (!map || map.key !== "callouts" || !window.DossierMapNotes) return [];
    var rep = DossierMapNotes.report();
    if (!rep || rep.width !== W || rep.height !== H) return [];
    var boxes = rep.boxes || [], out = [];
    (map.notes || []).forEach(function (n) {
      if (typeof n.lon !== "number" || typeof n.lat !== "number") return;
      var q = p(n.lon, n.lat), best = null, len = Infinity;
      boxes.forEach(function (b) {
        var g = [Math.max(b.x0, Math.min(q[0], b.x1)),
                 Math.max(b.y0, Math.min(q[1], b.y1)), q[0], q[1]], d;
        d = Math.hypot(g[2] - g[0], g[3] - g[1]);
        if (d < len) { len = d; best = g; }
      });
      if (best && len >= 4 * u) out.push(best);
    });
    return out;
  }
  function plate(ctx, x, y, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - r, y - r, 2 * r, 2 * r, r * 0.36);
    else ctx.rect(x - r, y - r, 2 * r, 2 * r);
  }
  function badge(ctx, P, x, y, r, n, u, step) {
    var R = D();
    plate(ctx, x, y, r * 0.94 + Math.max(1.5, 1.5 * u));
    R.paintShape(ctx, { fill: P.halo });
    plate(ctx, x, y, r * 0.94);
    R.paintShape(ctx, { fill: step, stroke: P.ink, width: Math.max(1.2, 1.6 * u) });
    R.text(ctx, P, String(n), x, y + r * 0.04,
      { size: r * 1.3, weight: 700, halo: 0, color: digitInk(step) });
  }
  /* THE WINDOW, BESIDE THE KEY: a plate of the key's own fill and edge, pinned
     under the legend box or over it. NOT a row in the key. */
  function stamp(ctx, P, u, heat, legend, taken, W, H, size) {
    var R = D(), q = parts(heat);
    if (!q) return null;
    var k = size / 17, pad = 12 * k, inset = 14 * u;
    var wLabel = R.width(ctx, q.label, size, 500), gap2 = 8 * k;
    var w = wLabel + R.width(ctx, q.range, size, 500) + gap2 + 2 * pad;
    var h = size * 1.55 + 0.4 * pad;
    var tries = [];
    if (legend) {
      tries.push([legend.x1 - w, legend.y0 + legend.h + 8 * u]);
      tries.push([legend.x1 - w, legend.y0 - 8 * u - h]);
    }
    tries.push([W - inset - w, H - inset - h], [inset, H - inset - h],
               [W - inset - w, inset], [inset, inset]);
    var best = null;
    tries.forEach(function (q) {
      var x = Math.min(Math.max(q[0], inset), Math.max(inset, W - inset - w));
      var y = Math.min(Math.max(q[1], inset), Math.max(inset, H - inset - h));
      var b = { x0: x, y0: y, x1: x + w, y1: y + h };
      var hit = taken.filter(function (t) { return R.overlaps(b, t); }).length;
      if (!best || hit < best.hit) best = { box: b, hit: hit };
    });
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(best.box.x0, best.box.y0, w, h, 10 * k);
    else ctx.rect(best.box.x0, best.box.y0, w, h);
    R.paintShape(ctx, { fill: P.box, stroke: P.boxLine, width: Math.max(1, u) });
    var dir0 = ctx.direction, cy = best.box.y0 + h / 2;
    R.setFont(ctx, size, 500);
    ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillStyle = P.ink;
    ctx.direction = "rtl"; ctx.fillText(q.label, best.box.x1 - pad, cy);
    ctx.direction = "ltr";
    ctx.fillText(q.range, best.box.x1 - pad - wLabel - gap2, cy);
    ctx.direction = dir0;
    taken.push(best.box);
    return { text: q.label + " " + q.range, box: best.box, covers: best.hit };
  }

  /* ONE DIGIT PER BELT, AND NEVER NONE. Painted after the legend against a
     `taken` holding every place, governorate, lane and zone name, every
     callout, every disc and the key box. An unscored belt gets no chip. */
  function badges(ctx, p, P, u, ts, G, map, taken, W, H, size, legend) {
    var R = D(), heat = (map && map.heat) || null, lv = levels(heat);
    var colors = ramp(P), kit = (window.DossierMapExtra || {}).kit;
    var mark = window.DossierMapLegend ? DossierMapLegend.markR(u) : 11 * u;
    var r = Math.max(BADGE_MIN, BADGE_R * u * ts), gap = GAP * u;
    var leaders = leadersOf(p, u, map, W, H), list = [];
    R.eachFeature(G && G.fronts, function (f) {
      var id = (f.properties || {}).id, g = ringsOf(p, f.geometry), s = heart(g);
      if (s && lv[id]) list.push({ id: id, n: lv[id], rings: g, s: s });
    });
    /* EVERY DIAMOND IS GROUND A CHIP MAY NOT TAKE, its own included. */
    var placed = taken.length, bars = taken.slice();
    list.forEach(function (it) { bars.push(boxAt(it.s.cx, it.s.cy, mark + gap)); });
    /* The cramped ones first (extra.js, `edgeness`): the rim has fewer ways. */
    if (kit) list.sort(function (a, b) {
      return kit.edgeness(b.s, W, H) - kit.edgeness(a.s, W, H);
    });
    var out = [];
    list.forEach(function (it) {
      var cands = spotsOn(it.s, r), spot = null, pass, i, c, b;
      /* ON THE BAND FIRST, TOUCHING IT SECOND: the chip is wider than the band
         at every size, and touching it still reads as that front's. */
      for (pass = 0; pass < 2 && !spot; pass++) {
        for (i = 0; i < cands.length; i++) {
          c = cands[i]; b = boxAt(c.x, c.y, r + gap);
          if (b.x0 < 0 || b.x1 > W || b.y0 < 0 || b.y1 > H) continue;
          if (!(pass ? near(it.rings, c.x, c.y, r) : inside(it.rings, c.x, c.y))) continue;
          if (bars.some(function (t) { return R.overlaps(b, t); })) continue;
          if (leaders.some(function (g) { return segBox(g, b); })) continue;
          spot = { x: c.x, y: c.y, box: b, on: pass ? "edge" : "belt" };
          break;
        }
      }
      /* AND NOTHING FREE EITHER WAY, so it steps off on a leader - the notes'
         own search and line. Never dropped: that is the whole point. */
      if (!spot && kit) {
        b = kit.findSpot(it.s, "n", 2 * (r + gap), 2 * (r + gap), u,
                         bars, bars, [], leaders, W, H);
        spot = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, box: b, on: "off" };
      }
      if (!spot) {
        c = [Math.min(Math.max(it.s.cx, r), W - r), Math.min(Math.max(it.s.cy, r), H - r)];
        spot = { x: c[0], y: c[1], box: boxAt(c[0], c[1], r + gap), on: "off" };
      }
      if (spot.on === "off" && kit) {
        var g = kit.leaderSeg(spot.box, it.s);
        if (kit.segLen(g) >= 4 * u) kit.leader(ctx, P, u, g);
      }
      badge(ctx, P, spot.x, spot.y, r, it.n, u, colors[it.n - 1]);
      bars.push(spot.box); taken.push(spot.box);
      out.push({ front: it.id, level: it.n, at: spot.on, box: spot.box,
        covers: taken.slice(0, placed).filter(function (t) {
          return R.overlaps(spot.box, t); }).length });
    });
    record(map, W, H, r, out, stamp(ctx, P, u, heat, legend, taken, W, H, size));
  }

  function record(map, W, H, r, list, note) {
    var key = ((map && map.id) || "?") + " " + W + "x" + H;
    REPORTS = REPORTS.filter(function (e) { return e.key !== key; })
      .slice(1 - REPORT_MAX);
    REPORTS.push({ key: key, map: (map && map.id) || null, width: W, height: H,
                   radius: Math.round(r), window_he: (note && note.text) || "",
                   window_box: note && note.box, badges: list });
  }
  function mapRecord(id) {
    var DS = (typeof DOSSIER !== "undefined" && DOSSIER) ? DOSSIER : null;
    return (DS && (DS.maps || []).filter(function (m) { return m.id === id; })[0]) || null;
  }
  /* WHAT THE VERIFIER READS, in the console and never on the page. One dry PNG
     run (?png=dry) paints every shape of every picture, so `DossierMapHeat
     .audit()` then answers for all six at once: { ok, fronts, contrast, dim,
     entries: [{ key, badges, missing, duplicates, wrong, overlaps, covers, at,
     window_he, window_want, ok }] }. `wrong` compares the digit PAINTED with the
     authored level; `dim` is any ramp step whose digit measures under 4.5:1. */
  function contrast() {
    var out = [];
    ["light", "dark"].forEach(function (t) {
      RAMP[t].forEach(function (c, i) {
        out.push({ theme: t, level: i + 1, step: c, ink: digitInk(c),
                   ratio: Math.round(ratio(digitInk(c), c) * 100) / 100 });
      });
    });
    return out;
  }
  function audit() {
    var R = D(), G = (typeof GEO !== "undefined" && GEO) ? GEO : null, n = 0;
    var dim = contrast().filter(function (r) { return r.ratio < 4.5; });
    var want = {};
    R.eachFeature(G && G.fronts, function (f) {
      want[(f.properties || {}).id] = true; n++;
    });
    var entries = REPORTS.map(function (e) {
      var rec = mapRecord(e.map), lv = levels(rec && rec.heat);
      var seen = {}, dup = [], wrong = [], missing = [], over = 0, covers = 0;
      var at = { belt: 0, edge: 0, off: 0 }, i, k;
      e.badges.forEach(function (b) {
        if (seen[b.front]) dup.push(b.front);
        seen[b.front] = b;
        if (lv[b.front] !== b.level) wrong.push(b.front);
        at[b.at] = (at[b.at] || 0) + 1;
        covers += b.covers || 0;
      });
      Object.keys(want).forEach(function (id) { if (!seen[id]) missing.push(id); });
      for (i = 0; i < e.badges.length; i++) {
        for (k = i + 1; k < e.badges.length; k++) {
          if (R.overlaps(e.badges[i].box, e.badges[k].box)) over++;
        }
      }
      var wt = windowText(rec && rec.heat);
      return { key: e.key, fronts: n, badges: e.badges.length, missing: missing,
               duplicates: dup, wrong: wrong, overlaps: over, covers: covers,
               at: at, window_he: e.window_he, window_want: wt,
               ok: !missing.length && !dup.length && !wrong.length && !over &&
                   !covers && e.badges.length === n && !!wt && e.window_he === wt };
    });
    return { ok: entries.length > 0 && !dim.length &&
               entries.every(function (e) { return e.ok; }),
             fronts: n, contrast: contrast(), dim: dim, entries: entries };
  }

  /* `words` is exported so the HTML key under the picture prints THE SAME five
     labels in the same order - one list, two keys, no chance of drift. */
  return { fronts: fronts, legendRows: legendRows, ramp: ramp, words: WORDS,
           badges: badges, audit: audit, windowText: windowText,
           report: function () { return REPORTS; } };
})();

window.DossierMapHeat = DossierMapHeat;
