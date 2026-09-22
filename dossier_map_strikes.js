/* dossier_map_strikes.js - the STRIKE TALLY layer: at every place the record
   names, a MAP PIN whose tip stands on the place's own point, and beside the
   pin's head a small box with how many strikes landed there. Nothing else:
   weapon, date and target are the list's (Ziv, 2026-09-23).

   Ziv, 2026-09-23, of the v3 count discs: "do a pin on where the thing that
   you say it is. Don't just show the number. And show the number next to the
   place, not above it." So the PIN says WHERE (its tip is the gazetteer point,
   the head stands above it), and the number sits BESIDE the head - left or
   right, whichever side has room - never above the pin and never on it.

   The tally itself is dossier_map_strikes_data.js, which this file and the
   list under the canvas both read - the picture and the sentences can never
   disagree about a count because neither of them counts anything.

   THE PIN IS THE PLACE'S MARK. It replaces the ordinary dot, which is why
   `pin` is turned off on those labels before a name is placed: the dot would
   otherwise be painted after this layer, on the pin's tip. The name is still
   placed by the ordinary label pass and lands against the tip, because the
   pin's rectangles and the number's box are pushed into `taken` before any
   name is placed, exactly the way a mark's own rectangle is (dossier_map_ink.js).

   NO ES modules - the page runs from file://. One global, shared with the
   tally module, which is loaded first:

     window.DossierMapStrikes += { paint, pinSwatch, pinBoxes, claim } */
"use strict";

