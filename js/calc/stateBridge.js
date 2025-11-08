// calc/stateBridge.js
// Provides a clean API for reading and writing hose data between the editor
// and your shared store.js state. This keeps the main entrypoint uncluttered.
//
// Assumes store.js exports a `state` shaped like:
//   state = {
//     lines: {
//       main: { gpm, size, length, elevation, nozzleId, wye }, 
//       A:    { gpm, size, length, elevation, nozzleId },
//       B:    { gpm, size, length, elevation, nozzleId }
//     }
//   }

import { state } from '../store.js';

/**
 * Get the current data for a line (main, A, or B).
 */
export function getLine(lineKey) {
  return state?.lines?.[lineKey] || null;
}

/**
 * Update a line’s data (partial write).
 * e.g. updateLine('A', { length: 150, nozzleId: 'fog185' });
 */
export function updateLine(lineKey, updates) {
  if (!state.lines[lineKey]) return;
  Object.assign(state.lines[lineKey], updates);
}

/**
 * Patch multiple fields on main line, including Wye state.
 * e.g. updateMain({ size: '2.5', wye: 'on' });
 */
export function updateMain(updates) {
  updateLine('main', updates);
}

/**
 * Convert editor DOM values into a line update.
 * This is called by the Apply button handler.
 */
export function readEditorValues(tipEl, lineKey) {
  const out = {};
  const getVal = (sel) => {
    const el = tipEl.querySelector(sel);
    return el ? el.value : null;
  };

  out.size      = getVal('#teSize');
  out.length    = Number(getVal('#teLen'));
  out.elevation = Number(getVal('#teElev'));

  const nozSel  = lineKey === 'A' ? '#teNozA' :
                  lineKey === 'B' ? '#teNozB' : '#teNoz';
  out.nozzleId  = getVal(nozSel);

  if (lineKey === 'main') {
    out.wye = getVal('#teWye');
  }

  return out;
}

/**
 * Apply editor changes back to the store.
 */
export function applyEditorToState(tipEl, activeSegment) {
  const updates = readEditorValues(tipEl, activeSegment);
  updateLine(activeSegment, updates);
}

/**
 * Export a snapshot of the calculator state.
 */
export function buildCalcSnapshot() {
  return JSON.parse(JSON.stringify(state.lines));
}

/**
 * Restore a snapshot into calculator lines.
 */
export function restoreCalcSnapshot(snapshot) {
  if (!snapshot) return;
  for (const k of Object.keys(snapshot)) {
    if (state.lines[k]) Object.assign(state.lines[k], snapshot[k]);
  }
}
