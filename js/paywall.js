// In-app paywall + purchase hooks for FireOps Calc (Capacitor).
//
// Supports:
//  1) cordova-plugin-purchase (recommended): exposes a global `store` object.
//  2) Capacitor IAP plugins (fallback): InAppPurchases / InAppPurchase2.
//
// Design goals:
//  - Best-effort: NEVER crash the app if billing isn't present.
//  - Loud logging: print actionable billing errors to console/Logcat.

function isNativeApp(){
  try{
    if (window?.Capacitor?.isNativePlatform) return !!window.Capacitor.isNativePlatform();
    const p = window?.Capacitor?.getPlatform?.();
    if (p && p !== 'web') return true;
  }catch(_e){}
  const proto = (window?.location?.protocol || '').toLowerCase();
  return proto === 'capacitor:';
}

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

// ------------------------- cordova-plugin-purchase -------------------------
function getStore(){
  try{ return window.store || null; }catch(_e){}
  return null;
}

// Keep a tiny singleton state to avoid re-registering product a bunch.
const _billing = {
  inited: false,
  productId: null,
  onEntitlement: null,
};

function log(...args){
  // This prefix makes Logcat filtering easy.
  console.log('[Billing]', ...args);
}

function logErr(...args){
  console.error('[Billing]', ...args);
}

export function initBilling({ productId, onEntitlement } = {}){
  _billing.productId = productId || _billing.productId;
  _billing.onEntitlement = onEntitlement || _billing.onEntitlement;

  if (!isNativeApp()) {
    log('initBilling skipped (web).');
    return { ok: false, reason: 'web' };
  }

  const store = getStore();
  if (!store){
    log('cordova-plugin-purchase store not found. (Plugin not injected yet?)');
    return { ok: false, reason: 'no_store' };
  }

  if (_billing.inited) return { ok: true, reason: 'already_inited' };
  if (!_billing.productId){
    logErr('initBilling called without productId.');
    return { ok: false, reason: 'no_product_id' };
  }

  _billing.inited = true;

  try{
    // Turn on useful logs (works in many versions of the plugin).
    try{ store.verbosity = store.DEBUG; }catch(_e){}

    // Register the non-consumable product.
    try{
      store.register({ id: _billing.productId, type: store.NON_CONSUMABLE });
      log('Registered product:', _billing.productId);
    }catch(e){
      logErr('store.register failed:', e);
    }

    // v13+ requires initialize() (safe no-op on older versions).
    try{
      if (typeof store.initialize === 'function' && store.PLATFORM?.GOOGLE_PLAY) {
        const r = store.initialize([store.PLATFORM.GOOGLE_PLAY]);
        // initialize may return a Promise in v13+
        if (r && typeof r.then === 'function') {
          r.then(() => log('store.initialize resolved')).catch(e => logErr('store.initialize failed:', e));
        } else {
          log('store.initialize called');
        }
      }
    }catch(e){
      logErr('store.initialize exception:', e);
    }

    // Global error handler
    try{
      store.error((e) => {
        // e can be Error-like or plugin error object
        const code = e?.code ?? e?.errorCode ?? 'unknown';
        const msg = e?.message ?? e?.error ?? String(e);
        logErr('store.error:', code, msg, e);
      });
    }catch(_e){}

    // Useful lifecycle logs
    try{
      store.ready(() => {
        log('store.ready');
        const p = store.get(_billing.productId);
        log('product state:', {
          id: p?.id,
          owned: !!p?.owned,
          state: p?.state,
          title: p?.title,
          price: p?.price,
        });
        if (p?.owned) {
          log('Entitlement detected (owned)');
          _billing.onEntitlement?.(true);
        }
      });
    }catch(_e){}

    // Purchase flow
    try{
      store.when(_billing.productId).approved((p) => {
        log('approved:', p?.id);
        // For a simple managed product, finishing is what acknowledges on Play.
        try{ p.finish(); }catch(e){ logErr('finish failed:', e); }
        _billing.onEntitlement?.(true);
      });

      store.when(_billing.productId).finished((p) => {
        log('finished:', p?.id);
      });

      store.when(_billing.productId).owned((p) => {
        log('owned:', p?.id);
        _billing.onEntitlement?.(true);
      });
    }catch(e){
      logErr('store.when handlers failed:', e);
    }

    // Start async refresh
    try{
      store.refresh();
      log('store.refresh called');
    }catch(e){
      logErr('store.refresh failed:', e);
    }

    return { ok: true };
  }catch(e){
    logErr('initBilling exception:', e);
    return { ok: false, reason: 'exception' };
  }
}

