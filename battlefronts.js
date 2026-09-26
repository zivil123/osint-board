/* The fronts view (the חזיתות tab): an ANALYSIS of each ground front inside
   Yemen - what is going on there and what is likely next - one card per front
   beside the board's own map, under one block with the overall picture.

   Round 2 (Ziv, 2026-09-25): "less like getting a bunch of reports together and
   more of like, this is what's going on". So no report is listed anywhere on
   this tab; a card only says how many reports its writing rests on.

   This screen SORTS and WRITES nothing. The order of the fronts, their numbers,
   scores, counts, places and every paragraph arrive in `const BATTLEFRONTS`
   (docs\battlefronts_data.js, generated - never hand-edited).

   Round 3: the activity strip, the score colour and the named places on the
   map live in battlefronts_marks.js (BfMarks), loaded just before this file.

   Layout is the apparatus view's: the pane sits INSIDE main.wrap in the list
   pane's column and draws on the SHARED board map through MapView.instance().
   battlefronts.css hides the attack list and the filter band while it is on.

   tabs.js owns which pane is on screen; the whole contract is one call at the
   bottom of this file:  Tabs.register("battlefronts", { show, hide })

   The shared map is the part needing care, and the rule is the one places.js
   keeps: show() takes the attack pins off and puts this view's belts and
   numbers on; hide() removes every layer it added, calls the board's own
   render() (which restores the pins and the band counts in one pass), and puts
   the view back where the reader left it.

   BATTLEFRONTS is read at CALL time, never at load: the generated file may not
   exist yet, and then the tab says so in one line and nothing throws.

   NO ES modules: the page runs from file://, where modules are blocked. Shared
   vocabulary (esc, fmtDate) is declared in app.js. */
"use strict";

