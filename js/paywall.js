// js/paywall.js
// Paywall + purchase helpers.
// Supports cordova-plugin-purchase (recommended) and Capacitor IAP fallback.
//
// IMPORTANT:
// cordova-plugin-purchase exposes a global "store" (or CdvPurchase.store in v13+).
// Many apps also have their own "store" object/module which can overwrite window.store.
// This file avoids that collision by preferring window.CdvPurchase.store and only
// falling back to window.store if it looks like the purchase plugin.

const DEFAULT_PRODUCT_ID = 'fireopscalc_unlock_199';

let _billing = {
  ready: false,
  productId: DEFAULT_PRODUCT_ID,
  platform: 'unknown', // 'cordova' | 'capacitor' | 'web'
  product: null,
  error: null
};

function log(...args){ try{ console.log('[paywall]', ...args); }catch(_e){} }
function logErr(...args){ try{ console.error('[paywall]', ...args); }catch(_e){} }

function isNative(){
  return !!(window.Capacitor?.isNativePlatform?.() || window.cordova);
}

// ------------------------- cordova-plugin-purchase -------------------------
// Prefer CdvPurchase.store when present (cordova-plugin-purchase v13+).
// Fall back to the legacy global `store` ONLY if it looks like the plugin.
function getPurchaseStore(){
  try{
    // v13+ recommended namespace
    if (window.CdvPurchase && window.CdvPurchase.store) return window.CdvPurchase.store;

    // legacy global
    const s = window.store;
    if (s && (typeof s.register === 'function' || typeof s.refresh === 'function' || typeof s.order === 'function')) {
      return s;
    }
  }catch(_e){}
  return null;
}

function getCdvPurchase(){
  try{ return window.CdvPurchase || null; }catch(_e){}
  return null;
}

function isFromPlayStoreLikely(){
  // We can't reliably prove it from JS, but we can at least hint.
  // If Cordova is present and the purchase plugin is available, you're probably OK.
  return !!getPurchaseStore();
}

// ------------------------------ UI Helpers --------------------------------
function $(sel){ return document.querySelector(sel); }

function ensurePaywallStyles(){
  if (document.getElementById('paywall-style')) return;
  const style = document.createElement('style');
  style.id = 'paywall-style';
  style.textContent = `
    .paywall-backdrop{
      position:fixed; inset:0;
      background:rgba(0,0,0,.55);
      display:flex; align-items:center; justify-content:center;
      z-index:9999;
      padding:18px;
    }
    .paywall-card{
      width:min(520px, 100%);
      background:rgba(12,18,28,.98);
      border:1px solid rgba(255,255,255,.12);
      border-radius:18px;
      box-shadow:0 12px 40px rgba(0,0,0,.55);
      padding:18px 18px 14px;
      color:#eaf2ff;
      font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    }
    .paywall-title{
      font-size:24px;
      font-weight:800;
      letter-spacing:.2px;
      color:#7fd3ff;
      margin:0 0 8px;
    }
    .paywall-sub{
      margin:0 0 14px;
      font-size:15px;
      opacity:.92;
      line-height:1.4;
    }
    .paywall-actions{
      display:flex;
      gap:10px;
      margin-top:12px;
    }
    .paywall-btn{
      flex:1;
      padding:12px 12px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,.18);
      background:transparent;
      color:#eaf2ff;
      font-weight:700;
      font-size:15px;
      cursor:pointer;
    }
    .paywall-btn.primary{
      background:linear-gradient(180deg, #2b7cff, #1a62e0);
      border-color:rgba(255,255,255,.08);
    }
    .paywall-note{
      margin-top:10px;
      font-size:12px;
      opacity:.72;
      line-height:1.35;
    }
    .paywall-error{
      margin-top:10px;
      padding:10px 12px;
      border-radius:12px;
      background:rgba(255,60,60,.12);
      border:1px solid rgba(255,60,60,.25);
      color:#ffd7d7;
      font-size:13px;
      font-weight:700;
    }
  `;
  document.head.appendChild(style);
}

