// ===========================================================
// deptNozzles.js
// Single source of truth for the "Department Setup → Nozzles" checkbox list.
// This file MUST stay lightweight: it only exports a library of {id,label}.
// The actual nozzle hydraulics data lives in store.js (NOZ / NOZ_LIST).
// ===========================================================

import { NOZ_LIST } from './store.js';

/**
 * Build the Department nozzle library from the canonical nozzle list.
 * - id MUST match the internal nozzle id used everywhere (store.NOZ keys).
 * - label is what the UI displays in Department Setup.
 *
 * NOTE: If you need to hide a nozzle from Department Setup, filter it out here.
 * Do NOT create duplicate "shadow" nozzle definitions elsewhere.
 */
function buildLibrary() {
  const list = Array.isArray(NOZ_LIST) ? NOZ_LIST : [];

  // Convert store nozzles into {id,label} options
  const raw = list
    .filter(n => n && typeof n === 'object' && n.id)
    .map(n => ({
      id: String(n.id),
      label: String(n.label || n.name || n.desc || n.id),
    }));

  // De-dupe by id (first wins)
  const seen = new Set();
  const deduped = [];
  for (const n of raw) {
    if (!n.id) continue;
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    deduped.push(n);
  }

  // Sort by label for consistent UX
  deduped.sort((a, b) => (a.label || '').localeCompare(b.label || ''));

  return deduped;
}

// Exported constant used by view.department.js
export const DEPT_NOZZLE_LIBRARY = buildLibrary();
