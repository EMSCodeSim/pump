// calcShared.js - shared math, geometry, persistence helpers for pump calc view
import { state, NOZ, COLORS, FL, FL_total, sumFt, splitIntoSections, PSI_PER_FT, seedDefaultsForKey, isSingleWye, activeNozzle, activeSide, sizeLabel, NOZ_LIST } from './store.js';
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
        // anything between 51–99 becomes 50 + remainder
        chunk = 50;
      } else {
        chunk = len;
      }
      out.push({ size, lengthFt: chunk, cValue: (seg.cValue ?? seg.c ?? null) });
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
  if(!secs.length) return '0′';
  return secs.map(s=> (s.lengthFt||0)+'′').join(' + ');
}






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

  // Apply saved line edits (practice mode), but DO NOT let them permanently override
  // department defaults for Line 1/2/3 in Calc mode.
  if (savedState.lines && state.lines) {
    for (const k of Object.keys(state.lines)) {
      if (savedState.lines[k]) Object.assign(state.lines[k], savedState.lines[k]);
    }
  }

  // If department defaults exist, re-seed left/back/right from dept templates.
  // This prevents the 'pump.practice.v3' snapshot from freezing nozzle + only showing 1–2 lines.
  try {
    seedDefaultsForKey('left');
    seedDefaultsForKey('back');
    seedDefaultsForKey('right');
  } catch(e) {}
}





const TRUCK_W = 390;
const TRUCK_H = 260;
const PX_PER_50FT = 45;
const CURVE_PULL = 36;
const BRANCH_LIFT = 10;





function injectStyle(root, cssText){ const s=document.createElement('style'); s.textContent=cssText; root.appendChild(s); }
function clearGroup(g){ while(g.firstChild) g.removeChild(g.firstChild); }
function clsFor(size){ return size==='5'?'hose5':(size==='2.5'?'hose25':'hose175'); }
function fmt(n){ return Math.round(n); }

function escapeHTML(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }



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
  // IMPORTANT: Do NOT override a nozzle that was chosen via Department Setup / presets.
  // Only seed a default if the target nozzle is currently missing.
  if (!L) return;

  const nozId = defaultNozzleIdForSize(size);

  if (where === 'main'){
    if (L.nozRight) return;
    L.nozRight = (NOZ && NOZ[nozId]) ? NOZ[nozId] : (NOZ_LIST||[]).find(n=>n && n.id===nozId) || null;
    return;
  }

  if (where === 'L'){
    if (L.nozLeft) return;
    L.nozLeft  = (NOZ && NOZ[nozId]) ? NOZ[nozId] : (NOZ_LIST||[]).find(n=>n && n.id===nozId) || null;
    return;
  }

  if (L.nozRight) return;
  L.nozRight = (NOZ && NOZ[nozId]) ? NOZ[nozId] : (NOZ_LIST||[]).find(n=>n && n.id===nozId) || null;
}

