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

// Hose sizes used in Department Setup and Charts (must stay in sync with view.charts.js)
export const HOSES_MATCHING_CHARTS = [
  { id: '1.75', label: '1¾"' },
  { id: '2.5',  label: '2½"' },
  { id: '4',    label: '4"'  },
  { id: '5',    label: '5"'  },
];


// Department-scoped UI lists for hoses and nozzles.
// These are populated when Department Setup is saved, and
// reused by line editors / calc as a single source of truth.
export let DEPT_UI_NOZZLES = [];
export let DEPT_UI_HOSES = [];

export function setDeptUiNozzles(list) {
  DEPT_UI_NOZZLES = Array.isArray(list) ? list : [];
}

export function setDeptUiHoses(list) {
  DEPT_UI_HOSES = Array.isArray(list) ? list : [];
}


/* =========================
 * Hose ID → diameter normalization
 * ========================= */
const HOSE_ID_TO_DIA = {
  'h_1':        '1',
  'h_15':       '1.5',
  'h_175':      '1.75',
  'h_2':        '2.0',
  'h_25':       '2.5',
  'h_3':        '3',
  'h_3_supply': '3',
  'h_4_ldh':    '4',
  'h_5_ldh':    '5',
  'h_w_1':      '1',
  'h_w_15':     '1.5',
  'h_booster_1':'1',
  'h_lf_175':   '1.75',
  'h_lf_2':     '2.0',
  'h_lf_25':    '2.5',
  'h_lf_5':     '5',
};

