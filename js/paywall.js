// js/paywall.js
// SAFE paywall + billing helpers (cordova-plugin-purchase)
// Adds:
//  - Disable trial once purchase succeeds (local unlock flag)
//  - Auto-unlock if already purchased (owned check after refresh/ready)
//
// IMPORTANT: Must NOT crash web build. All native/plugin calls are guarded.

const UNLOCK_KEY = 'fireops_pro_unlocked_v1';

let _cfg = {
  productId: null,
  onEntitlement: null,
};

let _billingInitAttempted = false;
let _billingReady = false;
let _lastError = '';

function log(...args) { try { console.log('[paywall]', ...args); } catch (_) {} }
function warn(...args) { try { console.warn('[paywall]', ...args); } catch (_) {} }

function setLastError(msg) {
  _lastError = String(msg || '');
  warn(_lastError);
}

function isNativeCapacitor() {
  try {
    if (window?.Capacitor?.isNativePlatform) return !!window.Capacitor.isNativePlatform();
    const p = window?.Capacitor?.getPlatform?.();
    return !!(p && p !== 'web');
  } catch (_) {}
  const proto = (window?.location?.protocol || '').toLowerCase();
  return proto === 'capacitor:';
}

// Use CdvPurchase.store to avoid colliding with your app's own store.js
function getStore() {
  const s = window?.CdvPurchase?.store;
  if (!s) return null;
  // sanity
  if (typeof s.register !== 'function') return null;
  return s;
}

function markUnlocked() {
  try { localStorage.setItem(UNLOCK_KEY, '1'); } catch (_) {}
  try { _cfg.onEntitlement?.(true); } catch (_) {}
}

export function isUnlockedLocal() {
  try { return localStorage.getItem(UNLOCK_KEY) === '1'; } catch (_) {}
  return false;
}

// Try to detect if product is owned (different plugin versions expose differently)
function isOwnedProduct(p) {
  if (!p) return false;
  try {
    if (typeof p.owned === 'boolean') return p.owned;
    if (typeof p.owned === 'function') return !!p.owned();
    if (typeof p.isOwned === 'function') return !!p.isOwned();
    if (typeof p.isOwned === 'boolean') return p.isOwned;
  } catch (_) {}
  return false;
}

// Fetch product object
function getProduct(store, productId) {
  try {
    if (store && typeof store.get === 'function') return store.get(productId);
  } catch (_) {}
  try {
    const list = store?.products;
    if (Array.isArray(list)) return list.find(x => x && (x.id === productId || x.productId === productId)) || null;
  } catch (_) {}
  return null;
}

// Auto-unlock check: refresh then see if owned
async function autoUnlockIfOwned(store, productId) {
  try {
    if (!store) return false;

    // Refresh receipts/products
    try {
      if (typeof store.refresh === 'function') store.refresh();
    } catch (_) {}

    // Give store time to update
    await new Promise(r => setTimeout(r, 700));

    const p = getProduct(store, productId);
    const owned = isOwnedProduct(p);

    if (owned) {
      log('Auto-unlock: product already owned');
      markUnlocked();
      return true;
    }
  } catch (e) {
    warn('autoUnlockIfOwned error', e);
  }
  return false;
}

/**
 * Initialize billing (safe no-op on web).
 * config: { productId: string, onEntitlement: (owned:boolean)=>void }
 *
 * Also does: auto-unlock if already purchased.
 */
export function initBilling(cfg = {}) {
  try {
    _cfg = { ..._cfg, ...cfg };
    const productId = _cfg.productId;

    // Always reflect local unlock immediately (so trial is disabled even before billing is ready)
    if (isUnlockedLocal()) {
      try { _cfg.onEntitlement?.(true); } catch (_) {}
    }

    if (!isNativeCapacitor()) {
      _billingReady = false;
      return false;
    }

    const store = getStore();
    if (!store) {
      _billingReady = false;
      setLastError('Billing not available: CdvPurchase.store not found.');
      return false;
    }

    if (_billingInitAttempted) return _billingReady;
    _billingInitAttempted = true;

    if (!productId) {
      _billingReady = false;
      setLastError('Billing config missing productId.');
      return false;
    }

    // Register product as NON_CONSUMABLE
    try {
      store.register([{
        id: productId,
        type: store.ProductType?.NON_CONSUMABLE || 'non consumable',
        platform: store.Platform?.GOOGLE_PLAY || 'google_play',
      }]);
    } catch (e) {
      warn('store.register failed (continuing)', e);
    }

    // Event hooks: ensure we set local unlock on success
    try {
      store.when(productId).approved(p => {
        try { p.finish?.(); } catch (_) {}
        markUnlocked();                 // ✅ disables trial forever
      });
      store.when(productId).verified(p => {
        try { p.finish?.(); } catch (_) {}
        markUnlocked();                 // ✅ disables trial forever
      });
      store.when(productId).owned(() => {
        markUnlocked();                 // ✅ auto-unlock if owned event fires
      });
    } catch (e) {
      warn('store.when hooks failed (continuing)', e);
    }

    try {
      store.error(e => warn('store.error', e));
    } catch (_) {}

    // Initialize/refresh and auto-unlock if already purchased
    try {
      const platform = store.Platform?.GOOGLE_PLAY || 'google_play';
      Promise.resolve(store.initialize ? store.initialize([platform]) : null)
        .then(async () => {
          _billingReady = true;
          try { store.refresh?.(); } catch (_) {}
          await autoUnlockIfOwned(store, productId); // ✅ auto-unlock on startup
        })
        .catch(e => {
          _billingReady = false;
          setLastError('store.initialize failed: ' + (e?.message || e));
        });
    } catch (e) {
      _billingReady = false;
      setLastError('store.initialize threw: ' + (e?.message || e));
    }

    return true;
  } catch (e) {
    setLastError('initBilling crashed: ' + (e?.message || e));
    return false;
  }
}

