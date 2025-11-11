// /js/view.practice.js
// Practice Mode (phone-friendly) with:
// - 50' multiples only (no 25'/75')
// - New Question clears prior answer/work
// - 1¾″ hose = RED, 2½″ hose = BLUE
// - Equations box = white text on black background
// - Non-overlapping label "bubbles" at line ends (constant readable size)
// - NOZZLE graphics drawn at line ends (and at master stream head)
// - Black-bar fix: SVG initializes with proper viewBox/size before first draw
//
// Requires: ./store.js (COEFF, PSI_PER_FT, FL_total)

import { COEFF, PSI_PER_FT, FL_total } from './store.js';

/* ========================= Small DOM helpers ========================= */

function injectStyle(root, cssText) {
  const s = document.createElement('style');
  s.textContent = cssText;
  root.appendChild(s);
}
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function weightedPick(weightedArray){
  const total = weightedArray.reduce((a,x)=>a+x.w,0);
  let r = Math.random()*total;
  for(const x of weightedArray){ if((r-=x.w)<=0) return x.v; }
  return weightedArray[weightedArray.length-1].v;
}
const sizeLabel = (sz) => sz==='2.5' ? '2½″' : (sz==='1.75' ? '1¾″' : `${sz}″`);

/* ========================= Constants & geometry ========================= */

const ns = 'http://www.w3.org/2000/svg';
const TOL = 5; // ± psi for Check
const TRUCK_W = 390;
const TRUCK_H = 260;
const PX_PER_50FT = 45;
const BRANCH_LIFT = 10;

function truckTopY(viewH){ return Math.max(0, viewH - TRUCK_H); }
function pumpXY(viewH){
  const top = truckTopY(viewH);
  return { x: TRUCK_W*0.515, y: top + TRUCK_H*0.74 };
}
function mainCurve(totalPx, viewH){
  // Always start at pump (fixes "hose not starting at firetruck")
  const {x:sx,y:sy} = pumpXY(viewH);
  const ex = sx;
  const ey = Math.max(10, sy - totalPx);
  const cx = (sx+ex)/2;
  const cy = sy - (sy-ey)*0.48;
  return { d:`M ${sx},${sy} Q ${cx},${cy} ${ex},${ey}`, endX:ex, endY:ey };
}
function straightBranch(side, startX, startY, totalPx){
  const dir = side==='L'?-1:1;
  const x = startX + dir*20;
  const y1 = startY - BRANCH_LIFT;
  const y2 = Math.max(8, y1 - totalPx);
  return { d:`M ${startX},${startY} L ${startX},${y1} L ${x},${y1} L ${x},${y2}`, endX:x, endY:y2 };
}

/* ========================= Scenario generator (50' only) ========================= */

