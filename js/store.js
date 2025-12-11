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
  ms1_3_8_80:     { id:'ms1_3_8_80',    name:'MS 1 3/8″ @ 80',     gpm:500,  NP:80 },
  ms1_1_2_80:     { id:'ms1_1_2_80',    name:'MS 1 1/2″ @ 80',     gpm:600,  NP:80 },
  ms1_3_4_80:     { id:'ms1_3_4_80',    name:'MS 1 3/4″ @ 80',     gpm:800,  NP:80 },
  ms2_80:         { id:'ms2_80',        name:'MS 2″ @ 80',         gpm:1000, NP:80 },

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
};

export const NOZ_LIST = Object.values(NOZ);

// Canonical nozzle list for all UIs (Department Setup, line editors, calc)
export function getDeptNozzles() {
  // 1) Department Setup UI-selected list, if any
  // 2) Otherwise full catalog so dropdowns are never empty.
  if (Array.isArray(DEPT_UI_NOZZLES) && DEPT_UI_NOZZLES.length) {
    return DEPT_UI_NOZZLES;
  }
  return Array.isArray(NOZ_LIST) ? NOZ_LIST : [];
}

// Canonical hose list for Department Setup / line editors
export function getDeptHoses() {
  if (Array.isArray(DEPT_UI_HOSES) && DEPT_UI_HOSES.length) {
    return DEPT_UI_HOSES;
  }
  return [];
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
  const per100 = flPer100(size, gpm);
  return per100 * (lengthFt / 100);
}

export function sumFt(items){
  if(!items || !items.length) return 0;
  return items.reduce((acc, seg) => acc + (Number(seg.lengthFt)||0), 0);
}

export function splitIntoSections(items){
  if(!items || !items.length) return [];
  return items.map(seg => ({
    size: seg.size,
    lengthFt: Number(seg.lengthFt)||0
  }));
}

export function FL_total(gpm, items){
  if(!items || !items.length) return 0;
  return items.reduce((acc, seg) => acc + FL(gpm, seg.size, seg.lengthFt), 0);
}

// 1.75-only helper for simplified math in some screens
export function FL_total_sections_175(gpm, items){
  if(!items || !items.length) return 0;
  return items.reduce((acc, seg) => acc + FL(gpm, '1.75', seg.lengthFt), 0);
}

/* =========================
 * Practice-state persistence
 * ========================= */
export const PRACTICE_SAVE_KEY = 'fireops_practice_state_v1';

export function safeClone(obj){
  return JSON.parse(JSON.stringify(obj));
}

function readPractice(){
  try {
    const raw = localStorage.getItem(PRACTICE_SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e){
    return null;
  }
}

export function loadSaved(){
  const snap = readPractice();
  if(!snap || typeof snap !== 'object') return null;
  return snap;
}

export function saveNow(snapshot){
  try {
    localStorage.setItem(PRACTICE_SAVE_KEY, JSON.stringify(snapshot));
  } catch(e){
    // ignore
  }
}

let _autoSave = null;
export function startAutoSave(buildSnapshotFn){
  stopAutoSave();
  _autoSave = setInterval(() => {
    try {
      const snap = buildSnapshotFn();
      if (snap) saveNow(snap);
    } catch(_){}
  }, 5000);
}
export function stopAutoSave(){
  if(_autoSave) clearInterval(_autoSave);
  _autoSave = null;
}

/* =========================
 * Snapshot helpers for calc/stateBridge.js
 * ========================= */
export function buildSnapshot(){
  if(!state.lines) return null;
  return safeClone(state.lines);
}

export function restoreState(linesSnapshot){
  if(!linesSnapshot || typeof linesSnapshot !== 'object') return;
  state.lines = safeClone(linesSnapshot);
}

/* =========================
 * Truck / layout constants
 * ========================= */
export const TRUCK_W = 640;
export const TRUCK_H = 240;
export const PX_PER_50FT = 40;
export const CURVE_PULL = 40;
export const BRANCH_LIFT = 30;

export function supplyHeight(){
  return 0;
}

export function computeNeededHeightPx(elevFt){
  const feet = Number(elevFt)||0;
  return feet * 2;
}

export function truckTopY(){
  return 80;
}

/* =========================
 * Small DOM helpers used by view.calc.main.js
 * ========================= */
export function clearGroup(group){
  while(group && group.firstChild){
    group.removeChild(group.firstChild);
  }
}

export function clsFor(base, extra){
  return extra ? base + ' ' + extra : base;
}

export function fmt(n){
  const v = Number(n)||0;
  return v.toFixed(0);
}

export function escapeHTML(str){
  if(str == null) return '';
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[s]);
}

export function addLabel(group, text, x, y, cls){
  const t = document.createElementNS('http://www.w3.org/2000/svg','text');
  t.setAttribute('x', x);
  t.setAttribute('y', y);
  t.setAttribute('class', cls||'');
  t.textContent = text;
  group.appendChild(t);
}

export function addTip(group, key, where, clsExtra){
  const g = document.createElementNS('http://www.w3.org/2000/svg','g');
  g.setAttribute('data-line', key);
  g.setAttribute('data-where', where);
  g.setAttribute('class', clsFor('hose-end', clsExtra||''));
  group.appendChild(g);
  return g;
}

