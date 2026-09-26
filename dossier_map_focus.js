/* ONE FRONT STRONG, THE OTHERS QUIET - and a chip that prints a RANK.

   The Word report's pictures (ROUND 4b, 2026-09-25). Two fields the validator
   (scripts\dossier_maps_focus.py) turns into the record's `heat` block:

     heat.focus / focus_he - a front close-up is ABOUT one front. Its belt is
       the heat painter's own belt (glow + fill in its 1-10 activity colour, the
       hatch, the diamond, the chip) plus a firm outline; every other belt stays
       on the map, QUIET: faded wash, faded thin hatch, faded diamond, no chip.
       The emitted heat holds only the focused belt, so the chip, the audit and
       the key all see one scored belt without being told.
     heat.numbers - {front id: n}: the chip prints n, the front's place in the
       report's table and on the tab, in its score's colour. The key's colour
       rows lose their digits (a "4" in the key must not read as front 4) and
       one row says what the number is.

   HOW IT GETS IN WITHOUT A LINE IN THE CAPPED FILES. dossier_map.js merges its
   painters last-wins into the one object whose `ground` it calls, and the heat
   file is on that list: it exports `ground` as a call to THIS file's ground(),
   which hands every picture without `heat.focus` straight to dossier_map_draw's
   ground() with the same arguments - so every other map is painted exactly as
   before. A focus picture's ground() gets a copy of the geography whose
   `fronts` holds only its own belt, so the ordinary hatch, outline and diamond
   land on that belt alone; the quiet ones are painted by quiet(), which the
   heat painter's fronts() calls first thing - under the belt fills, at the
   z-order the belts always had. The ink reservation (dossier_map_ink.js) still
   reserves every diamond, and every diamond is still painted.

   NO ES modules - the page runs from file://. One global:
     window.DossierMapFocus = { ground, quiet, keyRows } */
"use strict";

