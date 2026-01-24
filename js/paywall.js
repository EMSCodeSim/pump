/* paywall.js
   FireOps Calc Paywall + Billing bridge (Cordova/Capacitor compatible)
   - Avoids collision with your app's own "store" (window.store)
   - Prefers cordova-plugin-purchase v13+ (window.CdvPurchase.store)
   - Falls back to legacy inappbilling if present

   IMPORTANT FIX:
   For newer cordova-plugin-purchase builds, you must register+initialize using GOOGLE_PLAY platform
   or the product won't load (productExists=false).
*/

export const PRO_PRODUCT_ID = 'fireops.pro';

let _store = null;
let _opts = { verbose: false };
let _onOwned = null;
let _lastBillingError = '';

function isNativeApp() {
  return !!(window.cordova || window.Capacitor?.isNativePlatform?.());
}

function getBillingStore() {
  // Prefer v13+ namespace to avoid "window.store" collision with your app store.js
  const v13 = window.CdvPurchase?.store;
  if (v13) return v13;

  // Some builds expose "store" globally (can collide). If your app also uses window.store, avoid it.
  // We still allow it if it looks like the billing store.
  const legacy = window.store;
  if (legacy && (typeof legacy.initialize === 'function' || typeof legacy.register === 'function')) {
    return legacy;
  }

  return null;
}

function safeStringify(o) {
  try { return JSON.stringify(o, null, 2); } catch (_e) { return String(o); }
}

function getProductOwned(storeObj, productId) {
  try {
    const p = storeObj.get?.(productId);
    if (!p) return false;

    // cordova-plugin-purchase v13+:
    // - p.owned can exist
    // - p.state can be APPROVED/OWNED etc (varies by version)
    // - p.transactions may include owned/approved transactions
    if (p.owned === true) return true;

    // Some versions use state strings or numeric enums
    const st = p.state;
    if (typeof st === 'string') {
      const s = st.toLowerCase();
      if (s.includes('owned') || s.includes('approved')) return true;
    }

    // Some versions expose 'p.canPurchase' false when already owned.
    if (p.canPurchase === false && (p.owned === true || p.state)) {
      // not perfect, but helps on some builds
    }

    // Check last transaction
    const tx = (p.transactions && p.transactions[0]) || null;
    if (tx && (tx.state || tx.owned)) {
      const tstate = String(tx.state || '').toLowerCase();
      if (tx.owned === true) return true;
      if (tstate.includes('approved') || tstate.includes('finished') || tstate.includes('owned')) return true;
    }
  } catch (_e) {}
  return false;
}

function setProUnlockedLocal() {
  localStorage.setItem('fireops_pro_unlocked_v1', '1');
}

function emitDebug(obj) {
  if (!_opts.verbose) return;
  try {
    console.log('[billing debug]', obj);
  } catch (_e) {}
}