var Battlefronts = (function () {
  var NEAR_FIT_M = 60000;  /* an opened card fits its belt + points this close */
  /* Leaflet's path getBounds() hands out the layer's OWN bounds object, and
     L.latLngBounds(b) returns that same object: extending it grew the first
     belt's box to cover every front (al-Jawf opened at country zoom). Copy. */
  function copyBounds(b) {
    return L.latLngBounds(b.getSouthWest(), b.getNorthEast());
  }
  var root = null;
  var layers = null;       /* { belts: L.GeoJSON, nums: L.LayerGroup } while live */
  var beltById = {};       /* front id -> its belt path, for the fit */
  var saved = null;        /* the board's own view, taken on the way in */
  var activeFront = null;

  function data() {
    return (typeof BATTLEFRONTS !== "undefined" && BATTLEFRONTS) ? BATTLEFRONTS : null;
  }

  function lmap() {
    return (window.MapView && typeof MapView.instance === "function")
      ? MapView.instance() : null;
  }

  /* ---- the pane ------------------------------------------------------------ */

  function findRoot() {
    if (root && document.body.contains(root)) return root;
    root = document.querySelector('[data-pane="battlefronts"]');
    return root;
  }

  /* A written text may hold paragraph breaks (a blank line); each becomes its
     own <p>, so a long analysis never arrives as one wall of text. */
  function proseHtml(text, emptyHe, places) {
    var paras = String(text || "").split(/\n\s*\n/).map(function (p) {
      return p.trim();
    }).filter(Boolean);
    if (!paras.length) return '<p class="bf-prose bf-empty">' + emptyHe + "</p>";
    return paras.map(function (p) {
      return '<p class="bf-prose">' + BfMarks.markup(p, places) + "</p>";
    }).join("");
  }

  /* What the writing rests on - a count and a date, never the reports. */
  function basisHtml(front) {
    var n = Number(front.n_total) || 0;
    var line = n === 0 ? "מבוסס על מקורות פתוחים"
      : "מבוסס על " + (n === 1 ? "דיווח אחד" : n + " דיווחים");
    if (front.text_as_of) line += ", עד " + fmtDate(front.text_as_of);
    return '<p class="bf-basis">' + line + "</p>";
  }

  function cardHtml(front) {
    return '<div class="bf-head">' +
      '<span class="bf-num" aria-hidden="true">' + esc(String(front.num)) + "</span>" +
      '<div class="bf-title"><h3>' + esc(front.name_he || front.id) + "</h3>" +
      (front.gov_he ? '<span class="bf-gov">' + esc(front.gov_he) + "</span>" : "") +
      "</div></div>" +
      BfMarks.scoreHtml(front) +
      '<section class="bf-sit"><h4 class="bf-h">תמונת מצב</h4>' +
      proseHtml(front.situation_he, "עדיין לא נכתבה תמונת מצב לחזית זו.", front.places) + "</section>" +
      /* The outlook is a judgement, not a fact: labelled so in words, and set
         apart by a tint and a dashed rule (dashed = not settled). */
      '<section class="bf-out"><h4 class="bf-h">מה צפוי ' +
      '<span class="bf-assess">הערכה</span></h4>' +
      proseHtml(front.outlook_he, "עדיין לא נכתבה הערכה לחזית זו.", front.places) + "</section>" +
      (front.holds_he
        ? '<div class="bf-holds"><span class="tn-label">מי מחזיק בשטח</span>' +
          "<p>" + esc(front.holds_he) + "</p></div>"
        : "") +
      basisHtml(front);
  }

  function introHtml(bf) {
    var span = bf.window_start && bf.as_of
      ? fmtDate(bf.window_start) + " – " + fmtDate(bf.as_of) : "";
    return '<div class="list-intro"><p class="claim-note">' +
      "מה קורה בכל חזית קרקעית בתוך תימן. המספר על הכרטיס הוא המספר על המפה; " +
      "לחיצה על כרטיס מקרבת את המפה לחזית ומסמנת את המקומות שבו; " +
      "לחיצה על שם מודגש מראה אותו על המפה." +
      "</p>" +
      (span ? '<p class="bf-window">7 הימים הנספרים: ' + span + "</p>" : "") +
      "</div>";
  }

  function overallHtml(bf) {
    if (!String(bf.overall_he || "").trim()) return "";
    return '<section class="bf-overall"><h3 class="bf-h">התמונה הכוללת</h3>' +
      proseHtml(bf.overall_he, "", bf.overall_places) + "</section>";
  }

  function build() {
    if (!findRoot()) return false;
    root.classList.add("bf-pane");
    var bf = data();
    if (!bf || !Array.isArray(bf.fronts)) {
      root.innerHTML = '<p class="bf-missing">נתוני החזיתות עדיין לא מוכנים.</p>';
      return false;
    }
    var fronts = bf.fronts;
    root.innerHTML = BfMarks.stripHtml(bf) +
      '<div class="list-head"><h2>חזיתות <span class="count">' +
      fronts.length + "</span></h2></div>" + introHtml(bf) + overallHtml(bf) +
      '<ol class="bf-cards"></ol>';
    var cards = root.querySelector(".bf-cards");
    fronts.forEach(function (front) {
      var li = document.createElement("li");
      li.className = "bf-card";
      li.dataset.front = front.id;
      li.tabIndex = 0;
      li.innerHTML = cardHtml(front);
      li.addEventListener("click", function (event) {
        if (event.target.closest("a, button")) return;
        openFront(front.id);
      });
      li.addEventListener("keydown", function (event) {
        if (event.target !== li) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openFront(front.id);
      });
      cards.appendChild(li);
    });
    wire();
    return true;
  }

  /* One delegated handler for the pane's buttons, wired once per pane: a strip
     row does what a card tap does; a highlighted name marks its place. */
  function wire() {
    if (root.dataset.bfWired) return;
    root.dataset.bfWired = "1";
    root.addEventListener("click", function (event) {
      var row = event.target.closest(".bf-row");
      if (row) { rowTap(row.dataset.front); return; }
      var btn = event.target.closest(".bf-place");
      if (btn) placeTap(btn);
    });
  }

  function frontById(id) {
    var bf = data();
    return bf ? bf.fronts.filter(function (f) { return f.id === id; })[0] || null : null;
  }

  /* Wide: the pane scrolls to the card beside the fitted map. Phone: the map
     sits above everything, so the map is what comes into view (a card tap does
     the same) - scrolling to the card first would only jump twice. */
  function rowTap(id) {
    openFront(id, { scroll: !window.matchMedia("(max-width: 900px)").matches });
  }

  /* A name in a card looks in that card's places; one in the overall block
     looks in the overall list. */
  function placeTap(btn) {
    var card = btn.closest(".bf-card");
    var bf = data();
    var list = card ? (frontById(card.dataset.front) || {}).places : (bf && bf.overall_places);
    var place = BfMarks.placeByName(list, btn.dataset.place);
    if (BfMarks.showOne(place)) mapIntoView();
  }

  /* ---- on the map ------------------------------------------------------------ */

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function beltStyle(on) {
    return on
      ? { stroke: true, color: cssVar("--accent-text", "#6EA8FF"), weight: 3,
          fill: true, fillColor: cssVar("--accent", "#2E6BFF"), fillOpacity: 0.22 }
      : { stroke: true, color: cssVar("--ink", "#E6EDF5"), weight: 1.6,
          fill: true, fillColor: cssVar("--ink", "#E6EDF5"), fillOpacity: 0.08 };
  }

  /* The average of the outer ring's vertices - the point fronts.js puts its
     diamond on, which for a belt lands on its centreline. The number sits
     BESIDE that diamond (anchored off to its right), never on top of it. */
  function ringCentre(geom) {
    var ring = geom.type === "MultiPolygon" ? geom.coordinates[0][0] : geom.coordinates[0];
    var lat = 0, lon = 0;
    ring.forEach(function (p) { lon += p[0]; lat += p[1]; });
    return [lat / ring.length, lon / ring.length];
  }

  function addLayers() {
    var map = lmap();
    var bf = data();
    var geo = (typeof GEO !== "undefined" && GEO) ? GEO.fronts : null;
    if (!map || !bf || !geo || !Array.isArray(geo.features)) return;
    removeLayers();
    var numOf = {};
    bf.fronts.forEach(function (f) { numOf[f.id] = f.num; });
    var feats = geo.features.filter(function (ft) {
      return ft.properties && numOf[ft.properties.id] != null;
    });
    beltById = {};
    /* An OWN renderer, removed with the belts. Without it Leaflet creates the
       map's default renderer on first use and leaves it behind for good - one
       layer the board did not have before this tab was opened. */
    var renderer = L.svg();
    var belts = L.geoJSON({ type: "FeatureCollection", features: feats }, {
      renderer: renderer,
      interactive: false,
      style: function () { return beltStyle(false); },
      onEachFeature: function (ft, layer) { beltById[ft.properties.id] = layer; }
    }).addTo(map);
    var nums = L.layerGroup().addTo(map);
    feats.forEach(function (ft) {
      var id = ft.properties.id;
      var mark = L.marker(ringCentre(ft.geometry), {
        keyboard: false,
        icon: L.divIcon({
          className: "bf-numk",
          /* Filled in the front's activity colour - the strip row's colour. */
          html: '<span class="bf-numk-b" style="' + BfMarks.styleVars(frontById(id)) + '">' +
            esc(String(numOf[id])) + "</span>",
          iconSize: [28, 28],
          iconAnchor: [-10, 14]   /* 10px right of the diamond, vertically centred */
        })
      });
      mark.on("click", function () { openFront(id, { scroll: true }); });
      nums.addLayer(mark);
    });
    layers = { belts: belts, nums: nums, renderer: renderer };
  }

  function removeLayers() {
    var map = lmap();
    BfMarks.clear();
    if (layers && map) {
      map.removeLayer(layers.belts);
      map.removeLayer(layers.nums);
      map.removeLayer(layers.renderer);
    }
    layers = null;
    beltById = {};
    activeFront = null;
  }

  /* One front opened: its belt lit, its card marked, every place its texts
     name drawn, and the map fitted to the belt and those places together. */
  function openFront(id, opts) {
    var map = lmap();
    activeFront = id;
    Object.keys(beltById).forEach(function (k) {
      beltById[k].setStyle(beltStyle(k === id));
      if (k === id) beltById[k].bringToFront();
    });
    if (root) {
      root.querySelectorAll(".bf-card").forEach(function (c) {
        c.classList.toggle("active", c.dataset.front === id);
      });
    }
    var belt = beltById[id];
    var front = frontById(id);
    var fit = BfMarks.showAll(front && front.places, belt ? copyBounds(belt.getBounds()) : null);
    // Every place stays marked, but the view fits only the belt and the
    // points near it: a text that names Aden or Bab al-Mandab as context
    // must not zoom the front itself out of sight (seen 2026-09-25 on the
    // Lahj card, which fitted most of the south coast).
    if (belt && map) {
      var near = copyBounds(belt.getBounds());
      var c = near.getCenter();
      ((front && front.places) || []).forEach(function (p) {
        if (p.kind === "point" && map.distance(c, [p.lat, p.lon]) <= NEAR_FIT_M) {
          near.extend([p.lat, p.lon]);
        }
      });
      fit = near;
    }
    if (map && fit && fit.isValid()) {
      map.fitBounds(fit, { padding: [48, 48], maxZoom: 10, animate: false });
    }
    var card = root && root.querySelector('.bf-card[data-front="' + id + '"]');
    if (opts && opts.scroll && card) card.scrollIntoView({ block: "start" });
    if (!(opts && opts.scroll)) mapIntoView();
  }

  /* On a phone the map sits ABOVE the cards, so a fit made while reading a
     card lower down would happen off screen. Bring the map back into view. */
  function mapIntoView() {
    var map = lmap();
    if (!map || !window.matchMedia("(max-width: 900px)").matches) return;
    var box = map.getContainer().getBoundingClientRect();
    if (box.top < 0) window.scrollTo(0, Math.max(0, window.scrollY + box.top - 8));
  }

  /* ---- the shell's two calls ---------------------------------------------- */

  /* Hiding the band changes the map pane's height under a Leaflet that caches
     its size: told now and again next frame (expand.js's braces - the
     ResizeObserver in map.js is the belt, never the mechanism). */
  function remeasure(after) {
    if (!window.MapView || typeof MapView.invalidate !== "function") return;
    MapView.invalidate();
    requestAnimationFrame(function () {
      MapView.invalidate();
      if (after) after();
    });
  }

  function show() {
    var map = lmap();
    if (map && !saved) saved = { centre: map.getCenter(), zoom: map.getZoom() };
    var ok = build();
    if (ok) {
      if (map) map.closePopup();
      if (window.MapView && typeof MapView.draw === "function") MapView.draw([]);
      addLayers();
    }
    /* Fit ALL belts once the pane has its settled size; "saved" above was taken
       before this. Fitted twice: the map's own ResizeObserver fires after the
       first frame and sends an unmoved map home, so the second fit wins. */
    function fitAll() {
      var m = lmap(), b = null;
      if (!ok || !m || !saved) return;   /* tab already left: leave the restore be */
      Object.keys(beltById || {}).forEach(function (k) {
        b = b ? b.extend(beltById[k].getBounds()) : copyBounds(beltById[k].getBounds());
      });
      if (b && b.isValid()) m.fitBounds(b, { padding: [24, 24], animate: false });
    }
    remeasure(function () { fitAll(); requestAnimationFrame(fitAll); });
  }

  function hide() {
    /* An enlarged map is a FIXED panel; left open it floats over the next view. */
    if (window.MapExpand) MapExpand.close();
    var map = lmap();
    if (map) map.closePopup();
    removeLayers();
    /* The one true "restore the board" call (places.js does the same): it redraws
       the attack pins AND the band counts in one pass, so they cannot disagree. */
    if (typeof render === "function" && typeof DATA !== "undefined") render();
    var back = saved;
    saved = null;
    remeasure(function () {
      var m = lmap();
      if (m && back) m.setView(back.centre, back.zoom, { animate: false });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { findRoot(); });
  }

  return {
    show: show,
    hide: hide,
    focus: openFront,
    live: function () { return !!layers; }
  };
})();

window.Battlefronts = Battlefronts;

/* tabs.js may load after this file; guarded, and retried once the page is up. */
(function register() {
  var done = false;
  function tryOnce() {
    if (done || !window.Tabs || typeof Tabs.register !== "function") return;
    done = true;
    Tabs.register("battlefronts", { show: Battlefronts.show, hide: Battlefronts.hide });
  }
  tryOnce();
  if (!done) {
    document.addEventListener("DOMContentLoaded", tryOnce);
    window.addEventListener("load", tryOnce);
  }
})();
