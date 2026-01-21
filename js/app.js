// app.js — FireOps Calc (paywall + routing)
// Updated: do NOT auto-unlock / navigate unless purchase returns {ok:true}
// Also warms billing on paywall open (initBilling)

const PRO_PRODUCT_ID = 'fireops.pro';
const TRIAL_DAYS = 5;

const KEY_INSTALL_TS = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED = 'fireops_pro_unlocked_v1';
const KEY_TRIAL_INTRO_SHOWN = 'fireops_trial_intro_shown_v1';

let currentView = null; // { name, dispose() }

function nowMs() { return Date.now(); }

function isProUnlocked() {
  try { return localStorage.getItem(KEY_PRO_UNLOCKED) === '1'; } catch (_e) { return false; }
}

function isGrandfathered() {
  try { return localStorage.getItem(KEY_GRANDFATHERED) === '1'; } catch (_e) { return false; }
}

function ensureInstallTs() {
  try {
    let ts = localStorage.getItem(KEY_INSTALL_TS);
    if (!ts) {
      ts = String(nowMs());
      localStorage.setItem(KEY_INSTALL_TS, ts);
    }
    return Number(ts) || nowMs();
  } catch (_e) {
    return nowMs();
  }
}

function daysSince(ms) {
  const d = (nowMs() - ms) / (1000 * 60 * 60 * 24);
  return d;
}

function inTrialWindow() {
  const ts = ensureInstallTs();
  return daysSince(ts) < TRIAL_DAYS;
}

function needsPaywall() {
  if (isGrandfathered()) return false;
  if (isProUnlocked()) return false;
  return !inTrialWindow();
}

function clearMain() {
  const app = document.getElementById('app');
  if (app) app.innerHTML = '';
  return app;
}

function setView(name) {
  if (currentView && typeof currentView.dispose === 'function') {
    try { currentView.dispose(); } catch (_e) {}
  }
  currentView = null;

  if (name === 'calc') {
    // Your existing calc view loader
    const app = clearMain();
    const div = document.createElement('div');
    div.style.padding = '12px';
    div.innerHTML = `
      <h2 style="margin:0 0 8px 0;">FireOps Calc</h2>
      <div style="opacity:.8;">(Calc view loads here)</div>
    `;
    app.appendChild(div);
    currentView = { name: 'calc', dispose(){} };
    return;
  }

  if (name === 'paywall') {
    (async () => {
      const app = clearMain();
      const pw = await getPaywallModule();

      // ✅ Warm billing on open (doesn't block UI)
      if (typeof pw.initBilling === 'function') {
        try { await pw.initBilling(PRO_PRODUCT_ID); } catch(_e) {}
      }

      pw.renderPaywall(app, {
        productId: PRO_PRODUCT_ID,
        trialDays: TRIAL_DAYS,
        onClose: () => {
          // If trial still active, allow entry; otherwise keep paywall
          if (!needsPaywall()) setView('calc');
          else setView('paywall');
        },
        onPurchase: async () => {
          // ✅ ONLY unlock and leave paywall when purchase truly succeeds
          const res = await pw.buyProduct(PRO_PRODUCT_ID);
          if (res && res.ok) {
            try { localStorage.setItem(KEY_PRO_UNLOCKED, '1'); } catch (_e) {}
            setView('calc');
            return;
          }
          const reason = (res && (res.reason || (res.error && res.error.message)))
            ? (res.reason || res.error.message)
            : 'Purchase cancelled or failed.';
          throw new Error(reason);
        },
        onRestore: async () => {
          const r = await pw.restorePurchases(PRO_PRODUCT_ID);
          if (r && r.ok) {
            try { localStorage.setItem(KEY_PRO_UNLOCKED, '1'); } catch (_e) {}
            setView('calc');
            return;
          }
          const reason = (r && r.reason) ? r.reason : 'No purchase found to restore.';
          throw new Error(reason);
        },
        onContinueTrial: () => {
          setView('calc');
        }
      });

      currentView = { name: 'paywall', dispose(){} };
    })();
    return;
  }

  // default
  setView('calc');
}

async function getPaywallModule() {
  // IMPORTANT: no bare imports like '@capacitor/core' (breaks browser/module loader)
  return await import('./paywall.js');
}

function boot() {
  // First-run “intro shown” logic stays yours (if you use it)
  try {
    if (!localStorage.getItem(KEY_TRIAL_INTRO_SHOWN)) {
      localStorage.setItem(KEY_TRIAL_INTRO_SHOWN, '1');
    }
  } catch (_e) {}

  // Route
  if (needsPaywall()) setView('paywall');
  else setView('calc');
}

document.addEventListener('DOMContentLoaded', boot);
