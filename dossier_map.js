/* The two static maps of the dossier tab (רקע ומשמעויות), painted on a canvas
   from GEO (the board's own geography) plus DOSSIER (the gains layer, the lanes
   and the hand-anchored labels). The same painter serves the screen and the
   PowerPoint: exportPng() paints an offscreen canvas at slide resolution, so the
   deck carries exactly what the tab shows, legend included.

   NO ES modules - the page runs from file://. One global:

     window.DossierMap = {
       draw(canvas, mapId, theme, cssWidth),      // paints in place, frame's aspect
       exportPng(mapId, theme, width, height),    // -> PNG data URL
       frame(mapId, width, height),               // effective lon/lat extents
       aspect(mapId)                              // the frame's width / height
     }

   mapId is "overview" | "mandab"; theme is "dark" | "light". Pure function of
   DOSSIER + GEO + theme: the only DOM it touches is the canvas it is handed and
   the :root tokens of style.css (the dark palette is READ from them, never
   written here; the light palette has no tokens on the board and is authored
   below). The layer painters live in dossier_map_draw.js (`DossierMapDraw`),
   looked up at paint time so the two files may load in either order. Every
   string painted is Hebrew - the build refuses Latin in any map string, and the
   test that ships with this file scans what is painted.

   Frames are given as a latitude range and a longitude centre; the longitude
   span FOLLOWS from the canvas aspect through an equirectangular projection
   with a cos(mid-latitude) correction, so any canvas shows the whole latitude
   range and only more or less longitude. Each frame has its own shape on
   screen: the overview 16:9 (lon 41.13-55.17 / lat 12.0-19.6; the floor is
   12.0 so Socotra sits wholly under the legend box), the close-up 3:2 (lon
   41.34-45.36 / lat 12.32-14.92). The slide export is always 16:9, so there
   the close-up gains longitude on both sides (40.97-45.73) and nothing in the
   middle moves. The close-up was cut to that on Ziv's ask (2026-09-11):
   Hodeidah at the top, the facing African shore on the left, Aden on the
   right. The first cut reached 15.65N and 46.01E and read as a small map in a
   lot of ground the story never touches. */
"use strict";

