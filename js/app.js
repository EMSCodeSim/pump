// app.js — Production
// Tiny router + lazy loading
// Paywall is lazy-loaded ONLY on native

import { renderAdOnce } from './ads-guards.js';

// === AdSense (web-only) ===
const ADS_CLIENT = 'ca-pub-9414291143716298';
const SLOT_TABLES_BOTTOM = 'REPLACE_WITH_SLOT_ID';

const app = document.getElementById('app');
const buttons = Array.from(document.querySelectorAll('.navbtn'));
let currentView = null; // { name, dispose?() }

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
    } catch {}
  } catch (err) {
    chartsMount.innerHTML = '<div class="card">Failed to load charts: ' + String(err) + '</div>';
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

// On unlock, bounce back to calc
window.addEventListener('fireops:pro_unlocked', () => {
  try { setView('calc'); } catch {}
});

async function setView(name) {
  try {
    // Native-only: show paywall intro + hard block after trial
    if (isNativeApp()) {
      const pw = await getPaywall();
      if (pw) {
        try { await pw.initBilling?.(); } catch {}
        try { pw.showPaywallModal?.({ force: false }); } catch {}

        try {
          if (pw.hardBlocked?.()) {
            if (currentView?.dispose) { try { currentView.dispose(); } catch {} }
            if (topActionsEl) topActionsEl.style.display = 'none';
            currentView = { name: 'paywall', dispose: null };
            buttons.forEach(b => b.classList.remove('active'));
            return;
          }
        } catch {}
      }
    }

    if (currentView?.dispose) { try { currentView.dispose(); } catch {} }

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
