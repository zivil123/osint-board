/* dossier_deck.js — the dossier tab's PowerPoint, built in the browser on tap.

   window.DossierDeck = { build(theme) }  theme: "dark" | "light"  → Promise
   resolving to { blob, fileName, mime }. It does not save; see dossier_view.js.
   Reads DOSSIER (dossier_data.js) and, for the two map slides, DossierMap.exportPng
   (dossier_map.js). PptxGenJS 4.0.1 is fetched from jsDelivr on the FIRST tap and
   never before: the board must open with no network, and the deck is the one thing
   on it that needs one. Rejections carry a Hebrew message the view prints as is.

   Every text box is RTL, right-aligned, he-IL, Segoe UI (on every Windows
   PowerPoint; Heebo is a web font and would not be on a projector laptop). Mixed
   content is built from RUNS in one paragraph; a digits-only date is its own run
   wrapped in LRM marks, the deck's equivalent of the page's <bdi dir="ltr">.
   Paragraph properties (rtlMode, align, bullet, spacing) must sit on the FIRST run
   of each paragraph — pptxgenjs reads them from there, not from the shape.

   PowerPoint cannot report a text box's height back, so page breaks are decided
   here from a conservative glyph estimate; the text budgets in DOSSIER.md are the
   cap that keeps the estimate honest. Two themes come from one function: the dark
   one reads the board's own tokens (with the same values as fallbacks), the light
   one is a cool off-white ground with the violet darkened to keep 3:1. */
