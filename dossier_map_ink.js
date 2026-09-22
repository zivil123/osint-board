/* WHAT THE PICTURE PUT ON THE MAP: every MARK and every WORD, and the two
   accusations that come out of holding the two lists side by side.

   Ziv, 2026-09-19, looking at the real pictures after the picture check had
   passed all of them: the town names Haradh, Maris, Hayfan and Jabal Habashi
   were partly covered by a front's red diamond, by a summit triangle or by a
   heat badge, and al-Hazm printed with no dot at all on any of the four Marib
   pictures. Both faults are the same one seen from two sides - A MARK AND A
   WORD ON THE SAME PIXELS - and neither could be counted, because no file knew
   both lists. The painters each knew their own.

   So they report here, and this file answers two questions no single painter
   can:

     mark_over_text      a mark and a name share ground. Text must never sit
                         under a diamond, a triangle, a square, a pin or a
                         level badge, and a mark must never be painted onto a
                         name. Counted once per PAIR, by whichever of the two
                         was registered second.
     label_without_pin   a town's own dot is buried under somebody else's
                         name, so the reader is told a name and not shown a
                         place. Raised by dossier_map_zone_names.js, which asks
                         `covered()` once every name on the picture is down.
     name_far_from_mark  a name IS printed, but not beside the mark it belongs
                         to - so it reads as the name of whatever it landed
                         next to (2026-09-19, rule 8 of MAP_RULES.md).
     mark_unlabelled     a mark was painted and NOTHING on the picture says
                         what it is: no name touching it, no numbered disc
                         glued to it, no callout arrow reaching it. ON A LIST
                         PICTURE it says more than that: every mark that owns a
                         numbered row must carry its DISC, touching it, and a
                         name beside the mark does not stand in for one (Ziv,
                         2026-09-19 - the numbers ARE the join now that the
                         connector lines are gone).
     legend_orphan       a key row names a mark the picture never painted, or
                         the picture painted a mark kind the key never names.

   Both are counted into `DossierMapCheck` (dossier_map_check.js) and neither is
   on its `info` list, so either one above zero FAILS the picture in
   scripts\dossier_png_dump.py. That is the point: a counter nobody can raise is
   a rule nobody keeps.

   THE FIX IS NOT THIS FILE, IT IS THE RESERVATION. Every mark's rectangle goes
   into `taken` BEFORE any name is placed (dossier_map_zone_names.js,
   `reserve()`), so the placement engines walk round the marks the way they
   already walk round each other. This file is what proves they did.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapInk = { begin, reserve, mark, word, covered, report,
                              adjacent, painted, numbered, pending, audit }

   Loaded beside dossier_map_check.js, before every painter, and OPTIONAL at
   runtime exactly as the check is: every caller guards on the global, so a
   board without this file paints precisely as it did. */
"use strict";

