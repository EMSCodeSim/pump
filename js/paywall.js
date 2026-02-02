/* paywall.js — FireOps Calc (BILLING TEST MODE)
   - Product ID: fireops.pro (ONE-TIME / NON-CONSUMABLE)
   - ALWAYS show paywall on launch (until Pro unlock detected)
   - NO trial, NO grandfather
   - Uses offer.order() when available, else store.order()
   - Unlocks on APPROVED
*/

export const PRO_PRODUCT_ID = 'fireops.pro';

// ✅ BILLING TEST MODE: always lock until purchase is detected
export const FORCE_BILLING_TEST = true;

const KEY_PRO_UNLOCKED  = 'fireops_pro_unlocked_v1';
let _billingInitPromise = null;

// -------------------- localStorage safe --------------------
function lsGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, val); } catch {} }

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

// -------------------- Pro state --------------------
export function isProUnlocked() { return lsGet(KEY_PRO_UNLOCKED) === '1'; }
export function setProUnlocked(v) { lsSet(KEY_PRO_UNLOCKED, v ? '1' : '0'); }

// TEST MODE: block whole app until Pro unlocked
export function hardBlocked() {
  return !isProUnlocked();
}

// -------------------- Billing init --------------------
export async function initBilling() {
  if (_billingInitPromise) return _billingInitPromise;

  _billingInitPromise = (async () => {
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
      try { store.register([reg]); } catch { store.register(reg); }
    } catch {}

    // Unlock lifecycle (APPROVED is most reliable)
    try {
      if (typeof store.when === 'function') {
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
          .error(() => {});
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
      `Make sure it is Active and you installed from the correct Play testing track.`
    );
  }

  const offer = pickOrderableOffer(product);
  if (offer) {
    await offer.order();
    return;
  }

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

  if (typeof store.restorePurchases === 'function') {
    try {
      try { await store.restorePurchases(C?.Platform?.GOOGLE_PLAY); }
      catch { await store.restorePurchases(); }
    } catch {
      try { await store.update?.(); } catch {}
    }
  } else {
    try { await store.update?.(); } catch {}
  }

  try {
    const p = (typeof store.get === 'function') ? store.get(PRO_PRODUCT_ID) : null;
    if (p?.owned) setProUnlocked(true);
  } catch {}
}

// -------------------- Paywall Modal UI --------------------
export function hidePaywallModal() {
  try { document.getElementById('fireops-paywall-overlay')?.remove(); } catch {}
}

export function showPaywallModal() {
  // ALWAYS show in test mode if not unlocked
  if (!hardBlocked()) return;

  if (document.getElementById('fireops-paywall-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'fireops-paywall-overlay';
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,.75);
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
  title.textContent = 'Billing Test Mode';
  title.style.cssText = `font-size:22px; font-weight:900; margin-bottom:8px;`;

  const body = document.createElement('div');
  body.textContent = `This popup appears every launch for billing testing. Tap Buy Pro to test purchase, or Restore if you already own it.`;
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
  const restoreBtn = makeBtn('Restore', false);

  buyBtn.onclick = async () => {
    try {
      setMsg('Opening Google Play…');
      await buyPro();
      setMsg('Purchase started…');
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

  row.appendChild(buyBtn);
  row.appendChild(restoreBtn);

  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(row);
  card.appendChild(msg);
  overlay.appendChild(card);

  document.body.appendChild(overlay);
}
