<script>
// FireOps Calc – force fresh hoselines every time the site loads
(function () {
  try {
    // IMPORTANT:
    // 1) Open DevTools → Application → Local Storage → https://fireopscalc.com
    // 2) Look at the keys used by the pump calc.
    //    Replace the example keys below with the exact ones you see.

    var KEYS_TO_CLEAR = [
      'fireopscalc_state',       // example – change to your real key
      'fireopscalc_pump_state',  // example – change/remove as needed
    ];

    KEYS_TO_CLEAR.forEach(function (k) {
      if (localStorage.getItem(k) !== null) {
        localStorage.removeItem(k);
      }
    });

    // If your app namespaces everything under one prefix, you can do:
    //
    // Object.keys(localStorage).forEach(function (k) {
    //   if (k.indexOf('fireopscalc') !== -1 || k.indexOf('pump') !== -1) {
    //     localStorage.removeItem(k);
    //   }
    // });

  } catch (e) {
    // fail quietly – app should still run
  }
})();
</script>
