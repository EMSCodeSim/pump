// /js/store.js
// Shared data + helpers for pump calc + view.calc.js

/* ========================================================================== */
/*                              NOZZLE CATALOG                                */
/* ========================================================================== */

// Simple nozzle definitions.
// IDs can be anything, but should be stable for saved states.
export const NOZ = {
  chief185_50: {
    id: 'chief185_50',
    name: 'Fog 185 @ 50',
    gpm: 185,
    NP: 50
  },
  chiefXD265_50: {
    id: 'chiefXD265_50',
    name: 'Chief XD 265 @ 50',
    gpm: 265,
    NP: 50
  },
  smoothbore_1_1_8_50: {
    id: 'smoothbore_1_1_8_50',
    name: 'Smoothbore 1 1/8" @ 50',
    gpm: 325,
    NP: 50
  }
};

// Flat list for some lookup helpers
export const NOZ_LIST = Object.values(NOZ);

/* ========================================================================== */
/*                         HOSE COLORS (for CSS tags)                         */
/* ========================================================================== */

export const COLORS = {
  '1.75': '#ff5555', // red
  '2.5':  '#3366ff', // blue
  '5':    '#999999'  // gray
};

/* ========================================================================== */
/*                        FRICTION LOSS CALCULATION                           */
/* ========================================================================== */

// Reasonable defaults for FL coefficient C by size (C * (Q/100)^2 * (L/100))
const FL_COEFF = {
  '1.75': 15,   // 1¾"
  '1.5':  24,
  '2':    8,
  '2.5':  2,
  '3':    0.8,
  '5':    0.08
};

function normalizeSize(size) {
  if (size == null) return '2.5';
  const s = size.toString().trim();
  if (s === '1.75' || /1\s*3\/4/.test(s)) return '1.75';
  if (s === '1.5'  || /1\s*1\/2/.test(s)) return '1.5';
  if (s === '2.5'  || /2\s*1\/2/.test(s)) return '2.5';
  if (s === '3') return '3';
  if (s === '5') return '5';
  return s || '2.5';
}

// FL for a single segment: gpm, size (in), lengthFt
export function FL(gpm, size, lengthFt) {
  const Q = Number(gpm) || 0;
  const L = Number(lengthFt) || 0;
  if (!Q || !L) return 0;
  const nSize = normalizeSize(size);
  const C = FL_COEFF[nSize] != null ? FL_COEFF[nSize] : 2;
  const base = (Q / 100) * (Q / 100) * (L / 100) * C;
  return base;
}

// Total FL across a list of segments (used in a few older places)
export function FL_total(gpm, segments) {
  if (!gpm || !Array.isArray(segments)) return 0;
  return segments.reduce((acc, seg) => {
    return acc + FL(gpm, seg.size, seg.lengthFt);
  }, 0);
}

/* ========================================================================== */
/*                          SEGMENT / LENGTH HELPERS                          */
/* ========================================================================== */

// sumFt over a hose items array
export function sumFt(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((t, seg) => t + (Number(seg.lengthFt) || 0), 0);
}

// Split an array of items into 50' / 100' segments.
// view.calc.js has its own segmenter, but other code may call this.
export function splitIntoSections(items) {
  const raw = Array.isArray(items) ? items : [];
  const out = [];
  for (const seg of raw) {
    const size = normalizeSize(seg.size);
    let len = Number(seg.lengthFt) || 0;
    if (!size || !len) continue;
    while (len >= 100) {
      out.push({ size, lengthFt: 100 });
      len -= 100;
    }
    if (len > 0) {
      const rounded = len <= 50 ? 50 : 100;
      out.push({ size, lengthFt: rounded });
      len = 0;
    }
  }
  return out;
}

/* ========================================================================== */
/*                           WYE / NOZZLE HELPERS                             */
/* ========================================================================== */

// Returns true if the line is a wye and only one branch is really flowing
export function isSingleWye(L) {
  if (!L || !L.hasWye) return false;
  const gL = L.nozLeft && Number(L.nozLeft.gpm);
  const gR = L.nozRight && Number(L.nozRight.gpm);
  const leftOn  = !!gL;
  const rightOn = !!gR;
  return (leftOn && !rightOn) || (!leftOn && rightOn);
}

// Which side is active for single wye ('L' or 'R')
export function activeSide(L) {
  if (!L || !L.hasWye) return null;
  const gL = L.nozLeft && Number(L.nozLeft.gpm);
  const gR = L.nozRight && Number(L.nozRight.gpm);
  const leftOn  = !!gL;
  const rightOn = !!gR;
  if (leftOn && !rightOn) return 'L';
  if (!leftOn && rightOn) return 'R';
  return null;
}