function normalizeHoseDiameter(input){
  if (input == null) return '';
  const s = String(input).trim();
  if (!s) return '';
  const mapped = HOSE_ID_TO_DIA[s];
  if (mapped) return mapped;

  // already a diameter string
  if (/^\d+(?:\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return '';
    // canonicalize 2" to '2.0' because COEFF uses that key
    if (Math.abs(n - 2) < 1e-9) return '2.0';
    // keep 1.75 / 2.5 / 4 / 5 etc as-is
    return String(s);
  }
  return '';
}

/* =========================
 * Nozzle ID normalization (compat)
 * ========================= */

// Legacy Department Setup nozzle IDs → internal NOZ ids
const LEGACY_NOZ_ID_MAP = {
  // smooth bores
  'sb_78_50_160':   'sb7_8',
  'sb_1516_50_185': 'sb15_16',
  'sb_1_50_210':    'sb1',
  'sb_1118_50_265': 'sb1_1_8',
  'sb_114_50_325':  'sb1_1_4',

  // fog (incl Chief XD legacy ids used by older dept equipment storage)
  'fog_xd_175_50_165': 'chiefXD165_50',
  'fog_xd_175_50_185': 'chief185_50',
  'fog_xd_25_50_265':  'chiefXD265_50',
};

function canonicalNozzleId(raw){
  const id = String(raw || '').trim();
  if (!id) return '';
  return LEGACY_NOZ_ID_MAP[id] || id;
}

function resolveNozzleById(raw){
  const id = canonicalNozzleId(raw);
  if (!id) return null;
  if (NOZ && NOZ[id]) return NOZ[id];
  // Common legacy: ids saved without NP suffix (e.g. 'chiefXD265' instead of 'chiefXD265_50')
  if (NOZ && NOZ[id + '_50']) return NOZ[id + '_50'];
  // Safety fallback: search list (covers future catalog shapes)
  return (Array.isArray(NOZ_LIST) ? NOZ_LIST : []).find(n => n && String(n.id) === id) || null;
}


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

  // Chief XD fogs (expanded)
  chiefXD165_50:  { id:'chiefXD165_50', name:'Chief XD 1¾″ 165 gpm @ 50 psi', gpm:165, NP:50 },
  chief185_50:    { id:'chief185_50',   name:'Chief XD 1¾″ 185 gpm @ 50 psi', gpm:185, NP:50 },
  chiefXD:        { id:'chiefXD',       name:'Chief XD 1¾″ 185 gpm @ 50 psi', gpm:185, NP:50 },
  chiefXD200_75:  { id:'chiefXD200_75', name:'Chief XD 1¾″ 200 gpm @ 75 psi', gpm:200,  NP:75 },
  chiefXD265:     { id:'chiefXD265',    name:'Chief XD 2½″ 265 gpm @ 50 psi', gpm:265,  NP:50 },

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
  ms1_3_8_80:     { id:'ms1_3_8_80',    name:'MS 1 3/8″ @ 80',     gpm:502,  NP:80 },
  ms1_1_2_80:     { id:'ms1_1_2_80',    name:'MS 1 1/2″ @ 80',     gpm:598,  NP:80 },
  ms1_3_4_80:     { id:'ms1_3_4_80',    name:'MS 1 3/4″ @ 80',     gpm:814,  NP:80 },
  ms2_80:         { id:'ms2_80',        name:'MS 2″ @ 80',         gpm:1063, NP:80 },

  // Added to align with DEPT_NOZZLE_LIBRARY
  fog175_50:      { id:'fog175_50',     name:'Fog 175 @ 50',       gpm:175,  NP:50 },
  fog185_50:      { id:'fog185_50',     name:'Fog 185 @ 50',       gpm:185,  NP:50 },
  fog200_50:      { id:'fog200_50',     name:'Fog 200 @ 50',       gpm:200,  NP:50 },
  fog265_50:      { id:'fog265_50',     name:'Fog 265 @ 50',       gpm:265,  NP:50 },

  fog95_100:      { id:'fog95_100',     name:'Fog 95 @ 100',       gpm:95,   NP:100 },
  fog125_100:     { id:'fog125_100',    name:'Fog 125 @ 100',      gpm:125,  NP:100 },
  fog175_100:     { id:'fog175_100',    name:'Fog 175 @ 100',      gpm:175,  NP:100 },
  fog200_100:     { id:'fog200_100',    name:'Fog 200 @ 100',      gpm:200,  NP:100 },
  fog250_100:     { id:'fog250_100',    name:'Fog 250 @ 100',      gpm:250,  NP:100 },

  // Additional smooth-bore handline tips
  sb12_50:        { id:'sb12_50',       name:'SB 1/2″ @ 50',       gpm:50,   NP:50 },
  sb5_8_50:       { id:'sb5_8_50',      name:'SB 5/8″ @ 50',       gpm:80,   NP:50 },
  sb3_4_50:       { id:'sb3_4_50',      name:'SB 3/4″ @ 50',       gpm:120,  NP:50 },

  // Master stream fogs
  fog500_100:     { id:'fog500_100',    name:'Master Fog 500 @ 100',  gpm:500,  NP:100 },
  fog750_100:     { id:'fog750_100',    name:'Master Fog 750 @ 100',  gpm:750,  NP:100 },
  fog1000_100:    { id:'fog1000_100',   name:'Master Fog 1000 @ 100', gpm:1000, NP:100 },

  // Specialty examples
  piercing100_100:{ id:'piercing100_100', name:'Piercing 100 @ 100', gpm:100, NP:100 },
  cellar250_100:  { id:'cellar250_100',   name:'Cellar 250 @ 100',   gpm:250, NP:100 },
  breaker30_100:  { id:'breaker30_100',   name:'Breaker 30 @ 100',   gpm:30,  NP:100 },

};

export const NOZ_LIST = Object.values(NOZ);

export function getDeptNozzles() {
  // Canonical nozzle list for all UIs:
  // 1) Department Setup UI-selected list, if any
  // 2) Otherwise full catalog so dropdowns are never empty.
  if (Array.isArray(DEPT_UI_NOZZLES) && DEPT_UI_NOZZLES.length) {
    return DEPT_UI_NOZZLES;
  }
  return Array.isArray(NOZ_LIST) ? NOZ_LIST : [];
}

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

  // No built-in attack line defaults anymore.
  // Lines 1/2/3 become "blank" until the user saves them in Department Setup.
  state.lines = {
    left:  {
      label: 'Line 1',
      visible: false,
      itemsMain: [],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: null,
    },
    back:  {
      label: 'Line 2',
      visible: false,
      itemsMain: [],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: null,
    },
    right: {
      label: 'Line 3',
      visible: false,
      itemsMain: [],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: null,
    }
  };
}
seedInitialDefaults();

