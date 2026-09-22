/* The governance view: the institutions the Houthis run - ministries, security
   bodies, courts, the central bank, the aid administration - as a list beside the
   board's own map, each carrying the reports it was mapped from.

   This file owns the LIST: the cards, the category chips, the selection and the
   tab lifecycle. The map side - the layer, the pins and the popups - lives in
   places_map.js (window.PlacesMap), split off for the same reason cluster.js is
   split off from map.js: this file passed 500 lines and the map half stands on
   its own. Load order is icons.js, cluster.js, map.js, then places_map.js and
   places.js, which sit after tabs.js so the shell exists to register with.

   NO ES modules: the page runs from file://, where modules are blocked.

   tabs.js owns which pane is on screen. The whole contract with it is one call,
   made at the bottom of this file:

     Tabs.register("places", { show, hide })

   show() runs with this pane already visible; hide() while it is still on screen.

   The map is SHARED with the board, and that is the only part needing care:
   - show() clears the attack pins and puts this view's marks on the same map;
   - hide() takes them off and calls the board's own render(), which restores the
     pins AND repaints the chip counts in one pass. Restoring them any other way
     lets the numbers on the band and the pins on the map drift apart;
   - both ends re-measure the map. Hiding the filter band takes a whole row out of
     the desktop grid, so the map pane gets taller under a Leaflet that caches its
     container size. Same belt-and-braces as expand.js: measure now, and again on
     the next frame once the new layout has actually happened.

   Shared vocabulary (esc, ltr, fmtDate, glide) is declared in app.js and reached
   only from functions that run after every script has loaded. */
"use strict";