(function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_strikes: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }
  function S() {
    if (!window.DossierMapSpot) {
      throw new Error("dossier_map_strikes: dossier_map_spot.js is not on the page");
    }
    return window.DossierMapSpot;
  }
  function T() { return window.DossierMapStrikes; }

  /* ONE COLOUR ON EVERY GROUND. The pin is red with a white edge, and a thin
     dark keyline outside the white so the edge still reads on cream and beige
     where white alone vanishes; on a photo or on charcoal the white carries it.
     The number's box is white with a dark digit and a dark border in BOTH
     themes - the board's `P.ink` is near-white on the dark theme, and a white
     digit in a white box is the fault the v2 disc was measured with. */
  var RED = "#D8232A", EDGE = "#FFFFFF", KEY = "rgba(22,32,43,0.55)";
  var INK = "#16202B";

  /* THE NUMBER'S SIZE is the size the v3 disc gave its digit - the numbered
     marks' family, never under the text floor (dossier_map_spot.js, `floorR`:
     15 CSS px in the rectangle it is painted in, 13.5 on the canvas, a hair
     above both). The head is as tall as the number's box, so the pair reads as
     one unit at head height. */
  function numSize(u, ts, n) {
    return Math.max(S().discR(u, ts, n), S().floorR(u)) * 1.35;
  }
  function geom(q, u, ns) {
    var h = ns * 1.25, rh = h / 2, d = rh * 2.35;
    var ew = Math.max(1.5, 1.6 * u), k = Math.max(0.8, 0.8 * u);
    return { x: q[0], y: q[1], cx: q[0], cy: q[1] - d, rh: rh, d: d,
             ew: ew, k: k, out: ew + k, h: h, ns: ns };
  }

  /* WHERE THE PIN STANDS, as the rectangles it really covers: the head, and
     the stem in two steps narrowing to the tip - so a name set against the tip
     is not refused by a square the size of the head. All `mark: true`: a name
     may not sit on them, and a leader may cross them (dossier_map_ink.js). */
  function pinBoxes(g) {
    var o = g.out, sinF = Math.sqrt(Math.max(0, 1 - Math.pow(g.rh / g.d, 2)));
    var yt = g.cy + g.rh * g.rh / g.d, ym = (yt + g.y) / 2, hw = g.rh * sinF;
    return [
      { mark: true, x0: g.cx - g.rh - o, y0: g.cy - g.rh - o,
        x1: g.cx + g.rh + o, y1: g.cy + g.rh + o },
      { mark: true, x0: g.x - hw - o, y0: yt, x1: g.x + hw + o, y1: ym },
      { mark: true, x0: g.x - hw / 2 - o, y0: ym, x1: g.x + hw / 2 + o, y1: g.y + o }
    ];
  }

  /* THE NUMBER'S BOX TOUCHES THE HEAD'S SIDE, at head height: flush against
     the pin's outer edge, east or west. A WORD, not a mark, in `taken`, so a
     name keeps a reader's gap from it (dossier_map_gap.js). */
  function numBox(ctx, g, str, east) {
    var w = D().width(ctx, str, g.ns, 700) + g.ns * 0.6, e = g.rh + g.out;
    var x0 = east ? g.cx + e : g.cx - e - w;
    return { x0: x0, y0: g.cy - g.h / 2, x1: x0 + w, y1: g.cy + g.h / 2 };
  }
  function clash(b, taken, W, H) {
    var off = (b.x0 < 0 || b.y0 < 0 || b.x1 > W || b.y1 > H) ? 1e9 : 0;
    return off + taken.reduce(function (a, t) {
      var dx = Math.min(b.x1, t.x1) - Math.max(b.x0, t.x0);
      var dy = Math.min(b.y1, t.y1) - Math.max(b.y0, t.y0);
      return a + (dx > 0 && dy > 0 ? dx * dy : 0);
    }, 0);
  }
  /* LEFT OR RIGHT BY ROOM: east first, west when east is spoken for or off
     the canvas, and the less covered of the two when both are. */
  function side(ctx, g, str, taken, W, H) {
    var e = numBox(ctx, g, str, true), w = numBox(ctx, g, str, false);
    var ce = clash(e, taken, W, H);
    if (!ce) return e;
    return clash(w, taken, W, H) < ce ? w : e;
  }

  /* The ordinary dot is turned off HERE rather than in the record, because it
     is this layer that replaces it: a record carrying `pin: false` would lose
     its dot on every other picture of the same place too. Idempotent - the
     flag is only ever turned off, and only for a place this layer draws.
     AND THE KIND GOES WITH IT. A `capital` keeps a ringed dot AND a key row of
     its own (dossier_map_routes.js, `legendRows`), and a row naming a mark the
     picture does not paint is `legend_orphan`. On THIS picture the place's
     mark is the pin, so the label reads as a plain place. */
  function takeTheDot(map, keys) {
    (map.labels || []).forEach(function (l) {
      if (!keys[l.place]) return;
      l.pin = false;
      if (l.kind && l.kind !== "town") l.kind = "town";
    });
  }

  function pinPath(ctx, g) {
    var f = Math.acos(Math.min(1, g.rh / g.d));
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.arc(g.cx, g.cy, g.rh, Math.PI / 2 + f, Math.PI * 2.5 - f, false);
    ctx.closePath();
  }
  function paintPin(ctx, g) {
    pinPath(ctx, g);
    ctx.lineJoin = "round";
    ctx.strokeStyle = KEY; ctx.lineWidth = 2 * g.out; ctx.stroke();
    ctx.strokeStyle = EDGE; ctx.lineWidth = 2 * g.ew; ctx.stroke();
    ctx.fillStyle = RED; ctx.fill();
  }
  function paintNumber(ctx, P, g, b, str, u) {
    var R = D(), lw = Math.max(1.2, 1.4 * u);
    ctx.beginPath(); ctx.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    R.paintShape(ctx, { fill: EDGE, stroke: INK, width: lw });
    R.text(ctx, P, str, (b.x0 + b.x1) / 2, g.cy + g.ns * 0.04,
      { size: g.ns, weight: 700, halo: 0, color: INK });
  }

  var last = [];
  function paint(ctx, p, P, u, ts, map, taken, W, H) {
    var T0 = T();
    last = [];
    if (!T0 || !map || !map.strikes) return;
    var list = T0.tally(map), keys = {};
    if (!list.length) return;
    /* Every PIN is claimed before any number is sited, and every number before
       the first thing is drawn, so two places close together cannot each take
       the other's ground - and all of it is in `taken` before the key is laid
       out and before any name is placed. */
    var shown = list.filter(function (g) {
      return p.inside ? p.inside(g.lon, g.lat, 0) : true;
    }).map(function (t) {
      var g = geom(p(t.lon, t.lat), u, numSize(u, ts, t.count));
      pinBoxes(g).forEach(function (b) { taken.push(b); });
      keys[t.place] = true;
      return { t: t, g: g, str: String(t.count) };
    });
    shown.forEach(function (s) {
      s.box = side(ctx, s.g, s.str, taken, W, H);
      taken.push(s.box);
    });
    takeTheDot(map, keys);
    shown.forEach(function (s) { paintPin(ctx, s.g); });
    shown.forEach(function (s) { paintNumber(ctx, P, s.g, s.box, s.str, u); });
    last = shown;
  }

  /* THE PIN IS A MARK THE CHECK CAN SEE (2026-09-23). This layer paints before
     the label pass, and that pass opens by wiping the ink registry
     (dossier_map_ink.js, `begin`), so a pin registered in `paint` would be
     gone before any name was measured - and with the place's dot off, nothing
     was owed a name: `mark_unlabelled` 0 proved nothing. So dossier_map.js
     calls this AFTER placeLabels and before the names are painted: the head
     and the stem go in as marks (a name painted over them is `mark_over_text`),
     the whole pin as the place's OWN painted mark, and the place's label is
     handed the pin as its `markRect` - so the name is measured against the pin
     (`name_far_from_mark`), and a pin no name touches is `mark_unlabelled`.
     The number beside the head says how many, not which place: it claims
     nothing. */
  function claim(labels) {
    var I = window.DossierMapInk;
    if (!I || !I.own) { last = []; return; }
    last.forEach(function (s) {
      var bs = pinBoxes(s.g), tag = "pin " + s.t.place;
      var all = { mark: true, x0: Math.min.apply(null, bs.map(function (b) { return b.x0; })),
        y0: bs[0].y0, x1: Math.max.apply(null, bs.map(function (b) { return b.x1; })),
        y1: bs[bs.length - 1].y1 };
      bs.forEach(function (b) { I.mark(b, tag); });
      I.own(all, tag);
      (labels || []).forEach(function (l) {
        if (l.place === s.t.place && !l.markRect) l.markRect = all;
      });
    });
    last = [];
  }

  /* ---- the key's swatch ------------------------------------------------ */
  /* A SMALL PIN, with no number: a key row is 16 px tall, and a digit painted
     that small would fail the picture on the one rule it exists to keep
     (MAP_RULES.md rule 2). The row's own sentence says what the number is.
     No strike map carries a key today (`legend: false`); this keeps the row
     honest the day one does. */
  function pinSwatch(ctx, P, u, x, cy, sw, sh) {
    var rh = Math.min(sh, sw) / 2 / 1.9;
    var g = { x: x + sw / 2, y: cy + sh / 2, cx: x + sw / 2, rh: rh,
              d: rh * 2.35, ew: Math.max(1, u), out: Math.max(1.5, 1.6 * u) };
    g.cy = g.y - g.d;
    paintPin(ctx, g);
  }

  var X = window.DossierMapStrikes || (window.DossierMapStrikes = {});
  X.paint = paint; X.pinSwatch = pinSwatch; X.pinBoxes = pinBoxes; X.claim = claim;
}());