function makeScenario(){
  const kind = weightedPick([
    { v:'single', w:45 },
    { v:'wye2',   w:25 },
    { v:'master', w:30 }
  ]);

  if(kind==='single'){
    const mainSize = weightedPick([{v:'1.75',w:70},{v:'2.5',w:30}]);
    const mainLen  = weightedPick([{v:150,w:25},{v:200,w:50},{v:250,w:20},{v:300,w:5}]);
    const elevFt   = weightedPick([{v:0,w:30},{v:10,w:30},{v:20,w:25},{v:30,w:10},{v:40,w:5}]);
    const noz175 = [
      {gpm:185, NP:50, label:'185@50 (Fog)'},
      {gpm:150, NP:75, label:'150@75 (Fog)'},
      {gpm:185, NP:75, label:'185@75 (Fog)'}
    ];
    const noz25 = [
      {gpm:265, NP:50, label:'265@50 (Fog)'},
      {gpm:250, NP:75, label:'250@75 (Fog)'}
    ];
    const mainNoz = mainSize==='2.5' ? pick(noz25) : pick(noz175);
    const flow = mainNoz.gpm;
    const mainFL = FL_total(flow, [{size:mainSize, lengthFt:mainLen}]);
    const PDP = Math.round(mainNoz.NP + mainFL + elevFt*PSI_PER_FT);
    return { type:'single', mainSize, mainLen, elevFt, mainNoz, flow, PDP };
  }

  if(kind==='wye2'){
    const mainSize = weightedPick([{v:'1.75',w:70},{v:'2.5',w:30}]);
    const mainLen  = weightedPick([{v:150,w:25},{v:200,w:50},{v:250,w:20},{v:300,w:5}]);
    const elevFt   = weightedPick([{v:0,w:30},{v:10,w:30},{v:20,w:25},{v:30,w:10},{v:40,w:5}]);
    const wyeLoss = 10;

    const nozChoices = [
      {gpm:150, NP:75, label:'150@75'},
      {gpm:185, NP:50, label:'185@50'},
      {gpm:185, NP:75, label:'185@75'}
    ];
    const lenChoices = [50,100,150];

    const bnA = { len: pick(lenChoices), noz: pick(nozChoices) };
    const bnB = { len: pick(lenChoices), noz: pick(nozChoices) };

    const flow = bnA.noz.gpm + bnB.noz.gpm;
    const mainFL = FL_total(flow, [{size:mainSize, lengthFt:mainLen}]);

    const needA = bnA.noz.NP + FL_total(bnA.noz.gpm, [{size:'1.75', lengthFt:bnA.len}]);
    const needB = bnB.noz.NP + FL_total(bnB.noz.gpm, [{size:'1.75', lengthFt:bnB.len}]);
    const PDP = Math.round(Math.max(needA,needB) + mainFL + wyeLoss + elevFt*PSI_PER_FT);

    return { type:'wye2', mainSize, mainLen, elevFt, wyeLoss, bnA, bnB, flow, PDP };
  }

  // master stream (two equal 2½″ lines)
  const elevFt = weightedPick([{v:0,w:30},{v:10,w:30},{v:20,w:25},{v:30,w:10},{v:40,w:5}]);
  const ms = pick([
    { gpm: 500, NP: 80, appliance: 25 },
    { gpm: 750, NP: 80, appliance: 25 },
    { gpm: 1000, NP: 80, appliance: 25 }
  ]);
  const totalGPM = ms.gpm;
  const perLine = totalGPM/2;
  const lenChoices = [100,150,200,250,300];
  const L = pick(lenChoices);
  const flPer = FL_total(perLine, [{size:'2.5', lengthFt:L}]);
  const PDP = Math.round(ms.NP + flPer + ms.appliance + elevFt*PSI_PER_FT);

  return {
    type:'master',
    elevFt,
    ms,
    line1: { len: L, gpm: perLine },
    line2: { len: L, gpm: perLine },
    PDP
  };
}

function generateScenario(){
  let S;
  for(let i=0;i<18;i++){
    S = makeScenario();
    if(S.PDP <= 270) return S;
  }
  return S;
}

/* ========================= Reveal builder ========================= */

