/* paywall.js — FireOps Calc (OPTION A: FULL APP BLOCK AFTER 5 DAYS)
   - Product ID: fireops.pro (ONE-TIME / NON-CONSUMABLE)
   - Trial: 5 days from first launch
   - After trial: whole app blocked (unless Pro or grandfathered)
   - Includes paywall modal UI (Buy / Restore)
   - Purchase uses offer.order() when available (most reliable), else store.order(id)
   - Unlock on APPROVED (works even without validators)
*/

export const PRO_PRODUCT_ID = 'fireops.pro';
export const TRIAL_DAYS = 5;

const KEY_INSTALL_TS    = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED  = 'fireops_pro_unlocked_v1';

let _billingInitPromise = null;

// -------------------- localStorage safe --------------------
function lsGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, val); } catch {} }

// -------------------- time --------------------
function nowMs() { return Date.now(); }
function daysToMs(d) { return d * 24 * 60 * 60 * 1000; }

// -------------------- platform / store --------------------
export function isNativeApp() {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
    if (window.cordova) return true;
  } catch {}
  return false;
}

function getPlatformName() {
  try {
    const p = window.Capacitor?.getPlatform?.();
    if (p) return p;
  } catch {}
  if (/Android/i.test(navigator.userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios';
  return 'web';
}

function getCdvPurchase() { return window.CdvPurchase || null; }
function getBillingStore() {
  const C = getCdvPurchase();
  if (C?.store) return C.store;
  return window.store || null;
}

// -------------------- grandfather / trial flags --------------------
function hasAnyExistingUserData() {
  const keys = [
    'fireops_dept_equipment_v1',
    'fireops_presets_v1',
    'fireops_practice_v1',
    'PRACTICE_SAVE_KEY',
  ];
  try {
    for (const k of keys) {
      if (localStorage.getItem(k) != null) return true;
    }
  } catch {}
  return false;
}

function ensureInstallTimestamps() {
  const existing = lsGet(KEY_INSTALL_TS);
  if (!existing) {
    const oldUser = hasAnyExistingUserData();
    // Grandfathered users ON if any saved data exists
    lsSet(KEY_GRANDFATHERED, oldUser ? '1' : '0');
    lsSet(KEY_INSTALL_TS, String(nowMs()));
  }
}

function installMs() {
  const v = Number(lsGet(KEY_INSTALL_TS));
  return Number.isFinite(v) ? v : null;
}

export function isGrandfathered() { return lsGet(KEY_GRANDFATHERED) === '1'; }
export function isProUnlocked() { return lsGet(KEY_PRO_UNLOCKED) === '1'; }
export function setProUnlocked(v) { lsSet(KEY_PRO_UNLOCKED, v ? '1' : '0'); }

export function trialExpired() {
  const im = installMs();
  if (!im) return false;
  return (nowMs() - im) >= daysToMs(TRIAL_DAYS);
}

export function hardBlocked() {
  // Grandfathered users are never blocked
  if (isProUnlocked()) return false;
  if (isGrandfathered()) return false;
  return trialExpired();
}

// -------------------- Billing init --------------------
export async function initBilling() {
  if (_billingInitPromise) return _billingInitPromise;

  _billingInitPromise = (async () => {
    ensureInstallTimestamps();
    if (!isNativeApp()) return;

    const platform = getPlatformName();
    const store = getBillingStore();
    const C = getCdvPurchase();
    if (!store || !C) return;

    const NON_CONSUMABLE =
      C?.ProductType?.NON_CONSUMABLE ||
      store?.NON_CONSUMABLE ||
      'non consumable';

    const GOOGLE_PLAY =
      C?.Platform?.GOOGLE_PLAY ||
      store?.PLATFORM_GOOGLE_PLAY;

    const APPLE_APPSTORE =
      C?.Platform?.APPLE_APPSTORE ||
      store?.PLATFORM_APPLE_APPSTORE;

    // Register product (platform-specific)
    try {
      const reg = { id: PRO_PRODUCT_ID, type: NON_CONSUMABLE };
      if (platform === 'android' && GOOGLE_PLAY) reg.platform = GOOGLE_PLAY;
      if (platform === 'ios' && APPLE_APPSTORE) reg.platform = APPLE_APPSTORE;
      // Some versions want array, some accept single object
      try { store.register([reg]); } catch { store.register(reg); }
    } catch {}

    // Unlock lifecycle (APPROVED is the most reliable)
    try {
      if (typeof store.when === 'function') {
        // Global listeners (safe)
        store.when()
          .approved((tx) => {
            setProUnlocked(true);
            try { window.dispatchEvent(new CustomEvent('fireops:pro_unlocked')); } catch {}
            try { tx.finish?.(); } catch {}
          })
          .verified((tx) => {
            setProUnlocked(true);
            try { window.dispatchEvent(new CustomEvent('fireops:pro_unlocked')); } catch {}
            try { tx.finish?.(); } catch {}
          })
          .error(() => { /* keep silent in production */ });

        // Also listen on product if available
        const w = store.when(PRO_PRODUCT_ID);
        w?.owned?.(() => {
          setProUnlocked(true);
          try { window.dispatchEvent(new CustomEvent('fireops:pro_unlocked')); } catch {}
        });
      }
    } catch {}

    // Initialize adapter by platform
    try {
      if (platform === 'android' && GOOGLE_PLAY) await store.initialize([GOOGLE_PLAY]);
      else if (platform === 'ios' && APPLE_APPSTORE) await store.initialize([APPLE_APPSTORE]);
      else await store.initialize();
    } catch {}

    // Pull product data
    try { await store.update?.(); } catch {}

    // If already owned, unlock
    try {
      const p = (typeof store.get === 'function') ? store.get(PRO_PRODUCT_ID) : null;
      if (p?.owned) setProUnlocked(true);
    } catch {}
  })();

  return _billingInitPromise;
}

function pickOrderableOffer(p) {
  if (!p || !p.offers) return null;
  return p.offers.find(o => typeof o.order === 'function') || null;
}

export async function buyPro() {
  await initBilling();
  const store = getBillingStore();
  if (!store) throw new Error('Billing store missing');

  try { await store.update?.(); } catch {}

  const product = (typeof store.get === 'function') ? store.get(PRO_PRODUCT_ID) : null;
  if (!product) {
    throw new Error(
      `Product not returned by Play (${PRO_PRODUCT_ID}). ` +
      `Make sure it is Active and installed from the correct Play testing track.`
    );
  }

  // Prefer offer.order() when available (best reliability)
  const offer = pickOrderableOffer(product);
  if (offer) {
    await offer.order();
    return;
  }

  // Fallback
  if (typeof store.order === 'function') {
    await store.order(PRO_PRODUCT_ID);
    return;
  }

  throw new Error('No purchase method available (offer.order/store.order missing).');
}

export async function restorePurchases() {
  await initBilling();
  const store = getBillingStore();
  const C = getCdvPurchase();
  if (!store) throw new Error('Billing store missing');

  // Prefer restorePurchases if present; else update
  if (typeof store.restorePurchases === 'function') {
    try {
      // Some versions accept platform param; some do not.
      try { await store.restorePurchases(C?.Platform?.GOOGLE_PLAY); }
      catch { await store.restorePurchases(); }
    } catch {
      // If restore fails, try update
      try { await store.update?.(); } catch {}
    }
  } else {
    try { await store.update?.(); } catch {}
  }

  // Re-check ownership
  try {
    const p = (typeof store.get === 'function') ? store.get(PRO_PRODUCT_ID) : null;
    if (p?.owned) setProUnlocked(true);
  } catch {}
}

// -------------------- Paywall Modal UI --------------------
export function showPaywallModal(opts = {}) {
  ensureInstallTimestamps();

  const forced = !!opts.force;
  const allowClose = !!opts.allowClose;

  // Default behavior: only show when hard-blocked.
  // Testing behavior: allow forcing the modal during the trial.
  if (!forced && !hardBlocked()) return;

  // Don’t stack multiple overlays
  if (document.getElementById('fireops-paywall-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'fireops-paywall-overlay';
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,.70);
    display:flex; align-items:center; justify-content:center;
    z-index:999999; padding:16px;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    width:min(560px, 100%);
    background:#fff; border-radius:16px;
    padding:18px;
    box-shadow:0 25px 80px rgba(0,0,0,.35);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
  `;

  const title = document.createElement('div');
  title.textContent = forced && !hardBlocked()
    ? (opts.title || 'Billing Test')
    : 'Trial Ended';
  title.style.cssText = `font-size:22px; font-weight:900; margin-bottom:8px;`;

  const body = document.createElement('div');
  body.textContent = forced && !hardBlocked()
    ? (opts.body || `This popup is forced so you can test Google Play Billing. Tap Buy Pro to test purchase flow.`)
    : `Your 5-day free trial has ended. Upgrade to Pro to continue using FireOps Calc.`;
  body.style.cssText = `font-size:14px; line-height:1.45; opacity:.9; margin-bottom:14px;`;

  const msg = document.createElement('div');
  msg.style.cssText = `margin-top:10px; font-size:13px; min-height:18px; opacity:.9;`;
  const setMsg = (t) => { msg.textContent = t || ''; };

  const row = document.createElement('div');
  row.style.cssText = `display:flex; gap:10px; flex-wrap:wrap;`;

  function makeBtn(label, primary) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `
      flex:1; min-width:150px;
      padding:12px 14px;
      border-radius:12px;
      border:${primary ? '0' : '1px solid #ddd'};
      font-weight:900;
      cursor:pointer;
      background:${primary ? '#111' : '#fff'};
      color:${primary ? '#fff' : '#111'};
    `;
    return b;
  }

  const buyBtn = makeBtn('Buy Pro', true);
  const restoreBtn = makeBtn('Restore Purchase', false);

  // Optional close/continue button (useful for forced testing during the trial)
  const closeBtn = allowClose ? makeBtn('Continue', false) : null;

  buyBtn.onclick = async () => {
    try {
      setMsg('Opening Google Play…');
      await buyPro();
      setMsg('Purchase started…');
      // Approved handler will unlock + app.js will react
    } catch (e) {
      setMsg(e?.message || String(e));
    }
  };

  restoreBtn.onclick = async () => {
    try {
      setMsg('Restoring…');
      await restorePurchases();
      if (isProUnlocked()) {
        setMsg('Restored. Unlocking…');
        try { window.dispatchEvent(new CustomEvent('fireops:pro_unlocked')); } catch {}
      } else {
        setMsg('No prior purchase found for this account.');
      }
    } catch (e) {
      setMsg(e?.message || String(e));
    }
  };

  if (closeBtn) {
    closeBtn.onclick = () => {
      try { overlay.remove(); } catch {}
    };
  }

  row.appendChild(buyBtn);
  row.appendChild(restoreBtn);
  if (closeBtn) row.appendChild(closeBtn);

  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(row);
  card.appendChild(msg);
  overlay.appendChild(card);

  // Block all clicks to background
  overlay.addEventListener('click', (e) => { e.stopPropagation(); }, true);

  document.body.appendChild(overlay);
}

// Optional helper
export function _resetPaywallForSupport() {
  // Intentionally empty: keeps install timestamp & grandfather logic stable.
}