export async function initBilling({ verbose = false, productId = PRO_PRODUCT_ID, onOwned } = {}) {
  _opts.verbose = !!verbose;
  _onOwned = typeof onOwned === 'function' ? onOwned : null;

  if (!isNativeApp()) return { ok: false, reason: 'web' };

  _store = getBillingStore();
  if (!_store) return { ok: false, reason: 'no_store' };

  try {
    // Register product (with platform when available)
    try {
      if (typeof _store.register === 'function' && _store.NON_CONSUMABLE) {
        if (_store.GOOGLE_PLAY) {
          _store.register({ id: productId, type: _store.NON_CONSUMABLE, platform: _store.GOOGLE_PLAY });
        } else {
          _store.register({ id: productId, type: _store.NON_CONSUMABLE });
        }
      }
    } catch (_e) {}

    // Initialize (with platform list when available)
    if (typeof _store.initialize === 'function') {
      if (_store.GOOGLE_PLAY) await _store.initialize([_store.GOOGLE_PLAY]);
      else await _store.initialize();
    }

    // Attach event handlers (best-effort across versions)
    try {
      // v13+: store.when(productId).approved/owned/updated
      if (typeof _store.when === 'function') {
        _store.when(productId).updated(() => {
          // owned sync
          if (getProductOwned(_store, productId)) {
            setProUnlockedLocal();
            _onOwned?.();
          }
        });

        _store.when(productId).approved(async (p) => {
          try {
            // v13 often needs finish/verify; but finishing is safe if exposed
            if (p?.finish) await p.finish();
          } catch (_e) {}
          if (getProductOwned(_store, productId)) {
            setProUnlockedLocal();
            _onOwned?.();
          }
        });

        // Some versions fire "owned" directly
        try {
          _store.when(productId).owned(() => {
            setProUnlockedLocal();
            _onOwned?.();
          });
        } catch (_e) {}
      }

      // Legacy: store.ready(callback)
      if (typeof _store.ready === 'function') {
        _store.ready(() => {
          if (getProductOwned(_store, productId)) {
            setProUnlockedLocal();
            _onOwned?.();
          }
        });
      }
    } catch (_e) {}

    // Fetch product/offers
    try {
      if (typeof _store.update === 'function') await _store.update();
      else if (typeof _store.refresh === 'function') await _store.refresh();
    } catch (e) {
      _lastBillingError = (e && e.message) ? e.message : String(e);
    }

    // Sync owned state to local flag
    if (getProductOwned(_store, productId)) setProUnlockedLocal();

    // Debug snapshot
    const p = _store.get?.(productId) || null;
    const offersCount = (p?.offers?.length ?? 0);
    const debug = {
      hasStore: true,
      hasGet: typeof _store.get === 'function',
      productId,
      productExists: !!p,
      productType: p?.type ?? null,
      state: p?.state ?? null,
      owned: p?.owned ?? null,
      offersCount,
      offer0: p?.offers?.[0]?.id ?? null,
      offerFromGetOffer: (typeof _store.getOffer === 'function') ? (_store.getOffer(productId)?.id ?? null) : null,
      lastBillingError: _lastBillingError || '',
      native: true,
      time: new Date().toISOString()
    };

    emitDebug('[billing debug init]\n' + safeStringify(debug));
    return { ok: true, debug };
  } catch (e) {
    _lastBillingError = (e && e.message) ? e.message : String(e);
    emitDebug({ initError: _lastBillingError });
    return { ok: false, reason: 'init_error', error: _lastBillingError };
  }
}

export async function buyProduct(productId = PRO_PRODUCT_ID) {
  if (!isNativeApp()) {
    throw new Error('Billing not available on web.');
  }
  if (!_store) _store = getBillingStore();
  if (!_store) throw new Error('Billing store not available.');

  // Ensure product is loaded
  const p = _store.get?.(productId) || null;
  if (!p) {
    // Provide a very explicit error (matches what you were seeing)
    const debug = {
      hasStore: true,
      hasGet: typeof _store.get === 'function',
      productId,
      productExists: false,
      productType: null,
      state: null,
      owned: null,
      offersCount: 0,
      offer0: null,
      offerFromGetOffer: (typeof _store.getOffer === 'function') ? (_store.getOffer(productId)?.id ?? null) : null,
      lastBillingError: _lastBillingError || '',
      native: true,
      time: new Date().toISOString()
    };
    throw new Error('Product not loaded in billing store.\n' + safeStringify(debug));
  }

  // Already owned?
  if (getProductOwned(_store, productId)) {
    setProUnlockedLocal();
    _onOwned?.();
    return { ok: true, alreadyOwned: true };
  }

  // Try ordering with the best available API
  try {
    // v13: store.order(productId, offerId?)
    if (typeof _store.order === 'function') {
      // Prefer first offer if required
      const offerId = p?.offers?.[0]?.id || (typeof _store.getOffer === 'function' ? _store.getOffer(productId)?.id : null);
      if (offerId) {
        await _store.order(productId, offerId);
      } else {
        await _store.order(productId);
      }
    } else if (typeof _store.purchase === 'function') {
      // Some older versions use purchase(productId)
      await _store.purchase(productId);
    } else {
      throw new Error('No purchase/order function found on billing store.');
    }
  } catch (e) {
    _lastBillingError = (e && e.message) ? e.message : String(e);
    throw e;
  }

  return { ok: true };
}

