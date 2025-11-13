// /js/view.calc.js
// Stage view with popup editor support, Wye-aware UI (no main nozzle when wye),
// Branch-B default nozzle = Fog 185 @ 50, diameter-based default nozzles,
// and practice-state persistence (including tender shuttle) across view switches.
//
// Requires: ./store.js, ./waterSupply.js, and bottom-sheet-editor.js (optional; this file works without it).
import { state, NOZ, COLORS, FL, FL_total, sumFt, splitIntoSections, isSingleWye, activeNozzle, activeSide, sizeLabel, NOZ_LIST } from './store.js';
import { WaterSupplyUI } from './waterSupply.js';

/* ========================================================================== */
/*             Practice state persistence (incl. Tender Shuttle)              */
/* ========================================================================== */

const PRACTICE_SAVE_KEY = 'pump.practice.v3';

function safeClone(obj){
  return JSON.parse(JSON.stringify(obj));
}
function safeParse(json, fallback){
  try{
    return JSON.parse(json);
  }catch(_){
    return fallback;
  }
}

function loadPracticeState(){
  try{
    const raw = localStorage.getItem(PRACTICE_SAVE_KEY);
    if(!raw) return null;
    const parsed = safeParse(raw, null);
    if(!parsed) return null;
    return parsed;
  }catch(_){
    return null;
  }
}

function savePracticeState(snapshot){
  try{
    localStorage.setItem(PRACTICE_SAVE_KEY, JSON.stringify(snapshot));
  }catch(_){}
}

