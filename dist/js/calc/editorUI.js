// calc/editorUI.js
// Attaches enhancement logic to the tip editor whenever it opens.
// This file glues together: segmentWye, nozzleOptions, validators,
// and announces readiness via the event bus.

import { qs } from './dom.js';
import { attachSegmentWyeUI } from './segmentWye.js';
import { emit } from './events.js';

/**
 * Called once each time #tipEditor is opened.
 * You should call this from your tip editor open flow, e.g.:
 *
 *   emit('tipEditorOpened', { container, where })
 *
 * or through the entry file's global bridge:
 *
 *   window.__announceTipEditorOpen(where, container)
 */
export function enhanceTipEditor(container, where = 'main') {
  const tip = qs(container, '#tipEditor');
  if (!tip) return;

  // Avoid double-binding if editor reopens
  if (tip.__calcEnhanced) return;
  tip.__calcEnhanced = true;

  // Provide the Wye segmented controls and branch logic
  attachSegmentWyeUI(container, {
    NOZ_LIST: window.NOZ_LIST || [],
    findNozzleId: window.findNozzleId || null
  });

  // Notify that the editor has been enhanced (for future modules if needed)
  emit('editorEnhanced', { container, where });
}

export default enhanceTipEditor;
