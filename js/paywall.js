/* paywall.js
   - Uses cordova-plugin-purchase (not @capacitor-community/in-app-purchases)
   - IMPORTANT: your app also has its own store.js; do NOT grab that by accident.
*/

let _productId = null;
let _billingInitPromise = null;

function _getStore() {
  // IMPORTANT: this app also has its own "store.js". Do NOT accidentally use that.
  // We only accept a store object that looks like cordova-plugin-purchase.
  const s1 = window?.CdvPurchase?.store;
  if (s1 && typeof s1.register === "function" && typeof s1.order === "function") return s1;

  const s2 = window?.store;
  if (s2 && typeof s2.register === "function" && typeof s2.order === "function") return s2;

  return null;
}

function _isOwned(prod) {
  try {
    if (!prod) return false;
    // cordova-plugin-purchase has changed property names across versions
    if (prod.owned === true || prod.isOwned === true) return true;
    if (typeof prod.owned === "function" && prod.owned()) return true;
    if (typeof prod.isOwned === "function" && prod.isOwned()) return true;
    return false;
  } catch {
    return false;
  }
}

const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function _isCapacitorAndroid() {
  try {
    return !!(window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === "android");
  } catch {
    return false;
  }
}

function _isWeb() {
  // If you’re running in the browser (fireopscalc.com), we cannot do Play Billing
  // Purchases only work inside the installed app.
  return !_isCapacitorAndroid() && !window.cordova;
}

export async function initBilling(productId) {
  if (_billingInitPromise) return _billingInitPromise;

  _productId = productId;

  _billingInitPromise = (async () => {
    const s = _getStore();
    if (_isWeb()) return { ok: false, reason: "web" };
    if (!s) return { ok: false, reason: "store-missing" };

    // Cordova Purchase Store verbosity (optional)
    try {
      if (typeof s.verbosity !== "undefined") s.verbosity = s.DEBUG || s.INFO || 1;
    } catch {}

    // Register product (non-consumable)
    try {
      // v13+ uses store.register([{ id, type, platform }])
      if (typeof s.register === "function") {
        const ProductType = (window?.CdvPurchase?.ProductType) || (s?.NON_CONSUMABLE ? null : null);
        const Platform = window?.CdvPurchase?.Platform;

        // Best-effort registration that works across versions:
        const reg = [];

        if (Platform?.GOOGLE_PLAY) {
          reg.push({ id: productId, type: window?.CdvPurchase?.ProductType?.NON_CONSUMABLE || "non consumable", platform: Platform.GOOGLE_PLAY });
        } else {
          // Older plugin variants:
          reg.push({ id: productId, type: s.NON_CONSUMABLE || "non consumable" });
        }

        s.register(reg);
      }
    } catch (e) {
      console.warn("Billing register failed:", e);
    }

    // Hook common lifecycle handlers (safe across versions)
    try {
      if (typeof s.when === "function") {
        s.when(productId).approved((t) => {
          // Some versions require verify() to flip owned
          try { t.verify(); } catch {}
        });

        s.when(productId).verified((t) => {
          // Finish transaction
          try { t.finish(); } catch {}
        });
      }
    } catch {}

    // Ready callback
    const readyOk = await new Promise((resolve) => {
      let settled = false;

      const done = (ok) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };

      try {
        if (typeof s.ready === "function") {
          s.ready(() => done(true));
          // If ready never fires, fallback timeout
          setTimeout(() => done(true), 2500);
        } else {
          // No ready() API
          done(true);
        }
      } catch {
        done(false);
      }
    });

    // Refresh owned state once
    try { if (typeof s.refresh === "function") await s.refresh(); } catch {}

    return { ok: !!readyOk, reason: readyOk ? "ready" : "not-ready" };
  })();

  return _billingInitPromise;
}

async function checkOwned() {
  const s = _getStore();
  if (!s || !_productId) return false;

  try {
    // Refresh pulls owned state from Google Play (important after reinstall / restore).
    if (typeof s.refresh === "function") {
      await s.refresh();
    }
  } catch {
    // ignore
  }

  const p = s.get?.(_productId);
  return _isOwned(p);
}

export async function buyProduct(productId) {
  // Backwards-compatible wrapper.
  return purchaseAndWait(productId);
}

export async function purchaseAndWait(productId, { timeoutMs = 45000 } = {}) {
  const s = _getStore();
  if (!s) throw new Error("Billing store not available (cordova-plugin-purchase not loaded).");

  // Make sure billing is initialized (register product + ready)
  await initBilling(productId);

  // If already owned, resolve immediately.
  const already = s.get?.(productId);
  if (_isOwned(already)) return true;

  // Some store implementations want a refresh before ordering.
  try { if (typeof s.refresh === "function") await s.refresh(); } catch {}

  // Kick off purchase flow.
  await s.order(productId);

  // Wait for ownership to flip true (Google Play sheet + purchase complete).
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (typeof s.refresh === "function") await s.refresh();
    } catch {}
    const p = s.get?.(productId);
    if (_isOwned(p)) return true;
    await _sleep(600);
  }

  // Not owned within timeout: user likely cancelled, or Play Billing isn't ready.
  return false;
}

export async function restorePurchases(productId) {
  const s = _getStore();
  if (_isWeb()) throw new Error("Restore only works inside the installed app (not the website).");
  if (!s) throw new Error("Billing store not available.");

  await initBilling(productId);

  // refresh is effectively the restore sync for this plugin
  try { if (typeof s.refresh === "function") await s.refresh(); } catch {}
  const p = s.get?.(productId);
  return _isOwned(p);
}

// ---------- UI ----------

