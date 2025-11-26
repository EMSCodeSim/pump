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
 * Nozzle catalog (expanded)
 * ========================= */
export const NOZ = {
  // 1.75″ fog nozzles
  fog95_50:       { id:'fog95_50',      name:'Fog 95 @ 50',        gpm:95,   NP:50 },
  fog125_50:      { id:'fog125_50',     name:'Fog 125 @ 50',       gpm:125,  NP:50 },
  fog150_50:      { id:'fog150_50',     name:'Fog 150 @ 50',       gpm:150,  NP:50 },

  fog95_75:       { id:'fog95_75',      name:'Fog 95 @ 75',        gpm:95,   NP:75 },
  fog125_75:      { id:'fog125_75',     name:'Fog 125 @ 75',       gpm:125,  NP:75 },
  fog150_75:      { id:'fog150_75',     name:'Fog 150 @ 75',       gpm:150,  NP:75 },

  // NEW — very common 1.75″ fog @ 100 psi
  fog150_100:     { id:'fog150_100',    name:'Fog 150 @ 100',      gpm:150,  NP:100 },

  // “Chief” style fogs (your originals)
  chief185_50:    { id:'chief185_50',   name:'Fog 185 @ 50',       gpm:185,  NP:50 },
  chiefXD:        { id:'chiefXD',       name:'Fog 185 @ 50',       gpm:185,  NP:50 },
  chiefXD200_75:  { id:'chiefXD200_75', name:'Fog 200 @ 75',       gpm:200,  NP:75 },
  chiefXD265:     { id:'chiefXD265',    name:'Fog 265 @ 50',       gpm:265,  NP:50 },

  // 2½″ fog nozzles
  fog250_50:      { id:'fog250_50',     name:'2½″ Fog 250 @ 50',   gpm:250,  NP:50 },
  fog250_75:      { id:'fog250_75',     name:'2½″ Fog 250 @ 75',   gpm:250,  NP:75 },

  // Smooth-bores (handline)
  sb7_8:          { id:'sb7_8',         name:'SB 7/8″ @ 50',       gpm:160,  NP:50 },
  sb15_16:        { id:'sb15_16',       name:'SB 15/16″ @ 50',     gpm:185,  NP:50 },

  // 2½″ smooth-bore
  sb1:            { id:'sb1',           name:'SB 1″ @ 50',         gpm:210,  NP:50 },
  sb1_1_8:        { id:'sb1_1_8',       name:'SB 1 1/8″ @ 50',     gpm:265,  NP:50 },
  sb1_1_4:        { id:'sb1_1_4',       name:'SB 1 1/4″ @ 50',     gpm:325,  NP:50 },

  // Master stream smooth-bore (deck gun) @ 80 psi
  ms1_3_8_80:     { id:'ms1_3_8_80',    name:'MS 1 3/8″ @ 80',     gpm:500,  NP:80 },
  ms1_1_2_80:     { id:'ms1_1_2_80',    name:'MS 1 1/2″ @ 80',     gpm:600,  NP:80 },
  ms1_3_4_80:     { id:'ms1_3_4_80',    name:'MS 1 3/4″ @ 80',     gpm:800,  NP:80 },
  ms2_80:         { id:'ms2_80',        name:'MS 2″ @ 80',         gpm:1000, NP:80 },
};

export const NOZ_LIST = Object.values(NOZ);

/* =========================
 * Friction-loss coefficients
 * ========================= */
export const COEFF = {
  '1.5':  24,
  '1.75': 15.5,
  '2.0':  8,
  '2.5':  2,
  '3':    0.8,
  '4':    0.2,
  '5':    0.08,
};

export function sizeLabel(v){
  return v === '1.75' ? '1¾″' : v === '2.5' ? '2½″' : v === '5' ? '5″' : (v || '');
}

/* =========================
 * Hydraulics helpers
 * ========================= */

export const PSI_PER_FT = 0.5;

export function applianceLoss(totalGpm){
  return totalGpm > 350 ? 10 : 0;
}

function flPer100(size, gpm){
  const q = Math.max(0, gpm) / 100;
  const C = COEFF[size] ?? 10;
  return C * q * q;
}

export function FL(gpm, size, lengthFt){
  if(!size || !lengthFt || !gpm) return 0;
  return flPer100(size, gpm) * (lengthFt/100);
}

export function FL_total(gpm, items){
  if(!Array.isArray(items) || !items.length || !gpm) return 0;
  let sum = 0;
  for(const seg of items) sum += FL(gpm, seg.size, seg.lengthFt);
  return sum;
}

export function sumFt(items){
  if(!Array.isArray(items)) return 0;
  return items.reduce((a,c)=> a + (Number(c.lengthFt)||0), 0);
}

