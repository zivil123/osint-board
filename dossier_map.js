/* The static maps of the dossier tab (מתקפת פתע), painted on a canvas from GEO
   (the board's own geography) plus DOSSIER (the frames, the gains layer, the
   lanes, the hand-anchored labels and the assessed axes). The same painter
   serves the screen and the PowerPoint: exportPng() paints an offscreen canvas
   at slide resolution, so the deck carries exactly what the tab shows, legend
   included.

   NO ES modules - the page runs from file://. One global:

     window.DossierMap = {
       draw(canvas, mapId, theme, cssWidth, variant),   // paints in place
       exportPng(mapId, theme, w, h, variant, shape),   // -> PNG data URL
       variantsOf(mapId),        // ["plain", ...] the pictures of this frame
       ready(theme),             // Promise: the theme's relief pictures landed
       frame(mapId, w, h), aspect(mapId), project(mapId, W, H), palette, words
     }

   `shape` is "wide" (or undefined) and "square": the two pictures Ziv asked
   for on 2026-09-17, a whole slide and one that sits beside text. It picks the
   authored frame, never the canvas.

   mapId is any id in DOSSIER.maps; theme is "dark" | "light"; variant is
   "plain" (or undefined) | "notes" | "relief". Pure function of DOSSIER + GEO +
   theme: the only DOM it touches is the canvas it is handed, the :root tokens of
   style.css (the dark palette is READ from them, never written here; the light
   one has no tokens on the board and is authored below) and the relief images.
   The layer painters live in dossier_map_draw.js, dossier_map_legend.js,
   dossier_map_extra.js, dossier_map_gains.js, dossier_map_heat.js and the two
   the `key` field asks for, all looked up at paint time so the files may load
   in any order. Every string painted is
   Hebrew - the build refuses Latin in any map string.

   FRAMES ARE AUTHORED, in data\dossier_maps.json, and reach here as
   DOSSIER.frames: a latitude range and a longitude CENTRE, the longitude span
   following from the aspect of the rectangle being painted, so nothing is ever
   cropped. The rubric is in DOSSIER_LAYERS.md, "Frames". */
"use strict";

