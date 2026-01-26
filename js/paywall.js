/* paywall.js — FireOps Calc (TEST-FORCED / GUARANTEED BUY BUTTON)
   Product ID: fireops.pro (ONE-TIME PRODUCT)
   Trial: 5 days (unless grandfathered)
   TEST MODE:
     - Always show paywall + Buy button if:
         URL has ?forcePaywall=1
         OR localStorage.fireops_force_paywall_v1 === "1"
     - Grandfathered users ARE allowed to buy for testing.

   Debug:
     - Always available via "Show Debug"
     - Can be forced ON with:
         URL ?pwdebug=1
         OR localStorage.fireops_paywall_debug_v1 === "1"
*/

export const PRO_PRODUCT_ID = 'fireops.pro';
export const TRIAL_DAYS = 5;

const KEY_INSTALL_TS       = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED    = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED     = 'fireops_pro_unlocked_v1';
const KEY_PAYWALL_HIDE     = 'fireops_paywall_hide_v1';
const KEY_DEBUG_ENABLED    = 'fireops_paywall_debug_v1';
const KEY_DEBUG_LOG        = 'fireops_paywall_debug_log_v1';
const KEY_FORCE_PAYWALL    = 'fireops_force_paywall_v1';

let _billingInitPromise = null;

// -------------------- localStorage safe --------------------
function lsGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, val); } catch {} }
function lsDel(key) { try { localStorage.removeItem(key); } catch {} }

function qsGet(name) {
  try { return new URLSearchParams(location.search).get(name); } catch { return null; }
}

// -------------------- time --------------------
function nowMs() { return Date.now(); }
function daysToMs(d) { return d * 24 * 60 * 60 * 1000; }

// -------------------- debug --------------------
function isDebugEnabled() {
  return qsGet('pwdebug') === '1' || lsGet(KEY_DEBUG_ENABLED) === '1';
}
function setDebugEnabled(v) {
  lsSet(KEY_DEBUG_ENABLED, v ? '1' : '0');
}
function appendDebug(line) {
  const ts = new Date().toLocaleTimeString();
  const msg = `${ts}  ${line}`;
  try {
    const existing = lsGet(KEY_DEBUG_LOG) || '';
    lsSet(KEY_DEBUG_LOG, (existing + msg + '\n').slice(-16000));
  } catch {}
  try { console.log('[PW]', line); } catch {}

  const pre = document.getElementById('pwDebugPre');
  if (pre) {
    pre.textContent = (lsGet(KEY_DEBUG_LOG) || '').trimEnd();
    pre.scrollTop = pre.scrollHeight;
  }
}

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

// -------------------- trial / flags --------------------
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
  if (isProUnlocked()) return false;
  if (isGrandfathered()) return false;
  return trialExpired();
}

// Force show paywall regardless of flags
function forcePaywallEnabled() {
  return qsGet('forcePaywall') === '1' || lsGet(KEY_FORCE_PAYWALL) === '1';
}

