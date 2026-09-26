/* dossier_map_story_marks.js - the front maps' three story marks (2026-09-26):
   a reported CLASH as a plain red dot (name only), a PEAK's height, and the
   side view's PROFILE line. Fields validated by scripts\dossier_maps_story_marks.py.

   Ziv, 2026-09-26, of the Word report's front close-ups: the maps showed the
   overview's fighting belt while the text said the fighting was elsewhere, and
   the text spoke of ridges over the strait the map did not show. He chose "a
   small dot at each place the text says fighting happened, with its date" (a
   PLAIN mark - he rejected icon styles), the key peak heights written on, and
   the side view's line on the map.

   HOW IT HANGS ON THE PINS LAYER (docs\dossier_map_pins.js calls every hook):
   - `prep` (from the pins' `paint`, before the key is laid out): a pin's name
     takes, when the peak IS that pin, its height - no clash dates (Ziv,
     2026-09-26: "the maps shouldn't say the dates"; they stay in the data) -
     "name · 820 מ'". Any other peak becomes a REQUIRED label of the
     existing `heights` kind (routes.js draws its dark triangle, the placer seats
     its word, the ink check owns the pair), so nothing here re-invents placing.
     Idempotent: the record object is painted many times.
   - `isDot` / `dotGeom` / `drawDot`: a clash place's pin is drawn as a red dot
     with a white edge; the pins file keeps seating the name against it.
   - `line` (before the belts and roads are pushed into `taken`): the dashed
     profile line, registered with dossier_map_road_words.js so no word may lie
     on it (`word_on_road`); its end dots are ink marks.
   - `ends` (after the push): the letters alef and bet, each beside its end on
     clear ground, tagged `inkWord` so the check sees them.
   - `keyRows` (legend painter): the red-dot row, and the triangle row reworded
     for a peak; each only when that mark is on the picture.
   - `sides` (from `ends`), on every story map with dated dots: one
     plain word on each side's own ground naming the side (see SIDES below).
   A mark off the picture is filed as `story_mark_off`, a letter with no clear
   spot as `profile_end_unplaced` - both fail the dump.

   NO ES modules - the page runs from file://. One global:
     window.DossierMapStoryMarks = { prep, isDot, dotGeom, drawDot, line, ends, keyRows } */
"use strict";

