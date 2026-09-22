/* The governance view's marks on the SHARED map: its Leaflet layer, its pins and
   every popup it draws.

   Split out of places.js for exactly the reason cluster.js is split out of
   map.js - the file passed 500 lines and the map half is self-contained.
   places.js owns the list, the chips and the tab lifecycle, and calls in here:

     PlacesMap.add(records, onPick)   put the layer on the shared map and draw
     PlacesMap.draw(records)          redraw the marks (a no-op when not shown)
     PlacesMap.remove()               take the layer off and close any popup
     PlacesMap.select(key)            pan to a record's mark and open its popup
     PlacesMap.live()                 is the layer on the map right now

   `onPick(key)` fires when a mark or a popup row is chosen, so the list can open
   the matching card. Nothing here touches the list itself.

   Load after icons.js, cluster.js and map.js, and before places.js. Everything
   this file reaches for - MapView.instance(), MapIcons, AttackClusters, and
   Places.catHe() for the Hebrew of a category - is read at CALL time, the same
   way map.js reads app.js's globals, so nothing here depends on running before
   another script does.

   NO ES modules - the page runs from file://. */
"use strict";

var PlacesMap = (function () {

  var layer = null;
  var livePopup = null;
  var groupByKey = new Map();
  var picked = null;      /* onPick, handed in by places.js */

  /* ---- reaching the shared Leaflet instance ------------------------------ */

  /* map.js hands out its own map through MapView.instance(). It is asked at CALL
     time, never stored: the board builds its map inside app.js's init(), and a
     reference taken at load would be null for ever.

     An earlier version of this file caught the instance by wrapping L.map itself,
     which worked only while this script loaded ahead of app.js - a silent failure
     the day anyone reordered the tags, which is precisely the fault this codebase
     keeps paying for. One accessor in map.js, asked when needed, cannot go wrong
     that way. */
  function mapOf() {
    if (window.MapView && typeof MapView.instance === "function") {
      return MapView.instance();
    }
    return null;
  }

  function catHe(key) {
    return (window.Places && Places.catHe) ? Places.catHe(key) : "";
  }

  /* ---- popups ------------------------------------------------------------ */

  /* The one place the institution glyph is drawn. It says which FAMILY of mark
     this is - the map already carries ports, airfields and oil facilities - and
     WHICH institution it is, is the word beside it. Bare, never in a rounded
     icon chip (design-law §6). */
  function glyph() {
    return MapIcons.mark("institution", "p-glyph");
  }

  function sources(rec) {
    return (window.Places && Places.sourcesHtml) ? Places.sourcesHtml(rec) : "";
  }

  /* The mark is a silhouette, so it has no channel for how sure the location is -
     an attack pin says that with a detached ring. Here it is said in words, which
     is what the card does too. */
  function whereHe(rec) {
    return rec.precision === "area" ? " · מיקום משוער" : "";
  }

  function popupOne(rec) {
    return '<div class="pop pl" dir="rtl">' +
      "<h4>" + glyph() + esc(rec.he) + "</h4>" +
      '<div class="pop-meta">' + esc(catHe(rec.category)) +
        (rec.place_he ? " · " + esc(rec.place_he) : "") + whereHe(rec) + "</div>" +
      (rec.role_he ? '<div class="pop-meta">' + esc(rec.role_he) + "</div>" : "") +
      sources(rec) + "</div>";
  }

  /* Several institutions at one coordinate. Each row is a real button, because
     these rows are the ONLY way into an institution that shares its point with
     five others - keyboard reaches them and so does a screen reader. An
     institution has no verdict and no front, so the row is two cells where an
     attack's is four: the category takes the slot the date holds over there. */
  function popupMany(group, currentKey) {
    var place = group.records[0].place_he;
    var rows = group.records.map(function (rec) {
      return '<button type="button" class="cl-row pl-row" data-id="' +
        esc(rec.key) + '"' +
        (rec.key === currentKey ? ' aria-current="true"' : "") + ">" +
        '<span class="cl-date">' + esc(catHe(rec.category)) + "</span>" +
        '<span class="cl-title">' + esc(rec.he) + "</span></button>";
    }).join("");
    return '<div class="pop pl" dir="rtl"><h4>' + glyph() +
      (place ? esc(place) + " — " : "") + group.records.length +
      " מוסדות</h4>" +
      (group.precision === "area"
        ? '<div class="pop-meta">מיקום משוער</div>' : "") +
      '<div class="cl-note">בחרו מוסד כדי לפתוח אותו ברשימה</div>' +
      '<div class="cl-list">' + rows + "</div></div>";
  }

  function popupHtml(group, currentKey) {
    return group.records.length === 1
      ? popupOne(group.records[0])
      : popupMany(group, currentKey);
  }

  /* ---- the marks --------------------------------------------------------- */

  /* Only what can honestly be put on a point. A record whose location is a whole
     country stays in the list, exactly as an attack does. */
  function drawable(records) {
    return (records || []).filter(function (rec) {
      return typeof rec.lat === "number" && typeof rec.lon === "number" &&
        rec.precision !== "country" && rec.precision !== "none";
    });
  }

  /* An institution is a FACT about who runs a place, never a claim - so it takes
     the fixed sites' vocabulary and not the attack pin's: one filled silhouette,
     one flat quiet colour, no circle, no front hue, no verdict fill. Borrowing
     the pin would have made six ministries read as six unverified claims.
     It is drawn a step louder than a port or an airfield (--ink-muted against
     --site-mark) because in THIS view the institutions are the subject and the
     sites stay the frame of reference.
     Where several share the point the count rides beside the glyph as bare type,
     not as a counter badge - a filled disc carrying a number is the attack pin,
     and that shape is spoken for. */
  /* Every mark carries its number, INCLUDING 1 - the same rule the attack pins
     follow, and for the same reason: a bare mark beside numbered ones leaves the
     reader guessing whether it means one institution or an unknown count. The
     glyph itself is identical at any count, so the number is the only thing that
     says how much is there. */
  function markHtml(group) {
    return MapIcons.mark("institution", "pl-glyph") +
      '<b class="pl-count">' + group.records.length + "</b>";
  }

  function addGroup(map, group) {
    var mark = L.marker([group.lat, group.lon], {
      icon: L.divIcon({
        className: "pl-mark",
        html: markHtml(group),
        /* The glyph sits exactly on the coordinate, the way a site's does. The
           press target is grown to 34px by a transparent box in places.css - a
           14px silhouette is far under the touch floor. */
        iconSize: [14, 14], iconAnchor: [7, 7]
      }),
      keyboard: true,
      title: String(group.records.length)
    });
    mark.bindPopup(popupHtml(group, null));
    mark.on("popupopen", function (e) {
      livePopup = e.popup;
      /* Leaflet's autoPan lands short: the popup is capped to the live pane and
         whatever overflow is left is panned out by hand. Same helper the attack
         popups use - the fault and the fix are identical.
         Three times, though, and that is not belt-and-braces. Arriving on this
         tab the map pane grows 115px, so the board re-fits itself over the next
         frames - and a fit measured before that re-fit lands is measured against
         a box the map is about to leave. Measured: opened in that window, the
         Sana'a bubble sat 144px ABOVE the pane, clipped. The timeout is the
         guard rather than a second mechanism, exactly as glide() checks that a
         smooth scroll actually happened. */
      settle(map, e.popup);
      if (group.records.length > 1) {
        AttackClusters.bindRows(e.popup.getElement(), function (key) {
          if (picked) picked(key);
        });
      }
    });
    mark.on("popupclose", function () { livePopup = null; });
    if (group.records.length === 1) {
      mark.on("click", function () {
        if (picked) picked(group.records[0].key);
      });
    }
    mark.addTo(layer);
    group.mark = mark;
    group.records.forEach(function (rec) { groupByKey.set(rec.key, group); });
  }

  /* One mark per PLACE, never one per institution. Six ministries at the Sana'a
     coordinate drawn as six marks means five that can never be clicked - the
     fault Ziv found on the attack board over Marib, and the same answer: group by
     coordinate, draw one pin carrying the count, and list the rest in its popup.
     AttackClusters.group() is that grouping; it keys on coordinate, precision and
     radius and knows nothing about attacks. */
  function draw(records) {
    var map = mapOf();
    if (!map || !layer) return;
    layer.clearLayers();
    groupByKey.clear();
    AttackClusters.group(drawable(records)).forEach(function (g) {
      addGroup(map, g);
    });
  }

  /* The pane can change size under an OPEN popup - the enlarge button alone gives
     it three different heights - so the cap has to be re-applied when it does.
     map.js does exactly this for the attack popups; ours is not in its hands.
     On `resize` only, never on `moveend`: re-fitting after every pan would fight
     the reader's own dragging. */
  /* Through settle(), not a bare fit, and that is the whole point. MapView's own
     invalidate() re-measures the container FIRST - which is what fires this
     event - and only then calls goHome(), which re-fits the view and drags the
     open bubble along with its marker. A pass that runs inside the resize event
     is therefore measured against a view the map is one line away from leaving.
     Measured: closing the enlarged map left the Sana'a bubble 144px above the
     pane until the deferred passes were added. */
  function refit() {
    var map = mapOf();
    if (map && livePopup) settle(map, livePopup);
  }

  /* Fit now, on the next frame, and once more after the board has finished
     settling. Every pass after the first is a no-op when the bubble is already
     inside the pane, and the whole thing stops the moment the popup closes. */
  function settle(map, popup) {
    AttackClusters.fit(map, popup);
    requestAnimationFrame(function () {
      if (livePopup === popup) AttackClusters.fit(map, popup);
    });
    setTimeout(function () {
      if (livePopup === popup) AttackClusters.fit(map, popup);
    }, 200);
  }

  function add(records, onPick) {
    var map = mapOf();
    picked = typeof onPick === "function" ? onPick : null;
    if (!map) {
      /* Loud rather than silent: with no map the institutions simply would not
         appear, and an empty map reads as "nothing is here" rather than as a
         broken script. This is the one way this file can fail. */
      if (window.console) {
        console.warn("PlacesMap: MapView.instance() gave no map - the marks " +
          "cannot be drawn.");
      }
      return false;
    }
    if (!layer) layer = L.layerGroup();
    if (!layer._map) {
      layer.addTo(map);
      map.on("resize", refit);
    }
    draw(records);
    return true;
  }

  function remove() {
    var map = mapOf();
    if (map) map.off("resize", refit);
    if (map && livePopup) map.closePopup(livePopup);
    livePopup = null;
    if (layer) {
      layer.clearLayers();
      if (map && layer._map) map.removeLayer(layer);
    }
    groupByKey.clear();
  }

  /* Settle the view, THEN open. Leaflet's popup autoPan reads the map's pixel
     origin the instant the popup opens; racing an animated pan it measures a
     position the map is about to leave and gives up, which on a phone leaves the
     bubble hanging off the screen edge. */
  function select(key) {
    var map = mapOf();
    var group = groupByKey.get(key);
    if (!map || !group || !group.mark) return;
    map.panTo([group.lat, group.lon], { animate: false });
    /* Arriving from a card, a shared mark opens with THAT institution marked, so
       the popup still answers "which one did I just click". */
    if (group.records.length > 1) {
      group.mark.setPopupContent(popupHtml(group, key));
    }
    group.mark.openPopup();
  }

  return {
    add: add,
    draw: draw,
    remove: remove,
    select: select,
    live: function () { return !!(layer && layer._map); }
  };
})();

window.PlacesMap = PlacesMap;
