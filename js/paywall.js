/* paywall.js
   FireOps Calc Paywall + Billing bridge (Cordova/Capacitor compatible)
   - Avoids collision with your app's own "store" (window.store)
   - Prefers cordova-plugin-purchase v13+ (window.CdvPurchase.store)
   - Adds debug overlay so we can SEE product/offers/owned state on device
*/

const PRO_PRODUCT_ID = "fireops.pro";
const KEY_PRO_UNLOCKED = "fireops_pro_unlocked_v1";

let _store = null;
let _debugPanelEl = null;
let _lastBillingError = "";

function isNativeApp() {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch (_e) {
    return false;
  }
}

function getBillingStore() {
  try {
    // cordova-plugin-purchase v13+
    if (window.CdvPurchase && window.CdvPurchase.store) return window.CdvPurchase.store;

    // fallback (some older builds)
    if (window.store) return window.store;

    return null;
  } catch (_e) {
    return null;
  }
}

function setProUnlockedLocal() {
  try { localStorage.setItem(KEY_PRO_UNLOCKED, "1"); } catch (_e) {}
}

export function isProUnlocked() {
  try { return localStorage.getItem(KEY_PRO_UNLOCKED) === "1"; } catch (_e) { return false; }
}

function getProductOwned(storeObj, productId = PRO_PRODUCT_ID) {
  try {
    const p = storeObj && typeof storeObj.get === "function" ? storeObj.get(productId) : null;
    if (!p) return false;

    if (typeof p.owned === "boolean") return p.owned;
    if (typeof p.isOwned === "function") return !!p.isOwned();

    // Some builds expose a string state
    if (typeof p.state === "string" && p.state.toLowerCase().includes("owned")) return true;

    return false;
  } catch (_e) {
    return false;
  }
}

function getProductDebug(storeObj, productId = PRO_PRODUCT_ID) {
  let p = null;
  try {
    p = storeObj && typeof storeObj.get === "function" ? storeObj.get(productId) : null;
  } catch (_e) {}

  const offers = (p && Array.isArray(p.offers)) ? p.offers : [];
  const offer0 = offers.length ? offers[0] : null;

  let offerFromGetOffer = null;
  try {
    offerFromGetOffer = (p && typeof p.getOffer === "function") ? p.getOffer() : null;
  } catch (_e) {}

  return {
    hasStore: !!storeObj,
    hasGet: !!(storeObj && typeof storeObj.get === "function"),
    productId,
    productExists: !!p,
    productType: p && p.type ? p.type : null,
    state: p && p.state ? p.state : null,
    owned: p && typeof p.owned === "boolean" ? p.owned : null,
    offersCount: offers.length,
    offer0: offer0 ? { id: offer0.id || offer0.offerId || null, pricingPhases: offer0.pricingPhases || null } : null,
    offerFromGetOffer: offerFromGetOffer ? { id: offerFromGetOffer.id || offerFromGetOffer.offerId || null } : null,
    lastBillingError: _lastBillingError || "",
    native: isNativeApp(),
    time: new Date().toISOString(),
  };
}

function ensureDebugPanel() {
  if (_debugPanelEl) return _debugPanelEl;

  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.left = "10px";
  el.style.right = "10px";
  el.style.bottom = "10px";
  el.style.zIndex = "999999";
  el.style.padding = "10px";
  el.style.borderRadius = "12px";
  el.style.background = "rgba(0,0,0,0.75)";
  el.style.color = "#fff";
  el.style.fontSize = "12px";
  el.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  el.style.whiteSpace = "pre-wrap";
  el.style.maxHeight = "35vh";
  el.style.overflow = "auto";
  el.textContent = "[billing debug]\n(init...)";

  document.body.appendChild(el);
  _debugPanelEl = el;
  return el;
}

function showBillingDebugPanel(text) {
  try {
    const el = ensureDebugPanel();
    el.textContent = text;
  } catch (_e) {}
}

