// store.js
// Central app state, nozzle catalog, presets, and hydraulic helpers.
// - Lines start hidden; supply starts 'off' (user chooses).
// - NFPA elevation: PSI_PER_FT = 0.05 (0.5 psi / 10 ft).
// - Appliance loss: +10 psi only if total GPM > 350.
// - Exports restored for other views: COEFF, loadPresets, savePresets.

export const state = {
  supply: 'off',       // 'off' | 'pressurized' | 'draft'
  supplyReady: false,
  supplyLabel: 'Water Supply',
  lines: {
    left: {
      label: 'Line 1',
      visible: false,
      itemsMain: [],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: null,
    },
    back: {
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
    },
  },
  tableMode: false,
  ui: {
    showPresetInfoOnce: true,
  }
};

// --------------------------- Hose coeffs ---------------------------
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

// --------------------------- Nozzles ---------------------------
// id, label, gpm, np, type
export const NOZ_LIST = [
  // Fog
  { id: 'fog95_50',  label: 'Fog 95 @ 50',  gpm: 95,  np: 50, type: 'fog' },
  { id: 'fog125_50', label: 'Fog 125 @ 50', gpm: 125, np: 50, type: 'fog' },
  { id: 'fog150_50', label: 'Fog 150 @ 50', gpm: 150, np: 50, type: 'fog' },
  { id: 'fog185_50', label: 'Fog 185 @ 50', gpm: 185, np: 50, type: 'fog' },
  { id: 'fog250_50', label: 'Fog 250 @ 50', gpm: 250, np: 50, type: 'fog' },

  // Smooth bore
  { id: 'sb7_8',   label: 'Smooth Bore 7/8" (160 @ 50)',  gpm: 160, np: 50, type: 'sb' },
  { id: 'sb15_16', label: 'Smooth Bore 15/16" (185 @ 50)', gpm: 185, np: 50, type: 'sb' },
  { id: 'sb1',     label: 'Smooth Bore 1" (210 @ 50)',     gpm: 210, np: 50, type: 'sb' },
  { id: 'sb1_1_8', label: 'Smooth Bore 1-1/8" (265 @ 50)', gpm: 265, np: 50, type: 'sb' },

  // Master stream examples
  { id: 'ms500_80', label: 'Master Stream 500 @ 80', gpm: 500, np: 80, type: 'ms' },
  { id: 'ms750_80', label: 'Master Stream 750 @ 80', gpm: 750, np: 80, type: 'ms' },
];

// --- legacy nozzle id normalization (keeps nozzle dropdown from "sticking") ---
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

// --------------------------- Storage keys ---------------------------
const LS_KEY_STATE = 'fireops_state_v2';
const LS_KEY_PRESETS = 'fireops_presets_v1';
const LS_KEY_DEPT_SETUP = 'fireops_dept_setup_v1';
const LS_KEY_LINE_DEFAULTS = 'fireops_line_defaults_v1';

