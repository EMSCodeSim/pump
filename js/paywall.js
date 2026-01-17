// paywall.js
// FireOps Calc paywall + billing helper (Cordova-plugin-purchase style)
// Safe-by-default: never break app load if billing is missing/unavailable.

let _billingStarted = false;
let _productId = null;
let _onEntitlement = () => {};
let _lastErrToastAt = 0;

function isNativeCapacitor(){
  try{
    if (window?.Capacitor?.isNativePlatform) return !!window.Capacitor.isNativePlatform();
    const p = window?.Capacitor?.getPlatform?.();
    return !!p && p !== 'web';
  }catch(_e){}
  const proto = (window?.location?.protocol || '').toLowerCase();
  return proto === 'capacitor:';
}

function getStore(){
  // cordova-plugin-purchase usually exposes one of these:
  return window?.CdvPurchase?.store || window?.store || null;
}

function toast(msg){
  // keep it simple and non-blocking
  try{
    console.log('[paywall]', msg);
    const now = Date.now();
    if (now - _lastErrToastAt < 1500) return;
    _lastErrToastAt = now;

    // optional mini-toast if you already have a system; otherwise alert fallback
    if (window?.FireOpsToast) return window.FireOpsToast(msg);
    // Alert is OK for errors during dev/testing; comment out later if desired.
    // eslint-disable-next-line no-alert
    alert(msg);
  }catch(_e){}
}

function safeCall(fn){
  try{ return fn(); }catch(e){ console.error(e); return null; }
}

function ensureStoreReady(){
  if (!isNativeCapacitor()) throw new Error('Purchases only work in the installed app (not web preview).');
  const store = getStore();
  if (!store) throw new Error('Billing store not found. (CdvPurchase/store missing)');
  if (!_productId) throw new Error('Billing not initialized: missing productId.');
  return store;
}

function findProduct(store, id){
  // Different versions expose product lookup differently
  try{
    if (typeof store.get === 'function') return store.get(id);
  }catch(_e){}
  try{
    if (store.products && Array.isArray(store.products)) {
      return store.products.find(p => p && (p.id === id || p.productId === id));
    }
  }catch(_e){}
  return null;
}

/**
 * initBilling({ productId, onEntitlement })
 * Call once at app start (native only).
 */
export function initBilling({ productId, onEntitlement } = {}){
  if (_billingStarted) return;
  _billingStarted = true;

  _productId = productId || null;
  _onEntitlement = typeof onEntitlement === 'function' ? onEntitlement : (()=>{});

  // Web should never crash because billing isn’t present
  if (!isNativeCapacitor()) return;

  const store = getStore();
  if (!store) {
    console.warn('[paywall] store missing - purchases disabled');
    return;
  }
  if (!_productId) {
    console.warn('[paywall] productId missing - purchases disabled');
    return;
  }

  // Platform constants differ by version
  const Platform = window?.CdvPurchase?.Platform || store?.Platform || {};
  const ProductType = window?.CdvPurchase?.ProductType || store?.ProductType || {};

  const GOOGLE_PLAY =
    Platform.GOOGLE_PLAY || Platform.GOOGLE_PLAY_STORE || store.GOOGLE_PLAY || 'google_play';

  const NON_CONSUMABLE =
    ProductType.NON_CONSUMABLE || ProductType.PAID_SUBSCRIPTION || ProductType.CONSUMABLE || 'non-consumable';

  safeCall(() => {
    // Register product
    if (typeof store.register === 'function') {
      store.register({
        id: _productId,
        type: NON_CONSUMABLE,
        platform: GOOGLE_PLAY,
      });
    }
  });

  // Global store error handler
  safeCall(() => {
    if (typeof store.error === 'function') {
      store.error((err) => {
        console.error('[paywall store.error]', err);
        // Don’t spam alerts in production. This is useful while you test.
        toast(`Purchase error: ${err?.message || err}`);
      });
    }
  });

  // Ownership / unlock handlers
  safeCall(() => {
    // When product is updated/owned, sync entitlement
    if (typeof store.when === 'function') {
      store.when(_productId).updated((p) => {
        // some versions: p.owned, p.isOwned, p.state
        const owned = !!(p?.owned || p?.isOwned);
        if (owned) _onEntitlement(true);
      });

      store.when(_productId).approved((p) => {
        // finalize
        try{ p?.verify?.(); }catch(_e){}
        try{ p?.finish?.(); }catch(_e){}
        _onEntitlement(true);
      });

      store.when(_productId).verified((p) => {
        try{ p?.finish?.(); }catch(_e){}
        _onEntitlement(true);
      });
    }
  });

  // Initialize + refresh (restore ownership)
  safeCall(() => {
    if (typeof store.initialize === 'function') {
      store.initialize([GOOGLE_PLAY]);
    }
  });

  safeCall(() => {
    // refresh pulls ownership state (critical for "already purchased" auto-unlock)
    if (typeof store.refresh === 'function') store.refresh();
    if (typeof store.update === 'function') store.update();
  });
}

