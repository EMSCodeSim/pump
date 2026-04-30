// bottom-sheet-editor.js
// Compact no-scroll editor overlay for the calc stage.

(function(){
  const cfg = { lockScroll: true };
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
        inset: 0;
        width: 100vw;
        height: 100dvh;
        z-index: 9999;
        display: none;
        pointer-events: none;
        contain: layout paint;
      }

      #${BACKDROP_ID}{
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.55);
        pointer-events: auto;
        display: none;
      }

      #${PORTAL_ID} #tipEditor.cover-stage{
        position: absolute !important;
        left: 50% !important;
        top: 50% !important;
        transform: translate(-50%, -50%) !important;

        width: min(96vw, 620px) !important;
        max-height: calc(100dvh - 16px) !important;

        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px 10px !important;

        background: #0e151e !important;
        border: 1px solid rgba(255,255,255,.14) !important;
        border-radius: 16px !important;
        box-shadow: 0 18px 48px rgba(0,0,0,.55) !important;
        padding: 10px !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        pointer-events: auto !important;
      }

      #${PORTAL_ID} #tipEditor.cover-stage > #teTitle,
      #${PORTAL_ID} #tipEditor.cover-stage > #segSwitch,
      #${PORTAL_ID} #tipEditor.cover-stage > input[type="hidden"],
      #${PORTAL_ID} #tipEditor.cover-stage > #branchPlusWrap,
      #${PORTAL_ID} #tipEditor.cover-stage > #branchBlock,
      #${PORTAL_ID} #tipEditor.cover-stage > .te-actions{
        grid-column: 1 / -1 !important;
      }

      #${PORTAL_ID} #tipEditor.cover-stage #teTitle{
        margin: 0 !important;
        font-size: 15px !important;
        line-height: 1.1 !important;
        font-weight: 900 !important;
      }

      #${PORTAL_ID} #tipEditor.cover-stage .te-row{
        margin: 0 !important;
        min-width: 0 !important;
      }

      #${PORTAL_ID} #tipEditor.cover-stage #rowNoz{
        grid-column: 1 / -1 !important;
      }

      #${PORTAL_ID} #tipEditor.cover-stage .te-row label{
        display: block !important;
        margin: 0 0 3px !important;
        font-size: 12px !important;
        line-height: 1.1 !important;
        font-weight: 800 !important;
        color: #dfe9ff !important;
      }

      #${PORTAL_ID} #tipEditor.cover-stage .te-row input,
      #${PORTAL_ID} #tipEditor.cover-stage .te-row select{
        width: 100% !important;
        min-height: 38px !important;
        height: 38px !important;
        padding: 5px 10px !important;
        border-radius: 11px !important;
        background: #0b1420 !important;
        color: #eaf2ff !important;
        border: 1px solid rgba(95,133,201,.65) !important;
        font-size: 14px !important;
        font-weight: 800 !important;
        box-sizing: border-box !important;
      }

      #${PORTAL_ID} #tipEditor.cover-stage .inline-stepper,
      #${PORTAL_ID} #tipEditor.cover-stage .steppers{
        width: 100% !important;
        display: grid !important;
        grid-template-columns: 40px 1fr 40px !important;
        align-items: center !important;
        gap: 6px !important;
        min-height: 38px !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      #${PORTAL_ID} #tipEditor.cover-stage .stepBtn,
      #${PORTAL_ID} #tipEditor.cover-stage .stepVal{
        min-height: 38px !important;
        height: 38px !important;
        border-radius: 11px !important;
        font-size: 18px !important;
        font-weight: 900 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-sizing: border-box !important;
      }

      #${PORTAL_ID} #tipEditor.cover-stage .stepVal{
        font-size: 16px !important;
      }

      #${PORTAL_ID} #tipEditor.cover-stage .te-actions{
        position: static !important;
        bottom: auto !important;
        background: transparent !important;
        padding: 4px 0 0 !important;
        margin: 0 !important;
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
      }

      #${PORTAL_ID} #tipEditor.cover-stage .te-actions .btn{
        min-height: 40px !important;
        height: 40px !important;
        padding: 8px 12px !important;
        border-radius: 12px !important;
        font-size: 15px !important;
        font-weight: 900 !important;
      }

      #${PORTAL_ID} #tipEditor.cover-stage #branchPlusWrap:not(.is-hidden),
      #${PORTAL_ID} #tipEditor.cover-stage #branchBlock:not(.is-hidden){
        max-height: 30vh !important;
        overflow: auto !important;
        border-top: 1px solid rgba(255,255,255,.12) !important;
        padding-top: 6px !important;
      }

      @media (max-width: 520px){
        #${PORTAL_ID} #tipEditor.cover-stage{
          width: calc(100vw - 12px) !important;
          max-height: calc(100dvh - 12px) !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 6px 8px !important;
          padding: 8px !important;
          border-radius: 14px !important;
        }

        #${PORTAL_ID} #tipEditor.cover-stage #teTitle{
          font-size: 13px !important;
        }

        #${PORTAL_ID} #tipEditor.cover-stage .te-row label{
          font-size: 10px !important;
          margin-bottom: 2px !important;
        }

        #${PORTAL_ID} #tipEditor.cover-stage .te-row input,
        #${PORTAL_ID} #tipEditor.cover-stage .te-row select{
          min-height: 34px !important;
          height: 34px !important;
          padding: 4px 8px !important;
          border-radius: 10px !important;
          font-size: 12px !important;
        }

        #${PORTAL_ID} #tipEditor.cover-stage .inline-stepper,
        #${PORTAL_ID} #tipEditor.cover-stage .steppers{
          grid-template-columns: 34px 1fr 34px !important;
          min-height: 34px !important;
          gap: 5px !important;
        }

        #${PORTAL_ID} #tipEditor.cover-stage .stepBtn,
        #${PORTAL_ID} #tipEditor.cover-stage .stepVal{
          min-height: 34px !important;
          height: 34px !important;
          border-radius: 10px !important;
          font-size: 16px !important;
        }

        #${PORTAL_ID} #tipEditor.cover-stage .stepVal{
          font-size: 13px !important;
        }

        #${PORTAL_ID} #tipEditor.cover-stage .te-actions .btn{
          min-height: 36px !important;
          height: 36px !important;
          font-size: 13px !important;
        }
      }

      @media (max-height: 620px){
        #${PORTAL_ID} #tipEditor.cover-stage{
          grid-template-columns: 1fr 1fr 1fr !important;
          gap: 5px 8px !important;
          padding: 8px !important;
        }

        #${PORTAL_ID} #tipEditor.cover-stage #rowNoz{
          grid-column: auto !important;
        }

        #${PORTAL_ID} #tipEditor.cover-stage .te-row label{
          font-size: 10px !important;
        }

        #${PORTAL_ID} #tipEditor.cover-stage .te-row input,
        #${PORTAL_ID} #tipEditor.cover-stage .te-row select,
        #${PORTAL_ID} #tipEditor.cover-stage .stepBtn,
        #${PORTAL_ID} #tipEditor.cover-stage .stepVal{
          height: 31px !important;
          min-height: 31px !important;
          font-size: 12px !important;
        }

        #${PORTAL_ID} #tipEditor.cover-stage .inline-stepper,
        #${PORTAL_ID} #tipEditor.cover-stage .steppers{
          grid-template-columns: 31px 1fr 31px !important;
          min-height: 31px !important;
        }

        #${PORTAL_ID} #tipEditor.cover-stage .te-actions .btn{
          height: 34px !important;
          min-height: 34px !important;
        }
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
      backdrop.addEventListener('click', function(e){
        if (e.target !== backdrop) return;
        e.preventDefault();
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

    document.documentElement.style.overflow = lock ? 'hidden' : '';
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  function positionPortal(){
    if (!state.portal) return;

    state.portal.style.left = '0';
    state.portal.style.top = '0';
    state.portal.style.width = '100vw';
    state.portal.style.height = '100dvh';
  }

  function attachCancel(btn){
    if (!btn || btn.__fireopsCancelBound) return;

    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      api.close();
    });

    btn.__fireopsCancelBound = true;
  }

  function attachApply(btn){
    if (!btn || btn.__fireopsApplyBound) return;

    btn.addEventListener('click', function(){
      api.close();
    });

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
      els.tipEditor.style.display = 'grid';

      attachCancel(els.teCancel);
      attachApply(els.teApply);

      if (state.teWye){
        state.syncBranchBlock = syncBranchBlockVisibility;
        state.teWye.addEventListener('change', state.syncBranchBlock);
        requestAnimationFrame(syncBranchBlockVisibility);
      }

      if (!state.onResize){
        state.onResize = function(){
          positionPortal();
        };

        window.addEventListener('resize', state.onResize, { passive: true });
        window.addEventListener('orientationchange', state.onResize, { passive: true });
      }

      positionPortal();
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
        window.removeEventListener('resize', state.onResize);
        window.removeEventListener('orientationchange', state.onResize);
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
      if (opts && typeof opts === 'object'){
        Object.assign(cfg, opts);
      }
    }
  };

  window.BottomSheetEditor = api;
})();
