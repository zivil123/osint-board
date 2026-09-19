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
       frame(mapId, w, h), aspect(mapId), project(mapId, W, H), palette,
       words()                    // the legend's Hebrew, from the legend file
     }

   `shape` is "wide" (or undefined) and "square": the two pictures Ziv asked for
   on 2026-09-17, a whole slide and one beside text. It picks the authored frame,
   never the canvas. The page's own paint passes "screen" - neither, so it reads
   the wide frame and reports its self-check apart from the slide's.

   mapId is any id in DOSSIER.maps; theme is "dark" | "light"; variant is
   "plain" (or undefined) | "notes" | "relief". Pure function of DOSSIER + GEO +
   theme: the only DOM it touches is the canvas it is handed, style.css's :root
   tokens (the dark palette is READ from them, the light one is authored in
   dossier_map_light.js) and the relief images. The layer painters are the other
   dossier_map_*.js files, looked up at paint time so they may load in any
   order. Every string painted is Hebrew - the build refuses Latin.

   FRAMES ARE AUTHORED, in data\dossier_maps.json, and reach here as
   DOSSIER.frames: a latitude range and a longitude CENTRE, the longitude span
   following from the aspect of the rectangle being painted, so nothing is ever
   cropped. The rubric is in DOSSIER_LAYERS.md, "Frames". */
"use strict";

