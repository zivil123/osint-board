/* The roads map (the כבישים tab): Yemen's main road network on the terrain,
   the key corridors over it, the line of contact over everything, and six ways
   to colour them.

   RULE (Ziv, 2026-09-17): a score is shown by COLOUR, never by line width. Every
   key corridor is one fixed width on every layer; importance and the fighting
   score each carry a colour scale with a legend. The flow arrows are the one
   width that varies, and only because each carries its tonnage written beside it.

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
     to Shehen on the Oman border (its road north of Thamud reaches 18.24N). Inside the overview frame's relief raster
     (41.0-55.3E, 11.6-20.4N), so no new terrain picture is needed. */
  var FRAME = { lat: [12.1, 18.5], lonMid: 47.6 };
  var RELIEF_MAP = { frame: "overview", ground: "relief" };
  var LAYERS = ["fighting", "attacks", "status", "control", "importance", "flows"];
  var BANDS = ["low", "active", "heavy"];
  var BAND_HE = { quiet: "שקט", low: "נמוך", active: "פעיל", heavy: "כבד" };
  /* Importance 1-5 as a stepped scale, slate - blue - gold - orange - magenta, so
     neighbouring scores stay apart at half scale; none is a fighting colour. */
  var IMP = ["#6B7A8F", "#7FB3D5", "#F5C445", "#F28C28", "#E0457B"];
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
      houthi: "#E9F0F8", gov: "#061424",
      low: "#FDE68A", active: css("--v-partial", "#FB923C"),
      heavy: css("--geo-front-mark", "#FF2D20")
    };
  }

  function day(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? m[3] + "." + m[2] + "." + m[1] : (iso || "");
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
      var sc = Math.max(1, Math.min(5, (c.importance || {}).score || 1));
      stroke(ctx, p, c.p, IMP[sc - 1], w);
    } else if (layer === "attacks") {
      stroke(ctx, p, c.p, attackColour(C, attacksIn(c, state.win).length), w);
    } else {
      stroke(ctx, p, c.p, P.muted, Math.max(2.5, 4 * u));
    }
    ctx.globalAlpha = 1;
  }

  /* The fighting layer: every scored stretch of the whole network, coloured by
     band, one width; the entry picked in the busiest list gets an ink casing and
     every listed stretch its rank number. */
  function slice(N, i, v0, v1) {
    return ((N.lines[i] || {}).p || []).slice(2 * v0, 2 * v1 + 2);
  }
  function paintFighting(ctx, p, P, C, u, N, F, state) {
    var w = Math.max(4, 6.5 * u);
    var hot = F.top[state.hot === "" ? -1 : Number(state.hot)];
    if (hot) stroke(ctx, p, slice(N, hot.i, hot.v0, hot.v1), P.ink, w + 8 * u);
    BANDS.forEach(function (b) {
      F.pieces.forEach(function (q) {
        if (q[3] !== b) return;
        var flat = slice(N, q[0], q[1], q[2]);
        stroke(ctx, p, flat, P.sea, w + 2.5 * u);
        stroke(ctx, p, flat, C[b], w);
      });
    });
  }
  function rankMarks(ctx, p, P, u, N, F, state) {
    F.top.forEach(function (r, k) {
      var flat = slice(N, r.i, r.v0, r.v1), m = 2 * Math.floor(flat.length / 4);
      var q = p(flat[m], flat[m + 1]), rad = Math.max(10, 13 * u);
      var on = String(k) === String(state.hot);
      ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, Math.PI * 2);
      ctx.fillStyle = on ? P.ink : P.sea; ctx.fill();
      ctx.lineWidth = Math.max(2, 2.2 * u); ctx.strokeStyle = P.ink; ctx.stroke();
      ctx.font = "700 " + Math.round(Math.max(12, rad * 1.2)) + "px Heebo, Segoe UI, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = on ? P.sea : P.ink; ctx.fillText(String(k + 1), q[0], q[1] + rad * 0.06);
    });
  }
  /* The line of contact, the board's own GEO.control_line in the board's own
     style (light dashes), over every road on every layer, on a dark casing so it
     reads across a light road. */
  function contactLine(ctx, p, P, u, G) {
    var feats = (G.control_line && G.control_line.features) || [];
    ctx.beginPath();
    feats.forEach(function (f) {
      var g = f.geometry || {};
      var parts = g.type === "LineString" ? [g.coordinates] :
        g.type === "MultiLineString" ? g.coordinates : [];
      parts.forEach(function (line) {
        line.forEach(function (c, i) {
          var q = p(c[0], c[1]);
          if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
        });
      });
    });
    var cw = Math.max(1.8, (P.controlW || 2) * 1.2 * u);
    ctx.lineJoin = "round"; ctx.lineCap = "butt";
    ctx.strokeStyle = "rgba(6,20,36,0.85)"; ctx.lineWidth = cw + 2.5 * u; ctx.stroke();
    var dash = String(P.controlDash || "6 4").split(/[ ,]+/).map(function (d) {
      return Number(d) * 1.3 * u;
    });
    ctx.setLineDash(dash); ctx.strokeStyle = P.control || "#E6EDF5"; ctx.lineWidth = cw;
    ctx.stroke(); ctx.setLineDash([]);
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
    var F = D && D.fighting;
    if (state.layer === "fighting" && N && F) paintFighting(ctx, p, P, C, u, N, F, state);
    contactLine(ctx, p, P, u, G);
    var M = window.RoadsMarks;
    var lines = M.samples(p, list), fl = { pending: [], lines: [] };
    if (state.layer === "flows") fl = M.flowArrows(ctx, p, P, C, u, list, state, size, lines);
    var all = lines.concat(fl.lines);
    M.placeLabels(ctx, p, P, u, W, H, list, state, size, taken, lines);
    /* Figures before corridor names, so a name gives way to a figure. */
    M.flowLabels(ctx, P, u, W, H, fl.pending, size, taken, all);
    M.corridorLabels(ctx, P, u, W, H, list, state, size, taken, all);
    /* Last, so a count is never under a name. */
    if (state.layer === "attacks") M.attackMarks(ctx, p, P, C, u, list, state, size);
    if (state.layer === "fighting" && N && F) rankMarks(ctx, p, P, u, N, F, state);
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
    last.set(canvas, { p: p, W: W, layer: state.layer });
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
    var best = "", bestD = Math.max(14, m.W / 60), N = network();
    /* On the fighting layer a listed stretch answers first, as "top:<rank-1>". */
    var items = (D.corridors || []).map(function (c) { return { key: c.key, p: c.p }; });
    if (m.layer === "fighting" && D.fighting && N) {
      items = D.fighting.top.map(function (r, k) {
        return { key: "top:" + k, p: slice(N, r.i, r.v0, r.v1) };
      }).concat(items);
    }
    items.forEach(function (c) {
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
    var C = colours(), rows = [], D = roads() || {}, F = D.fighting;
    var P = window.DossierMap ? window.DossierMap.palette("dark") : {};
    if (state.layer === "fighting") {
      rows = [{ c: P.faint || "#8FA3B8", w: 2, l: BAND_HE.quiet + " (0)" },
              { c: C.low, l: BAND_HE.low + " (1-2)" }, { c: C.active, l: BAND_HE.active + " (3-5)" },
              { c: C.heavy, l: BAND_HE.heavy + " (6 ומעלה)" },
              { note: true, l: "ניקוד לכל קטע כביש: פיגוע ב-7 הימים 3, פיגוע ב-30 הימים 1, " +
                "באזור לחימה 2, חוצה את קו המגע 1. פיגוע נספר עד 10 ק\"מ מהכביש." }];
      if (F) {
        rows.push({ note: true, l: "הימים נספרים אחורה מהפיגוע האחרון בנתונים, " +
          day(F.anchor) + " - לא מהיום, כדי שעדכון מאוחר לא ייראה כשקט." });
      }
    } else if (state.layer === "attacks") {
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
      rows = IMP.map(function (c, k) { return { c: c, l: "חשיבות " + (k + 1) + " מתוך 5" }; });
    } else {
      rows = [{ c: C.flow, l: "זרימה בין ערים - עובי לפי הכמות שפורסמה" },
              { c: C.flow, dash: true, l: "לא פורסמה כמות - החץ אומר מה עובר" }];
    }
    rows.push({ c: "rgba(143,163,184,0.7)", w: 1.5, l: "כביש ראשי" });
    rows.push({ c: P.control || "#E6EDF5", w: 2, dash: true,
                l: "קו המגע" + (D.control_as_of ? ", נכון ל-" + day(D.control_as_of) : "") });
    return rows;
  }

  return { draw: draw, exportPng: exportPng, hit: hit, attacksIn: attacksIn,
           latest: latest, legend: legend, ready: ready, LAYERS: LAYERS,
           STATE_HE: STATE_HE, HOLDER_HE: HOLDER_HE, BAND_HE: BAND_HE, day: day };
})();

window.RoadsMap = RoadsMap;
