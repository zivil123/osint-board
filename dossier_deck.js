/* dossier_deck.js — the dossier tab's PowerPoint, built in the browser on tap.

   window.DossierDeck = { build() }  → Promise resolving to { blob, fileName, mime }.
   It does not save; see dossier_view.js. An argument is accepted and ignored: the
   deck had a dark and a light theme until 2026-09-15, when Ziv kept only the bright
   one, and an old caller still passes a name.
   Reads DOSSIER (dossier_data.js) and, for the map slides, DossierMap
   (dossier_map.js). PptxGenJS 4.0.1 is fetched from jsDelivr on the FIRST tap and
   never before: the board must open with no network, and the deck is the one thing
   on it that needs one. Rejections carry a Hebrew message the view prints as is.
   VERIFY WITH `?deck=dry`, never a real save: the board runs on the machine the
   reader is sitting at, and a test tap must not put a file or a window on it.

   THE DECK IS A TITLE SLIDE AND THEN MAPS ONLY (Ziv, 2026-09-15). The Top 5, the
   dated background, the importance and the sources all came off the deck the same
   day: the tab still carries them, the presentation is the maps. Every map in
   DOSSIER.maps is exported once per variant DossierMap knows for it (plain, notes,
   relief) as a full-bleed picture, and the plain overview and close-up are also
   emitted as editable PowerPoint objects (dossier_deck_map.js).

   Every text box is RTL, right-aligned, he-IL, Segoe UI (Heebo is a web font and
   would not be on a projector laptop). Mixed content is built from RUNS in one
   paragraph, a digits-only date in LRM marks; paragraph properties sit on the
   FIRST run — pptxgenjs reads them there. */
