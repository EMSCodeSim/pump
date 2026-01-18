// paywall.js — FireOps Calc
// UI is injected by JS (no paywall.html file)

let _productId = null;
let _store = null;
let _inited = false;
let _initPromise = null;

function isNativePlatform() {
  const proto = window?.location?.protocol || "";
  return proto === "capacitor:" || proto === "file:"; // capacitor/android builds
}

function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function _waitForDeviceReady(timeoutMs = 2500) {
  // Capacitor often fires deviceready quickly; web never does.
  if (!isNativePlatform()) return false;

  if (window.cordova && window.cordova.platformId) return true; // already there

  let done = false;
  await Promise.race([
    new Promise((resolve) => {
      document.addEventListener(
        "deviceready",
        () => {
          done = true;
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

  return done || !!(window.cordova && window.cordova.platformId);
}

function _getStore() {
  // cordova-plugin-purchase exposes either window.store or window.CdvPurchase.store depending on version
  return window?.store || window?.CdvPurchase?.store || null;
}

function _platformKey() {
  // cordova-plugin-purchase uses store.PLATFORM.GOOGLE_PLAY in newer versions
  const s = _getStore();
  if (!s) return null;
  return s?.PLATFORM?.GOOGLE_PLAY || "android";
}

function _typeNonConsumable() {
  const s = _getStore();
  if (!s) return null;
  // Common constants across versions:
  return s?.NON_CONSUMABLE || s?.ProductType?.NON_CONSUMABLE || "non consumable";
}

export async function initBilling(productId, { onApproved } = {}) {
  _productId = productId;

  if (!isNativePlatform()) {
    // Web build: do nothing, but don’t crash
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
      // Logging (safe across versions)
      try {
        store.verbosity = store.DEBUG;
      } catch {}

      // Register product
      const platform = _platformKey();
      const type = _typeNonConsumable();

      try {
        store.register([
          {
            id: productId,
            type,
            platform,
          },
        ]);
      } catch (e) {
        // Older versions accept single object
        store.register({ id: productId, type, platform });
      }

      // Wire handlers
      try {
        store.when(productId).approved((p) => {
          console.log("[paywall] approved:", productId);
          try {
            // finish/ack
            if (p && typeof p.finish === "function") p.finish();
          } catch {}
          try {
            if (typeof onApproved === "function") onApproved(p);
          } catch (cbErr) {
            console.warn("[paywall] onApproved callback error:", cbErr);
          }
        });
      } catch (e) {
        console.warn("[paywall] store.when().approved not available:", e);
      }

      try {
        store.error((err) => console.warn("[paywall] store error:", err));
      } catch {}

      // Initialize + refresh
      try {
        await store.initialize([platform]);
      } catch (e) {
        // Some versions: store.initialize(platform)
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

      _inited = true;

      // Auto-check ownership right after init
      try {
        const owned = await checkOwned(productId);
        if (owned && typeof onApproved === "function") {
          onApproved(null); // treat as already unlocked
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

  if (!_inited) {
    // if someone calls checkOwned first, try to init (best effort)
    await initBilling(productId, {});
  }

  const store = _getStore();
  if (!store) return false;

  try {
    const p = store.get(productId);
    if (!p) return false;

    // Different versions expose ownership differently
    if (typeof p.owned === "boolean") return p.owned;
    if (typeof p.isOwned === "boolean") return p.isOwned;
    if (typeof p.isOwned === "function") return !!p.isOwned();

    // Fallback: check transactions if present
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

  // Ensure billing is initialized and store exists
  if (!_inited) {
    await initBilling(productId, {});
  }

  const store = _getStore();
  if (!store) {
    alert("Billing not available. Make sure this build is installed from Google Play (Internal/Closed/Production).");
    return false;
  }

  try {
    console.log("[paywall] ordering:", productId);
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
    "Purchases only work in the installed Google Play app (Internal/Closed/Production). Not sideloaded.";

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
    btnPay.textContent = "Opening Google Play…";
    try {
      if (typeof onPayNow === "function") {
        await onPayNow();
      } else {
        await buyProduct(_productId);
      }
    } finally {
      btnPay.disabled = false;
      btnPay.textContent = priceLine;
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
