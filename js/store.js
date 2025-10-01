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
  _presetsMem: null,   // in-memory fallback if localStorage not available
};

/* =========================
 * Visual constants
 * ========================= */
export const COLORS = {
  '1.75': '#ff4545',   // red
  '2.5' : '#2e6cff',   // blue
  '5'   : '#ffd23a',   // yellow
};

/* =========================
 * Nozzle catalog (common)
 * ========================= */
export const NOZ = {
  // Fogs
  fog95_50:      { id:'fog95_50',      name:'Fog 95 @ 50',   gpm:95,  NP:50 },
  fog150_75:     { id:'fog150_75',     name:'Fog 150 @ 75',  gpm:150, NP:75 },

  // “Chief” fogs seen in your files
  chief185_50:   { id:'chief185_50',   name:'Fog 185 @ 50',  gpm:185, NP:50 },
  chiefXD:       { id:'chiefXD',       name:'Fog 185 @ 50',  gpm:185, NP:50 },   // alias
  chiefXD265:    { id:'chiefXD265',    name:'Fog 265 @ 50',  gpm:265, NP:50 },

  // Smooth bores
  sb7_8:         { id:'sb7_8',         name:'SB 7/8″ @ 50',  gpm:160, NP:50 },
  sb1_1_8:       { id:'sb1_1_8',       name:'SB 1 1/8″ @ 50',gpm:265, NP:50 },
};
export const NOZ_LIST = Object.values(NOZ);

/* =========================
 * Friction-loss coefficients (per 100 ft formula)
 *   FL_100 = C * (GPM/100)^2
 * Exported for Practice/Charts views.
 * ========================= */
export const COEFF = {
  '1.5':  24,    // optional/common reference (not used by default lines)
  '1.75': 15,
  '2.0':  8,     // optional/common reference
  '2.5':  2,
  '3':    0.8,   // optional/common reference
  '4':    0.2,   // optional/common reference
  '5':    0.08,
};

/* Pretty size label for UI */
export function sizeLabel(v){
  return v === '1.75' ? '1¾″' : v === '2.5' ? '2½″' : v === '5' ? '5″' : (v || '');
}

/* =========================
 * Hydraulics helpers
 * ========================= */

/** NFPA elevation: 0.5 psi per 10 ft -> 0.05 psi/ft */
export const PSI_PER_FT = 0.5;

/** Appliance loss: +10 psi only when total flow exceeds 350 gpm */
export function applianceLoss(totalGpm){
  return totalGpm > 350 ? 10 : 0;
}

/** Internal: pick C for size */
function flPer100(size, gpm){
  const q = Math.max(0, gpm) / 100;
  const C = COEFF[size] ?? 10; // fallback
  return C * q * q;
}

/** Friction loss for a single segment (psi) */
export function FL(gpm, size, lengthFt){
  if(!size || !lengthFt || !gpm) return 0;
  return flPer100(size, gpm) * (lengthFt/100);
}

/** Sum friction loss across segments */
export function FL_total(gpm, items){
  if(!Array.isArray(items) || !items.length || !gpm) return 0;
  let sum = 0;
  for(const seg of items) sum += FL(gpm, seg.size, seg.lengthFt);
  return sum;
}

/** Sum length (ft) */
export function sumFt(items){
  if(!Array.isArray(items)) return 0;
  return items.reduce((a,c)=> a + (Number(c.lengthFt)||0), 0);
}

/** Keep section list stable (UI can show each authored segment) */
export function splitIntoSections(items){
  if(!Array.isArray(items)) return [];
  return items.map(s => ({ size: String(s.size), lengthFt: Number(s.lengthFt)||0 }));
}

/* =========================
 * Line defaults (start hidden)
 * ========================= */
