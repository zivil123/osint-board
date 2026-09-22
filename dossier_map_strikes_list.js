/* dossier_map_strikes_list.js - the strike tally as WORDS under the picture.

   Ziv, 2026-09-22: *"don't put the text inside of the map, put it as something
   I can take."* The painter draws a counted disc at each place and a row of
   little squares for the events; that is a picture and a picture cannot be
   copied into a message. So the same tally is printed here as real HTML under
   the caption - selectable, reachable by a screen reader, and with one button
   that puts the identical plain text on the clipboard.

   NO ES modules - the page runs from file://. One global:

     window.DossierStrikesList = { render(container, map), mountAll(root) }

   `render` fills ONE container for ONE map record; `mountAll` finds every
   `.ds-strikes-box` a block wrote (dossier_map_block.js) and renders it. The
   block writes the empty box and schedules the mount, so the list follows the
   picture it belongs to and no view had to learn a new call.

   THE NUMBERS ARE NEVER COMPUTED HERE. They come from
   `DossierMapStrikes.tally(map)` (dossier_map_strikes_data.js), the same call
   the painter and the painted key make - one source for the picture, its key
   and these words, so the disc and the line under it can never disagree.

   The Hebrew is the main chat's, pasted from scratchpad/najran_city_copy.json.
   Nothing here is painted into a canvas and nothing reaches the PNG exports.

   Reads app.js's `esc` and the const DOSSIER at call time. Style: strikes.css */
"use strict";

