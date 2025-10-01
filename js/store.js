// store.js
// Central app state, nozzle catalog, and fluid calc helpers.
// Updated: NFPA elevation loss (0.5 psi / 10 ft), appliance loss (10 psi only if GPM > 350).

/* =========================
 * Global shared state
 * ========================= */
export const state = {
  supply: 'pressurized',
  // Lines are seeded lazily by seedDefaultsForKey to avoid overwriting any saved state.
  lines: null,
  showMath: false,
  lastMaxKey: null,
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
 *   id: stable key used in UI
 *   name: human label
 *   gpm: flow at rated NP
 *   NP:  rated nozzle pressure
 * ========================= */
export const NOZ = {
  // Common fogs
  fog95_50:      { id:'fog95_50',      name:'Fog 95 @ 50',   gpm:95,  NP:50 },
  fog150_75:     { id:'fog150_75',     name:'Fog 150 @ 75',  gpm:150, NP:75 },

  // Department “Chief” pattern often used in your files
  chief185_50:   { id:'chief185_50',   name:'Fog 185 @ 50',  gpm:185, NP:50 },
  chiefXD:       { id:'chiefXD',       name:'Fog 185 @ 50',  gpm:185, NP:50 },   // alias used in older views
  chiefXD265:    { id:'chiefXD265',    name:'Fog 265 @ 50',  gpm:265, NP:50 },

  // Smooth bores
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
 * (Use for wyes, manifolds, monitors, etc. where a flat rule is acceptable.)
 */
export function applianceLoss(totalGpm){
  return totalGpm > 350 ? 10 : 0;
}

/**
 * Friction loss per 100 ft using common fire-service shorthand:
 *   FL_100 = C * (GPM/100)^2
 * Typical C-values:
 *   1¾″ -> 15   (close to many field cheat-sheets)
 *   2½″ -> 2
 *   5″   -> 0.08
 */
function flPer100(size, gpm){
  const q = Math.max(0, gpm) / 100;
  const C =
    size === '1.75' ? 15 :
    size === '2.5'  ? 2  :
    size === '5'    ? 0.08 :
    10; // default catch-all
  return C * q * q;
}

/**
 * Friction loss for a single segment (lengthFt of a given size) at gpm.
 * Returns psi.
 */
export function FL(gpm, size, lengthFt){
  if(!size || !lengthFt || !gpm) return 0;
  const per100 = flPer100(size, gpm);
  return per100 * (lengthFt/100);
}

/**
 * Sum friction loss over an array of hose items: [{size, lengthFt}, ...]
 * Items may be mixed sizes.
 */
export function FL_total(gpm, items){
  if(!Array.isArray(items) || !items.length || !gpm) return 0;
  let sum = 0;
  for(const seg of items){
    sum += FL(gpm, seg.size, seg.lengthFt);
  }
  return sum;
}

/** Sum length (ft) for array of items. */
export function sumFt(items){
  if(!Array.isArray(items)) return 0;
  return items.reduce((a,c)=> a + (Number(c.lengthFt)||0), 0);
}

/**
 * Optionally normalize/merge segments; for now we keep simple passthrough so
 * downstream UI shows each authored segment. Shape: [{size, lengthFt}, ...]
 */
export function splitIntoSections(items){
  if(!Array.isArray(items)) return [];
  // Could merge adjacent same-size segments here if you want:
  // For now, return a shallow copy.
  return items.map(s => ({ size: String(s.size), lengthFt: Number(s.lengthFt)||0 }));
}

/* =========================
 * Line defaults & helpers
 * ========================= */

/**
 * Ensure state.lines[key] exists with your preferred defaults:
 *   L1: 200′ of 1¾″, 185 GPM @ 50 psi
 *   L2: 200′ of 1¾″, 185 GPM @ 50 psi
 *   L3: 250′ of 2½″, 265 GPM @ 50 psi (initially hidden)
 */
export function seedDefaultsForKey(key){
  if(!state.lines){
    state.lines = {};
  }
  if(state.lines[key]) return state.lines[key];

  // defaults
  const L1N = NOZ.chief185_50;
  const L3N = NOZ.sb1_1_8; // ~265 gpm @ 50 psi

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
    // generic placeholder for any other keys if used
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
 * Determine if a “single branch via wye” scenario is active.
 * This is true when L.hasWye is true and exactly ONE branch has any hose/nozzle.
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
  // If both present, pick right as default controlling side in single-branch calc; true wye should not call this.
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

/* =========================
 * Convenience: compute Wye/appliance loss using the rule above
 *   - When used, pass the TOTAL line flow feeding the appliance.
 * ========================= */
export function computeApplianceLoss(totalGpm){
  return applianceLoss(totalGpm);
}

/* =========================
 * (Optional) small util: clamp, round to 1 decimal, etc., if you need them later
 * ========================= */
export function round1(n){ return Math.round((Number(n)||0)*10)/10; }
