// /js/view.practice.js
// Phone-friendly Practice page for hydraulics drills.
// Uses your shared store helpers (NFPA 0.05 psi/ft + appliance loss: +10 psi only if total GPM > 350).

import {
  COEFF,
  PSI_PER_FT,
  FL_total,
  NOZ,
  NOZ_LIST,
  computeApplianceLoss,
} from './store.js';

// NOTE: We do NOT call any helpers that assume a specific "root" interface.
// import { applyMobileFormStyles, enhanceNumericInputs, padTouchTargets } from './mobile-ui.js';

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

// If the editor is ever used, keep it on 50' steps only.
function renderSegmentRow(idx, seg = { size: '1.75', lengthFt: 200 }) {
  const row = el(`
    <div class="row seg" data-i="\${idx}">
      <div class="field" style="min-width:140px">
        <label>Diameter</label>
        <select class="segSize"></select>
      </div>
      <div class="field" style="min-width:140px">
        <label>Length (ft)</label>
        <input class="segLen" type="number" inputmode="decimal" step="50" min="0" value="\${Number(seg.lengthFt)||0}">
      </div>
      <div class="field" style="min-width:120px; display:flex; align-items:flex-end">
        <button class="btn segDel" type="button" title="Remove segment">Remove</button>
      </div>
    </div>
  `);
  const sel = row.querySelector('.segSize');
  SIZES.forEach(s => sel.appendChild(option(s, s)));
  sel.value = String(seg.size || '1.75');
  return row;
}

function fmt0(n){ return String(Math.round(Number(n)||0)); }

// Tolerance for answer checking
const TOL = 5; // ±5 psi