// -------------------- UI --------------------
function injectCssOnce() {
  if (document.getElementById('paywallCss')) return;
  const css = `
    .paywall-overlay{position:fixed; inset:0; background:rgba(0,0,0,.70); display:flex; align-items:center; justify-content:center; z-index:99999; padding:16px;}
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

function buildHtml() {
  const dbg = isDebugEnabled();
  return `
  <div class="paywall-overlay" id="paywallOverlay">
    <div class="paywall-card">
      <div class="paywall-title">5-Day Free Trial</div>
      <div class="paywall-subtitle">
        FireOps Calc is free for ${TRIAL_DAYS} days. Unlock full access anytime with a one-time purchase.
      </div>

      <div class="paywall-actions">
        <button class="paywall-btn secondary" id="btnContinue">Continue Free Trial</button>
        <button class="paywall-btn primary" id="btnBuy">Unlock Pro — $1.99 one-time</button>
      </div>

      <div class="paywall-row">
        <button class="paywall-btn secondary" id="btnRestore">Restore Purchases</button>
        <button class="paywall-btn secondary" id="btnToggleDebug">${dbg ? 'Hide Debug' : 'Show Debug'}</button>
      </div>

      <div class="pw-mini" id="pwMiniSummary"></div>

      <div class="paywall-footnote">Purchases are processed through Google Play.</div>

      <div id="pwDebugWrap" style="display:${dbg ? 'block' : 'none'}; margin-top:10px;">
        <div style="opacity:.85; font-weight:800; margin-bottom:6px;">Billing Debug</div>
        <pre id="pwDebugPre" style="height:240px; overflow:auto; background:#0b1020; border:1px solid rgba(255,255,255,.12); padding:10px; border-radius:10px; font-size:12px; line-height:1.25; white-space:pre-wrap;"></pre>
        <div style="display:flex; gap:10px; margin-top:8px; justify-content:flex-end; flex-wrap:wrap;">
          <button class="paywall-btn secondary" id="btnCopy" style="min-width:140px;">Copy Log</button>
          <button class="paywall-btn secondary" id="btnClear" style="min-width:140px;">Clear Log</button>
          <button class="paywall-btn secondary" id="btnForceOn" style="min-width:160px;">Force Paywall ON</button>
          <button class="paywall-btn secondary" id="btnForceOff" style="min-width:160px;">Force Paywall OFF</button>
        </div>
      </div>
    </div>
  </div>`;
}

function refreshSummary() {
  const mini = document.getElementById('pwMiniSummary');
  if (!mini) return;

  const platform = getPlatformName();
  mini.innerHTML = `
    <b>Product:</b> ${PRO_PRODUCT_ID}<br/>
    <b>Platform:</b> ${platform} &nbsp; <b>Native:</b> ${isNativeApp()}<br/>
    <b>Grandfathered:</b> ${isGrandfathered()} &nbsp; <b>Pro unlocked:</b> ${isProUnlocked()}<br/>
    <b>Trial expired:</b> ${trialExpired()} &nbsp; <b>Hard blocked:</b> ${hardBlocked()}<br/>
    <b>Force Paywall:</b> ${forcePaywallEnabled()}
  `;
}

// -------------------- Billing init (fixed platform) --------------------
export async function initBilling() {
  if (_billingInitPromise) return _billingInitPromise;

  _billingInitPromise = (async () => {
    ensureInstallTimestamps();

    const platform = getPlatformName();
    appendDebug(`initBilling start. native=${isNativeApp()} platform=${platform}`);

    if (!isNativeApp()) {
      appendDebug('Not native; billing disabled.');
      return;
    }

    const store = getBillingStore();
    const C = getCdvPurchase();

    appendDebug(`Billing store present? ${!!store}`);
    if (!store) return;

    // Helpful introspection
    try {
      appendDebug(`store.when exists? ${typeof store.when}`);
      appendDebug(`store.initialize exists? ${typeof store.initialize}`);
      appendDebug(`store.register exists? ${typeof store.register}`);
      appendDebug(`store.order exists? ${typeof store.order}`);
      appendDebug(`store.get exists? ${typeof store.get}`);
    } catch {}

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

    // Register product (NEVER set iOS on Android)
    try {
      const reg = { id: PRO_PRODUCT_ID, type: NON_CONSUMABLE };
      if (platform === 'android' && GOOGLE_PLAY) reg.platform = GOOGLE_PLAY;
      if (platform === 'ios' && APPLE_APPSTORE) reg.platform = APPLE_APPSTORE;
      store.register(reg);
      appendDebug(`register OK: ${JSON.stringify(reg)}`);
    } catch (e) {
      appendDebug(`register FAILED: ${e?.message || String(e)}`);
    }

    // Attach listeners ONLY on supported events (avoid registered())
    try {
      if (typeof store.when === 'function') {
        const w = store.when(PRO_PRODUCT_ID);

        if (w?.approved) w.approved((p) => {
          appendDebug('EVENT approved -> verify()');
          try { p.verify(); } catch (e) { appendDebug(`verify threw: ${e?.message || String(e)}`); }
        });

        if (w?.verified) w.verified((p) => {
          appendDebug('EVENT verified -> unlock + finish');
          setProUnlocked(true);
          try { p.finish(); } catch (e) { appendDebug(`finish threw: ${e?.message || String(e)}`); }
          try { window.dispatchEvent(new CustomEvent('fireops:pro_unlocked')); } catch {}
        });

        if (w?.cancelled) w.cancelled(() => appendDebug('EVENT cancelled'));
        if (w?.error) w.error((err) => appendDebug(`EVENT error: ${err?.message || JSON.stringify(err) || String(err)}`));

        appendDebug('Listeners attached');
      } else {
        appendDebug('WARNING: store.when not available (plugin mismatch?)');
      }
    } catch (e) {
      appendDebug(`Listener attach FAILED: ${e?.message || String(e)}`);
    }

    // Initialize (FIXED: never iOS on Android)
    try {
      if (platform === 'android' && GOOGLE_PLAY) {
        appendDebug('store.initialize([GOOGLE_PLAY])');
        await store.initialize([GOOGLE_PLAY]);
      } else if (platform === 'ios' && APPLE_APPSTORE) {
        appendDebug('store.initialize([APPLE_APPSTORE])');
        await store.initialize([APPLE_APPSTORE]);
      } else {
        appendDebug('store.initialize() (no args)');
        await store.initialize();
      }
      appendDebug('initialize done');
    } catch (e) {
      appendDebug(`initialize FAILED: ${e?.message || String(e)}`);
    }

    // Update (fetch products)
    try {
      appendDebug('store.update() start');
      await store.update();
      appendDebug('store.update() done');
    } catch (e) {
      appendDebug(`store.update FAILED: ${e?.message || String(e)}`);
    }

    // Inspect product
    try {
      const p = (typeof store.get === 'function') ? store.get(PRO_PRODUCT_ID) : null;
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
      appendDebug(`product inspect FAILED: ${e?.message || String(e)}`);
    }
  })();

  return _billingInitPromise;
}

export async function buyPro() {
  appendDebug('buyPro() start');
  await initBilling();

  const store = getBillingStore();
  if (!store) throw new Error('Billing store missing');

  try {
    appendDebug('buyPro(): store.update() start');
    await store.update();
    appendDebug('buyPro(): store.update() done');
  } catch (e) {
    appendDebug(`buyPro(): update failed: ${e?.message || String(e)}`);
  }

  let product = null;
  try { product = (typeof store.get === 'function') ? store.get(PRO_PRODUCT_ID) : null; } catch {}
  appendDebug(`buyPro(): product=${product ? 'FOUND' : 'NULL'}`);

  if (!product) {
    throw new Error(`Product not returned by Play. Check: product ACTIVE, tester email added, installed from same track, and app signed correctly. (${PRO_PRODUCT_ID})`);
  }

  try {
    appendDebug('buyPro(): store.order(PRO_PRODUCT_ID) start');
    await store.order(PRO_PRODUCT_ID);
    appendDebug('buyPro(): store.order returned (purchase UI should appear)');
  } catch (e) {
    appendDebug(`buyPro(): store.order FAILED: ${e?.message || String(e)}`);
    throw e;
  }
}

export async function restorePurchases() {
  appendDebug('restorePurchases() start');
  await initBilling();
  const store = getBillingStore();
  if (!store) throw new Error('Billing store missing');

  if (typeof store.restorePurchases === 'function') {
    await store.restorePurchases();
    appendDebug('restorePurchases() done');
  } else {
    appendDebug('restorePurchases() not available in this plugin build');
  }
}

// -------------------- PUBLIC: showPaywallModal (GUARANTEED BUY BUTTON) --------------------
export function showPaywallModal({ force = false } = {}) {
  ensureInstallTimestamps();

  // GUARANTEE DISPLAY:
  // - forcePaywallEnabled() OR force=true will ALWAYS show paywall (and Buy button).
  const mustShow = force || forcePaywallEnabled();

  if (!mustShow) {
    // normal behavior (but still allow buys when shown)
    if (isProUnlocked()) return;
    if (isGrandfathered()) return;

    const dontShow = lsGet(KEY_PAYWALL_HIDE) === '1';
    if (dontShow && !hardBlocked()) return;
  }

  injectCssOnce();
  if (document.getElementById('paywallOverlay')) return;

  const wrap = document.createElement('div');
  wrap.innerHTML = buildHtml();
  document.body.appendChild(wrap.firstElementChild);

  // Fill debug panel if enabled
  const pre = document.getElementById('pwDebugPre');
  if (pre) pre.textContent = (lsGet(KEY_DEBUG_LOG) || '').trimEnd();

  refreshSummary();
  appendDebug(`Paywall shown. force=${force} forcePaywall=${forcePaywallEnabled()} native=${isNativeApp()} platform=${getPlatformName()}`);

  const btnContinue = document.getElementById('btnContinue');
  const btnBuy      = document.getElementById('btnBuy');
  const btnRestore  = document.getElementById('btnRestore');
  const btnToggle   = document.getElementById('btnToggleDebug');
  const dbgWrap     = document.getElementById('pwDebugWrap');
  const btnCopy     = document.getElementById('btnCopy');
  const btnClear    = document.getElementById('btnClear');
  const btnForceOn  = document.getElementById('btnForceOn');
  const btnForceOff = document.getElementById('btnForceOff');

  // GUARANTEE: Buy button always visible + enabled (even grandfathered / trial / etc.)
  if (btnBuy) {
    btnBuy.disabled = false;
    btnBuy.style.display = '';
  }

  btnContinue?.addEventListener('click', () => {
    appendDebug('Continue clicked -> close paywall');
    removePaywall();
  });

  btnToggle?.addEventListener('click', () => {
    const next = !isDebugEnabled();
    setDebugEnabled(next);
    appendDebug(`Debug toggled -> ${next ? 'ON' : 'OFF'}`);
    if (dbgWrap) dbgWrap.style.display = next ? 'block' : 'none';
    if (btnToggle) btnToggle.textContent = next ? 'Hide Debug' : 'Show Debug';
    refreshSummary();
    // refresh log view
    const pre2 = document.getElementById('pwDebugPre');
    if (pre2) pre2.textContent = (lsGet(KEY_DEBUG_LOG) || '').trimEnd();
  });

  btnCopy?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(lsGet(KEY_DEBUG_LOG) || '');
      appendDebug('Copied debug log to clipboard');
    } catch (e) {
      appendDebug(`Copy failed: ${e?.message || String(e)}`);
    }
  });

  btnClear?.addEventListener('click', () => {
    lsSet(KEY_DEBUG_LOG, '');
    appendDebug('Log cleared');
    const pre2 = document.getElementById('pwDebugPre');
    if (pre2) pre2.textContent = '';
  });

  btnForceOn?.addEventListener('click', () => {
    lsSet(KEY_FORCE_PAYWALL, '1');
    appendDebug('Force Paywall ON set in localStorage');
    refreshSummary();
  });

  btnForceOff?.addEventListener('click', () => {
    lsDel(KEY_FORCE_PAYWALL);
    appendDebug('Force Paywall OFF removed from localStorage');
    refreshSummary();
  });

  btnRestore?.addEventListener('click', async () => {
    try {
      btnRestore.disabled = true;
      btnRestore.textContent = 'Restoring…';
      await restorePurchases();
      btnRestore.textContent = 'Restore Purchases';
    } catch (e) {
      appendDebug(`Restore failed: ${e?.message || String(e)}`);
      btnRestore.textContent = 'Restore Purchases';
    } finally {
      btnRestore.disabled = false;
      refreshSummary();
    }
  });

  btnBuy?.addEventListener('click', async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    appendDebug('BUY button clicked');

    try {
      btnBuy.disabled = true;
      btnBuy.textContent = 'Opening Google Play…';

      await buyPro();

      btnBuy.textContent = 'Purchase started…';
      // keep visible briefly to read debug
      setTimeout(() => { try { removePaywall(); } catch {} }, 1200);
    } catch (err) {
      const msg = err?.message || String(err);
      appendDebug(`PAY ERROR: ${msg}`);
      btnBuy.disabled = false;
      btnBuy.textContent = 'Unlock Pro — $1.99 one-time';
    } finally {
      refreshSummary();
    }
  });

  // Kick billing init immediately so product loads while paywall is open
  initBilling().then(refreshSummary).catch(refreshSummary);
}

// Handy console helpers for testing
window.fireOpsPaywall = {
  show: (force = true) => showPaywallModal({ force }),
  initBilling,
  buyPro,
  restorePurchases,
  resetFlags: () => {
    lsDel(KEY_PAYWALL_HIDE);
    lsDel(KEY_GRANDFATHERED);
    lsDel(KEY_PRO_UNLOCKED);
    lsDel(KEY_INSTALL_TS);
    lsDel(KEY_DEBUG_LOG);
    appendDebug('Flags reset');
  },
  forceOn: () => lsSet(KEY_FORCE_PAYWALL, '1'),
  forceOff: () => lsDel(KEY_FORCE_PAYWALL),
};