var DossierMap = (function () {
  var BASE_W = 1280;                 /* the CSS width every size is written for */
  var FRAMES = {
    overview: { lat: [12.0, 19.6], lonMid: 48.15, aspect: 16 / 9, legend: "bottom" },
    /* The legend sits TOP-right here: bottom-right is Aden. */
    mandab:   { lat: [12.32, 14.92], lonMid: 43.35, aspect: 3 / 2, legend: "top" }
  };
  /* Text grows with the canvas (u = W / BASE_W) and then by this factor: a
     little on screen, half again on a slide, which is read from across a room
     and is nothing but this picture. */
  var TEXT_SCREEN = 1.15, TEXT_SLIDE = 1.5;
  var OPPOSITE = { e: "w", w: "e", n: "s", s: "n" };
  /* The board's own legend words, so the painted legend matches the one under
     the map on the board tab. */
  var WORDS = {
    houthi: "שטח בשליטת החות'ים",
    /* The government side's name and the fighting zone's name are Ziv's own
       words (2026-09-11), here and on the board's legend alike. */
    gov: "שטח בשליטת הכוחות הלגיטימיים",
    contested: "שטח לחימה פעיל",
    /* ONE row for every gain, confirmed or not (Ziv, 2026-09-11). Which ones an
       outside source confirmed is said in the text, never by a second style. */
    gained: "נכבש בידי החות'ים (מאומת + משוער)",
    /* WHEN, not how sure - the one split the map is allowed to draw on top of
       the gains (Ziv, 2026-09-12). A day is the finest window the record can
       carry: its dates have no time of day. */
    fresh: "נכבש ביממה האחרונה",
    front: "קו חזית משוער",
    lane: "נתיב שיט",
    noData: "אין נתוני מפה להצגה"
  };
  /* The light deck has no tokens on the board (dark is the board's only theme),
     so its palette is authored here. Territory is told apart by lightness AND
     temperature - Houthi ground a warm grey, government a cool one, the sea a
     clear blue-grey - because three light tints can never sit 3:1 apart from
     one another; measured, houthi/sea 1.4:1, gov/sea 1.2:1. What does hold
     3:1 is every line and mark on them: the darkened violet #5B4BC4 measures
     6.5:1 on the land and 5.2:1 on the sea, the ink 12:1 and better. The fill
     under the violet stroke keeps the board's own #B7A5F7, so captured ground
     reads as the same colour in both decks. */
  var LIGHT = {
    sea: "#C9DAEA", land: "#F4F7FA",
    houthi: "#C6BCAE", gov: "#E3E8ED", contested: "#EEF1F4",
    contestedStroke: "#7F8B98", adm1: "rgba(20, 40, 60, 0.20)",
    border: "#33445A", borderW: 2, control: "#1F2D3D", controlW: 2, controlDash: "6 4",
    ink: "#14202C", muted: "#3A4A5A", faint: "#5A6876", govLabel: "#4A5A6A",
    halo: "rgba(255, 255, 255, 0.92)", violet: "#5B4BC4", violetFill: "#B7A5F7",
    lane: "#4A5A6A", box: "#FFFFFF", boxLine: "rgba(20, 40, 60, 0.30)"
  };

  /* ---- tokens ------------------------------------------------------------------- */

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function cssNum(name, fallback) {
    var n = parseFloat(cssVar(name));
    return isFinite(n) ? n : fallback;
  }
  function painters() {
    if (!window.DossierMapDraw) throw new Error("dossier_map: dossier_map_draw.js is not on the page");
    return window.DossierMapDraw;
  }

  function palette(theme) {
    if (theme === "light") return LIGHT;
    var sea = cssVar("--map-bg");
    if (!sea) throw new Error("dossier_map: style.css tokens are not on the page");
    var ink = cssVar("--ink");
    return {
      sea: sea,
      /* Land is a step above the sea. --surface-2 alone is too close: with the
         government fill (a dark wash) on top it lands back on the sea colour and
         the west coast reads as water with an outline. Lifting the land a tenth
         of the way to the ink keeps government ground a visible step above the
         sea, contested a step above that, and Houthi ground a step above all -
         and the coastline itself is the border stroke, as on the board. */
      land: painters().mix(cssVar("--surface-2"), ink, 0.10),
      houthi: cssVar("--geo-fill-houthi"), gov: cssVar("--geo-fill-gov"),
      contested: cssVar("--geo-fill-contested"),
      contestedStroke: cssVar("--geo-contested-stroke"),
      adm1: cssVar("--geo-gov-line"),
      border: cssVar("--geo-border"), borderW: cssNum("--geo-border-w", 2.5),
      control: cssVar("--geo-control-line"), controlW: cssNum("--geo-control-w", 2),
      controlDash: cssVar("--geo-control-dash") || "6 4",
      ink: ink, muted: cssVar("--ink-muted"), faint: cssVar("--ink-faint"),
      govLabel: cssVar("--gov-label"), halo: cssVar("--map-halo"),
      violet: cssVar("--f-internal"), violetFill: cssVar("--f-internal"),
      lane: cssVar("--ink-faint"), box: cssVar("--surface"), boxLine: cssVar("--line-strong")
    };
  }

  /* ---- projection ----------------------------------------------------------- */

  function projector(frame, W, H) {
    var latMid = (frame.lat[0] + frame.lat[1]) / 2;
    var k = Math.cos(latMid * Math.PI / 180);
    var s = H / (frame.lat[1] - frame.lat[0]);
    var p = function (lon, lat) {
      return [W / 2 + (lon - frame.lonMid) * k * s, H / 2 - (lat - latMid) * s];
    };
    var half = W / 2 / (k * s);
    p.extent = { lon: [frame.lonMid - half, frame.lonMid + half], lat: frame.lat.slice() };
    p.inside = function (lon, lat, pad) {
      var d = pad || 0;
      return lon >= p.extent.lon[0] - d && lon <= p.extent.lon[1] + d &&
             lat >= frame.lat[0] - d && lat <= frame.lat[1] + d;
    };
    return p;
  }

  function geo() { return (typeof GEO !== "undefined" && GEO) ? GEO : null; }
  function dossier() { return (typeof DOSSIER !== "undefined" && DOSSIER) ? DOSSIER : null; }

  /* ---- the picture ----------------------------------------------------------- */

  function paint(ctx, mapId, theme, W, H, ts) {
    var R = painters(), P = palette(theme), G = geo(), D = dossier(), u = W / BASE_W;
    var map = D && (D.maps || []).filter(function (m) { return m.id === mapId; })[0];
    ctx.direction = "rtl";
    if (!G || !D || !map || !FRAMES[mapId]) {
      ctx.fillStyle = P.sea; ctx.fillRect(0, 0, W, H);
      R.text(ctx, P, WORDS.noData, W / 2, H / 2, { size: Math.max(20, 22 * u), weight: 600, halo: 0 });
      return;
    }
    var F = FRAMES[mapId], p = projector(F, W, H);
    /* 17px is the reading floor on screen; everything grows with the canvas
       and nothing shrinks below it, so a narrow canvas drops tier-2 labels
       instead of shrinking them. */
    var size = Math.max(17, 17 * u * ts), titleSize = Math.max(20, 22 * u * ts);
    R.ground(ctx, p, P, u, W, H, G);
    R.gains(ctx, p, P, u, D, G, mapId);
    /* Labels: the dossier's own first (they are the point of the map), then the
       lane names and the governorate names fitted around them and around the
       legend box, which is measured now and painted last. A label whose place
       is not a gain gets a small dot, so the name is anchored to something. */
    var gainKeys = {};
    (D.gains || []).forEach(function (g) { gainKeys[g.place_key] = true; });
    /* Under 800px the legend box (17px rows, six of them) would cover a
       third of the map and squeeze the strait's name off the close-up
       (measured at 700px), so it is left to the HTML legend the view prints
       under the canvas; the export is always wider and always carries it. */
    var title = map.title_he || "", titleW = R.width(ctx, title, titleSize, 600);
    var titleBottom = 16 * u + titleSize * 1.3;
    var legend = W >= 800
      ? R.legendLayout(ctx, P, u, W, H, !!(map.lanes && map.lanes.length), WORDS,
          { size: size, top: F.legend === "top" ? titleBottom + 10 * u : null,
            fresh: (D.gains || []).some(function (g) { return g.fresh; }) }) : null;
    var taken = [{ x0: W - 28 * u - titleW, y0: 0, x1: W, y1: titleBottom }];
    if (legend) taken.push(legend.box);
    /* A label keeps its authored side while that side is free; when two names
       would overprint (measured at 600px: Perim over Aden) it tries the other
       sides, and if none is free it is DROPPED - a name nobody can read is
       worse than a mark with its name in the list under the map. */
    var labels = [];
    (map.labels || []).forEach(function (l) {
      if ((W < 700 && l.tier === 2) || !p.inside(l.lon, l.lat, 0)) return;
      var q = p(l.lon, l.lat), isGain = !!gainKeys[l.place], spec = null;
      /* Anchor "c" names a country: centred on its point, no dot, in the
         quieter governorate ink, and dropped rather than moved or cut. */
      var quiet = l.anchor === "c";
      (quiet ? ["c"] : [l.anchor, OPPOSITE[l.anchor], "n", "s", "e", "w"]).some(function (a) {
        var s = R.place(ctx, l.he, q[0], q[1], a, size, (isGain ? 7 : 3) * u, u, W, H);
        var b = s.box, free = !taken.some(function (t) { return R.overlaps(b, t); }) &&
          (!quiet || (b.x0 >= 0 && b.x1 <= W && b.y0 >= 0 && b.y1 <= H));
        if (free) spec = s;
        return free;
      });
      if (!spec) return;
      if (!isGain && !quiet) R.ringMark(ctx, q[0], q[1], 3 * u, { fill: P.muted });
      taken.push(spec.box);
      labels.push({ pt: q, spec: spec, quiet: quiet });
    });
    var points = labels.map(function (l) { return { q: l.pt, he: l.spec.str }; });
    R.lanes(ctx, p, P, u, W, H, map.lanes, size, taken, legend && legend.box);
    if (mapId === "overview") R.govLabels(ctx, p, P, u, G, size, taken, points);
    labels.forEach(function (l) {
      var s = l.spec;
      R.text(ctx, P, s.str, s.x, s.y, { size: s.size, weight: l.quiet ? 500 : 600,
        halo: 3 * u, align: s.align, baseline: s.baseline, color: l.quiet ? P.govLabel : null });
    });
    R.text(ctx, P, title, W - 16 * u, 16 * u, { size: titleSize, weight: 600,
      halo: 4 * u, align: "right", baseline: "top" });
    if (legend) R.paintLegend(ctx, P, u, legend);
  }

  /* Heebo is a web font: a canvas painted before it arrives is set in the
     fallback face. Paint anyway (the page is never blank), then paint once more
     when the face lands. */
  var pending = [];
  function fontReady() {
    return !document.fonts || document.fonts.check("600 17px Heebo");
  }
  function repaintWhenLoaded() {
    if (!document.fonts || !pending.length) return;
    document.fonts.load("600 17px Heebo").then(function () {
      var again = pending; pending = [];
      again.forEach(function (a) { draw(a.canvas, a.mapId, a.theme, a.cssWidth); });
    }, function () { pending = []; });
  }

  function aspect(mapId) { return FRAMES[mapId] ? FRAMES[mapId].aspect : 16 / 9; }

  function draw(canvas, mapId, theme, cssWidth) {
    var W = Math.max(1, Math.round(cssWidth)), H = Math.round(W / aspect(mapId));
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx, mapId, theme, W, H, TEXT_SCREEN);
    if (!fontReady()) {
      pending = pending.filter(function (a) { return a.canvas !== canvas; });
      pending.push({ canvas: canvas, mapId: mapId, theme: theme, cssWidth: cssWidth });
      repaintWhenLoaded();
    }
  }

  function exportPng(mapId, theme, width, height) {
    var c = document.createElement("canvas");
    c.width = Math.round(width); c.height = Math.round(height);
    paint(c.getContext("2d"), mapId, theme, c.width, c.height, TEXT_SLIDE);
    return c.toDataURL("image/png");
  }

  function frame(mapId, width, height) {
    if (!FRAMES[mapId]) return null;
    return projector(FRAMES[mapId], width || BASE_W, height || BASE_W / aspect(mapId)).extent;
  }

  return { draw: draw, exportPng: exportPng, frame: frame, aspect: aspect };
})();

window.DossierMap = DossierMap;
