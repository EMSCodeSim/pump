// store.js
// Central app state, nozzle catalog, presets, and hydraulic helpers.
// - Lines start hidden; supply starts 'off' (user chooses).
// - NFPA elevation: PSI_PER_FT = 0.05 (0.5 psi / 10 ft).

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

/* =========================
 * Persisted "store" object (used by Department Setup UI)
 * ========================= */
const STORE_KEY = 'fireops_store_v1';

function safeParse(json, fallback){
  try{ return JSON.parse(json); }catch(e){ return fallback; }
}
function safeStringify(obj){
  try{ return JSON.stringify(obj); }catch(e){ return 'null'; }
}

export const store = getStore();

export function getStore(){
  const raw = localStorage.getItem(STORE_KEY);
  const obj = safeParse(raw, null);
  if (obj && typeof obj === 'object') return obj;
  return {
    hoses: [],
    nozzles: [],
    appliances: [],
    updatedAt: Date.now(),
  };
}

export function saveStore(obj){
  const out = obj && typeof obj === 'object' ? obj : {};
  out.updatedAt = Date.now();
  localStorage.setItem(STORE_KEY, safeStringify(out));
}

/* =========================
 * Hose + nozzle libraries
 * ========================= */

// Coefficients for standard hose sizes
export const COEFF = {
  '1.5': 24,
  '1.75': 15.5,
  '2': 8,
  '2.5': 2,
  '3': 0.8,
  '4': 0.2,
  '5': 0.08,
};

export const PSI_PER_FT = 0.05;

// Nozzle list
export const NOZ_LIST = [
  // Fog
  { id: 'fog95_50',  label: 'Fog 95 @ 50',  gpm: 95,  np: 50, type: 'fog' },
  { id: 'fog125_50', label: 'Fog 125 @ 50', gpm: 125, np: 50, type: 'fog' },
  { id: 'fog150_50', label: 'Fog 150 @ 50', gpm: 150, np: 50, type: 'fog' },
  { id: 'fog185_50', label: 'Fog 185 @ 50', gpm: 185, np: 50, type: 'fog' },
  { id: 'fog250_50', label: 'Fog 250 @ 50', gpm: 250, np: 50, type: 'fog' },

  // Smooth bore
  { id: 'sb7_8',   label: 'Smooth Bore 7/8" (160 @ 50)',   gpm: 160, np: 50, type: 'sb' },
  { id: 'sb15_16', label: 'Smooth Bore 15/16" (185 @ 50)', gpm: 185, np: 50, type: 'sb' },
  { id: 'sb1',     label: 'Smooth Bore 1" (210 @ 50)',     gpm: 210, np: 50, type: 'sb' },
  { id: 'sb1_1_8', label: 'Smooth Bore 1-1/8" (265 @ 50)', gpm: 265, np: 50, type: 'sb' },

  // Master stream
  { id: 'ms500_80', label: 'Master Stream 500 @ 80', gpm: 500, np: 80, type: 'ms' },
  { id: 'ms750_80', label: 'Master Stream 750 @ 80', gpm: 750, np: 80, type: 'ms' },
];

// Convenience mapping
export const NOZ = Object.fromEntries(N OZ_LIST.map(n => [n.id, n]));

// Legacy nozzle id normalization (keeps nozzle dropdown from "sticking")
export function canonicalNozzleId(id){
  const s = String(id ?? '').trim();
  if (!s) return '';
  if (s === 'sb_78_50_160' || s === 'sb_7_8' || s === 'sb78' || s === 'sb_78') return 'sb7_8';
  if (s === 'sb_1516_50_185' || s === 'sb_15_16' || s === 'sb1516' || s === 'sb_1516') return 'sb15_16';
  if (s === 'sb_1_50_210') return 'sb1';
  if (s === 'sb_118_50_265' || s === 'sb_1_1_8') return 'sb1_1_8';
  return s;
}

