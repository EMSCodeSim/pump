// deptState.js
// Centralized Department Setup state for FireOps Calc
// ---------------------------------------------------
// Goals:
// - Provide ONE "dept" object that all views can use
// - Keep DEPT_UI_NOZZLES / DEPT_UI_HOSES in sync so all line editors
//   (Standard, Master, Standpipe, Supply, etc.) see the same options
// - Persist department equipment + line defaults in localStorage
// - Provide a small subscription API so views can re-render on changes
//
// This file is intentionally "dumb": it mostly normalizes, persists, and
// fans out changes to store.js's DEPT_UI_* arrays.
//
// Usage examples (in other files):
//
//   import { getDept, getUiNozzles, getUiHoses } from './deptState.js';
//
//   const dept = getDept();
//   const hoseList = getUiHoses();
//   const nozzleList = getUiNozzles();
//
//   // When Department Setup saves selections:
//   import { setDeptEquipment, setDeptSelections } from './deptState.js';
//
//   setDeptEquipment({
//     nozzlesAll: normalizedNozzleArray,
//     hosesAll: normalizedHoseArray,
//     accessoriesAll: normalizedAccessoryArray,
//   });
//
//   setDeptSelections({
//     nozzleIds: ['fog150_50', 'sb15_16', 'my_custom_nozzle_id'],
//     hoseIds:   ['1.75', '2.5', 'h_lf_175'],
//   });
//
//   // Line defaults (Line1/Line2/Line3 editor or presets):
//   import { getLineDefaults, setLineDefault } from './deptState.js';
//
//   const line1 = getLineDefaults('1');  // { hose, nozzle, length, elevation } or null
//   setLineDefault('1', { hose: '1.75', nozzle: 'fog185_50', length: 200, elevation: 0 });
//

import {
  NOZ,
  COEFF,
  DEPT_UI_NOZZLES,
  DEPT_UI_HOSES,
  setDeptUiNozzles,
  setDeptUiHoses,
  loadDeptDefaults,
  saveDeptDefaults, // currently only used by store.js; we keep compatibility
} from './store.js';

/* =========================
 * Storage keys (shared)
 * ========================= */

const STORAGE_DEPT_KEY = 'fireops_dept_state_v1';  // internal deptState persistence only
const STORAGE_LINE_DEFAULTS_KEY = 'fireops_line_defaults_v1'; // line 1/2/3

/* =========================
 * In-memory dept state
 * ========================= */

let deptState = {
  // Full department equipment libraries
  nozzlesAll: [],      // [{ id, label, gpm?, np?, type? }, ...]
  hosesAll: [],        // [{ id, label, c? }, ...]
  accessoriesAll: [],  // [{ id, label, ... }, ...]

  // Selected IDs that should be visible in dropdowns
  selectedNozzleIds: [],  // ['fog150_50', 'sb15_16', ...]
  selectedHoseIds: [],    // ['1.75', '2.5', 'h_175', ...]

  // Line defaults (Line 1/2/3 editor)
  // lineDefaults['1'] = { hose, nozzle, length, elevation }
  lineDefaults: {},
};

// Simple subscribers: each is fn(newDeptState) => void
const listeners = [];

/* =========================
 * Internal helpers
 * ========================= */

function safeJsonParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function notify() {
  const snapshot = getDept(); // shallow clone
  listeners.forEach(fn => {
    try {
      fn(snapshot);
    } catch (e) {
      console.warn('deptState subscriber error', e);
    }
  });
}

function saveDeptToStorage() {
  try {
    const payload = {
      nozzlesAll: deptState.nozzlesAll || [],
      hosesAll: deptState.hosesAll || [],
      accessoriesAll: deptState.accessoriesAll || [],
      selectedNozzleIds: deptState.selectedNozzleIds || [],
      selectedHoseIds: deptState.selectedHoseIds || [],
    };
    localStorage.setItem(STORAGE_DEPT_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('deptState: saveDeptToStorage failed', e);
  }
}

function loadDeptFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_DEPT_KEY);
    if (!raw) return null;
    return safeJsonParse(raw, null);
  } catch (e) {
    console.warn('deptState: loadDeptFromStorage failed', e);
    return null;
  }
}

