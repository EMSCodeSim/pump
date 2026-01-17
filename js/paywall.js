// js/paywall.js (ES module)
// Must match imports in js/app.js exactly.
//
// Supports cordova-plugin-purchase v13+ (and falls back to older store.order if present).
// Never throws on web; billing is best-effort.

function isNativeApp() {
  try {
    if (window?.Capacitor?.isNativePlatform) return !!window.Capacitor.isNativePlatform();
    const p = window?.Capacitor?.getPlatform?.();
    if (p && p !== "web") return true;
  } catch (_e) {}
  const proto = (window?.location?.protocol || "").toLowerCase();
  return proto === "capacitor:";
}

function getStore() {
  try { return window.store || null; } catch (_e) {}
  return null;
}

function log(...a) { console.log("[Billing]", ...a); }
function warn(...a) { console.warn("[Billing]", ...a); }
function err(...a) { console.error("[Billing]", ...a); }

let _productId = null;
let _onEntitlement = null;
let _inited = false;
let _stylesAdded = false;

function ensureStyles() {
  if (_stylesAdded) return;
  _stylesAdded = true;
  const style = document.createElement("style");
  style.textContent = `
    .fo-modal-backdrop{
      position:fixed; inset:0; z-index:99999;
      background:rgba(0,0,0,.62);
      display:flex; align-items:center; justify-content:center;
      padding:18px;
    }
    .fo-modal{
      width:min(520px, 100%);
      background:rgba(10,16,26,.96);
      border:1px solid rgba(255,255,255,.10);
      border-radius:18px;
      box-shadow:0 18px 60px rgba(0,0,0,.55);
      color:rgba(255,255,255,.92);
      overflow:hidden;
    }
    .fo-modal-header{
      padding:18px 18px 10px 18px;
      font-size:22px;
      font-weight:800;
      color:#7ec3ff;
      letter-spacing:.2px;
    }
    .fo-modal-body{
      padding:0 18px 14px 18px;
      font-size:15px;
      line-height:1.4;
      color:rgba(255,255,255,.84);
    }
    .fo-modal-body b{ color:rgba(255,255,255,.95); }
    .fo-actions{
      display:flex; gap:10px; padding:14px 18px 18px 18px; flex-wrap:wrap;
    }
    .fo-btn{
      appearance:none;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.06);
      color:rgba(255,255,255,.92);
      padding:12px 14px;
      border-radius:14px;
      font-weight:800;
      cursor:pointer;
      min-height:44px;
      transition:transform .05s ease;
      flex:1 1 180px;
    }
    .fo-btn:active{ transform:scale(.98); }
    .fo-btn-primary{
      background:rgba(36,132,255,.92);
      border:1px solid rgba(255,255,255,.16);
      color:#fff;
      box-shadow:0 10px 24px rgba(36,132,255,.28), 0 0 0 2px rgba(36,132,255,.30);
    }
    .fo-status{
      margin-top:10px;
      padding:10px 12px;
      border-radius:12px;
      background:rgba(255,255,255,.05);
      border:1px solid rgba(255,255,255,.08);
      font-weight:700;
      color:rgba(255,255,255,.86);
    }
    .fo-status.error{
      border-color:rgba(255,80,80,.35);
      background:rgba(255,80,80,.08);
    }
    .fo-small{ font-size:12px; color:rgba(255,255,255,.62); margin-top:8px; }
  `;
  document.head.appendChild(style);
}

function createModal({ title, bodyHtml }) {
  ensureStyles();

  const backdrop = document.createElement("div");
  backdrop.className = "fo-modal-backdrop";
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });

  const modal = document.createElement("div");
  modal.className = "fo-modal";
  modal.addEventListener("click", (e) => e.stopPropagation());

  const header = document.createElement("div");
  header.className = "fo-modal-header";
  header.textContent = title;

  const body = document.createElement("div");
  body.className = "fo-modal-body";
  body.innerHTML = bodyHtml;

  const actions = document.createElement("div");
  actions.className = "fo-actions";

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(actions);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  return {
    backdrop,
    body,
    actions,
    close: () => backdrop.remove()
  };
}

function setStatus(bodyEl, msg, isError = false) {
  let el = bodyEl.querySelector(".fo-status");
  if (!el) {
    el = document.createElement("div");
    el.className = "fo-status";
    bodyEl.appendChild(el);
  }
  el.classList.toggle("error", !!isError);
  el.textContent = msg;
}

// ------------------------- Public API (exports) -------------------------

export function initBilling({ productId, onEntitlement } = {}) {
  _productId = productId || _productId;
  _onEntitlement = typeof onEntitlement === "function" ? onEntitlement : _onEntitlement;

  if (!isNativeApp()) {
    // Web: do nothing, never crash
    return { ok: false, reason: "web" };
  }

  const store = getStore();
  if (!store) {
    warn("store not found (cordova-plugin-purchase not injected yet)");
    return { ok: false, reason: "no_store" };
  }

  if (_inited) return { ok: true, reason: "already_inited" };
  if (!_productId) return { ok: false, reason: "no_product_id" };

  _inited = true;

  try { store.verbosity = store.DEBUG; } catch (_e) {}

  try {
    store.register({ id: _productId, type: store.NON_CONSUMABLE });
    log("Registered product:", _productId);
  } catch (e) {
    err("store.register failed:", e);
  }

  // v13+: initialize platform
  try {
    if (typeof store.initialize === "function" && store.PLATFORM?.GOOGLE_PLAY) {
      const r = store.initialize([store.PLATFORM.GOOGLE_PLAY]);
      if (r && typeof r.then === "function") {
        r.then(() => log("store.initialize resolved")).catch((e) => err("store.initialize failed:", e));
      } else {
        log("store.initialize called");
      }
    }
  } catch (e) {
    err("store.initialize threw:", e);
  }

  try {
    store.error((e) => err("store.error:", e));
  } catch (_e) {}

  // Entitlement + approval
  try {
    store.when(_productId).owned(() => {
      log("owned");
      _onEntitlement?.(true);
    });

    store.when(_productId).approved((p) => {
      log("approved");
      try { p.finish(); } catch (e) { err("finish failed:", e); }
      _onEntitlement?.(true);
    });
  } catch (e) {
    err("store.when hooks failed:", e);
  }

  try {
    store.ready(() => {
      log("store.ready");
      const p = store.get(_productId);
      if (p?.owned) _onEntitlement?.(true);
    });
  } catch (_e) {}

  try { store.refresh(); } catch (_e) {}

  return { ok: true };
}

