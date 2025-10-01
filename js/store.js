// store.js
// Central app state, nozzle catalog, and hydraulic helpers.
// Fix: initialize state.lines to avoid "Cannot convert undefined or null to object" in views.
// Updates: NFPA elevation (0.05 psi/ft) and appliance loss (10 psi only if total GPM > 350).

/* =========================
 * Global shared state
 * ========================= */
export const state = {
  supply: 'pressurized',
  showMath: false,
  lastMaxKey: null,
  // Pre-seed lines so any Object.values/entries calls are safe before a view seeds.
  lines: null, // will be populated immediately below by seedInitialDefaults()
};

/* =========================
 * Visual constants
 * ========================= */
export const COLORS = {
  '1.75': '#ff4545',  // red
  '2.5':  '#2e6cff',  // blue
  '5':    '#ffd23a',  // yellow
};

/* =========================
 * Nozzle catalog
 * ========================= */
export const NOZ = {
  fog95_50:      { id:'fog95_50',      name:'Fog 95 @ 50',   gpm:95,  NP:50 },
  fog150_75:     { id:'fog150_75',     name:'Fog 150 @ 75',  gpm:150, NP:75 },

  chief185_50:   { id:'chief185_50',   name:'Fog 185 @ 50',  gpm:185, NP:50 },
  chiefXD:       { id:'chiefXD',       name:'Fog 185 @ 50',  gpm:185, NP:50 },   // alias used in older files
  chiefXD265:    { id:'chiefXD265',    name:'Fog 265 @ 50',  gpm:265, NP:50 },

  sb7_8:         { id:'sb7_8',         name:'SB 7/8″ @ 50',  gpm:160, NP:50 },
  sb1_1_8:       { id:'sb1_1_8',       name:'SB 1 1/8″ @ 50',gpm:265, NP:50 },
};
export const NOZ_LIST = Object.values(NOZ);

/* Pretty size label for UI snippets */
export function sizeLabel(v){
  return v === '1.75' ? '1¾″' : v === '2.5' ? '2½″' : v === '5' ? '5″' : (v || '');
}

/* =========================
 * Hydraulics helpers
 * ========================= */

/** NFPA: 0.5 psi per 10 ft elevation gain => 0.05 psi/ft. */
export const PSI_PER_FT = 0.05;

/**
 * Appliance loss rule:
 *  - 10 psi ONLY when total GPM > 350
 *  - otherwise 0 psi
 */
export function applianceLoss(totalGpm){
  return totalGpm > 350 ? 10 : 0;
}

/**
 * Friction loss per 100 ft using common fire-service shorthand:
 *   FL_100 = C * (GPM/100)^2
 * Typical C-values:
 *   1¾″ -> 15
 *   2½″ -> 2
 *   5″   -> 0.08
 */
function flPer100(size, gpm){
  const q = Math.max(0, gpm) / 100;
  const C =
    size === '1.75' ? 15 :
    size === '2.5'  ? 2  :
    size === '5'    ? 0.08 :
    10; // default fallback
  return C * q * q;
}

/** Friction loss for a single segment (psi). */
export function FL(gpm, size, lengthFt){
  if(!size || !lengthFt || !gpm) return 0;
  const per100 = flPer100(size, gpm);
  return per100 * (lengthFt/100);
}

/** Sum friction loss across segments. */
export function FL_total(gpm, items){
  if(!Array.isArray(items) || !items.length || !gpm) return 0;
  let sum = 0;
  for(const seg of items){
    sum += FL(gpm, seg.size, seg.lengthFt);
  }
  return sum;
}

/** Sum length (ft). */
export function sumFt(items){
  if(!Array.isArray(items)) return 0;
  return items.reduce((a,c)=> a + (Number(c.lengthFt)||0), 0);
}

/** Keep section list stable for UI (optionally merge in future). */
export function splitIntoSections(items){
  if(!Array.isArray(items)) return [];
  return items.map(s => ({ size: String(s.size), lengthFt: Number(s.lengthFt)||0 }));
}

/* =========================
 * Line defaults & helpers
 * ========================= */

/**
 * Seed initial defaults once so any view can safely access state.lines immediately.
 *   L1: 200′ of 1¾″, 185 GPM @ 50 psi
 *   L2: 200′ of 1¾″, 185 GPM @ 50 psi
 *   L3: 250′ of 2½″, 265 GPM @ 50 psi (hidden)
 */
function seedInitialDefaults(){
  if (state.lines) return;
  const L1N = NOZ.chief185_50;
  const L3N = NOZ.sb1_1_8; // ~265 gpm @ 50 psi
  state.lines = {
    left:  {
      label: 'Line 1',
      visible: true,
      itemsMain: [{ size:'1.75', lengthFt:200 }],
      itemsLeft: [],
      itemsRight: [],
      hasWye: false,
      elevFt: 0,
      nozRight: L1N,
    },
    back:  {
      label: 'Line 2',
      visible: true,
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
// seed immediately so callers never see null
seedInitialDefaults();

/** Ensures a key exists and returns it (won’t overwrite existing). */
export function seedDefaultsForKey(key){
  if(!state.lines) state.lines = {};
  if(state.lines[key]) return state.lines[key];

  const L1N = NOZ.chief185_50;
  const L3N = NOZ.sb1_1_8;

  if(key === 'left'){
    state.lines.left = {
      label: 'Line 1',
      visible: true,
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
      visible: true,
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
      nozRight: NOZ_LIST[0] || null,
    };
  }
  return state.lines[key];
}

/**
 * True when Wye is present and exactly one branch is active.
 */
export function isSingleWye(L){
  if(!L || !L.hasWye) return false;
  const leftLen  = sumFt(L.itemsLeft || []);
  const rightLen = sumFt(L.itemsRight || []);
  const leftOn   = leftLen > 0 || !!L.nozLeft;
  const rightOn  = rightLen > 0 || !!L.nozRight;
  return (leftOn && !rightOn) || (!leftOn && rightOn);
}

/** Returns 'L' or 'R' for the active single-branch side; defaults to 'R'. */
export function activeSide(L){
  if(!L) return 'R';
  const l = sumFt(L.itemsLeft || []);
  const r = sumFt(L.itemsRight || []);
  if(l > 0 && r <= 0) return 'L';
  if(r > 0 && l <= 0) return 'R';
  return 'R';
}

/** For single-branch scenarios, pick the active nozzle; else returns L.nozRight when used generically. */
export function activeNozzle(L){
  if(!L) return null;
  if(isSingleWye(L)){
    return activeSide(L) === 'L' ? (L.nozLeft || L.nozRight) : (L.nozRight || L.nozLeft);
  }
  return L.nozRight || L.nozLeft || null;
}

/* Convenience: compute appliance loss for a given total flow. */
export function computeApplianceLoss(totalGpm){
  return applianceLoss(totalGpm);
}

/* Small utils */
export function round1(n){ return Math.round((Number(n)||0)*10)/10; }
