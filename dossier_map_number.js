/* THE NUMBER ON THE MAP: a numbered disc glued to the place name it belongs
   to, and the list those numbers are read off.

   Split out of dossier_map_key.js on 2026-09-18, when that file reached its
   500-line cap. The seam is a real one and not only a size one: BOTH answers to
   a map's notes need this. `key: "panel"` paints these discs beside a panel of
   sentences; `key: "callouts"` paints them inside its boxes, and on a PHONE it
   paints nothing but these discs while the sentences move to an HTML list under
   the picture. One disc, one numbering, one glue rule, whichever picture is
   being drawn - two copies would drift on the first change to either.

   THE NUMBER AND ITS NAME ARE ONE UNIT. Ziv, 2026-09-18, of both Marib
   pictures: *"make sure in the map that the name is next to the number and it
   makes sense... and make sure it's not one on top of another."* The discs used
   to be placed round the PLACE, never round its NAME. Measured on the wide
   picture before: 6 sat 110px above אל-כנאיס with אל-לבנאת's number nearer to
   it, 8 sat 180px west of צחן אל-ג'ן with תדיון's name between them, 9 sat
   200px from צאפר beside a front's name, and 4 and 5 sat side by side between
   the two names they belonged to. Box overlaps were ZERO throughout: nothing
   was printed on anything, and the reading was a guess anyway.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapNumber =
       { disc, discR, discs, listFor, audit, report }

   The self-check that reads these reports is `DossierMapNotes.check`.
*/
"use strict";

