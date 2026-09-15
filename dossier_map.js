/* The static maps of the dossier tab (מתקפת פתע), painted on a canvas from GEO
   (the board's own geography) plus DOSSIER (the frames, the gains layer, the
   lanes, the hand-anchored labels and the assessed axes). The same painter
   serves the screen and the PowerPoint: exportPng() paints an offscreen canvas
   at slide resolution, so the deck carries exactly what the tab shows, legend
   included.

   NO ES modules - the page runs from file://. One global:

     window.DossierMap = {
       draw(canvas, mapId, theme, cssWidth, variant),   // paints in place
       exportPng(mapId, theme, width, height, variant), // -> PNG data URL
       variantsOf(mapId),        // ["plain", ...] the pictures of this frame
       ready(theme),             // Promise: the theme's relief pictures landed
       frame(mapId, w, h), aspect(mapId), project(mapId, W, H), palette, words
     }

   mapId is any id in DOSSIER.maps ("overview" | "mandab" | "aden"); theme is
   "dark" | "light"; variant is "plain" (or undefined) | "notes" | "relief".
   Pure function of DOSSIER + GEO + theme: the only DOM it touches is the canvas
   it is handed, the :root tokens of style.css (the dark palette is READ from
   them, never written here; the light palette has no tokens on the board and is
   authored below) and the relief images it loads. The layer painters live in
   dossier_map_draw.js, dossier_map_legend.js and dossier_map_extra.js, looked
   up at paint time so the files may load in any order. Every string painted is
   Hebrew - the build refuses Latin in any map string.

   FRAMES ARE AUTHORED, in data\dossier_maps.json, and reach here as
   DOSSIER.frames. A frame is a latitude range and a longitude CENTRE; the
   longitude span FOLLOWS from the canvas aspect through an equirectangular
   projection with a cos(mid-latitude) correction, so any canvas shows the whole
   latitude range and only more or less longitude. That is what lets the same
   frame serve a 640px pane, a 1400px page and a 2560px slide. The rubric -
   what each frame is cut to and why - is in DOSSIER_MAPS.md. */
"use strict";

