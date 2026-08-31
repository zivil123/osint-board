/* Dashboard behaviour. Data arrives via data.js (const DATA) — no fetch() here,
   the page runs from file://.

   This file owns the list, the cards, the selection and the wiring. The band
   lives in filters.js (window.Filters) and the map in map.js (window.MapView);
   neither is reached any other way. */
"use strict";

const WEAPON_HE = {
  ballistic_missile: "טיל בליסטי",
  cruise_missile: "טיל שיוט",
  hypersonic_missile: "טיל היפרסוני",
  uav: "כטב\"ם",
  usv: "כלי שיט בלתי מאויש",
  naval_missile: "טיל ים",
  artillery: "ארטילריה",
  ground_assault: "מתקפה קרקעית",
  air_defense_missile: "טיל נ\"מ",
  unspecified: "לא צוין",
};
/* Verification status. Glyph + word carry the meaning; colour only reinforces. */
const CORROB = {
  confirmed: { he: "מאומת", glyph: "✓" },
  partial:   { he: "אימות חלקי", glyph: "≈" },
  denied:    { he: "הוכחש", glyph: "✕" },
  none:      { he: "ללא אימות עצמאי", glyph: "?" },
  pending:   { he: "טרם נבדק", glyph: "…" },
};
const TIER_HE = {
  spokesman: "דובר הכוחות המזוינים",
  military_media: "התקשורת הצבאית",
  news: "מקור חדשותי",
};
/* Every source names ITSELF. TIER_HE labelled every news channel "אל-מסירה",
   which was already loose at nine channels and is simply wrong at seventeen:
   a Saudi outlet and a Yemeni government outlet would both have been credited
   to the Houthi broadcaster. Falls back to the tier name for an unknown key. */
const CHANNEL_HE = {
  army21ye: "דובר הכוחות המזוינים",
  military_media: "התקשורת הצבאית",
  almasirah: "אל-מסירה",
  ypa: "סוכנות הידיעות ימן פרס",
  bab_mandab_en: "באב אל-מנדב",
  yemeni_military_en: "הצבא התימני (אנגלית)",
  official_news: "משרד ההסברה בצנעא",
  saba: "סוכנות סבא",
  nws_yemen: "חדשות תימן",
  national_resistance: "ההתנגדות הלאומית",
  yemen_army_media: "התקשורת של צבא הממשלה",
  sept_net: "26 בספטמבר",
  gov_military_media: "התקשורת הצבאית של ההתנגדות",
  yemen_shabab: "ימן שבאב",
  crater_sky: "כראתר סקאי",
  al_hadath: "אל-חדת'",
  saudi_news50: "סעודי ניוז 50",
};
function sourceHe(channel, tier) {
  return CHANNEL_HE[channel] || TIER_HE[tier] || "מקור";
}
/* Who was actually hit, as a fact. The announcement's own label for the enemy is
   rendered separately and always in quotes — the Houthis call the Yemeni army
   "Saudi", and the card must never repeat that as if it were established. */
const TARGET_ACTOR_HE = {
  saudi_state_asset: "תשתית סעודית",
  saudi_forces: "כוחות סעודיים",
  saudi_aircraft: "כלי טיס סעודי",
  yemeni_gov_forces: "כוחות הממשלה התימנית",
  commercial_shipping: "ספנות מסחרית",
  civilian: "אזרחים",
  unknown: "לא ברור",
};

const itemById = new Map();
const mqMobile = window.matchMedia("(max-width: 900px)");
const mqStill = window.matchMedia("(prefers-reduced-motion: reduce)");
let activeId = null;

