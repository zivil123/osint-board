/* The fronts Word report's door on the fronts tab (the owner, 2026-10-03: reach
   the report from the tab, and open it on the phone).

   Two controls in one row at the top of the pane: the big one opens the READABLE
   version (report/index.html - the report's pages as pictures, no app needed),
   the small one downloads the Word file under its Hebrew name.

   Everything it shows comes from report/meta.js (window.BF_REPORT), written by
   scripts\battlefronts_report_web.py together with the files it points at. The
   button carries the report's own date, so an old report never reads as today's.

   NO META, NO BUTTON: the folder is not on the public GitHub copy at all, and a
   fresh checkout has none either. The meta file is asked for once, by a script
   tag (it works from file:// too, where fetch does not); if it is not there the
   slot stays empty, takes no room, and the tab is whole without it.

   The contract with battlefronts.js is one call: BfReport.slotHtml() returns an
   empty box as a STRING for build() to write in; the box is filled here, once
   the meta has arrived. fmtDate and esc are app.js's. */
"use strict";

var BfReport = (function () {
  var DIR = "report/";
  var state = "idle";            /* idle | loading | ready | none */

  function meta() {
    var m = window.BF_REPORT;
    /* the date is printed through fmtDate, so it must be a date and nothing else */
    return (m && /^\d{4}-\d{2}-\d{2}$/.test(String(m.as_of)) && m.docx) ? m : null;
  }

  function html(m) {
    /* The stamp is the report's date plus a hash of its files: a new report is
       a new address, so no phone keeps yesterday's pages. */
    var v = "?v=" + encodeURIComponent(m.v || m.as_of);
    var when = "נכון ל-" + fmtDate(m.as_of) +
      (m.pages ? " · " + esc(String(m.pages)) + " עמודים" : "");
    return '<a class="bf-report-open" href="' + DIR + "index.html" + v +
      '" target="_blank" rel="noopener">' +
      '<span class="bf-report-name">דוח החזיתות המלא</span>' +
      '<span class="bf-report-when">' + when + "</span></a>" +
      '<a class="bf-report-dl" href="' + DIR + esc(m.docx) + v +
      '" download="' + esc(m.docx_name || m.docx) + '">הורדת קובץ Word</a>';
  }

  function fill() {
    var m = meta();
    if (!m) return;
    document.querySelectorAll(".bf-report").forEach(function (box) {
      if (!box.firstChild) box.innerHTML = html(m);
    });
  }

  function load() {
    state = "loading";
    var tag = document.createElement("script");
    /* a time stamp, not a content one: this tiny file IS where the content
       stamp comes from, so it must never be served from a cache */
    tag.src = DIR + "meta.js?t=" + Date.now();
    tag.onload = function () { state = meta() ? "ready" : "none"; fill(); };
    tag.onerror = function () { state = "none"; };
    document.head.appendChild(tag);
  }

  function slotHtml() {
    if (state === "none") return "";
    if (state === "idle") load();
    /* build() writes the box in on its next statement; fill after that */
    else if (state === "ready") setTimeout(fill, 0);
    return '<div class="bf-report"></div>';
  }

  return { slotHtml: slotHtml };
})();
