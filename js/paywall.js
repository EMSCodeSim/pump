/* paywall.js — FireOps Calc (DEBUG / TEST BUILD)
   - Always-on debug overlay (visible in native app)
   - 5-day free trial for NEW installs only
   - Existing installs auto-grandfathered if user data is present
   - One-time purchase unlock (fireops.pro)
   - Pay Now NEVER closes paywall unless verified/owned
*/

export const PRO_PRODUCT_ID = 'fireops.pro';
export const TRIAL_DAYS = 5;

const KEY_INSTALL_TS = 'fireops_install_ts_v1';
const KEY_GRANDFATHERED = 'fireops_grandfathered_v1';
const KEY_PRO_UNLOCKED = 'fireops_pro_unlocked_v1';
const KEY_PAYWALL_HIDE = 'fireops_paywall_hide_v1';

// Debug
const KEY_BILLING_DEBUG_LOG = 'fireops_billing_debug_log_v1';
const BILLING_DEBUG = true; // ✅ FORCE ON for testing builds

let _billingInitPromise = null;
let _storeListenersAttached = false;
let _purchaseInProgress = false;

// ---------- Utilities ----------
function nowMs() { return Date.now(); }
function daysToMs(days) { return days * 24 * 60 * 60 * 1000; }

export function isNativeApp() {
  return !!(window.cordova || window.Capacitor?.isNativePlatform?.());
}

function getBillingStore() {
  return (window.CdvPurchase && window.CdvPurchase.store) || window.store || null;
}

