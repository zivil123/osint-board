/* THE TRIBAL LAYER of the dossier maps: every tribal area filled by the stance
   its leadership takes TOWARD THE HOUTHIS - with, against, split - a thin line
   round each area, a thick one round each confederation, the Hebrew names of
   the confederations and of the tribes inside them, and the four rows the key
   needs to read any of it.

   Written 2026-09-22 for the `tribes` picture on the maps tab. It is its own
   file for the reason every painter here is its own file: dossier_map_draw.js
   and dossier_map.js were both at the 500-line cap, and a layer only one
   picture draws has no business growing the two files every picture draws.

   WHAT THE COLOURS SAY, AND WHAT THEY DO NOT. They answer "does this tribe back
   Ansar Allah", never "who holds this ground" - which is why a `tribes` map
   paints NO control fill at all (dossier_map_draw.js, `ground()`): two fills on
   one piece of land answering two different questions is a picture nobody can
   read. The line of contact stays, so the stances can be read against it.

   THE THREE TONES ARE TOKENS, not literals: `--tribe-with`, `--tribe-against`,
   `--tribe-split` in docs\style.css, each with a `-deck` twin for the LIGHT
   palette the downloads, the slides and the screen are painted in
   (DOSSIER_COLOUR.md). They are laid see-through so the hillshade reads
   through them, at one strength authored here - too heavy and the terrain is
   erased, too light and the reader stops telling green from blue at half scale.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapTribes = { fills, names, legendRows, stances }

   OPTIONAL at runtime and tolerant of a missing layer: with no `GEO.tribes` it
   paints nothing, names nothing and offers no key row, so a board built before
   the layer existed draws every other picture exactly as it did. The shared
   helpers come from DossierMapDraw, looked up on each call so the files may
   load in any order. */
"use strict";