function saveLineDefaultsToStorage() {
  try {
    const payload = deptState.lineDefaults || {};
    localStorage.setItem(STORAGE_LINE_DEFAULTS_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('deptState: saveLineDefaults failed', e);
  }
}

function loadLineDefaultsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_LINE_DEFAULTS_KEY);
    if (!raw) return {};
    const parsed = safeJsonParse(raw, {});
    return parsed || {};
  } catch (e) {
    console.warn('deptState: loadLineDefaults failed', e);
    return {};
  }
}

// Normalizes a nozzle from a variety of shapes into { id, label, gpm?, np? }
function normalizeNozzle(n, idx = 0) {
  if (!n) return null;

  if (typeof n === 'string' || typeof n === 'number') {
    const id = String(n);
    return { id, label: String(n) };
  }

  const id =
    n.id != null
      ? String(n.id)
      : String(n.value ?? n.name ?? idx);

  let label = n.label || n.name || String(id);

  let gpm = 0;
  let np = 0;

  if (typeof n.gpm === 'number') gpm = n.gpm;
  if (!gpm && typeof n.flow === 'number') gpm = n.flow;
  if (typeof n.np === 'number') np = n.np;
  if (!np && typeof n.NP === 'number') np = n.NP;
  if (!np && typeof n.pressure === 'number') np = n.pressure;

  // If in the NOZ catalog, use that as the authoritative GPM/NP if missing
  if (NOZ && NOZ[id]) {
    const cat = NOZ[id];
    if (!gpm && typeof cat.gpm === 'number') gpm = cat.gpm;
    if (!np && typeof cat.NP === 'number') np = cat.NP;
  }

  return { id, label, gpm, np };
}

// Normalizes a hose into { id, label, c? }
function normalizeHose(h, idx = 0) {
  if (!h) return null;

  if (typeof h === 'string' || typeof h === 'number') {
    const id = String(h);
    return { id, label: id };
  }

  const id =
    h.id != null
      ? String(h.id)
      : String(h.value ?? h.name ?? idx);

  const label = h.label || h.name || String(id);

  let c = null;
  if (typeof h.c === 'number') {
    c = h.c;
  } else if (COEFF) {
    // If id looks like a diameter, we can pull from COEFF
    const diamMatch = String(id).match(/(\d(?:\.\d+)?)/);
    if (diamMatch && COEFF[diamMatch[1]]) {
      c = COEFF[diamMatch[1]];
    }
  }

  const result = { id, label };
  if (c != null) result.c = c;
  return result;
}

// Pushes trimmed UI lists into store.js so all line views see the same menus
function syncUiListsFromState() {
  // Nozzles: convert selected ids → objects from nozzlesAll
  const selectedNozzles = new Set(deptState.selectedNozzleIds || []);
  let uiNozzles = deptState.nozzlesAll || [];

  if (selectedNozzles.size) {
    uiNozzles = uiNozzles.filter(n => selectedNozzles.has(String(n.id)));
  }

  // If none selected, fall back to "all"
  setDeptUiNozzles(uiNozzles || []);

  // Hoses: same idea
  const selectedHoses = new Set(deptState.selectedHoseIds || []);
  let uiHoses = deptState.hosesAll || [];

  if (selectedHoses.size) {
    uiHoses = uiHoses.filter(h => selectedHoses.has(String(h.id)));
  }

  setDeptUiHoses(uiHoses || []);
}

/* =========================
 * Initialization
 * ========================= */

