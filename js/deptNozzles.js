// ===========================================================
// deptNozzles.js
// Compatibility shim.
// The SINGLE nozzle source of truth is store.js (NOZ / NOZ_LIST + custom nozzles).
// Department Setup should NOT define its own nozzle catalog here.
// ===========================================================

import { NOZ_LIST } from './store.js';

// Keep the old export name so existing imports won't crash.
// This is intentionally derived from NOZ_LIST to guarantee consistent IDs + labels.
export const DEPT_NOZZLE_LIBRARY = (Array.isArray(NOZ_LIST) ? NOZ_LIST : [])
  .filter(n => n && n.id)
  .map(n => ({ id: String(n.id), label: String(n.label || n.name || n.id) }));
