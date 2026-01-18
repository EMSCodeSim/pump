/* paywall.js
   FireOps Calc — IAP helper for cordova-plugin-purchase (store)

   FIX: avoids collision with your app's internal js/store.js by preferring
   CdvPurchase.store and only using globalThis.store if it actually looks like
   the billing store (has order/register/when).

   Exports:
   - initBilling(options)
   - canPurchase()
   - buyProduct(productId)
   - restorePurchases()
*/

let _billingReady = false;

let _opts = {
  productId: "fireops.pro",
  debug: false,
  onEntitlementChanged: null, // (isPro:boolean) => void
  onLog: null,               // (msg:string) => void
};

function log(msg) {
  try {
    if (_opts?.debug) console.log("[paywall]", msg);
    if (typeof _opts?.onLog === "function") _opts.onLog(msg);
  } catch (_) {}
}

function looksLikeBillingStore(s) {
  return (
    !!s &&
    (typeof s.order === "function" ||
      typeof s.register === "function" ||
      typeof s.when === "function")
  );
}

function getStore() {
  // IMPORTANT: avoid collision with your app's own global `store`
  // cordova-plugin-purchase v13+ => globalThis.CdvPurchase.store
  const s1 = globalThis.CdvPurchase?.store;
  if (looksLikeBillingStore(s1)) return s1;

  // Some older setups expose a legacy global `store`
  const s0 = globalThis.store;
  if (looksLikeBillingStore(s0)) return s0;

  return null;
}

function isNativePlatform() {
  const w = globalThis;

  // Cordova present
  if (w.cordova) return true;

  // Capacitor present
  const Cap = w.Capacitor;
  if (Cap) {
    try {
      if (typeof Cap.isNativePlatform === "function") return !!Cap.isNativePlatform();
      if (typeof Cap.getPlatform === "function") return Cap.getPlatform() !== "web";
    } catch (_) {}
  }

  // Capacitor WebView commonly uses localhost with http(s)
  try {
    const h = w.location?.hostname || "";
    if (h === "localhost" || h === "127.0.0.1") return true;
  } catch (_) {}

  // Other native schemes
  try {
    const p = w.location?.protocol || "";
    if (p === "capacitor:" || p === "ionic:" || p === "file:") return true;
  } catch (_) {}

  return false;
}

function setProUnlocked(isPro) {
  try {
    if (typeof _opts?.onEntitlementChanged === "function") {
      _opts.onEntitlementChanged(!!isPro);
    }
  } catch (_) {}
}

function ensureStoreOrExplain() {
  const s = getStore();
  if (!s) {
    log("Billing store not found (cordova-plugin-purchase not available or not initialized).");
    return {
      ok: false,
      reason:
        "In-app purchases aren’t available in this build.\n\n" +
        "Make sure you're testing the INSTALLED Android app (not the website) " +
        "and that cordova-plugin-purchase is installed + synced into Android.",
    };
  }
  return { ok: true, store: s };
}

export async function initBilling(options = {}) {
  _opts = { ..._opts, ...options };
  _billingReady = false;

  const chk = ensureStoreOrExplain();
  if (!chk.ok) return false;

  const store = chk.store;

  if (!isNativePlatform()) {
    log("Not detected as native platform (blocking billing init).");
    return false;
  }

  try {
    log(`Registering product: ${_opts.productId}`);
    store.register({
      id: _opts.productId,
      type: store.NON_CONSUMABLE,
    });

    if (_opts.debug && store.verbosity != null) {
      store.verbosity = store.DEBUG;
    }

    // Track entitlement
    store.when(_opts.productId).updated((p) => {
      const owned =
        !!p?.owned ||
        p?.state === store.APPROVED ||
        p?.state === store.OWNED;

      log(`Product updated. owned=${owned} state=${p?.state}`);
      if (owned) setProUnlocked(true);
    });

    // Approval -> finish -> unlock
    store.when(_opts.productId).approved((p) => {
      log("Purchase approved. Finishing + unlocking.");
      try { p.finish(); } catch (_) {}
      setProUnlocked(true);
    });

    // Ready
    store.ready(() => {
      _billingReady = true;
      log("Store ready. Refreshing purchases…");
      try { store.refresh(); } catch (e) { log("store.refresh() error: " + (e?.message || e)); }
    });

    // Initialize for Google Play
    try {
      if (typeof store.initialize === "function") {
        store.initialize([store.GOOGLE_PLAY]);
      } else {
        // Some versions don't require initialize, refresh is enough
        store.refresh();
      }
    } catch (e) {
      log("Store init error: " + (e?.message || e));
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
  if (!chk.ok) {
    alert(chk.reason);
    return { ok: false, error: chk.reason };
  }

  if (!isNativePlatform()) {
    const msg =
      "Purchases only work inside the installed Android app.\n\n" +
      "If you’re testing in a browser (website), it can’t open Google Play Billing.";
    alert(msg);
    return { ok: false, error: msg };
  }

  const store = chk.store;

  try {
    // If user taps quickly, store might not be “ready” yet
    if (!_billingReady) {
      try { store.refresh(); } catch (_) {}
    }

    // Hard guard: prevents the exact error you're seeing
    if (typeof store.order !== "function") {
      // Try alternate call form, if available in this plugin version
      const alt = globalThis.CdvPurchase;
      if (typeof alt?.order === "function") {
        log(`Ordering via CdvPurchase.order: ${pid}`);
        alt.order(pid);
        return { ok: true };
      }
      throw new Error("Billing store present but order() is missing (store collision or plugin not initialized).");
    }

    log(`Ordering product: ${pid}`);
    store.order(pid);
    return { ok: true };
  } catch (e) {
    const msg = e?.message || String(e);
    log("Order failed: " + msg);
    alert("Purchase failed: " + msg);
    return { ok: false, error: msg };
  }
}

export async function restorePurchases() {
  const chk = ensureStoreOrExplain();
  if (!chk.ok) {
    alert(chk.reason);
    return { ok: false, error: chk.reason };
  }

  if (!isNativePlatform()) {
    const msg = "Restore only works inside the installed Android app (not the website).";
    alert(msg);
    return { ok: false, error: msg };
  }

  try {
    log("Restoring purchases (refresh)...");
    chk.store.refresh();
    return { ok: true };
  } catch (e) {
    const msg = e?.message || String(e);
    log("Restore failed: " + msg);
    alert("Restore failed: " + msg);
    return { ok: false, error: msg };
  }
}
