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

/* =============================== CSS class helper =============================== */
/**
 * ✅ clsFor (legacy import)
 * Returns a CSS class string based on common inputs (line key, hose size, generic tokens).
 * Works even if callers pass objects.
 */
export function clsFor(input){
  if (input == null) return '';

  // objects: try common fields
  if (typeof input === 'object') {
    if (input.key) return clsFor(input.key);
    if (input.size) return clsFor(input.size);
    if (input.id) return clsFor(input.id);
    if (input.label) return clsFor(input.label);
    return '';
  }

  const s = String(input).trim().toLowerCase();
  if (!s) return '';

  // Line keys
  if (s === 'left' || s === 'line1' || s === 'preconnect1') return 'line-left';
  if (s === 'back' || s === 'line2' || s === 'preconnect2') return 'line-back';
  if (s === 'right' || s === 'line3' || s === 'preconnect3') return 'line-right';

  // Hose sizes
  if (s === '1.75' || s.includes('1¾') || s.includes('1 3/4')) return 'hose-175';
  if (s === '2' || s.includes('2"')) return 'hose-2';
  if (s === '2.5' || s.includes('2½') || s.includes('2 1/2')) return 'hose-250';
  if (s === '3') return 'hose-3';
  if (s === '4') return 'hose-4';
  if (s === '5') return 'hose-5';

  // fallback tokenized
  return 'x-' + s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* =============================== SVG helpers =============================== */

export function addLabel(parent, x, y, text, opts = {}){
  if (!parent) return null;

  const {
    fontSize = 12,
    fontWeight = 700,
    fill = '#111',
    anchor = 'middle',
    baseline = 'middle',
    className = '',
    dx = 0,
    dy = 0,
    rotate = null,
    opacity = null,
    pointerEvents = 'none',
  } = opts || {};

  const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  el.setAttribute('x', String(Number(x) + Number(dx)));
  el.setAttribute('y', String(Number(y) + Number(dy)));
  el.setAttribute('text-anchor', anchor);
  el.setAttribute('dominant-baseline', baseline);
  el.setAttribute('font-size', String(fontSize));
  el.setAttribute('font-weight', String(fontWeight));
  el.setAttribute('fill', String(fill));
  el.setAttribute('pointer-events', String(pointerEvents));
  if (opacity != null) el.setAttribute('opacity', String(opacity));
  if (className) el.setAttribute('class', className);

  el.textContent = (text == null) ? '' : String(text);

  if (typeof rotate === 'number' && !Number.isNaN(rotate)) {
    el.setAttribute('transform', `rotate(${rotate} ${Number(x) + Number(dx)} ${Number(y) + Number(dy)})`);
  }

  parent.appendChild(el);
  return el;
}

// common aliases
export const addText = addLabel;
export const addSvgText = addLabel;

export function addTip(parent, x, y, text, opts = {}){
  const {
    dx = 10,
    dy = -10,
    fontSize = 11,
    fontWeight = 700,
    fill = '#111',
    anchor = 'start',
    baseline = 'middle',
    className = 'tip',
    opacity = 0.95,
    rotate = null,
  } = opts || {};

  return addLabel(parent, x, y, text, {
    dx, dy, fontSize, fontWeight, fill, anchor, baseline, className, opacity, rotate
  });
}

/* =============================== Breakdown helper =============================== */
/**
 * Named export guaranteed: breakdownText
 * Accepts:
 *  - (gpm:number, sections:Array<{size,lengthFt,cValue}>) OR
 *  - (lineObj:any, side?:'left'|'right')
 */
export function breakdownText(a, b){
  try {
    // (gpm, sections)
    if (typeof a === 'number' && Array.isArray(b)) {
      const gpm = a;
      const sections = b;
      if (!gpm || !sections.length) return '';

      const parts = [];
      for (const s of sections) {
        if (!s) continue;
        const size = String(s.size ?? '');
        const len  = Number(s.lengthFt ?? 0);
        const cVal = (s.cValue != null) ? Number(s.cValue) : undefined;
        if (!len) continue;
        const fl = FL(gpm, size, len, cVal);
        parts.push(`${size}" ${len}ft: ${Math.round(fl)}psi`);
      }
      const total = Math.round(FL_total(gpm, sections));
      return parts.length ? `${parts.join('  |  ')}  |  Total: ${total}psi` : '';
    }

    // (lineObj, side)
    const line = a;
    const side = (b === 'left') ? 'left' : 'right';
    if (!line) return '';

    let noz = null;
    if (side === 'left') noz = line.nozLeft || null;
    else noz = line.nozRight || null;

    const gpm = Number(noz?.gpm ?? noz?.GPM ?? 0);
    const sections = (side === 'left' ? line.itemsLeft : line.itemsMain) || [];
    return breakdownText(gpm, sections);
  } catch {
    return '';
  }
}

// aliases
export const breakdownLabel = breakdownText;
export const breakdownString = breakdownText;

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