export function resolveNozzleById(id){
  const nid = canonicalNozzleId(id);
  return NOZ_LIST.find(n => n.id === nid) || null;
}

export function normalizeHoseDiameter(v){
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (s === '1 1/2' || s === '1.5' || s === '1½') return '1.5';
  if (s === '1 3/4' || s === '1.75' || s === '1¾') return '1.75';
  if (s === '2') return '2';
  if (s === '2 1/2' || s === '2.5' || s === '2½') return '2.5';
  if (s === '3') return '3';
  if (s === '4') return '4';
  if (s === '5') return '5';
  return s;
}

export function sizeLabel(size){
  const s = normalizeHoseDiameter(size);
  if (s === '1.5') return '1 1/2"';
  if (s === '1.75') return '1 3/4"';
  if (s === '2.5') return '2 1/2"';
  return s ? `${s}"` : '—';
}

export function round1(x){ return Math.round((Number(x)||0) * 10) / 10; }

/* =========================
 * Dept selection (hoses/nozzles)
 * ========================= */
const LS_DEPT_HOSES = 'fireops_dept_hoses_v1';
const LS_DEPT_NOZZ  = 'fireops_dept_nozzles_v1';

export function setSelectedHoses(arr){
  localStorage.setItem(LS_DEPT_HOSES, safeStringify(arr||[]));
}
export function setSelectedNozzles(arr){
  localStorage.setItem(LS_DEPT_NOZZ, safeStringify(arr||[]));
}
export function getDeptHoses(){
  const raw = localStorage.getItem(LS_DEPT_HOSES);
  const arr = safeParse(raw, null);
  return Array.isArray(arr) ? arr : [];
}
export function getDeptNozzles(){
  const raw = localStorage.getItem(LS_DEPT_NOZZ);
  const arr = safeParse(raw, null);
  return Array.isArray(arr) ? arr : [];
}
export function setDeptUiHoses(arr){ setSelectedHoses(arr); }
export function setDeptUiNozzles(arr){ setSelectedNozzles(arr); }

// Custom hose/nozzle helpers used by Dept Setup
export function addCustomHose(h){ 
  const s = getStore();
  s.hoses = Array.isArray(s.hoses) ? s.hoses : [];
  s.hoses.push(h);
  saveStore(s);
}
export function addCustomNozzle(n){
  const s = getStore();
  s.nozzles = Array.isArray(s.nozzles) ? s.nozzles : [];
  s.nozzles.push(n);
  saveStore(s);
}

/* =========================
 * Hydraulics
 * ========================= */

// Friction Loss: FL = C * (Q^2) * (L/100), Q in hundreds of gpm
export function FL(gpm, size, lengthFt, cValue=null){
  const dia = normalizeHoseDiameter(size);
  const C = (cValue && Number.isFinite(Number(cValue))) ? Number(cValue) : (COEFF[dia] ?? 0);
  const Q = (Number(gpm) || 0) / 100;
  const L = (Number(lengthFt) || 0) / 100;
  return C * (Q * Q) * L;
}

export function FL_total(gpm, items){
  if(!Array.isArray(items) || !items.length || !gpm) return 0;
  let sum = 0;
  for(const seg of items){
    const size = (seg?.size ?? seg?.hose ?? seg?.hoseDiameter ?? seg?.dia ?? seg?.diameter ?? seg?.hoseSize ?? seg?.hoseDia);
    const len  = (seg?.lengthFt ?? seg?.length ?? seg?.len);
    sum += FL(gpm, size, len, seg?.cValue);
  }
  return sum;
}

export function sumFt(items){
  if(!Array.isArray(items)) return 0;
  return items.reduce((a,c)=> a + (Number(c.lengthFt)||0), 0);
}