// Which nozzle is "active" for FL math
export function activeNozzle(L) {
  if (!L) return null;
  if (L.hasWye) {
    const side = activeSide(L);
    if (side === 'L') return L.nozLeft || null;
    if (side === 'R') return L.nozRight || null;
    // both or none -> highest NP, just pick right for consistency
    return L.nozRight || L.nozLeft || null;
  }
  return L.nozRight || null;
}

// Nicely formatted size label for UI tags
export function sizeLabel(size) {
  const s = normalizeSize(size);
  if (s === '1.75') return '1¾″';
  if (s === '1.5')  return '1½″';
  if (s === '2.5')  return '2½″';
  if (s === '5')    return '5″';
  return s + '″';
}

/* ========================================================================== */
/*                            STATE INITIALIZATION                            */
/* ========================================================================== */

// Default hose segment builders
function makeSection(size, lengthFt) {
  return { size: normalizeSize(size), lengthFt: Number(lengthFt) || 0 };
}

// Line 1: 1.75", 200', Fog 185 @ 50
function makeLine1() {
  return {
    key: 'left',
    label: 'Line 1',
    visible: true,
    mainSize: '1.75',
    // 200' total: 100 + 100
    itemsMain: [
      makeSection('1.75', 100),
      makeSection('1.75', 100)
    ],
    // Wye / branches
    hasWye: false,
    branchSize: '1.75',
    // Branch A defaults (Option A: 185 @ 50, 50')
    itemsLeft:  [ makeSection('1.75', 50) ],
    // Branch B defaults (Option A: 185 @ 50, 50')
    itemsRight: [ makeSection('1.75', 50) ],
    // Nozzles: for non-wye, we use nozRight as main tip.
    nozLeft:  NOZ.chief185_50,      // Branch A (when wye used)
    nozRight: NOZ.chief185_50,      // Main / Branch B default
    elevFt: 0,
    wyeLoss: 10
  };
}

// Line 2: 1.75", 200', Fog 185 @ 50
function makeLine2() {
  return {
    key: 'right',
    label: 'Line 2',
    visible: true,
    mainSize: '1.75',
    itemsMain: [
      makeSection('1.75', 100),
      makeSection('1.75', 100)
    ],
    hasWye: false,
    branchSize: '1.75',
    itemsLeft:  [ makeSection('1.75', 50) ],
    itemsRight: [ makeSection('1.75', 50) ],
    nozLeft:  NOZ.chief185_50,
    nozRight: NOZ.chief185_50,
    elevFt: 0,
    wyeLoss: 10
  };
}

// Line 3: 2.5", 250', ChiefXD 265 @ 50 (always starts like this)
function makeLine3() {
  return {
    key: 'back',
    label: 'Line 3 (2½″)',
    visible: true,
    mainSize: '2.5',
    // 250': 100 + 100 + 50
    itemsMain: [
      makeSection('2.5', 100),
      makeSection('2.5', 100),
      makeSection('2.5', 50)
    ],
    hasWye: false,
    branchSize: '1.75', // if user ever Wyes off a 2½", branches are 1¾"
    itemsLeft:  [ makeSection('1.75', 50) ],
    itemsRight: [ makeSection('1.75', 50) ],
    nozLeft:  NOZ.chief185_50,         // Branch A default nozzle (Option A)
    nozRight: NOZ.chiefXD265_50,       // Main tip / Branch B default when wye is used
    elevFt: 0,
    wyeLoss: 10
  };
}

// Hydrant / tender defaults (simple placeholders, your waterSupply.js expands on this)
const defaultHydrant = {
  availableGPM: 1000,
  residual: 50,
  static: 70
};

const defaultTender = {
  // high-level summary object; individual tenders are inside WaterSupplyUI
  active: false
};

/* ========================================================================== */
/*                                    STATE                                   */
/* ========================================================================== */

export const state = {
  // Pressurized (hydrant) vs static (tender shuttle)
  supply: 'pressurized',       // 'pressurized' | 'static'
  hydrant: { ...defaultHydrant },
  tender:  { ...defaultTender },

  // Pump lines
  lines: {
    left:  makeLine1(),
    back:  makeLine3(),
    right: makeLine2()
  },

  showMath: true,
  lastMaxKey: null
};

/* ========================================================================== */
/*                             MISC SMALL HELPERS                             */
/* ========================================================================== */

export function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}
