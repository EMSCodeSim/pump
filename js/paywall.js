// js/paywall.js
// Safe on web (does nothing) and only enables purchases on native builds.
// Works with cordova-plugin-purchase v13+ where ordering may require an Offer.

const PRODUCT_ID_UNLOCK = "fireopscalc_unlock_199"; // <-- make sure this EXACTLY matches Play Console product id

function isNativeApp() {
  // Capacitor: native builds use capacitor:// or file://
  const proto = (window.location && window.location.protocol) ? window.location.protocol : "";
  return proto === "capacitor:" || proto === "file:";
}

function log(...args) {
  // keep logs in native debugging; harmless on web
  try { console.log("[paywall]", ...args); } catch {}
}

function safeStr(err) {
  try { return (err && (err.message || err.toString())) || String(err); } catch { return "Unknown error"; }
}

function getStore() {
  // cordova-plugin-purchase typically exposes window.CdvPurchase
  return window.CdvPurchase && window.CdvPurchase.store ? window.CdvPurchase.store : null;
}

function getPlatformInfo() {
  return {
    proto: (window.location && window.location.protocol) || "",
    hasCdvPurchase: !!window.CdvPurchase,
    hasStore: !!getStore(),
    userAgent: navigator.userAgent
  };
}

/**
 * Initialize billing (native only). Safe to call on web.
 * Returns { ok:boolean, reason?:string }
 */
export async function initBilling({ debug = false } = {}) {
  if (!isNativeApp()) {
    if (debug) log("initBilling skipped (web)", getPlatformInfo());
    return { ok: false, reason: "web" };
  }

  // Wait for cordova deviceready if it exists (capacitor + cordova plugin case)
  await waitForDeviceReady(4000);

  const store = getStore();
  if (!store) {
    log("No purchase store found", getPlatformInfo());
    return { ok: false, reason: "no_store" };
  }

  try {
    // Verbosity in v13+
    try { store.verbosity = store.DEBUG; } catch {}

    // Register product (works in most versions)
    try {
      store.register([
        {
          id: PRODUCT_ID_UNLOCK,
          type: window.CdvPurchase?.ProductType?.NON_CONSUMABLE || "non consumable",
        }
      ]);
    } catch (e) {
      // Some versions use store.register({id,type})
      try {
        store.register({
          id: PRODUCT_ID_UNLOCK,
          type: window.CdvPurchase?.ProductType?.NON_CONSUMABLE || "non consumable",
        });
      } catch (e2) {
        log("register failed (continuing)", safeStr(e2));
      }
    }

    // When approved/owned, mark unlocked
    store.when(PRODUCT_ID_UNLOCK).approved((p) => {
      try {
        log("approved", p?.id);
        setUnlocked(true);
        try { p.finish(); } catch {}
        try { store.refresh(); } catch {}
      } catch (e) {
        log("approved handler error", safeStr(e));
      }
    });

    store.when(PRODUCT_ID_UNLOCK).verified(() => {
      try {
        log("verified");
        setUnlocked(true);
      } catch {}
    });

    store.error((err) => {
      log("store error", safeStr(err));
    });

    // Initialize / refresh
    try {
      if (typeof store.initialize === "function") {
        // v13 uses initialize(platforms)
        await store.initialize([store.PLATFORM_GOOGLE_PLAY, store.PLATFORM_APPLE_APPSTORE].filter(Boolean));
      }
    } catch (e) {
      log("store.initialize failed (continuing)", safeStr(e));
    }

    try { store.refresh(); } catch {}

    if (debug) log("initBilling complete", getPlatformInfo());
    return { ok: true };
  } catch (e) {
    log("initBilling failed", safeStr(e));
    return { ok: false, reason: safeStr(e) };
  }
}

export function isUnlocked() {
  return localStorage.getItem("fireopscalc_unlocked") === "1";
}

export function setUnlocked(v) {
  try {
    localStorage.setItem("fireopscalc_unlocked", v ? "1" : "0");
  } catch {}
}

/**
 * Decide whether to block the app after trial expires.
 * Safe on web.
 */
export function shouldBlockWithPaywall({ trialDays = 5 } = {}) {
  // Web: never block (you said desktop/web should stay free for edits)
  if (!isNativeApp()) return false;

  // If unlocked, never block
  if (isUnlocked()) return false;

  const key = "fireopscalc_first_run_ts";
  let first = Number(localStorage.getItem(key) || "0");
  if (!first) {
    first = Date.now();
    try { localStorage.setItem(key, String(first)); } catch {}
  }
  const elapsedDays = (Date.now() - first) / (1000 * 60 * 60 * 24);
  return elapsedDays >= trialDays;
}

/**
 * Show the 5-day trial intro modal (native only).
 * Includes "Unlock Now" and "Continue Free Trial".
 */
