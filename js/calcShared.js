// js/calcShared.js
// Shared helpers for Calc view (state persistence, SVG helpers, nozzle helpers, etc.)

import {
  state,

  // compat exports expected by older files importing from calcShared.js
  PSI_PER_FT,
  NOZ,
  NOZ_LIST,
  seedDefaultsForKey,

  COLORS,
  FL,
  FL_total,
  FL_total_sections,

  activeNozzle,
} from './store.js';

/* ========================== Practice-state persistence ========================== */

export const PRACTICE_SAVE_KEY = 'pump.practice.v3';

export function safeClone(obj){
  try { return JSON.parse(JSON.stringify(obj)); } catch { return null; }
}

export function loadSaved(){
  try {
    const raw = sessionStorage.getItem(PRACTICE_SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveNow(pack){
  try { sessionStorage.setItem(PRACTICE_SAVE_KEY, JSON.stringify(pack)); } catch {}
}

let __saveInterval = null;

// No-op is safe; callers just signal intent
export function markDirty(){}

export function startAutoSave(getPackFn){
  stopAutoSave();
  __saveInterval = setInterval(()=>{
    try{
      const p = getPackFn?.();
      if (p) saveNow(p);
    }catch(_e){}
  }, 1000);
}

export function stopAutoSave(){
  if (__saveInterval) clearInterval(__saveInterval);
  __saveInterval = null;
}

// Build a combined snapshot: full sim state + optional water supply snapshot
export function buildSnapshot(waterSnapshot){
  return safeClone({
    state,
    water: waterSnapshot || null
  });
}

/* ============================= Restore / startup rules ============================= */
// Applies saved.state into live state (preserving object identities)
export function restoreState(savedState){
  if (!savedState) return;

  // Restore supply mode if present (non-critical)
  if (savedState.supply) state.supply = savedState.supply;

  // IMPORTANT:
  // Do NOT restore Line 1/2/3 (left/back/right) from practice snapshot.
  // These must always come from Department Defaults / Presets.
  if (savedState.lines && state.lines) {
    for (const k of Object.keys(state.lines)) {
      if (!savedState.lines[k]) continue;

      // Skip preconnects
      if (k === 'left' || k === 'back' || k === 'right') continue;

      Object.assign(state.lines[k], savedState.lines[k]);
    }
  }

  // Re-seed preconnects from department templates (source of truth)
  try {
    seedDefaultsForKey('left');
    seedDefaultsForKey('back');
    seedDefaultsForKey('right');
  } catch {}

  // FINAL GUARANTEE: app always starts with NO lines deployed
  try {
    if (state && state.lines) {
      ['left','back','right'].forEach(k => {
        if (state.lines[k]) state.lines[k].visible = false;
      });
    }
  } catch {}
}

/* =============================== Active side helper =============================== */
/**
 * Older calc code expects `activeSide` from calcShared.js
 * Return: 'right' | 'left'
 */
export function activeSide(line){
  if (!line) return 'right';
  if (line.nozLeft && !line.nozRight) return 'left';
  return 'right';
}

/* =============================== Constants / Geometry =============================== */

export const TRUCK_W = 390;
export const TRUCK_H = 260;
export const PX_PER_50FT = 45;
export const CURVE_PULL = 36;
export const BRANCH_LIFT = 10;

export function injectStyle(root, cssText){
  const s = document.createElement('style');
  s.textContent = cssText;
  root.appendChild(s);
}

export function clearGroup(g){
  while (g.firstChild) g.removeChild(g.firstChild);
}

export function fmt(n){ return Math.round(n); }

export function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]));
}

/* =============================== Nozzle helpers =============================== */

export function findNozzleId({ gpm, NP, preferFog=true }){
  const exact = NOZ_LIST.find(n =>
    Number(n.gpm) === Number(gpm) &&
    Number(n.NP)  === Number(NP) &&
    (!preferFog || /fog/i.test(n.name || n.label || ''))
  );
  if (exact) return exact.id;

  const any = NOZ_LIST.find(n =>
    Number(n.gpm) === Number(gpm) &&
    Number(n.NP)  === Number(NP)
  );
  if (any) return any.id;

  return null;
}

export function defaultNozzleIdForSize(size){
  const s = String(size || '');
  if (s === '1.75') return 'chief185_50';
  if (s === '2.5')  return 'chiefXD265';
  if (s === '5')    return 'fog1000_100';
  return 'chief185_50';
}

export function ensureDefaultNozzleFor(L, where){
  if (!L) return;

  const nozId = defaultNozzleIdForSize(
    (L.itemsMain && L.itemsMain[0] && L.itemsMain[0].size) || '1.75'
  );

  if (where === 'main'){
    if (L.nozRight) return;
    L.nozRight = NOZ?.[nozId] || NOZ_LIST.find(n => n.id === nozId) || null;
    return;
  }

  if (where === 'L'){
    if (L.nozLeft) return;
    L.nozLeft = NOZ?.[nozId] || NOZ_LIST.find(n => n.id === nozId) || null;
    return;
  }

  if (L.nozRight) return;
  L.nozRight = NOZ?.[nozId] || NOZ_LIST.find(n => n.id === nozId) || null;
}

/* =============================== Compat re-exports =============================== */
// Older modules sometimes import these from calcShared.js instead of store.js
export {
  PSI_PER_FT,
  COLORS,
  FL,
  FL_total,
  FL_total_sections,
  NOZ,
  NOZ_LIST,
  activeNozzle,
};
