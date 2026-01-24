/* paywall.js — FireOps Calc (Production)
   - 5-day free trial for NEW installs only
   - Existing installs auto-grandfathered if user data is present
   - One-time purchase unlock (fireops.pro)
   - No debug UI/logging
*/

export const PRO_PRODUCT_ID = 'fireops.pro';
export const TRIAL_DAYS = 5;

const KEY_INSTALL_TS = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED = 'fireops_pro_unlocked_v1';
const KEY_PAYWALL_HIDE = 'fireops_paywall_hide_v1';

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

function hasAnyExistingUserData() {
  // If these exist, we assume they were an existing user before the paywall rollout
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

function buildPaywallHtml() {
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

export async function initBilling() {
  if (_billingInitPromise) return _billingInitPromise;

  _billingInitPromise = (async () => {
    if (!isNativeApp()) return;

    const store = getBillingStore();
    if (!store) return;

    // Register product
    try {
      store.register({
        id: PRO_PRODUCT_ID,
        type: store.NON_CONSUMABLE,
        platform: (store.PLAY_STORE || store.Platform?.GOOGLE_PLAY || undefined)
      });
    } catch {}

    // Wire events
    try {
      store.when(PRO_PRODUCT_ID).approved((p) => { try { p.verify(); } catch {} });
      store.when(PRO_PRODUCT_ID).verified((p) => {
        setProUnlocked(true);
        try { p.finish(); } catch {}

        // Let app know immediately
        try {
          window.dispatchEvent(new CustomEvent('fireops:pro_unlocked', { detail: { productId: PRO_PRODUCT_ID } }));
        } catch {}
      });
    } catch {}

    // Initialize store
    try {
      const platforms = [];
      if (store?.PLAY_STORE) platforms.push(store.PLAY_STORE);
      else if (store?.Platform?.GOOGLE_PLAY) platforms.push(store.Platform.GOOGLE_PLAY);
      else if (store?.APPLE_APPSTORE) platforms.push(store.APPLE_APPSTORE);
      else if (store?.Platform?.APPLE_APPSTORE) platforms.push(store.Platform.APPLE_APPSTORE);

      await store.initialize(platforms.length ? platforms : undefined);
      try { await store.update(); } catch {}
    } catch {}
  })();

  return _billingInitPromise;
}

export async function buyPro() {
  const store = getBillingStore();
  if (!store) throw new Error('Billing not available');

  await initBilling();

  // Ensure product is present (best-effort)
  try { await store.update(); } catch {}

  try {
    await store.order(PRO_PRODUCT_ID);
  } catch (e) {
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
    try {
      btnPay.disabled = true;
      btnPay.textContent = 'Opening Google Play…';
      await buyPro();
      // verified() will unlock; close immediately for a clean UX
      removePaywall();
    } catch {
      // Restore button (no alerts; keep it simple)
      btnPay.disabled = false;
      btnPay.textContent = 'Unlock Pro — $1.99 one-time';
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