export function seedDefaultsForKey(key){
  if(!state.lines) seedInitialDefaults();

  // If we already have a real (non-placeholder) line, keep it.
  const existing = state.lines ? state.lines[key] : null;
  const isPlaceholder = (L) => !!L && Array.isArray(L.itemsMain) && L.itemsMain.length === 0
    && Array.isArray(L.itemsLeft) && L.itemsLeft.length === 0
    && Array.isArray(L.itemsRight) && L.itemsRight.length === 0
    && !L.nozRight && !L.nozLeft
    && !L.hasWye;

  // Prefer department-saved defaults
  // (and replace blank placeholders with the dept template).

  if (key === 'left' || key === 'back' || key === 'right') {
    const deptLine = getDeptLineDefault(key);

    // Only seed from department defaults when the existing line is missing or still blank/placeholder.
    // This prevents overwriting live state (e.g., retracting a line or changing settings on calc screen).
    if (deptLine && typeof deptLine === 'object' && (!existing || isPlaceholder(existing))) {
      // Clone so we don't mutate the stored template directly
      const seeded = JSON.parse(JSON.stringify(deptLine));
      // Preserve current visibility if we had an existing line object
      if (existing && typeof existing.visible === 'boolean') seeded.visible = existing.visible;
      state.lines[key] = seeded;
      return state.lines[key];
    }
  }
  if (existing && !isPlaceholder(existing)) return existing;


  // No built-in creation for left/back/right here.
  // They are seeded blank in seedInitialDefaults(), and only filled when Department Setup saves a template.

  if (key === 'left' || key === 'back' || key === 'right') {
    return state.lines[key];
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
  // 1) Preferred: full line objects saved in this module's storage (pump_dept_defaults_v1)
  const all = loadDeptDefaults();
  const candidate = all ? all[key] : null;
  if (candidate && typeof candidate === 'object' && Array.isArray(candidate.itemsMain)) {
    return candidate;
  }

  // 2) Compatibility: simple line defaults saved by deptState.js (fireops_line_defaults_v1)
  //    Shape: { '1': { hose, nozzle, length, elevation }, ... }
  try{
    const raw = localStorage.getItem('fireops_line_defaults_v1');
    if (!raw) return candidate || null;
    const parsed = JSON.parse(raw) || {};
    const map = (key === 'left') ? '1' : (key === 'back') ? '2' : (key === 'right') ? '3' : null;
    if (!map || !parsed[map]) return candidate || null;

    const d = parsed[map] || {};
    const hose = String(d.hose ?? d.size ?? d.diameter ?? '1.75');
    const len  = Number(d.length ?? d.len ?? 200) || 200;
    const elev = Number(d.elevation ?? d.elev ?? d.elevFt ?? 0) || 0;
    const nozId = String(d.nozzle ?? d.noz ?? d.nozId ?? '') || '';

    const nozObj = resolveNozzleById(nozId);

    const label = (key === 'left') ? 'Line 1' : (key === 'back') ? 'Line 2' : (key === 'right') ? 'Line 3' : 'Line';

    const built = {
      label,
      visible: false,
      itemsMain: [{ size: hose, lengthFt: len }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: elev,
      nozRight: nozObj || null,
    };

    // Persist the converted full object so subsequent loads are consistent.
    try{
      const full = loadDeptDefaults() || {};
      full[key] = built;
      saveDeptDefaults(full);
    }catch(_){/* ignore */}

    return built;
  }catch(e){
    return candidate || null;
  }
}

export function setDeptLineDefault(key, data){
  const all = loadDeptDefaults();
  all[key] = data;
  saveDeptDefaults(all);
}


// === Simple Line Defaults API for Department Setup =====================
// Used by view.department.js for Line 1 / Line 2 / Line 3 panels.
// Shape: { hose, nozzle, length, elevation } where:
//   - hose: hose id / diameter string (e.g. "1.75", "2.5")
//   - nozzle: internal nozzle id from NOZ (e.g. "fog150_50", "chiefXD165_50")
//   - length: number of feet
//   - elevation: elevation gain in feet
export function getLineDefaults(id){
  const key =
    id === 'line1' ? 'left' :
    id === 'line2' ? 'back' :
    id === 'line3' ? 'right' :
    null;

  const blank = { hose:'', nozzle:'', length:0, elevation:0 };
  if (!key) return blank;

  // Prefer saved department defaults
  const src = getDeptLineDefault(key);
  const L = (src && typeof src === 'object')
    ? src
    : seedDefaultsForKey(key);

  if (!L || typeof L !== 'object') return blank;

  const main = Array.isArray(L.itemsMain) && L.itemsMain[0]
    ? L.itemsMain[0]
    : {};

  return {
    hose: normalizeHoseDiameter(main.size || ''),
    nozzle: (L.nozRight && L.nozRight.id) || '',
    length: Number(main.lengthFt || 0),
    elevation: Number(L.elevFt || 0),
  };
}


// Returns a calc-ready snapshot of department line defaults for Line 1/2/3.
// Shape:
// {
//   line1: { hoseDiameter, nozzleId, lengthFt, elevationFt },
//   line2: { ... },
//   line3: { ... },
// }
export function getDeptLineDefaults(){
  // Calc deploy (seedDefaultsForKey) ultimately reads from pump_dept_defaults_v1 (left/back/right).
  // These helpers expose that same data in a simple shape for view.calc.main.js.
  //
  // IMPORTANT: getLineDefaults() in this module expects 'line1'|'line2'|'line3' (not '1'|'2'|'3').
  const l1 = getLineDefaults('line1') || {};
  const l2 = getLineDefaults('line2') || {};
  const l3 = getLineDefaults('line3') || {};

  const fallback = {
    line1: { hoseDiameter: '1.75', nozzleId: 'chief185_50', lengthFt: 200, elevationFt: 0 },
    line2: { hoseDiameter: '1.75', nozzleId: 'chief185_50', lengthFt: 200, elevationFt: 0 },
    line3: { hoseDiameter: '1.75', nozzleId: 'chief185_50', lengthFt: 200, elevationFt: 0 },
  };

  // Normalize minimal shapes expected by view.calc.main.js
  function norm(src, fb){
    const o = (src && typeof src === 'object') ? src : {};
    return {
      hoseDiameter: String(o.hoseDiameter ?? o.hose ?? fb.hoseDiameter),
      nozzleId: String(o.nozzleId ?? o.nozzle ?? fb.nozzleId),
      lengthFt: Number(o.lengthFt ?? o.length ?? fb.lengthFt) || fb.lengthFt,
      elevationFt: Number(o.elevationFt ?? o.elevation ?? fb.elevationFt) || fb.elevationFt,
    };
  }

  return {
    line1: norm(l1, fallback.line1),
    line2: norm(l2, fallback.line2),
    line3: norm(l3, fallback.line3),
  };
}


export function setLineDefaults(id, data){
  const key =
    id === 'line1' ? 'left' :
    id === 'line2' ? 'back' :
    id === 'line3' ? 'right' :
    null;
  if (!key || !data || typeof data !== 'object') return;

  const hoseIdRaw = data.hose != null ? String(data.hose) : '';
  const hoseId = normalizeHoseDiameter(hoseIdRaw) || hoseIdRaw;
  const len    = data.length != null ? Number(data.length) : 0;
  const elev   = data.elevation != null ? Number(data.elevation) : 0;
  const nozId  = data.nozzle != null ? String(data.nozzle) : '';

  const label =
    key === 'left'  ? 'Line 1' :
    key === 'back'  ? 'Line 2' :
    key === 'right' ? 'Line 3' :
    '';

  const main = {
    size: normalizeHoseDiameter(hoseId) || '1.75',
    lengthFt: len || 200,
  };

  const L = {
    label,
    visible: false,
    itemsMain: [main],
    itemsLeft: [],
    itemsRight: [],
    hasWye: false,
    elevFt: elev || 0,
    nozRight: resolveNozzleById(nozId),
  };

  setDeptLineDefault(key, L);
}