export function splitIntoSections(items){
  if(!Array.isArray(items)) return [];
  return items.map(s => ({ size: String(s.size), lengthFt: Number(s.lengthFt)||0 }));
}

/* =========================
 * Line defaults
 * ========================= */
function seedInitialDefaults(){
  if (state.lines) return;
  const L1N = NOZ.chief185_50;
  const L3N = NOZ.chiefXD265;

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

export 
function seedDefaultsForKey(key){
  if(!state.lines) seedInitialDefaults();
  if(state.lines[key]) return state.lines[key];

  // Prefer department-saved defaults for the three front-panel attack lines
  if (key === 'left' || key === 'back' || key === 'right') {
    const deptLine = getDeptLineDefault(key);
    if (deptLine && typeof deptLine === 'object') {
      // Clone so we don't mutate the stored template directly
      state.lines[key] = JSON.parse(JSON.stringify(deptLine));
      return state.lines[key];
    }
  }

  const L1N = NOZ.chief185_50;
  const L3N = NOZ.chiefXD265;

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
      nozRight: null,
    };
  }

  return state.lines[key];
}
/* =========================
 * Wye helpers
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
    return activeSide(L) === 'L'
      ? (L.nozLeft || L.nozRight)
      : (L.nozRight || L.nozLeft);
  }
  return L.nozRight || L.nozLeft || null;
}

export function computeApplianceLoss(totalGpm){
  return applianceLoss(totalGpm);
}

/* =========================
 * Line presets for Settings (Line 1/2/3 defaults)
 * ========================= */
const PRESET_STORAGE_KEY = 'fireops_line_presets_v1';

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

// Default presets used by the Settings → Customize Presets panel.
// These mirror the initial calc layout: Line 1/2 = 200' of 1¾″ @ 185 GPM,
// Line 3 = 250' of 2½″ @ 265 GPM.
function defaultPresets(){
  return {
    left:  { len: 200, size: '1.75', noz: 'chief185_50' },
    back:  { len: 200, size: '1.75', noz: 'chief185_50' },
    right: { len: 250, size: '2.5',  noz: 'chiefXD265'  },
  };
}

// Make sure whatever we load looks like the structure Settings expects
function normalizePresets(obj){
  if (!obj || typeof obj !== 'object') return defaultPresets();
  const hasShape =
    obj.left  && typeof obj.left.len  === 'number' && obj.left.size  && obj.left.noz &&
    obj.back  && typeof obj.back.len  === 'number' && obj.back.size  && obj.back.noz &&
    obj.right && typeof obj.right.len === 'number' && obj.right.size && obj.right.noz;

  if (hasShape) return obj;

  // If the stored value is from an older version (standpipe/foam/etc), ignore it.
  const def = defaultPresets();
  try { writeStorage(def); } catch {}
  return def;
}

export function loadPresets(){
  const fromStore = readStorage();
  if(fromStore) return normalizePresets(fromStore);
  if(state._presetsMem) return normalizePresets(state._presetsMem);
  const def = defaultPresets();
  state._presetsMem = def;
  return def;
}

export function savePresets(presetsObj){
  if(!presetsObj || typeof presetsObj !== 'object') return false;
  const norm = normalizePresets(presetsObj);
  state._presetsMem = norm;
  return writeStorage(norm);
}/* =========================
 * Small utils
 * ========================= */
export function round1(n){ return Math.round((Number(n)||0)*10)/10; }



// === Department Defaults Persistence (added) ===
const DEPT_STORAGE_KEY = 'pump_dept_defaults_v1';

function readDeptStorage(){
  try {
    const raw = localStorage.getItem(DEPT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e){
    return null;
  }
}

function writeDeptStorage(obj){
  try {
    localStorage.setItem(DEPT_STORAGE_KEY, JSON.stringify(obj));
    return true;
  } catch(e){
    return false;
  }
}

export function loadDeptDefaults(){
  const from = readDeptStorage();
  if(from) return from;

  // If none found, seed from initial lines in memory
  return {
    left:  JSON.parse(JSON.stringify(state.lines.left)),
    back:  JSON.parse(JSON.stringify(state.lines.back)),
    right: JSON.parse(JSON.stringify(state.lines.right)),
  };
}

export function saveDeptDefaults(obj){
  if(!obj) return false;
  return writeDeptStorage(obj);
}

export function getDeptLineDefault(key){
  const all = loadDeptDefaults();
  return all[key] || null;
}

export function setDeptLineDefault(key, data){
  const all = loadDeptDefaults();
  all[key] = data;
  saveDeptDefaults(all);
}