export async function buyProduct(productId) {
  const store = getStore();
  const id = productId || _productId;
  if (!store) throw new Error("Billing not available (store missing)");
  if (!id) throw new Error("Missing productId");

  const p = typeof store.get === "function" ? store.get(id) : null;

  // ✅ v13+ correct method
  if (p && typeof p.order === "function") {
    return p.order();
  }

  // Fallback older versions
  if (typeof store.order === "function") {
    return store.order(id);
  }

  throw new Error("No purchase method found (expected product.order() or store.order())");
}

export async function restorePurchases(productId) {
  const store = getStore();
  const id = productId || _productId;
  if (!store) throw new Error("Billing not available (store missing)");
  if (!id) throw new Error("Missing productId");

  try { store.refresh(); } catch (_e) {}
  await new Promise((r) => setTimeout(r, 800));

  const p = store.get(id);
  const owned = !!p?.owned;
  if (owned) _onEntitlement?.(true);
  return owned;
}

export function renderTrialIntroModal({ trialDays = 5, priceText = "$1.99 one-time", onContinue, onBuyNow } = {}) {
  // Web: don’t show trial modal
  if (!isNativeApp()) return;

  const { backdrop, body, actions, close } = createModal({
    title: `${trialDays}-Day Free Trial — No Risk`,
    bodyHtml: `
      <div>
        FireOps Calc is free to use for the next <b>${trialDays} days</b>.<br><br>
        After the trial, you can unlock the app with a <b>${priceText}</b> —
        <b>no subscription</b>, no auto-billing.
      </div>
      <div class="fo-small">
        Purchases only work when installed from Google Play (Internal/Closed/Production). Not sideloaded.
      </div>
    `
  });

  const btnTrial = document.createElement("button");
  btnTrial.className = "fo-btn";
  btnTrial.textContent = "Continue Free Trial";
  btnTrial.onclick = () => {
    try { onContinue?.(); } catch (_e) {}
    close();
  };

  const btnBuy = document.createElement("button");
  btnBuy.className = "fo-btn fo-btn-primary";
  btnBuy.textContent = `Unlock Now — ${priceText}`;
  btnBuy.onclick = async () => {
    try {
      setStatus(body, "Opening Google Play purchase…");
      await onBuyNow?.();
      setStatus(body, "Purchase flow started…");
    } catch (e) {
      err("trial buy error:", e);
      setStatus(body, `Purchase failed: ${e?.message || String(e)}`, true);
    }
  };

  actions.appendChild(btnTrial);
  actions.appendChild(btnBuy);

  // If something goes sideways, allow tap outside to close (already handled).
  backdrop.tabIndex = -1;
}

export function renderPaywall({ priceText = "$1.99 one-time", message = "Your free trial has ended.", onBuyNow, onRestore } = {}) {
  if (!isNativeApp()) return;

  const { body, actions, close } = createModal({
    title: "Unlock FireOps Calc",
    bodyHtml: `
      <div>
        ${message}<br><br>
        Unlock full access with a <b>${priceText}</b> — <b>no subscription</b>.
      </div>
      <div class="fo-small">If you already purchased, tap Restore.</div>
    `
  });

  const btnRestore = document.createElement("button");
  btnRestore.className = "fo-btn";
  btnRestore.textContent = "Restore Purchase";
  btnRestore.onclick = async () => {
    try {
      setStatus(body, "Restoring…");
      const ok = await onRestore?.();
      if (ok) {
        setStatus(body, "Restored ✅");
        close();
      } else {
        setStatus(body, "No previous purchase found on this account.", true);
      }
    } catch (e) {
      err("restore error:", e);
      setStatus(body, `Restore failed: ${e?.message || String(e)}`, true);
    }
  };

  const btnBuy = document.createElement("button");
  btnBuy.className = "fo-btn fo-btn-primary";
  btnBuy.textContent = `Unlock — ${priceText}`;
  btnBuy.onclick = async () => {
    try {
      setStatus(body, "Opening Google Play purchase…");
      await onBuyNow?.();
      setStatus(body, "Purchase flow started…");
    } catch (e) {
      err("paywall buy error:", e);
      setStatus(body, `Purchase failed: ${e?.message || String(e)}`, true);
    }
  };

  actions.appendChild(btnRestore);
  actions.appendChild(btnBuy);
}

export async function tryPurchasePro(productId) {
  // Prefer cordova-plugin-purchase
  if (getStore()) {
    await buyProduct(productId);
    return true;
  }
  throw new Error("Billing plugin not available");
}

export async function tryRestorePro(productId) {
  if (getStore()) {
    return await restorePurchases(productId);
  }
  throw new Error("Billing plugin not available");
}
