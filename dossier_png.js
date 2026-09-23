/* dossier_png.js - the download buttons under every map picture, on the dossier
   tab and on the maps tab, and the dry path that proves them without putting a
   file on anybody's screen.

   window.DossierPng = { mount(pane), dry, shapes, fileName(id, variant, shape,
                         ext), stash(item) } - the last three for the editable
   slide's button (dossier_pptx_edit.js), so its sizes, name and dry item come
   from here.

   Ziv asked for the maps as PNG files he can download (2026-09-17), and the
   same day for two SHAPES of each: wide for a whole slide, square for a slide
   with text beside it. The picture already exists at slide resolution -
   DossierMap.exportPng(id, theme, w, h, variant, shape) is what the deck's own
   slides are made of - so this is a thin wrapper over it: export in the LIGHT
   theme (the deck's one theme, and the one that prints), turn the data URL into
   a blob, and hand it to the view's own save helper.

   VERIFY WITH `?png=dry`, NEVER A REAL TAP. The board runs on the machine Ziv
   is sitting at: a test press drops a file in his downloads and pops his file
   explorer open over whatever he is doing. It happened twice in one session on
   2026-09-12 with the deck, which is why `?deck=dry` exists; this is the same
   flag for the same reason. With it the page builds every picture in every
   shape on load, SEQUENTIALLY (eighteen huge canvases at once is a memory spike
   for nothing), stashes what it measured on window.DossierPng.dry, and every
   button stashes instead of saving and says so in Hebrew.

   No ES modules - the page runs from file://. Loaded BEFORE dossier_view.js and
   maps_tab.js, so the global exists by the time either view renders and calls
   mount(). */
"use strict";

