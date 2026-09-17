/* The roads map (the כבישים tab): Yemen's main road network on the terrain,
   the key corridors drawn thick over it, and five ways to colour them.

   It is a dossier-style canvas map, not a Leaflet one, because every new map on
   this board is drawn on the terrain (DOSSIER_EXPORT.md) and the terrain lives
   in the dossier painter. So it REUSES that painter rather than copying it:
   DossierMap.palette() for the board's own colours, DossierMapDraw.ground()
   for sea, land, relief, territory, fighting belts and the line of contact,
   DossierMapDraw.place()/text() for Hebrew labels, and DossierMapRelief for the
   overview frame's relief picture, which already covers every corridor. Only
   the projection formula is restated here, because DossierMap.project() is
   keyed on a dossier map id and this map is not one; it is the same
   equirectangular projection with a cos(mid-latitude) correction.

   Painted text is Hebrew and digits only (the build refuses Latin in the two
   painted fields, name_he and unit_he).

     window.RoadsMap = {
       draw(canvas, cssWidth, state),          // state {layer, win, selected}
       exportPng(width, height, state),        // -> PNG data URL
       hit(canvas, x, y),                      // corridor key under a CSS point, or ""
       attacksIn(corridor, win),               // the corridor's attacks in the window
       legend(state), LAYERS, ready()
     }

   No ES modules - the page runs from file://. */
"use strict";

