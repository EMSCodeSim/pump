// store.js
// Central app state, nozzle catalog, presets, and hydraulic helpers.
// - Lines start hidden; supply starts 'off' (user chooses).
// - NFPA elevation: PSI_PER_FT = 0.05 (0.5 psi / 10 ft).
// - Appliance loss: +10 psi only if total GPM > 350.
// - Exports restored for other views: COEFF, loadPresets, savePresets.

export const state = {
  supply: 'off',       // 'off' | 'pressurized' | 'draft'
  supplyHint: '',      // small UI label
  showCharts: false,

  // Active lines keyed by panel position (left/back/right)
  lines: {
    left: null,
    back: null,
    right: null,
  },

  // UI selections
  activeSide: 'left',  // left | back | right

  // Optional add-ons / toggles
  appliances: {
    wye: false,
    standpipe: false,
    masterStream: false,
    foam: false,
  },

  // Department data caches (read from localStorage + dept setup)
  customNozzles: [],

  // Pump results
  result: null,
};

// ---------- Constants ----------
export const PSI_PER_FT = 0.05; // 0.5 psi per 10 ft
export const APPLIANCE_LOSS_HIGHFLOW_PSI = 10;

// Hose friction coefficients (COEFF) used by calculator and views
export const COEFF = {
  '1.5': 24,
  '1.75': 15.5,
  '2': 8,
  '2.5': 2,
  '3': 0.8,
  '4': 0.2,
  '5': 0.08,
};

// ---------- Nozzle catalog ----------
const NOZZLES = [
  // Fog
  { id: 'fog_95_150', label: 'Fog 95 @ 150', gpm: 95, NP: 150, type: 'fog' },
  { id: 'fog_125_100', label: 'Fog 125 @ 100', gpm: 125, NP: 100, type: 'fog' },
  { id: 'fog_150_100', label: 'Fog 150 @ 100', gpm: 150, NP: 100, type: 'fog' },
  { id: 'fog_185_50', label: 'Fog 185 @ 50', gpm: 185, NP: 50, type: 'fog' },

  // Smooth bore (common)
  { id: 'sb_7_8_50', label: 'Smooth Bore 7/8" @ 50', gpm: 185, NP: 50, type: 'sb', tip: '7/8"' },
  { id: 'sb_15_16_50', label: 'Smooth Bore 15/16" @ 50', gpm: 210, NP: 50, type: 'sb', tip: '15/16"' },
  { id: 'sb_1_1_8_50', label: 'Smooth Bore 1-1/8" @ 50', gpm: 265, NP: 50, type: 'sb', tip: '1-1/8"' },
  { id: 'sb_1_1_4_50', label: 'Smooth Bore 1-1/4" @ 50', gpm: 325, NP: 50, type: 'sb', tip: '1-1/4"' },

  // Master stream examples
  { id: 'ms_500_80', label: 'Master Stream 500 @ 80', gpm: 500, NP: 80, type: 'ms' },
  { id: 'ms_750_80', label: 'Master Stream 750 @ 80', gpm: 750, NP: 80, type: 'ms' },
];

// ---------- Local storage helpers ----------
function safeParse(raw, fallback) {
  try { return raw ? JSON.parse(raw) : fallback; } catch (_e) { return fallback; }
}
function safeStringify(obj) {
  try { return JSON.stringify(obj); } catch (_e) { return '{}'; }
}

export function saveState() {
  try {
    localStorage.setItem('fireops_store_state_v1', safeStringify(state));
  } catch (_e) {}
}

export function loadState() {
  try {
    const raw = localStorage.getItem('fireops_store_state_v1');
    const parsed = safeParse(raw, null);
    if (parsed && typeof parsed === 'object') {
      // shallow merge
      Object.assign(state, parsed);
    }
  } catch (_e) {}
}

// ---------- Normalize hose sizes ----------
export function normalizeHoseDiameter(v) {
  if (v == null) return '';
  const s = String(v).trim().toLowerCase();
  if (!s) return '';
  if (s.includes('1 1/2') || s === '1.5' || s === '1.50') return '1.5';
  if (s.includes('1 3/4') || s === '1.75' || s === '1.75"' || s === '1 3/4') return '1.75';
  if (s.includes('2 1/2') || s === '2.5' || s === '2.50' || s === '2 1/2') return '2.5';
  if (s === '2') return '2';
  if (s === '3') return '3';
  if (s === '4') return '4';
  if (s === '5' || s.includes('5')) return '5';
  // default
  return s.replace('"', '');
}

// ---------- Nozzle resolver ----------
export function resolveNozzleById(id) {
  if (!id) return null;

  // 1) dept custom nozzles (synced into state.customNozzles)
  const cn = state.customNozzles || [];
  const hitCustom = cn.find(n => String(n.id) === String(id));
  if (hitCustom) return hitCustom;

  // 2) built-in
  const hit = NOZZLES.find(n => n.id === id);
  return hit || null;
}

// ---------- Custom nozzles (kept in sync with dept storage) ----------
export function loadCustomNozzlesFromDept() {
  try {
    const KEY = 'fireops_dept_equipment_v1';
    const raw = localStorage.getItem(KEY);
    const dept = raw ? JSON.parse(raw) : {};
    const arr = Array.isArray(dept.customNozzles) ? dept.customNozzles : [];
    state.customNozzles = arr.map(x => ({
      id: String(x.id || ''),
      label: String(x.label || x.name || 'Custom nozzle'),
      name: String(x.name || x.label || 'Custom nozzle'),
      gpm: Number(x.gpm || 0),
      NP: Number(x.NP || x.np || x.psi || 0),
      type: 'custom',
    })).filter(x => x.id);
  } catch (_e) {
    state.customNozzles = [];
  }
}

