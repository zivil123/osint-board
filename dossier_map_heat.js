/* HOW HARD EACH FRONT IS BEING FOUGHT, as a colour on the belt itself.

   A dossier map record may carry `heat`:
     map.heat = { window: {from, to}, scale?: 10,
                  fronts: [{front, level, date, src}, ...] }   // one per belt
   `front` is a GEO.fronts feature's `properties.id`; `level` is 1..5, or 1..10
   with `scale: 10`. The build guarantees every belt is there; a belt with no
   level is painted the ordinary contested wash, so a gap reads "no reading".

   WHY A COLOUR AND NOT A WIDTH: a belt's width is already spoken for (12 km of
   sourced contact, UI.md "A front is a BELT ON THE LINE"); a rank is a colour.
   EACH BELT IS FILLED ON ITS OWN - safe as the build refuses overlapping belts.

   AND THE SAME NUMBER, WRITTEN ON THE BELT (2026-09-18). Ziv: *"mark on the
   map, on the fronts, the number of how much fighting there is... And also show
   what dates the information is from."* A colour has to be carried to the key
   and back before it says anything - so badges() writes every belt's level on it
   as a digit and stamps the window beside the key, LAST so nothing covers them.

   One global, window.DossierMapHeat (no ES modules - file://): ground() in
   dossier_map_draw.js calls fronts() in place of the contested fill, the legend
   legendRows(), dossier_map.js badges() last. `ground` and `kit` are for the
   report's focus / rank pictures, dossier_map_focus.js. Words authored HERE. */
"use strict";

