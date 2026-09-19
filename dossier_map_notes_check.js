/* THE SELF-CHECK FOR BOTH ANSWERS TO THE NOTES - a verifier, not a painter.

   It lived inside dossier_map_notes.js until 2026-09-19, when that file needed
   room to place a set of callouts from both ends and hit the 500-line cap every
   authored file here keeps. It came out rather than the placement, because it
   PAINTS NOTHING: it repaints a picture through the ordinary export path and
   measures the rectangles that landed. `DossierMapNotes.check` is still the
   documented entry point and still works - it is one line, and it calls this.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapNotesCheck = { check(mapId, shape) }

   PAINT A PICTURE AND MEASURE WHAT LANDED:

     DossierMapNotes.check("marib_objectives", "wide")            // the panel
     DossierMapNotes.check("marib_objectives_arrows", "square")   // the boxes
     DossierMapNotes.check("marib_objectives", 390)               // ON A PHONE
     DossierMapNotes.check()                                      // last paint

   A STRING IS A SLIDE AND A NUMBER IS A PAGE (2026-09-18). "wide" and "square"
   repaint through DossierMap.exportPng at 2560x1440 and 2048x2048, where the
   painting unit is a bitmap pixel; a NUMBER repaints through DossierMap.draw
   onto a canvas of that many CSS pixels, where the painting unit is a CSS pixel
   and the measurements below are therefore the size the reader's eye gets.
   Nothing is saved and nothing is added to the document - the canvas is
   detached, the same reason `?png=dry` exists.

   What must hold, and what `ok` is: `intersect` empty, no two painted
   rectangles of different items meeting (a number's disc and its own name count
   as two, so a disc printed over its name shows up here too, and a number
   joined to NOTHING is listed there as well); `markOver` empty, no place's own
   square printed through another place's NAME - that one is a fault of the
   label's authored `anchor` and not of these painters, so the check only names
   it; `cut` 0, no sentence ellipsised out of a box or a row; and on a page paint
   the text at least 11 CSS px, which is what sent the panel and the boxes off
   the picture under 700px in the first place. `loose` is not a fault - it names
   the numbers the canvas would not let touch their name and which are therefore
   tied to it by a hairline. Neither is `behind`: a hairline that meets another
   name is clipped out of it and passes under the text. */
"use strict";

