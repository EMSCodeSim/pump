// paywall.js — FireOps Calc paywall UI + purchase bridge
// Updated: safer billing-store detection + real purchase success gating

const PRO_PRODUCT_ID = 'fireops.pro';
const TRIAL_DAYS = 5;

const KEY_INSTALL_TS = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED = 'fireops_pro_unlocked_v1';
const KEY_TRIAL_INTRO_SHOWN = 'fireops_trial_intro_shown_v1';

function nowMs() { return Date.now(); }

function ensureInstallTs() {
  try {
    let ts = localStorage.getItem(KEY_INSTALL_TS);
    if (!ts) {
      ts = String(nowMs());
      localStorage.setItem(KEY_INSTALL_TS, ts);
    }
    return Number(ts) || nowMs();
  } catch (_e) {
    return nowMs();
  }
}

function daysSince(ms) {
  return (nowMs() - ms) / (1000 * 60 * 60 * 24);
}

function inTrialWindow(trialDays = TRIAL_DAYS) {
  const ts = ensureInstallTs();
  return daysSince(ts) < trialDays;
}

function isProUnlocked() {
  try { return localStorage.getItem(KEY_PRO_UNLOCKED) === '1'; } catch (_e) { return false; }
}

function isGrandfathered() {
  try { return localStorage.getItem(KEY_GRANDFATHERED) === '1'; } catch (_e) { return false; }
}

function looksLikeBillingStore(store) {
  // Heuristics: cordova-plugin-purchase store usually has register/when/ready/refresh/order
  if (!store) return false;
  const hasRegister = typeof store.register === 'function';
  const hasWhen = typeof store.when === 'function';
  const hasReady = typeof store.ready === 'function' || typeof store.onReady === 'function';
  const hasRefresh = typeof store.refresh === 'function';
  return (hasRegister || hasWhen) && (hasReady || hasRefresh);
}

function getBillingStore() {
  // cordova-plugin-purchase (recommended): window.CdvPurchase.store
  const s = window?.CdvPurchase?.store;
  if (s) return s;

  // Some builds expose it as window.store (but many apps also use window.store for state),
  // so ONLY accept window.store if it clearly looks like the billing store *and* has order().
  const w = window?.store;
  if (w && looksLikeBillingStore(w) && typeof w.order === "function") return w;

  return null;
}

function getProductFromStore(store, productId) {
  try {
    if (typeof store.get === "function") return store.get(productId);
  } catch (_) {}
  try {
    const list = store?.products || store?.products?.all || store?.products?.list;
    if (Array.isArray(list)) return list.find(p => p && (p.id === productId || p.productId === productId));
  } catch (_) {}
  return null;
}

function isOwnedInStore(store, productId) {
  const p = getProductFromStore(store, productId);
  if (!p) return false;
  if (p.owned === true) return true;
  if (p.isOwned === true) return true;
  if (typeof p.owned === "function" && p.owned()) return true;
  if (typeof p.isOwned === "function" && p.isOwned()) return true;
  if (String(p.state || "").toLowerCase() === "owned") return true;
  return false;
}

let __billingInitPromise = null;
export async function initBilling(productId = PRO_PRODUCT_ID) {
  if (__billingInitPromise) return __billingInitPromise;

  __billingInitPromise = (async () => {
    const store = getBillingStore();
    if (!store) return { ok: false, reason: "Billing store not found" };

    // Register product once (ignore if already registered)
    try {
      const NON_CONSUMABLE =
        store?.NON_CONSUMABLE ||
        store?.ProductType?.NON_CONSUMABLE ||
        store?.ProductType?.NON_CONSUMABLE_PRODUCT ||
        "non consumable";

      if (typeof store.register === "function") {
        try { store.register({ id: productId, type: NON_CONSUMABLE }); } catch (_) {}
      }
    } catch (_) {}

    // Wire up lifecycle handlers once
    try {
      if (typeof store.when === "function") {
        store.when(productId).approved((tx) => {
          try { if (tx && typeof tx.verify === "function") tx.verify(); } catch (_) {}
        });

        store.when(productId).verified((receipt) => {
          try { if (receipt && typeof receipt.finish === "function") receipt.finish(); } catch (_) {}
          try {
            localStorage.setItem(KEY_PRO_UNLOCKED, "1");
            localStorage.setItem(KEY_INSTALL_TS, ""); // disable trial timer after purchase
          } catch (_) {}
        });
      }
    } catch (_) {}

    // Some versions need initialize(); safe to try
    try {
      if (typeof store.initialize === "function") {
        const p = store?.Platform;
        const platforms = [];
        if (p?.GOOGLE_PLAY) platforms.push(p.GOOGLE_PLAY);
        else if (p?.GOOGLE_PLAYSTORE) platforms.push(p.GOOGLE_PLAYSTORE);
        else if (p?.ANDROID) platforms.push(p.ANDROID);
        else platforms.push("android-playstore");
        try { await store.initialize(platforms); } catch (_) {}
      }
    } catch (_) {}

    // Refresh to pull owned state
    try { if (typeof store.refresh === "function") store.refresh(); } catch (_) {}

    return { ok: true, store };
  })();

  return __billingInitPromise;
}

