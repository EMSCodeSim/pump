/* paywall.js — FireOps Calc (Option A)
   - 5-day free trial for NEW installs only
   - Existing installs are grandfathered
   - One-time purchase unlock (fireops.pro)
*/

const PRO_PRODUCT_ID = 'fireops.pro'; // must match Play Console Product ID exactly
const TRIAL_DAYS = 5;

const KEY_INSTALL_TS = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED = 'fireops_pro_unlocked_v1';
const KEY_TRIAL_INTRO_SHOWN = 'fireops_trial_intro_shown_v1';

let _billingInitPromise = null;

function nowMs() { return Date.now(); }
function daysToMs(days) { return days * 24 * 60 * 60 * 1000; }

function isNativeApp() {
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

function ensureInstallTimestamps() {
  const existing = safeGetLS(KEY_INSTALL_TS);
  if (!existing) {
    safeSetLS(KEY_INSTALL_TS, String(nowMs()));
    // If they install AFTER you introduced paywall, they are NOT grandfathered.
    safeSetLS(KEY_GRANDFATHERED, '0');
  }
  // If you ever want to force-grandfather existing users, you would set KEY_GRANDFATHERED=1
}

function getInstallMs() {
  const v = safeGetLS(KEY_INSTALL_TS);
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isProUnlocked() {
  return safeGetLS(KEY_PRO_UNLOCKED) === '1';
}

function setProUnlocked(val) {
  safeSetLS(KEY_PRO_UNLOCKED, val ? '1' : '0');
}

function isGrandfathered() {
  return safeGetLS(KEY_GRANDFATHERED) === '1';
}

function trialExpired() {
  const installMs = getInstallMs();
  if (!installMs) return false;
  const elapsed = nowMs() - installMs;
  return elapsed >= daysToMs(TRIAL_DAYS);
}

function shouldShowPaywallNow() {
  // Option A behavior:
  // - Existing installs can be grandfathered
  // - New installs: show paywall (intro) and allow continue during trial, then hard-block after trial ends
  if (isProUnlocked()) return false;
  if (isGrandfathered()) return false;
  return true;
}

function hardBlocked() {
  // After 5 days: hard paywall for new installs (unless unlocked or grandfathered)
  if (isProUnlocked()) return false;
  if (isGrandfathered()) return false;
  return trialExpired();
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildPaywallHtml() {
  // Keep your existing look/feel + truck image
  return `
  <div class="paywall-overlay" id="paywallOverlay">
    <div class="paywall-card">
      <div class="paywall-hero">
        <img src="assets/firetruck.png" alt="Fire truck" class="paywall-truck" />
      </div>

      <div class="paywall-title">5-Day Free Trial — No Risk</div>
      <div class="paywall-subtitle">
        FireOps Calc is free for 5 days. You can unlock full access anytime with a one-time purchase.
      </div>
      <div class="paywall-note">
        If the purchase sheet doesn’t open, billing may not be ready yet.
      </div>

      <div class="paywall-actions">
        <button class="paywall-btn secondary" id="btnContinueTrial">Continue Free Trial</button>
        <button class="paywall-btn primary" id="btnPayNow">Pay Now — $1.99 one-time</button>
      </div>

      <label class="paywall-dontshow">
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
  // lightweight, safe
  try { alert(msg); } catch { console.log(msg); }
}

async function initBilling({ verbose = false } = {}) {
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
        // Helps cordova-plugin-purchase pick the right store when multiple are available.
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
        setProUnlocked(true);
        try { p.finish(); } catch {}
      });
    } catch (e) {
      if (verbose) console.warn('[billing] event wiring failed', e);
    }

    // Initialize store (IMPORTANT FIX)
    try {
      // Initialize only the needed platform(s). Missing/empty platforms can cause products to never load.
      const platforms = [];
      if (_store?.PLAY_STORE) platforms.push(_store.PLAY_STORE);
      else if (_store?.Platform?.GOOGLE_PLAY) platforms.push(_store.Platform.GOOGLE_PLAY);
      else if (_store?.APPLE_APPSTORE) platforms.push(_store.APPLE_APPSTORE);
      else if (_store?.Platform?.APPLE_APPSTORE) platforms.push(_store.Platform.APPLE_APPSTORE);

      await _store.initialize(platforms.length ? platforms : undefined);

      // Fetch products / ownership
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
  const isNative = isNativeApp();
  const debug = {
    hasStore: !!_store,
    hasGet: !!_store?.get,
    productId: PRO_PRODUCT_ID,
    productExists: false,
    productType: null,
    state: null,
    owned: null,
    offersCount: 0,
    offer0: null,
    offerFromGetOffer: null,
    lastBillingError: '',
    native: isNative,
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
    debug.offer0 = (p?.offers && p.offers[0]) ? {
      id: p.offers[0].id ?? null,
      pricingPhases: p.offers[0].pricingPhases ? '[present]' : null
    } : null;

    // Some plugin versions support getOffer(id)
    if (typeof _store.getOffer === 'function') {
      try {
        const offer = _store.getOffer(PRO_PRODUCT_ID);
        debug.offerFromGetOffer = offer ? { id: offer.id ?? null } : null;
      } catch {}
    }
  } catch (e) {
    debug.lastBillingError = String(e?.message || e);
  }

  return debug;
}

function renderBillingDebug(json) {
  const el = document.getElementById('billingDebug');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = `[billing debug init]\n${JSON.stringify(json, null, 2)}`;
}

function removePaywall() {
  const overlay = document.getElementById('paywallOverlay');
  if (overlay) overlay.remove();
}

async function buyPro() {
  const _store = getBillingStore();
  if (!_store) throw new Error('Billing store not available');

  // Ensure init
  await initBilling({ verbose: true });

  // Confirm product loaded
  const debug = await getProductDebug();
  if (!debug.productExists) {
    // One more attempt: sometimes the store isn't ready on first open (deviceready timing).
    try { await initBilling({ verbose: true }); } catch {}
    const debug2 = await getProductDebug();
    if (!debug2.productExists) {
      throw new Error("Product not loaded in billing store. " + JSON.stringify(debug2));
    }
  }

  // Order
  try {
    await _store.order(PRO_PRODUCT_ID);
  } catch (e) {
    throw new Error(e?.message || String(e));
  }
}

function showPaywallModal({ force = false } = {}) {
  ensureInstallTimestamps();

  if (!force) {
    if (!shouldShowPaywallNow()) return;
    // If user checked "do not show again" during trial and not hard-blocked, skip.
    const dontShow = safeGetLS('fireops_paywall_hide_v1') === '1';
    if (dontShow && !hardBlocked()) return;
  }

  injectPaywallCssOnce();

  // If already present, don't duplicate
  if (document.getElementById('paywallOverlay')) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildPaywallHtml();
  document.body.appendChild(wrapper.firstElementChild);

  const btnContinue = document.getElementById('btnContinueTrial');
  const btnPay = document.getElementById('btnPayNow');
  const chk = document.getElementById('chkDontShow');

  // During hard block, disable continue
  if (hardBlocked()) {
    btnContinue.disabled = true;
    btnContinue.textContent = 'Trial Ended';
  }

  // Restore checkbox
  chk.checked = safeGetLS('fireops_paywall_hide_v1') === '1';

  chk.addEventListener('change', () => {
    safeSetLS('fireops_paywall_hide_v1', chk.checked ? '1' : '0');
  });

  btnContinue.addEventListener('click', () => {
    removePaywall();
  });

  btnPay.addEventListener('click', async () => {
    try {
      btnPay.disabled = true;
      btnPay.textContent = 'Opening purchase...';

      const debug = await getProductDebug();
      renderBillingDebug(debug);

      await buyPro();

      // If purchase succeeds, store events will flip the entitlement; also close paywall
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

  // Start billing init in background
  initBilling({ verbose: false })
    .then(async () => {
      const debug = await getProductDebug();
      // Only show debug automatically in native for troubleshooting
      if (isNativeApp()) renderBillingDebug(debug);
    })
    .catch(async () => {
      const debug = await getProductDebug();
      if (isNativeApp()) renderBillingDebug(debug);
    });
}

// Public API
window.fireOpsPaywall = {
  initBilling,
  showPaywallModal,
  shouldShowPaywallNow,
  hardBlocked,
  isProUnlocked,
  setProUnlocked
};
