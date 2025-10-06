// /js/bottom-sheet-editor.js
(function(){
  const html = `
    <div class="bs-backdrop" id="bsBackdrop" hidden></div>
    <div class="bs-sheet" id="bsEditor" role="dialog" aria-modal="true" aria-labelledby="bsTitle" hidden>
      <div class="bs-grab" aria-hidden="true"></div>
      <div class="bs-content">
        <h2 class="bs-title" id="bsTitle">Edit Line</h2>
        <div id="bsBody"></div>
        <div class="bs-actions">
          <button class="btn" id="bsCancel">Cancel</button>
          <button class="btn primary" id="bsApply">Apply</button>
        </div>
      </div>
    </div>
  `;
  const style = `
    .bs-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9998}
    .bs-sheet{
      position:fixed; left:0; right:0; bottom:0; z-index:9999;
      background:#0e151e; border-top:1px solid rgba(255,255,255,.12);
      border-radius:16px 16px 0 0; transform:translateY(100%);
      transition:transform .25s ease; max-height:80dvh; overflow:auto;
    }
    .bs-sheet.show{ transform:translateY(0); }
    .bs-grab{ width:42px; height:4px; border-radius:999px; background:#2b3b55; margin:8px auto 6px; }
    .bs-content{ padding:8px 12px 12px; }
    .bs-title{ margin:0 0 8px; font-size:16px; }
    .bs-actions{ display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
    @media (prefers-reduced-motion: reduce) { .bs-sheet { transition:none; } }
  `;

  function ensureDom(){
    if (document.getElementById('bsEditor')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<style>${style}</style>${html}`;
    document.body.appendChild(wrap);
  }

  let onApply = null, startY = null, lastY = null, swiping = false;

  function open({ title='Edit Line', bodyNode, onapply }){
    ensureDom();
    const sheet = document.getElementById('bsEditor');
    const backdrop = document.getElementById('bsBackdrop');
    const titleEl = sheet.querySelector('#bsTitle');
    const body = sheet.querySelector('#bsBody');
    const btnApply = sheet.querySelector('#bsApply');
    const btnCancel = sheet.querySelector('#bsCancel');

    titleEl.textContent = title;
    body.innerHTML = '';
    if (bodyNode) body.appendChild(bodyNode);
    onApply = typeof onapply === 'function' ? onapply : null;

    backdrop.hidden = false;
    sheet.hidden = false;
    requestAnimationFrame(()=> sheet.classList.add('show'));

    const close = () => {
      sheet.classList.remove('show');
      setTimeout(()=>{ sheet.hidden = true; backdrop.hidden = true; }, 250);
    };

    backdrop.onclick = close;
    btnCancel.onclick = close;
    btnApply.onclick = () => { if (onApply) onApply(); close(); };

    // Swipe down to close
    sheet.addEventListener('touchstart', (e)=>{
      startY = e.touches[0].clientY; lastY = startY; swiping = true;
    }, { passive: true });
    sheet.addEventListener('touchmove', (e)=>{
      if (!swiping) return;
      lastY = e.touches[0].clientY;
      const dy = lastY - startY;
      if (dy > 80) { swiping = false; close(); }
    }, { passive: true });
    sheet.addEventListener('touchend', ()=>{ swiping = false; startY = lastY = null; });

    // Escape to close
    const onKey = (e)=>{ if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey, { once:true });
  }

  window.BottomSheetEditor = { open, close: ()=>document.getElementById('bsBackdrop')?.click() };
})();
