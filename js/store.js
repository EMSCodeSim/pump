// store.js
// Central app state, nozzle catalog, presets, and hydraulic helpers.
// - Lines start hidden; supply starts 'off' (user chooses).
// - NFPA elevation: PSI_PER_FT = 0.05 (0.5 psi / 10 ft).
// - Appliance loss: +10 psi only if total GPM > 350.
// - Exports restored for other views: COEFF, loadPresets, savePresets.

export const state = {
  supply: 'off',       // 'off' | 'pressurized' | 'static' | 'relay'
  showMath: false,
  lastMaxKey: null,
  lines: null,         // seeded below
  supplyInfo: {
    staticPsi: 0,
    relayIntakePsi: 0,
    relayTargetIntakePsi: 0,
  },
  lastUpdatedAt: 0,
};

// -----------------------------
// Constants / coefficients
// -----------------------------
export const PSI_PER_FT = 0.05; // 0.5 psi per 10 ft (NFPA)
export const COEFF = {
  1.75: 15.5,
  2.0:  8.0,
  2.5:  2.0,
  3.0:  0.8,
  4.0:  0.2,
};

// Appliance loss rule: +10 psi only if total GPM > 350.
export function applianceLossPsi(totalGpm) {
  return totalGpm > 350 ? 10 : 0;
}

// -----------------------------
// Storage keys
// -----------------------------
const KEY_DEPT_DEFAULTS_V1 = 'pump_dept_defaults_v1';
const KEY_PRESETS_V1 = 'pump_presets_v1';
const KEY_LAST_PRESET = 'pump_last_preset_v1';

// -----------------------------
// Nozzle Catalog
// -----------------------------
export const NOZZLES = [
  // Fog nozzles
  { id: 'fog_95',   label: 'Fog 95 GPM',    gpm: 95,   type: 'fog',   np: 100 },
  { id: 'fog_125',  label: 'Fog 125 GPM',   gpm: 125,  type: 'fog',   np: 100 },
  { id: 'fog_150',  label: 'Fog 150 GPM',   gpm: 150,  type: 'fog',   np: 100 },
  { id: 'fog_185',  label: 'Fog 185 GPM',   gpm: 185,  type: 'fog',   np: 100 },
  { id: 'fog_250',  label: 'Fog 250 GPM',   gpm: 250,  type: 'fog',   np: 100 },

  // Smooth bore tips (example)
  { id: 'sb_7_8',   label: 'Smooth Bore 7/8" (160)', gpm: 160, type: 'sb', np: 50 },
  { id: 'sb_15_16', label: 'Smooth Bore 15/16" (185)', gpm: 185, type: 'sb', np: 50 },
  { id: 'sb_1_1_8', label: 'Smooth Bore 1-1/8" (265)', gpm: 265, type: 'sb', np: 50 },

  // Master stream (example)
  { id: 'ms_500', label: 'Master Stream 500', gpm: 500, type: 'ms', np: 80 },
];

// Helpers
export function getNozzleById(id) {
  return NOZZLES.find(n => n.id === id) || null;
}

export function getDeptNozzles() {
  // If your app supports custom department nozzles in storage, load them here.
  // Otherwise return default catalog.
  return NOZZLES.slice();
}

// -----------------------------
// Department Hoses (defaults)
// -----------------------------
export const HOSES = [
  { id: '1.75', size: '1.75', label: '1¾"' },
  { id: '2.0',  size: '2.0',  label: '2"' },
  { id: '2.5',  size: '2.5',  label: '2½"' },
  { id: '3.0',  size: '3.0',  label: '3"' },
  { id: '4.0',  size: '4.0',  label: '4"' },
];

export function getDeptHoses() {
  // If custom hoses exist, load here. Default:
  return HOSES.slice();
}

// -----------------------------
// Dept Defaults (Lines: left/back/right)
// -----------------------------
function makeDefaultLine(label = '') {
  return {
    label,
    itemsMain: [
      { size: '1.75', lengthFt: 200 },
    ],
    // Optional fields used by other views
    elevationFt: 0,
    nozRight: 'fog_150',
    _nozId: 'fog_150',
  };
}

