// Simple in-app paywall UI + purchase hooks.
// Release 1: UI + managed-product purchase/restore (best-effort), never breaks app.

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
      console.error(e);
      setMsg('Purchase failed: ' + String(e), true);
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
      console.error(e);
      setMsg('Restore failed: ' + String(e), true);
    }finally{
      restoreBtn.disabled = false;
    }
  });
}

function getIapPlugin(){
  try{
    const p = window?.Capacitor?.Plugins;
    return p?.InAppPurchases || p?.InAppPurchase2 || null;
  }catch(_e){}
  return null;
}

export async function tryPurchasePro(productId){
  const plugin = getIapPlugin();
  if (!plugin){
    alert('In-app purchase plugin not installed yet. Add @capacitor-community/in-app-purchases, then try again.');
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
  const plugin = getIapPlugin();
  if (!plugin){
    alert('In-app purchase plugin not installed yet. Add @capacitor-community/in-app-purchases, then try again.');
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
