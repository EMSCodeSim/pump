// store.js
// Older working store logic + compatibility exports for newer modules.
// This fixes missing exports: FL, COLORS, getConfiguredPreconnectCount, getDeptLineDefaults.

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

function loadPersistedStore(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return null;
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : null;
  }catch(_){ return null; }
}

export const store = (() => {
  const from = loadPersistedStore() || {};
  return {
    // department equipment selections
    deptSelectedHoses: Array.isArray(from.deptSelectedHoses) ? from.deptSelectedHoses.map(String) : [],
    deptSelectedNozzles: Array.isArray(from.deptSelectedNozzles) ? from.deptSelectedNozzles.map(String) : [],
    // custom items
    customHoses: Array.isArray(from.customHoses) ? from.customHoses : [],
    customNozzles: Array.isArray(from.customNozzles) ? from.customNozzles : [],
    // department hose "catalog" shown in Dept Setup
    deptHoses: HOSES_MATCHING_CHARTS.slice(),
  };
})();

export function saveStore(){
  try{
    localStorage.setItem(STORE_KEY, JSON.stringify({
      deptSelectedHoses: store.deptSelectedHoses,
      deptSelectedNozzles: store.deptSelectedNozzles,
      customHoses: store.customHoses,
      customNozzles: store.customNozzles,
    }));
    return true;
  }catch(_){ return false; }
}

export function setSelectedHoses(ids){
  store.deptSelectedHoses = Array.isArray(ids) ? ids.map(String) : [];
  setDeptUiHoses(getDeptHoses());
  saveStore();
}

export function setSelectedNozzles(ids){
  store.deptSelectedNozzles = Array.isArray(ids) ? ids.map(String) : [];
  setDeptUiNozzles(store.deptSelectedNozzles);
  saveStore();
}

export function addCustomHose(label, diameter, cValue){
  const id = `custom_hose_${Date.now()}`;
  const hose = { id, label:String(label||'Custom hose'), diameter:String(diameter||''), c:Number(cValue||0) };
  store.customHoses.push(hose);
  saveStore();
  return hose;
}

export function addCustomNozzle(label, gpm, np){
  const id = `custom_noz_${Date.now()}`;
  const noz = { id, name:String(label||'Custom nozzle'), label:String(label||'Custom nozzle'), gpm:Number(gpm||0), NP:Number(np||0) };
  store.customNozzles.push(noz);

  // Sync into dept equipment storage for consistency
  try {
    const KEY = 'fireops_dept_equipment_v1';
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(KEY);
      const dept = raw ? JSON.parse(raw) : {};
      const existing = Array.isArray(dept.customNozzles) ? dept.customNozzles : [];
      dept.customNozzles = existing.concat([{
        id: noz.id,
        label: noz.label,
        name: noz.name,
        gpm: noz.gpm,
        NP: noz.NP,
        np: noz.NP,
        psi: noz.NP,
      }]);
      localStorage.setItem(KEY, JSON.stringify(dept));
    }
  } catch (e) {
    console.warn('addCustomNozzle: failed to sync dept customNozzles', e);
  }

  saveStore();
  return noz;
}

export function getDeptHoses(){
  if (Array.isArray(DEPT_UI_HOSES) && DEPT_UI_HOSES.length) return DEPT_UI_HOSES;
  return HOSES_MATCHING_CHARTS.slice();
}

// Department-scoped UI lists for hoses and nozzles.
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

function resolveHoseMeta(input){
  const raw = (input == null ? '' : String(input)).trim();
  if (!raw) return { dia:'', c:null, kind:'diameter' };

  if (HOSE_ID_TO_DIA[raw]) {
    const dia = HOSE_ID_TO_DIA[raw];
    return { dia, c: null, kind: raw.startsWith('h_lf_') ? 'lowfriction' : 'built' };
  }

  if (raw.startsWith('custom_hose_')) {
    try{
      const deptRaw = localStorage.getItem('fireops_dept_equipment_v1');
      const dept = deptRaw ? JSON.parse(deptRaw) : {};
      const list = Array.isArray(dept?.customHoses) ? dept.customHoses : [];
      const found = list.find(h => h && String(h.id) === raw);
      if (found){
        const dia = String(found.diameter ?? found.dia ?? found.size ?? '').trim();
        const c   = Number(found.c ?? found.C ?? found.flC ?? found.coeff ?? null);
        return { dia: normalizeHoseDiameter(dia), c: Number.isFinite(c) ? c : null, kind:'custom' };
      }
    }catch(_e){ }
    return { dia:'', c:null, kind:'custom' };
  }

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    return { dia: normalizeHoseDiameter(raw), c: null, kind:'diameter' };
  }

  return { dia:'', c:null, kind:'diameter' };
}

