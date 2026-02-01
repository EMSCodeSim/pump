// app.js — Production (OPTION A: FULL APP BLOCK AFTER 5 DAYS)
// Explicit router + lazy loading (NO guessing paths)

import { renderAdOnce } from './ads-guards.js';

// === AdSense (web-only) ===
const ADS_CLIENT = 'ca-pub-9414291143716298';
const SLOT_TABLES_BOTTOM = 'REPLACE_WITH_SLOT_ID';

const app = document.getElementById('app');
const buttons = Array.from(document.querySelectorAll('.navbtn'));
let currentView = null; // { name, dispose?() }

// Native app detection (Capacitor / Cordova)
function isNativeApp() {
  try {
    if (window?.Capacitor?.isNativePlatform) return !!window.Capacitor.isNativePlatform();
    const p = window?.Capacitor?.getPlatform?.();
    if (p && p !== 'web') return true;
  } catch {}

  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return true;
  } catch {}

  const proto = (window?.location?.protocol || '').toLowerCase();
  return proto === 'capacitor:' || proto === 'ionic:' || proto === 'file:';
}

// ---- Lazy paywall module loader (native only) ----
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

/**
 * These are the ONLY allowed view entrypoints.
 * This prevents the app from ever attempting "./calc.js" or "./practice.js" etc.
 */
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

  if (chartsMount) chartsMount.innerHTML = '<div style="opacity:.7;padding:12px">Loading charts…</div>';

  try {
    const mod = await loaders.charts();
    const res = await mod.render(chartsMount);
    chartsDispose = res?.dispose || null;

    // Ads only on web builds
    if (!isNativeApp()) {
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
      } catch {}
    }
  } catch (err) {
    if (chartsMount) chartsMount.innerHTML = '<div class="card">Failed to load charts: ' + String(err) + '</div>';
  }
}

function closeCharts() {
  if (chartsDispose) { try { chartsDispose(); } catch {} chartsDispose = null; }
  if (chartsMount) chartsMount.innerHTML = '';
  if (chartsOverlay) chartsOverlay.style.display = 'none';
  updateTopActionsVisibility(currentView?.name || 'calc');
}

if (chartsClose) chartsClose.addEventListener('click', closeCharts);
if (chartsOverlay) chartsOverlay.addEventListener('click', (e) => { if (e.target === chartsOverlay) closeCharts(); });

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ]);
}

// -------------------- FULL APP TRIAL GATE --------------------
let _appIsHardBlocked = false;

function renderLockedScreen() {
  if (!app) return;
  app.innerHTML = `
    <div style="padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;">
      <div style="max-width:640px;margin:0 auto;">
        <div style="font-size:22px;font-weight:900;margin-bottom:8px;">Trial Ended</div>
        <div style="opacity:.9;line-height:1.45;margin-bottom:14px;">
          Your 5-day free trial has ended. Upgrade to Pro to continue using FireOps Calc.
        </div>
        <div style="opacity:.75;font-size:13px;line-height:1.45;">
          Tap <b>Buy Pro</b> in the popup to unlock, or <b>Restore Purchase</b> if you already own it.
        </div>
      </div>
    </div>
  `;
}

function disableNavigationUI() {
  // Disable nav buttons and hide charts overlay controls while blocked
  buttons.forEach(b => {
    try { b.disabled = true; b.style.pointerEvents = 'none'; } catch {}
  });
  if (topActionsEl) topActionsEl.style.display = 'none';
}

function enableNavigationUI() {
  buttons.forEach(b => {
    try { b.disabled = false; b.style.pointerEvents = ''; } catch {}
  });
  updateTopActionsVisibility(currentView?.name || 'calc');
}

