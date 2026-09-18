/* HOW HARD EACH FRONT IS BEING FOUGHT, as a colour on the belt itself.

   A dossier map record may carry `heat`:

     map.heat = { window: {from, to},
                  fronts: [{front, level, date, src}, ...] }   // 12 entries

   `front` is a GEO.fronts feature's `properties.id` and `level` is 1..5. The
   build guarantees all twelve are there; a belt this file cannot find a level
   for is painted the ordinary contested wash rather than left blank or guessed
   at, so a data gap shows as "no reading" and never as "quiet".

   WHY A COLOUR AND NOT A WIDTH. A belt's width is already spoken for - it is
   12 km of sourced contact either side of the line (UI.md, "A front is a BELT
   ON THE LINE") - so thickening one would say the fighting covers more ground
   than the source said. A rank on this board is a colour scale with a key, and
   nothing else.

   EACH BELT IS FILLED ON ITS OWN, one beginPath/fill per feature, which the
   single even-odd path in draw.js could not do. That is only safe because the
   build refuses a front shape that is not a simple ring and refuses any two
   that overlap (UI.md L174-219): no fill here can punch a hole in another.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapHeat = { fronts, legendRows, ramp }

   ground() in dossier_map_draw.js calls fronts() in place of the one contested
   fill and then paints its hatch, its outline and its red diamond on top,
   unchanged; the legend calls legendRows(). The shared helpers come from
   DossierMapDraw at call time, so the files may load in any order. The Hebrew
   words of the scale are authored HERE, the way dossier_map_zones.js owns its
   own - they name this layer's five steps and no other file has a use for them. */
"use strict";

var DossierMapHeat = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_heat: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  /* FIVE STEPS, MONOTONE IN LIGHTNESS, one set per ground. On the light deck
     the scale runs pale to deep, the ordinary reading of "more"; on the dark
     board it must run the other way - a near-black step 5 would vanish into the
     board instead of shouting - so it runs deep to bright. Neither end is the
     red of the fighting-zone diamond (#E01B0F light): the deepest light step
     #A50F15 is darker and far less orange, so a mark still reads on top of the
     ground it marks. */
  var RAMP = {
    light: ["#FEE5D9", "#FCAE91", "#FB6A4A", "#DE2D26", "#A50F15"],
    dark: ["#4A1512", "#7E2318", "#B1301C", "#DC5A2A", "#F59A4B"]
  };
  /* The key's five rows. A number AND a word on every one: the number is what
     the reader matches against the colour, the word is what it means. */
  var WORDS = ["1 — שקט יחסית", "2 — לחימה מועטה", "3 — לחימה מתונה",
               "4 — לחימה כבדה", "5 — הלחימה הכבדה ביותר"];

  /* A GLOW UNDER THE BELTS (2026-09-17). A belt is 12 km of sourced contact on
     a frame 500 km across, which is three pixels: the scale was right and
     unreadable, and a reader had to hunt for the colour before it could tell
     them anything. So every belt's ring is stroked in its own level colour,
     wide and soft, before the fills go down - the fighting is not spread any
     wider (the fill, the hatch and the outline still say exactly where it is),
     but the ATTENTION is. Ascending level, so where two glows meet the hotter
     one is on top and the eye is not sent to the quieter front. */
  var GLOW_W = 22, GLOW_A = 0.32;

  /* Takes a palette or a bare theme name, because the HTML key under the
     picture (dossier_map_block.js) has only the name. */
  function ramp(P) {
    var t = typeof P === "string" ? P : (P && P.theme);
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
      if (isFinite(n) && n >= 1 && n <= 5) out[r.front] = n;
    });
    return out;
  }

  /* Painted at the SAME fade the contested wash uses, so a heat map over the
     terrain keeps the relief readable exactly as the plain one does; the hatch,
     the outline and the diamond that follow in ground() are never washed back
     and are not this function's business. */
  function fronts(ctx, p, P, u, G, heat, opt) {
    var R = D(), o = opt || {}, colors = ramp(P), lv = levels(heat), list = [];
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
     steps take its place, in its place in the list - so the key never names a
     colour that is not on the picture, and never leaves one on the picture
     unnamed. The row that leaves is carrying the hatch pattern the belts are
     drawn with, built against the canvas the legend was measured on, so each
     scale row reuses it and a swatch still reads as a fighting zone rather than
     as a plain square. */
  function legendRows(P, u, map, rows) {
    var list = (rows || []).slice(), at = -1, i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].mark && list[i].hatch) { at = i; break; }
    }
    if (at < 0) return list;
    var old = list[at];
    var scale = ramp(P).map(function (c, n) {
      return { fill: c, hatch: old.hatch, stroke: old.stroke, dash: old.dash,
               width: old.width, label: WORDS[n] };
    });
    /* AND ONE ROW FOR THE MARK, under the scale. Every belt still carries the
       red diamond, whatever its level, and a mark on the map with no row in the
       key is a mark nobody can read - so the row the scale replaced hands its
       own words and its own swatch straight back, minus the one fill that is no
       longer on this picture. Once, never per level: the diamond says the same
       thing on all five. */
    scale.push({ hatch: old.hatch, stroke: old.stroke, dash: old.dash,
                 width: old.width, mark: true, label: old.label });
    return list.slice(0, at).concat(scale, list.slice(at + 1));
  }

  /* `words` is exported so the HTML key under the picture prints THE SAME five
     labels in the same order - one list, two keys, no chance of drift. */
  return { fronts: fronts, legendRows: legendRows, ramp: ramp, words: WORDS };
})();

window.DossierMapHeat = DossierMapHeat;
