/* trend_chart.js - the trends graph on the maps tab: one bar per DAY, stacked by
   front, the day's total written above it.

   Ziv asked for it on 2026-09-18: "a graph that just kind of sums the numbers of
   attacks from all fronts, from when this all started, so we can see trends." It
   lives on the maps screen as one more picture, after the last map, with the
   same two download buttons every picture there carries.

   THE NUMBERS AND THE PAINT ARE HERE; THE BLOCK IS IN maps_tab.js - its heading,
   its three-position switch and its two download buttons. Split that way because
   both halves are already near the 500-line cap, and because the maps tab
   already owns that pane's markup and hangs the maps' own buttons there.

     window.TrendChart = { bind(canvas), draw(), range(), setRange(key),
                           seriesFor(key), exportPng(shape), skin(), stash(item),
                           dry, painted, TITLE, FOOT, EMPTY, RANGES, SHAPES, ... }

   THE NUMBER ON THIS GRAPH IS THE NUMBER ON THE BOARD. The first tab counts one
   record of DATA.attacks per event - build.py has already merged the channels
   that reported the same operation onto one record by `event_key`, and `part_of`
   only says a message carried two operations - so the graph counts the same way:
   every record whose `date` falls in the range, nothing collapsed and nothing
   dropped. A total here that did not match the board's own counter for the same
   dates would make one of the two screens a liar.

   TIME RUNS RIGHT TO LEFT, oldest at the right edge. The page is RTL and so is
   his own filter band - the from-date box sits to the RIGHT of the to-date box -
   so a graph running the other way would read backwards against the screen it is
   on. `OLDEST_RIGHT` is the one place that is decided.

   THE PICTURE IS LIGHT, on the page and in the download alike, because every
   other picture on this tab is (DOSSIER_EXPORT.md, 2026-09-17: "make all of the
   maps bright") - it reads DossierMap.screenTheme rather than naming a theme, so
   the two can never drift. The front HUES are the board's own; their LIGHTNESS is
   stepped for the light ground, which is what dossier_map_light.js already does
   with the violet. Measured: every one of the four holds 3:1 or better on the
   picture's white AND on the page's navy (where its key swatch sits), and the
   dataviz validator passes all five checks all-pairs, worst deutan dE 11.5.

   NO HOVER LAYER, deliberately. Every value on this graph is already readable
   without one: the day's total is printed over its bar, the key under the
   picture carries the count per front, and the first tab lists the events
   themselves for any range. A tooltip would also be the one thing on the page
   that the downloaded picture could not carry, and this board is read on a
   phone, where there is no hover at all.

   No ES modules - the page runs from file://. */
"use strict";

