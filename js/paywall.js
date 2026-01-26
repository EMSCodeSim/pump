/* paywall.js — FireOps Calc (FIXED)
   - One-time purchase productId: fireops.pro
   - 5-day free trial for new installs (unless grandfathered)
   - IMPORTANT FIX: Never force iOS adapter on Android.
   - Adds full on-screen debug log.
*/

export const PRO_PRODUCT_ID = 'fireops.pro';
export const TRIAL_DAYS = 5;

const KEY_INSTALL_TS      = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED   = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED    = 'fireops_pro_unlocked_v1';
const KEY_PAYWALL_HIDE    = 'fireops_paywall_hide_v1';
const KEY_DEBUG_ENABLED   = 'fireops_paywall_debug_v1';
const KEY_DEBUG_LOG       = 'fireops_paywall_debug_log_v1';

let _billingInitPromise = null;

// -------------------- helpers --------------------
function nowMs() { return Date.now(); }
function daysToMs(days) { return days * 24 * 60 * 60 * 1000; }

function safeGetLS(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetLS(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

function isDebugEnabled() {
  try {
    const qs = new URLSearchParams(location.search);
    if (qs.get('pwdebug') === '1') return true;
  } catch {}
  return safeGetLS(KEY_DEBUG_ENABLED) === '1';
}
function setDebugEnabled(v) { safeSetLS(KEY_DEBUG_ENABLED, v ? '1' : '0'); }

function appendDebug(line) {
  const ts = new Date().toLocaleTimeString();
  const msg = `${ts}  ${line}`;
  try {
    const existing = safeGetLS(KEY_DEBUG_LOG) || '';
    const next = (existing + msg + '\n').slice(-14000);
    safeSetLS(KEY_DEBUG_LOG, next);
  } catch {}

  const pre = document.getElementById('pwDebugPre');
  if (pre) {
    pre.textContent = (safeGetLS(KEY_DEBUG_LOG) || '').trimEnd();
    pre.scrollTop = pre.scrollHeight;
  }

  try { console.log('[PW]', line); } catch {}
}

export function isNativeApp() {
  // Works for Capacitor and cordova
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
  // fallback
  if (window.cordova && /Android/i.test(navigator.userAgent)) return 'android';
  if (window.cordova && /iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios';
  return 'web';
}

function getCdvPurchase() {
  return window.CdvPurchase || null;
}

function getBillingStore() {
  // cordova-plugin-purchase v13: window.CdvPurchase.store
  const C = getCdvPurchase();
  if (C?.store) return C.store;
  // fallback (older code paths)
  return window.store || null;
}

// -------------------- trial logic --------------------
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

export function isGrandfathered() { return safeGetLS(KEY_GRANDFATHERED) === '1'; }
export function isProUnlocked() { return safeGetLS(KEY_PRO_UNLOCKED) === '1'; }
export function setProUnlocked(val) { safeSetLS(KEY_PRO_UNLOCKED, val ? '1' : '0'); }

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

// -------------------- UI --------------------
function injectPaywallCssOnce() {
  if (document.getElementById('paywallCss')) return;
  const css = `
    .paywall-overlay{position:fixed; inset:0; background:rgba(0,0,0,.65); display:flex; align-items:center; justify-content:center; z-index:99999; padding:16px;}
    .paywall-card{width:min(560px,94vw); background:#121826; color:#fff; border-radius:16px; box-shadow:0 20px 50px rgba(0,0,0,.45); padding:18px;}
    .paywall-title{font-size:22px; font-weight:800; margin:6px 0;}
    .paywall-subtitle{font-size:15px; line-height:1.35; opacity:.92; margin-bottom:14px;}
    .paywall-actions{display:flex; gap:12px; justify-content:flex-end; flex-wrap:wrap;}
    .paywall-btn{border:none; border-radius:12px; padding:12px 16px; font-weight:800; cursor:pointer; min-width:200px;}
    .paywall-btn.secondary{background:transparent; color:#dbe6ff; border:1px solid rgba(255,255,255,.25);}
    .paywall-btn.primary{background:#2a6bff; color:#fff;}
    .paywall-btn[disabled]{opacity:.55; cursor:not-allowed;}
    .paywall-dontshow{display:flex; gap:10px; align-items:center; margin-top:12px; opacity:.8; font-size:13px;}
    .paywall-footnote{margin-top:10px; font-size:12px; opacity:.65;}
  `;
  const style = document.createElement('style');
  style.id = 'paywallCss';
  style.textContent = css;
  document.head.appendChild(style);
}

function buildPaywallHtml() {
  const dbg = isDebugEnabled();
  return `
  <div class="paywall-overlay" id="paywallOverlay">
    <div class="paywall-card">
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

      <div class="paywall-actions" style="margin-top:10px; justify-content:space-between;">
        <button class="paywall-btn secondary" id="btnRestore">Restore Purchases</button>
        <button class="paywall-btn secondary" id="btnToggleDebug">${dbg ? 'Hide Debug' : 'Show Debug'}</button>
      </div>

      <div class="paywall-footnote">Purchases are processed through Google Play.</div>

      <div id="pwDebugWrap" style="display:${dbg ? 'block' : 'none'}; margin-top:10px;">
        <div style="opacity:.85; font-weight:800; margin-bottom:6px;">Billing Debug</div>
        <div id="pwDebugSummary" style="font-size:12px; opacity:.9; margin-bottom:8px;"></div>
        <pre id="pwDebugPre" style="height:220px; overflow:auto; background:#0b1020; border:1px solid rgba(255,255,255,.12); padding:10px; border-radius:10px; font-size:12px; line-height:1.25; white-space:pre-wrap;"></pre>
        <div style="display:flex; gap:10px; margin-top:8px; justify-content:flex-end;">
          <button class="paywall-btn secondary" id="btnCopyDebug" style="min-width:140px;">Copy Log</button>
          <button class="paywall-btn secondary" id="btnClearDebug" style="min-width:140px;">Clear Log</button>
        </div>
      </div>
    </div>
  </div>`;
}

function removePaywall() {
  const overlay = document.getElementById('paywallOverlay');
  if (overlay) overlay.remove();
}

function refreshDebugUI() {
  const pre = document.getElementById('pwDebugPre');
  if (pre) pre.textContent = (safeGetLS(KEY_DEBUG_LOG) || '').trimEnd();

  const sum = document.getElementById('pwDebugSummary');
  if (sum) {
    const store = getBillingStore();
    const platform = getPlatformName();
    sum.innerHTML = `
      • Platform: <b>${platform}</b><br/>
      • Native: <b>${isNativeApp() ? 'true' : 'false'}</b><br/>
      • Billing bridge detected: <b>${store ? 'YES' : 'NO'}</b><br/>
      • ProductId: <b>${PRO_PRODUCT_ID}</b><br/>
      • Pro unlocked: <b>${isProUnlocked() ? 'true' : 'false'}</b><br/>
      • Grandfathered: <b>${isGrandfathered() ? 'true' : 'false'}</b><br/>
      • Hard blocked: <b>${hardBlocked() ? 'true' : 'false'}</b><br/>
    `;
  }
}

// -------------------- Billing --------------------
export async function initBilling() {
  if (_billingInitPromise) return _billingInitPromise;

  _billingInitPromise = (async () => {
    const platform = getPlatformName();
    appendDebug(`initBilling() start. native=${isNativeApp()} platform=${platform}`);

    if (!isNativeApp()) {
      appendDebug('Not native -> skipping billing init.');
      return;
    }

    const store = getBillingStore();
    const C = getCdvPurchase();
    appendDebug(`store present? ${!!store}`);
    if (!store) return;

    // Log version-ish hints
    try {
      const keys = Object.keys(store).slice(0, 60);
      appendDebug(`store keys(sample): ${keys.join(', ')}`);
    } catch {}

    // Resolve constants safely for v13
    const ProductType = C?.ProductType;
    const Platform = C?.Platform;

    const typeNonConsumable =
      ProductType?.NON_CONSUMABLE ||
      store?.NON_CONSUMABLE || // fallback
      'non consumable';

    const platformGoogle =
      Platform?.GOOGLE_PLAY ||
      store?.PLATFORM_GOOGLE_PLAY;

    const platformApple =
      Platform?.APPLE_APPSTORE ||
      store?.PLATFORM_APPLE_APPSTORE;

    // Register product (optionally include platform so Play returns it correctly)
    try {
      const reg = { id: PRO_PRODUCT_ID, type: typeNonConsumable };

      // IMPORTANT FIX:
      // If running Android, NEVER set iOS platform. Only set Google Play if available.
      if (platform === 'android' && platformGoogle) reg.platform = platformGoogle;
      if (platform === 'ios' && platformApple) reg.platform = platformApple;

      store.register(reg);
      appendDebug(`register OK: ${JSON.stringify(reg)}`);
    } catch (e) {
      appendDebug(`register FAILED: ${e?.message || String(e)}`);
    }

    // Attach only supported listeners
    try {
      if (typeof store.when !== 'function') {
        appendDebug('ERROR: store.when is not a function (plugin mismatch)');
      } else {
        const w = store.when(PRO_PRODUCT_ID);

        if (w?.approved) w.approved((p) => {
          appendDebug('EVENT approved -> verify()');
          try { p.verify(); } catch (e) { appendDebug(`verify() threw: ${e?.message || String(e)}`); }
        });

        if (w?.verified) w.verified((p) => {
          appendDebug('EVENT verified -> unlock + finish');
          setProUnlocked(true);
          try { p.finish(); } catch (e) { appendDebug(`finish() threw: ${e?.message || String(e)}`); }
          try { window.dispatchEvent(new CustomEvent('fireops:pro_unlocked')); } catch {}
        });

        if (w?.cancelled) w.cancelled(() => appendDebug('EVENT cancelled'));
        if (w?.error) w.error((err) => appendDebug(`EVENT error: ${err?.message || JSON.stringify(err) || String(err)}`));

        appendDebug('Listeners attached');
      }
    } catch (e) {
      appendDebug(`Attaching listeners FAILED: ${e?.message || String(e)}`);
    }

    // Initialize
    try {
      // FIX: choose correct platform init, never iOS on Android.
      // If constants exist, initialize with that one platform, otherwise call initialize() with no args.
      if (platform === 'android' && platformGoogle) {
        appendDebug('store.initialize([GOOGLE_PLAY])');
        await store.initialize([platformGoogle]);
      } else if (platform === 'ios' && platformApple) {
        appendDebug('store.initialize([APPLE_APPSTORE])');
        await store.initialize([platformApple]);
      } else {
        appendDebug('store.initialize() (no args)');
        await store.initialize();
      }

      appendDebug('store.initialize() done');
    } catch (e) {
      appendDebug(`store.initialize FAILED: ${e?.message || String(e)}`);
    }

    // Update (fetch product details)
    try {
      appendDebug('store.update() start');
      await store.update();
      appendDebug('store.update() done');
    } catch (e) {
      appendDebug(`store.update FAILED: ${e?.message || String(e)}`);
    }

    // Inspect product
    try {
      let p = null;
      if (typeof store.get === 'function') p = store.get(PRO_PRODUCT_ID);
      appendDebug(`store.get(${PRO_PRODUCT_ID}) => ${p ? 'FOUND' : 'NULL'}`);
      if (p) {
        appendDebug(`product snapshot: ${JSON.stringify({
          id: p.id,
          owned: !!p.owned,
          canPurchase: !!p.canPurchase,
          loaded: !!p.loaded,
          title: p.title,
          price: p.price
        })}`);
      }
    } catch (e) {
      appendDebug(`product inspect failed: ${e?.message || String(e)}`);
    }
  })();

  return _billingInitPromise;
}

export async function buyPro() {
  const store = getBillingStore();
  if (!store) throw new Error('Billing not available (no store)');

  appendDebug('buyPro() start');
  await initBilling();

  // Refresh product list right before purchase
  try {
    appendDebug('buyPro(): store.update() start');
    await store.update();
    appendDebug('buyPro(): store.update() done');
  } catch (e) {
    appendDebug(`buyPro(): store.update failed: ${e?.message || String(e)}`);
  }

  // Confirm product is present
  let product = null;
  try { if (typeof store.get === 'function') product = store.get(PRO_PRODUCT_ID); } catch {}
  appendDebug(`buyPro(): product = ${product ? 'FOUND' : 'NULL'}`);

  if (!product) {
    throw new Error(`Product not returned by Play. Check test track/tester/product status. (${PRO_PRODUCT_ID})`);
  }

  // Order
  try {
    appendDebug('buyPro(): store.order(productId) start');
    await store.order(PRO_PRODUCT_ID);
    appendDebug('buyPro(): store.order() returned (purchase UI should appear)');
  } catch (e) {
    appendDebug(`buyPro(): store.order FAILED: ${e?.message || String(e)}`);
    throw e;
  }
}

// -------------------- Modal --------------------
export function showPaywallModal({ force = false } = {}) {
  ensureInstallTimestamps();

  if (!force) {
    if (isProUnlocked()) return;
    if (isGrandfathered()) return;

    const dontShow = safeGetLS(KEY_PAYWALL_HIDE) === '1';
    if (dontShow && !hardBlocked()) return;
  }

  injectPaywallCssOnce();
  if (document.getElementById('paywallOverlay')) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildPaywallHtml();
  document.body.appendChild(wrapper.firstElementChild);

  const btnContinue   = document.getElementById('btnContinueTrial');
  const btnPay        = document.getElementById('btnPayNow');
  const btnRestore    = document.getElementById('btnRestore');
  const btnToggleDbg  = document.getElementById('btnToggleDebug');
  const btnCopyDebug  = document.getElementById('btnCopyDebug');
  const btnClearDebug = document.getElementById('btnClearDebug');
  const chk           = document.getElementById('chkDontShow');
  const dontShowRow   = document.getElementById('dontShowRow');
  const debugWrap     = document.getElementById('pwDebugWrap');

  if (hardBlocked()) {
    if (btnContinue) {
      btnContinue.disabled = true;
      btnContinue.textContent = 'Trial Ended';
    }
    if (dontShowRow) dontShowRow.style.display = 'none';
  }

  if (chk) chk.checked = safeGetLS(KEY_PAYWALL_HIDE) === '1';
  chk?.addEventListener('change', () => safeSetLS(KEY_PAYWALL_HIDE, chk.checked ? '1' : '0'));

  btnContinue?.addEventListener('click', () => {
    if (hardBlocked()) return;
    appendDebug('Continue clicked -> closing paywall');
    removePaywall();
  });

  btnToggleDbg?.addEventListener('click', () => {
    const enabled = !isDebugEnabled();
    setDebugEnabled(enabled);
    appendDebug(`Debug toggled -> ${enabled ? 'ON' : 'OFF'}`);
    if (debugWrap) debugWrap.style.display = enabled ? 'block' : 'none';
    if (btnToggleDbg) btnToggleDbg.textContent = enabled ? 'Hide Debug' : 'Show Debug';
    refreshDebugUI();
  });

  btnCopyDebug?.addEventListener('click', async () => {
    const txt = safeGetLS(KEY_DEBUG_LOG) || '';
    try { await navigator.clipboard.writeText(txt); appendDebug('Copied debug log to clipboard'); }
    catch (e) { appendDebug(`Copy failed: ${e?.message || String(e)}`); }
  });

  btnClearDebug?.addEventListener('click', () => {
    safeSetLS(KEY_DEBUG_LOG, '');
    appendDebug('Log cleared');
    refreshDebugUI();
  });

  btnRestore?.addEventListener('click', async () => {
    appendDebug('Restore clicked');
    try {
      const store = getBillingStore();
      await initBilling();
      if (store?.restorePurchases) {
        appendDebug('Calling store.restorePurchases()...');
        await store.restorePurchases();
        appendDebug('restorePurchases() done');
      } else {
        appendDebug('restorePurchases() not available in this store version');
      }
    } catch (e) {
      appendDebug(`Restore failed: ${e?.message || String(e)}`);
    }
  });

  btnPay?.addEventListener('click', async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    appendDebug('Pay button clicked');

    try {
      btnPay.disabled = true;
      btnPay.textContent = 'Opening Google Play…';

      await buyPro();

      btnPay.textContent = 'Purchase started…';
      // Keep open briefly so debug stays visible
      setTimeout(() => { try { removePaywall(); } catch {} }, 1200);
    } catch (err) {
      const msg = err?.message || String(err);
      appendDebug(`PAY ERROR: ${msg}`);
      btnPay.disabled = false;
      btnPay.textContent = 'Unlock Pro — $1.99 one-time';
      refreshDebugUI();
    }
  });

  refreshDebugUI();

  // Start billing init
  initBilling().then(refreshDebugUI).catch(refreshDebugUI);
}

// Optional global for quick testing
window.fireOpsPaywall = { initBilling, showPaywallModal, buyPro, isNativeApp, isProUnlocked, setProUnlocked };
