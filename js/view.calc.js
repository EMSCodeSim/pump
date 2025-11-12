
// ===== Bootstrap Wye helpers (absolute earliest) =============================
(function(){
  try{
    if (typeof globalThis.updateWyeAndButtons !== 'function'){
      globalThis.updateWyeAndButtons = function(){ /* no-op until real fn loads */ };
    }
    if (typeof globalThis.gateWyeBySize !== 'function'){
      globalThis.gateWyeBySize = function(){ return false; };
    }
  }catch(_){}
})();
// ============================================================================


// === Wye helper stubs (guard against early calls) ============================
try{
  if (typeof updateWyeAndButtons !== 'function'){
    function updateWyeAndButtons(){ try{ return (globalThis && typeof globalThis.updateWyeAndButtons==='function') ? globalThis.updateWyeAndButtons() : undefined; }catch(_){} }
  }
  if (typeof gateWyeBySize !== 'function'){
    function gateWyeBySize(){
  try{ globalThis.gateWyeBySize = gateWyeBySize; }catch(_){}
 try{ return (globalThis && typeof globalThis.gateWyeBySize==='function') ? globalThis.gateWyeBySize() : false; }catch(_){ return false; } }
  }
}catch(_){}

// /js/view.calc.js
// Stage view with popup editor support, Wye-aware UI (no main nozzle when wye),
// Branch-B default nozzle = Fog 185 @ 50, diameter-based default nozzles,
// and practice-state persistence (including tender shuttle) across view switches.
//
// Requires: ./store.js, ./waterSupply.js, and bottom-sheet-editor.js (optional; this file works without it).
import { state, NOZ, COLORS, FL, FL_total, sumFt, splitIntoSections, PSI_PER_FT, seedDefaultsForKey, isSingleWye, activeNozzle, activeSide, sizeLabel, NOZ_LIST } from './store.js';
import { WaterSupplyUI } from './waterSupply.js';

/* ========================================================================== */
/*             Practice state persistence (incl. Tender Shuttle)              */
/* ========================================================================== */

const PRACTICE_SAVE_KEY = 'pump.practice.v3';