(function () {
  "use strict";

  const CDN = "https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js";
  const NO_NET = "ההורדה דורשת חיבור לאינטרנט";
  const NO_DATA = "אין נתונים להורדה";
  const FAILED = "יצירת המצגת נכשלה";
  const NO_MAP = "המפה אינה זמינה";
  const FONT = "Segoe UI";
  /* ?deck=dry — the verification path, beside the view's own ?deck=share. The
     board runs on the machine the reader is SITTING AT, so a test tap may never
     drop a file in his downloads or open his file explorer. With the flag the deck
     is built in FULL and handed back as a rejection carrying its Hebrew result,
     with the blob and the counts left on DossierDeck.dry. */
  const DRY = /[?&]deck=dry(&|$)/.test(location.search), META = {};
  if (DRY) {
    const st = document.createElement("style");
    st.textContent = '.ds-btn::after{content:" · בדיקה בלבד"}';
    (document.head || document.documentElement).appendChild(st); }
  const W = 10, H = 5.625, M = 0.5;            // LAYOUT_16x9, inches
  const RULE_W = 0.9;
  /* Measured on PowerPoint's own render of Segoe UI Hebrew (2026-09-11): a line
     holds width/(pt*0.55) characters with word-wrap slack counted, lines 1.2em
     apart. The character count carries the slack; the pitch is as measured. */
  const GLYPH = 0.55, LINE = 1.2;
  const LRM = "‎";
  /* The one theme: a cool off-white ground, dark ink, the violet darkened to keep 3:1.
     `name` is what DossierMap and DossierDeckMap are asked for. */
  const T = { name: "light", bg: "FBFDFF", ink: "0B2138", muted: "3F5670",
              accent: "1D4ED8", violet: "5B4BC4", line: "D6DEE8" };
  /* The maps that also go in as editable objects: the twin knows these two frames
     and their plain layers, nothing more. */
  const EDITABLE = ["overview", "mandab"];
  let libPromise = null;

  /* ---- library ------------------------------------------------------------ */

  function loadLib() {
    if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
    if (libPromise) return libPromise;
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      let timer = null;
      function fail() { clearTimeout(timer); s.remove(); libPromise = null; reject(new Error(NO_NET)); }
      s.src = CDN; s.async = true;
      s.onload = () => { clearTimeout(timer);
        if (window.PptxGenJS) resolve(window.PptxGenJS); else fail(); };
      s.onerror = fail;
      timer = setTimeout(fail, 20000);
      document.head.appendChild(s);
    });
    return libPromise;
  }

  /* ---- text helpers ------------------------------------------------------- */
  /* Headings only: a hyphen between two Hebrew letters becomes a non-breaking one,
     so a name like the strait's is never split across lines. */
  function noBreakHyphen(text) {
    return String(text || "").replace(/([֐-׿])-([֐-׿])/g, "$1‑$2");
  }
  function fmtDate(iso) {
    const p = String(iso || "").split("-");
    if (p.length !== 3) return String(iso || "");
    return LRM + Number(p[2]) + "." + Number(p[1]) + "." + p[0] + LRM;
  }
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  function run(text, o) {
    return { text: String(text == null ? "" : text),
      options: Object.assign({ rtlMode: true, lang: "he-IL", fontFace: FONT,
                               align: "right" }, o || {}) };
  }
  /* PowerPoint lays a run out by its LANGUAGE tag, not by its letters: Latin text
     tagged he-IL is drawn glyph-reversed ("AFP —1 troper ,trop ahcoM") and the
     same run tagged en-US is right; hyperlinks make no difference, and Unicode
     isolates print as visible boxes. Measured on nine variants, 2026-09-11. So a
     content string is cut into runs by script, and the cut follows the bidi
     algorithm's own rules for an RTL paragraph: a number joins the Latin before
     it (W7); any other neutral — a dash, a comma, brackets, spaces — is Latin only
     with Latin on BOTH sides (N1) and Hebrew otherwise (N2). Inside a Hebrew run
     PowerPoint places and mirrors it as the page would; inside a Latin run it is
     drawn LTR at the run's end, which put "AFP," with its comma on the wrong side
     and split "ב-Bab al-Mandab" into two reversed halves (measured). */
  const HEB = /[֐-׿]/, LAT = /[A-Za-zÀ-ɏ]/;
  const SEG = /[֐-׿]+|[A-Za-zÀ-ɏ]+|[0-9]+|[^֐-׿A-Za-zÀ-ɏ0-9]+/g;
  function runsFor(text, o) {
    const segs = String(text == null ? "" : text).match(SEG) || [];
    if (!segs.length) return [run("", o)];
    const cls = [];
    let lastStrong = "";
    segs.forEach((t, i) => {
      if (HEB.test(t) || LAT.test(t)) { cls[i] = HEB.test(t) ? "he" : "en"; lastStrong = cls[i]; }
      else if (/[0-9]/.test(t)) cls[i] = lastStrong === "en" ? "en" : "he";
      else cls[i] = ""; });
    cls.forEach((c, i) => {
      if (c) return; let prev = "", next = "";
      for (let j = i - 1; j >= 0 && !prev; j--) prev = cls[j];
      for (let j = i + 1; j < cls.length && !next; j++) next = cls[j];
      cls[i] = (prev === "en" && next === "en") ? "en" : "he"; });
    const groups = []; segs.forEach((t, i) => {
      const last = groups[groups.length - 1];
      if (last && last.cls === cls[i]) last.text += t; else groups.push({ cls: cls[i], text: t }); });
    return groups.map(g => run(g.text,
      Object.assign({}, o || {}, { lang: g.cls === "en" ? "en-US" : "he-IL" })));
  }
  function box(slide, runs, pos, o) {
    slide.addText(runs, Object.assign({ isTextBox: true, rtlMode: true, align: "right",
      valign: "top", lang: "he-IL", fontFace: FONT, margin: 0 }, pos, o || {}));
  }
  function tall(text, widthIn, pt, afterPt) {
    const lines = Math.max(1, Math.ceil(String(text || "").length /
      Math.max(8, Math.floor(widthIn * 72 / (pt * GLYPH)))));
    return (lines * pt * LINE + (afterPt || 0)) / 72;
  }

  /* ---- slide furniture ---------------------------------------------------- */

  function ground(slide) { slide.background = { color: T.bg }; }

  function heading(slide, text) {
    box(slide, runsFor(noBreakHyphen(text), { fontSize: 30, bold: true, color: T.ink }),
      { x: M, y: 0.3, w: W - 2 * M, h: 0.62 });
    slide.addShape("rect", { x: W - M - RULE_W, y: 0.98, w: RULE_W, h: 0.045,
      fill: { color: T.violet }, line: { color: T.violet, width: 0 } });
  }

  /* ---- slide 1: title ----------------------------------------------------- */

  /* The relief pictures under the terrain maps carry a credit their licence asks
     for. It is Latin, which a MAP may never show; a line of small type on the
     title slide is where it goes. Frames can carry different credits (terrain and
     streets tiles differ), so every distinct one is printed, first-seen order. */
  function reliefCredit() {
    const R = (typeof GEO !== "undefined" && GEO && GEO.relief) || null;
    if (!R || typeof R !== "object") return "";
    const seen = [];
    Object.keys(R).forEach(k => {
      const a = R[k] && R[k].attribution ? String(R[k].attribution).trim() : "";
      if (a && seen.indexOf(a) === -1) seen.push(a);
    });
    return seen.join(" · ");
  }

  /* The block is measured and centred, so a title that wraps to three lines pushes
     the subtitle down instead of printing through it. */
  function titleSlide(slide) {
    const title = noBreakHyphen(DOSSIER.title_he), sub = DOSSIER.subtitle_he || "";
    const titleH = tall(title, W - 2 * M, 40, 0), subH = sub ? tall(sub, W - 2 * M, 20, 0) : 0;
    const blockH = 0.26 + titleH + 0.12 + subH + 0.35 + 0.4;
    let y = Math.max(0.45, (H - blockH) / 2);  // the block is centred as a whole
    slide.addShape("rect", { x: W - M - 1.4, y: y, w: 1.4, h: 0.06,
      fill: { color: T.violet }, line: { color: T.violet, width: 0 } });
    y += 0.26;
    box(slide, runsFor(title, { fontSize: 40, bold: true, color: T.ink }),
      { x: M, y: y, w: W - 2 * M, h: titleH });
    y += titleH + 0.12;
    if (sub) {
      box(slide, runsFor(sub, { fontSize: 20, color: T.muted }),
        { x: M, y: y, w: W - 2 * M, h: subH });
      y += subH; }
    box(slide, [run("נכון ל-", { fontSize: 16, color: T.accent }),
                run(fmtDate(DOSSIER.as_of), { fontSize: 16, color: T.accent })],
      { x: M, y: y + 0.35, w: W - 2 * M, h: 0.4 });
    const credit = reliefCredit();
    if (credit) box(slide, runsFor(credit, { fontSize: 9, color: T.muted }),
      { x: M, y: H - 0.42, w: W - 2 * M, h: 0.26 });
  }

  /* ---- map slides --------------------------------------------------------- */

  /* A MAP SLIDE IS A TITLE BAND AND THE PICTURE UNDER IT (2026-09-17). It used
     to be the picture edge to edge, with its own heading painted into the
     canvas; Ziv, reviewing the three newest maps, asked for the header OUTSIDE
     the picture, so the painter stopped writing one and the slide writes it
     instead - as a real text box he can edit, in the deck's own type, above a
     picture fitted to what is left. The picture still carries its own legend,
     and "make everything bigger" (2026-09-11) is kept by fitting it to the
     WHOLE remaining height rather than to a margin box. Only a failed export
     falls back to a slide saying so.
     THE PLAIN OVERVIEW AND CLOSE-UP ARE IN THE DECK TWICE since 2026-09-14 - the
     picture, and then the same map as objects he can edit, because he asked for
     both: "put it as a picture and also put it as stuff that I can edit on the
     PowerPoint slide." The editable one is dossier_deck_map.js; if that file is
     not on the page the deck simply loses that slide and keeps every picture. */
  /* THE TWIN CARRIES THE SAME TITLE AS THE PICTURE SLIDE (2026-09-17). Every
     other map slide gained a real title text box the day the painter stopped
     writing one into the canvas; the editable twin was drawing the map alone,
     so the deck read as a titled picture followed by an anonymous one. The twin
     paints edge to edge and has no room reserved above it, so the title goes on
     a band of the deck's own ground laid over the map's top strip - the same
     height the picture slides reserve, and over the emptiest part of both
     frames (Saudi desert on the overview, open sea on the close-up). */
  function titleBand(slide, text) {
    slide.addShape("rect", { x: 0, y: 0, w: W, h: PIC_TOP,
      fill: { color: T.bg }, line: { color: T.bg, width: 0 } });
    heading(slide, text);
  }
  function vectorPage(pages, map) {
    if (!window.DossierDeckMap) return;
    pages.push({ draw: (slide) => {
      const s = DossierDeckMap.slide(null, slide, map.id, T.name);
      titleBand(slide, titleFor(map, "plain"));
      if (s) META.vector.push(Object.assign({ id: map.id }, s));
    } });
  }
  /* The page's own heading rule, so a slide and the block on the tab are named
     the same thing: the map's title, or its caption's first clause, and a
     variant's own caption where it has one. */
  function clauseOf(text) {
    const t = String(text || "").trim();
    const m = /[.。]|\s[—–-]\s/.exec(t);
    return (m ? t.slice(0, m.index) : t).replace(/[,،]\s*$/, "").trim();
  }
  function titleFor(map, variant) {
    const v = variant && variant !== "plain" && map.variants ? map.variants[variant] : null;
    const own = String(map.title_he || "").trim() || clauseOf(map.caption_he);
    return v ? (clauseOf(v.caption_he) || own) : own;
  }
  /* The picture keeps its own 16:9 shape - the export is always 2560x1440 - and
     is fitted to the band that is left, centred. Fitted by HEIGHT here, which
     is what a 16:9 picture under a title band always comes to on a 16:9 slide;
     the width branch is kept so a squarer export could not overflow the slide. */
  const PIC_TOP = 1.12, PIC_PAD = 0.18;
  function picBox(png) {
    const h = H - PIC_TOP - PIC_PAD, w = Math.min(W, h * 16 / 9);
    const fit = w === W ? { w: W, h: W * 9 / 16 } : { w: w, h: h };
    return { data: png.replace(/^data:/, ""), x: (W - fit.w) / 2, y: PIC_TOP,
             w: fit.w, h: fit.h };
  }
  function mapPage(pages, map, png, variant) {
    pages.push({ draw: (slide) => {
      ground(slide);
      heading(slide, titleFor(map, variant));
      if (png) { slide.addImage(picBox(png)); return; }
      box(slide, [run(NO_MAP, { fontSize: 20, color: T.muted, align: "center" })],
        { x: M, y: H / 2 - 0.25, w: W - 2 * M, h: 0.5 }, { align: "center" });
    } });
  }

  /* The painter's own list of what it can draw for a frame, plain first. A painter
     without the call (or a call that throws) means one plain picture per map. */
  function variantsOf(id) {
    const P = window.DossierMap;
    if (P && typeof P.variantsOf === "function") {
      try { const v = P.variantsOf(id); if (Array.isArray(v) && v.length) return v.slice(); }
      catch (err) { console.warn("dossier_deck: variantsOf failed", err); }
    }
    return ["plain"];
  }
  /* The relief pictures are fetched once and painted from memory; a deck built
     before they land would carry terrain maps with no terrain on them. */
  function mapsReady() {
    const P = window.DossierMap;
    if (!P || typeof P.ready !== "function") return Promise.resolve();
    return Promise.resolve().then(() => P.ready(T.name))
      .catch(err => { console.warn("dossier_deck: relief not ready", err); });
  }
  function exportMap(id, variant) {
    if (!window.DossierMap || typeof DossierMap.exportPng !== "function") return null;
    return Promise.resolve()
      .then(() => DossierMap.exportPng(id, T.name, 2560, 1440, variant))
      .then(png => (typeof png === "string" && png.indexOf("base64,") > 0) ? png : null)
      .catch(err => { console.error("dossier_deck: map export failed", err); return null; });
  }

  /* ---- the deck ----------------------------------------------------------- */

  /* One picture per (map, variant) in DOSSIER.maps order, every variant of a map
     together; the editable twin follows the plain picture of the frames it knows.
     A map that lives on the מפות tab (`tab: "maps"`) is NOT in the deck: Ziv
     moved those three off the document and out of its presentation on
     2026-09-17, and the tab's own PNG buttons are how they reach a slide. */
  function wantedPictures() {
    const maps = Array.isArray(DOSSIER.maps) ? DOSSIER.maps : [];
    const out = [];
    maps.forEach(map => {
      if (!map || !map.id || map.tab === "maps") return;
      variantsOf(map.id).forEach(variant => out.push({ map: map, variant: variant }));
    });
    return out;
  }

  function build(Lib) {
    const wanted = wantedPictures();
    META.vector = []; META.pictures = [];
    return mapsReady()
      .then(() => Promise.all(wanted.map(w => exportMap(w.map.id, w.variant))))
      .then(pngs => {
        const pptx = new Lib(); pptx.layout = "LAYOUT_16x9"; pptx.rtlMode = true;
        pptx.theme = { headFontFace: FONT, bodyFontFace: FONT, lang: "he-IL" };
        pptx.title = DOSSIER.title_he || "";
        const pages = [];
        pages.push({ draw: slide => { ground(slide); titleSlide(slide); } });
        wanted.forEach((w, i) => {
          mapPage(pages, w.map, pngs[i], w.variant);
          META.pictures.push({ id: w.map.id, variant: w.variant, png: !!pngs[i] });
          if (w.variant === "plain" && EDITABLE.indexOf(w.map.id) >= 0) vectorPage(pages, w.map);
        });
        pages.forEach((p, i) => p.draw(pptx.addSlide(), i + 1, pages.length));
        META.slides = pages.length; return pptx;
      });
  }

  const MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

  /* pptxgenjs writes an <a:pPr> before EVERY run of a mixed-run paragraph, and
     the schema allows one, first. PowerPoint reads the extras leniently (measured:
     every slide rendered) but a stricter reader may not, so the zip is opened with
     the JSZip the bundle already carries and each paragraph keeps only its first
     <a:pPr>. Any failure on this path falls back to the library's own save. */
  function cleanParagraphs(xml) {
    return xml.replace(/<a:p>([^]*?)<\/a:p>/g, (m, body) => {
      let first = true;
      const kept = body.replace(/<a:pPr\b[^>]*\/>|<a:pPr\b[^>]*>[^]*?<\/a:pPr>/g,
        s => { if (first) { first = false; return s; } return ""; });
      return "<a:p>" + kept + "</a:p>";
    });
  }
  /* Hands the finished file BACK, and never saves it. Which way a file reaches
     the reader is the view's business, not the deck's: on a phone it is the
     share sheet and on a desktop it is a download, and only the view knows
     which tap it is holding. */
  function save(pptx, fileName) {
    return pptx.write({ outputType: "blob" })
      .then(blob => window.JSZip ? JSZip.loadAsync(blob).then(zip => {
        const slides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n));
        return Promise.all(slides.map(n => zip.file(n).async("string")
          .then(xml => zip.file(n, cleanParagraphs(xml)))))
          .then(() => zip.generateAsync({ type: "blob", compression: "DEFLATE",
            mimeType: MIME }));
      }).catch(err => {
        console.warn("dossier_deck: paragraph clean failed, using the raw zip", err);
        return blob; }) : blob)
      .then(blob => ({ blob: blob, fileName: fileName, mime: MIME }));
  }

  /* Built, counted, and NOT handed over: the dry run's numbers go where a checker
     can read them and its Hebrew line goes on screen through the view. */
  function dry(made) {
    window.DossierDeck.dry = Object.assign({ slides: META.slides, pictures: META.pictures,
      vector: META.vector }, made);
    const err = new Error("בדיקה בלבד — " + META.slides + " שקפים. הקובץ לא נשמר.");
    err.dry = true; throw err;
  }

  function build_(/* theme — accepted and ignored since 2026-09-15 */) {
    if (typeof DOSSIER === "undefined" || !DOSSIER || !DOSSIER.title_he)
      return Promise.reject(new Error(NO_DATA));
    /* The date in the name is the dossier's OWN as_of, never the clock: the name
       names the DOCUMENT, so two people saving it on different days get the same
       file. A malformed as_of drops out rather than inventing one. */
    const base = (DOSSIER.deck && DOSSIER.deck.filename) || "dossier";
    const day = ISO.test(DOSSIER.as_of || "") ? "-" + DOSSIER.as_of : "";
    return loadLib()
      .then(Lib => build(Lib))
      .then(pptx => save(pptx, base + day + ".pptx"))
      .then(made => (DRY ? dry(made) : made))
      .catch(err => {
        const msg = err && err.message;
        if (msg === NO_NET || msg === NO_DATA || (err && err.dry)) throw err;
        console.error("dossier_deck:", err);
        throw new Error(FAILED);
      });
  }

  window.DossierDeck = { build: build_ };
})();
