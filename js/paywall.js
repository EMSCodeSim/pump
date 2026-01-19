// paywall.js
// Runtime-safe Capacitor access (NO imports)

const PRO_PRODUCT_ID = 'fireops.pro';
const TRIAL_DAYS = 5;

const KEY_INSTALL_TS = 'fireops_install_ts_v1';
const KEY_PRO_UNLOCKED = 'fireops_pro_unlocked_v1';
const KEY_TRIAL_INTRO_SHOWN = 'fireops_trial_intro_shown_v1';

// --------------------
// ENV
// --------------------
function getCapacitor() {
  return window.Capacitor || null;
}

function isNativeAndroid() {
  const cap = getCapacitor();
  return cap && cap.isNativePlatform && cap.getPlatform() === 'android';
}

// --------------------
// STATE
// --------------------
function hasPro() {
  return localStorage.getItem(KEY_PRO_UNLOCKED) === 'true';
}

function markProUnlocked() {
  localStorage.setItem(KEY_PRO_UNLOCKED, 'true');
}

function getInstallTime() {
  let ts = localStorage.getItem(KEY_INSTALL_TS);
  if (!ts) {
    ts = Date.now();
    localStorage.setItem(KEY_INSTALL_TS, ts);
  }
  return Number(ts);
}

function trialExpired() {
  const days =
    (Date.now() - getInstallTime()) / (1000 * 60 * 60 * 24);
  return days >= TRIAL_DAYS;
}

// --------------------
// PAYWALL ENTRY
// --------------------
window.maybeShowPaywall = function () {
  if (hasPro()) return;

  if (!trialExpired()) {
    showTrialPopup();
  } else {
    showHardPaywall();
  }
};

// --------------------
// UI
// --------------------
function showTrialPopup() {
  if (localStorage.getItem(KEY_TRIAL_INTRO_SHOWN)) return;
  localStorage.setItem(KEY_TRIAL_INTRO_SHOWN, 'true');
  document.body.classList.add('show-paywall');
}

function showHardPaywall() {
  document.body.classList.add('show-paywall');
}

// --------------------
// BUY FLOW
// --------------------
window.payNow = async function () {
  if (!isNativeAndroid()) {
    alert(
      'Purchases only work inside the installed Google Play app (not the website).'
    );
    return;
  }

  const cap = getCapacitor();
  const IAP = cap?.Plugins?.InAppPurchase;

  if (!IAP) {
    alert('Billing plugin not available');
    return;
  }

  try {
    const result = await IAP.purchase({
      productId: PRO_PRODUCT_ID,
    });

    if (
      result.purchaseState === 1 || // PURCHASED
      result.purchaseState === 2    // RESTORED
    ) {
      markProUnlocked();
      await IAP.finishTransaction({ purchase: result });
      unlockUI();
    }
  } catch (err) {
    console.error('Purchase failed', err);
    alert('Purchase failed: ' + err.message);
  }
};

// --------------------
// RESTORE
// --------------------
window.restorePurchases = async function () {
  if (!isNativeAndroid()) return;

  const cap = getCapacitor();
  const IAP = cap?.Plugins?.InAppPurchase;
  if (!IAP) return;

  try {
    const result = await IAP.restorePurchases();
    const owned = result.purchases?.find(
      p => p.productId === PRO_PRODUCT_ID
    );

    if (owned) {
      markProUnlocked();
      unlockUI();
    }
  } catch (err) {
    console.error('Restore failed', err);
  }
};

// --------------------
// UNLOCK
// --------------------
function unlockUI() {
  document.body.classList.remove('show-paywall');
  location.reload();
}
