/* map_notes.js — the numbered explanations written UNDER a map picture.

     window.DossierNotesList = { fill(pane) }

   A map carrying `key` — the Marib objectives' side panel, the reports map's
   callout boxes — writes its explanations INSIDE the picture, at a size that
   scales with the canvas: measured 6px at a 700px canvas and 11px at 1200. So
   below its own cutoff the painter drops them and paints the numbered discs
   alone, and the words come out here as real HTML at reading size, selectable
   and reachable by a screen reader. Style in `docs\map_notes.css`.

   THE PAINTER DECIDES AND SAYS SO ON THE CANVAS (2026-09-18, round 3). It
   stamps `data-notes="list"` when it did NOT paint them and `"painted"` when it
   did, on every paint, and this list follows that flag. A `max-width: 700px`
   media query was the first answer and was wrong: it guessed a CANVAS width
   from a WINDOW width, and the maps tab gives a 1024px window an 814px canvas —
   so a whole band of laptops had the words painted at 6-8px and no list either.
   One source of truth, and it is the painter's.

   Its own file, loaded before both views, because BOTH call it and this is the
   one piece of their map plumbing that must not be duplicated: a row's number
   has to match the disc on the picture, and two copies of that rule would be
   two chances to disagree. (The views duplicate the rest — drawMaps, theme,
   the resize timer — and that is the pattern this one deliberately breaks.)

   Reads app.js's `esc` and the const DOSSIER at call time. No ES modules — the
   page runs from file://. */
"use strict";

var DossierNotesList = (function () {
  var LABEL = "הסברים לסימונים במפה";

  /* Rows come LIVE from the painter, so the page and the picture number the
     same places in the same order. The fallback rebuilds them the way it does
     (notes[] order, index + 1, the Hebrew name off the map's own labels); a
     note whose place the map does not label still prints its number and its
     line, which is a complete row. */
  function rowsOf(map) {
    var K = window.DossierMapKey;
    if (K && typeof K.listFor === "function") {
      try {
        var rows = K.listFor(map);
        if (Array.isArray(rows) && rows.length) return rows;
      } catch (e) { /* fall through to the record's own order */ }
    }
    var labels = map.labels || [];
    return (map.notes || []).map(function (note, i) {
      var hit = labels.filter(function (l) { return l.place === note.place; })[0];
      return { n: i + 1, name_he: (hit && hit.he) || "", note_he: note.note_he || "" };
    });
  }

  /* The disc is HTML, not painted: white, ink ring, ink digit — the same mark
     dossier_map_number.js draws on the map, so a row and its disc read as one
     thing. `list-style: none`, because the number is already visible text and a
     marker beside it would number every row twice. */
  function html(map) {
    var rows = rowsOf(map).filter(function (r) { return r && r.note_he; });
    if (!rows.length) return "";
    return '<ol class="ds-notes" aria-label="' + esc(LABEL) + '">' +
      rows.map(function (r) {
        return '<li class="ds-note"><span class="ds-note-n">' + esc(String(r.n)) +
          '</span><span class="ds-note-t">' +
          (r.name_he ? '<b class="ds-note-name">' + esc(r.name_he) + "</b> " : "") +
          esc(r.note_he) + "</span></li>";
      }).join("") + "</ol>";
  }

  /* An OLD painter stamps nothing. Then ask it for its own cutoff and measure
     the canvas it just drew — its rule, read off its own exported constant,
     never a second copy of it. With neither, the picture is assumed to carry
     its words, so nothing is ever said twice. */
  function modeOf(section) {
    var canvas = section.querySelector(".ds-canvas");
    if (!canvas) return "painted";
    if (canvas.dataset.notes) return canvas.dataset.notes;
    var min = (window.DossierMapKey || {}).PANEL_MIN_W;
    var w = parseFloat(canvas.style.width) || canvas.clientWidth;
    return (min && w && w < min) ? "list" : "painted";
  }

  /* Build (or refresh) the list under every keyed picture in a pane, and show
     exactly the ones whose picture the painter left the words off.

     Called twice by each view: once after the blocks are written — BEFORE
     DossierPng.mount, so a list can never be appended under the download
     buttons — and again after EVERY repaint, which is what makes it switch when
     the window crosses the painter's cutoff. The HTML is replaced only when it
     actually changed, so a resize does not drop the reader's text selection. */
  function fill(pane) {
    if (typeof DOSSIER === "undefined" || !DOSSIER || !pane) return;
    var byId = {};
    (DOSSIER.maps || []).forEach(function (m) { byId[m.id] = m; });
    Array.prototype.forEach.call(pane.querySelectorAll(".ds-map"), function (section) {
      var map = byId[section.dataset.map];
      if (!map || !map.key || !(map.notes || []).length) return;
      var markup = html(map);
      if (!markup) return;
      var box = section.querySelector(".ds-notes-box");
      if (!box) {
        box = document.createElement("div");
        box.className = "ds-notes-box";
        var legend = section.querySelector(".ds-legend");
        if (legend) section.insertBefore(box, legend);
        else section.appendChild(box);
      }
      if (box.dataset.html !== markup) {
        box.innerHTML = markup;
        box.dataset.html = markup;
      }
      /* `:has()` in map_notes.css is the MECHANISM — a CSS selector cannot fail
         to fire — and this class is the BRACE for a browser that does not
         support it. Both read the same flag, so they can never disagree, and
         neither a missing `:has()` nor a repaint this call did not see can
         leave the words in neither place. */
      box.classList.toggle("is-on", modeOf(section) === "list");
    });
  }

  return { fill: fill, rowsOf: rowsOf, modeOf: modeOf };
})();

window.DossierNotesList = DossierNotesList;
