/* paywall.js
   FireOps Calc — IAP helper for cordova-plugin-purchase (store)
   - Robust “native app” detection (Capacitor often uses http(s)://localhost)
   - Auto-unlock if already purchased
   - Restore purchases support
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

function getStore() {
  // cordova-plugin-purchase exposes `store`
  return globalThis.store || globalThis.CdvPurchase?.store || null;
}

function isNativePlatform() {
  // Works for Capacitor + Cordova
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

  // Capacitor webview usually uses localhost (http/https)
  try {
    const h = w.location?.hostname || "";
    if (h === "localhost" || h === "127.0.0.1") return true;
  } catch (_) {}

  // Fallback: capacitor/ionic/file schemes
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
    log("Store not found (cordova-plugin-purchase not available).");
    return {
      ok: false,
      reason:
        "In-app purchases aren’t available in this build.\n\n" +
        "Make sure you're testing the installed Android app (not the website) " +
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
    // Register product
    log(`Registering product: ${_opts.productId}`);
    store.register({
      id: _opts.productId,
      type: store.NON_CONSUMABLE,
    });

    // Optional verbosity
    if (_opts.debug && store.verbosity != null) {
      store.verbosity = store.DEBUG;
    }

    // When product updates, check ownership
    store.when(_opts.productId).updated((p) => {
      const owned =
        !!p?.owned ||
        p?.state === store.APPROVED ||
        p?.state === store.OWNED;

      log(`Product updated. owned=${owned} state=${p?.state}`);
      if (owned) setProUnlocked(true);
    });

    // Approval => finish + unlock
    store.when(_opts.productId).approved((p) => {
      log("Purchase approved. Finishing + unlocking.");
      try { p.finish(); } catch (_) {}
      setProUnlocked(true);
    });

    store.ready(() => {
      _billingReady = true;
      log("Store ready. Refreshing purchases…");
      try {
        store.refresh();
      } catch (e) {
        log("store.refresh() error: " + (e?.message || e));
      }
    });

    // Initialize (Google Play)
    // Some versions use store.initialize(), some use store.refresh() only.
    try {
      if (typeof store.initialize === "function") {
        store.initialize([store.GOOGLE_PLAY]);
      } else {
        // fallback: just refresh
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
  const s = getStore();
  return !!s;
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
    log(`Ordering product: ${pid}`);
    store.order(pid);
    return { ok: true };
  } catch (e) {
    const msg = e?.message || String(e);
    log("Order failed: " + msg);
    alert("Purchase failed to start: " + msg);
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
    const msg =
      "Restore only works inside the installed Android app (not the website).";
    alert(msg);
    return { ok: false, error: msg };
  }

  const store = chk.store;

  try {
    log("Restoring purchases (refresh)...");
    store.refresh();
    return { ok: true };
  } catch (e) {
    const msg = e?.message || String(e);
    log("Restore failed: " + msg);
    alert("Restore failed: " + msg);
    return { ok: false, error: msg };
  }
}