var DossierPng = (function () {
  /* TWO SHAPES, TWO BUTTONS (2026-09-17). Ziv puts some of these pictures on a
     half slide with text beside them and asked for a shape that fits, so every
     picture offers the WIDE one (a whole 16:9 slide) and the SQUARE one (beside
     the text). The label says which slide it is for rather than naming pixels:
     a number tells him nothing about where the picture goes. The square frame
     is authored per frame - see dossier_map.js - and is never a crop. */
  var SHAPES = [
    { shape: "wide", label: "PNG רחב (שקף מלא)", w: 2560, h: 1440 },
    { shape: "square", label: "PNG מרובע (לצד טקסט)", w: 2048, h: 2048 }
  ];
  var BUSY = "מכין את התמונה…";
  var FAILED = "יצירת התמונה נכשלה.";
  var MISSING = "ההורדה אינה זמינה";
  var THEME = "light";
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
  /* The SHAPE rides in the name, before the date: two pictures of the same map
     land in the same folder on the same day, and "which one is this" must be
     answerable without opening either. */
  function fileName(id, variant, shape, ext) {
    return "osint-map-" + id + (variant && variant !== "plain" ? "-" + variant : "") +
      "-" + (shape || "wide") + "-" + stamp() + "." + (ext || "png");
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

  function render(id, variant, s) {
    return ready().then(function () {
      var png = DossierMap.exportPng(id, THEME, s.w, s.h, variant, s.shape);
      if (typeof png !== "string" || png.indexOf("base64,") < 0) throw new Error(FAILED);
      return png;
    });
  }
  function note(id, variant, s, png) {
    /* `name` is the file the real button would have written. It is stashed so a
       checker can read the stamped filename without a tap putting a file on
       Ziv's screen - the whole bargain of the dry run. */
    /* `kind` says what this picture IS, and it exists for the checker
       (2026-09-18): every MAP must come back with a self-check, and a map that
       reports nothing is a map whose painters never ran - the one failure that
       looks exactly like a clean run. The trends graph is stashed into this
       same list by docs\maps_tab.js and has no map painters in it at all, so
       one word on the item tells the two apart instead of a list of ids in the
       Python that would go stale the first time a map is added. */
    return stash({ id: id, variant: variant, shape: s.shape, kind: "map",
                   width: s.w, height: s.h,
                   name: fileName(id, variant, s.shape),
                   bytes: Math.round((png.length - png.indexOf(",") - 1) * 3 / 4),
                   dataUrl: png });
  }
  /* ONE stash for every dry item, the pictures and the editable slides of
     dossier_pptx_edit.js alike (2026-09-23). A new press replaces the old item
     of the same picture AND the same kind - keyed without the kind, the slide
     and the picture of one map would keep evicting each other. */
  function stash(item) {
    out.dry = out.dry || { done: false, items: [] };
    out.dry.items = out.dry.items.filter(function (it) {
      return it.id !== item.id || it.variant !== item.variant ||
        it.shape !== item.shape || it.kind !== item.kind;
    });
    out.dry.items.push(item);
    return item;
  }

  /* ---- the button ---------------------------------------------------------- */

  function status(section, text) {
    var el = section.querySelector(".ds-map-status");
    if (el) el.textContent = text || "";
  }

  function press(section, btn, s) {
    var id = section.dataset.map, variant = section.dataset.variant || "plain";
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = BUSY; status(section, "");
    render(id, variant, s).then(function (png) {
      btn.disabled = false; btn.textContent = label;
      if (DRY) {
        var it = note(id, variant, s, png);
        status(section, "בדיקה בלבד — " + it.width + "x" + it.height +
          ". הקובץ לא נשמר.");
        return;
      }
      var blob = toBlob(png), save = window.DossierSave;
      if (!blob || typeof save !== "function") { status(section, MISSING); return; }
      save({ blob: blob, fileName: fileName(id, variant, s.shape), mime: "image/png" });
    }, function (err) {
      btn.disabled = false; btn.textContent = label;
      console.error("dossier_png:", err);
      status(section, FAILED);
    });
  }

  /* THE THIRD BUTTON: the same picture as an EDITABLE slide (Ziv, 2026-09-23) -
     every word, pin and number a PowerPoint object over the picture's own
     ground. Wide only: the slide is 16:9. dossier_pptx_edit.js builds it and
     saves it, or under ?png=dry stashes it here and saves nothing. */
  var PPTX = { shape: "wide", label: "מצגת לעריכה (שקף מלא)" };
  var PPTX_BUSY = "מכין את המצגת…";
  var PPTX_FAILED = "יצירת המצגת נכשלה.";

  function pressPptx(section, btn) {
    var id = section.dataset.map, variant = section.dataset.variant || "plain";
    var label = btn.textContent, P = window.DossierPptx;
    if (!P || typeof P.build !== "function") { status(section, MISSING); return; }
    btn.disabled = true; btn.textContent = PPTX_BUSY; status(section, "");
    P.build(id, THEME, variant, PPTX.shape).then(function (res) {
      btn.disabled = false; btn.textContent = label;
      if (res && res.kind === "pptx") {
        status(section, "בדיקה בלבד — מצגת של " + ((res.counts && res.counts.placed) || 0) +
          " פריטים. הקובץ לא נשמר.");
      }
    }, function (err) {
      btn.disabled = false; btn.textContent = label;
      console.error("dossier_png: pptx", err);
      var msg = err && err.message;
      status(section, /[֐-׿]/.test(msg || "") ? msg : PPTX_FAILED);
    });
  }

  /* THREE buttons per PICTURE, which on these tabs means three per (map,
     variant): each block on the page is its own canvas, so each saves what is
     above it and nothing else has to be chosen - the wide picture, the square
     one, and the wide one as an editable slide. Quiet secondary controls - they are not what the dossier is
     for, and its own primary control (the deck) sits in the header (design-law:
     hierarchy from weight and shade, never a second colour). */
  function mount(pane) {
    if (!pane || !window.DossierMap) return;
    Array.prototype.forEach.call(pane.querySelectorAll(".ds-map"), function (section) {
      if (section.querySelector(".ds-png-btn")) return;
      var row = document.createElement("div");
      row.className = "ds-map-actions";
      SHAPES.forEach(function (s) {
        var btn = document.createElement("button");
        btn.type = "button"; btn.className = "ds-png-btn"; btn.textContent = s.label;
        btn.addEventListener("click", function () { press(section, btn, s); });
        row.appendChild(btn);
      });
      var edit = document.createElement("button");
      edit.type = "button"; edit.className = "ds-png-btn"; edit.textContent = PPTX.label;
      edit.addEventListener("click", function () { pressPptx(section, edit); });
      row.appendChild(edit);
      var line = document.createElement("p");
      line.className = "ds-map-status";
      line.setAttribute("aria-live", "polite");
      section.appendChild(row);
      section.appendChild(line);
    });
    if (DRY) dryRun(pane);
  }

  /* ---- the dry run ---------------------------------------------------------- */

  /* Every picture on the page in every shape, one after another, with nothing
     saved and nothing opened. SEQUENTIAL on purpose: each export is a canvas of
     millions of pixels plus its data URL, and building eighteen of them at once
     spikes memory for no gain. What it measured lands on window.DossierPng.dry
     for a checker to read - the deck's own ?deck=dry bargain.

     TWO PANES ASK, since the maps tab arrived: the dossier's six pictures and
     this tab's three. They share ONE queue and one item list, and `done` is set
     when the last pane's jobs drain - two runs each resetting the stash would
     leave a checker reading half of it and calling it all. */
  var queue = Promise.resolve(), running = 0;

  function dryRun(pane) {
    var jobs = [];
    Array.prototype.forEach.call(pane.querySelectorAll(".ds-map"), function (s) {
      SHAPES.forEach(function (shape) {
        jobs.push({ id: s.dataset.map, variant: s.dataset.variant || "plain", s: shape });
      });
    });
    out.dry = out.dry || { done: false, items: [] };
    out.dry.done = false;
    running++;
    queue = queue.then(function () {
      return jobs.reduce(function (chain, job) {
        return chain.then(function () {
          return render(job.id, job.variant, job.s).then(function (png) {
            note(job.id, job.variant, job.s, png);
          }, function (err) {
            console.error("dossier_png: dry export failed for " + job.id, err);
          });
        });
      }, Promise.resolve());
    }).then(function () {
      running -= 1;
      if (!running) out.dry.done = true;
    });
  }

  if (DRY) {
    var st = document.createElement("style");
    st.textContent = '.ds-png-btn::after{content:" · בדיקה בלבד"}';
    (document.head || document.documentElement).appendChild(st);
  }

  /* shapes, fileName and stash are read by dossier_pptx_edit.js, so the slide's
     sizes, its filename and its dry item come from this one place. */
  return { mount: mount, shapes: SHAPES, fileName: fileName, stash: stash,
           get dry() { return out.dry; } };
})();

window.DossierPng = DossierPng;
