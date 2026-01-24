/* paywall.js — FireOps Calc (Unified)
   - 5-day free trial for NEW installs only
   - Existing installs can be grandfathered (auto-detected by existing user data)
   - One-time purchase unlock (fireops.pro)
*/

export const PRO_PRODUCT_ID = 'fireops.pro'; // must match Play Console Product ID exactly
export const TRIAL_DAYS = 5;

const KEY_INSTALL_TS = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED = 'fireops_pro_unlocked_v1';
const KEY_TRIAL_INTRO_SHOWN = 'fireops_trial_intro_shown_v1';
const KEY_PAYWALL_HIDE = 'fireops_paywall_hide_v1';

let _billingInitPromise = null;

function nowMs() { return Date.now(); }
function daysToMs(days) { return days * 24 * 60 * 60 * 1000; }

export function isNativeApp() {
  // Cordova or Capacitor in native shell
  return !!(window.cordova || window.Capacitor?.isNativePlatform?.());
}

function getBillingStore() {
  // cordova-plugin-purchase usually attaches CdvPurchase.store
  // Some builds attach window.store
  return (window.CdvPurchase && window.CdvPurchase.store) || window.store || null;
}

function safeGetLS(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetLS(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

function hasAnyExistingUserData() {
  // If any of these exist, we assume this install existed before paywall rollout
  // (helps you grandfather existing users)
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
  } catch (_e) {}
  return false;
}

function ensureInstallTimestamps() {
  const existing = safeGetLS(KEY_INSTALL_TS);
  if (!existing) {
    // Auto-grandfather if we detect any existing user data
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

export function isProUnlocked() {
  return safeGetLS(KEY_PRO_UNLOCKED) === '1';
}

export function setProUnlocked(val) {
  safeSetLS(KEY_PRO_UNLOCKED, val ? '1' : '0');
}

export function isGrandfathered() {
  return safeGetLS(KEY_GRANDFATHERED) === '1';
}

export function trialExpired() {
  const installMs = getInstallMs();
  if (!installMs) return false;
  const elapsed = nowMs() - installMs;
  return elapsed >= daysToMs(TRIAL_DAYS);
}

export function shouldShowPaywallNow() {
  // Always show paywall UI (as intro) for new installs unless they hide it.
  // Hard-block after trial ends.
  if (isProUnlocked()) return false;
  if (isGrandfathered()) return false;
  return true;
}

export function hardBlocked() {
  // After 5 days: hard paywall for new installs (unless unlocked or grandfathered)
  if (isProUnlocked()) return false;
  if (isGrandfathered()) return false;
  return trialExpired();
}

function buildPaywallHtml() {
  return `
  <div class="paywall-overlay" id="paywallOverlay">
    <div class="paywall-card">
      <div class="paywall-hero">
        <img src="assets/firetruck.png" alt="Fire truck" class="paywall-truck" />
      </div>

      <div class="paywall-title">5-Day Free Trial — No Risk</div>
      <div class="paywall-subtitle">
        FireOps Calc is free for ${TRIAL_DAYS} days. Unlock full access anytime with a one-time purchase.
      </div>
      <div class="paywall-note">
        If the purchase sheet doesn’t open, billing may not be ready yet.
      </div>

      <div class="paywall-actions">
        <button class="paywall-btn secondary" id="btnContinueTrial">Continue Free Trial</button>
        <button class="paywall-btn primary" id="btnPayNow">Pay Now — $1.99 one-time</button>
      </div>

      <label class="paywall-dontshow" id="dontShowRow">
        <input type="checkbox" id="chkDontShow" />
        Do not show this again
      </label>

      <pre class="paywall-debug" id="billingDebug" style="display:none;"></pre>
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
    .paywall-subtitle{ font-size:15px; line-height:1.35; opacity:.92; margin-bottom:10px; }
    .paywall-note{ font-size:12px; opacity:.7; margin-bottom:14px; }
    .paywall-actions{ display:flex; gap:12px; justify-content:flex-end; flex-wrap:wrap; }
    .paywall-btn{
      border:none; border-radius:12px; padding:12px 16px; font-weight:800;
      cursor:pointer; min-width:180px;
    }
    .paywall-btn.secondary{ background:transparent; color:#dbe6ff; border:1px solid rgba(255,255,255,.25); }
    .paywall-btn.primary{ background:#2a6bff; color:#fff; }
    .paywall-btn[disabled]{ opacity:.55; cursor:not-allowed; }
    .paywall-dontshow{ display:flex; gap:10px; align-items:center; margin-top:12px; opacity:.8; font-size:13px; }
    .paywall-debug{ margin-top:12px; font-size:11px; white-space:pre-wrap; background:rgba(255,255,255,.06); padding:10px; border-radius:10px; }
  `;
  const style = document.createElement('style');
  style.id = 'paywallCss';
  style.textContent = css;
  document.head.appendChild(style);
}

function showToast(msg) {
  try { alert(msg); } catch { console.log(msg); }
}

export async function initBilling({ verbose = false } = {}) {
  if (_billingInitPromise) return _billingInitPromise;

  _billingInitPromise = (async () => {
    if (!isNativeApp()) return;

    const _store = getBillingStore();
    if (!_store) {
      if (verbose) console.warn('[billing] store not found');
      return;
    }

    // Register product
    try {
      _store.register({
        id: PRO_PRODUCT_ID,
        type: _store.NON_CONSUMABLE,
        platform: (_store.PLAY_STORE || _store.Platform?.GOOGLE_PLAY || undefined)
      });
    } catch (e) {
      if (verbose) console.warn('[billing] register failed', e);
    }

    // Events
    try {
      _store.when(PRO_PRODUCT_ID).approved((p) => {
        try { p.verify(); } catch {}
      });
      _store.when(PRO_PRODUCT_ID).verified((p) => {
        // Verified => unlock + acknowledge/finish
        setProUnlocked(true);
        try { p.finish(); } catch {}

        // Notify app.js to refresh views immediately
        try {
          window.dispatchEvent(new CustomEvent('fireops:pro_unlocked', { detail: { productId: PRO_PRODUCT_ID } }));
        } catch (_e) {}
      });
    } catch (e) {
      if (verbose) console.warn('[billing] event wiring failed', e);
    }

    // Initialize store
    try {
      const platforms = [];
      if (_store?.PLAY_STORE) platforms.push(_store.PLAY_STORE);
      else if (_store?.Platform?.GOOGLE_PLAY) platforms.push(_store.Platform.GOOGLE_PLAY);
      else if (_store?.APPLE_APPSTORE) platforms.push(_store.APPLE_APPSTORE);
      else if (_store?.Platform?.APPLE_APPSTORE) platforms.push(_store.Platform.APPLE_APPSTORE);

      await _store.initialize(platforms.length ? platforms : undefined);

      try { await _store.update(); } catch {}
    } catch (e) {
      if (verbose) console.warn('[billing] initialize/update failed', e);
      throw e;
    }
  })();

  return _billingInitPromise;
}

async function getProductDebug() {
  const _store = getBillingStore();
  const debug = {
    hasStore: !!_store,
    hasGet: !!_store?.get,
    productId: PRO_PRODUCT_ID,
    productExists: false,
    productType: null,
    state: null,
    owned: null,
    offersCount: 0,
    lastBillingError: '',
    native: isNativeApp(),
    time: new Date().toISOString()
  };

  if (!_store?.get) return debug;

  try {
    const p = _store.get(PRO_PRODUCT_ID);
    debug.productExists = !!p;
    debug.productType = p?.type ?? null;
    debug.state = p?.state ?? null;
    debug.owned = p?.owned ?? null;
    debug.offersCount = Array.isArray(p?.offers) ? p.offers.length : 0;
  } catch (e) {
    debug.lastBillingError = String(e?.message || e);
  }

  return debug;
}

function renderBillingDebug(json) {
  const el = document.getElementById('billingDebug');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = `[billing debug]\n${JSON.stringify(json, null, 2)}`;
}

function removePaywall() {
  const overlay = document.getElementById('paywallOverlay');
  if (overlay) overlay.remove();
}

export async function buyPro() {
  const _store = getBillingStore();
  if (!_store) throw new Error('Billing store not available');

  await initBilling({ verbose: true });

  const debug = await getProductDebug();
  if (!debug.productExists) {
    // one retry: deviceready timing can cause first load miss
    try { await initBilling({ verbose: true }); } catch {}
    const debug2 = await getProductDebug();
    if (!debug2.productExists) {
      throw new Error('Product not loaded in billing store. ' + JSON.stringify(debug2));
    }
  }

  try {
    await _store.order(PRO_PRODUCT_ID);
  } catch (e) {
    throw new Error(e?.message || String(e));
  }
}

export function showPaywallModal({ force = false } = {}) {
  ensureInstallTimestamps();

  if (!force) {
    if (!shouldShowPaywallNow()) return;

    // Allow hiding during trial only
    const dontShow = safeGetLS(KEY_PAYWALL_HIDE) === '1';
    if (dontShow && !hardBlocked()) return;
  }

  injectPaywallCssOnce();

  if (document.getElementById('paywallOverlay')) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildPaywallHtml();
  document.body.appendChild(wrapper.firstElementChild);

  const btnContinue = document.getElementById('btnContinueTrial');
  const btnPay = document.getElementById('btnPayNow');
  const chk = document.getElementById('chkDontShow');
  const dontShowRow = document.getElementById('dontShowRow');

  // During hard block, disable continue and do not allow "don't show again"
  if (hardBlocked()) {
    btnContinue.disabled = true;
    btnContinue.textContent = 'Trial Ended';
    if (dontShowRow) dontShowRow.style.display = 'none';
  }

  // Restore checkbox
  if (chk) chk.checked = safeGetLS(KEY_PAYWALL_HIDE) === '1';

  if (chk) {
    chk.addEventListener('change', () => {
      safeSetLS(KEY_PAYWALL_HIDE, chk.checked ? '1' : '0');
    });
  }

  btnContinue?.addEventListener('click', () => {
    // If trial expired, do not allow bypass
    if (hardBlocked()) return;
    removePaywall();
  });

  btnPay?.addEventListener('click', async () => {
    try {
      btnPay.disabled = true;
      btnPay.textContent = 'Opening purchase...';

      const debug = await getProductDebug();
      renderBillingDebug(debug);

      await buyPro();

      // verified() handler will unlock + finish + emit event
      // close UI now (or it will close after unlock event in app.js)
      removePaywall();
    } catch (e) {
      const msg = e?.message || String(e);
      const debug = await getProductDebug();
      renderBillingDebug(debug);

      showToast(`Purchase failed: ${msg}`);
      btnPay.disabled = false;
      btnPay.textContent = 'Pay Now — $1.99 one-time';
    }
  });

  // Start billing init (non-blocking)
  initBilling({ verbose: false })
    .then(async () => {
      if (isNativeApp()) renderBillingDebug(await getProductDebug());
    })
    .catch(async () => {
      if (isNativeApp()) renderBillingDebug(await getProductDebug());
    });
}

// Compatibility: keep the window API you used before
window.fireOpsPaywall = {
  initBilling,
  showPaywallModal,
  shouldShowPaywallNow,
  hardBlocked,
  isProUnlocked,
  setProUnlocked,
  buyPro,
  isNativeApp
};
