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

const state = {
  fronts: new Set(),
  from: "",
  to: "",
  verifiedOnly: false,
  /* ON by default, and the only filter that is. The board's job is the attacks
     worth looking at; the small stuff is one press away, never deleted. */
  majorOnly: true,
  kind: "",
};

/* skip names the group whose filter is ignored, so a chip can count itself. */
function passesWith(rec, skip) {
  if (skip !== "front" && state.fronts.size && !state.fronts.has(rec.front)) return false;
  if (skip !== "verified" && state.verifiedOnly && rec.corroboration !== "confirmed") return false;
  if (skip !== "major" && state.majorOnly && rec.severity === "minor") return false;
  if (skip !== "kind" && state.kind && rec.kind !== state.kind) return false;
  if (state.from && rec.date < state.from) return false;
  if (state.to && rec.date > state.to) return false;
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

  /* What kind of attack. severity is written by scripts/severity.py: sniper
     fire, small-arms incidents and artillery shelling are minor, on Ziv's
     instruction - "artillery shelling, I don't care about". */
  addChip("kind-chips", {
    he: "משמעותיים בלבד",
    color: "var(--accent-text)",
    tint: "var(--accent-tint)",
    isOn: function () { return state.majorOnly; },
    toggle: function () { state.majorOnly = !state.majorOnly; },
    count: function () {
      return countOf("major", function (r) { return r.severity !== "minor"; });
    },
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
function refreshCounts() {
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
  if (state.majorOnly) bits.push("אירועים משמעותיים בלבד");
  if (state.verifiedOnly) bits.push("מאומתות בלבד");
  const dated = state.from || state.to;
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
  /* Clear returns to the DEFAULT, not to nothing: the significant-events chip
     goes back ON, because that is the board as it opens. */
  document.getElementById("clear-filters").addEventListener("click", function () {
    state.fronts.clear();
    state.from = state.to = "";
    state.verifiedOnly = false;
    state.kind = "";
    state.majorOnly = true;
    from.value = to.value = "";
    render();
  });
}

window.Filters = {
  build: build,
  init: init,
  passes: recordPasses,
  refreshCounts: refreshCounts,
  emptyMessage: emptyMessage,
};
