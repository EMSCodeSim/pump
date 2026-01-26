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

function shouldForcePaywall() {
  try {
    const qs = new URLSearchParams(location.search);
    if (qs.get('forcePaywall') === '1') return true;
  } catch {}
  try {
    return localStorage.getItem('fireops_force_paywall_v1') === '1';
  } catch {}
  return false;
}

function enablePaywallTestMode() {
  // GUARANTEES the paywall appears + debug enabled.
  // Comment this out when you're done testing billing.
  try {
    localStorage.setItem('fireops_force_paywall_v1', '1');
    localStorage.setItem('fireops_paywall_debug_v1', '1');
  } catch {}
}

// Top quick-action row (Department Setup button)
const topActionsEl = document.querySelector('.top-actions');
function updateTopActionsVisibility(view) {
  if (!topActionsEl) return;
  topActionsEl.style.display = (view === 'calc') ? 'flex' : 'none';
}

function setActiveButton(name) {
  buttons.forEach(b => b.classList.toggle('active', b.dataset.view === name));
}

async function setView(name) {
  try {
    // Native-only: show paywall intro + hard block after trial
    if (isNativeApp()) {
      const pw = await getPaywall();
      if (pw) {
        try { await pw.initBilling?.(); } catch {}
        // IMPORTANT: allow forced paywall when testing (even if grandfathered)
        try { pw.showPaywallModal?.({ force: shouldForcePaywall() }); } catch {}

        // Hard-block screen (trial ended and not pro) — keep your old behavior
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

    const mod = await import(`./calc/${name}.js`).catch(async () => {
      // Fallback if your views are in different folders
      return await import(`./${name}.js`);
    });

    const view = await (mod?.render?.(app) ?? mod?.default?.(app));
    currentView = view || { name, dispose: null };

    setActiveButton(name);

    // Render ads only on web
    if (!isNativeApp()) {
      try { renderAdOnce(ADS_CLIENT, SLOT_TABLES_BOTTOM); } catch {}
    }
  } catch (e) {
    console.error(e);
    if (app) {
      app.innerHTML = `
        <div style="padding:12px">
          <div style="font-weight:800;margin-bottom:8px">App failed to load</div>
          <div style="opacity:.85;margin-bottom:10px">${String(e?.message || e)}</div>
          <button class="btn" id="btnReload">Reload</button>
        </div>
      `;
      const r = document.getElementById('btnReload');
      if (r) r.onclick = () => window.location.reload();
    }
  }
}

function openCharts() {
  window.location.href = '/charts.html';
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

// ===== BOOT =====
(async () => {
  // GUARANTEED paywall for testing on native builds.
  // Comment out enablePaywallTestMode() when you are done testing.
  if (isNativeApp()) {
    enablePaywallTestMode();
    try {
      const pw = await getPaywall();
      if (pw?.showPaywallModal) {
        try { await pw.initBilling?.(); } catch {}
        // Force popup immediately on launch
        pw.showPaywallModal({ force: true });
      }
    } catch (e) {
      try { console.log('[PW] boot paywall error', e); } catch {}
    }
  }

  setView('calc');
  updateTopActionsVisibility('calc');
})();
