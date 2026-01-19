// paywall.js — FireOps Calc
// UI is injected by JS (no paywall.html file)

let _productId = null;
let _store = null;
let _inited = false;
let _initPromise = null;

function isNativePlatform() {
  // ✅ Correct detection: if Capacitor OR Cordova runtime exists, we are inside the installed app
  // (even if location.protocol is https/http due to server.url or webview hosting)
  const hasCapacitor = !!window.Capacitor;
  const hasCordova = !!window.cordova;
  const hasPurchaseStore = !!(window.store || window.CdvPurchase?.store);

  return hasCapacitor || hasCordova || hasPurchaseStore;
}

function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function _waitForDeviceReady(timeoutMs = 4000) {
  // If not native, skip
  if (!isNativePlatform()) return false;

  // If cordova already available, assume ready
  if (window.cordova && window.cordova.platformId) return true;

  // Capacitor often doesn't fire deviceready the same way; don’t block forever.
  let resolved = false;

  await Promise.race([
    new Promise((resolve) => {
      document.addEventListener(
        "deviceready",
        () => {
          resolved = true;
          resolve(true);
        },
        { once: true }
      );
    }),
    (async () => {
      await _sleep(timeoutMs);
      return false;
    })(),
  ]);

  return resolved || !!(window.cordova && window.cordova.platformId) || !!window.Capacitor;
}

function _getStore() {
  // cordova-plugin-purchase exposes either window.store or window.CdvPurchase.store depending on version
  return window?.store || window?.CdvPurchase?.store || null;
}

function _platformKey() {
  const s = _getStore();
  if (!s) return null;
  return s?.PLATFORM?.GOOGLE_PLAY || "android";
}

function _typeNonConsumable() {
  const s = _getStore();
  if (!s) return null;
  return s?.NON_CONSUMABLE || s?.ProductType?.NON_CONSUMABLE || "non consumable";
}

function _setLocalProUnlocked() {
  // Keep keys stable across versions
  try {
    localStorage.setItem("fireops_pro_unlocked_v1", "1");
    localStorage.setItem("fireops_trial_disabled_v1", "1"); // disable trial once purchased
  } catch {}
}

export function isProUnlockedLocal() {
  try {
    return localStorage.getItem("fireops_pro_unlocked_v1") === "1";
  } catch {
    return false;
  }
}

export function disableTrialLocal() {
  try {
    localStorage.setItem("fireops_trial_disabled_v1", "1");
  } catch {}
}

export function isTrialDisabledLocal() {
  try {
    return localStorage.getItem("fireops_trial_disabled_v1") === "1";
  } catch {
    return false;
  }
}

export async function initBilling(productId, { onApproved } = {}) {
  _productId = productId;

  // Web build: do nothing (never crash)
  if (!isNativePlatform()) {
    _inited = false;
    _store = null;
    return false;
  }

  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    await _waitForDeviceReady();

    const store = _getStore();
    _store = store;

    if (!store) {
      console.warn("[paywall] Purchase store not found (cordova-plugin-purchase not available).");
      _inited = false;
      return false;
    }

    try {
      // verbosity (safe)
      try {
        store.verbosity = store.DEBUG;
      } catch {}

      const platform = _platformKey();
      const type = _typeNonConsumable();

      // Register product
      try {
        store.register([{ id: productId, type, platform }]);
      } catch (e) {
        store.register({ id: productId, type, platform });
      }

      // Store-level errors
      try {
        store.error((err) => console.warn("[paywall] store error:", err));
      } catch {}

      // ✅ Approved handler
      try {
        store.when(productId).approved((p) => {
          console.log("[paywall] approved:", productId);
          try {
            if (p && typeof p.finish === "function") p.finish();
          } catch {}

          // ✅ disable trial + unlock locally
          _setLocalProUnlocked();

          try {
            if (typeof onApproved === "function") onApproved(p);
          } catch (cbErr) {
            console.warn("[paywall] onApproved callback error:", cbErr);
          }
        });
      } catch (e) {
        console.warn("[paywall] store.when().approved not available:", e);
      }

      // ✅ Some versions emit "owned" separately
      try {
        store.when(productId).owned((p) => {
          console.log("[paywall] owned:", productId);
          _setLocalProUnlocked();
          try {
            if (typeof onApproved === "function") onApproved(p);
          } catch {}
        });
      } catch {}

      // Initialize + refresh
      try {
        await store.initialize([platform]);
      } catch (e) {
        try {
          await store.initialize(platform);
        } catch (e2) {
          console.warn("[paywall] store.initialize failed:", e2);
          _inited = false;
          return false;
        }
      }

      try {
        store.refresh();
      } catch {}

      // Give it a moment to populate product state on some devices
      await _sleep(300);

      _inited = true;

      // ✅ Auto-unlock if already owned (restores)
      try {
        const owned = await checkOwned(productId);
        if (owned) {
          _setLocalProUnlocked();
          if (typeof onApproved === "function") onApproved(null);
        }
      } catch {}

      return true;
    } catch (e) {
      console.warn("[paywall] initBilling failed:", e);
      _inited = false;
      return false;
    }
  })();

  return _initPromise;
}

