/* The layer painters behind dossier_map.js: geometry paths, Hebrew text with a
   halo, the ground itself, the shipping lanes and the governorate names.
   dossier_map.js owns the frames, the projection, the palette and the public
   API; it calls into this file at paint time, so the painter files may load in
   any order as long as all of them are on the page before the view draws.

   Split out the day the painter passed the 480-line cap, exactly as the brief
   allowed. The LEGEND and the fighting-zone diamond left for
   dossier_map_legend.js on 2026-09-15, and the relief raster, the fighting
   notes and the assessment arrows went into dossier_map_extra.js the same day.
   THE GAINS OVERLAY left for dossier_map_gains.js on 2026-09-17, when the heat
   painter's hook in ground() brought this file back to its cap.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapDraw = { ... }   (read by the other painter files only)

   Every string painted here is Hebrew; the words the legend needs live in
   dossier_map.js next to the palette, and this file is handed them. */
"use strict";

var DossierMapDraw = (function () {
  var FONT = '"Heebo", "Segoe UI", sans-serif';
  /* A CLEAN map carries almost no text - two port names on the crossing - so
     its few names are set larger than a crowded map could afford. Ziv,
     2026-09-17: "put the Mocha and Djibouti bigger in text". ONE factor, read
     by dossier_map.js for the place names and by dossier_map_routes.js for a
     route's own block, so the two can never drift into a per-label hack. */
  var CLEAN_TEXT = 1.6;
  /* A COUNTRY NAME IS SET IN ITS OWN STYLE (2026-09-17). Ziv, of the crossing:
     *"show the names of the other countries, including Somaliland."* An atlas
     tells a country from a town by the setting, so a `kind: "country"` label is
     larger than the map's own names, letter-spaced, in the quieter governorate
     ink, and carries no mark. The factor multiplies the map's BASE size, never
     the clean one - stacked on CLEAN_TEXT a country name would be the loudest
     thing on a map about a sea route. SPACE is a fraction of the size. */
  var COUNTRY_TEXT = 1.35, COUNTRY_SPACE = 0.12;
  /* What a CLEAN map draws at the edges of countries. Ziv, 2026-09-17: *"make
     the borders in Africa black... make sure it looks like one line."* TWO
     LINES, BECAUSE AN OUTLINE IS TWO THINGS: a COAST, which keeps the shoreline
     stroke, and a BORDER, drawn ONCE in black over a light casing from the
     stretches geo_borders.py cuts out (it holds why, and what the doubling was).
     Governorate and Saudi lines stay faint, or the picture becomes a political
     map of somewhere it is not about. The weight answers two asks of that hour:
     "a lot more visible" took it to 5.5, *"less big"* to 60% of that, 3.3. */
  var CLEAN_COAST = 1.6, CLEAN_BORDER = 3.3, CLEAN_BORDER_HALO = 3,
    CLEAN_BORDER_INK = "#000";

  /* ---- colours ---------------------------------------------------------------- */

  /* "#RGB", "#RRGGBB", "rgb(...)" or "rgba(...)" -> [r, g, b, a]. */
  function parseColor(str) {
    var s = String(str || "").trim(), m;
    if (s[0] === "#") {
      if (s.length === 4) s = "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
      return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16),
              parseInt(s.slice(5, 7), 16), 1];
    }
    m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 1];
    var p = m[1].split(",").map(parseFloat);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  function mix(a, b, t) {
    var A = parseColor(a), B = parseColor(b);
    return "rgb(" + [0, 1, 2].map(function (i) {
      return Math.round(A[i] + (B[i] - A[i]) * t);
    }).join(",") + ")";
  }
  function alpha(color, a) {
    var c = parseColor(color);
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
  }
  function dashOf(str, u) {
    return String(str).split(/\s+/).map(function (n) { return parseFloat(n) * u; });
  }

  /* ---- geometry ---------------------------------------------------------------- */

  function ringPath(ctx, p, ring) {
    for (var i = 0; i < ring.length; i++) {
      var q = p(ring[i][0], ring[i][1]);
      if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
    }
    ctx.closePath();
  }
  function polyPath(ctx, p, geom) {
    if (!geom) return;
    var polys = geom.type === "Polygon" ? [geom.coordinates]
      : geom.type === "MultiPolygon" ? geom.coordinates : [];
    polys.forEach(function (poly) { poly.forEach(function (r) { ringPath(ctx, p, r); }); });
  }
  function linePath(ctx, p, geom) {
    if (!geom) return;
    var lines = geom.type === "LineString" ? [geom.coordinates]
      : geom.type === "MultiLineString" ? geom.coordinates : [];
    lines.forEach(function (line) {
      line.forEach(function (pt, i) {
        var q = p(pt[0], pt[1]);
        if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
      });
    });
  }
  function eachFeature(fc, fn) {
    if (fc && fc.features) fc.features.forEach(fn);
  }
  function paintShape(ctx, style) {
    if (style.fill) { ctx.fillStyle = style.fill; ctx.fill("evenodd"); }
    if (style.stroke && style.width > 0) {
      ctx.strokeStyle = style.stroke; ctx.lineWidth = style.width;
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.setLineDash(style.dash || []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  function fillCollection(ctx, p, fc, style, filter) {
    ctx.beginPath();
    eachFeature(fc, function (f) {
      if (!filter || filter(f)) polyPath(ctx, p, f.geometry);
    });
    paintShape(ctx, style);
  }
  function strokeLines(ctx, p, fc, style) {
    ctx.beginPath();
    eachFeature(fc, function (f) { linePath(ctx, p, f.geometry); });
    paintShape(ctx, style);
  }
  function ringMark(ctx, x, y, r, style) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    paintShape(ctx, style);
  }

  /* Diagonal hatching: an ACTIVE FIGHTING zone is told apart by texture, not by
     a new hue - every hue on the board is spoken for by a front or a verdict,
     and on the light deck its tint sat almost on the government one (Ziv,
     2026-09-11: "a clearer separation"). One tile of a 45-degree line plus the
     two corner stubs, so the tiles join without a seam. */
  function hatch(ctx, color, u) {
    var n = Math.max(6, Math.round(10 * u)), c = document.createElement("canvas");
    c.width = c.height = n;
    var g = c.getContext("2d");
    g.strokeStyle = color; g.lineWidth = Math.max(1, 1.4 * u); g.lineCap = "square";
    g.beginPath();
    g.moveTo(0, n); g.lineTo(n, 0);
    g.moveTo(-1, 1); g.lineTo(1, -1);
    g.moveTo(n - 1, n + 1); g.lineTo(n + 1, n - 1);
    g.stroke();
    return ctx.createPattern(c, "repeat");
  }

  /* ---- text -------------------------------------------------------------------- */

  /* `sp` is letter spacing in px, and it is set AFTER the font because some
     engines reset it with the font. It is always written, so a caller that
     asks for none clears whatever the last caller set. Where the canvas has no
     letterSpacing at all the name is simply unspaced - a country label is still
     larger and quieter than a town, which is the distinction that matters. */
  function setFont(ctx, size, weight, sp) {
    ctx.font = (weight || 500) + " " + size + "px " + FONT;
    if ("letterSpacing" in ctx) ctx.letterSpacing = (sp || 0) + "px";
  }
  /* The scale the picture being painted is drawn at (u = canvas width / 1280),
     remembered by ground() - the first thing every picture paints - so the one
     place every string passes through can report a size the check can compare
     against its one floor. The check's contract is CSS px on a 1280 canvas, so
     a picture drawn at 2560 reports half of what it sets. */
  var SCALE = 1;
  /* AND THE SCALE OF THE WHOLE CANVAS, which on a three-band key-panel picture
     is about twice the map area's (2026-09-19). `SCALE` answers "how big is
     this for the rectangle it is painted in"; `CANVAS` answers "how big is this
     for the reader", and they are the same number on every picture that is not
     split. dossier_map.js sets it once per picture - it is the only file that
     knows the canvas - and a caller that never sets it leaves the two equal,
     which is what every unsplit map wants. */
  var CANVAS = 0;
  /* With no argument it ANSWERS instead of setting: the legend asks it what a
     CSS pixel of the whole picture is worth, to keep its own words above the
     13px floor while it shrinks them to fit a narrow band. */
  function canvasScale(u) {
    if (u === undefined) return CANVAS;
    CANVAS = u > 0 ? u : 0;
    return CANVAS;
  }

  /* Halo first, in the ground colour, so a name over a line stays legible.
     EVERY painted string passes through here, so this is also where the
     picture check is told how small the smallest text on the map got
     (`min_text_px` against the map area, `min_name_px` against the canvas):
     one sink, so a painter that sets its own size cannot be forgotten.
     Guarded - the check file is optional at runtime. */
  function text(ctx, P, str, x, y, o) {
    if (window.DossierMapCheck) {
      DossierMapCheck.text(o.size / (SCALE || 1));
      if (DossierMapCheck.name) DossierMapCheck.name(o.size / (CANVAS || SCALE || 1));
    }
    setFont(ctx, o.size, o.weight, o.spacing);
    ctx.textAlign = o.align || "center";
    ctx.textBaseline = o.baseline || "middle";
    if (o.halo > 0) {
      ctx.lineJoin = "round"; ctx.lineWidth = o.halo;
      ctx.strokeStyle = P.halo; ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = o.color || P.ink; ctx.fillText(str, x, y);
  }
  function width(ctx, str, size, weight, sp) {
    setFont(ctx, size, weight, sp);
    return ctx.measureText(str).width;
  }
  function overlaps(a, b) {
    return !(a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0);
  }
  /* Where a label sits relative to its point: anchor e/w/n/s names the side,
     the four DIAGONALS ne/nw/se/sw sit off a corner of it, and c centres it on
     the point (a country name, never flipped).
     A name that would run off the canvas on its authored side flips to the
     other side - at 600px the Perim name, anchored west, was cut at the edge.
     THE DIAGONALS CAME IN ON 2026-09-18, for the places the map's own text
     talks about: four sides were all a required name ever got, and al-Hazm -
     named in the Marib list - found none of them free and vanished without a
     word. A corner is the room a crowded map has left. Ziv: "you're talking
     about al-Hazm... and you don't show it on the map." */
  var FLIP = [
    { def: "e", of: { nw: "ne", sw: "se" }, hit: function (b) { return b.x0 < 0; } },
    { def: "w", of: { ne: "nw", se: "sw" },
      hit: function (b, W) { return b.x1 > W; } },
    { def: "s", of: { ne: "se", nw: "sw" }, hit: function (b) { return b.y0 < 0; } },
    { def: "n", of: { se: "ne", sw: "nw" },
      hit: function (b, W, H) { return b.y1 > H; } }
  ];
  function place(ctx, str, x, y, anchor, size, r, u, W, H, sp) {
    var w = width(ctx, str, size, 500, sp), h = size * 1.25, g = r + 5 * u;
    /* A diagonal clears the mark by the same g, split between the two axes. */
    var d = g * 0.71;
    var side = function (a) {
      if (a === "c") return { x: x, y: y, align: "center", baseline: "middle",
                              box: { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 } };
      if (a === "w") return { x: x - g, y: y, align: "right", baseline: "middle",
                              box: { x0: x - g - w, y0: y - h / 2, x1: x - g, y1: y + h / 2 } };
      if (a === "n") return { x: x, y: y - g, align: "center", baseline: "bottom",
                              box: { x0: x - w / 2, y0: y - g - h, x1: x + w / 2, y1: y - g } };
      if (a === "s") return { x: x, y: y + g, align: "center", baseline: "top",
                              box: { x0: x - w / 2, y0: y + g, x1: x + w / 2, y1: y + g + h } };
      if (a === "ne" || a === "se" || a === "nw" || a === "sw") {
        var east = a[1] === "e", north = a[0] === "n";
        var tx = east ? x + d : x - d, ty = north ? y - d : y + d;
        return { x: tx, y: ty, align: east ? "left" : "right",
                 baseline: north ? "bottom" : "top",
                 box: { x0: east ? tx : tx - w, y0: north ? ty - h : ty,
                        x1: east ? tx + w : tx, y1: north ? ty : ty + h } };
      }
      return { x: x + g, y: y, align: "left", baseline: "middle",
               box: { x0: x + g, y0: y - h / 2, x1: x + g + w, y1: y + h / 2 } };
    };
    var o = side(anchor), b = o.box;
    if (anchor === "c") { o.str = str; o.size = size; o.spacing = sp; return o; }
    FLIP.some(function (f) {
      if (!f.hit(b, W, H)) return false;
      o = side(f.of[anchor] || f.def);
      return true;
    });
    o.str = str; o.size = size; o.spacing = sp;
    return o;
  }

  /* ---- ground: sea, land, territory, boundaries, front line ------------------- */

  /* The coastline: Saudi Arabia, Yemen and the NEIGHBOUR LAND around the frame
     (Eritrea, Djibouti, Ethiopia, Oman, Somalia, Sudan - `nbr_adm0`, called
     `afr_adm0` until 2026-09-17, when Oman stopped it being an African list).
     The neighbours are plain land and a coastline only, no territory fill: they
     are there so the strait reads as a strait and its narrowness can be seen,
     and nobody on them is party to the map. The outline is a hairline, not the
     border stroke: the coast already shows by the land/sea step, and
     geoBoundaries' Eritrea and Ethiopia do not share one border line, so the
     full stroke drew that border twice (measured). */
  function landPath(ctx, p, G, shore) {
    ctx.beginPath();
    polyPath(ctx, p, G.sau_adm0.features[0].geometry);
    polyPath(ctx, p, G.yem_adm0.features[0].geometry);
    if (shore) eachFeature(G.nbr_adm0, function (f) { polyPath(ctx, p, f.geometry); });
  }
  /* THE GOVERNORATE OUTLINE, seen but quiet (2026-09-19). Ziv, of the Marib
     objectives picture: "the borders between the counties on the Yemeni side,
     you don't see them. Don't make them crazy, but make them seen." They were a
     20%-alpha wash that all but vanished on the pale government fill and under
     the terrain. Now a thin SOLID grey (the palette's `adm1`), scaled with the
     canvas like every other line here and about half the weight of the country
     border and the dashed line of contact - so the eye still reads those two
     first. District (ADM2) lines are not drawn on these pictures at all. */
  var GOV_LINE_W = 1.1;
  function govLine(P, u) {
    return { stroke: P.adm1, width: Math.max(1, GOV_LINE_W * u) };
  }

  /* `opt` carries the relief variant's business - `{img, bounds}` lays the
     terrain picture inside the coastline and `fade` washes the three territory
     fills back so the terrain stays readable under them - and one flag of its
     own: `clean`.

     A CLEAN MAP DRAWS NO WAR (2026-09-17). Ziv, on the Mocha-Djibouti
     crossing: strip everything unrelated to the crossing. So with the flag on,
     the control fills, the fighting belts with their hatch and their red
     diamonds, and the line of contact are all skipped, and what is left is the
     sea, the land, the terrain, the governorate outlines and the coast - the
     ground a sailing route is read on. Without either this paints exactly what
     it painted before the raster existed.

     AND `control: "merged"` PUTS TWO OF THEM BACK (2026-09-17). Ziv, of the
     same crossing picture: "show the boundaries between the Houthis and the
     Yemeni government, make the new territory gains just part of the Houthis."
     So on a merged map the two control fills and the line of contact are drawn
     although `clean` is on, and the dossier's gains are folded into the Houthi
     fill by mergedGains() below. The fighting belts and their diamonds stay
     off: the picture answers who holds which side of one boundary, and where
     the fighting is happening today is a different question. */
  function ground(ctx, p, P, u, W, H, G, opt) {
    var X = window.DossierMapExtra, o = opt || {}, merged = o.control === "merged";
    SCALE = u || 1;
    ctx.fillStyle = P.sea; ctx.fillRect(0, 0, W, H);
    landPath(ctx, p, G, true);
    paintShape(ctx, { fill: P.land });
    /* The raster goes in HERE - over the land fill, under everything that
       carries meaning, and clipped to the coastline that was just drawn. */
    if (o.img && X) X.relief(ctx, p, o.img, o.bounds, o.filter);
    var byControl = function (c) { return function (f) { return f.properties.control === c; }; };
    /* A TRIBAL map paints NO HOLDER (2026-09-22): its three fills answer a
       different question - which tribes back the Houthis - and a control fill
       under them would be a second colour on the same ground saying something
       else. The line of contact below stays, so the stances can be read against
       it. docs\dossier_map_tribes.js. */
    var zones = (o.tribes || (o.clean && !merged)) ? null : G.control_zones;
    /* On the light deck the three fills are opaque; over the terrain they would
       erase it, so they are washed back. The dark palette's fills already carry
       their own alpha and are left alone. */
    if (o.fade) ctx.globalAlpha = o.fade;
    fillCollection(ctx, p, zones, { fill: P.gov }, byControl("government"));
    fillCollection(ctx, p, zones, { fill: P.houthi }, byControl("houthi"));
    /* In the SAME pass and at the same alpha, so a gain and the ground it has
       joined are one colour and not two tones of it. */
    if (merged && window.DossierMapGains) DossierMapGains.mergedGains(ctx, p, P, u, o.D, G);
    /* AND THE GROUND TAKEN IN THIS ROUND IN ITS OWN REDDISH TONE, over the
       control fill it sits on and at the same wash, so the terrain still reads
       through it - `gains_fill` on the record (2026-09-22). One layer moves and
       nothing else on the picture does; the line round it goes down at the end
       of this function with the merged map's own. dossier_map_gains.js. */
    if (o.gainsFill && window.DossierMapGains) DossierMapGains.newGround(ctx, p, P, u, G);
    ctx.globalAlpha = 1;
    /* THE TRIBAL AREAS, in place of the holder: one of three tones per area by
       its stance toward the Houthis, a thin edge round each area and a thick
       one round each confederation. It sets its own wash and hands back at 1,
       and it draws nothing at all when the layer is absent. */
    if (o.tribes && window.DossierMapTribes) DossierMapTribes.fills(ctx, p, P, u, G);
    /* The ACTIVE FIGHTING zones are their own layer (data\fronts.json ->
       GEO.fronts), drawn over the territory instead of replacing a district's
       fill. Until 2026-09-14 the hatch WAS a district's control value, so a
       20 km contact belt in one corner of Khab wa Ash Sha'f painted 2.4 degrees
       of longitude as a war zone and a district one side plainly held lost its
       colour. Ziv reported it on al-Jawf, on Maqbanah and on the Lahij coast in
       one message. Territory now says WHO HOLDS, this says WHAT IS HAPPENING. */
    if (G.fronts && !o.clean && o.fronts !== false) {
      /* ONE WASH, OR FIVE (2026-09-17). A record carrying `heat` says how hard
         each belt is being fought this window, and dossier_map_heat.js fills
         every belt with its own step of that scale instead of the one contested
         colour. It is the same fade and the same shapes; what follows - the
         hatch, the outline and the red diamond - runs on top either way. */
      if (o.heat && window.DossierMapHeat) {
        DossierMapHeat.fronts(ctx, p, P, u, G, o.heat, o);
      } else {
        if (o.fade) ctx.globalAlpha = o.fade;
        fillCollection(ctx, p, G.fronts, { fill: P.contested });
        ctx.globalAlpha = 1;
      }
      /* The hatch, the outline and the diamond are never washed back - they are
         what says a fight is happening here, and a terrain picture underneath
         is no reason to say it more quietly. */
      fillCollection(ctx, p, G.fronts, { fill: hatch(ctx, P.contestedStroke, u),
        stroke: P.contestedStroke, width: Math.max(0.8, 0.8 * u), dash: [3 * u, 3 * u] });
      if (window.DossierMapLegend) window.DossierMapLegend.frontMarks(ctx, p, P, u, G);
    }
    fillCollection(ctx, p, G.yem_adm1, govLine(P, u));
    fillCollection(ctx, p, G.sau_adm1, govLine(P, u));
    /* THE COAST FIRST, at the shoreline weight and in Yemen's own dark ink on a
       clean map (the neighbours are half that picture) - and there it is their
       SHORELINE only, never their borders: those go down once, bold, below. */
    var edge = o.clean ? { stroke: P.border, width: Math.max(1.2, CLEAN_COAST * u) }
      : govLine(P, u);
    landPath(ctx, p, G, false);
    paintShape(ctx, { stroke: P.border,
      width: o.clean ? edge.width : P.borderW * u });
    ctx.beginPath();
    eachFeature(o.clean && G.nbr_coasts ? G.nbr_coasts : G.nbr_adm0,
      function (f) { polyPath(ctx, p, f.geometry); linePath(ctx, p, f.geometry); });
    paintShape(ctx, edge);
    /* THEN THE LAND BORDERS, bold: a light casing so the line reads across the
       terrain shading, the dark ink on top. Both sides of every border sit in
       this one path on purpose - see CLEAN_BORDER above. */
    if (o.clean && G.nbr_borders) {
      var bw = Math.max(2, CLEAN_BORDER * u);
      strokeLines(ctx, p, G.nbr_borders, { stroke: P.halo,
        width: bw + CLEAN_BORDER_HALO * u });
      strokeLines(ctx, p, G.nbr_borders, { stroke: CLEAN_BORDER_INK, width: bw });
    }
    /* The boundary itself. A merged map is drawn FOR it - it is the one line
       Ziv asked to see - so `clean` does not take it off there. */
    if (!o.clean || merged) {
      strokeLines(ctx, p, G.control_line, { stroke: P.control, width: P.controlW * u,
        dash: dashOf(P.controlDash, u) });
    }
    /* AND ON A MERGED MAP, THE SEAM (2026-09-18). The new ground is painted in
       the Houthi colour and a reader cannot tell it from the ground it joined -
       which is what Ziv asked for, and then: "it's okay that you did all of them
       in the same colour, but still make a line that separates the new
       territories that they conquered so we know what they are." So one more
       line, solid and brown against the dashed pale line of contact beside it.
       dossier_map_gains.js owns it, because it owns the gains.
       A `gains_fill` map takes the same line, and for the same reason: the tone
       says WHICH ground is new and the line says exactly where it ends. Last of
       all, so neither the hatch nor a border crosses it. */
    if ((merged || o.gainsFill) && window.DossierMapGains) {
      DossierMapGains.seam(ctx, p, P, u, G);
    }
  }

  /* ---- MOVED OUT ------------------------------------------------------------
     The governorate names left for dossier_map_zone_names.js on 2026-09-18,
     with the place names, when that file became the one place that answers what
     a picture names and this one reached its cap. THE SHIPPING LANES left for
     dossier_map_lanes.js on 2026-09-22, when the tribal layer needed a hook
     here and this file stood at 499 lines: `clip`, `segLen` and `lanes` moved
     whole, and dossier_map.js merges that file in so `R.lanes(...)` is
     unchanged. This file keeps the GROUND and the primitives every painter
     draws with.
     ------------------------------------------------------------------------ */

  return {
    mix: mix, alpha: alpha, text: text, width: width, overlaps: overlaps,
    place: place, ringMark: ringMark, setFont: setFont, paintShape: paintShape,
    canvasScale: canvasScale,
    hatch: hatch, dashOf: dashOf, eachFeature: eachFeature, polyPath: polyPath,
    strokeLines: strokeLines, ground: ground,
    CLEAN_TEXT: CLEAN_TEXT, COUNTRY_TEXT: COUNTRY_TEXT,
    COUNTRY_SPACE: COUNTRY_SPACE
  };
})();

window.DossierMapDraw = DossierMapDraw;
