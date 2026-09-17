/* dossier_deck_map.js — the dossier map as NATIVE POWERPOINT OBJECTS.

   window.DossierDeckMap = { slide(pptx, slide, mapId, theme) }

   The deck carries each map TWICE: the picture slide (dossier_deck.js, a PNG of
   the canvas) and then this one, the same map built from freeform shapes,
   ellipses and real text boxes, so Ziv can click a country, drag a name, retype
   a label or recolour a zone in PowerPoint itself. He asked for both on
   2026-09-14: "put it as a picture and also put it as stuff that I can edit on
   the PowerPoint slide."

   It uses dossier_map.js's OWN projector and palette (DossierMap.project /
   .palette / .words). Copying either would let the two slides drift apart on the
   first frame change, with nothing on screen to say which one was right.

   THREE THINGS POWERPOINT CANNOT DO, and what is done instead:
   - A custGeom shape has ONE path. pptxgenjs writes a second ring after an
     <a:close/> as a lnTo and never a moveTo, so a polygon with a hole comes out
     joined by a spar (measured, 2026-09-14). So every ring is its OWN shape, and
     a hole is painted in the other side's colour - which is exactly right here,
     because territory has only two values and a hole in one side's ground is the
     other side's ground.
   - There is no pattern fill, so the active-fighting zones cannot be hatched.
     They keep the tint and take a dashed outline instead. The picture slide
     beside them carries the stripes.
   - There is no halo behind text. Labels are plain, and sit where the canvas
     puts them.

   The VERTEX BUDGET is the thing that decides whether the file opens at all:
   geoBoundaries at 4 dp is ~50,000 points and PowerPoint will not hold that as
   editable shapes. Every ring is therefore Douglas-Peucker simplified to half a
   slide pixel and clipped to the slide, HERE and not in geo_prep.py: geo.js is
   already 1.43 MB and would carry a second geometry set on every page load for
   something used only on a tap, while the tap already waits on a CDN fetch and
   this costs a few milliseconds. BUDGET is enforced, not hoped for. */
"use strict";

