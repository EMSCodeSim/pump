// store.js
// Central app state, nozzle catalog, and hydraulic helpers.
// Updates:
// - Lines start hidden (user must deploy).
// - Supply starts 'off' (no helper drawn until user taps Supply).
// - NFPA elevation loss: PSI_PER_FT = 0.05
// - Appliance loss: 10 psi only when total GPM > 350
// - Adds loadPresets() export for Practice/Other pages.

export const state = {
  supply: 'off',        // 'off' | 'pressurized' | 'static' | 'relay' (draw nothing until user taps)
  showMath: false,
  lastMaxKey: null,
  lines: null,          // seeded below
};

export const COLORS = {
  '1.75': '#ff4545',    // red
  '2.5' : '#2e6cff',    // blue
  '5'   : '#ffd23a',    // yellow
};

export const NOZ = {
  fog95_50:      { id:'fog95_50',      name:'Fog 95 @ 50',   gpm:95,  NP:50 },
  fog150_75:     { id:'fog150_75',     name:'Fog 150 @ 75',  gpm:150, NP:75 },

  chief185_50:   { id:'chief185_50',   name:'Fog 185 @ 50',  gpm:185, NP:50 },
  chiefXD:       { id:'chiefXD',       name:'Fog 185 @ 50',  gpm:185, NP:50 },   // alias used in older views
  chiefXD265:    { id:'chiefXD265',    name:'Fog 265 @ 50',  gpm:265, NP:50 },

  sb7_8:         { id:'sb7_8',         name:'SB 7/8″ @ 50',  gpm:160, NP:50 },
  sb1_1_8:       { id:'sb1_1_8',       name:'SB 1 1/8″ @ 50',gpm:265, NP:50 },
};
export const NOZ_LIST = Object.values(NOZ);

export function sizeLabel(v){
  return v === '1.75' ? '1¾″' : v === '2.5' ? '2½″' : v === '5' ? '5″' : (v || '');
}

/* ---------- Hydraulics ---------- */

export const PSI_PER_FT = 0.05; // NFPA: 0.5 psi / 10 ft

export function applianceLoss(totalGpm){
  return totalGpm > 350 ? 10 : 0;
}

function flPer100(size, gpm){
  const q = Math.max(0, gpm) / 100;
  const C =
    size === '1.75' ? 15 :
    size === '2.5'  ? 2  :
    size === '5'    ? 0.08 :
    10;
  return C * q * q;
}

export function FL(gpm, size, lengthFt){
  if(!size || !lengthFt || !gpm) return 0;
  return flPer100(size, gpm) * (lengthFt/100);
}

export function FL_total(gpm, items){
  if(!Array.isArray(items) || !items.length || !gpm) return 0;
  let sum = 0;
  for(const seg of items) sum += FL(gpm, seg.size, seg.lengthFt);
  return sum;
}

export function sumFt(items){
  if(!Array.isArray(items)) return 0;
  return items.reduce((a,c)=> a + (Number(c.lengthFt)||0), 0);
}

export function splitIntoSections(items){
  if(!Array.isArray(items)) return [];
  return items.map(s => ({ size: String(s.size), lengthFt: Number(s.lengthFt)||0 }));
}

/* ---------- Defaults (start hidden) ---------- */
/*
  L1: 200′ of 1¾″, 185 @ 50 (hidden)
  L2: 200′ of 1¾″, 185 @ 50 (hidden)
  L3: 250′ of 2½″, 265 @ 50 (hidden)
*/
function seedInitialDefaults(){
  if (state.lines) return;
  const L1N = NOZ.chief185_50;
  const L3N = NOZ.sb1_1_8;

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
  if(!state.lines) seedInitialDefaults();
  if(state.lines[key]) return state.lines[key];

  const L1N = NOZ.chief185_50;
  const L3N = NOZ.sb1_1_8;

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
      nozRight: NOZ_LIST[0] || null,
    };
  }
  return state.lines[key];
}

/* ---------- Wye helpers ---------- */

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

/* Convenience */
export function computeApplianceLoss(totalGpm){
  return applianceLoss(totalGpm);
}

/* ---------- Presets (restore missing export) ---------- */
export function loadPresets() {
  // Keep in sync with views that reference these keys
  return {
    standpipe: {
      name: 'Standpipe',
      main: [{ size:'2.5', lengthFt:0 }],
      elevFt: 60,
      hasWye: false,
      nozzle: NOZ.fog150_75,
      supply: 'pressurized',
    },
    sprinkler: {
      name: 'Sprinkler',
      main: [{ size:'2.5', lengthFt:50 }],
      elevFt: 0,
      hasWye: false,
      nozzle: NOZ.fog150_75,
      supply: 'pressurized',
    },
    foam: {
      name: 'Foam',
      main: [{ size:'1.75', lengthFt:200 }],
      elevFt: 0,
      hasWye: false,
      nozzle: NOZ.chief185_50,
      supply: 'off', // don’t force supply visible
    },
    monitor: {
      name: 'Monitor',
      main: [{ size:'2.5', lengthFt:200 }],
      elevFt: 0,
      hasWye: false,
      nozzle: NOZ.sb1_1_8,
      supply: 'off',
    },
    aerial: {
      name: 'Aerial',
      main: [{ size:'2.5', lengthFt:150 }],
      elevFt: 80,
      hasWye: false,
      nozzle: NOZ.sb1_1_8,
      supply: 'pressurized',
    },
  };
}