export function showTrialIntroModal({ priceText = "$1.99", onClose } = {}) {
  // Never show this on web
  if (!isNativeApp()) return;

  // Only show once per install
  const seenKey = "fireopscalc_trial_modal_seen";
  if (localStorage.getItem(seenKey) === "1") return;
  localStorage.setItem(seenKey, "1");

  const wrap = document.createElement("div");
  wrap.style.position = "fixed";
  wrap.style.inset = "0";
  wrap.style.zIndex = "9999";
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.justifyContent = "center";
  wrap.style.padding = "18px";
  wrap.style.background = "rgba(0,0,0,0.55)";

  const card = document.createElement("div");
  card.style.width = "min(520px, 100%)";
  card.style.borderRadius = "18px";
  card.style.padding = "18px";
  card.style.background = "#0b1320";
  card.style.border = "1px solid rgba(255,255,255,0.12)";
  card.style.boxShadow = "0 18px 60px rgba(0,0,0,0.5)";
  card.style.color = "#e8f0ff";

  const title = document.createElement("div");
  title.textContent = "5-Day Free Trial — No Risk";
  title.style.fontSize = "22px";
  title.style.fontWeight = "800";
  title.style.marginBottom = "10px";

  const p1 = document.createElement("div");
  p1.textContent = "FireOps Calc is free to use for the next 5 days.";
  p1.style.opacity = "0.9";
  p1.style.marginBottom = "10px";

  const p2 = document.createElement("div");
  p2.textContent = `After the trial, you can unlock the app with a one-time ${priceText} purchase — no subscription, no auto-billing.`;
  p2.style.opacity = "0.9";
  p2.style.marginBottom = "12px";

  const note = document.createElement("div");
  note.textContent = "Purchases only work when installed from Google Play / App Store (Internal/Closed/Production). Not sideloaded.";
  note.style.fontSize = "12px";
  note.style.opacity = "0.75";
  note.style.marginBottom = "12px";

  const errorBox = document.createElement("div");
  errorBox.style.display = "none";
  errorBox.style.marginTop = "10px";
  errorBox.style.padding = "10px";
  errorBox.style.borderRadius = "12px";
  errorBox.style.border = "1px solid rgba(255,80,80,0.35)";
  errorBox.style.background = "rgba(255,80,80,0.10)";
  errorBox.style.color = "#ffd0d0";
  errorBox.style.fontWeight = "700";

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  }

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "10px";
  row.style.marginTop = "12px";

  const btnTrial = document.createElement("button");
  btnTrial.textContent = "Continue Free Trial";
  btnTrial.style.flex = "1";
  btnTrial.style.padding = "12px 14px";
  btnTrial.style.borderRadius = "14px";
  btnTrial.style.border = "1px solid rgba(255,255,255,0.18)";
  btnTrial.style.background = "transparent";
  btnTrial.style.color = "#e8f0ff";
  btnTrial.style.fontWeight = "800";

  const btnBuy = document.createElement("button");
  btnBuy.textContent = `Unlock Now — ${priceText} one-time`;
  btnBuy.style.flex = "1";
  btnBuy.style.padding = "12px 14px";
  btnBuy.style.borderRadius = "14px";
  btnBuy.style.border = "0";
  btnBuy.style.background = "#2a77ff";
  btnBuy.style.color = "white";
  btnBuy.style.fontWeight = "900";

  btnTrial.onclick = () => {
    try { document.body.removeChild(wrap); } catch {}
    if (typeof onClose === "function") onClose();
  };

  btnBuy.onclick = async () => {
    try {
      btnBuy.disabled = true;
      btnBuy.style.opacity = "0.75";
      await startPurchaseFlow();
      // If it succeeded, modal can close
      if (isUnlocked()) {
        try { document.body.removeChild(wrap); } catch {}
        if (typeof onClose === "function") onClose();
      } else {
        showError("Purchase did not complete (not unlocked yet).");
      }
    } catch (e) {
      showError("Purchase failed: " + safeStr(e));
    } finally {
      btnBuy.disabled = false;
      btnBuy.style.opacity = "1";
    }
  };

  card.appendChild(title);
  card.appendChild(p1);
  card.appendChild(p2);
  card.appendChild(note);
  row.appendChild(btnTrial);
  row.appendChild(btnBuy);
  card.appendChild(row);
  card.appendChild(errorBox);
  wrap.appendChild(card);

  document.body.appendChild(wrap);
}

/**
 * Purchase flow that supports both:
 * - store.order(PRODUCT_ID)
 * - store.order(offer)
 */
export async function startPurchaseFlow() {
  if (!isNativeApp()) throw new Error("Not running as a native app (web cannot purchase).");

  await waitForDeviceReady(4000);

  const store = getStore();
  if (!store) throw new Error("No purchase store found (CdvPurchase.store missing).");

  // Try init if needed
  try {
    if (typeof store.refresh === "function") store.refresh();
  } catch {}

  // 1) Old-style: store.order(productId)
  if (typeof store.order === "function") {
    try {
      log("Trying store.order(productId)...");
      const res = await store.order(PRODUCT_ID_UNLOCK);
      return res;
    } catch (e) {
      log("store.order(productId) failed, trying offer-based flow...", safeStr(e));
      // fall through to offer-based attempt
    }
  }

  // 2) New-style: order an Offer
  // Get product and its default offer
  const product = typeof store.get === "function" ? store.get(PRODUCT_ID_UNLOCK) : null;
  if (!product) {
    throw new Error("Product not found in store. Check product id and that it is active in Play Console.");
  }

  const offer =
    (typeof product.getOffer === "function" && product.getOffer()) ||
    (product.offers && product.offers[0]) ||
    null;

  if (!offer) {
    throw new Error("No offer found for product (expected product.getOffer() or product.offers[0]).");
  }

  if (typeof store.order !== "function") {
    throw new Error("No purchase method found (expected store.order()).");
  }

  log("Trying store.order(offer)...");
  return await store.order(offer);
}

/**
 * Restore purchases (useful on iOS especially)
 */
export async function restorePurchases() {
  if (!isNativeApp()) return;
  await waitForDeviceReady(4000);
  const store = getStore();
  if (!store) return;
  try { store.refresh(); } catch {}
}

async function waitForDeviceReady(timeoutMs = 3000) {
  // If cordova exists, wait for deviceready once.
  if (!window.cordova) return;

  if (window.__fireopscalc_deviceready) return;

  await new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      window.__fireopscalc_deviceready = true;
      resolve();
    }, timeoutMs);

    document.addEventListener("deviceready", () => {
      if (done) return;
      done = true;
      clearTimeout(t);
      window.__fireopscalc_deviceready = true;
      resolve();
    }, { once: true });
  });
}
