/* paywall.js — FireOps Calc (PRODUCTION)
   - Product ID: fireops.pro (ONE-TIME PRODUCT)
   - Trial: 5 days (unless grandfathered)
   - No debug UI
   - Grandfathered users bypass paywall + bypass trial blocking
*/

export const PRO_PRODUCT_ID = 'fireops.pro';
export const TRIAL_DAYS = 5;

const KEY_INSTALL_TS    = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED  = 'fireops_pro_unlocked_v1';
const KEY_PAYWALL_HIDE  = 'fireops_paywall_hide_v1';

let _billingInitPromise = null;

// -------------------- localStorage safe --------------------
function lsGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, val); } catch {} }
function lsDel(key) { try { localStorage.removeItem(key); } catch {} }

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
    if (p) return p; // 'android' | 'ios' | 'web'
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
    // ✅ Grandfathered users ON again
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
  // ✅ Grandfathered users are never blocked
  if (isProUnlocked()) return false;
  if (isGrandfathered()) return false;
  return trialExpired();
}

function daysRemaining() {
  const im = installMs();
  if (!im) return TRIAL_DAYS;
  const elapsed = nowMs() - im;
  const remaining = TRIAL_DAYS - Math.floor(elapsed / daysToMs(1));
  return Math.max(0, remaining);
}

// -------------------- UI --------------------
function injectCssOnce() {
  if (document.getElementById('paywallCss')) return;
  const css = `
    .paywall-overlay{position:fixed; inset:0; background:rgba(0,0,0,.72); display:flex; align-items:center; justify-content:center; z-index:99999; padding:16px;}
    .paywall-card{width:min(560px,94vw); background:#121826; color:#fff; border-radius:16px; box-shadow:0 20px 50px rgba(0,0,0,.45); padding:18px;}
    .paywall-title{font-size:22px; font-weight:800; margin:6px 0;}
    .paywall-subtitle{font-size:15px; line-height:1.35; opacity:.92; margin-bottom:14px;}
    .paywall-actions{display:flex; gap:12px; justify-content:flex-end; flex-wrap:wrap;}
    .paywall-btn{border:none; border-radius:12px; padding:12px 16px; font-weight:800; cursor:pointer; min-width:200px;}
    .paywall-btn.secondary{background:transparent; color:#dbe6ff; border:1px solid rgba(255,255,255,.25);}
    .paywall-btn.primary{background:#2a6bff; color:#fff;}
    .paywall-btn[disabled]{opacity:.55; cursor:not-allowed;}
    .paywall-row{display:flex; gap:12px; justify-content:space-between; flex-wrap:wrap; margin-top:10px;}
    .paywall-footnote{margin-top:10px; font-size:12px; opacity:.65;}
    .pw-mini{font-size:12px; opacity:.85; line-height:1.25; margin-top:10px;}
  `;
  const style = document.createElement('style');
  style.id = 'paywallCss';
  style.textContent = css;
  document.head.appendChild(style);
}

function removePaywall() {
  const overlay = document.getElementById('paywallOverlay');
  if (overlay) overlay.remove();
}

