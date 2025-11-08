
/* segmented-branch-patch.js
   Drop-in enhancer for view.calc.js popup editor.

   What it does:
   - Shows "Main / Line A / Line B" buttons only when Wye is ON and size is 2.5"
   - Only one branch section is visible at a time (A or B)
   - Defaults branch nozzle to Fog 185 @ 50 if empty
   - Locks branch diameter to 1.75 while editing A or B
   - Hides Wye controls if the main diameter is not 2.5"

   How to use:
   1) Include this file AFTER view.calc.js
      <script src="js/view.calc.js"></script>
      <script src="js/segmented-branch-patch.js"></script>

   2) No changes to your code required. The patch hooks into the popup editor each time it opens.
*/

(function(){
  // Minimal styles
  try {
    var st = document.createElement('style');
    st.textContent = [
      '#branchBlock{display:none}',
      '.segSwitch{display:flex;gap:6px;margin:6px 0 4px}',
      '.segBtn{padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.2)}',
      '.segBtn.active{background:rgba(59,130,246,.25);border-color:rgba(59,130,246,.6)}'
    ].join('\\n');
    document.head.appendChild(st);
  } catch (_) {}

  // Utility: find a Fog 185 @ 50 nozzle id if possible
  function getFog185Id() {
    try {
      if (typeof findNozzleId === 'function') {
        var id = findNozzleId({ gpm:185, NP:50, preferFog:true });
        if (id) return id;
      }
    } catch (_) {}
    try {
      if (Array.isArray(window.NOZ_LIST)) {
        var m = window.NOZ_LIST.find(function(n){
          var g = Number(n && n.gpm);
          var p = Number(n && n.NP);
          var label = String((n && (n.name || n.label)) || '');
          return (g===185 && p===50) || /185\s*@\s*50/i.test(label);
        });
        if (m) return m.id || m.name || m.label || null;
      }
    } catch (_) {}
    return null;
  }

  // Patch hook: rely on an event that view.calc.js can dispatch when opening the editor,
  // or poll for the tip editor container shortly after clicks.
  // We will monkey-patch the global function that view.calc.js uses to open the editor if available.
  var installOnce = false;

  function enhanceTipEditor(container, where) {
    var tip = container && container.querySelector && container.querySelector('#tipEditor');
    if (!tip || tip.__segPatchBound) return;
    tip.__segPatchBound = true;

    var segWrap = tip.querySelector('#segSwitch'); // if you already render the buttons
    var actions = tip.querySelector('.te-actions') || tip.lastElementChild;

    // If buttons are not present yet, create them
    if (!segWrap) {
      segWrap = document.createElement('div');
      segWrap.id = 'segSwitch';
      segWrap.className = 'segSwitch';
      tip.insertBefore(segWrap, actions);

      var makeBtn = function(label, seg) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'segBtn';
        b.dataset.seg = seg;
        b.textContent = label;
        return b;
      };
      segWrap.appendChild(makeBtn('Main', 'main'));
      segWrap.appendChild(makeBtn('Line A', 'A'));
      segWrap.appendChild(makeBtn('Line B', 'B'));
    }

    var btns = Array.prototype.slice.call(segWrap.querySelectorAll('.segBtn'));
    var block = tip.querySelector('#branchBlock');
    var aSect = tip.querySelector('#branchASection') || (block ? block.querySelectorAll('.card')[0] : null);
    var bSect = tip.querySelector('#branchBSection') || (block ? block.querySelectorAll('.card')[1] : null);

    if (aSect && !aSect.id) aSect.id = 'branchASection';
    if (bSect && !bSect.id) bSect.id = 'branchBSection';

    var sizeMinus = tip.querySelector('#sizeMinus');
    var sizePlus  = tip.querySelector('#sizePlus');
    var sizeHidden = tip.querySelector('#teSize');
    var wyeSel  = tip.querySelector('#teWye');
    var wyeRow  = wyeSel ? wyeSel.closest('.te-row') : null;

    var rowSize = tip.querySelector('#rowSize');
    var rowLen  = tip.querySelector('#rowLen');
    var rowElev = tip.querySelector('#rowElev');
    var rowNoz  = tip.querySelector('#rowNoz');

    function gateWyeBySize() {
      var ok = !!(sizeHidden && String(sizeHidden.value) === '2.5');
      if (!ok) {
        if (wyeSel) wyeSel.value = 'off';
        segWrap.style.display = 'none';
        if (block) block.style.display = 'none';
      }
      if (wyeRow) wyeRow.style.display = ok ? '' : 'none';
      return ok;
    }

    function setSeg(seg) {
      // highlight
      btns.forEach(function(b){ b.classList.toggle('active', b.dataset.seg === seg); });

      var mainShow = (seg === 'main');
      if (wyeRow) wyeRow.style.display = mainShow ? '' : 'none';
      if (rowSize) rowSize.style.display = mainShow ? '' : 'none';
      if (rowLen)  rowLen.style.display  = mainShow ? '' : 'none';
      if (rowElev) rowElev.style.display = mainShow ? '' : 'none';
      if (rowNoz)  rowNoz.style.display  = mainShow ? '' : 'none';

      if (block) block.style.display = (seg === 'A' || seg === 'B') ? '' : 'none';
      if (aSect) aSect.style.display = (seg === 'A') ? '' : 'none';
      if (bSect) bSect.style.display = (seg === 'B') ? '' : 'none';

      // lock branch size to 1.75
      var sizeLabel = tip.querySelector('#sizeLabel');
      if (!mainShow) {
        if (sizeHidden) sizeHidden.value = '1.75';
        if (sizeLabel) sizeLabel.textContent = '1 3/4"';
        if (sizeMinus) sizeMinus.disabled = true;
        if (sizePlus)  sizePlus.disabled  = true;
      } else {
        if (sizeMinus) sizeMinus.disabled = false;
        if (sizePlus)  sizePlus.disabled  = false;
      }

      // branch nozzles
      var selA = tip.querySelector('#teNozA');
      var selB = tip.querySelector('#teNozB');
      var fog  = getFog185Id();
      if (seg === 'A') {
        if (selA) {
          if (!selA.value && fog) selA.value = fog;
          selA.disabled = false;
        }
        if (selB) selB.disabled = true;
      } else if (seg === 'B') {
        if (selB) {
          if (!selB.value && fog) selB.value = fog;
          selB.disabled = false;
        }
        if (selA) selA.disabled = true;
      } else {
        if (selA) selA.disabled = true;
        if (selB) selB.disabled = true;
      }

      // where label
      try {
        var whereInput = tip.querySelector('#teWhere');
        if (whereInput) {
          whereInput.value = (seg === 'main') ? 'Main (to Wye)' : (seg === 'A' ? 'Line A (left of wye)' : 'Line B (right of wye)');
        }
      } catch (_) {}
    }

    function updateButtons() {
      var sizeOk = gateWyeBySize();
      var on = !!(wyeSel && wyeSel.value === 'on' && sizeOk);
      segWrap.style.display = on ? 'flex' : 'none';
      if (!on) setSeg('main');
    }

    // Bind
    btns.forEach(function(btn){
      btn.addEventListener('click', function(){ setSeg(btn.dataset.seg); });
    });
    if (wyeSel) wyeSel.addEventListener('change', updateButtons);
    if (sizeMinus) sizeMinus.addEventListener('click', function(){ setTimeout(updateButtons, 0); });
    if (sizePlus)  sizePlus .addEventListener('click', function(){ setTimeout(updateButtons, 0); });

    // Init
    updateButtons();
    if (where === 'L') setSeg('A');
    else if (where === 'R') setSeg('B');
    else setSeg('main');
  }

  // Attempt to hook into the editor opening by wrapping a known function if present
  // If your app uses a different function name, adjust below.
  var wrapped = false;
  function wrapOpen() {
    if (wrapped) return;
    wrapped = true;
    try {
      var originalOpen = window.openTipEditor; // adjust if your function has another name
      if (typeof originalOpen === 'function') {
        window.openTipEditor = function(key, where, container){
          var result = originalOpen.apply(this, arguments);
          try { enhanceTipEditor(container || document, where); } catch(_){}
          return result;
        };
        installOnce = true;
      }
    } catch(_) {}
  }

  // Fallback: observe DOM for the editor appearing, then enhance once per open
  var mo = new MutationObserver(function(muts){
    muts.forEach(function(m){
      for (var i=0;i<m.addedNodes.length;i++){
        var n = m.addedNodes[i];
        if (n && n.nodeType === 1 && n.querySelector && n.querySelector('#tipEditor')){
          try { enhanceTipEditor(document, null); } catch(_) {}
        }
      }
    });
  });
  try { mo.observe(document.body, { childList:true, subtree:true }); } catch(_){}

  // Try wrap immediately
  wrapOpen();
})();
