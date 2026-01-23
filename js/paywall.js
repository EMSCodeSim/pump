/* paywall.js
   FireOps Calc Paywall + Billing bridge (Cordova/Capacitor compatible)
   - Avoids collision with your app's own "store" (window.store)
   - Prefers cordova-plugin-purchase v13+ (window.CdvPurchase / window.store)
*/

const PRO_PRODUCT_ID = "fireops.pro";

// Local flags (kept in localStorage)
const KEY_PRO_UNLOCKED = "fireops_pro_unlocked_v1";

let _store = null;
let _lastBillingError = "";

function isNativeApp() {
  // Capacitor or Cordova presence
  return !!(window.Capacitor?.isNativePlatform?.() || window.cordova);
}

function getBillingStore() {
  // cordova-plugin-purchase v13+ exposes window.CdvPurchase AND window.store
  // Older versions expose window.store only
  const s = window.CdvPurchase?.store || window.store;
  return s || null;
}

function setProUnlockedLocal() {
  try {
    localStorage.setItem(KEY_PRO_UNLOCKED, "1");
  } catch (_e) {}
}

export function isProUnlocked() {
  try {
    return localStorage.getItem(KEY_PRO_UNLOCKED) === "1";
  } catch (_e) {
    return false;
  }
}

function showBillingDebugPanel(text) {
  try {
    let el = document.getElementById("billing-debug");
    if (!el) {
      el = document.createElement("pre");
      el.id = "billing-debug";
      el.style.position = "fixed";
      el.style.left = "10px";
      el.style.bottom = "10px";
      el.style.maxWidth = "92vw";
      el.style.maxHeight = "38vh";
      el.style.overflow = "auto";
      el.style.padding = "10px";
      el.style.borderRadius = "10px";
      el.style.background = "rgba(0,0,0,0.75)";
      el.style.color = "white";
      el.style.fontSize = "12px";
      el.style.zIndex = "999999";
      document.body.appendChild(el);
    }
    el.textContent = text;
  } catch (_e) {}
}

function getProductOwned(storeObj, productId) {
  try {
    // v13: store.get(productId) returns Product; owned is .owned or .isOwned
    if (typeof storeObj.get === "function") {
      const p = storeObj.get(productId);
      if (!p) return false;
      if (typeof p.owned === "boolean") return p.owned;
      if (typeof p.isOwned === "boolean") return p.isOwned;
      if (typeof p.isOwned === "function") return !!p.isOwned;
      if (typeof p.owned === "function") return !!p.owned;
      return false;
    }

    // fallback: storeObj.products?
    const list = storeObj.products || [];
    const p = list.find(x => x && x.id === productId);
    if (!p) return false;
    return !!(p.owned || p.isOwned);
  } catch (_e) {
    return false;
  }
}

function getProductDebug(storeObj, productId) {
  const d = {
    hasStore: !!storeObj,
    hasGet: typeof storeObj?.get === "function",
    productId,
    productExists: false,
    productType: null,
    state: null,
    owned: null,
    offersCount: 0,
    offer0: null,
    offerFromGetOffer: null,
    lastBillingError: _lastBillingError || "",
    native: isNativeApp(),
    time: new Date().toISOString()
  };

  try {
    if (storeObj && typeof storeObj.get === "function") {
      const p = storeObj.get(productId);
      if (p) {
        d.productExists = true;
        d.productType = p.type || p.productType || null;
        d.state = p.state || null;
        d.owned = (typeof p.owned === "boolean") ? p.owned
          : (typeof p.isOwned === "boolean") ? p.isOwned
          : (typeof p.isOwned === "function") ? !!p.isOwned()
          : (typeof p.owned === "function") ? !!p.owned()
          : null;

        const offers = p.offers || p.pricingPhases || p.pricing || [];
        if (Array.isArray(offers)) {
          d.offersCount = offers.length;
          d.offer0 = offers[0] || null;
        } else if (offers) {
          d.offersCount = 1;
          d.offer0 = offers;
        }

        try {
          if (typeof p.getOffer === "function") d.offerFromGetOffer = p.getOffer();
        } catch (_e) {}
      }
    }
  } catch (_e) {}

  return d;
}

function pickOffer(product) {
  if (!product) return null;

  // v13: product.offers is typical
  const offers = product.offers;
  if (Array.isArray(offers) && offers.length) return offers[0];

  // fallback
  if (product.pricingPhases && Array.isArray(product.pricingPhases) && product.pricingPhases.length) {
    return product.pricingPhases[0];
  }

  return null;
}

async function waitForOwnership(storeObj, productId, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
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
    // Register product if supported (safe no-op if not)
    try {
      if (typeof _store.register === "function" && _store.NON_CONSUMABLE) {
        // For modern cordova-plugin-purchase (v13+), explicitly bind to Google Play
        // so the plugin can correctly load offers under Billing v7+.
        if (_store.GOOGLE_PLAY) {
          _store.register({ id: PRO_PRODUCT_ID, type: _store.NON_CONSUMABLE, platform: _store.GOOGLE_PLAY });
        } else {
          _store.register({ id: PRO_PRODUCT_ID, type: _store.NON_CONSUMABLE });
        }
      }
    } catch (_e) {}

    // Initialize if supported
    if (typeof _store.initialize === "function") {
      // v13+ expects an array of platforms; passing GOOGLE_PLAY makes initialization deterministic.
      if (_store.GOOGLE_PLAY) await _store.initialize([_store.GOOGLE_PLAY]);
      else await _store.initialize();
    }

    // Fetch product/offers
    try {
      if (typeof _store.update === "function") await _store.update();
      else if (typeof _store.refresh === "function") await _store.refresh();
    } catch (e) {
      _lastBillingError = (e && e.message) ? e.message : String(e);
    }

    // Sync owned state to local flag
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

  try {
    const p = (typeof _store.get === "function") ? _store.get(productId) : null;
    const offer = pickOffer(p);

    if (!p) {
      const d = getProductDebug(_store, productId);
      throw new Error("Product not loaded in billing store. " + JSON.stringify(d));
    }
    if (!offer) {
      const d = getProductDebug(_store, productId);
      throw new Error("No purchase offer available for this product. " + JSON.stringify(d));
    }

    // v13+ best path
    if (typeof _store.requestPayment === "function") {
      await _store.requestPayment(offer);
      const owned = await waitForOwnership(_store, productId);
      if (owned) {
        setProUnlockedLocal();
        return { ok: true };
      }
      throw new Error("Purchase did not complete (no ownership detected).");
    }

    // fallback
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
    _lastBillingError = (e && e.message) ? e.message : String(e);
    return { ok: false, reason: _lastBillingError || "restore_failed" };
  }
}

export function getBillingLastError() {
  return _lastBillingError || "";
}
