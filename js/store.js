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

// Legacy nozzle id normalization (keeps nozzle dropdown from "sticking")
function _normNozId(id){
  const s = String(id ?? '').trim();
  if (!s) return '';
  if (s === 'sb_78_50_160' || s === 'sb_7_8' || s === 'sb78' || s === 'sb_78') return 'sb7_8';
  if (s === 'sb_1516_50_185' || s === 'sb_15_16' || s === 'sb1516' || s === 'sb_1516') return 'sb15_16';
  if (s === 'sb_1_50_210') return 'sb1';
  if (s === 'sb_118_50_265' || s === 'sb_1_1_8') return 'sb1_1_8';
  return s;
}

export function resolveNozzleById(id){
  const nid = _normNozId(id);
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

export function resolveHoseMeta(size){
  const dia = normalizeHoseDiameter(size);
  const c = COEFF[dia] ?? null;
  return { dia, c };
}

export function formatHoseLabel(size){
  const s = normalizeHoseDiameter(size);
  if (s === '1.5') return '1 1/2"';
  if (s === '1.75') return '1 3/4"';
  if (s === '2.5') return '2 1/2"';
  return s ? `${s}"` : '—';
}

// Friction Loss: FL = C * (Q^2) * (L/100), Q in hundreds of gpm
export function FL(size, gpm, lengthFt, cValue=null){
  const dia = normalizeHoseDiameter(size);
  const C = (cValue && Number.isFinite(Number(cValue))) ? Number(cValue) : (COEFF[dia] ?? 0);
  const Q = (Number(gpm) || 0) / 100;
  const L = (Number(lengthFt) || 0) / 100;
  return C * (Q * Q) * L;
}

export function applianceLoss(totalGpm){
  return (Number(totalGpm) || 0) > 350 ? 10 : 0;
}

export function elevationLoss(elevFt){
  return (Number(elevFt) || 0) * PSI_PER_FT;
}

// ---- Presets storage ----
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

function loadDeptDefaults(){
  try{
    const raw = localStorage.getItem(DEPT_DEFAULTS_KEY);
    const obj = safeParse(raw, null);
    if (obj && typeof obj === 'object') return obj;
  }catch(e){}
  return null;
}

function saveDeptDefaults(obj){
  try{ localStorage.setItem(DEPT_DEFAULTS_KEY, safeStringify(obj || {})); }catch(e){}
}

/**
 * Get a default line object for the given key: 'left'|'back'|'right'
 * 1) Preferred: full objects from pump_dept_defaults_v1
 * 2) Compatibility: simple objects from fireops_line_defaults_v1
 */
export function getDeptLineDefault(key){
  // 1) Preferred: full line objects saved in this module's storage (pump_dept_defaults_v1)
  const all = loadDeptDefaults();
  const candidate = all ? all[key] : null;
  if (candidate && typeof candidate === 'object' && Array.isArray(candidate.itemsMain)) {
    // Always start with NO lines deployed on app load
    const safe = JSON.parse(JSON.stringify(candidate));
    safe.visible = false;
    return safe;
  }

  // 2) Compatibility: simple line defaults saved by deptState.js (fireops_line_defaults_v1)
  //    Shape: { '1': { hose, nozzle, length, elevation }, ... }
  try{
    const raw = localStorage.getItem('fireops_line_defaults_v1');
    if (!raw) return candidate || null;
    const parsed = safeParse(raw, {}) || {};
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
      itemsMain: [{ size: normalizeHoseDiameter(hose) || hose, lengthFt: len, cValue: resolveHoseMeta(hose).c }],
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

/* =========================
 * Line seeding (FIRST RUN defaults)
 * ========================= */

// ✅ THIS FUNCTION IS THE FIX.
// Your previous working file intentionally left itemsMain empty.
// That causes: blank hose size + PP=NP until user edits.
// We now seed a real hose segment + nozzle so first-run works.
function seedInitialDefaults(){
  if (state.lines) return;

  // First-run built-in attack line defaults so new users see hose size + PP immediately.
  // Users can overwrite these in Department Setup at any time.
  const nozDefault = resolveNozzleById('fog185_50') || resolveNozzleById('fog150_50') || null;

  const mkLine = (label, hoseSize, lenFt) => {
    const meta = resolveHoseMeta(hoseSize);
    return {
      label,
      visible: false,
      itemsMain: [{ size: normalizeHoseDiameter(hoseSize) || String(hoseSize), lengthFt: Number(lenFt)||0, cValue: meta?.c ?? null }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: nozDefault,
    };
  };

  state.lines = {
    left:  mkLine('Line 1', '1.75', 200),
    back:  mkLine('Line 2', '1.75', 200),
    right: mkLine('Line 3', '1.75', 200),
  };
}

/* =========================
 * Public API used by views
 * ========================= */

export function ensureState(){
  seedInitialDefaults();
  return state;
}

export function resetLinesToDeptDefaults(){
  seedInitialDefaults();
  for (const k of ['left','back','right']){
    const def = getDeptLineDefault(k);
    if (def){
      state.lines[k] = JSON.parse(JSON.stringify(def));
      state.lines[k].visible = false;
    }
  }
}

export function setLineVisible(key, visible){
  seedInitialDefaults();
  const L = state.lines[key];
  if (!L) return;
  L.visible = !!visible;
}

export function setSupply(mode){
  state.supply = mode;
}

export function setShowMath(v){
  state.showMath = !!v;
}

export function calcLine(line){
  // Returns { gpm, np, fl, elev, appl, pp }
  const noz = line?.nozRight ? resolveNozzleById(line.nozRight.id || line.nozRight) : null;
  const gpm = noz ? (Number(noz.gpm) || 0) : 0;
  const np  = noz ? (Number(noz.np) || 0) : 0;

  const secs = Array.isArray(line?.itemsMain) ? line.itemsMain : [];
  let fl = 0;
  for (const seg of secs){
    fl += FL(seg?.size, gpm, seg?.lengthFt, seg?.cValue ?? null);
  }

  const elev = elevationLoss(line?.elevFt || 0);
  const appl = applianceLoss(gpm);

  const pp = Math.round(np + fl + elev + appl);
  return { gpm, np, fl: Math.round(fl * 10) / 10, elev: Math.round(elev * 10) / 10, appl, pp };
}

/* =========================
 * (Rest of file below is unchanged from your working version)
 * If your original working store.js had additional exports/helpers,
 * keep them here exactly as-is. 
 * ========================= */