/**
 * Buy product (safe on web; returns {ok,message})
 * On success -> marks unlocked locally.
 */
export async function buyProduct(productId) {
  try {
    productId = productId || _cfg.productId;
    if (!productId) return { ok: false, message: 'No productId provided.' };

    // If already unlocked locally, no need to purchase
    if (isUnlockedLocal()) return { ok: true, message: 'Already unlocked.' };

    if (!isNativeCapacitor()) {
      return { ok: false, message: 'Purchases only work in the installed Android app (Google Play).' };
    }

    const store = getStore();
    if (!store) {
      return { ok: false, message: 'Billing store not available (plugin not loaded).' };
    }

    // Ensure init attempt (safe)
    initBilling({ productId });

    // Try store.order(productId)
    if (typeof store.order === 'function') {
      await store.order(productId);
      // Some flows don’t immediately fire events; set local unlock if it becomes owned shortly
      await autoUnlockIfOwned(store, productId);
      return { ok: true };
    }

    // Fallback: product.order()
    const prod = getProduct(store, productId);
    if (prod && typeof prod.order === 'function') {
      await prod.order();
      await autoUnlockIfOwned(store, productId);
      return { ok: true };
    }

    return { ok: false, message: 'No purchase method found (expected store.order() or product.order()).' };
  } catch (e) {
    const msg = e?.message || String(e);
    setLastError('Purchase failed: ' + msg);
    return { ok: false, message: 'Purchase failed: ' + msg };
  }
}

/**
 * Restore purchases (refresh + owned check)
 * If owned -> marks unlocked locally.
 */
export async function restorePurchases(productId) {
  try {
    productId = productId || _cfg.productId;
    if (!productId) return { ok: false, message: 'No productId provided.' };

    // If already unlocked locally
    if (isUnlockedLocal()) return { ok: true, owned: true };

    if (!isNativeCapacitor()) {
      return { ok: false, message: 'Restore is only relevant in the installed Android app.' };
    }

    const store = getStore();
    if (!store) {
      return { ok: false, message: 'Billing store not available (plugin not loaded).' };
    }

    initBilling({ productId });

    const owned = await autoUnlockIfOwned(store, productId);
    return { ok: true, owned };
  } catch (e) {
    const msg = e?.message || String(e);
    setLastError('Restore failed: ' + msg);
    return { ok: false, message: 'Restore failed: ' + msg };
  }
}

// Convenience wrappers used by app.js
export async function tryPurchasePro(productId) { return buyProduct(productId); }
export async function tryRestorePro(productId) { return restorePurchases(productId); }

