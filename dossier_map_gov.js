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
  function say(name, why) {
    console.warn("dossier map: region " + name + " is on gov_names and was not"
      + " printed - " + why);
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
  var STEPS = [1.5, 1.35, 1.2, 1.1];
  function ladder(gov) {
    var steps = STEPS.filter(function (g) { return g <= gov; });
    if (!steps.length || steps[0] !== gov) steps.unshift(gov);
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
  /* `gov` is the factor dossier_map.js read off the frame. */
  function govLabels(ctx, p, P, u, G, size0, ts, taken, points, names, at,
                     narrow, gov) {
    var R = D(), matched = 0, index = idOf(G);
    var sizeAt = function (g) { return sizeOf(size0, u, ts, g); };
    var marks = (G.labels && G.labels.features || []).map(function (f) {
      return { name: f.properties.name_he, home: f.properties.set === "yem_adm1" ? 0 : 1,
               span: f.properties.span || 0, c: f.geometry.coordinates,
               props: f.properties };
    }).sort(function (a, b) { return a.home - b.home || b.span - a.span; });
    marks.forEach(function (m) {
      if (!wanted(names, m, index)) return;
      matched++;
      var own = !!(at && at[m.name]);
      var c = own ? at[m.name] : m.c;
      if (!p.inside(c[0], c[1], -0.2)) return say(m.name, "off the frame");
      var q = p(c[0], c[1]);
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
      var twice = (!names || narrow) &&
        points.some(function (pt) { return sameName(pt.he, m.name); });
      if (twice) return;
      if (points.some(function (pt) {
        return Math.hypot(pt.q[0] - q[0], pt.q[1] - q[1]) < 32 * u;
      })) return say(m.name, "a label stands on its anchor");
      var steps = own ? ladder(gov || 1) : [gov || 1], fit = null, size = 0;
      for (var i = 0; i < steps.length && !fit; i++) {
        size = sizeAt(steps[i]);
        var w = R.width(ctx, m.name, size, 500), h = size * 1.25;
        var box = { x0: q[0] - w / 2 - 3, y0: q[1] - h / 2 - 2, x1: q[0] + w / 2 + 3, y1: q[1] + h / 2 + 2 };
        if (!taken.some(function (t) { return R.overlaps(box, t); })) fit = box;
      }
      if (!fit) {
        return say(m.name, "no room at its anchor even at the smallest step -"
          + " author gov_anchor for it");
      }
      R.text(ctx, P, m.name, q[0], q[1], { size: size, color: P.govLabel, halo: 3 * u });
      taken.push(fit);
      if (window.DossierMapInk) DossierMapInk.word(fit, "region " + m.name);
      if (window.DossierMapCheck) DossierMapCheck.add("gov_names", 1);
    });
    if (names && names.length && !matched) {
      console.error("dossier map: gov_names matched no region in GEO.labels - " +
        "the whitelist and the layer disagree about what a region's key is");
    }
  }

  /* THE GROUND THESE NAMES WILL NEED, measured before anything is placed
     (2026-09-20). The key box is measured first and painted last, and until now
     nothing told it that a whitelisted region name has exactly one anchor and
     no second choice: the square Marib list picture's seven-row key stood on
     al-Jawf's anchor and that name - the picture's own subject - was dropped
     with a console line, while the wide shape of the same map printed it.

     Measured at the LAST step of the ladder, the smallest the name may shrink
     to, so the key is asked to give up only what the name really needs; a name
     with no authored anchor cannot step at all, so its one size is reserved.
     The same-name and label-on-anchor stand-downs are NOT applied here: the
     labels have not been placed yet when this is asked, and reserving a little
     ground for a name that later yields costs the key nothing it can use. */
  function reserve(ctx, p, u, G, size0, ts, names, at, gov) {
    var R = D(), out = [], index = idOf(G);
    if (!names || !names.length) return out;
    ((G.labels && G.labels.features) || []).forEach(function (f) {
      var q0 = f.properties || {};
      var m = { name: q0.name_he, c: f.geometry.coordinates, props: q0 };
      if (!wanted(names, m, index)) return;
      var own = !!(at && at[m.name]);
      var c = own ? at[m.name] : m.c;
      if (!p.inside(c[0], c[1], -0.2)) return;
      var q = p(c[0], c[1]);
      var steps = own ? ladder(gov || 1) : [gov || 1];
      var size = sizeOf(size0, u, ts, steps[steps.length - 1]);
      var w = R.width(ctx, m.name, size, 500), h = size * 1.25;
      out.push({ x0: q[0] - w / 2 - 3, y0: q[1] - h / 2 - 2,
                 x1: q[0] + w / 2 + 3, y1: q[1] + h / 2 + 2 });
    });
    return out;
  }

  return { govLabels: govLabels, reserve: reserve };
})();

window.DossierMapGov = DossierMapGov;
