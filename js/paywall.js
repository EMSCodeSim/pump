// paywall.js — SAFE / NON-BLOCKING VERSION

const PAYWALL_PRODUCT_ID = "fireopscalc_unlock";
let storeReady = false;
let purchaseAvailable = false;

function log(...args) {
  console.log("[Paywall]", ...args);
}

function showError(msg) {
  const el = document.getElementById("paywallError");
  if (el) {
    el.textContent = msg;
    el.style.display = "block";
  }
}

function hideError() {
  const el = document.getElementById("paywallError");
  if (el) el.style.display = "none";
}

// --- Initialize billing safely ---
function initBilling() {
  if (!window.store) {
    log("Store not present (web / preview / sideload)");
    return;
  }

  try {
    store.verbosity = store.ERROR;

    store.register({
      id: PAYWALL_PRODUCT_ID,
      type: store.NON_CONSUMABLE
    });

    store.when(PAYWALL_PRODUCT_ID).approved(product => {
      log("Purchase approved");
      product.finish();
      localStorage.setItem("fireops_pro", "true");
      closePaywall();
    });

    store.when(PAYWALL_PRODUCT_ID).error(err => {
      log("Purchase error", err);
      showError("Purchase failed. Please try again.");
    });

    store.ready(() => {
      log("Store ready");
      storeReady = true;
      purchaseAvailable = true;
    });

    store.refresh();
  } catch (e) {
    log("Billing init failed", e);
  }
}

// --- Purchase button handler ---
function buyNow() {
  hideError();

  if (!window.store || !storeReady) {
    showError("Purchases not available yet. Please wait a moment.");
    return;
  }

  const product = store.get(PAYWALL_PRODUCT_ID);

  if (!product) {
    showError("Purchase unavailable on this device.");
    return;
  }

  try {
    product.order();
  } catch (e) {
    log("Order failed", e);
    showError("Purchase failed. Make sure this app was installed from Google Play.");
  }
}

// --- UI helpers ---
function closePaywall() {
  const pw = document.getElementById("paywallOverlay");
  if (pw) pw.style.display = "none";
}

// --- Boot safely ---
document.addEventListener("deviceready", initBilling, false);

// Fallback for Capacitor timing
setTimeout(initBilling, 1500);

// Expose for button
window.fireopsBuyNow = buyNow;
