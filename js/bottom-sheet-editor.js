// bottom-sheet-editor.js
// Phone-friendly bottom sheet for your existing line editor ("+"), without changing your math/geometry.
// - Reuses your current #tipEditor markup and Apply/Cancel logic
// - Adds a dimmed backdrop and Esc/backdrop-to-close
// - Opens as a bottom sheet on phones, centered dialog on larger screens

(function(){
  // Find a reasonable root
  const root = document.querySelector('[data-calc-root]') || document.body;

  // Required elements
  const tipEditor   = root.querySelector('#tipEditor');
  const teCancel    = root.querySelector('#teCancel');
  const teApply     = root.querySelector('#teApply');
  const teWye       = root.querySelector('#teWye');
  const branchBlock = root.querySelector('#branchBlock');

  if(!tipEditor){
    console.warn('[bottom-sheet-editor] #tipEditor not found — nothing to do.');
    return;
  }

  // Ensure backdrop exists once
  let tipBackdrop = root.querySelector('#tipBackdrop');
  if(!tipBackdrop){
    tipBackdrop = document.createElement('div');
    tipBackdrop.id = 'tipBackdrop';
    tipBackdrop.className = 'sheet-backdrop';
    root.appendChild(tipBackdrop);
  }

  // Ensure the editor sits at top level so it’s not clipped by the SVG/stage
  if(tipEditor.parentElement !== root){
    root.appendChild(tipEditor);
  }

  // Open/Close helpers
  function openTipEditor(){
    tipEditor.classList.remove('is-hidden');
    tipBackdrop.style.display = 'block';
    requestAnimationFrame(()=>{
      tipEditor.classList.add('is-open');
      const first = tipEditor.querySelector('input, select, button');
      if(first) first.focus();
    });
  }
  function closeTipEditor(){
    tipEditor.classList.remove('is-open');
    setTimeout(()=>{
      tipEditor.classList.add('is-hidden');
      tipBackdrop.style.display = 'none';
    }, 200);
  }

  // Wire close UX
  tipBackdrop.addEventListener('click', closeTipEditor);
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && !tipEditor.classList.contains('is-hidden')) closeTipEditor();
  });
  if(teCancel) teCancel.addEventListener('click', closeTipEditor);

  // Respect any existing Apply logic, then close
  if(teApply){
    // If your Apply was set via onclick= or addEventListener elsewhere, we don’t override it.
    teApply.addEventListener('click', ()=>{
      // Your original listeners still run; we just close afterward
      closeTipEditor();
    });
  }

  // Toggle branch section when Wye changes (if present)
  if(teWye && branchBlock){
    teWye.addEventListener('change', ()=>{
      branchBlock.classList.toggle('is-hidden', teWye.value !== 'on');
    });
  }

  // Intercept clicks on the existing '+' hit areas and open as a modal
  document.addEventListener('click', (e)=>{
    const tip = e.target.closest('.hose-end');
    if(!tip) return;

    // Your current click handler (from the main file) populates #tipEditor fields.
    // We switch from “position/visibility” to modal opening:
    openTipEditor();
  });

  // Expose helpers if you want to open/close programmatically
  window.BottomSheetEditor = { open: openTipEditor, close: closeTipEditor };
})();
