/* dossier_png.js - one download button under every map picture on the dossier
   tab, and the dry path that proves it without putting a file on anybody's
   screen.

   window.DossierPng = { mount(pane), dry }

   Ziv asked for the maps as PNG files he can download (2026-09-17). The picture
   already exists at slide resolution - DossierMap.exportPng(id, theme, w, h,
   variant) is what the deck's own slides are made of - so this is a thin
   wrapper over it: export at 2560x1440 in the LIGHT theme (the deck's one
   theme, and the one that prints), turn the data URL into a blob, and hand it
   to the view's own save helper.

   VERIFY WITH `?png=dry`, NEVER A REAL TAP. The board runs on the machine Ziv
   is sitting at: a test press drops a file in his downloads and pops his file
   explorer open over whatever he is doing. It happened twice in one session on
   2026-09-12 with the deck, which is why `?deck=dry` exists; this is the same
   flag for the same reason. With it the page builds every picture on load,
   SEQUENTIALLY (nine 2560x1440 canvases at once is a memory spike for nothing),
   stashes what it measured on window.DossierPng.dry, and every button stashes
   instead of saving and says so in Hebrew.

   No ES modules - the page runs from file://. Loaded BEFORE dossier_view.js, so
   the global exists by the time the view renders and calls mount(). */
"use strict";

var DossierPng = (function () {
  var LABEL = "הורדת המפה (PNG)";
  var BUSY = "מכין את התמונה…";
  var FAILED = "יצירת התמונה נכשלה.";
  var MISSING = "ההורדה אינה זמינה";
  var W = 2560, H = 1440, THEME = "light";
  /* Same flag shape as the deck's ?deck=dry, and the same mark on the button
     so nobody mistakes a checking session for the real thing. */
  var DRY = /[?&]png=dry(&|$)/.test(location.search);
  var out = { dry: null };

  /* THE DATE IS TODAY'S, IN THE VIEWER'S OWN TIME, not the dossier's as_of
     (changed 2026-09-17). A picture is a file on somebody's disk: stamping it
     with the document's date makes two downloads on different days collide
     under one name, and makes a map saved this morning wear the date of the
     last dossier build, which is the one thing a filename must never lie
     about. The DECK still carries the document's date - it IS the document.
     Local parts, never toISOString(), which is UTC and turns the evening here
     into tomorrow. */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function stamp() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function fileName(id, variant) {
    return "osint-map-" + id + (variant && variant !== "plain" ? "-" + variant : "") +
      "-" + stamp() + ".png";
  }
  /* A data URL is what the painter returns; a blob is what a save needs. Done
     by hand rather than through fetch(), which a file:// page refuses. */
  function toBlob(dataUrl) {
    var comma = String(dataUrl || "").indexOf(",");
    if (comma < 0) return null;
    var bin = atob(dataUrl.slice(comma + 1));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: "image/png" });
  }

  /* The relief pictures are fetched once and painted from memory: a terrain map
     exported before they land would come out with no terrain on it. */
  function ready() {
    var P = window.DossierMap;
    if (!P || typeof P.ready !== "function") return Promise.resolve();
    return Promise.resolve().then(function () { return P.ready(THEME); })
      .catch(function (err) { console.warn("dossier_png: relief not ready", err); });
  }

  function render(id, variant) {
    return ready().then(function () {
      var png = DossierMap.exportPng(id, THEME, W, H, variant);
      if (typeof png !== "string" || png.indexOf("base64,") < 0) throw new Error(FAILED);
      return png;
    });
  }
  function note(id, variant, png) {
    /* `name` is the file the real button would have written. It is stashed so a
       checker can read the stamped filename without a tap putting a file on
       Ziv's screen - the whole bargain of the dry run. */
    var item = { id: id, variant: variant, width: W, height: H,
                 name: fileName(id, variant),
                 bytes: Math.round((png.length - png.indexOf(",") - 1) * 3 / 4),
                 dataUrl: png };
    out.dry = out.dry || { done: false, items: [] };
    out.dry.items = out.dry.items.filter(function (it) {
      return it.id !== id || it.variant !== variant;
    });
    out.dry.items.push(item);
    return item;
  }

  /* ---- the button ---------------------------------------------------------- */

  function status(section, text) {
    var el = section.querySelector(".ds-map-status");
    if (el) el.textContent = text || "";
  }

  function press(section, btn) {
    var id = section.dataset.map, variant = section.dataset.variant || "plain";
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = BUSY; status(section, "");
    render(id, variant).then(function (png) {
      btn.disabled = false; btn.textContent = label;
      if (DRY) {
        var it = note(id, variant, png);
        status(section, "בדיקה בלבד — " + it.width + "x" + it.height +
          ". הקובץ לא נשמר.");
        return;
      }
      var blob = toBlob(png), save = window.DossierSave;
      if (!blob || typeof save !== "function") { status(section, MISSING); return; }
      save({ blob: blob, fileName: fileName(id, variant), mime: "image/png" });
    }, function (err) {
      btn.disabled = false; btn.textContent = label;
      console.error("dossier_png:", err);
      status(section, FAILED);
    });
  }

  /* One button per PICTURE, which on this tab means one per (map, variant):
     each block on the page is its own canvas, so each saves what is above it
     and nothing else has to be chosen. A quiet secondary control - it is not
     what the page is for, and the page's own primary control (the deck) sits
     in the header (design-law: hierarchy from weight and shade, never a second
     colour). */
  function mount(pane) {
    if (!pane || !window.DossierMap) return;
    Array.prototype.forEach.call(pane.querySelectorAll(".ds-map"), function (section) {
      if (section.querySelector(".ds-png-btn")) return;
      var row = document.createElement("div");
      row.className = "ds-map-actions";
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "ds-png-btn"; btn.textContent = LABEL;
      btn.addEventListener("click", function () { press(section, btn); });
      row.appendChild(btn);
      var line = document.createElement("p");
      line.className = "ds-map-status";
      line.setAttribute("aria-live", "polite");
      section.appendChild(row);
      section.appendChild(line);
    });
    if (DRY) dryRun(pane);
  }

  /* ---- the dry run ---------------------------------------------------------- */

  /* Every picture on the page, one after another, with nothing saved and
     nothing opened. SEQUENTIAL on purpose: each export is a 2560x1440 canvas
     plus its data URL, and building nine of them at once spikes memory for no
     gain. What it measured lands on window.DossierPng.dry for a checker to
     read - the deck's own ?deck=dry bargain. */
  function dryRun(pane) {
    var jobs = Array.prototype.map.call(pane.querySelectorAll(".ds-map"),
      function (s) { return { id: s.dataset.map, variant: s.dataset.variant || "plain" }; });
    out.dry = { done: false, items: [] };
    jobs.reduce(function (chain, job) {
      return chain.then(function () {
        return render(job.id, job.variant).then(function (png) {
          note(job.id, job.variant, png);
        }, function (err) {
          console.error("dossier_png: dry export failed for " + job.id, err);
        });
      });
    }, Promise.resolve()).then(function () { out.dry.done = true; });
  }

  if (DRY) {
    var st = document.createElement("style");
    st.textContent = '.ds-png-btn::after{content:" · בדיקה בלבד"}';
    (document.head || document.documentElement).appendChild(st);
  }

  return { mount: mount, get dry() { return out.dry; } };
})();

window.DossierPng = DossierPng;
