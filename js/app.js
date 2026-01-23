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
    const host = (window?.location?.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return true;
  } catch (_e) {}

  // Fallback: native schemes
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
function isProUnlockedLocal() {
  try { return localStorage.getItem(KEY_PRO_UNLOCKED) === '1'; } catch (_e) {}
  return false;
}
function setProUnlockedLocal() {
  try { localStorage.setItem(KEY_PRO_UNLOCKED, '1'); } catch (_e) {}
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
  if (isGrandfathered()) return false;     // existing users free
  if (isProUnlockedLocal()) return false;  // already paid (local flag)
  return daysSinceInstall() >= TRIAL_DAYS; // trial expired
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

async function setView(name) {
  try {
    initTrialFlags();

    // Native-only: billing init + trial intro + paywall
    if (isNativeApp()) {
      const pw = await getPaywall();

      if (pw) {
        // Init billing (safe: never block app if it fails)
        try {
          await pw.initBilling?.({ verbose: true });

          // If plugin reports owned, keep local flag in sync
          try {
            if (pw.isProUnlocked?.()) setProUnlockedLocal();
          } catch (_e) {}
        } catch (_e) {}

        // First-time: show “Risk-Free Trial” popup (new users only)
        if (!isGrandfathered() && !isProUnlockedLocal() && !shouldBlockWithPaywall() && !hasShownTrialIntro()) {
          markTrialIntroShown();
          try {
            pw.renderTrialIntroModal?.({
              trialDays: TRIAL_DAYS,
              priceText: '$1.99 one-time',
              onContinue: () => {},
              onPay: async () => {
                const res = await pw.buyProduct(PRO_PRODUCT_ID);
                if (res?.ok) setProUnlockedLocal();
              }
            });
          } catch (_e) {}
        }

        // Hard paywall after trial expires
        if (shouldBlockWithPaywall()) {
          if (currentView?.dispose) { try { currentView.dispose(); } catch (_e) {} }
          if (topActionsEl) topActionsEl.style.display = 'none';

          if (app) {
            app.innerHTML = '';
            await pw.renderPaywall({
              priceText: '$1.99 one-time',
              onPay: async () => {
                const res = await pw.buyProduct(PRO_PRODUCT_ID);
                if (res?.ok) setProUnlockedLocal();
                // After purchase, re-enter calc
                setView('calc');
              },
              onClose: () => {
                // Trial expired; keep them gated.
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
