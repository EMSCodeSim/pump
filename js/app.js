// app.js — PAYMENT TEST VERSION (Internal track only)
// Always shows the Risk-Free Trial popup + adds a “Payment Test” panel on native.

import { renderAdOnce } from './ads-guards.js';

// === AdSense (web-only) ===
const ADS_CLIENT = 'ca-pub-9414291143716298';
const SLOT_TABLES_BOTTOM = 'REPLACE_WITH_SLOT_ID';

const app = document.getElementById('app');
const buttons = Array.from(document.querySelectorAll('.navbtn'));
let currentView = null; // { name, dispose?() }

// --------------------------- Paywall config ---------------------------
const PRO_PRODUCT_ID = 'fireops.pro';
const TRIAL_DAYS = 5;

const KEY_INSTALL_TS = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED = 'fireops_pro_unlocked_v1';
const KEY_TRIAL_INTRO_SHOWN = 'fireops_trial_intro_shown_v1';

// ====== PAYMENT TEST FLAGS ======
const KEY_PAYTEST = 'fireops_paytest_v1'; // set to "1" for internal builds
function isPayTestEnabled() {
  try { return localStorage.getItem(KEY_PAYTEST) === '1'; } catch (_e) {}
  return false;
}

// Auto-enable paytest if you want (optional):
// try { localStorage.setItem(KEY_PAYTEST, '1'); } catch(_e) {}

function isNativeApp() {
  try {
    if (window?.Capacitor?.isNativePlatform) return !!window.Capacitor.isNativePlatform();
    const p = window?.Capacitor?.getPlatform?.();
    if (p && p !== 'web') return true;
  } catch (_e) {}

  // Capacitor often runs in native WebView at localhost
  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return true;
  } catch (_e) {}

  const proto = (window?.location?.protocol || '').toLowerCase();
  return proto === 'capacitor:' || proto === 'ionic:' || proto === 'file:';
}

function hasAnyExistingUserData() {
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

function initTrialFlags() {
  let ts = 0;
  try { ts = Number(localStorage.getItem(KEY_INSTALL_TS) || '0') || 0; } catch (_e) {}
  if (!ts) {
    const existing = hasAnyExistingUserData();
    if (existing) {
      try { localStorage.setItem(KEY_GRANDFATHERED, '1'); } catch (_e) {}
    }
    try { localStorage.setItem(KEY_INSTALL_TS, String(Date.now())); } catch (_e) {}
  }
}

function isGrandfathered() {
  try { return localStorage.getItem(KEY_GRANDFATHERED) === '1'; } catch (_e) {}
  return false;
}
function isProUnlocked() {
  try { return localStorage.getItem(KEY_PRO_UNLOCKED) === '1'; } catch (_e) {}
  return false;
}
function hasShownTrialIntro() {
  try { return localStorage.getItem(KEY_TRIAL_INTRO_SHOWN) === '1'; } catch (_e) {}
  return false;
}
function markTrialIntroShown() {
  try { localStorage.setItem(KEY_TRIAL_INTRO_SHOWN, '1'); } catch (_e) {}
}
function daysSinceInstall() {
  try {
    const ts = Number(localStorage.getItem(KEY_INSTALL_TS) || '0') || 0;
    if (!ts) return 0;
    return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
  } catch (_e) {}
  return 0;
}

function shouldBlockWithPaywall() {
  if (!isNativeApp()) return false;        // web stays free
  if (isPayTestEnabled()) return false;    // PAYTEST: do NOT hard-block navigation
  if (isGrandfathered()) return false;     // existing users free
  if (isProUnlocked()) return false;       // already paid
  return daysSinceInstall() >= TRIAL_DAYS; // trial expired
}

// ---- Lazy paywall module loader ----
let _paywallMod = null;
async function getPaywall() {
  if (!isNativeApp()) return null;
  if (_paywallMod) return _paywallMod;
  _paywallMod = await import('./paywall.js');
  return _paywallMod;
}

// Top quick-action row (Department Setup button)
const topActionsEl = document.querySelector('.top-actions');
function updateTopActionsVisibility(viewName) {
  if (!topActionsEl) return;
  topActionsEl.style.display = (viewName === 'calc') ? 'flex' : 'none';
}

const loaders = {
  calc:     () => import('./view.calc.js'),
  practice: () => import('./view.practice.js'),
  charts:   () => import('./view.charts.js'),
  settings: () => import('./view.settings.js'),
};

// === Charts overlay support ===
let chartsOverlay = document.getElementById('chartsOverlay');
let chartsMount = document.getElementById('chartsMount');
let chartsClose = document.getElementById('closeCharts');
let chartsDispose = null;

async function openCharts() {
  if (!chartsOverlay) return;
  if (topActionsEl) topActionsEl.style.display = 'none';
  chartsOverlay.style.display = 'block';

  chartsMount.innerHTML = '<div style="opacity:.7;padding:12px">Loading charts…</div>';
  try {
    const mod = await loaders.charts();
    const res = await mod.render(chartsMount);
    chartsDispose = res?.dispose || null;

    try {
      renderAdOnce({
        key: 'tables_bottom',
        container: chartsMount,
        position: 'bottom',
        client: ADS_CLIENT,
        slot: SLOT_TABLES_BOTTOM,
        format: 'auto',
        style: 'display:block; margin:16px 0;',
      });
    } catch (_e) {}
  } catch (err) {
    chartsMount.innerHTML = '<div class="card">Failed to load charts: ' + String(err) + '</div>';
  }
}

function closeCharts() {
  if (chartsDispose) { try { chartsDispose(); } catch (_e) {} chartsDispose = null; }
  if (chartsMount) chartsMount.innerHTML = '';
  if (chartsOverlay) chartsOverlay.style.display = 'none';
  updateTopActionsVisibility(currentView?.name || 'calc');
}

if (chartsClose) chartsClose.addEventListener('click', closeCharts);
if (chartsOverlay) chartsOverlay.addEventListener('click', (e) => { if (e.target === chartsOverlay) closeCharts(); });

// ---- view swapping for calc/practice/settings ----
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ]);
}

