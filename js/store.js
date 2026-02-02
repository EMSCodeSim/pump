// store.js
// Central app state, nozzle catalog, presets, and hydraulic helpers.
// - Lines start hidden; supply starts 'off' (user chooses).
// - NFPA elevation: PSI_PER_FT = 0.05 (0.5 psi / 10 ft).

export const state = {
  supply: 'off',
  showMath: false,
  lastMaxKey: null,
  lines: null,
  _presetsMem: null,
};

/* =========================
 * Visual constants
 * ========================= */
export const COLORS = {
  '1.75': '#ff4545',   // red
  '2.5' : '#2e6cff',   // blue
  '5'   : '#ffd23a',   // yellow
};

export const HOSES_MATCHING_CHARTS = [
  { id: '1.75', label: '1¾"' },
  { id: '2.5',  label: '2½"' },
  { id: '4',    label: '4"'  },
  { id: '5',    label: '5"'  },
];

/* =========================
 * Persisted "store" object
 * ========================= */
const STORE_KEY = 'fireops_store_v1';

function safeParse(json, fallback){
  try { return JSON.parse(json); } catch(e){ return fallback; }
}
function safeStringify(obj){
  try { return JSON.stringify(obj); } catch(e){ return 'null'; }
}

export const store = (() => {
  const raw = localStorage.getItem(STORE_KEY);
  const obj = safeParse(raw, null);
  if (obj && typeof obj === 'object') return obj;
  return {
    hoses: [],
    nozzles: [],
    appliances: [],
    updatedAt: Date.now(),
  };
})();

export function saveStore(){
  store.updatedAt = Date.now();
  localStorage.setItem(STORE_KEY, safeStringify(store));
}

/* =========================
 * Dept selection (hoses/nozzles)
 * ========================= */
const LS_DEPT_HOSES = 'fireops_dept_hoses_v1';
const LS_DEPT_NOZZ  = 'fireops_dept_nozzles_v1';

export function setSelectedHoses(ids){
  localStorage.setItem(LS_DEPT_HOSES, safeStringify(ids || []));
}
export function setSelectedNozzles(ids){
  localStorage.setItem(LS_DEPT_NOZZ, safeStringify(ids || []));
}

export function addCustomHose(label, diameter, cValue){
  store.hoses = Array.isArray(store.hoses) ? store.hoses : [];
  store.hoses.push({
    id: 'H_' + Math.random().toString(36).slice(2,9),
    label,
    diameter: String(diameter),
    cValue: Number(cValue) || null,
    custom: true
  });
  saveStore();
}

export function addCustomNozzle(label, gpm, np){
  store.nozzles = Array.isArray(store.nozzles) ? store.nozzles : [];
  store.nozzles.push({
    id: 'N_' + Math.random().toString(36).slice(2,9),
    label,
    gpm: Number(gpm) || 0,
    np: Number(np) || 0,
    custom: true
  });
  saveStore();
}

/* =========================
 * Hose + nozzle libraries
 * ========================= */
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
];

export const NOZ = (() => {
  const out = {};
  for (const n of NOZ_LIST) out[n.id] = n;
  // allow custom
  if (Array.isArray(store.nozzles)) {
    for (const n of store.nozzles) out[n.id] = n;
  }
  return out;
})();

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
  return NOZ[nid] || null;
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

export function sizeLabel(size){
  const s = normalizeHoseDiameter(size);
  if (s === '1.5') return '1 1/2"';
  if (s === '1.75') return '1 3/4"';
  if (s === '2.5') return '2 1/2"';
  return s ? `${s}"` : '—';
}

function flPer100(size, gpm, cOverride){
  const dia = normalizeHoseDiameter(size);
  const C = (cOverride && Number.isFinite(Number(cOverride))) ? Number(cOverride) : (COEFF[dia] ?? 0);
  const Q = (Number(gpm) || 0) / 100;
  return C * (Q * Q);
}

export function FL(gpm, size, lengthFt, cOverride){
  if(!size || !lengthFt || !gpm) return 0;
  return flPer100(size, gpm, cOverride) * (lengthFt/100);
}

export function FL_total(gpm, items){
  if(!Array.isArray(items) || !items.length || !gpm) return 0;
  let sum = 0;
  for(const seg of items){
    // ✅ Accept legacy keys (hose/hoseDiameter) so first-run isn’t blank
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
    // ✅ Normalize legacy keys so bubbles + FL work immediately
    size: String(s?.size ?? s?.hose ?? s?.hoseDiameter ?? s?.dia ?? s?.diameter ?? s?.hoseSize ?? s?.hoseDia ?? '').trim(),
    lengthFt: Number(s?.lengthFt ?? s?.length ?? s?.len ?? 0) || 0,
    cValue: (Number.isFinite(Number(s?.cValue)) && Number(s?.cValue)>0) ? Number(s.cValue) : null,
  }));
}

