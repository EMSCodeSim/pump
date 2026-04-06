// calc/friction.js
// Pure hydraulic math wrappers used by stage rendering and KPI panels.
// These functions DO NOT touch DOM or global state.
//
// They wrap your existing shared FL, FL_total, and sumFt helpers in store.js
// so the calculator view doesn't need to call store.js directly.

import { FL, FL_total, sumFt } from '../store.js';

/**
 * Compute friction loss for a single line segment.
 * @param {Object} line - { gpm, size, length }
 */
export function computeFL(line) {
  const { gpm, size, length } = line || {};
  return FL(gpm, size, length);
}

/**
 * Compute total friction loss for main + branches (if Wye).
 * @param {Object} lines - { main, A, B }
 */
export function computeTotalFL(lines) {
  return FL_total(lines);
}

/**
 * Compute elevation PSI.
 * (store.js should already export PSI_PER_FT; otherwise inline: elev * 0.434)
 */
export function computeElevationPSI(elevFeet) {
  return elevFeet * 0.434;
}

/**
 * Sum total hose length for a line defined as an array of segments.
 */
export function totalLength(arr) {
  return sumFt(arr);
}
