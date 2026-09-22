/* dossier_map_check.js - the self-check every map painter reports into.
 *
 * A map that ships with a leader line lying across a name, a label the prose
 * talks about but the picture dropped, or explanatory text too small to read
 * is a map nobody can trust. The painters cannot judge that themselves, so
 * each one COUNTS what it did here, and scripts\dossier_png_dump.py reads the
 * counters out of the headless page afterwards and refuses the batch.
 *
 * Contract (fixed 2026-09-18, coded against by every painter):
 *
 *   DossierMapCheck.begin(mapId, shape)   start a report for one picture
 *   DossierMapCheck.add(key, n)           add n to a numeric counter
 *   DossierMapCheck.drop(placeKey)        a REQUIRED label could not be placed
 *   DossierMapCheck.labelDrop(placeKey)   an OPTIONAL one could not be placed
 *   DossierMapCheck.apart(a, b)           can these two word boxes be READ as
 *                                         two words? the placement's own test
 *   DossierMapCheck.textPairs(id, words)  the finished picture's words, judged
 *                                         pair by pair -> `text_over_text`
 *   DossierMapCheck.text(px)              an explanatory text size, CSS px
 *   DossierMapCheck.name(px)              a size painted ON THE MAP, CSS px
 *   DossierMapCheck.end()                 store it under mapId + ':' + shape
 *   DossierMapCheck.reports               every stored report
 *   DossierMapCheck.floor                 smallest legible text, 15 CSS px
 *   DossierMapCheck.nameFloor             smallest name on a map, 13.5 CSS px
 *   DossierMapCheck.info                  counters that COUNT, never accuse
 *
 * The report shape:
 *
 *   {line_over_text: 0, leader_crossings: 0, text_overflow: 0,
 *    dropped_required: [], labels_dropped: [], min_text_px: null,
 *    min_name_px: null}
 *
 * A LISTED CITY MUST NEVER VANISH IN SILENCE (2026-09-22). Until today only a
 * `req` label was reported when it could not be placed; an optional one was
 * simply not printed, and nothing anywhere said so. The port of Mocha is on
 * `west_fronts` and `west_plain` with the same anchor and the same point, and
 * it came back on one of the twins and not the other - because the fronts map
 * reserves a dozen fighting-belt boxes before a name is placed and the plain
 * one reserves none. `labels_dropped` is that report: the place keys an
 * optional label lost, filled by dossier_map_drop.js at the export and page
 * widths only (W >= 700), where a name that will not fit is a fault and not
 * simply a narrow canvas. It is a LIST like `dropped_required` and it fails a
 * picture the same way; scripts\dossier_png_dump.py names the keys.
 *
 * AND TWO WORDS MUST NEVER READ AS ONE (2026-09-22). Ziv, of the wide `tribes`
 * export: the city name חודיידה printed against the tribal area name
 * ח'ולאן א-טיאל, so the two ran together as a single word - and every counter
 * said `ok`, because no file held the picture's words side by side. MEASURED
 * before this counter existed: the two boxes do NOT intersect, they stand 6.3
 * device px apart on a 2560 canvas whose text is 41 px tall, which is a
 * quarter of a space. So the test is not "do they overlap" but `apart(a, b)`
 * below: two boxes are two words when they do not overlap AND, if they share a
 * line, at least a SPACE of the shorter box's height stands between them.
 * Stacked names are not touched - a name above another is how every region
 * name stands over its own town. `text_over_text` is that count, raised once
 * per PAIR by `textPairs` out of the ink audit (dossier_map_ink.js), where the
 * whole picture is finally known. `text_over_text_keys` names them in ASCII on
 * the dump's line; the page console carries the Hebrew.
 *
 * THE SAME FUNCTION IS THE PLACEMENT'S OWN TEST, so a painter cannot be held
 * to a rule it was not given: dossier_map_tribes_fit.js walks the tribal names
 * round everything already on the picture through `apart`, and the counter
 * then proves it did. One definition, both sides.
 *
 * TWO SIZES, BECAUSE A KEY-PANEL PICTURE HAS TWO SCALES (2026-09-19).
 * `min_text_px` is normalised by the scale the MAP AREA is painted at, which is
 * what a painter inside that rectangle knows; on a three-band picture the map
 * area is about half the canvas, so a name that measures 25 CSS px there is 13
 * on the picture a reader actually holds. `min_name_px` is normalised by the
 * CANVAS, so it says what the reader gets whatever the layout - and its floor
 * is lower (13.5) because it covers every word painted on the map, the key box
 * and the scale bar included, where `min_text_px` covers the explanatory text a
 * reader has to READ. Ziv's rule under both: "if you do stuff like this, make
 * it big."
 *
 * add() creates a counter that is not one of those, so a painter may report
 * something new without waiting for this file to change.
 *
 * A NEW COUNTER IS A FAULT UNLESS THIS FILE SAYS OTHERWISE, and that default
 * is deliberate: a painter that bothers to raise a number has found something,
 * and a checker that quietly ignores names it does not recognise is the way a
 * fault ships. `info` is the short list of counters that are INVENTORY rather
 * than accusation - how many region names, front names and place labels this
 * picture printed, and how many of them the prose required. They belong on the
 * line, because "this map printed three governorate names" is how rule 5 of
 * MAP_RULES.md is read back; they are not violations of anything. Kept HERE and
 * read out of the page by scripts\dossier_png_dump.py, so the painters and the
 * tool that judges them cannot hold two different lists (2026-09-18: they did,
 * and every good picture came back FAIL).
 *
 * `px` is normalised to a 1280-WIDE CANVAS: a painter drawing at 2560 for the
 * wide PNG halves its font size before reporting, so one floor covers every
 * shape. min_text_px stays null when a picture paints no explanatory text at
 * all, and a null passes - there is nothing to be too small.
 *
 * Every call outside a begin/end pair is a silent no-op. The painters run on
 * the screen, inside the PNG dry run and inside the deck, and none of those
 * may ever throw because a check was not open. This file is loaded FIRST of
 * the dossier map scripts for the same reason.
 */