/* =========================
 * Appliance & elevation loss
 * ========================= */
export function computeApplianceLoss(totalGpm){
  return (Number(totalGpm)||0) > 350 ? 10 : 0;
}

export function elevationLoss(elevFt){
  return (Number(elevFt)||0) * PSI_PER_FT;
}

/* =========================
 * Presets
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
  try{
    localStorage.setItem(PRESETS_KEY, safeStringify(presets || []));
  }catch(e){}
}

/* =========================
 * Dept defaults storage
 * ========================= */
const DEPT_DEFAULTS_KEY = 'pump_dept_defaults_v1';

function readDeptStorage(){
  try{
    const raw = localStorage.getItem(DEPT_DEFAULTS_KEY);
    const obj = safeParse(raw, null);
    return (obj && typeof obj === 'object') ? obj : null;
  }catch(e){
    return null;
  }
}

function writeDeptStorage(obj){
  try{
    localStorage.setItem(DEPT_DEFAULTS_KEY, safeStringify(obj || {}));
    return true;
  }catch(e){
    return false;
  }
}

export function loadDeptDefaults(){
  const obj = readDeptStorage();
  // IMPORTANT: If nothing stored, do NOT seed from in-memory placeholders.
  // Let getDeptLineDefault fall back to a real first-run template.
  return obj;
}

export function saveDeptDefaults(obj){
  if(!obj) return false;
  return writeDeptStorage(obj);
}

export function getDeptLineDefault(key){
  const all = loadDeptDefaults();
  const candidate = all ? all[key] : null;

  const firstRunFallback = () => {
    const label = (key === 'left') ? 'Line 1'
               : (key === 'back') ? 'Line 2'
               : (key === 'right') ? 'Line 3'
               : 'Line';

    const hose = '1.75';
    const len  = 200;
    const nozObj = resolveNozzleById('fog185_50') || resolveNozzleById('fog150_50') || null;

    return {
      label,
      visible: false,
      itemsMain: [{ size: normalizeHoseDiameter(hose) || hose, lengthFt: len, cValue: null }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: nozObj,
    };
  };

  if (candidate && typeof candidate === 'object' && Array.isArray(candidate.itemsMain)) {
    // ✅ Normalize legacy section shapes so hose size renders and FL works on first-run.
    const safe = JSON.parse(JSON.stringify(candidate));
    safe.visible = false;

    safe.itemsMain  = splitIntoSections(safe.itemsMain);
    safe.itemsLeft  = splitIntoSections(safe.itemsLeft);
    safe.itemsRight = splitIntoSections(safe.itemsRight);

    if (safe.nozRight && typeof safe.nozRight === 'object') {
      const nid = canonicalNozzleId(safe.nozRight.id || safe.nozRight.value || safe.nozRight);
      safe.nozRight = resolveNozzleById(nid) || safe.nozRight;
    } else if (typeof safe.nozRight === 'string') {
      safe.nozRight = resolveNozzleById(safe.nozRight) || null;
    }

    return safe;
  }

  // Compatibility: fireops_line_defaults_v1
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
      itemsMain: [{ size: normalizeHoseDiameter(hose) || hose, lengthFt: len, cValue: resolveHoseMeta(hose).c }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: elev,
      nozRight: nozObj || null,
    };

    try{
      const full = loadDeptDefaults() || {};
      full[key] = built;
      saveDeptDefaults(full);
    }catch(_){}

    return built;
  }catch(e){
    return candidate || firstRunFallback();
  }
}

/* =========================
 * In-memory line seeding
 * ========================= */
function seedInitialDefaults(){
  if (state.lines) return;

  // Seed with real hose segments so first-run deployed lines show hose size + PP ≠ NP
  const nozDefault = resolveNozzleById('fog185_50') || resolveNozzleById('fog150_50') || null;

  state.lines = {
    left: {
      label: 'Line 1',
      visible: false,
      itemsMain: [{ size: '1.75', lengthFt: 200, cValue: null }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: nozDefault,
    },
    back: {
      label: 'Line 2',
      visible: false,
      itemsMain: [{ size: '1.75', lengthFt: 200, cValue: null }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: nozDefault,
    },
    right: {
      label: 'Line 3',
      visible: false,
      itemsMain: [{ size: '1.75', lengthFt: 200, cValue: null }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: nozDefault,
    }
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
 * Misc helpers used elsewhere
 * ========================= */
export function isSingleWye(L){
  if(!L) return false;
  return !!L.hasWye;
}