export async function checkOwned(productId = _productId) {
  if (!productId) return false;
  if (!isNativePlatform()) return false;

  // If we already unlocked locally, trust it (fast path)
  if (isProUnlockedLocal()) return true;

  if (!_inited) {
    await initBilling(productId, {});
  }

  const store = _getStore();
  if (!store) return false;

  try {
    const p = store.get(productId);
    if (!p) return false;

    if (typeof p.owned === "boolean") return p.owned;
    if (typeof p.isOwned === "boolean") return p.isOwned;
    if (typeof p.isOwned === "function") return !!p.isOwned();

    if (p?.transactions?.length) return true;

    return false;
  } catch (e) {
    console.warn("[paywall] checkOwned error:", e);
    return false;
  }
}

export async function buyProduct(productId = _productId) {
  if (!productId) throw new Error("No productId set");

  if (!isNativePlatform()) {
    alert("Purchases only work inside the installed Google Play app (not the website).");
    return false;
  }

  // Ensure billing is initialized
  if (!_inited) {
    await initBilling(productId, {});
  }

  const store = _getStore();
  if (!store) {
    alert("Billing not available. Make sure this build is installed from Google Play (Internal/Closed/Production).");
    return false;
  }

  try {
    // Some devices need refresh right before ordering
    try {
      store.refresh();
      await _sleep(150);
    } catch {}

    console.log("[paywall] ordering:", productId);

    // cordova-plugin-purchase uses store.order(sku)
    await store.order(productId);
    return true;
  } catch (e) {
    console.warn("[paywall] order failed:", e);
    alert(`Purchase failed: ${e?.message || e}`);
    return false;
  }
}

/* ---------- UI helpers (modal injection) ---------- */

function _ensureModalRoot() {
  let root = document.getElementById("paywall-modal-root");
  if (root) return root;
  root = document.createElement("div");
  root.id = "paywall-modal-root";
  document.body.appendChild(root);
  return root;
}

export function closeAllPaywallModals() {
  const root = document.getElementById("paywall-modal-root");
  if (root) root.innerHTML = "";
}

export function renderTrialIntroModal({
  title = "5-Day Free Trial — No Risk",
  subtitle = "FireOps Calc is free for 5 days. You can unlock full access anytime with a one-time purchase.",
  priceLine = "Pay Now — $1.99 one-time",
  onContinue,
  onPayNow,
} = {}) {
  const root = _ensureModalRoot();
  root.innerHTML = "";

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.55);
    display:flex; align-items:center; justify-content:center;
    z-index:99999; padding:16px;
  `;

  const card = document.createElement("div");
  card.style.cssText = `
    width:min(520px, 100%);
    background:#0b1220;
    border:1px solid rgba(255,255,255,0.12);
    border-radius:16px;
    box-shadow:0 20px 60px rgba(0,0,0,0.5);
    padding:18px;
    color:#eaf2ff;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
  `;

  const h = document.createElement("div");
  h.style.cssText = "font-size:20px; font-weight:800; margin-bottom:6px;";
  h.textContent = title;

  const p = document.createElement("div");
  p.style.cssText = "opacity:0.9; margin-bottom:10px; line-height:1.35;";
  p.textContent = subtitle;

  const note = document.createElement("div");
  note.style.cssText = "opacity:0.75; font-size:12px; margin-bottom:14px;";
  note.textContent =
    "If the purchase sheet doesn’t open, billing may not be ready yet (or the SKU doesn’t match).";

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex; flex-direction:column; gap:10px;";

  const btnContinue = document.createElement("button");
  btnContinue.textContent = "Continue Free Trial";
  btnContinue.style.cssText = `
    width:100%;
    padding:12px 14px;
    border-radius:12px;
    border:1px solid rgba(255,255,255,0.18);
    background:rgba(255,255,255,0.06);
    color:#fff;
    font-weight:700;
  `;

  const btnPay = document.createElement("button");
  btnPay.textContent = priceLine;
  btnPay.style.cssText = `
    width:100%;
    padding:12px 14px;
    border-radius:12px;
    border:0;
    background:linear-gradient(180deg,#3aa0ff,#1d6bff);
    color:#fff;
    font-weight:900;
  `;

  btnContinue.onclick = () => {
    try {
      if (typeof onContinue === "function") onContinue();
    } finally {
      closeAllPaywallModals();
    }
  };

  btnPay.onclick = async () => {
    btnPay.disabled = true;
    const original = priceLine;
    btnPay.textContent = "Opening Google Play…";
    try {
      if (typeof onPayNow === "function") {
        await onPayNow();
      } else {
        await buyProduct(_productId);
      }
    } finally {
      btnPay.disabled = false;
      btnPay.textContent = original;
    }
  };

  btnRow.appendChild(btnContinue);
  btnRow.appendChild(btnPay);

  card.appendChild(h);
  card.appendChild(p);
  card.appendChild(note);
  card.appendChild(btnRow);
  overlay.appendChild(card);
  root.appendChild(overlay);
}
