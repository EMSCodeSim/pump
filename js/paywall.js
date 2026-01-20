/* paywall.js
   FireOps Calc Paywall + Billing bridge (Cordova/Capacitor compatible)
   - Avoids collision with your app's own "store" (window.store)
   - Prefers cordova-plugin-purchase v13+ (window.CdvPurchase.store)
   - Falls back to legacy window.store ONLY if it looks like the billing store
*/

/* =========================
   Config
========================= */
export const PRO_PRODUCT_ID = "fireops.pro"; // must match Play Console Product ID
export const TRIAL_DAYS = 5;

const KEY_INSTALL_TS = "fireops_install_ts_v1";
const KEY_PRO_UNLOCKED = "fireops_pro_unlocked_v1";
const KEY_TRIAL_INTRO_SHOWN = "fireops_trial_intro_shown_v1";

/* =========================
   Internal state
========================= */
let _store = null;
let _billingReady = false;
let _lastBillingError = "";

/* =========================
   Environment helpers
========================= */
function isNativeApp() {
  // Works for Capacitor + Cordova WebView cases
  const cap = window.Capacitor;
  if (cap && typeof cap.isNativePlatform === "function") return !!cap.isNativePlatform();
  if (cap && cap.getPlatform && cap.getPlatform() !== "web") return true;

  // Cordova
  return !!window.cordova;
}

function nowMs() {
  return Date.now();
}

function getInstallTs() {
  const v = Number(localStorage.getItem(KEY_INSTALL_TS) || "0");
  if (v > 0) return v;
  const ts = nowMs();
  localStorage.setItem(KEY_INSTALL_TS, String(ts));
  return ts;
}

function trialDaysUsed() {
  const usedMs = nowMs() - getInstallTs();
  return Math.floor(usedMs / (24 * 60 * 60 * 1000));
}

function trialExpired() {
  return trialDaysUsed() >= TRIAL_DAYS;
}

function setProUnlockedLocal() {
  localStorage.setItem(KEY_PRO_UNLOCKED, "1");
}

function setProLockedLocal() {
  localStorage.removeItem(KEY_PRO_UNLOCKED);
}

export function isProUnlocked() {
  return localStorage.getItem(KEY_PRO_UNLOCKED) === "1";
}

/* =========================
   Billing store detection
========================= */
function looksLikeBillingStore(s) {
  if (!s) return false;
  // Billing stores typically have initialize/ready/register/when/product APIs
  const hasInit = typeof s.initialize === "function" || typeof s.init === "function";
  const hasRegister = typeof s.register === "function";
  const hasWhen = typeof s.when === "function";
  const hasReady = typeof s.ready === "function";
  const hasProducts = typeof s.get === "function" || Array.isArray(s.products);
  return (hasInit && hasRegister) || (hasWhen && hasReady && hasProducts);
}

function getBillingStore() {
  // Prefer cordova-plugin-purchase v13+ global
  const cdp = window.CdvPurchase;
  if (cdp && cdp.store) return cdp.store;

  // Some builds expose window.store for billing (legacy),
  // BUT your app also uses "store", so only accept it if it looks like billing.
  const legacy = window.store;
  if (looksLikeBillingStore(legacy)) return legacy;

  return null;
}

function getProductOwned(storeObj) {
  try {
    // v13+: store.get(id) returns Product with .owned boolean
    const p = storeObj && typeof storeObj.get === "function" ? storeObj.get(PRO_PRODUCT_ID) : null;
    if (p && typeof p.owned === "boolean") return p.owned;

    // Some variants: product.state / product.isOwned
    if (p && typeof p.isOwned === "function") return !!p.isOwned();
    if (p && typeof p.state === "string" && p.state.toLowerCase().includes("owned")) return true;
  } catch (_) {}
  return false;
}

