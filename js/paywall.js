/* paywall.js
   FireOps Calc Paywall + Billing bridge (Cordova/Capacitor compatible)

   FIX: Ensure product is registered + initialized for GOOGLE_PLAY platform so offers load
   (prevents productExists:false / offersCount:0).
*/

const PRO_PRODUCT_ID = "fireops.pro";
const KEY_PRO_UNLOCKED = "fireops_pro_unlocked_v1";

let _store = null;
let _debugPanelEl = null;
let _lastBillingError = "";

function isNativeApp() {
  try {
    if (window?.Capacitor?.isNativePlatform) return !!window.Capacitor.isNativePlatform();
  } catch (_e) {}
  return !!window.cordova;
}

function getBillingStore() {
  try {
    // cordova-plugin-purchase v13+
    if (window.CdvPurchase && window.CdvPurchase.store) return window.CdvPurchase.store;

    // fallback (older)
    if (window.store && (typeof window.store.initialize === "function" || typeof window.store.register === "function")) {
      return window.store;
    }
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

    if (typeof p.state === "string") {
      const s = p.state.toLowerCase();
      if (s.includes("owned") || s.includes("approved")) return true;
    }
    return false;
  } catch (_e) {
    return false;
  }
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
  try { ensureDebugPanel().textContent = text; } catch (_e) {}
}

function getProductDebug(storeObj, productId = PRO_PRODUCT_ID) {
  let p = null;
  try { p = storeObj && typeof storeObj.get === "function" ? storeObj.get(productId) : null; } catch (_e) {}

  const offers = (p && Array.isArray(p.offers)) ? p.offers : [];
  const offer0 = offers.length ? offers[0] : null;

  let offerFromGetOffer = null;
  try { offerFromGetOffer = (p && typeof p.getOffer === "function") ? p.getOffer() : null; } catch (_e) {}

  return {
    hasStore: !!storeObj,
    hasGet: !!(storeObj && typeof storeObj.get === "function"),
    productId,
    productExists: !!p,
    productType: p && p.type ? p.type : null,
    state: p && p.state ? p.state : null,
    owned: p && typeof p.owned === "boolean" ? p.owned : null,
    offersCount: offers.length,
    offer0: offer0 ? { id: offer0.id || offer0.offerId || null } : null,
    offerFromGetOffer: offerFromGetOffer ? { id: offerFromGetOffer.id || offerFromGetOffer.offerId || null } : null,
    lastBillingError: _lastBillingError || "",
    native: isNativeApp(),
    time: new Date().toISOString(),
  };
}

async function safeUpdateStore(storeObj) {
  if (!storeObj) return;
  if (typeof storeObj.update === "function") return storeObj.update();
  if (typeof storeObj.refresh === "function") return storeObj.refresh();
}

async function waitForOwnership(storeObj, productId = PRO_PRODUCT_ID, timeoutMs = 45000) {
  const startTs = Date.now();
  while (Date.now() - startTs < timeoutMs) {
    if (getProductOwned(storeObj, productId)) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

export async function initBilling({ verbose = false } = {}) {
  if (!isNativeApp()) return { ok: false, reason: "web" };

  _store = getBillingStore();
  if (!_store) return { ok: false, reason: "no_store" };

  try {
    // ---- CRITICAL FIX: register with GOOGLE_PLAY platform if available ----
    try {
      if (typeof _store.register === "function" && _store.NON_CONSUMABLE) {
        if (_store.GOOGLE_PLAY) {
          _store.register({ id: PRO_PRODUCT_ID, type: _store.NON_CONSUMABLE, platform: _store.GOOGLE_PLAY });
        } else {
          _store.register({ id: PRO_PRODUCT_ID, type: _store.NON_CONSUMABLE });
        }
      }
    } catch (_e) {}

    // ---- CRITICAL FIX: initialize with GOOGLE_PLAY when supported ----
    if (typeof _store.initialize === "function") {
      if (_store.GOOGLE_PLAY) await _store.initialize([_store.GOOGLE_PLAY]);
      else await _store.initialize();
    }

    // Fetch product/offers
    try {
      await safeUpdateStore(_store);
    } catch (e) {
      _lastBillingError = (e && e.message) ? e.message : String(e);
    }

    // Sync owned -> local flag
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
      showBillingDebugPanel("[billing debug init FAILED]\n" + _lastBillingError + "\n\n" + JSON.stringify(d, null, 2));
    }
    return { ok: false, reason: _lastBillingError || "init_failed" };
  }
}

export async function buyProduct(productId = PRO_PRODUCT_ID) {
  if (!isNativeApp()) throw new Error("Purchases only work inside the installed Google Play app (not the website).");

  if (!_store) _store = getBillingStore();
  if (!_store) throw new Error("Billing store not available (CdvPurchase/store missing).");

  // Refresh before purchase attempt
  try { await safeUpdateStore(_store); } catch (_e) {}

  // Already owned?
  if (getProductOwned(_store, productId) || isProUnlocked()) {
    setProUnlockedLocal();
    return { ok: true, alreadyOwned: true };
  }

  const p = (typeof _store.get === "function") ? _store.get(productId) : null;
  if (!p) {
    const d = getProductDebug(_store, productId);
    throw new Error("Product not");
  }

  // Offers
  const offers = Array.isArray(p.offers) ? p.offers : [];
  const offer = (typeof p.getOffer === "function") ? p.getOffer() : (offers[0] || null);

  if (!offer) {
    const d = getProductDebug(_store, productId);
    throw new Error("No purchase offer available.\n" + JSON.stringify(d, null, 2));
  }

  // v13+ preferred purchase flow
  if (typeof _store.requestPayment === "function") {
    await _store.requestPayment(offer);
    const owned = await waitForOwnership(_store, productId);
    if (owned) { setProUnlockedLocal(); return { ok: true }; }
    throw new Error("Purchase did not complete (no ownership detected).");
  }

  // Legacy fallback
  if (typeof _store.order === "function") {
    await _store.order(productId);
    const owned = await waitForOwnership(_store, productId);
    if (owned) { setProUnlockedLocal(); return { ok: true }; }
    throw new Error("Purchase did not complete (no ownership detected).");
  }

  throw new Error("Purchase API not found (store.requestPayment/order missing).");
}

export async function restorePurchases(productId = PRO_PRODUCT_ID) {
  if (!isNativeApp()) return { ok: false, reason: "web" };
  if (!_store) _store = getBillingStore();
  if (!_store) return { ok: false, reason: "no_store" };

  try {
    if (typeof _store.restorePurchases === "function") await _store.restorePurchases();
    else await safeUpdateStore(_store);

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