var TrendChart = (function () {
  /* ---- copy, fixed by Ziv ------------------------------------------------- */
  var TITLE = "תקיפות מדווחות לפי יום וזירה";
  var FOOT = "כל עמודה היא יום. נספרים אירועים שדווחו, ולא כל מה שקרה בשטח.";
  var TOTAL_HE = 'סה"כ';
  var ATTACKS_HE = "תקיפות";
  var EMPTY = "אין נתוני תקיפות להצגה.";
  var OTHER_HE = "אחר";

  /* THE DAY THE CURRENT OFFENSIVE BEGAN, and the graph's own default window.
     The data confirms it: 41 records on 2026-09-03 against 3 to 7 on each of the
     days before it. Written here because nothing the page loads carries it. */
  var OFFENSIVE_START = "2026-09-03";
  /* `backfill_start` in data\channels.json - the first day this board covers at
     all. It is a PIPELINE fact and never reaches the browser, so it is written
     here; if it ever moves, it moves in both places. */
  var WINDOW_START = "2026-07-12";
  var WEEK_DAYS = 7;

  var RANGES = [
    { key: "week", he: "שבוע אחרון", days: WEEK_DAYS },
    { key: "sep3", he: "מאז 3.9", from: OFFENSIVE_START },
    { key: "jul12", he: "מאז 12.7", from: WINDOW_START }
  ];
  var DEFAULT_RANGE = "sep3";
  var OLDEST_RIGHT = true;

  /* ---- the two skins ------------------------------------------------------ */
  /* `light` is the picture's, on screen and in the file. `dark` is the board's
     own tokens verbatim, kept so the graph follows if the tab's theme ever goes
     back to the board's. Front hues are the same in both; only the step moves. */
  var SKIN = {
    light: {
      ground: "#FFFFFF", ink: "#14202C", muted: "#3A4A5A", faint: "#5A6876",
      grid: "rgba(20, 40, 60, 0.14)", axis: "rgba(20, 40, 60, 0.32)",
      front: { ships: "#37A493", israel: "#A44671", saudi: "#AD7D00",
               internal: "#7251E6", other: "#7B8794" }
    },
    dark: {
      ground: "#0A1E33", ink: "#E6EDF5", muted: "#A9BACC", faint: "#7C8FA3",
      grid: "rgba(230, 237, 245, 0.10)", axis: "rgba(230, 237, 245, 0.32)",
      front: { ships: "#5EEAD4", israel: "#F49CC4", saudi: "#F5C445",
               internal: "#B7A5F7", other: "#8FA3B8" }
    }
  };

  var FONT = '"Heebo", "Segoe UI", sans-serif';
  var BASE_W = 1280;            /* the CSS width every size below is written for */
  var TEXT_SCREEN = 1.15, TEXT_SLIDE = 1.5;   /* dossier_map.js's own two scales */
  var SHAPES = [
    { shape: "wide", label: "PNG רחב (שקף מלא)", w: 2560, h: 1440 },
    { shape: "square", label: "PNG מרובע (לצד טקסט)", w: 2048, h: 2048 }
  ];
  var DRY = /[?&]png=dry(&|$)/.test(location.search);
  var BUSY = "מכין את התמונה…", FAILED = "יצירת התמונה נכשלה.";
  var MISSING = "ההורדה אינה זמינה";

  var state = { range: DEFAULT_RANGE, canvas: null };
  var out = { dry: null, painted: null };

  /* ---- dates -------------------------------------------------------------- */
  /* Local parts and noon, never toISOString() and never midnight: filters.js
     pays for both lessons - UTC hands back yesterday in a +03:00 zone, and
     stepping a day from midnight across a clock change lands an hour early. */
  function parseIso(iso) {
    var p = String(iso).split("-");
    return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0, 0);
  }
  function isoOf(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
      "-" + String(d.getDate()).padStart(2, "0");
  }
  function shift(iso, days) {
    var d = parseIso(iso);
    d.setDate(d.getDate() + days);
    return isoOf(d);
  }
  function dayMonth(iso) {           /* 2026-09-03 -> 3.9, the board's own form */
    var p = iso.split("-");
    return (+p[2]) + "." + (+p[1]);
  }
  function fullDate(iso) {
    var p = iso.split("-");
    return (+p[2]) + "." + (+p[1]) + "." + p[0];
  }

  /* ---- the series --------------------------------------------------------- */
  function attacks() {
    return (typeof DATA !== "undefined" && DATA && DATA.attacks) ? DATA.attacks : null;
  }
  /* Read from filters.js rather than written again here: one list of fronts, in
     one order, so the graph stacks them the way the band names them. */
  function frontList() {
    return (typeof FRONTS !== "undefined" && FRONTS) ? FRONTS : [];
  }
  function rangeOf(key) {
    for (var i = 0; i < RANGES.length; i++) if (RANGES[i].key === key) return RANGES[i];
    return RANGES[1];
  }

  /* { from, to, days:[{date, per, total}], keys:[{key, he, n}], total, max }.
     A day with nothing on it is kept as an EMPTY SLOT - a gap that closed up
     would read as a busier stretch than there was. */
  function seriesFor(key) {
    var recs = attacks(), list = frontList();
    if (!recs || !recs.length || !list.length) return null;
    var to = "", i;
    for (i = 0; i < recs.length; i++) if (recs[i].date > to) to = recs[i].date;
    if (!to) return null;
    var r = rangeOf(key);
    var from = r.days ? shift(to, -(r.days - 1)) : r.from;
    if (from > to) from = to;

    var slots = [], index = {};
    for (var d = from; d <= to; d = shift(d, 1)) {
      index[d] = slots.length;
      slots.push({ date: d, per: {}, total: 0 });
    }
    var known = {};
    list.forEach(function (f) { known[f.key] = true; });
    var per = {}, total = 0;
    for (i = 0; i < recs.length; i++) {
      var rec = recs[i];
      if (rec.date < from || rec.date > to) continue;
      var slot = slots[index[rec.date]];
      if (!slot) continue;
      /* A front the band does not know still COUNTS - the bars have to add up to
         the number the first tab shows - so it stacks in its own grey bucket. */
      var k = known[rec.front] ? rec.front : "other";
      slot.per[k] = (slot.per[k] || 0) + 1;
      slot.total += 1;
      per[k] = (per[k] || 0) + 1;
      total += 1;
    }
    var keys = list.filter(function (f) { return per[f.key]; })
      .map(function (f) { return { key: f.key, he: f.he, n: per[f.key] }; });
    if (per.other) keys.push({ key: "other", he: OTHER_HE, n: per.other });
    var max = 0;
    slots.forEach(function (s) { if (s.total > max) max = s.total; });
    return { key: key, from: from, to: to, days: slots, keys: keys,
             total: total, max: max };
  }

  /* ---- painting ----------------------------------------------------------- */
  function niceStep(raw) {
    var steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    for (var i = 0; i < steps.length; i++) if (steps[i] >= raw) return steps[i];
    return steps[steps.length - 1];
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h));
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  }
  function say(ctx, str, x, y, size, colour, align, weight, rtl) {
    ctx.font = (weight || 400) + " " + Math.round(size) + "px " + FONT;
    ctx.fillStyle = colour;
    ctx.textAlign = align || "right";
    ctx.textBaseline = "alphabetic";
    /* A string of digits and separators is forced LTR (design-law S2): a dash or
       a space between two numbers is a bidi NEUTRAL and takes the paragraph's
       direction, so in an RTL line 3.9-18.9 is drawn 18.9-3.9. */
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.fillText(str, x, y);
  }
  function wrap(ctx, str, maxW) {
    var words = str.split(" "), lines = [], line = "";
    for (var i = 0; i < words.length; i++) {
      var next = line ? line + " " + words[i] : words[i];
      if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = words[i]; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  /* Totals are printed WHERE THEY FIT, and the peaks are printed whatever else
     has to go: at 69 bars a number on every one of them is a grey smear, and the
     one thing a reader looks for on a trend is the spike. So the days are placed
     in priority order - biggest first, then along the range - and each is kept
     only if its box clears every box already taken. */
  function placeTotals(ctx, days, xOf, size, pad) {
    ctx.font = "600 " + Math.round(size) + "px " + FONT;
    var live = [];
    days.forEach(function (d, i) { if (d.total) live.push({ i: i, d: d }); });
    var order = live.slice().sort(function (a, b) {
      return b.d.total - a.d.total || a.i - b.i;
    });
    var taken = [], put = {};
    order.forEach(function (c) {
      var w = ctx.measureText(String(c.d.total)).width + pad;
      var x = xOf(c.i), box = [x - w / 2, x + w / 2];
      for (var j = 0; j < taken.length; j++) {
        if (box[0] < taken[j][1] && box[1] > taken[j][0]) return;
      }
      taken.push(box);
      put[c.i] = true;
    });
    return put;
  }

  function paint(ctx, W, H, ts, s, skin, titled) {
    var u = W / BASE_W;
    var px = function (base, floor) { return Math.max(floor, base * u * ts); };
    ctx.save();
    ctx.fillStyle = skin.ground;
    ctx.fillRect(0, 0, W, H);
    if (!s || !s.days.length) {
      say(ctx, EMPTY, W / 2, H / 2, px(15, 13), skin.muted, "center", 500, true);
      ctx.restore();
      return null;
    }
    var padX = px(14, 8), padY = px(10, 6), gap = px(8, 5);
    var fHead = px(15, 12), fKey = px(14, 11), fTick = px(12, 9);
    var fTotal = px(12, 9), fFoot = px(13, 10);

    /* --- the header: what is counted, and over which days ------------------ */
    var y = padY + fHead;
    /* THE DOWNLOAD CARRIES ITS OWN TITLE; THE PAGE DOES NOT (2026-09-18, the
       fresh-eyes verifier). On the page the heading is the HTML `h3` above the
       canvas, so painting it as well would print it twice - which is why the
       map painter stopped painting headings at all. A PNG dropped on a slide
       has no such heading beside it, so the title and the window it covers are
       the first two things in the picture, and the switch position's own words
       say which window without making him read the dates. */
    if (titled) {
      say(ctx, TITLE, W - padX, y, fHead * 1.32, skin.ink, "right", 600, true);
      say(ctx, rangeOf(s.key).he, padX, y, fHead, skin.muted, "left", 500, true);
      y += gap + fHead * 1.25;
    }
    say(ctx, TOTAL_HE + " " + s.total + " " + ATTACKS_HE, W - padX, y, fHead,
        skin.ink, "right", 600, true);
    say(ctx, fullDate(s.from) + " – " + fullDate(s.to), padX, y, fHead * 0.92,
        skin.faint, "left", 400, false);

    /* --- the key: only the fronts that are actually in the range ----------- */
    y += gap + fKey;
    ctx.font = "400 " + Math.round(fKey) + "px " + FONT;
    var sw = fKey * 0.78, x = W - padX;
    s.keys.forEach(function (k) {
      var label = k.he + " " + k.n;
      var w = ctx.measureText(label).width + sw + fKey * 0.42;
      if (x - w < padX && x < W - padX) { x = W - padX; y += fKey * 1.5; }
      ctx.fillStyle = skin.front[k.key] || skin.muted;
      ctx.fillRect(x - sw, y - sw * 0.86, sw, sw * 0.86);
      say(ctx, label, x - sw - fKey * 0.34, y, fKey, skin.muted, "right", 400, true);
      x -= w + fKey * 0.9;
    });

    /* --- the plot ---------------------------------------------------------- */
    var step = niceStep(Math.max(1, s.max) / 4);
    var top = Math.max(step, Math.ceil(s.max / step) * step);
    ctx.font = "400 " + Math.round(fTick) + "px " + FONT;
    var gut = ctx.measureText(String(top)).width + fTick * 0.7;
    var footLines = (function () {
      ctx.font = "400 " + Math.round(fFoot) + "px " + FONT;
      return wrap(ctx, FOOT, W - padX * 2);
    })();
    var plotL = OLDEST_RIGHT ? padX : padX + gut;
    var plotR = OLDEST_RIGHT ? W - padX - gut : W - padX;
    var plotT = y + gap + fTotal * 1.4;
    var plotB = H - padY - footLines.length * fFoot * 1.35 - gap - fTick * 1.5;
    var plotH = Math.max(10, plotB - plotT);
    var slot = (plotR - plotL) / s.days.length;
    var xOf = function (i) {
      return OLDEST_RIGHT ? plotR - (i + 0.5) * slot : plotL + (i + 0.5) * slot;
    };
    var yOf = function (v) { return plotB - (v / top) * plotH; };

    /* Gridlines are solid hairlines one shade off the ground, never dashed. */
    ctx.lineWidth = Math.max(1, u * 0.9);
    for (var v = 0; v <= top + 0.001; v += step) {
      ctx.strokeStyle = v === 0 ? skin.axis : skin.grid;
      ctx.beginPath();
      ctx.moveTo(plotL, Math.round(yOf(v)) + 0.5);
      ctx.lineTo(plotR, Math.round(yOf(v)) + 0.5);
      ctx.stroke();
      say(ctx, String(v), OLDEST_RIGHT ? plotR + fTick * 0.5 : plotL - fTick * 0.5,
          yOf(v) + fTick * 0.36, fTick, skin.faint,
          OLDEST_RIGHT ? "left" : "right", 400, false);
    }

    /* Bars: thin, never filling the slot, with a 2px ground gap between the
       segments of a stack - white doing the separating, never a stroke. */
    var barW = Math.max(1, Math.min(26 * u, slot * 0.72));
    var seg = Math.min(2 * u, barW * 0.3);
    var order = s.keys.map(function (k) { return k.key; });
    s.days.forEach(function (day, i) {
      if (!day.total) return;
      var cum = 0, bx = xOf(i) - barW / 2, last = 0;
      order.forEach(function (k, n) { if (day.per[k]) last = n; });
      order.forEach(function (k, n) {
        var val = day.per[k];
        if (!val) return;
        var y1 = yOf(cum), y0 = yOf(cum + val), h = y1 - y0;
        var over = n < last ? Math.min(seg, h * 0.4) : 0;
        ctx.fillStyle = skin.front[k] || skin.muted;
        if (n === last) roundRect(ctx, bx, y0, barW, h, Math.min(4 * u, barW / 2));
        else ctx.fillRect(bx, y0 + over, barW, Math.max(0.8, h - over));
        cum += val;
      });
    });

    /* The day's total above its bar. */
    var put = placeTotals(ctx, s.days, xOf, fTotal, fTotal * 1.1);
    var painted = [];
    s.days.forEach(function (day, i) {
      if (!put[i]) return;
      say(ctx, String(day.total), xOf(i), yOf(day.total) - fTotal * 0.45, fTotal,
          skin.ink, "center", 600, false);
      painted.push({ date: day.date, total: day.total });
    });

    /* Date ticks, thinned the same way and always carrying the newest day. */
    ctx.font = "400 " + Math.round(fTick) + "px " + FONT;
    var tickY = plotB + fTick * 1.35, tTaken = [];
    var idx = [s.days.length - 1];
    for (var t = 0; t < s.days.length - 1; t++) idx.push(t);
    idx.forEach(function (i) {
      var label = dayMonth(s.days[i].date);
      var w = ctx.measureText(label).width + fTick * 1.1;
      var bx = xOf(i), box = [bx - w / 2, bx + w / 2];
      for (var j = 0; j < tTaken.length; j++) {
        if (box[0] < tTaken[j][1] && box[1] > tTaken[j][0]) return;
      }
      tTaken.push(box);
      say(ctx, label, bx, tickY, fTick, skin.faint, "center", 400, false);
    });

    /* The caveat travels WITH the picture: it is read on a slide, where nothing
       on this page is there to carry it. */
    var fy = H - padY - (footLines.length - 1) * fFoot * 1.35;
    footLines.forEach(function (line, n) {
      say(ctx, line, W - padX, fy + n * fFoot * 1.35, fFoot, skin.muted,
          "right", 400, true);
    });
    ctx.restore();
    return painted;
  }

  /* ---- the canvas on the page --------------------------------------------- */
  function theme() { return (window.DossierMap && DossierMap.screenTheme) || "light"; }
  function skinNow() { return SKIN[theme()] || SKIN.light; }

  function fontReady() {
    return !document.fonts || document.fonts.check("600 17px Heebo");
  }
  function draw() {
    var canvas = state.canvas;
    if (!canvas || !canvas.parentElement) return;
    var box = canvas.parentElement;
    var W = Math.round(box.clientWidth), H = Math.round(box.clientHeight);
    if (W <= 0 || H <= 0) return;            /* a hidden pane measures zero */
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var s = seriesFor(state.range);
    out.painted = { range: state.range, totals: paint(ctx, W, H, TEXT_SCREEN, s, skinNow()) };
    if (s) canvas.setAttribute("aria-label", TITLE + " — " + TOTAL_HE + " " + s.total);
    /* Heebo is a web font: a canvas painted before it lands is set in the
       fallback and every width was measured against the wrong glyphs. */
    if (!fontReady() && document.fonts) {
      document.fonts.load("600 17px Heebo").then(draw, function () {});
    }
  }

  /* The picture the button saves IS the picture on the page: the same painter,
     the same skin, the range currently on screen. Only the pixels differ - the
     wide slide and the authored square, each laid out for its own rectangle
     rather than cropped out of the other. */
  function exportPng(shape) {
    var s = SHAPES[0];
    SHAPES.forEach(function (x) { if (x.shape === shape) s = x; });
    var c = document.createElement("canvas");
    c.width = s.w; c.height = s.h;
    paint(c.getContext("2d"), c.width, c.height, TEXT_SLIDE,
          seriesFor(state.range), SKIN.light, true);
    return c.toDataURL("image/png");
  }

  /* What the block builder in maps_tab.js needs, and nothing else. It owns the
     markup, the switch and the two buttons; this file owns the numbers and the
     paint, so neither knows how the other does its half. */
  return {
    TITLE: TITLE, FOOT: FOOT, EMPTY: EMPTY, RANGES: RANGES, SHAPES: SHAPES,
    DRY: DRY, BUSY: BUSY, FAILED: FAILED, MISSING: MISSING,
    seriesFor: seriesFor, exportPng: exportPng, draw: draw, skin: skinNow,
    bind: function (canvas) { state.canvas = canvas; },
    range: function () { return state.range; },
    setRange: function (k) { state.range = rangeOf(k).key; draw(); },
    stash: function (item) {
      out.dry = out.dry || { items: [] };
      out.dry.items = out.dry.items.filter(function (it) {
        return it.variant !== item.variant || it.shape !== item.shape;
      });
      out.dry.items.push(item);
      return item;
    },
    get dry() { return out.dry; },
    get painted() { return out.painted; }
  };
})();

window.TrendChart = TrendChart;
