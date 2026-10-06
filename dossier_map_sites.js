/* THE SITE SYMBOLS: an airport is a plane, an oil facility is a drop.

     window.DossierMapSites = { paint, KINDS }

   Ziv, 2026-10-03: *"make like airports and oil the places, mark them with a
   mark of that. Don't just put a point."* A town dot in open desert read as a
   town with nothing there. Of four looks on one sheet he picked the SOLID DARK
   SYMBOL: the ink over a thin halo, no badge, no new hue - the same vocabulary
   as the square, the triangle and the ring, and the key says in words which is
   which. A derrick was drawn first for oil and turned into a blot at phone
   size, worst on a city's own outline; the drop stays a drop.

   WHICH place gets a symbol is DATA, never a name match: the place's own record
   carries `site` (data\gazetteer.json, checked by build_schema.py), the build
   turns it into the label's `kind` (scripts\dossier_maps_marks.py), and the
   painter reads nothing but that kind.

   The sizes live with the other marks' in dossier_map_routes.js (`SCALE`): the
   radius handed in here is the FINAL one, the same number the name placer and
   the ink check keep clear, so a name can never stand on the symbol. Each path
   is written inside a box of half-side 1, and that SQUARE is the box the ink
   check holds for it (dossier_map_ink.js, no `TALL` entry). Do not narrow it
   to the drop's own width: the name placer stands a name at the radius, and
   against a narrower box the name counted as too far from its own mark (rule
   8) - the Aramco name lost its only free side and the drop left the picture.

   Loaded BEFORE dossier_map_routes.js, whose `mark` asks here first. */
"use strict";

var DossierMapSites = (function () {
  /* a top-view plane, nose up: the right half, mirrored for the left */
  var PLANE = [[0.13, -0.78], [0.15, -0.22], [1.0, 0.36], [1.0, 0.55], [0.15, 0.26],
               [0.12, 0.60], [0.48, 0.86], [0.48, 1.0], [0, 0.90]];
  var DROP = 0.94;      /* the drop's half-height, so its round end ends at 1 */
  var KEY = 1.25;       /* a key swatch is drawn this much over the row's radius:
                           a silhouette holds less ink than a square as wide */

  function plane(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x - 0.13 * s, y - 0.78 * s);
    ctx.quadraticCurveTo(x, y - 1.2 * s, x + 0.13 * s, y - 0.78 * s);
    PLANE.slice(1).forEach(function (q) { ctx.lineTo(x + q[0] * s, y + q[1] * s); });
    PLANE.slice(0, 8).reverse().forEach(function (q) { ctx.lineTo(x - q[0] * s, y + q[1] * s); });
    ctx.closePath();
  }
  function drop(ctx, x, y, r) {
    var s = r * DROP;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.bezierCurveTo(x + 0.55 * s, y - 0.25 * s, x + 0.72 * s, y + 0.1 * s, x + 0.72 * s, y + 0.34 * s);
    ctx.arc(x, y + 0.34 * s, 0.72 * s, 0, Math.PI, false);
    ctx.bezierCurveTo(x - 0.72 * s, y + 0.1 * s, x - 0.55 * s, y - 0.25 * s, x, y - s);
    ctx.closePath();
  }
  var KINDS = { airport: plane, oil: drop };

  /* -> true when `kind` is a site and its symbol was painted; false hands the
     mark back to the caller's own shapes. `swatch` is the key's copy.
     On the editable slide a silhouette is no single office shape, so it is
     recorded as a small picture, the way the key's richer swatches are. */
  function paint(ctx, P, x, y, r, u, kind, swatch) {
    var path = KINDS[kind];
    if (!path) return false;
    var s = swatch ? r * KEY : r, lift = Math.max(1, 1.2 * u), m = s + lift + 2;
    var draw = function (c) {
      c.save();
      c.lineJoin = "round"; c.setLineDash([]);
      path(c, x, y, s);
      c.strokeStyle = P.halo; c.lineWidth = 2 * lift; c.stroke();
      c.fillStyle = P.ink; c.fill();
      c.restore();
    };
    var D = window.DossierMapDraw;
    if (!(D && D.recImage && D.recImage(ctx, x - m, y - m, 2 * m, 2 * m, draw))) draw(ctx);
    return true;
  }

  return { paint: paint, KINDS: KINDS };
})();

window.DossierMapSites = DossierMapSites;
