/* =========================================================
   paywall.js (FULL) — FireOps Calc
   Compatible with cordova-plugin-purchase v12 API shape
   One-time product (non-consumable) SKU: fireops.pro
   Trial: 5 days
   ========================================================= */

/** -------- CONFIG -------- **/
const PRODUCT_ID = 'fireops.pro';
const TRIAL_DAYS = 5;

// localStorage keys
const LS_INSTALL_TS = 'fireops_install_ts_v1';
const LS_PRO = 'fireops_pro_unlocked_v1';
const LS_HIDE_INTRO = 'fireops_hide_paywall_intro_v1';
const LS_DEBUG_LOG = 'fireops_paywall_debug_log_v1';

/** -------- INTERNAL STATE -------- **/
let storeRef = null;
let productRef = null;
let billingReady = false;
let listenersAttached = false;
let paywallEl = null;
let debugPanelEl = null;
let debugLogEl = null;
let purchaseInProgress = false;

/** -------- SMALL UTILS -------- **/
function isNative() {
  return !!(window.cordova || window.Capacitor?.isNativePlatform?.());
}
function isAndroid() {
  return (
    window.cordova?.platformId === 'android' ||
    window.Capacitor?.getPlatform?.() === 'android' ||
    /Android/i.test(navigator.userAgent)
  );
}
function nowMs() { return Date.now(); }
function daysToMs(d) { return d * 24 * 60 * 60 * 1000; }

function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

function persistLog(line) {
  try {
    const prev = localStorage.getItem(LS_DEBUG_LOG) || '';
    localStorage.setItem(LS_DEBUG_LOG, (prev + line).slice(-20000));
  } catch {}
}

function log(msg, obj) {
  const s = obj ? `${msg} ${safeJson(obj)}` : msg;
  const line = `[PW ${new Date().toLocaleTimeString()}] ${s}\n`;
  console.log(line.trim());
  persistLog(line);

  if (debugLogEl) {
    debugLogEl.textContent += line;
    debugLogEl.scrollTop = debugLogEl.scrollHeight;
  }
}

function safeJson(x) {
  try { return JSON.stringify(x); } catch { return String(x); }
}

/** -------- TRIAL / PRO -------- **/
export function ensureInstallTimestamp() {
  const v = lsGet(LS_INSTALL_TS);
  if (!v) lsSet(LS_INSTALL_TS, String(nowMs()));
}
export function isProUnlocked() {
  return lsGet(LS_PRO) === '1';
}
export function setProUnlocked(v) {
  lsSet(LS_PRO, v ? '1' : '0');
}
export function trialExpired() {
  ensureInstallTimestamp();
  const ts = Number(lsGet(LS_INSTALL_TS));
  if (!Number.isFinite(ts)) return false;
  return (nowMs() - ts) >= daysToMs(TRIAL_DAYS);
}
export function hardBlocked() {
  // After trial expires, must be pro to continue
  if (isProUnlocked()) return false;
  return trialExpired();
}

/** -------- UI: PAYWALL MODAL -------- **/
function injectCssOnce() {
  if (document.getElementById('fireopsPaywallCss')) return;
  const css = `
    .pwOverlay{position:fixed;inset:0;background:rgba(0,0,0,.68);display:flex;align-items:center;justify-content:center;z-index:999999;padding:16px;}
    .pwCard{width:min(560px,94vw);background:#121826;color:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5);padding:18px;}
    .pwTitle{font-size:22px;font-weight:900;margin:2px 0 8px;}
    .pwSub{font-size:14px;opacity:.92;line-height:1.35;margin:0 0 12px;}
    .pwBtns{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:10px;}
    .pwBtn{border:0;border-radius:12px;padding:12px 14px;font-weight:900;cursor:pointer;min-width:180px;}
    .pwBtnPrimary{background:#2a6bff;color:#fff;}
    .pwBtnSecondary{background:transparent;border:1px solid rgba(255,255,255,.25);color:#dbe6ff;}
    .pwBtn[disabled]{opacity:.55;cursor:not-allowed;}
    .pwRow{display:flex;gap:10px;justify-content:space-between;align-items:center;margin-top:10px;flex-wrap:wrap;}
    .pwCheck{display:flex;gap:10px;align-items:center;opacity:.85;font-size:13px;margin-top:10px;}
    .pwDiag{margin-top:10px;font-size:12px;opacity:.9;}
    /* Debug panel */
    .pwDbg{position:fixed;left:10px;right:10px;bottom:10px;max-height:42vh;overflow:auto;z-index:9999999;background:rgba(0,0,0,.9);color:#fff;border-radius:14px;padding:10px;font:12px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial;display:none;}
    .pwDbgTop{display:flex;justify-content:space-between;align-items:center;gap:10px;}
    .pwDbgBtn{border:0;border-radius:10px;padding:6px 10px;background:#3b3b3b;color:#fff;font-weight:900;cursor:pointer;}
    .pwDbg pre{white-space:pre-wrap;margin:8px 0 0;}
  `;
  const style = document.createElement('style');
  style.id = 'fireopsPaywallCss';
  style.textContent = css;
  document.head.appendChild(style);
}