function flSteps(gpm, size, lenFt, label){
  const C = COEFF[size];
  const per100 = C * Math.pow(gpm/100, 2);
  const flLen = per100 * (lenFt/100);
  return {
    text1: `${label} FL = C × (GPM/100)² × (length/100)`,
    text2: `= ${C} × (${gpm}/100)² × (${lenFt}/100)`,
    value: Math.round(flLen)
  };
}
function buildReveal(S){
  const E = (S.elevFt||0) * PSI_PER_FT;
  if(S.type==='single'){
    const mFL = flSteps(S.flow, S.mainSize, S.mainLen, 'Main');
    const total = S.mainNoz.NP + mFL.value + E;
    return {
      total: Math.round(total),
      html: `
        <div><b>PP Breakdown (Single line)</b></div>
        <ul class="simpleList">
          <li>Nozzle Pressure = <b>${S.mainNoz.NP} psi</b></li>
          <li>${mFL.text1}</li>
          <li>${mFL.text2} → <b>${mFL.value} psi</b></li>
          <li>Elevation = ${E>=0?'+':''}${Math.round(E)} psi</li>
        </ul>
        <div><b>PP = ${S.mainNoz.NP} + ${mFL.value} ${E>=0?'+':''}${Math.round(E)} = <span class="ok">${Math.round(total)} psi</span></b></div>
      `
    };
  }
  if(S.type==='wye2'){
    const flow = S.bnA.noz.gpm + S.bnB.noz.gpm;
    const mainFL = flSteps(flow, S.mainSize, S.mainLen, 'Main');
    const aFL = flSteps(S.bnA.noz.gpm, '1.75', S.bnA.len, 'Branch A');
    const bFL = flSteps(S.bnB.noz.gpm, '1.75', S.bnB.len, 'Branch B');
    const needA = S.bnA.noz.NP + aFL.value;
    const needB = S.bnB.noz.NP + bFL.value;
    const higher = Math.max(needA, needB);
    const total = higher + mainFL.value + 10 + E;
    return {
      total: Math.round(total),
      html: `
        <div><b>PP Breakdown (Two-branch wye)</b></div>
        <ul class="simpleList">
          <li>Branch A need = NP ${S.bnA.noz.NP} + FL_A = <b>${Math.round(needA)} psi</b></li>
          <li>  • ${aFL.text1}</li>
          <li>  • ${aFL.text2} → <b>${aFL.value} psi</b></li>
          <li>Branch B need = NP ${S.bnB.noz.NP} + FL_B = <b>${Math.round(needB)} psi</b></li>
          <li>  • ${bFL.text1}</li>
          <li>  • ${bFL.text2} → <b>${bFL.value} psi</b></li>
          <li>Take higher branch = <b>${Math.round(higher)} psi</b></li>
          <li>${mainFL.text1}</li>
          <li>${mainFL.text2} → <b>${mainFL.value} psi</b></li>
          <li>Wye loss = +<b>10 psi</b></li>
          <li>Elevation = ${E>=0?'+':''}${Math.round(E)} psi</li>
        </ul>
        <div><b>PP = ${Math.round(higher)} + ${mainFL.value} + 10 ${E>=0?'+':''}${Math.round(E)} = <span class="ok">${Math.round(total)} psi</span></b></div>
      `
    };
  }
  // master
  const totalGPM = S.ms.gpm;
  const perLine = totalGPM/2;
  const a = flSteps(perLine, '2.5', S.line1.len, 'Line 1');
  const b = flSteps(perLine, '2.5', S.line2.len, 'Line 2');
  const worst = Math.max(a.value, b.value);
  const total = S.ms.NP + worst + S.ms.appliance + E;
  return {
    total: Math.round(total),
    html: `
      <div><b>PP Breakdown (Master stream; two equal 2½″ lines)</b></div>
      <ul class="simpleList">
        <li>Total GPM = <b>${totalGPM} gpm</b> → per-line = <b>${perLine} gpm</b></li>
        <li>Master NP = <b>${S.ms.NP} psi</b></li>
        <li>Appliance loss = <b>${S.ms.appliance} psi</b></li>
        <li>${a.text1}</li>
        <li>${a.text2} → <b>${a.value} psi</b></li>
        <li>${b.text1}</li>
        <li>${b.text2} → <b>${b.value} psi</b></li>
        <li>Take higher line FL = <b>${Math.round(worst)} psi</b></li>
        <li>Elevation = ${E>=0?'+':''}${Math.round(E)} psi</li>
      </ul>
      <div><b>PP = ${S.ms.NP} + ${Math.round(worst)} + ${S.ms.appliance} ${E>=0?'+':''}${Math.round(E)} = <span class="ok">${Math.round(total)} psi</span></b></div>
    `
  };
}

/* ========================= Bubbles (constant readable size) ========================= */