async function waitForOwnership(storeObj, productId = PRO_PRODUCT_ID, timeoutMs = 45000) {
  const startTs = Date.now();
  while (Date.now() - startTs < timeoutMs) {
    try {
      if (getProductOwned(storeObj, productId)) return true;
    } catch (_e) {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

export async function initBilling({ verbose = false } = {}) {
  if (!isNativeApp()) return { ok: false, reason: "web" };

  _store = getBillingStore();
  if (!_store) return { ok: false, reason: "no_store" };

  try {
    // Try to register product if the plugin supports it (safe no-op if not)
    try {
      if (typeof _store.register === "function" && _store.NON_CONSUMABLE) {
        _store.register({ id: PRO_PRODUCT_ID, type: _store.NON_CONSUMABLE });
      }
    } catch (_e) {}

    // Initialize / refresh
    if (typeof _store.initialize === "function") {
      await _store.initialize();
    }

    // IMPORTANT: many builds require update() to fetch offers
    try {
      if (typeof _store.update === "function") await _store.update();
      else if (typeof _store.refresh === "function") await _store.refresh();
    } catch (e) {
      _lastBillingError = (e && e.message) ? e.message : String(e);
    }

    if (getProductOwned(_store, PRO_PRODUCT_ID)) setProUnlockedLocal();

    if (verbose) {
      const d = getProductDebug(_store, PRO_PRODUCT_ID);
      showBillingDebugPanel("[billing debug init]\n" + JSON.stringify(d, null, 2));
    }

    return { ok: true };
  } catch (e) {
    _lastBillingError = (e && e.message) ? e.message : String(e);
    if (verbose) {
      const d = getProductDebug(_store, PRO_PRODUCT_ID);
      showBillingDebugPanel("[billing debug init FAILED]\n" + JSON.stringify(d, null, 2));
    }
    return { ok: false, reason: _lastBillingError || "init_failed" };
  }
}

export async function buyProduct(productId = PRO_PRODUCT_ID) {
  if (!isNativeApp()) {
    throw new Error("Purchases only work inside the installed Google Play app (not the website).");
  }

  if (!_store) _store = getBillingStore();
  if (!_store) throw new Error("Billing store not available (CdvPurchase/store missing).");

  // If already owned, unlock immediately
  if (getProductOwned(_store, productId) || isProUnlocked()) {
    setProUnlockedLocal();
    return { ok: true, alreadyOwned: true };
  }

  // Ensure product/offers are loaded before attempting purchase
  try {
    if (typeof _store.update === "function") await _store.update();
    else if (typeof _store.refresh === "function") await _store.refresh();
  } catch (e) {
    _lastBillingError = (e && e.message) ? e.message : String(e);
  }

  // Debug snapshot pre-purchase
  try {
    const d = getProductDebug(_store, productId);
    showBillingDebugPanel("[billing debug pre-purchase]\n" + JSON.stringify(d, null, 2));
  } catch (_e) {}

  // Attempt purchase across plugin API variants
  try {
    // Prefer v13+ requestPayment flow when available (it reliably triggers the Play purchase sheet)
    const p = typeof _store.get === "function" ? _store.get(productId) : null;
    const offers = p && Array.isArray(p.offers) ? p.offers : [];
    const offer = (p && typeof p.getOffer === "function") ? p.getOffer() : (offers.length ? offers[0] : null);

    if (!p) {
      const d = getProductDebug(_store, productId);
      throw new Error("Product not loaded in billing store. " + JSON.stringify(d));
    }
    if (!offer) {
      const d = getProductDebug(_store, productId);
      throw new Error("No purchase offer available for this product. " + JSON.stringify(d));
    }

    if (typeof _store.requestPayment === "function") {
      await _store.requestPayment(offer || p || productId);
      const owned = await waitForOwnership(_store, productId);
      if (owned) {
        setProUnlockedLocal();
        return { ok: true };
      }
      throw new Error("Purchase did not complete (no ownership detected).");
    }

    // Fallback: store.order(productId)
    if (typeof _store.order === "function") {
      await _store.order(productId);
      const owned = await waitForOwnership(_store, productId);
      if (owned) {
        setProUnlockedLocal();
        return { ok: true };
      }
      throw new Error("Purchase did not complete (no ownership detected).");
    }

    throw new Error("Purchase API not found (store.order/requestPayment missing).");
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    throw new Error(msg);
  }
}

export async function restorePurchases(productId = PRO_PRODUCT_ID) {
  if (!isNativeApp()) return { ok: false, reason: "web" };
  if (!_store) _store = getBillingStore();
  if (!_store) return { ok: false, reason: "no_store" };

  try {
    if (typeof _store.restorePurchases === "function") {
      await _store.restorePurchases();
    } else if (typeof _store.update === "function") {
      await _store.update();
    } else if (typeof _store.refresh === "function") {
      await _store.refresh();
    }

    if (getProductOwned(_store, productId)) {
      setProUnlockedLocal();
      return { ok: true, restored: true };
    }
    return { ok: true, restored: false };
  } catch (e) {
    const reason = e && e.message ? e.message : String(e);
    return { ok: false, reason };
  }
}

/* ---------------------------------------------------------
   UI HELPERS (Trial modal + Hard paywall)
--------------------------------------------------------- */

// Trial modal (supports onPay or onBuyNow)
export function renderTrialIntroModal({
  trialDays = 5,
  priceText = "$1.99 one-time",
  onContinue = null,
  onPay = null,
  onBuyNow = null,
} = {}) {
  const _onPay = onPay || onBuyNow;

  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "99999";
  overlay.style.background = "rgba(0,0,0,0.55)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "14px";

  const card = document.createElement("div");
  card.style.width = "min(520px, 92vw)";
  card.style.borderRadius = "16px";
  card.style.background = "#0b1220";
  card.style.color = "#eaf0ff";
  card.style.boxShadow = "0 12px 40px rgba(0,0,0,0.45)";
  card.style.padding = "18px";

  const h = document.createElement("div");
  h.textContent = `${trialDays}-Day Free Trial — No Risk`;
  h.style.fontSize = "22px";
  h.style.fontWeight = "800";
  h.style.marginBottom = "10px";

  const p = document.createElement("div");
  p.textContent = `FireOps Calc is free for ${trialDays} days. You can unlock full access anytime with a one-time purchase.`;
  p.style.opacity = "0.95";
  p.style.marginBottom = "12px";
  p.style.lineHeight = "1.35";

  const hint = document.createElement("div");
  hint.textContent = "If the purchase sheet doesn’t open, billing may not be ready yet.";
  hint.style.opacity = "0.6";
  hint.style.fontSize = "12px";
  hint.style.marginBottom = "16px";

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "12px";
  row.style.justifyContent = "flex-end";
  row.style.flexWrap = "wrap";

  const btnContinue = document.createElement("button");
  btnContinue.textContent = "Continue Free Trial";
  btnContinue.style.padding = "12px 16px";
  btnContinue.style.borderRadius = "12px";
  btnContinue.style.border = "1px solid rgba(255,255,255,0.14)";
  btnContinue.style.background = "transparent";
  btnContinue.style.color = "#eaf0ff";
  btnContinue.style.fontWeight = "700";

  const btnPay = document.createElement("button");
  btnPay.textContent = `Pay Now — ${priceText}`;
  btnPay.style.padding = "12px 18px";
  btnPay.style.borderRadius = "12px";
  btnPay.style.border = "0";
  btnPay.style.background = "#2d6cff";
  btnPay.style.color = "white";
  btnPay.style.fontWeight = "900";

  btnContinue.addEventListener("click", () => {
    try { overlay.remove(); } catch (_e) {}
    try { onContinue && onContinue(); } catch (_e) {}
  });

  btnPay.addEventListener("click", async () => {
    if (!_onPay) return;

    const original = btnPay.textContent;
    btnPay.disabled = true;
    btnPay.textContent = "Opening purchase...";
    try {
      await _onPay();
      try { overlay.remove(); } catch (_e) {}
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      alert("Purchase failed: " + msg);
      btnPay.disabled = false;
      btnPay.textContent = original;
    }
  });

  row.appendChild(btnContinue);
  row.appendChild(btnPay);

  card.appendChild(h);
  card.appendChild(p);
  card.appendChild(hint);
  card.appendChild(row);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

export async function renderPaywall({
  priceText = "$1.99 one-time",
  onPay = null,
  onClose = null,
} = {}) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "99999";
  overlay.style.background = "rgba(0,0,0,0.65)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "14px";

  const card = document.createElement("div");
  card.style.width = "min(560px, 92vw)";
  card.style.borderRadius = "16px";
  card.style.background = "#0b1220";
  card.style.color = "#eaf0ff";
  card.style.boxShadow = "0 12px 40px rgba(0,0,0,0.45)";
  card.style.padding = "18px";

  const h = document.createElement("div");
  h.textContent = "Unlock Pro";
  h.style.fontSize = "22px";
  h.style.fontWeight = "900";
  h.style.marginBottom = "10px";

  const p = document.createElement("div");
  p.textContent = `Get full access with a one-time purchase (${priceText}).`;
  p.style.opacity = "0.95";
  p.style.marginBottom = "10px";
  p.style.lineHeight = "1.35";

  const hint = document.createElement("div");
  hint.textContent = "If the purchase sheet doesn’t open, billing may not be ready yet.";
  hint.style.opacity = "0.6";
  hint.style.fontSize = "12px";
  hint.style.marginBottom = "16px";

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "12px";
  row.style.justifyContent = "flex-end";
  row.style.flexWrap = "wrap";

  const btnClose = document.createElement("button");
  btnClose.textContent = "Not now";
  btnClose.style.padding = "12px 16px";
  btnClose.style.borderRadius = "12px";
  btnClose.style.border = "1px solid rgba(255,255,255,0.14)";
  btnClose.style.background = "transparent";
  btnClose.style.color = "#eaf0ff";
  btnClose.style.fontWeight = "700";

  const btnPay = document.createElement("button");
  btnPay.textContent = `Pay Now — ${priceText}`;
  btnPay.style.padding = "12px 18px";
  btnPay.style.borderRadius = "12px";
  btnPay.style.border = "0";
  btnPay.style.background = "#2d6cff";
  btnPay.style.color = "white";
  btnPay.style.fontWeight = "900";

  btnClose.addEventListener("click", () => {
    try { overlay.remove(); } catch (_e) {}
    try { onClose && onClose(); } catch (_e) {}
  });

  btnPay.addEventListener("click", async () => {
    if (!onPay) return;

    const original = btnPay.textContent;
    btnPay.disabled = true;
    btnPay.textContent = "Opening purchase...";
    try {
      await onPay();
      try { overlay.remove(); } catch (_e) {}
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      alert("Purchase failed: " + msg);
      btnPay.disabled = false;
      btnPay.textContent = original;
    }
  });

  row.appendChild(btnClose);
  row.appendChild(btnPay);

  card.appendChild(h);
  card.appendChild(p);
  card.appendChild(hint);
  card.appendChild(row);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}
