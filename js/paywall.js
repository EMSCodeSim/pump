/* paywall.js — Payment test + production-safe
   - Prevent store collision (CdvPurchase.store first)
   - Wait for store.ready() before ordering
   - Provide UI helpers:
       renderTrialIntroModal()
       renderPaywall()
*/

let _billingReady = false;
let _readyPromise = null;
let _readyResolve = null;

let _opts = {
  productId: "fireops.pro",
  debug: false,
  onEntitlementChanged: null, // (isPro:boolean)=>void
  onLog: null,
};

function log(msg) {
  try {
    if (_opts?.debug) console.log("[paywall]", msg);
    if (typeof _opts?.onLog === "function") _opts.onLog(msg);
  } catch (_) {}
}

function looksLikeBillingStore(s) {
  return !!s && (
    typeof s.order === "function" ||
    typeof s.register === "function" ||
    typeof s.when === "function" ||
    typeof s.refresh === "function"
  );
}

function getStore() {
  const s1 = globalThis.CdvPurchase?.store;
  if (looksLikeBillingStore(s1)) return s1;

  const s0 = globalThis.store;
  if (looksLikeBillingStore(s0)) return s0;

  return null;
}

function isNativePlatform() {
  const w = globalThis;

  if (w.cordova) return true;

  const Cap = w.Capacitor;
  if (Cap) {
    try {
      if (typeof Cap.isNativePlatform === "function") return !!Cap.isNativePlatform();
      if (typeof Cap.getPlatform === "function") return Cap.getPlatform() !== "web";
    } catch (_) {}
  }

  // Capacitor WebView often uses http(s)://localhost
  try {
    const h = (w.location?.hostname || "").toLowerCase();
    if (h === "localhost" || h === "127.0.0.1") return true;
  } catch (_) {}

  try {
    const p = (w.location?.protocol || "").toLowerCase();
    if (p === "capacitor:" || p === "ionic:" || p === "file:") return true;
  } catch (_) {}

  return false;
}

function setEntitlement(isPro) {
  try {
    if (typeof _opts?.onEntitlementChanged === "function") {
      _opts.onEntitlementChanged(!!isPro);
    }
  } catch (_) {}
}

function ensureStoreOrExplain() {
  const s = getStore();
  if (!s) {
    const reason =
      "In-app purchases aren’t available in this build.\n\n" +
      "Make sure you're testing the INSTALLED Android app from the Play Store Internal Testing link " +
      "(not the website / not Android Studio debug), and that Play Billing is included.";
    log("Billing store not found.");
    return { ok: false, reason };
  }
  return { ok: true, store: s };
}

function getProduct(pid) {
  const store = getStore();
  if (!store) return null;
  try { return store.get?.(pid) || null; } catch (_) {}
  return null;
}

function isOwned(pid) {
  const store = getStore();
  const p = getProduct(pid);
  if (!store || !p) return false;
  try {
    return !!p.owned || p.state === store.OWNED || p.state === store.APPROVED;
  } catch (_) {}
  return false;
}

function ensureReadyPromise() {
  if (_readyPromise) return;
  _readyPromise = new Promise((resolve) => { _readyResolve = resolve; });
}

async function waitForReady(ms = 6000) {
  if (_billingReady) return true;
  if (!_readyPromise) return false;

  return await Promise.race([
    _readyPromise.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), ms))
  ]);
}

/* ========================= Billing ========================= */

export async function initBilling(options = {}) {
  _opts = { ..._opts, ...options };
  _billingReady = false;
  ensureReadyPromise();

  const chk = ensureStoreOrExplain();
  if (!chk.ok) return false;

  const store = chk.store;
  if (!isNativePlatform()) return false;

  const pid = _opts.productId;

  try {
    log("Registering product: " + pid);
    store.register({ id: pid, type: store.NON_CONSUMABLE });

    if (_opts.debug && store.verbosity != null) store.verbosity = store.DEBUG;

    store.when(pid).updated((p) => {
      const owned = !!p?.owned || p?.state === store.APPROVED || p?.state === store.OWNED;
      log("Product updated. owned=" + owned + " state=" + p?.state);
      if (owned) setEntitlement(true);
    });

    store.when(pid).approved((p) => {
      log("Approved. Finishing.");
      try { p.finish(); } catch (_) {}
      setEntitlement(true);
    });

    store.ready(() => {
      log("Store READY");
      _billingReady = true;
      try { _readyResolve && _readyResolve(); } catch (_) {}
      try { store.refresh(); } catch (_) {}
    });

    // Init / refresh
    try {
      if (typeof store.initialize === "function") store.initialize([store.GOOGLE_PLAY]);
      else store.refresh();
    } catch (e) {
      log("Init error: " + (e?.message || e));
    }

    return true;
  } catch (e) {
    log("initBilling exception: " + (e?.message || e));
    return false;
  }
}