(function initDeptState() {
  // Seed from storage if present
  const stored = loadDeptFromStorage();
  if (stored && typeof stored === 'object') {
    deptState.nozzlesAll = Array.isArray(stored.nozzlesAll)
      ? stored.nozzlesAll.map(normalizeNozzle).filter(Boolean)
      : [];
    deptState.hosesAll = Array.isArray(stored.hosesAll)
      ? stored.hosesAll.map(normalizeHose).filter(Boolean)
      : [];
    deptState.accessoriesAll = Array.isArray(stored.accessoriesAll)
      ? stored.accessoriesAll
      : [];
    deptState.selectedNozzleIds = Array.isArray(stored.selectedNozzleIds)
      ? stored.selectedNozzleIds.map(String)
      : [];
    deptState.selectedHoseIds = Array.isArray(stored.selectedHoseIds)
      ? stored.selectedHoseIds.map(String)
      : [];
  }

  // Seed line defaults from STORAGE_LINE_DEFAULTS_KEY
  deptState.lineDefaults = loadLineDefaultsFromStorage();

  // Also keep compatibility with store.js dept defaults (left/back/right).
  // We don't overwrite our lineDefaults, but you *could* map these if desired.
  // const legacy = loadDeptDefaults();
  // (Optional: map legacy.left/back/right -> line '1'/'2'/'3')

  // Ensure DEPT_UI_* arrays are synced on load
  syncUiListsFromState();
})();

/* =========================
 * Public API
 * ========================= */

// Shallow clone so callers don't mutate internal object by accident
export function getDept() {
  return {
    nozzlesAll: [...(deptState.nozzlesAll || [])],
    hosesAll: [...(deptState.hosesAll || [])],
    accessoriesAll: [...(deptState.accessoriesAll || [])],
    selectedNozzleIds: [...(deptState.selectedNozzleIds || [])],
    selectedHoseIds: [...(deptState.selectedHoseIds || [])],
    lineDefaults: { ...(deptState.lineDefaults || {}) },
  };
}

// Replace the full department equipment libraries.
// Does NOT change which ones are selected for UI menus.
export function setDeptEquipment({
  nozzlesAll = null,
  hosesAll = null,
  accessoriesAll = null,
} = {}) {
  if (Array.isArray(nozzlesAll)) {
    deptState.nozzlesAll = nozzlesAll.map(normalizeNozzle).filter(Boolean);
  }
  if (Array.isArray(hosesAll)) {
    deptState.hosesAll = hosesAll.map(normalizeHose).filter(Boolean);
  }
  if (Array.isArray(accessoriesAll)) {
    deptState.accessoriesAll = accessoriesAll.slice();
  }

  saveDeptToStorage();
  syncUiListsFromState();
  notify();
}

// Set which nozzles/hoses are shown throughout the app.
// These IDs should match the ids in nozzlesAll/hosesAll.
export function setDeptSelections({ nozzleIds = null, hoseIds = null } = {}) {
  if (Array.isArray(nozzleIds)) {
    deptState.selectedNozzleIds = nozzleIds.map(String);
  }
  if (Array.isArray(hoseIds)) {
    deptState.selectedHoseIds = hoseIds.map(String);
  }

  saveDeptToStorage();
  syncUiListsFromState();
  notify();
}

// Convenience: clear selections so *all* equipment shows in the UI
export function clearDeptSelections() {
  deptState.selectedNozzleIds = [];
  deptState.selectedHoseIds = [];
  saveDeptToStorage();
  syncUiListsFromState();
  notify();
}

// Read-only views of current UI lists. These are exactly what
// view.lineStandard / view.lineMaster / etc will see.
export function getUiNozzles() {
  // Prefer the DEPT_UI_* arrays managed by this module
  if (Array.isArray(DEPT_UI_NOZZLES) && DEPT_UI_NOZZLES.length) {
    return DEPT_UI_NOZZLES.slice();
  }
  // Fallback: derived from deptState
  if (deptState.nozzlesAll && deptState.nozzlesAll.length) {
    const sel = new Set(deptState.selectedNozzleIds || []);
    if (sel.size) {
      return deptState.nozzlesAll.filter(n => sel.has(String(n.id)));
    }
    return deptState.nozzlesAll.slice();
  }
  return [];
}

export function getUiHoses() {
  if (Array.isArray(DEPT_UI_HOSES) && DEPT_UI_HOSES.length) {
    return DEPT_UI_HOSES.slice();
  }
  if (deptState.hosesAll && deptState.hosesAll.length) {
    const sel = new Set(deptState.selectedHoseIds || []);
    if (sel.size) {
      return deptState.hosesAll.filter(h => sel.has(String(h.id)));
    }
    return deptState.hosesAll.slice();
  }
  return [];
}

