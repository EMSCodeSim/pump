/* paywall.js — FireOps Calc (DEBUG build)
   Fixes:
   - Correct Google Play platform detection (no more APPLE_APPSTORE on Android)
   - Pay Now always logs and shows errors
*/

export const PRO_PRODUCT_ID = 'fireops.pro';
export const TRIAL_DAYS = 5;

// Storage keys
const KEY_INSTALL_TS    = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED  = 'fireops_pro_unlocked_v1';
const KEY_PAYWALL_HIDE  = 'fireops_paywall_hide_v1';
const KEY_DEBUG_OPEN    = 'fireops_paywall_debug_open_v1';

let _billingInitPromise = null;
let _debugEnabled = true;

// ---------- Helpers ----------
function nowMs() { return Date.now(); }
function daysToMs(days) { return days * 24 * 60 * 60 * 1000; }

function safeGetLS(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSetLS(key, val) { try { localStorage.setItem(key, val); } catch {} }

export function isNativeApp() {
  try {
    if (window?.Capacitor?.isNativePlatform) return !!window.Capacitor.isNativePlatform();
    const p = window?.Capacitor?.getPlatform?.();
    if (p && p !== 'web') return true;
  } catch {}
  const proto = (window?.location?.protocol || '').toLowerCase();
  return proto === 'capacitor:' || proto === 'ionic:' || proto === 'file:' || !!window.cordova;
}

function getBillingStore() {
  return (window.CdvPurchase && window.CdvPurchase.store) || window.store || null;
}

// ---------- Debug Panel ----------
function dbg(msg, obj) {
  if (!_debugEnabled) return;

  try { console.log('[PAYWALL]', msg, obj ?? ''); } catch {}

  try {
    const panel = document.getElementById('paywallDebugPanel');
    if (!panel) return;
    const line = document.createElement('div');
    line.style.padding = '4px 0';
    line.style.borderBottom = '1px solid rgba(255,255,255,.08)';
    line.textContent = `${new Date().toLocaleTimeString()}  ${msg}`;
    panel.appendChild(line);

    if (obj !== undefined) {
      const pre = document.createElement('pre');
      pre.style.margin = '6px 0 0';
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.wordBreak = 'break-word';
      pre.style.fontSize = '11px';
      pre.style.opacity = '.95';
      try { pre.textContent = JSON.stringify(obj, null, 2); } catch { pre.textContent = String(obj); }
      panel.appendChild(pre);
    }

    while (panel.childNodes.length > 220) panel.removeChild(panel.firstChild);
    panel.scrollTop = panel.scrollHeight;
  } catch {}
}

function ensureDebugUI() {
  if (!_debugEnabled) return;
  if (document.getElementById('paywallDebugWrap')) return;

  const wrap = document.createElement('div');
  wrap.id = 'paywallDebugWrap';
  wrap.style.cssText = `
    position:fixed; left:10px; bottom:10px; z-index:100000;
    width:min(460px, 92vw); max-height:40vh;
    background:rgba(0,0,0,.82); color:#fff;
    border:1px solid rgba(255,255,255,.18); border-radius:12px;
    box-shadow:0 10px 30px rgba(0,0,0,.35);
    overflow:hidden; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
    display:${safeGetLS(KEY_DEBUG_OPEN)==='1' ? 'block' : 'none'};
  `;

  wrap.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.12);">
      <div style="font-weight:800;">Paywall Debug</div>
      <div style="display:flex;gap:8px;">
        <button id="paywallDebugCopy" style="border:0;border-radius:10px;padding:6px 10px;font-weight:700;cursor:pointer;">Copy</button>
        <button id="paywallDebugClose" style="border:0;border-radius:10px;padding:6px 10px;font-weight:700;cursor:pointer;">Hide</button>
      </div>
    </div>
    <div id="paywallDebugPanel" style="padding:10px 12px;overflow:auto;max-height:32vh;font-size:12px;line-height:1.25;"></div>
    <div style="padding:10px 12px;border-top:1px solid rgba(255,255,255,.12);font-size:12px;opacity:.85;">
      Tip: tap the 🔧 badge on the paywall to toggle this panel.
    </div>
  `;
  document.body.appendChild(wrap);

  document.getElementById('paywallDebugClose')?.addEventListener('click', () => {
    safeSetLS(KEY_DEBUG_OPEN, '0');
    wrap.style.display = 'none';
  });

  document.getElementById('paywallDebugCopy')?.addEventListener('click', async () => {
    try {
      const panel = document.getElementById('paywallDebugPanel');
      const text = panel ? panel.innerText : '';
      await navigator.clipboard.writeText(text);
      dbg('Copied debug log to clipboard');
    } catch (e) {
      dbg('Copy failed', { err: String(e) });
    }
  });
}

function toggleDebugUI(force) {
  if (!_debugEnabled) return;
  ensureDebugUI();
  const wrap = document.getElementById('paywallDebugWrap');
  if (!wrap) return;
  const show = (force !== undefined) ? !!force : (wrap.style.display === 'none');
  wrap.style.display = show ? 'block' : 'none';
  safeSetLS(KEY_DEBUG_OPEN, show ? '1' : '0');
}

// ---------- Trial / Unlock ----------
function hasAnyExistingUserData() {
  const keys = [
    'fireops_dept_equipment_v1',
    'fireops_quickstart_seen_version',
    'fireops_practice_v1',
    'PRACTICE_SAVE_KEY',
    'fireops_presets_v1',
  ];
  try { for (const k of keys) if (localStorage.getItem(k) != null) return true; } catch {}
  return false;
}

function ensureInstallTimestamps() {
  const existing = safeGetLS(KEY_INSTALL_TS);
  if (!existing) {
    const oldUser = hasAnyExistingUserData();
    safeSetLS(KEY_GRANDFATHERED, oldUser ? '1' : '0');
    safeSetLS(KEY_INSTALL_TS, String(nowMs()));
    dbg('Install timestamp created', { oldUser });
  }
}

function getInstallMs() {
  const v = safeGetLS(KEY_INSTALL_TS);
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function isGrandfathered() { return safeGetLS(KEY_GRANDFATHERED) === '1'; }
export function isProUnlocked() { return safeGetLS(KEY_PRO_UNLOCKED) === '1'; }
export function setProUnlocked(val) { safeSetLS(KEY_PRO_UNLOCKED, val ? '1' : '0'); dbg('setProUnlocked()', { val: !!val }); }

export function trialExpired() {
  const installMs = getInstallMs();
  if (!installMs) return false;
  return (nowMs() - installMs) >= daysToMs(TRIAL_DAYS);
}

export function hardBlocked() {
  if (isProUnlocked()) return false;
  if (isGrandfathered()) return false;
  return trialExpired();
}

function shouldShowPaywallIntro() {
  if (isProUnlocked()) return false;
  if (isGrandfathered()) return false;
  return true;
}

// ---------- UI ----------
function injectPaywallCssOnce() {
  if (document.getElementById('paywallCss')) return;

  const css = `
    .paywall-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.65);
      display:flex; align-items:center; justify-content:center; z-index:99999; padding:16px; }
    .paywall-card{ width:min(540px, 94vw); background:#121826; color:#fff; border-radius:18px;
      box-shadow:0 20px 50px rgba(0,0,0,.45); padding:18px 18px 14px 18px;
      border:1px solid rgba(255,255,255,.08); position:relative; }
    .paywall-badge{ position:absolute; top:10px; right:10px; width:34px; height:34px; border-radius:12px;
      display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,.10);
      cursor:pointer; user-select:none; font-size:16px; }
    .paywall-title{ font-size:22px; font-weight:900; margin:6px 0 6px; }
    .paywall-subtitle{ font-size:15px; line-height:1.35; opacity:.92; margin-bottom:14px; }
    .paywall-actions{ display:flex; gap:12px; justify-content:flex-end; flex-wrap:wrap; }
    .paywall-btn{ border:none; border-radius:12px; padding:12px 16px; font-weight:900; cursor:pointer; min-width:190px; }
    .paywall-btn.secondary{ background:transparent; color:#dbe6ff; border:1px solid rgba(255,255,255,.25); }
    .paywall-btn.primary{ background:#2a6bff; color:#fff; }
    .paywall-btn[disabled]{ opacity:.55; cursor:not-allowed; }
    .paywall-dontshow{ display:flex; gap:10px; align-items:center; margin-top:12px; opacity:.85; font-size:13px; }
    .paywall-footnote{ margin-top:10px; font-size:12px; opacity:.65; }
    .paywall-debug-pill{ margin-top:12px; padding:10px 12px; border-radius:14px;
      background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.10);
      font-size:12px; line-height:1.25; opacity:.92; }
    .paywall-debug-pill b{ opacity:1; }
    .paywall-error{ margin-top:10px; color:#ffb4b4; font-size:12px; display:none; }
  `;

  const style = document.createElement('style');
  style.id = 'paywallCss';
  style.textContent = css;
  document.head.appendChild(style);
}

function removePaywall() {
  const overlay = document.getElementById('paywallOverlay');
  if (overlay) overlay.remove();
}

// ---------- Platform detection (FIX) ----------
function detectGooglePlayPlatform(store) {
  // Different versions expose different constants. We search all common spots.
  try {
    // Most common
    if (store?.Platform?.GOOGLE_PLAY) return store.Platform.GOOGLE_PLAY;
    if (store?.PLAY_STORE) return store.PLAY_STORE;

    // Sometimes under CdvPurchase.Platform
    if (window?.CdvPurchase?.Platform?.GOOGLE_PLAY) return window.CdvPurchase.Platform.GOOGLE_PLAY;

    // Fallback: scan store.Platform keys for something that includes GOOGLE
    const plat = store?.Platform;
    if (plat && typeof plat === 'object') {
      for (const k of Object.keys(plat)) {
        const up = String(k).toUpperCase();
        if (up.includes('GOOGLE') || up.includes('PLAY')) return plat[k];
      }
    }
  } catch {}
  return null;
}

function platformLabel(store) {
  try {
    const gp = detectGooglePlayPlatform(store);
    if (gp) return 'GOOGLE_PLAY';
    if (store?.Platform?.APPLE_APPSTORE || store?.APPLE_APPSTORE) return 'APPLE_APPSTORE';
    return 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

function getProductSnapshot(store) {
  try {
    const p =
      (store?.get && store.get(PRO_PRODUCT_ID)) ||
      (store?.products && store.products.find?.(x => x?.id === PRO_PRODUCT_ID)) ||
      null;

    if (!p) return { found: false };

    return {
      found: true,
      id: p.id,
      title: p.title,
      price: p.price || p.pricing?.price,
      state: p.state,
      owned: !!p.owned,
      canPurchase: p.canPurchase,
      type: p.type,
      platform: p.platform,
    };
  } catch (e) {
    return { found: false, err: String(e) };
  }
}

// ---------- Billing ----------
export async function initBilling() {
  if (_billingInitPromise) return _billingInitPromise;

  _billingInitPromise = (async () => {
    ensureDebugUI();
    dbg('initBilling() called');

    if (!isNativeApp()) { dbg('Not native; billing skipped'); return; }

    const store = getBillingStore();
    if (!store) { dbg('Billing store not found (window.CdvPurchase.store missing)'); return; }

    const gpPlatform = detectGooglePlayPlatform(store);

    dbg('Store detected', {
      hasCdvPurchase: !!window.CdvPurchase,
      platformLabel: platformLabel(store),
      hasWhen: typeof store.when === 'function',
      hasRegister: typeof store.register === 'function',
      hasOrder: typeof store.order === 'function',
      gpPlatformFound: !!gpPlatform,
    });

    // Register product (DO NOT force iOS; DO NOT set Apple platform)
    try {
      const typeConst = store.NON_CONSUMABLE || store.ProductType?.NON_CONSUMABLE || 'non-consumable';
      const reg = { id: PRO_PRODUCT_ID, type: typeConst };
      // Only set platform if we positively identified Google Play
      if (gpPlatform) reg.platform = gpPlatform;

      store.register(reg);
      dbg('store.register() OK', reg);
    } catch (e) {
      dbg('store.register() FAILED', { err: String(e) });
    }

    // Wire events
    try {
      store.when(PRO_PRODUCT_ID).approved((p) => {
        dbg('EVENT approved', { id: p?.id, state: p?.state });
        try { p.verify?.(); } catch {}
      });

      store.when(PRO_PRODUCT_ID).verified((p) => {
        dbg('EVENT verified', { id: p?.id, state: p?.state });
        setProUnlocked(true);
        try { p.finish?.(); } catch {}
        try { window.dispatchEvent(new CustomEvent('fireops:pro_unlocked', { detail: { productId: PRO_PRODUCT_ID } })); } catch {}
      });

      store.when(PRO_PRODUCT_ID).owned((p) => {
        dbg('EVENT owned', { id: p?.id, state: p?.state });
        setProUnlocked(true);
        try { p.finish?.(); } catch {}
        try { window.dispatchEvent(new CustomEvent('fireops:pro_unlocked', { detail: { productId: PRO_PRODUCT_ID } })); } catch {}
      });

      store.error((e) => dbg('STORE ERROR', { code: e?.code, message: e?.message, err: e }));
    } catch (e) {
      dbg('Event wiring failed', { err: String(e) });
    }

    // Initialize: Prefer Google Play only, otherwise let plugin auto-detect (SAFE fallback)
    try {
      if (gpPlatform) {
        dbg('Calling store.initialize([GOOGLE_PLAY])');
        await store.initialize([gpPlatform]);
      } else {
        dbg('Calling store.initialize() WITHOUT platform (auto-detect fallback)');
        await store.initialize();
      }
      dbg('store.initialize() OK');
    } catch (e) {
      dbg('store.initialize() FAILED', { err: String(e) });
    }

    // Refresh
    try {
      if (typeof store.update === 'function') { dbg('Calling store.update()'); await store.update(); dbg('store.update() OK'); }
      else if (typeof store.refresh === 'function') { dbg('Calling store.refresh()'); await store.refresh(); dbg('store.refresh() OK'); }
      else dbg('No update()/refresh() found on store');
    } catch (e) {
      dbg('Product refresh FAILED', { err: String(e) });
    }

    dbg('Product snapshot after init', getProductSnapshot(store));
  })();

  return _billingInitPromise;
}

export async function buyPro() {
  dbg('buyPro() start');

  const store = getBillingStore();
  if (!store) throw new Error('Billing store missing (window.CdvPurchase.store not available)');

  await initBilling();

  // refresh again before ordering
  try {
    if (typeof store.update === 'function') await store.update();
    else if (typeof store.refresh === 'function') await store.refresh();
  } catch {}

  const snap = getProductSnapshot(store);
  dbg('Product snapshot before order', snap);

  if (!snap.found) {
    throw new Error(`Product not found from Play: "${PRO_PRODUCT_ID}". This usually means:
- SKU mismatch (Play Console Product ID must be EXACT)
- Not installed from a Play test track that includes this APK/AAB
- Tester account not added / not accepted testing invite
- Play cache delay (can take a few hours after product activation)`);
  }

  dbg('Calling store.order()', { id: PRO_PRODUCT_ID });
  await store.order(PRO_PRODUCT_ID);
  dbg('store.order() returned (purchase UI may still be open)');
}

// ---------- Main entry ----------
export function enforcePaywall({ force = false } = {}) {
  ensureInstallTimestamps();
  ensureDebugUI();

  const store = getBillingStore();
  const debugSummary = `Store=${!!store} • Platform=${platformLabel(store)} • Host=${window.location.hostname}`;

  dbg('enforcePaywall()', {
    force,
    native: isNativeApp(),
    platform: platformLabel(store),
    grandfathered: isGrandfathered(),
    proUnlocked: isProUnlocked(),
    hardBlocked: hardBlocked(),
    trialExpired: trialExpired(),
  });

  if (!force) {
    if (!shouldShowPaywallIntro()) return;
    const dontShow = safeGetLS(KEY_PAYWALL_HIDE) === '1';
    if (dontShow && !hardBlocked()) return;
  }

  injectPaywallCssOnce();
  if (document.getElementById('paywallOverlay')) return;

  const html = `
  <div class="paywall-overlay" id="paywallOverlay">
    <div class="paywall-card">
      <div class="paywall-badge" id="btnPaywallDebug" title="Toggle Debug">🔧</div>

      <div class="paywall-title">${hardBlocked() ? 'Trial Ended' : '5-Day Free Trial'}</div>
      <div class="paywall-subtitle">
        FireOps Calc is free for ${TRIAL_DAYS} days. Unlock full access anytime with a one-time purchase.
      </div>

      <div class="paywall-actions">
        <button class="paywall-btn secondary" id="btnContinueTrial">Continue Free Trial</button>
        <button class="paywall-btn primary" id="btnPayNow">Unlock Pro — $1.99 one-time</button>
      </div>

      <div class="paywall-error" id="paywallError"></div>

      <label class="paywall-dontshow" id="dontShowRow">
        <input type="checkbox" id="chkDontShow" />
        Do not show this again
      </label>

      <div class="paywall-footnote">Purchases are processed through Google Play.</div>

      <div class="paywall-debug-pill">
        <div><b>Product:</b> ${PRO_PRODUCT_ID}</div>
        <div><b>Native:</b> ${isNativeApp()}</div>
        <div><b>Grandfathered:</b> ${isGrandfathered()}</div>
        <div><b>Pro unlocked:</b> ${isProUnlocked()}</div>
        <div><b>Hard blocked:</b> ${hardBlocked()}</div>
        <div style="margin-top:6px;opacity:.85;">${debugSummary}</div>
      </div>
    </div>
  </div>`;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper.firstElementChild);

  const btnDbg = document.getElementById('btnPaywallDebug');
  btnDbg?.addEventListener('click', () => toggleDebugUI());

  const btnContinue = document.getElementById('btnContinueTrial');
  const btnPay = document.getElementById('btnPayNow');
  const chk = document.getElementById('chkDontShow');
  const errBox = document.getElementById('paywallError');

  // HARD CLICK PROOF (logs even if something else fails)
  btnPay?.addEventListener('click', () => dbg('CLICK: Pay Now button tapped'));

  if (hardBlocked()) {
    if (btnContinue) { btnContinue.disabled = true; btnContinue.textContent = 'Trial Ended'; }
    const dontShowRow = document.getElementById('dontShowRow');
    if (dontShowRow) dontShowRow.style.display = 'none';
  }

  if (chk) chk.checked = safeGetLS(KEY_PAYWALL_HIDE) === '1';
  chk?.addEventListener('change', () => safeSetLS(KEY_PAYWALL_HIDE, chk.checked ? '1' : '0'));

  btnContinue?.addEventListener('click', () => {
    if (hardBlocked()) return;
    dbg('Continue trial clicked');
    removePaywall();
  });

  btnPay?.addEventListener('click', async () => {
    try {
      if (!btnPay) return;
      btnPay.disabled = true;
      btnPay.textContent = 'Opening Google Play…';
      if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }

      dbg('Pay flow starting...');
      await buyPro();

      removePaywall();
    } catch (e) {
      const msg = String(e?.message || e);
      dbg('Pay flow failed', { err: msg });

      if (errBox) {
        errBox.textContent = msg;
        errBox.style.display = 'block';
      }
      if (btnPay) {
        btnPay.disabled = false;
        btnPay.textContent = 'Unlock Pro — $1.99 one-time';
      }
    }
  });

  // kick init
  initBilling();
}

// Back-compat
export function showPaywallModal(opts) { return enforcePaywall(opts); }

// optional debug global
window.fireOpsPaywall = { enforcePaywall, initBilling, buyPro, hardBlocked };