function buildPaywallModal({
  title,
  body,
  note,
  showBuy,
  buyLabel,
  onContinue,
  onBuy
}){
  ensurePaywallStyles();
  const backdrop = document.createElement('div');
  backdrop.className = 'paywall-backdrop';

  const card = document.createElement('div');
  card.className = 'paywall-card';

  card.innerHTML = `
    <div style="font-size:13px; opacity:.55; font-weight:700; margin-bottom:6px;">FireOps Calc — Start Here</div>
    <h2 class="paywall-title">${title}</h2>
    <p class="paywall-sub">${body}</p>
    <div class="paywall-actions">
      <button class="paywall-btn" id="pw-continue">Continue Free Trial</button>
      ${showBuy ? `<button class="paywall-btn primary" id="pw-buy">${buyLabel}</button>` : ``}
    </div>
    ${note ? `<div class="paywall-note">${note}</div>` : ``}
    <div class="paywall-error" id="pw-error" style="display:none;"></div>
  `;

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  const btnContinue = card.querySelector('#pw-continue');
  const btnBuy = card.querySelector('#pw-buy');
  const errBox = card.querySelector('#pw-error');

  btnContinue.addEventListener('click', () => {
    try{ onContinue?.(); }catch(_e){}
    backdrop.remove();
  });

  if (btnBuy) {
    btnBuy.addEventListener('click', async () => {
      errBox.style.display = 'none';
      errBox.textContent = '';
      btnBuy.disabled = true;
      btnBuy.textContent = 'Opening purchase...';
      try{
        await onBuy?.({
          setError: (msg) => {
            errBox.textContent = msg;
            errBox.style.display = 'block';
          }
        });
      } finally {
        btnBuy.disabled = false;
        btnBuy.textContent = buyLabel;
      }
    });
  }

  return {
    close: () => backdrop.remove(),
    setError: (msg) => {
      errBox.textContent = msg;
      errBox.style.display = 'block';
    }
  };
}

// ---------------------------- Billing Logic --------------------------------

function daysSince(ts){
  if (!ts) return 999999;
  return (Date.now() - ts) / (1000*60*60*24);
}

export function getTrialState(){
  const start = Number(localStorage.getItem('trialStartMs') || '0');
  const trialDays = 5;
  if (!start) return { started:false, daysUsed:0, daysLeft:trialDays, expired:false };
  const used = Math.floor(daysSince(start));
  const left = Math.max(0, trialDays - used);
  return { started:true, daysUsed:used, daysLeft:left, expired:left <= 0 };
}

export function markTrialStarted(){
  const start = Number(localStorage.getItem('trialStartMs') || '0');
  if (!start) localStorage.setItem('trialStartMs', String(Date.now()));
}

export function isUnlocked(){
  return localStorage.getItem('proUnlocked') === '1';
}

export function setUnlocked(val){
  localStorage.setItem('proUnlocked', val ? '1' : '0');
}

export async function initBilling(productId = DEFAULT_PRODUCT_ID){
  _billing.ready = false;
  _billing.productId = productId;
  _billing.error = null;
  _billing.product = null;

  // Web environment: no purchases
  if (!isNative()) {
    _billing.platform = 'web';
    return { ok:false, reason:'web' };
  }

  // Prefer cordova-plugin-purchase if available
  const store = getPurchaseStore();
  if (store) {
    _billing.platform = 'cordova';
    try{
      // Some builds require `store.verbosity` etc.
      if (store.verbosity != null) store.verbosity = (store.DEBUG || store.INFO || 1);

      // Register product
      if (typeof store.register === 'function') {
        const CdvPurchase = getCdvPurchase();
        const ProductType = CdvPurchase?.ProductType || window.store?.NON_CONSUMABLE || 'non-consumable';

        store.register({
          id: productId,
          type: ProductType.NON_CONSUMABLE || ProductType
        });
      }

      // When approved, mark unlocked
      if (typeof store.when === 'function') {
        store.when(productId).approved((p) => {
          log('approved', p);
          try{
            setUnlocked(true);
            if (typeof p.finish === 'function') p.finish();
          }catch(e){ logErr('finish error', e); }
        });
      }

      // Ready hook
      await new Promise((resolve) => {
        if (typeof store.ready === 'function') store.ready(() => resolve());
        else resolve();
      });

      if (typeof store.refresh === 'function') store.refresh();

      // Capture product info if possible
      const p = (typeof store.get === 'function') ? store.get(productId) : null;
      _billing.product = p || null;
      _billing.ready = true;

      log('billing ready (cordova)', {
        productId,
        hasStoreOrder: typeof store.order === 'function',
        hasProductOrder: !!(p && typeof p.order === 'function'),
        hasCdvPurchaseStore: !!(window.CdvPurchase && window.CdvPurchase.store)
      });

      return { ok:true, platform:'cordova' };
    }catch(e){
      _billing.error = e;
      logErr('initBilling cordova error', e);
      return { ok:false, reason:'cordova_init_failed', error:String(e?.message||e) };
    }
  }

  // Capacitor fallback (if you later add a plugin)
  _billing.platform = 'capacitor';
  return { ok:false, reason:'no_purchase_plugin' };
}

