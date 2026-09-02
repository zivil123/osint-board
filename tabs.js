/* View switcher — the tab strip under the masthead.

   One class on <body> says which view is on: view-board, view-daily, and any
   view a later tab adds. tabs.js knows no view by name except the board (the
   default, whose map has to be re-measured on return). A view that needs to act
   on entering or leaving registers hooks:

       Tabs.register("daily", { show: fn, hide: fn });

   Switching runs, in order: old.hide() -> body class swap -> aria repaint ->
   new.show(). So a view's show() always runs with its pane already visible and
   measurable, and its hide() runs while its pane is still on screen.

   What each view hides or keeps of the board's furniture is that view's OWN
   stylesheet's business (body.view-<name> rules) — nothing here hides anything,
   which is what lets a view like "places" keep the shared map while "daily"
   drops it. Adding a tab costs one button in the strip, optionally one
   <section data-pane="...">, and the view's own files. Nothing in this file
   changes for a new tab.

   No ES modules — the page runs from file://. */
"use strict";

(function () {
  const hooks = {};   /* name -> { show, hide } */
  let current = "board";

  function buttons() {
    return Array.from(document.querySelectorAll(".tabs [data-view]"));
  }

  function register(name, h) {
    hooks[name] = h || {};
  }

  function select(name) {
    if (!name || name === current) return;
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

  register("board", {
    /* Leaving the board while the enlarged map floats over the page would strand
       a fixed panel on top of the next view — close it on the way out. */
    hide: function () {
      if (window.MapExpand) MapExpand.close();
    },
    /* Leaflet caches its container size, so returning from display:none it is
       told twice — now and on the next frame — the same braces as expand.js,
       because the ResizeObserver in map.js has been measured firing zero times
       in an embedded browser and is never the mechanism. */
    show: function () {
      if (!window.MapView) return;
      MapView.invalidate();
      requestAnimationFrame(function () { MapView.invalidate(); });
    },
  });

  buttons().forEach((b) => {
    b.addEventListener("click", function () { select(b.dataset.view); });
  });

  document.body.classList.add("view-board");

  window.Tabs = {
    register: register,
    select: select,
    current: function () { return current; },
  };
})();