var DossierMap = (function () {
  var BASE_W = 1280;                 /* the CSS width every size is written for */
  /* Text grows with the canvas (u = W / BASE_W) and then by this factor: a
     little on screen, half again on a slide, which is read from across a room
     and is nothing but this picture. */
  var TEXT_SCREEN = 1.15, TEXT_SLIDE = 1.5;
  /* The smallest step a governorate name keeps above a town name. It exists
     because the frame's `gov` factor grows with the CANVAS and not off the 17px
     reading floor: that floor is there so a name stays legible on a small map,
     and multiplying it handed a phone governorate names a quarter of the map
     wide - measured at 345px, where "ד'מאר" outweighed everything the frame is
     about. Wide canvases reach the frame's own factor; narrow ones keep a step
     and no more. */
  var GOV_MIN = 1.2;
  /* The PIN radius, written for BASE_W and floored the way the 17px text floor
     is: a mark that shrinks with the canvas stops being a mark. Read `place()`
     with it - the name is offset by the pin's own radius plus a gap, so the two
     can never sit on top of each other. 4.2 on the day it was built and 3.0
     since 2026-09-14: see the mark itself, painted below the labels. */
  var PIN_R = 3.0, PIN_MIN = 3;
  /* The territory fills are washed back under the relief picture, on the light
     deck only: the dark palette's fills already carry their own alpha, and an
     opaque fill would erase the terrain it is drawn over. */
  var RELIEF_FADE = 0.66;
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
    front: "קו חזית משוער",
    lane: "נתיב שיט",
    /* The arrow row, and only on a map that carries arrows. It says ASSESSMENT
       in so many words: an arrow on a map reads as a reported movement unless
       the key says otherwise, and nothing here has happened yet. */
    axis: "ציר התקדמות אפשרי (הערכה)",
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
    contestedStroke: "#7F8B98", frontMark: "#E01B0F",
    adm1: "rgba(20, 40, 60, 0.20)",
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
  /* The three painter files under one name, cached once all three are on the
     page. A missing file is named, because "undefined is not a function" out of
     a canvas paint says nothing about which script tag was left out. */
  var PAINTERS = null;
  function painters() {
    if (PAINTERS) return PAINTERS;
    var need = [["dossier_map_draw.js", window.DossierMapDraw],
                ["dossier_map_legend.js", window.DossierMapLegend],
                ["dossier_map_extra.js", window.DossierMapExtra]];
    var missing = need.filter(function (n) { return !n[1]; });
    if (missing.length) {
      throw new Error("dossier_map: " + missing.map(function (n) { return n[0]; })
        .join(", ") + " is not on the page");
    }
    var all = {};
    need.forEach(function (n) {
      Object.keys(n[1]).forEach(function (k) { all[k] = n[1][k]; });
    });
    PAINTERS = all;
    return all;
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
      frontMark: cssVar("--geo-front-mark"),
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

  /* ---- frames, maps and their pictures ---------------------------------------- */

  function mapOf(mapId) {
    var D = dossier();
    return (D && (D.maps || []).filter(function (m) { return m.id === mapId; })[0]) || null;
  }
  function frameOf(mapId) {
    var D = dossier(), m = mapOf(mapId);
    return (D && m && D.frames && D.frames[m.frame]) || null;
  }
  function aspect(mapId) {
    var f = frameOf(mapId);
    return (f && f.aspect && f.aspect[1]) ? f.aspect[0] / f.aspect[1] : 16 / 9;
  }
  /* The pictures this painter can draw for a frame, PLAIN FIRST. The page and
     the deck both ask, so a variant added to the record reaches both without a
     line of code in either. */
  function variantsOf(mapId) {
    var m = mapOf(mapId);
    return ["plain"].concat(Object.keys((m && m.variants) || {}));
  }

  /* ---- the relief pictures ------------------------------------------------------ */

  /* GEO.relief is written by geo_prep.py from relief_prep.py's output: one
     entry per frame, each with its lon/lat bounds, a light and a dark file and
     a content hash to bust the cache with. Nothing here draws until the picture
     for the theme has landed, which is what ready() is for.

     Loaded ONCE per theme and kept: the deck exports every map at 2560 and the
     page redraws on every resize, and re-fetching a 200 KB picture each time
     would make both stutter. */
  var reliefImg = {}, reliefWait = {};

  function reliefMeta() {
    var G = geo();
    return (G && G.relief && typeof G.relief === "object") ? G.relief : null;
  }
  /* Only the frames a map actually asks for terrain on - there is no point
     fetching a picture for a frame no variant draws. */
  function reliefFrames() {
    var D = dossier(), seen = {};
    (D && D.maps || []).forEach(function (m) {
      if (m.frame && m.variants && m.variants.relief) seen[m.frame] = true;
    });
    return Object.keys(seen);
  }
  function loadOne(store, name, file, hash) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { store[name] = img; resolve(); };
      /* A picture that will not load costs the terrain and nothing else: the
         map is painted without it rather than not at all. */
      img.onerror = function () {
        console.warn("dossier_map: the relief picture did not load: " + file);
        resolve();
      };
      img.src = file + (hash ? "?v=" + hash : "");
    });
  }
  /* Resolves when every relief picture this theme needs is in memory - or at
     once when there are none, or when the page is on file://, where an image
     TAINTS the canvas and toDataURL() throws, which would take the whole deck
     down for a background layer. */
  function ready(theme) {
    var key = theme === "light" ? "light" : "dark";
    if (reliefWait[key]) return reliefWait[key];
    var meta = reliefMeta(), names = meta ? reliefFrames() : [];
    if (!names.length || location.protocol === "file:") {
      reliefWait[key] = Promise.resolve(false);
      return reliefWait[key];
    }
    var store = reliefImg[key] = reliefImg[key] || {};
    reliefWait[key] = Promise.all(names.map(function (name) {
      var m = meta[name];
      if (!m || !m.file || !m.file[key]) return Promise.resolve();
      return loadOne(store, name, m.file[key], m.hash && m.hash[key]);
    })).then(function () { return true; });
    return reliefWait[key];
  }
  /* What ground() needs for this map, or null: the picture, where it goes, and
     how far back to wash the territory fills over it. */
  function reliefOpt(map, theme, variant) {
    if (variant !== "relief") return null;
    var key = theme === "light" ? "light" : "dark";
    var meta = reliefMeta(), m = meta && meta[map.frame];
    var img = (reliefImg[key] || {})[map.frame];
    if (!m || !m.bounds || !img) return null;
    return { img: img, bounds: m.bounds, fade: key === "light" ? RELIEF_FADE : 0 };
  }

  /* ---- the picture ----------------------------------------------------------- */

  function noData(ctx, P, R, W, H, u) {
    ctx.fillStyle = P.sea; ctx.fillRect(0, 0, W, H);
    R.text(ctx, P, WORDS.noData, W / 2, H / 2,
      { size: Math.max(20, 22 * u), weight: 600, halo: 0 });
  }

  function paint(ctx, mapId, theme, W, H, ts, variant) {
    var R = painters(), P = palette(theme), G = geo(), D = dossier(), u = W / BASE_W;
    var map = mapOf(mapId), F = frameOf(mapId), kind = variant || "plain";
    ctx.direction = "rtl";
    if (!G || !D || !map || !F) { noData(ctx, P, R, W, H, u); return; }
    var p = projector(F, W, H);
    /* 17px is the reading floor on screen; everything grows with the canvas
       and nothing shrinks below it, so a narrow canvas drops tier-2 labels
       instead of shrinking them. */
    var size = Math.max(17, 17 * u * ts), titleSize = Math.max(20, 22 * u * ts);
    var pinR = Math.max(PIN_MIN, PIN_R * u * ts);
    /* The NOTES picture is the same map with a sentence at every fighting zone,
       so it needs the room: the second-rank place names and the lane's name come
       off, and what is left is the ground, the fronts and what is happening on
       them. Nothing is added that the plain picture does not have. */
    var notesOn = kind === "notes";
    R.ground(ctx, p, P, u, W, H, G, reliefOpt(map, theme, kind));
    R.gains(ctx, p, P, u, D, G, mapId);
    /* Labels: the dossier's own first (they are the point of the map), then the
       lane names and the governorate names fitted around them and around the
       legend box, which is measured now and painted last. Every town and port
       gets a PIN, so the name is anchored to a place and not to a shape; an
       island, the strait and a country name carry the name alone. */
    var gainKeys = {};
    (D.gains || []).forEach(function (g) { gainKeys[g.place_key] = true; });
    /* Under 800px the legend box (17px rows, six of them) would cover a
       third of the map and squeeze the strait's name off the close-up
       (measured at 700px), so it is left to the HTML legend the view prints
       under the canvas; the export is always wider and always carries it. */
    /* A map may carry NO heading: Ziv struck the close-up's on 2026-09-12
       ("remove this line"). An empty title paints nothing and reserves nothing,
       so the legend below it climbs to the same inset every other floating thing
       uses - a heading that is gone must not leave its gap behind. */
    var title = map.title_he || "";
    var titleBottom = title ? 16 * u + titleSize * 1.3 : 16 * u;
    var taken = [];
    if (title) {
      taken.push({ x0: W - 28 * u - R.width(ctx, title, titleSize, 600), y0: 0,
                   x1: W, y1: titleBottom });
    }
    /* WHICH CORNER the legend takes is decided per render, by what would be
       under each of the four - the belts and their diamonds, the axes and the
       map's own labels (dossier_map_legend.js). The frame's authored `legend`
       is handed over as a PREFERENCE and only breaks a tie, because one frame
       is drawn at 3:2 on the page and 16:9 on every slide and a fixed corner
       cannot be clean on both. `top` is the y a top corner takes: the line
       under the painted title, or the plain inset when there is none. */
    var legend = W >= 800
      ? R.legendLayout(ctx, P, u, W, H, !!(map.lanes && map.lanes.length), WORDS,
          { size: size, arrows: !!(map.arrows && map.arrows.length),
            top: titleBottom + (title ? 10 * u : 0), pref: F.legend,
            p: p, G: G, map: map, taken: taken.slice() })
      : null;
    if (legend) taken.push(legend.box);
    /* The axes go down after the ground and before every name: they are what
       the Aden frame is for, and a town name is still free to be dropped for
       one rather than the other way round. */
    R.arrows(ctx, p, P, u, ts, map, taken, W, H);
    /* A label keeps its authored side while that side is free; when two names
       would overprint (measured at 600px: Perim over Aden) it tries the other
       sides, and if none is free it is DROPPED - a name nobody can read is
       worse than a mark with its name in the list under the map. */
    var labels = [];
    (map.labels || []).forEach(function (l) {
      if (((W < 700 || notesOn) && l.tier === 2) || !p.inside(l.lon, l.lat, 0)) return;
      var q = p(l.lon, l.lat), isGain = !!gainKeys[l.place], spec = null;
      /* Anchor "c" names a country: centred on its point, no dot, in the
         quieter governorate ink, and dropped rather than moved or cut. */
      var quiet = l.anchor === "c";
      /* An ISLAND gain on the overview is drawn as a 7px ring by gains(); the
         name clears that ring rather than the pin inside it. */
      var clear = isGain ? Math.max(pinR, 7 * u) : pinR;
      (quiet ? ["c"] : [l.anchor, OPPOSITE[l.anchor], "n", "s", "e", "w"]).some(function (a) {
        var s = R.place(ctx, l.he, q[0], q[1], a, size, clear, u, W, H);
        var b = s.box, free = !taken.some(function (t) { return R.overlaps(b, t); }) &&
          (!quiet || (b.x0 >= 0 && b.x1 <= W && b.y0 >= 0 && b.y1 <= H));
        if (free) spec = s;
        return free;
      });
      if (!spec) return;
      /* A PIN under every town and port - the GAINS INCLUDED. Until 2026-09-14
         the dot was drawn only for a label that was not a gain, so exactly the
         places the map is about - Mokha, Dhubab, Hays, al-Khawkhah - were names
         floating over a violet shape with nothing saying which pixel was the
         town (Ziv: "put a PIN so people can see where that city is... in the
         actual exact location"). A disc of the GROUND colour under a dot of the
         ink reads over violet, over either side's territory and over the sea,
         and adds no hue - every hue on this board is spoken for by a front, a
         verdict or a side.

         The mark that first carried that was 4.2px, and Ziv called it weird the
         same day ("I don't like the pins that you did. They look weird"). Asked
         what it should be instead he chose a small, tight dot under the name
         marking the exact spot - hence 3.0 - and drew the line this condition
         reads: "only on real towns and ports - never on islands, the strait, or
         a country name", because those are areas and an area has no one pixel
         ("especially on the islands, there's no reason to put a point, not even
         a city"). A country name already says so with anchor "c"; the two
         islands and the strait say it with `pin: false` in the label. */
      if (!quiet && l.pin !== false) {
        R.ringMark(ctx, q[0], q[1], pinR, { fill: P.halo });
        R.ringMark(ctx, q[0], q[1], pinR * 0.62, { fill: P.ink });
      }
      taken.push(spec.box);
      labels.push({ pt: q, spec: spec, quiet: quiet });
    });
    var points = labels.map(function (l) { return { q: l.pt, he: l.spec.str }; });
    var lanes = notesOn
      ? (map.lanes || []).map(function (l) { return { path: l.path, label_he: "" }; })
      : map.lanes;
    R.lanes(ctx, p, P, u, W, H, lanes, size, taken, legend && legend.box);
    /* The governorate names go down BEFORE the fighting zones: each has one
       anchor point and no second choice, while a zone name has a whole shape to
       find room in.

       ON THE NOTES PICTURE THEY COME OFF ALTOGETHER, and that is not a small
       decision - Ziv has twice objected to a province losing its name. It is
       made here because a note is NEVER dropped: twelve callouts four text
       lines deep cannot all find free ground on the overview, so whatever is
       already standing gets overprinted instead. Measured at 1400px with the
       governorate names in: 21 collisions across 12 callouts, which is an
       unreadable picture. Without them: see the number in DOSSIER_MAPS.md.
       The province names are not lost - the plain picture of the same frame
       sits directly above this one on the page and in the deck, and carries
       every one of them. */
    var gov = F.gov || 1;
    if (!notesOn) {
      R.govLabels(ctx, p, P, u, G,
        Math.max(size * Math.min(GOV_MIN, gov), 17 * u * ts * gov), taken, points);
    }
    if (notesOn) R.notes(ctx, p, P, u, ts, G, taken, W, H, size);
    else R.zoneNames(ctx, p, P, u, W, H, G, size, taken);
    labels.forEach(function (l) {
      var s = l.spec;
      R.text(ctx, P, s.str, s.x, s.y, { size: s.size, weight: l.quiet ? 500 : 600,
        halo: 3 * u, align: s.align, baseline: s.baseline, color: l.quiet ? P.govLabel : null });
    });
    if (title) {
      R.text(ctx, P, title, W - 16 * u, 16 * u, { size: titleSize, weight: 600,
        halo: 4 * u, align: "right", baseline: "top" });
    }
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
      again.forEach(function (a) { draw(a.canvas, a.mapId, a.theme, a.cssWidth, a.variant); });
    }, function () { pending = []; });
  }

  function draw(canvas, mapId, theme, cssWidth, variant) {
    var W = Math.max(1, Math.round(cssWidth)), H = Math.round(W / aspect(mapId));
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx, mapId, theme, W, H, TEXT_SCREEN, variant);
    if (!fontReady()) {
      pending = pending.filter(function (a) { return a.canvas !== canvas; });
      pending.push({ canvas: canvas, mapId: mapId, theme: theme,
                     cssWidth: cssWidth, variant: variant });
      repaintWhenLoaded();
    }
  }

  function exportPng(mapId, theme, width, height, variant) {
    var c = document.createElement("canvas");
    c.width = Math.round(width); c.height = Math.round(height);
    paint(c.getContext("2d"), mapId, theme, c.width, c.height, TEXT_SLIDE, variant);
    return c.toDataURL("image/png");
  }

  function frame(mapId, width, height) {
    var f = frameOf(mapId);
    if (!f) return null;
    return projector(f, width || BASE_W, height || BASE_W / aspect(mapId)).extent;
  }

  /* The deck's EDITABLE map slide (dossier_deck_map.js) paints the same picture
     out of PowerPoint shapes, so it must use this file's own projection and this
     file's own palette - copied, the two slides would drift apart on the first
     frame change and nobody would know which was right. */
  function project(mapId, W, H) {
    var f = frameOf(mapId);
    return f ? projector(f, W, H) : null;
  }

  return { draw: draw, exportPng: exportPng, frame: frame, aspect: aspect,
           variantsOf: variantsOf, ready: ready,
           project: project, palette: palette, words: WORDS };
})();

window.DossierMap = DossierMap;
