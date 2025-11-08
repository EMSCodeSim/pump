// view.calc.js (refactored entrypoint)
// Purpose: orchestrates the calculator view and popup editor by composing smaller modules.
//
// External deps expected by the existing app (unchanged):
//   - ./store.js (exports: state, NOZ, COLORS, FL, FL_total, etc.)
//   - ./waterSupply.js (exports: WaterSupplyUI)
// This module keeps the public surface minimal and defers UI details to calc/editorUI.js

import { state, NOZ, COLORS } from './store.js';
import { WaterSupplyUI } from './waterSupply.js';

// Internal modules for the calc view
import { enhanceTipEditor } from './calc/editorUI.js';
import { on, off, emit } from './calc/events.js';
import { injectCalcStyles } from './calc/styles.css.js';

// --- Public API ---
// Initialize the calc view inside a container element.
// Call this from wherever you previously created/attached the stage view.
export function initCalcView(container) {
  if (!container) throw new Error('initCalcView: container is required');

  // Inject styles once for the whole calculator view
  injectCalcStyles(container);

  // Hook: whenever the tip editor opens, enhance it with segmented Wye behavior.
  // Emit this event from your existing open flow (or wrap the opener function).
  on('calc:tipEditorOpened', ({ container: ctn, where }) => {
    try { enhanceTipEditor(ctn || container, where); } catch (e) { console.warn(e); }
  });

  // If your legacy code can call a global to announce editor open, keep this as a bridge:
  window.__announceTipEditorOpen = function(where, ctn = container){
    emit('calc:tipEditorOpened', { container: ctn, where });
  };

  // Any other calc-view bootstrapping can go here (render stage, bind zoom, etc.)
  // Keep legacy logic in place; this entry just wires the enhancement lifecycle.
}

// Optional: default export to ease drop-in usage
export default { initCalcView };