export function splitIntoSections(items){
  if(!Array.isArray(items)) return [];
  return items.map(s => ({
    // Accept legacy keys so first-run / migrated defaults never render blank hose size
    size: String(s?.size ?? s?.hose ?? s?.hoseDiameter ?? s?.dia ?? s?.diameter ?? s?.hoseSize ?? s?.hoseDia ?? ''),
    lengthFt: Number(s?.lengthFt ?? s?.length ?? s?.len ?? 0) || 0,
    cValue: (Number.isFinite(Number(s?.cValue)) && Number(s?.cValue)>0) ? Number(s.cValue) : null,
  }));
}

export function applianceLoss(totalGpm){
  return (Number(totalGpm) || 0) > 350 ? 10 : 0;
}

export function computeApplianceLoss(totalGpm){
  return applianceLoss(totalGpm);
}

/* =========================
 * Presets storage
 * ========================= */
const PRESETS_KEY = 'fireops_presets_v1';
export function loadPresets(){
  try{
    const raw = localStorage.getItem(PRESETS_KEY);
    const arr = safeParse(raw, null);
    if (Array.isArray(arr)) return arr;
  }catch(e){}
  return [];
}
export function savePresets(presets){
  try{ localStorage.setItem(PRESETS_KEY, safeStringify(presets || [])); }catch(e){}
}

/* =========================
 * Department Defaults (full line objects)
 * ========================= */
const DEPT_DEFAULTS_KEY = 'pump_dept_defaults_v1';

export function loadDeptDefaults(){
  try{
    const raw = localStorage.getItem(DEPT_DEFAULTS_KEY);
    const obj = safeParse(raw, null);
    if (obj && typeof obj === 'object') return obj;
  }catch(e){}
  return null;
}

export function saveDeptDefaults(obj){
  try{ localStorage.setItem(DEPT_DEFAULTS_KEY, safeStringify(obj || {})); }catch(e){}
}

export function getDeptLineDefaults(){
  const all = loadDeptDefaults();
  return all && typeof all === 'object' ? all : {};
}

export function setDeptLineDefault(key, obj){
  const all = loadDeptDefaults() || {};
  all[key] = obj;
  saveDeptDefaults(all);
}

