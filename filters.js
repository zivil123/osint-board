/* The control band: the chips, their counts, the dates and the clear button.

   Split out of app.js on 2026-08-29 when the counts stopped being constants.

   Two rules govern this file:

   1. A chip's number is what pressing it WOULD show, so every count is computed
      against the other filters and never against DATA.stats. With a from-date
      set, the board said 15 attacks while the chips still said 133 / 22 / 20 -
      the numbers were the totals of the whole file and moved for nothing.
   2. A chip's count skips its OWN group. Counting a front against the front
      filter would zero every front the moment one was selected. */
"use strict";

const FRONTS = [
  { key: "ships",    he: "ספינות" },
  { key: "israel",   he: "ישראל" },
  { key: "saudi",    he: "סעודיה" },
  { key: "internal", he: "בתוך תימן" },
];

/* The two wars, told apart by scripts/classify.py and asked for in these words
   (2026-08-29): "make another separation between the real attacks of ballistic
   missiles and UAVs and the ground attacks". One chip each, and pressing one
   releases the other - an event is one kind or the other, never both. */
const KINDS = [
  { key: "air",    he: 'טילים וכטב"מים' },
  { key: "ground", he: "לחימה קרקעית" },
];

/* The board opens on THIS WEEK, and Ziv's week starts on a Tuesday.

   His instruction, 2026-08-31: "make it by default from last Tuesday, because we
   count weeks from the last Tuesday." That reverses what he asked for on
   2026-08-30, when a "last week" chip was taken out because he would rather set
   the dates himself - and it is his to reverse. No OTHER filter is on at load,
   and none may be added without him asking for it in as many words.

   Two things keep the narrowed board honest. The two date boxes are filled from
   this state on every render, so the window is written on screen rather than
   applied invisibly; and the chip counts are already computed against it, so
   nothing on the board claims a number the list does not show. */
const WEEK_STARTS_ON = 2;   /* 0 = Sunday ... 2 = Tuesday */

function isoDay(d) {
  /* Local parts, never toISOString(): that converts to UTC and in a +03:00 zone
     it hands back YESTERDAY for anything before 03:00. */
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

/* Computed in the BROWSER, at load, not baked in by build.py. The board is a
   live page he opens on any day and the pipeline does not run at the moment he
   looks - so "this week" has to mean the week HE is in, or a board opened on
   Friday would still be showing the window that was current when it was built. */
function weekStart() {
  /* Noon, not midnight: Israel puts its clocks forward at 02:00, so stepping
     back over that boundary from midnight can land at 23:00 the day before and
     hand back a date one day early. From noon an hour either way is harmless. */
  const day = new Date();
  day.setHours(12, 0, 0, 0);
  day.setDate(day.getDate() - ((day.getDay() - WEEK_STARTS_ON + 7) % 7));
  return isoDay(day);
}

/* The board's resting state, and what `נקה סינון` returns to. Built fresh each
   time so the Set is never shared. */
function openingState() {
  return { fronts: new Set(), from: weekStart(), to: "", verifiedOnly: false, kind: "" };
}

const state = openingState();

/* skip names the group whose filter is ignored, so a chip can count itself. */
function passesWith(rec, skip) {
  if (skip !== "front" && state.fronts.size && !state.fronts.has(rec.front)) return false;
  if (skip !== "verified" && state.verifiedOnly && rec.corroboration !== "confirmed") return false;
  if (skip !== "kind" && state.kind && rec.kind !== state.kind) return false;
  if (skip !== "date") {
    if (state.from && rec.date < state.from) return false;
    if (state.to && rec.date > state.to) return false;
  }
  return true;
}

function recordPasses(rec) {
  return passesWith(rec, null);
}

function countOf(skip, test) {
  return DATA.attacks.reduce(function (n, rec) {
    return n + (passesWith(rec, skip) && test(rec) ? 1 : 0);
  }, 0);
}

/* Every chip built here, so nothing has to remember to register a new one. */
const chips = [];

function addChip(holderId, opts) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chip";
  btn.style.setProperty("--chip-c", opts.color);
  btn.style.setProperty("--chip-t", opts.tint);
  btn.setAttribute("aria-pressed", opts.isOn() ? "true" : "false");
  btn.classList.toggle("on", opts.isOn());
  const label = document.createElement("span");
  label.textContent = opts.he;
  const num = document.createElement("span");
  num.className = "n";
  btn.append(label, num);
  btn.addEventListener("click", function () {
    opts.toggle();
    render();
  });
  document.getElementById(holderId).appendChild(btn);
  chips.push({ btn: btn, num: num, opts: opts });
}

