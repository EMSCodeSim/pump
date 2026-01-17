/* paywall.js
   - Safe on WEB (no plugin): all functions no-op and NEVER block app load
   - Native (Capacitor + cordova-plugin-purchase): registers product, refreshes, orders, restores
*/

let _initOnce = false;
let _readyPromise = null;
let _lastProductId = null;
let _entitlementCb = null;

function isNativeLike() {
  try {
    if (window?.Capacitor?.isNativePlatform) return !!window.Capacitor.isNativePlatform();
    const p = window?.Capacitor?.getPlatform?.();
    if (p && p !== 'web') return true;
  } catch (_e) {}
  return (String(location?.protocol || '').toLowerCase() === 'capacitor:');
}

function getCdv() {
  // cordova-plugin-purchase v13+ exposes window.CdvPurchase
  return window?.CdvPurchase || null;
}

function getStore() {
  const cdv = getCdv();
  if (cdv?.store) return cdv.store;
  // legacy (older versions) sometimes expose window.store
  if (window?.store) return window.store;
  return null;
}

function getProductTypeEnum() {
  // v13+: CdvPurchase.ProductType.NON_CONSUMABLE
  const cdv = getCdv();
  if (cdv?.ProductType) return cdv.ProductType;
  // legacy fallback: store.NON_CONSUMABLE etc.
  const store = getStore();
  if (store) return store;
  return null;
}

function safeOwned(product) {
  if (!product) return false;
  // Common shapes:
  // - v13: product.owned (boolean)
  // - some builds: product.isOwned (function) / product.owned (function)
  try {
    if (typeof product.owned === 'boolean') return product.owned;
    if (typeof product.owned === 'function') return !!product.owned();
    if (typeof product.isOwned === 'function') return !!product.isOwned();
    if (typeof product.isOwned === 'boolean') return product.isOwned;
  } catch (_e) {}
  // Some stores expose .state
  try {
    if (String(product.state || '').toLowerCase() === 'owned') return true;
  } catch (_e) {}
  return false;
}

function findProduct(store, productId) {
  if (!store || !productId) return null;

  // v13 store.get(id)
  try {
    if (typeof store.get === 'function') {
      const p = store.get(productId);
      if (p) return p;
    }
  } catch (_e) {}

  // legacy store.products
  try {
    const list = store.products || store._products || [];
    if (Array.isArray(list)) {
      return list.find(p => p && (p.id === productId || p.productId === productId)) || null;
    }
  } catch (_e) {}

  return null;
}

function setStatusText(container, text, isError = false) {
  if (!container) return;
  let el = container.querySelector('.paywall-status');
  if (!el) {
    el = document.createElement('div');
    el.className = 'paywall-status';
    el.style.margin = '10px 0 0';
    el.style.padding = '10px 12px';
    el.style.borderRadius = '12px';
    el.style.border = '1px solid rgba(255,255,255,0.12)';
    el.style.background = 'rgba(0,0,0,0.25)';
    el.style.fontSize = '13px';
    el.style.lineHeight = '1.25';
    container.appendChild(el);
  }
  el.style.borderColor = isError ? 'rgba(255,80,80,0.55)' : 'rgba(255,255,255,0.12)';
  el.style.color = isError ? '#ffd2d2' : 'rgba(255,255,255,0.85)';
  el.textContent = text || '';
}

async function ensureReady(productId) {
  // WEB: resolve instantly
  if (!isNativeLike()) return { store: null, product: null, owned: false, mode: 'web' };

  const store = getStore();
  const cdv = getCdv();
  const ProductType = getProductTypeEnum();

  // Native but plugin missing: resolve instantly (do NOT block app)
  if (!store || !ProductType) return { store: null, product: null, owned: false, mode: 'native_no_plugin' };

  // single shared ready promise
  if (_readyPromise && _lastProductId === productId) return _readyPromise;

  _lastProductId = productId;

  _readyPromise = new Promise((resolve) => {
    try {
      // Reduce noise; you can bump this to DEBUG when troubleshooting
      try { store.verbosity = (store.INFO ?? store.verbosity ?? 1); } catch (_e) {}

      // Register product as NON_CONSUMABLE (one-time purchase)
      try {
        if (typeof store.register === 'function') {
          store.register({
            id: productId,
            type: ProductType.NON_CONSUMABLE || ProductType.NON_RENEWING_SUBSCRIPTION || ProductType.PAID_SUBSCRIPTION
          });
        }
      } catch (_e) {}

      // Wire entitlement handlers (multiple API shapes supported)
      try {
        const when = (typeof store.when === 'function') ? store.when(productId) : null;

        if (when?.approved) {
          when.approved((p) => {
            try { p?.finish?.(); } catch (_e) {}
            const owned = safeOwned(p) || true;
            try { _entitlementCb?.(owned); } catch (_e) {}
          });
        }

        if (when?.verified) {
          when.verified((p) => {
            const owned = safeOwned(p);
            try { _entitlementCb?.(owned); } catch (_e) {}
          });
        }

        if (when?.owned) {
          when.owned((p) => {
            const owned = safeOwned(p) || true;
            try { _entitlementCb?.(owned); } catch (_e) {}
          });
        }

      } catch (_e) {}

      // Refresh / initialize store
      const finish = () => {
        const p = findProduct(store, productId);
        resolve({ store, product: p, owned: safeOwned(p), mode: 'native_ready' });
      };

      try {
        if (typeof store.ready === 'function') {
          store.ready(() => {
            // refresh to fetch products + receipts
            try {
              if (typeof store.refresh === 'function') store.refresh();
              else if (typeof store.update === 'function') store.update();
            } catch (_e) {}
            // allow some microtask time for product list
            setTimeout(finish, 250);
          });
        } else {
          // no ready() hook: attempt refresh then resolve
          try {
            if (typeof store.refresh === 'function') store.refresh();
            else if (typeof store.update === 'function') store.update();
          } catch (_e) {}
          setTimeout(finish, 250);
        }
      } catch (_e) {
        // never block; resolve anyway
        setTimeout(finish, 0);
      }
    } catch (_e) {
      resolve({ store: null, product: null, owned: false, mode: 'native_error' });
    }
  });

  return _readyPromise;
}

