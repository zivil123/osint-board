/* dossier_map_strikes_data.js - the strike TALLY behind the strike-tally map,
   written first: the painter (dossier_map_strikes.js) and the list under the
   canvas (dossier_map_strikes_list.js) both read this and nothing else.
   `tally(map)` reads the MERGED events on window.DATA.attacks, keeps those
   whose `place_key` is one of `map.strikes.places` and whose `date` is on or
   after `map.strikes.since`, and groups them by place NORTH TO SOUTH, so the
   pins and the list's rows read down the page in one order. The Hebrew
   is the main chat's, from scratchpad/najran_city_copy.json. */
(function () {
  "use strict";

  /* The Hebrew carries a gershayim, which is an ASCII double quote: these
     literals were produced by json.dumps from the copy file, never typed. */
  var PH = { category: {
      drone: "כטב\"ם", missile: "טיל בליסטי",
      both: "טיל בליסטי וכטב\"ם",
      unspecified: "נשק לא צוין"
    }, key_count: "המספר ליד הסיכה – מספר התקיפות על היעד" };

  var CATS = ["drone", "missile", "both", "unspecified"];

  /* The raw `weapon` array: a rocket motor is a MISSILE, `uav` is a DRONE,
     both is `both`, and an event naming neither is UNSPECIFIED, never guessed. */
  var MISSILE = { ballistic_missile: 1, cruise_missile: 1, hypersonic_missile: 1 };
  function catOf(weapons) {
    var missile = false, drone = false;
    (weapons || []).forEach(function (one) {
      if (MISSILE[one]) missile = true;
      if (one === "uav") drone = true;
    });
    if (missile && drone) return "both";
    return missile ? "missile" : drone ? "drone" : "unspecified";
  }

  function attacks() {
    var d = (typeof DATA !== "undefined" && DATA) ? DATA.attacks : null;
    return Array.isArray(d) ? d : [];
  }

  /* Name and point come from the map's own LABEL - the gazetteer join the
     build resolved into `labels`, where dossier_map_zone_names.js reads both -
     and only then from the event, so an unlabelled place still gets its pin. */
  function labelOf(map, key) {
    var hit = ((map && map.labels) || []).filter(function (l) {
      return l.place === key;
    })[0];
    return hit || null;
  }

  function tally(map) {
    var s = (map && map.strikes) || null;
    if (!s || !(s.places || []).length) return [];
    var since = String(s.since || ""), out = [], byKey = {};
    s.places.forEach(function (key) {
      byKey[key] = { place: key, he: "", lat: null, lon: null, count: 0, events: [] };
      out.push(byKey[key]);
    });
    attacks().forEach(function (a) {
      var g = byKey[a.place_key];
      if (!g || (since && String(a.date || "") < since)) return;
      var names = a.target_names_he || a.target_name_he || "";
      g.events.push({
        date: String(a.date || ""),
        cat: catOf(a.weapon),
        weapons: (a.weapon || []).slice(),
        target_he: Array.isArray(names) ? (names[0] || "") : String(names),
        status: a.claim_status || "",
        verdict: a.corroboration || "none"
      });
      if (g.lat === null) { g.lat = a.lat; g.lon = a.lon; g.he = a.place_he || ""; }
    });
    out.forEach(function (g) {
      var l = labelOf(map, g.place);
      if (l) { g.he = l.he || g.he; g.lat = l.lat; g.lon = l.lon; }
      g.events.sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
      g.count = g.events.length;
    });
    return out.filter(function (g) {
      return g.count > 0 && g.lat !== null && g.lon !== null;
    }).sort(function (x, y) { return y.lat - x.lat; });
  }

  /* ONE ROW: the sentence for the number beside the pin. The picture paints
     the pin and its COUNT only (Ziv, 2026-09-23), so a strike map that still
     carries a key has nothing else to explain; the weapons are the list's. */
  function keyRows(map) {
    if (!tally(map).length) return [];
    return [{ label: PH.key_count, draw: function (c, Q, uu, x, cy, sw, sh) {
      window.DossierMapStrikes.pinSwatch(c, Q, uu, x, cy, sw, sh);
    } }];
  }

  var S = window.DossierMapStrikes || (window.DossierMapStrikes = {});
  S.tally = tally; S.keyRows = keyRows; S.phrases = PH;
  S.catOf = catOf; S.CATS = CATS;
}());
