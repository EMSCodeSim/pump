// pump/js/paywall.js

const PRO_PRODUCT_ID = 'fireops.pro';
const TRIAL_DAYS = 5;

let storeReady = false;
let storeRef = null;

/* -------------------------------
   Trial helpers
-------------------------------- */

function getInstallTime() {
  const key = 'install_time';
  let t = localStorage.getItem(key);
  if (!t) {
    t = Date.now();
    localStorage.setItem(key, t);
  }
  return parseInt(t, 10);
}

function trialExpired() {
  const daysUsed = (Date.now() - getInstallTime()) / (1000 * 60 * 60 * 24);
  return daysUsed >= TRIAL_DAYS;
}

function isProUnlocked() {
  return localStorage.getItem('pro_unlocked') === 'true';
}

function unlockProLocal() {
  localStorage.setItem('pro_unlocked', 'true');
}

/* -------------------------------
   Safe billing init (NON BLOCKING)
-------------------------------- */

function initBillingSafely() {
  try {
    if (!window.store) {
      console.warn('[Paywall] store not available (web / preview)');
      return;
    }

    storeRef = window.store;
    storeRef.verbosity = storeRef.INFO;

    storeRef.register({
      id: PRO_PRODUCT_ID,
      type: storeRef.NON_CONSUMABLE
    });

    storeRef.when(PRO_PRODUCT_ID).approved(product => {
      product.finish();
      unlockProLocal();
      hidePaywall();
      console.log('[Paywall] Purchase approved');
    });

    storeRef.ready(() => {
      storeReady = true;
      console.log('[Paywall] Store ready');
    });

    storeRef.refresh();
  } catch (err) {
    console.error('[Paywall] Billing init failed:', err);
  }
}

/* -------------------------------
   UI control
-------------------------------- */

function showPaywall() {
  const el = document.getElementById('paywall');
  if (el) el.style.display = 'flex';
}

function hidePaywall() {
  const el = document.getElementById('paywall');
  if (el) el.style.display = 'none';
}

function buyPro() {
  if (!storeReady || !storeRef) {
    alert('Purchases only work when installed from Google Play.');
    return;
  }

  try {
    storeRef.order(PRO_PRODUCT_ID);
  } catch (e) {
    console.error('Purchase failed:', e);
    alert('Purchase unavailable.');
  }
}

/* -------------------------------
   Boot hook (SAFE)
-------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  // App ALWAYS loads
  hidePaywall();

  // Decide later if paywall is needed
  if (!isProUnlocked() && trialExpired()) {
    showPaywall();
  }

  // Billing NEVER blocks app
  setTimeout(initBillingSafely, 0);
});

/* -------------------------------
   Expose button handlers
-------------------------------- */

window.buyPro = buyPro;
window.closePaywall = hidePaywall;