/* =======================
   Public API (used by app.js)
   ======================= */

export function initBilling({ productId, onEntitlement } = {}) {
  // Always safe; never throws
  _entitlementCb = (typeof onEntitlement === 'function') ? onEntitlement : null;

  // Prevent repeated heavy init
  if (_initOnce && _lastProductId === productId) return;

  _initOnce = true;
  _lastProductId = productId || _lastProductId;

  // Kick off readiness in background (non-blocking)
  try { ensureReady(productId); } catch (_e) {}
}

export async function buyProduct(productId) {
  const { store, product, mode } = await ensureReady(productId);

  if (!store) {
    throw new Error(
      mode === 'native_no_plugin'
        ? 'Purchases unavailable: billing plugin not detected in this build.'
        : 'Purchases unavailable on web. Install from Google Play to buy.'
    );
  }

  // Try the most compatible ordering paths
  try {
    // v13 supports store.order(productId)
    if (typeof store.order === 'function') {
      return await store.order(productId);
    }
  } catch (_e) {}

  try {
    // Some builds have product.order()
    const p = product || findProduct(store, productId);
    if (p && typeof p.order === 'function') {
      return await p.order();
    }
  } catch (_e) {}

  throw new Error('Purchase failed: No purchase method found (expected product.order() or store.order()).');
}

export async function restorePurchases(productId) {
  const { store } = await ensureReady(productId);
  if (!store) return false;

  try {
    // v13 sometimes uses store.refresh() to re-check ownership
    if (typeof store.restorePurchases === 'function') {
      await store.restorePurchases();
    } else if (typeof store.refresh === 'function') {
      store.refresh();
    } else if (typeof store.update === 'function') {
      store.update();
    }
  } catch (_e) {}

  // Give it a moment to process receipts
  await new Promise(r => setTimeout(r, 400));

  const p = findProduct(store, productId);
  const owned = safeOwned(p);
  try { if (owned) _entitlementCb?.(true); } catch (_e) {}
  return owned;
}

/* Fallbacks (if you ever switch to another IAP plugin later) */
export async function tryPurchasePro(productId) {
  // For now, just try the main path
  return buyProduct(productId);
}

export async function tryRestorePro(productId) {
  return restorePurchases(productId);
}

/* =======================
   UI helpers
   ======================= */

