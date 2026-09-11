/* The password gate — PUBLIC copy only.

   Ziv, 2026-09-05: "I want to add a password to the dashboard." The public site
   is static files on GitHub Pages, which cannot check a password for us, so the
   protection has to be real without a server: publish.py encrypts data.js and
   brief.js together into bundle.js (AES-256-GCM, key derived from the password
   with PBKDF2), and this file asks for the password, derives the same key in the
   browser, decrypts, and only THEN loads the rest of the board's scripts. Nothing
   readable about the attacks or the briefs reaches the phone before that.

   The home copy never loads this file, and window.__LOCKED__ exists only on the
   published page — so at home this is a no-op even if it were included.

   "Once per device": after a successful unlock the derived key (never the
   password) is kept in localStorage, so the next visit on that phone or laptop
   opens without asking. A changed password makes the stored key fail to decrypt,
   which clears it and asks again.

   Plain script, no modules (file:// and load-order rules of this board). The
   locked scripts are re-created in document order, one after the other, because
   every one of them initialises itself at execution and expects the one before
   it to have run. */
"use strict";

(function () {
  const lock = window.__LOCKED__;
  if (!lock) return;

  const KEY_STORE = "osint.unlock.key";
  const ITERATIONS = lock.iter || 200000;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function fromB64(text) {
    const bin = atob(text);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function toB64(bytes) {
    let s = "";
    bytes.forEach((b) => { s += String.fromCharCode(b); });
    return btoa(s);
  }

  async function deriveKey(password) {
    const base = await crypto.subtle.importKey(
      "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: fromB64(lock.salt),
        iterations: ITERATIONS },
      base, 256);
    return new Uint8Array(bits);
  }

  async function decryptWith(raw) {
    const key = await crypto.subtle.importKey(
      "raw", raw, "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(lock.iv) }, key, fromB64(lock.ct));
    return dec.decode(plain);
  }

  /* The decrypted text is the LOCKED files verbatim (data.js, brief.js,
     dossier_data.js — `const DATA`, `const BRIEF`, `const DOSSIER`), run as ONE
     inline classic script so those stay the same global bindings every other
     file reads by bare name. One syntax error in any of them kills all three,
     which is why every emitter writes pure json.dumps output. */
  function runData(text) {
    const s = document.createElement("script");
    s.textContent = text;
    document.head.appendChild(s);
    s.remove();
  }

  function loadLocked() {
    const tags = Array.from(document.querySelectorAll("script[data-locked-src]"));
    return tags.reduce((chain, tag) => chain.then(() => new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = tag.dataset.lockedSrc;
      s.onload = ok;
      s.onerror = () => fail(new Error("failed to load " + s.src));
      document.body.appendChild(s);
    })), Promise.resolve());
  }

  /* ---- the screen ---- */
  let overlay, input, button, error;

  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.className = "unlock";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-labelledby", "unlock-title");
    overlay.innerHTML =
      '<form class="unlock-card" id="unlock-form">' +
      '<h2 id="unlock-title">הלוח מוגן בסיסמה</h2>' +
      '<label class="unlock-label" for="unlock-pw">סיסמה</label>' +
      '<input class="unlock-input" id="unlock-pw" type="password"' +
      ' autocomplete="current-password" autocapitalize="off" spellcheck="false" required>' +
      '<button class="unlock-btn" type="submit">פתיחה</button>' +
      '<p class="unlock-err" id="unlock-err" hidden>הסיסמה שגויה.</p>' +
      "</form>";
    document.body.appendChild(overlay);
    input = overlay.querySelector("#unlock-pw");
    button = overlay.querySelector(".unlock-btn");
    error = overlay.querySelector("#unlock-err");
    overlay.querySelector("#unlock-form").addEventListener("submit", onSubmit);
  }

  function busy(on) {
    button.disabled = on;
    input.disabled = on;
    button.textContent = on ? "בודק…" : "פתיחה";
  }

  async function open(raw, remember) {
    const text = await decryptWith(raw);   // throws on a wrong key
    runData(text);
    await loadLocked();
    if (remember) {
      try { localStorage.setItem(KEY_STORE, toB64(raw)); } catch (e) { /* private mode */ }
    }
    overlay.remove();
  }

  async function onSubmit(event) {
    event.preventDefault();
    error.hidden = true;
    busy(true);
    try {
      await open(await deriveKey(input.value), true);
    } catch (e) {
      busy(false);
      input.value = "";
      error.hidden = false;
      input.focus();
    }
  }

  async function init() {
    buildOverlay();
    let stored = null;
    try { stored = localStorage.getItem(KEY_STORE); } catch (e) { stored = null; }
    if (stored) {
      busy(true);
      try {
        await open(fromB64(stored), false);
        return;
      } catch (e) {
        try { localStorage.removeItem(KEY_STORE); } catch (e2) { /* ignore */ }
        busy(false);
      }
    }
    input.focus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