export function getDeptLineDefault(key){
  // 1) Preferred: full line objects saved in this module's storage (pump_dept_defaults_v1)
  const all = loadDeptDefaults();
  const candidate = all ? all[key] : null;

  // First-run fallback: if nothing is saved yet, return a sane default template
  const firstRunFallback = () => {
    const label = (key === 'left') ? 'Line 1'
               : (key === 'back') ? 'Line 2'
               : (key === 'right') ? 'Line 3'
               : 'Line';

    // Default: 200' of 1¾" with Fog 150 @ 50
    const hose = '1.75';
    const len  = 200;
    const elev = 0;
    const nozObj = resolveNozzleById('fog150_50') || null;

    return {
      label,
      visible: false,
      itemsMain: [{ size: normalizeHoseDiameter(hose) || hose, lengthFt: len, cValue: null }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: elev,
      nozRight: nozObj,
    };
  };

  if (candidate && typeof candidate === 'object' && Array.isArray(candidate.itemsMain)) {
    // Always start with NO lines deployed on app load.
    // Normalize section shapes so legacy saved defaults (hoseDiameter/hose/len) still compute and render correctly.
    const safe = JSON.parse(JSON.stringify(candidate));
    safe.visible = false;
    safe.itemsMain  = splitIntoSections(safe.itemsMain);
    safe.itemsLeft  = splitIntoSections(safe.itemsLeft);
    safe.itemsRight = splitIntoSections(safe.itemsRight);

    // Normalize nozzle id/object (some saves store {id} or raw string)
    if (safe.nozRight && typeof safe.nozRight === 'object') {
      const nid = canonicalNozzleId(safe.nozRight.id || safe.nozRight.value || safe.nozRight);
      safe.nozRight = resolveNozzleById(nid) || safe.nozRight;
    } else if (typeof safe.nozRight === 'string') {
      safe.nozRight = resolveNozzleById(safe.nozRight) || null;
    }

    return safe;
  }

  // 2) Compatibility: simple line defaults saved by deptState.js (fireops_line_defaults_v1)
  //    Shape: { '1': { hose, nozzle, length, elevation }, ... }
  try{
    const raw = localStorage.getItem('fireops_line_defaults_v1');
    if (!raw) return candidate || firstRunFallback();
    const parsed = JSON.parse(raw) || {};
    const map = (key === 'left') ? '1' : (key === 'back') ? '2' : (key === 'right') ? '3' : null;
    if (!map || !parsed[map]) return candidate || firstRunFallback();

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
      itemsMain: [{ size: normalizeHoseDiameter(hose) || hose, lengthFt: len, cValue: null }],
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
    return candidate || firstRunFallback();
  }
}

/* =========================
 * Line defaults (in-memory state)
 * ========================= */

function seedInitialDefaults(){
  if (state.lines) return;

  // Seed Line 1/2/3 with a real hose + nozzle so deployed lines immediately
  // show hose size and calculate PP (NP + friction) even before the user edits defaults.
  state.lines = {
    left:  {
      label: 'Line 1',
      visible: false,
      itemsMain: [{ size: '1.75', lengthFt: 200, cValue: null }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: NOZ.fog150_50 || null,
    },
    back:  {
      label: 'Line 2',
      visible: false,
      itemsMain: [{ size: '1.75', lengthFt: 200, cValue: null }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: NOZ.fog150_50 || null,
    },
    right: {
      label: 'Line 3',
      visible: false,
      itemsMain: [{ size: '1.75', lengthFt: 200, cValue: null }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: NOZ.fog150_50 || null,
    },
  };
}

export function seedDefaultsForKey(key){
  if(!state.lines) seedInitialDefaults();

  const existing = state.lines ? state.lines[key] : null;

  // A placeholder is a blank line with no hose + no nozzle set yet.
  const isPlaceholder = (L) => !!L
    && Array.isArray(L.itemsMain) && L.itemsMain.length === 0
    && Array.isArray(L.itemsLeft) && L.itemsLeft.length === 0
    && Array.isArray(L.itemsRight) && L.itemsRight.length === 0
    && !L.nozRight && !L.nozLeft
    && !L.hasWye;

  // Only pull from saved Department defaults when the current in-memory line is missing or placeholder.
  if (key === 'left' || key === 'back' || key === 'right') {
    if (!existing || isPlaceholder(existing)) {
      const deptLine = getDeptLineDefault(key);
      if (deptLine && typeof deptLine === 'object') {
        state.lines[key] = JSON.parse(JSON.stringify(deptLine));
        state.lines[key].visible = false;
        return state.lines[key];
      }
    }
    if (existing) return existing;
  }

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
  const leftOn   = leftLen > 0 && (L.nozLeft || L.nozL);
  const rightOn  = rightLen > 0 && (L.nozRight || L.nozR || L.noz);
  return leftOn && rightOn;
}

/* =========================
 * Active selection (UI)
 * ========================= */
export let activeSide = 'left';
export let activeNozzle = null;

/* =========================
 * Line defaults interface (compat)
 * ========================= */
const LINE_DEFAULTS_KEY = 'fireops_line_defaults_v1';

export function getLineDefaults(){
  try{
    const raw = localStorage.getItem(LINE_DEFAULTS_KEY);
    const obj = safeParse(raw, null);
    return obj && typeof obj === 'object' ? obj : {};
  }catch(e){
    return {};
  }
}

export function setLineDefaults(obj){
  try{
    localStorage.setItem(LINE_DEFAULTS_KEY, safeStringify(obj || {}));
  }catch(e){}
}

/* =========================
 * Convenience (preconnects)
 * ========================= */
export function getConfiguredPreconnects(){
  const defs = getLineDefaults();
  return defs || {};
}

/* =========================
 * Additional helpers used elsewhere
 * ========================= */
export function isSingleWye(L){
  if(!L) return false;
  return !!L.hasWye;
}
