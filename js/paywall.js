// js/paywall.js
// Safe paywall + IAP helpers (cordova-plugin-purchase compatible)
// This file MUST export the functions app.js imports.
// It must NEVER crash the app if billing isn't available (web/iOS browser/etc).

let _cfg = {
  productId: null,
  onEntitlement: null,
};

let _billingInitAttempted = false;
let _billingReady = false;
let _lastError = '';

function setLastError(msg) {
  _lastError = String(msg || '');
  try { console.warn('[paywall]', _lastError); } catch (_) {}
}

function isNativeCapacitor() {
  try {
    if (window?.Capacitor?.isNativePlatform) return !!window.Capacitor.isNativePlatform();
    const p = window?.Capacitor?.getPlatform?.();
    if (p && p !== 'web') return true;
  } catch (_) {}
  const proto = (window?.location?.protocol || '').toLowerCase();
  return proto === 'capacitor:';
}

// Detect cordova-plugin-purchase store reliably.
// Avoid collision with your app's own "store.js" state object.
function getPurchaseStore() {
  const s = window?.CdvPurchase?.store || null;
  if (!s) return null;

  // sanity check: plugin store has initialize/register/when/order
  const ok =
    typeof s.initialize === 'function' &&
    typeof s.register === 'function' &&
    typeof s.when === 'function';

  return ok ? s : null;
}

function getPlatformId() {
  // cordova-plugin-purchase uses Platform.GOOGLE_PLAY when available
  const Platform = window?.CdvPurchase?.Platform;
  if (Platform?.GOOGLE_PLAY) return Platform.GOOGLE_PLAY;
  // fallback string sometimes works in older builds
  return 'google_play';
}

function getProductType() {
  const ProductType = window?.CdvPurchase?.ProductType;
  if (ProductType?.NON_CONSUMABLE) return ProductType.NON_CONSUMABLE;
  return 'non consumable';
}

function ensureConfig(productId) {
  if (productId) _cfg.productId = productId;
}

function emitEntitlement(owned) {
  try {
    if (typeof _cfg.onEntitlement === 'function') _cfg.onEntitlement(!!owned);
  } catch (_) {}
}

/**
 * Initialize billing once per app session (NO-OP on web).
 * config: { productId: string, onEntitlement: (owned:boolean)=>void }
 */
export function initBilling(config = {}) {
  try {
    if (config && typeof config === 'object') {
      _cfg = { ..._cfg, ...config };
    }
    ensureConfig(_cfg.productId);

    // Only attempt IAP init on native app builds.
    if (!isNativeCapacitor()) {
      _billingReady = false;
      return false;
    }

    const store = getPurchaseStore();
    if (!store) {
      _billingReady = false;
      setLastError('Billing not available: cordova-plugin-purchase store not found.');
      return false;
    }

    if (_billingInitAttempted) return _billingReady;
    _billingInitAttempted = true;

    const productId = _cfg.productId;
    if (!productId) {
      _billingReady = false;
      setLastError('Billing config missing productId.');
      return false;
    }

    // Register product
    try {
      store.register([
        {
          id: productId,
          type: getProductType(),
          platform: getPlatformId(),
        },
      ]);
    } catch (e) {
      _billingReady = false;
      setLastError('store.register failed: ' + (e?.message || e));
      return false;
    }

    // Wire events
    try {
      store.when(productId).approved((p) => {
        // finalize transaction
        try { p.verify?.(); } catch (_) {}
        try { p.finish?.(); } catch (_) {}
        emitEntitlement(true);
      });

      store.when(productId).verified((p) => {
        try { p.finish?.(); } catch (_) {}
        emitEntitlement(true);
      });

      store.when(productId).owned(() => {
        emitEntitlement(true);
      });

      store.error((e) => {
        setLastError(e?.message || JSON.stringify(e) || 'Unknown billing error');
      });
    } catch (e) {
      // Even if event wiring fails, don't crash app
      setLastError('Billing event wiring failed: ' + (e?.message || e));
    }

    // Initialize
    try {
      store.initialize([getPlatformId()])
        .then(() => {
          _billingReady = true;
          try { store.refresh?.(); } catch (_) {}
          // Check ownership state if possible
          try {
            const prod = store.get?.(productId);
            if (prod?.owned) emitEntitlement(true);
          } catch (_) {}
        })
        .catch((e) => {
          _billingReady = false;
          setLastError('store.initialize failed: ' + (e?.message || e));
        });
    } catch (e) {
      _billingReady = false;
      setLastError('store.initialize threw: ' + (e?.message || e));
    }

    return true;
  } catch (e) {
    // Never crash host app
    setLastError('initBilling crashed: ' + (e?.message || e));
    return false;
  }
}

