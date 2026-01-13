// store.js
// Central app state, department defaults, presets, and hydraulic helpers

// ======================================================
// Runtime State
// ======================================================
export const state = {
  supply: 'off',
  showMath: false,
  lastMaxKey: null,
  lines: null,
  supplyInfo: {
    staticPsi: 0,
    relayIntakePsi: 0,
    relayTargetIntakePsi: 0,
  },
  lastUpdatedAt: 0,
};

// ======================================================
// Constants
// ======================================================
export const PSI_PER_FT = 0.05;

export const COEFF = {
  1.75: 15.5,
  2.0: 8.0,
  2.5: 2.0,
  3.0: 0.8,
  4.0: 0.2,
};

// ======================================================
// Storage Keys
// ======================================================
const KEY_DEPT_DEFAULTS_V1 = 'pump_dept_defaults_v1';
const KEY_PRESETS_V1 = 'pump_presets_v1';
const KEY_LAST_PRESET = 'pump_last_preset_v1';

// ======================================================
// Nozzles
// ======================================================
export const NOZZLES = [
  { id: 'fog_95', label: 'Fog 95 GPM', gpm: 95, np: 100 },
  { id: 'fog_125', label: 'Fog 125 GPM', gpm: 125, np: 100 },
  { id: 'fog_150', label: 'Fog 150 GPM', gpm: 150, np: 100 },
  { id: 'fog_185', label: 'Fog 185 GPM', gpm: 185, np: 100 },
  { id: 'sb_7_8', label: 'Smooth Bore 7/8"', gpm: 160, np: 50 },
  { id: 'sb_15_16', label: 'Smooth Bore 15/16"', gpm: 185, np: 50 },
];

export function getNozzleById(id) {
  return NOZZLES.find(n => n.id === id) || null;
}

export function getDeptNozzles() {
  return NOZZLES.slice();
}

// ======================================================
// Hoses
// ======================================================
export const HOSES = [
  { id: '1.75', size: '1.75', label: '1¾"' },
  { id: '2.0', size: '2.0', label: '2"' },
  { id: '2.5', size: '2.5', label: '2½"' },
  { id: '3.0', size: '3.0', label: '3"' },
  { id: '4.0', size: '4.0', label: '4"' },
];

export function getDeptHoses() {
  return HOSES.slice();
}

// ======================================================
// Department Defaults
// ======================================================

function makeDefaultLine(label = '', placeholder = false) {
  return {
    label,
    itemsMain: placeholder
      ? [{ size: '', lengthFt: 0 }]          // IMPORTANT: placeholder lines
      : [{ size: '1.75', lengthFt: 200 }],   // real default
    elevationFt: 0,
    nozRight: placeholder ? '' : 'fog_150',
    _nozId: placeholder ? '' : 'fog_150',
  };
}

function seedDefaults() {
  return {
    left:  makeDefaultLine('Preconnect 1', false),
    back:  makeDefaultLine('Preconnect 2', true),
    right: makeDefaultLine('Preconnect 3', true),
  };
}

function loadDeptDefaults() {
  try {
    const raw = localStorage.getItem(KEY_DEPT_DEFAULTS_V1);
    if (!raw) return seedDefaults();

    const parsed = JSON.parse(raw);
    const seeded = seedDefaults();

    return {
      left:  parsed.left  || seeded.left,
      back:  parsed.back  || seeded.back,
      right: parsed.right || seeded.right,
    };
  } catch {
    return seedDefaults();
  }
}

function saveDeptDefaults(obj) {
  localStorage.setItem(KEY_DEPT_DEFAULTS_V1, JSON.stringify(obj));
}

export function getDeptLineDefault(key) {
  return loadDeptDefaults()[key] || null;
}

export function setDeptLineDefault(key, val) {
  const d = loadDeptDefaults();
  d[key] = val;
  saveDeptDefaults(d);
}

// ======================================================
// Line Defaults API (line1 / line2 / line3)
// ======================================================
function mapLineIdToKey(id) {
  return id === 'line1' ? 'left'
       : id === 'line2' ? 'back'
       : id === 'line3' ? 'right'
       : null;
}

