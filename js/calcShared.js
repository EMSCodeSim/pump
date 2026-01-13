// js/calcShared.js
// Shared helpers for Calc view (state persistence, SVG helpers, nozzle helpers, etc.)

import {
  state,
  NOZ, NOZ_LIST,
  seedDefaultsForKey,
  COLORS,              // ✅ IMPORT COLORS
} from './store.js';

/* ========================== Practice-state persistence ========================== */

const PRACTICE_SAVE_KEY = 'pump.practice.v3';

function safeClone(obj){
  try { return JSON.parse(JSON.stringify(obj)); } catch { return null; }
}

function loadSaved(){
  try {
    const raw = sessionStorage.getItem(PRACTICE_SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveNow(pack){
  try { sessionStorage.setItem(PRACTICE_SAVE_KEY, JSON.stringify(pack)); } catch {}
}

let __saveInterval = null;
function markDirty(){ /* left as-is in your file if you already implement */ }
function startAutoSave(getPackFn){
  stopAutoSave();
  __saveInterval = setInterval(()=>{
    try{
      const p = getPackFn?.();
      if (p) saveNow(p);
    }catch(_e){}
  }, 1000);
}
function stopAutoSave(){
  if (__saveInterval) clearInterval(__saveInterval);
  __saveInterval = null;
}

// Build a combined snapshot: full sim state + optional water supply snapshot
function buildSnapshot(waterSnapshot){
  return safeClone({
    state,                // entire sim state (lines, supply, etc.)
    water: waterSnapshot || null
  });
}

/* ============================= CRITICAL FIX HERE ============================= */
// Applies saved.state into live state (preserving object identities)
function restoreState(savedState){
  if (!savedState) return;

  // Restore supply mode if present (non-critical)
  if (savedState.supply) state.supply = savedState.supply;

  // IMPORTANT:
  // We do NOT restore full line objects for the preconnects (Line 1/2/3).
  if (savedState.lines && state.lines) {
    for (const k of Object.keys(state.lines)) {
      if (!savedState.lines[k]) continue;

      // Never restore preconnects from practice snapshot
      if (k === 'left' || k === 'back' || k === 'right') continue;

      Object.assign(state.lines[k], savedState.lines[k]);
    }
  }

  // Re-seed preconnects from department templates (source of truth)
  try {
    seedDefaultsForKey('left');
    seedDefaultsForKey('back');
    seedDefaultsForKey('right');
  } catch(e) {}

  // FINAL GUARANTEE: app always starts with NO lines deployed.
  try {
    if (state && state.lines) {
      ['left','back','right'].forEach(k => {
        if (state.lines[k]) state.lines[k].visible = false;
      });
    }
  } catch(_e) {}
}
/* ============================= END CRITICAL FIX ============================= */


/* =============================== Constants / Geometry =============================== */

const TRUCK_W = 390;
const TRUCK_H = 260;
const PX_PER_50FT = 45;
const CURVE_PULL = 36;
const BRANCH_LIFT = 10;

function injectStyle(root, cssText){
  const s=document.createElement('style');
  s.textContent=cssText;
  root.appendChild(s);
}
function clearGroup(g){ while(g.firstChild) g.removeChild(g.firstChild); }
function fmt(n){ return Math.round(n); }
function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

/* =============================== Nozzle helpers =============================== */

function findNozzleId({ gpm, NP, preferFog=true }){
  const exact = NOZ_LIST.find(n =>
    Number(n.gpm)===Number(gpm) &&
    Number(n.NP)===Number(NP) &&
    (!preferFog || /fog/i.test(n.name||n.label||'')));
  if (exact) return exact.id;

  const any = NOZ_LIST.find(n =>
    Number(n.gpm)===Number(gpm) &&
    Number(n.NP)===Number(NP));
  if (any) return any.id;

  return null;
}

function defaultNozzleIdForSize(size){
  const s = String(size||'');
  if (s === '1.75') return 'chief185_50';
  if (s === '2.5')  return 'chiefXD265';
  if (s === '5')    return 'fog1000_100';
  return 'chief185_50';
}

function ensureDefaultNozzleFor(L, where){
  if (!L) return;

  const nozId = defaultNozzleIdForSize(
    (L.itemsMain && L.itemsMain[0] && L.itemsMain[0].size) || '1.75'
  );

  if (where === 'main'){
    if (L.nozRight) return;
    L.nozRight = NOZ?.[nozId] || NOZ_LIST.find(n=>n.id===nozId) || null;
    return;
  }

  if (where === 'L'){
    if (L.nozLeft) return;
    L.nozLeft = NOZ?.[nozId] || NOZ_LIST.find(n=>n.id===nozId) || null;
    return;
  }

  if (L.nozRight) return;
  L.nozRight = NOZ?.[nozId] || NOZ_LIST.find(n=>n.id===nozId) || null;
}

/* =============================== Exports =============================== */

export {
  PRACTICE_SAVE_KEY,
  safeClone,
  loadSaved,
  saveNow,
  markDirty,
  startAutoSave,
  stopAutoSave,
  buildSnapshot,
  restoreState,

  COLORS,   // ✅ RE-EXPORT COLORS

  TRUCK_W, TRUCK_H, PX_PER_50FT, CURVE_PULL, BRANCH_LIFT,
  injectStyle, clearGroup, fmt, escapeHTML,

  findNozzleId,
  defaultNozzleIdForSize,
  ensureDefaultNozzleFor,
};
