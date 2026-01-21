// app.js (updated)
// Fixes:
// 1) Do NOT unlock/navigate after calling store.order(). Wait until OWNED.
// 2) Uses paywall.js purchaseAndWait() which avoids the store.js name collision.
// 3) Trial modal "Pay Now" path only unlocks after OWNED.

import { buildCalcView } from './calc/view.calc.js';
import { buildPracticeView } from './practice/view.practice.js';
import { buildInfoView } from './info/view.info.js';
import * as pw from './paywall.js';

const PRO_PRODUCT_ID = 'fireops.pro';

// Paywall config
// Option A: hard paywall after 5 days for NEW installs only.
// Existing users are grandfathered free.
const TRIAL_DAYS = 5;
const KEY_INSTALL_TS = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED = 'fireops_pro_unlocked_v1';
const KEY_TRIAL_INTRO_SHOWN = 'fireops_trial_intro_shown_v1';

let currentView = null; // { name, dispose() }

function nowMs() { return Date.now(); }

function daysBetween(msA, msB) {
  const diff = Math.max(0, msB - msA);
  return diff / (1000 * 60 * 60 * 24);
}

function getInstallTs() {
  const v = Number(localStorage.getItem(KEY_INSTALL_TS) || 0);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function ensureInstallTs() {
  let ts = getInstallTs();
  if (!ts) {
    ts = nowMs();
    localStorage.setItem(KEY_INSTALL_TS, String(ts));
  }
  return ts;
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

async function isProOwnedStore() {
  try {
    const ok = await pw.isProOwned(PRO_PRODUCT_ID);
    return !!ok;
  } catch {
    return false;
  }
}

async function shouldBlockForPaywall() {
  // If pro is unlocked locally, allow
  if (isProUnlockedLocal()) return false;

  // If store says owned, allow (and cache locally)
  const owned = await isProOwnedStore();
  if (owned) {
    localStorage.setItem(KEY_PRO_UNLOCKED, '1');
    return false;
  }

  // Grandfathered users: allow
  if (isGrandfathered()) return false;

  const installTs = ensureInstallTs();
  const ageDays = daysBetween(installTs, nowMs());

  // Hard paywall after trial
  return ageDays >= TRIAL_DAYS;
}

function setView(name) {
  if (currentView?.dispose) {
    try { currentView.dispose(); } catch {}
  }
  currentView = null;

  const root = document.getElementById('app');
  if (!root) return;

  root.innerHTML = '';

  if (name === 'calc') {
    currentView = buildCalcView(root);
  } else if (name === 'practice') {
    currentView = buildPracticeView(root);
  } else if (name === 'info') {
    currentView = buildInfoView(root);
  } else {
    currentView = buildCalcView(root);
  }
}

function showTrialIntroIfNeeded() {
  // Only show once per install
  if (localStorage.getItem(KEY_TRIAL_INTRO_SHOWN) === '1') return;
  localStorage.setItem(KEY_TRIAL_INTRO_SHOWN, '1');

  pw.renderTrialIntroModal({
    productId: PRO_PRODUCT_ID,
    trialDays: TRIAL_DAYS,
    onContinue: () => {
      // continue free trial
    },
    onPayNow: async () => {
      // paywall.js only calls this after the purchase is confirmed as OWNED
      try { localStorage.setItem(KEY_PRO_UNLOCKED, '1'); } catch (_e) {}
      setView('calc');
    }
  });
}

async function showPaywallAfterTrial() {
  const root = document.getElementById('app');
  if (!root) return;
  root.innerHTML = '';

  const paywallNode = pw.renderHardPaywall({
    productId: PRO_PRODUCT_ID,
    onPurchase: async () => {
      // IMPORTANT: store.order() only starts the purchase flow.
      // Do NOT unlock or navigate away until Google Play reports the item as OWNED.
      let ok = false;
      try {
        if (pw.purchaseAndWait) {
          ok = await pw.purchaseAndWait(PRO_PRODUCT_ID);
        } else {
          // fallback for older paywall.js
          await pw.buyProduct(PRO_PRODUCT_ID);
          ok = pw.checkOwned ? await pw.checkOwned() : false;
        }
      } catch (e) {
        alert('Purchase failed: ' + (e?.message || e));
        ok = false;
      }

      if (ok) {
        try { localStorage.setItem(KEY_PRO_UNLOCKED, '1'); } catch (_e) {}
        setView('calc');
      } else {
        alert('Purchase not completed. If the Google Play sheet did not open, billing may not be ready yet.');
        // stay on paywall
      }
    },
    onRestore: async () => {
      try {
        const ok = await pw.restorePurchases(PRO_PRODUCT_ID);
        if (ok) {
          localStorage.setItem(KEY_PRO_UNLOCKED, '1');
          setView('calc');
        } else {
          alert('No purchase found to restore for this Google account.');
        }
      } catch (e) {
        alert('Restore failed: ' + (e?.message || e));
      }
    }
  });

  root.appendChild(paywallNode);
}

async function boot() {
  // First: install timestamp
  ensureInstallTs();

  // If the user is already pro (store owned), cache it
  const owned = await isProOwnedStore();
  if (owned) {
    localStorage.setItem(KEY_PRO_UNLOCKED, '1');
  }

  // If NOT grandfathered, and they installed before you introduced trial logic,
  // you can grandfather them by setting KEY_GRANDFATHERED once.
  // (Leave this off unless you intentionally want that behavior.)

  // Show trial intro on first run (only if not blocked)
  const blocked = await shouldBlockForPaywall();
  if (!blocked) {
    showTrialIntroIfNeeded();
    setView('calc');
    return;
  }

  // Otherwise show hard paywall
  await showPaywallAfterTrial();
}

boot();