export async function buyProduct(productId){
  const store = getPurchaseStore();
  if (!store) throw new Error('Billing not available (store missing).');
  const id = productId || _billing.productId;
  if (!id) throw new Error('Missing productId.');

  log('order:', id);
  try{
    // Plugin API differs by version and by platform.
    // - Some versions support store.order(productId)
    // - Others expose a product object with product.order()
    const product = (typeof store.get === 'function') ? store.get(id) : null;

    if (product && typeof product.order === 'function') {
      const r = product.order();
      if (r && typeof r.then === 'function') await r;
    } else if (typeof store.order === 'function') {
      const r = store.order(id);
      if (r && typeof r.then === 'function') await r;
    } else {
      throw new Error('No purchase method found (expected product.order() or store.order()).');
    }
  }catch(e){
    logErr('order failed:', e);
    throw e;
  }
}

export async function restorePurchases(){
  const store = getPurchaseStore();
  if (!store) return { ok:false, reason:'store_missing' };
  try{
    if (typeof store.refresh === 'function') store.refresh();

    // If plugin exposes owned state on product:
    const p = (typeof store.get === 'function') ? store.get(_billing.productId) : null;
    if (p && (p.owned || p.isOwned)) {
      setUnlocked(true);
      return { ok:true, restored:true };
    }

    // Some versions store receipts; best effort only
    return { ok:true, restored:false };
  }catch(e){
    logErr('restore failed', e);
    return { ok:false, reason:'restore_failed', error:String(e?.message||e) };
  }
}

// ---------------------------- Paywall Flow ---------------------------------

export function maybeShowTrialPopup(){
  markTrialStarted();

  // If already unlocked, never show
  if (isUnlocked()) return;

  const trial = getTrialState();
  const trialDays = 5;

  const title = `5-Day Free Trial — No Risk`;
  const body =
    `FireOps Calc is free to use for the next ${trialDays} days.<br><br>` +
    `After the trial, you can unlock the app with a <b>$1.99 one-time</b> purchase — ` +
    `<b>no subscription</b>, no auto-billing.`;

  const note =
    `Purchases only work when installed from Google Play (Internal/Closed/Production). Not sideloaded.`;

  const modal = buildPaywallModal({
    title,
    body,
    note,
    showBuy: true,
    buyLabel: `Unlock Now — $1.99 one-time`,
    onContinue: () => {},
    onBuy: async ({ setError }) => {
      try{
        const init = await initBilling(_billing.productId);
        if (!init.ok) {
          setError(`Purchase failed: ${init.reason || 'Billing not ready'}`);
          return;
        }
        await buyProduct(_billing.productId);
      }catch(e){
        const msg = e?.message || String(e);
        setError(`Purchase failed: ${msg}`);
      }
    }
  });

  return modal;
}

export function enforceTrialLockIfNeeded(){
  if (isUnlocked()) return { locked:false };
  const trial = getTrialState();
  if (!trial.expired) return { locked:false };

  // Trial expired, lock pro features (you can wire this into your nav gating)
  return { locked:true };
}
