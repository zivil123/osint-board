/* Events that share a coordinate, and the popup that lets the reader reach each
   one. Loaded before map.js; map.js draws what group() returns.

   Why this exists (Ziv, 2026-08-29): "in Marib there are a few events that
   happen inside each other, and it only let me click on the big one."

   Measured: 134 of 175 events carry precision "area" and were drawn as a disc
   each. SIXTEEN of them share the identical centre and radius over Marib -
   thirty-two over Taiz. Sixteen identical discs stack: the last one drawn takes
   every click and the other fifteen are unreachable, while their translucent
   fills multiply into one near-opaque patch. Spreading them was not an option -
   the old 900 m offset ring is under half a pixel at the zoom this board reads
   at, which is why the nine Mokha events never separated either.

   So the geometry is drawn ONCE per place and the events hang off a single pin
   that says how many there are. Nothing is hidden and nothing is moved off its
   real coordinate. */
var AttackClusters = (function () {
  "use strict";

  /* Same place AND same claimed precision. An event pinned to a town centre is
     not the same mark as one that means "somewhere in this governorate", even
     when the coordinates round to the same point. */
  function keyOf(rec) {
    return rec.precision + "|" + rec.lat.toFixed(5) + "," + rec.lon.toFixed(5) +
      "|" + (rec.radius_km || 0);
  }

  /* One front colour per group. Two of today's groups mix fronts - a Saudi
     border strike and the ground war land on the same governorate centre - and
     there the pin takes no side: it goes neutral and every row in the popup
     carries its own front dot. */
  function frontOf(group) {
    var seen = {};
    group.records.forEach(function (r) { seen[r.front] = true; });
    var keys = Object.keys(seen);
    return keys.length === 1 ? keys[0] : null;
  }

  function group(records) {
    var byKey = {};
    var out = [];
    records.forEach(function (rec) {
      var key = keyOf(rec);
      var g = byKey[key];
      if (!g) {
        g = byKey[key] = {
          key: key,
          lat: rec.lat,
          lon: rec.lon,
          precision: rec.precision,
          radius_km: rec.radius_km,
          records: [],
        };
        out.push(g);
      }
      g.records.push(rec);
    });
    out.forEach(function (g) { g.front = frontOf(g); });
    /* Widest disc first, so a big governorate circle is painted under a smaller
       one and never buries it. */
    out.sort(function (a, b) {
      return (b.radius_km || 0) - (a.radius_km || 0);
    });
    return out;
  }

  /* Approximate claims carry radii up to 320 km ("somewhere in the Red Sea").
     Drawn literally, that circle covers both coasts and reads as a strike on land,
     which is the one thing a ship attack never is. Above 30 km the drawn radius is
     compressed, so the order still holds - a whole-sea claim draws wider than a named
     anchorage - while the widest lands near 60 km, clear of both coasts (measured:
     96 km of water to the nearest Saudi shore). The dashed outline, not the size, is
     what says "approximate". A circle centred on an anchorage - off Yanbu, Bab
     al-Mandab - still touches its own coastline; that one is the geography, not the
     drawing. */
  var AREA_SOFT_KM = 30;      /* drawn true to scale up to here */
  var AREA_COMPRESS = 0.3;    /* above it, size grows this slowly */
  function drawRadiusKm(km) {
    var r = (typeof km === "number" && km > 0) ? km : AREA_SOFT_KM;
    if (r <= AREA_SOFT_KM) return r;
    return AREA_SOFT_KM * Math.pow(r / AREA_SOFT_KM, AREA_COMPRESS);
  }

  /* ---- popups ------------------------------------------------------------ */

  /* One event: the card's own summary, unchanged from what the board has always
     shown when a single marker is clicked. */
  function eventHtml(rec) {
    var weapons = (rec.weapon || []).map(function (w) {
      return WEAPON_HE[w] || w;
    });
    return [
      '<div class="pop" dir="rtl">',
      "<h4>" + esc(rec.title_he) + "</h4>",
      '<div class="pop-meta">' + fmtDate(rec.date) +
        (rec.place_he ? " · " + esc(rec.place_he) : "") + "</div>",
      '<div class="pop-meta">' + esc(weapons.join(", ")) + "</div>",
      '<div class="pop-meta">' + vbadgeHtml(rec) + "</div>",
      '<a href="' + esc(rec.link) + '" target="_blank" rel="noopener">לפוסט המקורי</a>',
      "</div>"
    ].join("");
  }

  /* Several events: the whole list, each row a button. The rows are the ONLY
     way into the events under a shared pin, so they are buttons rather than
     styled divs - keyboard reaches them and so does a screen reader. */
  function listHtml(group, currentId) {
    var place = group.records[0].place_he;
    var rows = group.records.map(function (rec) {
      var v = CORROB[rec.corroboration] || CORROB.pending;
      var current = rec.id === currentId;
      return '<button type="button" class="cl-row" data-id="' + esc(rec.id) + '"' +
        (current ? ' aria-current="true"' : "") + ">" +
        '<span class="cl-dot" style="--dot-c: var(--f-' + rec.front + ')"></span>' +
        '<span class="cl-date">' + fmtDate(rec.date) + "</span>" +
        '<span class="cl-title">' + esc(rec.title_he) + "</span>" +
        '<span class="cl-v" style="--v-c: var(--v-' + rec.corroboration + ')" ' +
        'title="' + esc(v.he) + '">' + v.glyph + "</span>" +
        "</button>";
    }).join("");
    return [
      '<div class="pop cl" dir="rtl">',
      "<h4>" + (place ? esc(place) + " — " : "") +
        group.records.length + " אירועים</h4>",
      '<div class="cl-note">בחרו אירוע כדי לפתוח אותו ברשימה</div>',
      '<div class="cl-list">' + rows + "</div>",
      "</div>"
    ].join("");
  }

  function popupHtml(group, currentId) {
    return group.records.length === 1
      ? eventHtml(group.records[0])
      : listHtml(group, currentId);
  }

  /* Wire the rows of an open popup. Called on popupopen, because the popup's
     DOM does not exist before that. */
  function bindRows(popupEl, onPick) {
    if (!popupEl) return;
    var rows = popupEl.querySelectorAll(".cl-row");
    if (!rows.length) return;
    Array.prototype.forEach.call(rows, function (row) {
      row.addEventListener("click", function () {
        Array.prototype.forEach.call(rows, function (other) {
          other.removeAttribute("aria-current");
        });
        row.setAttribute("aria-current", "true");
        onPick(row.dataset.id);
      });
    });
    /* Arriving from a card click, the popup opens on a list of thirty-two and
       the event that was asked for may be anywhere in it. */
    var current = popupEl.querySelector('.cl-row[aria-current="true"]');
    if (current && current.scrollIntoView) {
      current.scrollIntoView({ block: "nearest" });
    }
  }

  /* The pane owns everything that floats in it (CLAUDE.md), and Leaflet's own
     autoPan does not finish the job: measured on the Marib cluster it left the
     bubble 31px above the pane, over the filter band, because the height it
     measures is not the height this stylesheet renders. So the popup is capped
     to the pane it lives in and the residual is taken out by hand.

     The cap is read from the live pane on every open - the enlarge button and a
     phone give it three different heights, and a stored number would be one of
     them for ever. */
  function fit(map, popup) {
    var pane = document.getElementById("map");
    if (!map || !popup || !pane) return;
    var m = pane.getBoundingClientRect();
    var cap = Math.max(120, Math.round(m.height - 150));
    if (popup.options.maxHeight !== cap) {
      popup.options.maxHeight = cap;
      popup.update();
    }
    var el = popup.getElement();
    if (!el) return;
    var p = el.getBoundingClientRect();
    var dy = 0;
    if (p.top < m.top + 8) dy = p.top - (m.top + 8);
    else if (p.bottom > m.bottom - 8) dy = p.bottom - (m.bottom - 8);
    /* Sideways too. A phone's map pane is 325px wide and the bubble is 309 - it
       fits by 16px and by nothing else, so a marker near either edge puts it
       half off the map without this. */
    var dx = 0;
    if (p.left < m.left + 8) dx = p.left - (m.left + 8);
    else if (p.right > m.right - 8) dx = p.right - (m.right - 8);
    /* panBy moves the VIEW, so the bubble travels the other way: a negative dy
       walks a popup that is too high back down into the pane. */
    if (dx || dy) map.panBy([dx, dy], { animate: false });
  }

  return {
    drawRadiusKm: drawRadiusKm,
    group: group,
    fit: fit,
    popupHtml: popupHtml,
    bindRows: bindRows,
  };
})();

window.AttackClusters = AttackClusters;
