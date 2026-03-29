// UI enhancement helpers extracted from the original view.calc.js
// Goal: make the + menu behave the same on web and Android by supporting
// BOTH editor roots:
//   1) #teSheet   (bottom-sheet editor path)
//   2) #tipEditor (inline editor path inside view.calc.js)
//
// Full replacement for js/view.calc.enhance.js

(() => {
  try {
    const old = document.getElementById('fireops-segplus-style');
    if (old) old.remove();

    const style = document.createElement('style');
    style.id = 'fireops-segplus-style';
    style.textContent = `
      .segSwitch {
        display: none !important;
        visibility: hidden !important;
      }

      [data-calc-root] .kpis .whyBtn,
      .kpis .whyBtn {
        background: rgba(15, 23, 42, 0.95);
        color: #eaf2ff;
        border: 1px solid rgba(255, 255, 255, 0.45);
        font-weight: 600;
        letter-spacing: 0.01em;
      }

      [data-calc-root] .supplybtn,
      .supplybtn {
        background: #111827;
        color: #eaf2ff;
        border: 1px solid rgba(148, 163, 184, 0.7);
      }

      @media (hover: hover) and (pointer: fine) {
        [data-calc-root] .supplybtn:hover,
        .supplybtn:hover,
        [data-calc-root] .whyBtn:hover,
        .whyBtn:hover {
          background: #1f2937;
          box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.8);
        }
      }

      .segPlus {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin: 10px 0 8px;
      }

      .segPlusBtn {
        appearance: none;
        border: 1px solid rgba(148, 163, 184, 0.55);
        background: #0b1420;
        color: #eaf2ff;
        border-radius: 999px;
        padding: 8px 12px;
        min-height: 40px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
      }

      .segPlusBtn.active {
        background: radial-gradient(circle at 10% 0%, #1e82ff, #1b3a72);
        border-color: #58b4ff;
        color: #f4f8ff;
        box-shadow: 0 0 0 1px rgba(70,176,255,.25), 0 8px 20px rgba(0,0,0,.35);
      }

      .segPlusIcon {
        font-weight: 900;
        font-size: 16px;
        line-height: 1;
      }

      .segPlusText {
        font-weight: 700;
        line-height: 1;
      }

      .is-hidden {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  } catch (_) {}
})();

;(function () {
  const ROOT_IDS = ['teSheet', 'tipEditor'];

  function hide(el) {
    if (!el) return;
    el.hidden = true;
    try { el.inert = true; } catch (_) {}
    el.style.display = 'none';
    el.classList.add('is-hidden');
  }

  function show(el, displayValue = '') {
    if (!el) return;
    el.hidden = false;
    try { el.inert = false; } catch (_) {}
    el.style.display = displayValue;
    el.classList.remove('is-hidden');
  }

  function setSelectValue(selectEl, value) {
    if (!selectEl) return;
    const wanted = String(value);
    const opt = Array.from(selectEl.options || []).find(o => String(o.value) === wanted);
    if (opt) {
      selectEl.value = wanted;
      try {
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {}
    }
  }

  function findActionsRoot(root) {
    return root.querySelector('.te-actions') || root.lastElementChild || root.firstElementChild;
  }

  function removePriorToolbar(root) {
    root.querySelectorAll('#segPlus').forEach(n => n.remove());
  }

  function ensureWhereValue(root, seg) {
    const teWhere = root.querySelector('#teWhere');
    if (!teWhere) return;

    if (seg === 'main') {
      teWhere.value = 'Main (to Wye)';
    } else if (seg === 'A') {
      teWhere.value = 'Line A (left of wye)';
    } else {
      teWhere.value = 'Line B (right of wye)';
    }
  }

  function lockBranchSize(root, onBranch) {
    const teSize = root.querySelector('#teSize');
    const sizeMinus = root.querySelector('#sizeMinus');
    const sizePlus = root.querySelector('#sizePlus');
    const sizeLabel = root.querySelector('#sizeLabel');

    if (onBranch) {
      setSelectValue(teSize, '1.75');
      if (sizeLabel) sizeLabel.textContent = '1 3/4″';
      if (sizeMinus) sizeMinus.disabled = true;
      if (sizePlus) sizePlus.disabled = true;
    } else {
      if (sizeMinus) sizeMinus.disabled = false;
      if (sizePlus) sizePlus.disabled = false;
    }
  }

  function pickSingleBranchRows(branchBlock, branch) {
    if (!branchBlock) return;

    const teLenA = branchBlock.querySelector('#teLenA');
    const teNozA = branchBlock.querySelector('#teNozA');
    const teLenB = branchBlock.querySelector('#teLenB');
    const teNozB = branchBlock.querySelector('#teNozB');

    const rowLenA = teLenA ? teLenA.closest('.te-row') : null;
    const rowNozA = teNozA ? teNozA.closest('.te-row') : null;
    const rowLenB = teLenB ? teLenB.closest('.te-row') : null;
    const rowNozB = teNozB ? teNozB.closest('.te-row') : null;

    if (branch === 'A') {
      show(rowLenA);
      show(rowNozA);
      hide(rowLenB);
      hide(rowNozB);
    } else if (branch === 'B') {
      hide(rowLenA);
      hide(rowNozA);
      show(rowLenB);
      show(rowNozB);
    } else {
      hide(rowLenA);
      hide(rowNozA);
      hide(rowLenB);
      hide(rowNozB);
    }
  }

  function apply(root) {
    try {
      if (!root) return;

      const contentRoot = root.querySelector('.te-content') || root;

      const segSwitch = contentRoot.querySelector('#segSwitch');
      if (segSwitch) hide(segSwitch);

      const branchBlock = contentRoot.querySelector('#branchBlock');
      const aSect = contentRoot.querySelector('#branchASection');
      const bSect = contentRoot.querySelector('#branchBSection');
      const teWye = contentRoot.querySelector('#teWye');
      const teSize = contentRoot.querySelector('#teSize');

      const wyeRow = teWye ? teWye.closest('.te-row') : null;
      const mainRows = ['#rowSize', '#rowLen', '#rowElev', '#rowNoz']
        .map(sel => contentRoot.querySelector(sel))
        .filter(Boolean);

      removePriorToolbar(contentRoot);

      const plusBar = document.createElement('div');
      plusBar.id = 'segPlus';
      plusBar.className = 'segPlus';
      plusBar.style.display = 'none';

      function mk(label, seg) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'segPlusBtn';

        const i = document.createElement('span');
        i.className = 'segPlusIcon';
        i.textContent = '+';

        const t = document.createElement('span');
        t.className = 'segPlusText';
        t.textContent = label;

        b.append(i, t);
        b.dataset.seg = seg;
        return b;
      }

      const pMain = mk('Main', 'main');
      const pLeft = mk('Line A', 'A');
      const pRight = mk('Line B', 'B');

      plusBar.append(pMain, pLeft, pRight);

      const actions = findActionsRoot(contentRoot);
      if (actions && actions.parentNode) {
        actions.parentNode.insertBefore(plusBar, actions);
      } else {
        contentRoot.appendChild(plusBar);
      }

      function select(seg) {
        plusBar.querySelectorAll('.segPlusBtn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.seg === seg);
        });

        const onMain = seg === 'main';

        if (wyeRow) {
          if (onMain) show(wyeRow);
          else hide(wyeRow);
        }

        mainRows.forEach(el => {
          if (onMain) show(el);
          else hide(el);
        });

        if (branchBlock) {
          if (onMain) hide(branchBlock);
          else show(branchBlock);
        }

        if (aSect || bSect) {
          if (seg === 'A') {
            show(aSect);
            hide(bSect);
          } else if (seg === 'B') {
            hide(aSect);
            show(bSect);
          } else {
            hide(aSect);
            hide(bSect);
          }
        } else {
          pickSingleBranchRows(branchBlock, seg);
        }

        lockBranchSize(contentRoot, !onMain);
        ensureWhereValue(contentRoot, seg);
      }

      function gateWyeOK() {
        return !!(teWye && teWye.value === 'on' && teSize && String(teSize.value) === '2.5');
      }

      function sync() {
        const ok = gateWyeOK();

        if (ok) {
          plusBar.style.display = 'flex';
          const anyActive = plusBar.querySelector('.segPlusBtn.active');
          if (!anyActive) select('main');
        } else {
          plusBar.style.display = 'none';
          select('main');
        }
      }

      pMain.addEventListener('click', () => select('main'));
      pLeft.addEventListener('click', () => select('A'));
      pRight.addEventListener('click', () => select('B'));

      if (teWye) teWye.addEventListener('change', sync);
      if (teSize) teSize.addEventListener('change', sync);

      sync();
    } catch (e) {
      console.warn('PLUS MENUS apply error', e);
    }
  }

  function tryApplyToExistingRoots() {
    ROOT_IDS.forEach(id => {
      const root = document.getElementById(id);
      if (root) apply(root);
    });
  }

  tryApplyToExistingRoots();

  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (!n || n.nodeType !== 1) continue;

        if (ROOT_IDS.includes(n.id)) {
          apply(n);
          continue;
        }

        ROOT_IDS.forEach(id => {
          const nested = n.querySelector ? n.querySelector('#' + id) : null;
          if (nested) apply(nested);
        });
      }
    }
  });

  obs.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });
})();
