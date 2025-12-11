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
  chiefXD265:     { id:'chiefXD265',    name:'Chief XD 2½″ 265 gpm @ 50 psi', gpm:265, NP:50 },

  // Smooth-bore tips (1.75″)
  sb7_8_50:       { id:'sb7_8_50',      name:'Smooth 7/8 @ 50',    gpm:160,  NP:50 },
  sb15_16_50:     { id:'sb15_16_50',    name:'Smooth 15/16 @ 50',  gpm:185,  NP:50 },

  // Smooth-bore tips (2.5″)
  sb1_50:         { id:'sb1_50',        name:'Smooth 1\" @ 50',     gpm:210,  NP:50 },
  sb1_1_8_50:     { id:'sb1_1_8_50',    name:'Smooth 1 1/8\" @ 50', gpm:265,  NP:50 },
  sb1_1_4_50:     { id:'sb1_1_4_50',    name:'Smooth 1 1/4\" @ 50', gpm:325,  NP:50 },

  // Master stream fogs
  ms500_80:       { id:'ms500_80',      name:'Master Fog 500 @ 80', gpm:500, NP:80 },
  ms750_80:       { id:'ms750_80',      name:'Master Fog 750 @ 80', gpm:750, NP:80 },
  ms1000_80:      { id:'ms1000_80',     name:'Master Fog 1000 @ 80',gpm:1000,NP:80 },

  // Master stream smooth tips
  ms1_3_8_80:     { id:'ms1_3_8_80',    name:'Master Smooth 1 3/8 @ 80', gpm:500, NP:80 },
  ms1_1_2_80:     { id:'ms1_1_2_80',    name:'Master Smooth 1 1/2 @ 80', gpm:600, NP:80 },
  ms1_3_4_80:     { id:'ms1_3_4_80',    name:'Master Smooth 1 3/4 @ 80', gpm:800, NP:80 },

  // Specialty / low flows
  fog30_100:      { id:'fog30_100',     name:'Fog 30 @ 100',       gpm:30,  NP:100 },
  fog60_100:      { id:'fog60_100',     name:'Fog 60 @ 100',       gpm:60,  NP:100 },
  breaker30_100:  { id:'breaker30_100', name:'Breaker 30 @ 100',   gpm:30,  NP:100 },
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
  // 1) Department Setup UI-selected list, if any
  // 2) Otherwise derive from DEPT_UI_HOSES or fall back to empty
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

// === Department Defaults Persistence (legacy) ===
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

// === New Line 1/2/3 simple defaults (Department Setup UI) ===
const LINE_DEFAULTS_KEY = 'fireops_line_defaults_v1';

