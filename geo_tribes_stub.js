/* TEMPORARY TEST STUB - NOT PART OF THE BOARD. DELETE BEFORE REPORTING.

   Written 2026-09-22 so the `tribes` picture could be drawn and LOOKED AT while
   the real layer and the real record were still being made by other helpers:

   - `GEO.tribes` / `GEO.tribe_blocks` are five hand-drawn boxes over Yemen -
     two confederations, all three stances, four member tribes and one
     top-level area - in exactly the payload shape the layer helper documented
     in the job note (properties and nothing else, `label_at` as [lon, lat]);
   - the `tribes` MAP RECORD is pushed onto DOSSIER.maps here because
     docs\dossier_data.js is a GENERATED file that only scripts\dossier_build.py
     may write, and that is the join pass's step, not this helper's. The object
     below is the byte-for-byte output of scripts\dossier_maps.check_maps on the
     new record in data\dossier_maps.json, so the picture drawn from it is the
     picture the board will draw once the build runs.

   It is loaded by one line in index.html right after geo.js, and BOTH go away
   together. Nothing else on the board reads it. */
"use strict";

(function () {
  if (typeof GEO === "undefined" || !GEO) return;

  function box(w, s, e, n) {
    return { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] };
  }
  function multi() {
    return { type: "MultiPolygon",
             coordinates: [].slice.call(arguments).map(function (g) {
               return g.coordinates;
             }) };
  }
  function fc(list) { return { type: "FeatureCollection", features: list }; }
  function feat(props, geom) {
    return { type: "Feature", properties: props, geometry: geom };
  }

  var usaymat = box(43.60, 15.60, 44.40, 16.30);
  var hajur = box(42.95, 16.00, 43.58, 16.70);
  var murad = box(45.20, 14.60, 46.20, 15.30);
  var abida = box(45.20, 15.40, 46.20, 16.10);
  var yafi = box(45.30, 13.60, 46.30, 14.30);

  GEO.tribes = fc([
    feat({ id: "abida", name_he: "עֻבַּידה", stance: "with",
           confederation: "madhhij", tier: 2, label_at: [45.70, 15.75] }, abida),
    feat({ id: "hajur", name_he: "חאג'ור", stance: "split",
           confederation: "hashid", tier: 2, label_at: [43.26, 16.35] }, hajur),
    feat({ id: "murad", name_he: "מֻראד", stance: "against",
           confederation: "madhhij", tier: 2, label_at: [45.70, 14.95] }, murad),
    feat({ id: "usaymat", name_he: "אל-עֻצַימאת", stance: "with",
           confederation: "hashid", tier: 2, label_at: [44.00, 15.95] }, usaymat),
    feat({ id: "yafi", name_he: "יאפע", stance: "against",
           confederation: null, tier: 1, label_at: [45.80, 13.95] }, yafi)
  ]);
  GEO.tribe_blocks = fc([
    feat({ id: "hashid", name_he: "חאשד", label_at: [43.72, 16.20] },
         multi(usaymat, hajur)),
    feat({ id: "madhhij", name_he: "מד'חג'", label_at: [45.70, 15.35] },
         multi(murad, abida))
  ]);

  if (typeof DOSSIER === "undefined" || !DOSSIER || !DOSSIER.maps) return;
  if (DOSSIER.maps.some(function (m) { return m.id === "tribes"; })) return;
  DOSSIER.maps.push({
    id: "tribes", frame: "overview", tab: "maps", ground: "relief",
    title_he: "שבטי תימן – עמדה כלפי החות'ים",
    caption_he: "הצבעים מציינים את עמדת השבטים כלפי החות'ים – תמיכה, התנגדות או " +
      "פילוג – ולא מי שולט בקרקע. זוהי הערכה המבוססת על מחקרים שפורסמו. שטח שלא " +
      "נצבע הוא שטח שאין בו שבט דומיננטי.",
    tribes: true, fronts: false, gov_names: [], front_names: [], lanes: [],
    labels: [
      { place: "sanaa", he: "צנעא", lat: 15.35, lon: 44.21, anchor: "e",
        tier: 1, kind: "town", pin: true },
      { place: "marib", he: "מארב", lat: 15.46, lon: 45.32, anchor: "e",
        tier: 1, kind: "town", pin: true },
      { place: "aden", he: "עדן", lat: 12.79, lon: 45.03, anchor: "s",
        tier: 1, kind: "town", pin: true }
    ]
  });
})();
