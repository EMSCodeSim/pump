// /js/view.practice.js
import { COEFF, FL_total, PSI_PER_FT } from './store.js';

const TRUCK_W = 390;
const TRUCK_H = 260;
const PX_PER_50FT = 45;
const CURVE_PULL = 36;
const BRANCH_LIFT = 10;
const TOL = 1; // fixed ±1 psi

// Master stream defaults (typical)
const MS_CHOICES = [
  { gpm: 500, NP: 80, appliance: 25 },
  { gpm: 750, NP: 80, appliance: 25 },
  { gpm: 1000, NP: 80, appliance: 25 }
];

export async function render(container){
  container.innerHTML = `
    <section class="stack">

      <!-- Controls ABOVE the truck -->
      <section class="card" style="padding-bottom:6px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:space-between">
          <div>
            <b>Practice Mode</b>
            <div class="sub">Use the info on the graphic to find Pump Pressure (PP).</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" id="newScenarioBtn">New Problem</button>
            <button class="btn" id="revealBtn">Reveal</button>
          </div>
        </div>
      </section>

      <!-- Visual (truck first) -->
      <section class="wrapper card">
        <div class="stage" id="stageP">
          <svg id="overlayPractice" preserveAspectRatio="xMidYMax meet" aria-label="Visual stage (practice)">
            <image id="truckImgP" href="https://fireopssim.com/pump/engine181.png" x="0" y="0" width="390" height="260" preserveAspectRatio="xMidYMax meet"></image>
            <g id="hosesP"></g><g id="branchesP"></g><g id="labelsP"></g>
          </svg>
        </div>

        <!-- Hose color key + Equations -->
        <div class="hoseLegend" style="margin-top:8px">
          <span class="legSwatch sw175"></span> 1¾″
          <span class="legSwatch sw25"></span> 2½″
          <span class="legSwatch sw5"></span> 5″
        </div>
        <div class="mini" style="margin-top:6px;opacity:.9">
          <div><b>Friction Loss:</b> <code>FL = C × (GPM/100)² × (length/100)</code></div>
          <div><b>PP (single line):</b> <code>PP = NP + Main FL ± Elev</code></div>
          <div><b>PP (two-branch wye):</b> <code>PP = max(Need A, Need B) + Main FL + Wye ± Elev</code></div>
          <div><b>PP (master stream; two 2½″):</b> <code>PP = NP(ms) + max(FL line1, FL line2) + Appliance ± Elev</code></div>
          <div style="margin-top:4px"><b>C Coefficients:</b> 1¾″ = <b>${COEFF["1.75"]}</b>, 2½″ = <b>${COEFF["2.5"]}</b>, 5″ = <b>${COEFF["5"]}</b></div>
        </div>

        <!-- Status text / reveal work -->
        <div id="practiceInfo" class="status" style="margin-top:8px">Tap <b>New Problem</b> to generate a scenario.</div>
        <div id="work" class="math" style="margin-top:8px"></div>
      </section>

      <!-- Answer row (fixed ±1) -->
      <section class="card">
        <div class="row" style="align-items:flex-end">
          <div class="field" style="max-width:220px">
            <label>Your PP answer (psi)</label>
            <input type="number" id="ppGuess" placeholder="e.g., 145">
          </div>
          <div class="field" style="max-width:160px">
            <button class="btn primary" id="checkBtn" style="width:100%">Check (±${TOL})</button>
          </div>
        </div>
        <div id="practiceStatus" class="status" style="margin-top:8px">No scenario loaded.</div>
      </section>

    </section>
  `;

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

  const ns = 'http://www.w3.org/2000/svg';
  let practiceAnswer = null;
  let scenario = null; // keep last scenario for reveal

  // ===== geometry helpers (matches calc view)
  function computeViewHeight(mainFt, branchMaxFt){
    const mainPx = (mainFt/50)*PX_PER_50FT;
    const branchPx = branchMaxFt ? (branchMaxFt/50)*PX_PER_50FT + BRANCH_LIFT : 0;
    return Math.max(TRUCK_H + 20 + mainPx + branchPx, TRUCK_H + 20);
  }
  function truckTopY(viewH){ return viewH - TRUCK_H; }
  function pumpXY(viewH){
    const top = truckTopY(viewH);
    return { x: TRUCK_W*0.515, y: top + TRUCK_H*0.74 };
  }
  function mainCurve(totalPx, viewH, dir=0){
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

  // ===== utils
  function clearPractice(){
    while(G_hosesP.firstChild) G_hosesP.removeChild(G_hosesP.firstChild);
    while(G_branchesP.firstChild) G_branchesP.removeChild(G_branchesP.firstChild);
    while(G_labelsP.firstChild) G_labelsP.removeChild(G_labelsP.firstChild);
    workEl.innerHTML = '';
  }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function weightedPick(weightedArray){
    const total = weightedArray.reduce((a,x)=>a+x.w,0);
    let r = Math.random()*total;
    for(const x of weightedArray){ if((r-=x.w)<=0) return x.v; }
    return weightedArray[weightedArray.length-1].v;
  }
  const sizeLabel = sz => sz==='2.5' ? '2½″' : (sz==='1.75' ? '1¾″' : `${sz}″`);

  // ===== scenario generator (no single-branch wye; add master stream)
  function makeScenario(){
    const kind = weightedPick([
      { v:'single', w:45 },
      { v:'wye2',   w:25 }, // two-branch wye only
      { v:'master', w:30 }  // two 2½″ to master stream
    ]);

    if(kind==='single'){
      const mainSize = weightedPick([{v:'1.75',w:70},{v:'2.5',w:30}]);
      const mainLen  = weightedPick([{v:150,w:25},{v:200,w:50},{v:250,w:20},{v:300,w:5}]);
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
      const mainLen  = weightedPick([{v:150,w:25},{v:200,w:50},{v:250,w:20},{v:300,w:5}]);
      const elevFt   = weightedPick([{v:0,w:30},{v:10,w:30},{v:20,w:25},{v:30,w:10},{v:40,w:5}]);
      const wyeLoss = 10;

      const nozChoices = [
        {gpm:150, NP:75, label:'Fog 150@75'},
        {gpm:185, NP:50, label:'ChiefXD 185@50'},
        {gpm:185, NP:75, label:'Fog 185@75'}
      ];
      const lenChoices = [50,75,100,150];

      const bnA = { len: pick(lenChoices), noz: pick(nozChoices) };
      const bnB = { len: pick(lenChoices), noz: pick(nozChoices) };

      const flow = bnA.noz.gpm + bnB.noz.gpm;
      const mainFL = FL_total(flow, [{size:mainSize, lengthFt:mainLen}]);

      const needA = bnA.noz.NP + FL_total(bnA.noz.gpm, [{size:'1.75', lengthFt:bnA.len}]);
      const needB = bnB.noz.NP + FL_total(bnB.noz.gpm, [{size:'1.75', lengthFt:bnB.len}]);

      const PDP = Math.round(Math.max(needA,needB) + mainFL + wyeLoss + elevFt*PSI_PER_FT);
      return { type:'wye2', mainSize, mainLen, elevFt, wyeLoss, bnA, bnB, flow, PDP };
    }

    // master stream: two 2.5" lines to master (siamese/appliance)
    if(kind==='master'){
      const elevFt = weightedPick([{v:0,w:30},{v:10,w:30},{v:20,w:25},{v:30,w:10},{v:40,w:5}]);
      const ms = pick(MS_CHOICES); // choose flow/NP/appliance
      const totalGPM = ms.gpm;
      const perLine = totalGPM/2;
      const lenChoices = [100,150,200,250,300];
      const L1 = pick(lenChoices);
      const L2 = pick(lenChoices);

      const fl1 = FL_total(perLine, [{size:'2.5', lengthFt:L1}]);
      const fl2 = FL_total(perLine, [{size:'2.5', lengthFt:L2}]);
      const worst = Math.max(fl1, fl2);
      const PDP = Math.round(ms.NP + worst + ms.appliance + elevFt*PSI_PER_FT);

      return {
        type:'master',
        elevFt,
        ms, // {gpm, NP, appliance}
        line1: { len: L1, gpm: perLine },
        line2: { len: L2, gpm: perLine },
        PDP
      };
    }
  }

  function generateScenario(){
    // bias to keep PP ≤ 250 where possible
    let S;
    for(let i=0;i<16;i++){
      S = makeScenario();
      if(S.PDP <= 270) return S; // allow a little headroom; "very few" >250
    }
    return S;
  }

  // ===== label anti-overlap helpers
  const placedLabels = [];
  function placeY(y){
    let yy = y;
    const step = 14;
    let safety = 0;
    while(placedLabels.some(v => Math.abs(v-yy) < step) && safety<10){
      yy -= step; // raise
      safety++;
    }
    placedLabels.push(yy);
    return yy;
  }
  function addLabel(x, y, text){
    const pad = 4;
    const g = document.createElementNS(ns,'g');
    const t = document.createElementNS(ns,'text');
    t.setAttribute('x', x);
    t.setAttribute('y', placeY(y));
    t.setAttribute('text-anchor','middle');
    t.setAttribute('fill','#0b0f14');
    t.setAttribute('font-size','12');
    t.textContent = text;
    G_labelsP.appendChild(t);
    const bb = t.getBBox();
    const r = document.createElementNS(ns,'rect');
    r.setAttribute('x', bb.x - pad);
    r.setAttribute('y', bb.y - pad);
    r.setAttribute('width', bb.width + pad*2);
    r.setAttribute('height', bb.height + pad*2);
    r.setAttribute('fill', '#eaf2ff');
    r.setAttribute('stroke', '#111');
    r.setAttribute('stroke-width', '.5');
    r.setAttribute('rx','4'); r.setAttribute('ry','4');
    g.appendChild(r); g.appendChild(t);
    G_labelsP.appendChild(g);
  }

  // ===== render helpers
  function drawScenario(S){
    clearPractice();
    placedLabels.length = 0;
    workEl.innerHTML = '';

    if(S.type==='master'){
      // Draw two branches directly from the pump (no main)
      const viewH = Math.max(TRUCK_H + 20 + (Math.max(S.line1.len, S.line2.len)/50)*PX_PER_50FT + BRANCH_LIFT, TRUCK_H+20);
      svg.setAttribute('viewBox', `0 0 ${TRUCK_W} ${Math.ceil(viewH)}`);
      stageEl.style.height = Math.ceil(viewH) + 'px';
      truckImg.setAttribute('y', String(truckTopY(viewH)));

      const {x:sx,y:sy} = pumpXY(viewH);

      // Left branch
      const aPx = (S.line1.len/50)*PX_PER_50FT;
      const aGeom = straightBranch('L', sx, sy, aPx);
      const aSh = document.createElementNS(ns,'path'); aSh.setAttribute('class','hoseBase shadow'); aSh.setAttribute('d', aGeom.d); G_branchesP.appendChild(aSh);
      const a = document.createElementNS(ns,'path'); a.setAttribute('class','hoseBase hose25'); a.setAttribute('d', aGeom.d); G_branchesP.appendChild(a);

      // Right branch
      const bPx = (S.line2.len/50)*PX_PER_50FT;
      const bGeom = straightBranch('R', sx, sy, bPx);
      const bSh = document.createElementNS(ns,'path'); bSh.setAttribute('class','hoseBase shadow'); bSh.setAttribute('d', bGeom.d); G_branchesP.appendChild(bSh);
      const b = document.createElementNS(ns,'path'); b.setAttribute('class','hoseBase hose25'); b.setAttribute('d', bGeom.d); G_branchesP.appendChild(b);

      // Labels: each line gets length + gpm; master nozzle gets NP, Elev, Appliance
      addLabel(aGeom.endX, Math.max(12, aGeom.endY - 12), `Line 1: ${S.line1.len}′ 2½″ — ${S.line1.gpm} gpm`);
      addLabel(bGeom.endX, Math.max(12, bGeom.endY - 12), `Line 2: ${S.line2.len}′ 2½″ — ${S.line2.gpm} gpm`);
      addLabel(sx, sy - 20, `Master: NP ${S.ms.NP} psi — Appliance ${S.ms.appliance} psi${S.elevFt?` — Elev ${S.elevFt}′`:''}`);

      return;
    }

    // Single or Wye-2 drawing (reuse main+branches geometry)
    const branchMax = S.type==='wye2' ? Math.max(S.bnA.len, S.bnB.len) : 0;
    const viewH = Math.ceil(computeViewHeight(S.mainLen, branchMax));
    svg.setAttribute('viewBox', `0 0 ${TRUCK_W} ${viewH}`);
    stageEl.style.height = viewH + 'px';
    truckImg.setAttribute('y', String(truckTopY(viewH)));

    // MAIN curve from pump
    const totalPx = (S.mainLen/50)*PX_PER_50FT;
    const geom = mainCurve(totalPx, viewH, 0);
    const base = document.createElementNS(ns,'path'); base.setAttribute('d', geom.d); G_hosesP.appendChild(base);

    const sh = document.createElementNS(ns,'path');
    sh.setAttribute('class','hoseBase shadow'); sh.setAttribute('d', geom.d);
    G_hosesP.appendChild(sh);

    const main = document.createElementNS(ns,'path');
    const mainClass = S.mainSize==='2.5' ? 'hose25' : (S.mainSize==='1.75' ? 'hose175':'hoseBase');
    main.setAttribute('class', `hoseBase ${mainClass}`);
    main.setAttribute('d', geom.d);
    const Ltot = base.getTotalLength();
    main.setAttribute('stroke-dasharray', `${Ltot} ${Ltot}`);
    main.setAttribute('stroke-dashoffset','0');
    G_hosesP.appendChild(main);

    // Branches if wye2
    let aGeom=null, bGeom=null;
    if(S.type==='wye2'){
      const aPx = (S.bnA.len/50)*PX_PER_50FT;
      aGeom = straightBranch('L', geom.endX, geom.endY, aPx);
      const aSh = document.createElementNS(ns,'path'); aSh.setAttribute('class','hoseBase shadow'); aSh.setAttribute('d', aGeom.d); G_branchesP.appendChild(aSh);
      const a = document.createElementNS(ns,'path'); a.setAttribute('class','hoseBase hose175'); a.setAttribute('d', aGeom.d); G_branchesP.appendChild(a);

      const bPx = (S.bnB.len/50)*PX_PER_50FT;
      bGeom = straightBranch('R', geom.endX, geom.endY, bPx);
      const bSh = document.createElementNS(ns,'path'); bSh.setAttribute('class','hoseBase shadow'); bSh.setAttribute('d', bGeom.d); G_branchesP.appendChild(bSh);
      const b = document.createElementNS(ns,'path'); b.setAttribute('class','hoseBase hose175'); b.setAttribute('d', bGeom.d); G_branchesP.appendChild(b);
    }

    // Labels:
    if(S.type==='single'){
      addLabel(
        geom.endX,
        Math.max(12, geom.endY - 12),
        `${S.mainLen}′ ${sizeLabel(S.mainSize)} — ${S.flow} gpm — NP ${S.mainNoz.NP} psi${S.elevFt?` — Elev ${S.elevFt}′`:''}`
      );
    } else if(S.type==='wye2'){
      // Main: show only main length & size (no elevation at wye)
      addLabel(geom.endX, Math.max(12, geom.endY - 12), `${S.mainLen}′ ${sizeLabel(S.mainSize)}`);
      // Branch labels include branch length, GPM, NP, Elev(ft) — but DO NOT convert elev to psi and DO NOT show at wye
      addLabel(aGeom.endX, Math.max(12, aGeom.endY - 12), `A: ${S.bnA.len}′ 1¾″ — ${S.bnA.noz.gpm} gpm — NP ${S.bnA.noz.NP} psi${S.elevFt?` — Elev ${S.elevFt}′`:''}`);
      addLabel(bGeom.endX, Math.max(12, bGeom.endY - 12), `B: ${S.bnB.len}′ 1¾″ — ${S.bnB.noz.gpm} gpm — NP ${S.bnB.noz.NP} psi${S.elevFt?` — Elev ${S.elevFt}′`:''}`);
    }
  }

  // ===== Build human-readable PP breakdown for Reveal (with explicit FL equation)
  function buildReveal(S){
    const E = S.elevFt * PSI_PER_FT;

    // helper for formatted FL steps
    const flSteps = (gpm, size, lenFt, label) => {
      const C = COEFF[size];
      const per100 = C * Math.pow(gpm/100, 2);
      const flLen = per100 * (lenFt/100);
      return {
        text1: `${label} FL: FL = C × (GPM/100)² × (length/100)`,
        text2: `= ${C} × (${gpm}/100)² × (${lenFt}/100)`,
        value: Math.round(flLen)
      };
    };

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
      const total = higher + mainFL.value + S.wyeLoss + E;

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
            <li>Wye loss = +<b>${S.wyeLoss} psi</b></li>
            <li>Elevation = ${E>=0?'+':''}${Math.round(E)} psi</li>
          </ul>
          <div><b>PP = ${Math.round(higher)} + ${mainFL.value} + ${S.wyeLoss} ${E>=0?'+':''}${Math.round(E)} = <span class="ok">${Math.round(total)} psi</span></b></div>
        `
      };
    }

    if(S.type==='master'){
      const perLine = S.ms.gpm/2;
      const a = flSteps(perLine, '2.5', S.line1.len, 'Line 1');
      const b = flSteps(perLine, '2.5', S.line2.len, 'Line 2');
      const worst = Math.max(a.value, b.value);
      const total = S.ms.NP + worst + S.ms.appliance + E;

      return {
        total: Math.round(total),
        html: `
          <div><b>PP Breakdown (Master stream; two 2½″ lines)</b></div>
          <ul class="simpleList">
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

  // Generate & render
  function makePractice(){
    const S = generateScenario();
    scenario = S;
    const rev = buildReveal(S);
    practiceAnswer = rev.total;
    drawScenario(S);
    practiceInfo.textContent = 'Scenario ready — enter your PP below (±1 psi).';
    statusEl.textContent = 'Awaiting your answer…';
    workEl.innerHTML = ''; // hidden until Reveal or miss
  }

  // ===== interactions
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
      workEl.innerHTML = rev.html; // show full breakdown on a miss
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

  // default state
  practiceAnswer = null;
  scenario = null;

  return { dispose(){} };
}

export default { render };
