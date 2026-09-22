/* THE NAMES ON A DOSSIER MAP: the map's own place names, and the Hebrew name of
   every active-fighting zone set inside its band where the band can hold it and
   beside it where it cannot.

   The zone names came out of dossier_map_extra.js into dossier_map_legend.js on
   2026-09-16 and out of that file on 2026-09-17, when the legend's hard-block
   corner scoring and the road swatch took it past the 500-line cap. THE PLACE
   NAMES JOINED THEM ON 2026-09-18, out of dossier_map.js, which was at its own
   cap on the day the required-name search had to be written: they are the same
   job - fitting Hebrew words round what is already on the picture - and the
   only two kinds of name a map paints for itself, so one file holds the whole
   question of what is named and what is not. Nothing about either search moved
   with the code; both grew a whitelist and the place names grew the
   eight-anchor search a required name gets.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapZoneNames = { zoneNames, placeLabels, paintLabels }

   dossier_map.js merges it into the one painter object the paint pass is
   handed, so `R.zoneNames(...)` there reads as it did before the split. The
   shared helpers come from DossierMapDraw at call time; those in another
   painter file (the place mark, its clearance) come in as `R`, the merged
   object, because this file is one of its own members. */
"use strict";

var DossierMapZoneNames = (function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_zone_names: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  var SIDES = ["n", "s", "e", "w"];
  /* Where a front's name may stand when its belt cannot hold it: eight sides,
     and the same eight again further out. The last ring is 34u - 34px on the
     page, 68 on a slide - which is still beside the belt and nowhere near the
     next one. */
  var AROUND = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
  var RINGS_OUT = [0, 12, 22, 34];
  function box(x0, y0, x1, y1) { return { x0: x0, y0: y0, x1: x1, y1: y1 }; }

  /* Heights across a shape, tried widest-run first. A name may reach a little
     past the ground it names (FIT) - cartography does that everywhere - but a
     run much narrower than the word means the shape is too small at this scale,
     and then this returns null and the caller sets the name beside it. */
  var LEVELS = [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65], FIT = 0.8;

  /* The widest run of the shape's OWN ground at one height, and the midpoint of
     it - an interior point by construction, so the name lands inside the shape
     however bent it is (a centroid does not: a crescent's is outside it). */
  function fitInRing(ring, w, h, W, H, taken) {
    var R = D();
    var ys = ring.map(function (q) { return q[1]; });
    var top = Math.min.apply(null, ys), bottom = Math.max.apply(null, ys);
    return LEVELS.map(function (t) {
      var y = top + (bottom - top) * t, xs = [];
      for (var i = 0; i < ring.length - 1; i++) {
        var a = ring[i], b = ring[i + 1];
        if ((a[1] > y) !== (b[1] > y)) {
          xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
        }
      }
      xs.sort(function (m, n) { return m - n; });
      var span = 0, cx = 0;
      for (var k = 0; k + 1 < xs.length; k += 2) {
        if (xs[k + 1] - xs[k] > span) { span = xs[k + 1] - xs[k]; cx = (xs[k] + xs[k + 1]) / 2; }
      }
      return { x: cx, y: y, span: span, box: box(cx - w / 2, y - h / 2, cx + w / 2, y + h / 2) };
    }).sort(function (a, b) { return b.span - a.span; }).filter(function (s) {
      return s.span >= w * FIT && s.box.x0 >= 0 && s.box.x1 <= W &&
        s.box.y0 >= 0 && s.box.y1 <= H &&
        !taken.some(function (t) { return DossierMapGap.clash(R, s.box, t); });
    })[0] || null;
  }

  /* The zones the legend calls שטח לחימה פעיל carry their own names, read from
     GEO.fronts (data\fronts.json) at paint time - never from a label list, so
     whatever that file says is what gets named and nobody has to remember to
     edit a second one.

     Every front carries a REAL HEBREW NAME as a required field, which is why
     this has no "unnamed" branch. It used to read a contested DISTRICT's
     name_he and fall back to a gain's, leaving a contested district that was
     not a gain with no name at all - geo.js carries geoBoundaries' English
     shapeName, and there is no English on this map ever (CLAUDE.md).

     No dot: this names an area, exactly as a country name does, and it is set a
     weight lighter than a town so the two never read as the same kind of thing.

     A name goes INSIDE its shape when the shape can hold it, and BESIDE it when
     it cannot. The inside-only version was written when a front was a whole
     district; since 2026-09-14 a front is a narrow band of sourced contact about
     12 km wide sitting on the control line, and no Hebrew name fits inside a
     band that thin at any scale this map is drawn at.

     And a shape whose projected bounding box is under 40*u across its diagonal
     keeps quiet: on the overview the frame spans 14 degrees of longitude, where
     the smaller bands are a few pixels of hatching and a name on them would
     shout louder than the thing it names.

     This is the PLAIN picture's treatment. The notes variant in
     dossier_map_extra.js replaces it outright - there the name heads a callout
     and the shape is named whatever its size, because a front with nothing
     written at it is the one thing that picture exists to prevent.

     AND `zone_text: false` SILENCES THIS TOO (2026-09-17). Ziv asked the strait
     picture for marks only, no text on the map except place names, and a front
     name is not a place name: "front of al-Qadhah" describes what is happening
     on ground the map already names. The flag came in for the map's own zone
     labels (dossier_map_routes.js) and reached only those, so three front names
     stayed on the picture, one clipped by the right rim at 2560. One flag,
     every painted name that is not a place: the diamonds and the hatching stay,
     because a mark is not a word. */
  /* ONLY THE FRONTS THIS MAP IS ABOUT, AND EACH NAME ONCE (2026-09-18). Every
     front in frame was named until that day. Ziv, of a heat map of the al-Jawf
     and Marib fighting: "don't put random information that is not needed", and
     "if you're talking about al-Jawf, what is happening in Taiz is not
     relevant." So a record may carry `front_names`, a whitelist of front ids,
     and then those are the only names printed. THE ZONE ITSELF IS UNTOUCHED -
     the hatch, the outline and the red diamond are painted in ground() and say
     a fight is happening there; this only decides whether the words are worth
     the room.

     AND A NAME THE MAP HAS ALREADY PRINTED IS NOT PRINTED TWICE. A front is
     named after the place it is being fought at, so on the heat maps "אל-יתמה"
     stood as a town label and again as a zone name a few pixels away, which
     reads as a stutter rather than two facts. A front name matches a town when
     it IS that name, or that name with a leading "front of" / "edge of" /
     "border of" - never looser, because a compound name ("the al-Wazi'iyah -
     al-Madaribah border") says more than the town does and has to survive. */
  var LEAD = /^(חזית|גבול|שולי|מוקד)\s+/;
  function bare(s) {
    return String(s || "").replace(LEAD, "").replace(/^אל-/, "").trim();
  }
  function printed(points, name) {
    var key = bare(name);
    return !!key && (points || []).some(function (pt) { return bare(pt.he) === key; });
  }
  function onList(names, props) {
    if (!names) return true;
    return names.some(function (k) {
      k = String(k).trim();
      return k === props.id || k === props.name_he;
    });
  }
  function zoneNames(ctx, p, P, u, W, H, G, size, taken, map, points) {
    if (map && map.zone_text === false) return;
    var R = D(), names = map && map.front_names, Gap = DossierMapGap;
    ((G.fronts && G.fronts.features) || []).forEach(function (f) {
      var name = (f.properties || {}).name_he;
      if (!name) return;
      if (!onList(names, f.properties || {}) || printed(points, name)) return;
      var geom = f.geometry || {}, ring = null, area = 0;
      var polys = geom.type === "Polygon" ? [geom.coordinates]
        : geom.type === "MultiPolygon" ? geom.coordinates : [];
      polys.forEach(function (poly) {
        var r = poly[0].map(function (c) { return p(c[0], c[1]); }), a = 0;
        for (var i = 0; i < r.length - 1; i++) {
          a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
        }
        a = Math.abs(a) / 2;
        if (a > area) { area = a; ring = r; }
      });
      if (!ring) return;
      var xs = ring.map(function (q) { return q[0]; });
      var ys = ring.map(function (q) { return q[1]; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      var bw = x1 - x0, bh = y1 - y0;
      if (Math.sqrt(bw * bw + bh * bh) < 40 * u) return;
      var spot = fitInRing(ring, R.width(ctx, name, size, 500), size * 1.25, W, H, taken);
      if (spot) {
        R.text(ctx, P, name, spot.x, spot.y, { size: size, weight: 500, halo: 3 * u });
        taken.push(spot.box);
        if (window.DossierMapInk) DossierMapInk.word(spot.box, "front " + name);
        if (window.DossierMapCheck) DossierMapCheck.add("front_names", 1);
        return;
      }
      /* Beside the band: from the middle of its bounding box, cleared by half
         that box on the axis it is leaving, so the name sits off the hatching
         rather than along it. A side that runs off the canvas or lands on a name
         already placed is passed over.

         FOUR SIDES AT ONE DISTANCE WAS NOT A SEARCH (2026-09-19). The Sirwah
         front is whitelisted on both Marib pictures and printed on neither:
         its four sides all land in the Marib cluster, and a name with no free
         side was simply dropped. So the sides are eight now, and they are
         tried again a little further out - still adjacent to the belt, which
         is what makes it read as that belt's name, but far enough to clear a
         town name standing on top of it. A name that fails every ring is still
         dropped: a front name is not a required label, and the hatching, the
         diamond and the level chip all say the fight is there without it. */
      var mx = (x0 + x1) / 2, my = (y0 + y1) / 2, spec = null;
      RINGS_OUT.some(function (extra) {
        return AROUND.some(function (a) {
          var wide = a.indexOf("e") >= 0 || a.indexOf("w") >= 0;
          var tall = a.indexOf("n") >= 0 || a.indexOf("s") >= 0;
          var clear = (wide && tall ? Math.max(bw, bh) / 2
                       : tall ? bh / 2 : bw / 2) + extra * u;
          var s = R.place(ctx, name, mx, my, a, size, clear, u, W, H), b = s.box;
          var free = !taken.some(function (t) { return Gap.clash(R, b, t); }) &&
            b.x0 >= 0 && b.x1 <= W && b.y0 >= 0 && b.y1 <= H;
          if (free) spec = s;
          return free;
        });
      });
      /* A WHITELISTED FRONT NAME THAT FOUND NO FREE SIDE IS COUNTED, not
         silent (2026-09-19). Ziv, of the wide Marib picture: the Raghwan front
         is on that record's list and did not print, although the Houthi ground
         west of the line was empty. It is INVENTORY and not an accusation - the
         hatching, the diamond and the level chip all say the fight is there
         without the words, and the reason is usually that the belt sits inside
         a cluster of objectives. But a number on the dump's own line is what
         makes it noticeable at all. */
      if (!spec) {
        if (window.DossierMapCheck) DossierMapCheck.add("front_names_unplaced", 1);
        console.warn("dossier map: the front name " + name +
          " is on this map's list and found no free side of its belt");
        return;
      }
      R.text(ctx, P, spec.str, spec.x, spec.y, { size: size, weight: 500,
        halo: 3 * u, align: spec.align, baseline: spec.baseline });
      taken.push(spec.box);
      if (window.DossierMapInk) DossierMapInk.word(spec.box, "front " + name);
      if (window.DossierMapCheck) DossierMapCheck.add("front_names", 1);
    });
  }

  /* ---- the map's own place names ---------------------------------------------- */

  /* A label keeps its authored side while that side is free; when two names
     would overprint (measured at 600px: Perim over Aden) it tries the other
     sides, and if none is free it is DROPPED - a name nobody can read is worse
     than a mark with its name in the list under the map.

     THAT BARGAIN DOES NOT HOLD FOR A NAME THE MAP TALKS ABOUT (2026-09-18).
     al-Hazm was authored on the Marib map, is named in its list of objectives,
     and was dropped in silence when its one authored side was occupied. Ziv:
     "you're talking about al-Hazm, the capital of al-Jawf, and you don't show
     it on the map. If you're talking about something, you need to show it on
     the map." So a label carrying `req` (baked upstream from the map's own
     prose and its notes) is placed FIRST, before any optional name and before
     the region names, is offered all eight sides and then the same eight a
     little further out, is never taken off by the narrow-canvas rule that
     silences second-rank names - and if it STILL cannot be placed it is
     reported to the picture check and named in the console. Never again in
     silence. An optional name still yields, which is what makes the room. */
  var OPPOSITE = { e: "w", w: "e", n: "s", s: "n",
                   ne: "sw", sw: "ne", nw: "se", se: "nw" };
  var ANCHORS = ["e", "w", "n", "s", "ne", "nw", "se", "sw"];
  /* Extra clearance, in u, for the rounds after the first a required name
     gets: the same eight sides, each a little further out. Three rings until
     2026-09-19, when every mark's rectangle started being reserved before any
     name was placed and the tight Marib cluster ran out of room - two required
     names went unplaced. Nearest is still tried first. */
  /* THE RINGS ARE CAPPED BY ADJACENCY NOW, NOT BY THIS LIST (2026-09-19). They
     ran to 86u until Ziv looked at the wide Marib picture: Tadween's name had
     reached across another connector's lane to sit beside the Raghwan front's
     red diamond, and read as that diamond's name. A name too far from its mark
     to be read as its mark's has not been saved from being dropped - it has
     been moved somewhere it says something false. So every candidate is
     measured by `DossierMapInk.adjacent`: at most 0.6 of a text height from its
     own mark, and nearer that mark than any other. The far rings cannot pass
     it; what replaces them is the numbered disc glued to the mark
     (`placeLabels` below). MAP_RULES.md rule 8. */
  var RINGS = [0, 8, 16, 26, 38];

  function sides(l, required) {
    if (!required) return [l.anchor, OPPOSITE[l.anchor], "n", "s", "e", "w"];
    return [l.anchor, OPPOSITE[l.anchor]].concat(ANCHORS);
  }
  /* A REQUIRED NAME ALREADY ON THE PICTURE IS NOT A DROPPED ONE (2026-09-19).
     The crossing map labels the PORT and the COUNTRY "Djibouti", and its
     caption promises the word once; at 340 CSS px on a phone only one of the
     two fits, and a reader is not being sent hunting for something that is
     there. The test is `check_prose`'s own (scripts\dossier_maps_names.py): a
     name is shown when it appears INSIDE a name the picture printed. What is
     still a drop, and still fails the picture, is a word that is nowhere. */
  /* AND THE VERDICT WAITS FOR THE FINISHED PICTURE (2026-09-19). Region names
     and front names are painted after this pass and can carry the word: the
     governorate name מארב stands down only while the town label is there, so
     on a 390px phone, where the cluster has no room for the town name, the
     region name prints instead. dossier_map_ink.js holds the name until every
     word is down, then drops or forgives it - same test, one layer later. */
  function lost(mapId, l, out, k) {
    var D = window.DossierMapDrop, he = String(l.he || ""), key = l.place || he || "(unnamed)";
    if (he && out.some(function (o) { return o.spec.str.indexOf(he) >= 0; })) {
      console.warn("dossier map " + mapId + ": " + key + " is not printed a " +
        "second time - its name is already on the picture");
      if (window.DossierMapCheck) DossierMapCheck.add("req_labels", 1);
      return;
    }
    if (window.DossierMapInk) return D && D.ring(k, l), DossierMapInk.pending(key, he);
    console.error("dossier map " + mapId + ": required label " + key +
      " could not be placed: no free anchor");
    if (window.DossierMapCheck) DossierMapCheck.drop(key);
  }

  /* THE GROUND EVERY MARK TAKES IS CLAIMED BEFORE A WORD IS PLACED, and that
     reservation lives in dossier_map_ink.js with the check it feeds
     (`DossierMapInk.reserve`, called at the top of placeLabels). It is not in
     this file because it is not about names: it is about the pins, squares,
     triangles and diamonds the names must now walk round. OPTIONAL at runtime,
     like the check itself - without that file the placement is exactly what it
     was before 2026-09-19, and so are the faults it found. */
  function reserve(ctx, p, R, u, map, o) {
    o.markOf = []; o.markBox = [];
    if (window.DossierMapInk) DossierMapInk.reserve(p, R, u, map, o);
  }

  /* Places one name, or answers FALSE when a required one found no anchor in
     `rings` - the caller decides whether that is a second round or a loss. */
  function oneLabel(ctx, p, P, R, u, l, o, out, rings) {
    var W = o.W, H = o.H, required = !!l.req, D = window.DossierMapDrop;
    if (!p.inside(l.lon, l.lat, 0)) {
      /* Off the frame is a FRAMING decision, not a placement failure - a square
         crop loses the two ends of a wide picture by design - so it is said out
         loud and left to the build's own check, which knows the frames. */
      if (required) {
        console.warn("dossier map " + o.mapId + ": required label " +
          (l.place || l.he) + " is outside this frame");
      }
      return true;
    }
    if (!required && (W < 700 || o.notesOn) && l.tier === 2) return true;
    var q = p(l.lon, l.lat), isGain = !!o.gainKeys[l.place], spec = null;
    /* `kind` picks the mark - objective, ridge, port or town - and the name's
       gap is read off the SAME number, so the two cannot disagree. */
    var markR = R.markClear(o.pinR, l.kind);
    /* A COUNTRY IS SET IN ITS OWN STYLE (2026-09-17, Ziv: "show the names of
       the other countries, including Somaliland"): larger than the map's own
       names, letter-spaced, no mark, and - like any anchor "c" - centred on its
       point and dropped rather than moved or cut. The size comes off the map's
       BASE size, never the clean one: see COUNTRY_TEXT. */
    var country = l.kind === "country";
    var quiet = country || l.anchor === "c";
    var lSize = country ? o.size * R.COUNTRY_TEXT : o.labelSize;
    var lSpace = country ? lSize * R.COUNTRY_SPACE : 0;
    /* An ISLAND gain on the overview is drawn as a 7px ring by gains(); the
       name clears that ring rather than the pin inside it. */
    var clear = isGain ? Math.max(markR, 7 * u) : markR;
    /* ITS OWN MARK IS NOT IN ITS WAY. Every mark's rectangle is reserved before
       any name is placed (dossier_map_ink.js), and that rectangle is a little
       WIDER than the gap `clear` holds the name at - so counting a name's own
       pin against it pushed every name on every picture one ring further out,
       and in the Marib cluster two required names then had nowhere left at all.
       The gap to its own dot is what `clear` is for; the reservation is about
       everybody else's. */
    var kOwn = o.markOf ? o.markOf.indexOf(l) : -1;
    var own = kOwn >= 0 ? o.markBox[kOwn] : null;
    /* What it may come as close to as `clear` allows and no closer: its own
       dot's clearance circle, `mark: true` so the gap test reads it as a MARK.
       Testing the RESERVED box instead let no name sit at its first anchor;
       skipping the mark let one sit ON its own dot (al-Labanat, same hour). */
    var ownClear = { x0: q[0] - clear, y0: q[1] - clear, mark: true,
                     x1: q[0] + clear, y1: q[1] + clear };
    /* THE PHONE'S LIST MAP PAINTS THE MARK AND ITS NUMBER AND NOT THE NAME
       (2026-09-19). Under the width a key panel needs, the sentences move to
       the HTML list under the canvas, numbered the same way - so a name here
       would be the same word twice, and at 340 CSS px the nine objectives
       crowded each other until two of them were dropped outright. The mark is
       still painted and its disc is glued to it (dossier_map_number.js), so a
       required place is SHOWN by its number. MAPS_TAB.md, "On a phone". */
    if (o.numbersOnly && o.numbersOnly[l.place]) {
      if (!quiet && l.pin !== false) R.mark(ctx, P, q[0], q[1], markR, u, l.kind);
      if (window.DossierMapCheck) {
        DossierMapCheck.add(required ? "req_labels" : "labels", 1);
      }
      return true;
    }
    /* ADJACENT OR NOT AT ALL (2026-09-19, MAP_RULES.md rule 8). Every side is
       offered, EAST INCLUDED - the earlier "never east of the mark" was a rule
       about the lanes, written before the lanes were reserved - but a candidate
       that does not touch its own mark, or that touches somebody else's more
       closely, is refused however free the ground is. FREE now means a SPACE
       beside another WORD and the old strict test round a MARK (gap.js). */
    (((required || W >= 700) && !quiet) ? rings : [0]).some(function (extra) {
      return (quiet ? ["c"] : sides(l, required)).some(function (a) {
        var s = R.place(ctx, l.he, q[0], q[1], a, lSize, clear + extra * u,
          u, W, H, lSpace);
        var b = s.box, free = !o.taken.some(function (t) {
          return DossierMapGap.clash(R, b, t === own ? ownClear : t);
        }) &&
          (!quiet || (b.x0 >= 0 && b.x1 <= W && b.y0 >= 0 && b.y1 <= H)) &&
          (quiet || !window.DossierMapInk ||
           DossierMapInk.adjacent(b, own, b.y1 - b.y0));
        if (free) spec = s;
        return free;
      });
    });
    /* AND AN OPTIONAL ONE THAT LOSES IS SAID OUT LOUD, AND KEEPS ITS DOT. */
    if (!spec) return required ? false : !D || D.lost(l, out, [ctx, p, P, R, u, o]);
      /* A PIN under every town and port, the GAINS INCLUDED - a disc of the
       ground colour under a dot of the ink, so it reads over violet, over
       either side's territory and over the sea and adds no hue. ONLY on real
       towns and ports: an island, the strait and a country name are areas with
       no one pixel, so they carry `pin: false` or anchor "c". Ziv's words, and
       why the mark went 4.2 -> 3.0, are in DOSSIER_LAYERS.md, "Labels". */
    if (!quiet && l.pin !== false) R.mark(ctx, P, q[0], q[1], markR, u, l.kind);
    o.taken.push(spec.box);
    out.push({ pt: q, spec: spec, quiet: quiet, place: l.place || l.he,
               markRect: own });
    if (window.DossierMapCheck) {
      DossierMapCheck.add(required ? "req_labels" : "labels", 1);
    }
    return true;
  }

  /* The places this picture can name WITHOUT a name on the map: every place
     that owns a numbered row. The number is glued to the mark, and the row -
     beside the picture, under it, or in the HTML list on a phone - carries the
     name, so the reader can still find the place.

     IT USED TO BE THE CONNECTED PICTURES ONLY, because a displaced disc could
     land anywhere and named nothing. Since 2026-09-19 a disc that stands in for
     a name is glued to its own MARK (dossier_map_number.js), so the square
     download and the phone can make the same trade the wide picture does -
     which is the trade rule 8 asks for in place of a name printed far away. */
  function rowsOf(map) {
    if (!map || (map.key !== "panel" && map.key !== "callouts")) return null;
    var out = {};
    (map.notes || []).forEach(function (n) { out[n.place] = true; });
    return out;
  }

  /* Every name MEASURED and its ground claimed, and none of them painted: the
     ink goes down after the notes and the callouts, exactly as it did when this
     loop lived in dossier_map.js, so nothing about what sits on top changed.
     What the caller gets back is the list to paint and the points the region
     names and the front names test themselves against. */
  function placeLabels(ctx, p, P, R, u, map, o) {
    var out = [], list = (map.labels || []), late = [], only = {}, some = false;
    reserve(ctx, p, R, u, map, o);
    (o.numbersOnly ? Object.keys(o.numbersOnly) : []).forEach(function (k) {
      only[k] = true; some = true;
    });
    list.filter(function (l) { return !!l.req; })
      .concat(list.filter(function (l) { return !l.req; }))
      .forEach(function (l) {
        if (!oneLabel(ctx, p, P, R, u, l, o, out, RINGS)) late.push(l);
      });
    var rows = rowsOf(map);
    late.forEach(function (l) {
      /* THE NUMBER IS THE NAMING, when no adjacent spot will hold the word.
         This place owns a numbered row, so the picture draws the MARK, glues
         that row's disc to it and counts the place as shown - never a name
         printed somewhere it would be read as another mark's. A place with NO
         row still fails: nothing else on the picture would name it. */
      if (rows && rows[l.place]) {
        var keep = o.numbersOnly;
        o.numbersOnly = rows;
        var got = oneLabel(ctx, p, P, R, u, l, o, out, RINGS);
        o.numbersOnly = keep;
        if (got) { only[l.place] = true; some = true; return; }
      }
      lost(o.mapId, l, out, [ctx, p, P, R, u, o]);
    });
    return { labels: out, numbersOnly: some ? only : null,
             points: out.map(function (l) {
               return { q: l.pt, he: l.spec.str };
             }) };
  }
  function paintLabels(ctx, P, R, u, labels) {
    var I = window.DossierMapInk;
    labels.forEach(function (l) {
      var s = l.spec;
      R.text(ctx, P, s.str, s.x, s.y, { size: s.size, weight: l.quiet ? 500 : 600,
        halo: 3 * u, align: s.align, baseline: s.baseline, spacing: s.spacing,
        color: l.quiet ? P.govLabel : null });
      if (I) I.word(s.box, l.place || s.str, l.markRect);
    });
    /* AND THE DOT IS STILL THERE TO BE SEEN. This is the last name a map
       paints, so every word on the picture is now measured and a pin buried
       under one can be named rather than guessed at. `label_without_pin` is an
       accusation and not inventory: the picture fails on it
       (scripts\dossier_png_dump.py), exactly as a dropped required label does.
       Ziv, 2026-09-19, of al-Hazm on all four Marib pictures: the name printed
       with no dot, so the reader could not tell where the town was. */
    if (!I) return;
    labels.forEach(function (l) {
      if (!l.markRect) return;
      var on = I.covered(l.markRect, l.spec.box);
      if (!on.length) return;
      if (window.DossierMapCheck) DossierMapCheck.add("label_without_pin", 1);
      console.error("dossier map: the mark under " + l.place +
        " is buried by " + on.join(", "));
    });
  }

  /* MOVED OUT: THE REGION NAMES left for dossier_map_gov.js on 2026-09-19, at
     this file's 500-line cap - that search, its whitelist matching and the
     per-map anchor override are all there. dossier_map.js merges both files
     into one painter object, so `R.govLabels(...)` reads as it always did. */
  return { zoneNames: zoneNames, placeLabels: placeLabels,
           paintLabels: paintLabels };
})();
window.DossierMapZoneNames = DossierMapZoneNames;
