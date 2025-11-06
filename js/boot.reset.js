
/* boot.reset.js — run this BEFORE your main app bundle (in <head>) */
(function(){
  try {
    // 1) Kill persisted state that might re-deploy hoses
    var killKey = function(store, key){
      try{ store.removeItem(key); }catch(_){}
    };
    var nuke = function(store){
      try{
        for (var i = store.length - 1; i >= 0; i--) {
          var k = store.key(i) || '';
          // conservative match on likely keys
          if (/(pump|calc|line|lines|state|view\.calc|fireops|hoseline)/i.test(k)) {
            killKey(store, k);
          }
        }
      }catch(_){}
    };
    nuke(window.localStorage || {});
    nuke(window.sessionStorage || {});
  } catch(_) {}

  // 2) Hide presets immediately with CSS (IDs and common classes)
  try {
    var css = document.createElement('style');
    css.setAttribute('data-boot-hide', 'presets');
    css.textContent = [
      '#presetsBtn','[data-presets]','#presetSheet','#sheetBackdrop',
      '.presets','.preset-sheet','.sheet-backdrop'
    ].join(',') + '{display:none!important;visibility:hidden!important;pointer-events:none!important;}';
    document.head && document.head.appendChild(css);
  } catch(_) {}

  // 3) Observer to remove late-rendered presets UI
  try {
    var removePresets = function(root){
      if (!root) return;
      var byId = ['presetsBtn','presetSheet','sheetBackdrop'];
      byId.forEach(function(id){
        var el = root.querySelector && root.querySelector('#'+id);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      // Remove any button that literally says "Presets"
      var btns = root.querySelectorAll && root.querySelectorAll('button, [role="button"]');
      if (btns) {
        for (var i=0;i<btns.length;i++){
          var t = (btns[i].textContent || '').trim().toLowerCase();
          if (t === 'presets' && btns[i].parentNode) btns[i].parentNode.removeChild(btns[i]);
        }
      }
    };
    var obs = new MutationObserver(function(muts){
      for (var i=0;i<muts.length;i++) removePresets(document.body);
    });
    obs.observe(document.documentElement || document.body, { childList:true, subtree:true });
    // initial sweep
    removePresets(document.body);
  } catch(_) {}
})();
