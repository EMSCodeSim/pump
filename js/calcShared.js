// calcShared.js - shared math, geometry, persistence helpers for pump calc view
import {
  state,
  NOZ,
  COLORS,
  FL,
  FL_total,
  sumFt,
  splitIntoSections,
  PSI_PER_FT,
  seedDefaultsForKey,
  isSingleWye,
  activeNozzle,
  activeSide,
  sizeLabel,
  NOZ_LIST
} from './store.js';

// --- SEGMENTED FL HELPERS: force math to 50′/100′ problems ---

function sectionsFor(items){
  const raw = Array.isArray(items) ? items : [];
  const out = [];
  for (const seg of raw){
    const size = seg.size;
    let len = Number(seg.lengthFt) || 0;
    if (!size || !len) continue;
    while (len > 0){
      let chunk;
      if (len >= 100){
        chunk = 100;
      } else if (len > 50){
        chunk = 50;
      } else {
        chunk = len;
      }
      out.push({
        size,
        lengthFt: chunk,
        cValue: seg.cValue
      });
      len -= chunk;
    }
  }
  return out;
}

function FL_total_sections(flow, items){
  const secs = sectionsFor(items||[]);
  let total = 0;
  for(const s of secs){
    total += FL(flow, s.size, s.lengthFt, s.cValue);
  }
  return total;
}

function breakdownText(items){
  const secs = sectionsFor(items||[]);
  if(!secs.length) return '';
  return secs.map(s => `${sizeLabel(s.size)} ${s.lengthFt}′`).join(' + ');
}

// --- PRACTICE snapshot persistence

const PRACTICE_SAVE_KEY = 'pump.practice.v3';

function safeClone(obj){
  try { return JSON.parse(JSON.stringify(obj)); } catch(e){ return null; }
}