let __saveInterval = null;
function startAutoSave(getWaterSnapshot){
  if(__saveInterval) clearInterval(__saveInterval);
  __saveInterval = setInterval(()=>{
    try{
      const waterSnapshot = getWaterSnapshot ? getWaterSnapshot() : null;
      const snap = buildSnapshot(waterSnapshot);
      savePracticeState(snap);
    }catch(_){}
  }, 5000);
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

// Applies saved.state into live state (preserving object identity where possible)
function applySnapshot(saved){
  if(!saved || !saved.state) return;
  const src = saved.state;

  function copyLine(dst, srcL){
    Object.assign(dst, srcL);
    dst.itemsMain  = Array.isArray(srcL.itemsMain)  ? srcL.itemsMain.slice()  : [];
    dst.itemsLeft  = Array.isArray(srcL.itemsLeft)  ? srcL.itemsLeft.slice()  : [];
    dst.itemsRight = Array.isArray(srcL.itemsRight) ? srcL.itemsRight.slice() : [];
  }

  if(src.lines){
    for(const key of Object.keys(state.lines)){
      if(src.lines[key]){
        copyLine(state.lines[key], src.lines[key]);
      }
    }
  }
  if(src.hydrant){
    Object.assign(state.hydrant, src.hydrant);
  }
  if(src.tender){
    Object.assign(state.tender, src.tender);
  }
  if(typeof src.showMath === 'boolean'){
    state.showMath = src.showMath;
  }
}

/* ========================================================================== */
/*                           Stage + UI Elements                              */
/* ========================================================================== */

const SVG_NS = 'http://www.w3.org/2000/svg';

// Constants for drawing
const PX_PER_50FT = 40;
const BRANCH_LIFT = 40;
const PSI_PER_FT  = 0.434;

function clsFor(size){
  if(size>=4.5) return 'sz5';
  if(size>=2.25) return 'sz25';
  return 'sz175';
}

// Utility: create SVG element
function createSVG(tag, attrs){
  const el = document.createElementNS(SVG_NS, tag);
  for(const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

// Stage references
let stageSvg, G_hoses, G_branches, G_labels, G_tips, G_debug;

// Math panel elements
let linesTable, GPMel, PDPel;

// Hydrant / tender UI
let hydrantBtn, tenderBtn, supplySummaryEl;

// WaterSupply UI instance
let waterUI = null;

/* ========================================================================== */
/*                          Stage Geometry Helpers                            */
/* ========================================================================== */

function basePathFor(key){
  // Returns a simple path from truck to edge of canvas depending on key
  const W = 600, H = 400;
  if(key==='left'){
    return `M 300,330 L 80,330`;
  }else if(key==='back'){
    return `M 300,330 L 300,100`;
  }else if(key==='right'){
    return `M 300,330 L 520,330`;
  }
  return `M 300,330 L 520,330`;
}

function straightBranch(side, startX, startY, totalPx){
  const dir = side==='L' ? -1 : 1;
  const x = startX + dir*20;
  const y1 = startY - BRANCH_LIFT;
  const y2 = Math.max(8, y1 - totalPx);
  return {
    d:`M ${startX},${startY} L ${startX},${y1} L ${x},${y1} L ${x},${y2}`,
    endX:x,
    endY:y2
  };
}

/* ========================================================================== */
/*                          SVG Label + Tip Helpers                           */
/* ========================================================================== */

function addLabel(G_labels, text, x, y, dy=0){
  const ns='http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns,'g');
  const pad = 4;
  const t = document.createElementNS(ns,'text');
  t.setAttribute('class','lbl');
  t.setAttribute('x', x);
  t.setAttribute('y', y+dy);
  t.setAttribute('dominant-baseline','middle');
  t.setAttribute('text-anchor','middle');
  t.textContent = text;
  g.appendChild(t);
  G_labels.appendChild(g);
  const bb = t.getBBox();
  const bg = document.createElementNS(ns,'rect');
  bg.setAttribute('x', bb.x - pad);
  bg.setAttribute('y', bb.y - pad);
  bg.setAttribute('width', bb.width + pad*2);
  bg.setAttribute('height', bb.height + pad*2);
  bg.setAttribute('fill', '#eaf2ff');
  bg.setAttribute('opacity', '.5');
  bg.setAttribute('rx','4');
  bg.setAttribute('ry','4');
  g.insertBefore(bg, t);
}

function addTip(G_tips, key, where, x, y){
  const ns='http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns,'g');
  g.setAttribute('class','tip');
  g.dataset.key = key;
  g.dataset.where = where;
  const c = document.createElementNS(ns,'circle');
  c.setAttribute('cx', x);
  c.setAttribute('cy', y);
  c.setAttribute('r', 6);
  c.setAttribute('fill','#ffcc00');
  g.appendChild(c);
  G_tips.appendChild(g);
}

/* ========================================================================== */
/*                        Segmented Hose Drawing                              */
/* ========================================================================== */

function drawSegmentedPath(group, basePath, segs){
  const ns = 'http://www.w3.org/2000/svg';
  const sh = document.createElementNS(ns,'path');
  sh.setAttribute('class','hoseBase shadow');
  sh.setAttribute('d', basePath.getAttribute('d'));
  group.appendChild(sh);
  const total = basePath.getTotalLength();
  let offset = 0;
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

function breakdownText(items){
  const secs = splitIntoSections(items || []);
  if (!secs || !secs.length) return '0′';
  return secs.map(s => s.lengthFt + '′').join(' + ');
}
function FL_total_sections(flow, items){
  const secs = splitIntoSections(items || []);
  if (!secs || !secs.length || !flow) return 0;
  return secs.reduce((acc, s) => acc + FL(flow, s.size, s.lengthFt), 0);
}

/* ========================================================================== */
/*                          Stage Drawing (Main)                              */
/* ========================================================================== */

function renderStage(){
  if(!stageSvg) return;
  G_hoses.innerHTML='';
  G_branches.innerHTML='';
  G_labels.innerHTML='';
  G_tips.innerHTML='';

  ['left','back','right'].forEach(key=>{
    const L = state.lines[key];
    if(!L.visible) return;

    const baseD = basePathFor(key);
    const geom = (function(){
      const path = createSVG('path', {d: baseD});
      stageSvg.appendChild(path);
      const len = path.getTotalLength();
      const ptStart = path.getPointAtLength(0);
      const ptEnd   = path.getPointAtLength(len);
      stageSvg.removeChild(path);
      return {
        d: baseD,
        endX: ptEnd.x,
        endY: ptEnd.y,
        startX: ptStart.x,
        startY: ptStart.y
      };
    })();

    const base = document.createElementNS('http://www.w3.org/2000/svg','path');
    base.setAttribute('class','hoseBase '+clsFor(L.mainSize || 2.5));
    base.setAttribute('d', geom.d);
    G_hoses.appendChild(base);

    const mainSecs = splitIntoSections(L.itemsMain);
    drawSegmentedPath(G_hoses, base, mainSecs);
    addTip(G_tips, key,'main',geom.endX,geom.endY);

    const single = isSingleWye(L);
    const usedNoz = single ? activeNozzle(L) : L.hasWye ? null : L.nozRight;
    const flowGpm = single ? (usedNoz?.gpm||0) : (L.hasWye ? (L.nozLeft.gpm + L.nozRight.gpm) : L.nozRight.gpm);
    const npLabel = L.hasWye ? ' — via Wye' : (' — Nozzle '+(L.nozRight?.NP||0)+' psi');
    const secText = (mainSecs && mainSecs.length)
      ? mainSecs.map(s => `${s.lengthFt}′`).join(' + ')
      : `${sumFt(L.itemsMain)}′`;

    addLabel(
      G_labels,
      `${secText} @ ${flowGpm} gpm${npLabel}`,
      geom.endX,
      geom.endY-6,
      (key==='left')?-10:(key==='back')?-22:-34
    );

    if(L.hasWye){
      if(sumFt(L.itemsLeft)>0){
        const gL = straightBranch('L', geom.endX, geom.endY, (sumFt(L.itemsLeft)/50)*PX_PER_50FT);
        const pathL = document.createElementNS('http://www.w3.org/2000/svg','path');
        pathL.setAttribute('class','hoseBase '+clsFor(L.branchSize||1.75));
        pathL.setAttribute('d', gL.d);
        G_branches.appendChild(pathL);
        const leftSecs = splitIntoSections(L.itemsLeft);
        drawSegmentedPath(G_branches, pathL, leftSecs);
        addTip(G_tips, key,'L',gL.endX,gL.endY);
        const txt = leftSecs.length
          ? leftSecs.map(s=>`${s.lengthFt}′`).join(' + ')
          : `${sumFt(L.itemsLeft)}′`;
        addLabel(G_labels, txt+' @ '+(L.nozLeft.gpm||0)+' gpm', gL.endX, gL.endY-4, -4);
      }
      if(sumFt(L.itemsRight)>0){
        const gR = straightBranch('R', geom.endX, geom.endY, (sumFt(L.itemsRight)/50)*PX_PER_50FT);
        const pathR = document.createElementNS('http://www.w3.org/2000/svg','path');
        pathR.setAttribute('class','hoseBase '+clsFor(L.branchSize||1.75));
        pathR.setAttribute('d', gR.d);
        G_branches.appendChild(pathR);
        const rightSecs = splitIntoSections(L.itemsRight);
        drawSegmentedPath(G_branches, pathR, rightSecs);
        addTip(G_tips, key,'R',gR.endX,gR.endY);
        const txtR = rightSecs.length
          ? rightSecs.map(s=>`${s.lengthFt}′`).join(' + ')
          : `${sumFt(L.itemsRight)}′`;
        addLabel(G_labels, txtR+' @ '+(L.nozRight.gpm||0)+' gpm', gR.endX, gR.endY-4, -4);
      }
    }
  });
}

/* ========================================================================== */
/*                        Pressure / Flow Text Helpers                        */
/* ========================================================================== */

function fmt(x){
  if(!isFinite(x)) return '0';
  return Math.round(x);
}

function ppExplainHTML(L){
  // Build a simple HTML explanation of the pressure math for one line,
  // using segmented 50'/100' chunks for FL.
  const single = isSingleWye(L);
  const active = activeNozzle(L);
  const flow = single
    ? (active?.gpm || 0)
    : L.hasWye
      ? ((L.nozLeft?.gpm || 0) + (L.nozRight?.gpm || 0))
      : (L.nozRight?.gpm || 0);

  const mainSecs = splitIntoSections(L.itemsMain);
  const mainFLs = mainSecs.map(s => FL(flow, s.size, s.lengthFt));
  const mainParts = mainSecs.map((s,i)=>fmt(mainFLs[i])+' ('+s.lengthFt+'′ '+sizeLabel(s.size)+')');
  const mainSum = mainFLs.reduce((a,c)=>a+c,0);
  const elevPsi = (L.elevFt||0)*PSI_PER_FT;

  if(single){
    const side = activeSide(L);
    const segs = side==='L' ? L.itemsLeft : L.itemsRight;
    const bnSecs = splitIntoSections(segs);
    const bnNoz  = active;
    const bnFLs = bnSecs.map(s=>FL(bnNoz.gpm, s.size, s.lengthFt));
    const bnParts = bnSecs.map((s,i)=>fmt(bnFLs[i])+' ('+s.lengthFt+'′ '+sizeLabel(s.size)+')');
    const bnSum = bnFLs.reduce((a,c)=>a+c,0);
    const PDP = bnNoz.NP + bnSum + mainSum + elevPsi;
    return `
      <div><strong>Single-branch Wye (${side==='L'?'Branch A':'Branch B'})</strong></div>
      <div>Nozzle pressure: ${bnNoz.NP} psi</div>
      <div>Main FL: ${fmt(mainSum)} psi = ${mainParts.join(' + ')}</div>
      <div>Branch FL: ${fmt(bnSum)} psi = ${bnParts.join(' + ')}</div>
      <div>Elevation: ${fmt(elevPsi)} psi</div>
      <div><strong>PDP = ${fmt(PDP)} psi</strong></div>
    `;
  }

  if(L.hasWye){
    const lSecs = splitIntoSections(L.itemsLeft);
    const rSecs = splitIntoSections(L.itemsRight);
    const lFLs = lSecs.map(s=>FL(L.nozLeft.gpm, s.size, s.lengthFt));
    const rFLs = rSecs.map(s=>FL(L.nozRight.gpm, s.size, s.lengthFt));
    const lSum = lFLs.reduce((a,c)=>a+c,0);
    const rSum = rFLs.reduce((a,c)=>a+c,0);
    const lParts = lSecs.map((s,i)=>fmt(lFLs[i])+' ('+s.lengthFt+'′ '+sizeLabel(s.size)+')');
    const rParts = rSecs.map((s,i)=>fmt(rFLs[i])+' ('+s.lengthFt+'′ '+sizeLabel(s.size)+')');
    const needL = L.nozLeft.NP + lSum;
    const needR = L.nozRight.NP + rSum;
    const via = Math.max(needL, needR);
    const PDP = via + mainSum + (L.wyeLoss||10) + elevPsi;

    return `
      <div><strong>Wye with two operating branches</strong></div>
      <div>Main FL: ${fmt(mainSum)} psi = ${mainParts.join(' + ')}</div>
      <div>Branch A need: NP+FL = ${fmt(needL)} psi = ${L.nozLeft.NP} + ${fmt(lSum)} (${lParts.join(' + ')})</div>
      <div>Branch B need: NP+FL = ${fmt(needR)} psi = ${L.nozRight.NP} + ${fmt(rSum)} (${rParts.join(' + ')})</div>
      <div>Using higher branch need: ${fmt(via)} psi</div>
      <div>+ Wye loss: ${fmt(L.wyeLoss||10)} psi</div>
      <div>+ Elevation: ${fmt(elevPsi)} psi</div>
      <div><strong>PDP = ${fmt(PDP)} psi</strong></div>
    `;
  }

  // Single straight line, no wye
  const noz = L.nozRight || active || {};
  const PDP = noz.NP + mainSum + elevPsi;
  return `
    <div><strong>Single line (no Wye)</strong></div>
    <div>Nozzle pressure: ${noz.NP} psi</div>
    <div>FL: ${fmt(mainSum)} psi = ${mainParts.join(' + ')}</div>
    <div>Elevation: ${fmt(elevPsi)} psi</div>
    <div><strong>PDP = ${fmt(PDP)} psi</strong></div>
  `;
}

/* ========================================================================== */
/*                        Totals (GPM & PDP summary)                          */
/* ========================================================================== */

function refreshTotals(){
    const vis = Object.entries(state.lines).filter(([_k, l]) => l.visible);
    let totalGPM = 0;
    let maxPDP = -Infinity;
    let maxKey = null;

    vis.forEach(([key, L]) => {
      const single = isSingleWye(L);
      const active = activeNozzle(L);
      const flow = single
        ? (active && active.gpm) || 0
        : L.hasWye
          ? ((L.nozLeft && L.nozLeft.gpm) || 0) + ((L.nozRight && L.nozRight.gpm) || 0)
          : (L.nozRight && L.nozRight.gpm) || 0;

      const mainFL = FL_total_sections(flow, L.itemsMain || []);
      let PDP = 0;

      if (single) {
        const side = activeSide(L);
        const bnSegs = side === 'L' ? (L.itemsLeft || []) : (L.itemsRight || []);
        const bnNoz = active || {};
        const branchFL = FL_total_sections(bnNoz.gpm || 0, bnSegs);
        PDP = (bnNoz.NP || 0) + branchFL + mainFL + ((L.elevFt || 0) * PSI_PER_FT);
      } else if (L.hasWye) {
        const leftGpm  = (L.nozLeft  && L.nozLeft.gpm)  || 0;
        const rightGpm = (L.nozRight && L.nozRight.gpm) || 0;
        const lNeed = FL_total_sections(leftGpm,  L.itemsLeft  || []) + ((L.nozLeft  && L.nozLeft.NP)  || 0);
        const rNeed = FL_total_sections(rightGpm, L.itemsRight || []) + ((L.nozRight && L.nozRight.NP) || 0);
        const maxNeed = Math.max(lNeed, rNeed);
        PDP = maxNeed + mainFL + (L.wyeLoss || 10) + ((L.elevFt || 0) * PSI_PER_FT);
      } else {
        const noz = L.nozRight || {};
        PDP = (noz.NP || 0) + mainFL + ((L.elevFt || 0) * PSI_PER_FT);
      }

      totalGPM += flow;
      if (PDP > maxPDP) {
        maxPDP = PDP;
        maxKey = key;
      }
    });

    state.lastMaxKey = maxKey;

    if (!vis.length) {
      GPMel.textContent = '— gpm';
      PDPel.textContent = '— psi';
      PDPel.classList.remove('orange', 'red');
      return;
    }

    GPMel.textContent = Math.round(totalGPM) + ' gpm';
    const v = Math.round(maxPDP);
    PDPel.textContent = v + ' psi';
    PDPel.classList.remove('orange', 'red');
    if (v > 250) PDPel.classList.add('red');
    else if (v > 200) PDPel.classList.add('orange');
}

/* --------------------------- Lines math panel --------------------------- */

function renderLinesPanel(){
    const anyDeployed = Object.values(state.lines).some(l => l.visible);
    if (!anyDeployed || !state.showMath) {
      linesTable.innerHTML = '';
      linesTable.classList.add('is-hidden');
      return;
    }
    linesTable.classList.remove('is-hidden');
    linesTable.innerHTML = '';

    ['left', 'back', 'right'].forEach(key => {
      const L = state.lines[key];
      const row = document.createElement('div');
      row.className = 'lineRow';

      const mainSecs = splitIntoSections(L.itemsMain || []);
      const mainSegsLabel = mainSecs.length
        ? mainSecs.map(s => s.lengthFt + '′ ' + sizeLabel(s.size)).join(' + ')
        : 'empty';

      const single = isSingleWye(L);
      const active = activeNozzle(L);
      const flow = single
        ? (active && active.gpm) || 0
        : L.hasWye
          ? ((L.nozLeft && L.nozLeft.gpm) || 0) + ((L.nozRight && L.nozRight.gpm) || 0)
          : (L.nozRight && L.nozRight.gpm) || 0;

      const head = document.createElement('div');
      head.className = 'lineHeader';
      head.innerHTML = `
        <span class="title">${L.label}</span>
        <span class="tag">Main: ${sumFt(L.itemsMain)}′ (${mainSegsLabel})</span>
        <span class="tag">Flow: ${flow} gpm</span>
        <span class="tag">${L.visible ? 'DEPLOYED' : 'not deployed'}</span>
      `;
      row.appendChild(head);
      linesTable.appendChild(row);

      if (!L.visible) return;

      const bflow = flow;
      const wrap = document.createElement('div');

      if (L.hasWye && !single) {
        const wye = (L.wyeLoss || 10);
        const leftSecs  = splitIntoSections(L.itemsLeft  || []);
        const rightSecs = splitIntoSections(L.itemsRight || []);

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
                <div class="barTitle">Main ${breakdownText(L.itemsMain)} @ ${bflow} gpm — Wye ${wye} psi</div>
                <div class="hosebar" id="viz_main_${key}"></div>
              </div>
              <div class="barWrap">
                <div class="barTitle">Branch A ${breakdownText(L.itemsLeft)} @ ${(L.nozLeft && L.nozLeft.gpm) || 0} gpm — NP ${(L.nozLeft && L.nozLeft.NP) || 0} psi</div>
                <div class="hosebar" id="viz_L_${key}"></div>
              </div>
              <div class="barWrap">
                <div class="barTitle">Branch B ${breakdownText(L.itemsRight)} @ ${(L.nozRight && L.nozRight.gpm) || 0} gpm — NP ${(L.nozRight && L.nozRight.NP) || 0} psi</div>
                <div class="hosebar" id="viz_R_${key}"></div>
              </div>
              <div class="simpleBox" id="pp_simple_${key}"></div>
            </div>
          </details>
        `;
        linesTable.appendChild(wrap);

        drawHoseBar(
          document.getElementById('viz_main_' + key),
          mainSecs,
          bflow,
          0,
          'Main ' + breakdownText(L.itemsMain) + ' @ ' + bflow + ' gpm',
          'Wye ' + wye
        );
        drawHoseBar(
          document.getElementById('viz_L_' + key),
          leftSecs,
          (L.nozLeft && L.nozLeft.gpm) || 0,
          (L.nozLeft && L.nozLeft.NP) || 0,
          'Branch A ' + breakdownText(L.itemsLeft || [])
        );
        drawHoseBar(
          document.getElementById('viz_R_' + key),
          rightSecs,
          (L.nozRight && L.nozRight.gpm) || 0,
          (L.nozRight && L.nozRight.NP) || 0,
          'Branch B ' + breakdownText(L.itemsRight || [])
        );
        document.getElementById('pp_simple_' + key).innerHTML = ppExplainHTML(L);
      } else if (single) {
        const side = activeSide(L);
        const bnSegs = side === 'L' ? (L.itemsLeft || []) : (L.itemsRight || []);
        const branchSecs = splitIntoSections(bnSegs);
        const bnTitle = side === 'L' ? 'Branch A' : 'Branch B';
        const noz = active || {};
        const wye = (L.wyeLoss || 10);

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
                <div class="barTitle">Main ${breakdownText(L.itemsMain)} @ ${bflow} gpm — via Wye</div>
                <div class="hosebar" id="viz_main_${key}"></div>
              </div>
              <div class="barWrap">
                <div class="barTitle">${bnTitle} ${breakdownText(bnSegs)} @ ${noz.gpm || 0} gpm — NP ${noz.NP || 0} psi</div>
                <div class="hosebar" id="viz_BR_${key}"></div>
              </div>
              <div class="simpleBox" id="pp_simple_${key}"></div>
            </div>
          </details>
        `;
        linesTable.appendChild(wrap);

        drawHoseBar(
          document.getElementById('viz_main_' + key),
          mainSecs,
          bflow,
          0,
          'Main ' + breakdownText(L.itemsMain) + ' @ ' + bflow + ' gpm',
          'Wye ' + wye
        );
        drawHoseBar(
          document.getElementById('viz_BR_' + key),
          branchSecs,
          noz.gpm || 0,
          noz.NP || 0,
          bnTitle + ' ' + breakdownText(bnSegs)
        );
        document.getElementById('pp_simple_' + key).innerHTML = ppExplainHTML(L);
      } else {
        const noz = L.nozRight || {};
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
                <div class="barTitle">Main ${breakdownText(L.itemsMain)} @ ${bflow} gpm — NP ${noz.NP || 0} psi</div>
                <div class="hosebar" id="viz_main_${key}"></div>
              </div>
              <div class="simpleBox" id="pp_simple_${key}"></div>
            </div>
          </details>
        `;
        linesTable.appendChild(wrap);

        drawHoseBar(
          document.getElementById('viz_main_' + key),
          mainSecs,
          bflow,
          noz.NP || 0,
          'Main ' + breakdownText(L.itemsMain) + ' @ ' + bflow + ' gpm'
        );
        document.getElementById('pp_simple_' + key).innerHTML = ppExplainHTML(L);
      }
    });
}

/* ========================================================================== */
/*                         Hosebar Visualization                             */
/* ========================================================================== */

function drawHoseBar(container, segs, gpm, nozzleNP, label, pillOverride){
  if(!container) return;
  container.innerHTML='';
  const totalFt = sumFt(segs);
  if(!totalFt || !gpm){
    container.textContent = 'No flow';
    return;
  }
  const bar = document.createElement('div');
  bar.className = 'hosebarInner';
  container.appendChild(bar);
  segs.forEach(seg=>{
    const span = document.createElement('div');
    span.className = 'seg '+clsFor(seg.size);
    const flPsi = FL(gpm, seg.size, seg.lengthFt);
    span.textContent = seg.lengthFt+'′ • '+fmt(flPsi)+' psi';
    span.style.flex = String(seg.lengthFt);
    bar.appendChild(span);
  });
  const pill = document.createElement('div');
  pill.className = 'pill';
  pill.textContent = pillOverride || (label + ' — NP '+nozzleNP+' psi');
  container.appendChild(pill);
}

/* ------------------------ Hydrant/Tender summary ------------------------ */

  
function refreshSupplySummary(){
    const box = supplySummaryEl;
    if(!box) return;
    const h = state.hydrant;
    const t = state.tender;
    let parts = [];
    if(h.enabled){
      parts.push(`Hydrant: ${h.staticPsi}→${h.residualPsi} psi, ${h.flowGpm} gpm`);
    }
    if(t.enabled){
      const count = (t.trips||[]).length;
      parts.push(`Tender shuttle: ${count} trip${count===1?'':'s'}`);
    }
    if(!parts.length){
      box.textContent = 'Hydrant / Tender supply: none configured';
    }else{
      box.textContent = parts.join(' • ');
    }
}

/* ========================================================================== */
/*                        Hydrant / Tender editor hooks                       */
/* ========================================================================== */

function onHydrantToggle(e){
  state.hydrant.enabled = e.target.checked;
  refreshSupplySummary();
}
function onTenderToggle(e){
  state.tender.enabled = e.target.checked;
  refreshSupplySummary();
}

/* ========================================================================== */
/*                           DOM Wiring / Init                                */
/* ========================================================================== */

function initDOM(root){
  stageSvg         = root.querySelector('#stageSvg');
  G_hoses          = root.querySelector('#hoses');
  G_branches       = root.querySelector('#branches');
  G_labels         = root.querySelector('#labels');
  G_tips           = root.querySelector('#tips');
  G_debug          = root.querySelector('#debug');
  linesTable       = root.querySelector('#linesTable');
  GPMel            = root.querySelector('#totalGPM');
  PDPel            = root.querySelector('#maxPDP');
  hydrantBtn       = root.querySelector('#hydrantBtn');
  tenderBtn        = root.querySelector('#tenderBtn');
  supplySummaryEl  = root.querySelector('#supplySummary');

  if(hydrantBtn) hydrantBtn.addEventListener('click', ()=>waterUI && waterUI.showHydrant());
  if(tenderBtn)  tenderBtn.addEventListener('click', ()=>waterUI && waterUI.showTender());

  const showMathToggle = root.querySelector('#showMathToggle');
  if(showMathToggle){
    showMathToggle.checked = !!state.showMath;
    showMathToggle.addEventListener('change', e=>{
      state.showMath = e.target.checked;
      renderLinesPanel();
    });
  }

  renderStage();
  renderLinesPanel();
  refreshTotals();
  refreshSupplySummary();
}

/* ========================================================================== */
/*                       WaterSupplyUI wiring / persistence                   */
/* ========================================================================== */

function initWaterUI(root){
  const container = root.querySelector('#waterSupplyPanel');
  if(!container) return;
  waterUI = new WaterSupplyUI(container, state.hydrant, state.tender, ()=>{
    refreshSupplySummary();
  });
}

/* ========================================================================== */
/*                         Practice state bootstrapping                       */
/* ========================================================================== */

function bootFromSavedState(root){
  const saved = loadPracticeState();
  if(!saved) return;
  applySnapshot(saved);
}

/* ========================================================================== */
/*                            Module Entry Point                              */
/* ========================================================================== */

export function initCalcView(root){
  bootFromSavedState(root);
  initDOM(root);
  initWaterUI(root);
  startAutoSave(()=> waterUI ? waterUI.buildSnapshot() : null);
}

/* ========================================================================== */
/*                            Style Tweaks / CSS                              */
/* ========================================================================== */

// Inject some simple responsive + shuttle CSS tweaks.
(function(){
  try{
    const css = `
      .hosebarInner{ display:flex; gap:4px; }
      .hosebarInner .seg{ padding:4px 6px; border-radius:4px; font-size:12px; white-space:nowrap; }
      .hosebarInner .seg.sz175{ background:#ffcccc; }
      .hosebarInner .seg.sz25{ background:#cce0ff; }
      .hosebarInner .seg.sz5{ background:#e0e0e0; }
      .hosebarInner + .pill{ margin-top:4px; display:inline-block; padding:3px 6px; border-radius:999px; background:#f4f4f4; font-size:11px; }

      .lineRow{ margin-bottom:8px; }
      .lineHeader{ display:flex; flex-wrap:wrap; gap:6px; font-size:13px; align-items:center; }
      .lineHeader .title{ font-weight:600; }
      .lineHeader .tag{ padding:2px 6px; border-radius:999px; background:#eef2ff; }

      .hoseviz{ margin-top:4px; border-radius:8px; border:1px solid #dde3f0; padding:6px; background:#fafbff; }
      .hoseLegend{ font-size:11px; opacity:.8; display:flex; gap:6px; align-items:center; margin-bottom:4px; }
      .legSwatch{ width:14px; height:4px; border-radius:999px; display:inline-block; }
      .legSwatch.sw175{ background:#ff5555; }
      .legSwatch.sw25{ background:#3366ff; }
      .legSwatch.sw5{ background:#999999; }

      .pill{ font-size:11px; }

      .shuttleMeta{display:none!important}
      .gpmLine{display:none!important}
      .shuttleMeta .btn{ padding:6px 10px; font-size:12px; }
      @media (max-width:520px){
        .shuttleMeta{ width:100%; justify-content:space-between; }
        .shuttleMeta .gpmLine{ font-weight:700; }
      }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }catch(_){}
})();

/* ========================================================================== */
/*                         Bottom-sheet Editor Hook                           */
/* ========================================================================== */

(function(){
  const SHEET_ID = 'bottomSheetEditor';
  function apply(sheet){
    try{
      const container = sheet.querySelector('[data-calc-root]');
      if(!container) return;
      // Basic mobile padding + overflow tweaks if needed
      const css = `
        [data-calc-root] .wrapper{ padding:8px; }
        [data-calc-root] .stageRow{ flex-direction:column; gap:8px; }
        [data-calc-root] .stageCol{ width:100%; }
        [data-calc-root] #stageSvg{ width:100%; height:auto; }
        [data-calc-root] .mathCol{ width:100%; }
        [data-calc-root] .mathCol .card{ margin-top:8px; }
        [data-calc-root] .hoseviz{ margin-top:8px; }
      `;
      const st = document.createElement('style');
      st.textContent = css;
      sheet.appendChild(st);
    }catch(_){}
  }

  const existing = document.getElementById(SHEET_ID);
  if(existing) apply(existing);

  const obs = new MutationObserver(muts=>{
    for (const m of muts){
      for (const n of m.addedNodes){
        if (n.nodeType===1 && n.id===SHEET_ID) apply(n);
      }
    }
  });
  obs.observe(document.documentElement || document.body, { childList:true, subtree:true });
})();
