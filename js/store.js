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
    // custom items (best-effort; catalog is still NOZ for calculations)
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
  // Dept UI hoses are a simple list used by dropdowns
  setDeptUiHoses(getDeptHoses());
  saveStore();
}

export function setSelectedNozzles(ids){
  store.deptSelectedNozzles = Array.isArray(ids) ? ids.map(String) : [];
  // Dept UI nozzles are ids; getDeptNozzles() resolves to full nozzle objects
  setDeptUiNozzles(store.deptSelectedNozzles);
  saveStore();
}

// Minimal custom item creators for Department Setup UI (does not affect hydraulics unless ids are used elsewhere)
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

  // Keep Department equipment storage in sync.
  // Calc/presets read custom nozzles from the shared dept-equipment key
  // (see preset.js getDeptCustomNozzlesForCalc), so if we only write to
  // store.customNozzles, Department Setup and Calc can drift apart.
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
  // Use Dept UI list if present; otherwise show chart-matching hoses.
  if (Array.isArray(DEPT_UI_HOSES) && DEPT_UI_HOSES.length) return DEPT_UI_HOSES;
  return HOSES_MATCHING_CHARTS.slice();
}



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

// Resolve a hose input (id or diameter) into { dia, c, kind }.
// - dia is the diameter string used by COEFF keys (e.g. '1.75', '2.0', '2.5', '5')
// - c is optional friction-loss coefficient override (for custom hoses)
// - kind is 'built' | 'lowfriction' | 'custom' | 'diameter'
function resolveHoseMeta(input){
  const raw = (input == null ? '' : String(input)).trim();
  if (!raw) return { dia:'', c:null, kind:'diameter' };

  // Built-in / low-friction ids
  if (HOSE_ID_TO_DIA[raw]) {
    const dia = HOSE_ID_TO_DIA[raw];
    // If this is a low-friction id, we allow an override C only if the dept storage includes one;
    // otherwise the default COEFF[dia] applies.
    return { dia, c: null, kind: raw.startsWith('h_lf_') ? 'lowfriction' : 'built' };
  }

  // Custom hose ids (canonical storage is fireops_dept_equipment_v1.customHoses)
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
    }catch(_e){ /* ignore */ }
    return { dia:'', c:null, kind:'custom' };
  }

  // Already a diameter string
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

  // Custom hose id -> diameter
  if (s.startsWith('custom_hose_')) {
    try{
      const rawDept = localStorage.getItem('fireops_dept_equipment_v1');
      const dept = rawDept ? JSON.parse(rawDept) : {};
      const list = Array.isArray(dept?.customHoses) ? dept.customHoses : [];
      const found = list.find(h => h && String(h.id) === s);
      const dia = found ? String(found.diameter ?? found.dia ?? found.size ?? '').trim() : '';
      if (dia) return normalizeHoseDiameter(dia);
    }catch(_e){ /* ignore */ }
    return '';
  }

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
  'fog_xd_25_50_265':  'chiefXD265',
};

export function canonicalNozzleId(raw){
  const id = String(raw || '').trim();
  if (!id) return '';
  return LEGACY_NOZ_ID_MAP[id] || id;
}