var Places = (function () {

  /* A code word never reaches the screen (design-law §2). These are the six the
     data carries; an unrecognised one is named as an institution rather than
     printed raw, and gets no chip, because nothing here knows what to call it. */
  var CAT_HE = {
    ministry: "משרד ממשלתי",
    security: "ביטחון ומשטרה",
    judiciary: "מערכת המשפט",
    economic: "כלכלה ופיננסים",
    aid_admin: "מנהל הסיוע",
    local_admin: "מנהל מקומי",
    military: "מערך צבאי"
  };
  /* Chip order, and the ONLY list buildChips reads - a category missing here
     gets a card and a badge but never a chip, so it must be kept in step with
     CAT_HE above and with PLACE_CATEGORIES in scripts/build_schema.py. */
  var CAT_ORDER = ["ministry", "security", "military", "judiciary", "economic",
    "aid_admin", "local_admin"];

  /* One line, in place, saying what the reader is looking at - and what it is
     NOT. The board's own list pane carries the same kind of line. */
  var HEAD_NOTE = "המוסדות והמערכים שבידי החות'ים, לפי דיווחים גלויים. " +
    "מי מנהל מה ומי אחראי על איזה אזור — ברמת עיר או מחוז, לא מתקנים.";

  var root = null;
  var listEl = null;
  var emptyEl = null;
  var countEl = null;
  var chipsEl = null;

  var chips = [];
  var picked = new Set();        /* empty = everything, and that is how it opens */
  var itemByKey = new Map();
  var shown = [];
  var activeKey = null;

  /* ---- data -------------------------------------------------------------- */

  /* DATA.places may not exist at all - it is written by the build, and was an
     empty array for its first day. Nothing here may assume it is there. */
  function all() {
    var list = (typeof DATA !== "undefined" && DATA && DATA.places) || [];
    return Array.isArray(list) ? list : [];
  }

  function catHe(key) {
    return CAT_HE[key] || "מוסד שלטון";
  }

  function passes(rec) {
    return picked.size === 0 || picked.has(rec.category);
  }

  function countIn(cat) {
    return all().reduce(function (n, rec) {
      return n + (rec.category === cat ? 1 : 0);
    }, 0);
  }

  /* places_map.js draws the marks. The guard is deliberate: if that script is
     missing the list still works, rather than the whole view going down with it. */
  function marks() {
    return window.PlacesMap || null;
  }

  /* ---- the card ---------------------------------------------------------- */

  function tagsHtml(rec) {
    var tags = [];
    if (rec.place_he) tags.push(esc(rec.place_he));
    if (rec.precision === "area") tags.push("מיקום משוער");
    if (rec.precision === "country" || rec.precision === "none") {
      tags.push("ללא מיקום מדויק");
    }
    /* A fact about the institution, said in a WORD. There is no hue left on this
       board and none is needed - colour never carries meaning alone anyway
       (design-law §3). */
    if (rec.sanctioned) tags.push("תחת סנקציות");
    if (!tags.length) return "";
    return '<div class="item-tags">' + tags.map(function (t) {
      return '<span class="tag">' + t + "</span>";
    }).join("") + "</div>";
  }

  /* A digits-only date is forced LTR through app.js's own helper; anything that
     is not a plain ISO day (a bare month, say) is printed as it came rather than
     run through a parser that would hand back NaN. */
  function srcDateHtml(value) {
    if (!value) return "";
    return " · " + (/^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? fmtDate(value) : ltr(value));
  }

  /* Every source is a real link to the report the institution was mapped from -
     the one thing on the card that reaches the underlying material, which is what
     design-law §6 asks of every screen. Stacked, not laid in a row: a report's
     title is a sentence, and three sentences side by side are three cut ones. */
  function sourcesHtml(rec) {
    var sources = Array.isArray(rec.sources) ? rec.sources : [];
    if (!sources.length) return "";
    return '<div class="p-sources"><span class="tn-label">מקורות ' +
      ltr(sources.length) + "</span>" +
      sources.map(function (s) {
        return '<a class="p-src" href="' + esc(s.url) + '" target="_blank" ' +
          'rel="noopener"><span class="p-src-t">' + esc(s.title) + "</span>" +
          '<span class="p-src-m">' + esc(s.publisher) + srcDateHtml(s.date) +
          "</span></a>";
      }).join("") + "</div>";
  }

  function cardHtml(rec) {
    /* The reading order is the board's own: what this is, then where and what
       kind of place, then the category badge, and everything longer than a line
       inside .item-detail, which opens with the card.

       The category is told apart by a fill, a border and THE WORD - the .kbadge
       precedent from the attack cards, carrying the same word its chip carries,
       so pressing a chip and reading a card agree. No ninth hue: every colour on
       this board is spoken for by a front or a verdict. */
    var out = [
      "<h3>" + esc(rec.he) + "</h3>",
      tagsHtml(rec),
      '<div class="item-meta"><span class="kbadge">' +
        esc(catHe(rec.category)) + "</span></div>",
      '<div class="item-detail" hidden>'
    ];
    if (rec.role_he) out.push('<p class="he">' + esc(rec.role_he) + "</p>");
    if (rec.ar) {
      out.push('<div class="p-ar"><span class="tn-label">בערבית</span>' +
        '<span dir="rtl" lang="ar">' + esc(rec.ar) + "</span></div>");
    }
    /* Where the sources disagree about who actually holds the place, that is said
       here, on the record, rather than settled silently at build time. */
    if (rec.boundary_note_he) {
      out.push('<div class="p-note">' + esc(rec.boundary_note_he) + "</div>");
    }
    out.push(sourcesHtml(rec), "</div>");
    return out.join("");
  }

  /* ---- selection --------------------------------------------------------- */

  function setDetail(item, open) {
    if (!item) return;
    var detail = item.querySelector(".item-detail");
    if (detail) detail.hidden = !open;
    item.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function isOpen(item) {
    return !!item && item.getAttribute("aria-expanded") === "true";
  }

  /* The same one-state rule the attack list uses: the selected card IS the card
     whose detail is open, so a mark opens a card and a card marks the map, with
     no second state to keep agreeing. */
  function select(key, opts) {
    if (activeKey && activeKey !== key && itemByKey.has(activeKey)) {
      var previous = itemByKey.get(activeKey);
      previous.classList.remove("active");
      setDetail(previous, false);
    }
    var item = itemByKey.get(key);
    if (!item) return;
    activeKey = key;
    item.classList.add("active");
    setDetail(item, true);
    if (opts && opts.scroll) scrollToCard(item);
    if (opts && opts.popup && marks()) marks().select(key);
  }

  /* The card lands at the TOP of the pane, minus the sticky head measured at call
     time - never stored, because a height written into a variable is the --band-h
     mistake. Centring is right for a line and wrong for a card: the detail opens
     before the scroll, so the card is usually taller than the pane and centring
     pushes its own heading off the top. Same rule, and the same reason, as
     scrollListTo() in app.js. */
  function scrollToCard(item) {
    var behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto" : "smooth";
    /* On a phone the PAGE is the only scroller and nothing is pinned over it. */
    if (!root || window.matchMedia("(max-width: 900px)").matches) {
      move(window, Math.max(0, window.scrollY +
        item.getBoundingClientRect().top - 12), behavior);
      return;
    }
    var head = root.querySelector(".list-head");
    var headH = head ? head.getBoundingClientRect().height : 0;
    var top = Math.max(0, root.scrollTop +
      (item.getBoundingClientRect().top - root.getBoundingClientRect().top) -
      headH - 10);
    move(root, top, behavior);
  }

  /* glide() attempts the animation and then CHECKS that it happened - smooth
     scrolling has been measured returning without error and moving nothing at
     all in an embedded browser on this very board. */
  function move(scroller, top, behavior) {
    if (typeof glide === "function") { glide(scroller, top, behavior); return; }
    if (scroller === window) window.scrollTo(0, top);
    else scroller.scrollTop = top;
  }

  /* ---- chips ------------------------------------------------------------- */

  /* All OFF at load: the screen opens showing everything it holds, and a default
     that hides rows is never mine to reach for and always the reader's to ask for
     (design-law §6, and CLAUDE.md's own history of that rule).

     A chip is drawn only for a category the data actually has, and where there is
     none the filter row is not drawn at all - an empty control band is worse than
     no band, because it promises a control that never arrives (§4). */
  function buildChips() {
    chips = [];
    if (!chipsEl) return;
    chipsEl.innerHTML = "";
    var present = CAT_ORDER.filter(function (cat) { return countIn(cat) > 0; });
    /* A category that is no longer in the data must not stay pressed: a filter
       with no chip left to release it would go on hiding rows with nothing on
       screen saying so. */
    picked.forEach(function (cat) {
      if (present.indexOf(cat) === -1) picked.delete(cat);
    });
    present.forEach(function (cat) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      /* The accent, and only when the chip is ON. No category here owns a hue:
         they are told apart by the word, exactly as the badge on the card is. */
      btn.style.setProperty("--chip-c", "var(--accent-text)");
      btn.style.setProperty("--chip-t", "var(--accent-tint)");
      btn.setAttribute("aria-pressed", "false");
      var label = document.createElement("span");
      label.textContent = catHe(cat);
      var num = document.createElement("span");
      num.className = "n";
      btn.append(label, num);
      btn.addEventListener("click", function () {
        if (picked.has(cat)) picked.delete(cat);
        else picked.add(cat);
        paint();
      });
      chipsEl.appendChild(btn);
      chips.push({ btn: btn, num: num, cat: cat });
    });
    var box = chipsEl.closest(".p-filters");
    if (box) box.hidden = present.length === 0;
  }

  /* Called from paint(), so the numbers and the list can never disagree. */
  function refreshChips() {
    chips.forEach(function (chip) {
      var on = picked.has(chip.cat);
      chip.btn.classList.toggle("on", on);
      chip.btn.setAttribute("aria-pressed", on ? "true" : "false");
      chip.num.textContent = String(countIn(chip.cat));
    });
  }

  /* Naming what is filtered out beats a bare "no results" - the same rule the
     band's own empty message follows. */
  function emptyMessage() {
    if (!all().length) {
      return "עדיין אין נתונים על מוסדות וכוחות. הם ייטענו לכאן בעדכון הבא.";
    }
    if (picked.size) {
      return "אין מוסדות בסינון " + [...picked].map(catHe).join(" · ") + ".";
    }
    return "אין מוסדות להצגה.";
  }

  /* ---- the pane ---------------------------------------------------------- */

  /* The pane's own furniture, built here rather than written into index.html:
     the shell owns WHERE this section sits and this file owns what is in it. */
  /* Only the title row lives in the sticky .list-head. The intro and the
     chips scroll away with the content: all three pinned together measured
     275px, so a card selected from the map could never start higher than
     the pane's middle — which is exactly what Ziv reported (2026-09-01:
     "it shows me from the middle... and not from the start"). scrollToCard
     subtracts the sticky head at call time, so the fix is structural. */
  function shellHtml() {
    return '<div class="list-head">' +
      '<h2>מוסדות וכוחות <span class="count"></span></h2>' +
      "</div>" +
      '<div class="list-intro">' +
      '<p class="claim-note">' + HEAD_NOTE + "</p>" +
      '<div class="p-filters" hidden>' +
      '<span class="chips-label" id="lbl-places-cat">סוג מוסד</span>' +
      '<div class="p-chips" role="group" aria-labelledby="lbl-places-cat"></div>' +
      "</div></div>" +
      '<ol class="list"></ol>' +
      '<div class="empty" hidden><p></p></div>';
  }

  function findRoot() {
    if (root && document.body.contains(root)) return root;
    root = document.querySelector('[data-pane="places"]') ||
      document.getElementById("places-pane");
    return root;
  }

  /* Idempotent: called at load, and again from show() in case the shell inserted
     the pane after this script ran. */
  function build() {
    if (!findRoot()) return false;
    if (!listEl || !root.contains(listEl)) {
      root.classList.add("places-pane");
      root.innerHTML = shellHtml();
      listEl = root.querySelector(".list");
      emptyEl = root.querySelector(".empty");
      countEl = root.querySelector(".count");
      chipsEl = root.querySelector(".p-chips");
    }
    refresh();
    return true;
  }

  /* The whole view, chips included, redrawn from the data as it is now. Pressing
     a chip calls paint() instead: the chip SET has not changed, and rebuilding
     the buttons would pull the one just pressed out from under the finger. */
  function refresh() {
    buildChips();
    paint();
  }

  function paint() {
    if (!listEl) return;
    shown = all().filter(passes);
    listEl.innerHTML = "";
    itemByKey.clear();
    activeKey = null;
    shown.forEach(function (rec) {
      var li = document.createElement("li");
      li.className = "item";
      li.innerHTML = cardHtml(rec);
      li.tabIndex = 0;
      li.setAttribute("aria-expanded", "false");
      li.addEventListener("click", function (event) {
        if (event.target.closest("a, summary, details")) return;
        /* Clicking the card that is already open closes its detail. It stays the
           selected record on the map - closing a card is not deselecting it. */
        if (activeKey === rec.key) {
          setDetail(li, !isOpen(li));
          return;
        }
        select(rec.key, { popup: true });
      });
      li.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        li.click();
      });
      listEl.appendChild(li);
      itemByKey.set(rec.key, li);
    });
    if (countEl) countEl.textContent = String(shown.length);
    if (emptyEl) {
      emptyEl.hidden = shown.length > 0;
      if (!shown.length) emptyEl.querySelector("p").textContent = emptyMessage();
    }
    refreshChips();
    /* The marks are redrawn from the same pass that built the list, so a chip can
       never leave the map showing something the list does not. */
    if (marks() && marks().live()) marks().draw(shown);
  }

  /* ---- the shell's two calls --------------------------------------------- */

  /* Leaflet caches its container size, and the pane it draws in has just changed
     height: the filter band above it is gone in this view, which takes a whole
     row out of the desktop grid. So it is told twice - now, and again on the next
     frame once the new layout has actually happened. The ResizeObserver inside
     map.js is the belt; it has been measured firing ZERO times in an embedded
     browser, so it is never the mechanism (expand.js does exactly this). */
  function remeasure() {
    if (!window.MapView || typeof MapView.invalidate !== "function") return;
    MapView.invalidate();
    requestAnimationFrame(function () { MapView.invalidate(); });
  }

  function show() {
    build();
    /* The attack pins come off first: the map is shared, and two views' marks on
       it at once would be two answers to "what am I looking at". */
    if (window.MapView && typeof MapView.draw === "function") MapView.draw([]);
    if (marks()) {
      marks().add(shown, function (key) {
        select(key, { scroll: true, popup: false });
      });
    }
    remeasure();
  }

  function hide() {
    /* The map pane is on screen in this view too, so its enlarge control works
       here - and an enlarged map is a FIXED panel. Left open it would float over
       whatever view comes next. tabs.js closes it when the board is left; this
       is the same courtesy from the other view that owns the map. */
    if (window.MapExpand) MapExpand.close();
    if (marks()) marks().remove();
    /* The one true "restore the board" call: render() re-filters, redraws the
       attack pins and repaints the chip counts in the same pass, so the numbers
       on the band can never disagree with the pins on the map. */
    if (typeof render === "function") render();
    remeasure();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { build(); });
  } else {
    build();
  }

  return {
    show: show,
    hide: hide,
    refresh: refresh,
    /* Read by places_map.js when it draws a popup - one Hebrew table, one place. */
    catHe: catHe,
    sourcesHtml: sourcesHtml,
    shown: function () { return shown.slice(); }
  };
})();

window.Places = Places;

/* tabs.js loads late in the page, so the shell may not exist when this file runs.
   Guarded, and retried once the document is ready. */
(function register() {
  var done = false;
  function tryOnce() {
    if (done || !window.Tabs || typeof Tabs.register !== "function") return;
    done = true;
    Tabs.register("places", { show: Places.show, hide: Places.hide });
  }
  tryOnce();
  if (!done) {
    document.addEventListener("DOMContentLoaded", tryOnce);
    window.addEventListener("load", tryOnce);
  }
})();