const placedBoxes = [];
function overlaps(a,b){
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

// Converts CSS pixels to SVG units so bubbles/text stay same on-screen size
function pxToSvg(svg, px){
  const vb = svg.viewBox.baseVal;
  const sx = (svg.clientWidth||vb.width) / (vb.width||1);
  return px / (sx||1);
}

function addBubble(svg, G_labelsP, x, y, text, side='C'){
  const padPx = 4, fontPx = 12, minWidthPx = 90, maxWidthPx = 200;
  const pad = pxToSvg(svg, padPx);
  const minW = pxToSvg(svg, minWidthPx);
  const maxW = pxToSvg(svg, maxWidthPx);
  const fontSize = pxToSvg(svg, fontPx);

  const t = document.createElementNS(ns,'text');
  t.setAttribute('x', -1000);
  t.setAttribute('y', -1000);
  t.setAttribute('text-anchor','middle');
  t.setAttribute('fill','#0b0f14');
  t.setAttribute('font-size', String(fontSize));
  t.textContent = text;
  G_labelsP.appendChild(t);

  let bb = t.getBBox();
  let boxW = Math.max(minW, Math.min(maxW, bb.width + pad*2));
  let boxH = bb.height + pad*2;

  let box = { x: x - boxW/2, y: y - boxH - pxToSvg(svg,6), w: boxW, h: boxH };
  const sideBias = side==='L' ? -pxToSvg(svg,10) : side==='R' ? pxToSvg(svg,10) : 0;
  let tries = 0;
  while(placedBoxes.some(b => overlaps(b, box)) && tries < 32){
    box.x += sideBias || ((tries%2===0?1:-1) * pxToSvg(svg,6));
    box.y -= pxToSvg(svg,10);
    tries++;
  }

  const r = document.createElementNS(ns,'rect');
  r.setAttribute('x', box.x);
  r.setAttribute('y', box.y);
  r.setAttribute('width', box.w);
  r.setAttribute('height', box.h);
  r.setAttribute('rx', pxToSvg(svg,4));
  r.setAttribute('ry', pxToSvg(svg,4));
  r.setAttribute('fill', '#eaf2ff');
  r.setAttribute('stroke', '#111');
  r.setAttribute('stroke-width', '.5');

  t.setAttribute('x', box.x + box.w/2);
  t.setAttribute('y', box.y + box.h - pad*0.8);

  const g = document.createElementNS(ns,'g');
  g.appendChild(r); g.appendChild(t);
  G_labelsP.appendChild(g);
  placedBoxes.push(box);
}

/* ========================= Nozzle graphics ========================= */

function drawNozzle(G, x, y, hoseSize, scale = 1) {
  const group = document.createElementNS(ns, 'g');
  group.setAttribute('transform', `translate(${x},${y})`);

  const couplingStroke = hoseSize === '2.5' ? '#3b82f6' : '#ef4444';

  const coupling = document.createElementNS(ns, 'rect');
  coupling.setAttribute('x', -4 * scale);
  coupling.setAttribute('y', -8 * scale);
  coupling.setAttribute('width', 8 * scale);
  coupling.setAttribute('height', 6 * scale);
  coupling.setAttribute('rx', 2 * scale);
  coupling.setAttribute('ry', 2 * scale);
  coupling.setAttribute('fill', '#f3f4f6');
  coupling.setAttribute('stroke', couplingStroke);
  coupling.setAttribute('stroke-width', 1);

  const body = document.createElementNS(ns, 'polygon');
  const pts = [
    [-3*scale, -8*scale],
    [ 3*scale, -8*scale],
    [ 5*scale, -14*scale],
    [-5*scale, -14*scale]
  ].map(p=>p.join(',')).join(' ');
  body.setAttribute('points', pts);
  body.setAttribute('fill', '#9ca3af');
  body.setAttribute('stroke', '#111');
  body.setAttribute('stroke-width', .6);

  const tip = document.createElementNS(ns, 'polygon');
  const tpts = [
    [-2*scale, -14*scale],
    [ 2*scale, -14*scale],
    [ 0,       -18*scale],
  ].map(p=>p.join(',')).join(' ');
  tip.setAttribute('points', tpts);
  tip.setAttribute('fill', '#6b7280');
  tip.setAttribute('stroke', '#111');
  tip.setAttribute('stroke-width', .6);

  group.appendChild(coupling);
  group.appendChild(body);
  group.appendChild(tip);
  G.appendChild(group);
}

/* ========================= Rendering ========================= */

export function render(container) {
  container.innerHTML = `
    <style>
      .practice-actions .btn { min-height: 40px; }
      .stage { min-height: 180px; display:flex; align-items:center; justify-content:center; }
      .status { font-size: 14px; color: #0f172a; }
      .math { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace; font-size: 14px; line-height: 1.4; }
      .btn { padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; background: white; cursor: pointer; }
      .btn.primary { background: #0ea5e9; border-color: #0284c7; color: white; }

      /* Hose styling — 1¾″ red, 2½″ blue */
      .hoseBase { fill: none; stroke-linecap: round; stroke-linejoin: round }
      .hose175 { stroke: #ef4444; stroke-width: 6; } /* red */
      .hose25  { stroke: #3b82f6; stroke-width: 9; } /* blue */
      .shadow  { stroke: rgba(0,0,0,.35); stroke-width: 12; }

      /* Equations box: white text on black */
      #eqBox {
        background:#0b0f14;
        color:#ffffff;
        border-radius:12px;
        padding:10px 12px;
        border:1px solid rgba(255,255,255,.15);
      }
      #eqBox code { background: transparent; color: #e6f3ff; padding: 0 2px; }

      /* Black-bar fix: svg is block-level and fills width */
      #overlayPractice{width:100%;display:block}
    </style>

    <section class="card">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:space-between">
        <div>
          <b>Practice Mode</b>
          <div class="sub">Use the graphic info to find Pump Pressure (PP).</div>
        </div>
        <div class="practice-actions" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" id="newScenarioBtn">New Question</button>
          <button class="btn" id="eqToggleBtn">Equations</button>
          <button class="btn" id="revealBtn">Reveal</button>
        </div>
      </div>
    </section>

    <section class="wrapper card">
      <div class="stage" id="stageP">
        <svg id="overlayPractice" preserveAspectRatio="xMidYMax meet" aria-label="Visual stage (practice)">
          <image id="truckImgP" href="https://fireopssim.com/pump/engine181.png" x="0" y="0" width="390" height="260" preserveAspectRatio="xMidYMax meet"></image>
          <g id="hosesP"></g><g id="branchesP"></g><g id="labelsP"></g><g id="nozzlesP"></g>
        </svg>
      </div>

      <div id="eqBox" style="margin-top:6px; display:none"></div>

      <div id="practiceInfo" class="status" style="margin-top:8px">Tap <b>New Question</b> to generate a scenario.</div>
      <div id="work" class="math" style="margin-top:8px"></div>
    </section>

    <section class="card">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="max-width:220px">
          <label>Your PP answer (psi)</label>
          <input type="number" id="ppGuess" placeholder="e.g., 145" inputmode="decimal" step="1" style="font-size:16px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;">
        </div>
        <div class="field" style="max-width:160px">
          <button class="btn primary" id="checkBtn" style="width:100%">Check (±${TOL})</button>
        </div>
      </div>
      <div id="practiceStatus" class="status" style="margin-top:8px">No scenario loaded.</div>
    </section>
  `;

  injectStyle(container, `input, select, textarea, button { font-size:16px; }`);

  // refs
  const stageEl = container.querySelector('#stageP');
  const svg = container.querySelector('#overlayPractice');

  // Ensure initial viewBox/size so truck is fully visible before first scenario draw (fixes black bar)
  try {
    const __initH = TRUCK_H + 20;
    const __initW = TRUCK_W;
    svg.setAttribute('viewBox', `0 0 ${__initW} ${__initH}`);
    svg.setAttribute('width', __initW);
    svg.setAttribute('height', __initH);
    svg.style.width = '100%';
    svg.style.display = 'block';
  } catch(e) {}

  const truckImg = container.querySelector('#truckImgP');
  const G_hosesP = container.querySelector('#hosesP');
  const G_branchesP = container.querySelector('#branchesP');
  const G_labelsP = container.querySelector('#labelsP');
  const G_nozzlesP = container.querySelector('#nozzlesP');

  const practiceInfo = container.querySelector('#practiceInfo');
  const statusEl = container.querySelector('#practiceStatus');
  const workEl = container.querySelector('#work');
  const eqBox = container.querySelector('#eqBox');
  const eqToggleBtn = container.querySelector('#eqToggleBtn');

  let scenario = null;
  let practiceAnswer = null;
  let eqVisible = false;

  /* --------------------- draw --------------------- */

  function clearGroups(){
    for (const g of [G_hosesP, G_branchesP, G_labelsP, G_nozzlesP]) {
      while(g.firstChild) g.removeChild(g.firstChild);
    }
    placedBoxes.length = 0;
  }

  function drawSegment(group, d, size){
    const base = document.createElementNS(ns,'path');
    base.setAttribute('d', d);
    const sh = document.createElementNS(ns,'path');
    sh.setAttribute('class','hoseBase shadow'); sh.setAttribute('d', d);
    group.appendChild(sh);
    const hose = document.createElementNS(ns,'path');
    hose.setAttribute('class', 'hoseBase ' + (size==='2.5' ? 'hose25' : 'hose175'));
    hose.setAttribute('d', d);
    group.appendChild(hose);
    return base;
  }

  function drawScenario(S){
    clearGroups();
    workEl.innerHTML = '';

    // Compute needed view height
    const baseH = TRUCK_H + 20;
    const extra = Math.max(
      S.type==='single' ? (S.mainLen/50)*PX_PER_50FT : 0,
      S.type==='wye2'   ? (Math.max(S.bnA.len, S.bnB.len)/50)*PX_PER_50FT : 0,
      S.type==='master' ? (S.line1.len/50)*PX_PER_50FT : 0
    );
    const viewH = baseH + extra + 10;
    svg.setAttribute('viewBox', `0 0 ${TRUCK_W} ${viewH}`);

    // MAIN
    if(S.type==='single' || S.type==='wye2'){
      const mainPx = (S.type==='single' ? (S.mainLen/50) : (Math.max(S.bnA.len,S.bnB.len)/50)) * PX_PER_50FT;
      const m = mainCurve(mainPx, viewH);
      drawSegment(G_hosesP, m.d, S.mainSize);

      // Label main
      addBubble(svg, G_labelsP, m.endX, m.endY, `${S.type==='single'?'Attack':'Main'} ${sizeLabel(S.mainSize)} • ${S.mainLen || Math.max(S.bnA.len,S.bnB.len)}′`, 'C');

      // Branches (if any)
      if(S.type==='wye2'){
        const bApx = (S.bnA.len/50)*PX_PER_50FT;
        const bBpx = (S.bnB.len/50)*PX_PER_50FT;
        const bA = straightBranch('L', m.endX, m.endY, bApx);
        const bB = straightBranch('R', m.endX, m.endY, bBpx);
        drawSegment(G_branchesP, bA.d, '1.75');
        drawSegment(G_branchesP, bB.d, '1.75');
        addBubble(svg, G_labelsP, bA.endX, bA.endY, `A 1¾″ • ${S.bnA.len}′ • ${S.bnA.noz.label}`, 'L');
        addBubble(svg, G_labelsP, bB.endX, bB.endY, `B 1¾″ • ${S.bnB.len}′ • ${S.bnB.noz.label}`, 'R');

        // nozzles
        drawNozzle(G_nozzlesP, bA.endX, bA.endY, '1.75', 1);
        drawNozzle(G_nozzlesP, bB.endX, bB.endY, '1.75', 1);
      } else {
        // single line nozzle
        drawNozzle(G_nozzlesP, m.endX, m.endY, S.mainSize, 1);
        addBubble(svg, G_labelsP, m.endX, m.endY, `${sizeLabel(S.mainSize)} • ${S.mainLen}′ • ${S.mainNoz.label}`, 'C');
      }
    }

    if(S.type==='master'){
      // two equal 2.5s up from pump
      const mainPx = (S.line1.len/50)*PX_PER_50FT;
      const m = mainCurve(mainPx, viewH);
      // For visualization: draw a single trunk (blue) then split visually near tip
      drawSegment(G_hosesP, m.d, '2.5');
      addBubble(svg, G_labelsP, m.endX, m.endY, `2× 2½″ • ${S.line1.len}′ • per-line ${S.line1.gpm} gpm`, 'C');
      drawNozzle(G_nozzlesP, m.endX, m.endY, '2.5', 1.1);
    }

    // Elevation bubble (if any)
    const elevPsi = (S.elevFt||0)*PSI_PER_FT;
    if (S.elevFt){
      const pump = pumpXY(viewH);
      addBubble(svg, G_labelsP, pump.x - 90, pump.y - 10, `Elevation ${S.elevFt}′ (${elevPsi>=0?'+':''}${Math.round(elevPsi)} psi)`, 'L');
    }

    // Instructions text
    if(S.type==='single'){
      practiceInfo.innerHTML = `Find PP for <b>${sizeLabel(S.mainSize)} ${S.mainLen}′</b> with nozzle <b>${S.mainNoz.label}</b>${S.elevFt?`, elevation ${S.elevFt}′`:''}.`;
    } else if(S.type==='wye2'){
      practiceInfo.innerHTML = `Wye: main ${sizeLabel(S.mainSize)} ${S.mainLen}′ feeding 1¾″ A/B (${S.bnA.len}′ ${S.bnA.noz.label}; ${S.bnB.len}′ ${S.bnB.noz.label})${S.elevFt?`, elevation ${S.elevFt}′`:''}.`;
    } else {
      practiceInfo.innerHTML = `Master stream ${S.ms.gpm} gpm (NP ${S.ms.NP}), 2× 2½″ ${S.line1.len}′, appliance ${S.ms.appliance} psi${S.elevFt?`, elevation ${S.elevFt}′`:''}.`;
    }
  }

  /* --------------------- equations/reveal/check --------------------- */

  function updateEqBox(S){
    const r = buildReveal(S);
    eqBox.innerHTML = r.html;
  }

  function onNew(){
    scenario = generateScenario();
    const r = buildReveal(scenario);
    practiceAnswer = r.total;
    statusEl.textContent = `New problem created.`;
    drawScenario(scenario);
    if (eqVisible) updateEqBox(scenario);
  }

  function onCheck(){
    if(!practiceAnswer){ statusEl.textContent = 'No scenario loaded.'; return; }
    const val = Number(container.querySelector('#ppGuess').value);
    if (!Number.isFinite(val)) { statusEl.textContent = 'Enter a number for PP.'; return; }
    const ok = Math.abs(val - practiceAnswer) <= TOL;
    statusEl.innerHTML = ok
      ? `✅ Correct! Target ${practiceAnswer} psi (±${TOL}).`
      : `❌ Not quite. Target ${practiceAnswer} psi (±${TOL}).`;
  }

  function onReveal(){
    if(!scenario) { statusEl.textContent = 'No scenario to reveal.'; return; }
    const r = buildReveal(scenario);
    workEl.innerHTML = r.html;
    statusEl.innerHTML = `Shown calculation. Target <b>${r.total} psi</b>.`;
  }

  /* --------------------- wire buttons --------------------- */

  container.querySelector('#newScenarioBtn').addEventListener('click', onNew);
  container.querySelector('#checkBtn').addEventListener('click', onCheck);
  container.querySelector('#revealBtn').addEventListener('click', onReveal);
  eqToggleBtn.addEventListener('click', ()=>{
    eqVisible = !eqVisible;
    eqBox.style.display = eqVisible ? '' : 'none';
    if (eqVisible && scenario) updateEqBox(scenario);
  });

  // First mount: ensure bubbles are visible (previous issue was missing bubbles)
  // We initialize viewBox above; user taps "New Question" to start.
}

export default { render };