var DossierMap = (function () {
  var BASE_W = 1280;                 /* the CSS width every size is written for */
  /* Text grows with the canvas (u = W / BASE_W) and then by this factor: a
     little on screen, half again on a slide, read from across a room. */
  var TEXT_SCREEN = 1.15, TEXT_SLIDE = 1.5;
  /* The smallest step a governorate name keeps above a town name. The frame's
     `gov` factor grows with the CANVAS, not off the 17px reading floor:
     multiplying that floor handed a phone region names a quarter of the map wide
     (345px). Wide canvases reach the frame's factor, narrow ones a step. */
  var GOV_MIN = 1.2;
  /* The PIN radius, written for BASE_W and floored like the 17px text floor: a
     mark that shrinks with the canvas stops being a mark. 4.2 on the day it was
     built, 3.0 since 2026-09-14 (DOSSIER_LAYERS.md, "Labels"). */
  var PIN_R = 3.0, PIN_MIN = 3;
  /* The light deck has no tokens on the board (dark is the board's only theme),
     so its palette is AUTHORED, in dossier_map_light.js - it moved there on
     2026-09-17 to make room here, and THE LEGEND'S HEBREW WORDS followed it on
     2026-09-19, when the canvas text scale and the phone's list map took this
     file to its cap. `words()` is the pass-through, a FUNCTION because that
     file may load after this one. */
  function words() { return window.DossierMapWords || {}; }

  /* ---- tokens ---------------------------------------------------------------- */
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function cssNum(name, fallback) {
    var n = parseFloat(cssVar(name));
    return isFinite(n) ? n : fallback;
  }
  /* Every painter file under one name, cached once they are all on the page. A
     missing one is NAMED, because "undefined is not a function" out of a canvas
     paint says nothing about which script tag was left out. */
  var PAINTERS = null;
  function painters() {
    if (PAINTERS) return PAINTERS;
    var need = [["dossier_map_draw.js", window.DossierMapDraw],
                ["dossier_map_legend.js", window.DossierMapLegend],
                ["dossier_map_extra.js", window.DossierMapExtra],
                ["dossier_map_gains.js", window.DossierMapGains],
                ["dossier_map_heat.js", window.DossierMapHeat],
                ["dossier_map_zone_names.js", window.DossierMapZoneNames],
                ["dossier_map_gov.js", window.DossierMapGov],
                ["dossier_map_routes.js", window.DossierMapRoutes],
                /* LAST ON PURPOSE: the merge below is last-wins and the roads
                   file's arrows() stands in for DossierMapExtra's. The ONE
                   optional entry - a page without it keeps the old arrows. */
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
  /* The OPTIONAL painters, each needed only by the map whose `key` asks for it
     - named when missing, for the same reason the ones above are. */
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
      /* Land is a step above the sea. --surface-2 alone is too close: under
         the government fill it lands back on the sea colour and the west coast
         reads as water with an outline. A tenth of the way to the ink keeps
         government above the sea, contested above that, Houthi above all. */
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

  /* ---- projection ------------------------------------------------------------ */
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
  /* A caller cutting the map's own rectangle asks `frameAspect`; one sizing a
     canvas asks `aspect`, AND THE TWO ARE THE SAME NUMBER on purpose: widening
     the canvas by the key panel's share left the page drawing a 2.61:1 picture
     the button never saved (DOSSIER_MAPS.md). */
  function frameAspect(mapId) {
    var f = frameOf(mapId);
    return (f && f.aspect && f.aspect[1]) ? f.aspect[0] / f.aspect[1] : 16 / 9;
  }
  function aspect(mapId) {
    return frameAspect(mapId);
  }
  /* The pictures this painter can draw for a frame, PLAIN FIRST. The page and
     the deck both ask, so a variant added to the record reaches both without a
     line of code. A `ground` map IS its picture - the terrain is the base, not
     a second view of the same frame - so it offers none. */
  function variantsOf(mapId) {
    var m = mapOf(mapId);
    if (m && m.ground) return ["plain"];
    return ["plain"].concat(Object.keys((m && m.variants) || {}));
  }

  /* ---- the relief pictures --------------------------------------------------- */
  /* Loading them, and deciding which frame needs one, is dossier_map_relief.js.
     OPTIONAL at runtime, as the terrain is: a board with no relief file draws
     on plain ground, so a missing script costs the terrain, never the picture. */
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
    R.text(ctx, P, words().noData, W / 2, H / 2,
      { size: Math.max(20, 22 * u), weight: 600, halo: 0 });
  }

  /* THE CANVAS IS NOT ALWAYS THE MAP (2026-09-17). A record carrying
     `key: "panel"` splits the canvas into a MAP AREA and a KEY PANEL, and the
     picture is painted into that area through a translated and CLIPPED context
     at the area's own size - so the projector, the legend's corner search and
     every pixel measurement are done on the rectangle the map really occupies.
     dossier_map_key.js owns the split, the discs and the panel, and says WHICH
     SHAPE's frame the area is projected with (`a.frame`) - the opposite of the
     canvas's, the wide canvas's area being the taller one.
     THE PICTURE CHECKS ITSELF WHILE IT IS PAINTED (2026-09-18), when
     dossier_map_check.js is on the page: this is the one place that knows a
     whole picture is starting and ending, so it opens and closes the report.
     Every painter files its findings into it and the dump refuses the batch on
     a violation. Guarded: a board without that file paints exactly as before.
     THE VARIANT IS PART OF THE NAME because it is part of the PICTURE: keyed on
     the id alone, `overview` plain, notes and relief wrote one report and the
     last to paint spoke for all three. Spelled as dossier_png.js stamps a
     FILENAME. */
  function checkName(mapId, variant) {
    return String(mapId) + (variant && variant !== "plain" ? "/" + variant : "");
  }
  function paint(ctx, mapId, theme, W, H, ts, variant, shape) {
    var map = mapOf(mapId), K = window.DossierMapKey, C = window.DossierMapCheck;
    if (C) C.begin(checkName(mapId, variant), shape || "wide");
    /* THE PICTURE'S OWN WIDTH, told once to the one place every string passes
       through, so a size can be reported as the READER gets it and not as the
       rectangle it was painted in (dossier_map_draw.js, `min_name_px`). */
    if (window.DossierMapDraw) DossierMapDraw.canvasScale(W / BASE_W);
    var a = map && map.key === "panel"
      ? need("dossier_map_key.js", K).area(map, W, H, shape, frameAspect(mapId))
      : null;
    if (!a) {
      paintMap(ctx, mapId, theme, W, H, ts, variant, shape);
      if (C) C.end();
      return;
    }
    var P = palette(theme), u = W / BASE_W;
    K.card(ctx, P, u, a, W, H);
    ctx.save();
    ctx.beginPath(); ctx.rect(a.map.x, a.map.y, a.map.w, a.map.h); ctx.clip();
    ctx.translate(a.map.x, a.map.y);
    /* THE MAP'S TEXT SCALES WITH THE CANVAS, NEVER WITH ITS OWN BAND
       (2026-09-19). Sizes in paintMap are written for a 1280-wide picture and
       grown by `u`, the width it is handed - about HALF the canvas on the
       three-band split, so a town name reading 25 CSS px elsewhere came out 13
       here the day the map band went 68% -> 51%. Ziv: "make it big". The fix
       is the right unit, not a floor: `ts` carries the ratio, so names, pins,
       discs and the key box are sized as an unsplit picture would size them. */
    var taken = paintMap(ctx, mapId, theme, a.map.w, a.map.h,
                         ts * (a.map.w > 0 ? W / a.map.w : 1), variant, a.frame);
    ctx.restore();
    /* THE PANEL IS HANDED WHAT THE MAP ALREADY COVERED - every rectangle the
       map area reserved, the SAME array and objects, so a connector is checked
       against every name and lets itself out of its own lane by IDENTITY
       (copying the list to add a zero offset broke exactly that). NOT
       TRANSLATED: map-area pixels and canvas pixels are the same numbers here,
       because the wide split puts the map at the canvas origin - which
       dossier_map_link.js asserts and refuses without. */
    K.panel(ctx, P, u, ts, map, a, W, taken);
    if (C) C.end();
  }

  function paintMap(ctx, mapId, theme, W, H, ts, variant, shape) {
    var R = painters(), P = palette(theme), G = geo(), D = dossier(), u = W / BASE_W;
    var map = mapOf(mapId), F = frameOf(mapId, shape), kind = variant || "plain";
    ctx.direction = "rtl";
    if (!G || !D || !map || !F) { noData(ctx, P, R, W, H, u); return []; }
    var p = projector(F, W, H);
    /* 17px is the reading floor on screen; everything grows with the canvas and
       nothing shrinks below it, so a narrow canvas drops tier-2 labels. */
    var size = Math.max(17, 17 * u * ts);
    var pinR = Math.max(PIN_MIN, PIN_R * u * ts);
    /* The NOTES picture is the same map with a sentence at every fighting zone,
       so it needs the room: the second-rank place names and the lane's name
       come off, and nothing is added that the plain picture lacks. */
    var notesOn = kind === "notes";
    /* A CLEAN map draws no war: the control fills, the fighting belts and their
       diamonds, the line of contact, the gains and the governorate names come
       off; terrain, coast, borders, places, route and key stay. A MERGED one
       puts the two territories and their boundary back, ground() folding the
       gains into the Houthi fill. Ziv's words and both rules are in
       DOSSIER_COLOUR.md, "Colour, the legend and the marks". */
    var clean = !!map.clean;
    var gOpt = reliefOpt(map, theme, kind) || {};
    gOpt.clean = clean; gOpt.control = map.control || null; gOpt.D = D;
    /* HOW HARD EACH BELT IS BEING FOUGHT, when the record says so: ground()
       hands it to dossier_map_heat.js, which fills each fighting zone with its
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
       outside it), so every floating thing - legend, scale bar - starts at the
       same 16*u edge. */
    var titleTop = 16 * u;
    var taken = [];
    /* THE CONNECTORS' LANES FIRST, before the legend is laid out and before any
       name is placed (2026-09-19): a key-panel picture joins each mark to its
       row along a horizontal lane, and the WORDS move off those rather than the
       lines bending round the words. dossier_map_fan.js owns the shape. */
    if (window.DossierMapFan) DossierMapFan.plan(p, u, map, W, H, taken, pinR,
      window.DossierMapKey ? DossierMapKey.splitOf() : null);
    /* WHICH CORNER the legend takes is decided per render, by what would be
       under each of the four (dossier_map_legend.js); the frame's authored
       `legend` only breaks a tie, one frame being drawn 3:2 on the page and
       16:9 on a slide. Under 800px there is no box at all - six 17px rows would
       cover a third of the map - and none on a map saying `legend: false`,
       whose corner is then not reserved either. Both in DOSSIER_LAYERS.md. */
    var legend = W >= 800 && map.legend !== false
      ? R.legendLayout(ctx, P, u, W, H, !!(map.lanes && map.lanes.length), words(),
          { size: size, arrows: !!(map.arrows && map.arrows.length),
            top: titleTop, pref: F.legend, clean: clean, control: map.control,
            p: p, G: G, map: map, taken: taken.slice() })
      : null;
    if (legend) taken.push(legend.box);
    /* The axes go down after the ground and before every name: they are what
       the Aden frame is for, and a town name is still free to be dropped for
       one rather than the other way round. */
    R.arrows(ctx, p, P, u, ts, map, taken, W, H);
    /* THE MAP'S OWN NAMES, the ones it exists to point at, go down before
       every other kind of text, and the ones its prose talks about first of
       all - so a name Ziv is reading about cannot lose its place to a name
       nobody asked for. The search is in dossier_map_zone_names.js. */
    /* A KEY-PANEL MAP TOO NARROW FOR ITS PANEL PAINTS NUMBERS AND NO OBJECTIVE
       NAMES (2026-09-19). The sentences have moved to the HTML list under the
       picture, numbered the same way, so a name here would be the same word
       twice - and at 340 CSS px they crowded the cluster until two required
       ones were dropped outright. The mark stays, its disc is glued to it, and
       the list below carries the name; a town that is nobody's objective keeps
       its name if it fits. MAPS_TAB.md, "On a phone". */
    var numbersOnly = null;
    if (map.key === "panel" &&
        !(window.DossierMapKey && DossierMapKey.splitOf())) {
      numbersOnly = {};
      (map.notes || []).forEach(function (n) { numbersOnly[n.place] = true; });
    }
    var placed = R.placeLabels(ctx, p, P, R, u, map, {
      W: W, H: H, taken: taken, size: size, labelSize: labelSize, pinR: pinR,
      notesOn: notesOn, gainKeys: gainKeys, mapId: mapId,
      numbersOnly: numbersOnly });
    /* AND THE PLACES THAT ENDED UP AS A NUMBER AND NO NAME, whatever the
       picture. A name with no adjacent spot is not printed far away any more
       (MAP_RULES.md rule 8): the place is shown by the disc glued to its mark,
       and the panel row or the list under the picture carries the word. */
    numbersOnly = placed.numbersOnly || numbersOnly;
    var labels = placed.labels, points = placed.points;
    var lanes = notesOn
      ? (map.lanes || []).map(function (l) { return { path: l.path, label_he: "" }; })
      : map.lanes;
    R.lanes(ctx, p, P, u, W, H, lanes, size, taken, legend && legend.box);
    /* Their names and distances, plus the scale bar a terrain map keeps in the
       corner the legend did not take. */
    R.mapOver(ctx, p, P, u, map, taken, W, H, size, legend);
    /* The governorate names go down BEFORE the fighting zones: each has one
       anchor point and no second choice, while a zone name has a whole shape to
       find room in. ON THE NOTES PICTURE THEY COME OFF ALTOGETHER (21
       collisions across 12 callouts with them in, measured at 1400px), and on a
       CLEAN one for the opposite reason: it is not a map of who holds what.
       Both, and why nothing is lost by the first, are in DOSSIER_MAPS.md,
       "Notes live on the FRONT" and DOSSIER_LAYERS.md. */
    var gov = F.gov || 1;
    if (!notesOn && !clean) {
      R.govLabels(ctx, p, P, u, G,
        Math.max(size * Math.min(GOV_MIN, gov), 17 * u * ts * gov), taken, points,
        map.gov_names, map.gov_anchor_he);
    }
    if (notesOn) R.notes(ctx, p, P, u, ts, G, taken, W, H, size, mapId);
    else if (!clean) R.zoneNames(ctx, p, P, u, W, H, G, size, taken, map, points);
    /* A MAP'S OWN NOTES, ONE OF TWO WAYS, and `key` on the record says which
       (2026-09-17). Ziv saw the nine Marib callouts and answered "too much
       text", so they come as CALLOUTS with arrows to their places
       (dossier_map_notes.js) or as numbered DISCS read off a key panel beside
       the map (dossier_map_key.js). After every place name, so a note goes
       where nothing else is. */
    if (map.key === "callouts") {
      need("dossier_map_notes.js", window.DossierMapNotes)
        .draw(ctx, p, P, u, ts, map, taken, W, H, size, numbersOnly, pinR);
    } else if (map.key === "panel") {
      need("dossier_map_key.js", window.DossierMapKey)
        .discs(ctx, p, P, u, ts, map, taken, W, H, pinR, numbersOnly);
    }
    R.paintLabels(ctx, P, R, u, labels);
    if (legend) R.paintLegend(ctx, P, u, legend);
    /* LAST OF ALL, AND ONLY ON A HEAT MAP: the level digit on every belt and
       the days they were read in, beside the key (dossier_map_heat.js). After
       the legend because nothing may cover them, and against a `taken` that by
       now holds every name, note, disc and the key box itself. */
    if (gOpt.heat && window.DossierMapHeat) {
      DossierMapHeat.badges(ctx, p, P, u, ts, G, map, taken, W, H, size, legend);
    }
    /* THE FINISHED PICTURE IS ASKED TWO QUESTIONS NO PAINTER CAN ANSWER
       (2026-09-19, dossier_map_ink.js): is every mark on it explained by
       something - a name touching it, a number glued to it, an arrow reaching
       it - and do the key's mark rows and the map's marks agree. */
    if (window.DossierMapInk) DossierMapInk.audit(mapId, legend);
    /* Everything this picture covered, for a caller that draws beside the map
       and must route round what is on it - the key panel, today. */
    return taken;
  }

  /* Heebo is a web font: a canvas painted before it arrives is set in the
     fallback face. Paint anyway (never a blank page), repaint when it lands.
     THE SCREEN PAINTS THE THEME THE BUTTON SAVES - Ziv, 2026-09-17: *"make all
     of the maps bright."* One name, read by both tabs, so they cannot drift. */
  var pending = [], SCREEN_THEME = "light";
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
    /* "screen" is a SHAPE for the self-check and nothing else: not "square", so
       it reads the wide frame and takes the wide split exactly as the undefined
       shape always did. Named because the page repaints - font, resize, tab -
       and an unnamed screen paint filed under the 2560px slide's own key. */
    paint(ctx, mapId, theme, W, H, TEXT_SCREEN, variant, "screen");
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
           project: project, palette: palette, words: words };
})();

window.DossierMap = DossierMap;
