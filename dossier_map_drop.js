/* dossier_map_drop.js - what happens when an OPTIONAL name finds no anchor.
 *
 * A LISTED CITY MUST NEVER VANISH FROM A PICTURE IN SILENCE (2026-09-22).
 *
 * The port of Mocha (`mokha`) is authored on BOTH west maps, `west_fronts` and
 * `west_plain`, with the same point and the same anchor - twin records, the
 * same labels. It came back on one of them and not on the other, and nothing
 * on the run said a word about it. Two reasons, and both were invisible:
 *
 *   1. an optional label got ONE placement try. A required name is offered all
 *      eight sides and then the same eight a little further out (the rings in
 *      dossier_map_zone_names.js); an optional one was offered its own anchor,
 *      the opposite side and the four compass points at the FIRST ring only.
 *      One reserved box on the near side and the name was gone.
 *   2. `west_fronts` reserves about a dozen fighting-belt boxes before any name
 *      is placed (dossier_map_ink.js, guarded by `map.fronts !== false`), and
 *      `west_plain` (`fronts: false`) reserves none. So the SAME city with the
 *      SAME anchor can survive on one twin and be crowded out of the other -
 *      which is exactly what happened, and exactly what no counter scored:
 *      `dropped_required` covers `req: true` labels and nothing else.
 *
 * What this file decides, and nothing else:
 *
 *   - WHERE a name that lost is reported. Every loss says so in the console,
 *     at every width, naming the picture, the key and the width - a line a
 *     helper can act on, which is what was missing.
 *   - WHETHER it is a FAULT. At W >= 700 - the 2560/2048/1536 exports and the
 *     1230 px board repaint - the picture had room and the name is owed: the
 *     key goes into `labels_dropped` (docs\dossier_map_check.js) and
 *     scripts\dossier_png_dump.py refuses the batch with exit 2, exactly the
 *     way a dropped required label does. Below 700 - the 390 px phone - it is
 *     REPORTED and never failed, because a phone is 340 CSS px of canvas and
 *     every picture on it crowds somewhere; that is the same line the size
 *     floors are held to (MAP_CHECK.md, "The three passes").
 *   - WHEN a loss is forgiven: the word is already ON the picture, printed by
 *     another label or by a region name that carries it. The same test
 *     `lost()` applies to a required name, one layer up - a reader is not sent
 *     hunting for something that is there, so it is said once and not counted.
 *
 * The extra rings an optional name now gets are NOT here: that is one argument
 * in dossier_map_zone_names.js, which is at its 500-line cap, and the rings are
 * still capped by `DossierMapInk.adjacent` - a name that has to reach past its
 * own mark to find room has not been saved, it has been moved somewhere it
 * says something false (MAP_RULES.md rule 8).
 *
 * OPTIONAL at runtime, like the check and the ink: without this file the
 * placement and the counters are exactly what they were before today.
 */