function injectPayTestPanel(pw) {
  if (!isNativeApp() || !isPayTestEnabled()) return;
  if (!app) return;

  const existing = document.getElementById('payTestPanel');
  if (existing) return;

  const panel = document.createElement('div');
  panel.id = 'payTestPanel';
  panel.style.cssText = `
    margin:12px; padding:12px; border-radius:14px;
    background:rgba(37,99,235,.12); border:1px solid rgba(37,99,235,.35);
    color:#0b1220;
  `;
  panel.innerHTML = `
    <div style="font-weight:900;margin-bottom:8px;">Payment Test Mode (Internal)</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn primary" id="ptBuy">Buy Now</button>
      <button class="btn" id="ptRestore">Restore</button>
      <button class="btn" id="ptPaywall">Open Full Paywall</button>
      <button class="btn" id="ptClearPro">Clear Pro Flag</button>
      <button class="btn" id="ptClearIntro">Clear Trial Intro Flag</button>
    </div>
    <div style="opacity:.75;margin-top:8px;font-size:.9em;">
      Product: <b>${PRO_PRODUCT_ID}</b>
    </div>
  `;

  app.prepend(panel);

  panel.querySelector('#ptBuy')?.addEventListener('click', async () => {
    await pw.buyProduct(PRO_PRODUCT_ID);
  });
  panel.querySelector('#ptRestore')?.addEventListener('click', async () => {
    const ok = await pw.restorePurchases(PRO_PRODUCT_ID);
    alert(ok ? 'Restore: purchase found ✅' : 'Restore: no purchase found ❌');
  });
  panel.querySelector('#ptPaywall')?.addEventListener('click', async () => {
    app.innerHTML = '';
    await pw.renderPaywall(app, {
      priceText: '$1.99 one-time',
      trialDays: TRIAL_DAYS,
      productId: PRO_PRODUCT_ID,
      onPurchase: async () => {
        await pw.buyProduct(PRO_PRODUCT_ID);
        try { localStorage.setItem(KEY_PRO_UNLOCKED, '1'); } catch (_e) {}
        setView('calc');
      },
      onRestore: async () => {
        const ok = await pw.restorePurchases(PRO_PRODUCT_ID);
        if (ok) {
          try { localStorage.setItem(KEY_PRO_UNLOCKED, '1'); } catch (_e) {}
          setView('calc');
        } else {
          alert('No purchase found for this account.');
        }
      }
    });
  });
  panel.querySelector('#ptClearPro')?.addEventListener('click', () => {
    try { localStorage.removeItem(KEY_PRO_UNLOCKED); } catch (_e) {}
    alert('Cleared Pro flag.');
  });
  panel.querySelector('#ptClearIntro')?.addEventListener('click', () => {
    try { localStorage.removeItem(KEY_TRIAL_INTRO_SHOWN); } catch (_e) {}
    alert('Cleared Trial Intro flag.');
  });
}

