// bottom-sheet-editor.js
// Popup editor that covers ONLY the fire-truck stage area, rendered in a fixed-position portal
// above the SVG (so it can't get hidden behind it). Opens on "+", closes on Apply/Cancel.

(function(){
  const cfg = {
    lockScroll: false // set true to prevent body scroll while the panel is open
  };

  // ---- Locate host elements created by view.calc.js
  const root        = document.querySelector('[data-calc-root]') || document.body;
  const stage       = root.querySelector('#stage');           // wrapper around the truck/SVG
  const stageSvg    = root.querySelector('#stageSvg') || root.querySelector('svg');
  const tipEditor   = root.querySelector('#tipEditor');       // the editor markup already on the page
  const teCancel    = root.querySelector('#teCancel');
  const teApply     = root.querySelector('#teApply');
  const teWye       = root.querySelector('#teWye');
  const branchBlock = root.querySelector('#branchBlock');

  if(!stage || !stageSvg || !tipEditor){
    // Essentials not found; expose a no-op API to avoid runtime errors.
    window.BottomSheetEditor = { open(){}, close(){}, configure(o){ Object.assign(cfg, o||{}); } };
    return;
  }

  // ---- Create a fixed-position portal host attached to <body>
  // We'll *move* #tipEditor into this host while open, then move it back on close.
  let portal = document.getElementById('stageOverlayHost');
  if(!portal){
    portal = document.createElement('div');
    portal.id = 'stageOverlayHost';
    document.body.appendChild(portal);
  }

  // Backdrop lives inside the portal, covers only the portal bounds
  let portalBackdrop = portal.querySelector('#stageOverlayBackdrop');
  if(!portalBackdrop){
    portalBackdrop = document.createElement('div');
    portalBackdrop.id = 'stageOverlayBackdrop';
    portal.appendChild(portalBackdrop);
  }

  // Keep original parent so we can restore on close
  const originalParent = tipEditor.parentElement;

  // ---- One-time safety / styling
  const styleId = 'stage-overlay-style';
  if(!document.getElementById(styleId)){
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = `
      /* Fixed portal positioned over the stage rect */
      #stageOverlayHost{
        position: fixed;
        left: 0; top: 0; width: 0; height: 0;
        z-index: 9999;           /* HIGH to beat any SVG stacking quirks */
        display: none;           /* shown when opening */
        pointer-events: none;    /* children manage interactivity */
        contain: layout paint;   /* avoid bleed/flicker */
      }
      #stageOverlayBackdrop{
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.45);
        pointer-events: auto;    /* receive clicks to close */
        display: none;           /* shown when open */
        -webkit-backdrop-filter: none !important;
        backdrop-filter: none !important;
        animation: fadeIn .14s ease-out;
      }
      @keyframes fadeIn { from{opacity:0} to{opacity:1} }

      /* Editor fills the portal area */
      #stageOverlayHost #tipEditor.cover-stage{
        position: absolute; inset: 0;
        display: none;           /* shown when open */
        pointer-events: auto;
        background: #0e151e;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 12px;
        box-shadow: 0 10px 24px rgba(0,0,0,.45);
        padding: 12px;
        overflow: auto;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
        transform: translateZ(0);
        animation: stageIn .14s ease-out;
      }
      @keyframes stageIn {
        from { opacity:.75; transform: translateZ(0) scale(0.985) }
        to   { opacity:1;   transform: translateZ(0) scale(1) }
      }

      /* Comfy mobile controls */
      #tipEditor .te-row label{
        font-weight:700; color:#dfe9ff; display:block; margin:6px 0 4px;
      }
      #tipEditor .te-row input, #tipEditor .te-row select{
        width:100%; padding:10px 12px; border-radius:12px;
        background:#0b1420; color:#eaf2ff;
        border:1px solid rgba(255,255,255,.22);
      }
      #tipEditor .te-actions{
        position: sticky; bottom: 0;
        background: rgba(14,21,30,.9);
        padding-top: 8px; margin-top: 10px;
      }
      #tipEditor .te-actions .btn{
        min-height: 44px; padding: 10px 14px; border-radius:12px;
      }
    `;
    document.head.appendChild(s);
  }

  // ---- Utilities
  function lockBodyScroll(lock){
    if(!cfg.lockScroll) return;
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  function positionPortalOverStage(){
    const r = stage.getBoundingClientRect();
    // Size and position the portal to exactly cover the stage’s on-screen rect
    portal.style.left   = `${Math.round(r.left)}px`;
    portal.style.top    = `${Math.round(r.top)}px`;
    portal.style.width  = `${Math.round(r.width)}px`;
    portal.style.height = `${Math.round(r.height)}px`;
  }

  function mountEditorIntoPortal(){
    if (tipEditor.parentElement !== portal){
      tipEditor.classList.add('cover-stage');
      portal.appendChild(tipEditor);
    }
  }

  function unmountEditorToOriginal(){
    if (tipEditor.parentElement === portal){
      originalParent.appendChild(tipEditor);
      tipEditor.classList.remove('cover-stage');
    }
  }

  let isOpen = false;
  let onScrollOrResizeBound = null;

  function open(){
    if (isOpen) return;

    // Prepare geometry and mount
    positionPortalOverStage();
    mountEditorIntoPortal();

    // Show portal + backdrop + editor
    portal.style.display = 'block';
    portalBackdrop.style.display = 'block';
    tipEditor.classList.remove('is-hidden');
    tipEditor.style.display = 'block';

    // Keep aligned if the page scrolls or resizes while open
    if(!onScrollOrResizeBound){
      onScrollOrResizeBound = () => positionPortalOverStage();
      window.addEventListener('scroll', onScrollOrResizeBound, { passive:true });
      window.addEventListener('resize', onScrollOrResizeBound, { passive:true });
    }

    // Focus first control
    const first = tipEditor.querySelector('input, select, textarea, button');
    if(first) setTimeout(()=> first.focus(), 0);

    lockBodyScroll(true);
    isOpen = true;
  }

  function close(){
    if (!isOpen) return;

    // Hide UI
    tipEditor.style.display = 'none';
    portalBackdrop.style.display = 'none';
    portal.style.display = 'none';

    // Restore to original place so existing code keeps working
    unmountEditorToOriginal();

    // Stop following geometry
    if(onScrollOrResizeBound){
      window.removeEventListener('scroll', onScrollOrResizeBound);
      window.removeEventListener('resize', onScrollOrResizeBound);
      onScrollOrResizeBound = null;
    }

    lockBodyScroll(false);
    isOpen = false;
  }

  // ---- Open only when clicking a real "+" (hose-end) inside the stage SVG
  stageSvg.addEventListener('click', (e)=>{
    const tip = e.target.closest('.hose-end');
    if(!tip) return;
    e.preventDefault();
    e.stopPropagation();
    open();
  });

  // ---- Backdrop closes (clicking outside the panel, but within the stage area)
  portalBackdrop.addEventListener('click', (e)=>{
    if(e.target !== portalBackdrop) return;
    e.stopPropagation();
    close();
  });

  // ---- Cancel closes
  if(teCancel){
    teCancel.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      close();
    });
  }

  // ---- Apply closes (per your request)
  if(teApply){
    teApply.addEventListener('click', ()=>{
      // Your host code applies changes; we just close the overlay.
      close();
    });
  }

  // ---- Wye toggle reveals branch inputs
  if(teWye && branchBlock){
    const sync = ()=> branchBlock.classList.toggle('is-hidden', teWye.value !== 'on');
    teWye.addEventListener('change', sync);
    requestAnimationFrame(sync);
  }

  // ---- Public API
  window.BottomSheetEditor = {
    open, close,
    configure(opts){
      if(opts && typeof opts === 'object') Object.assign(cfg, opts);
    }
  };
})();