function resolveNozzleById(raw){
  const id = canonicalNozzleId(raw);
  if (!id) return null;

  // 1) built-in catalog
  if (NOZ && NOZ[id]) return NOZ[id];
  if (NOZ && NOZ[id + '_50']) return NOZ[id + '_50'];

  // 2) custom nozzles created by user (stored in store.customNozzles)
  const custom = (store && Array.isArray(store.customNozzles)) ? store.customNozzles : [];
  const c = custom.find(n => n && String(n.id) === id);
  if (c) {
    // Normalize to the same shape calc expects
    return {
      id: String(c.id),
      name: String(c.name || c.label || c.id),
      gpm: Number(c.gpm ?? c.GPM ?? 0),
      NP:  Number(c.NP ?? c.np ?? 0),
      label: c.label || c.name || c.id,
    };
  }

  // 2b) custom nozzles saved in Department equipment storage (fireops_dept_equipment_v1)
  //     This is the canonical source used by Department Setup and Calc dropdowns.
  //     Shape: { customNozzles: [{id,label/name,gpm,NP}, ...] }
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
          gpm: Number(d.gpm ?? d.GPM ?? 0),
          NP:  Number(d.NP ?? d.np ?? 0),
          label: d.label || d.name || d.id,
        };
      }
    }
  } catch (e) {
    // ignore
  }

  // 3) safety fallback: search list (covers future catalog shapes)
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
  // Canonical nozzle list for all UIs.
  // DEPT_UI_NOZZLES can contain:
  //  - ids (strings), or
  //  - small UI objects {id,label} from Department Setup.
  // We always resolve to full calc-ready nozzle objects from NOZ (plus any stored customNozzles).
  const catalog = Array.isArray(NOZ_LIST) ? NOZ_LIST : [];

  // Custom nozzles can live in TWO places depending on which UI created them:
  // - store.customNozzles (legacy / fireops_store_v1)
  // - dept equipment storage (fireops_dept_equipment_v1) (used by dept setup + calc + presets)
  // IMPORTANT: If dept storage has custom nozzles, that is the canonical source.
  // Legacy store.customNozzles often contains stale/unnamed entries that show up as
  // "Custom nozzle XXX gpm @ YY psi" in the Line 1/2/3 dropdown.
  let custom = Array.isArray(store?.customNozzles) ? store.customNozzles : [];
  try {
    const KEY = 'fireops_dept_equipment_v1';
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const dept = JSON.parse(raw);
        if (dept && Array.isArray(dept.customNozzles) && dept.customNozzles.length) {
          // Use dept.customNozzles as canonical.
          // (Calc and presets read from this same object.)
          custom = dept.customNozzles;
        }
      }
    }
  } catch (e) {
    // non-fatal: fall back to store.customNozzles
  }

  function toFull(item){
    if (!item) return null;
    if (typeof item === 'string') item = { id: item };
    const rawId = String(item.id || '').trim();
    if (!rawId) return null;

    // 1) resolve against built-in catalog
    const built = resolveNozzleById(rawId);
    if (built) {
      return {
        id: built.id,
        label: item.label || item.name || built.name || built.label || built.id,
        gpm: Number(built.gpm ?? built.GPM ?? 0),
        NP:  Number(built.NP ?? built.np ?? 0),
      };
    }

    // 2) resolve against stored custom nozzles (UI only)
    const c = custom.find(n => n && String(n.id) === rawId);
    if (c) {
      return {
        id: c.id,
        // IMPORTANT: prefer the UI label/name if Department Setup passed one.
        // This is what keeps Line 1/2/3 showing the user's custom nozzle name.
        label: item.label || item.name || c.label || c.name || c.id,
        gpm: Number(c.gpm ?? 0),
        NP:  Number(c.NP ?? c.np ?? c.psi ?? c.pressure ?? 0),
      };
    }
    return null;
  }

  // Prefer department-selected list (ids or objects)
  if (Array.isArray(DEPT_UI_NOZZLES) && DEPT_UI_NOZZLES.length) {
    const resolved = DEPT_UI_NOZZLES.map(toFull).filter(Boolean);
    if (resolved.length) return resolved;
  }

  // Otherwise show full catalog + custom (so dropdowns are never empty)
  const base = catalog.map(n => ({
    id: n.id,
    label: n.label || n.name || n.id,
    gpm: Number(n.gpm ?? n.GPM ?? 0),
    NP:  Number(n.NP ?? n.np ?? 0),
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

export function splitIntoSections(items){
  if(!Array.isArray(items)) return [];
  return items.map(s => ({
    size: String(s.size),
    lengthFt: Number(s.lengthFt)||0,
    cValue: (Number.isFinite(Number(s.cValue)) && Number(s.cValue)>0) ? Number(s.cValue) : null,
  }));
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

  const existing = state.lines ? state.lines[key] : null;

  // A placeholder is a blank line with no hose + no nozzle set yet.
  const isPlaceholder = (L) => !!L
    && Array.isArray(L.itemsMain) && L.itemsMain.length === 0
    && Array.isArray(L.itemsLeft) && L.itemsLeft.length === 0
    && Array.isArray(L.itemsRight) && L.itemsRight.length === 0
    && !L.nozRight && !L.nozLeft
    && !L.hasWye;

  // IMPORTANT:
  // Only pull from saved Department defaults when the current in-memory line
  // is missing or still a blank placeholder. If we overwrite every click,
  // calc can never retract a line (it keeps getting re-seeded).
  if (key === 'left' || key === 'back' || key === 'right') {
    if (!existing || isPlaceholder(existing)) {
      const deptLine = getDeptLineDefault(key);
      if (deptLine && typeof deptLine === 'object') {
        state.lines[key] = JSON.parse(JSON.stringify(deptLine));
        return state.lines[key];
      }
    }
    // If we already have a real line object, return it as-is.
    if (existing) return existing;
  }


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
    hose: normalizeHoseDiameter(main.size || '') || normalizeHoseDiameter(L._hoseId || ''),
    nozzle: (L._nozId || (L.nozRight && L.nozRight.id) || ''),
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
    // Default start layout: Line 3 = 250' of 2½" with Chief XD 265 gpm @ 50 psi.
    line3: { hoseDiameter: '2.5',  nozzleId: 'chiefXD265',  lengthFt: 250, elevationFt: 0 },
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


// Ensure a nozzle id is included in the department-selected nozzle ids.
// This prevents Calc nozzle dropdown filters from dropping a nozzle that is used
// as a Department default Line 1/2/3 nozzle (especially custom_noz_*).
function ensureDeptNozzleSelected(nozId){
  const id = String(nozId||'').trim();
  if(!id) return;
  try{
    const KEY = 'fireops_dept_equipment_v1';
    const raw = (typeof localStorage!=='undefined') ? localStorage.getItem(KEY) : null;
    const dept = raw ? (JSON.parse(raw)||{}) : {};
    const arr = Array.isArray(dept.nozzles) ? dept.nozzles.map(String) : [];
    if(!arr.includes(id)){
      arr.push(id);
      dept.nozzles = arr;
      if (typeof localStorage!=='undefined') localStorage.setItem(KEY, JSON.stringify(dept));
    }
  }catch(_e){/* ignore */}
  try{
    // Keep legacy store selection in sync so DEPT_UI_NOZZLES stays aligned.
    if (typeof store !== 'undefined' && store && Array.isArray(store.deptSelectedNozzles)){
      const arr = store.deptSelectedNozzles.map(String);
      if(!arr.includes(id)){
        arr.push(id);
        store.deptSelectedNozzles = arr;
        if (typeof setDeptUiNozzles === 'function') setDeptUiNozzles(arr);
        if (typeof saveStore === 'function') saveStore();
      }
    }
  }catch(_e){/* ignore */}
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

  // Make sure the chosen nozzle is part of the department-selected nozzle ids.
  ensureDeptNozzleSelected(nozId);

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
    _hoseId: hoseIdRaw,
    _nozId: nozId,
    nozRight: resolveNozzleById(nozId),
  };

  setDeptLineDefault(key, L);
}

