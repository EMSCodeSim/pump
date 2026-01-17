/* ============================================================================
  paywall.js (NON-MODULE / GLOBAL)
  - Compatible with <script src="js/paywall.js"></script>
  - Cordova/Capacitor + cordova-plugin-purchase v13+ compatible
  - Fixes: "store.order is not a function" by using store.get(id).order()
  - Exposes: window.FireOpsPaywall = { ... }
============================================================================ */

(function () {
  const PRO_UNLOCK_KEY = "fireops_pro_unlocked_v1";
  const INTRO_SHOWN_KEY = "fireops_trial_intro_shown_v1";

  let _productId = "fireops_calc_pro_199";
  let _onEntitlement = null;
  let _storeReady = false;
  let _initAttempted = false;

  let _modalEl = null;

  function log(...args) { console.log("[Billing]", ...args); }
  function warn(...args) { console.warn("[Billing]", ...args); }
  function errlog(...args) { console.error("[Billing]", ...args); }

  function isProUnlocked() {
    return localStorage.getItem(PRO_UNLOCK_KEY) === "1";
  }

  function setProUnlocked() {
    localStorage.setItem(PRO_UNLOCK_KEY, "1");
  }

  function isBillingAvailable() {
    return typeof window !== "undefined" && !!window.store && typeof window.store.get === "function";
  }

  function closeModal() {
    if (_modalEl && _modalEl.parentNode) _modalEl.parentNode.removeChild(_modalEl);
    _modalEl = null;
  }

  function ensureStyles() {
    if (document.getElementById("fireops-paywall-styles")) return;

    const style = document.createElement("style");
    style.id = "fireops-paywall-styles";
    style.textContent = `
      .fo-modal-backdrop{
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(0,0,0,0.62);
        display: flex; align-items: center; justify-content: center;
        padding: 18px;
      }
      .fo-modal{
        width: min(520px, 100%);
        background: rgba(10,16,26,0.96);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 18px;
        box-shadow: 0 18px 60px rgba(0,0,0,0.55);
        color: rgba(255,255,255,0.92);
        overflow: hidden;
      }
      .fo-modal-header{
        padding: 18px 18px 10px 18px;
        font-size: 22px;
        font-weight: 800;
        color: #7ec3ff;
        letter-spacing: 0.2px;
      }
      .fo-modal-body{
        padding: 0 18px 14px 18px;
        font-size: 15px;
        line-height: 1.4;
        color: rgba(255,255,255,0.84);
      }
      .fo-modal-body b{ color: rgba(255,255,255,0.95); }
      .fo-modal-actions{
        display: flex;
        gap: 10px;
        padding: 14px 18px 18px 18px;
        flex-wrap: wrap;
      }
      .fo-btn{
        appearance: none;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.92);
        padding: 12px 14px;
        border-radius: 14px;
        font-weight: 800;
        cursor: pointer;
        user-select: none;
        transition: transform 0.05s ease;
        min-height: 44px;
      }
      .fo-btn:active{ transform: scale(0.98); }
      .fo-btn-primary{
        background: rgba(36, 132, 255, 0.92);
        border: 1px solid rgba(255,255,255,0.16);
        color: #fff;
        box-shadow: 0 10px 24px rgba(36,132,255,0.28), 0 0 0 2px rgba(36,132,255,0.30);
      }
      .fo-btn-secondary{ background: rgba(255,255,255,0.04); }
      .fo-btn-wide{ flex: 1 1 180px; }
      .fo-status{
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        font-weight: 700;
        color: rgba(255,255,255,0.86);
      }
      .fo-status.error{
        border-color: rgba(255, 80, 80, 0.35);
        background: rgba(255, 80, 80, 0.08);
      }
      .fo-small{
        font-size: 12px;
        color: rgba(255,255,255,0.62);
        margin-top: 8px;
      }
    `;
    document.head.appendChild(style);
  }

  function createModal({ title, bodyHtml }) {
    ensureStyles();
    closeModal();

    const backdrop = document.createElement("div");
    backdrop.className = "fo-modal-backdrop";
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
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
    actions.className = "fo-modal-actions";

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(actions);
    backdrop.appendChild(modal);

    document.body.appendChild(backdrop);
    _modalEl = backdrop;

    return { body, actions };
  }

  function setStatus(containerEl, message, isError = false) {
    let status = containerEl.querySelector(".fo-status");
    if (!status) {
      status = document.createElement("div");
      status.className = "fo-status";
      containerEl.appendChild(status);
    }
    status.classList.toggle("error", !!isError);
    status.textContent = message;
  }

  function initBilling({ productId, onEntitlement } = {}) {
    if (productId) _productId = productId;
    if (typeof onEntitlement === "function") _onEntitlement = onEntitlement;

    if (_initAttempted) return;
    _initAttempted = true;

    if (!isBillingAvailable()) {
      warn("cordova-plugin-purchase store not found (web preview or plugin not injected).");
      return;
    }

    const store = window.store;

    try { store.verbosity = store.DEBUG; } catch (_) {}

    try {
      store.register({ id: _productId, type: store.NON_CONSUMABLE });
      log("Registered product:", _productId);
    } catch (e) {
      errlog("store.register failed:", e);
    }

    try {
      store.error((e) => errlog("store.error:", e));
    } catch (_) {}

    try {
      store.when(_productId).updated((p) => log("updated:", p && p.state, p && p.owned, p && p.canPurchase));

      store.when(_productId).owned(() => {
        log("owned:", true);
        setProUnlocked();
        if (typeof _onEntitlement === "function") _onEntitlement({ productId: _productId, owned: true });
      });

      store.when(_productId).approved((p) => {
        log("approved");
        try { p.finish(); } catch (e) { errlog("finish failed:", e); }
        setProUnlocked();
        if (typeof _onEntitlement === "function") _onEntitlement({ productId: _productId, owned: true });
        closeModal();
      });
    } catch (e) {
      errlog("store.when hooks failed:", e);
    }

    try {
      store.initialize([store.PLATFORM.GOOGLE_PLAY])
        .then(() => {
          _storeReady = true;
          log("store.initialize: ready");
          try { store.refresh(); } catch (_) {}
        })
        .catch((e) => errlog("store.initialize failed:", e));
    } catch (e) {
      errlog("store.initialize threw:", e);
    }
  }

  function buyProduct(productId = _productId) {
    if (!isBillingAvailable()) throw new Error("Billing not available (store missing)");
    const store = window.store;

    const product = store.get(productId);
    if (!product) throw new Error(`Product not found: ${productId}`);

    if (product.owned) {
      setProUnlocked();
      if (typeof _onEntitlement === "function") _onEntitlement({ productId, owned: true });
      return Promise.resolve();
    }

    if (!product.canPurchase) throw new Error("Purchases not allowed on this device/account");

    // v13+ FIX: no store.order()
    return product.order();
  }

  function restorePurchases(productId = _productId) {
    if (!isBillingAvailable()) throw new Error("Billing not available (store missing)");
    const store = window.store;

    try { store.refresh(); } catch (e) { errlog("store.refresh failed:", e); }

    return new Promise((resolve) => {
      setTimeout(() => {
        const p = store.get(productId);
        if (p && p.owned) {
          setProUnlocked();
          if (typeof _onEntitlement === "function") _onEntitlement({ productId, owned: true });
          resolve(true);
        } else {
          resolve(false);
        }
      }, 800);
    });
  }

  function showTrialIntroModal({ productId, onEntitlement } = {}) {
    if (productId) _productId = productId;
    if (typeof onEntitlement === "function") _onEntitlement = onEntitlement;

    if (localStorage.getItem(INTRO_SHOWN_KEY) === "1") return;
    localStorage.setItem(INTRO_SHOWN_KEY, "1");

    const { body, actions } = createModal({
      title: "5-Day Free Trial — No Risk",
      bodyHtml: `
        <div>
          FireOps Calc is free to use for the next <b>5 days</b>.<br><br>
          After the trial, you can unlock the app with a <b>one-time $1.99 purchase</b> —
          <b>no subscription</b>, no auto-billing.<br><br>
          Try everything now, or unlock immediately if you already know it’s for you.
        </div>
        <div class="fo-small">
          Tip: Purchases only work when installed from Google Play (Internal Testing / Production).
        </div>
      `
    });

    const btnTrial = document.createElement("button");
    btnTrial.className = "fo-btn fo-btn-secondary fo-btn-wide";
    btnTrial.textContent = "Continue Free Trial";
    btnTrial.onclick = () => closeModal();

    const btnBuy = document.createElement("button");
    btnBuy.className = "fo-btn fo-btn-primary fo-btn-wide";
    btnBuy.textContent = "Unlock Now — $1.99 one-time";
    btnBuy.onclick = async () => {
      initBilling({ productId: _productId, onEntitlement: _onEntitlement });
      try {
        setStatus(body, "Opening Google Play purchase…");
        await buyProduct(_productId);
        setStatus(body, "Purchase flow started…");
      } catch (e) {
        errlog("order failed:", e);
        setStatus(body, `Purchase failed: ${e && e.message ? e.message : String(e)}`, true);
      }
    };

    actions.appendChild(btnTrial);
    actions.appendChild(btnBuy);
  }

  function showPaywall({ productId, onEntitlement, message } = {}) {
    if (productId) _productId = productId;
    if (typeof onEntitlement === "function") _onEntitlement = onEntitlement;

    if (isProUnlocked()) return;

    const { body, actions } = createModal({
      title: "Unlock FireOps Calc",
      bodyHtml: `
        <div>
          ${message ? message : "Your free trial has ended."}<br><br>
          Unlock full access with a <b>one-time $1.99 purchase</b> — <b>no subscription</b>.
        </div>
        <div class="fo-small">If you already purchased, tap Restore.</div>
      `
    });

    const btnRestore = document.createElement("button");
    btnRestore.className = "fo-btn fo-btn-secondary fo-btn-wide";
    btnRestore.textContent = "Restore Purchase";
    btnRestore.onclick = async () => {
      initBilling({ productId: _productId, onEntitlement: _onEntitlement });
      try {
        setStatus(body, "Restoring…");
        const ok = await restorePurchases(_productId);
        if (ok) {
          setStatus(body, "Restored ✅");
          closeModal();
        } else {
          setStatus(body, "No previous purchase found on this account.", true);
        }
      } catch (e) {
        errlog("restore failed:", e);
        setStatus(body, `Restore failed: ${e && e.message ? e.message : String(e)}`, true);
      }
    };

    const btnBuy = document.createElement("button");
    btnBuy.className = "fo-btn fo-btn-primary fo-btn-wide";
    btnBuy.textContent = "Unlock — $1.99 one-time";
    btnBuy.onclick = async () => {
      initBilling({ productId: _productId, onEntitlement: _onEntitlement });
      try {
        setStatus(body, "Opening Google Play purchase…");
        await buyProduct(_productId);
        setStatus(body, "Purchase flow started…");
      } catch (e) {
        errlog("order failed:", e);
        setStatus(body, `Purchase failed: ${e && e.message ? e.message : String(e)}`, true);
      }
    };

    actions.appendChild(btnRestore);
    actions.appendChild(btnBuy);
  }

  // Expose global API
  window.FireOpsPaywall = {
    initBilling,
    showTrialIntroModal,
    showPaywall,
    buyProduct,
    restorePurchases,
    isBillingAvailable,
    isProUnlocked,
    setProUnlocked
  };
})();
