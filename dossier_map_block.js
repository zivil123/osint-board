/* One picture's BLOCK on a page: the heading above the canvas, the canvas in
   its frame's own shape, the caption under it and the HTML legend under that.

   Split out of dossier_view.js on 2026-09-17, when the three terrain maps moved
   to their own tab (מפות) and two views needed to draw the same block. Nothing
   about the markup changed in the move; only its address did.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapBlock = { html(maps), variantsOf(id) }

   `html` takes a LIST of maps (each a record from DOSSIER.maps) and returns one
   section per (map, variant), in the list's own order - the order the deck lays
   its slides, so what he scrolls and what he presents never differ. Which maps
   are in the list is the view's business: the dossier renders the maps with no
   `tab`, the maps tab those whose `tab` is "maps".

   Both views then scan the DOM for `.ds-canvas` to paint and `.ds-map` to hang
   a download button on, so neither knows anything per-view about the other.

   Reads `esc` (app.js) at call time, and DossierMap for the frame's aspect. */
"use strict";

var DossierMapBlock = (function () {
  /* The HTML legend under each map - the same fills the board's legend names
     (index.html #lg-territory), plus the gains layer in the ground-war violet.
     Hebrew only: nothing under a map is English. */
  var LEGEND = [
    { cls: "sw fill", style: "--sw-fill: var(--geo-fill-houthi)", he: "שטח בשליטת החות'ים" },
    { cls: "sw fill", style: "--sw-fill: var(--geo-fill-gov)", he: "שטח בשליטת הכוחות הלגיטימיים" },
    { cls: "sw fill dash hatch mark", style: "--sw-fill: var(--geo-fill-contested)", he: "שטח לחימה פעיל" },
    { cls: "sw fill gain", style: "", he: "נכבש בידי החות'ים (מאומת + משוער)" },
    { cls: "sw line dash", style: "--sw-c: var(--geo-control-line); --sw-w: 2px", he: "קו חזית משוער" }
  ];
  /* A CLEAN map draws none of those - no territory, no fighting, no line of
     contact (Ziv, 2026-09-17, on the crossing: strip everything unrelated) - so
     its key under the canvas says only what the picture shows. It mirrors the
     painted legend's own rows, which dossier_map_legend.js builds from the same
     flag, so the two keys can never disagree. */
  var CLEAN_LEGEND = [
    { cls: "sw line", style: "--sw-c: var(--ink); --sw-w: 3px", he: "נתיב שיט ראשי" },
    { cls: "sw dot", style: "--sw: var(--ink)", he: "נמל" }
  ];
  var MISSING_MAP = "המפה אינה זמינה";

  /* THE VIOLET ROW, GATED ON THE VIOLET THAT IS PAINTED (2026-09-22), by the
     painted key's own resolver `DossierMapLegend.drawsTint(m, GEO)`: "list" is
     the dossier's captured places (this row exactly as it was), "wash" the
     `gains: "tint"` layer over GEO.recent_gains, "" neither. Asking the list
     alone was the old gate and it was the wrong question - a tint picture drew
     a violet no row named, which is rule 1. The wash's swatch colour is SAMPLED
     from the painter (`tintFill`), never written again here, so the two keys
     cannot show two violets. */
  function gainRow(m) {
    var LG = window.DossierMapLegend, G0 = (typeof GEO !== "undefined" && GEO) ? GEO : null;
    var t = LG && LG.drawsTint ? LG.drawsTint(m, G0) : "";
    if (!t) return [];
    if (t !== "wash") return [LEGEND[3]];
    var theme = (window.DossierMap && DossierMap.screenTheme) || "light";
    return [{ cls: "sw fill", he: LEGEND[3].he,
      style: "--sw-fill: " + LG.tintFill(DossierMap.palette(theme)) }];
  }

  /* THE ZONE SIGNS, NAMED UNDER THE PICTURE. The rows come from
     dossier_map_zones.js - its words and its own colour table, read at call
     time for the theme the canvas beside them was drawn in - so a sign and its
     swatch can never be named differently or shown in a colour the picture
     does not use. The swatches are the board's shared ones (`.sw` in
     style.css): a ring for the mine, a bar for a fortified line, a dashed bar
     for an assessed one. They RESEMBLE the signs rather than reproducing them
     (the painted key draws the real thing, teeth and spikes included) and every
     row says in words what it marks, which is what design-law asks of any mark
     that carries meaning. Measured on the page's own ground #081A2F: the screen
     skin's ochre #A8761F holds 4.4:1 and its mine red #D2530A 4.2:1, both past
     the 3:1 a graphical mark needs. */
  var ZONE_SW = { mine: "sw dot", fort: "sw line", dotted: "sw line dash" };

  function zoneRows(m) {
    var Z = window.DossierMapZones;
    if (!m || !(m.zones || []).length) return [];
    if (!Z || typeof Z.legendWords !== "function") return [];
    var theme = (window.DossierMap && DossierMap.screenTheme) || "light";
    return Z.legendWords(m).map(function (r) {
      var c = Z.ink(r.key === "dotted" ? "fort" : r.key, theme);
      return { cls: ZONE_SW[r.key] || "sw line", he: r.label,
        style: r.key === "mine" ? "--sw: " + c
          : "--sw-c: " + c + "; --sw-w: 3px" };
    });
  }

  /* A HEAT MAP'S KEY IS A SCALE HERE TOO (2026-09-17). The painted key on the
     canvas takes its one fighting-zone row out and puts five level rows and a
     diamond row in its place (dossier_map_heat.js); this key sits under the
     same picture, so it must list the SAME rows in the SAME order or the reader
     has two keys to one map. The colours and the words are read from that file
     rather than written again: one list, two keys, no chance of drift. The
     diamond row keeps the row it replaced - its words, its hatch and its mark -
     with the fill cleared, because that one colour is no longer on the map. */
  function heatRows(rows) {
    var H = window.DossierMapHeat;
    if (!H || typeof H.ramp !== "function") return rows;
    var theme = (window.DossierMap && DossierMap.screenTheme) || "light";
    var ramp = H.ramp(theme), words = H.words || [], at = -1, i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].cls.indexOf("mark") >= 0) { at = i; break; }
    }
    if (at < 0 || ramp.length !== words.length) return rows;
    var old = rows[at];
    var scale = ramp.map(function (c, n) {
      return { cls: old.cls.replace(/\s*mark\b/, ""), style: "--sw-fill: " + c,
               he: words[n] };
    });
    scale.push({ cls: old.cls, style: "--sw-fill: transparent", he: old.he });
    return rows.slice(0, at).concat(scale, rows.slice(at + 1));
  }

  /* THE SEAM'S ROW, the twin of the painted key's (2026-09-18; regated and
     redrawn 2026-09-22). The picture paints the new ground in the Houthi colour
     and runs a border where it ends - Ziv: "still make a line that separates
     the new territories that they conquered so we know what they are" - so both
     keys name it, in the same words and in the same colour, read from the
     painter rather than written again here.

     THE GATE IS THE PAINTED KEY'S OWN, `DossierMapLegend.drawsSeam(m, GEO)`:
     the record's `gains` ("seam" or "tint"), else `control: "merged"`, else
     `gains_fill` - AND an edge in the seam layer. Asking whether the LAYER
     exists was the old gate and it was the wrong question: it printed the row
     under a picture that draws no border at all. One resolver, two keys.

     THE SWATCH IS THE MARK THAT IS ON THE MAP: since 2026-09-22 the border is
     thin and DASHED in the control-line ink, half the weight of the line of
     contact above it, so this row is `sw line dash` at 1px against that row's
     2px. It RESEMBLES the line, as the zone signs' swatches do - the painted
     key draws the real thing, casing and all. */
  function seamRow(m) {
    var GN = window.DossierMapGains, LG = window.DossierMapLegend;
    var G0 = (typeof GEO !== "undefined" && GEO) ? GEO : null;
    if (!GN || !LG || !LG.drawsSeam || !LG.drawsSeam(m, G0)) return [];
    var theme = (window.DossierMap && DossierMap.screenTheme) || "light";
    return [{ cls: "sw line dash",
      style: "--sw-c: " + GN.seamInk(DossierMap.palette(theme)) + "; --sw-w: 1px",
      he: LG.seamLabel() }];
  }

  /* THE TRIBAL KEY, FROM THE PAINTER'S OWN ROWS (2026-09-22). A `tribes` map
     paints no holder fill and no fighting belt, so this key may not name one -
     MAP_RULES rule 1 asks the painted key and this one to be built from the
     same flag "so the two cannot disagree", and until now they did: the
     picture showed three stances and the words under it said Houthi-held.
     The rows come from DossierMapTribes.legendRows, the same call
     dossier_map_legend.js makes for the box on the canvas, so the four Hebrew
     labels and the three tones exist in ONE place and the key can never name a
     stance the layer does not carry. That call ignores its ctx; u is 1 because
     nothing here draws a stroke.

     EVERY SWATCH HERE STANDS ON THE MAP'S LAND, and that is why these four
     rows carry a background of their own. The three tones are laid SEE-THROUGH
     over the terrain (alpha 0.42), and `.sw.fill` is backed by `--map-bg`, the
     SEA - so over the page's dark navy a green tribe would have read almost
     black beside a picture where it is pale green. The land colour comes from
     the same palette the canvas beside it was painted in. The fourth row takes
     the ground and no tone at all, with the same thin edge every `.sw.fill`
     carries: that IS what land with no dominant tribe looks like. */
  function tribeRows(m) {
    var T = window.DossierMapTribes;
    if (!m || m.tribes !== true || !T || !window.DossierMapDraw) return null;
    if (!window.DossierMap || !DossierMap.palette) return null;
    var P = DossierMap.palette(DossierMap.screenTheme || "light");
    var rows = T.legendRows(null, P, 1, m) || [];
    if (!rows.length) return null;
    return rows.map(function (r) {
      return { cls: "sw fill", he: r.label,
        style: "background-color: " + P.land +
          (r.fill ? "; --sw-fill: " + r.fill : "") };
    });
  }

  function legendHtml(m) {
    /* A map may carry NO key ON IT - `legend: false`, Ziv 2026-09-17: *"remove
       the box that explains everything, there's no need for it."*
       **ON A CLEAN MAP THAT TAKES THIS ONE OFF TOO, AND ONLY THERE.** A clean
       picture draws a route and two ports and its caption names both in words,
       which is what let him say there was no need for it. A plain one still
       paints territory, fighting belts, a line of contact and, at the strait,
       an ochre line with teeth - taking the words off the CANVAS (`legend`,
       `zone_text`) cannot take away the need to know what they are, so the key
       moves under the picture instead of vanishing with the box.
       **A STRIKE MAP TOO** (Ziv, 2026-09-23: "remove the squares that show what
       everything means"): it paints the count disc only, its caption says what
       the number is, and the list under it carries weapon, date and target. */
    if (m && m.legend === false && (m.clean || m.strikes)) return "";
    /* The tribal rows REPLACE the whole list, exactly as they do in the painted
       key, and nothing below is asked of a tribal map: it is neither clean,
       merged nor heat, and those branches index LEGEND by position. */
    var rows = tribeRows(m), seam = seamRow(m), gain = gainRow(m);
    if (!rows) {
      /* NO VIOLET, NO VIOLET ROW (2026-09-18; regated 2026-09-22 - gainRow
         above). This key is the painted one's twin and asks its resolver, so
         two keys to one picture cannot disagree. The row is SPLICED IN rather
         than taken out of LEGEND, which the merged branch below indexes by
         position; a clean or tribal picture can draw the wash too, so there it
         is added at the end instead. */
      rows = (m && m.clean) ? CLEAN_LEGEND
        : LEGEND.slice(0, 3).concat(gain, [LEGEND[4]]);
      if (!(m && m.clean)) gain = [];
      /* A MERGED clean map puts the two territories and the boundary between
         them back (Ziv, 2026-09-17), and takes back exactly those three rows -
         never a row for the MERGED ground, which he asked to read as part of
         Houthi ground. A WASH is a different matter: it is a colour that IS on
         the picture, so gainRow's row is spent here too, before the seam, and
         once. Same rows the painted key adds. */
      if (m && m.clean && m.control === "merged") {
        rows = [LEGEND[0], LEGEND[1], LEGEND[4]].concat(gain, seam, CLEAN_LEGEND);
        seam = []; gain = [];
      }
      if (m && m.heat) rows = heatRows(rows);
    }
    /* A row appears only when the map carries the thing it names, the same
       bargain the painted key keeps: no zones, no zone rows. The seam goes in
       under the line of contact, where the painted key puts it - on the merged
       branch that is inside the list above, before the route and the ports, so
       it is spent there and added once. */
    rows = rows.concat(gain, seam, zoneRows(m));
    return '<div class="ds-legend" aria-label="מקרא המפה">' +
      rows.map(function (r) {
        return '<span class="ds-lg-row"><span class="' + r.cls + '"' +
          (r.style ? ' style="' + r.style + '"' : "") + "></span>" + esc(r.he) + "</span>";
      }).join("") + "</div>";
  }

  /* The frame's own shape (3:2 for the close-up, 16:9 for the rest), so the box
     has the canvas's shape before anything is drawn in it. The WIDE frame,
     unless the record's `page_frame` names another - then the box takes that
     shape and so does what the painter draws in it (2026-09-22). */
  function aspectOf(id) {
    var a = window.DossierMap && DossierMap.aspect ? DossierMap.aspect(id) : 16 / 9;
    return a.toFixed(4);
  }

  /* The pictures the painter can draw for a frame, plain first - the deck's own
     list, so the page and the file carry the same blocks. Without the call (an
     older painter) a map is its one plain picture. */
  function variantsOf(id) {
    if (window.DossierMap && typeof DossierMap.variantsOf === "function") {
      try {
        var v = DossierMap.variantsOf(id);
        if (Array.isArray(v) && v.length) return v;
      } catch (e) { /* fall through to the plain picture */ }
    }
    return ["plain"];
  }

  /* A block's heading: the map's own title when it has one, else the caption's
     first clause. The cut is at a full stop or a SPACED dash - never a bare
     hyphen, which in Hebrew joins a prefix to a number ("נכון ל-12"). Since
     2026-09-17 this is the ONLY heading a picture carries: the painter no
     longer writes one into the canvas, so the words appear once. */
  function clauseOf(text) {
    var t = String(text || "").trim();
    var m = /[.。]|\s[—–-]\s/.exec(t);
    return (m ? t.slice(0, m.index) : t).replace(/[,،]\s*$/, "").trim();
  }
  function blockHeading(m, variant) {
    if (variant) return clauseOf(variant.caption_he) || blockHeading(m, null);
    return String(m.title_he || "").trim() || clauseOf(m.caption_he);
  }

  /* When the heading was CUT OUT of the caption, the caption prints what is
     LEFT. Design law: a row never repeats the name of the group it sits in -
     and a one-clause caption with no title beside it would otherwise print
     twice, once as the heading and once under the map. */
  function captionAfter(text, heading) {
    var t = String(text || "").trim();
    if (!heading || t.indexOf(heading) !== 0) return t;
    return t.slice(heading.length).replace(/^[\s.,،。—–-]+/, "").trim();
  }

  /* THE STRIKE TALLY IS TEXT, NOT PAINT (2026-09-22). Ziv: "don't put the text
     inside of the map, put it as something I can take" - so a record carrying
     `strikes` gets an empty box under its caption and dossier_map_strikes_list.js
     fills it with the same tally the picture counts, plus a copy button. The box
     goes where the numbered explanations go, between the caption and the key. */
  /* ESRI'S LICENCE, UNDER THE PICTURE (2026-09-23). A `ground: "streets"` record
     is drawn on Esri street tiles, and their terms ask that the credit appear
     wherever the tiles appear - so the frame's own `attribution` from GEO.relief
     prints under the caption. Terrain grounds carry a different credit, already
     on the deck's title slide, so they get nothing here. The text is Latin in an
     RTL page: `dir="ltr"` keeps the commas at its end. */
  function creditLine(m) {
    if (!m || m.ground !== "streets") return "";
    var G0 = (typeof GEO !== "undefined" && GEO) ? GEO : null;
    var e = G0 && G0.relief ? G0.relief[m.frame] : null;
    var text = e && e.attribution ? String(e.attribution).trim() : "";
    if (!text) return "";
    return '<div class="ds-credit" dir="ltr" style="font-size:.75em;opacity:.7">' +
      esc(text) + "</div>";
  }

  function strikesBox(m) {
    return (m && m.strikes)
      ? '<div class="ds-strikes-box" data-map="' + esc(m.id) + '"></div>' : "";
  }

  function blockHtml(m, key, variant) {
    var heading = blockHeading(m, variant);
    var raw = variant ? (variant.caption_he || "") : (m.caption_he || "");
    var cut = variant ? true : !String(m.title_he || "").trim();
    var caption = cut ? captionAfter(raw, heading) : raw;
    return '<section class="ds-map" data-map="' + esc(m.id) + '" data-variant="' + esc(key) + '">' +
      (heading ? '<h3 class="ds-map-h">' + esc(heading) + "</h3>" : "") +
      '<div class="ds-map-wide"><div class="ds-map-box" style="--ar: ' + aspectOf(m.id) + '">' +
      '<canvas class="ds-canvas" data-map-id="' + esc(m.id) + '" data-variant="' + esc(key) +
      '" role="img" aria-label="' + esc(heading) + '"></canvas>' +
      (window.DossierMap ? "" : '<p class="ds-map-missing">' + MISSING_MAP + "</p>") +
      "</div></div>" +
      (caption ? '<p class="ds-caption">' + esc(caption) + "</p>" : "") +
      creditLine(m) +
      strikesBox(m) +
      legendHtml(m) +
      "</section>";
  }

  /* One block per (map, variant), every variant of a map together. The plain
     picture reads the map's own caption; a variant reads its own. */
  function html(maps) {
    var out = (maps || []).map(function (m) {
      return variantsOf(m.id).map(function (key) {
        var v = key !== "plain" && m.variants && m.variants[key] ? m.variants[key] : null;
        return blockHtml(m, key, v);
      }).join("");
    }).join("");
    /* The boxes above are filled on a zero timer, not here: this call returns a
       STRING and the view writes it into the pane on the next statement, so the
       fill has to wait until that has happened. Neither view had to learn it. */
    if ((maps || []).some(function (m) { return m && m.strikes; })) {
      setTimeout(function () {
        if (window.DossierStrikesList) DossierStrikesList.mountAll(document);
      }, 0);
    }
    return out;
  }

  return { html: html, variantsOf: variantsOf };
})();

window.DossierMapBlock = DossierMapBlock;