var DossierMap = (function () {
  var BASE_W = 1280;                 /* the CSS width every size is written for */
  /* Text grows with the canvas (u = W / BASE_W) and then by this factor: a
     little on screen, half again on a slide, which is read from across a room
     and is nothing but this picture. */
  var TEXT_SCREEN = 1.15, TEXT_SLIDE = 1.5;
  /* The smallest step a governorate name keeps above a town name. The frame's
     `gov` factor grows with the CANVAS and not off the 17px reading floor, and
     multiplying that floor handed a phone governorate names a quarter of the
     map wide - measured at 345px. Wide canvases reach the frame's own factor;
     narrow ones keep a step and no more. */
  var GOV_MIN = 1.2;
  /* The PIN radius, written for BASE_W and floored the way the 17px text floor
     is: a mark that shrinks with the canvas stops being a mark. 4.2 on the day
     it was built and 3.0 since 2026-09-14 (DOSSIER_LAYERS.md, "Labels"). */
  var PIN_R = 3.0, PIN_MIN = 3;
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
     so its palette is AUTHORED, in dossier_map_light.js - it moved there on
     2026-09-17 to make room here, and the reasoning that sets its colours
     moved with it. */

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
                ["dossier_map_extra.js", window.DossierMapExtra],
                ["dossier_map_gains.js", window.DossierMapGains],
                ["dossier_map_heat.js", window.DossierMapHeat],
                ["dossier_map_zone_names.js", window.DossierMapZoneNames],
                ["dossier_map_routes.js", window.DossierMapRoutes],
                /* LAST ON PURPOSE: the merge below is last-wins, and the roads
                   file's arrows() is meant to stand in for DossierMapExtra's.
                   It is the ONE optional entry here - a page without it keeps
                   the old arrows rather than refusing to draw at all. */
                ["dossier_map_roads.js", window.DossierMapRoads || {}]];
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
  /* The two OPTIONAL painters, each needed only by the map whose `key` asks for
     it - named when missing, for the same reason the four above are. */
  function need(file, mod) {
    if (!mod) throw new Error("dossier_map: " + file + " is not on the page");
    return mod;
  }

  function palette(theme) {
    if (theme === "light") return need("dossier_map_light.js", window.DossierMapLight);
    var sea = cssVar("--map-bg");
    if (!sea) throw new Error("dossier_map: style.css tokens are not on the page");
    var ink = cssVar("--ink");
    return {
      theme: "dark",
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
  /* TWO SHAPES OF EVERY PICTURE (2026-09-17): a WIDE one for a whole slide and
     a SQUARE one to sit beside text. The square is never derived -
     `frames.<name>.square` is authored, a 1:1 crop of a 16:9 frame losing the
     story's two ends - and a record without one falls back to the wide frame.
     DOSSIER_LAYERS.md, "Every frame has TWO shapes". */
  function frameOf(mapId, shape) {
    var D = dossier(), m = mapOf(mapId);
    var f = (D && m && D.frames && D.frames[m.frame]) || null;
    if (!f) return null;
    var sq = shape === "square" ? f.square : null;
    if (!sq || !sq.lat) return f;
    return { lat: sq.lat, aspect: [1, 1], legend: f.legend, gov: f.gov,
             lonMid: typeof sq.lonMid === "number" ? sq.lonMid : f.lonMid };
  }
  /* A caller cutting the map's own rectangle asks `frameAspect`; a caller
     sizing a canvas asks `aspect`, AND THE TWO ARE THE SAME NUMBER on purpose:
     widening the canvas by the key panel's share left the page drawing a 2.61:1
     picture the button never saved, and starved the panel to an 11px note
     (DOSSIER_MAPS.md, "The key panel's picture is the download's shape"). */
  function frameAspect(mapId) {
    var f = frameOf(mapId);
    return (f && f.aspect && f.aspect[1]) ? f.aspect[0] / f.aspect[1] : 16 / 9;
  }
  function aspect(mapId) {
    return frameAspect(mapId);
  }
  /* The pictures this painter can draw for a frame, PLAIN FIRST. The page and
     the deck both ask, so a variant added to the record reaches both without a
     line of code in either. A `ground` map IS its picture - the terrain is the
     base, not a second view of the same frame - so it offers none. */
  function variantsOf(mapId) {
    var m = mapOf(mapId);
    if (m && m.ground) return ["plain"];
    return ["plain"].concat(Object.keys((m && m.variants) || {}));
  }

  /* ---- the relief pictures ------------------------------------------------------ */

  /* Loading them, and deciding which frame needs one, is dossier_map_relief.js.
     OPTIONAL at runtime, exactly as the terrain itself is: a board with no
     relief file draws on plain ground, so a missing script costs the terrain
     and never the picture. */
  function reliefFile() { return window.DossierMapRelief || null; }
  function ready(theme) {
    var R = reliefFile();
    return R ? R.ready(theme) : Promise.resolve(false);
  }
  function reliefOpt(map, theme, variant) {
    var R = reliefFile();
    return R ? R.optFor(map, theme, variant) : null;
  }

  /* ---- the picture ----------------------------------------------------------- */

  function noData(ctx, P, R, W, H, u) {
    ctx.fillStyle = P.sea; ctx.fillRect(0, 0, W, H);
    R.text(ctx, P, WORDS.noData, W / 2, H / 2,
      { size: Math.max(20, 22 * u), weight: 600, halo: 0 });
  }

  /* THE CANVAS IS NOT ALWAYS THE MAP (2026-09-17). A record carrying
     `key: "panel"` splits the canvas into a MAP AREA and a KEY PANEL, and the
     whole picture below is then painted into the map area through a translated
     and CLIPPED context, at the map area's own size - so the projector, the
     legend's corner search, the label placement and every measurement in pixels
     are done on the rectangle the map really occupies. dossier_map_key.js owns
     the split, the numbered discs and the panel, and it also says WHICH SHAPE's
     frame the area is to be projected with (`a.frame`) - the opposite of the
     canvas's, because the wide canvas's area is the taller rectangle and the
     square canvas's is the wider one. An area wider than the shape it reads
     only gains longitude, so nothing the build passed can fall off an edge. */
  function paint(ctx, mapId, theme, W, H, ts, variant, shape) {
    var map = mapOf(mapId), K = window.DossierMapKey;
    var a = map && map.key === "panel"
      ? need("dossier_map_key.js", K).area(map, W, H, shape, frameAspect(mapId))
      : null;
    if (!a) { paintMap(ctx, mapId, theme, W, H, ts, variant, shape); return; }
    var P = palette(theme), u = W / BASE_W;
    K.card(ctx, P, u, a, W, H);
    ctx.save();
    ctx.beginPath(); ctx.rect(a.map.x, a.map.y, a.map.w, a.map.h); ctx.clip();
    ctx.translate(a.map.x, a.map.y);
    paintMap(ctx, mapId, theme, a.map.w, a.map.h, ts, variant, a.frame);
    ctx.restore();
    K.panel(ctx, P, u, ts, map, a, W);
  }

  function paintMap(ctx, mapId, theme, W, H, ts, variant, shape) {
    var R = painters(), P = palette(theme), G = geo(), D = dossier(), u = W / BASE_W;
    var map = mapOf(mapId), F = frameOf(mapId, shape), kind = variant || "plain";
    ctx.direction = "rtl";
    if (!G || !D || !map || !F) { noData(ctx, P, R, W, H, u); return; }
    var p = projector(F, W, H);
    /* 17px is the reading floor on screen; everything grows with the canvas
       and nothing shrinks below it, so a narrow canvas drops tier-2 labels
       instead of shrinking them. */
    var size = Math.max(17, 17 * u * ts);
    var pinR = Math.max(PIN_MIN, PIN_R * u * ts);
    /* The NOTES picture is the same map with a sentence at every fighting zone,
       so it needs the room: the second-rank place names and the lane's name come
       off, and nothing is added that the plain picture lacks. */
    var notesOn = kind === "notes";
    /* A CLEAN map draws no war: the control fills, the fighting belts and their
       diamonds, the line of contact, the gains and the governorate names all
       come off, and the terrain, coast, borders, places, route and key stay. A
       MERGED one puts the two territories and the boundary between them back,
       ground() folding the gains into the Houthi fill - which is why the
       record's gains are handed over with it. Ziv's words and both rules are in
       DOSSIER_LAYERS.md, "Colour, the legend and the marks". */
    var clean = !!map.clean;
    var gOpt = reliefOpt(map, theme, kind) || {};
    gOpt.clean = clean; gOpt.control = map.control || null; gOpt.D = D;
    /* HOW HARD EACH BELT IS BEING FOUGHT, when the record says so: ground()
       hands it to dossier_map_heat.js, which fills every fighting zone with its
       own step of the scale instead of the one contested colour. */
    gOpt.heat = map.heat || null;
    R.ground(ctx, p, P, u, W, H, G, gOpt);
    if (!clean) R.gains(ctx, p, P, u, D, G, mapId);
    /* A clean picture carries two or three names, so it sets them larger - one
       factor, in dossier_map_draw.js, which the route's own block reads too. */
    var labelSize = clean ? size * R.CLEAN_TEXT : size;
    /* Zones, sea routes and straight-line measures go down WITH the ground: a
       town's pin belongs on top of a line that passes through its port. */
    R.mapUnder(ctx, p, P, u, map);
    /* Labels: the dossier's own first (they are the point of the map), then the
       lane names and the governorate names fitted around them and around the
       legend box, which is measured now and painted last. */
    var gainKeys = {};
    (D.gains || []).forEach(function (g) { gainKeys[g.place_key] = true; });
    /* NO TITLE IS PAINTED INTO A PICTURE (2026-09-17, Ziv: the header goes
       outside it). So every floating thing on the canvas - the legend, the
       scale bar - starts at the same 16*u edge as everything else. */
    var titleTop = 16 * u;
    var taken = [];
    /* WHICH CORNER the legend takes is decided per render, by what would be
       under each of the four (dossier_map_legend.js); the frame's authored
       `legend` is a PREFERENCE that only breaks a tie, one frame being drawn at
       3:2 on the page and 16:9 on every slide. Under 800px there is no painted
       box at all - six 17px rows would cover a third of the map - and none on a
       map that says `legend: false`, whose corner is then not reserved either,
       so a name may stand there. Both are in DOSSIER_LAYERS.md. */
    var legend = W >= 800 && map.legend !== false
      ? R.legendLayout(ctx, P, u, W, H, !!(map.lanes && map.lanes.length), WORDS,
          { size: size, arrows: !!(map.arrows && map.arrows.length),
            top: titleTop, pref: F.legend, clean: clean, control: map.control,
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
      /* `kind` picks the mark - objective, ridge, port or town - and the name's
         gap is read off the SAME number, so the two cannot disagree. */
      var markR = R.markClear(pinR, l.kind);
      /* A COUNTRY IS SET IN ITS OWN STYLE (2026-09-17, Ziv: "show the names of
         the other countries, including Somaliland"): larger than the map's own
         names, letter-spaced, no mark, and - like any anchor "c" - centred on
         its point and dropped rather than moved or cut. The size comes off the
         map's BASE size, never the clean one: see COUNTRY_TEXT. */
      var country = l.kind === "country";
      var quiet = country || l.anchor === "c";
      var lSize = country ? size * R.COUNTRY_TEXT : labelSize;
      var lSpace = country ? lSize * R.COUNTRY_SPACE : 0;
      /* An ISLAND gain on the overview is drawn as a 7px ring by gains(); the
         name clears that ring rather than the pin inside it. */
      var clear = isGain ? Math.max(markR, 7 * u) : markR;
      (quiet ? ["c"] : [l.anchor, OPPOSITE[l.anchor], "n", "s", "e", "w"]).some(function (a) {
        var s = R.place(ctx, l.he, q[0], q[1], a, lSize, clear, u, W, H, lSpace);
        var b = s.box, free = !taken.some(function (t) { return R.overlaps(b, t); }) &&
          (!quiet || (b.x0 >= 0 && b.x1 <= W && b.y0 >= 0 && b.y1 <= H));
        if (free) spec = s;
        return free;
      });
      if (!spec) return;
      /* A PIN under every town and port, the GAINS INCLUDED - a disc of the
         ground colour under a dot of the ink, so it reads over violet, over
         either side's territory and over the sea and adds no hue. ONLY on real
         towns and ports: an island, the strait and a country name are areas and
         an area has no one pixel, so they carry `pin: false` or anchor "c".
         Ziv's own words, and why the mark went from 4.2 to 3.0, are in
         DOSSIER_LAYERS.md, "Labels, pins and the governorate names". */
      if (!quiet && l.pin !== false) R.mark(ctx, P, q[0], q[1], markR, u, l.kind);
      taken.push(spec.box);
      labels.push({ pt: q, spec: spec, quiet: quiet });
    });
    var points = labels.map(function (l) { return { q: l.pt, he: l.spec.str }; });
    var lanes = notesOn
      ? (map.lanes || []).map(function (l) { return { path: l.path, label_he: "" }; })
      : map.lanes;
    R.lanes(ctx, p, P, u, W, H, lanes, size, taken, legend && legend.box);
    /* Their names and distances, plus the scale bar a terrain map keeps in the
       corner the legend did not take. */
    R.mapOver(ctx, p, P, u, map, taken, W, H, size, legend);
    /* The governorate names go down BEFORE the fighting zones: each has one
       anchor point and no second choice, while a zone name has a whole shape to
       find room in.

       ON THE NOTES PICTURE THEY COME OFF ALTOGETHER (21 collisions across 12
       callouts with them in, measured at 1400px - a note is never dropped, so
       what was standing got overprinted), and on a CLEAN one they come off for
       the opposite reason: it is not a map of who holds what. Both decisions,
       and why nothing is lost by the first, are in DOSSIER_MAPS.md, "Notes live
       on the FRONT" and DOSSIER_LAYERS.md. */
    var gov = F.gov || 1;
    if (!notesOn && !clean) {
      R.govLabels(ctx, p, P, u, G,
        Math.max(size * Math.min(GOV_MIN, gov), 17 * u * ts * gov), taken, points);
    }
    if (notesOn) R.notes(ctx, p, P, u, ts, G, taken, W, H, size);
    else if (!clean) R.zoneNames(ctx, p, P, u, W, H, G, size, taken, map);
    /* A MAP'S OWN NOTES, ONE OF TWO WAYS, and `key` on the record says which
       (2026-09-17). Ziv saw the nine Marib callouts and answered "too much
       text", so the notes come as CALLOUTS with arrows to their places
       (dossier_map_notes.js) or as numbered DISCS read off a key panel beside
       the map (dossier_map_key.js, which also split this canvas). Painted after
       every place name, so a note goes where nothing else is. */
    if (map.key === "callouts") {
      need("dossier_map_notes.js", window.DossierMapNotes)
        .draw(ctx, p, P, u, ts, map, taken, W, H, size);
    } else if (map.key === "panel") {
      need("dossier_map_key.js", window.DossierMapKey)
        .discs(ctx, p, P, u, ts, map, taken, W, H);
    }
    labels.forEach(function (l) {
      var s = l.spec;
      R.text(ctx, P, s.str, s.x, s.y, { size: s.size, weight: l.quiet ? 500 : 600,
        halo: 3 * u, align: s.align, baseline: s.baseline, spacing: s.spacing,
        color: l.quiet ? P.govLabel : null });
    });
    if (legend) R.paintLegend(ctx, P, u, legend);
  }

  /* Heebo is a web font: a canvas painted before it arrives is set in the
     fallback face. Paint anyway (never a blank page), repaint when it lands. */
  var pending = [];
  /* THE SCREEN PAINTS THE THEME THE BUTTON SAVES - Ziv, 2026-09-17: *"make all
     of the maps bright."* One name, read by both tabs, so they cannot drift. */
  var SCREEN_THEME = "light";
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

  /* `shape` is "wide" (or undefined) for the slide-sized picture and "square"
     for the one beside text on half a slide. It picks the FRAME, not the
     canvas: the caller still says how many pixels it wants. */
  function exportPng(mapId, theme, width, height, variant, shape) {
    var c = document.createElement("canvas");
    c.width = Math.round(width); c.height = Math.round(height);
    paint(c.getContext("2d"), mapId, theme, c.width, c.height, TEXT_SLIDE,
          variant, shape);
    return c.toDataURL("image/png");
  }

  /* The frame's own rectangle, never the canvas's: a default height comes off
     `frameAspect`, so a key-panel map reports the ground its MAP AREA shows. */
  function frame(mapId, width, height) {
    var f = frameOf(mapId);
    if (!f) return null;
    return projector(f, width || BASE_W,
      height || BASE_W / frameAspect(mapId)).extent;
  }

  /* The deck's EDITABLE map slide (dossier_deck_map.js) paints the same picture
     out of PowerPoint shapes, so it must use this file's own projection and
     palette - copied, the two would drift apart on the first frame change. */
  function project(mapId, W, H) {
    var f = frameOf(mapId);
    return f ? projector(f, W, H) : null;
  }

  return { draw: draw, exportPng: exportPng, frame: frame, aspect: aspect,
           variantsOf: variantsOf, ready: ready, screenTheme: SCREEN_THEME,
           project: project, palette: palette, words: WORDS };
})();

window.DossierMap = DossierMap;
