/* The fronts view, round 3 (Ziv, 2026-09-25): the activity ranking at the top
   of the tab, the 1-10 activity colour, and every place a text names marked on
   the shared map. Loaded just BEFORE battlefronts.js, which calls into it.

   Ziv: "you're saying some names... you should also mark them on the map
   because I don't know what they mean" - so every [[name]] in a text becomes a
   highlighted word the reader can tap (or reach by keyboard), and the map
   shows where it is. And: "in one glance I will know which fronts are the most
   active" - so a ranked strip with a score from 1 to 10.

   This file SORTS and SCORES nothing: the score, its direction, the order and
   the place list all arrive in `const BATTLEFRONTS` (generated). A front with
   no score gets no chip and an empty grey bar; a name with no place entry
   prints as plain text. Neither throws.

   Map layers here carry their OWN L.svg renderer, removed in clear(): without
   it Leaflet creates the map's default renderer on first use and leaves it
   behind, one layer the board did not have before the tab was opened.

   NO ES modules (the page runs from file://). esc() is declared in app.js. */
"use strict";

var BfMarks = (function () {
  /* The ONE source for the 1-10 colours. A straight mix in OKLab from a muted
     slate (1) to the board's fighting red, --geo-front-mark (10): the hue warms
     and the chroma rises together, so "redder" always means "more fighting".
     Every stop is >= 4.7:1 on --bg, so the score number is legible in its own
     colour; the text ON a filled stop is picked by contrast in textOn(). */
  var SCALE = ["#8494A8", "#968E9C", "#A78890", "#B68084", "#C37877",
               "#D06F69", "#DD645B", "#E9574C", "#F44639", "#FF2D20"];
  var DARK = "#081A2F", LIGHT = "#FFFFFF";   /* --bg and white */

  var DIR = {
    up: { arrow: "↑", he: "בעלייה" },
    steady: { arrow: "", he: "ללא שינוי" },
    down: { arrow: "↓", he: "בירידה" }
  };

  function scoreOf(front) {
    var n = Number(front && front.score);
    return (Number.isInteger(n) && n >= 1 && n <= 10) ? n : null;
  }

  function colour(score) {
    return score ? SCALE[score - 1] : null;
  }

  function lumin(hex) {
    var c = [1, 3, 5].map(function (i) {
      var v = parseInt(hex.substr(i, 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function textOn(score) {
    var hex = colour(score);
    if (!hex) return null;
    var l = lumin(hex);
    var dark = (l + 0.05) / (lumin(DARK) + 0.05);
    var light = (lumin(LIGHT) + 0.05) / (l + 0.05);
    return dark >= light ? DARK : LIGHT;
  }

  /* The custom properties a coloured element reads: --bf-c fill, --bf-t ink. */
  function styleVars(front) {
    var s = scoreOf(front);
    return s ? "--bf-c:" + colour(s) + ";--bf-t:" + textOn(s) + ";" : "";
  }

  function dirHtml(front) {
    var d = DIR[front && front.direction];
    if (!d) return "";
    return '<span class="bf-dir bf-dir-' + front.direction + '">' +
      (d.arrow ? '<span aria-hidden="true">' + d.arrow + "</span> " : "") + d.he + "</span>";
  }

  /* ---- the ranking strip ---------------------------------------------------- */

  function rowHtml(front) {
    var s = scoreOf(front);
    return '<li><button type="button" class="bf-row" data-front="' + esc(front.id) + '"' +
      ' style="' + styleVars(front) + '">' +
      '<span class="bf-row-num">' + esc(String(front.num)) + "</span>" +
      '<span class="bf-row-name">' + esc(front.name_he || front.id) + "</span>" +
      '<span class="bf-bar" aria-hidden="true"><span class="bf-bar-fill"' +
      (s ? ' style="inline-size:' + (s * 10) + '%"' : "") + "></span></span>" +
      '<span class="bf-row-score">' +
      (s ? '<span class="bf-sr">ציון </span>' + s + '<span class="bf-sr"> מתוך 10</span>' : "–") +
      "</span>" + (dirHtml(front) || '<span class="bf-dir"></span>') +
      "</button></li>";
  }

  function keyHtml() {
    return '<div class="bf-key"><span>1 שקט</span><span class="bf-key-sw" aria-hidden="true">' +
      SCALE.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("") +
      "</span><span>10 מתקפה רחבה</span></div>";
  }

  function stripHtml(bf) {
    return '<section class="bf-strip" aria-labelledby="bf-strip-h">' +
      '<h2 class="bf-strip-h" id="bf-strip-h">מדד פעילות — 7 הימים האחרונים</h2>' +
      '<ol class="bf-rows">' + bf.fronts.map(rowHtml).join("") + "</ol>" +
      keyHtml() + "</section>";
  }

  /* The card header's score: a chip in the scale colour, the direction, and
     the one line that says why. Nothing at all when the front has no score. */
  function scoreHtml(front) {
    var s = scoreOf(front);
    var why = String(front.score_why_he || "").trim();
    if (!s && !why) return "";
    return '<div class="bf-score">' +
      (s ? '<span class="bf-chip" style="' + styleVars(front) + '">פעילות ' + s +
        '<span class="bf-chip-of">/10</span></span>' : "") +
      dirHtml(front) + "</div>" +
      (why ? '<p class="bf-why">' + markup(why, front.places) + "</p>" : "");
  }

  /* ---- names in the text ------------------------------------------------------ */

  var unmatched = 0;

  function placeByName(places, name) {
    if (!Array.isArray(places)) return null;
    for (var i = 0; i < places.length; i++) {
      if (places[i] && places[i].he === name) return places[i];
    }
    return null;
  }

  /* Escapes the text, then turns each [[name]] into a button. esc() leaves the
     brackets alone, so the match runs on the escaped text; the name is looked
     up UNescaped, which is what the button's data-place hands back. */
  function markup(text, places) {
    return esc(String(text || "")).replace(/\[\[([^\[\]]+)\]\]/g, function (all, shown) {
      var name = shown.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'").replace(/&amp;/g, "&");
      if (!placeByName(places, name)) { unmatched++; return shown; }
      return '<button type="button" class="bf-place" data-place="' + esc(name) + '">' +
        shown + "</button>";
    });
  }

  /* ---- on the map --------------------------------------------------------------- */

  var renderer = null;
  var allGroup = null, allItems = {};   /* the open card's places, by name */
  var oneGroup = null, hiddenName = null;
  var allMarks = [], oneMark = null;    /* labels for the placement pass */
  var placeTimer = null, placeHooked = null;

  function lmap() {
    return (window.MapView && typeof MapView.instance === "function")
      ? MapView.instance() : null;
  }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function areaFeature(adm) {
    var m = /^(adm[12]):(.+)$/.exec(String(adm || ""));
    var geo = (typeof GEO !== "undefined" && GEO) ? GEO["yem_" + (m && m[1])] : null;
    if (!m || !geo || !Array.isArray(geo.features)) return null;
    for (var i = 0; i < geo.features.length; i++) {
      var p = geo.features[i].properties;
      if (p && p.shapeID === m[2]) return geo.features[i];
    }
    return null;
  }

  /* The label is a divIcon with the map's dark halo. For a point it sits
     BESIDE its dot (to its left), never on it; for an area, at its centre.
     No leader line is drawn, so nothing crosses a word. */
  function label(latlng, name, beside, on) {
    return L.marker(latlng, {
      interactive: false, keyboard: false,
      icon: L.divIcon({
        className: "bf-plabel" + (beside ? " bf-plabel-pt" : "") + (on ? " on" : ""),
        html: "<span>" + esc(name) + "</span>", iconSize: [0, 0]
      })
    });
  }

  /* One place as layers, or null when its ref cannot be drawn. */
  function drawPlace(place, on) {
    if (!place) return null;
    if (place.kind === "point" && isFinite(place.lat) && isFinite(place.lon)) {
      var ll = L.latLng(Number(place.lat), Number(place.lon));
      var dot = L.circleMarker(ll, {
        renderer: renderer, interactive: false, radius: on ? 7 : 5.5, weight: 2,
        color: cssVar("--bg", "#081A2F"), fillOpacity: 1,
        fillColor: on ? cssVar("--accent-text", "#6EA8FF") : cssVar("--ink", "#E6EDF5"),
        className: "bf-pdot"
      });
      var pl = label(ll, place.he, true, on);
      return { layers: [dot, pl], bounds: L.latLngBounds(ll, ll), centre: ll,
               mark: { label: pl, ll: ll, pt: true, on: on } };
    }
    var ft = place.kind === "area" ? areaFeature(place.adm) : null;
    if (!ft) return null;
    var shape = L.geoJSON(ft, {
      renderer: renderer, interactive: false,
      style: function () {
        return { color: cssVar("--accent-text", "#6EA8FF"), weight: on ? 3 : 2,
                 dashArray: on ? null : "6 4", fill: true,
                 fillColor: cssVar("--accent-text", "#6EA8FF"), fillOpacity: on ? 0.14 : 0.06,
                 className: "bf-parea" };
      }
    });
    var b = shape.getBounds();
    var al = label(b.getCenter(), place.he, false, on);
    return { layers: [shape, al], bounds: b, centre: b.getCenter(),
             mark: { label: al, ll: b.getCenter(), pt: false, on: on } };
  }

  /* ---- label placement: no two names ever overlap ----------------------------
     After the map settles (and on every zoom), labels are walked in importance
     order - the lit one first, then the card's list order - and each takes the
     first spot beside its anchor that overlaps no name already placed, no dot
     and no map edge. Spots nearest the dot come first; further tiers step a
     line away. Nothing is hidden: if every spot is taken, the least-overlapping
     one is used. Positions are set as left/top on the span, relative to the
     0x0 icon at the anchor; the stylesheet's default (left of the dot) is what
     shows before the first pass. */
  function spots(w, h, pt, on) {
    var out = [], k, g = on ? 11 : 10;
    if (!pt) {
      out.push([-w / 2, -h / 2]);
      for (k = 1; k <= 6; k++) {
        out.push([-w / 2, -h / 2 - k * h], [-w / 2, -h / 2 + k * h]);
      }
      return out;
    }
    out.push([-g - w, -h / 2], [g, -h / 2], [-w / 2, -h - 7], [-w / 2, 7],
             [-w - 3, -h - 3], [3, -h - 3], [-w - 3, 3], [3, 3]);
    for (k = 1; k <= 5; k++) {
      out.push([-g - w, -h / 2 - k * h], [-g - w, -h / 2 + k * h],
               [g, -h / 2 - k * h], [g, -h / 2 + k * h],
               [-w / 2, -h - 7 - k * h], [-w / 2, 7 + k * h]);
    }
    return out;
  }

  function hits(a, b, pad) {
    return a.l < b.r + pad && b.l < a.r + pad && a.t < b.b + pad && b.t < a.b + pad;
  }

  function overlapArea(a, list) {
    var s = 0;
    list.forEach(function (b) {
      var x = Math.min(a.r, b.r) - Math.max(a.l, b.l), y = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (x > 0 && y > 0) s += x * y;
    });
    return s;
  }

  function placeLabels() {
    placeTimer = null;
    var map = lmap();
    if (!map) return;
    var marks = (oneMark ? [oneMark] : []).concat(allMarks).filter(function (m) {
      return map.hasLayer(m.label) && m.label.getElement();
    });
    var size = map.getSize(), done = [];
    /* What floats over the map and would hide a word: its own controls, and
       any absolutely placed sibling of the map box (the legend, the expand
       button). Kept out of like dots - soft, a name overlap still loses. */
    var box = map.getContainer(), br = box.getBoundingClientRect();
    var floats = [].slice.call(box.querySelectorAll(".leaflet-control"));
    [].forEach.call(box.parentNode ? box.parentNode.children : [], function (el) {
      var pos = el !== box && getComputedStyle(el).position;
      if (pos === "absolute" || pos === "fixed") floats.push(el);
    });
    floats = floats.filter(function (el) { return el.offsetWidth && el.offsetHeight; })
      .map(function (el) {
        var r = el.getBoundingClientRect();
        return { l: r.left - br.left, r: r.right - br.left, t: r.top - br.top, b: r.bottom - br.top };
      });
    var dots = marks.filter(function (m) { return m.pt; }).map(function (m) {
      var c = map.latLngToContainerPoint(m.ll), r = m.on ? 9 : 8;
      return { m: m, l: c.x - r, r: c.x + r, t: c.y - r, b: c.y + r };
    });
    marks.forEach(function (m) {
      var span = m.label.getElement().firstChild;
      if (!span) return;
      var w = span.offsetWidth, h = span.offsetHeight;
      if (!w || !h) return;                     /* map hidden: nothing to measure */
      var c = map.latLngToContainerPoint(m.ll);
      var offs = spots(w, h, m.pt, m.on);
      /* An area's centre can sit near the map edge while its name is wider
         than the room left; slide it inward along its own row, still over
         the area, rather than let the edge cut the word. */
      if (!m.pt && w < size.x) {
        offs = offs.concat(offs.map(function (o) {
          return [Math.max(4 - c.x, Math.min(size.x - c.x - w - 4, o[0])), o[1]];
        }));
      }
      var cands = offs.map(function (o) {
        return { x: o[0], y: o[1], l: c.x + o[0], r: c.x + o[0] + w, t: c.y + o[1], b: c.y + o[1] + h };
      });
      function free(q, pad) { return !done.some(function (d) { return hits(q, d, pad); }); }
      function clearDots(q) {
        return !dots.some(function (d) { return d.m !== m && hits(q, d, 0); }) &&
               !floats.some(function (f) { return hits(q, f, 2); });
      }
      function inside(q) { return q.l >= 4 && q.t >= 4 && q.r <= size.x - 4 && q.b <= size.y - 4; }
      /* An anchor off the view keeps its nearest free spot: pulling its name
         inward would float a word into the view, away from its place. */
      var anchorIn = c.x >= 0 && c.y >= 0 && c.x <= size.x && c.y <= size.y;
      var pick = (anchorIn && (
                   cands.filter(function (q) { return free(q, 2) && clearDots(q) && inside(q); })[0] ||
                   cands.filter(function (q) { return free(q, 2) && inside(q); })[0])) ||
                 cands.filter(function (q) { return free(q, 2); })[0] ||
                 cands.filter(function (q) { return free(q, 0); })[0];
      if (!pick) {
        pick = cands.reduce(function (best, q) {
          return overlapArea(q, done) < overlapArea(best, done) ? q : best;
        });
      }
      span.style.left = Math.round(pick.x) + "px";
      span.style.top = Math.round(pick.y) + "px";
      span.style.right = "auto";
      span.style.margin = "0";
      done.push({ l: c.x + Math.round(pick.x), r: c.x + Math.round(pick.x) + w,
                  t: c.y + Math.round(pick.y), b: c.y + Math.round(pick.y) + h });
    });
  }

  /* Coalesced: a fit fires several view events in one go. A timer, not a
     frame callback, so a hidden pane still gets its pass. */
  function schedulePlace() {
    var map = lmap();
    if (map && placeHooked !== map) {
      map.on("zoomend viewreset resize", schedulePlace);
      placeHooked = map;
    }
    if (!placeTimer) placeTimer = setTimeout(placeLabels, 0);
  }

  function unhookPlace() {
    if (placeHooked) placeHooked.off("zoomend viewreset resize", schedulePlace);
    placeHooked = null;
    if (placeTimer) clearTimeout(placeTimer);
    placeTimer = null;
  }

  function ensureRenderer() {
    if (!renderer) renderer = L.svg();
    return renderer;
  }

  function clearOne() {
    var map = lmap();
    if (oneGroup && map) map.removeLayer(oneGroup);
    oneGroup = null; oneMark = null;
    if (hiddenName && allItems[hiddenName] && allGroup) {
      allItems[hiddenName].forEach(function (l) { allGroup.addLayer(l); });
    }
    hiddenName = null;
  }

  function clear() {
    var map = lmap();
    clearOne();
    if (allGroup && map) map.removeLayer(allGroup);
    if (renderer && map) map.removeLayer(renderer);
    allGroup = null; allItems = {}; renderer = null; allMarks = [];
    unhookPlace();
  }

  /* Every place of the open card at once. Returns the bounds to fit: the
     places together with the belt the caller passes in. */
  function showAll(places, beltBounds) {
    var map = lmap();
    clear();
    var fit = beltBounds ? L.latLngBounds(beltBounds.getSouthWest(), beltBounds.getNorthEast()) : null;
    if (!map || !Array.isArray(places) || !places.length) return fit;
    ensureRenderer();
    allGroup = L.layerGroup().addTo(map);
    places.forEach(function (p) {
      var d = drawPlace(p, false);
      if (!d || allItems[p.he]) return;
      allItems[p.he] = d.layers;
      allMarks.push(d.mark);
      d.layers.forEach(function (l) { allGroup.addLayer(l); });
      fit = fit ? fit.extend(d.bounds) : L.latLngBounds(d.bounds.getSouthWest(), d.bounds.getNorthEast());
    });
    schedulePlace();                  /* runs after the caller's fitBounds */
    return fit;
  }

  /* One name tapped: that place alone lit (its quiet twin from showAll is
     hidden meanwhile, so a word is never printed twice), and the map on it. */
  function showOne(place) {
    var map = lmap();
    if (!map || !place) return false;
    clearOne();
    ensureRenderer();
    var d = drawPlace(place, true);
    if (!d) return false;
    if (allItems[place.he] && allGroup) {
      allItems[place.he].forEach(function (l) { allGroup.removeLayer(l); });
      hiddenName = place.he;
    }
    oneGroup = L.layerGroup(d.layers).addTo(map);
    oneMark = d.mark;
    if (place.kind === "point") {
      map.setView(d.centre, Math.max(map.getZoom(), 10), { animate: false });
    } else {
      map.fitBounds(d.bounds, { padding: [48, 48], maxZoom: 11, animate: false });
    }
    schedulePlace();
    return true;
  }

  return {
    SCALE: SCALE,
    colour: colour,
    textOn: textOn,
    scoreOf: scoreOf,
    styleVars: styleVars,
    stripHtml: stripHtml,
    scoreHtml: scoreHtml,
    markup: markup,
    placeByName: placeByName,
    showAll: showAll,
    showOne: showOne,
    clear: clear,
    unmatched: function () { return unmatched; }
  };
})();

window.BfMarks = BfMarks;