function buildHtml({ blocked }) {
  const remaining = daysRemaining();
  const subtitle = blocked
    ? `Your ${TRIAL_DAYS}-day free trial has ended. Unlock Pro to continue using FireOps Calc.`
    : `FireOps Calc is free for ${TRIAL_DAYS} days. You have ${remaining} day(s) left. Unlock Pro anytime with a one-time purchase.`;

  return `
  <div class="paywall-overlay" id="paywallOverlay">
    <div class="paywall-card">
      <div class="paywall-title">${blocked ? 'Trial Ended' : '5-Day Free Trial'}</div>
      <div class="paywall-subtitle">${subtitle}</div>

      <div class="paywall-actions">
        ${blocked ? '' : `<button class="paywall-btn secondary" id="btnContinue">Continue Free Trial</button>`}
        <button class="paywall-btn primary" id="btnBuy">Unlock Pro — $1.99 one-time</button>
      </div>

      <div class="paywall-row">
        <button class="paywall-btn secondary" id="btnRestore">Restore Purchases</button>
        ${blocked ? '' : `<button class="paywall-btn secondary" id="btnHide">Don't show again</button>`}
      </div>

      <div class="pw-mini" id="pwMini"></div>
      <div class="paywall-footnote">Purchases are processed through Google Play.</div>
    </div>
  </div>`;
}

function refreshMini() {
  const mini = document.getElementById('pwMini');
  if (!mini) return;
  mini.innerHTML = `
    Product: <b>${PRO_PRODUCT_ID}</b><br/>
    Trial days remaining: <b>${daysRemaining()}</b><br/>
  `;
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

    // Purchase lifecycle
    try {
      if (typeof store.when === 'function') {
        const w = store.when(PRO_PRODUCT_ID);

        w?.approved?.((p) => { try { p.verify(); } catch {} });

        w?.verified?.((p) => {
          setProUnlocked(true);
          try { p.finish(); } catch {}
          try { window.dispatchEvent(new CustomEvent('fireops:pro_unlocked')); } catch {}
        });

        w?.error?.((err) => { try { console.warn('[billing] error', err); } catch {} });
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
    throw new Error(`Product not returned by Play (${PRO_PRODUCT_ID}). Make sure it is Active and installed from the correct Play testing track.`);
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
    // Some builds use "update" as restore-ish
    try { await store.update(); } catch {}
  }
}

// -------------------- PUBLIC: showPaywallModal --------------------
export function showPaywallModal({ force = false } = {}) {
  ensureInstallTimestamps();

  // ✅ Grandfathered users bypass paywall entirely
  if (!force) {
    if (!isNativeApp()) return;
    if (isProUnlocked()) return;
    if (isGrandfathered()) return;

    const dontShow = lsGet(KEY_PAYWALL_HIDE) === '1';
    if (dontShow && !hardBlocked()) return;
  }

  injectCssOnce();
  if (document.getElementById('paywallOverlay')) return;

  const blocked = hardBlocked();
  const wrap = document.createElement('div');
  wrap.innerHTML = buildHtml({ blocked });
  document.body.appendChild(wrap.firstElementChild);

  refreshMini();

  const btnBuy = document.getElementById('btnBuy');
  const btnRestore = document.getElementById('btnRestore');
  const btnContinue = document.getElementById('btnContinue');
  const btnHide = document.getElementById('btnHide');

  // When hard-blocked: do not allow closing via background click
  const overlay = document.getElementById('paywallOverlay');
  if (!blocked && overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) removePaywall();
    });
  }

  btnContinue?.addEventListener('click', () => removePaywall());

  btnHide?.addEventListener('click', () => {
    lsSet(KEY_PAYWALL_HIDE, '1');
    removePaywall();
  });

  btnRestore?.addEventListener('click', async () => {
    try {
      btnRestore.disabled = true;
      btnRestore.textContent = 'Restoring…';
      await restorePurchases();
      btnRestore.textContent = 'Restore Purchases';
      if (isProUnlocked()) removePaywall();
    } catch (e) {
      btnRestore.textContent = 'Restore Purchases';
      try { console.warn('[billing] restore failed', e); } catch {}
    } finally {
      btnRestore.disabled = false;
    }
  });

  btnBuy?.addEventListener('click', async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    try {
      btnBuy.disabled = true;
      btnBuy.textContent = 'Opening Google Play…';
      await buyPro();
      // Purchase UI should appear; keep modal until verified event unlocks
      btnBuy.textContent = 'Waiting for purchase…';
    } catch (err) {
      btnBuy.disabled = false;
      btnBuy.textContent = 'Unlock Pro — $1.99 one-time';
      try { console.warn('[billing] buy failed', err); } catch {}
    }
  });

  // Prime billing in background (native only)
  initBilling().catch(() => {});
}

// Optional: production-safe reset helper (not exposed on window)
export function _resetPaywallForSupport() {
  lsDel(KEY_PAYWALL_HIDE);
  // NOTE: do NOT wipe grandfathered automatically
}
