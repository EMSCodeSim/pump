/* bottom-sheet-editor.js
 * Reusable mobile bottom sheet with:
 * - Drag handle + swipe-down to close
 * - Focus trap + ESC/backdrop to close
 * - Apply/Cancel actions with callbacks
 * - Safe-area padding & no-scroll background lock
 * - Small utility API: open(), close(), setContent(), setApplyEnabled(), setLoading(), updateTitle()
 *
 * Usage:
 *   const ctrl = BottomSheetEditor.open({
 *     title: 'Edit Line',
 *     html: '<p>…</p>',        // or node: HTMLElement
 *     primaryLabel: 'Apply',
 *     cancelLabel: 'Cancel',
 *     closeOnBackdrop: true,
 *     onApply: () => { … },    // optional
 *     onCancel: () => { … },   // optional
 *     initialFocus: '#gpm'     // optional CSS selector inside the sheet
 *   });
 *
 *   // Later (optional)
 *   ctrl.setContent('<b>Updated</b>');
 *   ctrl.setApplyEnabled(false);
 *   ctrl.setLoading(true);
 *   ctrl.updateTitle('New Title');
 *   ctrl.close();
 */

(function(){
  const ID = {
    wrap: 'bse-wrap',
    backdrop: 'bse-backdrop',
    sheet: 'bse-sheet',
    title: 'bse-title',
    body: 'bse-body',
    apply: 'bse-apply',
    cancel: 'bse-cancel',
    grab: 'bse-grab',
    loader: 'bse-loader'
  };

  const STYLE = `
  /* ===== Bottom Sheet Editor (BSE) ===== */
  :root { --bse-panel:#0e151e; --bse-ink:#eaf2ff; --bse-edge:rgba(255,255,255,.14); --bse-btn:#0b1320; --bse-btnEdge:#20324f; --bse-accent:#3aa7ff; }
  #${ID.wrap} { all: initial; font-family: system-ui, Segoe UI, Inter, Arial, sans-serif; }
  #${ID.wrap} *, #${ID.wrap} *::before, #${ID.wrap} *::after { box-sizing: border-box; }
  #${ID.backdrop}{
    position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 9998;
    opacity: 0; transition: opacity .2s ease;
  }
  #${ID.backdrop}.show{ opacity: 1; }
  #${ID.sheet}{
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 9999;
    background: var(--bse-panel); color: var(--bse-ink);
    border-top: 1px solid var(--bse-edge); border-radius: 16px 16px 0 0;
    transform: translateY(100%); transition: transform .25s ease;
    max-height: 80dvh; overflow: auto; -webkit-overflow-scrolling: touch;
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
    will-change: transform; contain: paint;
    box-shadow: 0 -10px 30px rgba(0,0,0,.35);
    backface-visibility: hidden;
  }
  #${ID.sheet}.show{ transform: translateY(0); }
  #${ID.sheet}:focus{ outline: none; }
  #${ID.sheet} .bse-content{ padding: 8px 12px 12px; }
  #${ID.sheet} .bse-head{ display:flex; align-items:center; justify-content:center; position:sticky; top:0; z-index:1;
    padding: 6px 12px 2px; background: linear-gradient(180deg, rgba(255,255,255,.04), transparent);
    border-top-left-radius: 16px; border-top-right-radius: 16px;
  }
  #${ID.grab}{ width: 42px; height: 4px; border-radius: 999px; background:#2b3b55; }
  #${ID.title}{ margin: 8px 0 10px; font-size: 16px; font-weight: 700; text-align:center; }
  #${ID.body} > * { max-width: 100%; }
  .bse-actions{ display:flex; gap:8px; justify-content:flex-end; margin-top: 14px; }
  .bse-btn{
    appearance:none; border:1px solid var(--bse-btnEdge); background: var(--bse-btn); color: var(--bse-ink);
    border-radius: 12px; padding: 10px 14px; min-height: 44px; min-width: 44px; cursor: pointer; font: inherit;
    box-shadow: 0 6px 16px rgba(0,0,0,.35);
  }
  .bse-btn:active{ transform: translateY(1px); filter: brightness(.98); }
  .bse-btn.primary{ border-color:#2b74ad; background: #102038; }
  .bse-btn[disabled]{ opacity:.6; cursor:not-allowed; }
  .bse-loader{
    display:none; margin-left:auto; margin-right:auto; width: 26px; height: 26px; border-radius: 50%;
    border: 2.5px solid rgba(255,255,255,.22); border-top-color: var(--bse-accent); animation: bseSpin .8s linear infinite;
  }
  .bse-loading .bse-loader{ display:block; }
  .bse-loading .bse-actions .bse-btn{ opacity:.5; pointer-events:none; }
  @keyframes bseSpin{ to { transform: rotate(360deg); } }

  @media (prefers-reduced-motion: reduce){
    #${ID.backdrop}{ transition: none !important; }
    #${ID.sheet}{ transition: none !important; }
  }

  /* Improve tap hit area for controls inside */
  #${ID.sheet} button, #${ID.sheet} input, #${ID.sheet} select, #${ID.sheet} textarea { font-size: 16px; }
  `;

  const HTML = `
    <div id="${ID.backdrop}" aria-hidden="true"></div>
    <section id="${ID.sheet}" role="dialog" aria-modal="true" aria-labelledby="${ID.title}" tabindex="-1">
      <div class="bse-head"><div id="${ID.grab}" aria-hidden="true"></div></div>
      <div class="bse-content">
        <h2 id="${ID.title}">Edit</h2>
        <div id="${ID.body}"></div>
        <div class="bse-loader" id="${ID.loader}" aria-hidden="true"></div>
        <div class="bse-actions">
          <button type="button" class="bse-btn" id="${ID.cancel}">Cancel</button>
          <button type="button" class="bse-btn primary" id="${ID.apply}">Apply</button>
        </div>
      </div>
    </section>
  `;

  let root, backdrop, sheet, titleEl, bodyEl, btnApply, btnCancel, loaderEl;
  let isOpen = false;
  let removeFns = [];
  let previousActive = null;
  let applyCb = null, cancelCb = null;
  let startY = null, currentY = null, dragging = false;

  function ensureDOM(){
    if (root) return;
    root = document.createElement('div');
    root.id = ID.wrap;
    root.innerHTML = `<style>${STYLE}</style>${HTML}`;
    document.body.appendChild(root);

    backdrop  = root.querySelector(`#${ID.backdrop}`);
    sheet     = root.querySelector(`#${ID.sheet}`);
    titleEl   = root.querySelector(`#${ID.title}`);
    bodyEl    = root.querySelector(`#${ID.body}`);
    btnApply  = root.querySelector(`#${ID.apply}`);
    btnCancel = root.querySelector(`#${ID.cancel}`);
    loaderEl  = root.querySelector(`#${ID.loader}`);
  }

  function lockScroll(){
    document.documentElement.classList.add('bse-noscroll');
    const style = document.getElementById('bse-noscroll-style');
    if (!style) {
      const s = document.createElement('style');
      s.id = 'bse-noscroll-style';
      s.textContent = `.bse-noscroll, .bse-noscroll body{ overflow:hidden !important; }`;
      document.head.appendChild(s);
    }
  }
  function unlockScroll(){
    document.documentElement.classList.remove('bse-noscroll');
  }

  function vibrate(ms=10){ try{ navigator.vibrate && navigator.vibrate(ms); }catch(_){} }

  function focusTrap(e){
    if (e.key !== 'Tab') return;
    const tabbables = getTabbables(sheet);
    if (!tabbables.length) return;
    const first = tabbables[0];
    const last = tabbables[tabbables.length - 1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }

  function getTabbables(scope){
    return Array.from(scope.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
  }

  function onKeydown(e){
    if (e.key === 'Escape'){ e.stopPropagation(); close(true); }
  }

  function onBackdrop(){
    // Configurable via open({ closeOnBackdrop })
    if (sheet.dataset.closeOnBackdrop === 'true') close(true);
  }

  function touchStart(e){
    if (e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    currentY = startY;
    dragging = true;
    sheet.style.transition = 'none';
  }
  function touchMove(e){
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    const dy = Math.max(0, currentY - startY);
    // Only allow pull-down
    sheet.style.transform = `translateY(${dy}px)`;
  }
  function touchEnd(){
    if (!dragging) return;
    const dy = Math.max(0, (currentY||0) - (startY||0));
    dragging = false;
    sheet.style.transition = '';
    if (dy > 90){ vibrate(5); close(true); }
    else { sheet.style.transform = 'translateY(0)'; }
    startY = currentY = null;
  }

  function setLoading(on){
    if (on){ sheet.classList.add('bse-loading'); }
    else { sheet.classList.remove('bse-loading'); }
  }

  function setApplyEnabled(enabled){
    btnApply.disabled = !enabled;
  }

  function updateTitle(t){
    titleEl.textContent = t || '';
  }

  function setContent(content){
    bodyEl.innerHTML = '';
    if (typeof content === 'string'){
      bodyEl.innerHTML = content;
    } else if (content instanceof HTMLElement){
      bodyEl.appendChild(content);
    }
  }

  function wireOnce(el, evt, fn, opts){
    el.addEventListener(evt, fn, opts);
    removeFns.push(()=> el.removeEventListener(evt, fn, opts));
  }

  function open(opts={}){
    ensureDOM();

    const {
      title = 'Edit',
      html = null,
      node = null,
      onApply = null,
      onCancel = null,
      primaryLabel = 'Apply',
      cancelLabel = 'Cancel',
      closeOnBackdrop = true,
      initialFocus = null
    } = opts;

    // Reset and configure
    sheet.dataset.closeOnBackdrop = closeOnBackdrop ? 'true' : 'false';
    updateTitle(title);
    setContent(node || html || '');
    btnApply.textContent = primaryLabel;
    btnCancel.textContent = cancelLabel;
    setLoading(false);
    setApplyEnabled(true);
    applyCb = typeof onApply === 'function' ? onApply : null;
    cancelCb = typeof onCancel === 'function' ? onCancel : null;

    // Show
    backdrop.classList.add('show');
    sheet.classList.add('show');
    backdrop.style.display = 'block';
    sheet.style.display = 'block';
    isOpen = true;
    lockScroll();
    previousActive = document.activeElement;

    // Focus management
    const doFocus = ()=>{
      let focusEl = null;
      if (initialFocus && typeof initialFocus === 'string'){
        focusEl = sheet.querySelector(initialFocus);
      }
      if (!focusEl){
        const tabs = getTabbables(sheet);
        focusEl = tabs[0] || btnApply || sheet;
      }
      focusEl && focusEl.focus();
    };
    setTimeout(doFocus, 0);

    // Clean old listeners
    removeFns.forEach(fn => fn());
    removeFns = [];

    // Wire listeners
    wireOnce(document, 'keydown', onKeydown, true);
    wireOnce(sheet, 'keydown', focusTrap);
    wireOnce(backdrop, 'click', onBackdrop);
    // Touch/drag on grab area AND sheet top area
    const grab = root.querySelector('#'+ID.grab);
    wireOnce(grab, 'touchstart', touchStart, {passive:true});
    wireOnce(grab, 'touchmove',  touchMove,  {passive:true});
    wireOnce(grab, 'touchend',   touchEnd,   {passive:true});
    // Also allow pulling anywhere in header area
    wireOnce(sheet, 'touchstart', (e)=>{
      // only allow pull if touch starts within ~90px from top of sheet
      const rect = sheet.getBoundingClientRect();
      if (e.touches[0].clientY - rect.top < 90) touchStart(e);
    }, {passive:true});
    wireOnce(sheet, 'touchmove',  touchMove,  {passive:true});
    wireOnce(sheet, 'touchend',   touchEnd,   {passive:true});

    // Buttons
    wireOnce(btnCancel, 'click', ()=>{
      vibrate(8);
      close(true);
    });
    wireOnce(btnApply, 'click', ()=>{
      // Prevent double submits while user callback runs
      if (btnApply.disabled) return;
      vibrate(10);
      const maybePromise = applyCb && applyCb();
      // If onApply returns a Promise, keep sheet until resolved/rejected
      if (maybePromise && typeof maybePromise.then === 'function'){
        setLoading(true);
        btnApply.disabled = true;
        maybePromise.finally(()=> {
          setLoading(false);
          btnApply.disabled = false;
          close(false); // treat as confirmed
        });
      } else {
        close(false);
      }
    });

    // Public controller
    const controller = {
      close: () => close(false),
      setContent,
      setApplyEnabled,
      setLoading,
      updateTitle,
      el: sheet
    };
    return controller;
  }

  function close(byCancel){
    if (!isOpen) return;
    isOpen = false;

    // callbacks
    try{
      if (byCancel && cancelCb) cancelCb();
      // Fire an event for external listeners (optional)
      const evt = new CustomEvent('bse:closed', { detail: { cancelled: !!byCancel }});
      sheet.dispatchEvent(evt);
    }catch(_){}

    // Animate out
    backdrop.classList.remove('show');
    sheet.classList.remove('show');
    sheet.style.transform = ''; // reset any drag transform
    // After transition, hide (timeout as a fallback)
    const tidy = ()=> {
      backdrop.style.display = 'none';
      sheet.style.display = 'none';
      unlockScroll();
      // Remove listeners
      removeFns.forEach(fn => fn());
      removeFns = [];
      // Restore focus
      if (previousActive && typeof previousActive.focus === 'function'){
        previousActive.focus();
      } else {
        // focus the document to avoid leaving focus trapped
        document.body.focus && document.body.focus();
      }
    };
    // Try to detect transition end
    let done = false;
    const onEnd = ()=>{ if (done) return; done = true; sheet.removeEventListener('transitionend', onEnd); tidy(); };
    sheet.addEventListener('transitionend', onEnd);
    setTimeout(onEnd, 260); // fallback
  }

  // Expose API
  window.BottomSheetEditor = {
    open,
    close: () => close(true),
    setContent,
    setApplyEnabled,
    setLoading,
    updateTitle,
    get isOpen(){ return isOpen; }
  };
})();
