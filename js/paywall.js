/* paywall.js — FireOps Calc (DEBUG TEST BUILD)
   - 5-day free trial for NEW installs only
   - Existing installs auto-grandfathered if user data is present
   - One-time purchase unlock (fireops.pro)
   - DEBUG overlay + detailed billing instrumentation (toggleable)
*/

export const PRO_PRODUCT_ID = 'fireops.pro';
export const TRIAL_DAYS = 5;

const KEY_INSTALL_TS = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED = 'fireops_pro_unlocked_v1';
const KEY_PAYWALL_HIDE = 'fireops_paywall_hide_v1';

// Debug enable switches
// - add ?debug=1 to URL (web)
// - or run localStorage.setItem('fireops_billing_debug','1') in console
const KEY_BILLING_DEBUG = 'fireops_billing_debug';

let _billingInitPromise = null;

function nowMs() { return Date.now(); }
function daysToMs(days) { return days * 24 * 60 * 60 * 1000; }

export function isNativeApp() {
  return !!(window.cordova || window.Capacitor?.isNativePlatform?.());
}

function getBillingStore() {
  return (window.CdvPurchase && window.CdvPurchase.store) || window.store || null;
}

function safeGetLS(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetLS(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

function isDebugEnabled() {
  try {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get('debug') === '1') return true;
  } catch {}
  return safeGetLS(KEY_BILLING_DEBUG) === '1';
}

// ===== DEBUG UI + LOGGING =====
function injectDebugCssOnce() {
  if (document.getElementById('fireopsDbgCss')) return;
  const css = `
    #fireopsDbgPanel{
      position:fixed; left:10px; right:10px; bottom:10px;
      z-index:100000; background:rgba(0,0,0,.88); color:#fff;
      border-radius:14px; padding:10px 10px 8px;
      font:12px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial;
      box-shadow:0 14px 40px rgba(0,0,0,.45);
      max-height:34vh; overflow:auto; display:none;
    }
    #fireopsDbgPanel .row{display:flex; gap:10px; align-items:center; justify-content:space-between;}
    #fireopsDbgPanel .btn{
      border:0; border-radius:10px; padding:6px 10px;
      background:#3b3b3b; color:#fff; cursor:pointer; font-weight:700;
    }
    #fireopsDbgPanel pre{white-space:pre-wrap; margin:8px 0 0 0;}
  `;
  const style = document.createElement('style');
  style.id = 'fireopsDbgCss';
  style.textContent = css;
  document.head.appendChild(style);
}

function ensureDebugPanel() {
  if (!isDebugEnabled()) return;
  injectDebugCssOnce();
  if (document.getElementById('fireopsDbgPanel')) return;

  const div = document.createElement('div');
  div.id = 'fireopsDbgPanel';
  div.innerHTML = `
    <div class="row">
      <strong>Billing Debug</strong>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn" id="fireopsDbgHide">Hide</button>
        <button class="btn" id="fireopsDbgClear">Clear</button>
      </div>
    </div>
    <pre id="fireopsDbgLog"></pre>
  `;
  document.body.appendChild(div);
  div.style.display = 'block';

  div.querySelector('#fireopsDbgHide')?.addEventListener('click', () => {
    div.style.display = 'none';
  });
  div.querySelector('#fireopsDbgClear')?.addEventListener('click', () => {
    const log = document.getElementById('fireopsDbgLog');
    if (log) log.textContent = '';
  });
}

function dbg(...args) {
  const enabled = isDebugEnabled();
  const msg = args.map(a => {
    try { return typeof a === 'string' ? a : JSON.stringify(a, null, 2); }
    catch { return String(a); }
  }).join(' ');

  // Always console.log (helps logcat too)
  try { console.log('[FIREOPS_BILLDBG]', msg); } catch {}

  if (!enabled) return;
  ensureDebugPanel();
  const log = document.getElementById('fireopsDbgLog');
  const panel = document.getElementById('fireopsDbgPanel');
  if (!log || !panel) return;

  panel.style.display = 'block';
  log.textContent += `${new Date().toLocaleTimeString()}  ${msg}\n`;
  log.scrollTop = log.scrollHeight;
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => dbg('window.error:', e.message, e.filename, e.lineno));
  window.addEventListener('unhandledrejection', (e) => dbg('unhandledrejection:', e.reason?.message || e.reason));
}

// ===== Trial / grandfather logic (unchanged) =====
function hasAnyExistingUserData() {
  const keys = [
    'fireops_dept_equipment_v1',
    'fireops_quickstart_seen_version',
    'fireops_practice_v1',
    'PRACTICE_SAVE_KEY',
    'fireops_presets_v1',
  ];
  try {
    for (const k of keys) {
      if (localStorage.getItem(k) != null) return true;
    }
  } catch {}
  return false;
}

