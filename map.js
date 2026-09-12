/* Map view for the dashboard.
   Owns: the Leaflet map, the tiles, the geography layers (global GEO from geo.js),
   the fixed reference sites (DATA.sites), the attack markers, the popups and the legend.

   NO ES modules — this page runs from file://, where modules are blocked. The whole
   contract with app.js is one global:

     window.MapView = {
       init(),               // build the map, geography, sites and legend
       draw(records),        // replace the attack markers with these records
       select(id),           // pan to a record's marker and open its popup
       onSelect(cb),         // cb(id) fires when a marker is clicked
       invalidate()          // re-measure the map container
     }

   Shared vocabulary (esc, ltr, fmtDate, WEAPON_HE, CORROB, corrobOf, vbadgeHtml,
   frontHe) is declared in app.js. map.js only reads it inside functions that app.js
   calls after both scripts have loaded, so load order stays safe. */
"use strict";

var MapView = (function () {
  /* Last-resort bounds. The real opening view is computed from the data plus
     Yemen's own outline by computeHome(), so a new front (an Israel claim, say)
     widens the view on its own instead of being drawn off-screen. */
  var FALLBACK_BOUNDS = [[11.5, 36], [27.5, 55]];
  var HOME_BOUNDS = FALLBACK_BOUNDS;
  var userMoved = false;

  var map = null;
  var attackLayer = null;
  var areaLayer = null;
  var siteLayer = null;
  var govLabelLayer = null;
  var groupByRecId = new Map();
  /* The popup on screen, if any. Leaflet keeps its own reference private and the
     pane can change size under an OPEN popup - the enlarge button alone gives it
     482px and 660px - so the cap has to be re-applied, and something has to be
     holding the popup when that happens. */
  var livePopup = null;
  var geoLayers = {};
  var renderers = {};
  var selectHandlers = [];
  var frontColor = {};
  var S = null;

  /* Custom panes give the draw order the task asks for, bottom to top. Leaflet's
     own overlayPane sits at 400, so the attack markers always stay on top of the
     geography and the fixed sites. */
  var PANE_Z = {
    geoFill: 351,
    geoDistrict: 352,
    geoGov: 353,
    geoBorder: 354,
    geoControl: 355,
    geoLabel: 356,
    geoSite: 357,
    /* The approximate-area discs. Below Leaflet's own overlayPane at 400, where
       the clickable marks live, so a 60 km circle is always painted UNDER the
       dots inside it and can never take their clicks. */
    attackArea: 358
  };

  /* ---- tokens ------------------------------------------------------------ */

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function cssNum(name, fallback) {
    var n = parseFloat(cssVar(name));
    return isNaN(n) ? fallback : n;
  }
  /* Read once. Every colour and weight below comes from the token block in
     style.css — no styling literals live in this file. */
  function readTokens() {
    S = {
      fillHouthi: cssVar("--geo-fill-houthi"),
      fillGov: cssVar("--geo-fill-gov"),
      fillContested: cssVar("--geo-fill-contested"),
      contestedStroke: cssVar("--geo-contested-stroke"),
      districtLine: cssVar("--geo-district-line"),
      districtW: cssNum("--geo-district-w", 0.6),
      govLine: cssVar("--geo-gov-line"),
      govW: cssNum("--geo-gov-w", 1),
      border: cssVar("--geo-border"),
      borderW: cssNum("--geo-border-w", 2.5),
      control: cssVar("--geo-control-line"),
      controlW: cssNum("--geo-control-w", 2),
      controlDash: cssVar("--geo-control-dash") || "6 4"
    };
    ["ships", "israel", "saudi", "internal"].forEach(function (k) {
      frontColor[k] = cssVar("--f-" + k);
    });
  }

  function geoData() {
    return (typeof GEO !== "undefined" && GEO) ? GEO : null;
  }
  function siteData() {
    if (typeof DATA === "undefined" || !DATA) return [];
    return Array.isArray(DATA.sites) ? DATA.sites : [];
  }

  /* ---- map --------------------------------------------------------------- */

  function createPanes() {
    Object.keys(PANE_Z).forEach(function (name) {
      var pane = map.createPane(name);
      pane.style.zIndex = String(PANE_Z[name]);
    });
  }

  /* One canvas renderer per pane. Leaflet's own per-pane renderer prefers SVG;
     333 district polygons need canvas to stay smooth, so we pass ours explicitly. */
  function rendererFor(pane) {
    if (!renderers[pane]) renderers[pane] = L.canvas({ pane: pane, padding: 0.4 });
    return renderers[pane];
  }

  function initMap() {
    map = L.map("map", {
      zoomControl: true,
      worldCopyJump: true,
      preferCanvas: true,
      /* Fractional zoom, so a fit uses the container it was given. Leaflet
         rounds fitBounds DOWN to a whole zoom level by default: growing the pane
         from 891x751 to the full 1440x900 window is 1.2x of height, less than
         the 2x a whole level costs, so the map redrew at exactly the same scale
         and the extra room came out as empty sea. Measured 2026-08-29. */
      zoomSnap: 0,
      /* Owned by the map now that no tile layer declares a range. */
      minZoom: 3,
      maxZoom: 13
    });
    /* NO raster basemap at all, and this is deliberate - see 2026-08-29.
       Esri publishes Canvas as Base + Reference so that labels can be dropped,
       and dropping Reference was the obvious fix. It was not enough: the BASE
       tiles have country names burnt into them too. Measured, English, over our
       own Hebrew: DJIBOUTI at z6, YEMEN at z7 - both inside the range this board
       actually reads at, so there is no zoom band where the ground is clean.
       CARTO's label-free basemaps now watermark for an API key, so there is no
       keyless replacement to swap in.

       Nothing of substance is lost. The tiles were already held to 0.42 opacity
       and 0.55 contrast because their roads and wadis read as scribble under our
       lines; the map has always been carried by its own geography - the national
       outlines, the governorate and district boundaries, the control zones, the
       front line and the fixed sites - and every word on it is Hebrew.
       Attribution moves to the data that actually draws it. */
    L.control.attribution({ prefix: false })
      .addAttribution(esc(GEO && GEO.attribution ? GEO.attribution
                                                 : "geoBoundaries (CC BY 4.0)"))
      .addTo(map);
    goHome();
    /* Only a real gesture counts. A programmatic fit fires the same events, so
       the flag is set from pointer/wheel/keyboard input, never from movestart. */
    ["dragstart", "wheel", "keydown"].forEach(function (ev) {
      map.getContainer().addEventListener(ev, function () { userMoved = true; },
        { passive: true });
    });
    map.on("zoomstart", function (e) { if (e && e.hard) userMoved = true; });
    createPanes();
    areaLayer = L.layerGroup().addTo(map);
    attackLayer = L.layerGroup().addTo(map);
  }

  function goHome() {
    map.fitBounds(HOME_BOUNDS, { animate: false, padding: [12, 12] });
  }

  /* Widen a lat/lon box in place. */
  function grow(box, lat, lon, padDeg) {
    if (typeof lat !== "number" || typeof lon !== "number") return;
    var d = padDeg || 0;
    box[0][0] = Math.min(box[0][0], lat - d);
    box[0][1] = Math.min(box[0][1], lon - d);
    box[1][0] = Math.max(box[1][0], lat + d);
    box[1][1] = Math.max(box[1][1], lon + d);
  }

  /* The opening view is YEMEN plus a border strip, not the whole theatre. Fitting
     every record pulls the box up to Ras Tanura at 26.6N, and 15 degrees of
     latitude in a short map zooms out until Yemen is a dot next to India - which
     is the opposite of being able to read its districts and its control line.
     Records outside the opening view are never stranded: a front filter refits
     to what it selected, and clicking a card pans to its pin. */
  function computeHome() {
    var geo = geoData();
    if (geo && geo.yem_adm0) {
      var b = L.geoJSON(geo.yem_adm0).getBounds();
      if (b && b.isValid()) {
        return [[b.getSouth() - 1.1, b.getWest() - 1.6],
                [b.getNorth() + 1.6, b.getEast() + 1.1]];
      }
    }
    return FALLBACK_BOUNDS;
  }

  /* Fit to a specific set - used when a filter narrows the board. Clearing the
     filters must go back to the opening view, NOT fit all 55 records: fitting
     everything spans Bab al-Mandab to Ras Tanura and leaves Yemen a dot, which
     is the state the reader started from and did not choose. */
  function fitTo(records) {
    if (!map || userMoved || !records || !records.length) return;
    var all = (typeof DATA !== "undefined" && DATA.attacks) ? DATA.attacks.length : 0;
    if (all && records.length === all) { goHome(); return; }
    var box = [[90, 180], [-90, -180]];
    var any = false;
    records.forEach(function (r) {
      if (typeof r.lat !== "number" || typeof r.lon !== "number") return;
      grow(box, r.lat, r.lon,
        (r.precision === "area"
          ? AttackClusters.drawRadiusKm(r.radius_km) : 0) / 111);
      any = true;
    });
    if (!any) return;
    grow(box, box[0][0], box[0][1], 0.5);
    grow(box, box[1][0], box[1][1], 0.5);
    map.fitBounds(box, { animate: false, padding: [16, 16] });
  }

  /* The pane is sized by CSS that depends on the live band height, and Leaflet
     only watches the window. Re-measure whenever the container itself changes. */
  function watchContainerSize() {
    var el = document.getElementById("map");
    if (!el || typeof ResizeObserver === "undefined") return;
    new ResizeObserver(function () {
      if (!map) return;
      map.invalidateSize(false);
      /* The container is sized off the live band height, so its first size is
         wrong and the opening fitBounds lands at minZoom. Re-fit until the
         reader has actually moved the map themselves. */
      if (!userMoved) goHome();
      updateLabels();
      refitPopup();
    }).observe(el);
  }

  /* A pane that just changed height has to give the open popup its new cap:
     measured, closing the enlarged map left a 536px bubble hanging 64px below a
     482px pane. */
  function refitPopup() {
    if (livePopup && map) AttackClusters.fit(map, livePopup);
  }

  /* ---- geography --------------------------------------------------------- */

  function addGeo(fc, pane, style) {
    if (!fc || !fc.type) return null;
    return L.geoJSON(fc, {
      pane: pane,
      renderer: rendererFor(pane),
      interactive: false,   /* geography must never swallow a marker click */
      style: style
    });
  }

  /* Territory is told apart by lightness, never by a new hue — all eight
     decorative hues are already spoken for by fronts and verification.
     A true diagonal hatch is awkward on a canvas renderer (Leaflet exposes no
     pattern hook), so "contested" uses the agreed fallback: the mid fill plus a
     faint dashed outline. This is the ONE stroke on the fill layer, and since the
     zones are dissolved it draws once around a pocket, not once per district. */
  function territoryStyle(feature) {
    var control = (feature && feature.properties && feature.properties.control) || "";
    if (control === "contested") {
      return {
        stroke: true, color: S.contestedStroke, weight: 0.8, dashArray: "3 3",
        fill: true, fillColor: S.fillContested, fillOpacity: 1
      };
    }
    return {
      stroke: false,
      fill: true,
      fillColor: control === "houthi" ? S.fillHouthi : S.fillGov,
      fillOpacity: 1
    };
  }

  function lineStyle(color, weight, dash) {
    return { stroke: true, color: color, weight: weight, dashArray: dash || null, fill: false };
  }

  function buildGeography() {
    var geo = geoData();
    if (!geo) return;

    /* Territory is drawn from the DISSOLVED zones, not the districts: one shape per
       side, so no district edge shows as a patch and no antialias seam shows inside
       one side's ground. (yem_adm2 is the fallback only if geo.js predates them.) */
    var territory = addGeo(geo.control_zones || geo.yem_adm2, "geoFill",
      territoryStyle);
    if (territory) geoLayers.territory = territory.addTo(map);

    /* Built, but NOT added: 333 sub-district outlines inside the governorates
       turn the country into a mesh, and the shape a reader orients by is the
       governorate. The legend row still switches them on. */
    var districts = addGeo(geo.yem_adm2, "geoDistrict",
      lineStyle(S.districtLine, S.districtW));
    if (districts) geoLayers.districts = districts;

    var govParts = [geo.yem_adm1, geo.sau_adm1]
      .map(function (fc) { return addGeo(fc, "geoGov", lineStyle(S.govLine, S.govW)); })
      .filter(Boolean);
    if (govParts.length) geoLayers.governorates = L.layerGroup(govParts).addTo(map);

    /* Deliberately the heaviest line on the map — the Yemen/Saudi border is the
       thing the reader is orienting by. */
    var borderParts = [geo.yem_adm0, geo.sau_adm0]
      .map(function (fc) { return addGeo(fc, "geoBorder", lineStyle(S.border, S.borderW)); })
      .filter(Boolean);
    if (borderParts.length) geoLayers.borders = L.layerGroup(borderParts).addTo(map);

    var control = addGeo(geo.control_line, "geoControl",
      lineStyle(S.control, S.controlW, S.controlDash));
    if (control) geoLayers.control = control.addTo(map);

    geoLayers.gains = MapGains.build({ map: map, geo: geo, add: addGeo });
  }

  /* ---- fixed reference sites --------------------------------------------- */

  function siteIcon(site) {
    var label = (site && site.he) ? site.he : "";
    return L.divIcon({
      className: "site-icon",
      html: MapIcons.site(site && site.kind) +
        '<b class="site-label">' + esc(label) + "</b>",
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  }

  function buildSites() {
    var sites = siteData().filter(function (s) {
      return s && typeof s.lat === "number" && typeof s.lon === "number";
    });
    if (!sites.length) return;
    var markers = sites.map(function (s) {
      return L.marker([s.lat, s.lon], {
        pane: "geoSite",
        icon: siteIcon(s),
        interactive: false,   /* a frame of reference, never a competing target */
        keyboard: false
      });
    });
    siteLayer = L.layerGroup(markers).addTo(map);
  }

  /* Governorate names are on at every zoom and thinned by collision; the ports and
     airfields wait until the map is close enough to be about single places. */
  function updateLabels() {
    if (!map) return;
    map.getContainer().classList.toggle("show-site-labels", map.getZoom() >= 8);
    MapLabels.place();
  }

  /* ---- attack markers ---------------------------------------------------- */

  /* Every event on the board is a DOT. An approximate one additionally gets the
     dashed disc that says "somewhere in here" - drawn ONCE per place, in its own
     pane under the dots and with interactive:false, so a 60 km circle can never
     swallow the click meant for a mark inside it.

     The old 900 m offset ring is gone with the code that needed it: at the zoom
     this board reads at, 900 m is under half a pixel. Co-located events are
     reached through the cluster popup instead - see cluster.js. */
  function groupColor(g) {
    return g.front ? (frontColor[g.front] || cssVar("--f-" + g.front))
                   : cssVar("--ink");
  }

  /* ONE pin shape for every group, and it always carries its number - Ziv,
     2026-08-29: "if there is only one, then write one. Don't leave it empty."
     A lone claim used to be a bare 7px dot beside numbered clusters, which read
     as a different kind of thing rather than as one of the same thing.

     The verdict rides on a single-event pin exactly as it rode on that dot:
     filled for corroborated, hollow and dashed for a claim nobody else carried,
     which is the wording the legend already uses. A group mixes verdicts, so its
     pin stays neutral and the popup rows carry them one by one. */
  function pin(g) {
    var color = groupColor(g);
    var single = g.records.length === 1;
    var verdict = single ? g.records[0].corroboration : null;
    var solid = verdict === "confirmed" || verdict === "partial" || !single;
    var fill = single
      ? MapIcons.rgba(color, MapIcons.fillFor(g.records[0]))
      : "transparent";
    return L.marker([g.lat, g.lon], {
      icon: L.divIcon({
        className: "cl-pin-wrap",
        html: MapIcons.pin(g.records.length, color, fill, solid,
          g.precision === "area"),
        iconSize: [30, 30], iconAnchor: [15, 15]
      }),
      keyboard: true,
      title: String(g.records.length)
    });
  }

  function fire(id) {
    selectHandlers.forEach(function (cb) { cb(id); });
  }

  function addGroup(g) {
    if (g.precision === "area") {
      L.circle([g.lat, g.lon], {
        radius: AttackClusters.drawRadiusKm(g.radius_km) * 1000,
        color: groupColor(g), weight: 1.5, dashArray: "6 6",
        fillColor: groupColor(g), fillOpacity: 0.14,
        interactive: false, pane: "attackArea",
        renderer: rendererFor("attackArea")
      }).addTo(areaLayer);
    }
    var single = g.records.length === 1;
    var mark = pin(g);
    mark.bindPopup(AttackClusters.popupHtml(g, null));
    mark.on("popupopen", function (e) {
      livePopup = e.popup;
      AttackClusters.fit(map, e.popup);
      if (!single) AttackClusters.bindRows(e.popup.getElement(), fire);
    });
    mark.on("popupclose", function () { livePopup = null; });
    if (single) mark.on("click", function () { fire(g.records[0].id); });
    mark.addTo(attackLayer);
    g.pin = mark;
    g.records.forEach(function (rec) { groupByRecId.set(rec.id, g); });
  }

  function draw(records) {
    if (!map) return;
    attackLayer.clearLayers();
    areaLayer.clearLayers();
    groupByRecId.clear();
    var drawn = (records || []).filter(function (rec) {
      return rec.lat != null &&
        rec.precision !== "country" && rec.precision !== "none";
    });
    AttackClusters.group(drawn).forEach(addGroup);
  }

  /* The pan does NOT animate, and that is the fix, not a shortcut. Leaflet's popup
     autoPan reads the map's pixel origin the instant the popup opens; racing an
     animated panTo it measures a position the map is about to leave and gives up,
     which on a phone - where the pane is barely wider than the bubble - left the
     popup hanging off the screen edge. Settle the view first, then open. */
  function select(id) {
    var g = groupByRecId.get(id);
    if (!g || !map) return;
    map.panTo([g.lat, g.lon], { animate: false });
    /* Arriving from a card, the popup opens on the list with THAT event marked,
       so a shared pin still answers "which one did I just click". */
    if (g.records.length > 1) {
      g.pin.setPopupContent(AttackClusters.popupHtml(g, id));
    }
    g.pin.openPopup();
  }

  /* ---- lifecycle --------------------------------------------------------- */

  function init() {
    readTokens();
    initMap();
    buildGeography();
    HOME_BOUNDS = computeHome();
    goHome();
    govLabelLayer = MapLabels.build({ map: map, geo: geoData(),
      pane: "geoLabel" });
    buildSites();
    updateLabels();
    map.on("zoomend moveend", updateLabels);
    MapLegend.init({ map: map, geo: geoData(), layers: geoLayers,
      sites: siteLayer });
    watchContainerSize();
  }

  return {
    init: init,
    draw: draw,
    select: select,
    fitTo: fitTo,
    /* The one shared Leaflet instance, for a second view that draws its own
       layer on this map (places_map.js). Without it that file had to wrap
       L.map itself to catch the instance as it was built - which works only if
       it loads before app.js calls init(), and fails silently otherwise. An
       accessor costs one line and cannot be got wrong by load order. */
    instance: function () { return map; },
    home: function () { userMoved = false; if (map) goHome(); },
    onSelect: function (cb) { if (typeof cb === "function") selectHandlers.push(cb); },
    invalidate: function () {
      if (!map) return;
      map.invalidateSize(false);
      if (!userMoved) goHome();
      refitPopup();
    }
  };
})();

window.MapView = MapView;