function loadSaved(){
  try{
    const raw = sessionStorage.getItem(PRACTICE_SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    return null;
  }
}

function saveNow(pack){
  try{
    sessionStorage.setItem(PRACTICE_SAVE_KEY, JSON.stringify(pack));
  }catch(e){}
}

let __saveInterval = null;

function markDirty(){}

function startAutoSave(getPackFn){
  stopAutoSave();
  __saveInterval = setInterval(()=>{
    try{
      const p = getPackFn?.();
      if (p) saveNow(p);
    }catch(e){}
  }, 1000);
}

function stopAutoSave(){
  if (__saveInterval) clearInterval(__saveInterval);
  __saveInterval = null;
}

function buildSnapshot(waterSnapshot){
  return safeClone({
    state,
    water: waterSnapshot || null
  });
}

/**
 * ✅ PATCHED restoreState:
 * - do NOT restore left/back/right from practice snapshot
 * - always start with preconnects stowed (visible=false)
 */
function restoreState(savedState){
  if (!savedState) return;

  if (savedState.supply) state.supply = savedState.supply;

  // Apply saved line edits (practice mode), but DO NOT let them permanently override
  // department defaults for Line 1/2/3 (left/back/right). Those must always come from Dept Setup / Presets.
  if (savedState.lines && state.lines) {
    for (const k of Object.keys(state.lines)) {
      if (!savedState.lines[k]) continue;

      // never restore preconnects from the practice snapshot
      if (k === 'left' || k === 'back' || k === 'right') continue;

      Object.assign(state.lines[k], savedState.lines[k]);
    }
  }

  // Re-seed left/back/right from dept templates (source of truth)
  try {
    seedDefaultsForKey('left');
    seedDefaultsForKey('back');
    seedDefaultsForKey('right');
  } catch(e) {}

  // Final guarantee: app starts with NO preconnects deployed
  try {
    if (state && state.lines) {
      ['left','back','right'].forEach(k=>{
        if (state.lines[k]) state.lines[k].visible = false;
      });
    }
  } catch(e) {}
}

// --- SVG / geometry helpers

const TRUCK_W = 390;
const TRUCK_H = 260;
const PX_PER_50FT = 45;
const CURVE_PULL = 36;
const BRANCH_LIFT = 10;

function supplyHeight(mode){
  if(mode === 'pressurized') return 80;
  if(mode === 'draft') return 115;
  if(mode === 'relay') return 95;
  return 70;
}

function computeNeededHeightPx(mainItems, leftItems){
  const mainFt = sumFt(mainItems||[]);
  const leftFt = sumFt(leftItems||[]);
  const tallestFt = Math.max(mainFt, leftFt);
  return Math.max(260, 160 + (tallestFt/50)*PX_PER_50FT);
}

function truckTopY(h){
  return Math.max(10, (h - TRUCK_H)/2);
}

function pumpXY(h){
  const top = truckTopY(h);
  return { x: 200, y: top + 130 };
}

function mainCurve(x0,y0,x1,y1,pull=CURVE_PULL){
  const midx = (x0+x1)/2;
  return `M ${x0} ${y0} C ${midx} ${y0+pull}, ${midx} ${y1-pull}, ${x1} ${y1}`;
}

function straightBranch(x0,y0,x1,y1){
  return `M ${x0} ${y0} L ${x1} ${y1}`;
}

function injectStyle(root, cssText){
  const s = document.createElement('style');
  s.textContent = cssText;
  root.appendChild(s);
}

function clearGroup(g){
  while(g.firstChild) g.removeChild(g.firstChild);
}

function clsFor(key){
  if(key === 'left') return 'line-left';
  if(key === 'back') return 'line-back';
  if(key === 'right') return 'line-right';
  return '';
}

function fmt(n){
  return Math.round(Number(n)||0);
}

function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

function addLabel(parent, x, y, text, opts={}){
  const {
    fontSize=12,
    fontWeight=700,
    fill='#d9e2ef',
    anchor='middle',
    baseline='middle',
    className='',
    dx=0, dy=0
  } = opts;

  const el = document.createElementNS('http://www.w3.org/2000/svg','text');
  el.setAttribute('x', String(Number(x)+Number(dx)));
  el.setAttribute('y', String(Number(y)+Number(dy)));
  el.setAttribute('font-size', String(fontSize));
  el.setAttribute('font-weight', String(fontWeight));
  el.setAttribute('fill', String(fill));
  el.setAttribute('text-anchor', anchor);
  el.setAttribute('dominant-baseline', baseline);
  if(className) el.setAttribute('class', className);
  el.textContent = text ?? '';
  parent.appendChild(el);
  return el;
}

function addTip(parent, x, y, text, opts={}){
  return addLabel(parent, x, y, text, {
    dx: 10, dy: -10,
    fontSize: 11,
    fontWeight: 700,
    fill: '#9fe879',
    anchor: 'start',
    baseline: 'middle',
    className: 'tip',
    ...opts
  });
}

function drawSegmentedPath(svg, d, cls, strokeWidth=5){
  const p = document.createElementNS('http://www.w3.org/2000/svg','path');
  p.setAttribute('d', d);
  p.setAttribute('class', cls);
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke-width', String(strokeWidth));
  p.setAttribute('stroke-linecap', 'round');
  p.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(p);
  return p;
}

function findNozzleId({ gpm, NP, preferFog=true }){
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
  return any ? any.id : null;
}

function defaultNozzleIdForSize(size){
  const s = String(size||'');
  if (s === '2.5') return 'chiefXD265';
  if (s === '5') return 'fog1000_100';
  return 'chief185_50';
}

function ensureDefaultNozzleFor(L, where){
  if(!L) return;
  const id = defaultNozzleIdForSize(L.itemsMain?.[0]?.size || '1.75');
  if(where === 'L'){
    if(!L.nozLeft) L.nozLeft = NOZ[id] || null;
  }else{
    if(!L.nozRight) L.nozRight = NOZ[id] || null;
  }
}

function setBranchBDefaultIfEmpty(line){
  if(!line) return;
  if(!line.itemsLeft || !line.itemsLeft.length){
    line.itemsLeft = [{ size: '1.75', lengthFt: 100, cValue: 15.5 }];
  }
}

function drawHoseBar(svg, x, y, w, h, fill, stroke='rgba(255,255,255,.25)'){
  const r = document.createElementNS('http://www.w3.org/2000/svg','rect');
  r.setAttribute('x', String(x));
  r.setAttribute('y', String(y));
  r.setAttribute('width', String(w));
  r.setAttribute('height', String(h));
  r.setAttribute('rx', '8');
  r.setAttribute('ry', '8');
  r.setAttribute('fill', fill);
  r.setAttribute('stroke', stroke);
  r.setAttribute('stroke-width', '1');
  svg.appendChild(r);
  return r;
}

function ppExplainHTML({ lineKey, flow, noz, mainItems, leftItems, elevFt, useWye }){
  const mainFL = FL_total_sections(flow, mainItems||[]);
  const leftFL = useWye ? FL_total_sections(flow, leftItems||[]) : 0;
  const elev = (Number(elevFt)||0) * PSI_PER_FT;

  const nozStr = noz ? `${noz.label} (${noz.gpm} gpm @ ${noz.NP} psi)` : '—';
  const mainStr = breakdownText(mainItems||[]);
  const leftStr = breakdownText(leftItems||[]);
  const elevStr = `${fmt(elevFt||0)}′ × ${PSI_PER_FT} = ${fmt(elev)} psi`;

  const totalA = (noz?.NP||0) + mainFL + elev;
  const totalB = useWye ? (noz?.NP||0) + leftFL + elev : 0;
  const total = useWye ? Math.max(totalA, totalB) : totalA;

  const wyeLine = useWye
    ? `<li><b>Branch (B)</b> FL = ${fmt(leftFL)} psi <span style="opacity:.7">(${escapeHTML(leftStr)})</span></li>`
    : '';

  return `
    <div class="ppExplain">
      <div style="margin-bottom:6px"><b>${escapeHTML(lineKey.toUpperCase())}</b> — ${escapeHTML(nozStr)}</div>
      <ul style="margin:0;padding-left:18px">
        <li><b>Main</b> FL = ${fmt(mainFL)} psi <span style="opacity:.7">(${escapeHTML(mainStr)})</span></li>
        ${wyeLine}
        <li><b>Elevation</b> = ${escapeHTML(elevStr)}</li>
      </ul>
      <div style="margin-top:6px"><b>PP = ${useWye ? 'max(A,B)' : ''} + Main FL + Elevation = <span style="color:#9fe879">${fmt(total)} psi</span></b></div>
    </div>
  `;
}

export {
  state,
  NOZ, COLORS, FL, FL_total, sumFt, splitIntoSections, PSI_PER_FT, seedDefaultsForKey,
  isSingleWye, activeNozzle, activeSide, sizeLabel, NOZ_LIST,
  sectionsFor, FL_total_sections, breakdownText,
  PRACTICE_SAVE_KEY, safeClone, loadSaved, saveNow, markDirty, startAutoSave, stopAutoSave,
  buildSnapshot, restoreState,
  TRUCK_W, TRUCK_H, PX_PER_50FT, CURVE_PULL, BRANCH_LIFT,
  supplyHeight, computeNeededHeightPx, truckTopY, pumpXY, mainCurve, straightBranch,
  injectStyle, clearGroup, clsFor, fmt, escapeHTML, addLabel, addTip, drawSegmentedPath,
  findNozzleId, defaultNozzleIdForSize, ensureDefaultNozzleFor, setBranchBDefaultIfEmpty,
  drawHoseBar, ppExplainHTML
};