/**
 * Attempt purchase of the pro product
 */
export async function buyProduct(){
  const store = ensureStoreReady();

  const product = findProduct(store, _productId);
  if (!product) {
    // This is the #1 cause of “button does nothing”: wrong Product ID in code
    throw new Error(
      `Product not found in store: "${_productId}". ` +
      `Check Play Console Product ID and match it exactly in app.js.`
    );
  }

  // order() exists on store in many versions
  if (typeof store.order === 'function') {
    return store.order(_productId);
  }

  // some versions order is on product
  if (typeof product.order === 'function') {
    return product.order();
  }

  throw new Error('No purchase method found (store.order/product.order missing).');
}

/**
 * Restore purchases (re-check ownership)
 */
export async function restorePurchases(){
  const store = ensureStoreReady();
  if (typeof store.refresh === 'function') store.refresh();
  if (typeof store.update === 'function') store.update();
}

/**
 * UI: 5-day intro modal with Continue + Pay Now
 */
export function renderTrialIntroModal({ title, body, priceText, onContinue, onPayNow } = {}){
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    background:rgba(0,0,0,.55);
    display:flex; align-items:center; justify-content:center;
    padding:18px;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    width:min(520px, 100%);
    border-radius:18px;
    padding:18px;
    background:rgba(10,20,35,.96);
    border:1px solid rgba(255,255,255,.12);
    box-shadow:0 20px 60px rgba(0,0,0,.55);
    color:#fff;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
  `;

  card.innerHTML = `
    <div style="font-size:20px; font-weight:800; margin-bottom:10px;">${title || '5-Day Free Trial — No Risk'}</div>
    <div style="opacity:.9; line-height:1.35; margin-bottom:14px;">${body || ''}</div>
    <div style="opacity:.75; font-size:12px; margin-bottom:14px;">
      Purchases only work in the installed Google Play app (Internal/Closed/Production). Not sideloaded.
    </div>
    <button id="trialContinueBtn" style="
      width:100%; padding:12px 14px; border-radius:12px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.08);
      color:#fff; font-weight:800; font-size:16px;
      margin-bottom:10px;
    ">Continue Free Trial</button>
    <button id="trialPayNowBtn" style="
      width:100%; padding:12px 14px; border-radius:12px;
      border:0;
      background:linear-gradient(180deg, #3da2ff, #1f6fe0);
      color:#fff; font-weight:900; font-size:16px;
    ">Pay Now — ${priceText || '$1.99 one-time'}</button>
  `;

  overlay.appendChild(card);

  const close = () => {
    try{ overlay.remove(); }catch(_e){}
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  card.querySelector('#trialContinueBtn')?.addEventListener('click', () => {
    close();
    try{ onContinue?.(); }catch(_e){}
  });

  card.querySelector('#trialPayNowBtn')?.addEventListener('click', async () => {
    // Don’t close immediately—if purchase throws we want the user to see it
    try{
      await onPayNow?.();
      close();
    }catch(e){
      toast(e?.message || String(e));
    }
  });

  document.body.appendChild(overlay);
}

/**
 * Helper wrappers your app.js can call
 */
export async function tryPurchasePro(){
  return buyProduct();
}
export async function tryRestorePro(){
  return restorePurchases();
}