function buildPaywall() {
  injectCssOnce();

  if (document.getElementById('fireopsPaywall')) return;

  paywallEl = document.createElement('div');
  paywallEl.id = 'fireopsPaywall';
  paywallEl.className = 'pwOverlay';

  const blocked = hardBlocked();

  paywallEl.innerHTML = `
    <div class="pwCard" role="dialog" aria-modal="true" aria-label="FireOps Pro Paywall">
      <div class="pwTitle">${blocked ? 'Trial Ended' : `${TRIAL_DAYS}-Day Free Trial`}</div>
      <div class="pwSub">
        ${blocked
          ? `Your free trial has ended. Unlock Pro to continue using the app.`
          : `FireOps Calc is free for ${TRIAL_DAYS} days. Unlock Pro anytime with a one-time purchase.`}
      </div>

      <div class="pwBtns">
        <button class="pwBtn pwBtnSecondary" id="pwContinue" ${blocked ? 'disabled' : ''}>
          Continue Free Trial
        </button>
        <button class="pwBtn pwBtnPrimary" id="pwBuy">
          Unlock Pro — $1.99 one-time
        </button>
      </div>

      <div class="pwRow">
        <button class="pwBtn pwBtnSecondary" id="pwRestore">Restore Purchases</button>
        <button class="pwBtn pwBtnSecondary" id="pwDebug">Show Debug</button>
      </div>

      ${blocked ? '' : `
        <label class="pwCheck">
          <input type="checkbox" id="pwHideIntro"/>
          Do not show this again
        </label>
      `}

      <div class="pwDiag" id="pwDiag"></div>
    </div>
  `;

  document.body.appendChild(paywallEl);

  // restore checkbox state
  const hideIntro = lsGet(LS_HIDE_INTRO) === '1';
  const chk = document.getElementById('pwHideIntro');
  if (chk) chk.checked = hideIntro;

  // wire buttons
  document.getElementById('pwContinue')?.addEventListener('click', () => {
    if (hardBlocked()) return;
    closePaywall();
  });

  document.getElementById('pwBuy')?.addEventListener('click', async () => {
    await onBuyClicked();
  });

  document.getElementById('pwRestore')?.addEventListener('click', async () => {
    await onRestoreClicked();
  });

  document.getElementById('pwDebug')?.addEventListener('click', () => {
    showDebug(true);
  });

  chk?.addEventListener('change', () => {
    lsSet(LS_HIDE_INTRO, chk.checked ? '1' : '0');
  });

  setDiag('');
}

function setDiag(text) {
  const el = document.getElementById('pwDiag');
  if (el) el.textContent = text || '';
}

export function closePaywall() {
  document.getElementById('fireopsPaywall')?.remove();
  paywallEl = null;
  setDiag('');
}

/** -------- UI: DEBUG PANEL -------- **/
function buildDebugPanel() {
  injectCssOnce();
  if (document.getElementById('fireopsPaywallDebug')) return;

  debugPanelEl = document.createElement('div');
  debugPanelEl.id = 'fireopsPaywallDebug';
  debugPanelEl.className = 'pwDbg';

  debugPanelEl.innerHTML = `
    <div class="pwDbgTop">
      <strong>Billing Debug</strong>
      <div style="display:flex;gap:8px;">
        <button class="pwDbgBtn" id="pwDbgCopy">Copy</button>
        <button class="pwDbgBtn" id="pwDbgClear">Clear</button>
        <button class="pwDbgBtn" id="pwDbgHide">Hide</button>
      </div>
    </div>
    <pre id="pwDbgLog"></pre>
  `;

  document.body.appendChild(debugPanelEl);
  debugLogEl = debugPanelEl.querySelector('#pwDbgLog');

  // Load persisted logs
  debugLogEl.textContent = lsGet(LS_DEBUG_LOG) || '';

  debugPanelEl.querySelector('#pwDbgHide')?.addEventListener('click', () => showDebug(false));
  debugPanelEl.querySelector('#pwDbgClear')?.addEventListener('click', () => {
    lsSet(LS_DEBUG_LOG, '');
    if (debugLogEl) debugLogEl.textContent = '';
  });
  debugPanelEl.querySelector('#pwDbgCopy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(debugLogEl?.textContent || '');
      log('✅ Copied debug log to clipboard');
    } catch {
      log('❌ Clipboard copy failed');
    }
  });
}

