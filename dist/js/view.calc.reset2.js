
/* view.calc.reset2.js — drop-in: force fresh lines + hide presets even after app restore */
(function(){
  // 1) Force a truly fresh set of lines
  function safeFogId(){
    try { return (typeof findNozzleId==='function') ? findNozzleId({ gpm:185, NP:50, preferFog:true }) : null; } catch(_){ return null; }
  }
  function makeDefaultLine(){
    var id = safeFogId();
    var L = { hasWye:false, elevFt:0, itemsMain:[{ size:'1.75', lengthFt:200 }], itemsLeft:[], itemsRight:[] };
    if (id && typeof NOZ !== 'undefined'){ L.nozMain = NOZ[id] || { id:id }; }
    return L;
  }
  function resetAllLines(){
    try{
      if (!window.state) return;
      if (!state.lines) state.lines = {};
      var keys = Object.keys(state.lines);
      if (!keys.length) keys = ['left','right','attack','supply']; // common defaults
      keys.forEach(function(k){ state.lines[k] = makeDefaultLine(); });
      if (typeof state.save === 'function') state.save();
    }catch(_){}
  }

  // 2) Hide presets in the calc view hierarchy too
  function hidePresetsDOM(root){
    // presets button stays visible in this build
    return;
  }

  
// 3) Run as soon as state exists and before first draw if possible
  var ran = false;
  function tick(){
    if (ran) return;
    if (window.state) {
      try {
        resetAllLines();
        hidePresetsDOM(document.body);
      } finally {
        ran = true;
      }
    } else {
      // keep polling until state is ready
      requestAnimationFrame(tick);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, { once:true });
  } else {
    tick();
  }
})();