export function renderTrialIntroModal({
  productId,
  trialDays = 5,
  onContinue,
  onPayNow,
}) {
  const root = document.createElement("div");
  root.id = "trialIntroModal";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.background = "rgba(0,0,0,0.55)";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";
  root.style.zIndex = "99999";

  const card = document.createElement("div");
  card.style.width = "min(520px, 92vw)";
  card.style.background = "#111827";
  card.style.color = "#fff";
  card.style.borderRadius = "16px";
  card.style.padding = "18px";
  card.style.boxShadow = "0 12px 40px rgba(0,0,0,0.35)";
  card.style.border = "1px solid rgba(255,255,255,0.10)";

  card.innerHTML = `
    <div style="font-size:18px;font-weight:700;margin-bottom:6px;">${trialDays}-Day Free Trial — No Risk</div>
    <div style="opacity:.85;margin-bottom:10px;line-height:1.35;">
      FireOps Calc is free for ${trialDays} days. You can unlock full access anytime with a one-time purchase.
    </div>
    <ul style="opacity:.9;margin:0 0 12px 18px;line-height:1.5;">
      <li>No subscription</li>
      <li>One-time unlock: $1.99</li>
      <li>Restore works if you reinstall</li>
    </ul>
    <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
      <button id="trialContinueBtn" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;font-weight:600;">Continue Trial</button>
      <button id="trialPayBtn" style="padding:10px 14px;border-radius:12px;border:0;background:#2563eb;color:#fff;font-weight:800;">Pay Now — $1.99 one-time</button>
    </div>
    <div style="margin-top:10px;opacity:.7;font-size:12px;">
      If the purchase sheet doesn’t open, billing may not be ready yet.
    </div>
  `;

  root.appendChild(card);
  document.body.appendChild(root);

  const btnContinue = card.querySelector("#trialContinueBtn");
  const btnPay = card.querySelector("#trialPayBtn");

  btnContinue.addEventListener("click", () => {
    try { root.remove(); } catch {}
    if (typeof onContinue === "function") onContinue();
  });

  btnPay.addEventListener("click", async () => {
    btnPay.disabled = true;
    btnPay.textContent = "Opening Google Play…";
    try {
      const ok = await purchaseAndWait(productId);
      if (ok) {
        // Let the app decide what to unlock; we just report success.
        if (typeof onPayNow === "function") onPayNow();
      } else {
        alert("Purchase was not completed. If the Google Play purchase sheet didn’t open, billing may not be ready yet.");
      }
    } catch (e) {
      alert("Purchase failed: " + (e?.message || e));
    } finally {
      btnPay.disabled = false;
      btnPay.textContent = "Pay Now — $1.99 one-time";
    }
  });

  // Click outside closes
  root.addEventListener("click", (e) => {
    if (e.target === root) {
      try { root.remove(); } catch {}
    }
  });

  return () => {
    try { root.remove(); } catch {}
  };
}

export function renderHardPaywall({ productId, onPurchase, onRestore }) {
  const wrap = document.createElement("div");
  wrap.style.minHeight = "calc(100vh - 60px)";
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.justifyContent = "center";
  wrap.style.padding = "18px";

  const card = document.createElement("div");
  card.style.width = "min(640px, 96vw)";
  card.style.background = "#0b1020";
  card.style.border = "1px solid rgba(255,255,255,0.10)";
  card.style.borderRadius = "18px";
  card.style.padding = "18px";
  card.style.color = "#fff";
  card.style.boxShadow = "0 14px 42px rgba(0,0,0,0.35)";

  card.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <div>
        <div style="font-size:20px;font-weight:800;">Trial ended</div>
        <div style="opacity:.85;margin-top:4px;">Unlock Pro to keep using FireOps Calc.</div>
      </div>
      <div style="font-weight:900;background:#111827;border:1px solid rgba(255,255,255,.12);padding:8px 10px;border-radius:12px;">$1.99</div>
    </div>

    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">
      <button id="pwRestoreBtn" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;font-weight:700;">Restore</button>
      <button id="pwBuyBtn" style="padding:10px 14px;border-radius:12px;border:0;background:#2563eb;color:#fff;font-weight:900;">Buy Now</button>
    </div>

    <div style="margin-top:10px;opacity:.7;font-size:12px;">
      Purchases require the installed app from Google Play (internal testing / production).
    </div>
  `;

  wrap.appendChild(card);

  const btnBuy = card.querySelector("#pwBuyBtn");
  const btnRestore = card.querySelector("#pwRestoreBtn");

  btnBuy.addEventListener("click", async () => {
    btnBuy.disabled = true;
    btnBuy.textContent = "Opening Google Play…";
    try {
      // Prefer external handler (app.js) so it can decide what to unlock
      if (typeof onPurchase === "function") {
        await onPurchase();
      } else {
        const ok = await purchaseAndWait(productId);
        if (!ok) alert("Purchase not completed.");
      }
    } finally {
      btnBuy.disabled = false;
      btnBuy.textContent = "Buy Now";
    }
  });

  btnRestore.addEventListener("click", async () => {
    btnRestore.disabled = true;
    btnRestore.textContent = "Restoring…";
    try {
      if (typeof onRestore === "function") {
        await onRestore();
      } else {
        const ok = await restorePurchases(productId);
        alert(ok ? "Restore successful." : "No purchase found to restore.");
      }
    } catch (e) {
      alert("Restore failed: " + (e?.message || e));
    } finally {
      btnRestore.disabled = false;
      btnRestore.textContent = "Restore";
    }
  });

  return wrap;
}

export async function isProOwned(productId) {
  await initBilling(productId);
  return checkOwned();
}