(function () {
  "use strict";

  const CDN = "https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js";
  const NO_NET = "ההורדה דורשת חיבור לאינטרנט";
  const NO_DATA = "אין נתונים להורדה";
  const FAILED = "יצירת המצגת נכשלה";
  const NO_MAP = "המפה אינה זמינה";
  const FONT = "Segoe UI";
  const W = 10, H = 5.625, M = 0.5;            // LAYOUT_16x9, inches
  const BODY_TOP = 1.2, BODY_BOTTOM = H - 0.58; // under the heading, above the footer
  const RULE_W = 0.9, GAP = 0.4;
  /* Measured on PowerPoint's own render of Segoe UI Hebrew (2026-09-11): a line
     holds width/(pt*0.55) characters once word-wrap slack is counted, and lines
     sit 1.2em apart. The character count is what carries the slack (measured
     ~76 per line where this says 65); the pitch is taken as measured. */
  const GLYPH = 0.55, LINE = 1.2;
  const LRM = "\u200E";
  const VERDICT = {
    confirmed: "אומת בדיווחים בין-לאומיים",
    partial: "אימות חלקי",
    none: "דיווח שלא נמצא לו אימות עצמאי",
    claim: "טענה",
  };
  const KIND = { shipping: "ספנות", saudi: "סעודיה", israel: "ישראל",
                 yemen: "תימן", iran: "איראן", watch: "למעקב" };
  const LIGHT = { bg: "FBFDFF", ink: "0B2138", muted: "3F5670", accent: "1D4ED8",
                  violet: "5B4BC4", line: "D6DEE8" };
  const DARK_FALLBACK = { bg: "081A2F", ink: "E6EDF5", muted: "A9BACC",
                          accent: "6EA8FF", violet: "B7A5F7", line: "22384F" };
  let libPromise = null;

  /* ---- library ------------------------------------------------------------ */

  function loadLib() {
    if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
    if (libPromise) return libPromise;
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      let timer = null;
      function fail() {
        clearTimeout(timer); s.remove(); libPromise = null;
        reject(new Error(NO_NET));
      }
      s.src = CDN; s.async = true;
      s.onload = () => { clearTimeout(timer);
        if (window.PptxGenJS) resolve(window.PptxGenJS); else fail(); };
      s.onerror = fail;
      timer = setTimeout(fail, 20000);
      document.head.appendChild(s);
    });
    return libPromise;
  }

  /* ---- theme -------------------------------------------------------------- */

  function tok(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const m = /^#([0-9a-f]{6})$/i.exec(v);
    return m ? m[1].toUpperCase() : fallback;
  }
  function themeOf(name) {
    if (name === "light") return Object.assign({ name: "light" }, LIGHT);
    const F = DARK_FALLBACK;
    return { name: "dark", bg: tok("--bg", F.bg), ink: tok("--ink", F.ink),
      muted: tok("--ink-muted", F.muted), accent: tok("--accent-text", F.accent),
      violet: tok("--f-internal", F.violet), line: F.line };
  }

  /* ---- text helpers ------------------------------------------------------- */

  /* Headings only: a hyphen between two Hebrew letters becomes a non-breaking one,
     so a name like the strait's is never split across lines. Body text wraps as
     PowerPoint sees fit; this is a heading's privilege. */
  function noBreakHyphen(text) {
    return String(text || "").replace(/([\u0590-\u05FF])-([\u0590-\u05FF])/g, "$1\u2011$2");
  }
  function fmtDate(iso) {
    const p = String(iso || "").split("-");
    if (p.length !== 3) return String(iso || "");
    return LRM + Number(p[2]) + "." + Number(p[1]) + "." + p[0] + LRM;
  }
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
  const HEB = /[\u0590-\u05FF]/, LAT = /[A-Za-z\u00C0-\u024F]/;
  const SEG = /[\u0590-\u05FF]+|[A-Za-z\u00C0-\u024F]+|[0-9]+|[^\u0590-\u05FFA-Za-z\u00C0-\u024F0-9]+/g;
  function runsFor(text, o) {
    const segs = String(text == null ? "" : text).match(SEG) || [];
    if (!segs.length) return [run("", o)];
    const cls = [];
    let lastStrong = "";
    segs.forEach((t, i) => {
      if (HEB.test(t) || LAT.test(t)) { cls[i] = HEB.test(t) ? "he" : "en"; lastStrong = cls[i]; }
      else if (/[0-9]/.test(t)) cls[i] = lastStrong === "en" ? "en" : "he";
      else cls[i] = "";
    });
    cls.forEach((c, i) => {
      if (c) return;
      let prev = "", next = "";
      for (let j = i - 1; j >= 0 && !prev; j--) prev = cls[j];
      for (let j = i + 1; j < cls.length && !next; j++) next = cls[j];
      cls[i] = (prev === "en" && next === "en") ? "en" : "he";
    });
    const groups = [];
    segs.forEach((t, i) => {
      const last = groups[groups.length - 1];
      if (last && last.cls === cls[i]) last.text += t; else groups.push({ cls: cls[i], text: t });
    });
    return groups.map(g => {
      const opts = Object.assign({}, o || {}, { lang: g.cls === "en" ? "en-US" : "he-IL" });
      if (opts.hyperlink) opts.hyperlink = Object.assign({}, opts.hyperlink);
      return run(g.text, opts);
    });
  }
  /* Paragraph-level options go on the first run; the last run ends the paragraph. */
  function para(runs, popts) {
    Object.assign(runs[0].options, popts || {});
    runs[runs.length - 1].options.breakLine = true;
    return runs;
  }
  function box(slide, runs, pos, o) {
    slide.addText(runs, Object.assign({ isTextBox: true, rtlMode: true, align: "right",
      valign: "top", lang: "he-IL", fontFace: FONT, margin: 0 }, pos, o || {}));
  }
  function linesOf(text, widthIn, pt) {
    const perLine = Math.max(8, Math.floor(widthIn * 72 / (pt * GLYPH)));
    return Math.max(1, Math.ceil(String(text || "").length / perLine));
  }
  function tall(text, widthIn, pt, afterPt) {
    return (linesOf(text, widthIn, pt) * pt * LINE + (afterPt || 0)) / 72;
  }

  /* Packs items into columns; `avail(pageIdx)` is the column height on that page,
     so the first page can give room to the intro. Returns pages → columns → items.
     An item that cannot fit beside the intro is NOT squeezed under it: the intro
     keeps its page alone and the item opens the next one (measured: a 700-char
     intro plus one item ran through the footer). */
  function pack(items, measure, avail, cols, maxPerCol) {
    const pages = [];
    let page = [], col = [], used = 0;
    function closeCol() {
      page.push(col); col = []; used = 0;
      if (page.length === cols) { pages.push(page); page = []; }
    }
    items.forEach(item => {
      const h = measure(item);
      if (col.length && (used + h > avail(pages.length) || col.length >= maxPerCol)) closeCol();
      if (!col.length && !page.length && h > avail(pages.length) &&
          avail(pages.length + 1) > avail(pages.length)) {
        pages.push([[]]);
      }
      col.push(item); used += h;
    });
    if (col.length) page.push(col);
    if (page.length) pages.push(page);
    return pages;
  }

  /* ---- slide furniture ---------------------------------------------------- */

  function ground(slide, T) { slide.background = { color: T.bg }; }

  function heading(slide, T, text) {
    box(slide, runsFor(noBreakHyphen(text), { fontSize: 30, bold: true, color: T.ink }),
      { x: M, y: 0.3, w: W - 2 * M, h: 0.62 });
    slide.addShape("rect", { x: W - M - RULE_W, y: 0.98, w: RULE_W, h: 0.045,
      fill: { color: T.violet }, line: { color: T.violet, width: 0 } });
  }

  function footer(slide, T, n, total) {
    const y = H - 0.42, h = 0.26;
    box(slide, [run("נכון ל-", { fontSize: 12, color: T.muted }),
                run(fmtDate(DOSSIER.as_of), { fontSize: 12, color: T.muted })],
      { x: W / 2, y: y, w: W / 2 - M, h: h });
    box(slide, [run("עמוד " + n + " מתוך " + total,
                    { fontSize: 12, color: T.muted, align: "left" })],
      { x: M, y: y, w: W / 2 - M, h: h }, { align: "left" });
  }

  /* ---- slide 1: title ----------------------------------------------------- */

  /* The block is measured and centred, so a title that wraps to three lines pushes
     the subtitle down instead of printing through it. */
  function titleSlide(slide, T) {
    const title = noBreakHyphen(DOSSIER.title_he), sub = DOSSIER.subtitle_he || "";
    const titleH = tall(title, W - 2 * M, 40, 0), subH = sub ? tall(sub, W - 2 * M, 20, 0) : 0;
    const blockH = 0.26 + titleH + 0.12 + subH + 0.35 + 0.4;
    let y = Math.max(0.45, (H - blockH) / 2);
    slide.addShape("rect", { x: W - M - 1.4, y: y, w: 1.4, h: 0.06,
      fill: { color: T.violet }, line: { color: T.violet, width: 0 } });
    y += 0.26;
    box(slide, runsFor(title, { fontSize: 40, bold: true, color: T.ink }),
      { x: M, y: y, w: W - 2 * M, h: titleH });
    y += titleH + 0.12;
    if (sub) {
      box(slide, runsFor(sub, { fontSize: 20, color: T.muted }),
        { x: M, y: y, w: W - 2 * M, h: subH });
      y += subH;
    }
    box(slide, [run("נכון ל-", { fontSize: 16, color: T.accent }),
                run(fmtDate(DOSSIER.as_of), { fontSize: 16, color: T.accent })],
      { x: M, y: y + 0.35, w: W - 2 * M, h: 0.4 });
  }

  /* ---- slide 2: the Top 5 ------------------------------------------------- */

  /* Ziv's own slide (2026-09-11): five headlines, each "title | one paragraph",
     all on ONE slide — never a second page. The build caps every item
     (DOSSIER.md) so the five fit at 12pt by the conservative estimate; this
     takes the largest size from 16pt down that fits. */
  function top5Page(pages, T) {
    const top = DOSSIER.top5;
    const items = top && Array.isArray(top.items) ? top.items : [];
    if (!items.length) return;
    const width = W - 2 * M, avail = BODY_BOTTOM - BODY_TOP;
    const line = it => (it.title_he || "") + " | " + (it.text_he || "");
    /* Measured on PowerPoint's render of this slide (2026-09-11): ~120 characters
       a line at 12pt across the full body, where GLYPH's 0.55 says 98 — so the
       shared estimate left a sixth of the slide empty at 12pt. 0.5 keeps slack. */
    const height = p => items.reduce((h, it) => h + (Math.ceil(line(it).length /
      Math.floor(width * 72 / (p * 0.5))) * p * LINE + 10) / 72, 0);
    let pt = 16;
    while (pt > 12 && height(pt) > avail) pt--;
    pages.push({ draw: (slide, n, total) => {
      ground(slide, T);
      heading(slide, T, top.heading_he || "");
      footer(slide, T, n, total);
      const runs = items.reduce((acc, it) => acc.concat(para(
        runsFor(it.title_he, { fontSize: pt, bold: true, color: T.ink })
          .concat(run(" | ", { fontSize: pt, color: T.muted }))
          .concat(runsFor(it.text_he, { fontSize: pt, color: T.ink })),
        { paraSpaceAfter: 10 })), []);
      box(slide, runs, { x: M, y: BODY_TOP, w: width, h: BODY_BOTTOM - BODY_TOP });
    } });
  }

  /* ---- prose sections: background, importance, meanings ------------------ */

  function bgRuns(item, T) {
    const v = VERDICT[item.verdict];
    const runs = [run(fmtDate(item.date), { fontSize: 18, bold: true, color: T.ink }),
                  run(" — ", { fontSize: 18, color: T.ink })]
      .concat(runsFor(item.text_he, { fontSize: 18, color: T.ink }));
    if (v) runs.push(run(" · " + v, { fontSize: 18, color: T.muted }));
    return para(runs, { bullet: { indent: 20 }, paraSpaceAfter: 8 });
  }
  function bgMeasure(width) {
    return item => tall(fmtDate(item.date) + " — " + (item.text_he || "") + " · " +
                        (VERDICT[item.verdict] || ""), width - 0.3, 18, 8);
  }

  function itemRuns(item, T) {
    const kind = KIND[item.kind];
    const head = (kind ? [run(kind + " · ", { fontSize: 16, color: T.muted })] : [])
      .concat(runsFor(item.title_he, { fontSize: 20, bold: true, color: T.ink }));
    return para(head, { paraSpaceAfter: 2 }).concat(
      para(runsFor(item.text_he, { fontSize: 18, color: T.ink }), { paraSpaceAfter: 12 }));
  }
  function itemMeasure(width) {
    return item => tall((KIND[item.kind] ? KIND[item.kind] + " · " : "") +
                        (item.title_he || ""), width, 20, 2) +
                   tall(item.text_he || "", width, 18, 12);
  }

  /* One prose section → one or more pages. `cols` is 1 or 2 (RTL: right first). */
  function sectionPages(pages, T, sec, toRuns, toMeasure, cols, maxPerCol) {
    if (!sec) return;
    const colW = cols === 2 ? (W - 2 * M - GAP) / 2 : W - 2 * M;
    const intro = String(sec.intro_he || "").trim();
    const introH = intro ? tall(intro, W - 2 * M, 18, 0) + 0.2 : 0;
    const full = BODY_BOTTOM - BODY_TOP;
    const avail = i => (i === 0 ? full - introH : full);
    const items = Array.isArray(sec.items) ? sec.items : [];
    const packed = items.length ? pack(items, toMeasure(colW), avail, cols, maxPerCol)
                                : [[]];
    packed.forEach((columns, pi) => {
      pages.push({ draw: (slide, n, total) => {
        ground(slide, T);
        heading(slide, T, sec.heading_he + (pi ? " (המשך)" : ""));
        footer(slide, T, n, total);
        let top = BODY_TOP;
        if (pi === 0 && intro) {
          box(slide, runsFor(intro, { fontSize: 18, color: T.ink }),
            { x: M, y: top, w: W - 2 * M, h: introH - 0.2 });
          top += introH;
        }
        columns.forEach((col, ci) => {
          const runs = col.reduce((acc, it) => acc.concat(toRuns(it, T)), []);
          if (!runs.length) return;
          const x = cols === 2 ? (ci === 0 ? W - M - colW : M) : M;
          box(slide, runs, { x: x, y: top, w: colW, h: BODY_BOTTOM - top });
        });
      } });
    });
  }

  /* ---- map slides --------------------------------------------------------- */

  /* A map slide is the map, edge to edge: the picture carries its own title
     and legend, so a heading bar, caption and footer would only shrink it
     (Ziv, 2026-09-11: "make everything bigger"). Only a failed export falls
     back to a titled slide saying so. */
  function mapPage(pages, T, map, png) {
    pages.push({ draw: (slide) => {
      ground(slide, T);
      if (png) {
        slide.addImage({ data: png.replace(/^data:/, ""), x: 0, y: 0, w: W, h: H });
        return;
      }
      heading(slide, T, map.title_he || "");
      box(slide, [run(NO_MAP, { fontSize: 20, color: T.muted, align: "center" })],
        { x: M, y: H / 2 - 0.25, w: W - 2 * M, h: 0.5 }, { align: "center" });
    } });
  }

  function exportMap(id, theme) {
    if (!window.DossierMap || typeof DossierMap.exportPng !== "function") {
      return Promise.resolve(null);
    }
    return Promise.resolve()
      .then(() => DossierMap.exportPng(id, theme, 2560, 1440))
      .then(png => (typeof png === "string" && png.indexOf("base64,") > 0) ? png : null)
      .catch(err => { console.error("dossier_deck: map export failed", err); return null; });
  }

  /* ---- sources ------------------------------------------------------------ */

  /* Date FIRST, link last. With a Latin publisher the paragraph's tail was
     "AFP · 3.9.2026" — Latin, neutrals, digits — and PowerPoint drew it as
     "3.9.2026AFP ·". Ending the paragraph on the link keeps any Latin run whole. */
  function sourceRuns(src, T) {
    const label = (src.title || "") + (src.publisher ? " — " + src.publisher : "");
    const runs = [];
    if (src.date) runs.push(run(fmtDate(src.date), { fontSize: 14, color: T.muted }),
                            run(" · ", { fontSize: 14, color: T.muted }));
    const link = runsFor(label, { fontSize: 14, color: T.accent, underline: { style: "sng" },
                                  hyperlink: { url: src.url, tooltip: src.url } });
    return para(runs.concat(link), { bullet: { type: "number", indent: 24 }, paraSpaceAfter: 6 });
  }
  function sourcePages(pages, T) {
    const sources = Array.isArray(DOSSIER.sources) ? DOSSIER.sources : [];
    const width = W - 2 * M - 0.35;
    const measure = s => tall((s.title || "") + " — " + (s.publisher || "") + " · " +
                              fmtDate(s.date), width, 14, 6);
    const packed = pack(sources, measure, () => BODY_BOTTOM - BODY_TOP, 1, 14);
    (packed.length ? packed : [[[]]]).forEach((columns, pi) => {
      pages.push({ draw: (slide, n, total) => {
        ground(slide, T);
        heading(slide, T, "מקורות" + (pi ? " (המשך)" : ""));
        footer(slide, T, n, total);
        const runs = columns[0].reduce((acc, s) => acc.concat(sourceRuns(s, T)), []);
        if (runs.length) {
          box(slide, runs, { x: M, y: BODY_TOP, w: W - 2 * M, h: BODY_BOTTOM - BODY_TOP });
        }
      } });
    });
  }

  /* ---- the deck ----------------------------------------------------------- */

  function section(id) {
    const list = Array.isArray(DOSSIER.sections) ? DOSSIER.sections : [];
    return list.find(s => s && s.id === id) || null;
  }

  function build(Lib, themeName) {
    const T = themeOf(themeName);
    const maps = Array.isArray(DOSSIER.maps) ? DOSSIER.maps : [];
    const wanted = ["overview", "mandab"].map(id => maps.find(m => m && m.id === id))
                                          .filter(Boolean);
    return Promise.all(wanted.map(m => exportMap(m.id, T.name))).then(pngs => {
      const pptx = new Lib();
      pptx.layout = "LAYOUT_16x9";
      pptx.rtlMode = true;
      pptx.theme = { headFontFace: FONT, bodyFontFace: FONT, lang: "he-IL" };
      pptx.title = DOSSIER.title_he || "";
      const pages = [];
      pages.push({ draw: slide => { ground(slide, T); titleSlide(slide, T); } });
      top5Page(pages, T);
      sectionPages(pages, T, section("background"), bgRuns, bgMeasure, 1, 7);
      wanted.forEach((m, i) => mapPage(pages, T, m, pngs[i]));
      const importance = section("importance"), meanings = section("meanings");
      const twoUp = s => (s && s.items && s.items.length > 4 ? 2 : 1);
      sectionPages(pages, T, importance, itemRuns, itemMeasure, twoUp(importance), 8);
      sectionPages(pages, T, meanings, itemRuns, itemMeasure, twoUp(meanings), 8);
      sourcePages(pages, T);
      pages.forEach((p, i) => p.draw(pptx.addSlide(), i + 1, pages.length));
      return pptx;
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
        return blob;
      }) : blob)
      .then(blob => ({ blob: blob, fileName: fileName, mime: MIME }));
  }

  function build_(theme) {
    const t = theme === "light" ? "light" : "dark";
    if (typeof DOSSIER === "undefined" || !DOSSIER || !DOSSIER.title_he) {
      return Promise.reject(new Error(NO_DATA));
    }
    const base = (DOSSIER.deck && DOSSIER.deck.filename) || "dossier";
    return loadLib()
      .then(Lib => build(Lib, t))
      .then(pptx => save(pptx, base + "-" + t + ".pptx"))
      .catch(err => {
        const msg = err && err.message;
        if (msg === NO_NET || msg === NO_DATA) throw err;
        console.error("dossier_deck:", err);
        throw new Error(FAILED);
      });
  }

  window.DossierDeck = { build: build_ };
})();
