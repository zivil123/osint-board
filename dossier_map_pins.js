/* dossier_map_pins.js - the STORY MAP layer (2026-09-25): a real location pin
   at every place the map's text names, its name BOLD and larger than any other
   word, the rest of the picture's names quiet context - and an axis drawn as a
   highlighted road with no arrowhead.

   Ziv, 2026-09-25, of the Battlefronts report: "if you're talking about a
   place it has to show on the map... marked clearly, don't just put a name,
   put a real pin on where it is." MAP_RULES.md rule 11.

   WHAT THE VALIDATOR ALREADY DID (scripts\dossier_maps_pins.py): every key in
   `map.pins` is a gazetteer point with its `he`, and its label is on
   `map.labels` exactly ONCE, first, `req`, `pinned` and `pin: false` - the pin
   replaces the dot, and a place in the frame's standard set is drawn once, as
   the pin. So this file draws and styles; it never adds or drops a place.

   THE ORDER, and why each step is where it is (hooks in dossier_map.js):
   - `paint` runs before the key is laid out and before any name is placed:
     the pins' ground goes into `taken`, like every mark's, and every label
     gets its STYLE (bold ink for a pin, grey and lighter for the rest).
     Nothing is drawn yet - the arrows go down after the key, and a pin under
     a road line would be the story's mark buried by its context.
   - `lines` stands in for the arrows pass: `head: false` axes are drawn here
     as a cased highlight with no head; every other arrow goes to the ordinary
     painter untouched (the same map object when there is none of ours).
   - `claim` runs after placeLabels (which wipes the ink registry) and before
     the names are painted: the pins are DRAWN, registered as marks and as each
     place's own mark, so the check measures the name against the pin
     (`name_far_from_mark`) and a pin no name touches is `mark_unlabelled` -
     the same second call the strike tally makes (dossier_map_strikes.js).
   - `place` is the label placer's measure for every STYLED name: a context
     name at the quiet size; a pin's name at the larger size, set against the
     head, its box widened to the BOLD width - the ordinary measure reads
     weight 500, and a box narrower than its ink would let the check pass a
     word that touches its neighbour.

   A record WITHOUT `pins` and without `head: false` meets none of this: no
   style is set, no box is pushed, and the arrows pass is the same call.

   NO ES modules - the page runs from file://. One global:
     window.DossierMapPins = { paint, lines, claim, named, place, BIG, QUIET_SIZE } */
"use strict";