function esc(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

/* Digits-only dates are forced LTR (design-law §2) — every date goes through here. */
function ltr(text) {
  return '<bdi dir="ltr">' + esc(text) + "</bdi>";
}
function fmtDate(isoDate) {
  const [y, m, d] = String(isoDate).split("-");
  return ltr(Number(d) + "." + Number(m) + "." + y);
}
function fmtStamp(isoUtc) {
  const d = new Date(isoUtc);
  const date = d.getDate() + "." + (d.getMonth() + 1) + "." + d.getFullYear();
  const time = String(d.getHours()).padStart(2, "0") + ":" +
               String(d.getMinutes()).padStart(2, "0");
  return ltr(date + ", " + time);
}

function frontHe(key) {
  const front = FRONTS.find((f) => f.key === key);
  return front ? front.he : key;
}
function corrobOf(rec) {
  return CORROB[rec.corroboration] || CORROB.pending;
}
/* Which of the two wars this is. The kind has been stamped on every record since
   2026-08-29 and driven a chip in the band, but no card ever said it - so in the
   list the only thing separating a ballistic launch from a mortar exchange was
   knowing what "ארטילריה" means. Ziv, 2026-08-31: "there doesn't seem to be any
   separation ... between the UAVs and missiles and the ground fighting."

   Same words as the chips, so pressing one and reading a card agree, and NO new
   hue: every colour on this board is already spoken for by a front or a verdict
   (design-law §3), and the front badge beside this one is the row's one coloured
   cell. This badge separates by fill and by the word, which is what the law asks
   of it anyway - colour never carries meaning alone.

   `other` (9 of 174) means the classifier could not tell, so it says nothing
   rather than inventing a third category the band has no chip for. */
function kbadgeHtml(rec) {
  const kind = KINDS.find((k) => k.key === rec.kind);
  if (!kind) return "";
  return '<span class="kbadge">' + esc(kind.he) + "</span>";
}
function vbadgeHtml(rec) {
  const v = corrobOf(rec);
  return '<span class="vbadge" style="--v-c: var(--v-' + rec.corroboration +
    "); --v-t: var(--v-" + rec.corroboration + '-tint)">' +
    '<span class="g">' + v.glyph + "</span>" + esc(v.he) + "</span>";
}

function sourcesHtml(rec) {
  const sources = rec.sources && rec.sources.length
    ? rec.sources
    : [{ link: rec.link, tier: rec.source_tier, channel: rec.channel }];
  const links = sources.map((s) =>
    '<a href="' + esc(s.link) + '" target="_blank" rel="noopener">' +
    esc(sourceHe(s.channel, s.tier)) + "</a>").join("");
  const count = sources.length > 1
    ? '<span class="src-count">' + sources.length + " מקורות</span>"
    : "";
  return count + links;
}

/* The fact first, then — underneath and clearly quoted — the announcement's own
   wording for the enemy. Never the Houthi label on its own. */
function targetHtml(rec) {
  const out = [];
  const fact = TARGET_ACTOR_HE[rec.target_actor];
  if (fact) {
    out.push('<div class="target"><span class="tag">' + esc(fact) + "</span></div>");
  }
  if (rec.claimed_enemy_he) {
    out.push('<div class="claimed">בהודעה: "' + esc(rec.claimed_enemy_he) + '"</div>');
  }
  return out.join("");
}

/* The named target - "Mokha port infrastructure and port workers" rather than
   just the category "civilians". Present on every record since the schema was
   written and never rendered until now. Extra names come from the other
   channels that covered the same operation. */
function targetNamesHtml(rec) {
  const names = (rec.target_names_he && rec.target_names_he.length)
    ? rec.target_names_he
    : (rec.target_name_he ? [rec.target_name_he] : []);
  if (!names.length) return "";
  return '<div class="tnames"><span class="tn-label">מה נפגע</span>' +
    names.map((n) => '<span class="tn">' + esc(n) + "</span>").join("") + "</div>";
}

/* Other channels' accounts of the SAME operation. The card's own paragraph is
   the authoritative source's words; these are everyone else's, each credited,
   so a detail only one outlet reported is no longer thrown away at merge. */
function alsoHtml(rec) {
  const also = rec.also_he;
  if (!also || !also.length) return "";
  /* Behind a click. A well-covered operation has seventeen of these, and printed
     out they made the open card 2,515px of wall - which is the opposite of what
     the card was rebuilt for. Same pattern as the Arabic original below it. */
  return '<details class="also"><summary>דיווחים נוספים על אותו אירוע ' +
    ltr(also.length) + "</summary>" +
    also.map((a) =>
      '<div class="also-row"><span class="also-src">' +
      esc(sourceHe(a.channel, a.tier)) + "</span>" +
      '<p class="also-he">' + esc(a.he) + "</p></div>").join("") + "</details>";
}

function partOfHtml(rec) {
  const p = rec.part_of;
  if (!p || !p.index || !p.of || p.of < 2) return "";
  return '<div class="partof">פעולה ' + ltr(p.index) + " מתוך " + ltr(p.of) +
    " באותה הודעה</div>";
}

function statusChipHtml(rec) {
  if (rec.claim_status !== "reported") return "";
  return '<span class="badge" style="--chip-c: var(--v-none); ' +
    '--chip-t: var(--v-none-tint)">דווח בלבד — ללא הודעה חות\'ית</span>';
}

function itemHtml(rec) {
  const tags = [];
  if (rec.place_he) tags.push('<span class="tag">' + esc(rec.place_he) + "</span>");
  (rec.weapon || []).forEach((w) =>
    tags.push('<span class="tag">' + esc(WEAPON_HE[w] || w) + "</span>"));
  if (rec.precision === "area") tags.push('<span class="tag">מיקום משוער</span>');
  if (rec.precision === "country" || rec.precision === "none") {
    tags.push('<span class="tag">ללא מיקום מדויק</span>');
  }
  const note = rec.corrob_note_he
    ? '<div class="corrob" style="--v-c: var(--v-' + rec.corroboration + ')">' +
      esc(rec.corrob_note_he) +
      (rec.corrob_url
        ? '<a href="' + esc(rec.corrob_url) + '" target="_blank" rel="noopener">הדיווח החיצוני</a>'
        : "") +
      "</div>"
    : "";
  /* Reading order, and it is the whole point of the card: the DATE alone and
     quiet, then WHAT HAPPENED, then what with and where, and only then the
     coloured badges. The date used to be the fourth chip in a row of three
     bordered badges, which is what made it read heavy. Everything longer than a
     line lives in .item-detail and opens with the card. */
  return [
    '<div class="item-date">' + fmtDate(rec.date) + "</div>",
    "<h3>" + esc(rec.title_he) + "</h3>",
    '<div class="item-tags">' + tags.join("") + "</div>",
    '<div class="item-meta">',
    '<span class="badge" style="--chip-c: var(--f-' + rec.front +
      "); --chip-t: var(--f-" + rec.front + '-tint)">' + esc(frontHe(rec.front)) + "</span>",
    kbadgeHtml(rec),
    vbadgeHtml(rec),
    statusChipHtml(rec),
    "</div>",
    '<div class="item-detail" hidden>',
    targetHtml(rec),
    targetNamesHtml(rec),
    partOfHtml(rec),
    '<p class="he">' + esc(rec.he) + "</p>",
    alsoHtml(rec),
    note,
    '<div class="item-links">' + sourcesHtml(rec) + "</div>",
    "<details><summary>המקור בערבית</summary>",
    '<div class="ar" dir="rtl" lang="ar">' + esc(rec.ar) + "</div></details>",
    "</div>",
  ].join("");
}

/* On desktop the list is its own scroller, so a marker click moves the PANE and
   the page stays exactly where the reader left it. scrollIntoView would drag the
   whole document, which is what it used to do. On a phone there is only one
   scroller, so scrollIntoView is still the right call there.

   The card lands at the TOP of the pane, not its middle. Centring is right for a
   line and wrong for a card: setActive opens the detail first, so the card being
   measured is often taller than the pane, and half of it went above the edge -
   taking the date and the heading, the two things that say which event this is.

   The sticky .list-head is subtracted because it floats over the top of the
   pane; a card aligned to 0 sits underneath it. Measured at call time, never
   stored - a height written into a variable is the --band-h mistake. */
function scrollListTo(item) {
  const behavior = mqStill.matches ? "auto" : "smooth";
  const pane = document.getElementById("list-pane");
  /* On a phone the PAGE is the only scroller, and nothing is pinned over it -
     the band scrolls away with everything else - so the card goes to the top of
     the window with a hair of room above it. */
  if (!pane || mqMobile.matches) {
    glide(window, Math.max(0, window.scrollY + item.getBoundingClientRect().top - 12),
      behavior);
    return;
  }
  const head = pane.querySelector(".list-head");
  const headH = head ? head.getBoundingClientRect().height : 0;
  const paneRect = pane.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  const top = Math.max(0, pane.scrollTop + (itemRect.top - paneRect.top) - headH - 10);
  glide(pane, top, behavior);
}

/* Smooth scrolling is a nicety and is NOT allowed to be the mechanism. Measured
   in an embedded browser on this very board: scrollTo({behavior:"smooth"})
   returns without error and the pane never moves, while behavior "auto" and
   scrollTop both work. So the animation is attempted and then CHECKED, and a
   pane that has not moved is moved by hand.

   The check is a timer, not requestAnimationFrame: rAF was measured firing zero
   times in that same browser, which would have made the guard as dead as the
   thing it guards. Same family as the ResizeObserver that fired zero times -
   never trust one mechanism to have run, and never let the guard share the
   fate of the mechanism. */
function glide(scroller, top, behavior) {
  const isWindow = scroller === window;
  const at = () => (isWindow ? window.scrollY : scroller.scrollTop);
  const put = (v) => { if (isWindow) window.scrollTo(0, v); else scroller.scrollTop = v; };
  if (behavior !== "smooth" || !scroller.scrollTo) {
    put(top);
    return;
  }
  const from = at();
  scroller.scrollTo({ top: top, behavior: "smooth" });
  setTimeout(function () {
    if (at() === from && from !== top) put(top);
  }, 80);
}

/* The card selected on the map is the card whose detail is open - one state,
   not two that have to be kept agreeing. So a marker click opens its card, and
   opening a card selects its marker, with no extra wiring either way. */
function setDetailOpen(item, open) {
  if (!item) return;
  const detail = item.querySelector(".item-detail");
  if (detail) detail.hidden = !open;
  item.setAttribute("aria-expanded", open ? "true" : "false");
}

function isDetailOpen(item) {
  return !!item && item.getAttribute("aria-expanded") === "true";
}

function setActive(id, opts) {
  if (activeId && activeId !== id && itemById.has(activeId)) {
    const previous = itemById.get(activeId);
    previous.classList.remove("active");
    setDetailOpen(previous, false);
  }
  const item = itemById.get(id);
  if (!item) return;
  activeId = id;
  item.classList.add("active");
  setDetailOpen(item, true);
  if (opts && opts.scrollList) scrollListTo(item);
  if (opts && opts.openPopup) MapView.select(id);
}

let renderedOnce = false;

function render() {
  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("empty");
  const emptyText = document.getElementById("empty-text");
  listEl.innerHTML = "";
  itemById.clear();
  activeId = null;

  const shown = DATA.attacks.filter(Filters.passes);
  MapView.draw(shown);
  /* Not on first paint - the opening view is Yemen on purpose. */
  if (renderedOnce && MapView.fitTo) MapView.fitTo(shown);
  renderedOnce = true;
  shown.forEach((rec) => {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = itemHtml(rec);
    li.tabIndex = 0;
    li.setAttribute("aria-expanded", "false");
    li.addEventListener("click", (event) => {
      if (event.target.closest("a, summary, details")) return;
      /* Clicking the card that is already open closes its detail. It stays the
         selected record on the map - closing a card is not deselecting it. */
      if (activeId === rec.id) {
        setDetailOpen(li, !isDetailOpen(li));
        return;
      }
      setActive(rec.id, { openPopup: true });
    });
    li.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      li.click();
    });
    listEl.appendChild(li);
    itemById.set(rec.id, li);
  });

  document.getElementById("count").textContent = String(shown.length);
  /* The chip numbers are recomputed from the same pass that built the list, so
     the band can never disagree with what is on screen. */
  Filters.refreshCounts();
  const noneAtAll = DATA.attacks.length === 0;
  emptyEl.hidden = shown.length > 0;
  if (noneAtAll) {
    emptyText.textContent =
      "עדיין אין נתונים. אחרי החיבור לטלגרם, התקיפות ייטענו לכאן.";
  } else if (shown.length === 0) {
    emptyText.textContent = Filters.emptyMessage();
  }
}

(function init() {
  if (typeof DATA === "undefined") {
    document.getElementById("empty").hidden = false;
    document.getElementById("empty-text").textContent =
      "קובץ הנתונים חסר. יש להריץ את תהליך העדכון.";
    return;
  }
  document.getElementById("stamp").innerHTML = "עודכן " + fmtStamp(DATA.generated);
  Filters.build();
  MapView.init();
  MapView.onSelect((id) => setActive(id, { scrollList: true, openPopup: false }));
  Filters.init();
  render();
})();
