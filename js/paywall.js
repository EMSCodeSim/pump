/* paywall.js
   FireOps Calc Paywall + Billing bridge (Cordova/Capacitor compatible)

   Goals:
   - Never unlock unless Google Play reports the product as owned.
   - Prefer requestPayment(offer) when available (more reliable on many builds).
   - Provide Restore Purchase flow.
   - Provide a small on-screen debug panel (native only) to see product/offers/owned state.
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
    // fallback for some older builds
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

function safeJson(obj) {
  try { return JSON.stringify(obj, null, 2); } catch (_e) { return String(obj); }
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
  try { document.body.appendChild(el); } catch (_e) {}
  _debugPanelEl = el;
  return el;
}

function showDebug(title, dataObj) {
  try {
    if (!isNativeApp()) return;
    const el = ensureDebugPanel();
    el.textContent = `${title}\n${safeJson(dataObj)}`;
  } catch (_e) {}
}

function getProduct(storeObj, productId = PRO_PRODUCT_ID) {
  try {
    if (storeObj && typeof storeObj.get === "function") return storeObj.get(productId);
  } catch (_e) {}
  return null;
}

function isOwnedProductObj(p) {
  if (!p) return false;
  try {
    if (typeof p.owned === "boolean") return p.owned;
    if (typeof p.isOwned === "function") return !!p.isOwned();
    if (typeof p.state === "string" && p.state.toLowerCase().includes("owned")) return true;
  } catch (_e) {}
  return false;
}

function getDebugSnapshot(storeObj, productId = PRO_PRODUCT_ID) {
  const p = getProduct(storeObj, productId);
  const offers = (p && Array.isArray(p.offers)) ? p.offers : [];
  let offerFromGetOffer = null;
  try { offerFromGetOffer = (p && typeof p.getOffer === "function") ? p.getOffer() : null; } catch (_e) {}

  return {
    native: isNativeApp(),
    hasStore: !!storeObj,
    hasGet: !!(storeObj && typeof storeObj.get === "function"),
    productId,
    productExists: !!p,
    productType: p && p.type ? p.type : null,
    state: p && p.state ? p.state : null,
    owned: p ? isOwnedProductObj(p) : null,
    offersCount: offers.length,
    offer0Id: offers[0] ? (offers[0].id || offers[0].offerId || null) : null,
    getOfferId: offerFromGetOffer ? (offerFromGetOffer.id || offerFromGetOffer.offerId || null) : null,
    lastBillingError: _lastBillingError || "",
    time: new Date().toISOString(),
  };
}

async function waitForOwnership(storeObj, productId = PRO_PRODUCT_ID, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const p = getProduct(storeObj, productId);
    if (isOwnedProductObj(p)) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function refreshOffers(storeObj) {
  if (!storeObj) return;
  try {
    if (typeof storeObj.update === "function") await storeObj.update();
    else if (typeof storeObj.refresh === "function") await storeObj.refresh();
  } catch (e) {
    _lastBillingError = (e && e.message) ? e.message : String(e);
  }
}

export async function initBilling({ verbose = false } = {}) {
  if (!isNativeApp()) return { ok: false, reason: "web" };

  _store = getBillingStore();
  if (!_store) return { ok: false, reason: "no_store" };

  try {
    // Register product if supported (safe no-op on builds without register)
    try {
      if (typeof _store.register === "function" && _store.NON_CONSUMABLE) {
        _store.register({ id: PRO_PRODUCT_ID, type: _store.NON_CONSUMABLE });
      }
    } catch (_e) {}

    if (typeof _store.initialize === "function") {
      await _store.initialize();
    }

    // IMPORTANT: fetch offers/SKUs
    await refreshOffers(_store);

    // If already owned, persist local flag
    if (isOwnedProductObj(getProduct(_store, PRO_PRODUCT_ID))) setProUnlockedLocal();

    if (verbose) showDebug("[billing init]", getDebugSnapshot(_store, PRO_PRODUCT_ID));
    return { ok: true };
  } catch (e) {
    _lastBillingError = (e && e.message) ? e.message : String(e);
    if (verbose) showDebug("[billing init FAILED]", getDebugSnapshot(_store, PRO_PRODUCT_ID));
    return { ok: false, reason: _lastBillingError || "init_failed" };
  }
}

export async function buyProduct(productId = PRO_PRODUCT_ID) {
  if (!isNativeApp()) throw new Error("Purchases only work inside the installed Google Play app (not the website).");

  if (!_store) _store = getBillingStore();
  if (!_store) throw new Error("Billing store not available (CdvPurchase/store missing).");

  // If already owned, unlock
  const alreadyOwned = isOwnedProductObj(getProduct(_store, productId)) || isProUnlocked();
  if (alreadyOwned) {
    setProUnlockedLocal();
    return { ok: true, alreadyOwned: true };
  }

  // Ensure offers are loaded
  await refreshOffers(_store);
  showDebug("[billing pre-purchase]", getDebugSnapshot(_store, productId));

  const product = getProduct(_store, productId);
  if (!product) {
    throw new Error("Product not loaded in billing store (store.get returned null).");
  }

  // Pick an offer
  let offer = null;
  try { offer = (typeof product.getOffer === "function") ? product.getOffer() : null; } catch (_e) {}
  if (!offer) {
    const offers = Array.isArray(product.offers) ? product.offers : [];
    offer = offers.length ? offers[0] : null;
  }

  if (!offer) {
    throw new Error("No purchase offer available (offersCount=0).");
  }

  // Prefer requestPayment(offer)
  try {
    if (typeof _store.requestPayment === "function") {
      await _store.requestPayment(offer);
      const owned = await waitForOwnership(_store, productId);
      showDebug("[billing post-requestPayment]", getDebugSnapshot(_store, productId));
      if (owned) {
        setProUnlockedLocal();
        return { ok: true };
      }
      throw new Error("Purchase did not complete (no ownership detected).");
    }

    // Fallback: order(productId)
    if (typeof _store.order === "function") {
      await _store.order(productId);
      const owned = await waitForOwnership(_store, productId);
      showDebug("[billing post-order]", getDebugSnapshot(_store, productId));
      if (owned) {
        setProUnlockedLocal();
        return { ok: true };
      }
      throw new Error("Purchase did not complete (no ownership detected).");
    }

    throw new Error("Purchase API not found (store.requestPayment/store.order missing).");
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
    } else {
      await refreshOffers(_store);
    }

    const owned = isOwnedProductObj(getProduct(_store, productId));
    showDebug("[billing restore]", getDebugSnapshot(_store, productId));

    if (owned) {
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
   UI (Trial modal + Hard paywall)
--------------------------------------------------------- */