function safeClone(obj){
  try { return JSON.parse(JSON.stringify(obj)); } catch { return null; }
}
function loadSaved(){
  try { const raw = sessionStorage.getItem(PRACTICE_SAVE_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function saveNow(pack){
  try { sessionStorage.setItem(PRACTICE_SAVE_KEY, JSON.stringify(pack)); } catch {}
}

// mark edits “dirty” and flush every 1s
let __dirty = false;
function markDirty(){ __dirty = true; }
let __saveInterval = null;
function startAutoSave(getPack){
  if (__saveInterval) return;
  __saveInterval = setInterval(()=>{
    if (!__dirty) return;
    const pack = getPack();
    if (pack) saveNow(pack);
    __dirty = false;
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

// Applies saved.state into live state (preserving object identities)
function restoreState(savedState){
  if (!savedState) return;
  if (savedState.supply) state.supply = savedState.supply;
  if (savedState.lines) {
    for (const k of Object.keys(state.lines)){
      if (savedState.lines[k]) Object.assign(state.lines[k], savedState.lines[k]);
    }
  }
  // If water/tenders/shuttle live on state, they’ll be set during water restore (below)
}

/* ========================================================================== */
/*                           Geometry & draw constants                        */
/* ========================================================================== */

const TRUCK_W = 390;
const TRUCK_H = 260;
const PX_PER_50FT = 45;
const CURVE_PULL = 36;
const BRANCH_LIFT = 10;

/* ========================================================================== */

// --- Helper: find the 185 GPM @ 50 psi nozzle (fallback to first fog if not found) ---
function pickNozzle18550(){
  try{
    if (Array.isArray(NOZ_LIST)) {
      // note: spaced to avoid accidental token; will fix after insertion
    }
  }catch(_){}
  try{
    if (Array.isArray(NOZ_LIST)) {
      for (const n of NOZ_LIST){
        const nm = (n.name||n.label||'').toLowerCase();
        const id = (n.id||'').toLowerCase();
        if ((nm.includes('185') || id.includes('185')) && (nm.includes('50') || id.includes('50'))) return n;
      }
      for (const n of NOZ_LIST){
        const nm = (n.name||n.label||'').toLowerCase();
        if (nm.includes('fog')) return n;
      }
      return NOZ_LIST[0];
    }
  }catch(_){}
  try{
    const cand = Object.values(NOZ||{}).find(n=>{
      const nm=(n.name||n.label||'').toLowerCase();
      const id=(n.id||'').toLowerCase();
      return (nm.includes('185')||id.includes('185')) && (nm.includes('50')||id.includes('50'));
    });
    if (cand) return cand;
  }catch(_){}
  return null;
}
// --- Ensure branch defaults (50' of 1.75 with 185@50) when Wye is enabled ---
function ensureBranchDefaultsOnWye(lineKey){
  try{
    const L = state.lines[lineKey];
    if (!L) return;
    // Remove main nozzle when Wye is on
    if (L.nozMain) delete L.nozMain;
    if (L.nozRight) delete L.nozRight;
    if (L.noz) delete L.noz;
    if (!Array.isArray(L.itemsLeft))  L.itemsLeft  = [];
    if (!Array.isArray(L.itemsRight)) L.itemsRight = [];
    if (!L.itemsLeft[0])  L.itemsLeft[0]  = { size:'1.75', lengthFt:50 };
    if (!L.itemsRight[0]) L.itemsRight[0] = { size:'1.75', lengthFt:50 };
    const noz = pickNozzle18550();
    if (noz){
      L.nozLeft  = noz;
      L.nozRight = noz;
    }
  }catch(_){}
}

/*                               Small utilities                              */
/* ========================================================================== */

function injectStyle(root, cssText){ const s=document.createElement('style'); s.textContent=cssText; root.appendChild(s); }
function clearGroup(g){ while(g.firstChild) g.removeChild(g.firstChild); }
function clsFor(size){ return size==='5'?'hose5':(size==='2.5'?'hose25':'hose175'); }
function fmt(n){ return Math.round(n); }

function escapeHTML(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- Nozzle finders & defaults ---------- */

// Generic finder (Fog preferred when preferFog=true)
function findNozzleId({ gpm, NP, preferFog=true }){
  // exact match
  const exact = NOZ_LIST.find(n =>
    Number(n.gpm)===Number(gpm) &&
    Number(n.NP)===Number(NP) &&
    (!preferFog || /fog/i.test(n.name||n.label||'')));
  if (exact) return exact.id;

  // close match
  const near = NOZ_LIST
    .filter(n => Math.abs(Number(n.gpm)-Number(gpm))<=12 && Math.abs(Number(n.NP)-Number(NP))<=5)
    .sort((a,b)=>{
      const af = /fog/i.test(a.name||a.label||'') ? 0 : 1;
      const bf = /fog/i.test(b.name||b.label||'') ? 0 : 1;
      const ad = Math.abs(a.gpm-gpm)+Math.abs(a.NP-NP);
      const bd = Math.abs(b.gpm-gpm)+Math.abs(b.NP-NP);
      return af-bf || ad-bd;
    })[0];
  if (near) return near.id;

  // fallback: first fog, else first
  const anyFog = NOZ_LIST.find(n => /fog/i.test(n.name||n.label||''));
  return anyFog ? anyFog.id : (NOZ_LIST[0]?.id);
}

// Requested defaults by diameter:
//  - 1.75 → 185 @ 50 (Fog preferred)
//  - 2.5  → 265 @ 50 (Fog preferred)
function defaultNozzleIdForSize(size){
  if (size === '1.75') return findNozzleId({ gpm:185, NP:50, preferFog:true });
  if (size === '2.5')  return findNozzleId({ gpm:265, NP:50, preferFog:true });
  // For other sizes, keep “closest fog near 185 @ 50”
  return findNozzleId({ gpm:185, NP:50, preferFog:true });
}

// Ensure a nozzle exists for a target (main/left/right) based on size
function ensureDefaultNozzleFor(L, where, size){
  const nozId = defaultNozzleIdForSize(size);
  if (where==='main'){
    L.nozRight = NOZ[nozId] || L.nozRight || NOZ_LIST.find(n=>n.id===nozId);
  } else if (where==='L'){
    L.nozLeft  = NOZ[nozId] || L.nozLeft  || NOZ_LIST.find(n=>n.id===nozId);
  } else {
    
    // Wye branch override: when editing branches, prefer Fog 185 @ 50 regardless of size
    try{
      if (state?.lines && (where==='L' || where!=='main')){
        const id185 = findNozzleId({ gpm:185, NP:50, preferFog:true });
        if (where==='L'){ L.nozLeft = NOZ[id185] || L.nozLeft || NOZ_LIST.find(n=>n.id===id185); }
        else { L.nozRight = NOZ[id185] || L.nozRight || NOZ_LIST.find(n=>n.id===id185); }
        return;
      }
    }catch(_){}
L.nozRight = NOZ[nozId] || L.nozRight || NOZ_LIST.find(n=>n.id===nozId);
  }
}

// Special helper: Branch B defaults to Fog 185 @ 50 if empty
function setBranchBDefaultIfEmpty(L){
  if(!(L?.nozRight?.id)){
    const id = findNozzleId({gpm:185, NP:50, preferFog:true});
    L.nozRight = NOZ[id] || L.nozRight || NOZ_LIST.find(n=>n.id===id) || L.nozRight;
  }
}

/* ========================================================================== */
/*                         Vertical sizing & geometry                          */
/* ========================================================================== */

function supplyHeight(){
  return state.supply==='drafting'?150: state.supply==='pressurized'?150: state.supply==='relay'?170: state.supply==='static'?150: 0;
}
function computeNeededHeightPx(){
  const needs = Object.values(state.lines).filter(l=>l.visible);
  let maxUp = 0;
  needs.forEach(L=>{
    const mainPx = (sumFt(L.itemsMain)/50)*PX_PER_50FT;
    let branchPx = 0;
    if(L.hasWye){
      const lpx = (sumFt(L.itemsLeft)/50)*PX_PER_50FT;
      const rpx = (sumFt(L.itemsRight)/50)*PX_PER_50FT;
      branchPx = Math.max(lpx, rpx) + BRANCH_LIFT;
    }
    maxUp = Math.max(maxUp, mainPx + branchPx);
  });
  return Math.max(TRUCK_H + supplyHeight() + 10, TRUCK_H + maxUp + 40 + supplyHeight());
}
function truckTopY(viewH){ return viewH - TRUCK_H - supplyHeight(); }
function pumpXY(viewH){ const top = truckTopY(viewH); return { x: TRUCK_W*0.515, y: top + TRUCK_H*0.74 }; }

function mainCurve(dir, totalPx, viewH){
  const {x:sx,y:sy} = pumpXY(viewH);
  const ex = dir===-1 ? sx - 110 : dir===1 ? sx + 110 : sx;
  const ey = Math.max(10, sy - totalPx);
  const cx = (sx+ex)/2 + (dir===-1?-CURVE_PULL:dir===1?CURVE_PULL:0);
  const cy = sy - (sy-ey)*0.48;
  return { d:`M ${sx},${sy} Q ${cx},${cy} ${ex},${ey}`, endX:ex, endY:ey };
}
function straightBranch(side, startX, startY, totalPx){
  const dir = side==='L'?-1:1, x = startX + dir*20, y1 = startY - BRANCH_LIFT, y2 = Math.max(8, y1 - totalPx);
  return { d:`M ${startX},${startY} L ${startX},${y1} L ${x},${y1} L ${x},${y2}`, endX:x, endY:y2 };
}
function addLabel(G_labels, text, x, y, dy=0){
  const ns='http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns,'g');
  const pad = 4;
  const t = document.createElementNS(ns,'text');
  t.setAttribute('class','lbl'); t.setAttribute('x', x); t.setAttribute('y', y+dy); t.setAttribute('text-anchor','middle'); t.setAttribute('stroke','#000000'); t.setAttribute('stroke-width','2'); t.setAttribute('paint-order','stroke fill'); t.textContent = text;
  g.appendChild(t); G_labels.appendChild(g);
  const bb = t.getBBox();
  const bg = document.createElementNS(ns,'rect');
  bg.setAttribute('x', bb.x - pad); bg.setAttribute('y', bb.y - pad);
  bg.setAttribute('width', bb.width + pad*2); bg.setAttribute('height', bb.height + pad*2);
  bg.setAttribute('fill','rgba(0,0,0,0.9)'); bg.setAttribute('opacity', '0.92'); bg.setAttribute('stroke','rgba(255,255,255,0.35)'); bg.setAttribute('stroke-width', '.5'); bg.setAttribute('rx','4'); bg.setAttribute('ry','4');
  g.insertBefore(bg, t);
}
// Variant that returns the label group and tries to avoid overlap
function addLabel2(G_labels, text, x, y, dy=0){
  const ns='http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns,'g');
  const pad = 4;
  const t = document.createElementNS(ns,'text');
  t.setAttribute('class','lbl'); t.setAttribute('x', x); t.setAttribute('y', y+dy);
  t.setAttribute('fill','#ffffff'); t.setAttribute('font-size','12');
  t.setAttribute('dominant-baseline','hanging'); t.setAttribute('text-anchor','middle'); t.setAttribute('stroke','#000000'); t.setAttribute('stroke-width','2'); t.setAttribute('paint-order','stroke fill'); t.textContent = text;
  g.appendChild(t); G_labels.appendChild(g);
  const bb = t.getBBox();
  const bg = document.createElementNS(ns,'rect');
  bg.setAttribute('x', bb.x - pad); bg.setAttribute('y', bb.y - pad);
  bg.setAttribute('width', bb.width + pad*2); bg.setAttribute('height', bb.height + pad*2);
  bg.setAttribute('rx', 6); bg.setAttribute('ry', 6);
  bg.setAttribute('fill','rgba(0,0,0,0.9)'); bg.setAttribute('stroke','rgba(255,255,255,0.35)'); bg.setAttribute('stroke-width','1');
  g.insertBefore(bg, t);
  try{ placeLabelNoOverlap(G_labels, g); }catch(_){}
  return g;
}

// Try to nudge label upward in steps until it doesn't overlap existing label rects
function placeLabelNoOverlap(G_labels, g){
  try{
    const maxIter = 8, step = 14;
    const rect = g.querySelector('rect'), text = g.querySelector('text');
    if(!rect || !text) return;
    let moved = 0, iter = 0;

    function intersects(a, b){
      return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
    }

    while(iter < maxIter){
      const bb = rect.getBBox();
      let collides = false;
      G_labels.querySelectorAll('g').forEach(other=>{
        if (other === g) return;
        const r = other.querySelector('rect'); if (!r) return;
        const obb = r.getBBox();
        if (intersects(bb, obb)) collides = true;
      });
      if (!collides) break;
      moved += step;
      // move up by step pixels
      text.setAttribute('y', parseFloat(text.getAttribute('y')) - step);
      const tbb = text.getBBox();
      rect.setAttribute('x', tbb.x - 4);
      rect.setAttribute('y', tbb.y - 4);
      rect.setAttribute('width', tbb.width + 8);
      rect.setAttribute('height', tbb.height + 8);
      iter++;
    }
  }catch(_){}
}

function addTip(G_tips, key, where, x, y){
  const ns='http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns,'g');
  g.setAttribute('class','hose-end'); g.setAttribute('data-line',key); g.setAttribute('data-where',where);
  const hit = document.createElementNS(ns,'rect'); hit.setAttribute('class','plus-hit'); hit.setAttribute('x', x-28); hit.setAttribute('y', y-28); hit.setAttribute('width', 56); hit.setAttribute('height', 56); hit.setAttribute('rx', 16); hit.setAttribute('ry', 16);
  const c = document.createElementNS(ns,'circle'); c.setAttribute('class','plus-circle'); c.setAttribute('cx',x); c.setAttribute('cy',y); c.setAttribute('r',16);
  const v = document.createElementNS(ns,'line'); v.setAttribute('class','plus-sign'); v.setAttribute('x1',x); v.setAttribute('y1',y-7); v.setAttribute('x2',x); v.setAttribute('y2',y+7);
  const h = document.createElementNS(ns,'line'); h.setAttribute('class','plus-sign'); h.setAttribute('x1',x-7); h.setAttribute('y1',y); h.setAttribute('x2',x+7); h.setAttribute('y2',y);
  g.appendChild(hit); g.appendChild(c); g.appendChild(v); g.appendChild(h); G_tips.appendChild(g);
}
function drawSegmentedPath(group, basePath, segs){
  const ns = 'http://www.w3.org/2000/svg';
  const sh = document.createElementNS(ns,'path');
  sh.setAttribute('class','hoseBase shadow'); sh.setAttribute('d', basePath.getAttribute('d')); group.appendChild(sh);
  const total = basePath.getTotalLength(); let offset = 0;
  const totalPx = (sumFt(segs)/50)*PX_PER_50FT || 1;
  segs.forEach(seg=>{
    const px = (seg.lengthFt/50)*PX_PER_50FT;
    const portion = Math.min(total, (px/totalPx)*total);
    const p = document.createElementNS(ns,'path');
    p.setAttribute('class', 'hoseBase '+clsFor(seg.size));
    p.setAttribute('d', basePath.getAttribute('d'));
    p.setAttribute('stroke-dasharray', portion+' '+total);
    p.setAttribute('stroke-dashoffset', -offset);
    group.appendChild(p);
    offset += portion;
  });
}

/* ========================================================================== */
/*                         Hose bar visualization                             */
/* ========================================================================== */

function drawHoseBar(containerEl, sections, gpm, npPsi, nozzleText, pillOverride=null){
  const totalLen = sumFt(sections);
  containerEl.innerHTML='';
  if(!totalLen||!gpm){
    containerEl.textContent='No hose yet';
    containerEl.style.color='#9fb0c8';
    containerEl.style.fontSize='12px';
    return;
  }
  const W = Math.max(300, Math.min(containerEl.clientWidth||360, 720)), NP_W=64, H=54;
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('width','100%'); svg.setAttribute('height',H);
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);

  if(nozzleText){
    const t=document.createElementNS(svgNS,'text'); t.setAttribute('x',8); t.setAttribute('y',12);
    t.setAttribute('fill','#cfe4ff'); t.setAttribute('font-size','12'); t.textContent=nozzleText;
    svg.appendChild(t);
  }

  const innerW=W-16-NP_W;
  const track=document.createElementNS(svgNS,'rect');
  track.setAttribute('x',8); track.setAttribute('y',20);
  track.setAttribute('width',innerW); track.setAttribute('height',18);
  track.setAttribute('fill','#0c1726'); track.setAttribute('stroke','#20324f');
  track.setAttribute('rx',6); track.setAttribute('ry',6);
  svg.appendChild(track);

  let x=8;
  sections.forEach(seg=>{
    const totalFt = sections.reduce((a,c)=>a+c.lengthFt,0) || 1;
    const segW=(seg.lengthFt/totalFt)*innerW;
    const r=document.createElementNS(svgNS,'rect');
    r.setAttribute('x',x); r.setAttribute('y',20);
    r.setAttribute('width',Math.max(segW,1)); r.setAttribute('height',18);
    r.setAttribute('fill',COLORS[seg.size]||'#888');
    r.setAttribute('stroke','rgba(0,0,0,.35)');
    r.setAttribute('rx',5); r.setAttribute('ry',5);
    svg.appendChild(r);

    const fl=FL(gpm,seg.size,seg.lengthFt);
    const tx=document.createElementNS(svgNS,'text');
    tx.setAttribute('fill','#0b0f14'); tx.setAttribute('font-size','11');
    tx.setAttribute('font-family','ui-monospace,Menlo,Consolas,monospace');
    tx.setAttribute('text-anchor','middle'); tx.setAttribute('x',x+segW/2); tx.setAttribute('y',34);
    tx.textContent=''+seg.lengthFt+'′ • '+Math.round(fl)+' psi';
    svg.appendChild(tx);

    x+=segW;
  });

  const pill=document.createElementNS(svgNS,'rect');
  pill.setAttribute('x',innerW+8+6); pill.setAttribute('y',20);
  pill.setAttribute('width',64-12); pill.setAttribute('height',18);
  pill.setAttribute('fill','#eaf2ff'); pill.setAttribute('stroke','#20324f');
  pill.setAttribute('rx',6); pill.setAttribute('ry',6);
  svg.appendChild(pill);

  const npT=document.createElementNS(svgNS,'text');
  npT.setAttribute('x',innerW+8+(64-12)/2); npT.setAttribute('y',33);
  npT.setAttribute('text-anchor','middle'); npT.setAttribute('fill','#0b0f14'); npT.setAttribute('font-size','11');
  npT.textContent = pillOverride ? pillOverride : ('NP '+npPsi);
  svg.appendChild(npT);

  containerEl.appendChild(svg);
}

/* ========================================================================== */
/*                         “Why?” explanation HTML                             */
/* ========================================================================== */

function ppExplainHTML(L){
  const single = isSingleWye(L);
  const side = activeSide(L);
  const flow = single ? (activeNozzle(L)?.gpm||0)
             : L.hasWye ? (L.nozLeft?.gpm||0)+(L.nozRight?.gpm||0)
                        : (L.nozRight?.gpm||0);
  const mainSecs = splitIntoSections(L.itemsMain);
  const mainFLs = mainSecs.map(s => FL(flow, s.size, s.lengthFt));
  const mainParts = mainSecs.map((s,i)=>fmt(mainFLs[i])+' ('+s.lengthFt+'′ '+sizeLabel(s.size)+')');
  const mainSum = mainFLs.reduce((a,c)=>a+c,0);
  const elevPsi = (L.elevFt||0) * PSI_PER_FT;
  const elevStr = (elevPsi>=0? '+':'')+fmt(elevPsi)+' psi';

  if(!L.hasWye){
    return `
      <div><b>Simple PP:</b>
        <ul class="simpleList">
          <li><b>Nozzle Pressure</b> = ${fmt(L.nozRight?.NP||0)} psi</li>
          <li><b>Friction Loss (Main)</b> = ${mainSecs.length ? mainParts.join(' + ') : 0} = <b>${fmt(mainSum)} psi</b></li>
          <li><b>Elevation</b> = ${elevStr}</li>
        </ul>
        <div style="margin-top:6px"><b>PP = NP + Main FL ± Elev = ${fmt(L.nozRight?.NP||0)} + ${fmt(mainSum)} ${elevStr} = <span style="color:#9fe879">${fmt((L.nozRight?.NP||0)+mainSum+elevPsi)} psi</span></b></div>
      </div>
    `;
  } else if(single){
    // NOTE: For single-branch via wye we DO NOT list a main-line nozzle anymore.
    const noz = activeNozzle(L);
    const bnSegs = side==='L'? L.itemsLeft : L.itemsRight;
    const bnSecs = splitIntoSections(bnSegs);
    const brFLs  = bnSecs.map(s => FL(noz.gpm, s.size, s.lengthFt));
    const brParts= bnSecs.map((s,i)=>fmt(brFLs[i])+' ('+s.lengthFt+'′ '+sizeLabel(s.size)+')');
    const brSum  = brFLs.reduce((x,y)=>x+y,0);
    const total  = noz.NP + brSum + mainSum + elevPsi;
    return `
      <div><b>Simple PP (Single branch via wye):</b>
        <ul class="simpleList">
          <li><b>Nozzle Pressure (branch)</b> = ${fmt(noz.NP)} psi</li>
          <li><b>Branch FL</b> = ${bnSecs.length ? brParts.join(' + ') : 0} = <b>${fmt(brSum)} psi</b></li>
          <li><b>Main FL</b> = ${mainSecs.length ? mainParts.join(' + ') : 0} = <b>${fmt(mainSum)} psi</b></li>
          <li><b>Elevation</b> = ${elevStr}</li>
        </ul>
        <div style="margin-top:6px"><b>PP = NP (branch) + Branch FL + Main FL ± Elev = ${fmt(noz.NP)} + ${fmt(brSum)} + ${fmt(mainSum)} ${elevStr} = <span style="color:#9fe879">${fmt(total)} psi</span></b></div>
      </div>
    `;
  } else {
    const aSecs = splitIntoSections(L.itemsLeft);
    const bSecs = splitIntoSections(L.itemsRight);
    const aFLs = aSecs.map(s => FL(L.nozLeft?.gpm||0, s.size, s.lengthFt));
    const bFLs = bSecs.map(s => FL(L.nozRight?.gpm||0, s.size, s.lengthFt));
    const aNeed = (L.nozLeft?.NP||0) + aFLs.reduce((x,y)=>x+y,0);
    const bNeed = (L.nozRight?.NP||0)+ bFLs.reduce((x,y)=>x+y,0);
    const maxNeed = Math.max(aNeed, bNeed);
    const wyeLoss = (L.wyeLoss||10);
    const total = maxNeed + mainSum + wyeLoss + elevPsi;
    return `
      <div><b>Simple PP (Wye):</b>
        <ul class="simpleList">
          <li><b>Branch A need</b> = ${Math.round(aNeed)} psi</li>
          <li><b>Branch B need</b> = ${Math.round(bNeed)} psi</li>
          <li><b>Take the higher branch</b> = <b>${Math.round(maxNeed)} psi</b></li>
          <li><b>Main FL</b> = ${mainSecs.length ? mainParts.join(' + ') : 0} = <b>${fmt(mainSum)} psi</b></li>
          <li><b>Wye</b> = +${wyeLoss} psi</li>
          <li><b>Elevation</b> = ${elevStr}</li>
        </ul>
        <div style="margin-top:6px"><b>PP = max(A,B) + Main FL + Wye ± Elev = ${fmt(maxNeed)} + ${fmt(mainSum)} + ${fmt(wyeLoss)} ${elevStr} = <span style="color:#9fe879)">${fmt(total)} psi</span></b></div>
      </div>
    `;
  }
}

/* ========================================================================== */
/*                                Main render                                 */
/* ========================================================================== */

export async function render(container){

  // Restore saved practice "state" early (lines/supply etc.)
  const saved_at_mount = loadSaved();
  if (saved_at_mount?.state) restoreState(saved_at_mount.state);

  // Persist on hide/close
  window.addEventListener('beforeunload', ()=>{
    const pack = buildSnapshot(pickWaterSnapshotSafe());
    if (pack) saveNow(pack);
  });
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'hidden') {
      const pack = buildSnapshot(pickWaterSnapshotSafe());
      if (pack) saveNow(pack);
    }
  });

  container.innerHTML = `
    <section class="stack" data-calc-root>
      <section class="wrapper card">
        <div class="stage" id="stage">
          <svg id="stageSvg" viewBox="0 0 ${TRUCK_W} ${TRUCK_H}" preserveAspectRatio="xMidYMax meet" aria-label="Visual stage">
            <image id="truckImg" href="/assets/images/engine181.png" x="0" y="0" width="${TRUCK_W}" height="${TRUCK_H}" preserveAspectRatio="xMidYMax meet"
              onerror="this.setAttribute('href','https://fireopssim.com/pump/engine181.png')"></image>
            <g id="hoses"></g>
            <g id="branches"></g>
            <g id="labels"></g>
            <g id="tips"></g>
            <g id="supplyG"></g>
          </svg>

          <!-- Editor (opened by bottom-sheet-editor.js or our fallback) -->
          <div id="tipEditor" class="tip-editor is-hidden" role="dialog" aria-modal="true" aria-labelledby="teTitle">
            <div class="mini" id="teTitle" style="margin-bottom:6px;opacity:.9">Edit Line</div>

            <div class="te-row"><label>Where</label><input id="teWhere" readonly></div>
            <!-- Segment Switch (shown only when Wye is ON) -->
            <div id="segSwitch" class="segSwitch is-hidden" style="display:none; margin:6px 0 4px; gap:6px">
              <button type="button" class="segBtn" data-seg="main">Main</button>
              <button type="button" class="segBtn" data-seg="A">Line A</button>
              <button type="button" class="segBtn" data-seg="B">Line B</button>
            </div>


            
            <!-- Diameter: - [value] +, cycles 1 3/4, 2 1/2, 5" -->
            <div class="te-row" id="rowSize">
              <label>Diameter</label>
              <input type="hidden" id="teSize" value="1.75">
              <div class="steppers">
                <button type="button" class="stepBtn" id="sizeMinus" aria-label="Decrease hose size">−</button>
                <div class="stepVal" id="sizeLabel">1 3/4″</div>
                <button type="button" class="stepBtn" id="sizePlus" aria-label="Increase hose size">+</button>
              </div>
            </div>

            <!-- Length: - [value] +, steps of 50' -->
            <div class="te-row" id="rowLen">
              <label>Length (ft)</label>
              <input type="hidden" id="teLen" value="50">
              <div class="steppers">
                <button type="button" class="stepBtn" id="lenMinus" aria-label="Decrease length">−</button>
                <div class="stepVal" id="lenLabel">50′</div>
                <button type="button" class="stepBtn" id="lenPlus" aria-label="Increase length">+</button>
              </div>
            </div>

            <!-- Nozzle: full list from charts (NOZ_LIST) -->
            <div class="te-row" id="rowNoz">
              <label>Nozzle</label>
              <select id="teNoz"></select>
            </div>

            <!-- Elevation: - [value] +, steps of 1' -->
            <div class="te-row" id="rowElev">
              <label>Elevation (ft)</label>
              <input type="hidden" id="teElev" value="0">
              <div class="steppers">
                <button type="button" class="stepBtn" id="elevMinus" aria-label="Decrease elevation">−</button>
                <div class="stepVal" id="elevLabel">0′</div>
            <!-- Branch controls (visible only when Wye is active) -->
            <section id="branchPlusWrap" style="display:none; margin-top:10px">
              <div class="ink-strong" style="font-weight:700;margin-bottom:6px">Branches (Wye)</div>

              <!-- Branch A -->
              <div class="card" id="branchASection" style="padding:8px; margin-bottom:8px">
                <div style="font-weight:700;margin-bottom:6px">Branch A</div>
                <div class="te-row">
                  <label>Length (ft)</label>
                  <input type="hidden" id="teLenA" value="50">
                  <div class="steppers">
                    <button type="button" class="stepBtn" id="lenAMinus">−</button>
                    <div class="stepVal" id="lenALabel">50′</div>
                    <button type="button" class="stepBtn" id="lenAPlus">+</button>
                  </div>
                </div>
                <div class="te-row">
                  <label>Elevation (ft)</label>
                  <input type="hidden" id="teElevA" value="0">
                  <div class="steppers">
                    <button type="button" class="stepBtn" id="elevAMinus">−</button>
                    <div class="stepVal" id="elevALabel">0′</div>
                    <button type="button" class="stepBtn" id="elevAPlus">+</button>
                  </div>
                </div>
                <div class="te-row">
                  <label>Nozzle</label>
                  <select id="teNozA"></select>
                </div>
              </div>

              <!-- Branch B -->
              <div class="card" id="branchBSection" style="padding:8px">
                <div style="font-weight:700;margin-bottom:6px">Branch B</div>
                <div class="te-row">
                  <label>Length (ft)</label>
                  <input type="hidden" id="teLenB" value="50">
                  <div class="steppers">
                    <button type="button" class="stepBtn" id="lenBMinus">−</button>
                    <div class="stepVal" id="lenBLabel">50′</div>
                    <button type="button" class="stepBtn" id="lenBPlus">+</button>
                  </div>
                </div>
                <div class="te-row">
                  <label>Elevation (ft)</label>
                  <input type="hidden" id="teElevB" value="0">
                  <div class="steppers">
                    <button type="button" class="stepBtn" id="elevBMinus">−</button>
                    <div class="stepVal" id="elevBLabel">0′</div>
                    <button type="button" class="stepBtn" id="elevBPlus">+</button>
                  </div>
                </div>
                <div class="te-row">
                  <label>Nozzle</label>
                  <select id="teNozB"></select>
                </div>
              </div>
            </section>
            
                <button type="button" class="stepBtn" id="elevPlus" aria-label="Increase elevation">+</button>
              </div>
            </div>


            <div class="te-row"><label>Wye</label>
              <select id="teWye"><option value="off">Off</option><option value="on">On</option></select>
            </div>

            <div id="branchBlock" class="is-hidden">
              <div class="te-row"><label>Branch A len</label><input type="number" id="teLenA" min="0" step="25" value="100"></div>
              <div class="te-row"><label>Branch A noz</label><select id="teNozA"></select></div>
              <div class="te-row"><label>Branch B len</label><input type="number" id="teLenB" min="0" step="25" value="100"></div>
              <div class="te-row"><label>Branch B noz</label><select id="teNozB"></select></div>
            </div>

            <div class="te-actions">
              <button class="btn" id="teCancel">Cancel</button>
              <button class="btn primary" id="teApply">Apply</button>
            </div>
          </div>

          <div class="info" id="topInfo">No lines deployed</div>
        </div>

        <!-- Controls -->
        <div class="controlBlock">
          <div class="controlRow">
            <div class="lineGroup">
              <button class="linebtn" data-line="left">Line 1</button>
              <button class="linebtn" data-line="back">Line 2</button>
              <button class="linebtn" data-line="right">Line 3</button>
            </div>
            <div class="actionGroup">
              <button class="presetsbtn" id="presetsBtn">Presets</button>
            </div>
          </div>

          <div class="controlRow">
            <div class="actionGroup">
              <button class="supplybtn" id="hydrantBtn" title="Pressurized (Hydrant)">Hydrant</button>
              <button class="supplybtn" id="tenderBtn"  title="Static (Tender Shuttle)">Tender</button>
            </div>
          </div>
        </div>
      </section>

      <!-- KPIs & answer box -->
      <section class="card">
        <div class="kpis">
          <div class="kpi"><div>Total Flow</div><b id="GPM">— gpm</b></div>
          <div class="kpi"><div>Max PP</div><b id="PDP">— psi</b><button id="whyBtn" class="whyBtn">Why?</button></div>
        </div>

        <div id="supplySummary" class="supplySummary" style="margin-top:10px; display:none;"></div>

        <!-- Hydrant helper -->
        <div id="hydrantHelper" class="helperPanel" style="display:none; margin-top:10px; background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
          <div style="color:#fff; font-weight:800; margin-bottom:6px">Hydrant Residual %Drop</div>
          <div class="mini" style="color:#a9bed9; margin-bottom:8px">
            0–10% → 3×, 11–15% → 2×, 16–25% → 1×, >25% → 0× of same-size lines
          </div>
          <div class="row" style="display:flex; gap:10px; flex-wrap:wrap">
            <div class="field" style="min-width:150px">
              <label>Line size</label>
              <select id="hydrantLineSize">
                <option value="1.75">1¾″ (attack)</option>
                <option value="2.5">2½″</option>
                <option value="5">5″ LDH</option>
              </select>
            </div>
            <div class="field" style="min-width:140px">
              <label>Static (psi)</label>
              <input type="number" id="hydrantStatic" placeholder="e.g., 80" inputmode="decimal">
            </div>
            <div class="field" style="min-width:170px">
              <label>Residual w/ 1 line (psi)</label>
              <input type="number" id="hydrantResidual" placeholder="e.g., 72" inputmode="decimal">
            </div>
            <div class="field" style="min-width:150px; display:flex; align-items:flex-end">
              <button class="btn primary" id="hydrantCalcBtn" type="button">Evaluate %Drop</button>
            </div>
          </div>
          <div id="hydrantResult" class="status" style="margin-top:8px; color:#cfe6ff">Enter numbers then press <b>Evaluate %Drop</b>.</div>
        </div>
<!-- Tender controls (minimal) -->
<div id="staticHelper" class="helperPanel" style="display:none; margin-top:10px; background:rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
  <!-- Compact Tender Shuttle status -->
  <div class="pill shuttleMeta" style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
    <div class="mini" style="font-weight:700;">Supply Mode</div>
    <div class="mini">Tender shuttle</div>
    <div class="gpmLine">Total Shuttle GPM: <span id="shuttleTotalGpm">0</span> gpm</div>
  </div>

  <div class="row" style="gap:10px; align-items:flex-end;">
    <div class="field">
      <label>Tender ID / Number</label>
      <input id="tAddId" type="text" placeholder="e.g., Tender 2">
    </div>
    <div class="field">
      <label>Capacity (gal)</label>
      <input id="tAddCap" type="number" inputmode="decimal" placeholder="e.g., 3000">
    </div>
    <div class="field">
      <button id="tAddBtn" class="btn primary" type="button">Add Tender</button>
    </div>
  </div>

  <!-- Per‑tender list with timers will render here -->
  <div id="tenderList" style="margin-top:10px"></div>
</div>


        

        <div class="linesTable is-hidden" id="linesTable"></div>
      </section>
    </section>

`;

  /* ----------------------------- Styles ---------------------------------- */
    /* ----------------------------- Styles ---------------------------------- */
  injectStyle(container, `
    :root, body { overflow-x: hidden; }
    [data-calc-root] { max-width: 100%; overflow-x: hidden; }
    .wrapper.card { max-width: 100%; overflow-x: hidden; }
    .stage { width: 100%; overflow: hidden; }
    #stageSvg { width: 100%; display: block; }  /* make SVG scale to container width */

    input, select, textarea, button { font-size:16px; }
    .btn, .linebtn, .supplybtn, .presetsbtn, .whyBtn { min-height:44px; padding:10px 14px; border-radius:12px; }
    .controlBlock { display:flex; flex-direction:column; gap:8px; margin-top:10px; }
    ...

    input, select, textarea, button { font-size:16px; }
    .btn, .linebtn, .supplybtn, .presetsbtn, .whyBtn { min-height:44px; padding:10px 14px; border-radius:12px; }
    .controlBlock { display:flex; flex-direction:column; gap:8px; margin-top:10px; }
    .controlRow { display:flex; gap:12px; justify-content:space-between; align-items:center; flex-wrap:wrap; }
    .lineGroup, .actionGroup { display:flex; gap:8px; flex-wrap:wrap; }
    .kpis { display:flex; gap:12px; flex-wrap:wrap; }
    .kpi b { font-size:20px; }
    .field label { display:block; font-weight:700; color:#dfe9ff; margin: 6px 0 4px; }
    .field input[type="text"], .field input[type="number"], .field select, .field textarea {
      width:100%; padding:10px 12px;
      border:1px solid rgba(255,255,255,.22);
/* phone KPI single-line */
try{(function(){const s=document.createElement("style");s.textContent="@media (max-width: 420px){.kpis{flex-wrap:nowrap}.kpi b{font-size:16px}.kpi{padding:6px 8px}}";document.head.appendChild(s);}())}catch(e){}
 border-radius:12px;
      background:#0b1420; color:#eaf2ff; outline:none;
    }
    .field input:focus, .field select:focus, .field textarea:focus {
      border-color:#6ecbff; box-shadow:0 0 0 3px rgba(110,203,255,.22);
    }
    .supplySummary { background:#0e151e; border:1px solid rgba(255,255,255,.12); border-radius:12px; padding:12px; color:#eaf2ff; }
    .supplySummary .row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    .supplySummary .k { color:#a9bed9; min-width:160px; }
    .supplySummary .v { font-weight:800; }

    .hoseBase{fill:none;stroke-linecap:round;stroke-linejoin:round}
    .hose5{stroke:#ecd464;stroke-width:12}
    .hose25{stroke:#6ecbff;stroke-width:9}
    .hose175{stroke:#ff6b6b;stroke-width:6}
    .shadow{stroke:rgba(0,0,0,.35);stroke-width:12}

    .hose-end{cursor:pointer;pointer-events:all}
    .plus-hit{fill:transparent;stroke:transparent}
    .plus-circle{fill:#fff;stroke:#111;stroke-width:1.5;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))}
    .plus-sign{stroke:#111;stroke-width:3;stroke-linecap:round}

    .hoseLegend{display:flex;gap:8px;align-items:center;font-size:11px;color:#cfe4ff;margin:2px 0 6px}
    .legSwatch{width:14px;height:8px;border-radius:3px;display:inline-block;border:1px solid rgba(0,0,0,.35)}
    .sw175{background:#ff6b6b} .sw25{background:#6ecbff} .sw5{background:#ecd464}

    details.math{background:#0b1a29;border:1px solid #1f3a57;border-radius:12px;padding:6px 8px;margin-top:6px}
    details.math summary{cursor:pointer;color:#cfe4ff;font-weight:700}
    .barWrap{background:#0b1320;border:1px solid #1f3a57;border-radius:10px;padding:6px;margin:6px 0}
    .barTitle{font-size:12px;color:#9fb0c8;margin-bottom:6px}
    .simpleBox{background:#0b1a29;border:1px solid #29507a;border-radius:10px;padding:8px;margin-top:6px;font-size:13px}
    .simpleBox b{color:#eaf2ff}
    .lbl{font-size:10px;fill:#0b0f14}
    .is-hidden{display:none!important}
  `);

  /* ------------------------------ DOM refs -------------------------------- */
  const stageSvg    = container.querySelector('#stageSvg');
  const G_hoses     = container.querySelector('#hoses');
  const G_branches  = container.querySelector('#branches');
  const G_labels    = container.querySelector('#labels');
  const G_tips      = container.querySelector('#tips');
  const G_supply    = container.querySelector('#supplyG');
  const truckImg    = container.querySelector('#truckImg');
  const topInfo     = container.querySelector('#topInfo');
  const PDPel       = container.querySelector('#PDP');
  const GPMel       = container.querySelector('#GPM');
  const supplySummaryEl = container.querySelector('#supplySummary');
  const linesTable  = container.querySelector('#linesTable');

  // Editor fields
  const tipEditor   = container.querySelector('#tipEditor');
  const teTitle     = container.querySelector('#teTitle');
  const teWhere     = container.querySelector('#teWhere');
  const teSize      = container.querySelector('#teSize');
  const teLen       = container.querySelector('#teLen');
  const teElev      = container.querySelector('#teElev');
  const teWye       = container.querySelector('#teWye');
  if (teWye) teWye.addEventListener('change', updateWyeAndButtons);
const teLenA      = container.querySelector('#teLenA');
  const teLenB      = container.querySelector('#teLenB');
  const teNoz       = container.querySelector('#teNoz');
  const teNozA      = container.querySelector('#teNozA');
  const teNozB      = container.querySelector('#teNozB');
  
  /* ====== Segmented Branch UI (scoped, no globals) ====== */
  (function(){
    // Create UI right above the action buttons, only once per open
    function __ensureSegUI(whereInit){
      const tip = container.querySelector('#tipEditor'); if (!tip) return;
      const actions = tip.querySelector('.te-actions') || tip.lastElementChild;

      // Wye row, branch container, and size steppers
      const wyeRow = tip.querySelector('#teWye')?.closest('.te-row');
      const branchBlock = tip.querySelector('#branchBlock');
      const aSect = tip.querySelector('#branchASection');
      const bSect = tip.querySelector('#branchBSection');
      const sizeMinus = tip.querySelector('#sizeMinus');
      const sizePlus  = tip.querySelector('#sizePlus');

      // Remove any prior segSwitch from previous opens, then recreate
      let wrap = tip.querySelector('#segSwitch');
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      wrap = document.createElement('div');
      wrap.id = 'segSwitch';
      wrap.className = 'segSwitch';
      wrap.style.display = 'none'; // default hidden, shown when Wye ON
      const mk = (label, seg)=>{
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'segBtn';
        b.dataset.seg = seg;
        b.textContent = label;
        return b;
      };
      const bMain = mk('Main','main');
      const bA    = mk('Line A','A');
      const bB    = mk('Line B','B');
      wrap.appendChild(bMain); wrap.appendChild(bA); wrap.appendChild(bB);
      tip.insertBefore(wrap, actions);

      function setActive(seg){
        // highlight
        [bMain,bA,bB].forEach(btn=>btn.classList.toggle('active', btn.dataset.seg===seg));

        // helper show/hide with robust a11y + style guards
        const hideEl = (el)=>{ if(!el) return; el.hidden = true; el.inert = true; el.style.display='none'; el.classList.add('is-hidden'); };
        const showEl = (el)=>{ if(!el) return; el.hidden = false; el.inert = false; el.style.display=''; el.classList.remove('is-hidden'); };

        const mainShow = (seg==='main');

        // show/hide main rows
        if (wyeRow) (mainShow? showEl : hideEl)(wyeRow);
        ['#rowSize','#rowLen','#rowElev','#rowNoz'].forEach(sel=>{
          const el = tip.querySelector(sel);
          if (el) (mainShow? showEl : hideEl)(el);
        });

        // legacy compact block wrapper only when on a branch
        if (branchBlock) (seg==='A'||seg==='B' ? showEl : hideEl)(branchBlock);

        
        // Hide the opposite side rows inside the legacy compact branchBlock
        if (branchBlock){
          const rowA_len = branchBlock.querySelector('#teLenA')?.closest('.te-row') || branchBlock.querySelector('label[for="teLenA"]')?.closest('.te-row');
          const rowA_noz = branchBlock.querySelector('#teNozA')?.closest('.te-row') || branchBlock.querySelector('label:contains("Branch A noz")')?.closest('.te-row');
          const rowB_len = branchBlock.querySelector('#teLenB')?.closest('.te-row') || branchBlock.querySelector('label[for="teLenB"]')?.closest('.te-row');
          const rowB_noz = branchBlock.querySelector('#teNozB')?.closest('.te-row') || branchBlock.querySelector('label:contains("Branch B noz")')?.closest('.te-row');
          if (seg==='A'){
            if (rowA_len) showEl(rowA_len);
            if (rowA_noz) showEl(rowA_noz);
            if (rowB_len) hideEl(rowB_len);
            if (rowB_noz) hideEl(rowB_noz);
          } else if (seg==='B'){
            if (rowA_len) hideEl(rowA_len);
            if (rowA_noz) hideEl(rowA_noz);
            if (rowB_len) showEl(rowB_len);
            if (rowB_noz) showEl(rowB_noz);
          }
        }
        // Exclusively show Branch sections
        if (seg==='A'){ showEl(aSect); hideEl(bSect); }
        else if (seg==='B'){ showEl(bSect); hideEl(aSect); }
        else { hideEl(aSect); hideEl(bSect); }

        // lock branch size to 1 3/4
        const sizeLabel = tip.querySelector('#sizeLabel');
        if (!mainShow){
          if (teSize) teSize.value = '1.75';
          if (sizeLabel) sizeLabel.textContent = '1 3/4″';
          if (sizeMinus) sizeMinus.disabled = true;
          if (sizePlus)  sizePlus.disabled  = true;
        }else{
          if (sizeMinus) sizeMinus.disabled = false;
          if (sizePlus)  sizePlus.disabled  = false;
        }

        // where label polish
        if (teWhere){
          teWhere.value = seg==='main' ? 'Main (to Wye)' : (seg==='A' ? 'Line A (left of wye)' : 'Line B (right of wye)');
        }
      }
function gateWyeBySize(){
  try{ globalThis.gateWyeBySize = gateWyeBySize; }catch(_){}

        const sizeOK = (teSize && String(teSize.value) === '2.5');
        const wyeSelect = tip.querySelector('#teWye');
        if (!sizeOK){
          // force off & hide everything Wye-related
          if (wyeSelect) wyeSelect.value = 'off';
          wrap.style.display = 'none';
          if (branchBlock) branchBlock.style.display = 'none';
        }
        // hide or show the Wye row itself
        if (wyeRow) wyeRow.style.display = sizeOK ? '' : 'none';
        return sizeOK;
      }

      function updateWyeAndButtons(){
        const isOn = tip.querySelector('#teWye')?.value === 'on';
        const sizeOK = gateWyeBySize();
        wrap.style.display = (isOn && sizeOK) ? 'flex' : 'none';
        if (!(isOn && sizeOK)){
          // collapse back to Main if user turned Wye off or size is not 2.5
          setActive('main');
        }
      }
// Ensure Wye helpers are globally accessible (avoid ReferenceError)
try{
  if (typeof updateWyeAndButtons === 'function') { globalThis.updateWyeAndButtons = updateWyeAndButtons; }
  if (typeof gateWyeBySize === 'function')      { globalThis.gateWyeBySize      = gateWyeBySize; }
}catch(_){}


      // Bind
      [bMain,bA,bB].forEach(btn=>btn.addEventListener('click', ()=> setActive(btn.dataset.seg)));
      const wyeSel = tip.querySelector('#teWye');
      if (wyeSel){
        wyeSel.addEventListener('change', updateWyeAndButtons);
      }
      if (sizeMinus) sizeMinus.addEventListener('click', ()=>{ setTimeout(updateWyeAndButtons,0); });
      if (sizePlus)  sizePlus .addEventListener('click', ()=>{ setTimeout(updateWyeAndButtons,0); });

      // Initial state
      updateWyeAndButtons();
      // If user clicked a branch tip to open, start there; else Main
      if (whereInit==='L') setActive('A');
      else if (whereInit==='R') setActive('B');
      else setActive('main');
    }

    // Expose short hooks (scoped to this container instance)
    container.__segEnsureUI = __ensureSegUI;
  })();
// Segment switch elements
  const segSwitch  = container.querySelector('#segSwitch');
  const segBtns    = segSwitch ? Array.from(segSwitch.querySelectorAll('.segBtn')) : [];
  const branchASection = container.querySelector('#branchASection');
  const branchBSection = container.querySelector('#branchBSection');

  let currentSeg = 'main'; // 'main' | 'A' | 'B'

  function setSeg(seg){
    currentSeg = seg;

    // helper show/hide with robust a11y + style guards
    const hideEl = (el)=>{ if(!el) return; el.hidden = true; el.inert = true; el.style.display='none'; el.classList.add('is-hidden'); };
    const showEl = (el)=>{ if(!el) return; el.hidden = false; el.inert = false; el.style.display=''; el.classList.remove('is-hidden'); };

    // Highlight active button
    segBtns.forEach(b => b.classList.toggle('active', b.dataset.seg === seg));

    // Toggle visibility of rows depending on segment
    const mainRows = ['#rowSize','#rowLen','#rowElev','#rowNoz'];
    const wyeRow = container.querySelector('#teWye')?.closest('.te-row');
    mainRows.forEach(sel=>{
      const el = container.querySelector(sel);
      if (!el) return;
      (seg==='main' ? showEl : hideEl)(el);
    });
    if (wyeRow) (seg==='main' ? showEl : hideEl)(wyeRow);

    // Branch sections — show only selected branch when wye is on
    if (seg==='A'){ showEl(branchASection); hideEl(branchBSection); }
    else if (seg==='B'){ showEl(branchBSection); hideEl(branchASection); }
    else { hideEl(branchASection); hideEl(branchBSection); }

    
    // Additionally, for the legacy compact branchBlock, hide the opposite branch rows
    const branchBlock = container.querySelector('#branchBlock');
    if (branchBlock){
      const rowA_len = branchBlock.querySelector('#teLenA')?.closest('.te-row') || branchBlock.querySelector('label[for="teLenA"]')?.closest('.te-row');
      const rowA_noz = branchBlock.querySelector('#teNozA')?.closest('.te-row') || branchBlock.querySelector('label:contains("Branch A noz")')?.closest('.te-row');
      const rowB_len = branchBlock.querySelector('#teLenB')?.closest('.te-row') || branchBlock.querySelector('label[for="teLenB"]')?.closest('.te-row');
      const rowB_noz = branchBlock.querySelector('#teNozB')?.closest('.te-row') || branchBlock.querySelector('label:contains("Branch B noz")')?.closest('.te-row');
      if (seg==='A'){
        if (rowA_len) showEl(rowA_len);
        if (rowA_noz) showEl(rowA_noz);
        if (rowB_len) hideEl(rowB_len);
        if (rowB_noz) hideEl(rowB_noz);
      } else if (seg==='B'){
        if (rowA_len) hideEl(rowA_len);
        if (rowA_noz) hideEl(rowA_noz);
        if (rowB_len) showEl(rowB_len);
        if (rowB_noz) showEl(rowB_noz);
      } else {
        // main
        if (rowA_len) hideEl(rowA_len);
        if (rowA_noz) hideEl(rowA_noz);
        if (rowB_len) hideEl(rowB_len);
        if (rowB_noz) hideEl(rowB_noz);
      }
    }
    // Lock diameter on branches
    const sizeMinus = container.querySelector('#sizeMinus');
    const sizePlus  = container.querySelector('#sizePlus');
    const teSize    = container.querySelector('#teSize');
    const sizeLabel = container.querySelector('#sizeLabel');
    if (seg==='A' || seg==='B'){
      if (teSize) teSize.value = '1.75';
      if (sizeLabel) sizeLabel.textContent = '1 3/4″';
      if (sizeMinus) sizeMinus.disabled = true;
      if (sizePlus)  sizePlus.disabled  = true;
    } else {
      if (sizeMinus) sizeMinus.disabled = false;
      if (sizePlus)  sizePlus.disabled  = false;
    }

    // Update “Where” label
    const teWhere = container.querySelector('#teWhere');
    if (teWhere){
      teWhere.value = seg === 'main'
        ? 'Main (to Wye)'
        : seg === 'A'
          ? 'Line A (left of wye)'
          : 'Line B (right of wye)';
    }
  }
function updateSegSwitchVisibility(){
    const wyeOn = teWye && teWye.value === 'on';
    if (segSwitch){
      segSwitch.style.display = wyeOn ? 'flex' : 'none';
    }
    if (!wyeOn){
      // Wye turned OFF → back to main and hide both branches
      setSeg('main');
      return;
    }
    // Wye turned ON → keep selection; default to A on first open
    if (currentSeg === 'main') setSeg('A'); else setSeg(currentSeg);
  }

  // Bind seg buttons
  segBtns.forEach(btn=>btn.addEventListener('click' );

// --- Ensure Branch B nozzle changes update math/render ---
try{
  const teNozB = container.querySelector('#teNozB');
  if (teNozB && !teNozB.__wired){
    teNozB.addEventListener('change', ()=>{
      try{
        const id = teNozB.value;
        // resolve current line
        let key = (typeof currentLineKey!=='undefined' && currentLineKey) ? currentLineKey : null;
        if (!key){
          const where = container.querySelector('#teTitle')?.textContent||'';
          const m = where && where.match(/^(Line|LDH)\s*([A-Z0-9]+)/i);
          if (m) key = (m[2]||'').toLowerCase();
        }
        if (!key && typeof lastEditedKey!=='undefined') key = lastEditedKey;
        if (!key) key = 'line1';
        const L = state.lines[key];
        if (L && id && NOZ[id]){
          L.nozRight = NOZ[id];
          if (typeof recompute==='function') recompute();
          if (typeof render==='function') render();
          if (typeof markDirty==='function') markDirty();
        }
      }catch(_){}
    });
    teNozB.__wired = true;
  }
}catch(_){}
, ()=> setSeg(btn.dataset.seg)));

  const branchBlock = container.querySelector('#branchBlock');
  const rowNoz      = container.querySelector('#rowNoz');

  // Populate nozzle selects
  [teNoz, teNozA, teNozB].forEach(sel=>{
    if(!sel) return;
    sel.innerHTML = NOZ_LIST.map(n=>`<option value="${n.id}">${n.name||n.label||n.id}</option>`).join('');
  });

  // Panels controlled by waterSupply.js
  const hydrantHelper = container.querySelector('#hydrantHelper');
  const staticHelper  = container.querySelector('#staticHelper');

  /* -------------------------- Water Supply wiring ------------------------- */

  const waterSupply = new WaterSupplyUI({
    container, state,
    pumpXY, truckTopY,
    G_supply, TRUCK_H,
    ids: {
      hydrantHelper: '#hydrantHelper',
      staticHelper:  '#staticHelper',
      tAddId:        '#tAddId',
      tAddCap:       '#tAddCap',
      tAddBtn:       '#tAddBtn',
      tenderList:    '#tenderList',
      shuttleTotalGpm: '#shuttleTotalGpm',
      hydrantLineSize: '#hydrantLineSize',
      hydrantStatic:   '#hydrantStatic',
      hydrantResidual: '#hydrantResidual',
      hydrantCalcBtn:  '#hydrantCalcBtn',
      hydrantResult:   '#hydrantResult',
      tTripAll:        '#tTripAll',
      tTripApplyAll:  '#tTripApplyAll'}
  });

  
  
  // Tender Shuttle: Round Trip apply-to-all + autofill + compact styles
  try {
    const tTripAllEl = container.querySelector('#tTripAll');
    const tTripApplyAllEl = container.querySelector('#tTripApplyAll');
    if (tTripApplyAllEl) {
      tTripApplyAllEl.addEventListener('click', ()=>{
        const minutes = (tTripAllEl ? parseFloat(tTripAllEl.getAttribute('data-min') || (tTripAllEl.textContent||'0')) : 0) || 0;
        let applied = false;
        try {
          if (waterSupply && typeof waterSupply.setAllRoundTripMinutes === 'function') {
            waterSupply.setAllRoundTripMinutes(minutes);
            applied = true;
          }
        } catch(e){}
        if (!applied) {
          const list = container.querySelectorAll('#tenderList input[name="trip"], #tenderList input[data-role="trip"]');
          list.forEach(inp => {
            inp.value = String(minutes);
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          });
          document.dispatchEvent(new CustomEvent('tender-apply-trip', { detail: { minutes } }));
        }
        try { refreshSupplySummary(); markDirty(); } catch(_){}
      });
    }
    let __tripAutofilled = false;
    const tenderListEl = container.querySelector('#tenderList');
    if (tenderListEl) {
      tenderListEl.addEventListener('input', (e)=>{
        const t = e.target;
        if (__tripAutofilled || !t) return;
        const isTrip = (t.name === 'trip') || (t.dataset.role === 'trip');
        if (!isTrip) return;
        const v = parseFloat(t.value);
        if (v > 0) {
          if (tTripAllEl && (tTripAllEl.getAttribute('data-min') === '0' || tTripAllEl.textContent === '—' || !tTripAllEl.textContent)) {
            tTripAllEl.setAttribute('data-min', String(v));
            tTripAllEl.textContent = String(v);
            __tripAutofilled = true;
          }
        }
      });
    }
  } catch(_){}

  (function(){
    try{
      const css = `
        .shuttleMeta .btn{ padding:6px 10px; font-size:12px; }
        @media (max-width:520px){
          .shuttleMeta{ width:100%; justify-content:space-between; }
          .shuttleMeta .gpmLine{ font-weight:700; }
          .shuttleMeta .tripCtrl input{ width:70px; }
          .helperPanel .field label{ font-size:12px; }
        }`;
      const st = document.createElement('style');
      st.textContent = css;
      document.head.appendChild(st);
    }catch(_){}
  })();
// Global Round Trip apply-to-all
  try {
    const tTripAllEl = container.querySelector('#tTripAll');
    const tTripApplyAllEl = container.querySelector('#tTripApplyAll');
    if (tTripApplyAllEl) {
      tTripApplyAllEl.addEventListener('click', ()=>{
        const minutes = (tTripAllEl ? parseFloat(tTripAllEl.getAttribute('data-min') || (tTripAllEl.textContent||'0')) : 0) || 0;
        let applied = false;
        try {
          if (waterSupply && typeof waterSupply.setAllRoundTripMinutes === 'function') {
            waterSupply.setAllRoundTripMinutes(minutes);
            applied = true;
          }
        } catch(e){}
        if (!applied) {
          // Fallback: set all tender "trip" inputs in the list and dispatch input events
          const list = container.querySelectorAll('#tenderList input[name="trip"], #tenderList input[data-role="trip"]');
          list.forEach(inp => {
            inp.value = String(minutes);
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          });
          // Dispatch a custom event for any listeners
          const evt = new CustomEvent('tender-apply-trip', { detail: { minutes } });
          document.dispatchEvent(evt);
        }
        // Recompute summary if present
        try {
          refreshSupplySummary();
          markDirty();
        } catch(_){}
      });
    }
  } catch(_){}
// Helper to pick the best snapshot API if present
  function pickWaterSnapshotSafe(){
    try {
      if (typeof waterSupply.getSnapshot === 'function') return waterSupply.getSnapshot();
      if (typeof waterSupply.snapshot    === 'function') return waterSupply.snapshot();
      if (typeof waterSupply.export      === 'function') return waterSupply.export();
    } catch {}
    // Best-effort DOM fallback if no API:
    try {
      const tenders = [];
      const list = container.querySelectorAll('#tenderList [data-tender]');
      list.forEach(node=>{
        tenders.push({
          id: node.getAttribute('data-id') || node.querySelector('.tenderName')?.textContent?.trim(),
          cap: +(node.getAttribute('data-cap') || node.querySelector('[data-cap]')?.textContent || 0)
        });
      });
      const gpm = +(container.querySelector('#shuttleTotalGpm')?.textContent || 0);
      return { tenders, shuttle: { totalGpm: gpm } };
    } catch {}
    return null;
  }

  // Restore water snapshot after WaterSupplyUI exists
  try {
    const snap = saved_at_mount?.water;
    if (snap && typeof waterSupply.restoreSnapshot === 'function') {
      waterSupply.restoreSnapshot(snap);
    } else if (snap && typeof waterSupply.setSnapshot === 'function') {
      waterSupply.setSnapshot(snap);
    } else if (snap && typeof waterSupply.import === 'function') {
      waterSupply.import(snap);
    } else if (snap) {
      // Fallback: try common field names on state
      if (snap.tenders) state.tenders = snap.tenders;
      if (snap.shuttle) state.shuttle = snap.shuttle;
    }
  } catch {}

  // Start autosave heartbeat (includes water snapshot)
  startAutoSave(()=>{
    const waterSnap = pickWaterSnapshotSafe();
    return buildSnapshot(waterSnap);
  });

  // Observe Tender Shuttle UI to persist on changes, too
  const tenderListEl = container.querySelector('#tenderList');
  const shuttleEl    = container.querySelector('#shuttleTotalGpm');
  const mo = new MutationObserver(() => {
    enhanceTenderListStyle();
    refreshSupplySummary();
    markDirty();
  });
  if (tenderListEl) mo.observe(tenderListEl, {childList:true, subtree:true, characterData:true});
  if (shuttleEl)    mo.observe(shuttleEl,    {childList:true, subtree:true, characterData:true});

  /* ---------------------------- Totals & KPIs ----------------------------- */

  function refreshTotals(){
    const vis = Object.entries(state.lines).filter(([_k,l])=>l.visible);
    let totalGPM = 0, maxPDP = -Infinity, maxKey = null;
    vis.forEach(([key, L])=>{
      const single = isSingleWye(L);
      const flow = single ? (activeNozzle(L)?.gpm||0)
                 : L.hasWye ? (L.nozLeft?.gpm||0) + (L.nozRight?.gpm||0)
                            : (L.nozRight?.gpm||0);
      const mainFL = FL_total(flow, L.itemsMain);
      let PDP=0;
      if(single){
        const side = activeSide(L);
        const bnSegs = side==='L' ? L.itemsLeft : L.itemsRight;
        const bnNoz  = activeNozzle(L);
        const branchFL = FL_total(bnNoz.gpm, bnSegs);
        PDP = bnNoz.NP + branchFL + mainFL + (L.elevFt * PSI_PER_FT);
      }else if(L.hasWye){
        const lNeed = FL_total(L.nozLeft?.gpm||0, L.itemsLeft) + (L.nozLeft?.NP||0);
        const rNeed = FL_total(L.nozRight?.gpm||0, L.itemsRight) + (L.nozRight?.NP||0);
        PDP = Math.max(lNeed, rNeed) + mainFL + (L.wyeLoss||10) + (L.elevFt * PSI_PER_FT);
      }else{
        PDP = (L.nozRight?.NP||0) + mainFL + (L.elevFt * PSI_PER_FT);
      }
      totalGPM += flow;
      if(PDP > maxPDP){ maxPDP = PDP; maxKey = key; }
    });
    state.lastMaxKey = maxKey;
    GPMel.textContent = vis.length? (Math.round(totalGPM)+' gpm') : '— gpm';
    PDPel.classList.remove('orange','red');
    if(vis.length){
      const v = Math.round(maxPDP);
      PDPel.textContent = v+' psi';
      if(v>250) PDPel.classList.add('red');
      else if(v>200) PDPel.classList.add('orange');
    }else{
      PDPel.textContent = '— psi';
    }
  }

  /* --------------------------- Lines math panel --------------------------- */

  function renderLinesPanel(){
    const anyDeployed = Object.values(state.lines).some(l=>l.visible);
    if(!anyDeployed || !state.showMath){ linesTable.innerHTML=''; linesTable.classList.add('is-hidden'); return; }
    linesTable.classList.remove('is-hidden'); linesTable.innerHTML='';

    ['left','back','right'].forEach(key=>{
      const L = state.lines[key];
      const row = document.createElement('div'); row.className='lineRow';
      const segs = L.itemsMain.length ? L.itemsMain.map(s=>s.lengthFt+'′ '+sizeLabel(s.size)).join(' + ') : 'empty';
      const single = isSingleWye(L);
      const usedNoz = single ? activeNozzle(L) : L.hasWye ? null : L.nozRight;
      const flow = single ? (usedNoz?.gpm||0) : (L.hasWye ? (L.nozLeft.gpm + L.nozRight.gpm) : L.nozRight.gpm);

      const head = document.createElement('div'); head.className='lineHeader'; head.innerHTML = `
        <span class="title">${L.label}</span>
        <span class="tag">Main: ${sumFt(L.itemsMain)}′ (${segs})</span>
        <span class="tag">Flow: ${flow} gpm</span>
        <span class="tag">${L.visible? 'DEPLOYED':'not deployed'}</span>
      `;
      row.appendChild(head);
      linesTable.appendChild(row);

      if(L.visible){
        const bflow = flow;
        const wrap = document.createElement('div');

        if(L.hasWye && !single){
          const wye = (L.wyeLoss ?? 10);
          wrap.innerHTML = `
            <details class="math" open>
              <summary>Line math</summary>
              <div class="hoseviz">
                <div class="hoseLegend">
                  <span class="legSwatch sw175"></span> 1¾″
                  <span class="legSwatch sw25"></span> 2½″
                  <span class="legSwatch sw5"></span> 5″
                </div>
                <div class="barWrap">
                  <div class="barTitle">Main ${sumFt(L.itemsMain)}′ @ ${bflow} gpm — Wye ${wye} psi</div>
                  <div class="hosebar" id="viz_main_${key}"></div>
                </div>
                <div class="barWrap">
                  <div class="barTitle">Branch A ${sumFt(L.itemsLeft)||0}′ @ ${L.nozLeft.gpm} gpm — NP ${L.nozLeft.NP} psi</div>
                  <div class="hosebar" id="viz_L_${key}"></div>
                </div>
                <div class="barWrap">
                  <div class="barTitle">Branch B ${sumFt(L.itemsRight)||0}′ @ ${L.nozRight.gpm} gpm — NP ${L.nozRight.NP} psi</div>
                  <div class="hosebar" id="viz_R_${key}"></div>
                </div>
                <div class="simpleBox" id="pp_simple_${key}"></div>
              </div>
            </details>
          `;
          linesTable.appendChild(wrap);

          drawHoseBar(document.getElementById('viz_main_'+key), splitIntoSections(L.itemsMain), bflow, 0, 'Main '+sumFt(L.itemsMain)+'′ @ '+bflow+' gpm', 'Wye '+wye);
          drawHoseBar(document.getElementById('viz_L_'+key), splitIntoSections(L.itemsLeft), L.nozLeft?.gpm||0, L.nozLeft?.NP||0, 'Branch A '+(sumFt(L.itemsLeft)||0)+'′');
          drawHoseBar(document.getElementById('viz_R_'+key), splitIntoSections(L.itemsRight), L.nozRight?.gpm||0, L.nozRight?.NP||0, 'Branch B '+(sumFt(L.itemsRight)||0)+'′');
          document.getElementById('pp_simple_'+key).innerHTML = ppExplainHTML(L);

        } else if(single){
          const side = activeSide(L);
          const bnSegs = side==='L'? L.itemsLeft : L.itemsRight;
          const bnTitle = side==='L' ? 'Branch A' : 'Branch B';
          const noz = activeNozzle(L);
          const wye = (L.wyeLoss ?? 10);

          wrap.innerHTML = `
            <details class="math" open>
              <summary>Line math</summary>
              <div class="hoseviz">
                <div class="hoseLegend">
                  <span class="legSwatch sw175"></span> 1¾″
                  <span class="legSwatch sw25"></span> 2½″
                  <span class="legSwatch sw5"></span> 5″
                </div>
                <div class="barWrap">
                  <div class="barTitle">Main ${sumFt(L.itemsMain)}′ @ ${bflow} gpm — via Wye</div>
                  <div class="hosebar" id="viz_main_${key}"></div>
                </div>
                <div class="barWrap">
                  <div class="barTitle">${bnTitle} ${sumFt(bnSegs)||0}′ @ ${noz.gpm} gpm — NP ${noz.NP} psi</div>
                  <div class="hosebar" id="viz_BR_${key}"></div>
                </div>
                <div class="simpleBox" id="pp_simple_${key}"></div>
              </div>
            </details>
          `;
          linesTable.appendChild(wrap);

          drawHoseBar(document.getElementById('viz_main_'+key), splitIntoSections(L.itemsMain), bflow, 0, 'Main '+sumFt(L.itemsMain)+'′ @ '+bflow+' gpm', 'Wye '+wye);
          drawHoseBar(document.getElementById('viz_BR_'+key), splitIntoSections(bnSegs), noz?.gpm||0, noz?.NP||0, bnTitle+' '+(sumFt(bnSegs)||0)+'′');
          document.getElementById('pp_simple_'+key).innerHTML = ppExplainHTML(L);

        } else {
          wrap.innerHTML = `
            <details class="math" open>
              <summary>Line math</summary>
              <div class="hoseviz">
                <div class="hoseLegend">
                  <span class="legSwatch sw175"></span> 1¾″
                  <span class="legSwatch sw25"></span> 2½″
                  <span class="legSwatch sw5"></span> 5″
                </div>
                <div class="barWrap">
                  <div class="barTitle">Main ${sumFt(L.itemsMain)}′ @ ${bflow} gpm — NP ${L.nozRight.NP} psi</div>
                  <div class="hosebar" id="viz_main_${key}"></div>
                </div>
                <div class="simpleBox" id="pp_simple_${key}"></div>
              </div>
            </details>
          `;
          linesTable.appendChild(wrap);

          drawHoseBar(document.getElementById('viz_main_'+key), splitIntoSections(L.itemsMain), bflow, (L.nozRight?.NP||0), 'Main '+sumFt(L.itemsMain)+'′ @ '+bflow+' gpm');
          document.getElementById('pp_simple_'+key).innerHTML = ppExplainHTML(L);
        }
      }
    });
  }

  /* ------------------------ Hydrant/Tender summary ------------------------ */

  function refreshSupplySummary(){
    const box = supplySummaryEl; if(!box) return;
    let html = '';
    if (state.supply === 'pressurized') {
      html = `<div class="row"><span class="k">Supply Mode</span><span class="v">Hydrant (pressurized)</span></div>`;
    } else if (state.supply === 'static') {
      const g = +(container.querySelector('#shuttleTotalGpm')?.textContent||0);
      html = `
        <div class="row"><span class="k">Supply Mode</span><span class="v">Tender shuttle</span></div>
        <div class="row"><span class="k">Total Shuttle GPM</span><span class="v"><b>${Math.round(g)}</b> gpm</span></div>
      `;
    }
    if (html) { box.innerHTML = html; box.style.display = 'block'; }
    else { box.innerHTML = ''; box.style.display = 'none'; }
  }

  /* ------------------------------ Why? button ----------------------------- *//* ------------------------------ Why? button ----------------------------- */

  container.querySelector('#whyBtn').addEventListener('click', ()=>{
    const anyDeployed = Object.values(state.lines).some(l=>l.visible);
    if(!anyDeployed){ alert('Deploy a line to see Pump Pressure breakdown.'); return; }
    if(!state.showMath){ state.showMath = true; renderLinesPanel(); }
    if(!state.lastMaxKey) return;
    const target = container.querySelector('#pp_simple_'+state.lastMaxKey);
    if(target){
      target.scrollIntoView({behavior:'smooth', block:'center'});
      const details = target.closest('details'); if(details && !details.open){ details.open = true; }
    }
  });

  /* ------------------------- Tip editor interactions ---------------------- */

  let editorContext=null;

  function setBranchABEditorDefaults(key){
    if(teNozA) teNozA.value = (state.lines[key].nozLeft?.id) || teNozA.value;
    if(teNozB) teNozB.value = (state.lines[key].nozRight?.id) || teNozB.value;
    if(teLenA) teLenA.value = (state.lines[key].itemsLeft[0]?.lengthFt)||0;
    if(teLenB) teLenB.value = (state.lines[key].itemsRight[0]?.lengthFt)||0;
  }

  function showHideMainNozzleRow(){
    const where = teWhere?.value?.toLowerCase();
    const wyeOn = teWye?.value==='on';
    if(rowNoz) rowNoz.style.display = (where==='main' && wyeOn) ? 'none' : '';
  }

  function onOpenPopulateEditor(key, where){
    const L = seedDefaultsForKey(key);
    L.visible = true;
    editorContext = {key, where};

    const whereLabel = where==='main'?'Main':('Branch '+where);
    teTitle.textContent = (L.label || key.toUpperCase())+' — '+whereLabel;
    teWhere.value = where.toUpperCase();
    teElev.value = L.elevFt||0;
    teWye.value  = L.hasWye? 'on':'off';

    if(where==='main'){
      const seg = L.itemsMain[0] || {size:'1.75',lengthFt:200};
      teSize.value = seg.size; teLen.value = seg.lengthFt||0;
      if (L.hasWye) {
        setBranchBDefaultIfEmpty(L); // ensure B default when wye on
      } else {
        // Ensure default nozzle for main based on diameter if missing
        ensureDefaultNozzleFor(L,'main',seg.size);
        if (L.nozRight?.id && teNoz) teNoz.value = L.nozRight.id;
      }
    } else if(where==='L'){
      const seg = L.itemsLeft[0] || {size:'1.75',lengthFt:100};
      teSize.value = seg.size; teLen.value = seg.lengthFt;
      ensureDefaultNozzleFor(L,'L',seg.size);
      if(teNoz) teNoz.value = (L.nozLeft?.id)||teNoz.value;
    } else {
      const seg = L.itemsRight[0] || {size:'1.75',lengthFt:100};
      teSize.value = seg.size; teLen.value = seg.lengthFt;
      setBranchBDefaultIfEmpty(L);
    }

    setBranchABEditorDefaults(key);
    showHideMainNozzleRow();
  }
  // Branch nozzle change listeners (mirror main lines)
  try {
    const nozA = tip.querySelector('#teNozA');
    const nozB = tip.querySelector('#teNozB');
    if (nozA) nozA.addEventListener('change', () => {
      try {
        const id = nozA.value;
        if (id && NOZ && NOZ[id]) { L.nozLeft = NOZ[id]; }
        // lock branch hose size to 1.75 is handled elsewhere in calc; just recompute
        recompute();
        render();
      } catch(_){}
    });
    if (nozB) nozB.addEventListener('change', () => {
      try {
        const id = nozB.value;
        if (id && NOZ && NOZ[id]) { L.nozRight = NOZ[id]; }
        recompute();
        render();
      } catch(_){}
    });
  } catch(_){}


  // Change of diameter in editor → update default nozzle (when applicable)
  teSize?.addEventListener('change', ()=>{
    if(!editorContext) return;
    const {key, where} = editorContext;
    const L = state.lines[key];
    const size = teSize.value;
    if (where==='main' && teWye.value!=='on'){
      ensureDefaultNozzleFor(L,'main',size);
      if (L.nozRight?.id && teNoz) teNoz.value = L.nozRight.id;
    } else if (where==='L'){
      ensureDefaultNozzleFor(L,'L',size);
      if (L.nozLeft?.id && teNoz) teNoz.value = L.nozLeft.id;
    } else if (where==='R'){
      // Branch B keeps its “Fog 185 @ 50” rule if empty; otherwise honor size default
      if (!(L.nozRight?.id)) setBranchBDefaultIfEmpty(L);
    }
  });

  // Delegate click on "+"
  stageSvg.addEventListener('click', (e)=>{
    const tip = e.target.closest('.hose-end'); if(!tip) return;
    e.preventDefault(); e.stopPropagation();
    const key = tip.getAttribute('data-line'); const where = tip.getAttribute('data-where');
    onOpenPopulateEditor(key, where);
    if (container && container.__segEnsureUI) container.__segEnsureUI(where);
// Initialize segment selection based on clicked tip
    if (where==='L') setSeg('A'); else if (where==='R') setSeg('B'); else setSeg('main');
    updateSegSwitchVisibility();
if (window.BottomSheetEditor && typeof window.BottomSheetEditor.open === 'function'){
      window.BottomSheetEditor.open();
    } else {
      // Minimal fallback
      tipEditor.classList.remove('is-hidden');
      tipEditor.classList.add('is-open');
    }
  });

  // Keep rowNoz visibility in sync when Wye changes in-editor
  teWye?.addEventListener('change', ()=>{
    const branchWrap = popupEl?.querySelector?.("#branchPlusWrap");
    if(branchWrap){ const on = teWye.value==="on"; branchWrap.style.display = on? "": "none"; if(on) initBranchPlusMenus(popupEl); }
    const wyeOn = teWye.value==='on';
    if (editorContext?.where==='main' && wyeOn){
      const L = state.lines[editorContext.key];
      setBranchBDefaultIfEmpty(L);
      if(teNozB && L?.nozRight?.id) teNozB.value = L.nozRight.id;
    }
    showHideMainNozzleRow();
  });

  // Apply updates; close panel handled by bottom-sheet-editor.js (auto-close there)
  container.querySelector('#teApply').addEventListener('click', ()=>{
    if(!editorContext) return;
    const {key, where} = editorContext; const L = state.lines[key];
    const size = teSize.value; const len = Math.max(0, +teLen.value||0);
    const elev=+teElev.value||0; const wyeOn = teWye.value==='on';
    L.elevFt = elev;

    if(where==='main'){
      L.itemsMain = [{size, lengthFt:len}];
      if(!wyeOn){
        L.hasWye=false; L.itemsLeft=[]; L.itemsRight=[];
        // default nozzle by diameter if unset OR use chosen
        if (teNoz && teNoz.value && NOZ[teNoz.value]) L.nozRight = NOZ[teNoz.value];
        else ensureDefaultNozzleFor(L,'main',size);
      }else{
        L.hasWye=true;
        const lenA = Math.max(0, +teLenA?.value||0);
        const lenB = Math.max(0, +teLenB?.value||0);
        L.itemsLeft  = lenA? [{size:'1.75',lengthFt:lenA}] : [];
        L.itemsRight = lenB? [{size:'1.75',lengthFt:lenB}] : [];
        if (teNozA?.value && NOZ[teNozA.value]) L.nozLeft  = NOZ[teNozA.value];
        // Branch B default if empty
        if (!(L.nozRight?.id)){
          setBranchBDefaultIfEmpty(L);
        }
        if (teNozB?.value && NOZ[teNozB.value]) L.nozRight = NOZ[teNozB.value];
      }
    } else if(where==='L'){
      L.hasWye = wyeOn || true; L.itemsLeft = len? [{size, lengthFt:len}] : [];
      if (teNoz?.value && NOZ[teNoz.value]) L.nozLeft = NOZ[teNoz.value];
      else ensureDefaultNozzleFor(L,'L',size);
    } else {
      L.hasWye = wyeOn || true; L.itemsRight = len? [{size, lengthFt:len}] : [];
      if (!(L.nozRight?.id)){
        setBranchBDefaultIfEmpty(L);
      }
      if (typeof teNozB!=='undefined' && teNozB && teNozB.value && NOZ[teNozB.value]) L.nozRight = NOZ[teNozB.value];
    }

    L.visible = true; drawAll(); markDirty();
  });

  /* ---------------------------- Line toggles ------------------------------ */

  container.querySelectorAll('.linebtn').forEach(b=>{
    b.addEventListener('click', ()=>{
      const key=b.dataset.line; const L=seedDefaultsForKey(key);
      L.visible = !L.visible; b.classList.toggle('active', L.visible);
      drawAll(); markDirty();
    });
  });

  /* --------------------------- Supply buttons ----------------------------- */

  container.querySelector('#hydrantBtn').addEventListener('click', ()=>{
    state.supply = 'pressurized'; drawAll(); markDirty();
  });
  container.querySelector('#tenderBtn').addEventListener('click', ()=>{
    state.supply = 'static'; drawAll(); markDirty();
  });

  function enhanceTenderListStyle() {
    const rootEl = container.querySelector('#tenderList');
    if (!rootEl) return;
    rootEl.querySelectorAll('b, .tenderName, .tender-id, .title, .name').forEach(el=>{
      el.classList.add('tender-emph');
    });
  }

  /* -------------------------- Ensure editor script ------------------------ */

  (function ensureBottomSheet(){
    if (window.BottomSheetEditor) return;
    try{
      const already = Array.from(document.scripts).some(s => (s.src||'').includes('bottom-sheet-editor.js'));
      if (already) return;
      const s = document.createElement('script');
      s.src = new URL('./bottom-sheet-editor.js', import.meta.url).href;
      document.body.appendChild(s);
    }catch(e){}
  })();

  /* -------------------------------- Draw --------------------------------- */

  function drawAll(){
    const viewH = Math.ceil(computeNeededHeightPx());
    stageSvg.setAttribute('viewBox', `0 0 ${TRUCK_W} ${viewH}`);
    stageSvg.style.height = viewH + 'px';
    truckImg.setAttribute('y', String(truckTopY(viewH)));

    clearGroup(G_hoses); clearGroup(G_branches); clearGroup(G_tips); clearGroup(G_labels); clearGroup(G_supply);

    const visibleKeys = ['left','back','right'].filter(k=>state.lines[k].visible);
    topInfo.textContent = visibleKeys.length ? ('Deployed: '+visibleKeys.map(k=>state.lines[k].label).join(' • ')) : 'No lines deployed';

    ['left','back','right'].filter(k=>state.lines[k].visible).forEach(key=>{
      const L = state.lines[key]; const dir = key==='left'?-1:key==='right'?1:0;
      const mainFt = sumFt(L.itemsMain);
      const geom = mainCurve(dir, (mainFt/50)*PX_PER_50FT, viewH);

      const base = document.createElementNS('http://www.w3.org/2000/svg','path'); base.setAttribute('d', geom.d); G_hoses.appendChild(base);
      drawSegmentedPath(G_hoses, base, L.itemsMain);
      addTip(G_tips, key,'main',geom.endX,geom.endY);

      // Main label: if Wye present, show 'via Wye' (no nozzle mention)
      const single = isSingleWye(L);
      const usedNoz = single ? activeNozzle(L) : L.hasWye ? null : L.nozRight;
      const flowGpm = single ? (usedNoz?.gpm||0) : (L.hasWye ? (L.nozLeft.gpm + L.nozRight.gpm) : L.nozRight.gpm);
      const npLabel = L.hasWye ? ' — via Wye' : (' — Nozzle '+(L.nozRight?.NP||0)+' psi');
      addLabel(G_labels, mainFt+'′ @ '+flowGpm+' gpm'+npLabel, geom.endX, geom.endY-6, (key==='left')?-10:(key==='back')?-22:-34);

      if(L.hasWye){
        if(sumFt(L.itemsLeft)>0){
          const gL = straightBranch('L', geom.endX, geom.endY, (sumFt(L.itemsLeft)/50)*PX_PER_50FT);
          const pathL = document.createElementNS('http://www.w3.org/2000/svg','path'); pathL.setAttribute('d', gL.d); G_branches.appendChild(pathL);
          drawSegmentedPath(G_branches, pathL, L.itemsLeft);
          addTip(G_tips, key,'L',gL.endX,gL.endY);
          try{
            const lenFtL = (typeof sumFt==='function') ? sumFt(L.itemsLeft)||0 : 0;
            const gpmL = (L.nozLeft && L.nozLeft.gpm) ? L.nozLeft.gpm : 0;
            const psiL = (L.nozLeft && (L.nozLeft.NP||L.nozLeft.psi||L.nozLeft.np)) ? (L.nozLeft.NP||L.nozLeft.psi||L.nozLeft.np) : 0;
            addLabel2(G_labels, String(lenFtL)+'′ @ '+String(gpmL)+' gpm — '+String(psiL)+' psi', gL.endX, gL.endY-8, -10);
          }catch(_){}

        } else addTip(G_tips, key,'L',geom.endX-20,geom.endY-20);

        if(sumFt(L.itemsRight)>0){
          const gR = straightBranch('R', geom.endX, geom.endY, (sumFt(L.itemsRight)/50)*PX_PER_50FT);
          const pathR = document.createElementNS('http://www.w3.org/2000/svg','path'); pathR.setAttribute('d', gR.d); G_branches.appendChild(pathR);
          drawSegmentedPath(G_branches, pathR, L.itemsRight);
          addTip(G_tips, key,'R',gR.endX,gR.endY);
          try{
            const lenFtR = (typeof sumFt==='function') ? sumFt(L.itemsRight)||0 : 0;
            const gpmR = (L.nozRight && L.nozRight.gpm) ? L.nozRight.gpm : 0;
            const psiR = (L.nozRight && (L.nozRight.NP||L.nozRight.psi||L.nozRight.np)) ? (L.nozRight.NP||L.nozRight.psi||L.nozRight.np) : 0;
            addLabel2(G_labels, String(lenFtR)+'′ @ '+String(gpmR)+' gpm — '+String(psiR)+' psi', gR.endX, gR.endY-8, -10);
          }catch(_){}

        } else addTip(G_tips, key,'R',geom.endX+20,geom.endY-20);
      }
      base.remove();
    });

    // Supply visuals & panels
    waterSupply.draw(viewH);
    if (typeof waterSupply.updatePanelsVisibility === 'function') {
      waterSupply.updatePanelsVisibility();
    }

    // KPIs, math, summary
    refreshTotals();
    renderLinesPanel();
    refreshSupplySummary();

    // Button active states
    container.querySelector('#hydrantBtn')?.classList.toggle('active', state.supply==='pressurized');
    container.querySelector('#tenderBtn')?.classList.toggle('active', state.supply==='static');

    // mark dirty after draw (belt & suspenders)
    markDirty();
  }

  // Initial draw
  drawAll();

  // Dev helper to clear saved practice
  window.__resetPractice = function(){ try { sessionStorage.removeItem(PRACTICE_SAVE_KEY); } catch(_) {} };

  
  try{ initPlusMenus(container); }catch(e){}
  return { dispose(){
    stopAutoSave();
  }};

    // (Fallback) Populate Branch A/B nozzle selects like main lines
    try {
      const nozA = root.querySelector('#teNozA');
      const nozB = root.querySelector('#teNozB');
      if (typeof fillNozzles === 'function') {
        fillNozzles(nozA);
        fillNozzles(nozB);
      }
      try {
        if (L.nozLeft && L.nozLeft.id && nozA) nozA.value = L.nozLeft.id;
        if (L.nozRight && L.nozRight.id && nozB) nozB.value = L.nozRight.id;
      } catch(_){}
      try {
        const defId = (typeof defaultNozzleIdForSize==='function') ? defaultNozzleIdForSize('1.75') : null;
        if (defId) {
          if (nozA && !nozA.value) nozA.value = defId;
          if (nozB && !nozB.value) nozB.value = defId;
        }
      } catch(_){}
    } catch(_){}
}

export default { render };


/* === Plus-menu steppers for Diameter, Length, Elevation, Nozzle === */

function initPlusMenus(root){
  const sizeSeq = [
    { val: "1.75", labelPlain: "1 3/4″" },
    { val: "2.5",  labelPlain: "2 1/2″" },
    { val: "5",    labelPlain: "5″" }
  ];
  const teSize = root.querySelector('#teSize');
  const sizeLabel = root.querySelector('#sizeLabel');
  const sizeMinus = root.querySelector('#sizeMinus');
  const sizePlus = root.querySelector('#sizePlus');
  let sizeIdx = Math.max(0, sizeSeq.findIndex(s => s.val === (teSize?.value || "1.75")));
  function drawSize(){ const item = sizeSeq[sizeIdx] || sizeSeq[0]; if(teSize) teSize.value = item.val; if(sizeLabel) sizeLabel.textContent = item.labelPlain; }
  function stepSize(d){ sizeIdx = (sizeIdx + d + sizeSeq.length) % sizeSeq.length; drawSize(); }
  sizeMinus?.addEventListener('click', ()=> stepSize(-1));
  sizePlus?.addEventListener('click', ()=> stepSize(+1));
  drawSize();

  const teLen = root.querySelector('#teLen');
  const lenLabel = root.querySelector('#lenLabel');
  const lenMinus = root.querySelector('#lenMinus');
  const lenPlus = root.querySelector('#lenPlus');
  const LEN_STEP=50, LEN_MIN=0, LEN_MAX=3000;
  function parseLen(){ return Math.max(LEN_MIN, Math.min(LEN_MAX, parseInt(teLen?.value||'0',10)||0)); }
  function drawLen(){ if(lenLabel) lenLabel.textContent = `${parseLen()}′`; }
  function stepLen(d){ let v = parseLen()+d; v=Math.max(LEN_MIN,Math.min(LEN_MAX,v)); if(teLen) teLen.value=String(v); drawLen(); }
  lenMinus?.addEventListener('click', ()=> stepLen(-LEN_STEP));
  lenPlus?.addEventListener('click', ()=> stepLen(+LEN_STEP));
  drawLen();

  const teElev = root.querySelector('#teElev');
  const elevLabel = root.querySelector('#elevLabel');
  const elevMinus = root.querySelector('#elevMinus');
  const elevPlus = root.querySelector('#elevPlus');
  const ELEV_STEP=1, ELEV_MIN=-500, ELEV_MAX=500;
  function parseElev(){ const v=parseInt(teElev?.value||'0',10); return isNaN(v)?0:Math.max(ELEV_MIN,Math.min(ELEV_MAX,v)); }
  function drawElev(){ if(elevLabel) elevLabel.textContent = `${parseElev()}′`; }
  function stepElev(d){ let v=parseElev()+d; v=Math.max(ELEV_MIN,Math.min(ELEV_MAX,v)); if(teElev) teElev.value=String(v); drawElev(); }
  elevMinus?.addEventListener('click', ()=> stepElev(-ELEV_STEP));
  elevPlus?.addEventListener('click', ()=> stepElev(+ELEV_STEP));
  drawElev();

  const teNoz = root.querySelector('#teNoz');
  if(teNoz && Array.isArray(NOZ_LIST)){
    teNoz.innerHTML = NOZ_LIST.map(n => {
      const label = n.name || n.desc || n.id || 'Nozzle';
      const val = n.id ?? label;
      return `<option value="${val}">${label}</option>`;
    }).join('');
  }

  if(!root.__plusMenuStyles){
    const s=document.createElement('style');
    s.textContent = `.te-row{display:grid;grid-template-columns:120px 1fr;gap:8px;align-items:center;margin:8px 0}
.steppers{display:flex;align-items:center;gap:8px;background:#0b1a29;border:1px solid var(--edge);border-radius:10px;padding:6px}
.stepBtn{background:#0b1320;border:1px solid var(--edge);border-radius:10px;color:#e9f1ff;font-weight:700;min-width:36px;height:36px}
.stepBtn:active{transform:translateY(1px)}
.stepVal{flex:1;text-align:center;font-weight:700}
@media (max-width:480px){.te-row{grid-template-columns:100px 1fr}.stepBtn{min-width:34px;height:34px}}`;
    root.appendChild(s);
    root.__plusMenuStyles = true;
  }
}


// Branch plus-menus for Wye
function initBranchPlusMenus(root){
  const LEN_STEP=50, LEN_MIN=0, LEN_MAX=3000;
  const ELEV_STEP=10, ELEV_MIN=-500, ELEV_MAX=500;

  function makeLen(elHidden, elLabel, minusBtn, plusBtn){
    function parse(){ return Math.max(LEN_MIN, Math.min(LEN_MAX, parseInt(elHidden?.value||'50',10)||50)); }
    function draw(){ if(elLabel) elLabel.textContent = `${parse()}′`; }
    function step(d){ let v = parse() + d; v = Math.max(LEN_MIN, Math.min(LEN_MAX, v)); if(elHidden) elHidden.value = String(v); draw(); }
    minusBtn?.addEventListener('click', ()=> step(-LEN_STEP));
    plusBtn?.addEventListener('click', ()=> step(+LEN_STEP));
    draw();
  }

  function makeElev(elHidden, elLabel, minusBtn, plusBtn){
    function parse(){ const v = parseInt(elHidden?.value||'0',10); return isNaN(v)?0:Math.max(ELEV_MIN, Math.min(ELEV_MAX, v)); }
    function draw(){ if(elLabel) elLabel.textContent = `${parse()}′`; }
    function step(d){ let v = parse() + d; v = Math.max(ELEV_MIN, Math.min(ELEV_MAX, v)); if(elHidden) elHidden.value = String(v); draw(); }
    minusBtn?.addEventListener('click', ()=> step(-ELEV_STEP));
    plusBtn?.addEventListener('click', ()=> step(+ELEV_STEP));
    draw();
  }

  function fillNozzles(sel){
    try{
      if(!sel || !Array.isArray(NOZ_LIST)) return;
    }catch(e){}
    if(!sel) return;
    sel.innerHTML = NOZ_LIST.map(n=>{
      const label = n.name || n.desc || n.id || 'Nozzle';
      const val = n.id ?? label;
      return `<option value="${val}">${label}</option>`;
    }).join('');
  }

  // Branch A
  makeLen(
    root.querySelector('#teLenA'),
    root.querySelector('#lenALabel'),
    root.querySelector('#lenAMinus'),
    root.querySelector('#lenAPlus')
  );
  makeElev(
    root.querySelector('#teElevA'),
    root.querySelector('#elevALabel'),
    root.querySelector('#elevAMinus'),
    root.querySelector('#elevAPlus')
  );
  fillNozzles(root.querySelector('#teNozA'));

  // Branch B
  makeLen(
    root.querySelector('#teLenB'),
    root.querySelector('#lenBLabel'),
    root.querySelector('#lenBMinus'),
    root.querySelector('#lenBPlus')
  );
  makeElev(
    root.querySelector('#teElevB'),
    root.querySelector('#elevBLabel'),
    root.querySelector('#elevBMinus'),
    root.querySelector('#elevBPlus')
  );
  fillNozzles(root.querySelector('#teNozB'));
}


/* AUTO-RESET & PRESETS-HIDE ON LOAD */
(function(){
  function safeFogId(){
    try { return (typeof findNozzleId==='function') ? findNozzleId({ gpm:185, NP:50, preferFog:true }) : null; } catch(_e){ return null; }
  }
  function resetAllDeployedLines(){
    try{
      if (!window.state || !state.lines) return;
      var id = safeFogId();
      for (var k in state.lines){
        if (!Object.prototype.hasOwnProperty.call(state.lines, k)) continue;
        var L = state.lines[k] || {};
        L.hasWye = false;
        L.elevFt = 0;
        L.itemsLeft = [];
        L.itemsRight = [];
        L.itemsMain = [{ size: '1.75', lengthFt: 200 }];
        if (id && window.NOZ){ L.nozMain = NOZ[id] || L.nozMain || { id: id }; }
        state.lines[k] = L;
      }
      if (typeof state.save === 'function') state.save();
    }catch(_e){}
  }
  function hidePresetsUI(){
    try{
      var css = document.createElement('style');
      css.setAttribute('data-auto-hide','presets');
      css.textContent = '#presetsBtn, #presetSheet, #sheetBackdrop{display:none!important;visibility:hidden!important;}';
      document.head && document.head.appendChild(css);
      var btn = document.getElementById('presetsBtn');
      if (btn){ btn.replaceWith(btn.cloneNode(true)); }
    }catch(_e){}
  }
  function init(){
    resetAllDeployedLines();
    hidePresetsUI();
    // If your app has a render() or drawAll(), trigger a first draw safely
    try{
      if (typeof render === 'function') render();
      else if (typeof drawAll === 'function') drawAll();
    }catch(_e){}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    setTimeout(init, 0);
  }
})();


    document.addEventListener('tender-trip-stopped', (ev)=>{
      try{
        const mins = ev && ev.detail && parseFloat(ev.detail.minutes);
        if (mins && mins > 0){
          const el = container.querySelector('#tTripAll');
          if (el){
            el.setAttribute('data-min', String(mins));
            el.textContent = String(mins);
          }
        }
      }catch(_){}
    });
    
(function(){
  try{
    const st = document.createElement('style');
    st.textContent = `
    .segSwitch{display:flex;gap:6px;margin:6px 0 4px}
    .segBtn{padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.2)}
    .segBtn.active{background:rgba(59,130,246,.25);border-color:rgba(59,130,246,.6)}
.pillVal{padding:2px 6px;border-radius:6px;background:rgba(255,255,255,.08);font-variant-numeric:tabular-nums}

    .segSwitch{display:flex;align-items:center;justify-content:flex-start;flex-wrap:wrap}
    .segBtn{padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);font-size:.85rem}
    .segBtn.active{background:var(--brand,rgba(59,130,246,.25));border-color:rgba(59,130,246,.6)}
    `;
    document.head.appendChild(st);
  }catch(_){}
})();




/* ==========================================================================
   Wye "+ menus" toolbar (Main / Left / Right)
   Non-destructive: operates on DOM only; no reliance on outer variables.
   Appears only when Wye = On and size = 2.5". Hides legacy segSwitch.
   ========================================================================== */
(function(){
  const SHEET_ID = 'teSheet';

  function hide(el){ if(!el) return; el.hidden = true; el.inert = true; el.style.display='none'; el.classList.add('is-hidden'); }
  function show(el){ if(!el) return; el.hidden = false; el.inert = false; el.style.display='';     el.classList.remove('is-hidden'); }

  function apply(sheet){
    try{
      const root = sheet.querySelector('.te-content') || sheet;
      // Hide existing segSwitch if present
      const segSwitch = root.querySelector('#segSwitch');
      if (segSwitch) segSwitch.style.display = 'none';

      const branchBlock = root.querySelector('#branchBlock');
      const aSect = root.querySelector('#branchASection');
      const bSect = root.querySelector('#branchBSection');
      const teWye = root.querySelector('#teWye');
      const teSize = root.querySelector('#teSize');
      const sizeMinus = root.querySelector('#sizeMinus');
      const sizePlus  = root.querySelector('#sizePlus');
      const teWhere   = root.querySelector('#teWhere');
      const wyeRow    = teWye ? teWye.closest('.te-row') : null;
      const mainRows  = ['#rowSize','#rowLen','#rowElev','#rowNoz'].map(sel=>root.querySelector(sel)).filter(Boolean);

      // Remove any prior toolbar
      root.querySelectorAll('#segPlus').forEach(n=>n.remove());

      // Build + toolbar
      const plusBar = document.createElement('div');
      plusBar.id = 'segPlus';
      plusBar.className = 'segPlus';
      plusBar.style.display = 'none'; // gated by Wye + size
      function mk(label, seg){
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'segPlusBtn';
        const i = document.createElement('span'); i.className='segPlusIcon'; i.textContent = '+';
        const t = document.createElement('span'); t.className='segPlusText'; t.textContent = label;
        b.append(i,t);
        b.dataset.seg = seg;
        return b;
      }
      const pMain  = mk('Main','main');
      const pLeft  = mk('Left','A');
      const pRight = mk('Right','B');
      plusBar.append(pMain,pLeft,pRight);

      const actions = root.querySelector('.te-actions') || root.firstElementChild;
      root.insertBefore(plusBar, actions);

      function select(seg){
        plusBar.querySelectorAll('.segPlusBtn').forEach(btn => btn.classList.toggle('active', btn.dataset.seg===seg));
        const onMain = (seg==='main');
        if (wyeRow) (onMain? show : hide)(wyeRow);
        mainRows.forEach(el => (onMain? show(el) : hide(el)));
        if (branchBlock) (onMain? hide : show)(branchBlock);
        if (aSect) (seg==='A' ? show : hide)(aSect);
        if (bSect) (seg==='B' ? show : hide)(bSect);

        // Lock branch size to 1 3/4 on branches
        if (!onMain){
          if (teSize) teSize.value = '1.75';
          const sizeLabel = root.querySelector('#sizeLabel');
          if (sizeLabel) sizeLabel.textContent = '1 3/4″';
          if (sizeMinus) sizeMinus.disabled = true;
          if (sizePlus)  sizePlus.disabled  = true;
        } else {
          if (sizeMinus) sizeMinus.disabled = false;
          if (sizePlus)  sizePlus.disabled  = false;
        }

        if (teWhere){
          teWhere.value = seg==='main' ? 'Main (to Wye)' :
                          seg==='A'    ? 'Line A (left of wye)' :
                                          'Line B (right of wye)';
        }
      }

      function gateWyeOK(){
        return teWye && teWye.value==='on' && teSize && String(teSize.value)==='2.5';
      }

      function sync(){
        const ok = gateWyeOK();
        plusBar.style.display = ok ? 'flex' : 'none';
        if (!ok){
          select('main');
        } else {
          const anyActive = plusBar.querySelector('.segPlusBtn.active');
          if (!anyActive) select('main');
        }
      }

      // Wire
      pMain.addEventListener('click', ()=> select('main'));
      pLeft.addEventListener('click', ()=> select('A'));
      pRight.addEventListener('click', ()=> select('B'));
      teWye?.addEventListener('change', sync);
      teSize?.addEventListener('change', sync);

      // Initial
      sync();
    }catch(e){
      console.warn('PLUS MENUS apply error', e);
    }
  }

  // If already open
  const sheet = document.getElementById(SHEET_ID);
  if (sheet) apply(sheet);

  // Watch for future openings
  const obs = new MutationObserver(muts=>{
    for (const m of muts){
      for (const n of m.addedNodes){
        if (n.nodeType===1 && n.id===SHEET_ID) apply(n);
      }
    }
  });
  obs.observe(document.documentElement || document.body, { childList:true, subtree:true });
})();
