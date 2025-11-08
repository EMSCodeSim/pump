// /js/view.calc.js  (refactored entry with visible shell + render alias)

import { injectCalcStyles } from './calc/styles.css.js';
import { on, emit } from './calc/events.js';
import { qs, el } from './calc/dom.js';
import renderStage from './calc/renderStage.js';

// If you still need these exports available globally, index.html already assigns them to window:
// import { state, NOZ, COLORS } from './store.js';
// import { WaterSupplyUI } from './waterSupply.js';

/** Initialize the calc view inside a container */
export function initCalcView(container) {
  if (!container) throw new Error('initCalcView: container is required');

  // 1) Styles (once)
  injectCalcStyles(container);

  // 2) Visible shell so the screen isn’t blank
  container.innerHTML = '';
  const header = el('div', {
    class: 'calc-header',
    style: {
      padding: '12px 16px',
      borderBottom: '1px solid rgba(255,255,255,.12)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }
  }, [
    el('div', { style: { fontWeight: 600 } }, 'FireOps Calc'),
    el('div', { style: { opacity: .7, fontSize: '0.9rem' } }, 'refactor scaffold')
  ]);

  // Optional demo button to prove events are wired
  const demoBtn = el('button', {
    class: 'segBtn',
    style: { marginLeft: 'auto' }
  }, 'Open Tip Editor (demo)');
  demoBtn.addEventListener('click', () => {
    // Your code that actually creates #tipEditor should run before this emit.
    // This just broadcasts the “editor opened” event so segment logic can attach.
    emit('tipEditorOpened', { container, where: 'main' });
  });
  header.appendChild(demoBtn);

  const stageHost = el('div', { id: 'stageHost', style: { padding: '12px 16px' } });
  container.appendChild(header);
  container.appendChild(stageHost);

  // 3) Minimal stage so you see something on screen
  renderStage(stageHost);

  // 4) Legacy bridge for non-event flows (call from your existing editor open code)
  window.__announceTipEditorOpen = function (where = 'main', ctn = container) {
    emit('tipEditorOpened', { container: ctn, where });
  };

  // 5) Example: react to editor enhanced (if you want to refresh the stage after edits)
  on('editorEnhanced', () => {
    // re-render / update any live numbers if needed
    // (stage exposes rerender via its return value if you wire that up later)
  });
}

/** Back-compat: many callers do mod.render(container) */
export function render(container) {
  return initCalcView(container);
}

/** Default export for legacy imports */
export default render;
