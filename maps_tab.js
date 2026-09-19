/* The maps view (the מפות tab) — the terrain maps of 2026-09-17 on a page of
   their own, each with its two download buttons, and since 2026-09-18 the
   trends graph after the last of them.

   Ziv asked for it in one line after reviewing them: a separate place for only
   those three. They left the dossier tab and the deck the same day, so the
   document is six pictures again and this tab is the pictures he takes away.

   Which maps land here is DATA, not a list in this file: every map in
   DOSSIER.maps carrying `tab: "maps"`. The blocks are built by
   dossier_map_block.js — the dossier view's own builder — and the canvases are
   painted, and the PNG buttons hung, exactly as they are there: both views scan
   the DOM they just wrote, so neither knows anything about the other.

   THE GRAPH IS THE LAST PICTURE ON THE PAGE. Its markup, its three-position
   switch and its two buttons are built here; its numbers and its paint are in
   trend_chart.js. It is deliberately NOT a `.ds-map` section: dossier_png.js
   scans for those and would try to export it as a map, which it is not.

   Reads app.js's `esc` at call time. No ES modules — the page runs from
   file://. */
"use strict";

(function () {
  const pane = document.getElementById("maps-pane");
  if (!pane) return;

  const TITLE = "מפות";
  /* WHY TWO BUTTONS, in one line above the pictures. He puts these on slides —
     some full-bleed, some beside a paragraph — and a button that says only
     "PNG" twice would leave him opening both to find out which is which. */
  const INTRO = "כל מפה יורדת כתמונה בשני גדלים: רחב לשקף מלא, ומרובע לצד טקסט.";
  const EMPTY = "אין מפות להצגה.";
  const MISSING = "המפות אינן זמינות.";

  function maps() {
    if (typeof DOSSIER === "undefined" || !DOSSIER) return [];
    return (DOSSIER.maps || []).filter((m) => m && m.tab === "maps");
  }

  function render() {
    const list = maps();
    const head = '<header class="mt-head"><h1 class="mt-title">' + esc(TITLE) + "</h1>" +
      '<p class="mt-intro">' + esc(INTRO) + "</p></header>";
    if (!window.DossierMapBlock) {
      pane.innerHTML = head + '<div class="empty"><p>' + esc(MISSING) + "</p></div>";
      return;
    }
    pane.innerHTML = head + (list.length
      ? DossierMapBlock.html(list)
      : '<div class="empty"><p>' + esc(EMPTY) + "</p></div>") + chartHtml();
    /* The numbered explanations under each keyed picture, for the phone. Built
       in dossier_view.js and used from both views — see the comment there. It
       runs BEFORE the buttons are written in, so a list can never be appended
       under them. */
    if (window.DossierNotesList) DossierNotesList.fill(pane);
    /* THE MAPS' MOUNT RUNS FIRST, AND THAT ORDER IS LOAD-BEARING UNDER ?png=dry.
       DossierPng.mount() creates the shared stash synchronously and only marks
       it `done` once its own exports drain, so the graph's pictures — pushed in
       synchronously right after — are always in the list before a checker can
       read it. Reversed, the graph would be pushing into a stash that does not
       exist yet. */
    if (window.DossierPng) DossierPng.mount(pane);
    mountChart();
    repaintWhenReady();
  }

  /* ---- the trends graph --------------------------------------------------- */

  /* The picture block, shaped like a map block and wearing the same classes, so
     a heading, a canvas, a key and two buttons look the same wherever they are
     on this page — but under its OWN class, because `.ds-map` is what
     dossier_png.js hangs map exports on. */
  function chartHtml() {
    const T = window.TrendChart;
    if (!T) return "";
    const seg = T.RANGES.map((r) =>
      '<button type="button" class="chip" data-range="' + esc(r.key) + '"' +
      ' aria-pressed="' + (r.key === T.range() ? "true" : "false") + '">' +
      "<span>" + esc(r.he) + "</span></button>").join("");
    const btns = T.SHAPES.map((s) =>
      '<button type="button" class="ds-png-btn tc-png" data-shape="' +
      esc(s.shape) + '">' + esc(s.label) + "</button>").join("");
    return '<section class="tc-block" aria-labelledby="tc-title">' +
      '<h3 class="ds-map-h" id="tc-title">' + esc(T.TITLE) + "</h3>" +
      '<div class="chips tc-switch" role="group" aria-label="' + esc(T.TITLE) +
      '">' + seg + "</div>" +
      '<div class="ds-map-wide"><div class="ds-map-box tc-box">' +
      '<canvas class="tc-canvas" role="img" aria-label="' + esc(T.TITLE) +
      '"></canvas></div></div>' +
      '<div class="ds-legend tc-key"></div>' +
      '<div class="ds-map-actions">' + btns + "</div>" +
      '<p class="ds-map-status tc-status" aria-live="polite"></p></section>';
  }

  /* The key is written in HTML as well as painted, exactly as every map block's
     is: a canvas says nothing to a screen reader, and these rows carry the
     COUNT per front — which makes them the table view of the picture beside
     them. The swatch takes the PICTURE's colour, not the board's token, so a
     swatch can never show a colour the graph does not use. */
  function paintKey(section) {
    const T = window.TrendChart, box = section.querySelector(".tc-key");
    const s = T.seriesFor(T.range());
    if (!box) return;
    box.innerHTML = !s || !s.keys.length ? "" : s.keys.map((k) =>
      '<span class="ds-lg-row"><span class="sw fill" style="--sw-fill: ' +
      esc(T.skin().front[k.key] || "") + '"></span>' +
      esc(k.he) + " " + esc(String(k.n)) + "</span>").join("");
  }

  function press(section, btn, shape) {
    const T = window.TrendChart, label = btn.textContent;
    const status = section.querySelector(".tc-status");
    btn.disabled = true; btn.textContent = T.BUSY; status.textContent = "";
    /* A frame apart so the button repaints before the export blocks the thread;
       the picture is built from data already in memory, never fetched. */
    setTimeout(function () {
      let item = null;
      try { item = stash(T.exportPng(shape), shape); }
      catch (err) { console.error("trend_chart:", err); }
      btn.disabled = false; btn.textContent = label;
      if (!item) { status.textContent = T.FAILED; return; }
      if (T.DRY) {
        status.textContent = "בדיקה בלבד — " + item.width + "x" + item.height +
          ". הקובץ לא נשמר.";
        return;
      }
      const blob = toBlob(item.dataUrl), save = window.DossierSave;
      if (!blob || typeof save !== "function") { status.textContent = T.MISSING; return; }
      save({ blob: blob, fileName: item.name, mime: "image/png" });
    }, 0);
  }

  function toBlob(dataUrl) {
    const comma = String(dataUrl || "").indexOf(",");
    if (comma < 0) return null;
    const bin = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: "image/png" });
  }

  /* The date is TODAY's in the viewer's own parts, and the range rides in the
     name as a map's variant does: three windows of one graph must not collide
     under one filename. dossier_png.js's own rule, applied to this picture. */
  function fileName(range, shape) {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    return "osint-trends-" + range + "-" + shape + "-" + d.getFullYear() + "-" +
      p(d.getMonth() + 1) + "-" + p(d.getDate()) + ".png";
  }

  /* One item, in dossier_png.js's own shape, pushed into BOTH stashes: the
     graph's own and — when it exists — the shared one, which is the list
     scripts\dossier_png_dump.py writes to disk. Without the second push the
     dump could not see this picture at all. */
  function stash(dataUrl, shape) {
    const T = window.TrendChart;
    let s = T.SHAPES[0];
    T.SHAPES.forEach((x) => { if (x.shape === shape) s = x; });
    /* `kind: "chart"` - not a map, so the picture dump does not ask it for a
       map self-check it could never file (dossier_png.js, `note`). */
    const item = { id: "trends", variant: T.range(), shape: shape, kind: "chart",
      width: s.w, height: s.h, name: fileName(T.range(), shape),
      bytes: Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 3 / 4),
      dataUrl: dataUrl };
    T.stash(item);
    const shared = window.DossierPng && DossierPng.dry;
    if (shared && shared.items) {
      shared.items = shared.items.filter((it) =>
        it.id !== item.id || it.variant !== item.variant || it.shape !== item.shape);
      shared.items.push(item);
    }
    return item;
  }

  function mountChart() {
    const T = window.TrendChart, section = pane.querySelector(".tc-block");
    if (!T || !section) return;
    T.bind(section.querySelector(".tc-canvas"));
    section.querySelectorAll(".tc-switch .chip").forEach((btn) => {
      btn.addEventListener("click", function () {
        T.setRange(btn.dataset.range);
        section.querySelectorAll(".tc-switch .chip").forEach((b) => {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
          b.classList.toggle("on", b === btn);
        });
        paintKey(section);
      });
      btn.classList.toggle("on", btn.getAttribute("aria-pressed") === "true");
    });
    section.querySelectorAll(".tc-png").forEach((btn) => {
      btn.addEventListener("click", function () { press(section, btn, btn.dataset.shape); });
    });
    paintKey(section);
    T.draw();
    /* Both pictures of the range on screen, stashed with nothing saved and
       nothing opened — the same bargain ?png=dry strikes for every map. */
    if (T.DRY) T.SHAPES.forEach((s) => { stash(T.exportPng(s.shape), s.shape); });
  }

  /* ---- the maps ---------------------------------------------------------- */

  /* Measured from the BOX, not the canvas: the painter writes the canvas's CSS
     size inline, so after a resize the canvas still reports the old width while
     the box already has the new one. Skipped while hidden — a display:none pane
     measures zero, and a zero-width map is a blank one. */
  function drawMaps() {
    if (!document.body.classList.contains("view-maps")) return;
    /* The graph is drawn from data already in memory, so it never waits on the
       terrain and is redrawn even when the map painter is missing. */
    if (window.TrendChart) TrendChart.draw();
    if (!window.DossierMap) return;
    pane.querySelectorAll(".ds-canvas").forEach((canvas) => {
      const width = canvas.parentElement.clientWidth;
      if (width <= 0) return;
      DossierMap.draw(canvas, canvas.dataset.mapId, theme(), width, canvas.dataset.variant);
    });
    /* The painter has just stamped each canvas with whether it wrote the
       explanations into the picture, so the lists follow it here — which is
       also what makes them switch when the window crosses its cutoff. */
    if (window.DossierNotesList) DossierNotesList.fill(pane);
  }

  /* The picture on the page is the picture the button saves — Ziv, 2026-09-17:
     "make all of the maps bright". The painter owns the name. */
  const theme = () => (window.DossierMap && DossierMap.screenTheme) || "light";

  /* Every map here is drawn ON the terrain, so this is not a nicety: painted
     before its picture landed, each one comes out on plain ground. */
  function repaintWhenReady() {
    if (!window.DossierMap || typeof DossierMap.ready !== "function") return;
    Promise.resolve().then(() => DossierMap.ready(theme())).then(drawMaps, () => {});
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawMaps, 150);
  });

  /* ---- init -------------------------------------------------------------- */

  (function init() {
    render();
    if (window.Tabs) {
      /* show() runs with the pane already visible and measurable (tabs.js),
         which is the one moment a canvas can be sized from its box. */
      Tabs.register("maps", {
        show: function () { window.scrollTo(0, 0); drawMaps(); repaintWhenReady(); },
      });
    }
  })();
})();