export function renderTrialIntroModal({
  trialDays = 5,
  priceText = "$1.99 one-time",
  onContinue = null,
  onPay = null,
  onRestore = null,
} = {}) {
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

  const body = document.createElement("div");
  body.textContent = `FireOps Calc is free for ${trialDays} days. You can unlock full access anytime with a one-time purchase.`;
  body.style.opacity = "0.95";
  body.style.marginBottom = "10px";
  body.style.lineHeight = "1.35";

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

  const btnRestore = document.createElement("button");
  btnRestore.textContent = "Restore Purchase";
  btnRestore.style.padding = "12px 16px";
  btnRestore.style.borderRadius = "12px";
  btnRestore.style.border = "1px solid rgba(255,255,255,0.14)";
  btnRestore.style.background = "transparent";
  btnRestore.style.color = "#eaf0ff";
  btnRestore.style.fontWeight = "700";

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

  btnRestore.addEventListener("click", async () => {
    if (!onRestore) return;
    const original = btnRestore.textContent;
    btnRestore.disabled = true;
    btnRestore.textContent = "Restoring...";
    try {
      await onRestore();
      try { overlay.remove(); } catch (_e) {}
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      alert("Restore failed: " + msg);
      btnRestore.disabled = false;
      btnRestore.textContent = original;
    }
  });

  row.appendChild(btnContinue);
  if (onRestore) row.appendChild(btnRestore);
  row.appendChild(btnPay);

  card.appendChild(h);
  card.appendChild(body);
  card.appendChild(hint);
  card.appendChild(row);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

export async function renderPaywall({
  priceText = "$1.99 one-time",
  onPay = null,
  onRestore = null,
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

  const body = document.createElement("div");
  body.textContent = `Get full access with a one-time purchase (${priceText}).`;
  body.style.opacity = "0.95";
  body.style.marginBottom = "10px";
  body.style.lineHeight = "1.35";

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

  const btnRestore = document.createElement("button");
  btnRestore.textContent = "Restore Purchase";
  btnRestore.style.padding = "12px 16px";
  btnRestore.style.borderRadius = "12px";
  btnRestore.style.border = "1px solid rgba(255,255,255,0.14)";
  btnRestore.style.background = "transparent";
  btnRestore.style.color = "#eaf0ff";
  btnRestore.style.fontWeight = "700";

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

  btnRestore.addEventListener("click", async () => {
    if (!onRestore) return;
    const original = btnRestore.textContent;
    btnRestore.disabled = true;
    btnRestore.textContent = "Restoring...";
    try {
      await onRestore();
      try { overlay.remove(); } catch (_e) {}
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      alert("Restore failed: " + msg);
      btnRestore.disabled = false;
      btnRestore.textContent = original;
    }
  });

  row.appendChild(btnClose);
  if (onRestore) row.appendChild(btnRestore);
  row.appendChild(btnPay);

  card.appendChild(h);
  card.appendChild(body);
  card.appendChild(hint);
  card.appendChild(row);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}
