/* CAN THIS BOX STAND BESIDE THAT ONE? The one question every placer on the
   board asks of `taken`, answered in one place.

   Written 2026-09-22, out of the `text_over_text` counter
   (dossier_map_check.js, `apart`) going red on EIGHT maps that draw no tribal
   layer at all. The counter says two words READ AS ONE when their boxes
   overlap, or when they share a line with less than a space - 0.16 of the
   shorter box's height - between them. The placers were still asking
   `R.overlaps`, which is an INTERSECTION test: it lets a region name come to
   rest one pixel off a town's name and calls that ground free. MEASURED on
   the board before this file existed: `west_fronts` stretch printed the region
   name מארב and the city name מארב flush together, read as one word
   "MaribMarib", and five more maps carried the same fault at exactly 2.00 px.

   So the placers ask the COUNTER'S OWN function. dossier_map_tribes_fit.js
   `room` did that for the tribal names first; this file is the same rule for
   the two placers that were left - the region names (dossier_map_gov.js) and
   the place labels (dossier_map_zone_names.js, at its 500-line cap, which is
   why the rule cannot live inside it). A painter held to a rule it was not
   given is how a counter ships red for ever.

   A MARK IS NOT A WORD. `taken` is one list holding three kinds of rectangle:
   the marks reserved before any name was placed (dossier_map_ink.js
   `reserve`, which puts `mark: true` on each), the word boxes of everything
   already written, and the key box. A name set at a pin's own clearance is not
   unreadable - it is how every town on the board is labelled - so anything
   carrying `mark: true` keeps the OLD strict test and not one pixel more is
   reserved round the marks than was reserved this morning. The Marib
   measurement of 2026-09-19, where a 15% margin on nine squares cost two
   required names, is exactly the mistake this file must not repeat.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapGap = { clash, step }

   Reached by name at call time, and tolerant of a board without the check on
   it (the deck and the screen both run these painters): with no
   DossierMapCheck the answer falls back to `R.overlaps`, which is what the
   painters did before this file existed. One <script> line in docs\index.html,
   after dossier_map_check.js. */
"use strict";

var DossierMapGap = (function () {
  /* IS `t` IN THE WAY OF `b`? True when the box may NOT be placed there.
     `R` is the painter's own kit (dossier_map_draw.js), which owns the strict
     rectangle test; the gap test belongs to the check, so that the picture and
     the audit of the picture can never hold two different opinions. */
  function clash(R, b, t) {
    var C = window.DossierMapCheck;
    if (!t || !b) return false;
    if (t.mark || !C || !C.apart) return R.overlaps(b, t);
    return !C.apart(b, t);
  }

  /* HOW FAR SIDEWAYS a box must move to get clear of `t` ON ITS OWN LINE, on
     top of the overlap itself. dossier_map_gov.js slides a blocked region name
     just past the box that blocked it; with the old strict test 2 px of slack
     was enough, and with the gap test 2 px lands the word right back inside
     the space the counter demands. A word wants the counter's own space - and
     since `apart` measures the SHORTER of the two boxes, the shorter one is
     what is asked for here too, never more. A mark wants the old 2 px. */
  function step(b, t) {
    var C = window.DossierMapCheck;
    if (!t || !b || t.mark || !C || !C.space) return 2;
    return Math.min(b.y1 - b.y0, t.y1 - t.y0) * C.space + 2;
  }

  return { clash: clash, step: step };
})();

window.DossierMapGap = DossierMapGap;