var DossierMapFocus = (function () {
  /* How quiet: measured by eye on the east and aden frames at half scale - the
     belts still read as belts, and none competes with the focused one. */
  var Q_FILL = 0.5, Q_LINE = 0.4, Q_MARK = 0.5;
  var ACT = "מדד פעילות";
  /* Short on purpose: a wider key cost the overview Harad at 1230px. */
  var NUM_WORD = "המספר: מקום החזית בדוח";
  var QUIET = null;   /* the other belts, for the length of ONE ground() call */

  function D() { return window.DossierMapDraw; }
  function on(o) { return !!(o && o.heat && o.heat.focus); }

  function ground(ctx, p, P, u, W, H, G, o) {
    var R = D();
    if (!on(o) || !G || !G.fronts) return R.ground(ctx, p, P, u, W, H, G, o);
    var id = o.heat.focus, mine = [], rest = [], G2 = {}, k;
    R.eachFeature(G.fronts, function (f) {
      ((f.properties || {}).id === id ? mine : rest).push(f);
    });
    for (k in G) G2[k] = G[k];
    G2.fronts = { type: "FeatureCollection", features: mine };
    QUIET = { type: "FeatureCollection", features: rest };
    var out;
    try { out = R.ground(ctx, p, P, u, W, H, G2, o); } finally { QUIET = null; }
    if (!o.clean && o.fronts !== false) outline(ctx, p, P, u, mine);
    return out;
  }

  /* THE FIRM OUTLINE, after the ground and before every name: a halo casing
     and the ink over it, so the edge reads on terrain of either tone. */
  function outline(ctx, p, P, u, list) {
    var R = D();
    [[P.halo, Math.max(3, 3.6 * u)], [P.ink, Math.max(1.6, 1.8 * u)]]
      .forEach(function (s) {
        list.forEach(function (f) {
          ctx.beginPath();
          R.polyPath(ctx, p, f.geometry);
          R.paintShape(ctx, { stroke: s[0], width: s[1] });
        });
      });
  }

  /* The quiet belts - the plain map's wash, hatch, outline and diamond, each
     faded, the hatch and its edge thinner. Called by DossierMapHeat.fronts(). */
  function quiet(ctx, p, P, u, o) {
    if (!QUIET || !QUIET.features.length) return;
    var R = D(), a0 = ctx.globalAlpha;
    function each(style) {
      R.eachFeature(QUIET, function (f) {
        ctx.beginPath();
        R.polyPath(ctx, p, f.geometry);
        R.paintShape(ctx, style);
      });
    }
    ctx.globalAlpha = ((o && o.fade) || 1) * Q_FILL;
    each({ fill: P.contested });
    ctx.globalAlpha = Q_LINE;
    each({ fill: R.hatch(ctx, P.contestedStroke, 0.8 * u), stroke: P.contestedStroke,
           width: Math.max(0.6, 0.6 * u), dash: [3 * u, 3 * u] });
    ctx.globalAlpha = Q_MARK;
    if (window.DossierMapLegend) DossierMapLegend.frontMarks(ctx, p, P, u, { fronts: QUIET });
    ctx.globalAlpha = a0;
    ctx.setLineDash([]);
  }

  /* THE KEY. Handed the heat painter's scale rows; a picture with neither
     field gets them back untouched (the same objects - nothing moves). */
  function keyRows(scale, heat, P) {
    var H = window.DossierMapHeat, K = H && H.kit;
    if (!heat || !K) return scale;
    var nums = heat.numbers || null;
    if (heat.focus) {
      var e = (heat.fronts || [])[0], n = e ? e.level : 0;
      var c = H.ramp(P, heat)[n - 1], num = nums && nums[heat.focus];
      /* The front's own name and score, and no more: a longer row widens the
         key, and on report_taiz_kadaha the wider box took a coast town's room. */
      return [{ fill: c, label: (heat.focus_he || heat.focus) + " — " + ACT + " " + n,
        draw: function (cx2, P2, u2, sx, cy, sw, sh) {
          if (num) {
            K.badge(cx2, P2, sx + sw / 2, cy, K.keyR(sw, sh, u2), num, u2, c);
            return;
          }
          cx2.beginPath(); cx2.rect(sx, cy - sh / 2, sw, sh);
          D().paintShape(cx2, { fill: c, stroke: P2.ink, width: Math.max(1.6, 1.8 * u2) });
        } }];
    }
    if (!nums) return scale;
    var slate = H.ramp(P, heat)[0];
    return scale.map(function (r) { return { fill: r.fill, label: r.label }; })
      .concat([{ label: NUM_WORD, draw: function (cx2, P2, u2, sx, cy, sw, sh) {
        K.badge(cx2, P2, sx + sw / 2, cy, K.keyR(sw, sh, u2), 1, u2, slate);
      } }]);
  }

  /* THE HATCHED GROUND AS RECTANGLES (2026-09-26). Ziv, of the Word report's
     front-1 map, where a note sat on the hatched belt and on a pin: "you see
     how the text is on other stuff. Make sure that it's not on other stuff."
     A note may point INTO a belt; its words stand outside it. Every belt the
     picture draws (the focused one and the quiet ones), cut into rows of
     cells and merged into runs, so the note search (dossier_map_notes.js)
     can hold them as bars and its counter can ask them. A cell counts as belt
     when its centre OR any corner is inside, so a run never undershoots the
     edge; the outline's stroke is covered by the pad. */
  function beltBars(p, u, G, map) {
    var out = [], c = 6 * u, pad = 3 * u;
    if (!G || !G.fronts || !map || map.clean || map.fronts === false) return out;
    D().eachFeature(G.fronts, function (f) {
      var g = f.geometry || {};
      var polys = g.type === "Polygon" ? [g.coordinates]
        : g.type === "MultiPolygon" ? g.coordinates : [];
      polys.forEach(function (poly) {
        var rings = poly.map(function (r) {
          return r.map(function (q) { return p(q[0], q[1]); });
        });
        var xs = rings[0].map(function (q) { return q[0]; });
        var ys = rings[0].map(function (q) { return q[1]; });
        var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
        var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
        for (var y = y0 - c; y < y1 + c; y += c) {
          var run = null;
          for (var x = x0 - c; x < x1 + 2 * c; x += c) {
            var hit = x < x1 + c && [[.5, .5], [0, 0], [1, 0], [0, 1], [1, 1]]
              .some(function (k) { return inside(rings, x + k[0] * c, y + k[1] * c); });
            if (hit && !run) run = { belt: true, x0: x - pad, y0: y - pad, x1: x + c + pad, y1: y + c + pad };
            else if (hit) run.x1 = x + c + pad;
            else if (run) { out.push(run); run = null; }
          }
          if (run) out.push(run);
        }
      });
    });
    return out;
  }
  function inside(rings, x, y) {
    var ins = false;
    rings.forEach(function (r) {
      for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
        if ((r[i][1] > y) !== (r[j][1] > y) &&
            x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) ins = !ins;
      }
    });
    return ins;
  }

  return { ground: ground, quiet: quiet, keyRows: keyRows, beltBars: beltBars };
})();

window.DossierMapFocus = DossierMapFocus;
