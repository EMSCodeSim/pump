/* ================================
   FireOps Calc – Paywall Logic
   ================================ */

(() => {
  const PRODUCT_ID = "fireops.pro";
  const TRIAL_DAYS = 5;
  const STORAGE = {
    installDate: "fireops_install_date",
    unlocked: "fireops_unlocked"
  };

  let storeReady = false;

  /* ---------- Utilities ---------- */

  function nowDays() {
    return Math.floor(Date.now() / 86400000);
  }

  function getInstallDay() {
    let d = localStorage.getItem(STORAGE.installDate);
    if (!d) {
      d = nowDays();
      localStorage.setItem(STORAGE.installDate, d);
    }
    return parseInt(d, 10);
  }

  function trialExpired() {
    return (nowDays() - getInstallDay()) >= TRIAL_DAYS;
  }

  function isUnlocked() {
    return localStorage.getItem(STORAGE.unlocked) === "true";
  }

  function unlockApp() {
    localStorage.setItem(STORAGE.unlocked, "true");
    hidePaywall();
    console.log("🔥 FireOps unlocked");
  }

  /* ---------- UI ---------- */

  function hidePaywall() {
    const el = document.getElementById("paywall");
    if (el) el.style.display = "none";
  }

  function showPaywall() {
    const el = document.getElementById("paywall");
    if (el) el.style.display = "block";
  }

  /* ---------- Billing ---------- */

  function initStore() {
    if (!window.store) {
      console.warn("Store not available (web / sideload)");
      return;
    }

    store.verbosity = store.DEBUG;

    store.register({
      id: PRODUCT_ID,
      type: store.NON_CONSUMABLE
    });

    store.when(PRODUCT_ID).approved(p => {
      console.log("✅ Purchase approved");
      p.finish();
      unlockApp();
    });

    store.when(PRODUCT_ID).owned(() => {
      console.log("🔓 Product already owned");
      unlockApp();
    });

    store.when(PRODUCT_ID).error(err => {
      console.error("Billing error:", err);
      alert("Purchase failed. Please try again.");
    });

    store.ready(() => {
      storeReady = true;
      console.log("🛒 Store ready");
      store.refresh();
    });

    store.refresh();
  }

  function buyNow() {
    if (!window.store || !storeReady) {
      alert("Purchases not available on this device.");
      return;
    }
    store.order(PRODUCT_ID);
  }

  /* ---------- Public API ---------- */

  window.FireOpsPaywall = {
    init() {
      if (isUnlocked()) {
        hidePaywall();
        return;
      }

      if (trialExpired()) {
        showPaywall();
      } else {
        showPaywall(); // still show during trial (with Pay Now button)
      }

      document.getElementById("paywall-buy")?.addEventListener("click", buyNow);
      document.getElementById("paywall-continue")?.addEventListener("click", hidePaywall);

      if (window.cordova) {
        document.addEventListener("deviceready", initStore, false);
      } else {
        // Web fallback (no billing, but app still loads)
        console.log("Running in browser mode");
      }
    }
  };
})();