(function () {
  'use strict';

  /* The width at which a picture is held to its names. The same 700 the tier-2
     rule above it uses, and for the same reason: under it the canvas is a
     phone's and second-rank names are given up on purpose. */
  var FULL_W = 700;

  /* An optional label found no free anchor. Returns TRUE always: the caller
     asks this only to record the loss, never to decide whether to paint.

     AND THE LINE SAYS HOW CROWDED THE PICTURE WAS, not only that it was: a
     yield line that counts is useless, one that names the obstacle solves the
     job. `o.taken` is every box already on this picture - the marks reserved
     before any name, the fighting belts, the names already down - so "23 boxes
     were already on it, anchor w" is the difference between the two west twins
     said in one number, and the anchor is the side the record asked for.

     `k` IS THE PAINTER'S KIT, in the order its one caller already holds it:
     [ctx, the projector, the palette, the painter, u, the options]. Everything
     this file used to be told - the map id, the width, the marks already on the
     picture - is on `k[5]`, and the kit is here so the lost name can leave its
     MARK behind on the way out (`ring` below). */
  function lost(l, out, k) {
    var o = (k && k[5]) || {}, mapId = o.mapId, W = o.W || 0,
        he = String(l.he || ""), key = l.place || he || "(unnamed)",
        n = o.taken ? o.taken.length : -1,
        where = "dossier map " + mapId + ": " + key +
          (n < 0 ? "" : " (anchor " + (l.anchor || "-") + ", " + n +
                        " box(es) already on the picture)");
    if (he && out && out.some(function (w) {
      return w.spec && w.spec.str && w.spec.str.indexOf(he) >= 0;
    })) {
      console.warn(where + " is not printed a second time - its name is"
        + " already on the picture");
      return true;
    }
    if (W < FULL_W) {
      console.warn(where + " could not be placed at " + Math.round(W) +
        "px: no free anchor (reported, not a fault - a phone crowds)");
      return true;
    }
    /* AND THE VERDICT WAITS FOR THE FINISHED PICTURE (2026-09-22), the way a
       required name's has since 2026-09-19. The test above can only see the
       PLACE names, because they are the only ones down when this pass runs;
       the region names and the front names are painted after it, and one of
       them may carry the word. The city of Dhamar on both west twins is that
       case exactly: its ringed dot is on the wide export with the governorate
       name ד'מאר beside it, so the reader is not hunting for anything, and
       calling it a drop accused the picture of a fault it does not have.
       So it goes into the SAME queue a required name waits in
       (dossier_map_ink.js, `pending` / `audit`), is forgiven by the SAME test -
       the word is somewhere on the picture - and nothing is forgiven by name.
       What does NOT change is where it is filed: `verdict` below. */
    if (window.DossierMapInk && DossierMapInk.pending) {
      ring(k, l);
      DossierMapInk.pending(key, he, { where: where, W: W });
      return true;
    }
    fail(where, key, W);
    return true;
  }
  /* THE PICTURE IS FINISHED and the held name is judged. `printed` is
     dossier_map_ink.js's answer to the only question that matters - is this
     word on the picture, printed by another label, a region name or a front
     name. Forgiven, it is counted as a name this picture said, exactly as the
     required path counts its own forgiveness (`req_labels`): the word IS on
     the picture and the inventory would otherwise say one fewer than a reader
     can see. Lost, it is filed under `labels_dropped` with its key and NEVER
     under the required counter - an optional name that vanishes is a fault of
     its own kind, and the two lists are what tell them apart. */
  function verdict(mapId, q, printed, owned) {
    var C = window.DossierMapCheck, o = (q && q.opt) || {},
        where = o.where || ("dossier map " + (mapId || "?") + ": " +
                            ((q && q.key) || "(unnamed)"));
    if (printed) {
      console.warn(where + " is not printed a second time - its name is"
        + " already on the picture");
      if (C) C.add("labels", 1);
      claim(owned, (q && q.key) || "");
      return false;
    }
    fail(where, (q && q.key) || "(unnamed)", o.W);
    return true;
  }
  function fail(where, key, W) {
    console.error(where + " could not be placed: no free anchor, and at " +
      Math.round(W || 0) + "px this picture had the room - see labels_dropped");
    if (window.DossierMapCheck) DossierMapCheck.labelDrop(key);
  }

  /* ---- THE DOT STAYS WHEN THE WORD GOES (2026-09-22) ---------------------

     Ziv, of the wide export of both west twins: Dhamar's name loses its spot in
     a crowded corner (32 boxes already down on the plain twin, 56 on the fronts
     one, anchor e - the town of Ma'bar, מעבר, is its neighbour), the
     governorate name ד'מאר stands at the city's own point and forgives it -
     the right verdict for the WORD - but the city itself was not
     SHOWN, because the ringed dot was painted after the placement succeeded and
     a name with no spot returned before it. A capital is a ringed dot
     (MAP_RULES.md), so the reader was told where Dhamar is by a region name and
     never shown the city.

     So a label that loses its placement at an export or page width paints its
     mark AT ONCE, before the loss is filed - the same mark, the same radius and
     the same kind the placed path paints, so nothing about the picture changes
     except that the dot is there. Three names are refused it, and each for the
     reason it has no dot when it IS placed: a country name and any anchor "c"
     are areas with no one pixel, and `pin: false` says so on the record.

     BELOW 700px NOTHING CHANGES: a phone gives up second-rank names on purpose
     and a dot with no word on 340 CSS px is a smudge, not a place.

     AN EXTRA DOT IS NEVER SHIPPED. If the name is not forgiven at the end of
     the picture, the picture FAILS on `labels_dropped` (or `dropped_required`)
     and is not published - so the only pictures that carry one of these dots
     are the ones where something else on them says what it is. */
  function ring(k, l) {
    var ctx = k && k[0], p = k && k[1], P = k && k[2], R = k && k[3],
        u = k && k[4], o = k && k[5];
    if (!ctx || !p || !o || !R || !R.mark || !R.markClear) return false;
    if ((o.W || 0) < FULL_W) return false;
    if (l.kind === "country" || l.anchor === "c" || l.pin === false) return false;
    if (p.inside && !p.inside(l.lon, l.lat, 0)) return false;
    var q = p(l.lon, l.lat);
    R.mark(ctx, P, q[0], q[1], R.markClear(o.pinR, l.kind), u, l.kind);
    return true;
  }

  /* AND THE MARK IS NOT THEN ACCUSED OF SAYING NOTHING. `mark_unlabelled` asks
     of every mark that was really painted whether anything on the finished
     picture names it (dossier_map_ink.js, `audit`), and a region name carries
     no `own`, so it claims no mark by touching one. A name that was FORGIVEN
     was forgiven precisely because the word IS on the picture - so its mark is
     claimed here, BY KEY and not by geometry: `owned` is ink's own list and
     every entry's tag is its kind and its place key, the key this file held the
     name under. Two dots at one point (the twins) claim only their own.
     Forgiveness is the ONLY thing that claims a mark this way: a name that is
     really lost leaves its mark unclaimed and the picture says both faults. */
  function claim(owned, key) {
    var want = String(key || "");
    if (!want) return 0;
    return (owned || []).filter(function (m) {
      var tag = String(m.tag || "");
      return tag.slice(tag.indexOf(" ") + 1) === want;
    }).map(function (m) { m.named = true; return 1; }).length;
  }

  window.DossierMapDrop = { lost: lost, verdict: verdict, ring: ring,
                            claim: claim, fullWidth: FULL_W };
})();
