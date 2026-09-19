/* THE NUMBER ON THE MAP: a numbered disc glued to the place name it belongs
   to, and the list those numbers are read off.

   Split out of dossier_map_key.js on 2026-09-18 at that file's 500-line cap.
   The seam is real and not only a size one: BOTH answers to a map's notes need
   this. `key: "panel"` paints these discs beside a panel of sentences;
   `key: "callouts"` paints them inside its boxes, and on a PHONE it paints
   nothing but these while the sentences move to a list under the picture. One
   disc, one numbering, one glue rule, whichever picture is drawn.

   THE NUMBER AND ITS NAME ARE ONE UNIT. Ziv, 2026-09-18, of both Marib
   pictures: *"make sure in the map that the name is next to the number and it
   makes sense... and make sure it's not one on top of another."* The discs used
   to be placed round the PLACE, never round its NAME: 6 sat 110px above
   אל-כנאיס with אל-לבנאת's number nearer it, 8 sat 180px west of צחן אל-ג'ן
   with תדיון's name between them, 9 sat 200px from צאפר beside a front's name.
   Box overlaps were ZERO throughout: the reading was a guess anyway.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapNumber = { disc, discR, discs, listFor, audit, report }

   The self-check that reads these reports is `DossierMapNotes.check`. */
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
     off (2026-09-18, round 3). "painted" means the words are on the picture;
     "list" means only the numbers are and the page must print the words under
     it. The painters decide by measuring what they were about to paint, so the
     page cannot disagree the way a media query could. AN EXPORT SETS NOTHING: a
     canvas with no CSS size of its own was made by `DossierMap.exportPng`, is
     never in the document and has no HTML under it. */
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
  /* The hairline from a number to its own name, edge to edge, in the shared
     halo-under-ink stroke - the callouts' leader over a shorter distance.
     IT GOES ROUND EVERY OTHER WORD, and until 2026-09-18 it went BEHIND them.
     צאפר's 9 is joined across ground תדוין's name sits in, and the first answer
     clipped the hairline out of every foreign name box so it passed behind the
     text. Ziv, the same day: *"you have lines that are on actual text, so that
     is not good... make sure that you don't cut anything off."* A clipped line
     is one broken in two that still had nowhere to go. So the route is
     DossierMapLeader's - straight, or ONE BEND round the words - and it keeps
     off the WHOLE registry, region and front names included.
     A route that cannot be found at all still gets its straight line, and the
     fault is counted and named: this hairline says whose number that is, and an
     unexplained number loose on a picture hides more than a line over a word.
     The opposite call from the panel's own connectors (dossier_map_link.js),
     where the row is numbered anyway. */
  function leadTo(ctx, P, u, a, b, avoid, mapId, n, leaders) {
    var LD = window.DossierMapLeader;
    var s = { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 };
    if (!LD) {
      console.error("dossier_map_number: dossier_map_leader.js is not on the" +
        " page - number " + n + " is not joined to its name");
      return null;
    }
    var rt = LD.best(a, s, avoid, leaders || []);
    if (!rt) {
      rt = LD.straight(a, s);
      LD.fault(mapId, "number " + n + " to its name",
               LD.overText(rt, avoid, a, s), 0);
    }
    if (LD.lengthOf(rt.pts) < 2 * u) return null;
    LD.paint(ctx, P, u, rt);
    return rt;
  }
  /* THE LAST-RESORT SEARCH IS THE SHARED ONE - `DossierMapExtra.kit`'s
     findSpot, scored on distance and never returning nothing, so a disc is
     NEVER DROPPED (a panel row with no number is a row about nothing). Its own
     ring search placed EVERY disc, the fault in the head of this file. */
  function nearSpot(box, cx, cy, r, u, bars, cross, W, H) {
    var f = kit().findSpot({ x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1,
      cx: cx, cy: cy }, "n", 2 * r, 2 * r, u, bars, cross || [], [], [], W, H);
    return { x: (f.x0 + f.x1) / 2, y: (f.y0 + f.y1) / 2, box: f };
  }

  /* ---- where the map painted this place's name ------------------------------ */
  /* FOUND, never recomputed. The label loop pushes every name's box into
     `taken` before this painter runs, and `place()` in dossier_map_draw.js
     anchors a box so its centre sits EXACTLY on its point's own axis - x above
     or below the mark, y beside it - a short gap out. So the name's box is the
     one box in `taken` centred on this place's axis and within a mark's width
     of it, and no sizing constant of the label's is copied here to go stale.
     Nothing matches when the map DROPPED the name; the caller falls back to the
     ring search. The gap returned is the mark's clearance plus 5u. */
  function nameBoxOf(taken, q, u) {
    var lim = Math.max(LABEL_GAP_MIN, LABEL_GAP * u), best = null;
    taken.forEach(function (t) {
      var cx = (t.x0 + t.x1) / 2, cy = (t.y0 + t.y1) / 2, gap = -1, side = "";
      /* A CONNECTOR'S RESERVED LANE IS NOT A NAME, AND NEITHER IS A MARK. Both
         sit in `taken` so the words move off them, and both carry the signature
         this looks for - a lane leaving THIS mark is axis-aligned with it a
         short gap out, a NEIGHBOUR'S mark rectangle (reserved by
         dossier_map_ink.js, 2026-09-19) is a small box on the same axis a few
         pixels away - which is how a number got glued to somebody else's dot. */
      if (t.lane || t.mark) return;
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
     number opens the row and the name follows leftwards, so on the map the
     number goes to the name's RIGHT and the pair reads the same way in both
     halves of one picture. The place's own mark is in `bars`, so a name
     anchored WEST of its mark takes the left side by measurement and not by a
     rule about anchors. THE CORNERS COUNT AS GLUED and are tried after the four
     sides: a disc touching the name's corner still reads as part of it. */
  var GLUE_SIDES = ["e", "w", "n", "s", "ne", "se", "nw", "sw"];
  /* AND THE OTHER WAY ROUND WHERE A CONNECTOR LEAVES THE MARK EASTWARD
     (2026-09-19). A disc standing in for a name is glued to the MARK, and the
     mark's own lane runs east out of it - "east first" put al-Thaniyah's 5 on
     its own line. West first, and number and line leave opposite ways. */
  var AWAY_SIDES = ["w", "nw", "sw", "n", "s", "ne", "se", "e"];

  function gluePair(b, r, u, bars, foreign, W, H, order) {
    var g = GLUE * u, mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2, out = null;
    (order || GLUE_SIDES).some(function (side) {
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
  /* IS THIS THE NEAREST MARK? The question a reader answers by eye when a disc
     is not touching a name, and the one the old "nearest NAME" test never
     asked. `others` is every other note's own point. */
  function ownMark(c, q, others) {
    var own = Math.hypot(c[0] - q[0], c[1] - q[1]);
    return !others.some(function (o) {
      return Math.hypot(c[0] - o[0], c[1] - o[1]) <= own;
    });
  }
  /* A ring search round the place's OWN point that never strays nearer to
     another note's mark than to this one - the displaced disc's placement on
     the square picture, where its hairline is all that says whose it is. */
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
  /* How boxed-in a name is, three disc-widths out. THE CROWDED NAMES GO FIRST,
     the measured reason the fighting callouts place the edge belts first:
     whoever goes last takes what is left, and five of the nine Marib names sit
     inside 200px of each other. */
  function crowd(box, bars, r) {
    var room = grow(box, 3 * r);
    return bars.filter(function (t) { return D().overlaps(room, t); }).length;
  }

  /* ---- the discs ------------------------------------------------------------ */

  /* One disc beside every note's NAME, numbered in `notes[]` order - what the
     panel and the list print, so the three cannot disagree. */
  /* `linked` says this picture also draws a CONNECTOR from every mark to its
     row (dossier_map_fan.js, the wide key panel), and two rules change with it,
     both from looking at the pictures on 2026-09-19.

     A DISC THAT CANNOT BE GLUED TO ITS OWN NAME IS NOT DRAWN. On the wide Marib
     picture 7 sat against the Safir square - Safir is row 8 - so the one thing
     the disc exists to say was said wrongly. The connector already runs from
     the mark to the numbered row, so a displaced disc can only mislead; an
     unglued one is left off and counted in `hidden`.
     WITHOUT A CONNECTOR - the square download and the phone - a displaced disc
     keeps its hairline, the only thing then saying whose number it is. Unled,
     it must land NEARER ITS OWN MARK than any other, and `disc_wrong_mark`
     counts every one that does not; the old rule measured against other NAMES,
     a different question that passed the Safir case. */
  /* THE MARK'S OWN CLEARANCE, read off the table the map drew it with
     (dossier_map_routes.js), so a disc glued to a mark starts exactly clear of
     the square, triangle or dot. Its own reserved ink is no obstacle to such a
     disc (notMine): that box is a pixel or two wider than the clearance, and on
     a phone canvas it swallowed every side a disc could take. */
  function markClearOf(pinR, place, map) {
    var R = window.DossierMapRoutes;
    var hit = ((map && map.labels) || []).filter(function (l) {
      return l.place === place;
    })[0];
    return R && R.markClear ? R.markClear(pinR, hit && hit.kind) : (pinR || 3);
  }
  /* A CONNECTOR'S LANE COMES OUT WITH IT, AND ONLY WHERE THERE ARE NO
     CONNECTORS (2026-09-19). On the square download and the phone there is no
     fan at all, so the filter costs nothing and buys the disc the sides a
     phone canvas has. On the WIDE picture it is a fault: the Marib lanes run
     18-43px apart through that cluster and a disc is 72 across, so wherever it
     is forced in it lies on a lane and `settle` has nowhere clean to move
     that lane to - measured every side, 1 to 4 crossings. There the connector
     itself names the mark (dossier_map_fan.js) and an unglued disc is left
     off. Hence `linked` at the call site. */
  function notMine(bars, q) {
    return bars.filter(function (t) {
      return !t.lane &&
        !(t.mark && q[0] >= t.x0 && q[0] <= t.x1 &&
          q[1] >= t.y0 && q[1] <= t.y1);
    });
  }

  /* `numbersOnly` is the PHONE case (2026-09-19): a key-panel map too narrow
     for its panel paints no objective NAMES - the HTML list below carries them,
     numbered the same way - so a disc is glued to its own MARK instead. Only
     where two marks sit too close for that does it stand off with a hairline,
     and never nearer another note's mark than its own. MAPS_TAB.md. */
  function discs(ctx, p, P, u, ts, map, taken, W, H, linked, pinR, numbersOnly) {
    var list = (map && map.notes) || [];
    var bars = taken.slice(), out = [], over = 0, leads = [], hidden = 0;
    /* MEASURED BEFORE A SINGLE DISC IS PLACED, and not for tidiness: `nameBoxOf`
       finds a name by its exact axis alignment with the point, and a disc GLUED
       to a name is aligned with it too - run afterwards, the audit would take
       the disc for the name beside it. It also hands the loop below every label
       box, so a hairline can be clipped behind names that are nobody's note. */
    var marks = audit(p, u, map, taken);
    var seats = list.map(function (n, i) {
      var ok = typeof n.lon === "number" && typeof n.lat === "number" &&
        p.inside(n.lon, n.lat, 0);
      var q = ok ? p(n.lon, n.lat) : null, r = discR(u, ts, i + 1);
      var nb = q ? nameBoxOf(taken, q, u) : null;
      var own = (q && numbersOnly && numbersOnly[n.place])
        ? boxAt(q[0], q[1], markClearOf(pinR, n.place, map)) : null;
      return { n: i + 1, note: n, q: q, r: r, nb: nb, own: own,
               box: q ? (nb ? nb.box : (own || boxAt(q[0], q[1], r))) : null };
    }).filter(function (s) { return !!s.q; });
    /* EVERY NOTE'S OWN MARK IS GROUND A NUMBER MAY NOT TAKE: the square says
       which pixel the name belongs to, and a disc on it hides what the pair
       points at. */
    seats.forEach(function (s) {
      if (!s.nb) return;
      s.mark = markBox(s.q, s.nb.gap, u);
      bars.push(s.mark);
    });
    var names = seats.filter(function (s) { return !!s.nb; }).map(function (s) {
      return { place: s.note.place, box: s.nb.box };
    });
    seats.slice().sort(function (a, b) {
      return crowd(b.box, bars, b.r) - crowd(a.box, bars, a.r);
    }).forEach(function (s) {
      var b = s.box, others = names.filter(function (o) { return o.box !== b; });
      var foreign = others.map(function (o) { return o.box; });
      var kin = seats.filter(function (o) { return o !== s; })
        .map(function (o) { return o.q; });
      /* GLUED TO ITS NAME WHERE THERE IS ONE, AND TO ITS MARK WHERE THERE IS
         NOT. On the phone picture the other notes' MARKS are what a stray disc
         would be read as belonging to, so they are what it must stay further
         from than its own - the same test `gluePair` runs against names. */
      if (s.own) {
        foreign = seats.filter(function (o) { return o !== s && o.own; })
          .map(function (o) { return o.own; });
      }
      var spot = (s.nb || s.own)
        ? gluePair(b, s.r, u, s.own && !linked ? notMine(bars, s.q) : bars,
                   foreign, W, H, s.own && linked ? AWAY_SIDES : null)
        : null;
      /* NEARER ITS OWN MARK THAN ANY OTHER, OR TIED TO IT BY A HAIRLINE - the
         second is the stronger, which is why it excuses the first (2026-09-19).
         At 340 CSS px the Marib cluster puts Marib, Sahn al-Jinn and Tadween
         inside four pixels of one another, so the ground nearer Sahn al-Jinn
         than either neighbour is a two-pixel band no disc of any size fits in:
         "nearest wins" there is not strict, it is unsatisfiable. A line that
         ENDS ON the square says whose number it is exactly, where nearness only
         guesses. So a stray disc is a fault only when it has no line. */
      var stray = false;
      /* NOT GLUED AND A CONNECTOR IS COMING: the disc is left off the picture
         altogether. See the head of `discs`. */
      if (!spot && linked) { hidden++; return; }
      /* Every side of the name taken, or the map dropped the name: the shared
         search, seeded on the NAME's own box where there is one, so the number
         still lands as near it as the canvas allows. The search takes no
         predicate, so the same "not beside somebody else's name" rule reaches
         it as BARS - every foreign name grown by a disc. */
      if (!spot) {
        var wall = bars.concat(foreign.map(function (o) { return grow(o, s.r); }));
        /* THE OWN-MARK SEARCH IS GIVEN THE PLAIN `bars`, not the walled-off
           one: "keep a disc's width clear of every other name" was the rule
           standing in for "whose mark is this", and a stricter proxy on top of
           the real test only shrinks the ground the real test can use. */
        spot = ownSpot(s.q, s.r, u, bars, kin, W, H) ||
          nearSpot(b, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, s.r, u, wall,
                   foreign, W, H);
        spot.side = ""; spot.glued = false;
        spot.gap = (s.nb || s.own) ? gapOf(spot.box, b) : -1;
        stray = !ownMark([spot.x, spot.y], s.q, kin);
      }
      /* A NUMBER THE CANVAS WOULD NOT LET TOUCH ITS NAME IS TIED TO IT BY A
         LINE - the whole difference between a number beside a name and one
         loose on a map. צאפר's name has תדוין, צחן אל-ג'ן, מארב and a front's
         hatch inside a disc's width on every side, so its 9 cannot be glued at
         any size; a hairline still reads as צאפר's. Drawn before the disc. */
      /* EVERY RECTANGLE THE MAP HAS FILLED SO FAR is ground this line keeps
         off, not the place labels alone: a governorate name and a front's name
         are words too, and both sit in `taken` by the time this runs. The
         number's own box and its own name are excepted by the router itself -
         the line has to leave one and reach the other. */
      var keep = bars.filter(function (t) { return t !== s.mark; });
      var rt = !spot.glued && (s.nb || s.own)
        ? leadTo(ctx, P, u, spot.box, b, keep, (map && map.id) || "?", s.n,
                 leads.map(function (l) { return l.route; }))
        : null;
      if (rt) {
        leads.push({ n: s.n, route: rt, seg: rt.segs[0], bend: rt.bend,
          over: marks.labels.filter(function (l) {
            return l.box !== b && rt.segs.some(function (g) {
              return segBox(g, l.box);
            });
          }).map(function (l) { return l.place; }) });
      }
      if (map && map.key === "panel" && window.DossierMapCheck) {
        DossierMapCheck.add("disc_wrong_mark", stray && !rt ? 1 : 0);
      }
      /* THE NUMBER IS WHAT NAMES THIS MARK where the map printed no name for
         it (MAP_RULES.md rule 8): glued to it, or tied to it by the hairline.
         dossier_map_ink.js counts a mark nothing claimed as `mark_unlabelled`,
         so a disc left off (`hidden` above) accuses the picture by name. */
      if (window.DossierMapInk && (spot.glued || rt)) {
        DossierMapInk.numbered(s.q[0], s.q[1]);
      }
      disc(ctx, P, spot.x, spot.y, s.r, s.n, u);
      bars.push(spot.box); taken.push(spot.box);
      out.push({ n: s.n, place: s.note.place, box: spot.box, side: spot.side,
                 glued: !!spot.glued, led: !!rt, gap: Math.round(spot.gap),
                 name: (s.nb || s.own) ? b : null });
    });
    out.sort(function (a, b) { return a.n - b.n; });
    out.forEach(function (a, i) {
      out.forEach(function (b, k) {
        if (k > i && D().overlaps(a.box, b.box)) over++;
      });
    });
    /* THE NUMBERS ALONE ARE THE "LIST" CASE. The panel paints after this and
       says "painted" when it lands; the callouts painter calls this only having
       decided not to draw its boxes. So "list" is the standing answer and
       "painted" the exception - the safe way round. */
    mark(ctx, "list");
    /* Named even at zero, so the dump's own line is the evidence that the rule
       ran on this picture at all and not only that it found nothing. */
    if (map && map.key === "panel" && window.DossierMapCheck) {
      DossierMapCheck.add("disc_wrong_mark", 0);
    }
    DISCS = { placed: out.length, of: list.length, overlaps: over, leads: leads,
              glued: out.filter(function (e) { return e.glued; }).length,
              hidden: hidden, area: { w: W, h: H }, list: out };
    return DISCS;
  }

  /* ---- what the picture may be checked against ------------------------------ */

  /* EVERY LABEL'S NAME BOX AND ITS OWN MARK, found the same way a note's is, so
     the self-check can ask the two questions no painter here owns: does a mark
     print over somebody else's NAME, and does a leader cross one. Both are
     faults of the label placement, so this only MEASURES them - the fix is an
     authored `anchor`. Added 2026-09-18 after the square at צחן אל-ג'ן was
     found printing through the name beside it. */
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
     order; `note_he` is ALWAYS the full note - `short_he` exists only because
     the on-map box has terrain under it and a list does not. */
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