export function getLineDefaults(id) {
  const key = mapLineIdToKey(id);
  if (!key) return null;

  const L = getDeptLineDefault(key);
  if (!L) return null;

  const seg = L.itemsMain?.[0] || {};
  return {
    hose: seg.size || '',
    length: Number(seg.lengthFt || 0),
    nozzle: L.nozRight || L._nozId || '',
    elevation: Number(L.elevationFt || 0),
    name: L.label || '',
  };
}

export function setLineDefaults(id, data) {
  const key = mapLineIdToKey(id);
  if (!key) return;

  const d = loadDeptDefaults();
  const base = d[key] || makeDefaultLine('');

  d[key] = {
    ...base,
    label: data.name ?? base.label,
    itemsMain: [{
      size: data.hose || base.itemsMain[0].size,
      lengthFt: Number(data.length || base.itemsMain[0].lengthFt),
    }],
    elevationFt: Number(data.elevation || 0),
    nozRight: data.nozzle || base.nozRight,
    _nozId: data.nozzle || base._nozId,
  };

  saveDeptDefaults(d);
}

// ======================================================
// Configured Preconnect Detection (FIXED)
// ======================================================
export function getConfiguredPreconnects() {
  const keys = ['left', 'back', 'right'];
  const out = [];

  function isReal(L) {
    if (!L || !L.itemsMain?.length) return false;
    const seg = L.itemsMain[0];
    return Number(seg.lengthFt || 0) > 0 && String(seg.size || '').trim() !== '';
  }

  for (let i = 0; i < keys.length; i++) {
    if (i === 0) {
      out.push(keys[i]); // Preconnect 1 always exists
      continue;
    }
    if (isReal(getDeptLineDefault(keys[i]))) {
      out.push(keys[i]);
    }
  }

  return out;
}

// ======================================================
// Presets
// ======================================================
export function loadPresets() {
  try {
    return JSON.parse(localStorage.getItem(KEY_PRESETS_V1)) || [];
  } catch {
    return [];
  }
}

export function savePresets(presets) {
  localStorage.setItem(KEY_PRESETS_V1, JSON.stringify(presets || []));
}

export function getLastPresetId() {
  return localStorage.getItem(KEY_LAST_PRESET) || '';
}

export function setLastPresetId(id) {
  localStorage.setItem(KEY_LAST_PRESET, id || '');
}

// ======================================================
// Hydraulics
// ======================================================
export function frictionLossPsi(hoseSize, gpm, lengthFt) {
  const C = COEFF[Number(hoseSize)] || 0;
  if (!C || !gpm || !lengthFt) return 0;
  return C * Math.pow(gpm / 100, 2) * (lengthFt / 100);
}

export function elevationPsi(ft) {
  return Number(ft || 0) * PSI_PER_FT;
}

// LEGACY EXPORT — REQUIRED BY OLDER VIEWS
export function FL_total(hoseSize, gpm, lengthFt) {
  return frictionLossPsi(hoseSize, gpm, lengthFt);
}

// ======================================================
// Runtime Line Seeding
// ======================================================
function seedRuntimeLines() {
  const d = loadDeptDefaults();

  const mk = key => {
    const L = d[key];
    const seg = L.itemsMain[0];
    const noz = getNozzleById(L.nozRight);

    return {
      key,
      enabled: key === 'left',
      hoseSize: seg.size || '1.75',
      lengthFt: seg.lengthFt || 200,
      nozzleId: noz?.id || 'fog_150',
      gpm: noz?.gpm || 150,
      nozzlePsi: noz?.np || 100,
      elevationFt: L.elevationFt || 0,
      applianceLoss: false,
    };
  };

  return {
    left: mk('left'),
    back: mk('back'),
    right: mk('right'),
  };
}

export function ensureSeeded() {
  if (!state.lines) {
    state.lines = seedRuntimeLines();
  }
}

ensureSeeded();
