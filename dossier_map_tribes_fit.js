/* WHERE A TRIBAL NAME MAY STAND once every other word is already down: the
   room test and the one step of shrinking that buys a name back when the room
   is not there.

   Written 2026-09-22, out of the wide `tribes` export. Ziv, looking at it after
   the picture standard merged the overview frame's ten cities into that map:
   the city name חודיידה printed against the tribal area name ח'ולאן א-טיאל, so
   the two ran together and read as a single word - and the dump said `ok`.

   TWO THINGS WERE WRONG AND ONLY ONE OF THEM IS HERE. The other is the
   counter: no file held the picture's words side by side, so nothing could
   accuse the pair (dossier_map_check.js, `text_over_text`). This file is the
   placement half.

   WHO WALKS ROUND WHOM. The frame's standard cities are the BASE of every
   picture (MAP_STARTER.md section 3) and a map's own layer sits ON TOP and
   changes nothing above it - so the city names are placed first, exactly as
   they are today, and the tribal names find clear ground. dossier_map.js
   already runs them in that order and hands both the same `taken`; what was
   missing is that `taken` was tested with `R.overlaps`, which asks only
   whether two rectangles INTERSECT. MEASURED on the wide export before this
   file existed: the two words that read as one do not intersect at all. They
   stand 6.3 device px apart on a 2560 canvas whose text is 41 px tall - a
   quarter of a space. A word box is tight around its own text, so "not
   touching" was never the same thing as "readable".

   So the room test is `DossierMapCheck.apart`, THE COUNTER'S OWN FUNCTION -
   one definition of what makes two words two words, asked by the painter that
   must satisfy it and by the audit that proves it did. A painter held to a
   rule it was not given is how a counter ships red for ever.

   A MARK IS NOT A WORD. Every mark's rectangle is in the same `taken` list
   (dossier_map_ink.js, `reserve`) carrying `mark: true`, and a name set at a
   pin's own clearance is not unreadable - it is how every town on the board is
   labelled. Those keep the old strict test, so not one pixel more is reserved
   round the marks than was reserved this morning: the Marib measurement of
   2026-09-19 (a 15% margin on nine squares cost two required names) is exactly
   the mistake this file must not repeat.

   AND ONE STEP OF SHRINKING BEFORE A NAME IS GIVEN UP. A tribal area name
   yields rather than fail the picture (dossier_map_tribes.js, `lost`), so
   every pixel the new gap takes would come straight out of the names on the
   map. `fit` therefore offers the same placement a second time at 0.85 of the
   rank's size - below the rank, never below the floor `ranked()` already
   applies, and only where the full size found nowhere. The ranks still read in
   order: a shrunk confederation is still bigger than an area, an area than a
   member.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapTribesFit = { room, fit, steps }

   NOT optional at runtime, and deliberately so: dossier_map_tribes.js calls it
   by name on every candidate spot, so a page that forgot the script line fails
   loudly on the first tribal name instead of quietly painting the fault this
   file was written to stop. One <script> line in docs\index.html, after
   dossier_map_tribes.js. */
"use strict";

var DossierMapTribesFit = (function () {
  /* THE ONE STEP. 0.85 is the smallest step that buys a word back: at the wide
     export the area rank paints about 41 px and 0.85 of it is 35, which is
     still over twice the 13.5 CSS px map-name floor the check holds every
     picture to (dossier_map_check.js, `nameFloor`), and the ~15% narrower word
     is what lets a long name fit between two cities. A second, smaller step
     was tried and refused: a third size on the picture reads as a fourth rank
     the key never names. */
  var STEPS = [1, 0.85];

  /* IS THERE ROOM FOR THIS BOX? `taken` is one list holding three kinds of
     rectangle - the marks reserved before any name was placed, the word boxes
     of everything already written, and the lanes and the key box. A mark may
     be stood beside; a WORD may not, unless a space stands between them. */
  function room(R, b, taken) {
    var C = window.DossierMapCheck;
    if (!b || !taken) return false;
    return !taken.some(function (t) {
      if (!t) return false;
      /* A mark, or a board with no check on it: the old strict test, so
         nothing about what the names must clear has been relaxed or
         tightened by accident. */
      if (t.mark || !C || !C.apart) return R.overlaps(b, t);
      return !C.apart(b, t);
    });
  }

  /* THE SAME PLACEMENT, AT MOST TWICE. `run` is the painter's own `place`,
     handed its own arguments untouched; only the SIZE moves between tries, and
     the first try is the authored rank, so a picture with room on it paints
     precisely what it painted before this file existed. */
  function fit(run, ctx, p, P, R, u, W, H, taken, lanes, j, o) {
    var args = [ctx, p, P, R, u, W, H, taken, lanes, j.at, j.he, j.size, o];
    return STEPS.some(function (z) {
      args[11] = j.size * z;
      return run.apply(null, args);
    });
  }

  return { room: room, fit: fit, steps: STEPS };
})();

window.DossierMapTribesFit = DossierMapTribesFit;
