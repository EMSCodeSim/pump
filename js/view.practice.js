// /js/view.practice.js
// Practice Mode (phone-friendly) with:
// - 50' multiples only (no 25' / 75')
// - New Question clears prior answer/work
// - 2½″ hose = BLUE, 1¾″ hose = RED
// - Equations box = white text on black background
// - Non-overlapping label "bubbles" at line ends
// - NOZZLE graphics drawn at line ends (and master stream junction)

import {
  COEFF,
  PSI_PER_FT,
  FL_total,
} from './store.js';

// ---------- small DOM helpers ----------
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

// ---------- constants ----------
const ns = 'http://www.w3.org/2000/svg';
const TOL = 5; // ± psi for "Check"
const TRUCK_W = 390;
const TRUCK_H = 260;
const PX_PER_50FT = 45;
const BRANCH_LIFT = 10;

// ---------- geometry helpers ----------
function truckTopY(viewH){ return viewH - TRUCK_H; }
function pumpXY(viewH){
  const top = truckTopY(viewH);
  return { x: TRUCK_W*0.515, y: top + TRUCK_H*0.74 };
}
function mainCurve(totalPx, viewH){
  const {x:sx,y:sy} = pumpXY(viewH);
  const ex = sx;
  const ey = Math.max(120, sy - totalPx);
  const cx = (sx+ex)/2;
  const cy = sy - (sy-ey)*0.48;
  return { d:`M ${sx},${sy} Q ${cx},${cy} ${ex},${ey}`, endX:ex, endY:ey };
}
function straightBranch(side, startX, startY, totalPx){
  const dir = side==='L'?-1:1;
  const x = startX + dir*20;
  const y1 = startY - BRANCH_LIFT;
  const y2 = Math.max(120, y1 - totalPx);
  return { d:`M ${startX},${startY} L ${startX},${y1} L ${x},${y1} L ${x},${y2}`, endX:x, endY:y2 };
}