export function canPurchase() {
  if (!isNativePlatform()) return false;
  return !!getStore();
}

export async function buyProduct(productId) {
  const pid = productId || _opts.productId;

  const chk = ensureStoreOrExplain();
  if (!chk.ok) { alert(chk.reason); return { ok: false, error: chk.reason }; }

  if (!isNativePlatform()) {
    const msg = "Purchases only work inside the installed Android app (not the website).";
    alert(msg);
    return { ok: false, error: msg };
  }

  const store = chk.store;

  try {
    // Ensure billing is initialized and READY
    ensureReadyPromise();
    if (!_billingReady) {
      try { store.refresh(); } catch (_) {}
      const ready = await waitForReady(6000);
      if (!ready) {
        throw new Error(
          "Billing not ready yet. (Common causes: installed not from Internal Testing link, " +
          "product not Active, or tester account not set.)"
        );
      }
    }

    if (typeof store.order !== "function") {
      const alt = globalThis.CdvPurchase;
      if (typeof alt?.order === "function") {
        log("Ordering via CdvPurchase.order: " + pid);
        alt.order(pid);
        return { ok: true };
      }
      throw new Error("Billing store present but order() is missing.");
    }

    log("Ordering product: " + pid);
    store.order(pid);
    return { ok: true };
  } catch (e) {
    const msg = e?.message || String(e);
    alert("Purchase failed: " + msg);
    return { ok: false, error: msg };
  }
}

// Returns true/false after refresh
export async function restorePurchases(productId) {
  const pid = productId || _opts.productId;

  const chk = ensureStoreOrExplain();
  if (!chk.ok) { alert(chk.reason); return false; }
  if (!isNativePlatform()) { alert("Restore only works in the installed app."); return false; }

  const store = chk.store;

  try {
    ensureReadyPromise();
    try { store.refresh(); } catch (_) {}

    // wait for ready + refresh callbacks
    await waitForReady(3000);

    const ok = await new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (isOwned(pid)) return resolve(true);
        if (Date.now() - start > 3500) return resolve(false);
        setTimeout(tick, 150);
      };
      tick();
    });

    if (ok) setEntitlement(true);
    return ok;
  } catch (e) {
    alert("Restore failed: " + (e?.message || String(e)));
    return false;
  }
}

/* ========================= UI Helpers ========================= */

let _modalEl = null;

function ensureStyles() {
  if (document.getElementById("fireops-paywall-styles")) return;
  const css = `
  .fo-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; z-index:99999; padding:18px; }
  .fo-card{ width:min(520px,96vw); background:#111827; color:#fff; border:1px solid rgba(255,255,255,.12); border-radius:16px; box-shadow:0 20px 70px rgba(0,0,0,.45); padding:16px; }
  .fo-title{ font-size:18px; font-weight:900; margin:0 0 6px; }
  .fo-sub{ opacity:.88; line-height:1.35; margin:0 0 12px; }
  .fo-bullets{ margin:0 0 12px; padding-left:18px; opacity:.92; }
  .fo-row{ display:flex; gap:10px; flex-wrap:wrap; }
  .fo-btn{ border-radius:12px; padding:12px 14px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.08); color:#fff; font-weight:900; cursor:pointer; }
  .fo-btn.primary{ background:#2563eb; border-color:#2563eb; }
  .fo-btn.ghost{ background:transparent; }
  .fo-note{ margin-top:10px; font-size:12px; opacity:.7; }
  .fo-divider{ height:1px; background:rgba(255,255,255,.12); margin:12px 0; }
  `;
  const style = document.createElement("style");
  style.id = "fireops-paywall-styles";
  style.textContent = css;
  document.head.appendChild(style);
}