(function () {
  var RED = "#D8232A", EDGE = "#FFFFFF", KEY = "rgba(22,32,43,0.6)", DARK = "#1B2530";
  /* The side view's own colour (2026-09-26): three near-parallel lines ran from
     the ridge to the cape - this one, the line of contact and a governorate
     border - so it takes a deep blue nothing else on a report map uses.
     INK is the pins' name ink (dossier_map_pins.js), for the peak heights. */
  var BLUE = "#1646A8", INK = "#111A24";
  var HE = { clash: "היתקלות מדווחת", peak: "פסגה, גובה במטרים",
             m: "מ'", from: "א", to: "ב", houthi: "החות'ים", government: "הכוחות הלגיטימיים" };
  var SEP = " · ";

  function off(what) {
    console.error("dossier map story marks: " + what + " is off the picture");
    if (window.DossierMapCheck) DossierMapCheck.add("story_mark_off", 1);
  }
  function dm(iso) { var d = String(iso).split("-"); return (+d[2]) + "." + (+d[1]); }
  function dates(map, place) {
    return ((map && map.clashes) || []).filter(function (c) { return c.place === place; })
      .map(function (c) { return c.date; }).sort().map(dm);
  }
  function isDot(map, place) { return dates(map, place).length > 0; }
  function meters(m) { return m + " " + HE.m; }
  /* The pin a peak stands on: named by key, or at the pin's own point. */
  function pinOf(k, map) {
    var hit = null;
    (map.pins || []).forEach(function (pin) {
      if (k.place === pin.place ||
          (Math.abs(k.lat - pin.lat) < 2e-4 && Math.abs(k.lon - pin.lon) < 2e-4)) hit = pin;
    });
    return hit;
  }

  function prep(map, p) {
    if (!map) return;
    var peaks = map.peaks || [], onPin = {}, labels;
    peaks.forEach(function (k) { var pin = pinOf(k, map); if (pin) onPin[pin.place] = k; });
    labels = (map.labels || []).filter(function (l) { return !l.storyPeak; });
    labels.forEach(function (l) {
      if (l.baseHe === undefined) { l.baseHe = l.he; l.baseKind = l.kind; }
      l.he = l.baseHe; l.kind = l.baseKind;
      if (!l.pinned) return;
      var bits = [l.baseHe];
      if (onPin[l.place]) bits.push(meters(onPin[l.place].m));
      l.he = bits.join(SEP);
    });
    peaks.forEach(function (k, i) {
      if (pinOf(k, map)) return;
      if (p && p.inside && !p.inside(k.lon, k.lat, 0)) { off("peak " + (k.place || i)); return; }
      var named = k.place && labels.filter(function (l) { return l.place === k.place; })[0];
      if (named) {   /* a context label already at that place: one word, one mark */
        named.he = named.baseHe + SEP + meters(k.m); named.kind = "heights";
        return;
      }
      labels.push({ place: k.place || "peak_" + i, he: meters(k.m), lat: k.lat, lon: k.lon,
                    anchor: "e", tier: 1, kind: "heights", req: true, storyPeak: true });
    });
    map.labels = labels;
  }

  /* THE CLASH DOT: about two thirds of a pin head, red with a white edge and a
     thin dark keyline - the pin's own recipe without the stem and the eye. */
  function dotGeom(q, u, size) {
    var r = size * 0.36, ew = Math.max(1.3, 1.4 * u), k = Math.max(0.8, 0.9 * u);
    return { dot: true, x: q[0], y: q[1], cx: q[0], cy: q[1], rh: r, d: 0,
             ew: ew, k: k, out: ew + k };
  }
  function dot(ctx, x, y, g) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, g.rh, 0, Math.PI * 2);
    ctx.strokeStyle = KEY; ctx.lineWidth = 2 * g.out; ctx.stroke();
    ctx.strokeStyle = EDGE; ctx.lineWidth = 2 * g.ew; ctx.stroke();
    ctx.fillStyle = RED; ctx.fill();
    ctx.restore();
  }
  function drawDot(ctx, g) {
    dot(ctx, g.x, g.y, g);
    if (window.DossierMapInk && DossierMapInk.painted) DossierMapInk.painted(g.x, g.y, "clash");
  }

  /* ---- the profile line ---------------------------------------------------- */
  var ENDS = null, LP = null;
  function line(ctx, p, u, map, taken) {
    ENDS = null; LP = p;
    /* A PEAK'S HEIGHT IN THE NAMES' DARK INK (2026-09-26): the pins' paint styles
       every non-pin label quiet grey AFTER prep, which barely read on the strong
       ramp's browns; this is the first hook after it. Colour only - the weight
       the placer measured stays. */
    ((map && map.labels) || []).forEach(function (l) {
      if (l.style && (l.storyPeak || (l.kind === "heights" && l.baseKind !== "heights")))
        l.style = { weight: l.style.weight, color: INK };
    });
    var pr = map && map.pins && map.profile;
    if (!pr) return;
    var f = pr.from, t = pr.to;
    if (p.inside && (!p.inside(f[1], f[0], 0) || !p.inside(t[1], t[0], 0))) off("profile end");
    /* DASH-DOT, the section line's own convention: a plain dash read as the
       line of contact (6-4 dash, the same dark) on the first picture. */
    var a = p(f[1], f[0]), b = p(t[1], t[0]), dash = [12 * u, 4 * u, 3 * u, 4 * u];
    ctx.save();
    ctx.lineCap = "butt";
    [["rgba(255,255,255,0.85)", 5.4 * u], [BLUE, 3 * u]].forEach(function (st) {
      ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      ctx.strokeStyle = st[0]; ctx.lineWidth = Math.max(1.2, st[1]); ctx.stroke();
    });
    ctx.setLineDash([]);
    var er = 4.2 * u;
    [a, b].forEach(function (e) {
      ctx.beginPath(); ctx.arc(e[0], e[1], er, 0, Math.PI * 2);
      ctx.fillStyle = BLUE; ctx.fill();
      ctx.strokeStyle = EDGE; ctx.lineWidth = 1.4 * u; ctx.stroke();
      taken.push({ mark: true, ink: "profile end", x0: e[0] - er - 2 * u, y0: e[1] - er - 2 * u,
                   x1: e[0] + er + 2 * u, y1: e[1] + er + 2 * u });
    });
    ctx.restore();
    if (window.DossierMapRoadWords) DossierMapRoadWords.add([a, b], 3 * u, "profile line");
    ENDS = [a, b];
  }

  /* Each letter beside its own end: straight on past the end first, then
     turning round it, at three reaches; a spot must be inside the picture, off
     every mark, belt bar and drawn line, and a space off every word. */
  function ends(ctx, P, u, ts, map, taken, W, H) {
    sides(ctx, P, u, ts, map, taken, W, H);
    if (!ENDS) return;
    var R = window.DossierMapDraw, C = window.DossierMapCheck, RW = window.DossierMapRoadWords;
    /* Each letter small, in a white disc ringed in the line's blue. */
    var size = Math.max(16, 16 * u * (ts || 1)), h = size * 1.5;
    /* The drawn lines no registry holds - the line of contact, the seam, the
       coast, borders - read off the geometry the notes use; a letter on one
       is not on clear ground (a governorate border is let pass second, the coast last). */
    var NL = window.DossierMapNoteLines && typeof GEO !== "undefined" && LP
      ? DossierMapNoteLines.build(LP, u, GEO, map, W, H) : null;
    ENDS.forEach(function (e, i) {
      var str = i ? HE.to : HE.from, w = h;
      var o = ENDS[1 - i], dx = e[0] - o[0], dy = e[1] - o[1], L = Math.hypot(dx, dy) || 1;
      dx /= L; dy /= L;
      var spot = null, first = null;
      [[], ["border", "roadnet"], ["border", "roadnet", "coast"]].some(function (let_) { return [0, 45, -45, 90, -90, 135, -135].some(function (deg) {
        var tt = deg * Math.PI / 180, ux = dx * Math.cos(tt) - dy * Math.sin(tt),
            uy = dx * Math.sin(tt) + dy * Math.cos(tt);
        return [5, 10, 16, 24, 32].some(function (gap) {
          var reach = Math.abs(ux) * w / 2 + Math.abs(uy) * h / 2 + gap * u;
          var cx = e[0] + ux * reach, cy = e[1] + uy * reach;
          var box = { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
          if (!first) first = box;
          if (box.x0 < 0 || box.y0 < 0 || box.x1 > W || box.y1 > H) return false;
          if (RW && RW.hits(box).length) return false;
          if (NL && NL.hits(box).some(function (k) { return let_.indexOf(k) < 0; })) return false;
          var bad = taken.some(function (b) {
            if (!b) return false;
            if (b.mark || !C || !C.apart) {
              return Math.min(b.x1, box.x1) - Math.max(b.x0, box.x0) > 0 &&
                     Math.min(b.y1, box.y1) - Math.max(b.y0, box.y0) > 0;
            }
            return !C.apart(b, box);
          });
          if (!bad) spot = box;
          return !bad;
        });
      }); });
      if (!spot) {
        console.error("dossier map story marks: the profile letter " + (i ? "B" : "A") +
                      " found no clear ground beside its end");
        if (C) C.add("profile_end_unplaced", 1);
        spot = first;
      }
      var sx = (spot.x0 + spot.x1) / 2, sy = (spot.y0 + spot.y1) / 2;
      ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, h / 2 - 0.8 * u, 0, Math.PI * 2);
      ctx.fillStyle = EDGE; ctx.fill();
      ctx.strokeStyle = BLUE; ctx.lineWidth = Math.max(1.2, 1.6 * u); ctx.stroke(); ctx.restore();
      R.text(ctx, P, str, sx, sy + 0.04 * size, { size: size, weight: 800, halo: 0, color: BLUE });
      spot.inkWord = "profile end " + (i ? "B" : "A");
      taken.push(spot);
    });
    ENDS = null;
  }

  /* ---- SIDES: which side holds which ground ---------------------------------
     2026-09-26, the strait sample: the strong ramp's browns swamp the Houthi
     fill (#C6BCAE, a house colour that does not change), so on a story map
     each side's ground is named once, in small plain words ("החות'ים", "הכוחות הלגיטימיים"): the
     most open spot wholly on that side's own fill, off every mark, word, drawn
     line and road. Placed before the names, so they give way to it; a side with
     no such spot, or none in the picture, simply gets no word. */
  function rings(p, W, H) {
    var out = { houthi: [], government: [] }, R = window.DossierMapDraw;
    if (typeof GEO === "undefined" || !GEO.control_zones || !R) return out;
    R.eachFeature(GEO.control_zones, function (f) {
      var c = (f.properties || {}).control, g = f.geometry || {};
      if (!out[c]) return;
      (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [])
        .forEach(function (poly) {
          var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
          var rs = poly.map(function (r) { return r.map(function (pt) {
            var q = p(pt[0], pt[1]);
            x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]);
            return q; }); });
          if (x1 > 0 && y1 > 0 && x0 < W && y0 < H) out[c].push(rs);
        });
    });
    return out;
  }
  /* Each side's ground as a quarter-scale mask, painted once per call. */
  var MQ = 4;
  function mask(polys, W, H) {
    var w = Math.ceil(W / MQ), h = Math.ceil(H / MQ), cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    var c = cv.getContext("2d");
    c.beginPath();
    polys.forEach(function (rs) { rs.forEach(function (r) {
      r.forEach(function (q, i) { c[i ? "lineTo" : "moveTo"](q[0] / MQ, q[1] / MQ); });
      c.closePath(); }); });
    c.fillStyle = "#000"; c.fill("evenodd");
    var d = c.getImageData(0, 0, w, h).data;
    return function (x, y) {
      var i = Math.floor(x / MQ), j = Math.floor(y / MQ);
      return i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 200;
    };
  }
  function sides(ctx, P, u, ts, map, taken, W, H) {
    if (!map || !map.pins || map.ground === "streets" ||
        /* Every Word-report front map names both sides, dot or no dot (Ziv,
           2026-09-26); the overview names fronts, not sides. */
        !(map.clashes || map.peaks || map.profile ||
          (map.tab === "report" && map.id !== "report_overview")) || !LP) return;
    var R = window.DossierMapDraw, RW = window.DossierMapRoadWords;
    var NL = window.DossierMapNoteLines ? DossierMapNoteLines.build(LP, u, GEO, map, W, H) : null;
    var zs = rings(LP, W, H), size = Math.max(16, 16 * u * (ts || 1)), h = size * 1.3;
    var step = Math.max(6, 10 * u), m = 10 * u;
    ["houthi", "government"].forEach(function (side) {
      if (!zs[side].length) return;
      var str = HE[side], w = R.width(ctx, str, size, 700) + 8 * u, best = null, on = mask(zs[side], W, H);
      for (var cy = m + h / 2; cy < H - m - h / 2; cy += step) {
        for (var cx = m + w / 2; cx < W - m - w / 2; cx += step) {
          var box = { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
          if (![[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1], [cx, cy]]
              .every(function (q) { return on(q[0], q[1]); })) continue;
          if ((RW && RW.hits(box).length) || (NL && NL.hits(box).length)) continue;
          /* Openness: the distance to the nearest reserved box, capped; 12u
             at least, over the check's own gap between words. */
          var room = 80 * u;
          taken.forEach(function (b) {
            if (!b) return;
            var dx = Math.max(b.x0 - box.x1, box.x0 - b.x1, 0), dy = Math.max(b.y0 - box.y1, box.y0 - b.y1, 0);
            room = Math.min(room, Math.hypot(dx, dy));
          });
          if (room < 12 * u) continue;
          var score = room - 0.02 * Math.hypot(cx - W / 2, cy - H / 2);
          if (!best || score > best.score) best = { box: box, score: score, x: cx, y: cy };
        }
      }
      if (!best) { console.error("dossier map story marks: no clear ground for the " + side + " word"); return; }
      R.text(ctx, P, str, best.x, best.y, { size: size, weight: 700, halo: 3.5 * u, color: INK });
      best.box.inkWord = "side " + side;
      taken.push(best.box);
    });
  }

  /* ---- the key --------------------------------------------------------------- */
  function keyRows(map, rows, u, p) {
    if (!map || !map.pins) return rows;
    var dots = (map.pins || []).some(function (pin) {
      return isDot(map, pin.place) && (!p || !p.inside || p.inside(pin.lon, pin.lat, 0));
    });
    var peakOnly = (map.labels || []).every(function (l) {
      return l.kind !== "heights" || l.storyPeak || (l.baseKind !== "heights" && l.baseHe !== undefined);
    });
    rows = rows.map(function (r) {
      if (r.kind !== "heights" || !peakOnly || !(map.peaks || []).length) return r;
      var c = {}; Object.keys(r).forEach(function (k) { c[k] = r[k]; });
      c.label = HE.peak;
      return c;
    });
    if (dots) {
      rows.push({ kind: "clash", label: HE.clash, draw: function (c, Q, uu, x, cy, sw, sh) {
        var g = dotGeom([x + sw / 2, cy], uu, sh / 1.05);
        dot(c, g.x, g.y, g);
      } });
    }
    return rows;
  }

  window.DossierMapStoryMarks = { prep: prep, isDot: isDot, dotGeom: dotGeom, drawDot: drawDot,
                                  line: line, ends: ends, sides: sides, keyRows: keyRows };
}());
