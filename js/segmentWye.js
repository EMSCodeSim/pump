// calc/segmentWye.js
// Handles all logic for the segmented Wye UI:
// - Main / Line A / Line B segment switching
// - Showing/hiding branch panels
// - Enforcing Wye only on 2.5"
// - Locking branch size to 1.75"
// - Defaulting branch nozzles to Fog 185@50

import { show, hide, qs, qsa } from './dom.js';
import { canUseWye, shouldShowSegmentSwitch, forcedBranchDiameter,
         isMain, isBranchA, isBranchB } from './validators.js';
import { findFog185Id, enableNozzle, ensureDefaultFog185 } from './nozzleOptions.js';

/**
 * Attach segmented Wye behavior to the editor container.
 * Called once each time `#tipEditor` is opened.
 */
export function attachSegmentWyeUI(container, { NOZ_LIST, findNozzleId }) {
  const tip = qs(container, '#tipEditor');
  if (!tip || tip.__segWyeBound) return;
  tip.__segWyeBound = true;

  const segWrap = qs(tip, '#segSwitch');
  const buttons = qsa(segWrap, '.segBtn') || [];

  const block = qs(tip, '#branchBlock');
  const aCard = qs(tip, '#branchASection');
  const bCard = qs(tip, '#branchBSection');

  const sizeHidden = qs(tip, '#teSize');
  const sizeMinus  = qs(tip, '#sizeMinus');
  const sizePlus   = qs(tip, '#sizePlus');
  const wyeSel     = qs(tip, '#teWye');
  const wyeRow     = wyeSel ? wyeSel.closest('.te-row') : null;

  const selA = qs(tip, '#teNozA');
  const selB = qs(tip, '#teNozB');

  const fogId = findFog185Id({ NOZ_LIST, findNozzleId });

  /** Ensure Wye is allowed only if main size = 2.5 */
  function gateWye() {
    const ok = canUseWye(sizeHidden.value);
    if (!ok) {
      wyeSel.value = 'off';
      hide(segWrap);
      hide(block);
    }
    if (wyeRow) wyeRow.style.display = ok ? '' : 'none';
    return ok;
  }

  /** Update visibility of segment buttons + branch sections */
  function setSegment(seg) {
    // highlight
    buttons.forEach(b => b.classList.toggle('active', b.dataset.seg === seg));

    // main rows
    const showMain = isMain(seg);
    ['#rowSize', '#rowLen', '#rowElev', '#rowNoz'].forEach(id => {
      const r = qs(tip, id);
      if (r) r.style.display = showMain ? '' : 'none';
    });

    // branch panels
    if (isBranchA(seg)) {
      show(block);
      if (aCard) show(aCard);
      if (bCard) hide(bCard);

      // lock size
      sizeHidden.value = forcedBranchDiameter();
      if (sizeMinus) sizeMinus.disabled = true;
      if (sizePlus)  sizePlus.disabled = true;

      // enable A only
      enableNozzle(selA, true);
      enableNozzle(selB, false);
      ensureDefaultFog185(selA, fogId);
    }
    else if (isBranchB(seg)) {
      show(block);
      if (bCard) show(bCard);
      if (aCard) hide(aCard);

      sizeHidden.value = forcedBranchDiameter();
      if (sizeMinus) sizeMinus.disabled = true;
      if (sizePlus)  sizePlus.disabled = true;

      enableNozzle(selA, false);
      enableNozzle(selB, true);
      ensureDefaultFog185(selB, fogId);
    }
    else {
      // Main
      hide(block);
      if (aCard) hide(aCard);
      if (bCard) hide(bCard);

      if (sizeMinus) sizeMinus.disabled = false;
      if (sizePlus)  sizePlus.disabled = false;

      enableNozzle(selA, false);
      enableNozzle(selB, false);
    }

    // update #teWhere label
    const whereInput = qs(tip, '#teWhere');
    if (whereInput) {
      whereInput.value =
        isMain(seg) ? 'Main (to Wye)' :
        isBranchA(seg) ? 'Line A (left of wye)' :
        'Line B (right of wye)';
    }
  }

  /** Show or hide segment switch entirely */
  function refreshButtons() {
    const ok = shouldShowSegmentSwitch({ wye: wyeSel.value, size: sizeHidden.value });
    segWrap.style.display = ok ? 'flex' : 'none';
    if (!ok) setSegment('main');
  }

  // hook events
  buttons.forEach(btn =>
    btn.addEventListener('click', () => setSegment(btn.dataset.seg))
  );
  wyeSel.addEventListener('change', refreshButtons);
  sizeMinus?.addEventListener('click', () => setTimeout(refreshButtons, 0));
  sizePlus ?.addEventListener('click', () => setTimeout(refreshButtons, 0));

  // initial
  gateWye();
  refreshButtons();
  setSegment('main');
}
