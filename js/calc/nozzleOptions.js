// calc/nozzleOptions.js
// Utilities for building and managing nozzle <select> options.
// This isolates all Fog-185@50 defaults, filtering, and enabling/disabling
// so the editor logic stays clean.

import { qs } from './dom.js';

/**
 * Return the nozzle ID for Fog 185 GPM @ 50 PSI if available.
 * Uses the same logic as the legacy findNozzleId but isolated and safer.
 */
export function findFog185Id({ NOZ_LIST, findNozzleId }) {
  try {
    if (typeof findNozzleId === 'function') {
      const id = findNozzleId({ gpm:185, NP:50, preferFog:true });
      if (id) return id;
    }
  } catch (_) {}

  // fallback search
  try {
    if (Array.isArray(NOZ_LIST)) {
      const match = NOZ_LIST.find(n => {
        const g = Number(n?.gpm);
        const p = Number(n?.NP);
        const label = String(n?.name || n?.label || '');
        return (g === 185 && p === 50) || /185\s*@\s*50/i.test(label);
      });
      return match ? (match.id || match.name || match.label) : null;
    }
  } catch (_) {}

  return null;
}

/**
 * Populate a <select> with nozzle options.
 * Accepts a filter function to allow 1.75-only, 2.5-only, fog-only, etc.
 */
export function populateNozzleSelect(selectEl, NOZ_LIST, filterFn = null) {
  if (!selectEl || !Array.isArray(NOZ_LIST)) return;

  // Clear existing
  selectEl.innerHTML = '';

  const list = filterFn ? NOZ_LIST.filter(filterFn) : NOZ_LIST;

  for (const noz of list) {
    const opt = document.createElement('option');
    opt.value = noz.id || noz.name || '';
    opt.textContent = noz.label || noz.name || `${noz.gpm} @ ${noz.NP}`;
    selectEl.appendChild(opt);
  }
}

/**
 * Enable or disable a nozzle <select>.
 */
export function enableNozzle(selectEl, enable=true) {
  if (!selectEl) return;
  selectEl.disabled = !enable;
}

/**
 * Set default nozzle if <select> is empty.
 */
export function ensureDefaultFog185(selectEl, fogId) {
  if (!selectEl || !fogId) return;
  if (!selectEl.value) selectEl.value = fogId;
}

/**
 * Convenience filters for common nozzle groups.
 */
export const isFog = n => /fog/i.test(n?.label || n?.name || '');
export const is175 = n => String(n?.size || n?.diameter) === '1.75';
export const is25  = n => String(n?.size || n?.diameter) === '2.5';
