// app.js
// Tiny router + lazy loading (Paywall is lazy-loaded ONLY on native)

import { renderAdOnce } from './ads-guards.js';

// === AdSense (web-only) ===
const ADS_CLIENT = 'ca-pub-9414291143716298';
const SLOT_TABLES_BOTTOM = 'REPLACE_WITH_SLOT_ID';

const app = document.getElementById('app');
const buttons = Array.from(document.querySelectorAll('.navbtn'));
let currentView = null; // { name, dispose?() }

// ----------------------------- Paywall config -----------------------------
// Option A: hard paywall after 5 days for NEW installs only.
// Existing users are grandfathered free.
const PRO_PRODUCT_ID = 'fireops.pro'; // <-- must match Play Console product ID
const TRIAL_DAYS = 5;
const KEY_INSTALL_TS = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED = 'fireops_pro_unlocked_v1';
const KEY_TRIAL_INTRO_SHOWN = 'fireops_trial_intro_shown_v1';

// ----------------------------- Utilities -----------------------------
const isNativeApp = () => !!(window.cordova || window.Capacitor?.isNativePlatform?.());

function nowMs() { return Date.now(); }
function getInstallTs() {
  let ts = Number(localStorage.getItem(KEY_INSTALL_TS) || '0');
  if (!ts) {
    ts = nowMs();
    localStorage.setItem(KEY_INSTALL_TS, String(ts));
  }
  return ts;
}
function daysSinceInstall() {
  return (nowMs() - getInstallTs()) / (1000 * 60 * 60 * 24);
}
function isGrandfathered() {
  return localStorage.getItem(KEY_GRANDFATHERED) === '1';
}
function setGrandfathered() {
  localStorage.setItem(KEY_GRANDFATHERED, '1');
}
function isProUnlockedLocal() {
  return localStorage.getItem(KEY_PRO_UNLOCKED) === '1';
}
function setProUnlockedLocal() {
  localStorage.setItem(KEY_PRO_UNLOCKED, '1');
}
function trialExpired() {
  return daysSinceInstall() >= TRIAL_DAYS;
}
function hasShownTrialIntro() {
  return localStorage.getItem(KEY_TRIAL_INTRO_SHOWN) === '1';
}
function setShownTrialIntro() {
  localStorage.setItem(KEY_TRIAL_INTRO_SHOWN, '1');
}

// ----------------------------- Routing -----------------------------
function setActive(name) {
  buttons.forEach(b => b.classList.toggle('active', b.dataset.view === name));
}

async function setView(name) {
  // Gate protected views on native apps only
  if (isNativeApp()) {
    const allowed = await ensureAccessOrShowPaywall(name);
    if (!allowed) return; // paywall shown
  }

  setActive(name);
  await renderView(name);
}

async function renderView(name) {
  if (currentView?.dispose) {
    try { currentView.dispose(); } catch (_e) {}
  }
  currentView = null;

  if (name === 'calc') {
    const mod = await import('./calc/view.calc.main.js');
    const dispose = mod.renderCalc?.(app) || null;
    currentView = { name, dispose };
  } else if (name === 'practice') {
    const mod = await import('./practice/view.practice.main.js');
    const dispose = mod.renderPractice?.(app) || null;
    currentView = { name, dispose };
  } else if (name === 'tables') {
    const mod = await import('./tables/view.tables.main.js');
    const dispose = mod.renderTables?.(app) || null;
    currentView = { name, dispose };
    // Web-only ad
    if (!isNativeApp()) renderAdOnce({ client: ADS_CLIENT, slot: SLOT_TABLES_BOTTOM });
  } else {
    // default to calc
    const mod = await import('./calc/view.calc.main.js');
    const dispose = mod.renderCalc?.(app) || null;
    currentView = { name: 'calc', dispose };
    setActive('calc');
  }
}

// ----------------------------- Lazy paywall module loader (native only) ----
let _paywallMod = null;
async function getPaywallMod() {
  if (_paywallMod) return _paywallMod;
  _paywallMod = await import('./paywall.js');
  return _paywallMod;
}

// ----------------------------- Access gate -----------------------------
async function ensureAccessOrShowPaywall(targetViewName) {
  // Only gate on native
  if (!isNativeApp()) return true;

  // Existing users are grandfathered on first run if they installed before gating existed.
  // (We mark them the first time this version runs.)
  if (!localStorage.getItem(KEY_INSTALL_TS)) {
    // If they already have existing saved data from older versions, treat as grandfathered.
    // Heuristic: any of these keys indicates an existing install.
    const hasAnyData =
      Object.keys(localStorage).some(k =>
        k.startsWith('dept_') ||
        k.startsWith('fireops_') ||
        k.includes('preset') ||
        k.includes('nozzle')
      );
    if (hasAnyData) setGrandfathered();
    getInstallTs(); // sets timestamp if missing
  }

  // If pro already unlocked or grandfathered, allow
  if (isGrandfathered() || isProUnlockedLocal()) return true;

  // Native-only: billing init + trial intro + paywall
  const pw = await getPaywallMod();

  const billing = await pw.initBilling({
    verbose: true,
    productId: PRO_PRODUCT_ID,
    onOwned: () => {
      setProUnlockedLocal();
      pw.hidePaywall?.();
      // After successful purchase, allow navigation
      // (Optionally re-render current view)
    }
  });

  // Show trial intro once (even if still in trial)
  if (!hasShownTrialIntro()) {
    setShownTrialIntro();
    await pw.showTrialIntro({
      trialDays: TRIAL_DAYS,
      priceText: '$1.99 one-time',
      onContinue: () => pw.hidePaywall?.(),
      onBuy: async () => {
        await pw.buyProduct(PRO_PRODUCT_ID);
      }
    });
    return true; // let them continue
  }

  // Hard paywall after trial expires
  if (trialExpired()) {
    await pw.showPaywall({
      title: '5-Day Free Trial — No Risk',
      subtitle: `Your free trial has ended. Unlock full access with a one-time purchase.`,
      priceText: '$1.99 one-time',
      onBuy: async () => {
        await pw.buyProduct(PRO_PRODUCT_ID);
      },
      onClose: () => {
        // Keep user on paywall view if trial expired; they can close the overlay
        // but the gate will immediately re-render the paywall if they try to access locked areas.
      }
    });
    currentView = { name: 'paywall', dispose: null };
    return false;
  }

  // Trial still active; allow
  return true;
}

// ----------------------------- Wire nav buttons -----------------------------
buttons.forEach(btn => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

// ----------------------------- Boot -----------------------------
(async function boot() {
  // Default route
  const defaultView = 'calc';
  await setView(defaultView);
})();
