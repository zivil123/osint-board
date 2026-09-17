/* The roads view (the כבישים tab): Yemen's main roads on the terrain, the key
   corridors over them, a five-way layer switch, a week / all switch for the
   attacks, and a card per corridor under the map.

   Built from const ROADS (roads_build.py) and const ROADS_GEO (roads_prep.py).
   The rules - corridor level only, never checkpoints, convoys or premises - are
   in ROADS.md; the builder enforces them, so nothing here has to.

   Tap a card and its road is highlighted on the map; tap a road on the map and
   its card is selected and brought into view. Tapping the selected one again
   clears it.

   Reads app.js's `esc`, RoadsMap and RoadsCards. No ES modules - the page runs
   from file://. */
"use strict";

(function () {
  const pane = document.getElementById("roads-pane");
  if (!pane) return;

  const TITLE = "כבישים";
  /* The honest limit, said once and on the tab itself (ROADS.md). */
  const NOTE = "אין מקור פתוח שסופר משאיות לפי כביש. הזרימות הן הערכות שפורסמו, " +
    "כל אחת עם המקור והתאריך שלה.";
  /* The fighting layer's honest limit, said on the tab (ROADS.md). */
  const FIGHT_NOTE = "השכבה הפותחת מראה איפה הפיגועים והלחימה נמצאים לאורך הכבישים. " +
    "באילו כבישים הכוחות נוסעים בפועל - זה לא מתפרסם.";
  const LAYER_HE = { fighting: "חשיבות ללחימה היום", attacks: "פיגועים", status: "מצב", control: "שליטה",
                     importance: "חשיבות", flows: "מטענים" };
  const WIN_HE = { week: "השבוע", all: "הכול" };
  const MISSING = "נתוני הכבישים אינם זמינים.";

  const state = { layer: "fighting", win: "week", selected: "", hot: "" };

  function data() { return (typeof ROADS !== "undefined" && ROADS) ? ROADS : null; }

  function switchRow(cls, label, options, current, attr) {
    return '<div class="rd-switch ' + cls + '" role="group" aria-label="' + esc(label) + '">' +
      Object.keys(options).map(function (k) {
        return '<button type="button" ' + attr + '="' + k + '" aria-pressed="' +
          (k === current ? "true" : "false") + '">' + esc(options[k]) + "</button>";
      }).join("") + "</div>";
  }

  function render() {
    const D = data();
    const head = '<header class="rd-head"><h1 class="rd-title">' + esc(TITLE) + "</h1>" +
      '<p class="rd-note">' + esc(NOTE) + " " + esc(FIGHT_NOTE) + "</p></header>";
    if (!D || !window.RoadsMap || !window.RoadsCards || !window.DossierMapDraw) {
      pane.innerHTML = head + '<div class="empty"><p>' + esc(MISSING) + "</p></div>";
      return;
    }
    const network = (typeof ROADS_GEO !== "undefined" && ROADS_GEO) ? ROADS_GEO : {};
    /* National totals only - never where a collection point stands (ROADS.md). */
    const tolls = D.tolls && D.tolls.note_he
      ? '<p class="rd-tolls">' + esc(D.tolls.note_he) + (D.tolls.src || []).map(function (s) {
          return ' <a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' +
            esc(s.publisher) + "</a>";
        }).join("") + "</p>"
      : "";
    pane.innerHTML = head + tolls +
      '<div class="rd-controls">' +
      switchRow("rd-layers", "צבע הכבישים לפי", LAYER_HE, state.layer, "data-layer") +
      switchRow("rd-window", "תקופת הפיגועים", WIN_HE, state.win, "data-win") +
      "</div>" +
      '<div class="rd-stage">' +
      '<figure class="rd-map"><div class="rd-canvas-box">' +
      '<canvas class="rd-canvas" aria-label="מפת הכבישים"></canvas></div>' +
      '<figcaption><ul class="rd-legend"></ul>' +
      '<p class="rd-credit">רשת הכבישים: ' + esc(network.attribution || "") +
      (network.snapshot ? ", " + esc(network.snapshot) : "") + ". פני השטח: SRTM.</p>" +
      "</figcaption></figure>" +
      '<aside class="rd-top" aria-label="הכבישים העמוסים ביותר עכשיו"></aside></div>' +
      '<div class="rd-cards"></div>';
    wire();
    refresh();
  }

  function legend() {
    const ul = pane.querySelector(".rd-legend");
    if (!ul) return;
    ul.innerHTML = RoadsMap.legend(state).map(function (r) {
      const w = r.w || 5;
      if (r.note) return '<li class="rd-legend-note">' + esc(r.l) + "</li>";
      const line = r.dot
        ? '<span class="rd-sw-dot" style="background:' + r.c + '"></span>'
        : '<span class="rd-sw" style="border-block-start:' + w + "px " +
          (r.dash ? "dashed " : "solid ") + r.c + (r.ring ? ";outline:2px solid " + r.ring : "") +
          '"></span>';
      return "<li>" + line + esc(r.l) + "</li>";
    }).join("");
  }

  function cards() {
    const box = pane.querySelector(".rd-cards");
    if (box) box.innerHTML = RoadsCards.html(data().corridors, state);
  }

  /* The five busiest stretches of the fighting layer, beside the map. */
  function top() {
    const box = pane.querySelector(".rd-top"), F = data().fighting;
    if (!box) return;
    box.hidden = state.layer !== "fighting" || !F;
    pane.querySelector(".rd-stage").classList.toggle("with-top", !box.hidden);
    if (box.hidden) return;
    const day = RoadsMap.day;
    box.innerHTML = "<h2 class=\"rd-top-title\">הכבישים העמוסים ביותר עכשיו</h2>" +
      '<p class="rd-muted">עד ' + esc(day(F.anchor)) + ", הפיגוע האחרון בנתונים</p>" +
      '<ol class="rd-top-list">' + F.top.map(function (r, k) {
        const on = String(k) === String(state.hot);
        const count = r.n30
          ? (r.n7 === 1 ? "פיגוע אחד" : r.n7 + " פיגועים") + " ב-7 ימים · " +
            (r.n30 === 1 ? "פיגוע אחד" : r.n30 + " פיגועים") + " ב-30 ימים"
          : "אין פיגועים ב-30 הימים";
        const tags = [r.front ? "באזור לחימה" : "", r.cross ? "חוצה את קו המגע" : ""]
          .filter(Boolean).join(" · ");
        return '<li><button type="button" class="rd-top-item rd-band-' + esc(r.band) +
          '" data-top="' + k + '" aria-label="' + esc((k + 1) + '. ' + r.name_he) + '" aria-pressed="' + (on ? "true" : "false") + '">' +
          '<span class="rd-top-rank">' + (k + 1) + "</span>" +
          '<span class="rd-top-body"><strong>' + esc(r.name_he) + "</strong>" +
          "<span>" + esc(RoadsMap.BAND_HE[r.band] || r.band) + " · " + esc(count) + "</span>" +
          (r.last ? "<span>האחרון: " + esc(day(r.last)) + "</span>" : "") +
          (tags ? "<span>" + esc(tags) + "</span>" : "") + "</span></button></li>";
      }).join("") + "</ol>";
  }

  function drawMap() {
    const canvas = pane.querySelector(".rd-canvas");
    if (!canvas || !document.body.classList.contains("view-roads")) return;
    const width = canvas.parentElement.clientWidth;  /* .rd-canvas-box */
    if (width > 0) RoadsMap.draw(canvas, width, state);
  }

  function pressed() {
    pane.querySelectorAll("[data-layer]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.layer === state.layer ? "true" : "false");
    });
    pane.querySelectorAll("[data-win]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.win === state.win ? "true" : "false");
    });
  }

  function refresh() {
    pressed();
    top();
    legend();
    cards();
    drawMap();
  }

  function selectTop(k) {
    state.hot = String(state.hot) === String(k) ? "" : String(k);
    state.selected = "";
    state.layer = "fighting";
    refresh();
  }

  function select(key, fromMap) {
    state.selected = state.selected === key ? "" : key;
    state.hot = "";
    refresh();
    if (fromMap && state.selected) {
      const card = pane.querySelector('.rd-card[data-road="' + state.selected + '"]');
      /* Straight to its top, never smooth: smooth scrolling has been measured
         not to move at all in an embedded browser (UI.md). */
      if (card) card.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }

  function wire() {
    pane.querySelector(".rd-controls").addEventListener("click", function (ev) {
      const b = ev.target.closest("button");
      if (!b) return;
      if (b.dataset.layer) state.layer = b.dataset.layer;
      if (b.dataset.win) state.win = b.dataset.win;
      refresh();
    });
    pane.querySelector(".rd-top").addEventListener("click", function (ev) {
      const b = ev.target.closest("[data-top]");
      if (b) selectTop(b.dataset.top);
    });
    pane.querySelector(".rd-cards").addEventListener("click", function (ev) {
      /* A source link or the sources toggle does its own job, not a selection. */
      if (ev.target.closest("a, summary, details")) return;
      const card = ev.target.closest(".rd-card");
      if (card) select(card.dataset.road, false);
    });
    const canvas = pane.querySelector(".rd-canvas");
    canvas.addEventListener("click", function (ev) {
      const box = canvas.getBoundingClientRect();
      const key = RoadsMap.hit(canvas, ev.clientX - box.left, ev.clientY - box.top);
      if (key.indexOf("top:") === 0) selectTop(key.slice(4));
      else if (key) select(key, true);
      else if (state.selected) select(state.selected, false);
      else if (state.hot !== "") selectTop(state.hot);
    });
  }

  let resizeTimer = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawMap, 150);
  });

  (function init() {
    render();
    if (window.Tabs) {
      Tabs.register("roads", {
        show: function () {
          window.scrollTo(0, 0);
          drawMap();
          /* Drawn on the terrain: painted before its picture landed it would come
             out on plain ground, so paint again once it has. */
          RoadsMap.ready().then(drawMap, function () {});
        },
      });
    }
    /* A hook for the headless picture dump: the state is settable from outside
       without pressing anything that saves a file. */
    window.RoadsTab = { state: state, refresh: refresh, select: select, selectTop: selectTop };
  })();
})();
