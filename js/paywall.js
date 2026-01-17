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
    await store.order(id);
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
  if (typeof plugin.restorePurchases === 'function'){
    const res = await plugin.restorePurchases();
    const items = res?.purchases || res?.items || res || [];
    if (Array.isArray(items)) return items.some(p => (p.productId||p.id) === productId);
    return false;
  }
  if (typeof plugin.getPurchasedProducts === 'function'){
    const res = await plugin.getPurchasedProducts();
    const items = res?.products || res?.purchases || res || [];
    if (Array.isArray(items)) return items.some(p => (p.productId||p.id) === productId);
    return false;
  }
  alert('Restore API not found on plugin. Check your IAP plugin docs and update paywall.js.');
  return false;
}

// ------------------------------ UI components ------------------------------

export async function renderPaywall(container, opts = {}){
  const priceText = opts.priceText || '$1.99 one-time';
  const trialDays = Number(opts.trialDays || 5);
  const productId = String(opts.productId || '');

  container.innerHTML = `
    <div class="card" style="max-width:720px;margin:18px auto;">
      <div style="font-weight:900;font-size:20px;margin-bottom:6px;">Unlock FireOps Calc Pro</div>
      <div style="opacity:.85;line-height:1.35;margin-bottom:12px;">
        Your <b>${esc(trialDays)}-day free trial</b> has ended.
        Unlock Pro for <b>${esc(priceText)}</b> (one-time purchase) to keep using the app.
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:10px;margin:12px 0;">
        <button class="btn primary" id="proBuyBtn" type="button">Unlock Pro (${esc(priceText)})</button>
        <button class="btn" id="proRestoreBtn" type="button">Restore Purchase</button>
      </div>

      <div style="opacity:.75;font-size:13px;line-height:1.35;">
        <div style="margin-top:8px;"><b>Product ID:</b> <span class="pill">${esc(productId)}</span></div>
        <div style="margin-top:8px;">If you already paid on this Google account, tap <b>Restore Purchase</b>.</div>
      </div>

      <div id="proMsg" style="margin-top:12px;opacity:.9;"></div>
    </div>
  `;

  const msg = container.querySelector('#proMsg');
  const buyBtn = container.querySelector('#proBuyBtn');
  const restoreBtn = container.querySelector('#proRestoreBtn');

  const setMsg = (t, isErr=false)=>{
    if (!msg) return;
    const border = isErr ? 'rgba(255,107,107,.6)' : 'rgba(70,176,255,.35)';
    msg.innerHTML = `<div style="padding:10px 12px;border-radius:12px;border:1px solid ${border};background:#050913;">${esc(t)}</div>`;
  };

  if (!isNativeApp()) {
    setMsg('Paywall is disabled on the website.');
  }

  buyBtn?.addEventListener('click', async ()=>{
    buyBtn.disabled = true;
    try{
      setMsg('Opening Google Play purchase…');
      await (opts.onPurchase?.());
    }catch(e){
      logErr('Paywall purchase error:', e);
      setMsg('Purchase failed: ' + String(e?.message || e), true);
    }finally{
      buyBtn.disabled = false;
    }
  });

  restoreBtn?.addEventListener('click', async ()=>{
    restoreBtn.disabled = true;
    try{
      setMsg('Checking purchases…');
      await (opts.onRestore?.());
    }catch(e){
      logErr('Paywall restore error:', e);
      setMsg('Restore failed: ' + String(e?.message || e), true);
    }finally{
      restoreBtn.disabled = false;
    }
  });
}

export function renderTrialIntroModal({
  title = '5-Day Free Trial — No Risk',
  trialDays = 5,
  priceText = '$1.99 one-time',
  onContinue,
  onBuyNow,
} = {}){
  // Show only on native. (Website stays free and shouldn't show purchase UI.)
  if (!isNativeApp()) return { close: ()=>{} };

  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:rgba(0,0,0,.65)',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'z-index:99999',
    'padding:16px'
  ].join(';');

  overlay.innerHTML = `
    <div class="card" style="max-width:620px;width:100%;">
      <div style="font-weight:900;font-size:20px;margin-bottom:8px;">${esc(title)}</div>
      <div style="opacity:.9;line-height:1.45;margin-bottom:14px;">
        FireOps Calc is free to use for the next <b>${esc(trialDays)} days</b>.<br><br>
        After the trial, you can unlock the app with a <b>one-time ${esc(priceText)}</b> purchase —
        <b>no subscription</b>, no auto-billing.
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;">
        <button class="btn" id="trialContinueBtn" type="button">Continue Free Trial</button>
        <button class="btn primary" id="trialBuyBtn" type="button">Unlock Now — ${esc(priceText)}</button>
      </div>
      <div id="trialMsg" style="margin-top:12px;opacity:.9;"></div>
    </div>
  `;

  function close(){
    try{ overlay.remove(); }catch(_e){}
  }

  overlay.addEventListener('click', (e)=>{
    // click outside card closes (continue trial)
    if (e.target === overlay) {
      onContinue?.();
      close();
    }
  });

  const contBtn = overlay.querySelector('#trialContinueBtn');
  const buyBtn = overlay.querySelector('#trialBuyBtn');
  const msgEl = overlay.querySelector('#trialMsg');
  const setMsg = (t, isErr=false)=>{
    if (!msgEl) return;
    const border = isErr ? 'rgba(255,107,107,.6)' : 'rgba(70,176,255,.35)';
    msgEl.innerHTML = `<div style="padding:10px 12px;border-radius:12px;border:1px solid ${border};background:#050913;">${esc(t)}</div>`;
  };

  contBtn?.addEventListener('click', ()=>{
    onContinue?.();
    close();
  });

  buyBtn?.addEventListener('click', async ()=>{
    if (!onBuyNow) return;
    buyBtn.disabled = true;
    if (contBtn) contBtn.disabled = true;
    setMsg('Opening Google Play purchase…');
    try{
      await onBuyNow();
      // If purchase succeeds, entitlement handler should update the UI.
      // We still close the modal to avoid blocking.
      close();
    }catch(e){
      logErr('Trial modal purchase error:', e);
      setMsg('Purchase failed: ' + String(e?.message || e), true);
      buyBtn.disabled = false;
      if (contBtn) contBtn.disabled = false;
    }
  });

  document.body.appendChild(overlay);
  return { close, setMsg };
}