var DossierMapTribes = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_tribes: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  /* The closed list, in the order the key prints them: backing the Houthis,
     against them, split. A feature whose `stance` is none of these is painted
     in no tone at all and reads as ground with no dominant tribe, which is the
     honest answer - a fourth colour nobody authored would be an invention. */
  var STANCES = ["with", "against", "split"];
  /* Read from the tokens, per deck. The fallbacks are the same six values
     style.css carries, so a page whose stylesheet did not load still paints
     three distinguishable tones instead of three transparent nothings. */
  var FALLBACK = {
    dark: { with: "#7FD9A6", against: "#7FB6F2", split: "#E9A13B" },
    light: { with: "#1E7A4C", against: "#1B5FA6", split: "#B46F12" }
  };
  /* ONE strength for the fill, set here and not by the caller: the terrain has
     to read through it and the three hues have to stay apart at half scale,
     and there is exactly one wash that does both. */
  var FILL_ALPHA = 0.42;
  /* The two edges. The AREA line is thin and quiet - it says where one tribe's
     ground ends and its neighbour's begins, inside a block that is one story -
     and the CONFEDERATION line is heavy over a halo casing, the way every line
     on these maps survives terrain shading. */
  var AREA_W = 1.1, AREA_MIN = 1, BLOCK_W = 3.0, BLOCK_MIN = 2.4, BLOCK_CASE = 3;

  function token(name) {
    try {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(name).trim();
    } catch (e) { return ""; }
  }
  function tone(P, stance) {
    var deck = P && P.theme === "light";
    return token("--tribe-" + stance + (deck ? "-deck" : "")) ||
      FALLBACK[deck ? "light" : "dark"][stance];
  }
  function features(fc) {
    return (fc && fc.features) || [];
  }
  /* Which of the three the LAYER actually carries. The key is built from this
     and not from the closed list above, because a row naming a colour that is
     not on the picture sends the reader hunting for it - the same rule the
     gains row and the heat scale already keep. */
  function stances(G) {
    var seen = {};
    features(G && G.tribes).forEach(function (f) {
      seen[(f.properties || {}).stance] = true;
    });
    return STANCES.filter(function (s) { return seen[s]; });
  }

  /* ---- the fills and the two edges ------------------------------------------ */

  function fills(ctx, p, P, u, G) {
    var R = D();
    if (!G || !features(G.tribes).length) return;
    STANCES.forEach(function (stance) {
      var any = false;
      ctx.beginPath();
      features(G.tribes).forEach(function (f) {
        if ((f.properties || {}).stance !== stance) return;
        any = true;
        R.polyPath(ctx, p, f.geometry);
      });
      if (!any) return;
      ctx.globalAlpha = FILL_ALPHA;
      R.paintShape(ctx, { fill: tone(P, stance) });
      ctx.globalAlpha = 1;
    });
    /* THE THIN LINE ROUND EVERY AREA. One path for all of them: the areas are
       dissolved upstream and do not overlap, so a shared edge is drawn once. */
    ctx.beginPath();
    features(G.tribes).forEach(function (f) { R.polyPath(ctx, p, f.geometry); });
    R.paintShape(ctx, { stroke: R.alpha(P.ink, 0.45),
      width: Math.max(AREA_MIN, AREA_W * u) });
    /* AND THE THICK ONE ROUND EVERY CONFEDERATION, over a casing in the map's
       own halo colour so it reads across the hillshade. Last, so no area edge
       is laid on top of it. */
    if (!features(G.tribe_blocks).length) return;
    var w = Math.max(BLOCK_MIN, BLOCK_W * u);
    var block = function (style) {
      ctx.beginPath();
      features(G.tribe_blocks).forEach(function (f) {
        R.polyPath(ctx, p, f.geometry);
      });
      R.paintShape(ctx, style);
    };
    block({ stroke: P.halo, width: w + BLOCK_CASE * u });
    block({ stroke: P.ink, width: w });
  }

  /* ---- the names ------------------------------------------------------------ */

  /* THREE SIZES, ONE HIERARCHY. A confederation's name is the biggest thing on
     the picture after nothing - it is the unit the reader is meant to see first
     - a top-level area that belongs to no confederation prints at the same
     rank, and a member tribe inside a block prints smaller and quieter, because
     it is a subdivision of a name already on the map. All three are multiples
     of the map's own base size, so they scale with the canvas and stay over the
     13.5 CSS px map-name floor (MAP_RULES.md rule 2a) on every shape. */
  var BLOCK_TEXT = 1.45, AREA_TEXT = 1.12, MEMBER_TEXT = 0.95;
  /* Where a name may stand: on its own label point first - the interior point
     the dissolve computed, or the override the author wrote - and then round
     it, near before far. An AREA has no one pixel, so any side is as true as
     any other; what is not allowed is landing on something already painted. */
  var SIDES = ["c", "n", "s", "e", "w", "ne", "nw", "se", "sw"];
  var RINGS = [0, 10, 20];

  function place(ctx, p, P, R, u, W, H, taken, at, he, size, o) {
    if (!he || !at || typeof at[0] !== "number" || typeof at[1] !== "number") {
      return false;
    }
    /* Off this frame is a FRAMING decision, not a placement failure: a square
       crop of a country map loses the ends of it by design. */
    if (!p.inside(at[0], at[1], 0)) return false;
    var q = p(at[0], at[1]), spec = null;
    RINGS.some(function (extra) {
      return SIDES.some(function (a) {
        var s = R.place(ctx, he, q[0], q[1], a, size, extra * u, u, W, H);
        var b = s.box;
        var free = b.x0 >= 0 && b.x1 <= W && b.y0 >= 0 && b.y1 <= H &&
          !taken.some(function (t) { return R.overlaps(b, t); });
        if (free) spec = s;
        return free;
      });
    });
    if (!spec) return false;
    R.text(ctx, P, spec.str, spec.x, spec.y, { size: size, weight: o.weight,
      halo: 3 * u, align: spec.align, baseline: spec.baseline, color: o.color });
    taken.push(spec.box);
    if (window.DossierMapInk) DossierMapInk.word(spec.box, o.tag);
    if (window.DossierMapCheck) {
      DossierMapCheck.add(o.req ? "req_labels" : "labels", 1);
    }
    return true;
  }

  /* A REQUIRED NAME THAT FOUND NOWHERE IS NEVER DROPPED IN SILENCE
     (MAP_RULES.md rule 6). It is handed to dossier_map_ink.js, which holds it
     until every word on the picture is down and then either forgives it -
     because some other label already prints that word - or files it as a
     dropped required label, which fails the picture. An OPTIONAL member tribe
     yields instead, with one console line: its ground is coloured and its
     confederation is named above it, so the reader is not sent hunting. */
  function lost(req, key, he) {
    if (req && window.DossierMapInk) return DossierMapInk.pending(key, he);
    if (req && window.DossierMapCheck) return DossierMapCheck.drop(key);
    console.warn("dossier map tribes: the member tribe " + he +
      " found no free spot on its own ground and is not printed");
  }

  function names(ctx, p, P, u, ts, G, taken, W, H, size, points) {
    var R = D();
    if (!G || !features(G.tribes).length) return;
    var jobs = [];
    features(G.tribe_blocks).forEach(function (f) {
      var pr = f.properties || {};
      jobs.push({ at: pr.label_at, he: pr.name_he, key: "block " + pr.id,
                  size: size * BLOCK_TEXT, weight: 700, color: P.ink, req: true });
    });
    features(G.tribes).forEach(function (f) {
      var pr = f.properties || {}, member = pr.tier === 2;
      jobs.push({ at: pr.label_at, he: pr.name_he, key: "tribe " + pr.id,
                  size: size * (member ? MEMBER_TEXT : AREA_TEXT),
                  weight: member ? 500 : 600,
                  color: member ? P.govLabel : P.muted, req: !member });
    });
    /* REQUIRED FIRST, exactly as the place names are placed (rule 6): a name
       the picture cannot do without must not lose its ground to one it can. */
    jobs.filter(function (j) { return j.req; })
      .concat(jobs.filter(function (j) { return !j.req; }))
      .forEach(function (j) {
        /* A NARROW CANVAS DROPS THE MEMBERS, the same trade every tier-2 name
           on this board makes: at 340 CSS px a confederation's name and four of
           its tribes cannot all be read, and the block name is the one that
           tells the reader what he is looking at. */
        if (!j.req && W < 700) return;
        var ok = place(ctx, p, P, R, u, W, H, taken, j.at, j.he, j.size,
          { weight: j.weight, color: j.color, req: j.req, tag: j.key + " " + j.he });
        if (!ok && j.at && p.inside(j.at[0], j.at[1], 0)) {
          lost(j.req, j.key, j.he);
        }
      });
    /* `points` is what the place names printed; nothing here reads it today,
       and it is taken so a later rule about a tribe sharing a town's name has
       one place to be written rather than a new argument to thread through. */
    return points;
  }

  /* ---- the key -------------------------------------------------------------- */

  /* The words this layer prints in the key. They live beside the drawing they
     name, the way dossier_map_routes.js and dossier_map_heat.js keep theirs,
     rather than in dossier_map_light.js with the words every map shares.

     THE ROW SAYS SUPPORT, NOT CONTROL, in so many words. A row reading only
     "with" beside a green swatch on a map of Yemen would be read as "Houthi
     ground", which is the one thing this picture does not say. */
  var HE = {
    with: "שבטים התומכים בחות'ים",
    against: "שבטים המתנגדים לחות'ים",
    split: "שבטים מפולגים או ניטרליים",
    none: "שטח ללא שבט דומיננטי"
  };

  /* ONLY THE ROWS THIS PICTURE EARNED. The three stance rows are built from the
     stances the LAYER carries, so a key can never name a tone that is not on
     the map; the fourth row is the ground left unpainted, which exists as soon
     as anything is painted at all. With no layer there are no rows, and
     dossier_map_legend.js then draws no box - an empty key is a white rectangle
     floating in a corner. */
  function legendRows(ctx, P, u, map) {
    var R = D(), G = (typeof GEO !== "undefined" && GEO) ? GEO : null;
    var here = stances(G);
    if (!here.length) return [];
    var rows = here.map(function (s) {
      return { fill: R.alpha(tone(P, s), FILL_ALPHA), label: HE[s],
               stroke: R.alpha(P.ink, 0.45), width: Math.max(AREA_MIN, AREA_W * u) };
    });
    /* The unpainted row shows the swatch's own land and the same thin edge, so
       the reader sees exactly what ground with no dominant tribe looks like
       beside the three that have one. */
    rows.push({ label: HE.none, stroke: R.alpha(P.ink, 0.45),
                width: Math.max(AREA_MIN, AREA_W * u) });
    return rows;
  }

  return { fills: fills, names: names, legendRows: legendRows,
           stances: stances };
})();

window.DossierMapTribes = DossierMapTribes;