function readLineDefaultsStorage(){
  try {
    const raw = localStorage.getItem(LINE_DEFAULTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch(e){
    return {};
  }
}

function writeLineDefaultsStorage(obj){
  try {
    if (!obj || typeof obj !== 'object') {
      localStorage.removeItem(LINE_DEFAULTS_KEY);
    } else {
      localStorage.setItem(LINE_DEFAULTS_KEY, JSON.stringify(obj));
    }
  } catch(e){
    // best-effort; ignore
  }
}

// Simple Line 1/2/3 defaults as used by Department Setup UI.
// id is "line1" | "line2" | "line3"
export function getLineDefaults(id){
  const all = readLineDefaultsStorage();
  const num = String(id).replace('line','');
  const val = all[num];
  if (!val || typeof val !== 'object') {
    return { hose:'', nozzle:'', length:0, elevation:0 };
  }
  return {
    hose: String(val.hose ?? ''),
    nozzle: String(val.nozzle ?? ''),
    length: Number(val.length ?? 0),
    elevation: Number(val.elevation ?? 0),
  };
}

export function setLineDefaults(id, data){
  if (!data || typeof data !== 'object') return;
  const num = String(id).replace('line','');
  if (!num) return;
  const all = readLineDefaultsStorage();
  all[num] = {
    hose: String(data.hose ?? ''),
    nozzle: String(data.nozzle ?? ''),
    length: Number(data.length ?? 0),
    elevation: Number(data.elevation ?? 0),
  };
  writeLineDefaultsStorage(all);
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

// Build a full line object for left/back/right from the simple line defaults
// saved by Department Setup (Line 1/2/3).
function buildDeptLineFromSimple(key){
  // Map our front-panel keys to numeric line defaults: 1, 2, 3
  const map = { left:'1', back:'2', right:'3' };
  const num = map[key];
  if (!num) return null;

  const all = readLineDefaultsStorage();
  const simple = all[num];
  if (!simple || typeof simple !== 'object') return null;

  // Base templates match seedInitialDefaults
  let base;
  if (key === 'left' || key === 'back') {
    base = {
      label: key === 'left' ? 'Line 1' : 'Line 2',
      visible: false,
      itemsMain: [{ size:'1.75', lengthFt:200 }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: NOZ.chief185_50,
    };
  } else if (key === 'right') {
    base = {
      label: 'Line 3',
      visible: false,
      itemsMain: [{ size:'2.5', lengthFt:250 }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: NOZ.chiefXD265,
    };
  } else {
    return null;
  }

  const hoseSize = simple.hose && String(simple.hose).trim()
    ? String(simple.hose).trim()
    : base.itemsMain[0].size;

  const lengthFtRaw = (simple.length != null) ? Number(simple.length) : base.itemsMain[0].lengthFt;
  const lengthFt = Number.isFinite(lengthFtRaw) && lengthFtRaw > 0 ? lengthFtRaw : base.itemsMain[0].lengthFt;

  const elevRaw = (simple.elevation != null) ? Number(simple.elevation) : base.elevFt;
  const elevFt = Number.isFinite(elevRaw) ? elevRaw : 0;

  const nozzleId = simple.nozzle && String(simple.nozzle).trim();
  const nozzle = nozzleId && NOZ[nozzleId] ? NOZ[nozzleId] : base.nozRight;

  const line = JSON.parse(JSON.stringify(base));
  if (line.itemsMain && line.itemsMain[0]) {
    line.itemsMain[0].size = hoseSize;
    line.itemsMain[0].lengthFt = lengthFt;
  }
  line.elevFt = elevFt;
  line.nozRight = nozzle;
  return line;
}

export function getDeptLineDefault(key){
  // Prefer new per-line defaults from Department Setup (Line 1/2/3)
  const fromSimple = buildDeptLineFromSimple(key);
  if (fromSimple) return fromSimple;

  // Fallback: legacy storage used by older builds
  const all = loadDeptDefaults();
  return (all && all[key]) ? all[key] : null;
}

export function setDeptLineDefault(key, data){
  const all = loadDeptDefaults();
  all[key] = data;
  saveDeptDefaults(all);
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

export 
function seedDefaultsForKey(key){
  if(!state.lines) seedInitialDefaults();

  // Prefer department-saved defaults for the three front-panel attack lines.
  // If the line has not been made visible yet in this session, we treat the
  // Department Setup values as the "starting point." Once the user has
  // pulled a line and edited it, we keep their edits.
  if (key === 'left' || key === 'back' || key === 'right') {
    const current = state.lines[key];
    const shouldOverride = !current || !current.visible;
    if (shouldOverride) {
      const deptLine = getDeptLineDefault(key);
      if (deptLine && typeof deptLine === 'object') {
        // Clone so we don't mutate the stored template directly
        state.lines[key] = JSON.parse(JSON.stringify(deptLine));
        return state.lines[key];
      }
    }
  }

  if(state.lines[key]) return state.lines[key];

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
      nozRight: L1N,
    };
  }
  return state.lines[key];
}

// === Tiny helpers used elsewhere (dom-only) =================
export const show = (elm, disp='') => { if (elm) elm.style.display = disp; };
export const hide = (elm) => { if (elm) elm.style.display = 'none'; };

export function injectStyle(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = css;
  document.head.appendChild(s);
}