export function showDebug(on) {
  buildDebugPanel();
  const el = document.getElementById('fireopsPaywallDebug');
  if (el) el.style.display = on ? 'block' : 'none';
}

/** -------- BILLING (cordova-plugin-purchase v12 style) -------- **/
function getStore() {
  return window.store || (window.CdvPurchase && window.CdvPurchase.store) || null;
}

export function initBilling() {
  ensureInstallTimestamp();
  showDebug(false); // panel exists but hidden

  log(`initBilling start. native=${isNative()} android=${isAndroid()}`);

  if (!isNative()) {
    log('Not native build → billing disabled');
    billingReady = false;
    return;
  }

  storeRef = getStore();
  if (!storeRef) {
    log('ERROR: store not found on window (plugin missing from build)');
    billingReady = false;
    return;
  }

  // Save reference for convenience
  const store = storeRef;

  // some versions use store.DEBUG; safe set
  try { store.verbosity = store.DEBUG; } catch {}

  // Attach listeners once
  if (!listenersAttached) {
    listenersAttached = true;

    // product lifecycle events
    try {
      store.when(PRODUCT_ID).updated(p => {
        productRef = p;
        log('event: updated', summarizeProduct(p));
      });
    } catch (e) {
      log('when(updated) attach failed: ' + (e?.message || e));
    }

    try {
      store.when(PRODUCT_ID).approved(p => {
        log('event: approved');
        try { p.finish(); } catch (e) { log('finish() failed: ' + (e?.message || e)); }
      });
    } catch (e) {
      log('when(approved) attach failed: ' + (e?.message || e));
    }

    try {
      store.when(PRODUCT_ID).owned(p => {
        productRef = p;
        log('event: owned → unlock');
        setProUnlocked(true);
        purchaseInProgress = false;
        setDiag('Owned ✅ Unlocking…');
        closePaywall();
      });
    } catch (e) {
      log('when(owned) attach failed: ' + (e?.message || e));
    }

    // global error handler
    try {
      store.error(err => {
        log('store.error', err);
        purchaseInProgress = false;
        setDiag('Billing error. Open Debug.');
      });
    } catch (e) {
      log('store.error attach failed: ' + (e?.message || e));
    }

    // ready handler
    try {
      store.ready(() => {
        billingReady = true;
        productRef = safeGetProduct(store);
        log('store.ready. product loaded=' + (!!productRef), productRef ? summarizeProduct(productRef) : null);
      });
    } catch (e) {
      log('store.ready attach failed: ' + (e?.message || e));
    }
  }

  // Register product (safe to call multiple times)
  try {
    log('register', { id: PRODUCT_ID, type: 'NON_CONSUMABLE' });
    store.register({ id: PRODUCT_ID, type: store.NON_CONSUMABLE });
  } catch (e) {
    log('REGISTER ERROR: ' + (e?.message || e));
  }

  // Initialize platform: FORCE GOOGLE PLAY on Android
  try {
    if (typeof store.initialize === 'function') {
      if (isAndroid()) {
        log('initialize platforms: [GOOGLE_PLAY]');
        store.initialize([store.GOOGLE_PLAY]);
      } else {
        // If you ever ship iOS, this can be updated later
        log('initialize platforms: (non-android) using default');
        store.initialize();
      }
    } else {
      log('store.initialize not found (older plugin?)');
    }
  } catch (e) {
    log('initialize failed: ' + (e?.message || e));
  }

  // Refresh to fetch product details
  safeRefresh(store);

  // Post-check shortly after init
  setTimeout(() => {
    productRef = safeGetProduct(store);
    log('post-init productRef=' + (productRef ? 'YES' : 'NO'), productRef ? summarizeProduct(productRef) : null);
  }, 800);
}

function safeRefresh(store) {
  try {
    if (typeof store.refresh === 'function') {
      log('store.refresh()');
      store.refresh();
      return;
    }
    if (typeof store.update === 'function') {
      log('store.update()');
      store.update();
      return;
    }
    log('No refresh/update method found');
  } catch (e) {
    log('refresh/update error: ' + (e?.message || e));
  }
}

function safeGetProduct(store) {
  try {
    if (typeof store.get === 'function') return store.get(PRODUCT_ID) || null;
  } catch {}
  return null;
}

