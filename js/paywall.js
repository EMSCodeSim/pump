// paywall.js
// 5-day free trial + $1.99 one-time unlock (Android/iOS via cordova-plugin-purchase)
//
// CRITICAL DESIGN GOAL:
// This file MUST be safe to load on the web (including iOS Safari).
// If the billing plugin is missing, everything should degrade gracefully
// and NEVER block the app from loading.

const TRIAL_KEY = 'fireopscalc_trial_start_ms';
const UNLOCK_KEY = 'fireopscalc_unlocked_v1';

// Product id in Google Play Console (Managed Product)
export const PRODUCT_ID = 'fireops_calc_unlock';

// 5 days
const TRIAL_MS = 5 * 24 * 60 * 60 * 1000;

// ---------- Safe localStorage wrappers (Safari private mode can throw) ----------
function lsGet(key) {
  try {
    return window?.localStorage?.getItem(key) ?? null;
  } catch (e) {
    return null;
  }
}

function lsSet(key, value) {
  try {
    window?.localStorage?.setItem(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

function lsRemove(key) {
  try {
    window?.localStorage?.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}

// ---------- Platform detection ----------
export function isNativeApp() {
  try {
    // Capacitor sets window.Capacitor; Cordova sets window.cordova.
    const cap = window?.Capacitor;
    if (cap?.isNativePlatform?.()) return true;
    if (window?.cordova) return true;
    return false;
  } catch (e) {
    return false;
  }
}

// ---------- Trial state ----------
export function initTrialFlags() {
  // Always set the trial start (if missing) but never throw.
  const existing = lsGet(TRIAL_KEY);
  if (!existing) {
    lsSet(TRIAL_KEY, String(Date.now()));
  }
}

export function markUnlocked() {
  lsSet(UNLOCK_KEY, '1');
}

export function clearUnlockedForTesting() {
  lsRemove(UNLOCK_KEY);
}

export function getTrialState() {
  const unlocked = lsGet(UNLOCK_KEY) === '1';

  // If localStorage is blocked (private mode), behave as: NOT unlocked, trial active
  // but with no persistent start. Use session time as start.
  const rawStart = lsGet(TRIAL_KEY);
  const startMs = rawStart ? Number(rawStart) : Date.now();

  const now = Date.now();
  const elapsed = now - startMs;
  const remainingMs = Math.max(0, TRIAL_MS - elapsed);
  const trialActive = remainingMs > 0;

  return {
    unlocked,
    startMs,
    now,
    elapsed,
    remainingMs,
    trialActive,
    daysRemaining: Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
  };
}

export function shouldBlockWithPaywall() {
  // Only block inside the native app. Web should always be usable.
  if (!isNativeApp()) return false;

  const s = getTrialState();
  if (s.unlocked) return false;
  if (s.trialActive) return false;
  return true;
}

// ---------- Billing plugin helpers ----------
function getCdvPurchase() {
  try {
    return window?.CdvPurchase ?? null;
  } catch (e) {
    return null;
  }
}

function getPluginStore() {
  // DO NOT fall back to window.store.
  // Your app may have its own "store" module; that name collides with cordova-plugin-purchase.
  const cp = getCdvPurchase();
  return cp?.store ?? null;
}

function storeHasOrdering(store) {
  if (!store) return false;
  // v13 has store.order(productId)
  if (typeof store.order === 'function') return true;
  // Some configs expose get(productId).order()
  const p = typeof store.get === 'function' ? store.get(PRODUCT_ID) : null;
  if (p && typeof p.order === 'function') return true;
  return false;
}

async function ensureStoreReady({ timeoutMs = 2500 } = {}) {
  // Never wait forever.
  const store = getPluginStore();
  if (!store) return { ok: false, reason: 'CdvPurchase.store not found' };

  // If register/initialize exists, call it safely.
  try {
    if (typeof store.register === 'function') {
      // For managed one-time unlock, NON_CONSUMABLE.
      const productType = (getCdvPurchase()?.ProductType?.NON_CONSUMABLE) ?? 'non consumable';
      store.register({ id: PRODUCT_ID, type: productType });
    }
  } catch (e) {
    // ignore
  }

  // Refresh if possible.
  try {
    if (typeof store.refresh === 'function') {
      store.refresh();
    }
  } catch (e) {
    // ignore
  }

  // Wait a little for products to populate (optional).
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, timeoutMs)));

  return { ok: true };
}

async function tryOrderProduct() {
  const store = getPluginStore();
  if (!store) {
    throw new Error('No purchase method found (CdvPurchase.store missing)');
  }

  // Prefer store.order(productId)
  if (typeof store.order === 'function') {
    return store.order(PRODUCT_ID);
  }

  // Fallback: store.get(productId).order()
  if (typeof store.get === 'function') {
    const p = store.get(PRODUCT_ID);
    if (p && typeof p.order === 'function') {
      return p.order();
    }
  }

  throw new Error('No purchase method found (expected store.order() or store.get(id).order())');
}

function attachUnlockListenersOnce() {
  const store = getPluginStore();
  if (!store || store.__fireops_listeners_attached) return;
  store.__fireops_listeners_attached = true;

  // v13: store.when('product').approved(...)
  try {
    if (typeof store.when === 'function') {
      store.when(PRODUCT_ID)
        .approved((p) => {
          try {
            if (typeof p.verify === 'function') p.verify();
            if (typeof p.finish === 'function') p.finish();
          } catch (e) {}
          markUnlocked();
          window.dispatchEvent(new CustomEvent('fireops:unlocked'));
        })
        .verified((p) => {
          try { if (typeof p.finish === 'function') p.finish(); } catch (e) {}
          markUnlocked();
          window.dispatchEvent(new CustomEvent('fireops:unlocked'));
        });
    }
  } catch (e) {
    // ignore
  }
}

// ---------- UI: Trial modal ----------
function formatDaysLeft(days) {
  if (days <= 0) return '0 days';
  if (days === 1) return '1 day';
  return `${days} days`;
}

function modalTemplate({ daysRemaining, errorText }) {
  const errHtml = errorText
    ? `<div class="trial-error">${escapeHtml(errorText)}</div>`
    : '';

  return `
  <div class="trial-backdrop">
    <div class="trial-modal">
      <div class="trial-title">5-Day Free Trial — No Risk</div>
      <div class="trial-text">FireOps Calc is free to use for the next <b>${formatDaysLeft(daysRemaining)}</b>.</div>
      <div class="trial-text">After the trial, you can unlock the app with a <b>$1.99 one-time purchase</b> — no subscription, no auto-billing.</div>
      <div class="trial-subtext">Purchases only work when installed from Google Play / App Store (internal/closed/production). Not sideloaded.</div>
      ${errHtml}
      <div class="trial-actions">
        <button id="trial-continue" class="trial-btn trial-btn-secondary">Continue Free Trial</button>
        <button id="trial-buy" class="trial-btn trial-btn-primary">Unlock Now — $1.99 one-time</button>
      </div>
    </div>
  </div>`;
}

function injectModalStylesOnce() {
  if (document.getElementById('fireops-trial-style')) return;
  const style = document.createElement('style');
  style.id = 'fireops-trial-style';
  style.textContent = `
    .trial-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:99999;padding:18px;}
    .trial-modal{width:min(520px,100%);background:#0b1220;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px 16px;color:#eaf2ff;box-shadow:0 20px 60px rgba(0,0,0,.55);}
    .trial-title{font-size:22px;font-weight:800;margin-bottom:10px;color:#7fd3ff;letter-spacing:.2px;}
    .trial-text{font-size:15px;line-height:1.35;margin:8px 0;color:rgba(234,242,255,.92);}
    .trial-subtext{font-size:12px;line-height:1.35;margin-top:8px;color:rgba(234,242,255,.65);}
    .trial-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px;}
    .trial-btn{flex:1;min-width:180px;border-radius:14px;border:1px solid rgba(255,255,255,.12);padding:12px 14px;font-size:15px;font-weight:800;cursor:pointer;}
    .trial-btn-secondary{background:transparent;color:#eaf2ff;}
    .trial-btn-primary{background:#2b8cff;color:white;border-color:rgba(43,140,255,.55);}
    .trial-error{margin-top:12px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,80,80,.35);background:rgba(255,80,80,.12);color:#ffd6d6;font-weight:700;}
  `;
  document.head.appendChild(style);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function removeExistingModal() {
  const existing = document.querySelector('.trial-backdrop');
  if (existing) existing.remove();
}

export async function showTrialModal({ force = false } = {}) {
  // Web never blocks, but you may still want to show messaging in-app.
  if (!force && !shouldBlockWithPaywall()) return;

  const state = getTrialState();

  injectModalStylesOnce();
  removeExistingModal();

  const wrapper = document.createElement('div');
  wrapper.innerHTML = modalTemplate({ daysRemaining: state.daysRemaining, errorText: '' });
  const backdrop = wrapper.firstElementChild;
  document.body.appendChild(backdrop);

  const btnContinue = document.getElementById('trial-continue');
  const btnBuy = document.getElementById('trial-buy');

  btnContinue?.addEventListener('click', () => {
    removeExistingModal();
  });

  btnBuy?.addEventListener('click', async () => {
    if (btnBuy) btnBuy.disabled = true;

    try {
      if (!isNativeApp()) {
        throw new Error('Purchases only work inside the installed app.');
      }

      const store = getPluginStore();
      if (!store) {
        throw new Error('Purchase system not available (plugin not detected).');
      }

      attachUnlockListenersOnce();

      await ensureStoreReady({ timeoutMs: 700 });

      if (!storeHasOrdering(store)) {
        throw new Error('No purchase method found (expected store.order() or store.get(id).order()).');
      }

      await tryOrderProduct();

      await new Promise((resolve) => setTimeout(resolve, 600));
      const s2 = getTrialState();
      if (s2.unlocked) {
        removeExistingModal();
      }
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      removeExistingModal();
      const wrapper2 = document.createElement('div');
      wrapper2.innerHTML = modalTemplate({ daysRemaining: getTrialState().daysRemaining, errorText: `Purchase failed: ${msg}` });
      document.body.appendChild(wrapper2.firstElementChild);

      document.getElementById('trial-continue')?.addEventListener('click', removeExistingModal);
      document.getElementById('trial-buy')?.addEventListener('click', () => showTrialModal({ force: true }));
    } finally {
      if (btnBuy) btnBuy.disabled = false;
    }
  });

  const onUnlocked = () => {
    removeExistingModal();
    window.removeEventListener('fireops:unlocked', onUnlocked);
  };
  window.addEventListener('fireops:unlocked', onUnlocked);
}