// --------------------------- UI: Paywall overlays ---------------------------

let _overlayEl = null;

function ensureOverlay() {
  if (_overlayEl) return _overlayEl;

  const el = document.createElement('div');
  el.id = 'paywallOverlay';
  el.style.position = 'fixed';
  el.style.left = '0';
  el.style.top = '0';
  el.style.right = '0';
  el.style.bottom = '0';
  el.style.zIndex = '9999';
  el.style.display = 'none';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.background = 'rgba(0,0,0,0.55)';

  el.innerHTML = `
    <div style="width:min(520px,92vw);background:#121826;border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:18px;color:#eaf2ff;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div id="pwTitle" style="font-size:22px;font-weight:800;letter-spacing:.2px;margin-bottom:8px"></div>
      <div id="pwSubtitle" style="opacity:.9;line-height:1.4;margin-bottom:14px"></div>
      <div id="pwHint" style="opacity:.6;font-size:12px;margin-top:-6px;margin-bottom:14px"></div>

      <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
        <button id="pwContinue" style="background:transparent;border:0;color:#b8c7ff;font-weight:700;padding:10px 12px">Continue Free Trial</button>
        <button id="pwBuy" style="background:#2f6bff;border:0;color:white;font-weight:800;padding:11px 14px;border-radius:12px;min-width:220px">Pay Now</button>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
        <input id="pwDontShow" type="checkbox" />
        <label for="pwDontShow" style="font-size:12px;opacity:.75">Do not show this again</label>
      </div>

      <pre id="pwDebug" style="display:none;white-space:pre-wrap;word-break:break-word;margin-top:12px;padding:10px;border-radius:12px;background:rgba(255,255,255,0.06);max-height:200px;overflow:auto"></pre>
    </div>
  `;

  document.body.appendChild(el);
  _overlayEl = el;
  return el;
}

function showOverlay({ title, subtitle, hint, priceText, onBuy, onContinue, showDebug = false, debugText = '' }) {
  const el = ensureOverlay();
  el.querySelector('#pwTitle').textContent = title || 'Unlock Pro';
  el.querySelector('#pwSubtitle').textContent = subtitle || '';
  el.querySelector('#pwHint').textContent = hint || '';

  const buyBtn = el.querySelector('#pwBuy');
  const contBtn = el.querySelector('#pwContinue');
  const dbg = el.querySelector('#pwDebug');

  buyBtn.textContent = priceText ? `Pay Now — ${priceText}` : 'Pay Now';

  dbg.style.display = showDebug ? 'block' : 'none';
  dbg.textContent = debugText || '';

  buyBtn.disabled = false;
  buyBtn.onclick = async () => {
    buyBtn.disabled = true;
    buyBtn.textContent = 'Opening purchase...';
    try {
      await onBuy?.();
    } catch (e) {
      alert('Purchase failed: ' + (e?.message || e));
    } finally {
      buyBtn.disabled = false;
      buyBtn.textContent = priceText ? `Pay Now — ${priceText}` : 'Pay Now';
    }
  };

  contBtn.onclick = () => {
    onContinue?.();
  };

  el.style.display = 'flex';
}

export function hidePaywall() {
  const el = ensureOverlay();
  el.style.display = 'none';
}

export async function showTrialIntro({ trialDays = 5, priceText = '$1.99 one-time', onBuy, onContinue } = {}) {
  showOverlay({
    title: '5-Day Free Trial — No Risk',
    subtitle: `FireOps Calc is free for ${trialDays} days. You can unlock full access anytime with a one-time purchase.`,
    hint: `If the purchase sheet doesn't open, billing may not be ready yet.`,
    priceText,
    onBuy,
    onContinue,
    showDebug: _opts.verbose
  });
}

export async function showPaywall({ title, subtitle, priceText = '$1.99 one-time', onBuy, onClose } = {}) {
  showOverlay({
    title: title || 'Unlock Pro',
    subtitle: subtitle || 'Unlock full access with a one-time purchase.',
    hint: `If the purchase sheet doesn't open, billing may not be ready yet.`,
    priceText,
    onBuy,
    onContinue: onClose,
    showDebug: _opts.verbose
  });
}
