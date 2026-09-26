/* THE REGION NAMES: a governorate's or a Saudi region's own Hebrew name,
   printed where the map has room for it and nowhere it would say something
   twice.

   Split out of dossier_map_zone_names.js on 2026-09-19, when the phone's
   numbers-only list map and the "already printed" rule took that file past the
   500-line cap every authored file here keeps - the same seam the place names
   themselves came through on 2026-09-18, and the zone names before them. The
   seam is a real one: a place label and a front name are fitted round what is
   on the picture, while a region name has ONE anchor and either stands there or
   stands down. Nothing about the search moved with the code; what it grew here
   is the per-map anchor override.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapGov = { govLabels }

   dossier_map.js merges it into the one painter object the paint pass is
   handed, so `R.govLabels(...)` there reads exactly as it did before. */
"use strict";

var DossierMapGov = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_gov: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  /* Quieter than a claim. Only where the frame holds them, never on top of a
     dossier label, and never beside one naming the same place - "אל-חודיידה"
     under "חודיידה" reads as a typo, and "תעז" twice over reads as a stutter,
     so a governorate that shares its name with a dossier label, or whose anchor
     sits within 32px of one's point, yields to it. That second case is why Taiz
     governorate's authored anchor (data\gov_names.json, on the city) costs the
     overview nothing: the city label is already there, and the governorate name
     stands down.

     ONLY THE NAMES THE MAP NEEDS (2026-09-18). Every anchor in frame was
     printed until that day, and Ziv, seeing Amran, al-Mahwit and Dhamar on a
     heat map of the al-Jawf and Marib fighting: "why are they even there? What
     is the point of that? Don't put random information that is not needed." So
     a map record may carry `gov_names`, a whitelist, and then these are the
     only region names printed; with no list the frame decides, as it always
     did. A key is matched against every identity the layer could carry - an
     explicit `key`, the geoBoundaries shapeName that gov_names.json is keyed
     by, the shapeID geo.js emits today, or the Hebrew name itself - because
     which of them the build bakes may change, and A LIST THAT MATCHES NOTHING
     IS AN ERROR AND NOT AN EMPTY MAP: it says so in the console rather than
     quietly taking every region name off the picture. */
  function sameName(a, b) {
    var strip = function (s) { return String(s || "").replace(/^אל-/, "").trim(); };
    a = strip(a); b = strip(b);
    return !!a && !!b && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0);
  }
  /* A whitelist is written in the geoBoundaries SHAPE NAMES data\gov_names.json
     is keyed by ("Al Jawf Governorate"), and the label layer carries a shapeID
     and the Hebrew name and not that name at all. The two are joined through
     the BOUNDARY layers, which carry both - measured 2026-09-18: 21 of Yemen's
     22 first-level units have a label, and every one of them joins. Built once
     from GEO, which does not change while the page is open. */
  var NAME_ID = null;
  function idOf(G) {
    if (NAME_ID) return NAME_ID;
    NAME_ID = {};
    [G.yem_adm1, G.sau_adm1].forEach(function (fc) {
      D().eachFeature(fc, function (f) {
        var q = f.properties || {};
        if (q.shapeName && q.shapeID) NAME_ID[q.shapeName] = q.shapeID;
      });
    });
    return NAME_ID;
  }
  function wanted(names, m, index) {
    if (!names) return true;
    var q = m.props || {};
    return names.some(function (k) {
      k = String(k).trim();
      return k === q.key || k === q.shapeName || k === q.shapeID ||
        k === m.name || (!!q.shapeID && index[k] === q.shapeID);
    });
  }

  /* `at` IS THE MAP'S OWN ANCHOR OVERRIDE, `gov_anchor` on the record, resolved
     by the build into {Hebrew name: [lon, lat]} (2026-09-19). A governorate's
     anchor is geo_labels.py's interior point of the whole polygon, and a map
     cut to a subject inside that polygon therefore cannot print its name at
     all: the Marib objectives picture fills its east and south with Hadramawt
     and Shabwa ground, its notes talk about both, and both anchors sit far off
     the frame. The override says WHERE ON THAT GOVERNORATE'S OWN GROUND this
     picture prints the name, and the build refuses a point that is not inside
     the frame and inside that polygon - so it can never move a name onto
     somebody else's land, which is the one thing an anchor may not do. */
  /* A NAME ON THE WHITELIST THAT DOES NOT REACH THE PICTURE SAYS SO
     (2026-09-19). `gov_names` is a promise the map's own prose makes - the
     Marib notes talk about Hadramawt and Shabwa - and until now a region name
     that found no room simply was not painted, with nothing anywhere to say
     it. It is a console line and not yet a counter: several pictures on this
     board print fewer region names than they list, and turning that into a
     refusal is a day's work on the anchors, not a line here. */
  /* WITH THE PICTURE'S NAME ON IT (2026-09-22): the phone pass walks the whole
     board, so a yield line that names only the region says nothing about which
     of a dozen pictures lost it. */
  function say(who, name, why) {
    console.warn("dossier map " + who + ": region " + name + " is on gov_names"
      + " and was not printed - " + why);
  }

  /* ONE NAME STEPS DOWN, NEVER THE WHOLE FRAME (2026-09-19). The frame's `gov`
     factor is how big Ziv asked the region names on THIS picture to be - "make
     it big" - and until now a single name that could not be fitted at that size
     was paid for by every other name on the map: the Marib objectives list map
     had its frame dropped from 1.5 to 1.1 so "מארב" would fit between the discs,
     and al-Jawf, Hadramawt and Shabwa all shrank with it for nothing. So the
     LADDER is per name: full size first, then 1.35, 1.2 and a floor of 1.1, and
     the first step that clears every box already on the picture is the one
     painted. A frame below the floor keeps its own factor and never steps - the
     ladder only ever goes DOWN from what the frame asked for.

     The floor is 1.1 and not lower because the smallest of these is still a
     name a reader has to read: `sizeAt` is written round the 17px reading floor
     of dossier_map.js, so 1.1 lands well above the checker's 13.5 CSS px on a
     1280 canvas (dossier_map_check.js, `nameFloor`) on every shape this board
     paints.

     ONLY A NAME THIS PICTURE ANCHORED BY HAND STEPS. `gov_anchor` is the
     author saying WHERE on this picture that region is named - a promise the
     picture's own prose makes - so shrinking it a step to keep that promise is
     what the override was for. A name standing at its own computed interior
     point has promised nothing: it fits at the size the frame asked for or it
     stands down, exactly as it did before, so no other picture on the board
     gains a name it was not printing. Measured 2026-09-19: stepping every name
     gave the fighting-heat callouts map a third region name and a leader line
     across it, and that picture failed its own check. */
  /* AND ONE STEP BELOW THE FLOOR ON A PHONE (2026-09-22). The 1.1 floor is the
     13.5 CSS px reading floor on a 1280 canvas; a `narrow` picture is 340 CSS
     px of canvas where rule 7 has already traded names for numbers and
     MAP_CHECK's phone pass deliberately holds no picture to a size floor. The
     word this buys is the one the picture would otherwise lose outright: on
     marib_objectives the town name has no room in the objective cluster and
     the governorate name מארב is what carries the word (rule 10 forbids it the
     wrong ground, so the only room left is a smaller word). */
  /* AND BELOW THE 1.1 STEP WHERE THE PICTURE PAYS FOR IT IN PIXELS
     (2026-09-22). 1.1 is the 13.5 CSS px floor read on a 1280 canvas, but the
     size a reader actually gets is `sizeAt(g)` over the CANVAS scale, and a
     2048-wide export paints a 1.1 name at 23 CSS px - eight clear of the 15 px
     floor rule 2 holds readable text to. The LAND shape is where that room is
     needed: 1.6 units of canvas to the 1280 the sizes are written in, so its
     words cover half again the ground the tall shape's do, and five names -
     al-Hudaydah, Raymah, al-Mahwit, ad-Dali and Aden, every one of them a
     NARROW governorate - had no box small enough to stand on their own land.
     So the ladder keeps stepping while the word itself stays at or above 15 CSS
     px, MEASURED off the canvas rather than assumed from the factor. On the
     1230px page nothing under 1.0 clears it, so that pass is untouched. */
  var NAME_MIN = 15;
  var FINE = [1, 0.9, 0.8, 0.7];
  function fineSteps(sizeAt, cu) {
    return FINE.filter(function (g) { return sizeAt(g) / (cu || 1) >= NAME_MIN; });
  }
  var STEPS = [1.5, 1.35, 1.2, 1.1];
  function ladder(gov, narrow, fine) {
    var steps = STEPS.filter(function (g) { return g <= gov; });
    if (!steps.length || steps[0] !== gov) steps.unshift(gov);
    (fine || []).forEach(function (g) {
      if (g < steps[steps.length - 1]) steps.push(g);
    });
    if (narrow) steps.push(0.92);
    return steps;
  }
  /* THE SIZING SUM CAME HERE FROM dossier_map.js ON 2026-09-20, when the key
     had to ask the same question ahead of time (`reserve` below) and that file
     stood at its 500-line cap. It is the region names' own sum and always was:
     GOV_MIN is the smallest step a governorate name keeps above a town name,
     and the frame's `gov` factor grows with the CANVAS rather than off the 17px
     reading floor - multiplying that floor handed a phone region names a
     quarter of the map wide (345px). Wide canvases reach the frame's factor,
     narrow ones a step. `size` and `ts` are the caller's: the map's base text
     size and the screen/slide step. */
  var GOV_MIN = 1.2;
  function sizeOf(size, u, ts, g) {
    return Math.max(size * Math.min(GOV_MIN, g), 17 * u * ts * g);
  }
  /* THE ANCHOR IS DERIVED, AND A HAND ONE IS ONLY A HINT (2026-09-22).
     MAP_RULES.md rule 10 and Ziv, on the tall west_fronts picture: "the names
     of the counties are in the wrong place... make sure it NEVER happens again
     that they are in wrong places." Three anchors are tried for every name, in
     this order, and each one only if its BOX passes the check's own test -
     centre on the governorate's own land, 85% of the box over it:

       1. the region's OWN point (GEO.labels - geo_labels' interior point, or a
          data\gov_names.json `at` with a written reason beside it);
       2. the record's `gov_anchor`, which is a fit fix and no longer a truth;
       3. the DERIVED point - dossier_map_gov_point.js, the pole of
          inaccessibility of the part of the governorate this frame shows.

     The record's overrides came SECOND because they are exactly what put
     al-Hudaydah, Hajjah and Jazan in the sea: authored for the rim margin and
     for collisions, on a picture whose frame then changed under them. The bare
     ones on west_fronts/west_plain are gone from the record as well.

     A name that finds no spot on its own ground at any size is NOT PRINTED. It
     says so on the console and the picture loses a name - which is the trade
     Ziv asked for: a region name somewhere wrong is worse than none. */
  function nudge(o) {
    var R = D(), Pt = window.DossierMapGovPoint, best = null, soft = null;
    /* WHY A NAME YIELDED, IN ENOUGH DETAIL TO ACT ON (2026-09-22). The counts
       alone said "everything was taken" and nothing about BY WHAT: `hit` keeps
       the first box that blocked the roomiest spot, `frac` the best share of
       its own ground any box reached, and `wide` the widest the word ever was,
       so the console line names the obstacle instead of the tally. */
    o.why = { taken: 0, near: 0, ground: 0, frac: 0, hit: null, wide: 0 };
    var size = 0, w = 0, h = 0;
    /* ONE SPOT, ANSWERED: the fit, or the box that blocked it, or nothing.
       Written as a closure on 2026-09-22 so the SLIDE below can ask the same
       question of a moved box without a second copy of the four tests. */
    var test = function (x, y) {
      var box = { x0: x - w / 2 - 3, y0: y - h / 2 - 2,
                  x1: x + w / 2 + 3, y1: y + h / 2 + 2 };
      var bad = null;
      /* A WORD ALREADY ON THE PICTURE NEEDS A SPACE BESIDE IT, not merely a
         pixel (2026-09-22). `R.overlaps` asks whether two rectangles INTERSECT,
         so a region name came to rest flush against a town's name and read as
         one word with it - "MaribMarib" on west_fronts stretch, and the same
         fault on five more maps. dossier_map_gap.js asks the counter's own
         `apart` for the word boxes and keeps the strict test for the marks, so
         nothing about the clearance round a dot has moved. */
      o.taken.some(function (t) {
        return DossierMapGap.clash(R, box, t) ? ((bad = t), true) : false;
      });
      if (bad) {
        o.why.taken++;
        if (!o.why.hit) o.why.hit = bad;
        return { bad: bad, box: box };
      }
      /* NOT ON A TOWN'S OWN DOT either. The text boxes are in `taken` and
         already miss each other; this is the PIN, which is not, and a region
         name painted across a town's dot reads as that town's own second
         line (rule 6a). It used to be a 32px circle round the anchor and it
         cost the wide slide five region names that had somewhere to stand:
         what matters is whether the dot falls under the WORD. */
      if (o.points.some(function (pt) {
        return pt.q[0] > box.x0 - 6 * o.u && pt.q[0] < box.x1 + 6 * o.u &&
               pt.q[1] > box.y0 - 6 * o.u && pt.q[1] < box.y1 + 6 * o.u;
      })) { o.why.near++; return null; }
      var g = Pt.ground(o.G, o.sid, o.p, o.W, o.H, box);
      if (!Pt.good(g)) {
        o.why.ground++;
        o.why.frac = Math.max(o.why.frac, g.frac);
        return null;
      }
      var hit = { x: x, y: y, box: box, size: size };
      if (o.fill && Pt.onFill(o.G, o.p, o.W, o.H, box) > 0.02) {
        soft = soft || hit;                /* somebody else's fill - last resort */
        return null;
      }
      return hit;
    };
    for (var si = 0; si < o.steps.length && !best; si++) {
      size = o.sizeAt(o.steps[si]);
      w = R.width(o.ctx, o.name, size, 500); h = size * 1.25;
      o.why.wide = Math.max(o.why.wide, Math.round(w));
      for (var ci = 0; ci < o.spots.length && !best; ci++) {
        var r = test(o.spots[ci].x, o.spots[ci].y);
        if (r && !r.bad) { best = r; continue; }
        /* THE COLLISION NUDGE, and it moves the word ALONG ITS OWN LAND
           (2026-09-22, rule 10). A derived spot is the middle of the ground,
           and the thing in the way is usually one 39px mark: sliding the word
           just clear of THAT box - left, right, up, down, whichever still
           stands on the governorate - saves a name that a jump to the next
           sampled spot would have lost. EVERY spot is slid, not just the
           roomiest few: measured on the wide west picture, the cap at eight
           spots cost two names and the whole pass still paints in its second. */
        if (r && r.bad) {
          var b = r.bad, bx = r.box, g = DossierMapGap.step(bx, b);
          [[b.x1 - bx.x0 + g, 0], [b.x0 - bx.x1 - g, 0],
           [0, b.y1 - bx.y0 + 2], [0, b.y0 - bx.y1 - 2]].forEach(function (d) {
            if (best) return;
            var r2 = test(o.spots[ci].x + d[0], o.spots[ci].y + d[1]);
            if (r2 && !r2.bad) best = r2;
          });
        }
      }
    }
    return best || soft;
  }

  /* `gov` is the factor dossier_map.js read off the frame; `o` carries the
     picture itself - its id, its shape, the rectangle it paints into and
     whether the ground taken this round is filled on it. */
  function govLabels(ctx, p, P, u, G, size0, ts, taken, points, names, at,
                     narrow, gov, o) {
    var R = D(), matched = 0, index = idOf(G), opt = o || {}, off = 0;
    var who = (opt.mapId || "?") + " " + (opt.shape || "-");
    var Pt = window.DossierMapGovPoint;
    if (!Pt) throw new Error("dossier_map_gov: dossier_map_gov_point.js is not on the page");
    var W = opt.W || 0, H = opt.H || 0;
    Pt.reset(opt.mapId, opt.shape);
    var sizeAt = function (g) { return sizeOf(size0, u, ts, g); };
    var fine = fineSteps(sizeAt, R.canvasScale() || u);
    var marks = (G.labels && G.labels.features || []).map(function (f) {
      return { name: f.properties.name_he, home: f.properties.set === "yem_adm1" ? 0 : 1,
               span: f.properties.span || 0, c: f.geometry.coordinates,
               props: f.properties };
    }).sort(function (a, b) { return a.home - b.home || b.span - a.span; });
    marks.forEach(function (m) {
      if (!wanted(names, m, index)) return;
      matched++;
      var sid = (m.props || {}).shapeID;
      /* The three anchors, in the order above, and then every other spot on
         the visible ground - most room first, which is how a name NUDGES to
         clear a neighbour without ever leaving its own land. */
      var spots = [], seen = {}, add = function (x, y) {
        var k = Math.round(x) + "," + Math.round(y);
        if (!seen[k]) { seen[k] = true; spots.push({ x: x, y: y }); }
      };
      var hint = m.c && p.inside(m.c[0], m.c[1], -0.2) ? p(m.c[0], m.c[1]) : null;
      if (hint) add(hint[0], hint[1]);
      /* THEN OUTWARD FROM THE MIDDLE, and the middle is the hint when the hint
         stands on this governorate's own ground and the POLE when it does not.
         A nudge is a SMALL move: taken in the order the spots come back in -
         most room first - a blocked name jumped clean across its own ground,
         and the wide picture put Taiz out on the roomy Mocha plain when the
         highlands round its own capital were merely crowded. Walking outward
         from the middle, the name stops at the first free spot instead. */
      var ds = sid ? Pt.spots(G, sid, p, u, W, H) : [];
      var from = ds[0];
      if (hint && sid && Pt.ground(G, sid, p, W, H,
            { x0: hint[0] - 1, y0: hint[1] - 1, x1: hint[0] + 1, y1: hint[1] + 1 }).mid) {
        from = { x: hint[0], y: hint[1] };
      }
      if (from) {
        ds.slice().sort(function (a, b) {
          return Math.hypot(a.x - from.x, a.y - from.y) -
                 Math.hypot(b.x - from.x, b.y - from.y);
        }).forEach(function (s) { add(s.x, s.y); });
      }
      /* AND THE RECORD'S OVERRIDE LAST OF ALL. It was authored for fit, and
         every spot above is derived from the ground itself, so the override is
         reached only where the shapes give nothing - which is the case it was
         written for (the Marib picture, whose Hadramawt and Shabwa anchors both
         fall outside the frame). Measured 2026-09-22: put SECOND, it took the
         wide west picture's Taiz name back onto the Mocha strip the moment a
         town label crowded the highlands. */
      if (at && at[m.name] && p.inside(at[m.name][0], at[m.name][1], -0.2)) {
        add(p(at[m.name][0], at[m.name][1])[0], p(at[m.name][0], at[m.name][1])[1]);
      }
      if (!spots.length) {
        off++;
        return say(who, m.name, "no ground of its own inside this frame");
      }
      /* A LABEL NAMING THE SAME PLACE has already printed the word, so the
         region name standing down costs the reader nothing - that is a
         different thing from losing it, and only the second is reported.
         UNLESS THE MAP ASKED FOR IT BY NAME (2026-09-19). On a picture whose
         SUBJECT is the governorate, the town and the region are two different
         facts and the reader needs both: Ziv, of the Marib objectives map,
         "you didn't write the Marib county". A whitelist is a deliberate list
         of the names this picture prints, so a name on it outranks the
         same-name rule; a map with no whitelist keeps the old behaviour.
         NOT ON THE PHONE, though - `narrow` is the key-panel picture that could
         not split, where rule 7 already trades names for numbers and the word
         is on the canvas once as the town. Measured at 340px: the region name
         took the last free anchor and a REQUIRED town label was dropped. */
      /* A PIN'S NAME OUTRANKS THE WHITELIST (2026-09-26): on a story map the
         bold pin already prints the word, so a same-text region name is the
         word twice beside one mark (dossier_map_pins.js, `named`). */
      var twice = ((!names || narrow) &&
        points.some(function (pt) { return sameName(pt.he, m.name); })) ||
        !!(window.DossierMapPins && DossierMapPins.named &&
           DossierMapPins.named(m.name, opt.mapId));
      if (twice) return;
      /* EVERY SIZE AT EVERY SPOT, biggest first: the name keeps the size the
         frame asked for wherever it can, and steps down the ladder only when
         no spot on its own ground will hold it. Stepping used to be for
         hand-anchored names alone, because a computed anchor had no second
         choice and shrinking it bought nothing; now it has the whole of its
         own visible ground to try, so a step down is what keeps a name that
         would otherwise be lost. */
      var job = { ctx: ctx, G: G, p: p, u: u, W: W, H: H, sid: sid,
                  name: m.name, spots: spots, taken: taken, points: points,
                  fill: !!opt.fill, steps: ladder(gov || 1, narrow, fine),
                  sizeAt: sizeAt };
      var fit = nudge(job);
      if (!fit) {
        off++;
        var b = job.why.hit;
        return say(who, m.name, spots.length + " spot(s) on its own ground x " +
          job.steps.length + " size(s) tried, against " + taken.length +
          " box(es) already on the picture: " + job.why.taken + " lay under one"
          + " of them" + (b ? " (first " + Math.round(b.x1 - b.x0) +
            "x" + Math.round(b.y1 - b.y0) + " at " + Math.round(b.x0) + "," +
            Math.round(b.y0) + ")" : "") + ", " + job.why.near + " under a"
          + " town's dot, " + job.why.ground + " off its own ground (best " +
          Math.round(job.why.frac * 100) + "% of the box on it); the word is up"
          + " to " + job.why.wide + "px wide");
      }
      R.text(ctx, P, m.name, fit.x, fit.y,
             { size: fit.size, color: P.govLabel, halo: 3 * u });
      taken.push(fit.box);
      if (window.DossierMapInk) DossierMapInk.word(fit.box, "region " + m.name);
      Pt.note(opt.mapId, opt.shape,
              { box: fit.box, he: m.name, key: sid || null });
      if (window.DossierMapCheck) DossierMapCheck.add("gov_names", 1);
    });
    if (names && names.length && !matched) {
      console.error("dossier map: gov_names matched no region in GEO.labels - " +
        "the whitelist and the layer disagree about what a region's key is");
    }
    /* SAID ONCE, WITH THE PICTURE'S NAME ON IT. The counter itself is not filed
       here: scripts\dossier_png_tall.py measures every placed box against its
       own polygon from outside (`gov_off_ground`), through placed() below, so
       the painter and the tool that judges it cannot both count and disagree. */
    if (off) {
      console.warn("dossier map " + who + ": " + off + " region name(s) yielded"
        + " rather than print off their own ground");
    }
  }

  /* THE GROUND THESE NAMES WILL NEED, measured before anything is placed
     (2026-09-20). The key box is measured first and painted last, and until now
     nothing told it that a whitelisted region name has exactly one anchor and
     no second choice: the square Marib list picture's seven-row key stood on
     al-Jawf's anchor and that name - the picture's own subject - was dropped
     with a console line, while the wide shape of the same map printed it.

     Measured at the LAST step of the ladder, the smallest the name may shrink
     to, so the key is asked to give up only what the name really needs. The
     same-name stand-down is NOT applied here: the labels have not been placed
     yet when this is asked, and reserving a little ground for a name that later
     yields costs the key nothing it can use.

     IT RESERVES THE SPOT THE NAME WILL ACTUALLY TAKE (2026-09-22): the first of
     the same three anchors whose box stands on the governorate's own ground.
     Nothing is placed yet, so no collision can move the name off it. */
  function reserve(ctx, p, u, G, size0, ts, names, at, gov, W, H) {
    var R = D(), out = [], index = idOf(G), Pt = window.DossierMapGovPoint;
    if (!names || !names.length || !Pt) return out;
    ((G.labels && G.labels.features) || []).forEach(function (f) {
      var q0 = f.properties || {};
      var m = { name: q0.name_he, c: f.geometry.coordinates, props: q0 };
      if (!wanted(names, m, index)) return;
      var sid = q0.shapeID, spots = [];
      [m.c, at && at[m.name]].forEach(function (c) {
        if (c && p.inside(c[0], c[1], -0.2)) {
          var q = p(c[0], c[1]);
          spots.push({ x: q[0], y: q[1] });
        }
      });
      (sid ? Pt.spots(G, sid, p, u, W, H) : []).forEach(function (s) {
        spots.push(s);
      });
      var steps = ladder(gov || 1);
      var fit = nudge({ ctx: ctx, G: G, p: p, u: u, W: W, H: H, sid: sid,
                        name: m.name, spots: spots, taken: [], points: [],
                        fill: false, steps: [steps[steps.length - 1]],
                        sizeAt: function (g) { return sizeOf(size0, u, ts, g); } });
      if (fit) out.push(fit.box);
    });
    return out;
  }

  /* WHAT THIS PICTURE PRINTED, for the picture check: every region name's box
     in the map band's own pixels and the shapeID of the ground it claims to
     stand on (scripts\dossier_png_tall.py, GOV_JS). The painter hands the
     boxes over directly rather than have the tool wrap DossierMapInk.word. */
  function placed(mapId, shape) {
    var Pt = window.DossierMapGovPoint;
    return Pt ? Pt.placed(mapId, shape) : [];
  }

  return { govLabels: govLabels, reserve: reserve, placed: placed };
})();

window.DossierMapGov = DossierMapGov;
