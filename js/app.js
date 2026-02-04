// app.js — PRODUCTION
// Option A: FULL APP BLOCK AFTER 5 DAYS
// Includes native cache / service worker kill switch (Android fix)

import { renderAdOnce } from './ads-guards.js';

/* =========================================================
   🔥 NATIVE CACHE / SERVICE WORKER KILL SWITCH
   Prevents Android WebView from pinning old JS forever
   ========================================================= */
(async function killStaleCaches() {
  try {
    const isNative =
      (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() !== 'web') ||
      window.location.protocol === 'file:' ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:';

    if (!isNative) return;

    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }

    // Clear CacheStorage
    if (window.caches?.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch {
    // swallow errors silently
  }
})();
/* ========================================================= */

const ADS_CLIENT = 'ca-pub-9414291143716298';
const SLOT_TABLES_BOTTOM = 'REPLACE_WITH_SLOT_ID';

const app = document.getElementById('app');
const buttons = Array.from(document.querySelectorAll('.navbtn'));
let currentView = null;

/* -------------------- Native app detection -------------------- */
function isNativeApp() {
  try {
    if (window?.cordova || window?.phonegap || window?.PhoneGap) return true;
    if (window?.Capacitor?.isNativePlatform) return !!window.Capacitor.isNativePlatform();
    const p = window?.Capacitor?.getPlatform?.();
    if (p && p !== 'web') return true;
  } catch {}
  const proto = (window?.location?.protocol || '').toLowerCase();
  return proto === 'file:' || proto === 'capacitor:' || proto === 'ionic:';
}

/* -------------------- Paywall loader (native only) -------------------- */
let _paywallMod = null;
async function getPaywall() {
  if (!isNativeApp()) return null;
  if (_paywallMod) return _paywallMod;
  _paywallMod = await import('./paywall.js');
  return _paywallMod;
}

/* -------------------- Top actions visibility -------------------- */
const topActionsEl = document.querySelector('.top-actions');
function updateTopActionsVisibility(viewName) {
  if (!topActionsEl) return;
  topActionsEl.style.display = (viewName === 'calc') ? 'flex' : 'none';
}

/* -------------------- View loaders -------------------- */
const loaders = {
  calc:     () => import('./view.calc.js'),
  practice: () => import('./view.practice.js'),
  charts:   () => import('./view.charts.js'),
  settings: () => import('./view.settings.js'),
};

/* -------------------- Charts overlay -------------------- */
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
    if (chartsMount) chartsMount.innerHTML =
      '<div class="card">Failed to load charts: ' + String(err) + '</div>';
  }
}

function closeCharts() {
  if (chartsDispose) { try { chartsDispose(); } catch {} chartsDispose = null; }
  if (chartsMount) chartsMount.innerHTML = '';
  if (chartsOverlay) chartsOverlay.style.display = 'none';
  updateTopActionsVisibility(currentView?.name || 'calc');
}

if (chartsClose) chartsClose.addEventListener('click', closeCharts);
if (chartsOverlay) chartsOverlay.addEventListener('click', (e) => {
  if (e.target === chartsOverlay) closeCharts();
});

/* -------------------- Utility -------------------- */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);
}

/* ==================== FULL APP GATE ==================== */
let _blocked = false;

function renderTrialEndedScreen() {
  if (!app) return;
  app.innerHTML = `
    <div style="padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;">
      <div style="max-width:640px;margin:0 auto;">
        <div style="font-size:22px;font-weight:900;margin-bottom:8px;">Trial Ended</div>
        <div style="opacity:.9;line-height:1.45;margin-bottom:14px;">
          Your 5-day free trial has ended. Upgrade to Pro to continue using FireOps Calc.
        </div>
        <div style="opacity:.75;font-size:12px;">
          Use Buy Pro / Restore in the popup.
        </div>
      </div>
    </div>
  `;
}

function disableNav() {
  buttons.forEach(b => {
    try { b.disabled = true; b.style.pointerEvents = 'none'; } catch {}
  });
  if (topActionsEl) topActionsEl.style.display = 'none';
}

function enableNav() {
  buttons.forEach(b => {
    try { b.disabled = false; b.style.pointerEvents = ''; } catch {}
  });
  updateTopActionsVisibility(currentView?.name || 'calc');
}

async function enforceProductionGate() {
  if (!isNativeApp()) return true;

  const pw = await getPaywall();
  if (!pw) return true;

  try { await pw.initBilling?.(); } catch {}

  if (pw.hardBlocked?.()) {
    _blocked = true;
    renderTrialEndedScreen();
    disableNav();
    try { pw.showPaywallModal?.(); } catch {}
    return false;
  }

  _blocked = false;
  enableNav();
  return true;
}

/* -------------------- Unlock handler -------------------- */
window.addEventListener('fireops:pro_unlocked', async () => {
  const pw = await getPaywall();
  try { pw?.hidePaywallModal?.(); } catch {}

  _blocked = false;
  enableNav();

  try {
    await setView('calc');
  } catch {
    try { window.location.reload(); } catch {}
  }
});

/* -------------------- View switching -------------------- */
async function setView(name) {
  if (_blocked) return;

  const load = loaders[name];
  if (!load) throw new Error(`Unknown view "${name}"`);

  if (currentView?.dispose) {
    try { currentView.dispose(); } catch {}
  }

  updateTopActionsVisibility(name);
  if (app) app.innerHTML = '<div style="opacity:.7;padding:12px">Loading…</div>';

  const mod = await withTimeout(load(), 8000, `Load view "${name}"`);
  if (!mod?.render) throw new Error(`View "${name}" did not export render()`);

  const view = await withTimeout(mod.render(app), 8000, `Render view "${name}"`);
  currentView = { name, dispose: view?.dispose };

  buttons.forEach(b => b.classList.toggle('active', b.dataset.view === name));
  updateTopActionsVisibility(name);
}

buttons.forEach(b => b.addEventListener('click', () => {
  if (_blocked) return;

  const v = b.dataset.view;
  if (v === 'charts') { openCharts(); return; }

  if (v === 'calc' && currentView?.name === 'practice') {
    window.location.reload();
    return;
  }

  setView(v);
}));

/* -------------------- Boot -------------------- */
(async () => {
  const ok = await enforceProductionGate();
  if (!ok) return;

  await setView('calc');
  updateTopActionsVisibility('calc');
})();