var DossierMapNotesCheck = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_notes_check: dossier_map_draw.js is missing");
    }
    return window.DossierMapDraw;
  }
  function N() {
    if (!window.DossierMapNumber) {
      throw new Error("dossier_map_notes_check: dossier_map_number.js is missing");
    }
    return window.DossierMapNumber;
  }
  /* The painter's own floor, read off the painter rather than copied: two
     numbers for one rule is how the check and the picture come to disagree. */
  function readMin() {
    return (window.DossierMapNotes || {}).READ_MIN || 11;
  }

  var SHAPES = { wide: [2560, 1440], square: [2048, 2048] };

  function check(mapId, shape) {
    var R = D(), pageW = typeof shape === "number" ? Math.round(shape) : 0;
    var sq = shape === "square", wh = SHAPES[sq ? "square" : "wide"], c;
    var READ_MIN = readMin();
    if (mapId && pageW) {
      c = document.createElement("canvas");
      window.DossierMap.draw(c, mapId, "light", pageW, null);
    } else if (mapId) {
      window.DossierMap.exportPng(mapId, "light", wh[0], wh[1], null,
                                  sq ? "square" : "wide");
    }
    /* WHICH PICTURE THIS IS comes off the RECORD, never off which painter left
       a report behind: both painters keep their last paint, so after a callouts
       map the panel's discs are still sitting there from an earlier one. With
       no mapId - the caller painted it themselves and knows - the callout
       painter's own report wins. `DOSSIER` is a page-scope const and not a
       window property, exactly as dossier_map.js reads it. */
    var doc = (typeof DOSSIER !== "undefined" && DOSSIER) ? DOSSIER : null;
    var rec = mapId && doc ? (doc.maps || []).filter(function (m) {
      return m.id === mapId; })[0] : null;
    var K2 = window.DossierMapKey, key = K2 && K2.report();
    var REPORT = (window.DossierMapNotes || {}).report
      ? window.DossierMapNotes.report() : null;
    var kind = rec ? (rec.key === "panel" ? "panel" : "callouts")
                   : (REPORT ? "callouts" : "panel");
    /* WAS THE TEXT PAINTED AT ALL? Off the painters' own reports and never off
       the width: each of them clears its report when it measures the words too
       small and paints the numbers alone instead. */
    var bare = !(kind === "panel" ? (key && key.panel) : REPORT);
    var discs = key && key.discs, box = kind === "callouts" && !bare ? REPORT : null;
    var parts = [], bad = [], loose = [], behind = [], cut = 0, size = 0;
    if (box) {
      box.list.forEach(function (e) { parts.push({ tag: String(e.n), box: e.box }); });
      cut = box.cut || 0;
      size = box.size;
    }
    if (discs && (kind === "panel" || bare)) {
      discs.list.forEach(function (e) {
        parts.push({ tag: String(e.n), box: e.box });
        if (e.name) parts.push({ tag: e.n + "name", box: e.name, name: true });
        /* A number the canvas would not let touch its name is TIED to it by a
           hairline; it is still joined, so it is listed here and not a fault.
           A NUMBER WITH NO NAME TO JOIN is not the same fault as a number that
           missed one: a narrow canvas drops second-rank names, and the disc
           then sits on the place itself with its name in the HTML list under
           the picture. `gap` is -1 when the map painted no name. */
        if (!e.glued) loose.push(e.n + " " + e.place +
          (e.gap < 0 ? " NONAME" : " @" + e.gap + (e.led ? " led" : " LOOSE")));
        if (!e.glued && !e.led && e.gap >= 0) bad.push(e.n + " unjoined");
      });
      (discs.leads || []).forEach(function (l) {
        (l.behind || []).forEach(function (q) { behind.push(l.n + " under " + q); });
      });
      /* THE DIGIT IS THE ONLY TEXT LEFT ON A BARE PICTURE, so it is the size
         that has to clear the floor - the disc's own r*1.35, read back off the
         box the report kept. */
      if (bare) {
        size = Math.round(Math.min.apply(null, discs.list.map(function (e) {
          return (e.box.x1 - e.box.x0) / 2 * 1.35;
        }).concat([999])));
      } else if (kind === "panel") {
        cut = (key.panel && key.panel.cut) || 0;
        size = key.panel && key.panel.noteSize;
      }
    }
    parts.forEach(function (a, i) {
      parts.forEach(function (b, k) {
        /* Two NAMES touching is the map's own business, not this painter's. */
        if (k > i && !(a.name && b.name) && R.overlaps(a.box, b.box)) {
          bad.push(a.tag + "x" + b.tag);
        }
      });
    });
    var mark = (key && key.audit && key.audit.hits) || [];
    if (pageW && size && size < READ_MIN) bad.push("text " + size + "px");
    /* AND THE PAGE WAS TOLD THE TRUTH. `data-notes` is what docs\maps_tab.js
       shows or hides the HTML list on, so a picture that painted its words
       while the attribute said "list" would print them twice, and the other way
       round would lose them - this is the assertion that the two cannot part. */
    var notes = c ? c.getAttribute("data-notes") : null;
    if (pageW && notes !== (bare ? "list" : "painted")) {
      bad.push("data-notes=" + notes);
    }
    if (!pageW && exportMarked()) bad.push("data-notes on an export");
    /* A MARK OVER SOMEBODY ELSE'S NAME FAILS THE SLIDE and is only reported on
       the page. The authored `anchor` that fixes one is chosen for the picture
       that gets downloaded; the label engine re-solves at every page width and
       a 340px canvas will always crowd somewhere. */
    return { map: mapId || null,
             shape: pageW ? pageW + "px page" : (sq ? "square" : "wide"),
             kind: bare ? kind + "/bare" : kind,
             items: parts.filter(function (a) { return !a.name; }).length,
             intersect: bad, markOver: mark, loose: loose, behind: behind,
             cut: cut, size: size, notes: notes,
             crossings: box ? box.crossings : null,
             line_over_text: box ? box.line_over_text : null,
             css: box ? box.css : null,
             ok: !bad.length && !cut && (!!pageW || !mark.length) };
  }

  /* An export's canvas has no CSS size of its own, and that is what stops the
     attribute being written on one. Asked here rather than assumed, because
     nothing else on the page would ever notice if it changed. */
  function exportMarked() {
    var c = document.createElement("canvas");
    N().mark(c.getContext("2d"), "painted");
    return c.getAttribute("data-notes") !== null;
  }

  return { check: check };
})();

window.DossierMapNotesCheck = DossierMapNotesCheck;
