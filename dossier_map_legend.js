/* The dossier maps' KEY and the marks that must be read at any scale: the
   legend box (measured before anything is placed, painted after everything
   else), the red diamond every active-fighting zone carries, and the plain
   picture's zone names.

   Split out of dossier_map_draw.js on 2026-09-15 at its line cap; looked up at
   paint time, so the painter files may load in any order. IN OVERLAY MODE
   (2026-09-23) the diamond, the box, each row's word and each swatch - as a
   small picture - are RECORDED instead of drawn (dossier_map_draw.js, `rec`).

   NO ES modules - the page runs from file://. One global:

     window.DossierMapLegend = { legendLayout, paintLegend, frontMarks,
                                 diamond, markR, centre, seamLabel, drawsSeam,
                                 drawsTint, tintFill }

   It reaches back into DossierMapDraw at call time for the shared helpers
   (hatch, width, setFont, paintShape, dashOf, eachFeature), into
   DossierMapGains for the gains swatch and into DossierMapHeat for the
   fighting scale that replaces the one fighting-zone row on a heat map; the
   Hebrew words it prints are handed in by dossier_map.js, which is where they
   are authored beside the palette. */
"use strict";

var DossierMapLegend = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_legend: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  function box(x0, y0, x1, y1) { return { x0: x0, y0: y0, x1: x1, y1: y1 }; }
  /* WHERE the box may stand is dossier_map_corner.js since 2026-09-19 - the
     four corners, what each would cover and the slide along an edge. */
  function need() {
    if (!window.DossierMapCorner) {
      throw new Error("dossier_map_legend: dossier_map_corner.js is not on the page");
    }
    return window.DossierMapCorner;
  }

  /* ---- the fighting-zone mark ---------------------------------------------- */

  /* A DIAMOND ON EVERY FIGHTING ZONE (2026-09-15). A belt is 12 km wide, which
     is five pixels once the whole country is on one canvas, and Ziv could not
     find them: "make the fighting places more like marked or something because
     it's hard to see them on a big map." So each zone also carries a mark that
     does NOT shrink with the geography - a diamond, floored so it reads at any
     scale. Diamond and not a dot, because a dot on this board is a town.
     RED, and the one place this board takes a new hue: every other colour
     answers which front or how well confirmed, this one answers where it is
     happening now. The first pass obeyed the no-new-hue rule and Ziv came back
     with "make it a color that stands out... so people see it fast".

     6.6 (floor 7) on the day it was built and 11 (floor 11) since 2026-09-15:
     he asked for the red marks bigger again, having seen them on the whole
     country. The legend's own swatch follows at 0.8 of it, so the key and the
     map keep showing the same mark.

     Drawn at the average of the shape's own vertices, which for a belt sits on
     its centreline - the one point certainly ON the line rather than beside it. */
  var MARK_R = 11, MARK_MIN = 11;

  function markR(u) { return Math.max(MARK_MIN, MARK_R * u); }

  function diamond(ctx, x, y, r, style) {
    if (D().recMark(ctx, "diamond", x, y, r, style)) return;
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath();
    D().paintShape(ctx, style);
  }

  /* The centre of a front's biggest ring, in canvas pixels, or null. */
  function centre(p, geom) {
    var polys = geom.type === "Polygon" ? [geom.coordinates]
      : geom.type === "MultiPolygon" ? geom.coordinates : [];
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

  function frontMarks(ctx, p, P, u, G) {
    var r = markR(u);
    D().eachFeature(G.fronts, function (f) {
      var best = centre(p, f.geometry || {});
      if (!best) return;
      diamond(ctx, best[0], best[1], r + Math.max(2, 2 * u), { fill: P.halo });
      diamond(ctx, best[0], best[1], r, { fill: P.frontMark,
        stroke: P.halo, width: Math.max(1.5, 1.5 * u) });
    });
  }

  /* ---- the legend box ------------------------------------------------------- */

  /* NO GAINS, NO GAINS ROW (2026-09-18): a window in which nothing changed
     hands leaves `DOSSIER.gains` empty, the painter draws no violet for it, and
     a row naming a colour that is not on the picture sends the reader hunting.
     Read off the DOSSIER global at call time (as dossier_map_relief.js reads
     it), so nothing is threaded through the caller's opt; it is the whole
     dossier's list and not this frame's, and empty is empty everywhere. One leg
     of `drawsTint` below - the OTHER violet is the wash, and the gate is the
     paint. */
  function hasGains() {
    var D0 = (typeof DOSSIER !== "undefined" && DOSSIER) ? DOSSIER : null;
    return !!(D0 && D0.gains && D0.gains.length);
  }

  /* ---- the seam row --------------------------------------------------------- */

  /* THE ROW EVERY PICTURE THAT DRAWS THE SEAM GETS (2026-09-18; the gate widened
     2026-09-22). It had no gains row and that was the point - a row naming a
     colour that is not on the picture sends the reader hunting for it. The seam
     is not a colour: it is a LINE that is on the picture, drawn by
     dossier_map_gains.js, and Ziv asked for it by name - "still make a line
     that separates the new territories that they conquered so we know what they
     are." A line nobody can name is a line nobody can read, so where there is a
     key there is now a row for it, and where there is no key (the crossing) the
     caption says it in words.

     THE GATE IS WHAT THE PICTURE DRAWS, never how it was asked for: `gainsMode`
     below repeats `ground()`'s own one-word resolution, which runs the border
     for "seam" and for "tint" alike, and not the old `control === "merged"`
     flag this row was born on. AND the layer must have an edge to draw: no
     gains_seam, no row. `drawsSeam` is exported because the HTML key under the
     canvas (dossier_map_block.js) asks the same question, and two keys to one
     picture may never disagree about whether the line is there.

     THE DATE IS THE GAINS' OWN, never `GEO.recent_gains_since`: that is the
     board's window start (12 July) and the seam is the border of what was taken
     since 10 September. Preferred is a `since` the seam layer carries; failing
     that the earliest date in the gains list; failing both the literal, which
     is what the date is today. */
  function seamDate() {
    var G0 = (typeof GEO !== "undefined" && GEO) ? GEO : null;
    var since = G0 && G0.gains_seam && G0.gains_seam.since;
    if (!since) {
      since = ((G0 && G0.recent_gains_list) || []).map(function (g) {
        return g.date;
      }).filter(Boolean).sort()[0];
    }
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(since || ""));
    return m ? Number(m[3]) + "." + Number(m[2]) : "10.9";
  }
  function seamLabel(words) {
    var w = words || (window.DossierMapWords || {});
    return (w.seam || "גבול השטח שנכבש מאז") + " " + seamDate();
  }
  /* ONE WORD PER PICTURE, resolved exactly as dossier_map_draw.js `ground()`
     resolves it, because both rows below must follow the paint and not the ask. */
  function gainsMode(map) {
    var m = map || {};
    return m.gains || (m.control === "merged" ? "seam"
      : m.gains_fill === true ? "tint" : "none");
  }
  function drawsSeam(map, G) {
    var GN = window.DossierMapGains;
    return gainsMode(map) !== "none" && !!(GN && GN.hasSeam && GN.hasSeam(G));
  }
  function seamRows(opt, words) {
    var GN = window.DossierMapGains;
    if (!drawsSeam(opt.map, opt.G)) return [];
    return [{ label: seamLabel(words),
      draw: function (ctx, P0, u0, sx, cy, sw) {
        GN.seamSwatch(ctx, P0, u0, sx, cy, sw);
      } }];
  }

  /* ---- the violet row: WHICHEVER VIOLET IS ON THE PICTURE (2026-09-22) -------
     TWO layers paint violet and this row was gated on neither. It asked
     `DOSSIER.gains` - the dossier's captured places, painted by `gains()` on
     every NON-clean picture - while a record resolving to `gains: "tint"` lays
     the WASH over `GEO.recent_gains` (`newGround`, run from `ground()`, on
     clean and tribal pictures too). That list is empty today, so a tint picture
     showed a violet NO row named: rule 1, the fault the seam row was regated
     for, one layer along. So the gate is the PAINT and it says WHICH violet -
     the list first (it paints its own tone over plain land, and a picture
     drawing it may not move by a pixel), else the wash. Exported: the HTML key
     asks it too, and two keys to one picture may never disagree. */
  var TINT_BOX = { type: "FeatureCollection", features: [{ type: "Feature",
    geometry: { type: "Polygon",
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } }] };

  function drawsTint(map, G) {
    var m = map || {};
    if (hasGains() && !m.clean) return "list";
    var has = G && G.recent_gains && (G.recent_gains.features || []).length;
    return (gainsMode(m) === "tint" && has) ? "wash" : "";
  }
  /* THE SWATCH IS PAINTED BY THE PAINTER, never described again here: the row
     hands `newGround` a unit square projected onto the swatch box and gets the
     tone and the alpha the map has. Under it goes the HOLDER'S fill and not
     bare land, because that is what the wash lies on - every district in the
     layer changed hands TO the Houthis (dossier_map_gains.js: a government gain
     needs the layer split upstream first), and over the tan the same wash reads
     as a dustier mauve than over land. Then the hairline edge every fill row
     carries. `tintFill` hands the HTML key that composite as ONE CSS colour, by
     drawing this very swatch on a scratch canvas and reading the middle pixel
     back - sampled, so the day the tone or its alpha moves, both keys move. */
  function tintSwatch(ctx, P, u, x, cy, sw, sh) {
    var R = D(), y = cy - sh / 2;
    ctx.beginPath(); ctx.rect(x, y, sw, sh);
    R.paintShape(ctx, { fill: P.land }); R.paintShape(ctx, { fill: P.houthi });
    window.DossierMapGains.newGround(ctx, function (lon, lat) {
      return [x + lon * sw, y + lat * sh];
    }, P, u, { recent_gains: TINT_BOX });
    ctx.beginPath(); ctx.rect(x, y, sw, sh);
    R.paintShape(ctx, { stroke: P.boxLine, width: Math.max(1, u) });
  }
  function tintFill(P) {
    var c = document.createElement("canvas"), g;
    c.width = 12; c.height = 12; g = c.getContext("2d");
    tintSwatch(g, P, 1, 0, 6, 12, 12);
    var d = g.getImageData(6, 6, 1, 1).data;
    return "rgb(" + d[0] + ", " + d[1] + ", " + d[2] + ")";
  }
  function tintRows(opt, words, P, u) {
    var t = drawsTint(opt.map, opt.G);
    if (!t) return [];
    return [t === "wash" ? { draw: tintSwatch, label: words.gained }
      : { gain: window.DossierMapGains.gainStyle(P, u), label: words.gained }];
  }

  /* MEASURED before any label is placed, so its box counts as taken ground for
     the governorate names and the lane name, and PAINTED last so it sits over
     everything. Its CORNER is chosen here too, by the scoring above - `opt.top`
     is the y a top corner takes (the line under the painted title) and
     `opt.pref` is the frame's own preference, which now only breaks a tie. A
     key and nothing else: the strait-width notes that once sat under it were
     "not relevant" (Ziv, 2026-09-11), and the build now refuses a map note.
     Everything scales with the row text.

     `opt.arrows` adds the assessment row, and only the Aden map has it. The
     RELIEF variant adds no row at all: terrain under the same picture is said
     by the caption under the canvas, and a legend that grows for a second
     picture of the same ground would be a key to the paper, not to the map. */
  function metrics(L, size) {
    var k = size / 17;
    L.size = size; L.k = k; L.pad = 12 * k; L.sw = 26 * k; L.gap = 9 * k;
    L.rowH = size * 1.55;
    return L;
  }
  function legendLayout(ctx, P, u, W, H, hasLanes, words, opt) {
    var R = D(), L = metrics({}, opt.size);
    /* A CLEAN map draws no territory, no fighting belts and no line of contact,
       so it is given none of their rows: a key to something that is not on the
       picture is noise, and on the crossing map it would be five rows of it.
       What is left is what this layer's own painters hand back below - the
       route and the ports.

       A MERGED one draws three of those five again and takes back exactly three
       rows (2026-09-17): the two territories and the boundary between them.
       There is no GAINS row on it and that is the point - Ziv asked for the new
       ground to read as "just part of the Houthis", so a row telling the reader
       to look for a separate colour would name a colour that is not there.
       Since 2026-09-18 it takes a FOURTH: the seam that runs where the new
       ground ends, which is a line on the picture and not a second colour - see
       seamRows above.

       THE SEAM ROW IS ADDED TO WHICHEVER LIST THIS PICTURE USES (2026-09-22),
       plain, clean-merged or tribal, because every one of them can now draw the
       border: the record's `gains` decides, not `clean` and not `control`. It
       goes LAST of the ground rows - directly under the line of contact it is
       told apart from - and before the lane, the axes and the layers' own rows,
       so both keys list it in the same place. */
    var control = [
      { fill: P.houthi, label: words.houthi },
      { fill: P.gov, label: words.gov },
      { line: P.control, dash: R.dashOf(P.controlDash, u), width: P.controlW * u,
        label: words.front }
    ];
    var gained = tintRows(opt, words, P, u);
    /* A TRIBAL MAP HAS NO HOLDER ROWS AND NO FIGHTING ROW (2026-09-22): it
       paints neither, and a row naming a fill that is not on the picture is
       the one thing every rule about this key forbids. Its own stance swatches
       come from the file that paints them, as every other layer's rows do. */
    var tribal = !!(opt.map && opt.map.tribes === true && window.DossierMapTribes);
    L.rows = (tribal ? DossierMapTribes.legendRows(ctx, P, u, opt.map)
      : !opt.clean ? [
      control[0], control[1],
      { fill: P.contested, hatch: R.hatch(ctx, P.contestedStroke, u),
        stroke: P.contestedStroke,
        dash: [3 * u, 3 * u], width: u, mark: true, label: words.contested }
    ].concat(gained, [control[2]])
      : opt.control === "merged" ? control : []
    ).concat(tribal || opt.clean ? gained : [], seamRows(opt, words));
    if (hasLanes) {
      L.rows.push({ line: P.lane, dash: [8 * u, 6 * u], width: 2 * u, label: words.lane });
    }
    /* THE SWATCH SHOWS THE MARK THAT IS ON THE MAP (2026-09-17): an axis drawn
       along a road is a DOTTED run of beads, not a solid shaft. All-or-nothing
       on purpose - a key cannot show two marks on one row. */
    if (opt.arrows) {
      var ax = (opt.map && opt.map.arrows) || [];
      L.rows.push({ arrow: true, label: words.axis,
        dots: ax.length > 0 && ax.every(function (a) { return !!a.road; }) });
    }
    /* Routes, measures, zones, the marker a label chose and a CLAIM each bring
       their own row, built by the file that paints them - a row carries its own
       `draw`, and appears only when the map carries the thing it names. */
    if (window.DossierMapRoutes) {
      L.rows = L.rows.concat(DossierMapRoutes.legendRows(ctx, P, u, opt.map));
    }
    /* A HEAT map's key is a SCALE: dossier_map_heat.js takes the one fighting-
       zone row out and puts its five steps in the same place - on that picture
       the belts are not one colour. Nothing else about the key changes. */
    if (opt.map && opt.map.heat && window.DossierMapHeat) {
      L.rows = DossierMapHeat.legendRows(P, u, opt.map, L.rows);
    }
    /* The strike tally's own rows - a colour per weapon category the picture
       really paints, then the sentence for the number in the disc - built by
       the file that paints them (dossier_map_strikes_data.js). */
    if (opt.map && opt.map.strikes && window.DossierMapStrikes) {
      L.rows = L.rows.concat(DossierMapStrikes.keyRows(opt.map, ctx, P, u));
    }
    /* No rows, no box. Only a clean map can reach this, and an empty key drawn
       anyway would be a white rectangle floating in a corner. */
    if (!L.rows.length) return null;
    function widest(S) {
      return Math.max.apply(null, L.rows.map(function (r) {
        return R.width(ctx, r.label, S.size, 500);
      }));
    }
    var cu = (window.DossierMapDraw && DossierMapDraw.canvasScale()) || u;
    var cap = W * 0.44;
    /* THE KEY SHRINKS ITS OWN WORDS RATHER THAN CUTTING THEM (2026-09-19). The
       box is capped at 0.44 of the picture it sits in and the map text now
       scales with the CANVAS, so on the three-band split rows set for 2560 were
       capped at 0.44 of 1306 and three Hebrew rows were clipped off the card.
       The size comes down until the widest row fits, never below 13 CSS px of
       the whole picture (MAP_RULES.md, rule 2); if even that will not fit, the
       BOX widens past the cap - a wide key is read, a cut one is not. */
    /* ONE CANDIDATE SHAPE OF THE KEY, measured at `size` and placed: the single
       column, and the two-column lie-down below when the column is dirty. It is
       a function so the whole question can be asked again a size smaller. */
    function shape(size) {
      var S = metrics({}, size);
      var textW = widest(S), extra = S.sw + S.gap + 2 * S.pad;
      if (textW + extra > cap) {
        var want = Math.max(13 * cu, S.size * (cap - extra) / textW);
        if (want < S.size) {
          metrics(S, want);
          textW = widest(S); extra = S.sw + S.gap + 2 * S.pad;
        }
      }
      S.w = Math.max(textW + extra, Math.min(cap, 220 * u + 2 * S.pad));
      S.h = 2 * S.pad + L.rows.length * S.rowH;
      S.pick = need().corner(S, u, W, H, opt);
      /* AND WHEN ONE COLUMN CANNOT STAND ANYWHERE CLEAN, THE KEY LIES DOWN
         (2026-09-20). The Marib list picture's key reached seven rows - the
         regional-capital row was the seventh - and at that height no corner and
         no slid position on the right edge missed every mark: the tall box came
         down the edge onto al-Thaniyah. Half as tall and twice as wide, the
         same seven rows fit across more of the frame. Tried ONLY when the
         single column is dirty and kept only if it is cleaner, so every key
         that is clean today is untouched. */
      if ((S.pick.hard || S.pick.edge) && L.rows.length > 3) {
        var per = Math.ceil(L.rows.length / 2);
        S.colW = S.w - 2 * S.pad; S.colGap = 1.6 * S.pad;
        var alt = { w: 2 * S.colW + S.colGap + 2 * S.pad,
                    h: 2 * S.pad + per * S.rowH };
        if (alt.w <= W - 28 * u) {
          var wide = need().corner(alt, u, W, H, opt);
          if (wide.hard < S.pick.hard
              || (wide.hard === S.pick.hard
                  && ((S.pick.edge && !wide.edge) || wide.score < S.pick.score))) {
            S.cols = 2; S.per = per; S.w = alt.w; S.h = alt.h; S.pick = wide;
          }
        }
      }
      return S;
    }
    /* AND WHEN NO SHAPE OF IT STANDS CLEAR, THE KEY GETS SMALLER (2026-09-20).
       A key that covers a mark, a disc or a region name's only anchor is a key
       that has taken something off the picture, and the reader cannot get it
       back; a key two steps smaller is still a key. So while the best placement
       covers something HARD, the same search runs again at 0.9, 0.8 ... of the
       authored size, and the FIRST size that stands clear wins - largest clean,
       never smallest possible. The floor is 15 CSS px of a 1280-wide canvas
       (MAP_RULES.md, rule 2), below which nothing is printed smaller and the
       old least-bad answer stands. A key that is already clean - including one
       pinned along an edge, which several approved pictures use - never enters
       this loop, so nothing that reads well today moves by a pixel. */
    var S = shape(opt.size);
    if (S.pick.hard) {
      for (var f = 0.9; f > 0.44; f -= 0.1) {
        if (opt.size * f < 15 * cu) break;
        var T = shape(opt.size * f);
        if (!T.pick.hard) { S = T; break; }
      }
    }
    ["size", "k", "pad", "sw", "gap", "rowH", "w", "h", "cols", "per",
     "colW", "colGap"].forEach(function (key) { L[key] = S[key]; });
    var pick = S.pick;
    L.at = pick.at; L.cover = pick.score; L.hard = pick.hard;
    L.x0 = pick.box.x0; L.x1 = pick.box.x1; L.y0 = pick.box.y0;
    L.box = pick.box;
    return L;
  }

  /* The swatch for the assessment row: the same halo-under-red stroke and the
     same filled head the axes are drawn with, laid flat across the swatch box,
     so the key shows the mark rather than describing it. */
  function arrowSwatch(ctx, P, u, x, y, w, dots) {
    var R = D(), head = Math.min(9 * u, w * 0.45), half = head * 0.5;
    if (dots) {
      /* THREE BEADS AND THE HEAD, the road axis's own mark. */
      var r = Math.max(1.6, 2.1 * u), run = w - head, i;
      for (i = 0; i < 3; i++) {
        R.ringMark(ctx, x + run * (i + 0.5) / 3, y, r + Math.max(1, u),
          { fill: P.halo });
        R.ringMark(ctx, x + run * (i + 0.5) / 3, y, r, { fill: P.frontMark });
      }
    } else {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w - head, y);
      R.paintShape(ctx, { stroke: P.halo, width: Math.max(3, 5 * u) });
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w - head, y);
      R.paintShape(ctx, { stroke: P.frontMark, width: Math.max(2, 3 * u) });
    }
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w - head, y - half);
    ctx.lineTo(x + w - head, y + half);
    ctx.closePath();
    R.paintShape(ctx, { fill: P.frontMark });
  }

  function paintLegend(ctx, P, u, L) {
    var R = D(), rr = ctx.roundRect ? 10 * L.k : 0;
    if (!R.rec(ctx, { kind: "box", x: L.x0, y: L.y0, w: L.w, h: L.h, fill: P.box,
        stroke: P.boxLine, strokeW: Math.max(1, u), radius: rr })) {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(L.x0, L.y0, L.w, L.h, 10 * L.k);
      else ctx.rect(L.x0, L.y0, L.w, L.h);
      R.paintShape(ctx, { fill: P.box, stroke: P.boxLine, width: Math.max(1, u) });
    }
    var sh = 16 * L.k, per = L.cols === 2 ? L.per : L.rows.length;
    L.rows.forEach(function (r, i) {
      /* RTL: the first column is the RIGHT one, where the reading starts. */
      var col = Math.floor(i / per);
      var right = L.x1 - L.pad - col * ((L.colW || 0) + (L.colGap || 0));
      var y = L.y0 + L.pad + (i - col * per) * L.rowH;
      var cy = y + L.rowH / 2, sx = right - L.sw, sy = cy - sh / 2, m = L.rowH;
      if (!R.recImage(ctx, sx - m, cy - m, L.sw + 2 * m, 2 * m, swatch)) swatch(ctx);
      R.setFont(ctx, L.size, 500);
      ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillStyle = P.ink;
      if (!R.recText(ctx, P, r.label, sx - L.gap, cy, { size: L.size })) {
        ctx.fillText(r.label, sx - L.gap, cy);
      }
      function swatch(ctx) {
        if (r.draw) {
          r.draw(ctx, P, u, sx, cy, L.sw, sh);
        } else if (r.arrow) {
          arrowSwatch(ctx, P, u, sx, cy, L.sw, r.dots);
        } else if (r.line) {
          ctx.beginPath(); ctx.moveTo(sx, cy); ctx.lineTo(sx + L.sw, cy);
          R.paintShape(ctx, { stroke: r.line, width: r.width, dash: r.dash });
        } else {
          /* Land under the fill, so the swatch is the colour the map shows; a
             hairline edge, because the government wash is a dark step that
             would otherwise vanish into the box. */
          ctx.beginPath(); ctx.rect(sx, sy, L.sw, sh);
          R.paintShape(ctx, { fill: P.land });
          if (r.hatch) {
            R.paintShape(ctx, { fill: r.fill });
            R.paintShape(ctx, { fill: r.hatch });
          }
          ctx.beginPath(); ctx.rect(sx, sy, L.sw, sh);
          R.paintShape(ctx, r.gain || { fill: r.hatch ? null : r.fill,
            stroke: r.stroke || P.boxLine,
            width: r.width || Math.max(1, u), dash: r.dash });
          if (r.mark) {
            diamond(ctx, sx + L.sw / 2, cy, markR(u) * 0.8,
              { fill: P.frontMark, stroke: P.halo, width: Math.max(1, u) });
          }
        }
      }
    });
  }

  return { centre: centre, legendLayout: legendLayout, paintLegend: paintLegend,
           frontMarks: frontMarks, diamond: diamond, markR: markR,
           seamLabel: seamLabel, drawsSeam: drawsSeam,
           drawsTint: drawsTint, tintFill: tintFill };
})();

window.DossierMapLegend = DossierMapLegend;
