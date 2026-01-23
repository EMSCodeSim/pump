// app.js
// Tiny router + lazy loading (Paywall is lazy-loaded ONLY on native)

import { renderAdOnce } from './ads-guards.js';

// === AdSense (web-only) ===
const ADS_CLIENT = 'ca-pub-9414291143716298';
const SLOT_TABLES_BOTTOM = 'REPLACE_WITH_SLOT_ID';

const app = document.getElementById('app');
const buttons = Array.from(document.querySelectorAll('.navbtn'));
let currentView = null; // { name, dispose?() }

// --------------------------- Paywall config ---------------------------
// Play Console product id (no underscores)
const PRO_PRODUCT_ID = 'fireops.pro';
const TRIAL_DAYS = 5;

const KEY_INSTALL_TS = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED = 'fireops_pro_unlocked_v1';
const KEY_TRIAL_INTRO_SHOWN = 'fireops_trial_intro_shown_v1';

function isNativeApp() {
  try {
    // Preferred: Capacitor API
    if (window?.Capacitor?.isNativePlatform) return !!window.Capacitor.isNativePlatform();
    const p = window?.Capacitor?.getPlatform?.();
    if (p && p !== 'web') return true;
  } catch (_e) {}

  // Capacitor Android often runs http(s)://localhost inside native WebView
  try {
    const host = (window?.location?.host || '').toLowerCase();
    if (host.includes('localhost')) return true;
  } catch (_e) {}

  // Cordova hint
  try {
    if (window?.cordova) return true;
  } catch (_e) {}

  return false;
}

function nowMs() { return Date.now(); }

function initTrialFlags() {
  // install timestamp: used to compute trial
  try {
    if (!localStorage.getItem(KEY_INSTALL_TS)) {
      localStorage.setItem(KEY_INSTALL_TS, String(nowMs()));
    }
  } catch (_e) {}
}

function getInstallTs() {
  try { return Number(localStorage.getItem(KEY_INSTALL_TS) || 0); } catch (_e) { return 0; }
}

function hasShownTrialIntro() {
  try { return localStorage.getItem(KEY_TRIAL_INTRO_SHOWN) === '1'; } catch (_e) { return false; }
}

function markTrialIntroShown() {
  try { localStorage.setItem(KEY_TRIAL_INTRO_SHOWN, '1'); } catch (_e) {}
}

function isGrandfathered() {
  try { return localStorage.getItem(KEY_GRANDFATHERED) === '1'; } catch (_e) { return false; }
}

function isProUnlocked() {
  try { return localStorage.getItem(KEY_PRO_UNLOCKED) === '1'; } catch (_e) { return false; }
}

function trialExpired() {
  const ts = getInstallTs();
  if (!ts) return false;
  const days = (nowMs() - ts) / (1000 * 60 * 60 * 24);
  return days >= TRIAL_DAYS;
}

function shouldBlockWithPaywall() {
  // Only native builds gate; web remains open
  if (!isNativeApp()) return false;
  if (isGrandfathered()) return false;
  if (isProUnlocked()) return false;
  return trialExpired();
}

// --------------------------- Charts overlay ---------------------------
const chartsOverlay = document.getElementById('chartsOverlay');
const chartsClose = document.getElementById('chartsClose');
const chartsBody = document.getElementById('chartsBody');
const chartsTitle = document.getElementById('chartsTitle');