function summarizeProduct(p) {
  return {
    id: p?.id,
    state: p?.state,
    owned: !!p?.owned,
    canPurchase: !!p?.canPurchase,
    price: p?.price || p?.pricing?.localizedPrice || p?.pricing?.price
  };
}

/** -------- BUY / RESTORE BUTTON HANDLERS -------- **/
async function onBuyClicked() {
  const buyBtn = document.getElementById('pwBuy');
  if (!buyBtn) return;

  if (purchaseInProgress) return;

  purchaseInProgress = true;
  buyBtn.disabled = true;
  buyBtn.textContent = 'Opening Google Play…';
  setDiag('Starting purchase…');

  try {
    initBilling();

    // Give it a moment to pull product
    await waitMs(700);

    const store = storeRef || getStore();
    if (!store) throw new Error('Billing store missing');

    productRef = productRef || safeGetProduct(store);

    log('buy clicked. productRef=' + (productRef ? 'YES' : 'NO'), productRef ? summarizeProduct(productRef) : null);

    if (!productRef) {
      purchaseInProgress = false;
      buyBtn.disabled = false;
      buyBtn.textContent = 'Unlock Pro — $1.99 one-time';
      setDiag('❌ Product not returned. Open Debug and confirm install/tester/track.');
      return;
    }

    if (productRef.owned) {
      setProUnlocked(true);
      closePaywall();
      return;
    }

    if (productRef.canPurchase === false) {
      purchaseInProgress = false;
      buyBtn.disabled = false;
      buyBtn.textContent = 'Unlock Pro — $1.99 one-time';
      setDiag('❌ Product cannot be purchased (not eligible or not loaded). Open Debug.');
      return;
    }

    // cordova-plugin-purchase v12: store.order is NOT a Promise
    log('calling store.order("' + PRODUCT_ID + '")');
    store.order(PRODUCT_ID);

    // Watchdog: if no owned event happens, re-enable button
    setTimeout(() => {
      if (purchaseInProgress && !isProUnlocked()) {
        log('watchdog: no owned event yet');
        purchaseInProgress = false;
        buyBtn.disabled = false;
        buyBtn.textContent = 'Unlock Pro — $1.99 one-time';
        setDiag('⏱ No confirmation yet. If Play UI didn’t appear, check Debug.');
      }
    }, 25000);

  } catch (e) {
    log('PAY ERROR: ' + (e?.message || e));
    purchaseInProgress = false;
    buyBtn.disabled = false;
    buyBtn.textContent = 'Unlock Pro — $1.99 one-time';
    setDiag('Purchase error. Open Debug.');
  }
}

async function onRestoreClicked() {
  const btn = document.getElementById('pwRestore');
  if (!btn) return;

  btn.disabled = true;
  const oldTxt = btn.textContent;
  btn.textContent = 'Restoring…';
  setDiag('Restoring…');

  try {
    initBilling();
    await waitMs(600);

    const store = storeRef || getStore();
    if (!store) throw new Error('Billing store missing');

    safeRefresh(store);
    await waitMs(800);

    productRef = safeGetProduct(store);
    log('restore: productRef=' + (productRef ? 'YES' : 'NO'), productRef ? summarizeProduct(productRef) : null);

    if (productRef?.owned) {
      setProUnlocked(true);
      setDiag('Owned ✅ Restored');
      closePaywall();
    } else {
      setDiag('No purchase found to restore.');
    }
  } catch (e) {
    log('RESTORE ERROR: ' + (e?.message || e));
    setDiag('Restore error. Open Debug.');
  } finally {
    btn.disabled = false;
    btn.textContent = oldTxt;
  }
}

function waitMs(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** -------- MAIN ENTRY: call this from app.js -------- **/
export function enforcePaywall({ force = false } = {}) {
  ensureInstallTimestamp();

  // If already pro, never show
  if (isProUnlocked()) return;

  // If user chose "do not show again" and not blocked, do nothing
  const hideIntro = lsGet(LS_HIDE_INTRO) === '1';
  if (!force && hideIntro && !hardBlocked()) return;

  // If not blocked (trial active), show intro paywall optionally
  // If blocked, MUST show paywall
  buildPaywall();
  initBilling();
}

/** Optional: helper to force show */
export function showPaywallNow() {
  enforcePaywall({ force: true });
}

/** Optional: expose globals for quick button wiring in older builds */
window.fireOpsPaywall = {
  enforcePaywall,
  showPaywallNow,
  initBilling,
  showDebug,
  isProUnlocked,
  hardBlocked
};