/*
  L1: 200′ of 1¾″, 185 @ 50 (hidden)
  L2: 200′ of 1¾″, 185 @ 50 (hidden)
  L3: 250′ of 2½″, 265 @ 50 (hidden)
*/
function seedInitialDefaults(){
  if (state.lines) return;
  const L1N = NOZ.chief185_50;
  const L3N = NOZ.sb1_1_8;

  state.lines = {
    left:  {
      label: 'Line 1',
      visible: false,
      itemsMain: [{ size:'1.75', lengthFt:200 }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: L1N,
    },
    back:  {
      label: 'Line 2',
      visible: false,
      itemsMain: [{ size:'1.75', lengthFt:200 }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: L1N,
    },
    right: {
      label: 'Line 3',
      visible: false,
      itemsMain: [{ size:'2.5', lengthFt:250 }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: L3N,
    }
  };
}
seedInitialDefaults();

/** Ensure a line exists without overwriting user edits */
export function seedDefaultsForKey(key){
  if(!state.lines) seedInitialDefaults();
  if(state.lines[key]) return state.lines[key];

  const L1N = NOZ.chief185_50;
  const L3N = NOZ.sb1_1_8;

  if(key === 'left'){
    state.lines.left = {
      label: 'Line 1',
      visible: false,
      itemsMain: [{ size:'1.75', lengthFt:200 }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: L1N,
    };
  } else if(key === 'back'){
    state.lines.back = {
      label: 'Line 2',
      visible: false,
      itemsMain: [{ size:'1.75', lengthFt:200 }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: L1N,
    };
  } else if(key === 'right'){
    state.lines.right = {
      label: 'Line 3',
      visible: false,
      itemsMain: [{ size:'2.5', lengthFt:250 }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: L3N,
    };
  } else {
    state.lines[key] = {
      label: key,
      visible: false,
      itemsMain: [],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: NOZ_LIST[0] || null,
    };
  }
  return state.lines[key];
}

/* =========================
 * Wye convenience helpers
 * ========================= */
export function isSingleWye(L){
  if(!L || !L.hasWye) return false;
  const leftLen  = sumFt(L.itemsLeft || []);
  const rightLen = sumFt(L.itemsRight || []);
  const leftOn   = leftLen > 0 || !!L.nozLeft;
  const rightOn  = rightLen > 0 || !!L.nozRight;
  return (leftOn && !rightOn) || (!leftOn && rightOn);
}
export function activeSide(L){
  if(!L) return 'R';
  const l = sumFt(L.itemsLeft || []);
  const r = sumFt(L.itemsRight || []);
  if(l > 0 && r <= 0) return 'L';
  if(r > 0 && l <= 0) return 'R';
  return 'R';
}
export function activeNozzle(L){
  if(!L) return null;
  if(isSingleWye(L)){
    return activeSide(L) === 'L' ? (L.nozLeft || L.nozRight) : (L.nozRight || L.nozLeft);
  }
  return L.nozRight || L.nozLeft || null;
}

/* Convenience alias */
export function computeApplianceLoss(totalGpm){
  return applianceLoss(totalGpm);
}

/* =========================
 * Presets (with persistence)
 * ========================= */
const PRESET_STORAGE_KEY = 'pump_presets_v1';

function hasStorage(){
  try {
    return typeof window !== 'undefined'
        && typeof window.localStorage !== 'undefined';
  } catch { return false; }
}

function readStorage(){
  if(!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeStorage(obj){
  if(!hasStorage()) { state._presetsMem = obj; return true; }
  try {
    window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(obj));
    return true;
  } catch { return false; }
}

function defaultPresets(){
  return {
    standpipe: {
      name: 'Standpipe',
      main: [{ size:'2.5', lengthFt:0 }],
      elevFt: 60,
      hasWye: false,
      nozzle: NOZ.fog150_75,
      supply: 'pressurized',
    },
    sprinkler: {
      name: 'Sprinkler',
      main: [{ size:'2.5', lengthFt:50 }],
      elevFt: 0,
      hasWye: false,
      nozzle: NOZ.fog150_75,
      supply: 'pressurized',
    },
    foam: {
      name: 'Foam',
      main: [{ size:'1.75', lengthFt:200 }],
      elevFt: 0,
      hasWye: false,
      nozzle: NOZ.chief185_50,
      supply: 'off',
    },
    monitor: {
      name: 'Monitor',
      main: [{ size:'2.5', lengthFt:200 }],
      elevFt: 0,
      hasWye: false,
      nozzle: NOZ.sb1_1_8,
      supply: 'off',
    },
    aerial: {
      name: 'Aerial',
      main: [{ size:'2.5', lengthFt:150 }],
      elevFt: 80,
      hasWye: false,
      nozzle: NOZ.sb1_1_8,
      supply: 'pressurized',
    },
  };
}

/** Read presets (storage -> memory -> defaults) */
export function loadPresets(){
  const fromStore = readStorage();
  if(fromStore) return fromStore;
  if(state._presetsMem) return state._presetsMem;
  const d = defaultPresets();
  // do not auto-write defaults; let callers save only when modified
  return d;
}

/** Persist presets for Settings page & others */
export function savePresets(presetsObj){
  // basic validation: must be an object
  if(!presetsObj || typeof presetsObj !== 'object') return false;
  state._presetsMem = presetsObj; // in-memory fallback
  return writeStorage(presetsObj);
}

/* =========================
 * Small utils
 * ========================= */
export function round1(n){ return Math.round((Number(n)||0)*10)/10; }
