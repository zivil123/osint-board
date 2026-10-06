/* View switcher — the tab strip under the masthead.

   One class on <body> says which view is on: view-daily, view-maps,
   view-battlefronts, and any view a later tab adds. tabs.js knows no view by
   name except the DEFAULT, the summaries (the board was the default until
   2026-10-03, when its tab came off with three others). A view that needs to
   act on entering or leaving registers hooks:

       Tabs.register("daily", { show: fn, hide: fn });

   Switching runs, in order: old.hide() -> body class swap -> aria repaint ->
   new.show(). So a view's show() always runs with its pane already visible and
   measurable, and its hide() runs while its pane is still on screen.

   What each view hides or keeps of the shared furniture is that view's OWN
   stylesheet's business (body.view-<name> rules) — nothing here hides anything,
   which is what lets "battlefronts" keep the shared map while "daily" drops it.
   A view that borrows the map re-measures it in its own show() and closes the
   enlarged map in its own hide(); nothing here does that for it any more.
   Adding a tab costs one button in the strip, optionally one
   <section data-pane="...">, and the view's own files. Nothing in this file
   changes for a new tab.

   No ES modules — the page runs from file://. */
"use strict";

(function () {
  const DEFAULT = "daily";
  const hooks = {};   /* name -> { show, hide } */
  let current = DEFAULT;

  function buttons() {
    return Array.from(document.querySelectorAll(".tabs [data-view]"));
  }

  function register(name, h) {
    hooks[name] = h || {};
  }

  /* A view exists only while the strip offers it. Any other name — a tab that
     was taken off (board, dossier, roads, places), an old link, a typo — lands
     on the default instead of a page with nothing on it. */
  function offered(name) {
    return buttons().some((b) => b.dataset.view === name);
  }

  function select(name) {
    if (!name) return;
    if (!offered(name)) name = DEFAULT;
    if (name === current) return;
    const leaving = hooks[current];
    if (leaving && leaving.hide) leaving.hide();
    document.body.classList.remove("view-" + current);
    current = name;
    document.body.classList.add("view-" + name);
    buttons().forEach((b) => {
      b.setAttribute("aria-selected", b.dataset.view === name ? "true" : "false");
    });
    const arriving = hooks[name];
    if (arriving && arriving.show) arriving.show();
  }

  buttons().forEach((b) => {
    b.addEventListener("click", function () { select(b.dataset.view); });
  });

  /* index.html already carries this class on <body>, so the first paint is the
     summaries; said again here so the page still opens right from older markup. */
  document.body.classList.add("view-" + DEFAULT);

  window.Tabs = {
    register: register,
    select: select,
    current: function () { return current; },
  };
})();