// === Line defaults (Line 1 / Line 2 / Line 3) ===============================
//
// key is '1' | '2' | '3' (Line numbers as strings)
// data shape: { hose, nozzle, length, elevation }

export function getLineDefaults(key) {
  const k = String(key);
  const all = deptState.lineDefaults || {};
  const val = all[k];
  return val ? { ...val } : null;
}

export function setLineDefault(key, data) {
  if (!data || typeof data !== 'object') return;
  const k = String(key);

  const cleaned = {
    hose: String(data.hose ?? ''),
    nozzle: String(data.nozzle ?? ''),
    length: Number(data.length ?? 0),
    elevation: Number(data.elevation ?? 0),
  };

  if (!deptState.lineDefaults) deptState.lineDefaults = {};
  deptState.lineDefaults[k] = cleaned;

  saveLineDefaultsToStorage();
  notify();
}



// Returns a calc-ready snapshot of department line defaults for Line 1/2/3.
// Shape matches what view.calc.main expects:
// {
//   line1: { hoseDiameter, nozzleId, lengthFt, elevationFt },
//   line2: { ... },
//   line3: { ... },
// }
export function getDeptLineDefaults() {
  // Department Setup stores keys as '1', '2', '3'
  const l1 = getLineDefaults('1') || null;
  const l2 = getLineDefaults('2') || null;
  const l3 = getLineDefaults('3') || null;

  // Fallbacks match the initial hard-coded layout in store.js
  const fallback = {
    line1: { hoseDiameter: '1.75', nozzleId: 'chief185_50', lengthFt: 200, elevationFt: 0 },
    line2: { hoseDiameter: '1.75', nozzleId: 'chief185_50', lengthFt: 200, elevationFt: 0 },
    line3: { hoseDiameter: '2.5',  nozzleId: 'chiefXD265',  lengthFt: 250, elevationFt: 0 },
  };

  function shape(src, key) {
    const base = fallback[key];
    if (!src) return { ...base };

    return {
      hoseDiameter: src.hose || base.hoseDiameter,
      nozzleId: src.nozzle || base.nozzleId,
      lengthFt:
        typeof src.length === 'number' && !Number.isNaN(src.length)
          ? src.length
          : base.lengthFt,
      elevationFt:
        typeof src.elevation === 'number' && !Number.isNaN(src.elevation)
          ? src.elevation
          : base.elevationFt,
    };
  }

  return {
    line1: shape(l1, 'line1'),
    line2: shape(l2, 'line2'),
    line3: shape(l3, 'line3'),
  };
}

// Optional helper if you want to map to legacy left/back/right in store.js
export function syncLegacyLineDefaults() {
  const legacy = loadDeptDefaults();
  if (!legacy || typeof legacy !== 'object') return;

  // You can adjust this mapping if your app uses a different convention.
  const map = {
    left: '1',
    back: '2',
    right: '3',
  };

  Object.keys(map).forEach(legacyKey => {
    const lineKey = map[legacyKey];
    const src = legacy[legacyKey];
    if (!src) return;

    // Try to infer hose/nozzle/length/elevation from legacy object
    const hose = src.itemsMain && src.itemsMain[0] ? src.itemsMain[0].size : '';
    const length = src.itemsMain && src.itemsMain[0] ? Number(src.itemsMain[0].lengthFt || 0) : 0;
    const nozzle = src.nozMain && src.nozMain.id ? src.nozMain.id : (src.nozMain || '');
    const elevation = Number(src.elevFt || 0);

    setLineDefault(lineKey, { hose, nozzle, length, elevation });
  });
}

// === Subscription API =======================================================

export function subscribeDept(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.push(fn);
  // Immediately send current snapshot
  try {
    fn(getDept());
  } catch (e) {
    console.warn('deptState: subscriber initial call failed', e);
  }
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

// For convenience, alias
export const onDeptChange = subscribeDept;