async function setView(name) {
  try {
    initTrialFlags();

    if (isNativeApp()) {
      const pw = await getPaywall();

      if (pw) {
        // Enable Payment Test Mode automatically if you want:
        // try { localStorage.setItem(KEY_PAYTEST, '1'); } catch(_e) {}

        // Init billing (fix option name)
        try {
          pw.initBilling?.({
            productId: PRO_PRODUCT_ID,
            onEntitlementChanged: (owned) => {
              if (owned) {
                try { localStorage.setItem(KEY_PRO_UNLOCKED, '1'); } catch (_e) {}
              }
            }
          });
        } catch (_e) {}

        // PAYMENT TEST: Always show the Risk-Free Trial popup on launch (native only)
        if (isPayTestEnabled()) {
          try {
            pw.renderTrialIntroModal?.({
              trialDays: TRIAL_DAYS,
              priceText: '$1.99 one-time',
              onContinue: () => {},
              onBuyNow: async () => { await pw.buyProduct(PRO_PRODUCT_ID); }
            });
          } catch (_e) {}
        } else {
          // Production behavior: show one-time intro for NEW users
          if (!isGrandfathered() && !isProUnlocked() && !shouldBlockWithPaywall() && !hasShownTrialIntro()) {
            markTrialIntroShown();
            try {
              pw.renderTrialIntroModal?.({
                trialDays: TRIAL_DAYS,
                priceText: '$1.99 one-time',
                onContinue: () => {},
                onBuyNow: async () => { await pw.buyProduct(PRO_PRODUCT_ID); }
              });
            } catch (_e) {}
          }

          // Production hard paywall
          if (shouldBlockWithPaywall()) {
            if (currentView?.dispose) { try { currentView.dispose(); } catch (_e) {} }
            if (topActionsEl) topActionsEl.style.display = 'none';

            if (app) {
              app.innerHTML = '';
              await pw.renderPaywall(app, {
                priceText: '$1.99 one-time',
                trialDays: TRIAL_DAYS,
                productId: PRO_PRODUCT_ID,
                onPurchase: async () => {
                  await pw.buyProduct(PRO_PRODUCT_ID);
                  try { localStorage.setItem(KEY_PRO_UNLOCKED, '1'); } catch (_e) {}
                  setView('calc');
                },
                onRestore: async () => {
                  const ok = await pw.restorePurchases(PRO_PRODUCT_ID);
                  if (ok) {
                    try { localStorage.setItem(KEY_PRO_UNLOCKED, '1'); } catch (_e) {}
                    setView('calc');
                  } else {
                    throw new Error('No purchase found for this account.');
                  }
                }
              });
            }

            currentView = { name: 'paywall', dispose: null };
            buttons.forEach(b => b.classList.remove('active'));
            return;
          }
        }
      }
    }

    // Normal view loading
    if (currentView?.dispose) { currentView.dispose(); }

    updateTopActionsVisibility(name);
    if (app) app.innerHTML = '<div style="opacity:.7;padding:12px">Loading…</div>';

    const mod = await withTimeout(loaders[name](), 6000, `Load view "${name}"`);
    const view = await withTimeout(mod.render(app), 6000, `Render view "${name}"`);

    currentView = { name, dispose: view?.dispose };
    buttons.forEach(b => b.classList.toggle('active', b.dataset.view === name));
    updateTopActionsVisibility(name);

    // Inject payment test panel on calc view only
    if (name === 'calc' && isNativeApp()) {
      const pw = await getPaywall();
      if (pw) injectPayTestPanel(pw);
    }
  } catch (err) {
    const msg = String(err);
    if (app) {
      app.innerHTML = `
        <div class="card">
          <div style="font-weight:800;margin-bottom:6px;">App failed to load</div>
          <div style="opacity:.85;margin-bottom:10px;">${msg}</div>
          <button class="btn primary" id="btnReload">Reload</button>
        </div>
      `;
      const r = document.getElementById('btnReload');
      if (r) r.onclick = () => window.location.reload();
    }
  }
}

buttons.forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.view;
  if (v === 'charts') { openCharts(); return; }
  if (v === 'calc' && currentView?.name === 'practice') { window.location.reload(); return; }
  setView(v);
}));

setView('calc');
updateTopActionsVisibility('calc');
