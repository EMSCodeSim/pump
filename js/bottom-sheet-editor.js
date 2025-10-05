// bottom-sheet-editor.js
// Popup editor that ONLY covers the fire-truck stage (#stage). Opens on "+", closes on Apply/Cancel.
// Assumes #tipEditor markup already exists inside the page (created by view.calc.js).

(function(){
  const cfg = {
    lockScroll: false // set true to disable body scroll while editor is open
  };

  // Find calc root & key DOM nodes
  const root        = document.querySelector('[data-calc-root]') || document.body;
  const stage       = root.querySelector('#stage');          // wrapper that contains the truck SVG
  const stageSvg    = root.querySelector('#stageSvg') || root.querySelector('svg');
  const tipEditor   = root.querySelector('#tipEditor');
  const teCancel    = root.querySelector('#teCancel');
  const teApply     = root.querySelector('#teApply');
  const teWye       = root.querySelector('#teWye');
  const branchBlock = root.querySelector('#branchBlock');

  // If essentials are missing, expose a no-op API
  if(!stage || !stageSvg || !tipEditor){
    window.BottomSheetEditor = {
      open(){}, close(){}, configure(o){ Object.assign(cfg, o||{}); }
    };
    return;
  }

  // Ensure stage can host absolutely-positioned children
  if (getComputedStyle(stage).position === 'static') {
    stage.style.position = 'relative';
  }

  // Backdrop that covers ONLY the stage area (not the whole page)
  let stageBackdrop = stage.querySelector('#stageBackdrop');
  if(!stageBackdrop){
    stageBackdrop = document.createElement('div');
    stageBackdrop.id = 'stageBackdrop';
    stage.appendChild(stageBackdrop);
  }

  // Put #tipEditor inside #stage so it overlays the truck only
  if (tipEditor.parentElement !== stage) {
    stage.appendChild(tipEditor);
  }

  // One-time safety / styling
  const styleId = 'stage-editor-style';
  if(!document.getElementById(styleId)){
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = `
      /* Backdrop only over the truck stage */
      #stage #stageBackdrop{
        position:absolute; inset:0;
        background: rgba(0,0,0,0.45);
        display:none; z-index: 20;  /* below the editor, above the SVG */
        -webkit-backdrop-filter: none !important;
        backdrop-filter: none !important;
        pointer-events: auto;
      }
      /* Editor covers the stage area */
      #stage #tipEditor.cover-stage{
        position:absolute; inset:0;
        display:none; z-index: 21; /* above backdrop */
        background: #0e151e;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 12px;
        box-shadow: 0 10px 24px rgba(0,0,0,.45);
        padding: 12px;
        overflow: auto;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
        transform: translateZ(0);
      }
      #stage #tipEditor.cover-stage.is-open{
        display:block;
        animation: stageIn .16s ease-out;
      }
      #stage #stageBackdrop.show{
        display:block;
        animation: fadeIn .16s ease-out;
      }
      @keyframes fadeIn{ from{opacity:0} to{opacity:1} }
      @keyframes stageIn{
        from{ opacity:.75; transform: translateZ(0) scale(0.98) }
        to{ opacity:1; transform: translateZ(0) scale(1) }
      }

      /* Make fields comfy for mobile inside the full-cover panel */
      #tipEditor .te-row label{ font-weight:700; color:#dfe9ff; display:block; margin:6px 0 4px }
      #tipEditor .te-row input, #tipEditor .te-row select{
        width:100%; padding:10px 12px; border-radius:12px;
        background:#0b1420; color:#eaf2ff;
        border:1px solid rgba(255,255,255,.22);
      }
      #tipEditor .te-actions{ position:sticky; bottom:0; background:rgba(14,21,30,.85); padding-top:8px; margin-top:10px; backdrop-filter: none; }
      #tipEditor .te-actions .btn{ min-height:44px; padding:10px 14px; border-radius:12px; }
    `;
    document.head.appendChild(s);
  }

  // Behavior helpers
  function lockBodyScroll(lock){
    if(!cfg.lockScroll) return;
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  function open(){
    if (tipEditor.classList.contains('is-open')) return;

    // Make sure editor has the cover-stage class and is inside stage
    tipEditor.classList.add('cover-stage');

    // Show backdrop + editor
    stageBackdrop.classList.add('show');
    tipEditor.classList.add('is-open');
    lockBodyScroll(true);

    // Focus the first control inside
    const first = tipEditor.querySelector('input, select, textarea, button');
    if(first) setTimeout(()=> first.focus(), 0);
  }

  function close(){
    if (!tipEditor.classList.contains('is-open')) return;
    tipEditor.classList.remove('is-open');
    stageBackdrop.classList.remove('show');
    lockBodyScroll(false);
  }

  // Open ONLY when clicking a real "+" (hose-end) inside the stage SVG
  stageSvg.addEventListener('click', (e)=>{
    const tip = e.target.closest('.hose-end');
    if(!tip) return;
    e.preventDefault();
    e.stopPropagation();
    open();
  });

  // Backdrop: click outside panel (but inside stage) closes
  stageBackdrop.addEventListener('click', (e)=>{
    if(e.target !== stageBackdrop) return;
    e.stopPropagation();
    close();
  });

  // Cancel closes
  if(teCancel){
    teCancel.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      close();
    });
  }

  // Apply closes (per your request)
  if(teApply){
    teApply.addEventListener('click', ()=>{
      // Your host code already applies state; we just close the overlay here.
      close();
    });
  }

  // Wye toggle shows/hides branch inputs
  if(teWye && branchBlock){
    const sync = ()=> branchBlock.classList.toggle('is-hidden', teWye.value !== 'on');
    teWye.addEventListener('change', sync);
    requestAnimationFrame(sync);
  }

  // Public API for optional external control
  window.BottomSheetEditor = {
    open, close,
    configure(opts){
      if(opts && typeof opts === 'object') Object.assign(cfg, opts);
    }
  };
})();