var DossierDeckMap = (function () {
  var W_IN = 10, H_IN = 5.625;            /* LAYOUT_16x9, inches */
  var PX = 1280;                          /* projection space; scaled to inches */
  var BUDGET = 6000;                      /* total vertices on one slide */
  var TOL_PX = 0.55;                      /* Douglas-Peucker, in slide pixels */
  var MIN_IN = 0.02;                      /* no zero-width shape */
  var FONT = "Segoe UI";
  var used = 0;

  /* ---- geometry ----------------------------------------------------------- */

  function perp(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var d = dx * dx + dy * dy;
    if (!d) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    var t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / d;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }
  /* Douglas-Peucker, iterative so a long coastline cannot blow the stack. */
  function simplify(pts, tol) {
    if (pts.length < 3) return pts.slice();
    var keep = new Array(pts.length), stack = [[0, pts.length - 1]];
    keep[0] = keep[pts.length - 1] = true;
    while (stack.length) {
      var seg = stack.pop(), lo = seg[0], hi = seg[1], far = -1, best = tol;
      for (var i = lo + 1; i < hi; i++) {
        var d = perp(pts[i], pts[lo], pts[hi]);
        if (d > best) { best = d; far = i; }
      }
      if (far > 0) { keep[far] = true; stack.push([lo, far], [far, hi]); }
    }
    return pts.filter(function (_, i) { return keep[i]; });
  }
  /* Sutherland-Hodgman against the slide rectangle: a ring running far off the
     page would still be a shape the size of Arabia to click on and drag. */
  function clipEdge(pts, inside, cut) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var cur = pts[i], prev = pts[(i + pts.length - 1) % pts.length];
      var ci = inside(cur), pi = inside(prev);
      if (ci) { if (!pi) out.push(cut(prev, cur)); out.push(cur); }
      else if (pi) { out.push(cut(prev, cur)); }
    }
    return out;
  }
  function clipRect(pts, w, h) {
    var m = 0.5;
    var lerp = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
    pts = clipEdge(pts, function (p) { return p[0] >= -m; },
      function (a, b) { return lerp(a, b, (-m - a[0]) / (b[0] - a[0])); });
    pts = clipEdge(pts, function (p) { return p[0] <= w + m; },
      function (a, b) { return lerp(a, b, (w + m - a[0]) / (b[0] - a[0])); });
    pts = clipEdge(pts, function (p) { return p[1] >= -m; },
      function (a, b) { return lerp(a, b, (-m - a[1]) / (b[1] - a[1])); });
    pts = clipEdge(pts, function (p) { return p[1] <= h + m; },
      function (a, b) { return lerp(a, b, (h + m - a[1]) / (b[1] - a[1])); });
    return pts;
  }
  function ringsOf(geom) {
    if (!geom) return [];
    if (geom.type === "Polygon") return [geom.coordinates];
    if (geom.type === "MultiPolygon") return geom.coordinates;
    return [];
  }

  /* ---- shapes ------------------------------------------------------------- */

  /* One ring -> one freeform, its own tight bounding box so it can be picked up
     on its own in PowerPoint. Points are inches from the shape's origin; the
     path's w/h are the shape's w/h (measured against pptxgenjs 4.0.1's XML). */
  function ring(slide, pts, style, sx, sy) {
    if (used >= BUDGET || pts.length < 3) return false;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, i;
    for (i = 0; i < pts.length; i++) {
      if (pts[i][0] < x0) x0 = pts[i][0];
      if (pts[i][0] > x1) x1 = pts[i][0];
      if (pts[i][1] < y0) y0 = pts[i][1];
      if (pts[i][1] > y1) y1 = pts[i][1];
    }
    var w = Math.max(MIN_IN, (x1 - x0) * sx), h = Math.max(MIN_IN, (y1 - y0) * sy);
    var pointList = [];
    for (i = 0; i < pts.length; i++) {
      pointList.push({ x: Number(((pts[i][0] - x0) * sx).toFixed(3)),
                       y: Number(((pts[i][1] - y0) * sy).toFixed(3)) });
    }
    pointList.push({ close: true });
    used += pts.length;
    slide.addShape("custGeom", Object.assign({
      x: Number((x0 * sx).toFixed(3)), y: Number((y0 * sy).toFixed(3)),
      w: Number(w.toFixed(3)), h: Number(h.toFixed(3)), points: pointList
    }, style));
    return true;
  }
  function line(slide, pts, style, sx, sy) {
    if (used >= BUDGET || pts.length < 2) return;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, i;
    for (i = 0; i < pts.length; i++) {
      x0 = Math.min(x0, pts[i][0]); x1 = Math.max(x1, pts[i][0]);
      y0 = Math.min(y0, pts[i][1]); y1 = Math.max(y1, pts[i][1]);
    }
    var pointList = [];
    for (i = 0; i < pts.length; i++) {
      pointList.push({ x: Number(((pts[i][0] - x0) * sx).toFixed(3)),
                       y: Number(((pts[i][1] - y0) * sy).toFixed(3)) });
    }
    used += pts.length;
    slide.addShape("custGeom", Object.assign({
      x: Number((x0 * sx).toFixed(3)), y: Number((y0 * sy).toFixed(3)),
      w: Number(Math.max(MIN_IN, (x1 - x0) * sx).toFixed(3)),
      h: Number(Math.max(MIN_IN, (y1 - y0) * sy).toFixed(3)),
      points: pointList, fill: { type: "none" }
    }, style));
  }

  /* Every ring of a collection, simplified then clipped, in draw order. When a
     feature has holes, `holeStyle` paints them - territory is two-valued, so a
     hole in one side's ground is the other side's ground and nothing else. */
  function collection(slide, fc, project, style, holeStyle, filter, sx, sy) {
    ((fc && fc.features) || []).forEach(function (f) {
      if (filter && !filter(f)) return;
      ringsOf(f.geometry).forEach(function (poly) {
        poly.forEach(function (r, index) {
          if (index && !holeStyle) return;
          var pts = r.map(function (c) { return project(c[0], c[1]); });
          pts = clipRect(simplify(pts, TOL_PX), PX, PX / (W_IN / H_IN));
          ring(slide, pts, index ? holeStyle : style, sx, sy);
        });
      });
    });
  }

  /* ---- colour ------------------------------------------------------------- */

  /* The dark palette is read from style.css and most of it is rgb()/rgba() -
     the territory washes are alpha over the land on purpose. PowerPoint's
     solidFill is a flat 6-hex and nothing else, so every colour is parsed and
     any alpha is COMPOSITED onto the colour it sits on, in the canvas painter's
     own draw order. Passing the raw token through produced a black country
     (measured on the first dry run, 2026-09-14): "rgb(35,59,84)" with the "#"
     stripped is not a hex value and PowerPoint fell back to black. */
  function rgbOf(str) {
    /* A bare 6-hex counts, because flat() hands its own result back in as the
       backdrop of the next layer. Requiring the "#" made every wash composite
       onto black and turned the whole palette grey (measured, 2026-09-14). */
    var t = String(str || "").trim(), m;
    m = /^#([0-9a-f]{3})$/i.exec(t);
    if (m) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16),
                   parseInt(m[1][2] + m[1][2], 16), 1];
    m = /^#?([0-9a-f]{6})$/i.exec(t);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16),
                   parseInt(m[1].slice(4, 6), 16), 1];
    m = /^rgba?\(([^)]+)\)$/i.exec(t);
    if (m) {
      var n = m[1].split(",").map(function (v) { return parseFloat(v); });
      return [n[0] || 0, n[1] || 0, n[2] || 0, n.length > 3 ? n[3] : 1];
    }
    return [0, 0, 0, 1];
  }
  function flat(color, under) {
    var c = rgbOf(color), b = rgbOf(under || "#000000"), out = "", i, v;
    for (i = 0; i < 3; i++) {
      v = Math.round(c[i] * c[3] + b[i] * (1 - c[3]));
      out += ("0" + Math.max(0, Math.min(255, v)).toString(16)).slice(-2);
    }
    return out.toUpperCase();
  }

  /* ---- text --------------------------------------------------------------- */

  /* Hebrew only, RTL, he-IL - the same law as everywhere else on this board, and
     the same font the rest of the deck uses (Heebo is a web font and would not
     be on a projector laptop). */
  function text(slide, str, cx, cy, size, color, bold, sx, sy) {
    var w = Math.max(0.6, String(str).length * size / 120), h = size / 52;
    slide.addText([{ text: String(str),
      options: { rtlMode: true, lang: "he-IL", fontFace: FONT, fontSize: size,
                 color: color, bold: !!bold, align: "center" } }], {
      x: Number((cx * sx - w / 2).toFixed(3)), y: Number((cy * sy - h / 2).toFixed(3)),
      w: Number(w.toFixed(3)), h: Number(h.toFixed(3)),
      isTextBox: true, rtlMode: true, lang: "he-IL", fontFace: FONT,
      align: "center", valign: "middle", margin: 0
    });
  }

  /* ---- the slide ---------------------------------------------------------- */

  function build(pptx, slide, mapId, theme) {
    /* geo.js and dossier_data.js declare `const GEO` / `const DOSSIER`, and a
       top-level const is NOT a property of window - read them by name, the way
       dossier_map.js does. Reaching for window.GEO returned undefined and this
       slide came out blank (measured on the first dry run, 2026-09-14). */
    var G = (typeof GEO !== "undefined") ? GEO : null;
    var D = (typeof DOSSIER !== "undefined") ? DOSSIER : null;
    var M = window.DossierMap;
    if (!G || !D || !M || typeof M.project !== "function") return null;
    var H_PX = PX / (W_IN / H_IN);
    var p = M.project(mapId, PX, H_PX);
    if (!p) return null;
    var P = M.palette(theme === "light" ? "light" : "dark");
    var sx = W_IN / PX, sy = H_IN / H_PX;
    var map = (D.maps || []).filter(function (m) { return m.id === mapId; })[0] || {};
    used = 0;

    /* Colours are flattened in the canvas painter's own draw order: land over
       sea, each territory wash over land, everything else over the ground it
       covers. */
    var SEA = flat(P.sea), LANDC = flat(P.land, P.sea);
    var GOVC = flat(P.gov, LANDC), HOUC = flat(P.houthi, LANDC);
    var hex = function (c, under) { return flat(c, under || LANDC); };
    var solid = function (c, under) { return { color: hex(c, under) }; };
    var none = { type: "none" };

    slide.background = { color: SEA };

    /* land, then the two territories, then what is happening on them */
    var LAND = { fill: { color: LANDC }, line: { color: hex(P.border, SEA), width: 1 } };
    collection(slide, G.yem_adm0, p, LAND, null, null, sx, sy);
    collection(slide, G.sau_adm0, p, LAND, null, null, sx, sy);
    collection(slide, G.nbr_adm0, p,
      { fill: { color: LANDC }, line: { color: hex(P.adm1, SEA), width: 0.5 } },
      null, null, sx, sy);

    var isH = function (f) { return f.properties.holder === "houthi"; };
    var isG = function (f) { return f.properties.holder === "government"; };
    collection(slide, G.control_zones, p, { fill: { color: GOVC }, line: none },
      { fill: { color: HOUC }, line: none }, isG, sx, sy);
    collection(slide, G.control_zones, p, { fill: { color: HOUC }, line: none },
      { fill: { color: GOVC }, line: none }, isH, sx, sy);

    /* No pattern fill in PowerPoint, so a fighting zone is the tint plus a
       dashed edge. The picture slide next door carries the stripes. */
    collection(slide, G.fronts, p,
      { fill: solid(P.contested, HOUC),
        line: { color: hex(P.contestedStroke, HOUC), width: 1, dashType: "dash" } },
      null, null, sx, sy);

    /* the gains, from the dossier's own list, exactly as the canvas paints them */
    var adm2 = {};
    ((G.yem_adm2 && G.yem_adm2.features) || []).forEach(function (f) {
      adm2[f.properties.shapeID] = f;
    });
    (D.gains || []).forEach(function (g) {
      var f = g.district_id ? adm2[g.district_id] : null;
      if (!f || typeof g.part_index !== "number") return;
      var c = f.geometry.coordinates;
      var part = f.geometry.type === "MultiPolygon" ? c[g.part_index]
        : (f.geometry.type === "Polygon" && g.part_index === 0) ? c : null;
      if (!part) return;
      var pts = part[0].map(function (q) { return p(q[0], q[1]); });
      pts = clipRect(simplify(pts, TOL_PX), PX, H_PX);
      ring(slide, pts, { fill: { color: flat(P.violetFill, LANDC), transparency: 45 },
        line: { color: hex(P.violet, LANDC), width: 1.5 } }, sx, sy);
    });

    /* the approximate front line, and the shipping lane */
    ((G.control_line && G.control_line.features) || []).forEach(function (f) {
      var coords = f.geometry.type === "LineString" ? [f.geometry.coordinates]
        : f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [];
      coords.forEach(function (c) {
        var pts = simplify(c.map(function (q) { return p(q[0], q[1]); }), TOL_PX)
          .filter(function (q) {
            return q[0] > -40 && q[0] < PX + 40 && q[1] > -40 && q[1] < H_PX + 40;
          });
        line(slide, pts, { line: { color: hex(P.control, LANDC), width: 1.5,
          dashType: "dash" } }, sx, sy);
      });
    });
    (map.lanes || []).forEach(function (lane) {
      var pts = (lane.path || []).map(function (c) { return p(c[0], c[1]); });
      line(slide, pts, { line: { color: hex(P.lane, SEA), width: 1.5,
        dashType: "lgDash" } }, sx, sy);
    });

    /* PINS and names. Ziv, 2026-09-14: "put a PIN so people can see where that
       city is... in the actual exact location." On the slide the pin is a real
       ellipse he can select and the name a real text box he can drag.

       The names are COLLECTED FIRST and placed by priority, exactly as the canvas
       painter does: a town before a governorate before a front zone, and a name
       that would land on one already placed is DROPPED. Drawn in three
       independent passes they piled up - 52 boxes on the overview, unreadable
       around Taiz and Aden (measured, first dry run). A name nobody can read is
       worse than no name, and the picture slide beside it still carries the lot. */
    var pins = 0, placed = [], cand = [];
    var boxOf = function (cx, cy, str, size) {
      var w = Math.max(0.6, String(str).length * size / 120), h = size / 52;
      return { x0: cx * sx - w / 2, y0: cy * sy - h / 2,
               x1: cx * sx + w / 2, y1: cy * sy + h / 2 };
    };
    (map.labels || []).forEach(function (l) {
      if (!p.inside(l.lon, l.lat, 0)) return;
      var q = p(l.lon, l.lat), quiet = l.anchor === "c";
      /* The dot marks a SPOT, so only a real town or port gets one, and it is
         small and tight - Ziv, 2026-09-14: "I don't like the pins that you did.
         They look weird, especially on the islands, there's no reason to put a
         point, not even a city." An island, the strait and a country name are
         areas with no one pixel: `pin: false` in the label (or anchor "c") and
         the name stands alone. Same rule and same radius step as the canvas
         painter - the two slides must show the same picture. */
      if (!quiet && l.pin !== false) {
        var r = 0.04;
        slide.addShape("ellipse", {
          x: Number((q[0] * sx - r).toFixed(3)), y: Number((q[1] * sy - r).toFixed(3)),
          w: r * 2, h: r * 2, fill: { color: flat(P.ink, LANDC) },
          line: { color: LANDC, width: 1 }
        });
        pins++;
      }
      var dx = l.anchor === "e" ? 0.42 : l.anchor === "w" ? -0.42 : 0;
      var dy = l.anchor === "s" ? 0.20 : l.anchor === "n" ? -0.20 : 0;
      cand.push({ rank: 0, str: l.he, cx: q[0] + dx / sx, cy: q[1] + dy / sy,
                  size: quiet ? 12 : 13, bold: !quiet,
                  color: flat(quiet ? P.govLabel : P.ink, LANDC) });
    });
    ((G.labels && G.labels.features) || []).forEach(function (f) {
      var c = f.geometry.coordinates;
      if (!p.inside(c[0], c[1], -0.2)) return;
      var q = p(c[0], c[1]);
      cand.push({ rank: 1, str: f.properties.name_he, cx: q[0], cy: q[1],
                  size: 12, bold: false, color: flat(P.govLabel, LANDC) });
    });
    ((G.fronts && G.fronts.features) || []).forEach(function (f) {
      /* The LARGEST ring, across Polygon and MultiPolygon alike, exactly as the
         canvas painter picks it. Until 2026-09-14 this read coordinates[0] and
         averaged it: right for a Polygon, and for a MultiPolygon that index is a
         whole polygon, so c[0] was an array, the average came out a string, and
         the name was dropped with nothing in the console to say why. Fronts
         became multi-part the same day. */
      var geom = f.geometry || {}, ring = null, area = 0;
      var polys = geom.type === "Polygon" ? [geom.coordinates]
        : geom.type === "MultiPolygon" ? geom.coordinates : [];
      polys.forEach(function (poly) {
        var g = poly[0], a = 0;
        for (var i = 0; i < g.length - 1; i++) {
          a += g[i][0] * g[i + 1][1] - g[i + 1][0] * g[i][1];
        }
        a = Math.abs(a) / 2;
        if (a > area) { area = a; ring = g; }
      });
      if (!ring) return;
      var cx = 0, cy = 0;
      ring.forEach(function (c) { cx += c[0]; cy += c[1]; });
      cx /= ring.length; cy /= ring.length;
      if (!p.inside(cx, cy, 0)) return;
      var q = p(cx, cy);
      /* The same DIAMOND the canvas paints, for the same reason: a 12 km belt is
         a hairline once the whole country is on one slide, and Ziv could not find
         the fighting on it (2026-09-15). A real shape he can select and move.
         Widened the same afternoon, with the canvas painter's own constant: at
         0.105 in he still could not see it on a projected slide. */
      var d = 0.17;
      slide.addShape("diamond", {
        x: Number((q[0] * sx - d).toFixed(3)), y: Number((q[1] * sy - d).toFixed(3)),
        w: d * 2, h: d * 2, fill: { color: flat(P.frontMark, HOUC) },
        line: { color: flat(P.halo, HOUC), width: 1.5 }
      });
      cand.push({ rank: 2, str: f.properties.name_he, cx: q[0], cy: q[1],
                  size: 11, bold: false, color: flat(P.muted, LANDC) });
    });
    cand.sort(function (a, b) { return a.rank - b.rank; });
    cand.forEach(function (c) {
      var b = boxOf(c.cx, c.cy, c.str, c.size);
      var clash = placed.some(function (t) {
        return !(b.x1 < t.x0 || t.x1 < b.x0 || b.y1 < t.y0 || t.y1 < b.y0);
      });
      if (clash) return;
      placed.push(b);
      text(slide, c.str, c.cx, c.cy, c.size, c.color, c.bold, sx, sy);
    });
    var labels = placed.length;

    legend(slide, P, flat, LANDC, SEA);
    return { vertices: used, pins: pins, labels: labels, budget: BUDGET };
  }

  /* A key and nothing else, in the same words as the board's own legend. Top
     right on the close-up, because bottom right is Aden. */
  function legend(slide, P, flat, LANDC, SEA) {
    var words = window.DossierMap.words || {};
    var rows = [
      { fill: P.houthi, label: words.houthi },
      { fill: P.gov, label: words.gov },
      { fill: P.contested, label: words.contested, dash: true },
      { fill: P.violetFill, label: words.gained, stroke: P.violet }
    ];
    var w = 2.9, rowH = 0.26, pad = 0.12;
    var x = W_IN - 0.25 - w, y = H_IN - 0.25 - (rows.length * rowH + 2 * pad);
    slide.addShape("roundRect", { x: x, y: y, w: w, h: rows.length * rowH + 2 * pad,
      fill: { color: flat(P.box, SEA) },
      line: { color: flat(P.boxLine, P.box), width: 1 }, rectRadius: 0.06 });
    rows.forEach(function (r, i) {
      var cy = y + pad + i * rowH;
      slide.addShape("rect", { x: x + w - pad - 0.34, y: cy + 0.05, w: 0.34, h: 0.16,
        fill: { color: flat(r.fill, flat(P.land, P.sea)) },
        line: { color: flat(r.stroke || P.boxLine, P.box), width: 1,
                dashType: r.dash ? "dash" : "solid" } });
      slide.addText([{ text: String(r.label || ""),
        options: { rtlMode: true, lang: "he-IL", fontFace: FONT, fontSize: 10,
                   color: flat(P.ink, P.box), align: "right" } }], {
        x: x + pad, y: cy, w: w - 2 * pad - 0.42, h: rowH,
        isTextBox: true, rtlMode: true, lang: "he-IL", fontFace: FONT,
        align: "right", valign: "middle", margin: 0 });
    });
  }

  return { slide: build };
})();

window.DossierDeckMap = DossierDeckMap;
