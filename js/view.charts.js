// view.calc.js (refactored entrypoint with render alias)
// Purpose: orchestrates the calculator view and popup editor by composing smaller modules.

import { state, NOZ, COLORS } from './store.js';
import { WaterSupplyUI } from './waterSupply.js';

// Internal modules for the calc view
import { enhanceTipEditor } from './calc/editorUI.js';
import { on, emit } from './calc/events.js';
import { injectCalcStyles } from './calc/styles.css.js';

/** Initialize the calc view inside a container */
export function initCalcView(container) {
  if (!container) throw new Error('initCalcView: container is required');

  // Inject styles once for the whole calculator view
  injectCalcStyles(container);

  // Hook: whenever the tip editor opens, enhance it with segmented Wye behavior.
  on('tipEditorOpened', ({ detail }) => {
    const { container: ctn, where } = detail || {};
    try { enhanceTipEditor(ctn || container, where); } catch (e) { console.warn(e); }
  });

  // Legacy bridge for non-event-based flows
  window.__announceTipEditorOpen = function(where, ctn = container){
    emit('tipEditorOpened', { container: ctn, where });
  };
}

/** Back-compat: many callers do `mod.render(container)` */
export function render(container){
  return initCalcView(container);
}

/** Default export is a function for legacy imports */
export default render;