function ensureInstallTimestamps() {
  const existing = safeGetLS(KEY_INSTALL_TS);
  if (!existing) {
    const oldUser = hasAnyExistingUserData();
    safeSetLS(KEY_GRANDFATHERED, oldUser ? '1' : '0');
    safeSetLS(KEY_INSTALL_TS, String(nowMs()));
  }
}

function getInstallMs() {
  const v = safeGetLS(KEY_INSTALL_TS);
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function isGrandfathered() {
  return safeGetLS(KEY_GRANDFATHERED) === '1';
}

export function isProUnlocked() {
  return safeGetLS(KEY_PRO_UNLOCKED) === '1';
}

export function setProUnlocked(val) {
  safeSetLS(KEY_PRO_UNLOCKED, val ? '1' : '0');
}

export function trialExpired() {
  const installMs = getInstallMs();
  if (!installMs) return false;
  return (nowMs() - installMs) >= daysToMs(TRIAL_DAYS);
}

export function hardBlocked() {
  if (isProUnlocked()) return false;
  if (isGrandfathered()) return false;
  return trialExpired();
}

function shouldShowPaywallIntro() {
  if (isProUnlocked()) return false;
  if (isGrandfathered()) return false;
  return true;
}

// ===== Paywall UI =====
function buildPaywallHtml() {
  const debugHint = isDebugEnabled()
    ? `<div style="margin-top:10px;font-size:12px;opacity:.75">
         DEBUG ON • logs will appear at bottom. (Disable by removing ?debug=1 or localStorage.fireops_billing_debug)
       </div>`
    : '';

  return `
  <div class="paywall-overlay" id="paywallOverlay" role="dialog" aria-modal="true" aria-label="FireOps Pro Paywall">
    <div class="paywall-card">
      <div class="paywall-hero">
        <img src="assets/firetruck.png" alt="FireOps Calc" class="paywall-truck" />
      </div>

      <div class="paywall-title">5-Day Free Trial</div>
      <div class="paywall-subtitle">
        FireOps Calc is free for ${TRIAL_DAYS} days. Unlock full access anytime with a one-time purchase.
      </div>

      <div class="paywall-actions">
        <button class="paywall-btn secondary" id="btnContinueTrial">Continue Free Trial</button>
        <button class="paywall-btn primary" id="btnPayNow">Unlock Pro — $1.99 one-time</button>
      </div>

      <label class="paywall-dontshow" id="dontShowRow">
        <input type="checkbox" id="chkDontShow" />
        Do not show this again
      </label>

      <div class="paywall-footnote">
        Purchases are processed through Google Play.
      </div>

      ${debugHint}
    </div>
  </div>
  `;
}

function injectPaywallCssOnce() {
  if (document.getElementById('paywallCss')) return;
  const css = `
    .paywall-overlay{
      position:fixed; inset:0; background:rgba(0,0,0,.65);
      display:flex; align-items:center; justify-content:center; z-index:99999;
      padding:16px;
    }
    .paywall-card{
      width:min(520px, 92vw);
      background:#121826; color:#fff; border-radius:16px;
      box-shadow:0 20px 50px rgba(0,0,0,.45);
      padding:18px 18px 14px 18px;
    }
    .paywall-hero{ display:flex; justify-content:center; margin-bottom:10px; }
    .paywall-truck{ max-width:240px; width:50%; height:auto; opacity:.95; }
    .paywall-title{ font-size:22px; font-weight:800; margin:6px 0 6px; }
    .paywall-subtitle{ font-size:15px; line-height:1.35; opacity:.92; margin-bottom:14px; }
    .paywall-actions{ display:flex; gap:12px; justify-content:flex-end; flex-wrap:wrap; }
    .paywall-btn{
      border:none; border-radius:12px; padding:12px 16px; font-weight:800;
      cursor:pointer; min-width:180px;
    }
    .paywall-btn.secondary{ background:transparent; color:#dbe6ff; border:1px solid rgba(255,255,255,.25); }
    .paywall-btn.primary{ background:#2a6bff; color:#fff; }
    .paywall-btn[disabled]{ opacity:.55; cursor:not-allowed; }
    .paywall-dontshow{ display:flex; gap:10px; align-items:center; margin-top:12px; opacity:.8; font-size:13px; }
    .paywall-footnote{ margin-top:10px; font-size:12px; opacity:.65; }
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

function dispatchUnlocked() {
  try {
    window.dispatchEvent(new CustomEvent('fireops:pro_unlocked', { detail: { productId: PRO_PRODUCT_ID } }));
  } catch {}
}

// ===== Billing (instrumented) =====
function getPlatformForRegister(store) {
  return (store.PLAY_STORE || store.Platform?.GOOGLE_PLAY || undefined);
}

function getInitPlatforms(store) {
  const platforms = [];
  if (store?.PLAY_STORE) platforms.push(store.PLAY_STORE);
  else if (store?.Platform?.GOOGLE_PLAY) platforms.push(store.Platform.GOOGLE_PLAY);
  else if (store?.APPLE_APPSTORE) platforms.push(store.APPLE_APPSTORE);
  else if (store?.Platform?.APPLE_APPSTORE) platforms.push(store.Platform.APPLE_APPSTORE);
  return platforms.length ? platforms : undefined;
}

function attachStoreDebug(store) {
  // Only attach once
  if (store.__fireopsDbgAttached) return;
  store.__fireopsDbgAttached = true;

  try {
    store.error((e) => dbg('store.error:', e?.code, e?.message, e));
  } catch (e) {
    dbg('store.error attach failed:', e?.message || e);
  }

  try {
    store.when(PRO_PRODUCT_ID).registered((p) => dbg('event: registered', p?.id));
    store.when(PRO_PRODUCT_ID).updated((p) => dbg('event: updated', {
      id: p?.id,
      state: p?.state,
      owned: p?.owned,
      canPurchase: p?.canPurchase,
      title: p?.title,
      price: p?.pricing?.price
    }));

    store.when(PRO_PRODUCT_ID).approved((p) => {
      dbg('event: approved', p?.id || p);
      try { p.verify(); dbg('approved: verify() called'); } catch (e) { dbg('approved: verify() failed', e?.message || e); }
    });

    store.when(PRO_PRODUCT_ID).verified((p) => {
      dbg('event: verified', p?.id || p);
      setProUnlocked(true);
      dispatchUnlocked();
      try { p.finish(); dbg('verified: finish() called'); } catch (e) { dbg('verified: finish() failed', e?.message || e); }
      // ✅ Only close paywall when we actually unlock
      removePaywall();
    });

    // Some setups fire owned rather than verified depending on validation config
    store.when(PRO_PRODUCT_ID).owned((p) => {
      dbg('event: owned', p?.id || p);
      setProUnlocked(true);
      dispatchUnlocked();
      // ✅ close paywall when owned as well
      removePaywall();
    });

    store.when(PRO_PRODUCT_ID).cancelled((p) => dbg('event: cancelled', p?.id || p));
    store.when(PRO_PRODUCT_ID).finished((p) => dbg('event: finished', p?.id || p));
  } catch (e) {
    dbg('attachStoreDebug failed:', e?.message || e);
  }
}

export async function initBilling() {
  if (_billingInitPromise) return _billingInitPromise;

  _billingInitPromise = (async () => {
    dbg('initBilling() start. isNativeApp=', isNativeApp());
    if (!isNativeApp()) return;

    const store = getBillingStore();
    dbg('billing store present?', !!store);

    if (!store) {
      dbg('❌ No billing store found (window.CdvPurchase.store / window.store missing).');
      return;
    }

    attachStoreDebug(store);

    // Register product
    try {
      const platform = getPlatformForRegister(store);
      dbg('register product', { id: PRO_PRODUCT_ID, type: store.NON_CONSUMABLE, platform });
      store.register({
        id: PRO_PRODUCT_ID,
        type: store.NON_CONSUMABLE,
        platform
      });
    } catch (e) {
      dbg('register failed:', e?.message || e);
    }

    // Initialize + update
    try {
      const platforms = getInitPlatforms(store);
      dbg('store.initialize platforms=', platforms);
      await store.initialize(platforms);
      dbg('store.initialize done');

      try {
        dbg('store.update start');
        await store.update();
        dbg('store.update done');
      } catch (e) {
        dbg('store.update failed:', e?.message || e);
      }

      // Check if product exists
      try {
        const p = store.get(PRO_PRODUCT_ID);
        dbg('store.get(PRO_PRODUCT_ID)=', p ? {
          id: p.id,
          title: p.title,
          state: p.state,
          owned: p.owned,
          canPurchase: p.canPurchase,
          price: p.pricing?.price
        } : 'NULL (product not returned by Play)');
      } catch (e) {
        dbg('store.get failed:', e?.message || e);
      }
    } catch (e) {
      dbg('initialize failed:', e?.message || e);
    }
  })();

  return _billingInitPromise;
}

export async function buyPro() {
  const store = getBillingStore();
  if (!store) throw new Error('Billing not available: store missing');

  await initBilling();

  // Refresh product list (best-effort)
  try {
    dbg('buyPro: store.update start');
    await store.update();
    dbg('buyPro: store.update done');
  } catch (e) {
    dbg('buyPro: store.update failed:', e?.message || e);
  }

  // Confirm product present (debug)
  try {
    const p = store.get(PRO_PRODUCT_ID);
    dbg('buyPro: product check=', p ? {
      id: p.id,
      state: p.state,
      owned: p.owned,
      canPurchase: p.canPurchase,
      price: p.pricing?.price
    } : 'NULL');
  } catch (e) {
    dbg('buyPro: store.get failed:', e?.message || e);
  }

  // Order
  try {
    dbg('buyPro: calling store.order', PRO_PRODUCT_ID);
    return await store.order(PRO_PRODUCT_ID);
  } catch (e) {
    dbg('buyPro: store.order failed:', e?.message || e);
    throw new Error(e?.message || String(e));
  }
}

export function showPaywallModal({ force = false } = {}) {
  ensureInstallTimestamps();

  if (!force) {
    if (!shouldShowPaywallIntro()) return;

    // Allow hide during trial only
    const dontShow = safeGetLS(KEY_PAYWALL_HIDE) === '1';
    if (dontShow && !hardBlocked()) return;
  }

  injectPaywallCssOnce();
  if (document.getElementById('paywallOverlay')) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildPaywallHtml();
  document.body.appendChild(wrapper.firstElementChild);

  // If debug on, show panel immediately
  if (isDebugEnabled()) ensureDebugPanel();

  const btnContinue = document.getElementById('btnContinueTrial');
  const btnPay = document.getElementById('btnPayNow');
  const chk = document.getElementById('chkDontShow');
  const dontShowRow = document.getElementById('dontShowRow');

  // Hard block: disable continue + no "dont show"
  if (hardBlocked()) {
    if (btnContinue) {
      btnContinue.disabled = true;
      btnContinue.textContent = 'Trial Ended';
    }
    if (dontShowRow) dontShowRow.style.display = 'none';
  }

  if (chk) chk.checked = safeGetLS(KEY_PAYWALL_HIDE) === '1';

  chk?.addEventListener('change', () => {
    safeSetLS(KEY_PAYWALL_HIDE, chk.checked ? '1' : '0');
  });

  btnContinue?.addEventListener('click', () => {
    if (hardBlocked()) return;
    removePaywall();
  });

  btnPay?.addEventListener('click', async () => {
    if (!btnPay) return;
    try {
      dbg('PAY CLICK');
      btnPay.disabled = true;
      btnPay.textContent = 'Opening Google Play…';

      // Watchdog: if no verified/owned after 20s, restore button and keep paywall open
      const watchdogMs = 20000;
      let watchdogHit = false;
      const watchdog = setTimeout(() => {
        watchdogHit = true;
        dbg(`⏱ Watchdog: no verified/owned after ${watchdogMs}ms. Pay UI may not have launched, product missing, or purchase cancelled.`);
        btnPay.disabled = false;
        btnPay.textContent = 'Unlock Pro — $1.99 one-time';
      }, watchdogMs);

      await buyPro();
      dbg('store.order resolved (does NOT mean purchased). Waiting for verified/owned…');

      // Do NOT close paywall here.
      // It will close on verified/owned events in attachStoreDebug.
      // If purchase completes quickly, verified/owned will fire and close paywall.

      // If it completed immediately and unlocked already, cancel watchdog
      // (removePaywall triggers only on verified/owned; also check flag)
      const poll = setInterval(() => {
        if (isProUnlocked()) {
          clearInterval(poll);
          clearTimeout(watchdog);
          dbg('Unlocked detected (poll).');
        }
        if (watchdogHit) {
          clearInterval(poll);
          clearTimeout(watchdog);
        }
      }, 500);

    } catch (e) {
      dbg('PAY ERROR:', e?.message || e);
      btnPay.disabled = false;
      btnPay.textContent = 'Unlock Pro — $1.99 one-time';
      // Show an alert in debug builds so you see it on device
      if (isDebugEnabled()) {
        try { alert(`Purchase error:\n${e?.message || e}`); } catch {}
      }
    }
  });

  // Non-blocking init
  initBilling();
}

// Optional compatibility
window.fireOpsPaywall = {
  initBilling,
  showPaywallModal,
  hardBlocked,
  isProUnlocked,
  setProUnlocked,
  buyPro,
  isNativeApp
};