var DossierMapInk = (function () {
  /* A shared edge is not a collision. Two rectangles that merely touch - a name
     box measured flush against a pin's own clearance - would otherwise be
     reported for ever, and the one thing this file must not do is cry wolf.
     More than a pixel of overlap on BOTH axes is ink on ink. */
  var BITE = 1;

  function hit(a, b) {
    return !!a && !!b &&
      Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > BITE &&
      Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > BITE;
  }

  var marks = [], words = [];
  /* THE MARKS THAT BELONG TO A PLACE, and what ended up saying so. `marks`
     holds every rectangle on the picture, diamonds and level badges included;
     this is the subset a LABEL owns, the one thing on a map that a reader
     expects a word beside. `drawn` is set when the mark is really painted (a
     label whose name is dropped never paints one), `named` when something
     claimed it - its own name, a numbered disc glued to it, a callout arrow. */
  var owned = [], kinds = {}, pend = [];

  function tell(n) {
    if (n && window.DossierMapCheck) DossierMapCheck.add("mark_over_text", n);
  }
  /* One picture starts. Called by placeLabels, which every map paint reaches
     and which runs before any name is placed - so the lists can never carry a
     rectangle from the picture before this one. */
  function begin() {
    marks = []; words = []; owned = []; kinds = {}; pend = [];
  }
  /* A REQUIRED NAME THE LABEL PASS COULD NOT PLACE, held over until the
     picture is FINISHED (2026-09-19). The place names go down before the
     region names and the front names, so at that moment nothing can say
     whether the word is on the picture or not - and the build's own rule
     (scripts\dossier_maps_names.py, `check_prose`) is exactly that a name is
     shown when it appears INSIDE something the picture prints, its region
     names and front names included. At 390 CSS px the Marib cluster has no
     room for the town label מארב; the governorate name מארב stands down only
     while the town label is there, so on the phone it prints and the reader is
     told where Marib is. `audit` below is where the verdict is taken. */
  function pending(key, he) {
    pend.push({ key: String(key || "?"), he: String(he || "") });
  }
  function said(he) {
    return !!he && words.some(function (w) {
      return String(w.tag).indexOf(he) >= 0;
    });
  }
  /* A mark was painted: a pin, an objective square, a summit triangle, a
     fighting zone's diamond, a heat level badge. `box` is the ground it covers,
     in the same pixels the names are measured in. */
  function mark(box, tag) {
    if (!box) return;
    var bad = words.filter(function (w) { return hit(box, w.box); });
    marks.push({ box: box, tag: tag || "mark" });
    if (bad.length) {
      tell(bad.length);
      console.error("dossier map ink: the mark " + (tag || "?") +
        " is painted over " + bad.map(function (w) { return w.tag; }).join(", "));
    }
  }
  /* A name was painted: a town, a region, a front. `own` is the mark this name
     belongs to, which it is allowed to touch - a name is set at its mark's own
     clearance and the reservation holds a little more than that, so counting
     the pair would report every named town on the board.

     AND A NAME WITH AN `own` IS MEASURED AGAINST IT (2026-09-19, rule 8). The
     placement only ever offers an adjacent spot now, so this is the proof and
     not the rule: a name that still lands away from its mark is counted and
     named, and the mark it was meant for is left unclaimed for `audit` to
     accuse. A region name and a front name carry no `own` - they name an AREA,
     and an area has no one pixel to sit beside. */
  function word(box, tag, own) {
    if (!box) return;
    var bad = marks.filter(function (m) {
      return m.box !== own && hit(box, m.box);
    });
    words.push({ box: box, tag: tag || "name" });
    if (bad.length) {
      tell(bad.length);
      console.error("dossier map ink: the name " + (tag || "?") +
        " is painted over " + bad.map(function (m) { return m.tag; }).join(", "));
    }
    if (!own) return;
    if (adjacent(box, own, box.y1 - box.y0)) { claim(own); return; }
    if (window.DossierMapCheck) DossierMapCheck.add("name_far_from_mark", 1);
    console.error("dossier map ink: the name " + (tag || "?") + " is printed " +
      Math.round(gapOf(box, own)) + "px from its own mark, or nearer another " +
      "mark than its own - it reads as that mark's name");
  }
  /* Is this rectangle buried under a name? `own` is the caller's own name box,
     which is never a fault: a pin and the word beside it belong together. */
  function covered(box, own) {
    return words.filter(function (w) {
      return w.box !== own && hit(box, w.box);
    }).map(function (w) { return w.tag; });
  }

  /* ---- ADJACENCY: a name belongs to the mark it is TOUCHING ---------------- */

  /* Ziv, 2026-09-19, of the wide Marib list map: Tadween's name printed a long
     way north-west of its own square, across another connector's lane and hard
     against the Raghwan front's red diamond, so it read as the diamond's name;
     Sahn al-Jinn's was pushed to the far side of the hatching; and
     al-Thaniyah's square carried no word and no number at all - the only one of
     nine with nothing beside it. The search had been given ever longer reaches
     (rings out to 86u) precisely so that a required name would never be
     dropped, and the far rings bought exactly the wrong thing: a name nobody
     can attach to anything is not a name that was saved.

     So a name is offered ANY side of its mark, east included, and no distance:
     the gap is at most ADJ text heights, and no other mark on the picture may
     be as near. Where that cannot be had, the name is not printed at all and
     the place is shown by its NUMBERED DISC glued to the mark instead - which
     is what the list beside the picture names. MAP_RULES.md rule 8. */
  var ADJ = 0.6;

  function gapOf(a, b) {
    var dx = Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1));
    var dy = Math.max(0, Math.max(a.y0 - b.y1, b.y0 - a.y1));
    return Math.hypot(dx, dy);
  }
  /* `h` is the text's own height, so the rule reads the same on a phone and on
     a 2560px slide: everything on the picture grows together.
     A MARK NEARER YOUR OWN MARK THAN THE WORD IS TALL IS NOT A RIVAL
     (2026-09-19). al-Hazm's dot stands 19px from the al-Labanat objective
     square on the Marib picture at 1230, where the name is 23px high, and
     Marib's own dot sits inside the ring of nine squares: no placement of a
     word that size can be nearer one of them than the other by enough for a
     reader to see, so "nearest wins" there is not strict, it is unsatisfiable,
     and the required name was dropped outright - the very fault Ziv raised.
     One text height is the honest line: closer than that and the two marks
     are one cluster, the name stands beside the pair, and the neighbour is
     told apart by its own number, its connector or its own name. A mark
     further off than the word is tall still wins the name away and still
     refuses the spot - the Tadween-by-the-red-diamond case this was written
     for, where the square and the diamond are hundreds of pixels apart. */
  function adjacent(box, own, h) {
    if (!own || !box) return true;
    var g = gapOf(box, own);
    if (g > ADJ * (h || 0)) return false;
    return !marks.some(function (m) {
      return m.box !== own && gapOf(box, m.box) <= g &&
        gapOf(own, m.box) > (h || 0);
    });
  }
  function at(x, y) {
    return owned.filter(function (o) {
      return x >= o.box.x0 && x <= o.box.x1 && y >= o.box.y0 && y <= o.box.y1;
    });
  }
  function claim(own) {
    owned.forEach(function (o) { if (o.box === own) o.named = true; });
  }
  /* THE MARK WAS REALLY PAINTED, and of this KIND - reported by the one
     function that draws every one of them (dossier_map_routes.js `mark`), so a
     reservation whose name was later dropped is never counted as ink on the
     picture, and the key's own rows can be held to what is really there. The
     legend's swatch calls that function too and says so, or every key would
     prove itself. */
  function painted(x, y, kind) {
    if (kind) kinds[kind] = (kinds[kind] || 0) + 1;
    at(x, y).forEach(function (o) { o.drawn = true; });
  }
  /* A NUMBERED DISC IS GLUED TO THIS MARK, or a callout's arrow ends on it.
     Either says which place it is as plainly as a name does - the number is
     read off the list beside the picture, the arrow off the sentence it came
     from - so both claim the mark.
     `glued` is the STRICTER answer: the disc is touching its own unit, the
     mark or the name printed against it, rather than standing off at the end
     of a hairline. A list picture is held to that one (`audit` below); every
     other picture is held to `named`. */
  function numbered(x, y, glued) {
    at(x, y).forEach(function (o) {
      o.named = true;
      if (glued !== false) o.disc = true;
    });
  }

  /* ---- the picture is finished: what was left unsaid ----------------------- */

  /* Called once by dossier_map.js after every layer, the legend and the heat
     badges are down. Two accusations, and both are questions no single painter
     can answer because each needs the WHOLE picture:

       mark_unlabelled  a mark is on the map and nothing says what it is.
       legend_orphan    the key and the map disagree about which marks exist.

     The key rows this reads are the ones that carry a `kind` - the mark rows
     dossier_map_routes.js builds from the record's own labels. A row that
     describes the PICTURE rather than naming a mark on it - the claim caveat,
     the territory fills, the line of contact - carries none and is not asked:
     it can never be orphaned by a painter, because no painter decides it. */
  function audit(mapId, legend) {
    var C = window.DossierMapCheck;
    if (!C) return null;
    pend.forEach(function (q) {
      if (said(q.he)) {
        console.warn("dossier map " + (mapId || "?") + ": " + q.key + " is " +
          "not printed a second time - its name is already on the picture");
        C.add("req_labels", 1);
        return;
      }
      console.error("dossier map " + (mapId || "?") + ": required label " +
        q.key + " could not be placed: no free anchor");
      C.drop(q.key);
    });
    C.add("name_far_from_mark", 0);
    /* ON A LIST PICTURE THE DISC IS THE RULE, not a second-best to a name
       (Ziv, 2026-09-19). A mark that owns a numbered row has to carry that
       number TOUCHING it, because the number is now the only thing joining the
       square to the sentence beside the map. A name printed against the mark is
       still wanted and still placed - it just no longer excuses a missing
       disc. Every other mark is held to the older question: does ANYTHING on
       the picture say what this is. */
    var lost = owned.filter(function (o) {
      return o.drawn && (!o.named || (o.needsDisc && !o.disc));
    });
    C.add("mark_unlabelled", lost.length);
    if (lost.length) {
      console.error("dossier map " + (mapId || "?") + ": nothing names " +
        lost.map(function (o) {
          return o.tag + (o.needsDisc && !o.disc ? " (no number disc" +
            " touching it)" : "");
        }).join(", ") +
        " - no name touching the mark, no number glued to it");
    }
    var rows = (legend && legend.rows) || null, orphan = 0, want = {};
    if (rows) {
      rows.forEach(function (r) {
        if (!r.kind) return;
        want[r.kind] = true;
        if (kinds[r.kind]) return;
        orphan++;
        console.error("dossier map " + (mapId || "?") + ": the key has a row " +
          "for " + r.kind + " and the picture paints none");
      });
      Object.keys(kinds).forEach(function (k) {
        if (k === "town" || want[k]) return;
        orphan++;
        console.error("dossier map " + (mapId || "?") + ": the picture paints " +
          "a " + k + " mark and the key never names it");
      });
      C.add("legend_orphan", orphan);
    }
    return { unlabelled: lost.length, orphan: orphan, kinds: kinds };
  }

  /* ---- the reservation: every mark measured before any name is placed ------ */

  /* A MARK IS ON THE PICTURE BEFORE ANY NAME IS (2026-09-19), so every name -
     the map's own, the region names, the front names, and everything the other
     painters fit round `taken` - walks round the marks the way it already
     walks round the other names.

     Two faults Ziv found on the real pictures, and they are one fault:

       - al-Hazm printed with NO DOT on all four Marib pictures. The dot WAS
         painted; al-Labanat's name was then placed on top of it, because a
         pin's own rectangle was in nobody's list.
       - Haradh, Maris, Hayfan and Jabal Habashi printed under their front's
         red diamond, a summit triangle or a level badge. The same pixels the
         other way round: the diamonds go down in ground(), long before any
         name is placed, and nothing told the placement they were there.

     So every mark that WILL be painted is measured here first and its
     rectangle pushed into `taken`. A label whose name then cannot be placed
     has still spent its mark's few pixels, which is the honest trade: the
     alternative is a reservation that arrives after the name it was meant to
     protect. */
  /* THE RECTANGLE IS THE MARK'S OWN, NOT A GENEROUS SQUARE ROUND IT. Every
     pixel reserved here is a pixel the names cannot use, and the Marib
     objectives sit close enough together that a 15% margin on each of nine
     squares cost two required names their place (measured 2026-09-19). So each
     shape is measured as dossier_map_routes.js draws it: a summit triangle
     reaches 1.15r above its point and 0.8r below, a square and a diamond r each
     way, a dot r - plus the halo lift each of them is painted with. */
  var LIFT = 2;
  var TALL = { heights: [1.15, 0.8, 1.1] };   /* up, down, sideways, in r */

  /* `mark: true` travels with the rectangle, because `taken` is one list and
     the two things that read it want different answers: a BOX may not be
     placed on a mark, and a LEADER may cross one - a line over a dot is
     nothing, a line over a word is rule 4 of MAP_RULES.md. The leader tests
     filter the list through `DossierMapExtra.kit.words()`. */
  function markBox(x, y, r, u, kind) {
    var s = TALL[kind] || [1, 1, 1], lift = Math.max(1.5, LIFT * u);
    return { mark: true,
             x0: x - r * s[2] - lift, y0: y - r * s[0] - lift,
             x1: x + r * s[2] + lift, y1: y + r * s[1] + lift };
  }
  /* A DIAMOND IS RESERVED AS THE RHOMBUS IT IS, in two rectangles - a tall
     narrow one and a wide flat one, each half the width of the bounding box on
     its short axis. Their union covers every point of |dx| + |dy| <= r and
     leaves the four CORNERS free, which is where a name anchored ne/nw/se/sw
     sits. Measured 2026-09-19: the diamond's radius is floored at 11px
     (dossier_map_legend.js MARK_MIN), so on a 390px phone one front's
     bounding square takes 25x25 of a 340px map, five of them ring the Marib
     cluster, and the square claimed half again the ground the red shape
     really covers - enough to leave the required name מארב nowhere to stand.
     Nothing about what the names must clear has been relaxed: the ink under
     the rhombus is reserved exactly as before. */
  function diamondBoxes(x, y, r, u) {
    var lift = Math.max(1.5, LIFT * u), a = r + lift, h = a / 2;
    return [{ mark: true, x0: x - h, y0: y - a, x1: x + h, y1: y + a },
            { mark: true, x0: x - a, y0: y - h, x1: x + a, y1: y + h }];
  }
  function quiet(l) { return l.kind === "country" || l.anchor === "c"; }
  /* The same test dossier_map_zone_names.js paints a mark on, so a reservation
     cannot be made for a mark that never appears or missed for one that does. */
  function marked(l, o, p) {
    if (!p.inside(l.lon, l.lat, 0) || quiet(l) || l.pin === false) return false;
    return !!l.req || !((o.W < 700 || o.notesOn) && l.tier === 2);
  }
  function markSize(R, l, o, u) {
    var r = R.markClear(o.pinR, l.kind);
    return o.gainKeys[l.place] ? Math.max(r, 7 * u) : r;
  }
  /* The centre of a front's biggest ring, in canvas pixels - the point
     dossier_map_legend.js draws the diamond at, computed the same way (the
     average of the ring's own vertices), so the rectangle reserved here is the
     ground the diamond really takes. */
  function frontCentre(p, geom) {
    var g = geom || {};
    var polys = g.type === "Polygon" ? [g.coordinates]
      : g.type === "MultiPolygon" ? g.coordinates : [];
    var best = null, area = 0;
    polys.forEach(function (poly) {
      var ring = poly[0], sx = 0, sy = 0, a = 0, i;
      for (i = 0; i < ring.length - 1; i++) {
        var q = p(ring[i][0], ring[i][1]), n = p(ring[i + 1][0], ring[i + 1][1]);
        a += q[0] * n[1] - n[0] * q[1];
        sx += q[0]; sy += q[1];
      }
      a = Math.abs(a) / 2;
      if (a > area && i) { area = a; best = [sx / i, sy / i]; }
    });
    return best;
  }
  /* Opens the picture's report as well: placeLabels is the one call every map
     paint makes before a single name is placed. `o.markOf` / `o.markBox` come
     back as two parallel lists and nothing is written onto the record - DOSSIER
     is the same object at every paint, and a rectangle left on a label would
     outlive the canvas it was measured for. */
  /* WHICH MARKS OWE A NUMBER. A LIST picture (`key: "panel"`) joins each mark
     to its row by the digit alone since the connector lines came off, so every
     place that owns a row must carry its disc against the mark. A callouts
     picture draws an ARROW from the sentence to the place, which is its own
     join, so it is not held to this. */
  function rowsOf(map) {
    var out = {};
    if (!map || map.key !== "panel") return out;
    (map.notes || []).forEach(function (n) { out[n.place] = true; });
    return out;
  }

  function reserve(p, R, u, map, o) {
    var G = (typeof GEO !== "undefined" && GEO) ? GEO : null;
    var rows = rowsOf(map);
    begin();
    /* The fighting zones' diamonds, on every map that draws them - a clean map
       draws none, which is why the flag is read and not guessed at. AND A MAP
       SAYING `fronts: false` DRAWS NONE EITHER (2026-09-22): the flag reached
       the ground painter and the belt painter when it arrived, and not this
       reservation, so `west_plain` - the same frame WITHOUT the fighting belts
       - was still walking its names round twelve diamonds nobody can see. It
       cost that picture four region names and the Marib capital's dot on the
       16:9 export. Same one token as the other two files read. */
    if (G && G.fronts && !map.clean && map.fronts !== false) {
      var dr = window.DossierMapLegend ? DossierMapLegend.markR(u) : 11 * u;
      R.eachFeature(G.fronts, function (f) {
        var c = frontCentre(p, f.geometry || {});
        if (!c) return;
        var tag = "diamond " + ((f.properties || {}).id || "?");
        diamondBoxes(c[0], c[1], dr, u).forEach(function (b) {
          o.taken.push(b);
          mark(b, tag);
        });
      });
    }
    (map.labels || []).forEach(function (l) {
      if (!marked(l, o, p)) return;
      var q = p(l.lon, l.lat);
      var b = markBox(q[0], q[1], markSize(R, l, o, u), u, l.kind);
      var tag = (l.kind || "town") + " " + (l.place || l.he);
      o.markOf.push(l); o.markBox.push(b);
      o.taken.push(b);
      mark(b, tag);
      /* A LABEL'S OWN MARK, kept apart from the diamonds and the badges: it is
         the only kind of mark a reader expects a word beside, and `audit` will
         ask of each one whether anything on the finished picture said what it
         is. `drawn` stays false until the mark is really painted. */
      owned.push({ box: b, tag: tag, drawn: false, named: false,
                   disc: false, needsDisc: !!rows[l.place] });
    });
    /* AND THE GROUND EACH NUMBER IS OWED, for the same reason and in the same
       breath (2026-09-19). On a list picture the digit is the only thing
       joining a square to its row, so a disc-sized rectangle beside every
       numbered mark is claimed before a word is measured - one floor-sized
       square each, on the side away from the name's own anchor. The rule and
       what was measured without it are in dossier_map_spot.js, `slots`. */
    if (window.DossierMapSpot && DossierMapSpot.slots) {
      DossierMapSpot.slots(p, R, u, map, o);
    }
  }

  function report() {
    return { marks: marks.length, words: words.length, kinds: kinds,
             owned: owned.map(function (o) {
               return { tag: o.tag, drawn: o.drawn, named: o.named,
                        disc: o.disc, needsDisc: o.needsDisc };
             }),
             tags: { marks: marks.map(function (m) { return m.tag; }),
                     words: words.map(function (w) { return w.tag; }) } };
  }

  return { begin: begin, reserve: reserve, mark: mark, word: word,
           covered: covered, report: report, adjacent: adjacent,
           painted: painted, numbered: numbered, pending: pending,
           audit: audit };
})();

window.DossierMapInk = DossierMapInk;
