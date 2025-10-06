/* bottom-sheet-editor.js  — CENTER MODAL VERSION
 * Replaces the bottom sheet with a centered popup over the truck image.
 * - Accessible modal (role="dialog", focus trap, ESC/backdrop close)
 * - Dimmed backdrop; page scroll locked while open
 * - Built-in form factory: buildLineEditorForm(line) for hoseline settings
 * - API: BottomSheetEditor.open({ title, node|html, onApply, onCancel, initialFocus })
 *        BottomSheetEditor.close()
 *
 * Integration example in view.calc.js (pseudo):
 *   const ctrl = BottomSheetEditor.open({
 *     title: 'Edit Line (Left)',
 *     node: buildLineEditorForm(currentLine),
 *     onApply: () => { const data = readLineEditorForm(); applyToState(data); }
 *   });
 */

(function(){
  const ID = {
    wrap: 'bse-wrap',
    backdrop: 'bse-backdrop',
    modal: 'bse-modal',
    dialog: 'bse-dialog',
    title: 'bse-title',
    body: 'bse-body',
    apply: 'bse-apply',
    cancel: 'bse-cancel',
    loader: 'bse-loader'
  };

  const STYLE = `
  :root {
    --bse-bg: rgba(0,0,0,.55);
    --bse-panel:#0f1624; --bse-ink:#eaf2ff; --bse-edge:rgba(255,255,255,.14);
    --bse-btn:#0b1320; --bse-btnEdge:#20324f; --bse-accent:#3aa7ff;
  }
  #${ID.wrap} { all: initial; font-family: system-ui, Segoe UI, Inter, Arial, sans-serif; }
  #${ID.wrap} *, #${ID.wrap} *::before, #${ID.wrap} *::after { box-sizing: border-box; }

  /* Backdrop fills the whole viewport */
  #${ID.backdrop}{
    position: fixed; inset: 0; background: var(--bse-bg); z-index: 9998;
    opacity: 0; transition: opacity .18s ease;
  }
  #${ID.backdrop}.show{ opacity: 1; }

  /* Centered modal container */
  #${ID.modal}{
    position: fixed; inset: 0; z-index: 9999;
    display: grid; place-items: center; padding: 12px;
    pointer-events: none;       /* backdrop eats outer clicks */
  }

  /* Dialog panel */
  #${ID.dialog}{
    pointer-events: auto; background: var(--bse-panel); color: var(--bse-ink);
    border: 1px solid var(--bse-edge); border-radius: 16px;
    width: min(92vw, 560px); max-height: min(82vh, 720px);
    display: flex; flex-direction: column;
    transform: translateY(10px) scale(.98);
    opacity: 0; transition: transform .18s ease, opacity .18s ease;
    box-shadow: 0 18px 48px rgba(0,0,0,.45);
    padding-bottom: calc(10px + env(safe-area-inset-bottom));
    outline: none;
  }
  #${ID.dialog}.show{ transform: translateY(0) scale(1); opacity: 1; }

  .bse-head{
    display:flex; align-items:center; justify-content:space-between;
    padding: 10px 12px; border-bottom: 1px solid var(--bse-edge);
  }
  #${ID.title}{ margin:0; font-size:16px; font-weight:800; letter-spacing:.2px; }
  .bse-close{
    appearance:none; border:1px solid var(--bse-btnEdge); background:var(--bse-btn);
    color:#cfe4ff; border-radius:10px; padding:8px 10px; min-width:40px; cursor:pointer;
  }

  .bse-content{ padding: 10px 12px; overflow:auto; -webkit-overflow-scrolling: touch; }
  .bse-actions{ padding: 10px 12px; display:flex; gap:8px; justify-content:flex-end; border-top:1px solid var(--bse-edge); }
  .bse-btn{
    appearance:none; border:1px solid var(--bse-btnEdge); background:var(--bse-btn); color:var(--bse-ink);
    border-radius:12px; padding:10px 14px; min-height:44px; min-width:44px; cursor:pointer; font: inherit;
    box-shadow:0 6px 16px rgba(0,0,0,.35);
  }
  .bse-btn.primary{ background:#102038; border-color:#2b74ad; }
  .bse-btn:active{ transform: translateY(1px); filter: brightness(.98); }
  .bse-btn[disabled]{ opacity:.65; cursor:not-allowed; }

  .bse-loader{
    display:none; margin: 8px auto; width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid rgba(255,255,255,.22); border-top-color: var(--bse-accent);
    animation: bseSpin .8s linear infinite;
  }
  .bse-loading .bse-loader{ display:block; }
  .bse-loading .bse-actions .bse-btn{ opacity:.5; pointer-events:none; }
  @keyframes bseSpin{ to { transform: rotate(360deg); } }

  /* Form basics inside modal */
  #${ID.dialog} label{ display:block; font-weight:700; color:#dfe9ff; margin: 8px 0 4px; }
  #${ID.dialog} input, #${ID.dialog} select{
    width:100%; padding:10px 12px; border:1px solid rgba(255,255,255,.22); border-radius:12px;
    background:#0b1420; color:#eaf2ff; font-size:16px; outline:none;
  }
  #${ID.dialog} input:focus, #${ID.dialog} select:focus{
    border-color:#6ecbff; box-shadow:0 0 0 3px rgba(110,203,255,.22);
  }
  .row{ display:flex; gap:10px; flex-wrap:wrap; }
  .col{ flex:1 1 180px; min-width: 160px; }
  .chipRow{ display:flex; gap:6px; flex-wrap: wrap; }
  .chip{
    padding:8px 10px; border:1px solid #1f3a57; background:#0b1a29; color:#eaf2ff;
    border-radius:999px; cursor:pointer; font-size:14px;
  }
  .chip.active{ border-color:#2a5f92; background:#0e2036; }

  /* Reduced motion preference */
  @media (prefers-reduced-motion: reduce){
    #${ID.backdrop}, #${ID.dialog}{ transition: none !important; }
  }
  `;

  const HTML = `
    <div id="${ID.backdrop}" aria-hidden="true"></div>
    <section id="${ID.modal}" aria-hidden="true">
      <div id="${ID.dialog}" role="dialog" aria-modal="true" aria-labelledby="${ID.title}" tabindex="-1">
        <div class="bse-head">
          <h2 id="${ID.title}">Edit</h2>
          <button type="button" class="bse-close" data-close="1" aria-label="Close">Close</button>
        </div>
        <div class="bse-content">
          <div class="bse-loader" id="${ID.loader}" aria-hidden="true"></div>
          <div id="${ID.body}"></div>
        </div>
        <div class="bse-actions">
          <button type="button" class="bse-btn" id="${ID.cancel}">Cancel</button>
          <button type="button" class="bse-btn primary" id="${ID.apply}">Apply</button>
        </div>
      </div>
    </section>
  `;

  let root, backdrop, modal, dialog, titleEl, bodyEl, btnApply, btnCancel, loaderEl;
  let isOpen = false, removeFns = [], previousActive = null;
  let applyCb = null, cancelCb = null;

  function ensureDOM(){
    if (root) return;
    root = document.createElement('div');
    root.id = ID.wrap;
    root.innerHTML = `<style>${STYLE}</style>${HTML}`;
    document.body.appendChild(root);

    backdrop  = root.querySelector('#'+ID.backdrop);
    modal     = root.querySelector('#'+ID.modal);
    dialog    = root.querySelector('#'+ID.dialog);
    titleEl   = root.querySelector('#'+ID.title);
    bodyEl    = root.querySelector('#'+ID.body);
    btnApply  = root.querySelector('#'+ID.apply);
    btnCancel = root.querySelector('#'+ID.cancel);
    loaderEl  = root.querySelector('#'+ID.loader);
  }

  function lockScroll(){
    document.documentElement.classList.add('bse-noscroll');
    if (!document.getElementById('bse-noscroll-style')){
      const s = document.createElement('style');
      s.id = 'bse-noscroll-style';
      s.textContent = `.bse-noscroll, .bse-noscroll body{ overflow:hidden !important; }`;
      document.head.appendChild(s);
    }
  }
  function unlockScroll(){ document.documentElement.classList.remove('bse-noscroll'); }

  function getTabbables(scope){
    return Array.from(scope.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
  }
  function focusTrap(e){
    if (e.key !== 'Tab') return;
    const tabbables = getTabbables(dialog);
    if (!tabbables.length) return;
    const first = tabbables[0], last = tabbables[tabbables.length - 1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }
  function onKeydown(e){
    if (e.key === 'Escape'){ e.stopPropagation(); close(true); }
  }
  function onBackdropClick(e){
    if (e.target === backdrop){ close(true); }
  }
  function vibrate(ms=10){ try{ navigator.vibrate && navigator.vibrate(ms); }catch(_){} }

  function setLoading(on){
    if (on){ dialog.classList.add('bse-loading'); }
    else { dialog.classList.remove('bse-loading'); }
  }
  function setApplyEnabled(enabled){ btnApply.disabled = !enabled; }
  function updateTitle(t){ titleEl.textContent = t || ''; }
  function setContent(content){
    bodyEl.innerHTML = '';
    if (typeof content === 'string') bodyEl.innerHTML = content;
    else if (content instanceof HTMLElement) bodyEl.appendChild(content);
  }

  function wire(el, evt, fn, opts){ el.addEventListener(evt, fn, opts); removeFns.push(()=>el.removeEventListener(evt, fn, opts)); }

  function open(opts={}){
    ensureDOM();
    const {
      title = 'Edit',
      html = null,
      node = null,
      onApply = null,
      onCancel = null,
      initialFocus = null,
      primaryLabel = 'Apply',
      cancelLabel = 'Cancel'
    } = opts;

    updateTitle(title);
    setContent(node || html || '');
    setLoading(false);
    setApplyEnabled(true);
    btnApply.textContent = primaryLabel;
    btnCancel.textContent = cancelLabel;
    applyCb = typeof onApply === 'function' ? onApply : null;
    cancelCb = typeof onCancel === 'function' ? onCancel : null;

    // show
    backdrop.classList.add('show');
    dialog.classList.add('show');
    backdrop.style.display = 'block';
    modal.style.display = 'grid';
    isOpen = true;
    lockScroll();
    previousActive = document.activeElement;

    // cleanup old listeners
    removeFns.forEach(fn=>fn()); removeFns = [];

    // listeners
    wire(document, 'keydown', onKeydown, true);
    wire(dialog, 'keydown', focusTrap);
    wire(backdrop, 'click', onBackdropClick);
    // close buttons
    modal.querySelector('[data-close]')?.addEventListener('click', ()=> close(true), { once:true });
    wire(btnCancel, 'click', ()=> { vibrate(8); close(true); });
    wire(btnApply, 'click', ()=>{
      if (btnApply.disabled) return;
      vibrate(10);
      const maybe = applyCb && applyCb();
      if (maybe && typeof maybe.then === 'function'){
        setLoading(true); btnApply.disabled = true;
        maybe.finally(()=>{ setLoading(false); btnApply.disabled = false; close(false); });
      } else { close(false); }
    });

    // focus
    setTimeout(()=>{
      let el = initialFocus ? dialog.querySelector(initialFocus) : null;
      if (!el){
        const tabs = getTabbables(dialog);
        el = tabs[0] || dialog;
      }
      el && el.focus();
    }, 0);

    // controller
    return {
      close: () => close(false),
      setContent, setApplyEnabled, setLoading, updateTitle,
      el: dialog
    };
  }

  function close(byCancel){
    if (!isOpen) return;
    isOpen = false;

    try{
      if (byCancel && cancelCb) cancelCb();
      dialog.dispatchEvent(new CustomEvent('bse:closed', { detail: { cancelled: !!byCancel }}));
    }catch(_){}

    backdrop.classList.remove('show');
    dialog.classList.remove('show');

    const tidy = ()=>{
      backdrop.style.display = 'none';
      modal.style.display = 'none';
      unlockScroll();
      removeFns.forEach(fn=>fn()); removeFns = [];
      if (previousActive && typeof previousActive.focus === 'function') previousActive.focus();
    };
    const onEnd = ()=>{ dialog.removeEventListener('transitionend', onEnd); tidy(); };
    dialog.addEventListener('transitionend', onEnd);
    setTimeout(onEnd, 220);
  }

  // ---------- Built-in hoseline editor form helpers ----------
  // Default nozzles (adjust if your store provides these dynamically)
  const DEFAULT_NOZZLES = [
    { id:'fog175_185_50',  label:'Fog 185 @50',  gpm:185, np:50,  size:'1.75' },
    { id:'fog175_185_75',  label:'Fog 185 @75',  gpm:185, np:75,  size:'1.75' },
    { id:'sb25_265_50',    label:'SmoothBore 265 @50', gpm:265, np:50, size:'2.5' },
    { id:'fog25_250_75',   label:'Fog 250 @75',  gpm:250, np:75,  size:'2.5' }
  ];

  function makeEl(html){
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  // Build a form node for editing a line
  // line: { size, lengthFt, hasWye, elevFt, nozzle: { id,gpm,np,label } }
  function buildLineEditorForm(line={}){
    const sz = String(line.size || '1.75');
    const len = Number(line.lengthFt || 200);
    const elev = Number(line.elevFt || 0);
    const hasWye = !!line.hasWye;
    const noz = line.nozzle || inferDefaultNozzle(sz);

    const node = makeEl(`
      <form id="bseLineForm">
        <div class="row">
          <div class="col">
            <label>Diameter</label>
            <select name="size" id="bseSize">
              <option value="1.75">1¾″</option>
              <option value="2.5">2½″</option>
              <option value="5">5″ (supply)</option>
            </select>
          </div>
          <div class="col">
            <label>Length (ft)</label>
            <input type="number" inputmode="numeric" step="25" min="0" name="lengthFt" id="bseLen" value="${len}">
            <div class="chipRow" style="margin-top:6px">
              ${[150,200,250,300].map(v=>`<button type="button" class="chip" data-len="${v}">${v}′</button>`).join('')}
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <label>Elevation (ft)</label>
            <input type="number" inputmode="decimal" step="5" name="elevFt" id="bseElev" value="${elev}">
          </div>
          <div class="col">
            <label>Wye (split to two 1¾″?)</label>
            <select name="hasWye" id="bseWye">
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
            <div style="margin-top:6px; font-size:12px; color:#9fb0c8">
              If “Yes”, the main line will not have a nozzle; branch defaults: A <b>Fog 185 @50</b>, B <b>Fog 185 @50</b>.
            </div>
          </div>
        </div>

        <div id="bseNozGroup">
          <label>Nozzle</label>
          <select name="nozId" id="bseNozId"></select>
          <div class="row" style="margin-top:8px">
            <div class="col">
              <label>Nozzle Flow (GPM)</label>
              <input type="number" inputmode="decimal" step="5" name="nozGpm" id="bseNozGpm" value="${noz.gpm||185}">
            </div>
            <div class="col">
              <label>Nozzle Pressure (NP psi)</label>
              <input type="number" inputmode="decimal" step="5" name="nozNp" id="bseNozNp" value="${noz.np||50}">
            </div>
          </div>
        </div>
      </form>
    `);

    // wire selects
    const selSize = node.querySelector('#bseSize');
    const selWye  = node.querySelector('#bseWye');
    const selNoz  = node.querySelector('#bseNozId');
    const inpLen  = node.querySelector('#bseLen');
    const inpElev = node.querySelector('#bseElev');
    const inpGpm  = node.querySelector('#bseNozGpm');
    const inpNp   = node.querySelector('#bseNozNp');
    const nozGroup= node.querySelector('#bseNozGroup');

    // Fill nozzle list for current size
    function fillNozzles(forSize){
      selNoz.innerHTML = '';
      const items = DEFAULT_NOZZLES.filter(n => n.size === forSize);
      items.forEach(n=>{
        const o = document.createElement('option');
        o.value = n.id; o.textContent = n.label; selNoz.appendChild(o);
      });
      // pick default rule: 2.5 → 265@50, 1.75 → 185@50
      const def = inferDefaultNozzle(forSize);
      selNoz.value = def.id;
      inpGpm.value = def.gpm;
      inpNp.value  = def.np;
    }

    function inferDefaultNozzle(size){
      if (size === '2.5') return { id:'sb25_265_50', label:'SmoothBore 265 @50', gpm:265, np:50, size:'2.5' };
      return { id:'fog175_185_50', label:'Fog 185 @50', gpm:185, np:50, size:'1.75' };
    }

    // initial
    selSize.value = sz;
    selWye.value  = String(hasWye);
    fillNozzles(sz);
    // If a specific nozzle present in incoming line, select it
    if (line.nozzle && line.nozzle.id){
      const match = Array.from(selNoz.options).find(o => o.value === line.nozzle.id);
      if (match){ selNoz.value = match.value; }
      if (typeof line.nozzle.gpm === 'number') inpGpm.value = line.nozzle.gpm;
      if (typeof line.nozzle.np  === 'number') inpNp.value  = line.nozzle.np;
    }
    // Hide nozzle group when Wye is ON (main line has no nozzle)
    function updateNozzleVisibility(){
      const off = (selWye.value === 'true');
      nozGroup.style.display = off ? 'none' : 'block';
    }
    updateNozzleVisibility();

    // events
    selSize.addEventListener('change', ()=>{
      fillNozzles(selSize.value);
    });
    selWye.addEventListener('change', updateNozzleVisibility);
    node.querySelectorAll('.chip').forEach(chip=>{
      chip.addEventListener('click', (e)=>{
        e.preventDefault();
        const v = Number(chip.getAttribute('data-len'));
        inpLen.value = v;
        node.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
        chip.classList.add('active');
      });
    });
    selNoz.addEventListener('change', ()=>{
      const n = DEFAULT_NOZZLES.find(x=>x.id===selNoz.value);
      if (n){ inpGpm.value = n.gpm; inpNp.value = n.np; }
    });

    // expose reader on node for onApply
    node.readValues = () => {
      const size = selSize.value;
      const hasW = (selWye.value === 'true');
      const data = {
        size,
        lengthFt: Number(inpLen.value||0),
        elevFt: Number(inpElev.value||0),
        hasWye: hasW
      };
      if (!hasW){
        data.nozzle = {
          id: selNoz.value,
          gpm: Number(inpGpm.value||0),
          np:  Number(inpNp.value||0),
          label: selNoz.options[selNoz.selectedIndex]?.text || ''
        };
      } else {
        // main line nozzle removed; branch defaults handled by your calc code
        data.nozzle = null;
      }
      return data;
    };

    return node;
  }

  // expose
  window.BottomSheetEditor = {
    open, close: () => close(true),
    setContent, setApplyEnabled, setLoading, updateTitle,
    buildLineEditorForm,
    get isOpen(){ return isOpen; }
  };
})();