// Special helper: Branch B defaults to Fog 185 @ 50 (always when this helper is called)
function setBranchBDefaultIfEmpty(L){
  // Only seed if Branch B nozzle is empty (never override Dept Setup / presets)
  if(!L) return;
  if (L.nozRight) return;
  try{
    const id = typeof findNozzleId==='function'
      ? findNozzleId({gpm:185, NP:50, preferFog:true})
      : null;
    if(id && NOZ && NOZ[id]){
      L.nozRight = NOZ[id];
      return;
    }
    const fallback = (NOZ_LIST||[]).find(n=>Number(n.gpm)===185 && Number(n.NP)===50);
    if(fallback) L.nozRight = fallback;
  }catch(_){}
}





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
  const pad = 6;
  const t = document.createElementNS(ns,'text');
  t.setAttribute('class','lbl'); t.setAttribute('x', x); t.setAttribute('y', y+dy); t.setAttribute('text-anchor','middle'); t.textContent = text;
  g.appendChild(t); G_labels.appendChild(g);

  // Build background + then nudge to avoid running off-screen or overlapping.
  const bg = document.createElementNS(ns,'rect');
  bg.setAttribute('class','lblbg');
  bg.setAttribute('fill', '#eaf2ff');
  bg.setAttribute('opacity', '0.94');
  bg.setAttribute('stroke', '#111');
  bg.setAttribute('stroke-width', '.6');
  bg.setAttribute('rx','6');
  bg.setAttribute('ry','6');
  g.insertBefore(bg, t);

  const svg = G_labels?.ownerSVGElement || null;
  const viewW = (svg?.viewBox?.baseVal?.width) || (typeof TRUCK_W !== 'undefined' ? TRUCK_W : 380);
  const viewH = (svg?.viewBox?.baseVal?.height) || 9999;

  function rectFromText(){
    const bb = t.getBBox();
    return {
      x: bb.x - pad,
      y: bb.y - pad,
      w: bb.width + pad*2,
      h: bb.height + pad*2,
    };
  }

  function setBg(r){
    bg.setAttribute('x', r.x);
    bg.setAttribute('y', r.y);
    bg.setAttribute('width', r.w);
    bg.setAttribute('height', r.h);
  }

  // First pass size
  let r = rectFromText();

  // Clamp horizontally into viewBox
  const margin = 2;
  if (r.x < margin) {
    const shift = margin - r.x;
    t.setAttribute('x', Number(t.getAttribute('x')) + shift);
    r = rectFromText();
  }
  if (r.x + r.w > viewW - margin) {
    const shift = (viewW - margin) - (r.x + r.w);
    t.setAttribute('x', Number(t.getAttribute('x')) + shift);
    r = rectFromText();
  }

  // Prevent overlap with existing label bubbles (simple stacking).
  // We look at existing rects inside this same labels group.
  const existing = Array.from(G_labels.querySelectorAll('rect.lblbg'));
  let safety = 0;
  while (safety++ < 10) {
    let collided = false;
    for (const other of existing) {
      // Skip our own bg (not yet in DOM when querying, but be safe)
      if (other === bg) continue;
      const ob = other.getBBox();
      const ox = ob.x, oy = ob.y, ow = ob.width, oh = ob.height;
      const intersects = !(r.x + r.w < ox || r.x > ox + ow || r.y + r.h < oy || r.y > oy + oh);
      if (intersects) {
        // Move this label down just below the other.
        const delta = (oy + oh + 4) - r.y;
        t.setAttribute('y', Number(t.getAttribute('y')) + delta);
        r = rectFromText();
        collided = true;
      }
    }
    if (!collided) break;
  }

  // Clamp vertically (keep on screen; prefer staying within the viewBox)
  if (r.y < margin) {
    const shift = margin - r.y;
    t.setAttribute('y', Number(t.getAttribute('y')) + shift);
    r = rectFromText();
  }
  if (viewH !== 9999 && r.y + r.h > viewH - margin) {
    const shift = (viewH - margin) - (r.y + r.h);
    t.setAttribute('y', Number(t.getAttribute('y')) + shift);
    r = rectFromText();
  }

  setBg(r);
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

  // Removed black shadow path; draw only colored hose segments
  const total = basePath.getTotalLength();
  let offset = 0;
  const totalPx = (sumFt(segs) / 50) * PX_PER_50FT || 1;

  segs.forEach(seg => {
    const px = (seg.lengthFt / 50) * PX_PER_50FT;
    const portion = Math.min(total, (px / totalPx) * total);

    const p = document.createElementNS(ns,'path');
    p.setAttribute('class', 'hoseBase ' + clsFor(seg.size));
    p.setAttribute('d', basePath.getAttribute('d'));
    p.setAttribute('stroke-dasharray', portion + ' ' + total);
    p.setAttribute('stroke-dashoffset', -offset);
    group.appendChild(p);

    offset += portion;
  });
}




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





function ppExplainHTML(L){
  const single = isSingleWye(L);
  const side = activeSide(L);
  const flow = single ? (activeNozzle(L)?.gpm||0)
             : L.hasWye ? (L.nozLeft?.gpm||0)+(L.nozRight?.gpm||0)
                        : (L.nozRight?.gpm||0);
  const mainSecs = sectionsFor(L.itemsMain);
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
    const bnSecs = sectionsFor(bnSegs);
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
    const aSecs = sectionsFor(L.itemsLeft);
    const bSecs = sectionsFor(L.itemsRight);
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