function openCharts() {
  if (!chartsOverlay) return;
  chartsTitle.textContent = 'Charts';
  chartsBody.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="font-weight:800;margin-bottom:6px">Quick Charts</div>
      <div style="opacity:.85">Pump charts & quick-reference tools.</div>
    </div>
  `;
  chartsOverlay.classList.add('open');
}

function closeCharts() {
  chartsOverlay?.classList.remove('open');
}

chartsClose?.addEventListener('click', closeCharts);
chartsOverlay?.addEventListener('click', (e) => { if (e.target === chartsOverlay) closeCharts(); });

// --------------------------- Lazy loaders ---------------------------
const loaders = {
  calc: () => import('./view.calc.main.js'),
  practice: () => import('./view.practice.js'),
  tables: () => import('./view.tables.js'),
  settings: () => import('./view.settings.js'),
};

function updateTopActionsVisibility(viewName) {
  const topActions = document.getElementById('topActions');
  if (!topActions) return;
  // Example: show only on calc
  topActions.style.display = (viewName === 'calc') ? '' : 'none';
}

// Web-only AdSense safe render (does nothing on native)
try {
  renderAdOnce?.(ADS_CLIENT, SLOT_TABLES_BOTTOM, '#tablesAdBottom');
} catch (_e) {}

// --------------------------- Paywall module lazy import ---------------------------
let _paywallMod = null;
let _billingInitDone = false;

async function getPaywall() {
  if (!isNativeApp()) return null;
  if (_paywallMod) return _paywallMod;
  _paywallMod = await import('./paywall.js');
  return _paywallMod;
}

// ---- view swapping for calc/practice/settings ----
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ]);
}

async function setView(name) {
  try {
    initTrialFlags();

    // Native-only: billing init + trial intro + paywall
    if (isNativeApp()) {
      const pw = await getPaywall();

      if (pw) {
        // Init billing once per app launch (never block app if it fails)
        if (!_billingInitDone) {
          _billingInitDone = true;
          try {
            await pw.initBilling?.({ verbose: true });
          } catch (_e) {}
        }

        // First-time: show “Risk-Free Trial” popup (new users only)
        if (!isGrandfathered() && !isProUnlocked() && !shouldBlockWithPaywall() && !hasShownTrialIntro()) {
          markTrialIntroShown();
          try {
            pw.renderTrialIntroModal?.({
              trialDays: TRIAL_DAYS,
              priceText: '$1.99 one-time',
              onContinue: () => {},
              onPay: async () => {
                await pw.buyProduct(PRO_PRODUCT_ID);
                setView('calc');
              },
              onRestore: async () => {
                const res = await pw.restorePurchases(PRO_PRODUCT_ID);
                if (res?.ok && res?.restored) {
                  setView('calc');
                } else {
                  throw new Error('No purchase found for this account.');
                }
              }
            });
          } catch (_e) {}
        }

        // Hard paywall after trial expires
        if (shouldBlockWithPaywall()) {
          if (currentView?.dispose) { try { currentView.dispose(); } catch (_e) {} }
          const topActionsEl = document.getElementById('topActions');
          if (topActionsEl) topActionsEl.style.display = 'none';

          if (app) {
            app.innerHTML = '';
            await pw.renderPaywall({
              priceText: '$1.99 one-time',
              onPay: async () => {
                await pw.buyProduct(PRO_PRODUCT_ID);
                setView('calc');
              },
              onRestore: async () => {
                const res = await pw.restorePurchases(PRO_PRODUCT_ID);
                if (res?.ok && res?.restored) {
                  setView('calc');
                } else {
                  throw new Error('No purchase found for this account.');
                }
              },
              onClose: () => {
                // If trial expired, user will be re-gated on next navigation.
              },
            });
          }

          currentView = { name: 'paywall', dispose: null };
          buttons.forEach(b => b.classList.remove('active'));
          return;
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
  } catch (err) {
    const msg = String(err);
    if (app) {
      app.innerHTML = `
        <div class="card">
          <div style="font-weight:800;margin-bottom:6px;">App failed to load</div>
          <div style="opacity:.85;margin-bottom:10px;">${msg}</div>

          <button class="btn primary" id="btnSetup">Run Preconnect Setup</button>
          <button class="btn" id="btnReload" style="margin-left:8px;">Hard Reload</button>

          <div style="opacity:.7;margin-top:10px;font-size:.9em;">
            If this keeps happening on web, clear site data for fireopscalc.com (cache + storage).
          </div>
        </div>
      `;

      const s = document.getElementById('btnSetup');
      if (s) s.onclick = () => window.location.href = '/setup-preconnects.html';

      const r = document.getElementById('btnReload');
      if (r) r.onclick = () => window.location.reload();
    }
  }
}

// Intercept bottom-nav clicks: open overlay for Charts, swap view for others
buttons.forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.view;

  if (v === 'charts') {
    openCharts();
    return;
  }

  // If coming back to calc from practice, force a full page reload
  if (v === 'calc' && currentView?.name === 'practice') {
    window.location.reload();
    return;
  }

  setView(v);
}));

setView('calc');
updateTopActionsVisibility('calc');