var DossierMapHeat = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_heat: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  /* FIVE STEPS, MONOTONE IN LIGHTNESS, one set per ground. Light deck: pale to
     deep, the ordinary reading of "more". Dark board: deep to bright, a
     near-black step 5 vanishing into the board instead of shouting. Neither end
     is the fighting-zone diamond's red (#E01B0F light): the deepest light step
     #A50F15 is darker and far less orange, so a mark still reads on it. */
  var RAMP = {
    light: ["#FEE5D9", "#FCAE91", "#FB6A4A", "#DE2D26", "#A50F15"],
    dark: ["#4A1512", "#7E2318", "#B1301C", "#DC5A2A", "#F59A4B"]
  };
  /* THE DIGIT ON A CHIP IS MEASURED, NEVER PICKED BY EYE. The chip is the step's
     own colour, so one ink cannot serve five - the dark ink holds 15.6:1 on
     light step 1 and 3.5:1 on light step 4, and the dark ramp runs the other way
     up. Each step takes whichever reads better ON it; audit() asserts all ten
     clear 4.5:1 (#14202C measured 4.35:1 on dark step 4, hence #0B121A). */
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
  /* The key's five rows. A number AND a word on each: the number is what the
     reader matches against the colour, the word is what it means. */
  var WORDS = ["1 — שקט יחסית", "2 — לחימה מועטה", "3 — לחימה מתונה",
               "4 — לחימה כבדה", "5 — הלחימה הכבדה ביותר"];

  /* A GLOW UNDER THE BELTS (2026-09-17). A belt is 12 km of sourced contact on
     a 500 km frame - three pixels: the scale was right and unreadable. So every
     ring is stroked in its level colour, wide and soft, before the fills go
     down; the fighting is not spread wider (fill, hatch and outline still say
     where it is), the ATTENTION is. Ascending, so the hotter glow is on top. */
  var GLOW_W = 22, GLOW_A = 0.32;

  /* THE 1-10 SCALE, `heat.scale: 10` (2026-09-25, the Word report's overview -
     "in one glance I will know which fronts are the most active"): the Fronts
     tab's own colours, BfMarks.SCALE in battlefronts_marks.js, read at call time;
     TEN copies it (2026-09-25) for a page without the tab. Key: 1, 4, 7, 10. */
  var TEN = ["#8494A8", "#968E9C", "#A78890", "#B68084", "#C37877",
             "#D06F69", "#DD645B", "#E9574C", "#F44639", "#FF2D20"];
  var TEN_KEY = [1, 4, 7, 10], TEN_WORD = "מדד פעילות";
  function top(heat) { return heat && heat.scale === 10 ? 10 : 5; }
  /* A palette or a bare theme name (the HTML key has only the name) + heat. */
  function ramp(P, heat) {
    var B = window.BfMarks, t = typeof P === "string" ? P : (P && P.theme);
    if (top(heat) === 10) return (B && B.SCALE && B.SCALE.length === 10) ? B.SCALE : TEN;
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
      if (isFinite(n) && n >= 1 && n <= top(heat)) out[r.front] = n;
    });
    return out;
  }

  /* Painted at the SAME fade the contested wash uses, so a heat map over the
     terrain keeps the relief readable as the plain one does; the hatch, the
     outline and the diamond that follow in ground() are not its business. */
  function fronts(ctx, p, P, u, G, heat, opt) {
    var R = D(), o = opt || {}, colors = ramp(P, heat), lv = levels(heat), list = [];
    if (heat && heat.focus && window.DossierMapFocus) DossierMapFocus.quiet(ctx, p, P, u, o);
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
     steps take its place in the list - so the key never names a colour that is
     not on the picture, and never leaves one on it unnamed. The row that leaves
     carries the hatch the belts are drawn with, built against the canvas the
     legend was measured on, so a swatch still reads as one. */
  function legendRows(P, u, map, rows) {
    var list = (rows || []).slice(), at = -1, i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].mark && list[i].hatch) { at = i; break; }
    }
    if (at < 0) return list;
    var old = list[at], steps = ramp(P, map && map.heat), ten = steps.length === 10;
    var scale = (ten ? TEN_KEY : [1, 2, 3, 4, 5]).map(function (n) {
      var c = steps[n - 1];
      return { fill: c, label: ten ? TEN_WORD + " " + n : WORDS[n - 1],
        draw: function (cx2, P2, u2, sx, cy, sw, sh) {
          badge(cx2, P2, sx + sw / 2, cy, keyR(sw, sh, u2), n, u2, c);
        } };
    });
    if (window.DossierMapFocus) scale = DossierMapFocus.keyRows(scale, map && map.heat, P);
    /* AND ONE ROW FOR THE MARK, under the scale: every belt still carries the
       red diamond, and a mark with no row is a mark nobody can read - so the
       row the scale replaced hands its words and swatch back, minus the fill. */
    scale.push({ hatch: old.hatch, stroke: old.stroke, dash: old.dash,
                 width: old.width, mark: true, label: old.label });
    return list.slice(0, at).concat(scale, list.slice(at + 1));
  }

  /* ---- the level digit, written on the belt -------------------------------- */

  /* A COLOURED CHIP, NOT A WHITE DISC. The key panel's objectives are numbered
     white DISCS (dossier_map_key.js) and on fronts_heat_reports they stand a
     few pixels from these: identical marks, a row number and a level. So a
     level is a rounded SQUARE filled with ITS OWN STEP - its belt's colour,
     its key row's - and white circles stay the notes'. */
  var BADGE_R = 12, BADGE_MIN = 10;
  /* How finely a belt is sampled: the chip is WIDER than a 12 km band. */
  var SPOTS = 40;
  var GAP = 2;          /* how far a badge keeps off a diamond and its neighbours */
  var REPORTS = [], REPORT_MAX = 40;
  /* The date stamp, in the board's day.month form (docs\gains.js). PAINTED AS
     TWO RUNS AND NOT ONE STRING (`parts()`): in an rtl run the dash between two
     numbers is a neutral BETWEEN NUMBERS, which bidi resolves as if numbers ran
     right-to-left. Chromium renders one marked string forwards (2026-09-18) -
     but a range reading backwards elsewhere is a WRONG DATE. */
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
  /* The belt's centreline point - its biggest ring's average vertex, which
     lands on the contact line and is where the red diamond goes. */
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
     stretch of line, so measuring to its vertices measures to it. */
  function near(rings, x, y, d) {
    return rings.some(function (r) {
      return r.some(function (q) {
        return (q[0] - x) * (q[0] - x) + (q[1] - y) * (q[1] - y) <= d * d;
      });
    });
  }
  /* Somewhere on the belt to stand, NEAREST FIRST; the grid reaches `pad` past
     the belt's box, for pass two. */
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
  /* THE CALLOUT LEADERS OF A `key: "callouts"` PICTURE, drawn before this
     painter runs and NOT in `taken` - only the boxes are. TAKEN STRAIGHT FROM
     THE REPORT since 2026-09-18, bends and all, so a chip is kept off the line
     really drawn: it used to rebuild them from `rep.boxes`, a field report never
     carried, so the list came back EMPTY and a badge could land on an arrow. */
  function leadersOf(p, u, map, W, H) {
    if (!map || map.key !== "callouts" || !window.DossierMapNotes) return [];
    var rep = DossierMapNotes.report();
    if (!rep || rep.width !== W || rep.height !== H) return [];
    return (rep.routes || []).filter(function (rt) {
      return rt && rt.segs.length && rt.len >= 4 * u;
    });
  }
  function plate(ctx, x, y, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - r, y - r, 2 * r, 2 * r, r * 0.36);
    else ctx.rect(x - r, y - r, 2 * r, 2 * r);
  }
  /* THE LEVEL IN THE KEY IS STILL A LEVEL TO READ (2026-09-19). A chip drawn to
     fit the 16k swatch writes its digit at 61% of the key's own words: 25 CSS px
     on a slide, where nobody noticed, and 12 on the 1230px board, under the
     floor. It grows to what the floor needs and no further - the 26k row holds
     it, and on a slide the swatch already wins, so the downloads do not move.
     AND THE FLOOR IS THE CANVAS'S, NOT THE SWATCH'S BAND: floored on `u`, the
     width the KEY was handed - half the canvas on a three-band split - it came
     out at 8.8 CSS px on the heat-report panel. MAP_RULES.md rule 2. */
  function keyR(sw, sh, u) {
    var floor = (window.DossierMapCheck || {}).floor || 15;
    var cu = (window.DossierMapDraw && DossierMapDraw.canvasScale()) || u;
    return Math.max(Math.min(sw, sh) / 2, floor * cu / 1.3);
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
  /* THE WINDOW, BESIDE THE KEY: a plate of the key's own fill and edge, under
     the legend box or over it. NOT a row in the key. */
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
     `taken` holding every name, callout, disc and the key box itself. An
     unscored belt gets no chip. */
  function badges(ctx, p, P, u, ts, G, map, taken, W, H, size, legend) {
    var R = D(), heat = (map && map.heat) || null, lv = levels(heat);
    var colors = ramp(P, heat), kit = (window.DossierMapExtra || {}).kit;
    var mark = window.DossierMapLegend ? DossierMapLegend.markR(u) : 11 * u;
    var r = Math.max(BADGE_MIN, BADGE_R * u * ts), gap = GAP * u;
    var leaders = leadersOf(p, u, map, W, H), list = [];
    R.eachFeature(G && G.fronts, function (f) {
      var id = (f.properties || {}).id, g = ringsOf(p, f.geometry), s = heart(g); if (s && window.DossierMapBeltWords) DossierMapBeltWords.slideHeart(s, f);
      if (s && lv[id]) list.push({ id: id, n: lv[id], rings: g, s: s });
    });
    /* EVERY DIAMOND IS GROUND A CHIP MAY NOT TAKE, its own included - and the
       marks reserved before the names (dossier_map_ink.js) are NOT: a chip is
       placed exactly as it was, so that reservation costs the badges nothing. */
    var placed = taken.length, bars = kit ? kit.words(taken) : taken.slice();
    list.forEach(function (it) { bars.push(boxAt(it.s.cx, it.s.cy, mark + gap)); }); if (window.DossierMapBeltWords) bars = bars.concat(DossierMapBeltWords.lineBars());
    /* The cramped ones first (extra.js, `edgeness`): the rim has fewer ways. */
    if (kit) list.sort(function (a, b) {
      return kit.edgeness(b.s, W, H) - kit.edgeness(a.s, W, H);
    });
    var out = [], drawn = leaders.slice(), over = 0, dirty = [];
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
          if (hitsLeader(drawn, b)) continue;
          spot = { x: c.x, y: c.y, box: b, on: pass ? "edge" : "belt" };
          break;
        }
      }
      /* AND NOTHING FREE EITHER WAY, so it steps off on a leader - the notes'
         own search and line, refusal and one bend included. Never dropped. */
      if (!spot && kit) {
        b = kit.findSpot(it.s, "n", 2 * (r + gap), 2 * (r + gap), u,
                         bars, bars, [], drawn, W, H);
        spot = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, box: b, on: "off",
                 rt: b.route };
      }
      if (!spot) {
        c = [Math.min(Math.max(it.s.cx, r), W - r), Math.min(Math.max(it.s.cy, r), H - r)];
        spot = { x: c[0], y: c[1], box: boxAt(c[0], c[1], r + gap), on: "off" };
      }
      if (spot.on === "off" && kit) {
        var rt = spot.rt || kit.straight(spot.box, it.s);
        if (rt.len >= 4 * u) {
          kit.paint(ctx, P, u, rt); drawn.push(rt);
          if (!spot.rt) { dirty.push(it.id);
            over += kit.overText(rt, taken.slice(0, placed), spot.box, it.s); }
        }
      }
      badge(ctx, P, spot.x, spot.y, r, (heat.numbers || {})[it.id] || it.n, u, colors[it.n - 1]);
      bars.push(spot.box); taken.push(spot.box);
      /* THE LAST MARK ON THE PICTURE, and it goes on the one list every name
         is checked against (dossier_map_ink.js): a chip printed over a town
         name is `mark_over_text` and fails the picture, whatever the search
         thought it had avoided. */
      if (window.DossierMapInk) DossierMapInk.mark(spot.box, "level " + it.id);
      out.push({ front: it.id, level: it.n, at: spot.on, box: spot.box,
        covers: (kit ? kit.words(taken.slice(0, placed)) : taken.slice(0, placed))
          .filter(function (t) { return R.overlaps(spot.box, t); }).length });
    });
    /* AND IT SAYS SO: a leader the router could not place clean is counted and
       named - the fault Ziv photographed was a line over a front's name. */
    if (kit) {
      kit.fault((map || {}).id, "heat badges " + W + "x" + H +
        (dirty.length ? " at " + dirty.join(", ") : ""), over, kit.crossings(drawn));
    }
    record(map, W, H, r, out, stamp(ctx, P, u, heat, legend, taken, W, H, size));
  }
  /* A chip may not sit on a LINE either, and only the boxes are in `taken`. The
     box test is dossier_map_leader.js's own and not a copy: one answer on this
     board to "does this line touch that rectangle" (a second lived here until
     2026-09-19). */
  function hitsLeader(leaders, b) {
    var seg = (window.DossierMapLeader || {}).segBox;
    return !!seg && leaders.some(function (l) {
      return (l.segs || [l]).some(function (g) { return seg(g, b); });
    });
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
     run (?png=dry) paints every shape, so `DossierMapHeat.audit()` answers for
     all six at once: { ok, fronts, contrast, dim, entries: [{ key, badges,
     missing, duplicates, wrong, overlaps, covers, at, window_he, window_want,
     ok }] }. `wrong` is the digit PAINTED against the authored level; `dim` any
     ramp step whose digit measures under 4.5:1. */
  function contrast() {
    var out = [];
    ["light", "dark", "ten"].forEach(function (t) {
      (t === "ten" ? ramp(t, { scale: 10 }) : RAMP[t]).forEach(function (c, i) {
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
     labels in the same order - one list, two keys, no drift. */
  return { fronts: fronts, legendRows: legendRows, ramp: ramp, words: WORDS,
           badges: badges, audit: audit, windowText: windowText,
           report: function () { return REPORTS; }, kit: { badge: badge, keyR: keyR },
           ground: function () { var F = window.DossierMapFocus;
             return (F || D()).ground.apply(null, arguments); } };
})();

window.DossierMapHeat = DossierMapHeat;
