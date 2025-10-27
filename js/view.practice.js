// /js/view.practice.js
// Practice page for hydraulics drills (phone-friendly).
// - Hose lengths limited to 50' multiples in practice mode (no 25' or 75').
// - New Question resets previous answer & work.
// - Safe nozzle list rendering (skips undefined keys in NOZ_LIST).
// - Bubble labels have collision-avoidance (no overlapping).
// - Exports: named `render` and default `{ render }` so routers using mod.render(app) work.

import {
  COEFF,
  PSI_PER_FT,
  FL_total,
  NOZ,
  NOZ_LIST,
  computeApplianceLoss,
} from './store.js';

// NOTE: No external UI helpers are called here.

const SIZES = ['1.75', '2.5', '5'];

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
function option(v, text) {
  const o = document.createElement('option');
  o.value = v;
  o.textContent = text ?? v;
  return o;
}
function rnd(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function round1(n){ return Math.round(n*10)/10; }
function round0(n){ return Math.round(n); }

// -----------------------------
// Problem/Math helpers
// -----------------------------
function genSeg(size, ft){ return { size, lengthFt: ft }; }

function makeWyeScenario() {
  const mainSize = '2.5';
  const branchSize = '1.75';
  const gpmEach = rnd([120, 125, 130, 140, 150, 160]);
  const totalGPM = gpmEach * 2;

  const lenChoices = [50,100,150]; // no 75'
  const branchLen = rnd(lenChoices);
  const mainLen = rnd([100, 150, 200]);

  const elevFt = rnd([ -10, 0, 10, 20 ]);
  const applianceOn = true;
  const nozzleNP = rnd([ 50, 75, 100 ]);

  const segs = [
    genSeg(mainSize, mainLen),
    genSeg(branchSize, branchLen),
    genSeg(branchSize, branchLen),
  ];

  return {
    type: 'wye2',
    mainSize, mainLen, elevFt, nozzleNP, applianceOn,
    bnA: { len: branchLen, noz: { gpm: gpmEach, NP: nozzleNP } },
    bnB: { len: branchLen, noz: { gpm: gpmEach, NP: nozzleNP } },
    flow: totalGPM,
    PDP: 0 // computed on reveal
  };
}

function makeSingleLineScenario() {
  const size = rnd(['1.75','2.5']);
  const gpm = size === '1.75'
    ? rnd([120,125,130,140,150,160,180])
    : rnd([200,250,265,300,325,350]);
  const elevFt = rnd([-10, 0, 10, 20, 30]);

  const lenChoices = [100,150,200,250,300];
  const lengthFt = rnd(lenChoices);

  const nozzleNP = rnd([50, 75, 100]);
  const applianceOn = gpm > 350;

  const segs = [ genSeg(size, lengthFt) ];
  return {
    type: 'single',
    mainSize: size,
    mainLen: lengthFt,
    elevFt,
    mainNoz: { NP: nozzleNP, gpm },
    flow: gpm,
    applianceOn,
    segs
  };
}

function makeMasterStreamScenario() {
  const elevFt = rnd([-10,0,10,20,30]);
  const ms = rnd([
    { gpm: 500, NP: 80, appliance: 25 },
    { gpm: 750, NP: 80, appliance: 25 },
    { gpm: 1000, NP: 80, appliance: 25 },
  ]);
  const lenChoices = [100,150,200,250,300];
  const L = rnd(lenChoices);
  return {
    type: 'master',
    elevFt,
    ms,
    line1: { len: L, gpm: ms.gpm/2 },
    line2: { len: L, gpm: ms.gpm/2 }
  };
}

function generateScenario() {
  const which = rnd(['wye', 'single', 'master', 'single', 'wye']);
  if (which === 'wye') return makeWyeScenario();
  if (which === 'master') return makeMasterStreamScenario();
  return makeSingleLineScenario();
}

function buildReveal(S){
  const E = (S.elevFt||0) * PSI_PER_FT;
  if(S.type==='single'){
    const mainFL = FL_total(S.flow, [{size:S.mainSize, lengthFt:S.mainLen}]);
    const total = S.mainNoz.NP + mainFL + E;
    return {
      total: Math.round(total),
      lines: [
        `Flow: ${S.flow} gpm`,
        `Friction loss: ${round1(mainFL)} psi`,
        `Elevation: ${round1(E)} psi (${S.elevFt||0} ft)`,
        `Appliance: 0 psi`,
        `Nozzle pressure: ${S.mainNoz.NP} psi`,
        `—`,
        `Pump Pressure ≈ ${Math.round(total)} psi`
      ]
    };
  }
  if(S.type==='wye2'){
    const flow = S.bnA.noz.gpm + S.bnB.noz.gpm;
    const mainFL = FL_total(flow, [{size:S.mainSize, lengthFt:S.mainLen}]);
    const needA = S.bnA.noz.NP + FL_total(S.bnA.noz.gpm, [{size:'1.75', lengthFt:S.bnA.len}]);
    const needB = S.bnB.noz.NP + FL_total(S.bnB.noz.gpm, [{size:'1.75', lengthFt:S.bnB.len}]);
    const higher = Math.max(needA, needB);
    const total = higher + mainFL + 10 + E;
    return {
      total: Math.round(total),
      lines: [
        `Flow: ${flow} gpm`,
        `Friction loss (main): ${round1(mainFL)} psi`,
        `Higher branch need: ${round1(higher)} psi`,
        `Wye loss: 10 psi`,
        `Elevation: ${round1(E)} psi (${S.elevFt||0} ft)`,
        `—`,
        `Pump Pressure ≈ ${Math.round(total)} psi`
      ]
    };
  }
  if(S.type==='master'){
    const totalGPM = S.ms.gpm;
    const per = totalGPM/2;
    const aFL = FL_total(per, [{size:'2.5', lengthFt:S.line1.len}]);
    const bFL = FL_total(per, [{size:'2.5', lengthFt:S.line2.len}]);
    const worst = Math.max(aFL,bFL);
    const total = S.ms.NP + worst + S.ms.appliance + E;
    return {
      total: Math.round(total),
      lines: [
        `Flow: ${totalGPM} gpm (per line ${per})`,
        `Friction loss (worst line): ${round1(worst)} psi`,
        `Appliance: ${S.ms.appliance} psi`,
        `Elevation: ${round1(E)} psi (${S.elevFt||0} ft)`,
        `Nozzle pressure: ${S.ms.NP} psi`,
        `—`,
        `Pump Pressure ≈ ${Math.round(total)} psi`
      ]
    };
  }
}

// -----------------------------
// Render
// -----------------------------
export function render(container) {
  container.innerHTML = `
    <style>
      .practice-actions .btn { min-height: 40px; }
      .stage { min-height: 180px; display:flex; align-items:center; justify-content:center; }
      .mini { background: #f8fafc; border-radius: 12px; padding: 8px 10px; }
      .status { font-size: 14px; color: #0f172a; }
      .math { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace; font-size: 14px; line-height: 1.4; }
      .field { display:flex; flex-direction:column; gap:6px; }
      .field input, .field select { font-size: 16px; padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; }
      .row { display:flex; gap: 12px; flex-wrap: wrap; align-items:flex-end; }
      .btn { padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; background: white; cursor: pointer; }
      .btn.primary { background: #0ea5e9; border-color: #0284c7; color: white; }
      .seg { background: #f1f5f9; border-radius: 12px; padding: 8px; }
      .seg .field label { font-size: 12px; color: #334155; }

      /* Hose drawing */
      .hoseBase { fill: none; stroke-width: 10; stroke-linecap: round; }
      .hose175 { stroke: #ef4444; }
      .hose25  { stroke: #eab308; }
      .shadow  { stroke: rgba(0,0,0,.22); stroke-width: 12; }

      .bubble-bg { fill:#eaf2ff; stroke:#111; stroke-width:.5 }
      .bubble-text { fill:#0b0f14; font-size:12px }
    </style>

    <section class="card">
      <div class="row" style="align-items:center; justify-content:space-between">
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
          <g id="hosesP"></g><g id="branchesP"></g><g id="labelsP"></g>
        </svg>
      </div>

      <div id="eqBox" class="mini" style="margin-top:6px;opacity:.95; display:none"></div>

      <div id="practiceInfo" class="status" style="margin-top:8px">Tap <b>New Question</b> to generate a scenario.</div>
      <div id="work" class="math" style="margin-top:8px"></div>
    </section>

    <section class="card">
      <div class="row" style="align-items:flex-end">
        <div class="field" style="max-width:220px">
          <label>Your PP answer (psi)</label>
          <input type="number" id="ppGuess" placeholder="e.g., 145" inputmode="decimal" step="1">
        </div>
        <div class="field" style="max-width:160px">
          <button class="btn primary" id="checkBtn" style="width:160px">Check</button>
        </div>
        <div class="field" style="max-width:160px">
          <button class="btn" id="showBuildBtn" style="width:160px">Show Build</button>
        </div>
        <div class="field">
          <div id="status" class="status">Awaiting your answer…</div>
        </div>
      </div>
    </section>
  `;

  // Minimal, safe styling helper (no root.querySelectorAll usage)
  injectStyle(container, `
    input, select, textarea, button { font-size:16px; } /* prevent iOS zoom */
  `);

  // DOM refs
  const stageEl = container.querySelector('#stageP');
  const svg = container.querySelector('#overlayPractice');
  const truckImg = container.querySelector('#truckImgP');
  const G_hosesP = container.querySelector('#hosesP');
  const G_branchesP = container.querySelector('#branchesP');
  const G_labelsP = container.querySelector('#labelsP');
  const practiceInfo = container.querySelector('#practiceInfo');
  const workEl = container.querySelector('#work');
  const statusEl = container.querySelector('#status');
  const eqBox = container.querySelector('#eqBox');
  const eqToggleBtn = container.querySelector('#eqToggleBtn');

  const ns = 'http://www.w3.org/2000/svg';
  let practiceAnswer = null;
  let scenario = null;
  let eqVisible = false;

  // geometry helpers
  const TRUCK_W = 390;
  const TRUCK_H = 260;
  const PX_PER_50FT = 45;
  const BRANCH_LIFT = 10;

  function truckTopY(viewH){ return viewH - TRUCK_H; }
  function pumpXY(viewH){
    const top = truckTopY(viewH);
    return { x: TRUCK_W*0.515, y: top + TRUCK_H*0.74 };
  }
  function mainCurve(totalPx, viewH){
    const {x:sx,y:sy} = pumpXY(viewH);
    const ex = sx;
    const ey = Math.max(10, sy - totalPx);
    const cx = (sx+ex)/2;
    const cy = sy - (sy-ey)*0.48;
    return { d:`M ${sx},${sy} Q ${cx},${cy} ${ex},${ey}`, endX:ex, endY:ey };
  }
  function straightBranch(side, startX, startY, totalPx){
    const dir = side==='L'?-1:1, x = startX + dir*20, y1 = startY - BRANCH_LIFT, y2 = Math.max(8, y1 - totalPx);
    return { d:`M ${startX},${startY} L ${startX},${y1} L ${x},${y1} L ${x},${y2}`, endX:x, endY:y2 };
  }

  // -----------------------------
  // Bubble label collision-avoidance
  // -----------------------------
  const placedBoxes = [];
  function overlaps(a,b){
    return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  }
  function offsetForAttempt(n){
    // Stagger slightly left/right every couple of attempts
    const dx = ((n % 4) - 1.5) * 8; // -12, -4, 4, 12...
    const dy = -12;                // nudge upward each iteration
    return { dx, dy };
  }
  function addLabel(x, y, text, side='C'){
    const pad = 4;

    // Create text offscreen first to measure
    const t = document.createElementNS(ns,'text');
    t.setAttribute('x', -1000);
    t.setAttribute('y', -1000);
    t.setAttribute('class','bubble-text');
    t.setAttribute('text-anchor','middle');
    t.textContent = text;
    G_labelsP.appendChild(t);

    let bb = t.getBBox();
    let box = { x: x - bb.width/2 - pad, y: y - bb.height - pad, w: bb.width + pad*2, h: bb.height + pad*2 };
    let tries = 0;

    // Try to find a non-overlapping position
    while(placedBoxes.some(b => overlaps(b, box)) && tries < 24){
      const {dx, dy} = offsetForAttempt(tries++);
      // prefer shifting left for left branch, right for right branch
      const bias = side==='L' ? -10 : side==='R' ? 10 : 0;
      box.x += dx + bias;
      box.y += dy;
    }

    // Apply final position
    const r = document.createElementNS(ns,'rect');
    r.setAttribute('x', box.x);
    r.setAttribute('y', box.y);
    r.setAttribute('width', box.w);
    r.setAttribute('height', box.h);
    r.setAttribute('rx','4'); r.setAttribute('ry','4');
    r.setAttribute('class','bubble-bg');

    t.setAttribute('x', box.x + box.w/2);
    t.setAttribute('y', box.y + box.h - pad - 1);

    G_labelsP.appendChild(r);
    G_labelsP.appendChild(t);
    placedBoxes.push(box);
  }

  // draw
  function drawScenario(S){
    while(G_hosesP.firstChild) G_hosesP.removeChild(G_hosesP.firstChild);
    while(G_branchesP.firstChild) G_branchesP.removeChild(G_branchesP.firstChild);
    while(G_labelsP.firstChild) G_labelsP.removeChild(G_labelsP.firstChild);
    placedBoxes.length = 0;
    workEl.innerHTML = '';

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
      const sh = document.createElementNS(ns,'path'); sh.setAttribute('class','hoseBase shadow'); sh.setAttribute('d', geom.d); G_hosesP.appendChild(sh);
      const main = document.createElementNS(ns,'path'); main.setAttribute('class', `hoseBase ${S.mainSize==='2.5'?'hose25':'hose175'}`); main.setAttribute('d', geom.d); G_hosesP.appendChild(main);

      if(S.type==='wye2'){
        const aPx = (S.bnA.len/50)*PX_PER_50FT;
        const aGeom = straightBranch('L', geom.endX, geom.endY, aPx);
        const aSh = document.createElementNS(ns,'path'); aSh.setAttribute('class','hoseBase shadow'); aSh.setAttribute('d', aGeom.d); G_branchesP.appendChild(aSh);
        const a = document.createElementNS(ns,'path'); a.setAttribute('class','hoseBase hose175'); a.setAttribute('d', aGeom.d); G_branchesP.appendChild(a);

        const bPx = (S.bnB.len/50)*PX_PER_50FT;
        const bGeom = straightBranch('R', geom.endX, geom.endY, bPx);
        const bSh = document.createElementNS(ns,'path'); bSh.setAttribute('class','hoseBase shadow'); bSh.setAttribute('d', bGeom.d); G_branchesP.appendChild(bSh);
        const b = document.createElementNS(ns,'path'); b.setAttribute('class','hoseBase hose175'); b.setAttribute('d', bGeom.d); G_branchesP.appendChild(b);

        // Labels with collision-avoidance (side-biased)
        addLabel(geom.endX, Math.max(12, geom.endY - 12), `${S.mainLen}′ ${S.mainSize==='2.5'?'2½″':'1¾″'}`, 'C');
        addLabel(aGeom.endX, Math.max(12, aGeom.endY - 12), `A: ${S.bnA.len}′ 1¾″ — ${S.bnA.noz.gpm} gpm — NP ${S.bnA.noz.NP}${S.elevFt?` — Elev ${S.elevFt}′`:''}`, 'L');
        addLabel(bGeom.endX, Math.max(12, bGeom.endY - 12), `B: ${S.bnB.len}′ 1¾″ — ${S.bnB.noz.gpm} gpm — NP ${S.bnB.noz.NP}${S.elevFt?` — Elev ${S.elevFt}′`:''}`, 'R');
      } else {
        addLabel(geom.endX, Math.max(12, geom.endY - 12), `${S.mainLen}′ ${S.mainSize==='2.5'?'2½″':'1¾″'} — ${S.flow} gpm — NP ${S.mainNoz.NP}${S.elevFt?` — Elev ${S.elevFt}′`:''}`, 'C');
      }
      return;
    }

    if(S.type==='master'){
      const {x:sx,y:sy} = pumpXY(viewH);
      const outLeftX  = sx - 26;
      const outRightX = sx + 26;
      const outY = sy;
      const junctionY = Math.max(12, sy - (S.line1.len/50)*PX_PER_50FT);
      const junctionX = sx;

      const aPath = `M ${outLeftX},${outY} L ${outLeftX},${outY - BRANCH_LIFT} L ${outLeftX},${junctionY} L ${junctionX},${junctionY}`;
      const aSh = document.createElementNS(ns,'path'); aSh.setAttribute('class','hoseBase shadow'); aSh.setAttribute('d', aPath); G_branchesP.appendChild(aSh);
      const a = document.createElementNS(ns,'path'); a.setAttribute('class','hoseBase hose25'); a.setAttribute('d', aPath); G_branchesP.appendChild(a);

      const bPath = `M ${outRightX},${outY} L ${outRightX},${outY - BRANCH_LIFT} L ${outRightX},${junctionY} L ${junctionX},${junctionY}`;
      const bSh = document.createElementNS(ns,'path'); bSh.setAttribute('class','hoseBase shadow'); bSh.setAttribute('d', bPath); G_branchesP.appendChild(bSh);
      const b = document.createElementNS(ns,'path'); b.setAttribute('class','hoseBase hose25'); b.setAttribute('d', bPath); G_branchesP.appendChild(b);

      // Junction dot
      const nozzle = document.createElementNS(ns,'circle');
      nozzle.setAttribute('cx', junctionX); nozzle.setAttribute('cy', junctionY);
      nozzle.setAttribute('r', 4); nozzle.setAttribute('fill', '#eaf2ff'); nozzle.setAttribute('stroke', '#111'); nozzle.setAttribute('stroke-width', '.8');
      G_hosesP.appendChild(nozzle);

      // Labels with collision-avoidance and side bias
      addLabel(outLeftX - 20, Math.max(12, junctionY - 12), `Line 1: ${S.line1.len}′ 2½″`, 'L');
      addLabel(outRightX + 20, Math.max(12, junctionY - 12), `Line 2: ${S.line2.len}′ 2½″`, 'R');
      addLabel(junctionX, Math.max(12, junctionY - 26), `Master: ${S.ms.gpm} gpm — NP ${S.ms.NP} — App ${S.ms.appliance}${S.elevFt?` — Elev ${S.elevFt}′`:''}`, 'C');
    }
  }

  // Interactions
  const TOL = 5;
  function makePractice(){
    const S = generateScenario();
    scenario = S;

    if(eqVisible){
      eqBox.innerHTML = `
        <div>
          <div>• FL = C × (Q/100)² × L</div>
          <div>• PDP = ΣFL + Elevation + Appliance + NP</div>
          <div>• Elevation ≈ ${PSI_PER_FT} psi/ft</div>
        </div>
      `;
    }

    const rev = buildReveal(S);
    practiceAnswer = rev.total;
    drawScenario(S);
    practiceInfo.textContent = `Scenario ready — enter your PP below (±${TOL} psi).`;

    // Reset previous work/answer
    statusEl.textContent = 'Awaiting your answer…';
    workEl.innerHTML = '';
    const guessEl = container.querySelector('#ppGuess');
    if(guessEl) guessEl.value = '';
  }

  container.querySelector('#newScenarioBtn').addEventListener('click', makePractice);

  container.querySelector('#checkBtn').addEventListener('click', ()=>{
    const guess = +(container.querySelector('#ppGuess').value||0);
    if(practiceAnswer==null){ statusEl.textContent = 'Generate a problem first.'; return; }
    const diff = Math.abs(guess - practiceAnswer);
    const rev = buildReveal(scenario);
    if(diff<=TOL){
      statusEl.textContent = `✅ Correct! PP ≈ ${practiceAnswer} psi`;
      workEl.innerHTML = rev.lines.map(l=>`<div>${l}</div>`).join('');
    }else{
      statusEl.textContent = `❌ Not quite. Try again or tap Reveal.`;
      workEl.innerHTML = rev.lines.map(l=>`<div>${l}</div>`).join('');
    }
  });

  container.querySelector('#showBuildBtn').addEventListener('click', ()=>{
    if(!scenario){ statusEl.textContent = 'Generate a problem first.'; return; }
    const rev = buildReveal(scenario);
    workEl.innerHTML = rev.lines.map(l=>`<div>${l}</div>`).join('');
  });

  eqToggleBtn.addEventListener('click', ()=>{
    eqVisible = !eqVisible;
    if(eqVisible){
      eqBox.innerHTML = `
        <div>
          <div>• FL = C × (Q/100)² × L</div>
          <div>• PDP = ΣFL + Elevation + Appliance + NP</div>
          <div>• Elevation ≈ ${PSI_PER_FT} psi/ft</div>
        </div>
      `;
      eqBox.style.display = 'block';
      eqToggleBtn.textContent = 'Hide Equations';
    }else{
      eqBox.style.display = 'none';
      eqToggleBtn.textContent = 'Equations';
    }
  });

  // Optional external events
  const onNew = ()=> makePractice();
  const onEq  = ()=> eqToggleBtn.click();
  window.addEventListener('practice:newProblem', onNew);
  window.addEventListener('toggle:equations', onEq);

  // initial
  practiceAnswer = null; scenario = null;

  return {
    dispose(){
      window.removeEventListener('practice:newProblem', onNew);
      window.removeEventListener('toggle:equations', onEq);
    }
  };
}

export default { render };
