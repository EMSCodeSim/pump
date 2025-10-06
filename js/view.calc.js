// /js/view.calc.js
// Stage view with popup editor support, Wye-aware UI (no main nozzle when wye),
// Branch-B default nozzle = Fog 185 @ 50, diameter-based default nozzles,
// and practice-state persistence (including tender shuttle) across view switches.
//
// Requires: ./store.js, ./waterSupply.js, and bottom-sheet-editor.js (optional; this file works without it).

import {
  state,
  NOZ,
  NOZ_LIST,
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
  sizeLabel
} from './store.js';

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
  t.setAttribute('class','lbl'); t.setAttribute('x', x); t.setAttribute('y', y+dy); t.setAttribute('text-anchor','middle'); t.textContent = text;
  g.appendChild(t); G_labels.appendChild(g);
  const bb = t.getBBox();
  const bg = document.createElementNS(ns,'rect');
  bg.setAttribute('x', bb.x - pad); bg.setAttribute('y', bb.y - pad);
  bg.setAttribute('width', bb.width + pad*2); bg.setAttribute('height', bb.height + pad*2);
  bg.setAttribute('fill', '#eaf2ff'); bg.setAttribute('opacity', '0.92'); bg.setAttribute('stroke', '#111'); bg.setAttribute('stroke-width', '.5'); bg.setAttribute('rx','4'); bg.setAttribute('ry','4');
  g.insertBefore(bg, t);
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

            <div class="te-row" id="rowSize"><label>Diameter</label>
              <select id="teSize">
                <option value="1.75">1¾″</option>
                <option value="2.5">2½″</option>
                <option value="5">5″</option>
              </select>
            </div>

            <div class="te-row" id="rowLen"><label>Length (ft)</label>
              <input type="number" id="teLen" min="0" step="25" value="200">
            </div>

            <div class="te-row" id="rowNoz"><label>Nozzle</label>
              <select id="teNoz"></select>
            </div>

            <div class="te-row"><label>Elevation (ft)</label>
              <input type="number" id="teElev" step="5" value="0">
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

        <!-- Tender shuttle -->
        <div id="staticHelper" class="helperPanel" style="display:none; margin-top:10px; background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <div>
              <div style="color:#fff; font-weight:800;">Tender Shuttle (Static Supply)</div>
              <div class="mini" style="color:#a9bed9">Assume 10% capacity loss. Start when leaving scene; stop on return full.</div>
            </div>
            <div class="pill">Total Shuttle GPM: <span id="shuttleTotalGpm">0</span></div>
          </div>
          <div class="row" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
            <div class="field" style="min-width:160px">
              <label>Tender ID / Number</label>
              <input id="tAddId" type="text" placeholder="e.g., Tender 2">
            </div>
            <div class="field" style="min-width:160px">
              <label>Capacity (gal)</label>
              <input id="tAddCap" type="number" inputmode="decimal" placeholder="e.g., 3000">
            </div>
            <div class="field" style="min-width:140px; display:flex; align-items:flex-end">
              <button id="tAddBtn" class="btn primary" type="button">Add Tender</button>
            </div>
          </div>
          <div id="tenderList" style="margin-top:10px"></div>
        </div>

        <div class="linesTable is-hidden" id="linesTable"></div>
      </section>
    </section>

    <!-- Presets bottom sheet -->
    <div id="sheet" class="sheet" aria-modal="true" role="dialog">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="title">Presets</div>
        <button class="btn" id="sheetClose">Close</button>
      </div>
      <div class="mini" style="opacity:.85;margin-top:4px">Pick a setup, then choose line to apply.</div>

      <div class="preset-grid" id="presetGrid">
        <div class="preset" data-preset="standpipe">Standpipe</div>
        <div class="preset" data-preset="sprinkler">Sprinkler</div>
        <div class="preset" data-preset="foam">Foam</div>
        <div class="preset" data-preset="monitor">Monitor</div>
        <div class="preset" data-preset="aerial">Aerial</div>
      </div>

      <div class="mini" style="opacity:.85;margin-top:10px">Apply to:</div>
      <div class="linepick">
        <div class="preset" data-applyline="left">Line 1</div>
        <div class="preset" data-applyline="back">Line 2</div>
        <div class="preset" data-applyline="right">Line 3</div>
      </div>
      <div class="te-actions"><button class="btn primary" id="sheetApply" disabled>Apply Preset</button></div>
    </div>
    <div id="sheetBackdrop" class="sheet-backdrop"></div>
  `;

  /* ----------------------------- Styles ---------------------------------- */
  injectStyle(container, `
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
      border:1px solid rgba(255,255,255,.22); border-radius:12px;
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
  const teLenA      = container.querySelector('#teLenA');
  const teLenB      = container.querySelector('#teLenB');
  const teNoz       = container.querySelector('#teNoz');
  const teNozA      = container.querySelector('#teNozA');
  const teNozB      = container.querySelector('#teNozB');
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
      hydrantResult:   '#hydrantResult'
    }
  });

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

  /* ------------------------------- Presets -------------------------------- */

  const sheet = container.querySelector('#sheet'), sheetBackdrop = container.querySelector('#sheetBackdrop');
  let chosenPreset=null, chosenLine=null;
  function openSheet(){ sheet.classList.add('show'); sheetBackdrop.style.display='block'; }
  function closeSheet(){ sheet.classList.remove('show'); sheetBackdrop.style.display='none'; chosenPreset=null; chosenLine=null; container.querySelector('#sheetApply').disabled=true; }
  container.querySelector('#presetsBtn').addEventListener('click', openSheet);
  container.querySelector('#sheetClose').addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', closeSheet);
  container.querySelector('#presetGrid').addEventListener('click',(e)=>{
    const p = e.target.closest('.preset'); if(!p) return;
    chosenPreset = p.dataset.preset;
    container.querySelectorAll('#presetGrid .preset').forEach(x=>x.style.outline='none');
    p.style.outline = '2px solid var(--accent)';
    updateSheetApply();
  });
  container.querySelector('.linepick').addEventListener('click',(e)=>{
    const p = e.target.closest('.preset'); if(!p) return;
    chosenLine = p.dataset.applyline;
    container.querySelectorAll('.linepick .preset').forEach(x=>x.style.outline='none');
    p.style.outline = '2px solid var(--accent)';
    updateSheetApply();
  });
  function updateSheetApply(){ container.querySelector('#sheetApply').disabled = !(chosenPreset && chosenLine); }
  container.querySelector('#sheetApply').addEventListener('click', ()=>{ if(!(chosenPreset && chosenLine)) return; applyPresetTo(chosenPreset, chosenLine); closeSheet(); });

  function clearLine(L){ L.itemsMain=[]; L.itemsLeft=[]; L.itemsRight=[]; L.hasWye=false; L.elevFt=0; }
  function applyPresetTo(preset, key){
    const L = state.lines[key]; clearLine(L); L.visible = true;
    switch(preset){
      case 'standpipe':
        L.itemsMain=[{size:'2.5', lengthFt:0}]; L.hasWye=false;
        ensureDefaultNozzleFor(L,'main','2.5');
        L.elevFt=60; break;
      case 'sprinkler':
        state.supply='pressurized';
        L.itemsMain=[{size:'2.5', lengthFt:50}]; L.hasWye=false;
        ensureDefaultNozzleFor(L,'main','2.5');
        break;
      case 'foam':
        L.itemsMain=[{size:'1.75', lengthFt:200}]; L.hasWye=false; L.elevFt=0;
        ensureDefaultNozzleFor(L,'main','1.75');
        break;
      case 'monitor':
        L.itemsMain=[{size:'2.5', lengthFt:200}]; L.hasWye=false; L.elevFt=0;
        ensureDefaultNozzleFor(L,'main','2.5');
        break;
      case 'aerial':
        state.supply='pressurized';
        L.itemsMain=[{size:'2.5', lengthFt:150}]; L.hasWye=false; L.elevFt=80;
        ensureDefaultNozzleFor(L,'main','2.5');
        break;
    }
    drawAll();
    markDirty();
  }

  /* ------------------------------ Why? button ----------------------------- */

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
      if (teNoz?.value && NOZ[teNoz.value]) L.nozRight = NOZ[teNoz.value];
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
        } else addTip(G_tips, key,'L',geom.endX-20,geom.endY-20);

        if(sumFt(L.itemsRight)>0){
          const gR = straightBranch('R', geom.endX, geom.endY, (sumFt(L.itemsRight)/50)*PX_PER_50FT);
          const pathR = document.createElementNS('http://www.w3.org/2000/svg','path'); pathR.setAttribute('d', gR.d); G_branches.appendChild(pathR);
          drawSegmentedPath(G_branches, pathR, L.itemsRight);
          addTip(G_tips, key,'R',gR.endX,gR.endY);
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

  return { dispose(){
    stopAutoSave();
  }};
}

export default { render };
