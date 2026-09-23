/* dossier_pptx_edit.js - the EDITABLE twin of a map picture: one PowerPoint
   slide that looks like the PNG, where every word, pin, dot, number badge,
   leader line and the key box is its own object Ziv can move and retype.

   window.DossierPptx = { fromLayers(layers, meta), build(id, theme, variant,
                          shape, opts), last }

   ONE PAINT, TWO OUTPUTS (Ziv, 2026-09-23). The map painter is asked for its
   LAYERS - DossierMap.exportLayers() - which is the export picture with every
   overlay mark left OFF, plus the list of what it would have drawn on top, in
   draw order and in export-canvas pixels. The slide is that base picture laid
   full-bleed at its own resolution, then one native object per record in the
   same order, so the z-order is the painter's. Nothing is re-derived here:
   dossier_deck_map.js places its names with its own heuristic and drifts from
   the picture, which is the one thing this file exists not to do.

   The base PNG goes into the file byte for byte (pptxgenjs writes the base64
   straight into the zip), so the picture on the slide is the picture.

   Text: the font is Heebo, the board's own. Windows sees a static weight as a
   FAMILY NAME, so 500 is "Heebo Medium", 600 "Heebo SemiBold" and 700 is
   "Heebo" set bold - naming "Heebo" bold for 600 renders 700 and looks heavy.
   The canvas halo becomes a PowerPoint GLOW, which sits behind the letters as
   the halo does; an outline would thin them.

   PLACEMENT is by the painter's ANCHOR, not by the ink box alone: the edge the
   canvas aligned to (x with left/right/center) becomes the text box edge with
   wrap off, and the baseline is recovered from the ink box plus the ascent of
   the same string measured live in the same font. PowerPoint then puts the
   first baseline PPT_BASE_EM below the box top; TEXT_DY_EM is the ONE vertical
   calibration knob for what that model misses.

   Verify with `?png=dry` (or opts.dry): the file is built in full and stashed
   on DossierPng.dry.items as kind "pptx" instead of being saved. A real tap on
   the board drops a file on the screen of the man sitting at it.

   No ES modules - the page runs from file://. The PptxGenJS loader is the
   deck's (DossierDeck.loadLib), never a second copy. */
"use strict";

