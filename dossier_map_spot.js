/* WHERE A NUMBERED DISC MAY STAND: the ground claimed for it before any word
   is placed, and the search that places it.

   Split out of dossier_map_number.js on 2026-09-19 at that file's 500-line cap,
   which is the same seam the file itself came out of (dossier_map_key.js,
   2026-09-18). The cut is a real one: this file knows nothing about a digit
   being painted, and the file it left knows nothing about how a spot is found.

   It exists because of one instruction. Ziv, 2026-09-19, having had the
   connector lines built the day before: *"Remove the lines from the Marib. And
   do it a bit more zoomed out. And replace the lines with numbers next to the
   squares."* With the lines gone the digit is the ONLY thing joining a square
   to its row, so a disc that could not touch its mark used to be excused by its
   connector and is now a fault (`mark_unlabelled`, dossier_map_ink.js).

   NO ES modules - the page runs from file://. One global:

     window.DossierMapSpot = { discR, floorR, ladder, glue, slots, slotOf,
                               ownSpot, ownMark, nearSpot, markClearOf,
                               boxAt, gapOf, grow } */
"use strict";

var DossierMapSpot = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_spot: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }
  function kit() {
    var X = window.DossierMapExtra;
    if (!X || !X.kit) {
      throw new Error("dossier_map_spot: dossier_map_extra.js is not on the page");
    }
    return X.kit;
  }

  /* The disc is written for BASE_W and floored like every other mark here: a
     number that shrinks with the canvas stops being readable, and this one has
     to be matched to a row in the panel by eye. */
  var DISC_R = 12, DISC_MIN = 10, GLUE = 4;
  var SLOTS = {};

  function boxAt(x, y, r) {
    return { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
  }
  /* How far a number ended from its own unit - the gap the self-check reads. */
  function gapOf(a, b) {
    var dx = Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1));
    var dy = Math.max(0, Math.max(a.y0 - b.y1, b.y0 - a.y1));
    return Math.hypot(dx, dy);
  }
  function grow(b, m) {
    return { x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m };
  }
  function discR(u, ts, n) {
    var r = Math.max(DISC_MIN, DISC_R * u * ts);
    return n >= 10 ? r * 1.18 : r;
  }
  /* THE SMALLEST A DIGIT MAY BE, and the floor is the picture check's own: 15
     CSS px measured in the rectangle it is painted in, 13.5 measured on the
     CANVAS (MAP_RULES.md rules 2 and 2a), whichever bites first. A number that
     shrinks until it fits is the fault rule 2 was written against, so this is
     where the shrinking stops - on the wide Marib picture a radius of 20
     against a full-size 36.
     A HAIR ABOVE THE FLOOR, NEVER EXACTLY ON IT. The check measures the digit
     back off the painted rectangle, so a disc sized to land on 15.000 lands on
     14.999 and the picture fails for a rounding error: both square pictures did
     on 2026-09-19. One per cent is invisible and is the difference between a
     floor hit and a floor missed. */
  var SAFE = 1.01;
  function floorR(u) {
    var C = window.DossierMapCheck, R = D();
    var cs = R.canvasScale ? (R.canvasScale() || u) : u;
    var floor = (C && typeof C.floor === "number") ? C.floor : 15;
    var nameFloor = (C && typeof C.nameFloor === "number") ? C.nameFloor : 13.5;
    return Math.max(DISC_MIN,
                    nameFloor * cs * SAFE / 1.35, floor * u * SAFE / 1.35);
  }
  /* THE SIZES A DISC MAY TRY, LARGEST FIRST, the last rung the floor itself
     rather than the last step that cleared it: a picture that fails for the
     sake of half a pixel of digit has failed for nothing. */
  var RUNGS = [1, 0.86, 0.74, 0.64];
  function ladder(r, u) {
    var min = floorR(u);
    var out = RUNGS.map(function (k) { return r * k; })
      .filter(function (v) { return v >= min; });
    if (!out.length) return [r];
    if (out[out.length - 1] > min + 0.5) out.push(min);
    return out;
  }
  /* THE MARK'S OWN CLEARANCE, read off the table the map drew it with
     (dossier_map_routes.js), so a disc glued to a mark starts exactly clear of
     the square, triangle or dot. */
  function markClearOf(pinR, place, map) {
    var R = window.DossierMapRoutes;
    var hit = ((map && map.labels) || []).filter(function (l) {
      return l.place === place;
    })[0];
    return R && R.markClear ? R.markClear(pinR, hit && hit.kind) : (pinR || 3);
  }

  /* ---- glued: the four sides of a box, then its corners -------------------- */

  /* THE RTL READING SIDE FIRST: in the panel the number opens the row and the
     name follows leftwards, so on the map the number goes to the right and the
     pair reads the same way in both halves of one picture. THE CORNERS COUNT AS
     GLUED and are tried after the four sides: a disc touching a corner still
     reads as part of that unit. */
  var SIDES = ["e", "w", "n", "s", "ne", "se", "nw", "sw"];
  var OPPOSITE = { e: "w", w: "e", n: "s", s: "n",
                   ne: "sw", sw: "ne", nw: "se", se: "nw" };

  function sideBox(b, side, r, g) {
    var mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
    var x = side.indexOf("e") >= 0 ? b.x1 + g + r
          : side.indexOf("w") >= 0 ? b.x0 - g - r : mx;
    var y = side.indexOf("n") >= 0 ? b.y0 - g - r
          : side.indexOf("s") >= 0 ? b.y1 + g + r : my;
    return { x: x, y: y, box: boxAt(x, y, r) };
  }
  function glue(b, r, u, bars, foreign, W, H, order) {
    var g = GLUE * u, out = null;
    (order || SIDES).some(function (side) {
      var c = sideBox(b, side, r, g), box = c.box, own = gapOf(box, b);
      if (box.x0 < 0 || box.x1 > W || box.y0 < 0 || box.y1 > H) return false;
      if (bars.some(function (t) { return D().overlaps(box, t); })) return false;
      /* AND ITS OWN UNIT MUST BE THE NEAREST. A number touching one name and
         resting against another reads as the other's - which is how צאפר's 9
         came to sit 2px off אל-ת'ניה, the fault this pass is about.
         A RIVAL INSIDE THE SAME CLUSTER IS NOT A RIVAL, the excuse rule 8 makes
         for a name and for the same reason (DossierMapInk.adjacent). At 1230px
         the Marib squares sit 16px apart and a disc is 26 across, so "nearest
         wins" there is not strict, it is unsatisfiable. What tells them apart at
         that spacing is TOUCHING. A rival further off than one disc across still
         wins the number away and still refuses the spot. */
      if (foreign.some(function (o) {
            return gapOf(box, o) <= own && gapOf(b, o) > 2 * r;
          })) return false;
      out = { x: c.x, y: c.y, box: box, side: side, glued: true, gap: own };
      return true;
    });
    return out;
  }

  /* ---- the ground every number is owed, claimed before any name is placed --- */

  /* THE RESERVATION IS THE FIX, AND IT IS THE SAME FIX AS THE MARKS' OWN
     (dossier_map_ink.js, 2026-09-19). A disc placed after the words is a disc
     placed on whatever the words left, and on a list picture that is not good
     enough any more: every numbered mark must end up with a digit TOUCHING it.
     Measured at the page's own 1230px before this existed: Sahn al-Jinn's
     square had Tadween's square to the north, Marib's to the south, a front's
     red diamond west and Marib's and Tadween's NAMES east - every side spoken
     for, its number left 18px off at the end of a hairline, and the picture
     rightly failed.
     So one disc-sized rectangle per numbered place is claimed HERE, before a
     single word is measured, and the names walk round it the way they already
     walk round the marks. Two things keep the cost honest:
       - it is reserved at the FLOOR radius, not the full one, so a name loses
         the smallest square a readable digit can sit in and no more;
       - it is offered the side OPPOSITE the label's authored anchor first, so
         the name keeps its own first choice and the pair ends up either side of
         the mark.
     A place hemmed in by other MARKS gets no slot and falls through to the
     older search, which is the one case a hairline is still drawn for. */
  function slotFor(q, rungs, c, u, o, anchor) {
    var g = GLUE * u, order = [], mk = boxAt(q[0], q[1], c), out = null;
    if (OPPOSITE[anchor]) order.push(OPPOSITE[anchor]);
    SIDES.forEach(function (s) {
      if (order.indexOf(s) < 0 && s !== anchor) order.push(s);
    });
    if (anchor && SIDES.indexOf(anchor) >= 0) order.push(anchor);
    /* THE BIGGEST DISC THAT FITS, side by side down the ladder. Claiming the
       floor size for everybody would be cheaper in ground and would leave one
       picture printing 20px numbers beside 28px ones - measured on the wide
       Marib list, four of nine - and a number that is smaller than its
       neighbour for no reason a reader can see is the kind of detail Ziv reads
       as sloppiness. So each place claims the largest it can have and the disc
       is painted at exactly that size. */
    rungs.some(function (r) {
      return order.some(function (side) {
      var b = sideBox(mk, side, r, g).box;
      if (b.x0 < 0 || b.x1 > o.W || b.y0 < 0 || b.y1 > o.H) return false;
      if (o.taken.some(function (t) { return D().overlaps(b, t); })) return false;
      /* BOTH FLAGS, and each is read by somebody: `disc` keeps the name search
         in dossier_map_number.js from mistaking this small axis-aligned box for
         the place's own name, and `mark` tells the leader router that crossing
         reserved-but-empty ground is not a line over a word (rule 4). A word
         may still not be PLACED on it - that is the point of claiming it. */
      b.disc = true; b.mark = true;
      out = { box: b, r: r };
      return true;
      });
    });
    return out;
  }
  /* Called by DossierMapInk.reserve, in the same breath as the marks. A
     CALLOUTS picture draws an arrow from its sentence to the place, which is
     its own join, so only a `key: "panel"` picture reserves these. */
  /* THE MOST BOXED-IN PLACE CLAIMS FIRST, the same rule the callouts place
     their edge belts by: whoever goes last takes what is left, and in the
     Marib cluster the last of three squares 30px apart is left with nothing.
     Measured 2026-09-19 on the wide download: in `notes[]` order Sahn al-Jinn
     went ninth of nine and its number ended up at the far end of its name,
     280px from its own square and smaller than the other eight. */
  function crowding(q, r, o) {
    var room = { x0: q[0] - 3 * r, y0: q[1] - 3 * r,
                 x1: q[0] + 3 * r, y1: q[1] + 3 * r };
    return o.taken.filter(function (t) { return D().overlaps(room, t); }).length;
  }
  function slots(p, R, u, map, o) {
    SLOTS = {};
    if (!map || map.key !== "panel" || !p) return SLOTS;
    var seats = [];
    (map.notes || []).forEach(function (n, i) {
      if (typeof n.lon !== "number" || typeof n.lat !== "number") return;
      if (!p.inside(n.lon, n.lat, 0)) return;
      var q = p(n.lon, n.lat), rungs = ladder(discR(u, o.ts || 1, i + 1), u);
      seats.push({ n: n, q: q, rungs: rungs,
                   c: markClearOf(o.pinR, n.place, map),
                   crowd: crowding(q, rungs[0], o) });
    });
    seats.sort(function (a, b) { return b.crowd - a.crowd; });
    seats.forEach(function (e) {
      var hit = ((map.labels) || []).filter(function (l) {
        return l.place === e.n.place;
      })[0];
      var s = slotFor(e.q, e.rungs, e.c, u, o, hit && hit.anchor);
      if (s) { o.taken.push(s.box); SLOTS[e.n.place] = s; }
    });
    return SLOTS;
  }
  function slotOf(place) {
    return SLOTS[place] || null;
  }

  /* ---- not glued: the searches of last resort ------------------------------ */

  /* IS THIS THE NEAREST MARK? The question a reader answers by eye when a disc
     is not touching anything, and the one the old "nearest NAME" test never
     asked. `others` is every other note's own point. */
  function ownMark(c, q, others) {
    var own = Math.hypot(c[0] - q[0], c[1] - q[1]);
    return !others.some(function (o) {
      return Math.hypot(c[0] - o[0], c[1] - o[1]) <= own;
    });
  }
  /* A ring search round the place's OWN point that never strays nearer to
     another note's mark than to this one - the displaced disc's placement,
     where its hairline is all that says whose it is. */
  function ownSpot(q, r, u, bars, others, W, H) {
    var step = Math.max(4 * u, r * 0.5), out = null, ring, k, ang, x, y, b;
    for (ring = 1; ring <= 20 && !out; ring++) {
      for (k = 0; k < 36 && !out; k++) {
        ang = k * Math.PI / 18;
        x = q[0] + Math.cos(ang) * (r + step * ring);
        y = q[1] + Math.sin(ang) * (r + step * ring);
        b = boxAt(x, y, r);
        if (b.x0 < 0 || b.x1 > W || b.y0 < 0 || b.y1 > H) continue;
        if (bars.some(function (t) { return D().overlaps(b, t); })) continue;
        if (ownMark([x, y], q, others)) out = { x: x, y: y, box: b };
      }
    }
    return out;
  }
  /* THE LAST-RESORT SEARCH IS THE SHARED ONE - `DossierMapExtra.kit`'s
     findSpot, scored on distance and never returning nothing, so a disc is
     NEVER DROPPED (a panel row with no number is a row about nothing). */
  function nearSpot(box, cx, cy, r, u, bars, cross, W, H) {
    var f = kit().findSpot({ x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1,
      cx: cx, cy: cy }, "n", 2 * r, 2 * r, u, bars, cross || [], [], [], W, H);
    return { x: (f.x0 + f.x1) / 2, y: (f.y0 + f.y1) / 2, box: f };
  }

  return { discR: discR, floorR: floorR, ladder: ladder, glue: glue,
           slots: slots, slotOf: slotOf, ownSpot: ownSpot, ownMark: ownMark,
           nearSpot: nearSpot, markClearOf: markClearOf,
           boxAt: boxAt, gapOf: gapOf, grow: grow };
})();

window.DossierMapSpot = DossierMapSpot;
