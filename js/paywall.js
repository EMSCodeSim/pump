/* paywall.js
   FireOps Calc paywall + billing helpers (Cordova/Capacitor + cordova-plugin-purchase v13)
   - Safe on WEB (won't break page load)
   - Safe if plugin missing (shows message, disables buy)
*/

const LS_TRIAL_START = "fireops_trial_start_ms";
const LS_UNLOCKED = "fireops_unlocked";
const DEFAULT_TRIAL_DAYS = 5;

function nowMs() {
  return Date.now();
}

function clampInt(n, fallback) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.floor(x) : fallback;
}

function isProbablyNative() {
  try {
    // Capacitor native check
    const cap = window.Capacitor;
    if (cap?.isNativePlatform?.()) return true;

    // Older Capacitor pattern
    const platform = cap?.getPlatform?.();
    if (platform && platform !== "web") return true;

    // Cordova check
    if (typeof window.cordova !== "undefined") return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Cordova Purchase plugin (cordova-plugin-purchase) is usually exposed at window.CdvPurchase
 * We must NOT use window.store (name collision risk with your own store.js).
 */
function getCdv() {
  try {
    return window.CdvPurchase || null;
  } catch {
    return null;
  }
}

function getPurchaseStore() {
  const cdv = getCdv();
  const s = cdv?.store || null;
  // sanity check to avoid picking up your own app "store"
  if (!s) return null;
  if (typeof s.register !== "function") return null;
  if (typeof s.refresh !== "function") return null;
  return s;
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export function isUnlocked() {
  try {
    return localStorage.getItem(LS_UNLOCKED) === "1";
  } catch {
    return false;
  }
}

export function setUnlocked(flag) {
  try {
    localStorage.setItem(LS_UNLOCKED, flag ? "1" : "0");
  } catch {
    // ignore
  }
}

export function getOrStartTrialDays(trialDays = DEFAULT_TRIAL_DAYS) {
  trialDays = clampInt(trialDays, DEFAULT_TRIAL_DAYS);

  try {
    const raw = localStorage.getItem(LS_TRIAL_START);
    let start = raw ? Number(raw) : 0;
    if (!Number.isFinite(start) || start <= 0) {
      start = nowMs();
      localStorage.setItem(LS_TRIAL_START, String(start));
    }
    const elapsedDays = (nowMs() - start) / (1000 * 60 * 60 * 24);
    const remaining = Math.max(0, trialDays - elapsedDays);
    return {
      trialDays,
      startMs: start,
      elapsedDays,
      remainingDays: remaining,
      isExpired: remaining <= 0,
    };
  } catch {
    // if localStorage blocked, just behave permissively
    return {
      trialDays,
      startMs: nowMs(),
      elapsedDays: 0,
      remainingDays: trialDays,
      isExpired: false,
    };
  }
}

/**
 * Initialize billing. SAFE on web: returns { ok:false, reason:"not-native" } without breaking load.
 * @param {object} opts
 * @param {string} opts.productId - e.g. "fireopscalc_unlock"
 * @param {number} opts.trialDays
 */
export async function initBilling(opts = {}) {
  const productId = String(opts.productId || "").trim();
  const trialDays = clampInt(opts.trialDays, DEFAULT_TRIAL_DAYS);

  // Never block web
  if (!isProbablyNative()) {
    return { ok: false, reason: "not-native", productId, trialDays };
  }

  const cdv = getCdv();
  const purchaseStore = getPurchaseStore();
  if (!cdv || !purchaseStore) {
    return { ok: false, reason: "plugin-missing", productId, trialDays };
  }
  if (!productId) {
    return { ok: false, reason: "no-product-id", productId, trialDays };
  }

  // Make everything defensive
  try {
    // Optional: quieter logs in prod
    try {
      if (purchaseStore.verbosity) purchaseStore.verbosity = cdv.LogLevel?.QUIET ?? purchaseStore.verbosity;
    } catch {}

    // Register product (NON-CONSUMABLE one-time)
    purchaseStore.register([
      {
        id: productId,
        type: cdv.ProductType?.NON_CONSUMABLE || "non consumable",
        platform: cdv.Platform?.GOOGLE_PLAY || "google_play",
      },
    ]);

    // If store.initialize exists (v13), call it
    try {
      if (typeof purchaseStore.initialize === "function" && cdv.Platform?.GOOGLE_PLAY) {
        // do not await forever
        const initPromise = purchaseStore.initialize([cdv.Platform.GOOGLE_PLAY]);
        await promiseWithTimeout(initPromise, 8000);
      }
    } catch {
      // ignore; refresh below still helps
    }

    // Hooks: if owned/verified, unlock
    try {
      purchaseStore.when(productId).owned(() => setUnlocked(true));
    } catch {}
    try {
      purchaseStore.when(productId).approved((p) => {
        // Some setups require verify/finish
        try {
          if (typeof p.verify === "function") p.verify();
          else if (typeof p.finish === "function") p.finish();
        } catch {}
      });
    } catch {}
    try {
      purchaseStore.when(productId).verified((p) => {
        setUnlocked(true);
        try {
          if (typeof p.finish === "function") p.finish();
        } catch {}
      });
    } catch {}

    // Always refresh, but never block app start
    try {
      await promiseWithTimeout(purchaseStore.refresh(), 8000);
    } catch {
      // ignore
    }

    // If product already shows owned, unlock
    try {
      const prod = purchaseStore.get(productId);
      if (prod?.owned) setUnlocked(true);
    } catch {}

    return { ok: true, reason: "ready", productId, trialDays };
  } catch (err) {
    return { ok: false, reason: "init-error", productId, trialDays, error: String(err?.message || err) };
  }
}

function promiseWithTimeout(promise, ms) {
  if (!promise || typeof promise.then !== "function") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

/**
 * Attempts to purchase the product.
 * Works with either:
 *  - product.order()
 *  - store.order(productId)
 */
export async function purchaseNow(productId) {
  productId = String(productId || "").trim();
  if (!productId) throw new Error("Missing productId");

  // On web: fail gracefully (do not break page)
  if (!isProbablyNative()) {
    throw new Error("Purchases only work in the installed app (Google Play).");
  }

  const purchaseStore = getPurchaseStore();
  if (!purchaseStore) {
    throw new Error("Purchase system not available (plugin missing).");
  }

  // Refresh first (best practice), but don’t hang
  try {
    await promiseWithTimeout(purchaseStore.refresh(), 6000);
  } catch {}

  const prod = safeGetProduct(productId);

  // Try product.order() first
  if (prod && typeof prod.order === "function") {
    await prod.order();
    return;
  }

  // Fallback: store.order(productId)
  if (typeof purchaseStore.order === "function") {
    await purchaseStore.order(productId);
    return;
  }

  throw new Error("No purchase method found (expected product.order() or store.order())");
}

function safeGetProduct(productId) {
  try {
    const s = getPurchaseStore();
    if (!s) return null;
    return s.get(productId) || null;
  } catch {
    return null;
  }
}

/**
 * Show paywall modal.
 * IMPORTANT: This function NEVER blocks app load. If you call it on web, it will show
 * a message and disable the Buy button.
 */
export function showPaywallModal({
  productId,
  trialDays = DEFAULT_TRIAL_DAYS,
  title = "5-Day Free Trial — No Risk",
  subtitle = "FireOps Calc is free to use for the next 5 days.",
  priceLine = "$1.99 one-time purchase — no subscription, no auto-billing.",
  onContinue = null,
  onPurchased = null,
} = {}) {
  const native = isProbablyNative();

  // Remove existing
  const old = document.getElementById("fireops-paywall-overlay");
  if (old) old.remove();

  const overlay = document.createElement("div");
  overlay.id = "fireops-paywall-overlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0,0,0,0.55);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
  `;

  const card = document.createElement("div");
  card.style.cssText = `
    width: min(520px, 100%);
    background: rgba(10, 16, 24, 0.98);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 16px;
    padding: 18px 16px;
    color: #eaf2ff;
    box-shadow: 0 18px 60px rgba(0,0,0,0.55);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  `;

  const trial = getOrStartTrialDays(trialDays);
  const daysLeft = Math.ceil(trial.remainingDays);

  card.innerHTML = `
    <div style="font-size:14px; opacity:0.85; margin-bottom:6px;">FireOps Calc — Start Here</div>
    <div style="font-size:26px; font-weight:800; color:#7fd0ff; margin-bottom:10px;">${escapeHtml(title)}</div>
    <div style="font-size:16px; margin-bottom:10px;">${escapeHtml(subtitle)}</div>
    <div style="font-size:16px; margin-bottom:12px;">
      After the trial, unlock with a <b>$1.99 one-time</b> purchase — <b>no subscription</b>, <b>no auto-billing</b>.
    </div>

    <div style="font-size:14px; opacity:0.9; margin-bottom:10px;">
      Trial status: <b>${trial.isExpired ? "Expired" : `${daysLeft} day(s) left`}</b>
    </div>

    <div id="fireops-paywall-msg" style="
      display:none; margin: 10px 0 14px 0;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,80,80,0.35);
      background: rgba(255,80,80,0.12);
      color: #ffd1d1;
      font-size: 14px;
    "></div>

    <div style="display:flex; gap:10px; margin-top: 12px;">
      <button id="fireops-paywall-continue" style="
        flex:1;
        padding: 12px 12px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.06);
        color: #eaf2ff;
        font-weight: 700;
        font-size: 16px;
      ">Continue Free Trial</button>

      <button id="fireops-paywall-buy" style="
        flex:1;
        padding: 12px 12px;
        border-radius: 14px;
        border: 1px solid rgba(80,160,255,0.45);
        background: rgba(60,140,255,0.9);
        color: #06121f;
        font-weight: 900;
        font-size: 16px;
      ">Unlock Now — $1.99 one-time</button>
    </div>

    <div style="margin-top:10px; font-size:12px; opacity:0.7; line-height:1.35;">
      Purchases only work when installed from <b>Google Play</b> (Internal/Closed/Production). Not sideloaded.
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const msg = card.querySelector("#fireops-paywall-msg");
  const btnContinue = card.querySelector("#fireops-paywall-continue");
  const btnBuy = card.querySelector("#fireops-paywall-buy");

  function showMsg(text) {
    if (!msg) return;
    msg.style.display = "block";
    msg.textContent = text;
  }

  function close() {
    overlay.remove();
  }

  btnContinue?.addEventListener("click", () => {
    close();
    try {
      onContinue && onContinue();
    } catch {}
  });

  // If web, disable buying and show message (do NOT break page load)
  if (!native) {
    btnBuy.disabled = true;
    btnBuy.style.opacity = "0.5";
    btnBuy.style.cursor = "not-allowed";
    showMsg("Purchases are only available in the installed app (Google Play).");
    return { close, setMessage: showMsg };
  }

  btnBuy?.addEventListener("click", async () => {
    btnBuy.disabled = true;
    btnBuy.style.opacity = "0.7";
    try {
      await purchaseNow(productId);
      // If purchase completes, plugin should mark owned/verified; we also unlock defensively
      setUnlocked(true);
      close();
      try {
        onPurchased && onPurchased();
      } catch {}
    } catch (e) {
      btnBuy.disabled = false;
      btnBuy.style.opacity = "1";
      showMsg(`Purchase failed: ${String(e?.message || e)}`);
    }
  });

  return { close, setMessage: showMsg };
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
