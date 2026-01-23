// app.js
// Tiny router + lazy loading (Paywall is lazy-loaded ONLY on native)

import { renderAdOnce } from './ads-guards.js';

// === AdSense (web-only) ===
const ADS_CLIENT = 'ca-pub-9414291143716880';
const ADS_SLOT = '1234567890';

// ------------------------------ Paywall config ------------------------------
// Option A: hard paywall after 5 days for NEW installs only.
// Existing users are grandfathered free.
const PRO_PRODUCT_ID = 'fireops.pro'; // <-- set this same ID in Play Console one-time product
const TRIAL_DAYS = 5;
const KEY_INSTALL_TS = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED = 'fireops_pro_unlocked_v1';
const KEY_TRIAL_INTRO_SHOWN = 'fireops_trial_intro_shown_v1';

// ------------------------------ Router ------------------------------
let currentView = null; // { name, dispose?() }

function isNativeApp() {
  return !!(window.Capacitor?.isNativePlatform?.() || window.cordova);
}

function daysSince(ts) {
  return (Date.now() - ts) / (1000 * 60 * 60 * 24);
}

function getOrSetInstallTs() {
  try {
    let ts = Number(localStorage.getItem(KEY_INSTALL_TS) || '0');
    if (!ts) {
      ts = Date.now();
      localStorage.setItem(KEY_INSTALL_TS, String(ts));
    }
    return ts;
  } catch (_e) {
    return Date.now();
  }
}

function isGrandfathered() {
  try {
    return localStorage.getItem(KEY_GRANDFATHERED) === '1';
  } catch (_e) {
    return false;
  }
}

function setGrandfathered() {
  try {
    localStorage.setItem(KEY_GRANDFATHERED, '1');
  } catch (_e) {}
}

function isProUnlockedLocal() {
  try {
    return localStorage.getItem(KEY_PRO_UNLOCKED) === '1';
  } catch (_e) {
    return false;
  }
}

function setProUnlockedLocal() {
  try {
    localStorage.setItem(KEY_PRO_UNLOCKED, '1');
  } catch (_e) {}
}

function shouldShowPaywall() {
  // Web never paywalls
  if (!isNativeApp()) return false;

  // Grandfathered users never paywall
  if (isGrandfathered()) return false;

  // If already unlocked, no paywall
  if (isProUnlockedLocal()) return false;

  const installTs = getOrSetInstallTs();
  const days = daysSince(installTs);

  return days >= TRIAL_DAYS;
}

// ------------------------------ UI helpers ------------------------------
function $(sel) { return document.querySelector(sel); }

function setBodyClass(cls) {
  document.body.className = cls || '';
}

function setMain(html) {
  const main = $('#app');
  if (main) main.innerHTML = html;
}

function showToast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.position = 'fixed';
  el.style.left = '50%';
  el.style.bottom = '22px';
  el.style.transform = 'translateX(-50%)';
  el.style.background = 'rgba(0,0,0,0.8)';
  el.style.color = 'white';
  el.style.padding = '10px 14px';
  el.style.borderRadius = '12px';
  el.style.fontSize = '14px';
  el.style.zIndex = '99999';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ------------------------------ Paywall view ------------------------------
async function showTrialIntroIfNeeded() {
  if (!isNativeApp()) return;

  try {
    const shown = localStorage.getItem(KEY_TRIAL_INTRO_SHOWN) === '1';
    if (shown) return;
    localStorage.setItem(KEY_TRIAL_INTRO_SHOWN, '1');
  } catch (_e) {}

  // Show intro paywall (optional, does not block)
  await openPaywall({ allowContinue: true, forceShow: true });
}

async function openPaywall({ allowContinue = true, forceShow = false } = {}) {
  // Lazy load paywall + billing only when needed
  const paywall = await import('./paywall.js');

  // Initialize billing (native only)
  await paywall.initBilling({ verbose: true });

  const title = '5-Day Free Trial — No Risk';
  const desc = `FireOps Calc is free for ${TRIAL_DAYS} days. You can unlock full access anytime with a one-time purchase.`;
  const hint = `If the purchase sheet doesn’t open, billing may not be ready yet.`;

  setBodyClass('view-paywall');
  setMain(`
    <div class="paywall-wrap">
      <div class="paywall-card">
        <h2>${title}</h2>
        <p>${desc}</p>
        <p class="muted">${hint}</p>

        <div class="paywall-actions">
          ${allowContinue ? `<button id="btn-continue" class="btn-secondary">Continue Free Trial</button>` : ''}
          <button id="btn-buy" class="btn-primary">Pay Now — $1.99 one-time</button>
        </div>

        <label class="paywall-opt">
          <input type="checkbox" id="opt-hide" />
          Do not show this again
        </label>
      </div>
    </div>
  `);

  const btnBuy = $('#btn-buy');
  const btnContinue = $('#btn-continue');
  const optHide = $('#opt-hide');

  if (btnContinue) {
    btnContinue.addEventListener('click', () => {
      // Allow continue trial (no purchase)
      navigateToHome();
    });
  }

  if (btnBuy) {
    btnBuy.addEventListener('click', async () => {
      btnBuy.disabled = true;
      btnBuy.textContent = 'Opening purchase...';
      try {
        await paywall.buyProduct(PRO_PRODUCT_ID);
        setProUnlockedLocal();
        showToast('Pro unlocked. Thank you!');
        navigateToHome();
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        showToast('Purchase failed: ' + msg);
        btnBuy.disabled = false;
        btnBuy.textContent = 'Pay Now — $1.99 one-time';
      }
    });
  }

  if (optHide) {
    optHide.addEventListener('change', () => {
      if (optHide.checked) setGrandfathered();
    });
  }
}

// ------------------------------ App views ------------------------------
function navigateToHome() {
  setBodyClass('view-home');
  setMain(`
    <div class="home-wrap">
      <h1>FireOps Calc</h1>
      <div class="home-actions">
        <button id="go-calc" class="btn-primary">Pump Calculator</button>
        <button id="go-practice" class="btn-secondary">Practice</button>
        <button id="go-info" class="btn-secondary">Tables / Info</button>
      </div>
      <div id="ad-slot"></div>
    </div>
  `);

  // web-only ads
  if (!isNativeApp()) {
    renderAdOnce({ client: ADS_CLIENT, slot: ADS_SLOT, containerSelector: '#ad-slot' });
  }

  $('#go-calc')?.addEventListener('click', () => location.href = './index.html');
  $('#go-practice')?.addEventListener('click', () => location.href = './practice.html');
  $('#go-info')?.addEventListener('click', () => location.href = './tables.html');
}

// ------------------------------ Boot ------------------------------
async function boot() {
  // Existing installs can be grandfathered by setting this once (optional logic)
  // If you want: mark all installs before a certain date as grandfathered.
  // For now: only set when user checks "Do not show again" on paywall.

  // Show trial intro once on native (non-blocking)
  await showTrialIntroIfNeeded();

  // Enforce paywall after trial window (native only)
  if (shouldShowPaywall()) {
    await openPaywall({ allowContinue: false, forceShow: true });
    return;
  }

  navigateToHome();
}

boot();
