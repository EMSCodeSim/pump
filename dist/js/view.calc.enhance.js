// UI enhancement helpers extracted from the original view.calc.js
// 1) CSS injection for segSwitch / Why / Tender buttons
// 2) PLUS MENUS auto wiring for the Tip Editor (teSheet)

// Inject CSS to hide Main / Line A / Line B segment buttons in the editor (UI only)
(() => {
  try {
    const style = document.createElement('style');
    style.textContent = `
      .segSwitch {
        display: none !important;
        visibility: hidden !important;
      }

      /* Improve contrast/legibility of the PDP "Why?" chip on desktop */
      [data-calc-root] .kpis .whyBtn,
      .kpis .whyBtn {
        background: rgba(15, 23, 42, 0.95);
        color: #eaf2ff;
        border: 1px solid rgba(255, 255, 255, 0.45);
        font-weight: 600;
        letter-spacing: 0.01em;
      }

      /* Improve visibility of Hydrant / Tender mode buttons on larger screens */
      [data-calc-root] .supplybtn,
      .supplybtn {
        background: #111827;
        color: #eaf2ff;
        border: 1px solid rgba(148, 163, 184, 0.7);
      }

      /* Optional hover/focus styling for desktop mice */
      @media (hover: hover) and (pointer: fine) {
        [data-calc-root] .supplybtn:hover,
        .supplybtn:hover,
        [data-calc-root] .whyBtn:hover,
        .whyBtn:hover {
          background: #1f2937;
          box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.8);
        }
      }
    `;
    document.head.appendChild(style);
  } catch (_) {}
})();

;(function(){
  const SHEET_ID = 'teSheet';

  function hide(el){ if(!el) return; el.hidden = true; el.inert = true; el.style.display='none'; el.classList.add('is-hidden'); }
  function show(el){ if(!el) return; el.hidden = false; el.inert = false; el.style.display='';     el.classList.remove('is-hidden'); }

  function apply(sheet){
    try{
      const root = sheet.querySelector('.te-content') || sheet;
      // Hide existing segSwitch if present
      const segSwitch = root.querySelector('#segSwitch');
      if (segSwitch) segSwitch.style.display = 'none';

      const branchBlock = root.querySelector('#branchBlock');
      const aSect = root.querySelector('#branchASection');
      const bSect = root.querySelector('#branchBSection');
      const teWye = root.querySelector('#teWye');
      const teSize = root.querySelector('#teSize');
      const sizeMinus = root.querySelector('#sizeMinus');
      const sizePlus  = root.querySelector('#sizePlus');
      const teWhere   = root.querySelector('#teWhere');
      const wyeRow    = teWye ? teWye.closest('.te-row') : null;
      const mainRows  = ['#rowSize','#rowLen','#rowElev','#rowNoz'].map(sel=>root.querySelector(sel)).filter(Boolean);

      // Remove any prior toolbar
      root.querySelectorAll('#segPlus').forEach(n=>n.remove());

      // Build + toolbar
      const plusBar = document.createElement('div');
      plusBar.id = 'segPlus';
      plusBar.className = 'segPlus';
      plusBar.style.display = 'none'; // gated by Wye + size
      function mk(label, seg){
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'segPlusBtn';
        const i = document.createElement('span'); i.className='segPlusIcon'; i.textContent = '+';
        const t = document.createElement('span'); t.className='segPlusText'; t.textContent = label;
        b.append(i,t);
        b.dataset.seg = seg;
        return b;
      }
      const pMain  = mk('Main','main');
      const pLeft  = mk('Left','A');
      const pRight = mk('Right','B');
      plusBar.append(pMain,pLeft,pRight);

      const actions = root.querySelector('.te-actions') || root.firstElementChild;
      root.insertBefore(plusBar, actions);

      function select(seg){
        plusBar.querySelectorAll('.segPlusBtn').forEach(btn => btn.classList.toggle('active', btn.dataset.seg===seg));
        const onMain = (seg==='main');
        if (wyeRow) (onMain? show : hide)(wyeRow);
        mainRows.forEach(el => (onMain? show(el) : hide(el)));
        if (branchBlock) (onMain? hide : show)(branchBlock);
        if (aSect) (seg==='A' ? show : hide)(aSect);
        if (bSect) (seg==='B' ? show : hide)(bSect);

        // Lock branch size to 1 3/4 on branches
        if (!onMain){
          if (teSize) teSize.value = '1.75';
          const sizeLabel = root.querySelector('#sizeLabel');
          if (sizeLabel) sizeLabel.textContent = '1 3/4″';
          if (sizeMinus) sizeMinus.disabled = true;
          if (sizePlus)  sizePlus.disabled  = true;
        } else {
          if (sizeMinus) sizeMinus.disabled = false;
          if (sizePlus)  sizePlus.disabled  = false;
        }

        if (teWhere){
          teWhere.value = seg==='main' ? 'Main (to Wye)' :
                          seg==='A'    ? 'Line A (left of wye)' :
                                          'Line B (right of wye)';
        }
      }

      function gateWyeOK(){
        return teWye && teWye.value==='on' && teSize && String(teSize.value)==='2.5';
      }

      function sync(){
        const ok = gateWyeOK();
        plusBar.style.display = ok ? 'flex' : 'none';
        if (!ok){
          select('main');
        } else {
          const anyActive = plusBar.querySelector('.segPlusBtn.active');
          if (!anyActive) select('main');
        }
      }

      // Wire
      pMain.addEventListener('click', ()=> select('main'));
      pLeft.addEventListener('click', ()=> select('A'));
      pRight.addEventListener('click', ()=> select('B'));
      teWye?.addEventListener('change', sync);
      teSize?.addEventListener('change', sync);

      // Initial
      sync();
    }catch(e){
      console.warn('PLUS MENUS apply error', e);
    }
  }

  // If already open
  const sheet = document.getElementById(SHEET_ID);
  if (sheet) apply(sheet);

  // Watch for future openings
  const obs = new MutationObserver(muts=>{
    for (const m of muts){
      for (const n of m.addedNodes){
        if (n.nodeType===1 && n.id===SHEET_ID) apply(n);
      }
    }
  });
  obs.observe(document.documentElement || document.body, { childList:true, subtree:true });
})();