/* ------------------------------------------------------------------
   5-DAY TRIAL POPUP (Pay Now button + continue)
------------------------------------------------------------------- */
export function renderTrialIntroModal({
  daysLeft = 5,
  priceText = '$1.99',
  productId = _cfg.productId,
  onClose,
  onBuyNow,
} = {}) {
  // If already unlocked, don't show
  if (isUnlockedLocal()) return { close: () => {} };

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed; inset:0;
    background:rgba(0,0,0,.6);
    display:flex; align-items:center; justify-content:center;
    z-index:9999; padding:16px;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    width:90%; max-width:520px;
    background:#0b1626;
    color:#fff;
    border-radius:16px;
    padding:18px;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    border:1px solid rgba(255,255,255,.10);
    box-shadow:0 14px 40px rgba(0,0,0,.5);
  `;

  const err = document.createElement('div');
  err.style.cssText = `
    display:none;
    margin-top:10px;
    padding:10px 12px;
    border-radius:12px;
    border:1px solid rgba(255,80,80,.35);
    background:rgba(255,80,80,.10);
    color:#ffd6d6;
    font-weight:800;
  `;

  function showErr(msg) {
    err.textContent = 'Purchase failed: ' + String(msg || 'Unknown error');
    err.style.display = 'block';
  }

  card.innerHTML = `
    <div style="font-size:22px;font-weight:900;color:#79b6ff;margin-bottom:6px;">
      5-Day Free Trial — No Risk
    </div>

    <div style="opacity:.9;line-height:1.35;">
      FireOps Calc is free for <b>${Number(daysLeft) || 5}</b> days.
      You can unlock full access anytime with a one-time purchase.
    </div>

    <div style="font-size:12px;opacity:.65;margin-top:10px;">
      Purchases only work in the installed Google Play app (Internal/Closed/Production). Not sideloaded.
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px;">
      <button id="trialContinue"
        style="padding:12px;border-radius:12px;background:transparent;color:#fff;
        border:1px solid rgba(255,255,255,.2);font-weight:800;cursor:pointer;">
        Continue Free Trial
      </button>

      <button id="trialPayNow"
        style="padding:14px;border-radius:12px;
        background:linear-gradient(180deg,#4da3ff,#2a76ff);
        color:#fff;font-weight:900;border:none;cursor:pointer;">
        Pay Now — ${priceText}
      </button>
    </div>
  `;

  card.appendChild(err);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    try { onClose?.(); } catch (_) {}
  };

  card.querySelector('#trialContinue').onclick = close;

  card.querySelector('#trialPayNow').onclick = async () => {
    err.style.display = 'none';
    try {
      // Prefer app.js provided handler
      if (typeof onBuyNow === 'function') {
        await onBuyNow();
      } else {
        await buyProduct(productId);
      }

      // If now unlocked, close modal
      if (isUnlockedLocal()) close();
      else {
        // Some stores unlock via async events; check again after a moment
        setTimeout(() => { if (isUnlockedLocal()) close(); }, 900);
      }
    } catch (e) {
      showErr(e?.message || e);
    }
  };

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  return { close };
}

/* ------------------------------------------------------------------
   Hard paywall render (kept compatible)
------------------------------------------------------------------- */
export function renderPaywall(mountEl, opts = {}) {
  // If already unlocked, don't render paywall
  if (isUnlockedLocal()) {
    try { mountEl.innerHTML = ''; } catch (_) {}
    return { close: () => {} };
  }

  const priceText = opts.priceText || '$1.99 one-time';
  const trialDays = Number(opts.trialDays || 5);
  const productId = opts.productId || _cfg.productId;

  if (!mountEl) return { close: () => {} };

  mountEl.innerHTML = `
    <div class="card" style="max-width:560px;margin:18px auto;padding:16px;">
      <div style="font-weight:900;font-size:22px;margin-bottom:6px;color:#79b6ff;">Trial Ended</div>
      <div style="opacity:.9;line-height:1.35;margin-bottom:12px;">
        Your <b>${trialDays}-day</b> free trial has ended.<br><br>
        Unlock FireOps Calc with a <b>${priceText}</b> — no subscription.
      </div>

      <div id="pwErr" style="display:${_lastError ? 'block' : 'none'};margin:10px 0;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,80,80,.35);background:rgba(255,80,80,.10);color:#ffd6d6;font-weight:800;">
        ${_lastError ? 'Purchase failed: ' + String(_lastError) : ''}
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;">
        <button id="pwRestore" class="btn">Restore Purchase</button>
        <button id="pwBuy" class="btn primary">Unlock Now — ${priceText}</button>
      </div>
    </div>
  `;

  const pwErr = mountEl.querySelector('#pwErr');
  const setErr = (m) => {
    if (!pwErr) return;
    pwErr.style.display = 'block';
    pwErr.textContent = 'Purchase failed: ' + String(m || 'Unknown error');
  };

  mountEl.querySelector('#pwBuy')?.addEventListener('click', async () => {
    try {
      if (opts.onPurchase) {
        await opts.onPurchase();
      } else {
        const res = await buyProduct(productId);
        if (!res.ok) throw new Error(res.message || 'Purchase failed');
      }
      if (isUnlockedLocal()) mountEl.innerHTML = '';
    } catch (e) {
      setErr(e?.message || e);
    }
  });

  mountEl.querySelector('#pwRestore')?.addEventListener('click', async () => {
    try {
      if (opts.onRestore) {
        await opts.onRestore();
      } else {
        const res = await restorePurchases(productId);
        if (!res.ok) throw new Error(res.message || 'Restore failed');
      }
      if (isUnlockedLocal()) mountEl.innerHTML = '';
    } catch (e) {
      setErr(e?.message || e);
    }
  });

  return { close: () => { try { mountEl.innerHTML = ''; } catch (_) {} } };
}