function seedDefaults() {
  return {
    left:  makeDefaultLine('Preconnect 1'),
    back:  makeDefaultLine('Preconnect 2'),
    right: makeDefaultLine('Preconnect 3'),
  };
}

function loadDeptDefaults() {
  try {
    const raw = localStorage.getItem(KEY_DEPT_DEFAULTS_V1);
    if (!raw) return seedDefaults();
    const parsed = JSON.parse(raw);
    // Ensure keys exist
    const seeded = seedDefaults();
    return {
      left:  parsed.left  || seeded.left,
      back:  parsed.back  || seeded.back,
      right: parsed.right || seeded.right,
    };
  } catch (e) {
    return seedDefaults();
  }
}

function saveDeptDefaults(obj) {
  localStorage.setItem(KEY_DEPT_DEFAULTS_V1, JSON.stringify(obj));
}

// Public accessors
export function getDeptLineDefault(key) {
  const d = loadDeptDefaults();
  return d[key] || null;
}

export function setDeptLineDefault(key, value) {
  const d = loadDeptDefaults();
  d[key] = value;
  saveDeptDefaults(d);
}

// -----------------------------
// Line Defaults API (legacy ids line1/line2/line3)
// - Maps to dept defaults left/back/right
// - This is what your calc and dept pages expect
// -----------------------------
function mapLineIdToKey(id) {
  return id === 'line1' ? 'left'
       : id === 'line2' ? 'back'
       : id === 'line3' ? 'right'
       : null;
}

// Reads the simplified line defaults used by setup UI.
export function getLineDefaults(id) {
  const key = mapLineIdToKey(id);
  if (!key) return null;

  const L = getDeptLineDefault(key);
  if (!L) return null;

  const seg = (L.itemsMain && L.itemsMain[0]) ? L.itemsMain[0] : {};
  return {
    hose: seg.size || '',
    nozzle: L.nozRight || L._nozId || '',
    length: Number(seg.lengthFt || 0),
    elevation: Number(L.elevationFt || 0),
    name: L.label || '',
  };
}

// Writes simplified line defaults into dept defaults shape.
export function setLineDefaults(id, data) {
  const key = mapLineIdToKey(id);
  if (!key) return;

  const d = loadDeptDefaults();
  const base = d[key] || makeDefaultLine('');

  const hose = String(data?.hose ?? '').trim();
  const nozzle = String(data?.nozzle ?? '').trim();
  const length = Number(data?.length ?? 0);
  const elevation = Number(data?.elevation ?? 0);

  // Keep label if provided in data.name; otherwise keep existing
  const label = (data?.name != null && String(data.name).trim() !== '')
    ? String(data.name).trim()
    : (base.label || '');

  d[key] = {
    ...base,
    label,
    itemsMain: [{ size: hose || (base.itemsMain?.[0]?.size ?? '1.75'), lengthFt: length || (base.itemsMain?.[0]?.lengthFt ?? 200) }],
    elevationFt: elevation,
    nozRight: nozzle || base.nozRight || base._nozId || 'fog_150',
    _nozId: nozzle || base._nozId || base.nozRight || 'fog_150',
  };

  saveDeptDefaults(d);
}

// -----------------------------
// ✅ FIXED: configured preconnect detection
// -----------------------------
export function getConfiguredPreconnects(){
  const keys = ['left','back','right'];
  const out = [];

  function isReal(L){
    if (!L || typeof L !== 'object') return false;
    if (!Array.isArray(L.itemsMain) || !L.itemsMain.length) return false;

    const seg = L.itemsMain[0] || {};
    const len = Number(seg.lengthFt || 0);
    const size = String(seg.size || '').trim();
    const noz  = L.nozRight || L._nozId;

    return len > 0 && (size !== '' || !!noz);
  }

  for (let i = 0; i < keys.length; i++){
    const key = keys[i];

    // Preconnect 1 always exists
    if (i === 0){
      out.push(key);
      continue;
    }

    const L = getDeptLineDefault(key);
    if (isReal(L)) out.push(key);
  }

  return out;
}

