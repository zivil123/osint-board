/* The map's own glyphs. Loaded before map.js, which draws what it returns.

   Two marks live here and they say different things:

   - a SITE is a fixed place - a port, an airfield, a refinery. Ziv, 2026-08-29:
     "instead of the small square, make a logo of an airport or of an oil". A
     rotated 7px square said "something is here" and nothing else; the shape now
     says WHAT is here, which is the whole reason the sites are on the board.
     They stay quiet - one flat colour, no fill weight - because a site is the
     frame of reference and never a claim.
   - a PIN is one or more attack claims. It carries the count, the front colour
     and, when it stands for a single event, that event's verdict. */
var MapIcons = (function () {
  "use strict";

  /* 14x14 silhouettes. Filled, not stroked: a 1px outline at this size turns to
     grey mush on a dark ground, and these are read at a glance or not at all. */
  var GLYPH = {
    airport:
      '<path d="M7 0.7 6 1.9v4.2L0.7 8.6v1.3L6 8.6v3.1l-1.6 1v1.1L7 13.2l2.6 0.6v-1.1l-1.6-1V8.6l5.3 1.3V8.6L8 6.1V1.9z"/>',
    airbase:
      '<path d="M7 0.7 6 1.9v4.2L0.7 8.6v1.3L6 8.6v3.1l-1.6 1v1.1L7 13.2l2.6 0.6v-1.1l-1.6-1V8.6l5.3 1.3V8.6L8 6.1V1.9z"/>' +
      '<rect x="1.4" y="12.2" width="11.2" height="1.4" rx="0.7"/>',
    /* Oil: a drop. Refineries and export terminals are the same substance. */
    refinery: '<path d="M7 0.8c3.1 3.7 4.6 6.2 4.6 8.2a4.6 4.6 0 1 1-9.2 0c0-2 1.5-4.5 4.6-8.2z"/>',
    oil_terminal: '<path d="M7 0.8c3.1 3.7 4.6 6.2 4.6 8.2a4.6 4.6 0 1 1-9.2 0c0-2 1.5-4.5 4.6-8.2z"/>',
    /* Gas: a flame. */
    gas: '<path d="M8.1 0.6c0.3 2-0.5 3.2-1.6 4.3C5.2 6.2 3.6 7.5 3.6 9.6a3.4 3.4 0 0 0 6.8 0c0-1-0.4-1.8-0.9-2.6 0.9 0.3 1.5 1 1.9 1.9 0.5-3.1-0.9-6.6-3.3-8.3z"/>',
    /* Port: an anchor. */
    port:
      '<path d="M6.3 2.2a0.7 0.7 0 1 1 1.4 0 0.7 0.7 0 0 1-1.4 0z" fill="none"/>' +
      '<path d="M7 0.6a1.7 1.7 0 0 0-0.7 3.2v1.1H4.6v1.3h1.7v5.5A4.6 4.6 0 0 1 2.2 8.1H0.8A6 6 0 0 0 7 13.5 6 6 0 0 0 13.2 8.1h-1.4a4.6 4.6 0 0 1-4.1 3.6V6.2h1.7V4.9H7.7V3.8A1.7 1.7 0 0 0 7 0.6zm0 1.2a0.5 0.5 0 1 1 0 1 0.5 0.5 0 0 1 0-1z"/>',
    /* A strait is water, not a facility - it keeps the old lozenge. */
    strait: '<path d="M7 1.2 12.8 7 7 12.8 1.2 7z"/>'
  };

  function site(kind) {
    var path = GLYPH[kind] || GLYPH.strait;
    return '<svg class="site-glyph" width="14" height="14" viewBox="0 0 14 14" ' +
      'aria-hidden="true" focusable="false">' + path + "</svg>";
  }

  /* Corroborated claims are drawn solid; unverified ones stay hollow, so the map
     separates "the world saw this too" from "only they said it" at a glance. */
  function fillFor(rec) {
    if (rec.corroboration === "confirmed") return 0.75;
    if (rec.corroboration === "partial") return 0.45;
    if (rec.corroboration === "denied") return 0.12;
    return 0.10;
  }

  /* `#2E6BFF` + 0.45 -> `rgba(46,107,255,0.45)`. The pin's fill is the verdict,
     exactly as the old 7px dot's fillOpacity was, so the legend keeps its word:
     a full circle is corroborated and a hollow one is only claimed. */
  function rgba(hex, alpha) {
    var h = String(hex || "").trim().replace("#", "");
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (h.length !== 6) return "transparent";
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," +
      (n & 255) + "," + alpha + ")";
  }

  /* Every pin carries its number - a lone event says "1" rather than nothing,
     so the map never leaves the reader counting.

     `approx` is the LOCATION's certainty, which is a different thing from the
     verdict the fill carries: the group stands for "somewhere in this area", not
     for a spot. Ziv, on the province pin and the town pin sitting one inside the
     other over Marib: "why is there a two inside the twelve". Both were the same
     circle, so nothing on the map said one meant a province and one a town. The
     ring in map.css is what says it; the colour here is what draws it. */
  function pin(count, color, fill, solid, approx) {
    return '<span class="cl-pin' + (solid ? "" : " hollow") +
      (count === 1 ? " solo" : "") + (approx ? " approx" : "") +
      '" style="--pin-c: ' + color + "; --pin-f: " + fill +
      "; --pin-r: " + rgba(color, 0.8) + '">' + count + "</span>";
  }

  return { site: site, pin: pin, rgba: rgba, fillFor: fillFor };
})();

window.MapIcons = MapIcons;
