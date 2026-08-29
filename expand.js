/* Expand control — fills the window with the map alone.

   Lives in its own file because map.js is at 442 of its 500 lines and this is
   not map behaviour: it is a layout state on <body> that the map has to be told
   about. No ES modules — the page runs from file://.

   The contract is one class: body.map-full. style.css does the rest. */
"use strict";

(function () {
  var FULL = "map-full";
  var btn = document.getElementById("map-expand");
  var label = document.getElementById("mx-label");
  if (!btn) return;

  /* Leaflet caches its container size, so every change of that box has to be
     announced. The ResizeObserver in map.js watches #map and is the belt — it
     has been measured firing ZERO times in an embedded browser, so it is never
     the mechanism. This is the braces: measure now, and again on the next frame
     once the fixed pane has actually been laid out. */
  function remeasure() {
    if (!window.MapView) return;
    MapView.invalidate();
    requestAnimationFrame(function () { MapView.invalidate(); });
  }

  function apply(on) {
    document.body.classList.toggle(FULL, on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute("aria-label", on ? "סגירת המפה המורחבת" : "הרחבת המפה");
    if (label) label.textContent = on ? "סגירה" : "הרחבה";
    remeasure();
  }

  function isOpen() {
    return document.body.classList.contains(FULL);
  }

  btn.addEventListener("click", function () { apply(!isOpen()); });

  /* Escape is the way out of anything that covers the screen. */
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isOpen()) {
      apply(false);
      btn.focus();
    }
  });

  /* And so is clicking the dimmed page. The scrim is body::before, so a click on
     it is delivered to <body> - anything outside the panel closes. The button
     lives INSIDE the panel, so it is never caught by this. */
  document.addEventListener("click", function (event) {
    if (!isOpen()) return;
    if (event.target.closest && event.target.closest(".map-pane")) return;
    apply(false);
  });

  /* Reached by app.js only for the closing half — nothing else opens it. */
  window.MapExpand = {
    close: function () { if (isOpen()) apply(false); },
    isOpen: isOpen
  };
})();