/* =========================
 * Line seeding / defaults
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

export function seedDefaultsForKey(key){
  if (!state.lines) seedInitialDefaults();
  const current = state.lines[key];

  // For the three front-panel attack lines (Line 1 / Line 2 / Line 3),
  // prefer Department Setup defaults the *first* time the line is pulled
  // in this session. Once the user has worked the line (visible = true),
  // we keep their edits until a full page reload.
  if (key === 'left' || key === 'back' || key === 'right') {
    const shouldUseDept = !current || !current.visible;
    if (shouldUseDept) {
      const deptLine = getDeptLineDefault(key);
      if (deptLine && typeof deptLine === 'object') {
        // Clone so we don't mutate the stored template directly
        state.lines[key] = JSON.parse(JSON.stringify(deptLine));
        return state.lines[key];
      }
    }
  }

  // If we already have a line object (and chose not to override it above),
  // just return it.
  if (current) return current;

  // Otherwise, fall back to built-in defaults that match the original app.
  const L1N = NOZ.chief185_50;
  const L3N = NOZ.chiefXD265;

  if (key === 'left') {
    state.lines.left = {
      label: 'Line 1',
      visible: false,
      itemsMain: [{ size: '1.75', lengthFt: 200 }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: L1N,
    };
  } else if (key === 'back') {
    state.lines.back = {
      label: 'Line 2',
      visible: false,
      itemsMain: [{ size: '1.75', lengthFt: 200 }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: L1N,
    };
  } else if (key === 'right') {
    state.lines.right = {
      label: 'Line 3',
      visible: false,
      itemsMain: [{ size: '2.5', lengthFt: 250 }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: L3N,
    };
  } else {
    // Any other dynamic / custom line
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

  // If the stored value is from an older version (standpipe/foam/etc),
  // ignore it.
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

/* =========================
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

// Simple Line 1/2/3 defaults shared with deptState.js & preset.js.
// These live in localStorage under 'fireops_line_defaults_v1' and
// are a lightweight shape like:
//   { "1": { hose, nozzle, length, elevation }, ... }
// or, in older builds:
//   { "1": { hoseDiameter, lengthFt, nozzleId, elevationFt }, ... }
const LINE_DEFAULTS_STORAGE_KEY = 'fireops_line_defaults_v1';

function readSimpleLineDefaults() {
  try {
    const raw = localStorage.getItem(LINE_DEFAULTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

// Build a full calc line object (itemsMain / elevFt / nozRight) from
// the simple per-line defaults, falling back to the original hard-coded
// defaults if any fields are missing.
function buildDeptLineFromSimple(key) {
  const map = { left: '1', back: '2', right: '3' };
  const lineKey = map[key];
  if (!lineKey) return null;

  const all = readSimpleLineDefaults();
  const simple = all[lineKey];
  if (!simple || typeof simple !== 'object') return null;

  // Support both the new shape ({hose,nozzle,length,elevation})
  // and the older shape ({hoseDiameter,lengthFt,nozzleId,elevationFt}).
  const rawHose =
    simple.hose ??
    simple.hoseId ??
    simple.hoseDiameter;

  const rawNozId =
    simple.nozzle ??
    simple.nozzleId;

  const rawLen =
    simple.length ??
    simple.lengthFt;

  const rawElev =
    simple.elevation ??
    simple.elevationFt;

  const L1N = NOZ.chief185_50;
  const L3N = NOZ.chiefXD265;

  let base;
  if (key === 'left' || key === 'back') {
    base = {
      label: key === 'left' ? 'Line 1' : 'Line 2',
      visible: false,
      itemsMain: [{ size: '1.75', lengthFt: 200 }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: L1N,
    };
  } else if (key === 'right') {
    base = {
      label: 'Line 3',
      visible: false,
      itemsMain: [{ size: '2.5', lengthFt: 250 }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: L3N,
    };
  } else {
    return null;
  }

  const hoseId = rawHose != null && String(rawHose).trim() !== ''
    ? String(rawHose).trim()
    : base.itemsMain[0].size;

  const lenVal = Number(rawLen);
  const lengthFt = Number.isFinite(lenVal) && lenVal > 0
    ? lenVal
    : base.itemsMain[0].lengthFt;

  const elevVal = Number(rawElev);
  const elevFt = Number.isFinite(elevVal) ? elevVal : base.elevFt;

  const nozObj = rawNozId && NOZ[rawNozId]
    ? NOZ[rawNozId]
    : base.nozRight;

  const line = JSON.parse(JSON.stringify(base));
  if (line.itemsMain && line.itemsMain[0]) {
    line.itemsMain[0].size = hoseId;
    line.itemsMain[0].lengthFt = lengthFt;
  }
  line.elevFt = elevFt;
  line.nozRight = nozObj;

  return line;
}

export function getDeptLineDefault(key){
  // 1) Prefer the simple line defaults used by the new Department Setup.
  const fromSimple = buildDeptLineFromSimple(key);
  if (fromSimple) return fromSimple;

  // 2) Fall back to the legacy full-line defaults stored by older builds.
  const all = loadDeptDefaults();
  return all && all[key] ? all[key] : null;
}

export function setDeptLineDefault(key, data){
  const all = loadDeptDefaults();
  all[key] = data;
  saveDeptDefaults(all);
}