export function renderTrialIntroModal({ trialDays = 5, priceText = '$1.99 one-time', onContinue, onBuyNow } = {}) {
  // Never block app even if something goes wrong
  try {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '99999';
    overlay.style.background = 'rgba(0,0,0,0.65)';
    overlay.style.backdropFilter = 'blur(6px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '16px';

    const card = document.createElement('div');
    card.style.width = 'min(520px, 92vw)';
    card.style.borderRadius = '16px';
    card.style.border = '1px solid rgba(255,255,255,0.14)';
    card.style.background = '#0b1320';
    card.style.boxShadow = '0 14px 40px rgba(0,0,0,0.85)';
    card.style.padding = '16px';

    card.innerHTML = `
      <div style="opacity:.8;font-weight:700;margin-bottom:6px;">FireOps Calc — Start Here</div>
      <div style="font-size:22px;font-weight:900;margin-bottom:8px;color:#8fd0ff;">${trialDays}-Day Free Trial — No Risk</div>
      <div style="opacity:.9;line-height:1.35;margin-bottom:10px;">
        FireOps Calc is free to use for the next <b>${trialDays} days</b>.
        <br><br>
        After the trial, you can unlock the app with a <b>${priceText}</b> — <b>no subscription, no auto-billing</b>.
        <div style="margin-top:8px;opacity:.7;font-size:13px;">
          Purchases only work when installed from Google Play (Internal/Closed/Production). Not sideloaded.
        </div>
      </div>
    `;

    const btnRow = document.createElement('div');
    btnRow.style.display = 'grid';
    btnRow.style.gridTemplateColumns = '1fr';
    btnRow.style.gap = '10px';
    btnRow.style.marginTop = '12px';

    const btnContinue = document.createElement('button');
    btnContinue.textContent = 'Continue Free Trial';
    btnContinue.style.padding = '12px 14px';
    btnContinue.style.borderRadius = '12px';
    btnContinue.style.border = '1px solid rgba(255,255,255,0.12)';
    btnContinue.style.background = 'rgba(255,255,255,0.06)';
    btnContinue.style.color = '#fff';
    btnContinue.style.fontWeight = '800';

    const btnBuy = document.createElement('button');
    btnBuy.textContent = `Unlock Now — ${priceText}`;
    btnBuy.style.padding = '12px 14px';
    btnBuy.style.borderRadius = '12px';
    btnBuy.style.border = '1px solid rgba(143,208,255,0.55)';
    btnBuy.style.background = 'rgba(143,208,255,0.20)';
    btnBuy.style.color = '#cfeaff';
    btnBuy.style.fontWeight = '900';

    btnContinue.onclick = () => {
      try { onContinue?.(); } catch (_e) {}
      overlay.remove();
    };

    btnBuy.onclick = async () => {
      btnBuy.disabled = true;
      btnBuy.style.opacity = '0.75';
      setStatusText(card, 'Opening Google Play purchase…');
      try {
        await (onBuyNow?.());
        setStatusText(card, 'Purchase started. Complete it in Google Play.', false);
      } catch (e) {
        setStatusText(card, `Purchase failed: ${String(e?.message || e)}`, true);
      } finally {
        btnBuy.disabled = false;
        btnBuy.style.opacity = '1';
      }
    };

    btnRow.appendChild(btnContinue);
    btnRow.appendChild(btnBuy);
    card.appendChild(btnRow);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  } catch (_e) {}
}

export async function renderPaywall(mountEl, { trialDays = 5, priceText = '$1.99 one-time', productId, onPurchase, onRestore } = {}) {
  // Mount-only UI; never throws; never blocks app load
  if (!mountEl) return;

  mountEl.innerHTML = `
    <div class="card" style="padding:16px;">
      <div style="opacity:.8;font-weight:700;margin-bottom:6px;">FireOps Calc</div>
      <div style="font-size:22px;font-weight:900;margin-bottom:8px;color:#8fd0ff;">Trial Ended</div>
      <div style="opacity:.9;line-height:1.35;margin-bottom:12px;">
        Your <b>${trialDays}-day free trial</b> has ended.
        <br><br>
        Unlock FireOps Calc with a <b>${priceText}</b> — <b>no subscription, no auto-billing</b>.
        <div style="margin-top:8px;opacity:.7;font-size:13px;">
          Purchases only work when installed from Google Play (Internal/Closed/Production). Not sideloaded.
        </div>
      </div>

      <div class="paywall-actions" style="display:grid;gap:10px;">
        <button class="btn" id="pwRestore">Restore Purchase</button>
        <button class="btn primary" id="pwBuy">Unlock Now — ${priceText}</button>
      </div>
    </div>
  `;

  const buyBtn = mountEl.querySelector('#pwBuy');
  const restoreBtn = mountEl.querySelector('#pwRestore');
  const card = mountEl.querySelector('.card');

  // Show plugin status info (but do not block)
  try {
    const env = await ensureReady(productId);
    if (env.mode === 'native_no_plugin') {
      setStatusText(card, 'Billing plugin not detected in this build. Run: npx cap sync android and rebuild.', true);
    } else if (env.mode === 'web') {
      setStatusText(card, 'Web version is free. Purchases only work in the installed app from Google Play.', false);
    }
  } catch (_e) {}

  if (buyBtn) {
    buyBtn.onclick = async () => {
      buyBtn.disabled = true;
      restoreBtn && (restoreBtn.disabled = true);
      setStatusText(card, 'Starting purchase…');
      try {
        await (onPurchase?.());
        setStatusText(card, 'Purchase complete.', false);
      } catch (e) {
        setStatusText(card, `Purchase failed: ${String(e?.message || e)}`, true);
      } finally {
        buyBtn.disabled = false;
        restoreBtn && (restoreBtn.disabled = false);
      }
    };
  }

  if (restoreBtn) {
    restoreBtn.onclick = async () => {
      restoreBtn.disabled = true;
      buyBtn && (buyBtn.disabled = true);
      setStatusText(card, 'Restoring purchase…');
      try {
        await (onRestore?.());
        setStatusText(card, 'Restore complete.', false);
      } catch (e) {
        setStatusText(card, `Restore failed: ${String(e?.message || e)}`, true);
      } finally {
        restoreBtn.disabled = false;
        buyBtn && (buyBtn.disabled = false);
      }
    };
  }
}
