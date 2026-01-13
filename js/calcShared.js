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

export function markDirty(){}

export function startAutoSave(getPackFn){
  stopAutoSave();
  __saveInterval = setInterval(()=>{
    try{
      const p = getPackFn?.();
      if (p) saveNow(p);
    }catch{}
  }, 1000);
}

export function stopAutoSave(){
  if (__saveInterval) clearInterval(__saveInterval);
  __saveInterval = null;
}

export function buildSnapshot(waterSnapshot){
  return safeClone({ state, water: waterSnapshot || null });
}

/* ============================= Restore / startup rules ============================= */

export function restoreState(savedState){
  if (!savedState) return;

  if (savedState.supply) state.supply = savedState.supply;

  if (savedState.lines && state.lines) {
    for (const k of Object.keys(state.lines)) {
      if (!savedState.lines[k]) continue;
      if (k === 'left' || k === 'back' || k === 'right') continue;
      Object.assign(state.lines[k], savedState.lines[k]);
    }
  }

  try {
    seedDefaultsForKey('left');
    seedDefaultsForKey('back');
    seedDefaultsForKey('right');
  } catch {}

  try {
    ['left','back','right'].forEach(k=>{
      if (state.lines?.[k]) state.lines[k].visible = false;
    });
  } catch {}
}

/* =============================== Active side helper =============================== */

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

/* =============================== Layout helper =============================== */
/**
 * ✅ computeNeededHeightPx (legacy import)
 * Computes SVG height needed for a hose layout.
 *
 * Accepts:
 *  - line object with itemsMain / itemsLeft
 *  - or array of sections
 */
export function computeNeededHeightPx(input){
  try{
    const sections = Array.isArray(input)
      ? input
      : (input?.itemsLeft?.length ? input.itemsLeft : input?.itemsMain) || [];

    let totalFt = 0;
    for (const s of sections) {
      totalFt += Number(s?.lengthFt || 0);
    }

    // Convert hose length to vertical pixels
    const hosePx = (totalFt / 50) * PX_PER_50FT;

    // Add spacing for nozzle, curves, labels
    return Math.max(120, Math.round(hosePx + 80));
  }catch{
    return 200;
  }
}

/* =============================== DOM / SVG helpers =============================== */

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
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

/* =============================== CSS class helper =============================== */

export function clsFor(input){
  if (!input) return '';
  if (typeof input === 'object') return clsFor(input.key || input.size || input.id || '');
  const s = String(input).toLowerCase();

  if (s.includes('left')) return 'line-left';
  if (s.includes('back')) return 'line-back';
  if (s.includes('right')) return 'line-right';

  return 'x-' + s.replace(/[^a-z0-9]+/g,'-');
}

/* =============================== SVG label helpers =============================== */

export function addLabel(parent,x,y,text,opts={}){
  if (!parent) return null;
  const el = document.createElementNS('http://www.w3.org/2000/svg','text');
  el.setAttribute('x',x);
  el.setAttribute('y',y);
  el.setAttribute('font-size',opts.fontSize||12);
  el.setAttribute('font-weight',opts.fontWeight||700);
  el.setAttribute('fill',opts.fill||'#111');
  el.textContent = text ?? '';
  parent.appendChild(el);
  return el;
}

export const addText = addLabel;
export const addSvgText = addLabel;

export function addTip(parent,x,y,text){
  return addLabel(parent,x+10,y-10,text,{fontSize:11});
}

/* =============================== Breakdown helper =============================== */

export function breakdownText(a,b){
  try{
    if (typeof a === 'number' && Array.isArray(b)) {
      const parts = b.map(s=>{
        const fl = FL(a,s.size,s.lengthFt,s.cValue);
        return `${s.size}" ${s.lengthFt}ft: ${Math.round(fl)}psi`;
      });
      return parts.join(' | ');
    }

    const line = a;
    const side = b === 'left' ? 'left' : 'right';
    const noz = side==='left'?line.nozLeft:line.nozRight;
    const gpm = noz?.gpm || 0;
    const sections = side==='left'?line.itemsLeft:line.itemsMain;
    return breakdownText(gpm,sections||[]);
  }catch{
    return '';
  }
}

export const breakdownLabel = breakdownText;
export const breakdownString = breakdownText;

/* =============================== Nozzle helpers =============================== */

export function findNozzleId({ gpm, NP }){
  return NOZ_LIST.find(n=>n.gpm===gpm && n.NP===NP)?.id || null;
}

export function defaultNozzleIdForSize(size){
  if (size==='2.5') return 'chiefXD265';
  if (size==='5') return 'fog1000_100';
  return 'chief185_50';
}

export function ensureDefaultNozzleFor(L,where){
  if (!L) return;
  const id = defaultNozzleIdForSize(L.itemsMain?.[0]?.size);
  if (where==='left') L.nozLeft ??= NOZ[id];
  else L.nozRight ??= NOZ[id];
}

/* =============================== Compat re-exports =============================== */

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