var RoadsMap = (function () {
  var BASE_W = 1280, ASPECT = 16 / 9, TS_SCREEN = 1.15, TS_SLIDE = 1.5;
  /* The frame: every corridor with room round it - Hodeidah on the west coast
     to al-Ghaydah in al-Mahrah. Inside the overview frame's relief raster
     (41.0-55.3E, 11.6-20.4N), so no new terrain picture is needed. */
  var FRAME = { lat: [12.4, 18.2], lonMid: 47.6 };
  var RELIEF_MAP = { frame: "overview", ground: "relief" };
  var LAYERS = ["attacks", "status", "control", "importance", "flows"];
  var STATE_HE = { open: "פתוח", closed: "סגור", frontline: "קו חזית", reopened: "נפתח מחדש" };
  var HOLDER_HE = { houthi: "בשליטת החות'ים", government: "בשליטת הכוחות הלגיטימיים",
                    none: "מחוץ לשטח תימן" };
  var last = new WeakMap();

  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function colours() {
    return {
      open: css("--v-confirmed", "#4ADE80"), closed: css("--v-denied", "#F87171"),
      frontline: css("--v-partial", "#FB923C"), reopened: css("--f-ships", "#5EEAD4"),
      fire: css("--geo-front-mark", "#FF2D20"), warm: css("--v-partial", "#FB923C"),
      hot: css("--v-denied", "#F87171"), gold: css("--f-saudi", "#F5C445"),
      flow: css("--f-ships", "#5EEAD4"), quiet: css("--v-none", "#8FA3B8"),
      /* The board's two territory colours at full strength: its fills are a
         light wash (Houthi-held) and a dark wash (government-held), so a road
         stretch is a light line or a dark line in a light casing. */
      houthi: "#E9F0F8", gov: "#061424"
    };
  }

  function roads() { return (typeof ROADS !== "undefined" && ROADS) ? ROADS : null; }
  function network() { return (typeof ROADS_GEO !== "undefined" && ROADS_GEO) ? ROADS_GEO : null; }
  function geo() { return (typeof GEO !== "undefined" && GEO) ? GEO : null; }

  function projector(W, H) {
    var latMid = (FRAME.lat[0] + FRAME.lat[1]) / 2;
    var k = Math.cos(latMid * Math.PI / 180), s = H / (FRAME.lat[1] - FRAME.lat[0]);
    return function (lon, lat) {
      return [W / 2 + (lon - FRAME.lonMid) * k * s, H / 2 - (lat - latMid) * s];
    };
  }

  /* The window follows the board's own week: filters.js's weekStart() is the one
     place Ziv's Tuesday is written, so this reads it rather than restating it. */
  function attacksIn(c, win) {
    var list = (c && c.attacks) || [];
    if (win !== "week") return list;
    var from = typeof weekStart === "function" ? weekStart() : "";
    return list.filter(function (a) { return !from || a.date >= from; });
  }
  function latest(c) {
    var s = (c.status || []);
    return s.length ? s[s.length - 1] : null;
  }

  function flatPath(ctx, p, flat) {
    for (var i = 0; i + 1 < flat.length; i += 2) {
      var q = p(flat[i], flat[i + 1]);
      if (i === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
    }
  }
  function stroke(ctx, p, flat, colour, w, dash) {
    ctx.beginPath(); flatPath(ctx, p, flat);
    ctx.strokeStyle = colour; ctx.lineWidth = w;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
  }

  /* ---- layers -------------------------------------------------------------- */

  function attackColour(C, n) {
    if (!n) return C.quiet;
    if (n <= 2) return C.warm;
    if (n <= 5) return C.hot;
    return C.fire;
  }
  function paintCorridor(ctx, p, P, C, u, c, state) {
    var w = Math.max(3.5, 6 * u), layer = state.layer;
    var dim = state.selected && state.selected !== c.key;
    ctx.globalAlpha = dim ? 0.4 : 1;
    /* Casing first: the selected road carries a wide ink outline, every road a
       ground-coloured one, so a line reads over terrain and territory alike. */
    if (state.selected === c.key) stroke(ctx, p, c.p, P.ink, w + 7 * u);
    else stroke(ctx, p, c.p, P.sea, w + 3 * u);
    if (layer === "control") {
      (c.stretches || []).forEach(function (s) {
        if (s.holder === "government") {
          stroke(ctx, p, s.p, C.houthi, w);
          stroke(ctx, p, s.p, C.gov, Math.max(1.5, w - 3 * u));
        } else {
          stroke(ctx, p, s.p, s.holder === "houthi" ? C.houthi : C.quiet, w);
        }
        if (s.front) stroke(ctx, p, s.p, C.fire, Math.max(2, w * 0.45), [6 * u, 5 * u]);
      });
    } else if (layer === "status") {
      var st = latest(c);
      stroke(ctx, p, c.p, st ? C[st.state] : C.quiet, w,
             st && st.state === "frontline" ? [10 * u, 5 * u] : null);
    } else if (layer === "importance") {
      var sc = (c.importance || {}).score || 1;
      stroke(ctx, p, c.p, C.gold, Math.max(2, (1.5 + sc * 1.6) * u * 1.4));
    } else if (layer === "attacks") {
      stroke(ctx, p, c.p, attackColour(C, attacksIn(c, state.win).length), w);
    } else {
      stroke(ctx, p, c.p, P.muted, Math.max(2.5, 4 * u));
    }
    ctx.globalAlpha = 1;
  }

  function attackMarks(ctx, p, P, C, u, list, state, size) {
    var groups = {}, seen = {};
    list.forEach(function (c) {
      if (state.selected && state.selected !== c.key) return;
      attacksIn(c, state.win).forEach(function (a) {
        /* One attack near two corridors is still one attack. */
        if (seen[a.event_key]) return;
        seen[a.event_key] = true;
        var g = groups[a.place_key] = groups[a.place_key] || { a: a, n: 0 };
        g.n += 1;
      });
    });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k], q = p(g.a.lon, g.a.lat), r = Math.max(9, 11 * u);
      ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
      ctx.fillStyle = C.fire; ctx.fill();
      ctx.lineWidth = Math.max(1.5, 2 * u); ctx.strokeStyle = P.halo; ctx.stroke();
      window.DossierMapDraw.text(ctx, P, String(g.n), q[0], q[1],
        { size: Math.max(11, size * 0.75), weight: 600, halo: 0, color: "#fff" });
    });
  }

  function flowArrows(ctx, p, P, C, u, list, state, size, taken) {
    var R = window.DossierMapDraw, all = [];
    list.forEach(function (c) {
      (c.flows || []).forEach(function (f) { all.push({ f: f, c: c }); });
    });
    var max = {};
    all.forEach(function (o) {
      if (typeof o.f.amount === "number") {
        max[o.f.unit_he] = Math.max(max[o.f.unit_he] || 0, o.f.amount);
      }
    });
    var seen = {};
    all.forEach(function (o) {
      var f = o.f, pair = f.from + ">" + f.to;
      var nth = seen[pair] = (seen[pair] || 0) + 1;
      var a = p(f.a[0], f.a[1]), b = p(f.b[0], f.b[1]);
      var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      var bend = (0.12 + 0.08 * (nth - 1)) * len;
      var cx = (a[0] + b[0]) / 2 - dy / len * bend, cy = (a[1] + b[1]) / 2 + dx / len * bend;
      var known = typeof f.amount === "number";
      var w = known ? (3 + 9 * Math.sqrt(f.amount / max[f.unit_he])) * u : 3 * u;
      w = Math.max(2.5, w);
      var dim = state.selected && state.selected !== o.c.key;
      ctx.globalAlpha = dim ? 0.35 : 1;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(cx, cy, b[0], b[1]);
      ctx.strokeStyle = C.flow; ctx.lineWidth = w; ctx.lineCap = "round";
      ctx.setLineDash(known ? [] : [8 * u, 6 * u]); ctx.stroke(); ctx.setLineDash([]);
      /* The head points along the curve's last tangent, at the destination. */
      var tx = b[0] - cx, ty = b[1] - cy, tl = Math.hypot(tx, ty) || 1;
      var hx = tx / tl, hy = ty / tl, hs = Math.max(9, w * 2.4 + 6 * u);
      ctx.beginPath(); ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - hx * hs - hy * hs * 0.55, b[1] - hy * hs + hx * hs * 0.55);
      ctx.lineTo(b[0] - hx * hs + hy * hs * 0.55, b[1] - hy * hs - hx * hs * 0.55);
      ctx.closePath(); ctx.fillStyle = C.flow; ctx.fill();
      /* The label sits off the arc's crown, on its outer side, so it neither
         covers the arrow nor lands on the road the arrow runs beside. */
      var mx = 0.25 * a[0] + 0.5 * cx + 0.25 * b[0] - dy / len * size * 0.9;
      var my = 0.25 * a[1] + 0.5 * cy + 0.25 * b[1] + dx / len * size * 0.9;
      var label = known ? Number(f.amount).toLocaleString("he-IL") + " " + f.unit_he
        : "אין נתון";
      R.text(ctx, P, label, mx, my, { size: size * 0.85, weight: 600, halo: 4 * u,
                                       color: P.ink });
      var half = R.width(ctx, label, size * 0.85, 600) / 2;
      taken.push({ x0: mx - half, y0: my - size * 0.6, x1: mx + half, y1: my + size * 0.6 });
      ctx.globalAlpha = 1;
    });
  }

  function placeLabels(ctx, p, P, u, W, H, list, state, size, taken) {
    var R = window.DossierMapDraw, done = {};
    var pinR = Math.max(3, 3.4 * u);
    list.forEach(function (c) {
      (c.waypoints || []).forEach(function (wp) {
        if (done[wp.key]) return;
        done[wp.key] = true;
        var q = p(wp.lon, wp.lat);
        ctx.beginPath(); ctx.arc(q[0], q[1], pinR + 1.5 * u, 0, Math.PI * 2);
        ctx.fillStyle = P.halo; ctx.fill();
        ctx.beginPath(); ctx.arc(q[0], q[1], pinR, 0, Math.PI * 2);
        ctx.fillStyle = P.ink; ctx.fill();
        ["n", "s", "e", "w"].some(function (anchor) {
          var o = R.place(ctx, wp.he, q[0], q[1], anchor, size, pinR, u, W, H);
          if (taken.some(function (t) { return R.overlaps(o.box, t); })) return false;
          taken.push(o.box);
          R.text(ctx, P, o.str, o.x, o.y, { size: size, weight: 600, halo: 4 * u,
                                             align: o.align, baseline: o.baseline });
          return true;
        });
      });
    });
    /* The corridor's own name, at the middle of its line: every road on a wide
       canvas, only the selected one on a narrow one. */
    list.forEach(function (c) {
      if (W < 700 && state.selected !== c.key) return;
      var n = c.p.length / 2, i = Math.floor(n / 2) * 2, q = p(c.p[i], c.p[i + 1]);
      ["s", "n", "e", "w"].some(function (anchor) {
        var o = R.place(ctx, c.name_he, q[0], q[1], anchor, size * 0.95, 14 * u, u, W, H);
        if (taken.some(function (t) { return R.overlaps(o.box, t); })) return false;
        taken.push(o.box);
        R.text(ctx, P, o.str, o.x, o.y, { size: size * 0.95, weight: 500, halo: 4 * u,
                                           align: o.align, baseline: o.baseline,
                                           color: P.muted });
        return true;
      });
    });
  }

  /* ---- the picture ----------------------------------------------------------- */

  function paint(ctx, W, H, ts, state) {
    var R = window.DossierMapDraw, D = roads(), G = geo(), N = network();
    var P = window.DossierMap.palette("dark"), C = colours(), u = W / BASE_W;
    ctx.direction = "rtl";
    var p = projector(W, H);
    var list = (D && D.corridors) || [];
    var opt = (window.DossierMapRelief && window.DossierMapRelief.optFor(
      RELIEF_MAP, "dark", "plain")) || {};
    /* The war is drawn only on the control layer - on the other four it is a
       different question, and the territory wash would sit under every colour. */
    opt.clean = state.layer !== "control";
    if (!G) { ctx.fillStyle = P.sea; ctx.fillRect(0, 0, W, H); return p; }
    R.ground(ctx, p, P, u, W, H, G, opt);
    if (N) {
      ctx.beginPath();
      N.lines.forEach(function (l) { if (l.c !== "s") flatPath(ctx, p, l.p); });
      ctx.strokeStyle = P.faint; ctx.lineWidth = Math.max(0.8, 1.1 * u); ctx.stroke();
      ctx.beginPath();
      N.lines.forEach(function (l) { if (l.c === "s") flatPath(ctx, p, l.p); });
      ctx.globalAlpha = 0.6; ctx.lineWidth = Math.max(0.5, 0.7 * u); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    var size = Math.max(15, 16 * u * ts), taken = [];
    list.forEach(function (c) { if (c.key !== state.selected) paintCorridor(ctx, p, P, C, u, c, state); });
    list.forEach(function (c) { if (c.key === state.selected) paintCorridor(ctx, p, P, C, u, c, state); });
    if (state.layer === "attacks") attackMarks(ctx, p, P, C, u, list, state, size);
    if (state.layer === "flows") flowArrows(ctx, p, P, C, u, list, state, size, taken);
    placeLabels(ctx, p, P, u, W, H, list, state, size, taken);
    return p;
  }

  function draw(canvas, cssWidth, state) {
    var W = Math.max(1, Math.round(cssWidth)), H = Math.round(W / ASPECT);
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var p = paint(ctx, W, H, TS_SCREEN, state);
    last.set(canvas, { p: p, W: W });
  }

  function exportPng(width, height, state) {
    var c = document.createElement("canvas");
    c.width = Math.round(width); c.height = Math.round(height);
    paint(c.getContext("2d"), c.width, c.height, TS_SLIDE, state);
    return c.toDataURL("image/png");
  }

  /* The corridor nearest a CSS point on the canvas, within a finger's reach. */
  function hit(canvas, x, y) {
    var m = last.get(canvas), D = roads();
    if (!m || !D) return "";
    var best = "", bestD = Math.max(14, m.W / 60);
    (D.corridors || []).forEach(function (c) {
      for (var i = 0; i + 3 < c.p.length; i += 2) {
        var a = m.p(c.p[i], c.p[i + 1]), b = m.p(c.p[i + 2], c.p[i + 3]);
        var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
        var t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0;
        var d = Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
        if (d < bestD) { bestD = d; best = c.key; }
      }
    });
    return best;
  }

  function ready() {
    return window.DossierMap ? window.DossierMap.ready("dark") : Promise.resolve(false);
  }

  /* The key under the map, per layer: [{colour, dash, label}]. HTML, not
     painted - a phone-width canvas has no room for it. */
  function legend(state) {
    var C = colours(), rows = [];
    if (state.layer === "attacks") {
      rows = [{ c: C.quiet, l: "אין פיגועים ליד הכביש" }, { c: C.warm, l: "1-2 פיגועים" },
              { c: C.hot, l: "3-5 פיגועים" }, { c: C.fire, l: "6 פיגועים ומעלה" },
              { c: C.fire, dot: true, l: "מקום הפיגוע ומספר הפיגועים בו" }];
    } else if (state.layer === "status") {
      rows = ["open", "reopened", "frontline", "closed"].map(function (s) {
        return { c: C[s], dash: s === "frontline", l: STATE_HE[s] };
      });
    } else if (state.layer === "control") {
      rows = [{ c: C.houthi, l: HOLDER_HE.houthi },
              { c: C.gov, ring: C.houthi, l: HOLDER_HE.government },
              { c: C.fire, dash: true, l: "עובר באזור לחימה פעיל" }];
    } else if (state.layer === "importance") {
      rows = [{ c: C.gold, w: 3, l: "חשיבות 1 - קו דק" }, { c: C.gold, w: 10, l: "חשיבות 5 - קו עבה" }];
    } else {
      rows = [{ c: C.flow, l: "זרימה בין ערים - עובי לפי הכמות שפורסמה" },
              { c: C.flow, dash: true, l: "אין נתון כמות מפורסם" }];
    }
    rows.push({ c: "rgba(143,163,184,0.7)", w: 1.5, l: "כביש ראשי" });
    return rows;
  }

  return { draw: draw, exportPng: exportPng, hit: hit, attacksIn: attacksIn,
           latest: latest, legend: legend, ready: ready, LAYERS: LAYERS,
           STATE_HE: STATE_HE, HOLDER_HE: HOLDER_HE };
})();

window.RoadsMap = RoadsMap;
