/* THE NUMBER ON THE MAP: a numbered disc touching the mark it belongs to, and
   the list those numbers are read off.

   Split out of dossier_map_key.js on 2026-09-18 at that file's 500-line cap;
   WHERE a disc may stand went the same way on 2026-09-19, into
   dossier_map_spot.js. The seam between this file and the key is real and not
   only a size one: BOTH answers to a map's notes need this. `key: "panel"`
   paints these discs beside a panel of sentences; `key: "callouts"` paints them
   inside its boxes, and on a PHONE it paints nothing but these while the
   sentences move to a list under the picture. One disc, one numbering, one glue
   rule, whichever picture is drawn.

   THE NUMBER AND ITS MARK ARE ONE UNIT. Ziv, 2026-09-18: *"make sure in the map
   that the name is next to the number and it makes sense... and make sure it's
   not one on top of another."* Then, 2026-09-19, taking the connector lines off
   again: *"replace the lines with numbers next to the squares."* So the digit is
   now the ONLY thing joining a square to its row, and every mark that owns a row
   must carry one touching it - dossier_map_ink.js counts the ones that do not as
   `mark_unlabelled`.

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
  /* The disc's geometry, its floor, the reserved ground and the searches. */
  function S() {
    if (!window.DossierMapSpot) {
      throw new Error("dossier_map_number: dossier_map_spot.js is not on the page");
    }
    return window.DossierMapSpot;
  }

  var LABEL_GAP = 18, LABEL_GAP_MIN = 12, AXIS = 0.6;
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
    /* OVERLAY MODE (2026-09-23): ONE badge record - disc, ring, halo, digit. */
    if (R.rec(ctx, { kind: "badge", x: x, y: y, r: r, str: str, size: r * 1.35,
        fill: "#FFFFFF", color: P.ink, stroke: P.ink, strokeW: Math.max(1.2, 1.4 * u),
        halo: P.halo, haloW: Math.max(1.5, 1.5 * u), weight: 700, dy: r * 0.04 })) return;
    ctx.beginPath(); ctx.arc(x, y, r + Math.max(1.5, 1.5 * u), 0, Math.PI * 2);
    R.paintShape(ctx, { fill: P.halo });
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    R.paintShape(ctx, { fill: "#FFFFFF", stroke: P.ink,
      width: Math.max(1.2, 1.4 * u) });
    R.text(ctx, P, str, x, y + r * 0.04, { size: r * 1.35, weight: 700, halo: 0,
      color: P.ink });
  }
  function discR(u, ts, n) { return S().discR(u, ts, n); }

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
  /* The hairline from a number to its own unit, edge to edge, in the shared
     halo-under-ink stroke. IT GOES ROUND EVERY OTHER WORD, and until 2026-09-18
     it went BEHIND them. Ziv: *"you have lines that are on actual text, so that
     is not good... make sure that you don't cut anything off."* A clipped line
     is one broken in two that still had nowhere to go, so the route is
     DossierMapLeader's - straight, or ONE BEND round the words - and it keeps
     off the WHOLE registry, region and front names included.
     IT IS THE LAST RESORT AND NOT THE ANSWER, on every shape since 2026-09-19:
     the rule is a disc TOUCHING its own mark (MAP_RULES.md rule 3), and a mark
     whose disc had to stand off is counted `mark_unlabelled` by
     dossier_map_ink.js even though the hairline reaches it. */
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

  /* ---- where the map painted this place's name ------------------------------ */
  /* FOUND, never recomputed. The label loop pushes every name's box into
     `taken` before this painter runs, and `place()` in dossier_map_draw.js
     anchors a box so its centre sits EXACTLY on its point's own axis, a short
     gap out. So the name's box is the one box in `taken` centred on this
     place's axis and within a mark's width of it, and no sizing constant of the
     label's is copied here to go stale. Nothing matches when the map DROPPED
     the name; the caller glues the disc to the mark instead.
     THE REACH IS MEASURED IN THE TEXT'S OWN UNIT, NEVER IN `u` ALONE
     (2026-09-19). A name is sized `17 * u * ts` and may stand up to 0.6 of its
     own height from its mark (DossierMapInk.adjacent, rule 8), so on the wide
     list picture - where `ts` reaches 2.7 - a perfectly adjacent name sits up to
     54px out while this looked 20px. All nine Marib names were invisible to it
     and every disc fell through to the ring search. */
  function nameBoxOf(taken, q, u, ts) {
    var lim = Math.max(LABEL_GAP_MIN, LABEL_GAP * u * (ts || 1)), best = null;
    taken.forEach(function (t) {
      var cx = (t.x0 + t.x1) / 2, cy = (t.y0 + t.y1) / 2, gap = -1, side = "";
      /* A MARK IS NOT A NAME, and neither is a number's own reserved ground:
         both sit in `taken` carrying the signature this looks for - a small box
         on the same axis a few pixels out - which is how a number got glued to
         somebody else's dot. */
      if (t.mark || t.disc) return;
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
  /* THE MARK'S OWN GROUND, found rather than re-measured: dossier_map_ink.js
     reserves every mark's rectangle before a single name is placed, flagged
     `mark`, so the one containing this place's point IS the square (or dot, or
     triangle) the reader sees. It is what a disc may not cover. */
  function mineOf(bars, q) {
    var out = null;
    bars.forEach(function (t) {
      if (out || !t.mark) return;
      if (q[0] >= t.x0 && q[0] <= t.x1 && q[1] >= t.y0 && q[1] <= t.y1) out = t;
    });
    return out;
  }
  /* A DISC GLUED TO ITS OWN MARK IS NOT BLOCKED BY THAT MARK'S OWN RESERVED
     INK. The reservation is a pixel or two wider than the clearance the disc is
     set at, so counting it would push every such disc a ring further out, and
     on a 340 CSS px phone canvas it swallowed every side a disc could take.
     Everybody else's ink still bars the way. */
  function notMine(bars, q) {
    return bars.filter(function (t) {
      return !(t.mark && q[0] >= t.x0 && q[0] <= t.x1 &&
               q[1] >= t.y0 && q[1] <= t.y1);
    });
  }

  /* A NAME WITHDRAWN SO ITS NUMBER CAN TOUCH THE SQUARE - the last resort
     before a hairline. Everything that knows about it is undone in one place:
     the ground it had reserved goes back to the picture, it comes off the list
     dossier_map.js is about to paint, and it comes off the "somebody else's
     name" list the discs still to be placed are measured against. The picture's
     inventory is corrected too, so a count of the names a picture printed stays
     a count of what is really on it. */
  function yieldName(taken, bars, names, labels, map, s) {
    var boxes = [taken, bars], k, i;
    for (k = 0; k < boxes.length; k++) {
      i = boxes[k].indexOf(s.nb.box);
      if (i >= 0) boxes[k].splice(i, 1);
    }
    for (i = labels.length - 1; i >= 0; i--) {
      if (labels[i].spec && labels[i].spec.box === s.nb.box) labels.splice(i, 1);
    }
    for (i = names.length - 1; i >= 0; i--) {
      if (names[i].box === s.nb.box) names.splice(i, 1);
    }
    var hit = ((map && map.labels) || []).filter(function (l) {
      return l.place === s.note.place;
    })[0];
    if (window.DossierMapCheck) {
      DossierMapCheck.add(hit && hit.req ? "req_labels" : "labels", -1);
    }
    console.warn("dossier map " + ((map && map.id) || "?") + ": " +
      s.note.place + " is shown by its number " + s.n + " alone - the name had" +
      " the only ground the disc could touch the mark from");
    s.nb = null;
  }

  /* How boxed-in a name is, three disc-widths out. THE CROWDED NAMES GO FIRST,
     the measured reason the fighting callouts place the edge belts first:
     whoever goes last takes what is left, and five of the nine Marib names sit
     inside 200px of each other. */
  function crowd(box, bars, r) {
    var room = S().grow(box, 3 * r);
    return bars.filter(function (t) { return D().overlaps(room, t); }).length;
  }

  /* ---- the discs ------------------------------------------------------------ */

  /* One disc on every note's mark, numbered in `notes[]` order - what the panel
     and the list print, so the three cannot disagree.
     EVERY MARK CARRIES ITS NUMBER, ON EVERY SHAPE (Ziv, 2026-09-19: "replace
     the lines with numbers next to the squares"). A disc is never left off any
     more - the connector that used to excuse a missing one is gone - so the
     order of preference is: the RESERVED SLOT against its own square, which no
     word was allowed to take (dossier_map_spot.js); glued to its own NAME,
     which sits against the mark already, so the three read as one unit; glued
     to the MARK by the ordinary search; the name withdrawn so the number can
     have its ground; and only where none of those is possible, stood off with
     a hairline back to its mark. A displaced disc must land NEARER ITS OWN MARK
     than any other, and `disc_wrong_mark` counts every one that does not.
     `numbersOnly` is the PHONE case: a key-panel map too narrow for its panel
     paints no objective NAMES - the HTML list below carries them, numbered the
     same way - so a disc is glued to its own MARK instead. MAPS_TAB.md. */
  function discs(ctx, p, P, u, ts, map, taken, W, H, pinR, numbersOnly,
                 labels) {
    var list = (map && map.notes) || [], Q = S();
    var bars = taken.slice(), out = [], over = 0, leads = [];
    /* MEASURED BEFORE A SINGLE DISC IS PLACED, and not for tidiness: `nameBoxOf`
       finds a name by its exact axis alignment with the point, and a disc GLUED
       to a name is aligned with it too - run afterwards, the audit would take
       the disc for the name beside it. It also hands the loop below every label
       box, so a hairline can be clipped behind names that are nobody's note. */
    var marks = audit(p, u, map, taken, ts, pinR);
    var seats = list.map(function (n, i) {
      var ok = typeof n.lon === "number" && typeof n.lat === "number" &&
        p.inside(n.lon, n.lat, 0);
      var q = ok ? p(n.lon, n.lat) : null, r = Q.discR(u, ts, i + 1);
      var nb = q ? nameBoxOf(taken, q, u, ts) : null;
      /* The square itself, at the clearance the map drew it with - the disc's
         second choice of something to be glued to. `own` says the disc is
         standing IN FOR a name (the phone's list map prints none); `mine` is the
         WIDER rectangle the reservation put in `taken`, kept only so the disc
         and its hairline may cross their own mark's ink. */
      var mk = q ? Q.boxAt(q[0], q[1], Q.markClearOf(pinR, n.place, map)) : null;
      var own = (q && numbersOnly && numbersOnly[n.place]) ? mk : null;
      return { n: i + 1, note: n, q: q, r: r, nb: nb, own: own, mk: mk,
               slot: Q.slotOf(n.place),
               mine: q ? mineOf(bars, q) : null,
               box: q ? (nb ? nb.box : (mk || Q.boxAt(q[0], q[1], r))) : null };
    }).filter(function (s) { return !!s.q; });
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
      /* ITS OWN RESERVED GROUND IS NOT IN ITS WAY - it was claimed for this
         number and nothing else may stand there. Everybody else's slot still
         bars the way, which is how two neighbouring squares keep one each. */
      var free = s.slot
        ? bars.filter(function (t) { return t !== s.slot.box; }) : bars;
      /* GLUED TO ITS NAME WHERE THERE IS ONE, AND TO ITS MARK WHERE THERE IS
         NOT. On the phone picture the other notes' MARKS are what a stray disc
         would be read as belonging to, so they are what it must stay further
         from than its own - the same test `glue` runs against names. */
      if (s.own) {
        foreign = seats.filter(function (o) { return o !== s && o.own; })
          .map(function (o) { return o.own; });
      }
      /* THE SIDES ARE TRIED IN THIS ORDER, AND THE DISC MAY GET SMALLER RATHER
         THAN GO WANDERING (2026-09-19): the name's own sides first, then the
         SQUARE's - "on the outer side of the name or directly against the
         square" - then the same two a step smaller, down to the size at which
         the digit would break the 15 CSS px floor and no further. */
      var kinBox = seats.filter(function (o) { return o !== s && o.mk; })
        .map(function (o) { return o.mk; });
      var rung = Q.ladder(s.r, u), gave = false, spot = null;
      /* THE GROUND THAT WAS KEPT FOR IT, BESIDE ITS OWN SQUARE, and it is the
         FIRST choice and not a fallback (Ziv, 2026-09-19: "replace the lines
         with numbers next to the squares"). Gluing to the NAME first was tried
         and looked at: on the wide list picture six of the nine numbers ended
         up at the far end of a name, with the square 60-130px away on the other
         side of the word - which is a number next to a NAME, and leaves the
         reader joining it to a square by eye again. Nothing was ever allowed
         onto this rectangle, so it cannot fail, it costs no name, and every
         number on the picture ends up the same distance from its own mark. */
      if (s.slot && s.mk) {
        var sb = s.slot.box;
        s.r = s.slot.r;
        spot = { x: (sb.x0 + sb.x1) / 2, y: (sb.y0 + sb.y1) / 2,
                 box: sb, side: "slot", glued: true, gap: Q.gapOf(sb, s.mk) };
        b = s.mk;
      }
      /* NO SLOT: the marks round it left no side free when the ground was
         claimed. Then the name it is printed beside will do - the two are one
         unit - and the square itself after that, a step smaller each time
         round, down to the size at which the digit would break the 15 CSS px
         floor and no further (MAP_RULES.md rule 2). */
      if (!spot) rung.some(function (r) {
        if (!spot && s.nb) {
          spot = Q.glue(s.nb.box, r, u, free, foreign, W, H, null);
        }
        if (!spot && (s.nb || s.own) && s.mk) {
          spot = Q.glue(s.mk, r, u, notMine(free, s.q),
                        s.own ? foreign : kinBox, W, H, null);
          if (spot) b = s.mk;
        }
        if (spot) s.r = r;
        return !!spot;
      });
      /* Only when the whole ladder is exhausted does the NAME stand down for
         the number: the row beside the picture carries that word anyway, and a
         square with no number on it says nothing at all. */
      if (!spot && s.nb && s.mk && labels) {
        var freed = free.filter(function (t) { return t !== s.nb.box; });
        rung.some(function (r) {
          spot = Q.glue(s.mk, r, u, notMine(freed, s.q), kinBox, W, H, null);
          if (spot) { s.r = r; b = s.mk; gave = true; }
          return !!spot;
        });
        if (gave) yieldName(taken, bars, names, labels, map, s);
      }
      /* NEARER ITS OWN MARK THAN ANY OTHER, OR TIED TO IT BY A HAIRLINE - the
         second is the stronger, which is why it excuses the first (2026-09-19).
         At 340 CSS px the Marib cluster puts Marib, Sahn al-Jinn and Tadween
         inside four pixels of one another, so the ground nearer Sahn al-Jinn
         than either neighbour is a two-pixel band no disc of any size fits in.
         A line that ENDS ON the square says whose number it is exactly, where
         nearness only guesses. So a stray disc is a fault only with no line. */
      var stray = false;
      if (!spot) {
        var wall = bars.concat(foreign.map(function (o) { return Q.grow(o, s.r); }));
        /* THE OWN-MARK SEARCH IS GIVEN THE PLAIN `bars`, not the walled-off
           one: "keep a disc's width clear of every other name" was the rule
           standing in for "whose mark is this", and a stricter proxy on top of
           the real test only shrinks the ground the real test can use. */
        spot = Q.ownSpot(s.q, s.r, u, free, kin, W, H) ||
          Q.nearSpot(b, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, s.r, u, wall,
                     foreign, W, H);
        spot.side = ""; spot.glued = false;
        spot.gap = (s.nb || s.mk) ? Q.gapOf(spot.box, b) : -1;
        stray = !Q.ownMark([spot.x, spot.y], s.q, kin);
      }
      /* EVERY RECTANGLE THE MAP HAS FILLED SO FAR is ground the hairline keeps
         off, not the place labels alone: a governorate name and a front's name
         are words too. The number's own box and its own mark are excepted - the
         line has to leave one and reach the other. */
      var keep = bars.filter(function (t) {
        return t !== s.mk && t !== s.mine;
      });
      var rt = !spot.glued && (s.nb || s.mk)
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
      /* THE NUMBER IS WHAT NAMES THIS MARK (MAP_RULES.md rules 3 and 8), and
         the second argument is whether it is TOUCHING its own unit. On a list
         picture that is the whole rule - a mark whose disc had to stand off is
         counted `mark_unlabelled` even though its hairline reaches it - so the
         two answers are reported apart and dossier_map_ink.js decides. */
      if (window.DossierMapInk && (spot.glued || rt)) {
        DossierMapInk.numbered(s.q[0], s.q[1], !!spot.glued);
      }
      disc(ctx, P, spot.x, spot.y, s.r, s.n, u);
      if (!s.slot || spot.box !== s.slot.box) {
        bars.push(spot.box); taken.push(spot.box);
      }
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
              area: { w: W, h: H }, list: out };
    return DISCS;
  }

  /* ---- what the picture may be checked against ------------------------------ */

  /* EVERY LABEL'S NAME BOX AND ITS OWN MARK, found the same way a note's is, so
     the self-check can ask the two questions no painter here owns: does a mark
     print over somebody else's NAME, and does a leader cross one. Both are
     faults of the label placement, so this only MEASURES them - the fix is an
     authored `anchor`. Added 2026-09-18 after the square at צחן אל-ג'ן was
     found printing through the name beside it. */
  function audit(p, u, map, taken, ts, pinR) {
    var seen = [], hits = [], Q = S();
    ((map && map.labels) || []).forEach(function (l) {
      if (typeof l.lon !== "number" || typeof l.lat !== "number") return;
      if (!p.inside(l.lon, l.lat, 0) || l.pin === false) return;
      var q = p(l.lon, l.lat), nb = nameBoxOf(taken, q, u, ts);
      /* THE MARK IS THE MARK, never the space between it and its name: read
         off the same clearance table the map drew it with. Measured from the
         name's own gap, a name set several rings out made its mark a 48px blob
         and this reported it over every word near it. */
      if (nb) seen.push({ place: l.place, box: nb.box, side: nb.side,
                          mark: mineOf(taken, q) ||
                            Q.boxAt(q[0], q[1],
                                    Q.markClearOf(pinR, l.place, map)) });
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