async function enforceFullAppGate() {
  if (!isNativeApp()) return true;

  const pw = await getPaywall();
  if (!pw) return true;

  try { await pw.initBilling?.(); } catch {}

  try {
    if (pw.hardBlocked?.()) {
      _appIsHardBlocked = true;
      renderLockedScreen();
      disableNavigationUI();
      try { pw.showPaywallModal?.({ force: true }); } catch {}
      return false;
    }
  } catch {}

  _appIsHardBlocked = false;
  enableNavigationUI();
  return true;
}

// On unlock, reload app so everything re-initializes cleanly
window.addEventListener('fireops:pro_unlocked', () => {
  try { window.location.reload(); } catch {}
});

// -------------------- (Optional) Soft paywall check per-view --------------------
// With full-app block after 5 days, we don’t need popups during the trial.
// But we still silently init billing once per launch so owned users unlock.
let _billingInitedThisSession = false;
async function initBillingOnce() {
  if (_billingInitedThisSession) return;
  if (!isNativeApp()) return;

  const pw = await getPaywall();
  if (!pw) return;

  try { await pw.initBilling?.(); } catch {}
  _billingInitedThisSession = true;
}

// ---- Billing test forcing (native only) ----
const KEY_FORCE_BILLING_TEST = 'fireops_force_billing_test_v1';
function billingTestEnabled() {
  try {
    const url = new URL(window.location.href);
    const q = (url.searchParams.get('billtest') || '').trim();
    if (q === '1' || q.toLowerCase() === 'true') {
      try { localStorage.setItem(KEY_FORCE_BILLING_TEST, '1'); } catch {}
    }
  } catch {}
  try { return localStorage.getItem(KEY_FORCE_BILLING_TEST) === '1'; } catch { return false; }
}

async function setView(name) {
  try {
    // If blocked, do nothing (full app locked)
    if (_appIsHardBlocked) return;

    const load = loaders[name];
    if (!load) {
      throw new Error(
        `Unknown view "${name}". Fix your button data-view or add a loader entry in app.js.`
      );
    }

    // Ensure billing is initialized in background (native only)
    await initBillingOnce();

    if (currentView?.dispose) { try { currentView.dispose(); } catch {} }

    updateTopActionsVisibility(name);

    if (app) app.innerHTML = '<div style="opacity:.7;padding:12px">Loading…</div>';

    const mod = await withTimeout(load(), 8000, `Load view "${name}"`);
    if (!mod?.render) throw new Error(`View "${name}" did not export render()`);

    const view = await withTimeout(mod.render(app), 8000, `Render view "${name}"`);

    currentView = { name, dispose: view?.dispose };

    buttons.forEach(b => b.classList.toggle('active', b.dataset.view === name));
    updateTopActionsVisibility(name);
  } catch (err) {
    const msg = String(err?.message || err);
    console.error('[app.js] setView error:', err);

    if (app) {
      app.innerHTML = `
        <div class="card">
          <div style="font-weight:800;margin-bottom:6px;">App failed to load</div>
          <div style="opacity:.85;margin-bottom:10px;">${msg}</div>
          <button class="btn primary" id="btnSetup">Run Preconnect Setup</button>
          <button class="btn" id="btnReload" style="margin-left:8px;">Reload</button>
        </div>
      `;

      const s = document.getElementById('btnSetup');
      if (s) s.onclick = () => window.location.href = '/setup-preconnects.html';

      const r = document.getElementById('btnReload');
      if (r) r.onclick = () => window.location.reload();
    }
  }
}

buttons.forEach(b => b.addEventListener('click', () => {
  if (_appIsHardBlocked) return;

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

// Boot
(async () => {
  // Full hard-block gate FIRST
  const ok = await enforceFullAppGate();
  if (!ok) return;

  // Optional: force the billing popup during the trial for testing
  if (isNativeApp() && billingTestEnabled()) {
    try {
      const pw = await getPaywall();
      await pw?.initBilling?.();
      pw?.showPaywallModal?.({ force: true, allowClose: true });
    } catch {}
  }

  // Normal boot
  setView('calc');
  updateTopActionsVisibility('calc');
})();