function safeGetLS(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetLS(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

function appendDebugPersist(line) {
  try {
    const prev = localStorage.getItem(KEY_BILLING_DEBUG_LOG) || '';
    const next = (prev + line).slice(-12000); // keep last ~12k chars
    localStorage.setItem(KEY_BILLING_DEBUG_LOG, next);
  } catch {}
}

// ---------- Debug Panel ----------
function injectDebugCssOnce() {
  if (document.getElementById('fireopsDbgCss')) return;
  const css = `
    #fireopsDbgPanel{
      position:fixed; left:10px; right:10px; bottom:10px;
      z-index:100000; background:rgba(0,0,0,.9); color:#fff;
      border-radius:14px; padding:10px 10px 8px;
      font:12px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial;
      box-shadow:0 14px 40px rgba(0,0,0,.55);
      max-height:38vh; overflow:auto; display:none;
    }
    #fireopsDbgPanel .row{display:flex; gap:8px; align-items:center; justify-content:space-between;}
    #fireopsDbgPanel .btn{
      border:0; border-radius:10px; padding:6px 10px;
      background:#3b3b3b; color:#fff; cursor:pointer; font-weight:800;
    }
    #fireopsDbgPanel pre{white-space:pre-wrap; margin:8px 0 0 0;}
    #fireopsDbgBadge{
      position:fixed; left:10px; bottom:10px; z-index:100001;
      background:rgba(0,0,0,.75); color:#fff; padding:8px 10px;
      border-radius:12px; font:12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial;
      display:none;
    }
  `;
  const style = document.createElement('style');
  style.id = 'fireopsDbgCss';
  style.textContent = css;
  document.head.appendChild(style);
}

function ensureDebugUI() {
  if (!BILLING_DEBUG) return;
  injectDebugCssOnce();

  if (!document.getElementById('fireopsDbgBadge')) {
    const badge = document.createElement('div');
    badge.id = 'fireopsDbgBadge';
    badge.textContent = 'Billing Debug';
    badge.addEventListener('click', () => {
      const panel = document.getElementById('fireopsDbgPanel');
      if (panel) panel.style.display = 'block';
      badge.style.display = 'none';
    });
    document.body.appendChild(badge);
    badge.style.display = 'block';
  }

  if (document.getElementById('fireopsDbgPanel')) return;

  const panel = document.createElement('div');
  panel.id = 'fireopsDbgPanel';
  panel.innerHTML = `
    <div class="row">
      <strong>Billing Debug</strong>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn" id="fireopsDbgCopy">Copy</button>
        <button class="btn" id="fireopsDbgClear">Clear</button>
        <button class="btn" id="fireopsDbgHide">Hide</button>
      </div>
    </div>
    <div style="margin-top:6px;opacity:.9">
      <div id="fireopsDbgStatus"></div>
    </div>
    <pre id="fireopsDbgLog"></pre>
  `;
  document.body.appendChild(panel);
  panel.style.display = 'block';

  const log = panel.querySelector('#fireopsDbgLog');
  const persisted = safeGetLS(KEY_BILLING_DEBUG_LOG);
  if (log && persisted) log.textContent = persisted;

  panel.querySelector('#fireopsDbgHide')?.addEventListener('click', () => {
    panel.style.display = 'none';
    const badge = document.getElementById('fireopsDbgBadge');
    if (badge) badge.style.display = 'block';
  });

  panel.querySelector('#fireopsDbgClear')?.addEventListener('click', () => {
    safeSetLS(KEY_BILLING_DEBUG_LOG, '');
    const logEl = document.getElementById('fireopsDbgLog');
    if (logEl) logEl.textContent = '';
  });

  panel.querySelector('#fireopsDbgCopy')?.addEventListener('click', async () => {
    try {
      const txt = document.getElementById('fireopsDbgLog')?.textContent || '';
      await navigator.clipboard.writeText(txt);
      dbg('✅ Copied debug log to clipboard');
    } catch {
      dbg('❌ Clipboard copy failed (may be blocked).');
    }
  });
}

function setDebugStatus(lines) {
  if (!BILLING_DEBUG) return;
  ensureDebugUI();
  const el = document.getElementById('fireopsDbgStatus');
  if (!el) return;
  el.innerHTML = lines.map(s => `<div>• ${escapeHtml(s)}</div>`).join('');
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function dbg(...args) {
  const msg = args.map(a => {
    try { return typeof a === 'string' ? a : JSON.stringify(a, null, 2); }
    catch { return String(a); }
  }).join(' ');

  try { console.log('[FIREOPS_BILLDBG]', msg); } catch {}
  const line = `${new Date().toLocaleTimeString()}  ${msg}\n`;
  appendDebugPersist(line);

  if (!BILLING_DEBUG) return;

  ensureDebugUI();
  const log = document.getElementById('fireopsDbgLog');
  const panel = document.getElementById('fireopsDbgPanel');
  if (panel) panel.style.display = 'block';
  if (log) {
    log.textContent += line;
    log.scrollTop = log.scrollHeight;
  }

  // In-your-face alerts only for critical missing bridge/product conditions
  if (msg.includes('❌') || msg.includes('NULL (product not returned')) {
    try { alert(msg); } catch {}
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => dbg('window.error:', e.message, e.filename, e.lineno));
  window.addEventListener('unhandledrejection', (e) => dbg('unhandledrejection:', e.reason?.message || e.reason));
}

// ---------- Trial / grandfather logic ----------
function hasAnyExistingUserData() {
  // If these exist, we assume they were an existing user before the paywall rollout
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
  } catch {}
  return false;
}

function ensureInstallTimestamps() {
  const existing = safeGetLS(KEY_INSTALL_TS);
  if (!existing) {
    const oldUser = hasAnyExistingUserData();
    safeSetLS(KEY_GRANDFATHERED, oldUser ? '1' : '0');
    safeSetLS(KEY_INSTALL_TS, String(nowMs()));
  }
}

function getInstallMs() {
  const v = safeGetLS(KEY_INSTALL_TS);
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function isGrandfathered() {
  return safeGetLS(KEY_GRANDFATHERED) === '1';
}

export function isProUnlocked() {
  return safeGetLS(KEY_PRO_UNLOCKED) === '1';
}

export function setProUnlocked(val) {
  safeSetLS(KEY_PRO_UNLOCKED, val ? '1' : '0');
}

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

// ---------- Paywall UI ----------
function buildPaywallHtml() {
  return `
  <div class="paywall-overlay" id="paywallOverlay" role="dialog" aria-modal="true" aria-label="FireOps Pro Paywall">
    <div class="paywall-card">
      <div class="paywall-hero">
        <img src="assets/firetruck.png" alt="FireOps Calc" class="paywall-truck" />
      </div>

      <div class="paywall-title">5-Day Free Trial</div>
      <div class="paywall-subtitle">
        FireOps Calc is free for ${TRIAL_DAYS} days. Unlock full access anytime with a one-time purchase.
      </div>

      <div class="paywall-actions">
        <button class="paywall-btn secondary" id="btnContinueTrial">Continue Free Trial</button>
        <button class="paywall-btn primary" id="btnPayNow">Unlock Pro — $1.99 one-time</button>
      </div>

      <div class="paywall-actions" style="margin-top:10px">
        <button class="paywall-btn secondary" id="btnRestore">Restore Purchases</button>
        <button class="paywall-btn secondary" id="btnShowDebug">Show Debug</button>
      </div>

      <label class="paywall-dontshow" id="dontShowRow">
        <input type="checkbox" id="chkDontShow" />
        Do not show this again
      </label>

      <div class="paywall-footnote">
        Purchases are processed through Google Play.
      </div>

      <div class="paywall-footnote" id="paywallDiag" style="opacity:.9;margin-top:8px;"></div>
    </div>
  </div>
  `;
}

function injectPaywallCssOnce() {
  if (document.getElementById('paywallCss')) return;
  const css = `
    .paywall-overlay{
      position:fixed; inset:0; background:rgba(0,0,0,.65);
      display:flex; align-items:center; justify-content:center; z-index:99999;
      padding:16px;
    }
    .paywall-card{
      width:min(540px, 94vw);
      background:#121826; color:#fff; border-radius:16px;
      box-shadow:0 20px 50px rgba(0,0,0,.45);
      padding:18px 18px 14px 18px;
    }
    .paywall-hero{ display:flex; justify-content:center; margin-bottom:10px; }
    .paywall-truck{ max-width:240px; width:50%; height:auto; opacity:.95; }
    .paywall-title{ font-size:22px; font-weight:800; margin:6px 0 6px; }
    .paywall-subtitle{ font-size:15px; line-height:1.35; opacity:.92; margin-bottom:14px; }
    .paywall-actions{ display:flex; gap:12px; justify-content:flex-end; flex-wrap:wrap; }
    .paywall-btn{
      border:none; border-radius:12px; padding:12px 16px; font-weight:800;
      cursor:pointer; min-width:180px;
    }
    .paywall-btn.secondary{ background:transparent; color:#dbe6ff; border:1px solid rgba(255,255,255,.25); }
    .paywall-btn.primary{ background:#2a6bff; color:#fff; }
    .paywall-btn[disabled]{ opacity:.55; cursor:not-allowed; }
    .paywall-dontshow{ display:flex; gap:10px; align-items:center; margin-top:12px; opacity:.8; font-size:13px; }
    .paywall-footnote{ margin-top:10px; font-size:12px; opacity:.65; }
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

function setDiag(text) {
  const el = document.getElementById('paywallDiag');
  if (el) el.textContent = text || '';
}

function dispatchUnlocked() {
  try {
    window.dispatchEvent(new CustomEvent('fireops:pro_unlocked', { detail: { productId: PRO_PRODUCT_ID } }));
  } catch {}
}

// ---------- Billing ----------
function platformForRegister(store) {
  return (store.PLAY_STORE || store.Platform?.GOOGLE_PLAY || undefined);
}

function platformsForInit(store) {
  const platforms = [];
  if (store?.PLAY_STORE) platforms.push(store.PLAY_STORE);
  else if (store?.Platform?.GOOGLE_PLAY) platforms.push(store.Platform.GOOGLE_PLAY);
  else if (store?.APPLE_APPSTORE) platforms.push(store.APPLE_APPSTORE);
  else if (store?.Platform?.APPLE_APPSTORE) platforms.push(store.Platform.APPLE_APPSTORE);
  return platforms.length ? platforms : undefined;
}

function attachStoreListeners(store) {
  if (_storeListenersAttached) return;
  _storeListenersAttached = true;

  dbg('Attaching store listeners…');

  try {
    store.error((e) => {
      dbg('store.error:', e?.code, e?.message, e);
      setDiag(`Billing error: ${e?.message || e?.code || 'unknown'}`);
    });
  } catch (e) {
    dbg('store.error attach failed:', e?.message || e);
  }

  // Product lifecycle
  try {
    store.when(PRO_PRODUCT_ID).registered((p) => dbg('event: registered', p?.id));
    store.when(PRO_PRODUCT_ID).updated((p) => {
      dbg('event: updated', {
        id: p?.id,
        state: p?.state,
        owned: p?.owned,
        canPurchase: p?.canPurchase,
        title: p?.title,
        price: p?.pricing?.price
      });
      updateStatusFromStore(store);
    });

    // Purchase lifecycle
    store.when(PRO_PRODUCT_ID).approved((t) => {
      dbg('event: approved', t?.id || t);
      setDiag('Approved. Verifying…');
      try { t.verify(); dbg('approved: verify() called'); } catch (e) { dbg('approved: verify() failed', e?.message || e); }
    });

    store.when(PRO_PRODUCT_ID).verified((t) => {
      dbg('event: verified', t?.id || t);
      setDiag('Verified ✅ Unlocking…');
      setProUnlocked(true);
      dispatchUnlocked();
      try { t.finish(); dbg('verified: finish() called'); } catch (e) { dbg('verified: finish() failed', e?.message || e); }
      _purchaseInProgress = false;
      // ✅ close ONLY on verified
      removePaywall();
    });

    // Some setups fire owned (or you may get owned after update)
    store.when(PRO_PRODUCT_ID).owned((p) => {
      dbg('event: owned', p?.id || p);
      setDiag('Owned ✅ Unlocking…');
      setProUnlocked(true);
      dispatchUnlocked();
      _purchaseInProgress = false;
      removePaywall();
    });

    store.when(PRO_PRODUCT_ID).cancelled((t) => {
      dbg('event: cancelled', t?.id || t);
      setDiag('Purchase cancelled');
      _purchaseInProgress = false;
      restorePayButton();
    });

    store.when(PRO_PRODUCT_ID).finished((t) => {
      dbg('event: finished', t?.id || t);
      _purchaseInProgress = false;
    });

  } catch (e) {
    dbg('when() attach failed:', e?.message || e);
  }
}

function updateStatusFromStore(store) {
  const bridge = !!store;
  let product = null;
  try { product = store?.get?.(PRO_PRODUCT_ID) || null; } catch {}

  const bridgeLine = `Billing bridge detected: ${bridge ? 'YES' : 'NO'}`;
  const prodLine = `Product loaded: ${product ? 'YES' : 'NO'}`;

  const extra = [];
  if (product) {
    extra.push(`canPurchase: ${!!product.canPurchase}`);
    extra.push(`owned: ${!!product.owned}`);
    if (product.pricing?.price) extra.push(`price: ${product.pricing.price}`);
    if (product.state != null) extra.push(`state: ${product.state}`);
  } else {
    extra.push(`productId requested: ${PRO_PRODUCT_ID}`);
  }

  setDebugStatus([bridgeLine, prodLine, ...extra]);

  if (!bridge) setDiag('❌ Billing bridge missing (plugin not loaded in build)');
  else if (!product) setDiag('❌ Product not returned by Play (ID/Active/tester/track/install issue)');
  else if (product.owned) setDiag('Already owned ✅');
  else setDiag('');
}

function restorePayButton() {
  const btnPay = document.getElementById('btnPayNow');
  if (!btnPay) return;
  btnPay.disabled = false;
  btnPay.textContent = 'Unlock Pro — $1.99 one-time';
}

// Init billing and fetch product
export async function initBilling() {
  if (_billingInitPromise) return _billingInitPromise;

  _billingInitPromise = (async () => {
    ensureDebugUI();
    dbg('initBilling start. native=', isNativeApp());

    if (!isNativeApp()) {
      dbg('Not native app — billing disabled.');
      setDebugStatus(['Billing bridge detected: NO', 'Product loaded: NO', 'Reason: not native build']);
      return;
    }

    const store = getBillingStore();
    dbg('store present?', !!store);

    if (!store) {
      dbg('❌ No billing store found (window.CdvPurchase.store / window.store missing).');
      setDebugStatus(['Billing bridge detected: NO', 'Product loaded: NO', 'Reason: store missing']);
      return;
    }

    attachStoreListeners(store);

    // Register product
    try {
      dbg('register', { id: PRO_PRODUCT_ID, type: store.NON_CONSUMABLE, platform: platformForRegister(store) });
      store.register({
        id: PRO_PRODUCT_ID,
        type: store.NON_CONSUMABLE,
        platform: platformForRegister(store)
      });
    } catch (e) {
      dbg('register failed:', e?.message || e);
    }

    // Initialize store
    try {
      const plats = platformsForInit(store);
      dbg('initialize platforms:', plats);
      await store.initialize(plats);
      dbg('initialize done');
    } catch (e) {
      dbg('❌ initialize failed:', e?.message || e);
    }

    // Update / fetch products
    try {
      dbg('update() start');
      await store.update();
      dbg('update() done');
    } catch (e) {
      dbg('❌ update() failed:', e?.message || e);
    }

    // Report status
    updateStatusFromStore(store);

    // If already owned, unlock immediately
    try {
      const p = store.get(PRO_PRODUCT_ID);
      if (p?.owned) {
        dbg('Already owned — unlocking');
        setProUnlocked(true);
        dispatchUnlocked();
      }
    } catch {}
  })();

  return _billingInitPromise;
}

// Purchase
export async function buyPro() {
  const store = getBillingStore();
  if (!store) throw new Error('Billing not available: store missing');

  await initBilling();

  // Refresh
  try {
    dbg('buyPro: update() start');
    await store.update();
    dbg('buyPro: update() done');
  } catch (e) {
    dbg('buyPro: update failed:', e?.message || e);
  }

  // Check product
  let p = null;
  try { p = store.get(PRO_PRODUCT_ID); } catch {}
  dbg('buyPro: product =', p ? { id: p.id, canPurchase: p.canPurchase, owned: p.owned, price: p.pricing?.price } : 'NULL');

  if (!p) {
    throw new Error(`Product not returned by Play. Check productId/status/test track/tester. (${PRO_PRODUCT_ID})`);
  }
  if (p.owned) {
    setProUnlocked(true);
    dispatchUnlocked();
    return;
  }

  // Order
  dbg('buyPro: calling store.order', PRO_PRODUCT_ID);
  return await store.order(PRO_PRODUCT_ID);
}

// Restore purchases
export async function restorePurchases() {
  const store = getBillingStore();
  if (!store) throw new Error('Billing not available: store missing');
  await initBilling();

  try {
    dbg('restore: store.update() start');
    await store.update();
    dbg('restore: store.update() done');
  } catch (e) {
    dbg('restore: update failed:', e?.message || e);
  }

  try {
    const p = store.get(PRO_PRODUCT_ID);
    dbg('restore: product=', p ? { id: p.id, owned: p.owned, canPurchase: p.canPurchase } : 'NULL');
    if (p?.owned) {
      setProUnlocked(true);
      dispatchUnlocked();
      removePaywall();
    } else {
      setDiag('No purchase found to restore (not owned).');
    }
  } catch (e) {
    dbg('restore: get failed', e?.message || e);
  }
}

// ---------- Paywall main ----------
export function showPaywallModal({ force = false } = {}) {
  ensureInstallTimestamps();

  if (!force) {
    if (!shouldShowPaywallIntro()) return;

    // Allow hide during trial only
    const dontShow = safeGetLS(KEY_PAYWALL_HIDE) === '1';
    if (dontShow && !hardBlocked()) return;
  }

  injectPaywallCssOnce();
  if (document.getElementById('paywallOverlay')) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildPaywallHtml();
  document.body.appendChild(wrapper.firstElementChild);

  // Debug UI
  ensureDebugUI();
  dbg('Paywall shown. native=', isNativeApp());

  const btnContinue = document.getElementById('btnContinueTrial');
  const btnPay = document.getElementById('btnPayNow');
  const btnRestore = document.getElementById('btnRestore');
  const btnShowDebug = document.getElementById('btnShowDebug');
  const chk = document.getElementById('chkDontShow');
  const dontShowRow = document.getElementById('dontShowRow');

  // Hard block: disable continue + no "dont show"
  if (hardBlocked()) {
    if (btnContinue) {
      btnContinue.disabled = true;
      btnContinue.textContent = 'Trial Ended';
    }
    if (dontShowRow) dontShowRow.style.display = 'none';
  }

  if (chk) chk.checked = safeGetLS(KEY_PAYWALL_HIDE) === '1';

  chk?.addEventListener('change', () => {
    safeSetLS(KEY_PAYWALL_HIDE, chk.checked ? '1' : '0');
  });

  btnShowDebug?.addEventListener('click', () => {
    ensureDebugUI();
    const panel = document.getElementById('fireopsDbgPanel');
    if (panel) panel.style.display = 'block';
    const badge = document.getElementById('fireopsDbgBadge');
    if (badge) badge.style.display = 'none';
    dbg('Debug panel opened');
  });

  btnContinue?.addEventListener('click', () => {
    if (hardBlocked()) return;
    removePaywall();
  });

  btnRestore?.addEventListener('click', async () => {
    try {
      btnRestore.disabled = true;
      btnRestore.textContent = 'Restoring…';
      await restorePurchases();
    } catch (e) {
      dbg('restore ERROR:', e?.message || e);
    } finally {
      btnRestore.disabled = false;
      btnRestore.textContent = 'Restore Purchases';
    }
  });

  btnPay?.addEventListener('click', async () => {
    if (!btnPay) return;
    if (_purchaseInProgress) return;

    try {
      _purchaseInProgress = true;
      btnPay.disabled = true;
      btnPay.textContent = 'Opening Google Play…';

      // Start billing if needed
      await initBilling();

      // Watchdog: if no verified/owned within 25s, show why and restore button
      const watchdogMs = 25000;
      const start = Date.now();
      const watchdog = setInterval(() => {
        const elapsed = Date.now() - start;
        if (!_purchaseInProgress) {
          clearInterval(watchdog);
          return;
        }
        if (elapsed >= watchdogMs) {
          clearInterval(watchdog);
          dbg(`⏱ Watchdog: no verified/owned after ${watchdogMs}ms. Purchase UI may not have launched or product missing.`);
          setDiag('⏱ No purchase callback. See debug panel.');
          _purchaseInProgress = false;
          restorePayButton();
        }
      }, 500);

      await buyPro();

      // IMPORTANT:
      // Do NOT close paywall here.
      // We only close paywall on verified/owned events.
      dbg('store.order resolved (does NOT mean purchased). Waiting for verified/owned…');
      setDiag('Waiting for purchase confirmation…');

    } catch (e) {
      dbg('PAY ERROR:', e?.message || e);
      setDiag(`Purchase error: ${e?.message || e}`);
      _purchaseInProgress = false;
      restorePayButton();
    }
  });

  // Non-blocking init
  initBilling();
}

// Optional compatibility
window.fireOpsPaywall = {
  initBilling,
  showPaywallModal,
  hardBlocked,
  isProUnlocked,
  setProUnlocked,
  buyPro,
  restorePurchases,
  isNativeApp
};
