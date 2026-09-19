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
  function govLabels(ctx, p, P, u, G, size, taken, points, names, at) {
    var R = D(), matched = 0, index = idOf(G);
    var marks = (G.labels && G.labels.features || []).map(function (f) {
      return { name: f.properties.name_he, home: f.properties.set === "yem_adm1" ? 0 : 1,
               span: f.properties.span || 0, c: f.geometry.coordinates,
               props: f.properties };
    }).sort(function (a, b) { return a.home - b.home || b.span - a.span; });
    marks.forEach(function (m) {
      if (!wanted(names, m, index)) return;
      matched++;
      var c = (at && at[m.name]) || m.c;
      if (!p.inside(c[0], c[1], -0.2)) return say(m.name, "off the frame");
      var q = p(c[0], c[1]);
      /* A LABEL NAMING THE SAME PLACE has already printed the word, so the
         region name standing down costs the reader nothing - that is a
         different thing from losing it, and only the second is reported. */
      var twice = points.some(function (pt) { return sameName(pt.he, m.name); });
      if (twice) return;
      if (points.some(function (pt) {
        return Math.hypot(pt.q[0] - q[0], pt.q[1] - q[1]) < 32 * u;
      })) return say(m.name, "a label stands on its anchor");
      var w = R.width(ctx, m.name, size, 500), h = size * 1.25;
      var box = { x0: q[0] - w / 2 - 3, y0: q[1] - h / 2 - 2, x1: q[0] + w / 2 + 3, y1: q[1] + h / 2 + 2 };
      if (taken.some(function (t) { return R.overlaps(box, t); })) {
        return say(m.name, "no room at its anchor - author gov_anchor for it");
      }
      R.text(ctx, P, m.name, q[0], q[1], { size: size, color: P.govLabel, halo: 3 * u });
      taken.push(box);
      if (window.DossierMapInk) DossierMapInk.word(box, "region " + m.name);
      if (window.DossierMapCheck) DossierMapCheck.add("gov_names", 1);
    });
    if (names && names.length && !matched) {
      console.error("dossier map: gov_names matched no region in GEO.labels - " +
        "the whitelist and the layer disagree about what a region's key is");
    }
  }

  return { govLabels: govLabels };
})();

window.DossierMapGov = DossierMapGov;