export async function buyProduct(productId = PRO_PRODUCT_ID) {
  // If already unlocked, return fast
  if (isProUnlocked() || localStorage.getItem(KEY_GRANDFATHERED) === "1") {
    return { ok: true, alreadyOwned: true };
  }

  const init = await initBilling(productId);
  if (!init.ok) return init;

  const store = init.store;

  // If Play says it's already owned, unlock immediately
  try {
    if (isOwnedInStore(store, productId)) {
      localStorage.setItem(KEY_PRO_UNLOCKED, "1");
      localStorage.setItem(KEY_INSTALL_TS, "");
      return { ok: true, alreadyOwned: true };
    }
  } catch (_) {}

  const waitForOwned = (timeoutMs = 60000) => new Promise((resolve) => {
    const t0 = Date.now();
    const timer = setInterval(() => {
      const owned =
        isProUnlocked() ||
        localStorage.getItem(KEY_PRO_UNLOCKED) === "1" ||
        isOwnedInStore(store, productId);

      if (owned) {
        clearInterval(timer);
        resolve({ ok: true });
      } else if (Date.now() - t0 > timeoutMs) {
        clearInterval(timer);
        resolve({ ok: false, reason: "Timed out waiting for purchase" });
      }
    }, 400);
  });

  try {
    if (typeof store.order === "function") {
      const r = store.order(productId);
      if (r && typeof r.then === "function") await r;
    } else if (typeof store.requestPayment === "function") {
      await store.requestPayment(productId);
    } else {
      return { ok: false, reason: "Purchase API not available (store.order missing)" };
    }
  } catch (e) {
    const msg = (e && (e.message || e.error || e.code)) ? String(e.message || e.error || e.code) : "Purchase cancelled/failed";
    return { ok: false, reason: msg, error: e };
  }

  const result = await waitForOwned();
  if (result.ok) {
    try { localStorage.setItem(KEY_INSTALL_TS, ""); } catch (_) {}
  }
  return result;
}

export async function restorePurchases(productId = PRO_PRODUCT_ID) {
  const init = await initBilling(productId);
  if (!init.ok) return init;

  const store = init.store;

  try {
    if (typeof store.refresh === "function") store.refresh();
  } catch (_e) {}

  // Wait briefly for refresh to populate owned flags
  await new Promise(r => setTimeout(r, 900));

  try {
    if (isOwnedInStore(store, productId)) {
      localStorage.setItem(KEY_PRO_UNLOCKED, "1");
      localStorage.setItem(KEY_INSTALL_TS, "");
      return { ok: true };
    }
  } catch (_e) {}

  return { ok: false, reason: "Not owned" };
}

export function renderPaywall(rootEl, opts) {
  const productId = opts?.productId || PRO_PRODUCT_ID;
  const trialDays = opts?.trialDays || TRIAL_DAYS;

  const wrap = document.createElement('div');
  wrap.style.position = 'fixed';
  wrap.style.inset = '0';
  wrap.style.zIndex = '9999';
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';
  wrap.style.background = 'rgba(0,0,0,.55)';

  const card = document.createElement('div');
  card.style.width = 'min(520px, 92vw)';
  card.style.borderRadius = '16px';
  card.style.background = '#111827';
  card.style.color = 'white';
  card.style.padding = '18px 16px';
  card.style.boxShadow = '0 12px 30px rgba(0,0,0,.35)';
  card.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';

  const inTrial = inTrialWindow(trialDays);

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
      <div style="font-size:18px;font-weight:800;">5-Day Free Trial — No Risk</div>
      <button id="pwClose" style="background:transparent;border:none;color:#9ca3af;font-size:18px;cursor:pointer;">✕</button>
    </div>
    <div style="margin-top:10px;opacity:.9;line-height:1.35">
      FireOps Calc is free for ${trialDays} days. You can unlock full access with a one-time purchase.
    </div>
    <ul style="margin:12px 0 14px 18px;opacity:.9">
      <li>No subscription</li>
      <li>One-time unlock: $1.99</li>
      <li>Restore works if you reinstall</li>
    </ul>
    <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
      <button id="pwTrial" style="padding:10px 12px;border-radius:12px;border:1px solid #374151;background:#111827;color:#e5e7eb;cursor:pointer;">
        ${inTrial ? 'Continue Trial' : 'Close'}
      </button>
      <button id="pwBuy" style="padding:10px 14px;border-radius:12px;border:none;background:#2563eb;color:white;font-weight:800;cursor:pointer;">
        Pay Now — $1.99 one-time
      </button>
      <button id="pwRestore" style="padding:10px 12px;border-radius:12px;border:1px solid #374151;background:#0b1220;color:#e5e7eb;cursor:pointer;">
        Restore
      </button>
    </div>
    <div style="margin-top:10px;font-size:12px;opacity:.65;">
      If the purchase sheet doesn’t open, billing may still be initializing. Try again in 30 seconds.
    </div>
  `;

  wrap.appendChild(card);
  rootEl.appendChild(wrap);

  const $ = (id) => card.querySelector(id);

  $('#pwClose').onclick = () => { try { wrap.remove(); } catch(_e){}; opts?.onClose?.(); };
  $('#pwTrial').onclick = () => { try { wrap.remove(); } catch(_e){}; opts?.onContinueTrial?.(); };

  $('#pwBuy').onclick = async () => {
    try {
      // Prefer the host app’s onPurchase (so it decides routing)
      if (opts?.onPurchase) await opts.onPurchase();
      else {
        const r = await buyProduct(productId);
        if (!r.ok) throw new Error(r.reason || 'Purchase failed');
        wrap.remove();
        opts?.onClose?.();
      }
    } catch (e) {
      alert(`Purchase failed: ${e?.message || e}`);
    }
  };

  $('#pwRestore').onclick = async () => {
    try {
      if (opts?.onRestore) await opts.onRestore();
      else {
        const r = await restorePurchases(productId);
        if (!r.ok) throw new Error(r.reason || 'Nothing to restore');
        alert('Restored! Pro unlocked.');
        wrap.remove();
        opts?.onClose?.();
      }
    } catch (e) {
      alert(`Restore failed: ${e?.message || e}`);
    }
  };
}