export async function render(container) {
  container.innerHTML = `
    <section class="stack">
      <section class="card" style="padding-bottom:6px">
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
            <g id="hosesP"></g><g id="branchesP"></g><g id="labelsP"></g>
          </svg>
        </div>

        <div class="hoseLegend" style="margin-top:8px">
          <span class="legSwatch sw175"></span> 1¾″
          <span class="legSwatch sw25"></span> 2½″
          <span class="legSwatch sw5"></span> 5″
        </div>

        <!-- Scenario-aware equations (hidden by default) -->
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
            <button class="btn primary" id="checkBtn" style="width:100%">Check (±${TOL})</button>
          </div>
        </div>
        <div id="practiceStatus" class="status" style="margin-top:8px">No scenario loaded.</div>
      </section>
    </section>
  ";

  // Minimal, safe styling helper (no root.querySelectorAll usage)
  injectStyle(container, `
    :root { --tap: 44px; --tapS: 40px; --fieldPad: 10px; --radius: 12px; }
    input, select, textarea, button { font-size:16px; } /* prevent iOS zoom */
    .btn { min-height: var(--tap); min-width: var(--tapS); padding: 10px 14px; border-radius: var(--radius); }
    .row { display:flex; gap:10px; flex-wrap:wrap; }
    .practice-actions { display:flex; gap:8px; align-items:center; justify-content:center; flex-wrap:wrap; }
    .field label { display:block; font-weight:700; color:#dfe9ff; margin: 6px 0 4px; }
    .field input[type="text"], .field input[type="number"], .field select, .field textarea {
      width:100%; padding: var(--fieldPad) calc(var(--fieldPad) + 2px);
      border:1px solid rgba(255,255,255,.22); border-radius: var(--radius);
      background:#0b1420; color:#eaf2ff; outline:none;
    }
    .field input:focus, .field select:focus, .field textarea:focus {
      border-color:#6ecbff; box-shadow:0 0 0 3px rgba(110,203,255,.22);
    }
    .kpi b { font-size: 20px; }
    hr { border:0; border-top:1px solid rgba(255,255,255,.12); }
  `);

  // ===== DOM refs
  const stageEl = container.querySelector('#stageP');
  const svg = container.querySelector('#overlayPractice');
  const truckImg = container.querySelector('#truckImgP');
  const G_hosesP = container.querySelector('#hosesP');
  const G_branchesP = container.querySelector('#branchesP');
  const G_labelsP = container.querySelector('#labelsP');
  const practiceInfo = container.querySelector('#practiceInfo');
  const statusEl = container.querySelector('#practiceStatus');
  const workEl = container.querySelector('#work');
  const eqBox = container.querySelector('#eqBox');
  const eqToggleBtn = container.querySelector('#eqToggleBtn');

  const ns = 'http://www.w3.org/2000/svg';
  let practiceAnswer = null;
  let scenario = null;
  let eqVisible = false;

  // ===== geometry helpers
  const TRUCK_W = 390;
  const TRUCK_H = 260;
  const PX_PER_50FT = 45;
  const CURVE_PULL = 36;
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
    return { d:\`M \${sx},\${sy} Q \${cx},\${cy} \${ex},\${ey}\`, endX:ex, endY:ey };
  }
  function straightBranch(side, startX, startY, totalPx){
    const dir = side==='L'?-1:1, x = startX + dir*20, y1 = startY - BRANCH_LIFT, y2 = Math.max(8, y1 - totalPx);
    return { d:\`M \${startX},\${startY} L \${startX},\${y1} L \${x},\${y1} L \${x},\${y2}\`, endX:x, endY:y2 };
  }

  // ===== utils
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function weightedPick(weightedArray){
    const total = weightedArray.reduce((a,x)=>a+x.w,0);
    let r = Math.random()*total;
    for(const x of weightedArray){ if((r-=x.w)<=0) return x.v; }
    return weightedArray[weightedArray.length-1].v;
  }
  const sizeLabelLocal = sz => sz==='2.5' ? '2½″' : (sz==='1.75' ? '1¾″' : \`\${sz}″\`);

  // ===== scenario generator — ONLY 50' multiples (no 75')
  function makeScenario(){
    const kind = weightedPick([
      { v:'single', w:45 },
      { v:'wye2',   w:25 },
      { v:'master', w:30 }
    ]);

    if(kind==='single'){
      const mainSize = weightedPick([{v:'1.75',w:70},{v:'2.5',w:30}]);
      const mainLen  = weightedPick([{v:150,w:25},{v:200,w:50},{v:250,w:20},{v:300,w:5}]); // 50 multiples only
      const elevFt   = weightedPick([{v:0,w:30},{v:10,w:30},{v:20,w:25},{v:30,w:10},{v:40,w:5}]);
      const mainNozzles_175 = [
        {gpm:185, NP:50, label:'ChiefXD 185@50'},
        {gpm:150, NP:75, label:'Fog 150@75'},
        {gpm:185, NP:75, label:'Fog 185@75'}
      ];
      const mainNozzles_25 = [
        {gpm:265, NP:50, label:'SB 1 1/8 265@50'},
        {gpm:250, NP:75, label:'Fog 250@75'}
      ];
      const mainNoz = mainSize==='2.5' ? pick(mainNozzles_25) : pick(mainNozzles_175);
      const flow = mainNoz.gpm;
      const mainFL = FL_total(flow, [{size:mainSize, lengthFt:mainLen}]);
      const PDP = Math.round(mainNoz.NP + mainFL + elevFt*PSI_PER_FT);
      return { type:'single', mainSize, mainLen, elevFt, mainNoz, flow, PDP };
    }

    if(kind==='wye2'){
      const mainSize = weightedPick([{v:'1.75',w:70},{v:'2.5',w:30}]);
      const mainLen  = weightedPick([{v:150,w:25},{v:200,w:50},{v:250,w:20},{v:300,w:5}]); // 50 multiples only
      const elevFt   = weightedPick([{v:0,w:30},{v:10,w:30},{v:20,w:25},{v:30,w:10},{v:40,w:5}]);
      const wyeLoss = 10;

      const nozChoices = [
        {gpm:150, NP:75, label:'Fog 150@75'},
        {gpm:185, NP:50, label:'ChiefXD 185@50'},
        {gpm:185, NP:75, label:'Fog 185@75'}
      ];
      const lenChoices = [50,100,150]; // removed 75

      const bnA = { len: pick(lenChoices), noz: pick(nozChoices) };
      const bnB = { len: pick(lenChoices), noz: pick(nozChoices) };

      const flow = bnA.noz.gpm + bnB.noz.gpm;
      const mainFL = FL_total(flow, [{size:mainSize, lengthFt:mainLen}]);

      const needA = bnA.noz.NP + FL_total(bnA.noz.gpm, [{size:'1.75', lengthFt:bnA.len}]);
      const needB = bnB.noz.NP + FL_total(bnB.noz.gpm, [{size:'1.75', lengthFt:bnB.len}]);
      const PDP = Math.round(Math.max(needA,needB) + mainFL + wyeLoss + elevFt*PSI_PER_FT);

      return { type:'wye2', mainSize, mainLen, elevFt, wyeLoss, bnA, bnB, flow, PDP };
    }

    if(kind==='master'){
      const elevFt = weightedPick([{v:0,w:30},{v:10,w:30},{v:20,w:25},{v:30,w:10},{v:40,w:5}]);
      const ms = pick([
        { gpm: 500, NP: 80, appliance: 25 },
        { gpm: 750, NP: 80, appliance: 25 },
        { gpm: 1000, NP: 80, appliance: 25 }
      ]);
      const totalGPM = ms.gpm;
      const perLine = totalGPM/2;
      const lenChoices = [100,150,200,250,300]; // 50 multiples only
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
  }

  function generateScenario(){
    let S;
    for(let i=0;i<18;i++){
      S = makeScenario();
      if(S.PDP <= 270) return S;
    }
    return S;
  }

  // ===== bubble label helpers (collision-avoidance)
  const placedBoxes = [];
  function overlaps(a,b){
    return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  }
  function nudge(attempt, sideBias){
    const dy = -12;                  // prefer upward
    const dx = ((attempt % 4) - 1.5) * 8 + sideBias; // small lateral jitter + side bias
    return { dx, dy };
  }
  function addLabel(x, y, text, side='C'){
    const pad = 4;

    // Create text offscreen first to measure
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

    // Draw rect behind the text
    const r = document.createElementNS(ns,'rect');
    r.setAttribute('x', box.x);
    r.setAttribute('y', box.y);
    r.setAttribute('width', box.w);
    r.setAttribute('height', box.h);
    r.setAttribute('rx','4'); r.setAttribute('ry','4');
    r.setAttribute('fill', '#eaf2ff'); r.setAttribute('stroke', '#111'); r.setAttribute('stroke-width', '.5');

    // Position measured text
    t.setAttribute('x', box.x + box.w/2);
    t.setAttribute('y', box.y + box.h - pad - 1);

    // Group & append in correct order (rect behind text)
    const g = document.createElementNS(ns,'g');
    g.appendChild(r); g.appendChild(t);
    G_labelsP.appendChild(g);

    placedBoxes.push(box);
  }

  // ===== draw
  function drawScenario(S){
    while(G_hosesP.firstChild) G_hosesP.removeChild(G_hosesP.firstChild);
    while(G_branchesP.firstChild) G_branchesP.removeChild(G_branchesP.firstChild);
    while(G_labelsP.firstChild) G_labelsP.removeChild(G_labelsP.firstChild);
    placedBoxes.length = 0;
    workEl.innerHTML = '';

    // Compute a simple viewBox height
    const baseH = TRUCK_H + 20;
    const extra = Math.max(
      S.type==='single' ? (S.mainLen/50)*PX_PER_50FT : 0,
      S.type==='wye2'   ? (Math.max(S.bnA.len, S.bnB.len)/50)*PX_PER_50FT : 0,
      S.type==='master' ? (S.line1.len/50)*PX_PER_50FT : 0
    ) + BRANCH_LIFT + 20;
    const viewH = Math.ceil(baseH + extra);

    svg.setAttribute('viewBox', \`0 0 \${TRUCK_W} \${viewH}\`);
    stageEl.style.height = viewH + 'px';
    truckImg.setAttribute('y', String(truckTopY(viewH)));

    // Main path if present
    if(S.type==='single' || S.type==='wye2'){
      const totalPx = (S.mainLen/50)*PX_PER_50FT;
      const geom = mainCurve(totalPx, viewH);
      const sh = document.createElementNS(ns,'path'); sh.setAttribute('class','hoseBase shadow'); sh.setAttribute('d', geom.d); G_hosesP.appendChild(sh);
      const main = document.createElementNS(ns,'path'); main.setAttribute('class', \`hoseBase \${S.mainSize==='2.5'?'hose25':'hose175'}\`); main.setAttribute('d', geom.d); G_hosesP.appendChild(main);

      if(S.type==='wye2'){
        const aPx = (S.bnA.len/50)*PX_PER_50FT;
        const aGeom = straightBranch('L', geom.endX, geom.endY, aPx);
        const aSh = document.createElementNS(ns,'path'); aSh.setAttribute('class','hoseBase shadow'); aSh.setAttribute('d', aGeom.d); G_branchesP.appendChild(aSh);
        const a = document.createElementNS(ns,'path'); a.setAttribute('class','hoseBase hose175'); a.setAttribute('d', aGeom.d); G_branchesP.appendChild(a);

        const bPx = (S.bnB.len/50)*PX_PER_50FT;
        const bGeom = straightBranch('R', geom.endX, geom.endY, bPx);
        const bSh = document.createElementNS(ns,'path'); bSh.setAttribute('class','hoseBase shadow'); bSh.setAttribute('d', bGeom.d); G_branchesP.appendChild(bSh);
        const b = document.createElementNS(ns,'path'); b.setAttribute('class','hoseBase hose175'); b.setAttribute('d', bGeom.d); G_branchesP.appendChild(b);

        addLabel(geom.endX, Math.max(12, geom.endY - 12), \`\${S.mainLen}′ \${sizeLabelLocal(S.mainSize)}\`, 'C');
        addLabel(aGeom.endX, Math.max(12, aGeom.endY - 12), \`A: \${S.bnA.len}′ 1¾″ — \${S.bnA.noz.gpm} gpm — NP \${S.bnA.noz.NP} psi\${S.elevFt?\` — Elev \${S.elevFt}′\`:""}\`, 'L');
        addLabel(bGeom.endX, Math.max(12, bGeom.endY - 12), \`B: \${S.bnB.len}′ 1¾″ — \${S.bnB.noz.gpm} gpm — NP \${S.bnB.noz.NP} psi\${S.elevFt?\` — Elev \${S.elevFt}′\`:""}\`, 'R');
      } else {
        addLabel(geom.endX, Math.max(12, geom.endY - 12), \`\${S.mainLen}′ \${sizeLabelLocal(S.mainSize)} — \${S.flow} gpm — NP \${S.mainNoz.NP} psi\${S.elevFt?\` — Elev \${S.elevFt}′\`:""}\`, 'C');
      }
      return;
    }

    // Master stream
    if(S.type==='master'){
      const {x:sx,y:sy} = pumpXY(viewH);
      const outLeftX  = sx - 26;
      const outRightX = sx + 26;
      const outY = sy;
      const junctionY = Math.max(12, sy - (S.line1.len/50)*PX_PER_50FT);
      const junctionX = sx;

      const aPath = \`M \${outLeftX},\${outY} L \${outLeftX},\${outY - BRANCH_LIFT} L \${outLeftX},\${junctionY} L \${junctionX},\${junctionY}\`;
      const aSh = document.createElementNS(ns,'path'); aSh.setAttribute('class','hoseBase shadow'); aSh.setAttribute('d', aPath); G_branchesP.appendChild(aSh);
      const a = document.createElementNS(ns,'path'); a.setAttribute('class','hoseBase hose25'); a.setAttribute('d', aPath); G_branchesP.appendChild(a);

      const bPath = \`M \${outRightX},\${outY} L \${outRightX},\${outY - BRANCH_LIFT} L \${outRightX},\${junctionY} L \${junctionX},\${junctionY}\`;
      const bSh = document.createElementNS(ns,'path'); bSh.setAttribute('class','hoseBase shadow'); bSh.setAttribute('d', bPath); G_branchesP.appendChild(bSh);
      const b = document.createElementNS(ns,'path'); b.setAttribute('class','hoseBase hose25'); b.setAttribute('d', bPath); G_branchesP.appendChild(b);

      const nozzle = document.createElementNS(ns,'circle');
      nozzle.setAttribute('cx', junctionX); nozzle.setAttribute('cy', junctionY);
      nozzle.setAttribute('r', 4); nozzle.setAttribute('fill', '#eaf2ff'); nozzle.setAttribute('stroke', '#111'); nozzle.setAttribute('stroke-width', '.8');
      G_hosesP.appendChild(nozzle);

      addLabel(outLeftX - 20, Math.max(12, junctionY - 12), \`Line 1: \${S.line1.len}′ 2½″\`, 'L');
      addLabel(outRightX + 20, Math.max(12, junctionY - 12), \`Line 2: \${S.line2.len}′ 2½″\`, 'R');
      addLabel(junctionX, Math.max(12, junctionY - 26), \`Master: \${S.ms.gpm} gpm — NP \${S.ms.NP} psi — Appliance \${S.ms.appliance} psi\${S.elevFt?\` — Elev \${S.elevFt}′\`:""}\`, 'C');
    }
  }

  // ===== equations (scenario-aware, no numbers)
  function renderEquations(S){
    const base = `
      <div><b>Friction Loss (per section):</b> <code>FL = C × (GPM/100)² × (length/100)</code></div>
      <div style="margin-top:2px"><b>Elevation (psi):</b> <code>Elev = 0.05 × height(ft)</code></div>
      <div style="margin-top:4px"><b>C Coefficients:</b> 1¾″ = <b>${COEFF["1.75"]}</b>, 2½″ = <b>${COEFF["2.5"]}</b>, 5″ = <b>${COEFF["5"]}</b></div>
    `;
    if(!S){
      return base + `<div style="margin-top:6px" class="status">Generate a problem to see scenario-specific equations.</div>`;
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

  // ===== reveal breakdown (with numbers)
  function flSteps(gpm, size, lenFt, label){
    const C = COEFF[size];
    const per100 = C * Math.pow(gpm/100, 2);
    const flLen = per100 * (lenFt/100);
    return {
      text1: \`\${label} FL = C × (GPM/100)² × (length/100)\`,
      text2: \`= \${C} × (\${gpm}/100)² × (\${lenFt}/100)\`,
      value: Math.round(flLen)
    };
  }

  function buildReveal(S){
    const E = S.elevFt * PSI_PER_FT;
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

    if(S.type==='master'){
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
  }

  // ===== interactions
  function makePractice(){
    const S = generateScenario();
    scenario = S;

    // Scenario-aware equations if visible
    if(eqVisible){
      eqBox.innerHTML = renderEquations(scenario);
    }

    const rev = buildReveal(S);
    practiceAnswer = rev.total;
    drawScenario(S);
    practiceInfo.textContent = \`Scenario ready — enter your PP below (±\${TOL} psi).\`;

    // Reset previous work/answer (per your request)
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
      statusEl.innerHTML = \`<span class="ok">✅ Correct!</span> (Answer \${practiceAnswer} psi; Δ \${diff})\`;
      workEl.innerHTML = '';
    }else{
      statusEl.innerHTML = \`<span class="alert">❌ Not quite.</span> (Answer \${practiceAnswer} psi; Δ \${diff})\`;
      workEl.innerHTML = rev.html;
      workEl.scrollIntoView({behavior:'smooth', block:'nearest'});
    }
  });
  container.querySelector('#revealBtn').addEventListener('click', ()=>{
    if(!scenario) return;
    const rev = buildReveal(scenario);
    workEl.innerHTML = rev.html;
    statusEl.innerHTML = \`<b>Answer:</b> \${rev.total} psi\`;
    workEl.scrollIntoView({behavior:'smooth', block:'nearest'});
  });

  // Equations toggle — scenario-aware, no numbers
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

  // External events (optional)
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
    }
  };
}

export default { render };
