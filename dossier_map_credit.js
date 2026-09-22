/* THE MAP SOURCE'S CREDIT, PAINTED ON A STREET PICTURE (2026-09-23).

   A `ground: "streets"` record is drawn on Esri Canvas basemap tiles
   (scripts\relief_streets.py), and their terms ask that the credit appear
   wherever the tiles appear. The HTML block already prints it under the
   caption (dossier_map_block.js, `creditLine`), but an exported PNG leaves the
   page without its caption - so the picture carries the line itself.

   WHAT IT IS: ONE line of small Latin text, left to right, in the bottom-LEFT
   corner, in the theme's own ink at reduced alpha over a faint rounded strip
   of the key box's colour. The words are the relief entry's own
   `attribution` (GEO.relief.<frame>.attribution, written by relief_prep.py
   through geo_prep.py) - never a literal here, so the two cannot drift.

   GATED ON THE RECORD'S `ground === "streets"`, a VALUE read: the relief
   entry carries no `kind` field for the page, and a terrain map has its
   credit on the deck's title slide already. A terrain map gets nothing.

   WHEN: after the ground and before any mark or name, from dossier_map.js,
   and its box goes into the same `taken` list every placer walks round, so
   no disc, no name and no key lands on it.

   THE FLOOR: 15 CSS px on every pass - `15 * u` on a canvas painted at
   u = W / 1280, and never under 15 real pixels on the page, whose canvas is
   laid out in CSS pixels. A line that will not fit in one row at that size
   (the 340 px phone canvas) is NOT shrunk and NOT wrapped: it is left off,
   and the HTML credit under the same canvas says it.

   NO ES modules - the page runs from file://. One global, loaded before
   dossier_map.js; optional at runtime, every caller guards on it:

     window.DossierMapCredit = { paint(ctx, P, u, W, H, map, taken) }       */
"use strict";

var DossierMapCredit = (function () {
  var FLOOR = 15;            /* CSS px - the picture check's text floor */
  var INK_ALPHA = 0.78, STRIP_ALPHA = 0.62;
  var FONT = '"Heebo", "Segoe UI", sans-serif';

  function textOf(map) {
    var G = (typeof GEO !== "undefined" && GEO) ? GEO : null;
    var e = G && G.relief && map ? G.relief[map.frame] : null;
    return e && e.attribution ? String(e.attribution).trim() : "";
  }

  /* Paints the line and returns its box, or null when nothing was painted. */
  function paint(ctx, P, u, W, H, map, taken) {
    if (!map || map.ground !== "streets") return null;
    var str = textOf(map);
    if (!str) return null;
    var k = u > 0 ? u : 1;
    var size = Math.max(FLOOR, FLOOR * k);
    var pad = Math.max(4, 5 * k), edge = Math.max(8, 12 * k);
    ctx.save();
    ctx.direction = "ltr";
    ctx.font = "400 " + size + "px " + FONT;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    var w = ctx.measureText(str).width, h = size * 1.3;
    var box = { x0: edge, y0: H - edge - h - 2 * pad,
                x1: edge + w + 2 * pad, y1: H - edge };
    if (box.x1 > W - edge) {
      ctx.restore();
      console.info("dossier map credit: " + (map.id || "?") + " at " +
        Math.round(W) + "px has no room for the credit line at " +
        FLOOR + "px; the line under the picture carries it");
      return null;
    }
    ctx.globalAlpha = STRIP_ALPHA;
    ctx.fillStyle = P.box || P.halo || "#FFFFFF";
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, 6 * k);
    } else {
      ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
    }
    ctx.fill();
    ctx.globalAlpha = INK_ALPHA;
    ctx.fillStyle = P.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(str, box.x0 + pad, (box.y0 + box.y1) / 2);
    ctx.restore();
    /* Told to the picture check like every other string (dossier_map_draw.js
       `text`): its contract is CSS px on a 1280 canvas. */
    if (window.DossierMapCheck) DossierMapCheck.text(size / k);
    if (taken) taken.push(box);
    return box;
  }

  return { paint: paint };
})();

window.DossierMapCredit = DossierMapCredit;
