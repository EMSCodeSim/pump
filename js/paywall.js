// paywall.js
import { Capacitor } from '@capacitor/core';
import {
  InAppPurchase,
  PurchaseState
} from '@capacitor-community/in-app-purchase';

// =====================
// CONFIG
// =====================
const PRO_PRODUCT_ID = 'fireops.pro';
const TRIAL_DAYS = 5;

const KEY_INSTALL_TS = 'fireops_install_ts_v1';
const KEY_PRO_UNLOCKED = 'fireops_pro_unlocked_v1';
const KEY_TRIAL_INTRO_SHOWN = 'fireops_trial_intro_shown_v1';

// =====================
// ENV CHECK
// =====================
function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

// =====================
// STATE HELPERS
// =====================
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

// =====================
// PAYWALL ENTRY
// =====================
export async function maybeShowPaywall() {
  if (hasPro()) return;

  if (!trialExpired()) {
    showTrialPopup();
  } else {
    showHardPaywall();
  }
}

// =====================
// UI
// =====================
function showTrialPopup() {
  if (localStorage.getItem(KEY_TRIAL_INTRO_SHOWN)) return;
  localStorage.setItem(KEY_TRIAL_INTRO_SHOWN, 'true');

  document.body.classList.add('show-paywall');
}

function showHardPaywall() {
  document.body.classList.add('show-paywall');
}

// =====================
// BUY FLOW
// =====================
export async function payNow() {
  if (!isNativeAndroid()) {
    alert(
      'Purchases only work inside the installed Google Play app (not the website).'
    );
    return;
  }

  try {
    // Load products
    const { products } = await InAppPurchase.getProducts({
      productIds: [PRO_PRODUCT_ID],
    });

    if (!products || !products.length) {
      throw new Error('Product not available from Play Store');
    }

    // Start purchase
    const result = await InAppPurchase.purchase({
      productId: PRO_PRODUCT_ID,
    });

    if (
      result.purchaseState === PurchaseState.PURCHASED ||
      result.purchaseState === PurchaseState.RESTORED
    ) {
      markProUnlocked();
      await InAppPurchase.finishTransaction({
        purchase: result,
      });

      unlockUI();
    }
  } catch (err) {
    console.error('Purchase failed', err);
    alert('Purchase failed: ' + err.message);
  }
}

// =====================
// RESTORE
// =====================
export async function restorePurchases() {
  if (!isNativeAndroid()) return;

  try {
    const { purchases } = await InAppPurchase.restorePurchases();

    const owned = purchases.find(
      p =>
        p.productId === PRO_PRODUCT_ID &&
        (p.purchaseState === PurchaseState.PURCHASED ||
          p.purchaseState === PurchaseState.RESTORED)
    );

    if (owned) {
      markProUnlocked();
      unlockUI();
    }
  } catch (err) {
    console.error('Restore failed', err);
  }
}

// =====================
// UNLOCK UI
// =====================
function unlockUI() {
  document.body.classList.remove('show-paywall');
  location.reload();
}