function normalizeHoseDiameter(input){
  if (input == null) return '';
  const s = String(input).trim();
  if (!s) return '';
  const mapped = HOSE_ID_TO_DIA[s];
  if (mapped) return mapped;

  if (s.startsWith('custom_hose_')) {
    try{
      const rawDept = localStorage.getItem('fireops_dept_equipment_v1');
      const dept = rawDept ? JSON.parse(rawDept) : {};
      const list = Array.isArray(dept?.customHoses) ? dept.customHoses : [];
      const found = list.find(h => h && String(h.id) === s);
      const dia = found ? String(found.diameter ?? found.dia ?? found.size ?? '').trim() : '';
      if (dia) return normalizeHoseDiameter(dia);
    }catch(_e){ }
    return '';
  }

  if (/^\d+(?:\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return '';
    if (Math.abs(n - 2) < 1e-9) return '2.0';
    return String(s);
  }
  return '';
}

/* =========================
 * Nozzle ID normalization (compat)
 * ========================= */
const LEGACY_NOZ_ID_MAP = {
  'sb_78_50_160':   'sb7_8',
  'sb_1516_50_185': 'sb15_16',
  'sb_1_50_210':    'sb1',
  'sb_1118_50_265': 'sb1_1_8',
  'sb_114_50_325':  'sb1_1_4',

  'fog_xd_175_50_165': 'chiefXD165_50',
  'fog_xd_175_50_185': 'chief185_50',
  'fog_xd_25_50_265':  'chiefXD265',
};

export function canonicalNozzleId(raw){
  const id = String(raw || '').trim();
  if (!id) return '';
  return LEGACY_NOZ_ID_MAP[id] || id;
}

/* =========================
 * Nozzle catalog (expanded)
 * ========================= */
export const NOZ = {
  fog95_50:       { id:'fog95_50',      name:'Fog 95 @ 50',        gpm:95,   NP:50 },
  fog125_50:      { id:'fog125_50',     name:'Fog 125 @ 50',       gpm:125,  NP:50 },
  fog150_50:      { id:'fog150_50',     name:'Fog 150 @ 50',       gpm:150,  NP:50 },
  fog95_75:       { id:'fog95_75',      name:'Fog 95 @ 75',        gpm:95,   NP:75 },
  fog125_75:      { id:'fog125_75',     name:'Fog 125 @ 75',       gpm:125,  NP:75 },
  fog150_75:      { id:'fog150_75',     name:'Fog 150 @ 75',       gpm:150,  NP:75 },
  fog150_100:     { id:'fog150_100',    name:'Fog 150 @ 100',      gpm:150,  NP:100 },

  chiefXD165_50:  { id:'chiefXD165_50', name:'Chief XD 1¾″ 165 gpm @ 50 psi', gpm:165, NP:50 },
  chief185_50:    { id:'chief185_50',   name:'Chief XD 1¾″ 185 gpm @ 50 psi', gpm:185, NP:50 },
  chiefXD:        { id:'chiefXD',       name:'Chief XD 1¾″ 185 gpm @ 50 psi', gpm:185, NP:50 },
  chiefXD200_75:  { id:'chiefXD200_75', name:'Chief XD 1¾″ 200 gpm @ 75 psi', gpm:200,  NP:75 },
  chiefXD265:     { id:'chiefXD265',    name:'Chief XD 2½″ 265 gpm @ 50 psi', gpm:265,  NP:50 },

  fog250_50:      { id:'fog250_50',     name:'2½″ Fog 250 @ 50',   gpm:250,  NP:50 },
  fog250_75:      { id:'fog250_75',     name:'2½″ Fog 250 @ 75',   gpm:250,  NP:75 },

  sb7_8:          { id:'sb7_8',         name:'SB 7/8″ @ 50',       gpm:160,  NP:50 },
  sb15_16:        { id:'sb15_16',       name:'SB 15/16″ @ 50',     gpm:185,  NP:50 },
  sb1:            { id:'sb1',           name:'SB 1″ @ 50',         gpm:210,  NP:50 },
  sb1_1_8:        { id:'sb1_1_8',       name:'SB 1 1/8″ @ 50',     gpm:265,  NP:50 },
  sb1_1_4:        { id:'sb1_1_4',       name:'SB 1 1/4″ @ 50',     gpm:325,  NP:50 },

  ms1_3_8_80:     { id:'ms1_3_8_80',    name:'MS 1 3/8″ @ 80',     gpm:502,  NP:80 },
  ms1_1_2_80:     { id:'ms1_1_2_80',    name:'MS 1 1/2″ @ 80',     gpm:598,  NP:80 },
  ms1_3_4_80:     { id:'ms1_3_4_80',    name:'MS 1 3/4″ @ 80',     gpm:814,  NP:80 },
  ms2_80:         { id:'ms2_80',        name:'MS 2″ @ 80',         gpm:1063, NP:80 },
};

export const NOZ_LIST = Object.values(NOZ);

function resolveNozzleById(raw){
  const id = canonicalNozzleId(raw);
  if (!id) return null;

  if (NOZ && NOZ[id]) return NOZ[id];

  const custom = (store && Array.isArray(store.customNozzles)) ? store.customNozzles : [];
  const c = custom.find(n => n && String(n.id) === id);
  if (c) {
    return {
      id: String(c.id),
      name: String(c.name || c.label || c.id),
      gpm: Number(c.gpm ?? 0),
      NP:  Number(c.NP ?? c.np ?? 0),
      label: c.label || c.name || c.id,
    };
  }

  try {
    const rawDept = localStorage.getItem('fireops_dept_equipment_v1');
    if (rawDept) {
      const dept = JSON.parse(rawDept) || {};
      const deptCustom = Array.isArray(dept.customNozzles) ? dept.customNozzles : [];
      const d = deptCustom.find(n => n && String(n.id) === id);
      if (d) {
        return {
          id: String(d.id),
          name: String(d.name || d.label || d.id),
          gpm: Number(d.gpm ?? 0),
          NP:  Number(d.NP ?? d.np ?? 0),
          label: d.label || d.name || d.id,
        };
      }
    }
  } catch (_e) {}

  return (Array.isArray(NOZ_LIST) ? NOZ_LIST : []).find(n => n && String(n.id) === id) || null;
}

export function getDeptNozzles() {
  const catalog = Array.isArray(NOZ_LIST) ? NOZ_LIST : [];
  let custom = Array.isArray(store?.customNozzles) ? store.customNozzles : [];

  try {
    const KEY = 'fireops_dept_equipment_v1';
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const dept = JSON.parse(raw);
      if (dept && Array.isArray(dept.customNozzles) && dept.customNozzles.length) {
        custom = dept.customNozzles;
      }
    }
  } catch (_e) {}

  function toFull(item){
    if (!item) return null;
    if (typeof item === 'string') item = { id: item };
    const rawId = String(item.id || '').trim();
    if (!rawId) return null;

    const built = resolveNozzleById(rawId);
    if (built) {
      return {
        id: built.id,
        label: item.label || item.name || built.name || built.label || built.id,
        gpm: Number(built.gpm ?? 0),
        NP:  Number(built.NP ?? 0),
      };
    }

    const c = custom.find(n => n && String(n.id) === rawId);
    if (c) {
      return {
        id: c.id,
        label: item.label || item.name || c.label || c.name || c.id,
        gpm: Number(c.gpm ?? 0),
        NP:  Number(c.NP ?? c.np ?? c.psi ?? 0),
      };
    }
    return null;
  }

  if (Array.isArray(DEPT_UI_NOZZLES) && DEPT_UI_NOZZLES.length) {
    const resolved = DEPT_UI_NOZZLES.map(toFull).filter(Boolean);
    if (resolved.length) return resolved;
  }

  const base = catalog.map(n => ({
    id: n.id,
    label: n.label || n.name || n.id,
    gpm: Number(n.gpm ?? 0),
    NP:  Number(n.NP ?? 0),
  }));
  const extra = custom.map(n => ({
    id: n.id,
    label: n.label || n.name || n.id,
    gpm: Number(n.gpm ?? 0),
    NP:  Number(n.NP ?? n.np ?? 0),
  }));
  return base.concat(extra);
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

function flPer100(size, gpm, cOverride){
  const q = Math.max(0, gpm) / 100;
  const C = (Number.isFinite(Number(cOverride)) && Number(cOverride) > 0)
    ? Number(cOverride)
    : (COEFF[size] ?? 10);
  return C * q * q;
}

export function FL(gpm, size, lengthFt, cOverride){
  if(!size || !lengthFt || !gpm) return 0;
  return flPer100(size, gpm, cOverride) * (lengthFt/100);
}

export function FL_total(gpm, items){
  if(!Array.isArray(items) || !items.length || !gpm) return 0;
  let sum = 0;
  for(const seg of items) sum += FL(gpm, seg.size, seg.lengthFt, seg.cValue);
  return sum;
}

export function sumFt(items){
  if(!Array.isArray(items)) return 0;
  return items.reduce((a,c)=> a + (Number(c.lengthFt)||0), 0);
}

/* =========================
 * Line defaults
 * ========================= */
function seedInitialDefaults(){
  if (state.lines) return;

  state.lines = {
    left:  { label:'Line 1', visible:false, itemsMain:[], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:null, nozLeft:null },
    back:  { label:'Line 2', visible:false, itemsMain:[], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:null, nozLeft:null },
    right: { label:'Line 3', visible:false, itemsMain:[], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:null, nozLeft:null },
  };
}
seedInitialDefaults();

export function seedDefaultsForKey(key){
  if(!state.lines) seedInitialDefaults();
  const existing = state.lines ? state.lines[key] : null;

  const isPlaceholder = (L) => !!L
    && Array.isArray(L.itemsMain) && L.itemsMain.length === 0
    && Array.isArray(L.itemsLeft) && L.itemsLeft.length === 0
    && Array.isArray(L.itemsRight) && L.itemsRight.length === 0
    && !L.nozRight && !L.nozLeft
    && !L.hasWye;

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

  if (key === 'left' || key === 'back' || key === 'right') return state.lines[key];

  state.lines[key] = { label:key, visible:false, itemsMain:[], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:null, nozLeft:null };
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
    return activeSide(L) === 'L' ? (L.nozLeft || L.nozRight) : (L.nozRight || L.nozLeft);
  }
  return L.nozRight || L.nozLeft || null;
}

