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

  function hasGains() {
    var D0 = (typeof DOSSIER !== "undefined" && DOSSIER) ? DOSSIER : null;
    return !!(D0 && D0.gains && D0.gains.length);
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

  function legendHtml(m) {
    /* A map may carry NO key ON IT - `legend: false`, Ziv 2026-09-17: *"remove
       the box that explains everything, there's no need for it."*
       **ON A CLEAN MAP THAT TAKES THIS ONE OFF TOO, AND ONLY THERE.** A clean
       picture draws a route and two ports and its caption names both in words,
       which is what let him say there was no need for it. A plain one still
       paints territory, fighting belts, a line of contact and, at the strait,
       an ochre line with teeth - taking the words off the CANVAS (`legend`,
       `zone_text`) cannot take away the need to know what they are, so the key
       moves under the picture instead of vanishing with the box. */
    if (m && m.legend === false && m.clean) return "";
    /* NO GAINS, NO GAINS ROW (2026-09-18). A window in which nothing changed
       hands leaves DOSSIER.gains empty and the painter draws no violet, so the
       key must not name it - and this key is the painted one's twin
       (dossier_map_legend.js does the same against the same list), because two
       keys to one picture may never disagree. Filtered rather than taken out of
       LEGEND, which the merged branch below indexes by position. */
    var rows = (m && m.clean) ? CLEAN_LEGEND
      : hasGains() ? LEGEND
        : LEGEND.filter(function (r) { return r.cls.indexOf("gain") < 0; });
    /* A MERGED clean map puts the two territories and the boundary between them
       back (Ziv, 2026-09-17), and takes back exactly those three rows - never
       the gains row, because he asked for the new ground to read as part of
       Houthi ground and a row naming a colour that is no longer on the picture
       would send the reader hunting for it. Same three the painted key adds. */
    if (m && m.clean && m.control === "merged") {
      rows = [LEGEND[0], LEGEND[1], LEGEND[4]].concat(CLEAN_LEGEND);
    }
    if (m && m.heat) rows = heatRows(rows);
    /* A row appears only when the map carries the thing it names, the same
       bargain the painted key keeps: no zones, no zone rows. */
    rows = rows.concat(zoneRows(m));
    return '<div class="ds-legend" aria-label="מקרא המפה">' +
      rows.map(function (r) {
        return '<span class="ds-lg-row"><span class="' + r.cls + '"' +
          (r.style ? ' style="' + r.style + '"' : "") + "></span>" + esc(r.he) + "</span>";
      }).join("") + "</div>";
  }

  /* The frame's own shape (3:2 for the close-up, 16:9 for the rest), so the box
     has the canvas's shape before anything is drawn in it. Always the WIDE
     frame: the square picture is a download, never a canvas on the page. */
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
      legendHtml(m) +
      "</section>";
  }

  /* One block per (map, variant), every variant of a map together. The plain
     picture reads the map's own caption; a variant reads its own. */
  function html(maps) {
    return (maps || []).map(function (m) {
      return variantsOf(m.id).map(function (key) {
        var v = key !== "plain" && m.variants && m.variants[key] ? m.variants[key] : null;
        return blockHtml(m, key, v);
      }).join("");
    }).join("");
  }

  return { html: html, variantsOf: variantsOf };
})();

window.DossierMapBlock = DossierMapBlock;