(function () {
  'use strict';

  var FLOOR = 15, NAME_FLOOR = 13.5;
  /* HOW MUCH CLEAR GROUND MAKES TWO WORDS TWO WORDS, as a fraction of the
   * SHORTER box's height - so the rule reads the same on a 390px phone and on
   * a 2560px slide, like every other measure on these maps. A word box is
   * about 1.56 times its own font size (1.25 leading plus the padding the
   * placement measures with) and a space in this face is about a quarter of
   * the size, so a quarter of an em is 0.16 of the box. MEASURED on the wide
   * `tribes` export, 2026-09-22: the three pairs a reader runs together sit
   * 1.3, 6.1 and 6.3 px apart where 0.16 of the box is 8-10 px, and the widest
   * honest gap on the board - תעז beside חזית חיפאן on the overview square -
   * is 12.3 px against a 8.8 px demand, so it stays a pass. */
  var SPACE = 0.16, BITE = 1;

  /* An ASCII handle for one word, for the dump's line: the console keeps the
   * Hebrew, but a report field goes through a Windows console that cannot.
   * The index is always there, so two region names never read alike. */
  function handle(tag, i) {
    var s = String(tag === undefined ? "" : tag)
      .replace(/[^ -~]+/g, " ").replace(/\s+/g, "-").replace(/^-|-$/g, "");
    return (s || "word") + "#" + i;
  }
  /* Counters that are inventory, not accusation - see the head of this file.
   * `front_names_unplaced` joined them on 2026-09-19: a whitelisted front name
   * that found no free side of its own belt is worth a number on the dump's
   * line, and is not a fault - the hatching, the diamond and the level chip all
   * say the fight is there without the words (MAP_RULES.md rule 5). */
  var INFO = ['gov_names', 'front_names', 'front_names_unplaced',
              'labels', 'req_labels'];

  function blank() {
    return {
      line_over_text: 0,
      leader_crossings: 0,
      text_overflow: 0,
      dropped_required: [],
      labels_dropped: [],
      min_text_px: null,
      min_name_px: null
    };
  }

  var cur = null;    // the open report, or null between pictures
  var curKey = '';   // mapId + ':' + shape for the open report

  var Check = {
    reports: {},
    floor: FLOOR,
    nameFloor: NAME_FLOOR,
    info: INFO.slice(),

    /* Start a picture. A begin with one already open simply replaces it:
     * a painter that threw half way through must not poison the next run. */
    begin: function (mapId, shape) {
      curKey = String(mapId == null ? '' : mapId) + ':' +
               String(shape == null ? '' : shape);
      cur = blank();
      return cur;
    },

    /* Add n to a counter, creating it the first time it is named. */
    add: function (key, n) {
      if (!cur || !key) return;
      var amount = (n === undefined || n === null) ? 1 : Number(n);
      if (!isFinite(amount)) return;
      var have = Number(cur[key]);
      cur[key] = (isFinite(have) ? have : 0) + amount;
    },

    /* A label the map was REQUIRED to show and could not place. */
    drop: function (placeKey) {
      if (!cur || !placeKey) return;
      cur.dropped_required.push(String(placeKey));
    },

    /* An OPTIONAL label that found no free anchor at a width where one was
     * owed to it. Same shape as drop() above and the same verdict; what
     * differs is who decides, and that is dossier_map_drop.js - this file
     * only holds the list. */
    labelDrop: function (placeKey) {
      if (!cur || !placeKey) return;
      cur.labels_dropped.push(String(placeKey));
    },

    /* CAN THESE TWO BE READ AS TWO WORDS? True when they can. Ink on ink is
     * never two words; neither is a word standing on another's line with less
     * than a space beside it. A box ABOVE another is left alone - that is how
     * a region name stands over its own town on every picture here. */
    space: SPACE,
    apart: function (a, b) {
      if (!a || !b) return true;
      var ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      var oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (ox > BITE && oy > BITE) return false;
      var h = Math.min(a.y1 - a.y0, b.y1 - b.y0);
      if (oy <= h / 2) return true;              /* different lines */
      return -ox >= SPACE * h;                   /* a space between them */
    },

    /* THE FINISHED PICTURE'S WORDS, JUDGED PAIR BY PAIR. Called once, from the
     * ink audit, with every word box the painters registered - the one moment
     * at which the whole picture is known. Counted once per PAIR and named in
     * the console; `text_over_text_keys` carries the same pairs in ASCII so
     * the dump's own line says which two words ran together. Filed at zero
     * when the picture is clean: the line is the evidence the rule RAN. */
    textPairs: function (mapId, words) {
      if (!cur) return 0;
      var list = words || [], said = [], keys = [], i, k;
      for (i = 0; i < list.length; i++) {
        for (k = i + 1; k < list.length; k++) {
          if (Check.apart(list[i].box, list[k].box)) continue;
          said.push(list[i].tag + " / " + list[k].tag);
          keys.push(handle(list[i].tag, i) + "/" + handle(list[k].tag, k));
        }
      }
      Check.add('text_over_text', said.length);
      if (said.length) {
        cur.text_over_text_keys = keys.join(',');
        console.error('dossier map ' + (mapId || '?') + ': two words read as ' +
          'one - ' + said.join('; '));
      }
      return said.length;
    },

    /* Report one explanatory text size in CSS px on a 1280-wide canvas.
     * Only the smallest is kept - that is the one a reader fails on. */
    text: function (px) {
      if (!cur) return;
      var size = Number(px);
      if (!isFinite(size) || size <= 0) return;
      if (cur.min_text_px === null || size < cur.min_text_px) {
        cur.min_text_px = size;
      }
    },

    /* The same, normalised by the CANVAS rather than by the rectangle the
     * painter was handed - what the reader's eye actually gets. */
    name: function (px) {
      if (!cur) return;
      var size = Number(px);
      if (!isFinite(size) || size <= 0) return;
      if (cur.min_name_px === null || size < cur.min_name_px) {
        cur.min_name_px = size;
      }
    },

    /* Store the open report and close it. Returns it, or null if none. */
    end: function () {
      if (!cur) return null;
      var done = cur;
      Check.reports[curKey] = done;
      cur = null;
      curKey = '';
      return done;
    },

    /* The open report, for a painter that wants to read its own counters. */
    current: function () {
      return cur;
    },

    /* Does one report pass? The same test dossier_png_dump.py applies, kept in
     * step with it deliberately: every named counter above zero, every counter
     * a painter invented that is not on `info`, a required label dropped, or
     * text under the floor. */
    passes: function (report) {
      if (!report) return false;
      if (report.dropped_required && report.dropped_required.length) return false;
      if (report.labels_dropped && report.labels_dropped.length) return false;
      if (report.min_text_px !== null && report.min_text_px < FLOOR) return false;
      if (report.min_name_px !== null && report.min_name_px < NAME_FLOOR) {
        return false;
      }
      var key, value;
      for (key in report) {
        if (!Object.prototype.hasOwnProperty.call(report, key)) continue;
        if (key === 'dropped_required' || key === 'min_text_px') continue;
        if (key === 'labels_dropped') continue;
        if (key === 'min_name_px') continue;
        if (INFO.indexOf(key) >= 0) continue;
        value = Number(report[key]);
        if (isFinite(value) && value > 0) return false;
      }
      return true;
    }
  };

  window.DossierMapCheck = Check;
})();