/* =========================
 * Line presets for Settings (Line 1/2/3 defaults)
 * ========================= */
const PRESET_STORAGE_KEY = 'fireops_line_presets_v1';

function hasStorage(){
  try { return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'; }
  catch { return false; }
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
    left:  { len: 200, size: '1.75', noz: 'chief185_50' },
    back:  { len: 200, size: '1.75', noz: 'chief185_50' },
    right: { len: 250, size: '2.5',  noz: 'chiefXD265'  },
  };
}

function normalizePresets(obj){
  if (!obj || typeof obj !== 'object') return defaultPresets();
  const hasShape =
    obj.left  && typeof obj.left.len  === 'number' && obj.left.size  && obj.left.noz &&
    obj.back  && typeof obj.back.len  === 'number' && obj.back.size  && obj.back.noz &&
    obj.right && typeof obj.right.len === 'number' && obj.right.size && obj.right.noz;

  if (hasShape) return obj;

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
}

export function round1(n){ return Math.round((Number(n)||0)*10)/10; }

/* =========================
 * Department Defaults Persistence
 * ========================= */
const DEPT_STORAGE_KEY = 'pump_dept_defaults_v1';

function readDeptStorage(){
  try {
    const raw = localStorage.getItem(DEPT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(_e){
    return null;
  }
}

function writeDeptStorage(obj){
  try {
    localStorage.setItem(DEPT_STORAGE_KEY, JSON.stringify(obj));
    return true;
  } catch(_e){
    return false;
  }
}

export function loadDeptDefaults(){
  const from = readDeptStorage();
  if(from) return from;

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
  const candidate = all ? all[key] : null;
  if (candidate && typeof candidate === 'object' && Array.isArray(candidate.itemsMain)) {
    const safe = JSON.parse(JSON.stringify(candidate));
    safe.visible = false;
    return safe;
  }

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

    const hoseMeta = resolveHoseMeta(hose);

    const built = {
      label,
      visible: false,
      itemsMain: [{ size: normalizeHoseDiameter(hose) || hose, lengthFt: len, cValue: hoseMeta.c }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: elev,
      nozRight: nozObj || null,
      nozLeft: null,
    };

    try{
      const full = loadDeptDefaults() || {};
      full[key] = built;
      saveDeptDefaults(full);
    }catch(_){}

    return built;
  }catch(_e){
    return candidate || null;
  }
}

export function setDeptLineDefault(key, data){
  const all = loadDeptDefaults();
  all[key] = data;
  saveDeptDefaults(all);
}

// Returns an array of configured preconnect keys in order: left, back, right.
export function getConfiguredPreconnects(){
  const keys = ['left','back','right'];
  const out = [];
  for (let i = 0; i < keys.length; i++){
    const k = keys[i];
    if (i === 0){
      out.push(k);
      continue;
    }
    const saved = getDeptLineDefault(k);
    if (saved) out.push(k);
  }
  return out;
}

/* =========================
 * Compatibility exports (NEW)
 * ========================= */

// Newer modules expect getConfiguredPreconnectCount()
export function getConfiguredPreconnectCount(){
  try{
    const list = getConfiguredPreconnects();
    return Array.isArray(list) ? list.length : 0;
  }catch(_e){
    return 0;
  }
}

// Newer modules expect getDeptLineDefaults()
export function getDeptLineDefaults(){
  return loadDeptDefaults();
}
