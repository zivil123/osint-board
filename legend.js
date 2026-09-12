/* The map legend: the rows under the map that say what a colour or a line means,
   and the buttons that switch a geography layer on and off.

   Split out of map.js when that file reached its 500-line ceiling. NO ES modules -
   this page runs from file://, where they are blocked - so the contract is one global:

     window.MapLegend = {
       init({ map, geo, layers, sites })   // fill the rows in, wire the toggles
     }

   `layers` is map.js's own geoLayers object, so a row toggles the real layer. `esc`
   and `fmtDate` come from app.js and are only read inside init(), which map.js calls
   after every script has loaded. */
"use strict";

var MapLegend = (function () {
  var ctx = { map: null, geo: null, layers: {}, sites: null };

  function setLayer(name, on) {
    var layer = (name === "sites") ? ctx.sites : ctx.layers[name];
    if (!layer || !ctx.map) return;
    if (on && !ctx.map.hasLayer(layer)) layer.addTo(ctx.map);
    else if (!on && ctx.map.hasLayer(layer)) ctx.map.removeLayer(layer);
  }

  function show(node, on) {
    if (node) node.hidden = !on;
  }
  function toggleButton(name) {
    return document.querySelector('.lg-row[data-layer="' + name + '"]');
  }

  function legendFootHtml(geo) {
    var bits = [];
    var note = geo.control_note_he ||
      "קווי השליטה מקורבים בלבד ומשתנים מעת לעת.";
    bits.push(esc(note));
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(geo.control_as_of || ""))) {
      bits.push("נכון ל־" + fmtDate(geo.control_as_of));
    }
    bits.push(esc(geo.attribution || "geoBoundaries (CC BY 4.0)"));
    return bits.join("<br>");
  }

  /* One line per area that changed hands, newest first - the map says WHERE, and
     these say what it is called and when it fell. `to` is the status it ended in,
     so ground still being fought over is never reported as taken. */
  var GAIN_HE = { houthi: "נכבש", contested: "קרבות" };

  function gainRowsHtml(geo) {
    return (geo.recent_gains_list || []).map(function (gain) {
      return '<div class="lg-gain"><b>' + esc(gain.name_he) + "</b><span>" +
        fmtDate(gain.date) + " · " + (GAIN_HE[gain.to] || "") + "</span></div>";
    }).join("");
  }

  function init(context) {
    ctx = context;
    var root = document.getElementById("legend");
    if (!root) return;
    var geo = ctx.geo;
    var body = document.getElementById("lg-body");
    var toggle = document.getElementById("lg-toggle");

    /* Rows only appear when the layer behind them actually exists. */
    show(document.getElementById("lg-geo"), !!geo);
    if (geo) {
      show(document.getElementById("lg-territory"), !!ctx.layers.territory);
      show(toggleButton("districts"), !!ctx.layers.districts);
      show(toggleButton("governorates"), !!ctx.layers.governorates);
      show(document.getElementById("lg-borders"), !!ctx.layers.borders);
      show(toggleButton("control"), !!ctx.layers.control);
      var gainList = document.getElementById("lg-gain-list");
      if (gainList) gainList.innerHTML = gainRowsHtml(geo);
      show(document.getElementById("lg-gains"), !!ctx.layers.gains);
      var foot = document.getElementById("lg-foot");
      if (foot) {
        foot.innerHTML = legendFootHtml(geo);
        foot.hidden = false;
      }
    }
    show(document.getElementById("lg-sites"), !!ctx.sites);

    Array.prototype.forEach.call(
      root.querySelectorAll(".lg-row[data-layer]"),
      function (btn) {
        btn.addEventListener("click", function () {
          var on = btn.getAttribute("aria-pressed") !== "true";
          btn.setAttribute("aria-pressed", on ? "true" : "false");
          setLayer(btn.dataset.layer, on);
        });
      }
    );

    if (toggle && body) {
      var setOpen = function (open) {
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        body.hidden = !open;
      };
      /* Collapsed on phones so it never eats the 48vh map. */
      /* Closed on every width. Open, it covers the half of the map Yemen is
         drawn on - measured at 1024px, where it hid the whole country. */
      setOpen(false);
      toggle.addEventListener("click", function () {
        setOpen(toggle.getAttribute("aria-expanded") !== "true");
      });
    }
  }

  return { init: init };
})();

window.MapLegend = MapLegend;