export function addCustomNozzle({ id, label, gpm, np }) {
  if (!id) return;
  const noz = { id:String(id), name:String(label||'Custom nozzle'), label:String(label||'Custom nozzle'), gpm:Number(gpm||0), NP:Number(np||0) };
  state.customNozzles.push(noz);

  // Keep Department equipment storage in sync.
  // Calc/presets read custom nozzles from the shared dept-equipment key
  // (see preset.js getDeptCustomNozzlesForCalc), so if we only write to
  // state.customNozzles, Department Setup and Calc can drift apart.
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
}

// ---------- Presets ----------
export function loadPresets() {
  try {
    const raw = localStorage.getItem('fireops_presets_v1');
    const parsed = safeParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

export function savePresets(list) {
  try {
    localStorage.setItem('fireops_presets_v1', safeStringify(Array.isArray(list) ? list : []));
  } catch (_e) {}
}

// ---------- Dept line defaults (Line 1/2/3) ----------
export function setDeptLineDefault(sideKey, lineObj) {
  // Store to shared key used by Department Setup:
  // fireops_line_defaults_v1: { '1': { hose, nozzle, length, elevation }, ... }
  try {
    const raw = localStorage.getItem('fireops_line_defaults_v1');
    const parsed = raw ? JSON.parse(raw) : {};
    const map = (sideKey === 'left') ? '1' : (sideKey === 'back') ? '2' : (sideKey === 'right') ? '3' : null;
    if (!map) return;

    // Pull out raw ids for hose/nozzle if present, else derive from built object
    const hose = lineObj?._hoseId || lineObj?.itemsMain?.[0]?.size || '1.75';
    const nozzle = lineObj?._nozId || lineObj?.nozRight?.id || '';

    parsed[map] = {
      hose,
      nozzle,
      length: Number(lineObj?.itemsMain?.[0]?.lengthFt ?? 200) || 200,
      elevation: Number(lineObj?.elevFt ?? 0) || 0,
    };

    localStorage.setItem('fireops_line_defaults_v1', JSON.stringify(parsed));
  } catch (_e) {}
}

export function getDeptLineDefault(sideKey) {
  // Used to build a default line object for calc view.
  // 1) If a candidate line object exists in state.lines, keep it.
  // 2) Else read from fireops_line_defaults_v1
  const candidate = state.lines?.[sideKey] || null;
  if (candidate) {
    const safe = JSON.parse(JSON.stringify(candidate));
    safe.visible = false;
    return safe;
  }

  // 2) Compatibility: simple line defaults saved by deptState.js (fireops_line_defaults_v1)
  //    Shape: { '1': { hose, nozzle, length, elevation }, ... }
  try{
    const raw = localStorage.getItem('fireops_line_defaults_v1');
    if (!raw) return candidate || null;
    const parsed = JSON.parse(raw) || {};
    const map = (sideKey === 'left') ? '1' : (sideKey === 'back') ? '2' : (sideKey === 'right') ? '3' : null;
    if (!map || !parsed[map]) return candidate || null;

    const d = parsed[map] || {};
    const hose = String(d.hose ?? d.size ?? d.diameter ?? '1.75');
    const len  = Number(d.length ?? d.len ?? 200) || 200;
    const elev = Number(d.elevation ?? d.elev ?? d.elevFt ?? 0) || 0;
    const nozId = String(d.nozzle ?? d.noz ?? d.nozId ?? '') || '';

    const nozObj = resolveNozzleById(nozId);

    const label = (sideKey === 'left') ? 'Line 1' : (sideKey === 'back') ? 'Line 2' : (sideKey === 'right') ? 'Line 3' : 'Line';

    const built = {
      label,
      visible: false,
      itemsMain: [{ size: normalizeHoseDiameter(hose), lengthFt: len }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: elev,
      _hoseId: String(d.hose ?? ''),
      _nozId: nozId,
      nozRight: nozObj,
    };

    return built;
  } catch (_e) {
    return candidate || null;
  }
}

// Convenience setter from Department Setup screens
export function setLineFromSetup(key, hoseIdRaw, nozId, len, elev) {
  const hoseId = normalizeHoseDiameter(hoseIdRaw || '1.75');
  const label =
    key === 'left' ? 'Line 1' :
    key === 'back' ? 'Line 2' :
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

// --- Added for calc UI gating: count configured preconnects (Line 1/2/3)
// Used by view.calc.main.js (and others). Reads Department Setup storage.
// Returns 0..3.
export function getConfiguredPreconnectCount() {
  try {
    // Current storage: simple defaults saved by Department Setup
    // Shape: { '1': { hose, nozzle, length, elevation }, '2': {...}, '3': {...} }
    const raw = localStorage.getItem('fireops_line_defaults_v1');
    if (raw) {
      const parsed = JSON.parse(raw) || {};
      const slots = ['1','2','3'];
      let n = 0;
      for (const s of slots) {
        const d = parsed[s];
        const hasHose = !!(d && (d.hose ?? d.size ?? d.diameter));
        const hasNoz  = !!(d && (d.nozzle ?? d.noz ?? d.nozId));
        if (hasHose && hasNoz) n++;
      }
      return n;
    }

    // Back-compat: some older builds stored preconnects as an array
    // Shape: [{hose, nozzle, lengthFt, elevFt, ...}, ...]
    const raw2 = localStorage.getItem('fireops_preconnects_v1');
    if (raw2) {
      const arr = JSON.parse(raw2);
      if (Array.isArray(arr)) {
        return arr.filter(x => x && x.hose && x.nozzle).length;
      }
    }

    return 0;
  } catch (_e) {
    return 0;
  }
}
