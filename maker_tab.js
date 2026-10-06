/* The map maker's door on the view rail (#tab-maker in index.html).

   It is a way OUT of the board, not a view: tabs.js never sees it (it carries
   no data-view) and nothing here touches a pane. The tab is hidden in the
   markup and shown only once a map maker has answered:

     GET /make/api/ping
       no answer, an error, or anything that is not JSON  -> the tab stays hidden
       JSON with a "url" (a web address)                  -> the tab opens that
       any other JSON                                     -> the tab opens /make/

   So the public copy, which has no map maker, never shows it, and the page
   opened from file:// never asks. A sign-in page answering in the ping's place
   is not JSON and counts as no answer.

   No ES modules - the page runs from file://. */
"use strict";

(function () {
  const tab = document.getElementById("tab-maker");
  if (!tab || !window.fetch || !/^https?:$/.test(location.protocol)) return;
  let target = "/make/";

  // The ping takes a moment, and the tab used to pop in two seconds after the
  // rest of the rail. A device that has seen a map maker here shows the tab at
  // once from that memory; the ping below still decides, and hides it again
  // (and forgets) when no map maker answers.
  const KEY = "maker_tab_seen";
  function recall() { try { return localStorage.getItem(KEY); } catch (err) { return null; } }
  function remember(v) {
    try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (err) { /* private window */ }
  }
  const seen = recall();
  if (seen) { target = seen; tab.hidden = false; }

  fetch("/make/api/ping", { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("no map maker here");
      return r.json();
    })
    .then(function (answer) {
      if (!answer || typeof answer !== "object") throw new Error("not a map maker");
      target = "/make/";
      if (typeof answer.url === "string" && answer.url) {
        try {
          const u = new URL(answer.url, location.href);
          if (/^https?:$/.test(u.protocol)) target = u.href;
        } catch (err) { /* not an address: /make/ stands */ }
      }
      tab.hidden = false;
      remember(target);
    })
    .catch(function () { tab.hidden = true; remember(null); /* no map maker */ });

  tab.addEventListener("click", function () { location.assign(target); });
})();
