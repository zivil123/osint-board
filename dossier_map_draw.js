/* The layer painters behind dossier_map.js: geometry paths, Hebrew text with a
   halo, the gains overlay, the shipping lanes and the governorate names.
   dossier_map.js owns the frames, the projection, the palette and the public
   API; it calls into this file at paint time, so the painter files may load in
   any order as long as all of them are on the page before the view draws.

   Split out the day the painter passed the 480-line cap, exactly as the brief
   allowed. The LEGEND and the fighting-zone diamond left for
   dossier_map_legend.js on 2026-09-15, and the relief raster, the fighting
   notes and the assessment arrows went into dossier_map_extra.js the same day.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapDraw = { ... }   (read by the other painter files only)

   Every string painted here is Hebrew; the words the legend needs live in
   dossier_map.js next to the palette, and this file is handed them. */
"use strict";

var DossierMapDraw = (function () {
  var FONT = '"Heebo", "Segoe UI", sans-serif';
  /* A CLEAN map carries almost no text - two port names and one route name on
     the crossing picture - so its few names are set larger than a map crowded
     with towns could afford. Ziv, 2026-09-17: "put the Mocha and Djibouti
     bigger in text". ONE factor, read by dossier_map.js for the place names and
     by dossier_map_routes.js for the route's own block, so the two can never
     drift apart into a per-label hack. */
  var CLEAN_TEXT = 1.6;

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

  function setFont(ctx, size, weight) {
    ctx.font = (weight || 500) + " " + size + "px " + FONT;
  }
  /* Halo first, in the ground colour, so a name over a line stays legible. */
  function text(ctx, P, str, x, y, o) {
    setFont(ctx, o.size, o.weight);
    ctx.textAlign = o.align || "center";
    ctx.textBaseline = o.baseline || "middle";
    if (o.halo > 0) {
      ctx.lineJoin = "round"; ctx.lineWidth = o.halo;
      ctx.strokeStyle = P.halo; ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = o.color || P.ink; ctx.fillText(str, x, y);
  }
  function width(ctx, str, size, weight) {
    setFont(ctx, size, weight);
    return ctx.measureText(str).width;
  }
  function overlaps(a, b) {
    return !(a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0);
  }
  /* Where a label sits relative to its point: anchor e/w/n/s names the side
     and c centres it on the point (a country name, never flipped).
     A name that would run off the canvas on its authored side flips to the
     other side - at 600px the Perim name, anchored west, was cut at the edge. */
  function place(ctx, str, x, y, anchor, size, r, u, W, H) {
    var w = width(ctx, str, size, 500), h = size * 1.25, g = r + 5 * u;
    var side = function (a) {
      if (a === "c") return { x: x, y: y, align: "center", baseline: "middle",
                              box: { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 } };
      if (a === "w") return { x: x - g, y: y, align: "right", baseline: "middle",
                              box: { x0: x - g - w, y0: y - h / 2, x1: x - g, y1: y + h / 2 } };
      if (a === "n") return { x: x, y: y - g, align: "center", baseline: "bottom",
                              box: { x0: x - w / 2, y0: y - g - h, x1: x + w / 2, y1: y - g } };
      if (a === "s") return { x: x, y: y + g, align: "center", baseline: "top",
                              box: { x0: x - w / 2, y0: y + g, x1: x + w / 2, y1: y + g + h } };
      return { x: x + g, y: y, align: "left", baseline: "middle",
               box: { x0: x + g, y0: y - h / 2, x1: x + g + w, y1: y + h / 2 } };
    };
    var o = side(anchor), b = o.box;
    if (anchor === "c") { o.str = str; o.size = size; return o; }
    if (b.x0 < 0) o = side("e"); else if (b.x1 > W) o = side("w");
    else if (b.y0 < 0) o = side("s"); else if (b.y1 > H) o = side("n");
    o.str = str; o.size = size;
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
    ctx.fillStyle = P.sea; ctx.fillRect(0, 0, W, H);
    landPath(ctx, p, G, true);
    paintShape(ctx, { fill: P.land });
    /* The raster goes in HERE - over the land fill, under everything that
       carries meaning, and clipped to the coastline that was just drawn. */
    if (o.img && X) X.relief(ctx, p, o.img, o.bounds);
    var byControl = function (c) { return function (f) { return f.properties.control === c; }; };
    var zones = (o.clean && !merged) ? null : G.control_zones;
    /* On the light deck the three fills are opaque; over the terrain they would
       erase it, so they are washed back. The dark palette's fills already carry
       their own alpha and are left alone. */
    if (o.fade) ctx.globalAlpha = o.fade;
    fillCollection(ctx, p, zones, { fill: P.gov }, byControl("government"));
    fillCollection(ctx, p, zones, { fill: P.houthi }, byControl("houthi"));
    /* In the SAME pass and at the same alpha, so a gain and the ground it has
       joined are one colour and not two tones of it. */
    if (merged) mergedGains(ctx, p, P, u, o.D, G);
    ctx.globalAlpha = 1;
    /* The ACTIVE FIGHTING zones are their own layer (data\fronts.json ->
       GEO.fronts), drawn over the territory instead of replacing a district's
       fill. Until 2026-09-14 the hatch WAS a district's control value, so a
       20 km contact belt in one corner of Khab wa Ash Sha'f painted 2.4 degrees
       of longitude as a war zone and a district one side plainly held lost its
       colour. Ziv reported it on al-Jawf, on Maqbanah and on the Lahij coast in
       one message. Territory now says WHO HOLDS, this says WHAT IS HAPPENING. */
    if (G.fronts && !o.clean) {
      if (o.fade) ctx.globalAlpha = o.fade;
      fillCollection(ctx, p, G.fronts, { fill: P.contested });
      ctx.globalAlpha = 1;
      /* The hatch, the outline and the diamond are never washed back - they are
         what says a fight is happening here, and a terrain picture underneath
         is no reason to say it more quietly. */
      fillCollection(ctx, p, G.fronts, { fill: hatch(ctx, P.contestedStroke, u),
        stroke: P.contestedStroke, width: Math.max(0.8, 0.8 * u), dash: [3 * u, 3 * u] });
      if (window.DossierMapLegend) window.DossierMapLegend.frontMarks(ctx, p, P, u, G);
    }
    fillCollection(ctx, p, G.yem_adm1, { stroke: P.adm1, width: Math.max(0.8, u) });
    fillCollection(ctx, p, G.sau_adm1, { stroke: P.adm1, width: Math.max(0.8, u) });
    landPath(ctx, p, G, false);
    paintShape(ctx, { stroke: P.border, width: P.borderW * u });
    ctx.beginPath();
    eachFeature(G.nbr_adm0, function (f) { polyPath(ctx, p, f.geometry); });
    paintShape(ctx, { stroke: P.adm1, width: Math.max(0.8, u) });
    /* The boundary itself. A merged map is drawn FOR it - it is the one line
       Ziv asked to see - so `clean` does not take it off there. */
    if (!o.clean || merged) {
      strokeLines(ctx, p, G.control_line, { stroke: P.control, width: P.controlW * u,
        dash: dashOf(P.controlDash, u) });
    }
  }

  /* ---- the gains overlay -------------------------------------------------------- */

  var adm2Index = null;
  function district(G, id) {
    if (!adm2Index) {
      adm2Index = {};
      eachFeature(G.yem_adm2, function (f) { adm2Index[f.properties.shapeID] = f; });
    }
    return adm2Index[id] || null;
  }
  /* ONE style for every gain, whatever its status: Ziv asked for captured and
     contested to read as one, "נכבש בידי החות'ים (מאומת + משוער)" (2026-09-11).
     The status still travels in the data and the text says which were
     confirmed; the map no longer draws the difference. */
  function gainStyle(P, u) {
    return { fill: alpha(P.violetFill, 0.5), stroke: P.violet, width: 2 * u, dash: [] };
  }
  /* There is ONE gain style and no second one. A heavier edge once set the last
     day's ground apart; Ziv struck that on 2026-09-13 ("remove what was conquered
     in the last day"), as he struck the captured/contested split on 2026-09-11.
     WHEN a place fell is said in the text under the map, never by a second style. */
  /* A district and an island BOTH paint only `coordinates[part_index]` of their
     ADM2 feature, never the whole district: the islands live inside mainland
     districts (Perim in Dhubab, Hanish and Zuqar in Al Khukhah), so a whole
     district would colour an island with its mainland's status. `kind` decides
     only the overview treatment - there an island is five pixels and takes a
     ring mark like a port or a town. */
  function gainPart(G, g) {
    var f = g.district_id ? district(G, g.district_id) : null;
    if (!f || typeof g.part_index !== "number") return null;
    var geom = f.geometry, c = geom.coordinates;
    var part = geom.type === "MultiPolygon" ? c[g.part_index]
      : (geom.type === "Polygon" && g.part_index === 0) ? c : null;
    return part ? { type: "Polygon", coordinates: part } : null;
  }
  /* THE SAME GROUND, IN THE SAME COLOUR (2026-09-17). On a `control: "merged"`
     map a gain is not a third thing on the picture: Ziv asked for the new
     ground to be "just part of the Houthis", so it is painted with the Houthi
     control fill and nothing else - no violet, no stroke, and none of the plain
     land the violet needs underneath it. Called from ground() between the two
     control fills and the alpha reset, so it is washed back with them on the
     light deck and a reader cannot tell a gain from the ground beside it.
     Which places were taken, and when, is still said in the text under the map;
     this picture is about one boundary and does not answer that. */
  function mergedGains(ctx, p, P, u, D, G) {
    ((D && D.gains) || []).forEach(function (g) {
      var geom = gainPart(G, g);
      if (geom) {
        ctx.beginPath(); polyPath(ctx, p, geom);
        paintShape(ctx, { fill: P.houthi });
      } else if (typeof g.lon === "number") {
        var q = p(g.lon, g.lat);
        ringMark(ctx, q[0], q[1], 7 * u, { fill: P.houthi });
      }
    });
  }
  function gains(ctx, p, P, u, D, G, mapId) {
    (D.gains || []).forEach(function (g) {
      var geom = null;
      if (g.kind === "district" || (g.kind === "island" && mapId !== "overview")) geom = gainPart(G, g);
      /* Plain land under the violet, exactly as the legend swatch does, so a
         gain on Houthi ground and one on government ground are the same
         colour - measured on the light slide, the see-through wash read as
         two tones, which is the very separation Ziv asked to remove. */
      if (geom) {
        ctx.beginPath(); polyPath(ctx, p, geom);
        paintShape(ctx, { fill: P.land });
        paintShape(ctx, gainStyle(P, u));
      } else {
        var q = p(g.lon, g.lat);
        ringMark(ctx, q[0], q[1], 7 * u, { fill: P.land });
        ringMark(ctx, q[0], q[1], 7 * u, gainStyle(P, u));
      }
    });
  }

  /* ---- shipping lanes ------------------------------------------------------------ */

  /* The part of segment a-b inside the canvas (Liang-Barsky), or null. */
  function clip(a, b, W, H) {
    var dx = b[0] - a[0], dy = b[1] - a[1], t0 = 0, t1 = 1;
    var edges = [[-dx, a[0]], [dx, W - a[0]], [-dy, a[1]], [dy, H - a[1]]];
    for (var i = 0; i < 4; i++) {
      var q = edges[i][0], r = edges[i][1];
      if (q === 0) { if (r < 0) return null; continue; }
      var t = r / q;
      if (q < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
      else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
  }

  function segLen(seg) {
    return seg ? Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]) : 0;
  }

  function lanes(ctx, p, P, u, W, H, list, size, taken, legend) {
    (list || []).forEach(function (lane) {
      var pts = (lane.path || []).map(function (c) { return p(c[0], c[1]); });
      if (pts.length < 2) return;
      ctx.beginPath();
      pts.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      paintShape(ctx, { stroke: P.lane, width: 2 * u, dash: [8 * u, 6 * u] });
      if (!lane.label_he) return;
      /* The name rides the segment with the most FREE length: on screen and
         not under the legend box. On the close-up the Gulf of Aden leg runs
         mostly off the canvas and then under the legend, so the leg through
         the strait wins there; on the overview the Gulf leg is the long one. */
      var best = null, len = -1;
      for (var i = 1; i < pts.length; i++) {
        var seg = clip(pts[i - 1], pts[i], W, H), d = segLen(seg);
        if (seg && legend) {
          var under = clip([seg[0][0] - legend.x0, seg[0][1] - legend.y0],
            [seg[1][0] - legend.x0, seg[1][1] - legend.y0], legend.x1 - legend.x0, legend.y1 - legend.y0);
          d -= segLen(under);
        }
        if (seg && d > len) { len = d; best = seg; }
      }
      if (!best) return;
      var a = best[0], b = best[1], w = width(ctx, lane.label_he, size, 500);
      var ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (Math.cos(ang) < 0) ang += Math.PI;         /* never upside down */
      /* Slide along the visible part until the name lands inside the canvas
         and clear of every place label and the legend box. */
      var spot = [0.5, 0.35, 0.65, 0.2, 0.8].map(function (t) {
        var x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        return { x: x, y: y, box: { x0: x - w / 2, y0: y - size * 1.6, x1: x + w / 2, y1: y + 2 * u } };
      }).filter(function (s) {
        return s.box.x0 >= 0 && s.box.x1 <= W && s.box.y0 >= 0 && s.box.y1 <= H &&
          !taken.some(function (t) { return overlaps(s.box, t); });
      })[0];
      if (!spot) return;
      ctx.save(); ctx.translate(spot.x, spot.y); ctx.rotate(ang);
      text(ctx, P, lane.label_he, 0, -6 * u, { size: size, color: P.muted, halo: 3 * u,
        align: "center", baseline: "bottom" });
      ctx.restore();
      taken.push(spot.box);
    });
  }

  /* ---- governorate names ------------------------------------------------------------ */

  /* Quieter than a claim. Only where the frame holds them, never on top of a
     dossier label, and never beside one naming the same place - "אל-חודיידה"
     under "חודיידה" reads as a typo, and "תעז" twice over reads as a stutter,
     so a governorate that shares its name with a dossier label, or whose anchor
     sits within 32px of one's point, yields to it. That second case is why Taiz
     governorate's authored anchor (data\gov_names.json, on the city) costs the
     overview nothing: the city label is already there, and the governorate name
     stands down. */
  function sameName(a, b) {
    var strip = function (s) { return String(s || "").replace(/^אל-/, "").trim(); };
    a = strip(a); b = strip(b);
    return !!a && !!b && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0);
  }
  function govLabels(ctx, p, P, u, G, size, taken, points) {
    var marks = (G.labels && G.labels.features || []).map(function (f) {
      return { name: f.properties.name_he, home: f.properties.set === "yem_adm1" ? 0 : 1,
               span: f.properties.span || 0, c: f.geometry.coordinates };
    }).sort(function (a, b) { return a.home - b.home || b.span - a.span; });
    marks.forEach(function (m) {
      if (!p.inside(m.c[0], m.c[1], -0.2)) return;
      var q = p(m.c[0], m.c[1]);
      var near = points.some(function (pt) {
        return Math.hypot(pt.q[0] - q[0], pt.q[1] - q[1]) < 32 * u || sameName(pt.he, m.name);
      });
      if (near) return;
      var w = width(ctx, m.name, size, 500), h = size * 1.25;
      var box = { x0: q[0] - w / 2 - 3, y0: q[1] - h / 2 - 2, x1: q[0] + w / 2 + 3, y1: q[1] + h / 2 + 2 };
      if (taken.some(function (t) { return overlaps(box, t); })) return;
      text(ctx, P, m.name, q[0], q[1], { size: size, color: P.govLabel, halo: 3 * u });
      taken.push(box);
    });
  }

  return {
    mix: mix, alpha: alpha, text: text, width: width, overlaps: overlaps,
    place: place, ringMark: ringMark, setFont: setFont, paintShape: paintShape,
    hatch: hatch, dashOf: dashOf, eachFeature: eachFeature, gainStyle: gainStyle,
    ground: ground, gains: gains, lanes: lanes, govLabels: govLabels,
    CLEAN_TEXT: CLEAN_TEXT
  };
})();

window.DossierMapDraw = DossierMapDraw;
