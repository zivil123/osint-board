/* The maps view (the מפות tab) — the three terrain maps of 2026-09-17 on a page
   of their own, each with its two download buttons.

   Ziv asked for it in one line after reviewing them: a separate place for only
   those three. They left the dossier tab and the deck the same day, so the
   document is six pictures again and this tab is the pictures he takes away.

   Which maps land here is DATA, not a list in this file: every map in
   DOSSIER.maps carrying `tab: "maps"`. The blocks are built by
   dossier_map_block.js — the dossier view's own builder — and the canvases are
   painted, and the PNG buttons hung, exactly as they are there: both views scan
   the DOM they just wrote, so neither knows anything about the other.

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
      : '<div class="empty"><p>' + esc(EMPTY) + "</p></div>");
    if (window.DossierPng) DossierPng.mount(pane);
    repaintWhenReady();
  }

  /* ---- the maps ---------------------------------------------------------- */

  /* Measured from the BOX, not the canvas: the painter writes the canvas's CSS
     size inline, so after a resize the canvas still reports the old width while
     the box already has the new one. Skipped while hidden — a display:none pane
     measures zero, and a zero-width map is a blank one. */
  function drawMaps() {
    if (!window.DossierMap || !document.body.classList.contains("view-maps")) return;
    pane.querySelectorAll(".ds-canvas").forEach((canvas) => {
      const width = canvas.parentElement.clientWidth;
      if (width <= 0) return;
      DossierMap.draw(canvas, canvas.dataset.mapId, theme(), width, canvas.dataset.variant);
    });
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
