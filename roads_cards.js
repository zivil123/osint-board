/* The road cards under the roads map (the כבישים tab): one card per key
   corridor - name, summary, what moves where, importance and why, status
   history, who holds which stretch, attacks along it, sources.

   Pure HTML from const ROADS; the tab (roads_tab.js) writes it in and wires
   the taps. A draft claim carries a visible draft badge, because the analysis
   is filled in by a research pass after the tab itself exists and a placeholder
   must never read as a finding.

     window.RoadsCards = { html(corridors, state), attackLine(corridor, win) }

   Reads app.js's `esc` and RoadsMap at call time. No ES modules. */
"use strict";

var RoadsCards = (function () {
  var DRAFT = "טיוטה";

  function e(s) { return esc(s); }
  function badge(obj) {
    return obj && obj.draft ? ' <span class="rd-draft">' + DRAFT + "</span>" : "";
  }
  /* "2026-09-14" -> "14.09.2026": the board's own dates are day-first. */
  function day(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? m[3] + "." + m[2] + "." + m[1] : (iso || "");
  }
  function sourceLinks(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (s) {
      if (!s || !s.url || seen[s.url]) return;
      seen[s.url] = true;
      out.push('<li><a href="' + e(s.url) + '" target="_blank" rel="noopener noreferrer">' +
        e(s.title) + "</a> <span class=\"rd-src-meta\">" + e(s.publisher) + ", " +
        e(day(s.date)) + "</span></li>");
    });
    return out.join("");
  }
  function allSources(c) {
    var list = [].concat((c.importance || {}).src || []);
    (c.status || []).forEach(function (s) { list = list.concat(s.src || []); });
    (c.flows || []).forEach(function (f) { list = list.concat(f.src || []); });
    return list;
  }

  function flows(c) {
    if (!(c.flows || []).length) return '<p class="rd-muted">אין נתוני זרימה.</p>';
    return "<ul class=\"rd-list\">" + c.flows.map(function (f) {
      var amount = typeof f.amount === "number"
        ? Number(f.amount).toLocaleString("he-IL") + " " + f.unit_he
        : "אין נתון כמות מפורסם";
      return "<li><strong>" + e(f.from_he) + " ← " + e(f.to_he) + "</strong>: " +
        e(f.what_he) + " · " + e(amount) + badge(f) + "</li>";
    }).join("") + "</ul>";
  }

  function importance(c) {
    var imp = c.importance || {}, score = imp.score || 0, dots = "";
    for (var i = 1; i <= 5; i++) dots += '<span class="rd-dot' + (i <= score ? " on" : "") + '"></span>';
    return '<p class="rd-score" aria-label="חשיבות ' + score + ' מתוך 5">' + dots +
      " <span>" + score + "/5</span>" + badge(imp) + "</p><ul class=\"rd-list\">" +
      (imp.reasons_he || []).map(function (r) { return "<li>" + e(r) + "</li>"; }).join("") +
      "</ul>";
  }

  function status(c) {
    return '<ol class="rd-list rd-history">' + (c.status || []).slice().reverse().map(function (s) {
      return '<li><span class="rd-state rd-' + e(s.state) + '">' +
        e(RoadsMap.STATE_HE[s.state] || s.state) + "</span> מ-" + e(day(s.since)) +
        " · " + e(s.note_he) + badge(s) + "</li>";
    }).join("") + "</ol>";
  }

  function holders(c) {
    var total = {}, fronts = 0;
    (c.stretches || []).forEach(function (s) {
      total[s.holder] = (total[s.holder] || 0) + s.km;
      if (s.front) fronts += s.km;
    });
    var rows = Object.keys(total).map(function (h) {
      return "<li>" + e(RoadsMap.HOLDER_HE[h] || h) + ": כ-" + Math.round(total[h]) + ' ק"מ</li>';
    });
    if (fronts) rows.push("<li>באזור לחימה פעיל: כ-" + Math.round(fronts) + ' ק"מ</li>');
    return '<ul class="rd-list">' + rows.join("") + "</ul>";
  }

  function attackLine(c, win) {
    var list = RoadsMap.attacksIn(c, win);
    var scope = win === "week" ? "השבוע" : "בכל התקופה";
    if (!list.length) return "אין פיגועים ליד הכביש " + scope + ".";
    var a = list[0];
    var count = list.length === 1 ? "פיגוע אחד" : list.length + " פיגועים";
    return count + " ליד הכביש " + scope + ". האחרון: " + day(a.date) +
      ", " + a.place_he + " - " + a.title_he;
  }

  function card(c, state) {
    var on = state.selected === c.key;
    var fallback = (c.legs || []).some(function (l) { return !l.snapped; })
      ? '<p class="rd-muted">חלק מהקו משורטט בקו ישר בין ערים: לא נמצא לו כביש רציף בנתוני המפה.</p>'
      : "";
    return '<article class="rd-card' + (on ? " on" : "") + '" data-road="' + e(c.key) +
      '">' +
      '<h3 class="rd-name"><button type="button" class="rd-pick" aria-pressed="' +
      (on ? "true" : "false") + '">' + e(c.name_he) + '</button> <span class="rd-km">כ-' +
      c.km + ' ק"מ</span></h3>' +
      '<p class="rd-summary">' + e(c.summary_he) + "</p>" + fallback +
      '<div class="rd-grid">' +
      "<section><h4>מה עובר ולאן</h4>" + flows(c) + "</section>" +
      "<section><h4>חשיבות</h4>" + importance(c) + "</section>" +
      "<section><h4>מצב הכביש</h4>" + status(c) + "</section>" +
      "<section><h4>מי מחזיק</h4>" + holders(c) + "</section>" +
      "<section><h4>פיגועים</h4><p class=\"rd-attacks\">" + e(attackLine(c, state.win)) + "</p></section>" +
      "</div>" +
      '<details class="rd-sources"><summary>מקורות</summary><ul>' + sourceLinks(allSources(c)) +
      "</ul></details></article>";
  }

  function html(corridors, state) {
    return (corridors || []).map(function (c) { return card(c, state); }).join("");
  }

  return { html: html, attackLine: attackLine };
})();

window.RoadsCards = RoadsCards;