/**
 * Attempts to purchase a product.
 * Returns: { ok:boolean, message?:string }
 */
export async function buyProduct(productId) {
  try {
    productId = productId || _cfg.productId;
    if (!productId) return { ok: false, message: 'No productId provided.' };

    if (!isNativeCapacitor()) {
      return { ok: false, message: 'Purchases only work in the installed Android app (Google Play).' };
    }

    const store = getPurchaseStore();
    if (!store) {
      return { ok: false, message: 'Billing store not available (plugin not loaded).' };
    }

    // Make sure init happened (safe to call repeatedly)
    initBilling({ productId });

    // Try store.order(productId)
    if (typeof store.order === 'function') {
      await store.order(productId);
      return { ok: true };
    }

    // Fallback: product.order()
    const prod = store.get?.(productId);
    if (prod && typeof prod.order === 'function') {
      await prod.order();
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
 * Restores/refreshes purchases.
 * Returns: { ok:boolean, owned?:boolean, message?:string }
 */
export async function restorePurchases(productId) {
  try {
    productId = productId || _cfg.productId;
    if (!productId) return { ok: false, message: 'No productId provided.' };

    if (!isNativeCapacitor()) {
      return { ok: false, message: 'Restore is only relevant in the installed Android app.' };
    }

    const store = getPurchaseStore();
    if (!store) {
      return { ok: false, message: 'Billing store not available (plugin not loaded).' };
    }

    initBilling({ productId });

    // refresh state
    if (typeof store.refresh === 'function') {
      await store.refresh();
    }

    let owned = false;
    try {
      const prod = store.get?.(productId);
      owned = !!prod?.owned;
    } catch (_) {}

    if (owned) emitEntitlement(true);
    return { ok: true, owned };
  } catch (e) {
    const msg = e?.message || String(e);
    setLastError('Restore failed: ' + msg);
    return { ok: false, message: 'Restore failed: ' + msg };
  }
}

// Convenience wrappers used by app.js
export async function tryPurchasePro(productId) {
  return buyProduct(productId);
}

export async function tryRestorePro(productId) {
  return restorePurchases(productId);
}

/**
 * Renders a small "trial intro" modal (non-blocking).
 * Returns an object with { close() }.
 */
export function renderTrialIntroModal({ daysLeft = 5, priceText = '$1.99 one-time', onClose } = {}) {
  try {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,.55);
      display:flex; align-items:center; justify-content:center;
      z-index:9999; padding:16px;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      width:min(520px, 92vw);
      border-radius:18px;
      background:rgba(10,18,28,.95);
      border:1px solid rgba(255,255,255,.10);
      box-shadow: 0 18px 60px rgba(0,0,0,.45);
      color:#eaf2ff;
      padding:16px 16px 14px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    `;

    card.innerHTML = `
      <div style="font-size:20px;font-weight:800;color:#79b6ff;margin-bottom:6px;">
        5-Day Free Trial — No Risk
      </div>
      <div style="opacity:.92;line-height:1.35;margin-bottom:10px;">
        FireOps Calc is free to use for the next <b>${daysLeft}</b> days.
        After the trial, unlock the app with a one-time <b>${priceText}</b> — no subscription.
      </div>
      <div style="opacity:.65;font-size:12px;margin-bottom:12px;">
        Purchases only work when installed from Google Play (Internal/Closed/Production). Not sideloaded.
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;align-items:center;">
        <button id="trialIntroClose" style="
          border-radius:12px;
          padding:10px 14px;
          border:1px solid rgba(255,255,255,.14);
          background:transparent;
          color:#eaf2ff;
          font-weight:700;
          cursor:pointer;
        ">Continue Free Trial</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const close = () => {
      try { overlay.remove(); } catch (_) {}
      try { onClose?.(); } catch (_) {}
    };

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    card.querySelector('#trialIntroClose')?.addEventListener('click', close);

    return { close };
  } catch (e) {
    // never break app
    setLastError('renderTrialIntroModal failed: ' + (e?.message || e));
    return { close: () => {} };
  }
}

/**
 * Renders the full paywall (blocking style).
 * options: { productId, priceText, onContinue, onBuy, onRestore }
 */
export function renderPaywall(options = {}) {
  const {
    productId = _cfg.productId,
    priceText = '$1.99 one-time',
    onContinue,
    onBuy,
    onRestore,
  } = options || {};

  try {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,.70);
      display:flex; align-items:center; justify-content:center;
      z-index:10000; padding:16px;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      width:min(560px, 92vw);
      border-radius:20px;
      background:rgba(10,18,28,.96);
      border:1px solid rgba(255,255,255,.10);
      box-shadow: 0 18px 70px rgba(0,0,0,.55);
      color:#eaf2ff;
      padding:18px 16px 14px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    `;

    const msg = _lastError ? `<div style="margin:10px 0 0;padding:10px 12px;border-radius:12px;background:rgba(255,80,80,.12);border:1px solid rgba(255,80,80,.22);">
      <b>Purchase failed:</b> ${escapeHtml(_lastError)}
    </div>` : '';

    card.innerHTML = `
      <div style="opacity:.65;font-weight:800;margin-bottom:6px;">FireOps Calc — Start Here</div>
      <div style="font-size:24px;font-weight:900;color:#79b6ff;margin-bottom:6px;">
        5-Day Free Trial — No Risk
      </div>
      <div style="opacity:.92;line-height:1.35;margin-bottom:12px;">
        After the trial, you can unlock the app with a <b>${priceText}</b> — no subscription, no auto-billing.
      </div>
      <div style="opacity:.65;font-size:12px;margin-bottom:12px;">
        Purchases only work when installed from Google Play (Internal/Closed/Production). Not sideloaded.
      </div>

      ${msg}

      <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px;">
        <button id="pwContinue" style="
          border-radius:14px;
          padding:12px 14px;
          border:1px solid rgba(255,255,255,.14);
          background:transparent;
          color:#eaf2ff;
          font-weight:800;
          cursor:pointer;
        ">Continue Free Trial</button>

        <button id="pwBuy" style="
          border-radius:14px;
          padding:14px 14px;
          border:0;
          background:linear-gradient(180deg, rgba(72,162,255,1), rgba(42,118,255,1));
          color:white;
          font-weight:900;
          cursor:pointer;
          box-shadow: 0 10px 30px rgba(35,120,255,.35);
        ">Buy It Now — ${priceText}</button>

        <button id="pwRestore" style="
          border-radius:14px;
          padding:10px 14px;
          border:1px solid rgba(255,255,255,.10);
          background:rgba(255,255,255,.06);
          color:#eaf2ff;
          font-weight:800;
          cursor:pointer;
        ">Restore Purchase</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const close = () => { try { overlay.remove(); } catch (_) {} };

    card.querySelector('#pwContinue')?.addEventListener('click', () => {
      try { onContinue?.(); } catch (_) {}
      close();
    });

    card.querySelector('#pwBuy')?.addEventListener('click', async () => {
      try {
        if (typeof onBuy === 'function') {
          await onBuy(productId);
        } else {
          await buyProduct(productId);
        }
      } catch (e) {
        setLastError(e?.message || e);
      }
    });

    card.querySelector('#pwRestore')?.addEventListener('click', async () => {
      try {
        if (typeof onRestore === 'function') {
          await onRestore(productId);
        } else {
          await restorePurchases(productId);
        }
      } catch (e) {
        setLastError(e?.message || e);
      }
    });

    return { close, el: overlay };
  } catch (e) {
    setLastError('renderPaywall failed: ' + (e?.message || e));
    return { close: () => {}, el: null };
  }
}

// --- helpers ---
function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