var DossierMapNumber = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_number: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }
  /* The shared callout SEARCH and its box helpers, the leader included. */
  function kit() {
    var X = window.DossierMapExtra;
    if (!X || !X.kit) {
      throw new Error("dossier_map_number: dossier_map_extra.js is not on the page");
    }
    return X.kit;
  }

  /* The disc, written for BASE_W and floored like every other mark here: a
     number that shrinks with the canvas stops being readable, and this one has
     to be matched to a row in the panel by eye. */
  var DISC_R = 12, DISC_MIN = 10;
  var LABEL_GAP = 18, LABEL_GAP_MIN = 12, AXIS = 0.6, GLUE = 4;
  var DISCS = null, AUDIT = null;

  /* ---- what the page is told ------------------------------------------------ */

  /* `data-notes` ON THE CANVAS, the one thing the HTML under the picture keys
     off (2026-09-18, round 3). "painted" means the words are on the picture -
     the side panel or the callout boxes; "list" means only the numbers are, and
     the page must print the words under it. The painters decide by measuring
     what they were about to paint, so the page can never disagree with the
     picture the way a width in a media query could.
     AN EXPORT SETS NOTHING: a canvas with no CSS size of its own was made by
     `DossierMap.exportPng` for a download, is never in the document, and has no
     HTML under it to switch. */
  function mark(ctx, how) {
    var c = ctx && ctx.canvas;
    if (!c || !c.style || !c.style.width || !c.setAttribute) return;
    c.setAttribute("data-notes", how);
  }

  /* ---- the numbered disc --------------------------------------------------- */

  /* BLACK ON WHITE, and the only mark on this board that carries a digit: the
     ink on a white disc with an ink ring, so it reads over the terrain, over
     either side's territory and over the sea without adding a hue - every hue
     here is spoken for by a front, a zone or a route. */
  function disc(ctx, P, x, y, r, n, u) {
    var R = D(), str = String(n);
    ctx.beginPath(); ctx.arc(x, y, r + Math.max(1.5, 1.5 * u), 0, Math.PI * 2);
    R.paintShape(ctx, { fill: P.halo });
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    R.paintShape(ctx, { fill: "#FFFFFF", stroke: P.ink,
      width: Math.max(1.2, 1.4 * u) });
    R.text(ctx, P, str, x, y + r * 0.04, { size: r * 1.35, weight: 700, halo: 0,
      color: P.ink });
  }
  function discR(u, ts, n) {
    var r = Math.max(DISC_MIN, DISC_R * u * ts);
    return n >= 10 ? r * 1.18 : r;
  }
  function boxAt(x, y, r) {
    return { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
  }
  /* How far a number ended from its own name - the gap the self-check reads. */
  function gapOf(a, b) {
    var dx = Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1));
    var dy = Math.max(0, Math.max(a.y0 - b.y1, b.y0 - a.y1));
    return Math.hypot(dx, dy);
  }
  function grow(b, m) {
    return { x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m };
  }
  /* DOES A LEADER TOUCH A RECTANGLE? Liang-Barsky, the box pulled in a pixel so
     a line that merely leaves its own edge is not read as crossing it. It lives
     in this file rather than in the callouts' because BOTH leaders need it and
     this is the lower of the two - dossier_map_notes.js calls it here. */
  function segBox(g, b) {
    var x = g[0], y = g[1], dx = g[2] - x, dy = g[3] - y, t0 = 0, t1 = 1, i, q, r, t;
    var e = [[-dx, x - b.x0 - 1], [dx, b.x1 - 1 - x],
             [-dy, y - b.y0 - 1], [dy, b.y1 - 1 - y]];
    for (i = 0; i < 4; i++) {
      q = e[i][0]; r = e[i][1];
      if (q === 0) { if (r < 0) return false; continue; }
      t = r / q;
      if (q < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  }
  /* The hairline between two rectangles, edge to edge, in the shared kit's own
     halo-under-ink stroke - the callouts' leader, over a shorter distance. */
  /* AND IT PASSES BEHIND EVERY OTHER NAME, never through one (2026-09-18).
     צאפר's 9 is joined across ground that תדוין's name sits in, and a hairline
     drawn over that name is the "one on top of another" this whole pass is
     about. The placement is not touched - the line is CLIPPED out of every
     foreign name box, so where it meets one it runs behind the text. */
  function leadTo(ctx, P, u, a, b, holes, W, H) {
    var K = kit();
    var g = K.leaderSeg(a, { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 });
    var h = K.leaderSeg(b, { cx: g[0], cy: g[1] }), seg = [g[0], g[1], h[0], h[1]];
    if (K.segLen(seg) < 2 * u) return null;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    (holes || []).forEach(function (o) {
      ctx.rect(o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0);
    });
    ctx.clip("evenodd");
    K.leader(ctx, P, u, seg);
    ctx.restore();
    return seg;
  }
  /* THE LAST-RESORT SEARCH IS THE SHARED ONE. This used to be a ring search of
     its own - eight directions, six rings, fewest overlaps wins - and it placed
     EVERY disc, which is the fault in the head of this file. What is left for it
     is the rare case, so it is `DossierMapExtra.kit`'s own findSpot, scored on
     distance and never returning nothing: a disc is NEVER DROPPED, a row in the
     panel with no number on the map being a row about nothing. */
  function nearSpot(box, cx, cy, r, u, bars, cross, W, H) {
    var f = kit().findSpot({ x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1,
      cx: cx, cy: cy }, "n", 2 * r, 2 * r, u, bars, cross || [], [], [], W, H);
    return { x: (f.x0 + f.x1) / 2, y: (f.y0 + f.y1) / 2, box: f };
  }

  /* ---- where the map painted this place's name ------------------------------ */

  /* FOUND, never recomputed. The label loop in dossier_map.js pushes every
     name's box into `taken` before this painter runs, and `place()` in
     dossier_map_draw.js anchors a box so its centre sits EXACTLY on its point's
     own axis - x for a name above or below the mark, y for one beside it - a
     short gap out from the mark. So the name's box is the one box in `taken`
     centred on this place's axis and within a mark's width of it, and not one
     sizing constant of the label's has to be copied here, which is what would
     have gone stale. Nothing matches when the map DROPPED the name; the caller
     falls back to the ring search. The gap it returns is the mark's own
     clearance plus 5u, which is where the mark's radius comes from below. */
  function nameBoxOf(taken, q, u) {
    var lim = Math.max(LABEL_GAP_MIN, LABEL_GAP * u), best = null;
    taken.forEach(function (t) {
      var cx = (t.x0 + t.x1) / 2, cy = (t.y0 + t.y1) / 2, gap = -1, side = "";
      if (Math.abs(cy - q[1]) <= AXIS) {
        if (t.x0 > q[0]) { gap = t.x0 - q[0]; side = "e"; }
        else if (t.x1 < q[0]) { gap = q[0] - t.x1; side = "w"; }
      } else if (Math.abs(cx - q[0]) <= AXIS) {
        if (t.y0 > q[1]) { gap = t.y0 - q[1]; side = "s"; }
        else if (t.y1 < q[1]) { gap = q[1] - t.y1; side = "n"; }
      }
      if (side && gap >= 0 && gap <= lim && (!best || gap < best.gap)) {
        best = { box: t, side: side, gap: gap };
      }
    });
    return best;
  }
  function markBox(q, gap, u) {
    return boxAt(q[0], q[1], Math.max(1, gap - 5 * u));
  }

  /* The four sides of the name, THE RTL READING SIDE FIRST: in the panel the
     number opens the row and the name follows it leftwards, so on the map the
     number goes to the name's RIGHT and the pair reads the same way in both
     halves of one picture. The place's own mark is in `bars`, so a name
     anchored WEST of its mark - where the right side IS the mark - takes the
     left side by measurement, not by a rule about anchors. THE CORNERS COUNT AS
     GLUED and are tried after the four sides: a disc touching the name's corner
     still reads as part of it. */
  var GLUE_SIDES = ["e", "w", "n", "s", "ne", "se", "nw", "sw"];

  function gluePair(b, r, u, bars, foreign, W, H) {
    var g = GLUE * u, mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2, out = null;
    GLUE_SIDES.some(function (side) {
      var x = side.indexOf("e") >= 0 ? b.x1 + g + r
            : side.indexOf("w") >= 0 ? b.x0 - g - r : mx;
      var y = side.indexOf("n") >= 0 ? b.y0 - g - r
            : side.indexOf("s") >= 0 ? b.y1 + g + r : my;
      var box = boxAt(x, y, r), own = gapOf(box, b);
      if (box.x0 < 0 || box.x1 > W || box.y0 < 0 || box.y1 > H) return false;
      if (bars.some(function (t) { return D().overlaps(box, t); })) return false;
      /* AND ITS OWN NAME MUST BE THE NEAREST NAME. A number touching one name
         and resting against another reads as the other's - which is how צאפר's
         9 came to sit 2px off אל-ת'ניה, the very fault this pass is about. */
      if (foreign.some(function (o) { return gapOf(box, o) <= own; })) return false;
      out = { x: x, y: y, box: box, side: side, glued: true, gap: own };
      return true;
    });
    return out;
  }
  /* How boxed-in a name is, three disc-widths out. THE CROWDED NAMES GO FIRST,
     for the measured reason the fighting callouts place the edge belts first:
     whoever goes last takes what is left, and five of the nine Marib names sit
     inside 200px of each other. */
  function crowd(box, bars, r) {
    var room = grow(box, 3 * r);
    return bars.filter(function (t) { return D().overlaps(room, t); }).length;
  }

  /* ---- the discs ------------------------------------------------------------ */

  /* One disc beside every note's NAME, numbered in `notes[]` order - the order
     the panel and the HTML list print, so the three cannot disagree however any
     of them is laid out. What landed is kept for the console and for the
     self-check, never for the page. */
  function discs(ctx, p, P, u, ts, map, taken, W, H) {
    var list = (map && map.notes) || [];
    var bars = taken.slice(), out = [], over = 0, leads = [];
    /* MEASURED BEFORE A SINGLE DISC IS PLACED, and that is not a tidiness
       point: `nameBoxOf` finds a name by its exact axis alignment with the
       point, and a disc GLUED to a name is aligned with it too - run afterwards,
       the audit would take the disc for the name it sits beside. It also hands
       the loop below every label box on the map, so a hairline can be clipped
       behind names that are nobody's note. */
    var marks = audit(p, u, map, taken);
    var seats = list.map(function (n, i) {
      var ok = typeof n.lon === "number" && typeof n.lat === "number" &&
        p.inside(n.lon, n.lat, 0);
      var q = ok ? p(n.lon, n.lat) : null, r = discR(u, ts, i + 1);
      var nb = q ? nameBoxOf(taken, q, u) : null;
      return { n: i + 1, note: n, q: q, r: r, nb: nb,
               box: q ? (nb ? nb.box : boxAt(q[0], q[1], r)) : null };
    }).filter(function (s) { return !!s.q; });
    /* EVERY NOTE'S OWN MARK IS GROUND A NUMBER MAY NOT TAKE: the square says
       which pixel the name belongs to, and a disc on it hides what the pair
       points at. */
    seats.forEach(function (s) {
      if (s.nb) bars.push(markBox(s.q, s.nb.gap, u));
    });
    var names = seats.filter(function (s) { return !!s.nb; }).map(function (s) {
      return { place: s.note.place, box: s.nb.box };
    });
    seats.slice().sort(function (a, b) {
      return crowd(b.box, bars, b.r) - crowd(a.box, bars, a.r);
    }).forEach(function (s) {
      var b = s.box, others = names.filter(function (o) { return o.box !== b; });
      var foreign = others.map(function (o) { return o.box; });
      var spot = s.nb ? gluePair(b, s.r, u, bars, foreign, W, H) : null;
      /* Every side of the name taken, or the map dropped the name: the shared
         search, seeded on the NAME's own box where there is one, so the number
         still lands as near it as the canvas allows. The search takes no
         predicate, so the same "not beside somebody else's name" rule reaches
         it as BARS - every foreign name grown by a disc. */
      if (!spot) {
        spot = nearSpot(b, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, s.r, u,
          bars.concat(foreign.map(function (o) { return grow(o, s.r); })),
          foreign, W, H);
        spot.side = ""; spot.glued = false;
        spot.gap = s.nb ? gapOf(spot.box, b) : -1;
      }
      /* A NUMBER THE CANVAS WOULD NOT LET TOUCH ITS NAME IS TIED TO IT BY A
         LINE, and that is the whole difference between a number beside a name
         and a number loose on a map. צאפר's name has תדוין, צחן אל-ג'ן, מארב
         and a front's hatch inside a disc's width of it on every side, so its 9
         cannot be glued at any canvas size; joined by a hairline it still reads
         as צאפר's. Drawn before the disc, so the disc covers its own end. */
      var holes = marks.labels.map(function (l) { return l.box; })
        .filter(function (o) { return o !== b; });
      var seg = !spot.glued && s.nb
        ? leadTo(ctx, P, u, spot.box, b, holes, W, H) : null;
      if (seg) {
        leads.push({ n: s.n, seg: seg, behind: marks.labels.filter(function (l) {
          return l.box !== b && segBox(seg, l.box);
        }).map(function (l) { return l.place; }) });
      }
      disc(ctx, P, spot.x, spot.y, s.r, s.n, u);
      bars.push(spot.box); taken.push(spot.box);
      out.push({ n: s.n, place: s.note.place, box: spot.box, side: spot.side,
                 glued: !!spot.glued, led: !!seg, gap: Math.round(spot.gap),
                 name: s.nb ? b : null });
    });
    out.sort(function (a, b) { return a.n - b.n; });
    out.forEach(function (a, i) {
      out.forEach(function (b, k) {
        if (k > i && D().overlaps(a.box, b.box)) over++;
      });
    });
    /* THE NUMBERS ALONE ARE THE "LIST" CASE. The panel paints after this and
       says "painted" when it lands; the callouts painter calls this only when
       it has already decided not to draw its boxes. So "list" is the standing
       answer and "painted" is the exception, which is the safe way round: a
       picture whose words failed to paint shows them under it. */
    mark(ctx, "list");
    DISCS = { placed: out.length, of: list.length, overlaps: over, leads: leads,
              glued: out.filter(function (e) { return e.glued; }).length,
              area: { w: W, h: H }, list: out };
    return DISCS;
  }

  /* ---- what the picture may be checked against ------------------------------ */

  /* EVERY LABEL'S NAME BOX AND ITS OWN MARK, found the same way a note's is, so
     the self-check can ask the two questions no painter here owns: does a mark
     print over somebody else's NAME, and does a leader cross one. Both are
     faults of the map's own label placement rather than of this file, so this
     only MEASURES them - the fix is an authored `anchor` on the label. Added
     2026-09-18 after the objective square at צחן אל-ג'ן was found printing
     through the name beside it and nothing in the check had looked. */
  function audit(p, u, map, taken) {
    var seen = [], hits = [];
    ((map && map.labels) || []).forEach(function (l) {
      if (typeof l.lon !== "number" || typeof l.lat !== "number") return;
      if (!p.inside(l.lon, l.lat, 0) || l.pin === false) return;
      var q = p(l.lon, l.lat), nb = nameBoxOf(taken, q, u);
      if (nb) seen.push({ place: l.place, box: nb.box, side: nb.side,
                          mark: markBox(q, nb.gap, u) });
    });
    seen.forEach(function (a) {
      seen.forEach(function (b) {
        if (a !== b && D().overlaps(a.mark, b.box)) {
          hits.push(a.place + " mark over " + b.place + " name");
        }
      });
    });
    AUDIT = { labels: seen, hits: hits };
    return AUDIT;
  }

  /* THE SAME NUMBERS AS WORDS, for the HTML list a phone shows under the
     picture in place of the panel or the boxes (docs\maps_tab.js). In painted
     order, and `note_he` is ALWAYS the full note - `short_he` exists only
     because the on-map box has terrain under it, and a list under the picture
     does not. */
  function listFor(map) {
    return ((map && map.notes) || []).map(function (n, i) {
      var hit = ((map && map.labels) || []).filter(function (l) {
        return l.place === n.place;
      })[0];
      return { n: i + 1, name_he: (hit && hit.he) || n.he || n.name_he || "",
               note_he: n.note_he || "" };
    });
  }

  return { disc: disc, discR: discR, discs: discs, listFor: listFor,
           audit: audit, segBox: segBox, mark: mark,
           report: function () { return { discs: DISCS, audit: AUDIT }; } };
})();

window.DossierMapNumber = DossierMapNumber;