(function () {
  function D() {
    if (!window.DossierMapDraw) {
      throw new Error("dossier_map_pins: dossier_map_draw.js is not on the page");
    }
    return window.DossierMapDraw;
  }

  /* THE HIERARCHY. A pin's name is 1.3x the map's name size and bold, in a
     fixed dark ink; the context names step down to 0.9 of the map's size (17
     -> 15.3, still over the 15 CSS px floor) in a lighter weight and grey. Fixed
     colours, not the palette's: a report map is printed on the light theme,
     and the pin must read on terrain, on either side's fill and on the sea. */
  var BIG = 1.3, PIN_WEIGHT = 800, INK = "#111A24";
  var QUIET_WEIGHT = 500, QUIET = "#5E6873", QUIET_SIZE = 0.9;
  /* THE PIN: red with a white edge and a thin dark keyline outside it (reads on
     sand, cream and the sea alike - the strike pin's measured recipe), and a
     white eye in the head so it reads as a map pin, not a red blob. */
  var BOLD = 2.2;   /* report-map arrow: stem and head times the shared size */
  var RED = "#D8232A", EDGE = "#FFFFFF", KEY = "rgba(22,32,43,0.6)";
  /* THE HIGHLIGHTED ROAD: a deep amber-orange line in a dark casing - a route
     marked on a road map, not a front's red and not an assessment's arrow. It
     must out-shout the YELLOW road network (dossier_map_roadnet.js, trunk 3.5u
     ink): more orange and about twice as wide, with a floor for print. */
  var ROAD = "#F07A12", CASE = "rgba(22,32,43,0.78)";

  function geom(q, u, size) {
    var rh = size * 0.55, d = rh * 2.35;
    var ew = Math.max(1.5, 1.6 * u), k = Math.max(0.8, 0.9 * u);
    return { x: q[0], y: q[1], cx: q[0], cy: q[1] - d, rh: rh, d: d,
             ew: ew, k: k, out: ew + k };
  }
  /* The head and the stem in two narrowing steps, as the rectangles they
     cover, so a name set against the tip is not refused by a head-sized box. */
  function boxes(g) {
    if (g.dot) return [{ mark: true, x0: g.x - g.rh - g.out, y0: g.y - g.rh - g.out,
                         x1: g.x + g.rh + g.out, y1: g.y + g.rh + g.out }];
    var o = g.out, sinF = Math.sqrt(Math.max(0, 1 - Math.pow(g.rh / g.d, 2)));
    var yt = g.cy + g.rh * g.rh / g.d, ym = (yt + g.y) / 2, hw = g.rh * sinF;
    return [
      { mark: true, x0: g.cx - g.rh - o, y0: g.cy - g.rh - o,
        x1: g.cx + g.rh + o, y1: g.cy + g.rh + o },
      { mark: true, x0: g.x - hw - o, y0: yt, x1: g.x + hw + o, y1: ym },
      { mark: true, x0: g.x - hw / 2 - o, y0: ym, x1: g.x + hw / 2 + o, y1: g.y + o }
    ];
  }
  function drawPin(ctx, g) {
    if (g.dot) return window.DossierMapStoryMarks.drawDot(ctx, g);   /* a clash */
    var f = Math.acos(Math.min(1, g.rh / g.d));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.arc(g.cx, g.cy, g.rh, Math.PI / 2 + f, Math.PI * 2.5 - f, false);
    ctx.closePath();
    ctx.lineJoin = "round";
    ctx.strokeStyle = KEY; ctx.lineWidth = 2 * g.out; ctx.stroke();
    ctx.strokeStyle = EDGE; ctx.lineWidth = 2 * g.ew; ctx.stroke();
    ctx.fillStyle = RED; ctx.fill();
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.rh * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = EDGE; ctx.fill();
    ctx.restore();
  }

  var last = [], seated = [], words = {};
  /* A NAME IS PRINTED ONCE, AND THE PIN WINS (2026-09-26, DOSSIER_LAYERS.md).
     On the printed overview "צנעא" and "תעז" each printed twice: the bold pin
     name and a grey word of the same text beside it (the governorate), so the
     reader saw two names and one mark. Any context or region word whose text
     equals a pin's name on the same map is not drawn: context labels come off
     `map.labels` here, region names ask `named()` in dossier_map_gov.js.
     `paint` runs only for a map WITH pins, so the words carry the map's id and
     `named(str, id)` answers false for any other picture. */
  function bare(s) { return String(s || "").replace(/^אל-/, "").trim(); }
  function named(str, id) {
    return !!bare(str) && words[bare(str)] === true && (id === undefined || words[""] === id);
  }
  function paint(ctx, p, P, u, ts, map, taken, W, H) {
    last = []; seated = last; words = { "": map && map.id };
    if (!map || !map.pins || !map.pins.length) return;
    map.pins.forEach(function (pin) { if (bare(pin.he)) words[bare(pin.he)] = true; });
    map.labels = (map.labels || []).filter(function (l) { return l.pinned || !named(l.he); });
    /* Clash dates, peak heights (dossier_map_story_marks.js): the words first. */
    var S = window.DossierMapStoryMarks; if (S) S.prep(map, p);
    var size = Math.max(17, 17 * u * (ts || 1)), halo = 4 * u, pinned = {};
    map.pins.forEach(function (pin) {
      pinned[pin.place] = true;
      if (p.inside && !p.inside(pin.lon, pin.lat, 0)) return;
      var q = p(pin.lon, pin.lat), g = S && S.isDot(map, pin.place) ? S.dotGeom(q, u, size) : geom(q, u, size);
      boxes(g).forEach(function (b) { taken.push(b); });
      last.push({ place: pin.place, g: g, side: (map.pin_anchor || {})[pin.place],
                  edge: Math.min(g.x, W - g.x, g.cy - g.rh, H - g.y) });
    });
    /* THE MOST BOXED-IN PIN IS SEATED FIRST: the one nearest the canvas edge
       has the fewest sides left, so it chooses before a neighbour with room on
       every side takes its only one (MAP_RULES.md rule 3's order, for names). */
    var edge = {};
    last.forEach(function (s) { edge[s.place] = s.edge; });
    var labels = map.labels || [], first = labels.filter(function (l) {
      return l.pinned && edge[l.place] !== undefined;
    }).sort(function (a, b) { return edge[a.place] - edge[b.place]; });
    map.labels = first.concat(labels.filter(function (l) { return first.indexOf(l) < 0; }));
    /* A DOTLESS PLACE'S POINT IS KEPT FREE. A district or a sea word has no
       dot, so nothing reserves its point, and a story name seated first could
       cover it and leave the quiet name no side to stand on (measured on the
       wide Madaribah picture: Ras al-Ara's name over the district's point).
       A small mark-box at the point; the place's own name stands clear of it. */
    (map.labels || []).forEach(function (l) {
      if (pinned[l.place] || l.pin !== false || l.anchor === "c" ||
          l.kind === "country" || (p.inside && !p.inside(l.lon, l.lat, 0))) return;
      var q = p(l.lon, l.lat), k = 5 * u;
      taken.push({ mark: true, x0: q[0] - k, y0: q[1] - k, x1: q[0] + k, y1: q[1] + k });
    });
    (map.labels || []).forEach(function (l) {
      l.style = pinned[l.place]
        ? { weight: PIN_WEIGHT, color: INK, halo: halo }
        : { weight: QUIET_WEIGHT, color: QUIET };
    });
  }

  function claim(ctx, labels) {
    var I = window.DossierMapInk;
    last.forEach(function (s) {
      drawPin(ctx, s.g);
      if (!I || !I.own) return;
      var bs = boxes(s.g), tag = "pin " + s.place;
      var all = { mark: true, x0: bs[0].x0, y0: bs[0].y0, x1: bs[0].x1, y1: Math.max(bs[0].y1, s.g.y + s.g.out) };
      bs.forEach(function (b) { I.mark(b, tag); });
      I.own(all, tag);
      (labels || []).forEach(function (l) {
        if (l.place === s.place && !l.markRect) l.markRect = all;
      });
    });
    if (window.DossierMapBeltWords) DossierMapBeltWords.claimLed(labels);
    last = [];
  }

  /* THE MEASURE FOR EVERY NAME ON A STORY MAP (the placer asks it for any
     label carrying a `style`). A context name: the ordinary one at the quiet
     size. A pin's name: the ordinary one at the pin's size, widened to the
     bold ink on the side AWAY from the mark (the side the text grows toward),
     since the ordinary measure reads weight 500. A name ABOVE or
     BESIDE the pin is set against its HEAD - beside the tip it would sit on
     the stem, so e and w were never free and every name fell below the pin;
     a name below is set under the tip, where the ordinary measure puts it. */
  var HEAD_SIDE = { n: true, e: true, w: true, ne: true, nw: true };
  function place(ctx, str, x, y, anchor, size, r, u, W, H, sp) {
    var R = D(), big = size * BIG, g = null, side = null;
    seated.forEach(function (s) {
      if (Math.abs(s.g.x - x) < 0.5 && Math.abs(s.g.y - y) < 0.5) { g = s.g; side = s.side; }
    });
    if (!g) return R.place(ctx, str, x, y, anchor, size * QUIET_SIZE, r, u, W, H, sp);
    /* `pin_anchor` (dossier_maps_pins.py): every side the placer offers becomes
       the forced one, placed on an unbounded canvas so it can never flip; a box
       off the picture is then made unplaceable, so the name drops LOUDLY. */
    var W0 = W, H0 = H;
    if (side) { anchor = side; W = H = Infinity; }
    /* A reader's gap from the head's edge (4u), and 3u more under the tip:
       at 2u a name's halo sat on the pin's white edge (native crop, Dhubab). */
    if (g.dot || HEAD_SIDE[anchor]) { y = g.cy; r = g.rh + g.out - u; } else r += 3 * u;
    var s = R.place(ctx, str, x, y, anchor, big, r, u, W, H, sp);
    var extra = R.width(ctx, str, big, PIN_WEIGHT, sp) - R.width(ctx, str, big, 500, sp);
    if (s && s.box && extra > 0) widen(s, extra);
    if (side && s && s.box && (s.box.x0 < 0 || s.box.y0 < 0 || s.box.x1 > W0 ||
        s.box.y1 > H0)) {
      console.warn("dossier map pins: pin_anchor " + side + " puts a name off the picture");
      s.box = { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 };
    }
    return s;
  }
  /* The seated pin whose tip is at (x, y), for a leader that ends on its head. */
  function head(x, y) {
    var g = null;
    seated.forEach(function (s) { if (Math.abs(s.g.x - x) < 0.5 && Math.abs(s.g.y - y) < 0.5) g = s.g; });
    return g;
  }
  function widen(s, extra) {
    var b = s.box;
    if (s.align === "right") b.x0 -= extra;
    else if (s.align === "left") b.x1 += extra;
    else { b.x0 -= extra / 2; b.x1 += extra / 2; }
    return s;
  }

  /* ---- head: false - the highlighted road ---------------------------------- */
  function line(ctx, pts, u) {
    ctx.save();
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    [[CASE, Math.max(6.4, 11.5 * u)], [ROAD, Math.max(4.2, 7.2 * u)]].forEach(function (st) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.strokeStyle = st[0]; ctx.lineWidth = st[1]; ctx.stroke();
    });
    ctx.restore();
    if (window.DossierMapRoadWords) DossierMapRoadWords.add(pts, Math.max(6.4, 11.5 * u) / 2, "story road");
  }
  function lines(R, ctx, p, P, u, ts, map, taken, W, H) {
    var list = (map && map.arrows) || [], I = window.DossierMapInk;
    /* THE BELTS ARE GROUND NO WORD MAY TAKE, from here until the notes
       (dossier_map_belt_words.js, MAP_CHECK.md `word_on_belt`). */
    var S = window.DossierMapStoryMarks; if (S) S.line(ctx, p, u, map, taken);   /* the side view's line */
    if (window.DossierMapBeltWords) DossierMapBeltWords.push(taken);
    if (S) S.ends(ctx, P, u, ts, map, taken, W, H);
    heads(p, u, list, taken, bold(map));
    /* An axis LABEL is placed now, before the names: it walks round the
       diamonds (reserved again, harmlessly, with the names) and is tagged a
       word so the ink check sees it (2026-09-26). */
    if (list.length && I && I.diamonds) {
      I.diamonds(p, R, u, map).forEach(function (b) { taken.push(b); });
    }
    var n0 = taken.length;
    try { draw(R, ctx, p, P, u, ts, map, taken, W, H, list); } finally {
      taken.slice(n0).forEach(function (b) { if (b && !b.mark) b.inkWord = "axis label"; });
    }
  }
  function draw(R, ctx, p, P, u, ts, map, taken, W, H, list) {
    list.forEach(function (a) {
      if (a.head !== false) return;
      var pts = (a.path || []).map(function (c) { return p(c[0], c[1]); });
      if (pts.length >= 2) line(ctx, pts, u);
    });
    var rest = list.filter(function (a) { return a.head !== false; });
    if (!rest.length) return;
    var sub = {};
    Object.keys(map).forEach(function (k) { sub[k] = map[k]; });
    /* The axes are drawn WITHOUT their names, which are set here instead: the
       shared painter tries four spots at the path's middle and, all taken,
       printed the name on the pins and the diamond (report_bayda_zahir). */
    sub.arrows = rest.map(function (a) {
      var b = {}; Object.keys(a).forEach(function (k) { b[k] = a[k]; });
      b.label_he = ""; return b;
    });
    /* A REPORT MAP'S ARROW IS THE STORY (2026-09-26): at print size the shared
       4u stem was a hairline, so a plain arrow on tab "report" is drawn here,
       BOLD times thicker with a head to match; library maps keep theirs. */
    var k = bold(map);
    if (k > 1) {
      sub.arrows.filter(function (a) { return !a.road; }).forEach(function (a) {
        var pts = (a.path || []).map(function (c) { return p(c[0], c[1]); });
        if (pts.length >= 2) thick(ctx, P, u, pts, k);
      });
      sub.arrows = sub.arrows.filter(function (a) { return !!a.road; });
    }
    if (sub.arrows.length) R.arrows(ctx, p, P, u, ts, sub, taken, W, H);
    rest.forEach(function (a) {
      var pts = (a.path || []).map(function (c) { return p(c[0], c[1]); });
      if (a.label_he && pts.length >= 2) axisName(ctx, P, u, ts, a.label_he, pts, taken, W, H, k);
    });
  }
  /* Along the axis from its middle outwards, each side at one to three
     offsets; a spot must clear every mark and stand a space off every word
     (DossierMapCheck.apart). None clean: the middle spot, and the check says so. */
  function axisName(ctx, P, u, ts, str, pts, taken, W, H, bk) {
    var R = window.DossierMapDraw, C = window.DossierMapCheck;
    var size = Math.max(17, 17 * u * ts) * 0.85, h = size * 1.3;
    var w = R.width(ctx, str, size, 700) + 6 * u, spot = null, first = null;
    [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8].some(function (t) {
      var i = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
      var f = t * (pts.length - 1) - i, a = pts[i], b = pts[i + 1];
      var x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      var nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
      /* The box's own reach across the line, so on a steep arrow the whole
         width of the words clears the stem, not just its centre. */
      var clr = Math.abs(nx) * w / 2 + Math.abs(ny) * h / 2 + 3.5 * u * (bk || 1) + 4 * u;
      return [1, -1, 2, -2, 3, -3].some(function (k) {
        var o = (Math.abs(k) - 1) * 14 * u + clr, s = k > 0 ? 1 : -1;
        var cx = x + nx * o * s, cy = y + ny * o * s;
        var box = { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
        if (!first) first = { x: cx, y: cy, box: box };
        if (box.x0 < 0 || box.y0 < 0 || box.x1 > W || box.y1 > H) return false;
        var bad = taken.some(function (o) {
          if (!o) return false;
          if (o.mark || !C || !C.apart) {
            return Math.min(o.x1, box.x1) - Math.max(o.x0, box.x0) > 1 &&
                   Math.min(o.y1, box.y1) - Math.max(o.y0, box.y0) > 1;
          }
          return !C.apart(o, box);
        });
        if (!bad) spot = { x: cx, y: cy, box: box };
        return !bad;
      });
    });
    /* NOTHING CLEAR ALONG THE ROUTE on a belt-held picture: the label is
       dropped and the arrow stays (MAP_CHECK.md `word_on_belt`). */
    if (!spot && window.DossierMapBeltWords && DossierMapBeltWords.on()) {
      console.warn("dossier map: an axis label found no spot off the belts - dropped");
      return;
    }
    spot = spot || first;
    R.text(ctx, P, str, spot.x, spot.y, { size: size, weight: 700, halo: 4 * u });
    taken.push(spot.box);
  }

  /* EVERY ARROWHEAD IS A MARK (2026-09-26): its ground goes into `taken`
     before any name is placed, tagged `ink` so dossier_map_ink.js registers it
     and a word painted on it is counted. The head is 14u long and 7u each side
     of its tip (dossier_map_extra.js `head`), plus its halo. */
  function bold(map) { return map && map.tab === "report" ? BOLD : 1; }
  /* Straight stem stopped short of the tip so its cap stays under the head. */
  function thick(ctx, P, u, pts, k) {
    var D = window.DossierMapDraw, t = pts[pts.length - 1], f = pts[pts.length - 2];
    var d = Math.hypot(t[0] - f[0], t[1] - f[1]) || 1, L = 14 * u * k, S = 7 * u * k;
    var dx = (t[0] - f[0]) / d, dy = (t[1] - f[1]) / d, e = [t[0] - dx * L * 0.7, t[1] - dy * L * 0.7];
    [[P.halo, 7 * u * k], [P.frontMark, 4 * u * k]].forEach(function (st) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length - 1; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.lineTo(e[0], e[1]);
      D.paintShape(ctx, { stroke: st[0], width: st[1] });
    });
    ctx.beginPath(); ctx.moveTo(t[0], t[1]);
    ctx.lineTo(t[0] - L * dx - S * dy, t[1] - L * dy + S * dx);
    ctx.lineTo(t[0] - L * dx + S * dy, t[1] - L * dy - S * dx); ctx.closePath();
    D.paintShape(ctx, { fill: P.frontMark, stroke: P.halo, width: Math.max(1, 1.2 * u * k) });
  }
  function heads(p, u, list, taken, k) {
    k = k || 1;
    list.forEach(function (a) {
      var pts = (a.path || []).map(function (c) { return p(c[0], c[1]); });
      if (a.head === false || pts.length < 2) return;
      var t = pts[pts.length - 1], f = pts[pts.length - 2];
      var d = Math.hypot(t[0] - f[0], t[1] - f[1]) || 1;
      var dx = (t[0] - f[0]) / d, dy = (t[1] - f[1]) / d, L = 14 * u * k, S = 7 * u * k;
      var xs = [t[0], t[0] - L * dx - S * dy, t[0] - L * dx + S * dy];
      var ys = [t[1], t[1] - L * dy + S * dx, t[1] - L * dy - S * dx];
      taken.push({ mark: true, ink: "arrowhead", x0: Math.min.apply(null, xs) - 2 * u,
        y0: Math.min.apply(null, ys) - 2 * u, x1: Math.max.apply(null, xs) + 2 * u,
        y1: Math.max.apply(null, ys) + 2 * u });
    });
  }

  window.DossierMapPins = { paint: paint, lines: lines, claim: claim, named: named,
                            place: place, head: head, BIG: BIG, QUIET_SIZE: QUIET_SIZE };
}());