function build() {
  FRONTS.forEach(function (front) {
    addChip("front-chips", {
      he: front.he,
      color: "var(--f-" + front.key + ")",
      tint: "var(--f-" + front.key + "-tint)",
      isOn: function () { return state.fronts.has(front.key); },
      toggle: function () {
        if (state.fronts.has(front.key)) state.fronts.delete(front.key);
        else state.fronts.add(front.key);
      },
      count: function () {
        return countOf("front", function (r) { return r.front === front.key; });
      },
    });
  });

  KINDS.forEach(function (kind) {
    addChip("kind-chips", {
      he: kind.he,
      color: "var(--accent-text)",
      tint: "var(--accent-tint)",
      isOn: function () { return state.kind === kind.key; },
      toggle: function () {
        state.kind = state.kind === kind.key ? "" : kind.key;
      },
      count: function () {
        return countOf("kind", function (r) { return r.kind === kind.key; });
      },
    });
  });

  addChip("verify-chips", {
    he: "רק מאומתות",
    color: "var(--v-confirmed)",
    tint: "var(--v-confirmed-tint)",
    isOn: function () { return state.verifiedOnly; },
    toggle: function () { state.verifiedOnly = !state.verifiedOnly; },
    count: function () {
      return countOf("verified", function (r) { return r.corroboration === "confirmed"; });
    },
  });
}

/* Called from render(), so the numbers and the list can never disagree. */
function syncDates() {
  const from = document.getElementById("date-from");
  const to = document.getElementById("date-to");
  if (from && from.value !== state.from) from.value = state.from;
  if (to && to.value !== state.to) to.value = state.to;
}

function refreshCounts() {
  syncDates();
  chips.forEach(function (chip) {
    const on = chip.opts.isOn();
    chip.btn.classList.toggle("on", on);
    chip.btn.setAttribute("aria-pressed", on ? "true" : "false");
    chip.num.textContent = String(chip.opts.count());
  });
}

/* Naming what is filtered out beats a bare "no results" — a quiet front should
   read as quiet, not as broken data. */
function emptyMessage() {
  const bits = [];
  if (state.fronts.size) {
    bits.push([...state.fronts].map(frontHe).join(", "));
  }
  const kind = KINDS.find(function (k) { return k.key === state.kind; });
  if (kind) bits.push(kind.he + " בלבד");
  if (state.verifiedOnly) bits.push("מאומתות בלבד");
  const dated = Boolean(state.from || state.to);
  if (!bits.length) {
    return dated ? "אין תקיפות בטווח התאריכים שנבחר."
                 : "אין תקיפות שמתאימות לסינון הנוכחי.";
  }
  return "אין תקיפות בסינון " + bits.join(" · ") +
    (dated ? " בטווח התאריכים שנבחר." : ".");
}

function init() {
  const from = document.getElementById("date-from");
  const to = document.getElementById("date-to");
  from.addEventListener("change", function () { state.from = from.value; render(); });
  to.addEventListener("change", function () { state.to = to.value; render(); });
  /* Clear returns the board to how it OPENED - this week, nothing else on. It
     is the one tap back to home from anywhere, which matters more now that the
     board has a resting state again: a default reachable only by reloading the
     page would be a one-way door. To see the whole file he empties the from-box
     itself, which is right there with the date in it. */
  document.getElementById("clear-filters").addEventListener("click", function () {
    const home = openingState();
    state.fronts.clear();
    state.from = home.from;
    state.to = home.to;
    state.verifiedOnly = home.verifiedOnly;
    state.kind = home.kind;
    render();   /* render() syncs the two date boxes from state */
  });
}

window.Filters = {
  build: build,
  init: init,
  passes: recordPasses,
  refreshCounts: refreshCounts,
  emptyMessage: emptyMessage,
};