/* =========================
   Billing init
========================= */
export async function initBilling({ verbose = false } = {}) {
  _billingReady = false;
  _lastBillingError = "";
  _store = getBillingStore();

  if (!isNativeApp()) {
    _lastBillingError = "Not running inside the installed app (web detected).";
    if (verbose) console.warn("[paywall] billing not available on web");
    return { ok: false, reason: _lastBillingError };
  }

  if (!_store) {
    _lastBillingError =
      "Billing library not found (CdvPurchase/store missing). Check plugin + android build.";
    if (verbose) console.warn("[paywall] " + _lastBillingError);
    return { ok: false, reason: _lastBillingError };
  }

  try {
    // Register product (handle both v13 and older signatures)
    // v13 ProductType: window.CdvPurchase.ProductType
    const cdp = window.CdvPurchase;
    const ProductType = cdp && cdp.ProductType ? cdp.ProductType : null;

    // If ProductType exists, use NON_CONSUMABLE (one-time unlock)
    const typeVal = ProductType && ProductType.NON_CONSUMABLE ? ProductType.NON_CONSUMABLE : "non-consumable";

    if (typeof _store.register === "function") {
      // Many versions accept: { id, type, platform? }
      try {
        _store.register({ id: PRO_PRODUCT_ID, type: typeVal });
      } catch (e) {
        // Some older versions use store.register({ id, alias, type })
        _store.register({ id: PRO_PRODUCT_ID, alias: PRO_PRODUCT_ID, type: typeVal });
      }
    }

    // Wire events (best-effort across versions)
    if (typeof _store.when === "function") {
      _store.when(PRO_PRODUCT_ID).approved((p) => {
        try {
          // Finish transaction if needed
          if (p && typeof p.verify === "function") p.verify();
          if (p && typeof p.finish === "function") p.finish();
        } catch (_) {}
        setProUnlockedLocal();
        _billingReady = true;
      });

      _store.when(PRO_PRODUCT_ID).verified((p) => {
        try {
          if (p && typeof p.finish === "function") p.finish();
        } catch (_) {}
        setProUnlockedLocal();
        _billingReady = true;
      });

      _store.when(PRO_PRODUCT_ID).owned(() => {
        setProUnlockedLocal();
        _billingReady = true;
      });

      _store.when(PRO_PRODUCT_ID).cancelled(() => {
        // user cancelled – do nothing
        _billingReady = true;
      });

      _store.error((err) => {
        _lastBillingError = (err && (err.message || err.code || String(err))) || "Billing error";
        if (verbose) console.warn("[paywall] store.error:", err);
      });
    }

    // Initialize
    if (typeof _store.initialize === "function") {
      // v13 requires platforms; if available, try Google Play
      const Platform = window.CdvPurchase && window.CdvPurchase.Platform ? window.CdvPurchase.Platform : null;
      if (Platform && Platform.GOOGLE_PLAY) {
        await _store.initialize([Platform.GOOGLE_PLAY]);
      } else {
        await _store.initialize();
      }
    } else if (typeof _store.init === "function") {
      await _store.init();
    }

    // Ready callback (if available)
    if (typeof _store.ready === "function") {
      _store.ready(() => {
        _billingReady = true;
        if (getProductOwned(_store)) setProUnlockedLocal();
      });
    } else {
      // If no ready(), treat as ready after init attempt
      _billingReady = true;
      if (getProductOwned(_store)) setProUnlockedLocal();
    }

    // Final owned check
    if (getProductOwned(_store)) setProUnlockedLocal();

    return { ok: true };
  } catch (e) {
    _billingReady = false;
    _lastBillingError = e && e.message ? e.message : String(e);
    if (verbose) console.warn("[paywall] initBilling failed:", e);
    return { ok: false, reason: _lastBillingError };
  }
}

/* =========================
   Purchase actions
========================= */
export async function buyProduct(productId = PRO_PRODUCT_ID) {
  if (!isNativeApp()) {
    throw new Error("Purchases only work inside the installed Google Play app (not the website).");
  }

  if (!_store) _store = getBillingStore();
  if (!_store) throw new Error("Billing store not available (CdvPurchase/store missing).");

  // If already owned, unlock immediately
  if (getProductOwned(_store) || isProUnlocked()) {
    setProUnlockedLocal();
    return { ok: true, alreadyOwned: true };
  }

  // Attempt purchase across plugin API variants
  try {
    // Common: store.order(productId)
    if (typeof _store.order === "function") {
      await _store.order(productId);
      // post-check
      if (getProductOwned(_store)) setProUnlockedLocal();
      return { ok: true };
    }

    // v13 sometimes wants an "offer" rather than an id
    const p = typeof _store.get === "function" ? _store.get(productId) : null;
    const offer =
      p && typeof p.getOffer === "function"
        ? p.getOffer()
        : p && Array.isArray(p.offers) && p.offers.length
          ? p.offers[0]
          : null;

    if (typeof _store.requestPayment === "function") {
      await _store.requestPayment(offer || p || productId);
      if (getProductOwned(_store)) setProUnlockedLocal();
      return { ok: true };
    }

    throw new Error("Purchase API not found (store.order/requestPayment missing).");
  } catch (e) {
    // Bubble a clean message
    const msg = e && e.message ? e.message : String(e);
    throw new Error(msg);
  }
}

export async function restorePurchases() {
  if (!isNativeApp()) return { ok: false, reason: "web" };
  if (!_store) _store = getBillingStore();
  if (!_store) return { ok: false, reason: "no_store" };

  try {
    if (typeof _store.restorePurchases === "function") {
      await _store.restorePurchases();
    } else if (typeof _store.refresh === "function") {
      await _store.refresh();
    } else if (typeof _store.update === "function") {
      await _store.update();
    }

    if (getProductOwned(_store)) {
      setProUnlockedLocal();
      return { ok: true, restored: true };
    }
    return { ok: true, restored: false };
  } catch (e) {
    return { ok: false, reason: e && e.message ? e.message : String(e) };
  }
}

/* =========================
   UI (Trial + Paywall)
========================= */

// Returns { showIntro, expired, daysUsed }
export function getTrialStatus() {
  const days = trialDaysUsed();
  const expired = trialExpired();
  const introShown = localStorage.getItem(KEY_TRIAL_INTRO_SHOWN) === "1";
  return { showIntro: !introShown && !isProUnlocked(), expired, daysUsed: days };
}