// ---------- scenario generator (50' multiples only) ----------
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
      {gpm:185, NP:50, label:'185@50'},
      {gpm:150, NP:75, label:'150@75'},
      {gpm:185, NP:75, label:'185@75'}
    ];
    const noz25 = [
      {gpm:265, NP:50, label:'265@50'},
      {gpm:250, NP:75, label:'250@75'}
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

  // master stream w/ two equal 2½″ lines
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
    ms, // {gpm, NP, appliance}
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

// ---------- reveal builder ----------
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

// ---------- bubble labels (non-overlapping) ----------
const placedBoxes = [];
function overlaps(a,b){
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}
function nudge(attempt, sideBias){
  const dy = -12; // prefer upward
  const dx = ((attempt % 4) - 1.5) * 8 + sideBias; // small lateral jitter + side bias
  return { dx, dy };
}
function addBubble(G_labelsP, x, y, text, side='C'){
  const pad = 4;

  // Measure text first offscreen
  const t = document.createElementNS(ns,'text');
  t.setAttribute('x', -1000);
  t.setAttribute('y', -1000);
  t.setAttribute('text-anchor','middle');
  t.setAttribute('fill','#0b0f14');
  t.setAttribute('font-size','12');
  t.textContent = text;
  G_labelsP.appendChild(t);

  let bb = t.getBBox();
  let box = { x: x - bb.width/2 - pad, y: y - bb.height - pad, w: bb.width + pad*2, h: bb.height + pad*2 };

  const sideBias = side==='L' ? -10 : side==='R' ? 10 : 0;
  let tries = 0;
  while(placedBoxes.some(b => overlaps(b, box)) && tries < 32){
    const {dx, dy} = nudge(tries++, sideBias);
    box.x += dx;
    box.y += dy;
  }

  const r = document.createElementNS(ns,'rect');
  r.setAttribute('x', box.x);
  r.setAttribute('y', box.y);
  r.setAttribute('width', box.w);
  r.setAttribute('height', box.h);
  r.setAttribute('rx','4'); r.setAttribute('ry','4');
  r.setAttribute('fill', '#eaf2ff'); r.setAttribute('stroke', '#111'); r.setAttribute('stroke-width', '.5');

  t.setAttribute('x', box.x + box.w/2);
  t.setAttribute('y', box.y + box.h - 4 - 1);

  const g = document.createElementNS(ns,'g');
  g.appendChild(r); g.appendChild(t);
  G_labelsP.appendChild(g);

  placedBoxes.push(box);
}

// ---------- nozzle graphics ----------
// Draws a small nozzle oriented UP (no rotation math needed).
// Scales slightly by hose size; colors match hose color on the coupling.
function drawNozzle(G, x, y, hoseSize, scale = 1) {
  const group = document.createElementNS(ns, 'g');
  group.setAttribute('transform', `translate(${x},${y})`);

  // choose hose class / color
  const hoseClass = hoseSize === '2.5' ? 'hose25' : 'hose175';
  const couplingStroke = hoseSize === '2.5' ? '#3b82f6' : '#ef4444';

  // coupling (short stub where hose meets nozzle)
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

  // nozzle body (slight taper)
  const body = document.createElementNS(ns, 'polygon');
  // points relative to (0,0): draw upward
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

  // tip
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

// ---------- rendering ----------
export function render(container) {
  container.innerHTML = `
    <style>
      .practice-actions .btn { min-height: 40px; }
      .stage { min-height: 180px; display:flex; align-items:center; justify-content:center; margin-bottom: 40px; }
      .status { font-size: 14px; color: #0f172a; }
      .math { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace; font-size: 14px; line-height: 1.4; }
      .btn { padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; background: white; cursor: pointer; }
      .btn.primary { background: #0ea5e9; border-color: #0284c7; color: white; }

      /* Hose styling — 1¾″ red, 2½″ blue */
      .hoseBase { fill: none; stroke-width: 10; stroke-linecap: round; }
      .hose175 { stroke: #ef4444; } /* red */
      .hose25  { stroke: #3b82f6; } /* blue */
      .shadow  { stroke: rgba(0,0,0,.22); stroke-width: 12; }

      /* Equations box: white text on black */
      #eqBox {
        background:#0b0f14;
        color:#ffffff;
        border-radius:12px;
        padding:10px 12px;
        border:1px solid rgba(255,255,255,.15);
      }
      #eqBox code {
        background: transparent;
        color: #e6f3ff;
        padding: 0 2px;
      }

      /* NEW: ensure the SVG fills and paints cleanly before first question */
      #overlayPractice{width:100%;display:block}
    
      /* Limit the graphics card height on desktop so hose never hits site header */
      #practiceGraphicCard {
        max-height: 420px;
        overflow: hidden;
      }

      /* Extra space above the answer card so it never overlaps the truck */
      .card.practice-answer {
        margin-top: 24px;
      }
      @media (min-width: 768px){
        .card.practice-answer {
          margin-top: 48px;
        }
      }
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

    <section id="practiceGraphicCard" class="wrapper card">
      <div class="stage" id="stageP">
        <svg id="overlayPractice" width="100%" height="380" preserveAspectRatio="xMidYMax meet" aria-label="Visual stage (practice)">
          <image id="truckImgP" href="https://fireopssim.com/pump/engine181.png" x="0" y="0" width="390" height="260" preserveAspectRatio="xMidYMax meet"></image>
          <g id="hosesP"></g><g id="branchesP"></g><g id="labelsP"></g><g id="nozzlesP"></g>
        </svg>
      </div>

      <div id="eqBox" style="margin-top:6px; display:none"></div>

      <div id="practiceInfo" class="status" style="margin-top:8px">Tap <b>New Question</b> to generate a scenario.</div>
      <div id="work" class="math" style="margin-top:8px"></div>
    </section>

    <section class="card practice-answer">
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

  injectStyle(container, `
    input, select, textarea, button { font-size:16px; } /* prevent iOS zoom on iPhone */
  `);

  // refs
  const stageEl = container.querySelector('#stageP');
  const svg = container.querySelector('#overlayPractice');
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

  /* NEW: set an initial SVG size so the truck is fully visible before first question */
  {
    const initH = TRUCK_H + 20;
    svg.setAttribute('viewBox', `0 0 ${TRUCK_W} ${initH}`);
    stageEl.style.height = initH + 'px';
    truckImg.setAttribute('y', String(truckTopY(initH)));
  }

  // -------- draw --------
  function drawScenario(S){
    // clear layers
    for (const g of [G_hosesP, G_branchesP, G_labelsP, G_nozzlesP]) {
      while(g.firstChild) g.removeChild(g.firstChild);
    }
    placedBoxes.length = 0;
    workEl.innerHTML = '';

    // view size
    const baseH = TRUCK_H + 20;
    const extra = Math.max(
      S.type==='single' ? (S.mainLen/50)*PX_PER_50FT : 0,
      S.type==='wye2'   ? (Math.max(S.bnA.len, S.bnB.len)/50)*PX_PER_50FT : 0,
      S.type==='master' ? (S.line1.len/50)*PX_PER_50FT : 0
    ) + BRANCH_LIFT + 20;
    const viewH = Math.ceil(baseH + extra);

    svg.setAttribute('viewBox', `0 0 ${TRUCK_W} ${viewH}`);
    stageEl.style.height = viewH + 'px';
    truckImg.setAttribute('y', String(truckTopY(viewH)));

    if(S.type==='single' || S.type==='wye2'){
      const totalPx = (S.mainLen/50)*PX_PER_50FT;
      const geom = mainCurve(totalPx, viewH);

      // main
      const sh = document.createElementNS(ns,'path');
      sh.setAttribute('class','hoseBase shadow');
      sh.setAttribute('d', geom.d);
      G_hosesP.appendChild(sh);

      const main = document.createElementNS(ns,'path');
      main.setAttribute('class', `hoseBase ${S.mainSize==='2.5'?'hose25':'hose175'}`);
      main.setAttribute('d', geom.d);
      G_hosesP.appendChild(main);

      // nozzle for single or for the wye junction head (we’ll put nozzles on branches for wye)
      if (S.type==='single') {
        drawNozzle(G_nozzlesP, geom.endX, geom.endY, S.mainSize, S.mainSize==='2.5' ? 1.1 : 1);
      }

      if(S.type==='wye2'){
        // A
        const aPx = (S.bnA.len/50)*PX_PER_50FT;
        const aGeom = straightBranch('L', geom.endX, geom.endY, aPx);
        const aSh = document.createElementNS(ns,'path');
        aSh.setAttribute('class','hoseBase shadow');
        aSh.setAttribute('d', aGeom.d);
        G_branchesP.appendChild(aSh);
        const a = document.createElementNS(ns,'path');
        a.setAttribute('class','hoseBase hose175');
        a.setAttribute('d', aGeom.d);
        G_branchesP.appendChild(a);

        // B
        const bPx = (S.bnB.len/50)*PX_PER_50FT;
        const bGeom = straightBranch('R', geom.endX, geom.endY, bPx);
        const bSh = document.createElementNS(ns,'path');
        bSh.setAttribute('class','hoseBase shadow');
        bSh.setAttribute('d', bGeom.d);
        G_branchesP.appendChild(bSh);
        const b = document.createElementNS(ns,'path');
        b.setAttribute('class','hoseBase hose175');
        b.setAttribute('d', bGeom.d);
        G_branchesP.appendChild(b);

        // branch nozzles
        drawNozzle(G_nozzlesP, aGeom.endX, aGeom.endY, '1.75', 1);
        drawNozzle(G_nozzlesP, bGeom.endX, bGeom.endY, '1.75', 1);

        // bubbles (non-overlap)
        addBubble(G_labelsP, geom.endX, Math.max(12, geom.endY - 12), `${S.mainLen}′ ${sizeLabel(S.mainSize)}`, 'C');
        addBubble(G_labelsP, aGeom.endX, Math.max(12, aGeom.endY - 12), `A: ${S.bnA.len}′ 1¾″ — ${S.bnA.noz.gpm} gpm — NP ${S.bnA.noz.NP}${S.elevFt?` — Elev ${S.elevFt}′`:''}`, 'L');
        addBubble(G_labelsP, bGeom.endX, Math.max(12, bGeom.endY - 12), `B: ${S.bnB.len}′ 1¾″ — ${S.bnB.noz.gpm} gpm — NP ${S.bnB.noz.NP}${S.elevFt?` — Elev ${S.elevFt}′`:''}`, 'R');
      } else {
        addBubble(G_labelsP, geom.endX, Math.max(12, geom.endY - 12), `${S.mainLen}′ ${sizeLabel(S.mainSize)} — ${S.flow} gpm — NP ${S.mainNoz.NP}${S.elevFt?` — Elev ${S.elevFt}′`:''}`, 'C');
      }
      return;
    }

    // master
    const {x:sx,y:sy} = pumpXY(viewH);
    const outLeftX  = sx - 26;
    const outRightX = sx + 26;
    const outY = sy;
    const junctionY = Math.max(12, sy - (S.line1.len/50)*PX_PER_50FT);
    const junctionX = sx;

    // left
    const aPath = `M ${outLeftX},${outY} L ${outLeftX},${outY - BRANCH_LIFT} L ${outLeftX},${junctionY} L ${junctionX},${junctionY}`;
    const aSh = document.createElementNS(ns,'path');
    aSh.setAttribute('class','hoseBase shadow');
    aSh.setAttribute('d', aPath);
    G_branchesP.appendChild(aSh);
    const a = document.createElementNS(ns,'path');
    a.setAttribute('class','hoseBase hose25');
    a.setAttribute('d', aPath);
    G_branchesP.appendChild(a);

    // right
    const bPath = `M ${outRightX},${outY} L ${outRightX},${outY - BRANCH_LIFT} L ${outRightX},${junctionY} L ${junctionX},${junctionY}`;
    const bSh = document.createElementNS(ns,'path');
    bSh.setAttribute('class','hoseBase shadow');
    bSh.setAttribute('d', bPath);
    G_branchesP.appendChild(bSh);
    const b = document.createElementNS(ns,'path');
    b.setAttribute('class','hoseBase hose25');
    b.setAttribute('d', bPath);
    G_branchesP.appendChild(b);

    // nozzle at master stream junction (a bit larger)
    drawNozzle(G_nozzlesP, junctionX, junctionY, '2.5', 1.25);

    // junction bubble labels
    addBubble(G_labelsP, outLeftX - 20, Math.max(12, junctionY - 12), `Line 1: ${S.line1.len}′ 2½″`, 'L');
    addBubble(G_labelsP, outRightX + 20, Math.max(12, junctionY - 12), `Line 2: ${S.line2.len}′ 2½″`, 'R');
    addBubble(G_labelsP, junctionX, Math.max(12, junctionY - 26), `Master: ${S.ms.gpm} gpm — NP ${S.ms.NP} — App ${S.ms.appliance}${S.elevFt?` — Elev ${S.elevFt}′`:''}`, 'C');
  }

  // ---------- equations ----------
  function renderEquations(S){
    const base = `
      <div><b>Friction Loss (per section):</b> <code>FL = C × (GPM/100)² × (length/100)</code></div>
      <div style="margin-top:2px"><b>Elevation (psi):</b> <code>Elev = 0.05 × height(ft)</code></div>
      <div style="margin-top:4px"><b>C Coefficients:</b> 1¾″ = <b>${COEFF["1.75"]}</b>, 2½″ = <b>${COEFF["2.5"]}</b>, 5″ = <b>${COEFF["5"]}</b></div>
    `;
    if(!S){
      return base + `<div style="margin-top:6px">Generate a problem to see scenario-specific equations.</div>`;
    }
    if(S.type === 'single'){
      return `${base}
        <hr style="opacity:.2;margin:8px 0">
        <div><b>Single Line:</b> <code>PP = NP + MainFL ± Elev</code></div>`;
    }
    if(S.type === 'wye2'){
      return `${base}
        <hr style="opacity:.2;margin:8px 0">
        <div><b>Two-Branch Wye:</b> <code>PP = max(Need_A, Need_B) + MainFL + 10 ± Elev</code></div>`;
    }
    return `${base}
      <hr style="opacity:.2;margin:8px 0">
      <div><b>Master Stream (two equal 2½″ lines):</b> <code>PP = NP(ms) + max(FL_line) + Appliance ± Elev</code></div>`;
  }

  // ---------- interactions ----------
  function makePractice(){
    const S = generateScenario();
    scenario = S;

    if(eqVisible){
      eqBox.innerHTML = renderEquations(scenario);
      eqBox.style.display = 'block';
    }

    const rev = buildReveal(S);
    practiceAnswer = rev.total;
    drawScenario(S);
    practiceInfo.textContent = `Scenario ready — enter your PP below (±${TOL} psi).`;

    // Reset previous work/answer
    statusEl.textContent = 'Awaiting your answer…';
    workEl.innerHTML = '';
    const guessEl = container.querySelector('#ppGuess');
    if (guessEl) guessEl.value = '';
  }

  container.querySelector('#newScenarioBtn').addEventListener('click', makePractice);

  container.querySelector('#checkBtn').addEventListener('click', ()=>{
    const guess = +(container.querySelector('#ppGuess').value||0);
    if(practiceAnswer==null){ statusEl.textContent = 'Generate a problem first.'; return; }
    const diff = Math.abs(guess - practiceAnswer);
    const rev = buildReveal(scenario);
    if(diff<=TOL){
      statusEl.innerHTML = `<span class="ok">✅ Correct!</span> (Answer ${practiceAnswer} psi; Δ ${diff})`;
      workEl.innerHTML = '';
    }else{
      statusEl.innerHTML = `<span class="alert">❌ Not quite.</span> (Answer ${practiceAnswer} psi; Δ ${diff})`;
      workEl.innerHTML = rev.html;
      workEl.scrollIntoView({behavior:'smooth', block:'nearest'});
    }
  });

  container.querySelector('#revealBtn').addEventListener('click', ()=>{
    if(!scenario) return;
    const rev = buildReveal(scenario);
    workEl.innerHTML = rev.html;
    statusEl.innerHTML = `<b>Answer:</b> ${rev.total} psi`;
    workEl.scrollIntoView({behavior:'smooth', block:'nearest'});
  });

  eqToggleBtn.addEventListener('click', ()=>{
    eqVisible = !eqVisible;
    if(eqVisible){
      eqBox.innerHTML = renderEquations(scenario);
      eqBox.style.display = 'block';
      eqToggleBtn.textContent = 'Hide Equations';
    }else{
      eqBox.style.display = 'none';
      eqToggleBtn.textContent = 'Equations';
    }
  });

  // Global capture handler: on desktop some overlay may intercept clicks,
  // so we map clicks by screen position into the three header buttons.
  const globalPracticeClick = (e)=>{
    try{
      const x = e.clientX, y = e.clientY;
      const pairs = [
        [container.querySelector('#newScenarioBtn'), ()=> makePractice()],
        [eqToggleBtn, ()=> eqToggleBtn.click()],
        [container.querySelector('#revealBtn'), ()=> container.querySelector('#revealBtn').click()],
      ];
      for(const [btn, handler] of pairs){
        if(!btn) continue;
        const r = btn.getBoundingClientRect();
        if(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom){
          e.preventDefault();
          handler();
          return;
        }
      }
    }catch(_){}
  };
  window.addEventListener('click', globalPracticeClick, true);

  // external events (optional)
  const onNew = ()=> makePractice();
  const onEq  = ()=> eqToggleBtn.click();
  window.addEventListener('practice:newProblem', onNew);
  window.addEventListener('toggle:equations', onEq);

  // initial state
  practiceAnswer = null; scenario = null;

  return {
    dispose(){
      window.removeEventListener('practice:newProblem', onNew);
      window.removeEventListener('toggle:equations', onEq);
      window.removeEventListener('click', globalPracticeClick, true);
    }
  };
}

export default { render };