var DossierPptx = (function () {
  var SLIDE_W = 10, SLIDE_H = 5.625;          // LAYOUT_16x9, inches
  var MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  /* WHERE POWERPOINT PUTS THE FIRST BASELINE (measured 2026-09-23 on its own
     render: Heebo 400/500/600/700, Latin and Hebrew, 36-120 px, zero insets,
     top anchor, single spacing, set or unset - all at 0.856 em +-0.01). A
     single line is 1.2 x the font's own line (win = typo = hhea ascent 2146,
     descent 862 on 2048 units), shared out in the font's ascent:descent ratio,
     so the baseline sits 1.2 x 2146 / 3008 em below the box top - NOT the
     ascent of 1.048 em a browser uses, which put every word 0.19 em high. */
  var HEEBO_ASC = 2146, HEEBO_DESC = 862;
  var PPT_BASE_EM = 1.2 * HEEBO_ASC / (HEEBO_ASC + HEEBO_DESC);
  /* THE vertical calibration, in em of the item's own size, added to every
     text box top for what the model above misses; positive moves words DOWN. */
  var TEXT_DY_EM = -0.022;
  /* Box height in em: tall enough for one Heebo line at 100% spacing. The text
     is top-anchored, so this never moves a word. */
  var LINE_EM = 1.8;
  /* The canvas halo is a stroke of haloW centred on the glyph edge: a crisp
     white band haloW/2 wide round every letter. PowerPoint's glow is a soft
     falloff, far fainter at its radius than its name says: at rad = haloW/2 it
     barely showed. Measured 2026-09-23 as white added over the base by
     distance from the ink (west_fronts, haloW 6): the picture gives +47 / +42
     / +18 / +2 at 2 / 3 / 4 / 5 px; rad = 3.5 x haloW comes closest over the
     band (+45 / +37 / +21 / +7) and gives the lowest diff round the words;
     2x left the halo half as bright, 5x fogs the ground. Opacity stays the
     painter's halo alpha - one source. */
  var GLOW_K = 3.5;
  var MIN_IN = 0.01;                          // a zero-size shape does not open
  var NO_LIB = "ההורדה דורשת חיבור לאינטרנט";
  var NO_MAP = "המפה אינה זמינה";
  var FAILED = "יצירת המצגת נכשלה";
  var DRY = /[?&]png=dry(&|$)/.test(location.search);
  var out = { last: null };

  /* ---- colours --------------------------------------------------------------
     One parser for every CSS colour a painter may use, named ones included: the
     browser's own. A canvas context normalises fillStyle to "#rrggbb" or
     "rgba(r, g, b, a)", and an unparseable string leaves the sentinel. */
  var cx = null;
  function ctx() {
    if (!cx) cx = document.createElement("canvas").getContext("2d");
    return cx;
  }
  function hex2(n) { n = Math.max(0, Math.min(255, Math.round(+n))); return (n < 16 ? "0" : "") + n.toString(16); }
  function col(css) {
    if (css == null || css === "" || css === "none") return null;
    var c = ctx(), SENT = "#010203";
    c.fillStyle = SENT; c.fillStyle = String(css);
    var v = String(c.fillStyle);
    if (v === SENT && String(css).toLowerCase() !== SENT) return null;
    if (v.charAt(0) === "#") return { hex: v.slice(1, 7).toUpperCase(), alpha: 1 };
    var m = /rgba?\(([^)]+)\)/.exec(v);
    if (!m) return null;
    var p = m[1].split(",").map(function (s) { return parseFloat(s); });
    var a = p.length > 3 ? p[3] : 1;
    if (!(a > 0)) return null;                 // fully transparent = not there
    return { hex: (hex2(p[0]) + hex2(p[1]) + hex2(p[2])).toUpperCase(), alpha: a };
  }
  function tr(c) { return Math.round((1 - c.alpha) * 100); }
  function fillOf(css) {
    var c = col(css);
    return c ? { color: c.hex, transparency: tr(c) } : undefined;
  }
  function lineOf(css, wPx, g) {
    var c = col(css);
    if (!c || !(+wPx > 0)) return undefined;
    return { color: c.hex, transparency: tr(c), width: pt(wPx, g) };
  }

  /* ---- geometry: export px -> slide inches / points ------------------------ */
  function X(px, g) { return g.ox + px * g.s; }
  function Y(px, g) { return g.oy + px * g.s; }
  function L(px, g) { return px * g.s; }
  function pt(px, g) { return px * g.s * 72; }

  /* ---- text ------------------------------------------------------------------ */
  function weightOf(w) {
    if (w === "bold" || w === "bolder") return 700;
    var n = parseInt(w, 10);
    return n > 0 ? n : 400;
  }
  /* THE WEIGHT THE PICTURE SHOWS, not the one asked for. The page loads only
     the Heebo weights its font link names (400/500/600 on 2026-09-23), so a
     painter's 700 is drawn by the browser in 600 - and a slide set in Heebo
     Bold came out wider and heavier (marib_objectives' key titles, 2 px off).
     One source: the faces the document declares, matched the way CSS matches
     a weight (asked 400-500: up to 500, then down, then up; under 400: down,
     then up; over 500: up, then down). No Heebo face declared = trust w. */
  function shownWeight(w) {
    var have = [];
    try {
      document.fonts.forEach(function (f) {
        if (!/heebo/i.test(f.family) || f.status === "error") return;
        var r = String(f.weight).split(/\s+/).map(Number);
        if (r.length > 1 && w >= r[0] && w <= r[1]) have.push(w);
        else if (r[0] > 0) have.push(r[0]);
      });
    } catch (e) { have = []; }
    if (!have.length || have.indexOf(w) >= 0) return w;
    var up = have.filter(function (v) { return v > w; }).sort(function (a, b) { return a - b; });
    var down = have.filter(function (v) { return v < w; }).sort(function (a, b) { return b - a; });
    if (w >= 400 && w <= 500) {
      var near = up.filter(function (v) { return v <= 500; });
      return near.length ? near[0] : down.length ? down[0] : up[0];
    }
    if (w < 400) return down.length ? down[0] : up[0];
    return up.length ? up[0] : down[0];
  }
  /* The four statics installed on this machine; anything else lands on the
     nearest, never on a family PowerPoint would have to substitute. */
  function faceOf(w) {
    if (w <= 450) return { face: "Heebo", bold: false };
    if (w <= 550) return { face: "Heebo Medium", bold: false };
    if (w <= 650) return { face: "Heebo SemiBold", bold: false };
    return { face: "Heebo", bold: true };
  }
  function cssFont(it) {
    if (it.font && /\d(\.\d+)?px/.test(it.font)) return it.font;
    return weightOf(it.weight) + " " + (+it.size || 16) + "px Heebo, sans-serif";
  }
  function ascentAt(str, font, baseline, sp) {
    var c = ctx();
    c.font = font; c.textBaseline = baseline || "alphabetic"; c.direction = "rtl";
    if ("letterSpacing" in c) c.letterSpacing = (+sp || 0) + "px";
    var m = c.measureText(str);
    return { asc: m.actualBoundingBoxAscent || 0, adv: m.width || 0 };
  }
  /* Where the canvas put the alphabetic baseline. The ink box is export pixels
     by contract, so its top plus this string's alphabetic ascent IS the
     baseline; without a box the anchor is converted through the same measure. */
  function baselineOf(it, font) {
    var alpha = ascentAt(it.str, font, "alphabetic", it.spacing);
    if (it.box && isFinite(+it.box.y)) return { y: +it.box.y + alpha.asc, adv: alpha.adv };
    var b = it.baseline || "alphabetic";
    if (b === "alphabetic") return { y: +it.y, adv: alpha.adv };
    return { y: +it.y - ascentAt(it.str, font, b, it.spacing).asc + alpha.asc, adv: alpha.adv };
  }
  function alignOf(a) {
    if (a === "center" || a === "centre") return "center";
    if (a === "left" || a === "end") return "left";   // RTL: end is the left edge
    return "right";                                   // right, start, missing
  }
  function addText(slide, it, g, opt) {
    var str = String(it.str == null ? "" : it.str);
    var fill = col(it.fill);
    if (!str.trim() || !fill) return false;
    var size = +it.size || 16, w = weightOf(it.weight), f = faceOf(shownWeight(w));
    var font = cssFont(it), base = baselineOf(it, font);
    var align = alignOf(it.align);
    /* Width: the wider of the ink and the advance, plus slack both sides. With
       wrap off the width only decides where the aligned edge is. */
    var wPx = Math.max(+(it.box && it.box.w) || 0, base.adv) + size * 0.4;
    var left = align === "right" ? +it.x - wPx : align === "center" ? +it.x - wPx / 2 : +it.x;
    var top = base.y - (PPT_BASE_EM - TEXT_DY_EM) * size, hPx = size * LINE_EM;
    /* A TURNED word (a lane name along its road): `box` is the unrotated ink
       box about the rotated centre, and PowerPoint turns a shape about ITS
       centre - so the text box is centred on the ink box both ways, then
       turned by the same angle. */
    var rot = +it.rot || 0;
    if (rot && it.box) {
      var cxp = +it.box.x + +it.box.w / 2, cyp = +it.box.y + +it.box.h / 2;
      align = "center"; left = cxp - wPx / 2;
      hPx = Math.max(2 * (cyp - top), size * 0.5);
    }
    var o = {
      x: X(left, g), y: Y(top, g),
      w: Math.max(L(wPx, g), MIN_IN), h: Math.max(L(hPx, g), MIN_IN),
      fontFace: f.face, bold: f.bold, fontSize: pt(size, g),
      color: fill.hex, transparency: tr(fill),
      margin: [0, 0, 0, 0], fit: "none", wrap: false, valign: "top",
      align: align, rtlMode: true, lang: "he-IL", objectName: str.slice(0, 60)
    };
    var halo = col(it.halo);
    if (halo && +it.haloW > 0) o.glow = { size: pt(+it.haloW * GLOW_K, g), opacity: halo.alpha, color: halo.hex };
    if (+it.spacing > 0) o.charSpacing = pt(+it.spacing, g);
    if (rot) o.rotate = rot;
    if (opt) Object.keys(opt).forEach(function (k) { o[k] = opt[k]; });
    slide.addText(str, o);
    return true;
  }

  /* ---- marks, lines, badges, the key box ----------------------------------- */
  var SHAPE = { dot: "ellipse", ring: "ellipse", diamond: "diamond", square: "rect", triangle: "triangle" };

  /* The painter's geometry in r (Recorder, 2026-09-23): dot, ring and diamond
     span 2r about the centre (diamond r = centre to vertex), square r = half
     side, triangle apex at y-1.15r and base at y+0.8r, x+-1.1r - PowerPoint's
     upright isosceles triangle on exactly that box. */
  function markBox(it, r) {
    if (it.kind === "triangle") return { x0: it.x - 1.1 * r, y0: it.y - 1.15 * r, w: 2.2 * r, h: 1.95 * r };
    return { x0: it.x - r, y0: it.y - r, w: 2 * r, h: 2 * r };
  }
  function addMark(slide, it, g) {
    var r = +it.r;
    if (!(r > 0)) return false;
    var b = markBox({ kind: it.kind, x: +it.x, y: +it.y }, r);
    var o = { x: X(b.x0, g), y: Y(b.y0, g), w: L(b.w, g), h: L(b.h, g), objectName: it.kind };
    var f = fillOf(it.fill), ln = lineOf(it.stroke, it.strokeW, g);
    if (f) o.fill = f;
    if (ln) { var d = dashOf(it.dash, it.strokeW); if (d) ln.dashType = d; o.line = ln; }
    if (!f && !ln) return false;
    if (+it.rot) o.rotate = +it.rot;
    slide.addShape(SHAPE[it.kind], o);
    return true;
  }
  /* A key-box swatch too rich for one shape, painted by the painter itself:
     laid as the picture it is, at its own pixel size. */
  function addImage(slide, it, g) {
    if (typeof it.src !== "string" || it.src.indexOf("base64,") < 0 || !(+it.w > 0 && +it.h > 0)) return false;
    slide.addImage({ data: it.src, x: X(+it.x, g), y: Y(+it.y, g), w: L(+it.w, g), h: L(+it.h, g),
                     objectName: "swatch" });
    return true;
  }
  /* PowerPoint's preset dashes are multiples of the line width: sysDot 1:1,
     sysDash 3:1, dash 4:3, lgDash 8:3. The canvas dash is read as its first
     segment over the width and the nearest preset taken. */
  function dashOf(d, wPx) {
    if (!d || !d.length || !(+d[0] > 0)) return null;
    var k = +d[0] / Math.max(+wPx || 1, 1);
    return k <= 1.5 ? "sysDot" : k <= 3.5 ? "sysDash" : k <= 6 ? "dash" : "lgDash";
  }
  function addLine(slide, it, g) {
    var pts = (it.pts || []).filter(function (p) { return p && isFinite(+p[0]) && isFinite(+p[1]); });
    var ln = lineOf(it.stroke, it.width || 1, g);
    if (pts.length < 2 || !ln) return false;
    var xs = pts.map(function (p) { return +p[0]; }), ys = pts.map(function (p) { return +p[1]; });
    var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
    var x1 = Math.max.apply(null, xs), y1 = Math.max.apply(null, ys);
    var dash = dashOf(it.dash, it.width), a = it.arrow;
    if (dash) ln.dashType = dash;
    if (a === true || a === "end" || a === "both") ln.endArrowType = "triangle";
    if (a === "start" || a === "both") ln.beginArrowType = "triangle";
    /* One custGeom per line, open: a path of one moveTo and its lnTos. Points
       are inches from the shape's own corner. */
    slide.addShape("custGeom", {
      x: X(x0, g), y: Y(y0, g), w: Math.max(L(x1 - x0, g), MIN_IN), h: Math.max(L(y1 - y0, g), MIN_IN),
      points: pts.map(function (p) { return { x: L(+p[0] - x0, g), y: L(+p[1] - y0, g) }; }),
      line: ln, objectName: "line"
    });
    return true;
  }
  function disc(slide, x, y, r, g, o) {
    o.x = X(x - r, g); o.y = Y(y - r, g); o.w = L(2 * r, g); o.h = L(2 * r, g);
    slide.addShape("ellipse", o);
  }
  /* The numbered disc as the painter draws it: a halo disc haloW wider, the
     disc with its ring, and the digit - the same text path as every word,
     centred, middle baseline, dy below the centre. */
  function addBadge(slide, it, g) {
    var r = +it.r, x = +it.x, y = +it.y, f = fillOf(it.fill);
    if (!(r > 0) || !f) return false;
    var halo = fillOf(it.halo);
    if (halo && +it.haloW > 0) disc(slide, x, y, r + +it.haloW, g, { fill: halo, objectName: "badge halo" });
    var o = { fill: f, objectName: "badge " + it.str }, ln = lineOf(it.stroke, it.strokeW, g);
    if (ln) o.line = ln;
    disc(slide, x, y, r, g, o);
    addText(slide, { str: it.str, x: x, y: y + (+it.dy || 0), align: "center", baseline: "middle",
                     size: +it.size || r, weight: it.weight || 700, font: it.font,
                     fill: it.color || "#fff" }, g);
    return true;
  }
  function addBox(slide, it, g) {
    var f = fillOf(it.fill), ln = lineOf(it.stroke, it.strokeW || 1, g);
    if (!(+it.w > 0 && +it.h > 0) || (!f && !ln)) return false;
    var o = { x: X(+it.x, g), y: Y(+it.y, g), w: L(+it.w, g), h: L(+it.h, g), objectName: "key" };
    if (f) o.fill = f;
    if (ln) o.line = ln;
    if (+it.radius > 0) o.rectRadius = L(+it.radius, g);
    slide.addShape(+it.radius > 0 ? "roundRect" : "rect", o);
    return true;
  }
  var ADD = { text: addText, dot: addMark, ring: addMark, diamond: addMark, square: addMark,
              triangle: addMark, line: addLine, badge: addBadge, box: addBox, image: addImage };

  /* ---- the slide ------------------------------------------------------------ */

  /* layers = {w, h, base, items}; meta = {id, theme, variant, shape, title}.
     The picture is fitted to the 16:9 slide: a wide export fills it edge to
     edge at 256 px an inch; a square one is centred at full height. */
  function fromLayers(layers, meta) {
    var Lib = window.PptxGenJS;
    if (!Lib) throw new Error(NO_LIB);
    if (!layers || typeof layers.base !== "string" || layers.base.indexOf("base64,") < 0)
      throw new Error(NO_MAP);
    meta = meta || {};
    var w = +layers.w, h = +layers.h, s = Math.min(SLIDE_W / w, SLIDE_H / h);
    var g = { s: s, ox: (SLIDE_W - w * s) / 2, oy: (SLIDE_H - h * s) / 2 };
    var pptx = new Lib();
    pptx.layout = "LAYOUT_16x9";
    pptx.title = meta.title || meta.id || "map";
    var slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addImage({ data: layers.base, x: g.ox, y: g.oy, w: w * s, h: h * s,
                     altText: meta.id || "map", objectName: "picture" });
    /* seen = what the painter recorded, byKind = what became an object; the
       two differ only by what was skipped (no colour, no size, unknown kind). */
    var counts = { items: 0, placed: 0, skipped: 0, text: 0, seen: {}, byKind: {} };
    (layers.items || []).forEach(function (it) {
      counts.items++;
      var k = (it && it.kind) || "?";
      counts.seen[k] = (counts.seen[k] || 0) + 1;
      var fn = it && ADD[it.kind], ok = false;
      try { ok = fn ? fn(slide, it, g) : false; }
      catch (err) { console.warn("dossier_pptx_edit: item failed", it, err); }
      if (!ok) { counts.skipped++; return; }
      counts.placed++;
      counts.byKind[it.kind] = (counts.byKind[it.kind] || 0) + 1;
      if (it.kind === "text" || it.kind === "badge") counts.text++;
    });
    out.last = { id: meta.id, shape: meta.shape, w: w, h: h, counts: counts };
    return pptx;
  }

  function shapeSize(shape) {
    var list = (window.DossierPng && DossierPng.shapes) || [];
    for (var i = 0; i < list.length; i++) if (list[i].shape === shape) return list[i];
    return shape === "square" ? { w: 2048, h: 2048 } : { w: 2560, h: 1440 };
  }
  function nameFor(id, variant, shape) {
    if (window.DossierPng && typeof DossierPng.fileName === "function")
      return DossierPng.fileName(id, variant, shape, "pptx");
    return "osint-map-" + id + "-" + shape + ".pptx";
  }

  /* Build the slide for one map and either save it or, dry, stash it. Resolves
     to the dry item or to {name, saved:true}. */
  function build(mapId, theme, variant, shape, opts) {
    theme = theme || "light"; variant = variant || "plain"; shape = shape || "wide";
    var dry = DRY || !!(opts && opts.dry), S = shapeSize(shape);
    var P = window.DossierMap, D = window.DossierDeck;
    if (!P || typeof P.exportLayers !== "function") return Promise.reject(new Error(NO_MAP));
    if (!D || typeof D.loadLib !== "function") return Promise.reject(new Error(NO_LIB));
    var name = nameFor(mapId, variant, shape);
    return D.loadLib()
      .then(function () { return typeof P.ready === "function" ? P.ready(theme) : null; })
      .then(function () { return P.exportLayers(mapId, theme, S.w, S.h, variant, shape); })
      .then(function (layers) {
        var pptx = fromLayers(layers, { id: mapId, theme: theme, variant: variant, shape: shape });
        return pptx.write({ outputType: dry ? "base64" : "blob", compression: true });
      })
      .then(function (data) {
        if (dry) return stash(mapId, theme, variant, shape, S, name, data);
        var save = window.DossierSave;
        if (typeof save !== "function") throw new Error(FAILED);
        save({ blob: data, fileName: name, mime: MIME });
        return { name: name, saved: true, counts: out.last && out.last.counts };
      });
  }
  function stash(id, theme, variant, shape, S, name, b64) {
    var item = { id: id, variant: variant, shape: shape, theme: theme, kind: "pptx",
                 width: S.w, height: S.h, name: name,
                 bytes: Math.round(b64.length * 3 / 4),
                 counts: out.last && out.last.counts,
                 dataUrl: "data:" + MIME + ";base64," + b64 };
    if (window.DossierPng && typeof DossierPng.stash === "function") DossierPng.stash(item);
    return item;
  }

  return { fromLayers: fromLayers, build: build, get last() { return out.last; },
           MIME: MIME, TEXT_DY_EM: TEXT_DY_EM };
})();

window.DossierPptx = DossierPptx;