var DossierStrikesList = (function () {
  var P = {
      "list_title": "רשימת התקיפות",
      "copy_button": "העתק את הרשימה",
      "copied": "הועתק",
      "since_line": "מ-12 ביולי 2026 ועד היום",
      "count_one": "תקיפה אחת",
      "count_many": "{n} תקיפות",
      "category": {
          "drone": "כטב\"ם",
          "missile": "טיל בליסטי",
          "both": "טיל בליסטי וכטב\"ם",
          "unspecified": "נשק לא צוין"
      },
      "status": {
          "claimed": "לפי הודעת החות'ים",
          "reported": "לפי דיווח"
      },
      "verdict": {
          "confirmed": "אומת ממקור עצמאי",
          "partial": "אימות חלקי",
          "denied": "הוכחש",
          "none": ""
      },
      "target_prefix": "היעד המוצהר:"
  };

  /* One separator between the parts of a line, on the page and in the copied
     text alike - the reader's eye and his paste have to see the same row. */
  var SEP = " · ";

  /* D.M, no year: the year is said once in the since line above, and a column
     of "12.7" reads as a date where "12.07.2026" reads as a serial number. */
  function dayMonth(iso) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(iso || ""));
    if (!m) return String(iso || "");
    return String(parseInt(m[3], 10)) + "." + String(parseInt(m[2], 10));
  }

  function countOf(row) {
    var n = row && row.count;
    if (typeof n === "number" && n >= 0) return n;
    return ((row && row.events) || []).length;
  }

  function countWord(n) {
    return n === 1 ? P.count_one : String(P.count_many).replace("{n}", String(n));
  }

  /* ONE EVENT, ONE LINE: the date, what was fired, the target, who says so,
     and the verdict only when there IS one. `verdict.none` is the empty string
     in the copy file on purpose - an unjudged event must not print a word that
     sounds like a judgement, so an empty word drops the part entirely. */
  function lineOf(ev) {
    if (!ev) return "";
    var parts = [dayMonth(ev.date), P.category[ev.cat] || P.category.unspecified];
    if (ev.target_he) parts.push(P.target_prefix + " " + ev.target_he);
    var status = P.status[ev.status];
    if (status) parts.push(status);
    var verdict = P.verdict[ev.verdict];
    if (verdict) parts.push(verdict);
    return parts.join(SEP);
  }

  function rowsOf(map) {
    var S = window.DossierMapStrikes;
    if (!S || typeof S.tally !== "function") return [];
    try {
      var rows = S.tally(map);
      if (!Array.isArray(rows)) return [];
      return rows.filter(function (r) { return r && ((r.events || []).length); });
    } catch (e) { return []; }
  }

  /* The list's markup wears `ds-notes`/`ds-note`, the same classes the numbered
     explanations under a keyed picture wear (map_notes.css), so this block
     reads as one of the board's lists and not as a new invention. The numbers
     restart under every place, because they count that place's strikes. */
  function html(rows) {
    return '<div class="ds-strikes" dir="rtl">' +
      '<div class="ds-strikes-top">' +
      '<div class="ds-strikes-titles">' +
      '<h4 class="ds-strikes-h">' + esc(P.list_title) + "</h4>" +
      '<p class="ds-strikes-since">' + esc(P.since_line) + "</p></div>" +
      '<button type="button" class="ds-strikes-copy">' + esc(P.copy_button) +
      "</button></div>" +
      rows.map(function (r) {
        return '<h5 class="ds-strikes-place">' + esc(r.he || r.place || "") +
          '<span class="ds-strikes-count">' + esc(countWord(countOf(r))) +
          "</span></h5>" +
          '<ol class="ds-notes strikes">' + (r.events || []).map(function (ev, i) {
            return '<li class="ds-note"><span class="ds-note-n">' + esc(String(i + 1)) +
              '</span><span class="ds-note-t">' + esc(lineOf(ev)) + "</span></li>";
          }).join("") + "</ol>";
      }).join("") + "</div>";
  }

  /* THE TEXT THE BUTTON HANDS OVER IS BUILT FROM THE SAME ROWS AND THE SAME
     `lineOf`, never scraped off the page: a paste into a report must not carry
     whatever spacing the layout happened to produce that day. */
  function plainText(rows) {
    var out = [P.list_title, P.since_line, ""];
    rows.forEach(function (r) {
      out.push((r.he || r.place || "") + " — " + countWord(countOf(r)));
      (r.events || []).forEach(function (ev, i) {
        out.push(String(i + 1) + ". " + lineOf(ev));
      });
      out.push("");
    });
    return out.join("\n").replace(/\n+$/, "\n");
  }

  function flash(btn) {
    if (!btn || btn.dataset.busy === "1") return;
    btn.dataset.busy = "1";
    btn.textContent = P.copied;
    btn.classList.add("is-done");
    window.setTimeout(function () {
      btn.textContent = P.copy_button;
      btn.classList.remove("is-done");
      btn.dataset.busy = "";
    }, 2000);
  }

  /* THE FALLBACK IS A SELECTION, NOT A LIE. A page served from file://, an
     insecure origin or a denied permission has no `navigator.clipboard`; there
     the list selects itself so one press of the copy key takes it, and the
     button does NOT say "copied", because nothing was. */
  function selectText(container) {
    var body = container && container.querySelector(".ds-strikes");
    if (!body || !window.getSelection || !document.createRange) return false;
    var sel = window.getSelection(), range = document.createRange();
    range.selectNodeContents(body);
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  }

  function copy(btn, container, text) {
    var nav = window.navigator;
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      try {
        nav.clipboard.writeText(text).then(function () { flash(btn); },
          function () { selectText(container); });
        return;
      } catch (e) { /* fall through to the selection */ }
    }
    selectText(container);
  }

  /* A strikes picture carries no `key` and no `notes`, so the numbered
     explanations list never builds one for it - but if an older box is sitting
     in the section it comes out, because two lists under one picture is the
     thing the painted heading was struck for. */
  function dropNotes(container) {
    var section = container.closest ? container.closest(".ds-map") : null;
    var box = section && section.querySelector(".ds-notes-box");
    if (box && box.parentNode) box.parentNode.removeChild(box);
  }

  function render(container, map) {
    if (!container || !map) return false;
    var rows = rowsOf(map);
    if (!rows.length) { container.innerHTML = ""; return false; }
    var markup = html(rows);
    container.innerHTML = markup;
    container.dataset.rows = String(rows.length);
    var text = plainText(rows);
    var btn = container.querySelector(".ds-strikes-copy");
    if (btn) {
      btn.addEventListener("click", function () { copy(btn, container, text); });
    }
    dropNotes(container);
    return true;
  }

  /* Every empty box a block wrote, filled from the record it names. Called on a
     zero timer by dossier_map_block.js, which builds its markup as a string and
     hands it to a view that writes it in synchronously - so by the time this
     runs the boxes are in the document. Running it twice is harmless: a box is
     rebuilt from the same tally. */
  function mountAll(root) {
    if (typeof DOSSIER === "undefined" || !DOSSIER) return;
    var doc = root || document, byId = {};
    (DOSSIER.maps || []).forEach(function (m) { if (m) byId[m.id] = m; });
    Array.prototype.forEach.call(doc.querySelectorAll(".ds-strikes-box"),
      function (box) {
        var map = byId[box.dataset.map];
        if (map && map.strikes) render(box, map);
      });
  }

  return { render: render, mountAll: mountAll, plainText: plainText,
           lineOf: lineOf, rowsOf: rowsOf };
})();

window.DossierStrikesList = DossierStrikesList;