function closeModal() {
  if (_modalEl && _modalEl.parentNode) _modalEl.parentNode.removeChild(_modalEl);
  _modalEl = null;
}

export function renderTrialIntroModal(opts = {}) {
  ensureStyles();
  closeModal();

  const trialDays = Number(opts.trialDays || 5);
  const priceText = opts.priceText || "$1.99 one-time";

  const overlay = document.createElement("div");
  overlay.className = "fo-overlay";

  const card = document.createElement("div");
  card.className = "fo-card";
  card.innerHTML = `
    <div class="fo-title">Risk-Free ${trialDays}-Day Trial</div>
    <div class="fo-sub">
      Use <b>all features</b> for ${trialDays} days. After that, unlock Pro to keep using FireOps Calc.
    </div>
    <ul class="fo-bullets">
      <li>No subscription</li>
      <li>One-time unlock: <b>${priceText}</b></li>
      <li>Restore works if you reinstall</li>
    </ul>
    <div class="fo-row">
      <button class="fo-btn ghost" id="fo-continue">Continue Trial</button>
      <button class="fo-btn primary" id="fo-buynow">Pay Now</button>
    </div>
    <div class="fo-note" id="fo-status">Ready: <span style="opacity:.85">${_billingReady ? "YES" : "NO"}</span></div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  _modalEl = overlay;

  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

  card.querySelector("#fo-continue")?.addEventListener("click", () => {
    closeModal();
    try { opts.onContinue?.(); } catch (_) {}
  });

  card.querySelector("#fo-buynow")?.addEventListener("click", async () => {
    // IMPORTANT: do NOT auto-close. Only close if the user taps outside or hits Continue.
    try {
      const statusEl = card.querySelector("#fo-status");
      if (statusEl) statusEl.innerHTML = 'Starting purchase…';

      if (opts.onBuyNow) await opts.onBuyNow();
      else await buyProduct(_opts.productId);

      // leave modal open; purchase sheet should appear
      if (statusEl) statusEl.innerHTML = 'If the purchase sheet didn’t open, billing may not be ready.';
    } catch (e) {
      const statusEl = card.querySelector("#fo-status");
      if (statusEl) statusEl.innerHTML = 'Error: ' + (e?.message || String(e));
      // keep modal open so you can read the error
    }
  });
}

export async function renderPaywall(mountEl, opts = {}) {
  ensureStyles();

  const trialDays = Number(opts.trialDays || 5);
  const priceText = opts.priceText || "$1.99 one-time";
  const productId = opts.productId || _opts.productId;

  if (!mountEl) return;

  mountEl.innerHTML = `
    <div class="fo-card" style="margin:16px auto; max-width:560px;">
      <div class="fo-title">Unlock Pro</div>
      <div class="fo-sub">
        Full paywall screen (trial ended after ${trialDays} days).
      </div>
      <div class="fo-divider"></div>
      <div class="fo-sub" style="margin-bottom:10px;">
        <b>${priceText}</b> • one-time purchase • no subscription
      </div>
      <div class="fo-row">
        <button class="fo-btn primary" id="fo-paywall-buy">Pay Now</button>
        <button class="fo-btn" id="fo-paywall-restore">Restore</button>
      </div>
      <div class="fo-note">Product: <span style="opacity:.85">${productId}</span></div>
    </div>
  `;

  mountEl.querySelector("#fo-paywall-buy")?.addEventListener("click", async () => {
    try {
      if (typeof opts.onPurchase === "function") await opts.onPurchase();
      else await buyProduct(productId);
    } catch (e) {
      alert(e?.message || String(e));
    }
  });

  mountEl.querySelector("#fo-paywall-restore")?.addEventListener("click", async () => {
    try {
      if (typeof opts.onRestore === "function") await opts.onRestore();
      else {
        const ok = await restorePurchases(productId);
        if (!ok) alert("No purchase found for this account.");
      }
    } catch (e) {
      alert(e?.message || String(e));
    }
  });
}