// -----------------------------
// Presets
// -----------------------------
export function loadPresets() {
  try {
    const raw = localStorage.getItem(KEY_PRESETS_V1);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
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

// -----------------------------
// Hydraulics helpers
// -----------------------------
export function frictionLossPsi(hoseSize, gpm, lengthFt) {
  const C = COEFF[Number(hoseSize)] || 0;
  if (!C || !gpm || !lengthFt) return 0;

  const q = gpm / 100;
  const L = lengthFt / 100;
  return C * q * q * L;
}

export function elevationPsi(elevationFt) {
  return (Number(elevationFt) || 0) * PSI_PER_FT;
}

// Compute PDP for a single line:
export function computeLinePDP({ hoseSize, gpm, lengthFt, nozzlePsi, elevationFt, applianceLoss }) {
  const fl = frictionLossPsi(hoseSize, gpm, lengthFt);
  const el = elevationPsi(elevationFt);
  const ap = applianceLoss ? applianceLossPsi(gpm) : 0;
  const pdp = (Number(nozzlePsi) || 0) + fl + el + ap;

  return {
    pdp,
    nozzlePsi: Number(nozzlePsi) || 0,
    frictionPsi: fl,
    elevationPsi: el,
    appliancePsi: ap,
  };
}

// -----------------------------
// Seed runtime state.lines from dept defaults
// -----------------------------
function seedRuntimeLinesFromDept() {
  const d = loadDeptDefaults();

  const mk = (key) => {
    const L = d[key] || makeDefaultLine('');
    const seg = (L.itemsMain && L.itemsMain[0]) ? L.itemsMain[0] : { size: '1.75', lengthFt: 200 };
    const noz = getNozzleById(L.nozRight || L._nozId) || getNozzleById('fog_150');

    return {
      key,
      label: L.label || '',
      enabled: (key === 'left'), // only first shown by default
      hoseSize: seg.size || '1.75',
      lengthFt: Number(seg.lengthFt || 200),
      nozzleId: noz?.id || 'fog_150',
      gpm: noz?.gpm || 150,
      nozzlePsi: noz?.np || 100,
      elevationFt: Number(L.elevationFt || 0),
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
    state.lines = seedRuntimeLinesFromDept();
  }
}

export function resetToDeptDefaults() {
  state.lines = seedRuntimeLinesFromDept();
  state.lastUpdatedAt = Date.now();
}

export function setSupplyMode(mode) {
  state.supply = mode;
  state.lastUpdatedAt = Date.now();
}

export function setShowMath(val) {
  state.showMath = !!val;
}

export function setLineEnabled(key, enabled) {
  ensureSeeded();
  if (!state.lines[key]) return;
  state.lines[key].enabled = !!enabled;
  state.lastUpdatedAt = Date.now();
}

export function setLineValue(key, patch) {
  ensureSeeded();
  if (!state.lines[key]) return;
  state.lines[key] = { ...state.lines[key], ...patch };
  state.lastUpdatedAt = Date.now();
}

// Sync runtime line values into dept defaults (optional, if you use “save defaults”)
export function saveRuntimeLineAsDeptDefault(key) {
  ensureSeeded();
  const line = state.lines[key];
  if (!line) return;

  const obj = loadDeptDefaults();
  const base = obj[key] || makeDefaultLine('');

  obj[key] = {
    ...base,
    label: line.label || base.label || '',
    itemsMain: [{ size: String(line.hoseSize || '1.75'), lengthFt: Number(line.lengthFt || 200) }],
    elevationFt: Number(line.elevationFt || 0),
    nozRight: String(line.nozzleId || base.nozRight || base._nozId || 'fog_150'),
    _nozId: String(line.nozzleId || base._nozId || base.nozRight || 'fog_150'),
  };

  saveDeptDefaults(obj);
}

// Initialize on import
ensureSeeded();
