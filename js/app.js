// app.js — Production
// Tiny router + lazy loading
// Paywall is lazy-loaded ONLY on native

import { renderAdOnce } from './ads-guards.js';

// === AdSense (web-only) ===
const ADS_CLIENT = 'ca-pub-9414291143716298';
const SLOT_TABLES_BOTTOM = 'REPLACE_WITH_SLOT_ID';

const app = document.getElementById('app');
const buttons = Array.from(document.querySelectorAll('.navbtn'));
let currentView = null;

// ---- Native detection ----
function isNativeApp() {
  try {
    const cap = window.Capacitor;
    if (cap?.isNativePlatform?.()) return true;
  } catch {}
  // Cordova fallback
  return !!window.cordova;
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
  // Only show on calc view
  topActionsEl.style.display = (viewName === 'calc') ? '' : 'none';
}

// Simple timeouts guard against silent render killers
function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

// ---- View loaders (lazy) ----
const loaders = {
  calc: () => import('./calc/view.calc.main.js'),
  practice: () => import('./practice/view.practice.js'),
  tables: () => import('./tables/view.tables.js'),
  info: () => import('./info/view.info.js'),
};

// Department Setup quick action button routes to calc subpanel
document.getElementById('btnDeptSetup')?.addEventListener('click', async () => {
  try {
    await setView('calc');
    // Optional: if calc view exposes openDeptSetup
    const mod = await import('./calc/view.calc.main.js');
    mod.openDeptSetup?.();
  } catch (e) {
    console.error('DeptSetup route failed', e);
  }
});

// If paywall triggers an unlock event, bounce user back to calc
window.addEventListener('fireops:pro_unlocked', () => {
  try { setView('calc'); } catch {}
});

async function setView(name) {
  try {
    // Native-only: show paywall intro + hard block after trial
    if (isNativeApp()) {
      const pw = await getPaywall();
      if (pw) {
        // New paywall API: enforcePaywall({force})
        // Back-compat: if an older paywall is still bundled, fall back gracefully.
        try {
          if (typeof pw.enforcePaywall === 'function') {
            pw.enforcePaywall({ force: false });
          } else if (typeof pw.showPaywallModal === 'function') {
            pw.showPaywallModal({ force: false });
          } else if (typeof pw.initBilling === 'function') {
            // Last resort: init billing only (won't show UI unless paywall does it)
            pw.initBilling();
          }
        } catch (e) {
          console.error('Paywall enforce failed', e);
        }

        // Hard block after trial expires (unless pro is unlocked)
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
          <div style="font-weight:800;margin-bottom:6px;">Something went wrong</div>
          <div style="opacity:.85;font-size:13px;white-space:pre-wrap">${msg}</div>
          <div style="margin-top:10px;opacity:.7;font-size:12px">Try reloading. If this keeps happening, it may be a module load error.</div>
        </div>
      `;
    }
    console.error(err);
  }
}

// ---- Nav buttons ----
buttons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const view = btn.dataset.view;
    if (!view) return;
    await setView(view);
  });
});

// ---- Web-only ads ----
function setupWebAds() {
  if (isNativeApp()) return;
  // Example: only render ads on tables/info views
  // (You can refine based on your UI)
  try {
    renderAdOnce({
      client: ADS_CLIENT,
      slot: SLOT_TABLES_BOTTOM,
      where: '#adsBottom',
    });
  } catch (e) {
    console.warn('Ad render failed', e);
  }
}

// ---- App start ----
(async function boot() {
  try {
    // Default view
    await setView('calc');
    setupWebAds();
  } catch (e) {
    console.error('Boot failed', e);
  }
})();
