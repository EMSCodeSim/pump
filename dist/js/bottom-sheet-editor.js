// bottom-sheet-editor.js
// Mobile editor overlay for the calc stage.
// Re-resolves the current calc DOM on every open so Android cannot hold stale refs
// after the calc view re-renders.

(function(){
  const cfg = { lockScroll: false };
  const STYLE_ID = 'stage-overlay-style';
  const PORTAL_ID = 'stageOverlayHost';
  const BACKDROP_ID = 'stageOverlayBackdrop';

  let state = {
    isOpen: false,
    portal: null,
    backdrop: null,
    tipEditor: null,
    originalParent: null,
    teWye: null,
    branchBlock: null,
    syncBranchBlock: null,
    onResize: null,
  };

  function ensureStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${PORTAL_ID}{
        position: fixed;
        left: 0; top: 0; width: 0; height: 0;
        z-index: 9999;
        display: none;
        pointer-events: none;
        contain: layout paint;
      }
      #${BACKDROP_ID}{
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.45);
        pointer-events: auto;
        display: none;
        -webkit-backdrop-filter: none !important;
        backdrop-filter: none !important;
        animation: fireopsFadeIn .14s ease-out;
      }
      @keyframes fireopsFadeIn { from{opacity:0} to{opacity:1} }
      #${PORTAL_ID} #tipEditor.cover-stage{
        position: absolute; inset: 0;
        display: none;
        pointer-events: auto;
        background: #0e151e;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 22px;
        box-shadow: 0 18px 48px rgba(0,0,0,.5);
        padding: 16px;
        overflow: auto;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
        transform: translateZ(0);
        animation: fireopsStageIn .14s ease-out;
      }
      @keyframes fireopsStageIn {
        from { opacity:.75; transform: translateZ(0) scale(0.985) }
        to   { opacity:1;   transform: translateZ(0) scale(1) }
      }
      #tipEditor .te-row label{
        font-weight:800; color:#dfe9ff; display:block; margin:6px 0 4px;
      }
      #tipEditor .te-row input,
      #tipEditor .te-row select{
        width:100%; padding:12px 14px; border-radius:14px;
        background:#0b1420; color:#eaf2ff;
        border:1px solid rgba(255,255,255,.22);
      }
      #tipEditor .te-actions{
        position: sticky; bottom: 0;
        background: rgba(14,21,30,.9);
        padding-top: 8px; margin-top: 10px;
      }
      #tipEditor .te-actions .btn{
        min-height: 52px; padding: 10px 14px; border-radius:14px;
      }
    `;
    document.head.appendChild(s);
  }

  function ensurePortal(){
    ensureStyle();
    let portal = document.getElementById(PORTAL_ID);
    if (!portal){
      portal = document.createElement('div');
      portal.id = PORTAL_ID;
      document.body.appendChild(portal);
    }
    let backdrop = portal.querySelector('#' + BACKDROP_ID);
    if (!backdrop){
      backdrop = document.createElement('div');
      backdrop.id = BACKDROP_ID;
      portal.appendChild(backdrop);
    }
    if (!backdrop.__fireopsBound){
      backdrop.addEventListener('click', (e)=>{
        if (e.target !== backdrop) return;
        e.stopPropagation();
        api.close();
      });
      backdrop.__fireopsBound = true;
    }
    state.portal = portal;
    state.backdrop = backdrop;
    return { portal, backdrop };
  }

  function getCurrentEls(){
    const root = document.querySelector('[data-calc-root]') || document.body;
    return {
      root,
      stage: root.querySelector('#stage'),
      tipEditor: root.querySelector('#tipEditor'),
      teCancel: root.querySelector('#teCancel'),
      teApply: root.querySelector('#teApply'),
      teWye: root.querySelector('#teWye'),
      branchBlock: root.querySelector('#branchBlock'),
    };
  }

  function lockBodyScroll(lock){
    if (!cfg.lockScroll) return;
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  function positionPortal(){
    if (!state.portal) return;
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const inset = vw <= 640 ? 8 : 18;
    state.portal.style.left = `${inset}px`;
    state.portal.style.top = `${inset}px`;
    state.portal.style.width = `${Math.max(320, vw - (inset * 2))}px`;
    state.portal.style.height = `${Math.max(320, vh - (inset * 2))}px`;
  }

  function attachCancel(btn){
    if (!btn || btn.__fireopsCancelBound) return;
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      api.close();
    });
    btn.__fireopsCancelBound = true;
  }

  function attachApply(btn){
    if (!btn || btn.__fireopsApplyBound) return;
    btn.addEventListener('click', ()=> api.close());
    btn.__fireopsApplyBound = true;
  }

  function syncBranchBlockVisibility(){
    if (!state.teWye || !state.branchBlock) return;
    state.branchBlock.classList.toggle('is-hidden', state.teWye.value !== 'wye');
  }

  const api = {
    open(){
      const { portal, backdrop } = ensurePortal();
      const els = getCurrentEls();
      if (!els.stage || !els.tipEditor) return;

      if (state.isOpen && state.tipEditor === els.tipEditor){
        positionPortal();
        return;
      }

      api.close();

      state.tipEditor = els.tipEditor;
      state.originalParent = els.tipEditor.parentElement;
      state.teWye = els.teWye || null;
      state.branchBlock = els.branchBlock || null;

      els.tipEditor.classList.add('cover-stage');
      portal.appendChild(els.tipEditor);
      portal.style.display = 'block';
      backdrop.style.display = 'block';
      els.tipEditor.classList.remove('is-hidden');
      els.tipEditor.style.display = 'block';

      attachCancel(els.teCancel);
      attachApply(els.teApply);

      if (state.teWye){
        state.syncBranchBlock = syncBranchBlockVisibility;
        state.teWye.addEventListener('change', state.syncBranchBlock);
        requestAnimationFrame(syncBranchBlockVisibility);
      }

      if (!state.onResize){
        state.onResize = () => positionPortal();
        window.addEventListener('scroll', state.onResize, { passive: true });
        window.addEventListener('resize', state.onResize, { passive: true });
      }

      positionPortal();
      const first = els.tipEditor.querySelector('input, select, textarea, button');
      if (first) setTimeout(() => first.focus(), 0);
      lockBodyScroll(true);
      state.isOpen = true;
    },

    close(){
      if (!state.isOpen && !state.tipEditor){
        lockBodyScroll(false);
        return;
      }

      const { portal, backdrop } = ensurePortal();
      const tipEditor = state.tipEditor;
      if (tipEditor){
        tipEditor.style.display = 'none';
        if (state.originalParent && tipEditor.parentElement === portal){
          state.originalParent.appendChild(tipEditor);
        }
        tipEditor.classList.remove('cover-stage');
      }

      if (state.teWye && state.syncBranchBlock){
        state.teWye.removeEventListener('change', state.syncBranchBlock);
      }

      backdrop.style.display = 'none';
      portal.style.display = 'none';

      if (state.onResize){
        window.removeEventListener('scroll', state.onResize);
        window.removeEventListener('resize', state.onResize);
      }

      state = {
        isOpen: false,
        portal,
        backdrop,
        tipEditor: null,
        originalParent: null,
        teWye: null,
        branchBlock: null,
        syncBranchBlock: null,
        onResize: null,
      };
      lockBodyScroll(false);
    },

    configure(opts){
      if (opts && typeof opts === 'object') Object.assign(cfg, opts);
    }
  };

  window.BottomSheetEditor = api;
})();
