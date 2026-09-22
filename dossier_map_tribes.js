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

  /* THREE SIZES, ONE HIERARCHY: a confederation is the unit the reader is
     meant to see first, a top-level area belonging to no confederation prints
     at the same rank, and a member tribe inside a block prints smaller and
     quieter, being a subdivision of a name already on the map. All three are
     multiples of the map's base size, so they scale with the canvas and stay
     over the 13.5 CSS px map-name floor (rule 2a) on every shape. */
  var BLOCK_TEXT = 1.45, AREA_TEXT = 1.06, MEMBER_TEXT = 0.80;
  /* THE MULTIPLIER GOES INSIDE THE FLOOR, never on top of it (measured at
     390 CSS px, 2026-09-22): `size` is already floored at 17, and multiplying
     THAT by 1.45 painted a confederation at 25 px on a 340 px canvas and
     dropped a required name. This way the ranks keep their order wherever
     there is room and collapse onto the one floor where there is none. */
  function ranked(u, ts, mult) { return Math.max(17, 17 * u * ts * mult); }
  /* BIGGEST GROUND FIRST INSIDE A RANK: whoever is placed first takes the
     room, and in id order Yafa lost its name to two neighbours a third of its
     size. Degrees squared off the lon/lat box, which costs no projection. */
  function span(geom) {
    var polys = (geom || {}).type === "Polygon" ? [geom.coordinates]
      : (geom || {}).type === "MultiPolygon" ? geom.coordinates : [], big = 0;
    polys.forEach(function (poly) {
      var xs = poly[0].map(function (c) { return c[0]; });
      var ys = poly[0].map(function (c) { return c[1]; });
      big = Math.max(big, (Math.max.apply(null, xs) - Math.min.apply(null, xs)) *
        (Math.max.apply(null, ys) - Math.min.apply(null, ys)));
    });
    return big;
  }
  /* Where a name may stand: on its own label point first - the interior point
     the dissolve computed, or the override the author wrote - then on the
     derived point below, and round each of those, near before far. An AREA has
     no one pixel, so any side is as true as any other; what is not allowed is
     landing on something already painted. The rings are measured in the NAME'S
     OWN HEIGHT, so the search reaches as far relative to the word on a phone as
     it does on a slide. */
  var SIDES = ["c", "n", "s", "e", "w", "ne", "nw", "se", "sw"];
  var RINGS = [0, 0.55, 1.1, 1.8];

  /* AND THE SECOND POINT IS DERIVED, not authored (rule 10's lesson): out of
     the label point, along a dozen rows, the middle of the WIDEST unbroken run
     of its OWN ground. Tihama's dissolved point sits at the EAST EDGE of its
     plain, so every spot round it put half the box at sea. */
  function widest(ctx, q, size) {
    var step = size * 0.4, best = 0, pt = null, r, y, a, b, far = 60 * step;
    for (r = -6; r <= 6; r++) {
      y = q[1] + r * step;
      if (!ctx.isPointInPath(q[0], y)) continue;
      for (a = q[0]; a > q[0] - far && ctx.isPointInPath(a - step, y); a -= step);
      for (b = q[0]; b < q[0] + far && ctx.isPointInPath(b + step, y); b += step);
      if (b - a > best) { best = b - a; pt = [(a + b) / 2, y]; }
    }
    return pt;
  }

  /* THE NAME TOUCHES ITS OWN GROUND (MAP_RULES.md rule 8, measured 2026-09-22).
     The ring search reaches a word-width sideways and threw Razih's name into
     Saudi water and half of Khawlan bin Amir's into the Red Sea, all scored
     `ok`. Demanding the box CENTRE on its own ground was the first fix and was
     too strict - Yafa and most of the highland members went silent, which reads
     worse than a word that overhangs. So the test is rule 8's: the box OVERLAPS
     its own ground, or is joined to it by a LEADER (`aside`), and the
     best-covered free spot wins, nearest ring first. */
  var GX = 5, GY = 3;
  function cover(ctx, b) {
    var n = 0, i, k;
    for (i = 0; i < GX; i++) {
      for (k = 0; k < GY; k++) {
        if (ctx.isPointInPath(b.x0 + (b.x1 - b.x0) * (i + 0.5) / GX,
                              b.y0 + (b.y1 - b.y0) * (k + 0.5) / GY)) n++;
      }
    }
    return n / (GX * GY);
  }
  /* AND NO NAME LIES ON THE SEA. A spot not WHOLLY inside its own colour is
     asked a second question, against YEMEN and not against "land": with the
     whole coastline as the test Subayhi's name stood on DJIBOUTI with its
     leader across the Bab al-Mandab, and Razih's on the Saudi side of the
     border - as false as one at sea. How much of the box must be on Yemen is
     rule 10's own 85%: demanding every sample cost six names for nothing. */
  var ON_YEM = 0.85;
  function yemen(ctx, p, R) {
    var G = (typeof GEO !== "undefined" && GEO) ? GEO : null;
    if (!G || !features(G.yem_adm0).length) return false;
    ctx.beginPath();
    features(G.yem_adm0).forEach(function (f) { R.polyPath(ctx, p, f.geometry); });
    return true;
  }
  /* Inside the canvas, on nobody's word, and clear of a leader already drawn -
     a line over a word is a hard fault either way round (rule 4). */
  function open(R, b, W, H, taken, lanes) {
    var L = window.DossierMapLeader;
    return b.x0 >= 0 && b.x1 <= W && b.y0 >= 0 && b.y1 <= H &&
      window.DossierMapTribesFit.room(R, b, taken) &&
      !(L && lanes.some(function (rt) {
        return rt.segs.some(function (g) { return L.segBox(g, b); });
      }));
  }
  /* A LONG NAME MAY WRAP ONTO TWO LINES, broken at the space nearest its
     middle, tried only where one line found no spot wholly on its own ground:
     Khawlan bin Amir on one line is five times the width of its block and the
     Tihama name is wider than the coastal plain at any latitude, and both stood
     at sea. A MEMBER never wraps - two short lines read as two names. */
  function twoLines(he) {
    var w = String(he).split(/\s+/), i, cut = -1, gap = 1e9, a, d;
    if (w.length < 2) return null;
    for (i = 1; i < w.length; i++) {
      a = w.slice(0, i).join(" ").length;
      d = Math.abs(a - (String(he).length - a));
      if (d < gap) { gap = d; cut = i; }
    }
    return [w.slice(0, cut).join(" "), w.slice(cut).join(" ")];
  }
  /* A stacked, centred spec: the same shape R.place returns, plus `lines`. */
  function stack(ctx, R, lines, size, weight, q) {
    var w = 0, h = size * 1.25 * lines.length;
    lines.forEach(function (s) { w = Math.max(w, R.width(ctx, s, size, weight)); });
    return { lines: lines, x: q[0], y: q[1], align: "center", baseline: "middle",
             str: lines.join(" "),
             box: { x0: q[0] - w / 2, y0: q[1] - h / 2,
                    x1: q[0] + w / 2, y1: q[1] + h / 2 } };
  }
  function ink(ctx, P, R, u, spec, size, o) {
    var ls = spec.lines || [spec.str], i, step = size * 1.25;
    for (i = 0; i < ls.length; i++) {
      R.text(ctx, P, ls[i], spec.x, spec.y + (i - (ls.length - 1) / 2) * step,
        { size: size, weight: o.weight, halo: 3 * u, align: spec.align,
          baseline: spec.baseline, color: o.color });
    }
  }

  function place(ctx, p, P, R, u, W, H, taken, lanes, at, he, size, o) {
    if (!he || !at || typeof at[0] !== "number" || typeof at[1] !== "number") {
      return false;
    }
    /* Off this frame is a FRAMING decision, not a placement failure: a square
       crop of a country map loses the ends of it by design. */
    if (!p.inside(at[0], at[1], 0)) return false;
    var from = [p(at[0], at[1])], list = [], spec = null, whole = false, wide;
    var wrap = o.wrap && twoLines(he);
    if (o.geom) {
      ctx.beginPath();
      R.polyPath(ctx, p, o.geom);
      wide = widest(ctx, from[0], size);
      if (wide) from.push(wide);
    }
    function weigh(s) {
      if (!open(R, s.box, W, H, taken, lanes)) return false;
      s.on = o.geom ? cover(ctx, s.box) : 1;
      if (s.on > 0) list.push(s);
      whole = whole || s.on > 0.999;
      return whole;
    }
    from.some(function (q) {
      return RINGS.some(function (extra) {
        return SIDES.some(function (a) {
          return weigh(R.place(ctx, he, q[0], q[1], a, size, extra * size, u, W, H));
        });
      });
    });
    if (wrap && !whole) {
      from.forEach(function (q) { weigh(stack(ctx, R, wrap, size, o.weight, q)); });
    }
    if (!list.length) return false;
    /* Best-covered wins; failing a whole one, the best-covered DRY one does. */
    list.sort(function (a, b) { return b.on - a.on; });
    if (list[0].on > 0.999) spec = list[0];
    else if (yemen(ctx, p, R)) {
      list.some(function (s) {
        if (cover(ctx, s.box) >= ON_YEM) { spec = s; return true; }
        return false;
      });
    }
    if (!spec) return false;
    ink(ctx, P, R, u, spec, size, o);
    taken.push(spec.box);
    if (window.DossierMapInk) DossierMapInk.word(spec.box, o.tag);
    if (window.DossierMapCheck) {
      DossierMapCheck.add(o.req ? "req_labels" : "labels", 1);
    }
    return true;
  }

  /* A NAME THAT FITS NOWHERE ON ITS OWN GROUND IS PRINTED JUST OUTSIDE IT AND
     TIED TO IT BY A LEADER - the connector the callouts already draw
     (dossier_map_leader.js), not a new look. The reach is capped, and a leader
     that cannot reach its ground without crossing a word or another leader is
     refused. WHERE THE LINE TOUCHES DOWN is its own ground at a point NO WORD
     COVERS, found by a spiral out of the label point: `DossierMapLeader.best`
     excuses the box its mark sits inside, which is how three far-north leaders
     came to run through the block name they started under. */
  var ASIDE = 4;            /* how far out, in text heights, a tied name goes */
  function touch(ctx, p, R, geom, q, taken, step) {
    var r, k, a, x, y, hit = null;
    if (!geom) return q;
    ctx.beginPath();
    R.polyPath(ctx, p, geom);
    for (r = 0; r < 9 && !hit; r++) {
      for (k = 0; k < (r ? 12 : 1) && !hit; k++) {
        a = k * Math.PI / 6;
        x = q[0] + Math.cos(a) * r * step;
        y = q[1] + Math.sin(a) * r * step;
        if (ctx.isPointInPath(x, y) && !taken.some(function (t) {
          return x >= t.x0 && x <= t.x1 && y >= t.y0 && y <= t.y1;
        })) hit = [x, y];
      }
    }
    return hit;
  }
  function aside(ctx, p, P, R, u, W, H, taken, lanes, at, he, size, o) {
    var L = window.DossierMapLeader;
    if (!L || !p.inside(at[0], at[1], 0)) return false;
    var h = size * 1.25, w = R.width(ctx, he, size, o.weight), ring, k, ang, b, rt;
    var q = touch(ctx, p, R, o.geom, p(at[0], at[1]), taken, h * 0.6), out = null;
    if (!q) return false;
    var s = { cx: q[0], cy: q[1] };
    if (!yemen(ctx, p, R)) return false;
    for (ring = 1; ring <= ASIDE && !out; ring++) {
      for (k = 0; k < 16 && !out; k++) {
        ang = k * Math.PI / 8;
        b = L.boxAt(q[0] + Math.cos(ang) * (w / 2 + h * ring),
                    q[1] + Math.sin(ang) * (h / 2 + h * ring), w, h);
        if (!open(R, b, W, H, taken, lanes) || cover(ctx, b) < ON_YEM) continue;
        rt = L.best(b, s, taken, lanes, 1) || L.best(b, s, taken, lanes, 2);
        if (rt && L.overText(rt, taken, b, null)) rt = null;   /* no excuses */
        if (rt) out = { box: b, route: rt };
      }
    }
    if (!out) return false;
    L.paint(ctx, P, u, out.route);
    ink(ctx, P, R, u, { x: (out.box.x0 + out.box.x1) / 2, str: he,
      y: (out.box.y0 + out.box.y1) / 2, align: "center", baseline: "middle" },
      size, o);
    taken.push(out.box);
    lanes.push(out.route);
    if (window.DossierMapInk) DossierMapInk.word(out.box, o.tag);
    if (window.DossierMapCheck) {
      DossierMapCheck.add(o.req ? "req_labels" : "labels", 1);
    }
    return true;
  }

  /* A REQUIRED NAME THAT FOUND NOWHERE IS NEVER DROPPED IN SILENCE
     (MAP_RULES.md rule 6). It is handed to dossier_map_ink.js, which holds it
     until every word on the picture is down and then either forgives it -
     because some other label already prints that word - or files it as a
     dropped required label, which fails the picture. AN AREA NAME YIELDS
     instead, with one console line: its ground is coloured, the key says what
     the colour means and its confederation - where it has one - is named above
     it, so the reader is never sent hunting for a word that is not there. */
  function lost(req, key, he) {
    if (req && window.DossierMapInk) return DossierMapInk.pending(key, he);
    if (req && window.DossierMapCheck) return DossierMapCheck.drop(key);
    console.warn("dossier map tribes: " + key +
      " found no spot touching its own ground and is not printed");
  }

  /* WHICH OF THESE NAMES THE PICTURE CANNOT DO WITHOUT (measured 2026-09-22):
     the four CONFEDERATIONS, and only those. A top-level area's name is placed
     right after them and before any member, but it YIELDS rather than fail the
     picture, because on the wide export a tribe's name is wider than the tribe
     is: at 2560 the area rank paints about 38 CSS px, and Khawlan al-Tiyal's
     word is longer than the 0.73 degrees of ground it stands on, with Sanaa,
     Hashid, Murad and Marib already printed round it. Requiring all sixteen was
     a demand no canvas could meet - the wide export dropped one and the 390 px
     phone six - and rule 8 is plain that a name with nowhere adjacent is not
     printed far away. Nothing the record's own prose names is in this list:
     the caption talks about colours, and the key carries those. */
  function names(ctx, p, P, u, ts, G, taken, W, H, size, points) {
    var R = D(), narrow = W < 700, lanes = [];
    if (!G || !features(G.tribes).length) return;
    var jobs = [];
    features(G.tribe_blocks).forEach(function (f) {
      var pr = f.properties || {};
      jobs.push({ at: pr.label_at, he: pr.name_he, key: "block " + pr.id,
                  size: ranked(u, ts, BLOCK_TEXT),
                  geom: f.geometry,
                  /* REQUIRED EVERYWHERE BUT ON A PHONE. At 340 CSS px the name
                     is floored at 17 px while its ground shrinks with the
                     canvas, so Khawlan bin Amir's word is several times the
                     width of the ground it must stand on and the ground test
                     above can pass nowhere. Rule 7 already makes this trade for
                     every other name on a phone; failing the picture instead
                     would only buy the word back by printing it at sea. */
                  weight: 700, color: P.ink, req: !narrow, rank: 0,
                  wrap: true, big: span(f.geometry) });
    });
    features(G.tribes).forEach(function (f) {
      var pr = f.properties || {}, member = pr.tier === 2;
      jobs.push({ at: pr.label_at, he: pr.name_he, key: "tribe " + pr.id,
                  geom: f.geometry,
                  size: ranked(u, ts, member ? MEMBER_TEXT : AREA_TEXT),
                  weight: member ? 500 : 600, wrap: !member,
                  color: member ? P.govLabel : P.muted,
                  req: false, rank: member ? 2 : 1, big: span(f.geometry) });
    });
    /* BLOCKS, THEN AREAS, THEN MEMBERS - biggest rank first, exactly as the
       place names are placed (rule 6): a name the picture leans on must not
       lose its ground to one it can spare. */
    jobs.sort(function (a, b) { return a.rank - b.rank || b.big - a.big; });
    jobs.forEach(function (j) {
      /* A NARROW CANVAS DROPS THE MEMBERS, the trade every tier-2 name on this
         board makes: at 340 CSS px a confederation and four of its tribes
         cannot all be read, and the block name is what says what this is.
         `fit` (dossier_map_tribes_fit.js) offers the same placement once more,
         one step smaller, where the authored rank found nowhere. */
      if (j.rank === 2 && narrow) return;
      var o = { weight: j.weight, color: j.color, req: j.req,
                geom: j.geom, wrap: j.wrap, tag: j.key + " " + j.he };
      var ok = DossierMapTribesFit.fit(place, ctx, p, P, R, u, W, H,
        taken, lanes, j, o);
      /* NOTHING ON ITS OWN GROUND, at either size: print it beside the ground
         with a leader before giving it up - what keeps Yafa and the highland
         members on the picture at all. */
      if (!ok && j.at) {
        ok = aside(ctx, p, P, R, u, W, H, taken, lanes, j.at, j.he, j.size, o);
      }
      if (!ok && j.at && p.inside(j.at[0], j.at[1], 0)) lost(j.req, j.key, j.he);
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
