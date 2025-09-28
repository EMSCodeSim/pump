// /js/view.practice.js
import { FL_total, PSI_PER_FT } from './store.js';

const TRUCK_W = 390;
const TRUCK_H = 260;
const PX_PER_50FT = 45;
const CURVE_PULL = 36;
const BRANCH_LIFT = 10;

export async function render(container){
  container.innerHTML = `
    <section class="stack">

      <!-- Controls ABOVE the truck -->
      <section class="card" style="padding-bottom:6px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:space-between">
          <div>
            <b>Practice Mode</b>
            <div class="sub">Realistic line setups. Find the correct Pump Pressure (PP).</div>
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

        <!-- Hose color key -->
        <div class="hoseLegend" style="margin-top:8px">
          <span class="legSwatch sw175"></span> 1¾″
          <span class="legSwatch sw25"></span> 2½″
          <span class="legSwatch sw5"></span> 5″
        </div>

        <!-- Moved BELOW the truck so it never covers labels -->
        <div id="practiceInfo" class="status" style="margin-top:8px">Tap <b>New Problem</b> to generate a scenario.</div>
      </section>

      <!-- Answer row -->
      <section class="card">
        <div class="row" style="align-items:flex-end">
          <div class="field" style="max-width:200px">
            <label>Your PP answer (psi)</label>
            <input type="number" id="ppGuess" placeholder="e.g., 145">
          </div>
          <div class="field" style="max-width:160px">
            <label>Tolerance (± psi)</label>
            <input type="number" id="ppTol" value="10">
          </div>
          <div class="field" style="max-width:160px">
            <button class="btn primary" id="checkBtn" style="width:100%">Check</button>
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

  const ns = 'http://www.w3.org/2000/svg';
  let practiceAnswer = null;

  // ===== geometry helpers (mirrors view.calc.js)
  function computeViewHeight(mainFt, branchMaxFt){
    const mainPx = (mainFt/50)*PX_PER_50FT;
    const branchPx = branchMaxFt ? (branchMaxFt/50)*PX_PER_50FT + BRANCH_LIFT : 0;
    // Some headroom above truck & labels
    return Math.max(TRUCK_H + 20 + mainPx + branchPx, TRUCK_H + 20);
  }
  function truckTopY(viewH){ return viewH - TRUCK_H; }
  function pumpXY(viewH){
    const top = truckTopY(viewH);
    return { x: TRUCK_W*0.515, y: top + TRUCK_H*0.74 }; // same pump spot as calc
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

  // ===== util
  function clearPractice(){
    while(G_hosesP.firstChild) G_hosesP.removeChild(G_hosesP.firstChild);
    while(G_branchesP.firstChild) G_branchesP.removeChild(G_branchesP.firstChild);
    while(G_labelsP.firstChild) G_labelsP.removeChild(G_labelsP.firstChild);
  }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function weightedPick(weightedArray){
    const total = weightedArray.reduce((a,x)=>a+x.w,0);
    let r = Math.random()*total;
    for(const x of weightedArray){ if((r-=x.w)<=0) return x.v; }
    return weightedArray[weightedArray.length-1].v;
  }

  // ===== scenario generator (realistic; rarely >250)
  function makeRealisticScenario(){
    const mainSize = weightedPick([{v:'1.75',w:70},{v:'2.5',w:30}]);
    const mainLen  = weightedPick([{v:150,w:25},{v:200,w:50},{v:250,w:20},{v:300,w:5}]);
    const elev     = weightedPick([{v:0,w:30},{v:10,w:30},{v:20,w:25},{v:30,w:10},{v:40,w:5}]);

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

    const useWye = Math.random() < 0.28;
    const twoBranches = useWye && Math.random() < 0.7;

    const branchNozzles = [
      {gpm:150, NP:75, label:'Fog 150@75'},
      {gpm:185, NP:50, label:'ChiefXD 185@50'},
      {gpm:185, NP:75, label:'Fog 185@75'}
    ];
    const branchLens = [50,75,100,150];

    let bnA=null, bnB=null, wyeLoss=10;
    if(useWye){
      bnA = { len: pick(branchLens), noz: pick(branchNozzles) };
      if(twoBranches){ bnB = { len: pick(branchLens), noz: pick(branchNozzles) }; }
    }

    const flow = useWye
      ? ((bnA?.noz.gpm||0) + (bnB?.noz.gpm||0) + (!twoBranches ? mainNoz.gpm : 0))
      : mainNoz.gpm;

    const mainFL = FL_total(flow, [{size:mainSize, lengthFt:mainLen}]);

    let PDP=0;
    if(!useWye){
      PDP = mainNoz.NP + mainFL + elev*PSI_PER_FT;
    }else if(twoBranches){
      const needA = bnA.noz.NP + FL_total(bnA.noz.gpm, [{size:'1.75', lengthFt:bnA.len}]);
      const needB = bnB.noz.NP + FL_total(bnB.noz.gpm, [{size:'1.75', lengthFt:bnB.len}]);
      PDP = Math.max(needA, needB) + mainFL + wyeLoss + elev*PSI_PER_FT;
    }else{ // single branch via wye
      const needBranch = bnA.noz.NP + FL_total(bnA.noz.gpm, [{size:'1.75', lengthFt:bnA.len}]);
      PDP = needBranch + mainFL + elev*PSI_PER_FT; // no extra wye loss for single flowing
    }

    return {
      mainSize, mainLen, elev, mainNoz,
      useWye, twoBranches, bnA, bnB, wyeLoss,
      flow, PDP: Math.round(PDP)
    };
  }
  function generateBiasedScenario(){
    let S;
    for(let i=0;i<12;i++){ S = makeRealisticScenario(); if(S.PDP<=250) return S; }
    return S;
  }

  function drawScenario(S){
    clearPractice();

    // Compute SVG height and layout
    const branchMax = S.useWye ? Math.max(S.bnA.len, S.twoBranches? S.bnB.len : 0) : 0;
    const viewH = Math.ceil(computeViewHeight(S.mainLen, branchMax));
    svg.setAttribute('viewBox', `0 0 ${TRUCK_W} ${viewH}`);
    stageEl.style.height = viewH + 'px';
    truckImg.setAttribute('y', String(truckTopY(viewH)));

    // MAIN curve from pump
    const totalPx = (S.mainLen/50)*PX_PER_50FT;
    const geom = mainCurve(totalPx, viewH, 0); // dir 0 = center
    const base = document.createElementNS(ns,'path'); base.setAttribute('d', geom.d); G_hosesP.appendChild(base);

    const sh = document.createElementNS(ns,'path');
    sh.setAttribute('class','hoseBase shadow'); sh.setAttribute('d', geom.d);
    G_hosesP.appendChild(sh);

    const main = document.createElementNS(ns,'path');
    main.setAttribute('class', `hoseBase ${S.mainSize==='2.5'?'hose25':'hose175'}`);
    main.setAttribute('d', geom.d);
    const L = base.getTotalLength();
    main.setAttribute('stroke-dasharray', `${L} ${L}`);
    main.setAttribute('stroke-dashoffset','0');
    G_hosesP.appendChild(main);

    // BRANCHES (from the end of main)
    if(S.useWye){
      // A (left)
      const aPx = (S.bnA.len/50)*PX_PER_50FT;
      const aGeom = straightBranch('L', geom.endX, geom.endY, aPx);
      const aSh = document.createElementNS(ns,'path'); aSh.setAttribute('class','hoseBase shadow'); aSh.setAttribute('d', aGeom.d); G_branchesP.appendChild(aSh);
      const a = document.createElementNS(ns,'path'); a.setAttribute('class','hoseBase hose175'); a.setAttribute('d', aGeom.d); G_branchesP.appendChild(a);

      // B (right) if any
      if(S.twoBranches){
        const bPx = (S.bnB.len/50)*PX_PER_50FT;
        const bGeom = straightBranch('R', geom.endX, geom.endY, bPx);
        const bSh = document.createElementNS(ns,'path'); bSh.setAttribute('class','hoseBase shadow'); bSh.setAttribute('d', bGeom.d); G_branchesP.appendChild(bSh);
        const b = document.createElementNS(ns,'path'); b.setAttribute('class','hoseBase hose175'); b.setAttribute('d', bGeom.d); G_branchesP.appendChild(b);
      }
    }

    // LABEL near the main nozzle/branch junction; info text is below, so no overlap
    const npLabel = S.useWye
      ? (S.twoBranches ? 'Wye (two branches)' : 'Wye (single branch)')
      : `Nozzle ${S.mainNoz.NP} psi`;
    const lbl = `${S.mainLen}′ ${S.mainSize==='2.5'?'2½″':'1¾″'} @ ${S.flow} gpm — ${npLabel}${S.elev?` — Elev ${S.elev}′`:''}`;
    const t=document.createElementNS(ns,'text');
    t.setAttribute('x', geom.endX);
    t.setAttribute('y', Math.max(12, geom.endY - 10));
    t.setAttribute('text-anchor','middle');
    t.setAttribute('fill','#eaf2ff');
    t.setAttribute('font-size','12');
    t.textContent = lbl;
    G_labelsP.appendChild(t);
  }

  // Generate & render
  function makePractice(){
    const S = generateBiasedScenario();
    practiceAnswer = S.PDP;
    drawScenario(S);
    practiceInfo.textContent = 'Scenario ready — enter your PP answer below.';
    statusEl.textContent = 'Awaiting your answer…';
  }

  // ===== interactions
  container.querySelector('#newScenarioBtn').addEventListener('click', makePractice);
  container.querySelector('#checkBtn').addEventListener('click', ()=>{
    const guess = +(container.querySelector('#ppGuess').value||0);
    const tol = Math.max(0, +(container.querySelector('#ppTol').value||10));
    if(practiceAnswer==null){ statusEl.textContent = 'Generate a problem first.'; return; }
    const diff = Math.abs(guess - practiceAnswer);
    if(diff<=tol){ statusEl.innerHTML = `<span class="ok">✅ Correct!</span> (Answer ${practiceAnswer} psi; Δ ${diff})`; }
    else if(diff<=tol*2){ statusEl.innerHTML = `<span class="warn">⚠️ Close.</span> (Answer ${practiceAnswer} psi; Δ ${diff})`; }
    else{ statusEl.innerHTML = `<span class="alert">❌ Not quite.</span> (Answer ${practiceAnswer} psi; Δ ${diff})`; }
  });
  container.querySelector('#revealBtn').addEventListener('click', ()=>{
    if(practiceAnswer!=null) statusEl.innerHTML = `<b>Answer:</b> ${practiceAnswer} psi`;
  });

  // default state
  practiceAnswer = null;

  return { dispose(){} };
}

export default { render };