export async function buyProduct(productId){
  const store = getStore();
  if (!store) throw new Error('Billing not available (store missing).');
  const id = productId || _billing.productId;
  if (!id) throw new Error('Missing productId.');

  log('order:', id);
  try{
    // ✅ v13+ FIX: product.order()
    const p = (typeof store.get === 'function') ? store.get(id) : null;
    if (p && typeof p.order === 'function') {
      await p.order();
    } else if (typeof store.order === 'function') {
      // Older plugin versions
      await store.order(id);
    } else {
      throw new Error('No purchase method found (expected product.order() or store.order()).');
    }
  }catch(e){
    // Many "cancel" flows throw errors; log them clearly.
    logErr('order failed:', e);
    throw e;
  }
}

export async function restorePurchases(productId){
  const store = getStore();
  if (!store) throw new Error('Billing not available (store missing).');
  const id = productId || _billing.productId;
  if (!id) throw new Error('Missing productId.');

  log('restore: refresh + owned check', id);
  try{
    store.refresh();
  }catch(e){
    logErr('restore refresh failed:', e);
  }

  // Give refresh a moment; if not, still return current state.
  await new Promise(r => setTimeout(r, 800));
  const p = store.get(id);
  const owned = !!p?.owned;
  log('restore result:', { id, owned });
  if (owned) _billing.onEntitlement?.(true);
  return owned;
}

// ---------------------------- Capacitor fallback ----------------------------
function getIapPlugin(){
  try{
    const p = window?.Capacitor?.Plugins;
    return p?.InAppPurchases || p?.InAppPurchase2 || null;
  }catch(_e){}
  return null;
}

export async function tryPurchasePro(productId){
  // Prefer cordova-plugin-purchase
  if (getStore()) {
    await buyProduct(productId);
    return true;
  }

  // Fallback to Capacitor plugin
  const plugin = getIapPlugin();
  if (!plugin){
    alert('In-app purchase plugin not installed yet. (cordova-plugin-purchase recommended)');
    return false;
  }
  if (typeof plugin.purchase === 'function'){
    await plugin.purchase({ productId });
    return true;
  }
  if (typeof plugin.order === 'function'){
    await plugin.order({ productId });
    return true;
  }
  alert('Purchase API not found on plugin. Check your IAP plugin docs and update paywall.js.');
  return false;
}

export async function tryRestorePro(productId){
  // Prefer cordova-plugin-purchase
  if (getStore()) {
    return await restorePurchases(productId);
  }

  // Fallback to Capacitor plugin
  const plugin = getIapPlugin();
  if (!plugin){
    alert('In-app purchase plugin not installed yet. (cordova-plugin-purchase recommended)');
    return false;
  }
  if (typeof plugin.restore === 'function'){
    await plugin.restore();
    return true;
  }
  if (typeof plugin.restorePurchases === 'function'){
    await plugin.restorePurchases();
    return true;
  }
  alert('Restore API not found on plugin. Check your IAP plugin docs and update paywall.js.');
  return false;
}

export function showPurchaseError(msg){
  try{
    const el = document.getElementById('purchaseError');
    if (el){
      el.textContent = msg;
      el.style.display = 'block';
      return;
    }
  }catch(_e){}
  alert(msg);
}

export function hidePurchaseError(){
  try{
    const el = document.getElementById('purchaseError');
    if (el){
      el.textContent = '';
      el.style.display = 'none';
    }
  }catch(_e){}
}

export function formatError(e){
  const code = e?.code ?? e?.errorCode ?? '';
  const msg = e?.message ?? e?.error ?? String(e ?? '');
  if (code) return `${code}: ${msg}`;
  return msg || 'Unknown error';
}