function ensureRoot() {
  let root = document.getElementById("paywall-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "paywall-root";
    document.body.appendChild(root);
  }
  return root;
}

function closeAllPaywallUI() {
  const root = document.getElementById("paywall-root");
  if (root) root.innerHTML = "";
  document.body.classList.remove("show-paywall");
}

export function renderTrialIntroModal({
  priceText = "$1.99 one-time",
  onContinue = null,
  onPay = null,
} = {}) {
  const root = ensureRoot();
  document.body.classList.add("show-paywall");

  root.innerHTML = `
    <div class="pw-backdrop" style="
      position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:9998;
      display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="pw-card" style="
        width:min(520px, 96vw); background:#0f172a; color:#e5e7eb; border-radius:16px;
        box-shadow:0 20px 60px rgba(0,0,0,.5); padding:18px; border:1px solid rgba(255,255,255,.12);">
        <div style="font-size:20px; font-weight:800; margin-bottom:6px;">5-Day Free Trial — No Risk</div>
        <div style="opacity:.9; line-height:1.35; margin-bottom:12px;">
          FireOps Calc is free for 5 days. You can unlock full access anytime with a one-time purchase.
        </div>

        <div style="opacity:.75; font-size:12px; margin:10px 0 14px;">
          If the purchase sheet doesn’t open, billing may not be ready yet.
        </div>

        <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
          <button id="pw-continue" style="
            padding:12px 14px; border-radius:12px; border:1px solid rgba(255,255,255,.18);
            background:transparent; color:#e5e7eb; font-weight:700;">
            Continue Free Trial
          </button>

          <button id="pw-pay" style="
            padding:12px 14px; border-radius:12px; border:none;
            background:#2563eb; color:white; font-weight:800; min-width:180px;">
            Pay Now — ${priceText}
          </button>
        </div>
      </div>
    </div>
  `;

  localStorage.setItem(KEY_TRIAL_INTRO_SHOWN, "1");

  const btnContinue = document.getElementById("pw-continue");
  const btnPay = document.getElementById("pw-pay");

  btnContinue.onclick = () => {
    closeAllPaywallUI();
    if (typeof onContinue === "function") onContinue();
  };

  btnPay.onclick = async () => {
    if (typeof onPay === "function") return onPay();

    // Default pay behavior
    try {
      btnPay.disabled = true;
      btnPay.textContent = "Opening purchase…";
      await buyProduct(PRO_PRODUCT_ID);
      setProUnlockedLocal();
      closeAllPaywallUI();
    } catch (e) {
      btnPay.disabled = false;
      btnPay.textContent = `Pay Now — ${priceText}`;
      alert(`Purchase failed: ${e && e.message ? e.message : String(e)}`);
    }
  };
}

// Hard paywall after trial ends (if not purchased)
export function renderPaywall({
  priceText = "$1.99 one-time",
  onPay = null,
  onClose = null,
} = {}) {
  const root = ensureRoot();
  document.body.classList.add("show-paywall");

  root.innerHTML = `
    <div class="pw-backdrop" style="
      position:fixed; inset:0; background:rgba(0,0,0,.70); z-index:9998;
      display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="pw-card" style="
        width:min(560px, 96vw); background:#0b1220; color:#e5e7eb; border-radius:16px;
        box-shadow:0 20px 60px rgba(0,0,0,.6); padding:18px; border:1px solid rgba(255,255,255,.12);">
        <div style="font-size:20px; font-weight:900; margin-bottom:6px;">Trial ended</div>
        <div style="opacity:.92; line-height:1.35; margin-bottom:12px;">
          Unlock Pro to keep using FireOps Calc.
        </div>

        <ul style="margin:0 0 14px 18px; opacity:.9;">
          <li>No subscription</li>
          <li>One-time unlock: ${priceText}</li>
          <li>Restore works if you reinstall</li>
        </ul>

        <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
          <button id="pw-close" style="
            padding:12px 14px; border-radius:12px; border:1px solid rgba(255,255,255,.18);
            background:transparent; color:#e5e7eb; font-weight:700;">
            Close
          </button>

          <button id="pw-pay" style="
            padding:12px 14px; border-radius:12px; border:none;
            background:#2563eb; color:white; font-weight:900; min-width:200px;">
            Pay Now — ${priceText}
          </button>
        </div>

        <div style="margin-top:10px; opacity:.65; font-size:12px;">
          ${_lastBillingError ? `Billing note: ${_lastBillingError}` : ""}
        </div>
      </div>
    </div>
  `;

  document.getElementById("pw-close").onclick = () => {
    if (typeof onClose === "function") onClose();
  };

  document.getElementById("pw-pay").onclick = async () => {
    if (typeof onPay === "function") return onPay();

    try {
      await buyProduct(PRO_PRODUCT_ID);
      setProUnlockedLocal();
      closeAllPaywallUI();
    } catch (e) {
      alert(`Purchase failed: ${e && e.message ? e.message : String(e)}`);
    }
  };
}

/* =========================
   Gate helper
========================= */
export function shouldBlockForPaywall() {
  if (isProUnlocked()) return false;
  return trialExpired();
}