// --------------------------- Utils ---------------------------
export function clamp(n, lo, hi){
  n = Number(n);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

export function round1(x){ return Math.round(x * 10) / 10; }
export function round0(x){ return Math.round(x); }

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

export function formatHoseLabel(size){
  const s = normalizeHoseDiameter(size);
  if (s === '1.5') return '1 1/2"';
  if (s === '1.75') return '1 3/4"';
  if (s === '2.5') return '2 1/2"';
  return s ? `${s}"` : '—';
}

// --------------------------- Hydraulics ---------------------------
export function FL(size, gpm, lengthFt, cValue=null){
  // Friction Loss: FL = C * (Q^2) * (L/100)
  // Q in hundreds of gpm
  const dia = normalizeHoseDiameter(size);
  const C = (cValue && Number.isFinite(Number(cValue))) ? Number(cValue) : (COEFF[dia] ?? 0);
  const Q = (Number(gpm) || 0) / 100;
  const L = (Number(lengthFt) || 0) / 100;
  return C * (Q * Q) * L;
}

export function applianceLoss(totalGpm){
  // +10 psi only if total GPM > 350
  return (Number(totalGpm) || 0) > 350 ? 10 : 0;
}

export function elevationLoss(elevFt){
  return (Number(elevFt) || 0) * PSI_PER_FT;
}

export function calcLine(line){
  // Returns { gpm, np, fl, elev, appl, pp }
  // Simple model: single nozzle fed by main line.
  const noz = line?.nozRight ? resolveNozzleById(line.nozRight.id || line.nozRight) : null;
  const gpm = noz ? (Number(noz.gpm) || 0) : 0;
  const np  = noz ? (Number(noz.np) || 0) : 0;

  // Sum friction across main sections
  const secs = Array.isArray(line?.itemsMain) ? line.itemsMain : [];
  let fl = 0;
  for (const seg of secs){
    const size = seg?.size;
    const len  = seg?.lengthFt;
    const cv   = seg?.cValue ?? null;
    fl += FL(size, gpm, len, cv);
  }

  const elev = elevationLoss(line?.elevFt || 0);
  const appl = applianceLoss(gpm);

  const pp = round0(np + fl + elev + appl);
  return { gpm, np, fl: round1(fl), elev: round1(elev), appl, pp };
}

// --------------------------- Presets ---------------------------
export function loadPresets(){
  try {
    const raw = localStorage.getItem(LS_KEY_PRESETS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e){
    return [];
  }
}

export function savePresets(presets){
  try {
    localStorage.setItem(LS_KEY_PRESETS, JSON.stringify(presets || []));
  } catch (e){}
}

// --------------------------- Dept setup / line defaults ---------------------------
function loadDeptSetup(){
  try {
    const raw = localStorage.getItem(LS_KEY_DEPT_SETUP);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e){
    return null;
  }
}

function saveDeptSetup(obj){
  try { localStorage.setItem(LS_KEY_DEPT_SETUP, JSON.stringify(obj || {})); } catch (e){}
}

function loadLineDefaults(){
  try {
    const raw = localStorage.getItem(LS_KEY_LINE_DEFAULTS);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    return obj;
  } catch (e){
    return null;
  }
}

function saveLineDefaults(obj){
  try { localStorage.setItem(LS_KEY_LINE_DEFAULTS, JSON.stringify(obj || {})); } catch (e){}
}

function firstRunFallback(key){
  const label = (key === 'left') ? 'Line 1'
             : (key === 'back') ? 'Line 2'
             : (key === 'right') ? 'Line 3'
             : 'Line';

  const nozObj = resolveNozzleById('fog150_50') || resolveNozzleById('fog185_50') || null;

  return {
    label,
    visible: false,
    itemsMain: [{ size: '1.75', lengthFt: 200, cValue: null }],
    itemsLeft: [],
    itemsRight: [],
    hasWye: false,
    elevFt: 0,
    nozRight: nozObj,
  };
}

export function getDeptLineDefault(key){
  const dept = loadDeptSetup();
  const lineDefs = loadLineDefaults();

  // Candidate pulled from stored line defaults or dept setup
  let candidate = null;

  if (lineDefs && lineDefs[key]) candidate = lineDefs[key];
  else if (dept && dept.lineDefaults && dept.lineDefaults[key]) candidate = dept.lineDefaults[key];

  // Normalize structure so calc/bubbles always work.
  const normalizeSections = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map((s) => {
      const o = (s && typeof s === 'object') ? { ...s } : {};

      // --- size normalization ---
      // Accept multiple legacy keys including `hose` (this is the bug you’re seeing on first run).
      const rawSize = (o.size != null) ? o.size
                   : (o.hose != null) ? o.hose
                   : (o.hoseDiameter != null) ? o.hoseDiameter
                   : (o.dia != null) ? o.dia
                   : (o.diameter != null) ? o.diameter
                   : (o.hoseDia != null) ? o.hoseDia
                   : (o.hoseSize != null) ? o.hoseSize
                   : '';
      const dia = normalizeHoseDiameter(rawSize);
      o.size = dia || String(rawSize || '').trim();

      // length normalization
      const rawLen = (o.lengthFt != null) ? o.lengthFt
                   : (o.length != null) ? o.length
                   : (o.len != null) ? o.len
                   : 0;
      o.lengthFt = Number(rawLen) || 0;

      // cValue normalization (optional)
      const cv = Number(o.cValue);
      o.cValue = (Number.isFinite(cv) && cv > 0) ? cv : null;

      return o;
    });
  };

  const normalizeLine = (L) => {
    if (!L || typeof L !== 'object') return null;
    const out = { ...L };
    // Some saves used `items` instead of `itemsMain`.
    if (!Array.isArray(out.itemsMain) && Array.isArray(out.items)) out.itemsMain = out.items;
    out.itemsMain  = normalizeSections(out.itemsMain);
    out.itemsLeft  = normalizeSections(out.itemsLeft);
    out.itemsRight = normalizeSections(out.itemsRight);

    // Nozzle normalization
    if (out.nozRight && typeof out.nozRight === 'object'){
      const nid = _normNozId(out.nozRight.id || out.nozRight.value || out.nozRight);
      out.nozRight = resolveNozzleById(nid) || out.nozRight;
    } else if (typeof out.nozRight === 'string') {
      out.nozRight = resolveNozzleById(out.nozRight) || null;
    }

    // Coerce basics
    out.label = String(out.label || firstRunFallback(key).label);
    out.hasWye = !!out.hasWye;
    out.elevFt = Number(out.elevFt) || 0;
    out.visible = !!out.visible;

    return out;
  };

  candidate = normalizeLine(candidate);

  // First-run fallback: if nothing saved yet, return a sane template.
  if (!candidate) return firstRunFallback(key);

  return candidate;
}

// --------------------------- State persistence ---------------------------
export function saveState(){
  try {
    const snapshot = JSON.parse(JSON.stringify(state));
    localStorage.setItem(LS_KEY_STATE, JSON.stringify(snapshot));
  } catch (e){}
}

export function loadState(){
  try {
    const raw = localStorage.getItem(LS_KEY_STATE);
    if (!raw) return false;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return false;

    // merge shallow
    state.supply = obj.supply ?? state.supply;
    state.supplyReady = !!obj.supplyReady;
    state.supplyLabel = obj.supplyLabel ?? state.supplyLabel;
    state.tableMode = !!obj.tableMode;
    state.ui = { ...state.ui, ...(obj.ui || {}) };

    // restore lines but keep schema
    for (const k of ['left','back','right']){
      if (obj.lines && obj.lines[k]){
        const L = obj.lines[k];
        state.lines[k] = {
          ...state.lines[k],
          ...L,
        };

        // Normalize sections
        const def = getDeptLineDefault(k);
        // If saved line had no sections, keep empty (user can deploy) but ensure arrays exist
        state.lines[k].itemsMain = Array.isArray(state.lines[k].itemsMain) ? state.lines[k].itemsMain : (def.itemsMain || []);
        state.lines[k].itemsLeft = Array.isArray(state.lines[k].itemsLeft) ? state.lines[k].itemsLeft : (def.itemsLeft || []);
        state.lines[k].itemsRight = Array.isArray(state.lines[k].itemsRight) ? state.lines[k].itemsRight : (def.itemsRight || []);
      }
    }

    return true;
  } catch (e){
    return false;
  }
}

export function resetState(){
  try {
    localStorage.removeItem(LS_KEY_STATE);
  } catch (e){}
  // soft reset to defaults
  state.supply = 'off';
  state.supplyReady = false;
  state.supplyLabel = 'Water Supply';
  state.tableMode = false;
  state.ui = { showPresetInfoOnce: true };

  state.lines.left = { label:'Line 1', visible:false, itemsMain:[], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:null };
  state.lines.back = { label:'Line 2', visible:false, itemsMain:[], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:null };
  state.lines.right= { label:'Line 3', visible:false, itemsMain:[], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:null };
}
