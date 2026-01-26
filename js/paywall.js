/* paywall.js — FireOps Calc (NO POPUP MODE)
   - Product ID: fireops.pro (ONE-TIME PRODUCT)
   - Trial timer still tracks 5 days from first launch/download
   - NO paywall popup/modal displayed
   - Grandfathered users bypass trial blocking
   - Billing init still available (silent)
*/

export const PRO_PRODUCT_ID = 'fireops.pro';
export const TRIAL_DAYS = 5;

const KEY_INSTALL_TS    = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED  = 'fireops_pro_unlocked_v1';
const KEY_PAYWALL_HIDE  = 'fireops_paywall_hide_v1'; // kept for compatibility

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
    // Grandfathered users ON
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

// -------------------- Billing init (silent) --------------------
export async function initBilling() {
  if (_billingInitPromise) return _billingInitPromise;

  _billingInitPromise = (async () => {
    ensureInstallTimestamps();
    if (!isNativeApp()) return;

    const platform = getPlatformName();
    const store = getBillingStore();
    const C = getCdvPurchase();
    if (!store) return;

    const ProductType = C?.ProductType;
    const Platform = C?.Platform;

    const NON_CONSUMABLE =
      ProductType?.NON_CONSUMABLE ||
      store?.NON_CONSUMABLE ||
      'non consumable';

    const GOOGLE_PLAY =
      Platform?.GOOGLE_PLAY ||
      store?.PLATFORM_GOOGLE_PLAY;

    const APPLE_APPSTORE =
      Platform?.APPLE_APPSTORE ||
      store?.PLATFORM_APPLE_APPSTORE;

    // Register product (never iOS on Android)
    try {
      const reg = { id: PRO_PRODUCT_ID, type: NON_CONSUMABLE };
      if (platform === 'android' && GOOGLE_PLAY) reg.platform = GOOGLE_PLAY;
      if (platform === 'ios' && APPLE_APPSTORE) reg.platform = APPLE_APPSTORE;
      store.register(reg);
    } catch {}

    // Purchase lifecycle (silent unlock)
    try {
      if (typeof store.when === 'function') {
        const w = store.when(PRO_PRODUCT_ID);

        // Unlock on approved (no UI dependency)
        w?.approved?.((p) => {
          setProUnlocked(true);
          try { p.finish(); } catch {}
          try { window.dispatchEvent(new CustomEvent('fireops:pro_unlocked')); } catch {}
          try { p.verify?.(); } catch {}
        });

        w?.verified?.((p) => {
          setProUnlocked(true);
          try { p.finish(); } catch {}
          try { window.dispatchEvent(new CustomEvent('fireops:pro_unlocked')); } catch {}
        });
      }
    } catch {}

    // Initialize by platform
    try {
      if (platform === 'android' && GOOGLE_PLAY) await store.initialize([GOOGLE_PLAY]);
      else if (platform === 'ios' && APPLE_APPSTORE) await store.initialize([APPLE_APPSTORE]);
      else await store.initialize();
    } catch {}

    // Pull product data
    try { await store.update(); } catch {}

    // If already owned, unlock
    try {
      const p = (typeof store.get === 'function') ? store.get(PRO_PRODUCT_ID) : null;
      if (p?.owned) setProUnlocked(true);
    } catch {}
  })();

  return _billingInitPromise;
}

export async function buyPro() {
  await initBilling();
  const store = getBillingStore();
  if (!store) throw new Error('Billing store missing');
  try { await store.update(); } catch {}

  const product = (typeof store.get === 'function') ? store.get(PRO_PRODUCT_ID) : null;
  if (!product) {
    throw new Error(
      `Product not returned by Play (${PRO_PRODUCT_ID}). ` +
      `Make sure it is Active and installed from the correct Play testing track.`
    );
  }
  await store.order(PRO_PRODUCT_ID);
}

export async function restorePurchases() {
  await initBilling();
  const store = getBillingStore();
  if (!store) throw new Error('Billing store missing');

  if (typeof store.restorePurchases === 'function') {
    await store.restorePurchases();
  } else {
    try { await store.update(); } catch {}
  }
}

// -------------------- PUBLIC: showPaywallModal --------------------
// NO-POPUP MODE: keep signature so app.js can call it, but do nothing.
export function showPaywallModal(_opts = {}) {
  ensureInstallTimestamps();
  return;
}

// Compatibility helper
export function _resetPaywallForSupport() {
  // Keep install timestamp & grandfather status — do nothing here in no-popup mode.
  // (Intentionally empty.)
}
