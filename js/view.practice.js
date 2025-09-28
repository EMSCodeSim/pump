// /js/view.practice.js
import { FL_total, PSI_PER_FT } from './store.js';

export async function render(container){
  container.innerHTML = `
    <section class="stack">

      <!-- Practice controls ABOVE the truck -->
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

      <!-- Visual first (matches Calculations placement) -->
      <section class="wrapper card">
        <div class="stage">
          <svg id="overlayPractice" viewBox="0 0 390 260" preserveAspectRatio="xMidYMax meet" aria-label="Visual stage (practice)">
            <image href="https://fireopssim.com/pump/engine181.png" x="0" y="0" width="390" height="260"></image>
            <g id="hosesP"></g><g id="branchesP"></g><g id="labelsP"></g>
          </svg>
          <div class="info" id="practiceInfo">Tap <b>New Problem</b> to generate a scenario.</div>
        </div>

        <!-- Hose color key -->
        <div class="hoseLegend" style="margin-top:8px">
          <span class="legSwatch sw175"></span> 1¾″
          <span class="legSwatch sw25"></span> 2½″
          <span class="legSwatch sw5"></span> 5″
        </div>
      </section>

      <!-- Answer row immediately under the visual -->
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
  const G_hosesP = container.querySelector('#hosesP');
  const G_branchesP = container.querySelector('#branchesP');
  const G_labelsP = container.querySelector('#labelsP');
  const practiceInfo = container.querySelector('#practiceInfo');
  const statusEl = container.querySelector('#practiceStatus');

  const ns = 'http://www.w3.org/2000/svg';
  let practiceAnswer = null;

  // ===== helpers
  function clearPractice(){
    while(G_hosesP.firstChild) G_hosesP.removeChild(G_hosesP.firstChild);
    while(G_branchesP.firstChild) G_branchesP.removeChild(G_branchesP.firstChild);
    while(G_labelsP.firstChild) G_labelsP.removeChild(G_labelsP.firstChild);
  }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function weightedPick(weightedArray){
    // weightedArray: [{v:..., w:...}, ...]
    const total = weightedArray.reduce((a,x)=>a+x.w,0);
    let r = Math.random()*total;
    for(const x of weightedArray){ if((r-=x.w)<=0) return x.v; }
    return weightedArray[weightedArray.length-1].v;
  }

  // Generate a realistic scenario, biasing PP ≤ 250 psi (allow rare high cases)
  function makeRealisticScenario(){
    // Main hose selection (more 1¾″ than 2½″)
    const mainSize = weightedPick([
      {v:'1.75', w:70},
      {v:'2.5',  w:30},
    ]);
    // Typical preconnect lengths (slight bias to 200')
    const mainLen = weightedPick([
      {v:150, w:25}, {v:200, w:50}, {v:250, w:20}, {v:300, w:5}
    ]);
    // Elevation conservative
    const elev = weightedPick([
      {v:0, w:30}, {v:10, w:30}, {v:20, w:25}, {v:30, w:10}, {v:40, w:5}
    ]);

    // Nozzles: Align to line size (avoid unrealistic combos)
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

    // Wye usage: sometimes, and usually two flowing branches if used
    const useWye = Math.random() < 0.28; // ~28% cases
    const twoBranches = useWye && Math.random() < 0.7;

    const branchNozzles = [
      {gpm:150, NP:75, label:'Fog 150@75'},
      {gpm:185, NP:50, label:'ChiefXD 185@50'},
      {gpm:185, NP:75, label:'Fog 185@75'}
    ];
    const branchLens = [50, 75, 100, 150];

    let bnA = null, bnB = null, wyeLoss = 10;

    if(useWye){
      bnA = {
        len: pick(branchLens),
        noz: pick(branchNozzles) // 1¾″ branch assumed
      };
      if(twoBranches){
        bnB = {
          len: pick(branchLens),
          noz: pick(branchNozzles)
        };
      }
    }

    // Compute PP for this layout (mirrors your calculation rules)
    const flow = useWye
      ? ( (bnA?.noz.gpm || 0) + (bnB?.noz.gpm || 0) + (!twoBranches ? mainNoz.gpm : 0) )
      : mainNoz.gpm;

    const mainFL = FL_total(flow, [{size:mainSize, lengthFt:mainLen}]);

    let PDP = 0;
    if(!useWye){
      PDP = mainNoz.NP + mainFL + elev*PSI_PER_FT;
    } else if(useWye && twoBranches){
      const needA = (bnA.noz.NP) + FL_total(bnA.noz.gpm, [{size:'1.75', lengthFt:bnA.len}]);
      const needB = (bnB.noz.NP) + FL_total(bnB.noz.gpm, [{size:'1.75', lengthFt:bnB.len}]);
      PDP = Math.max(needA, needB) + mainFL + wyeLoss + elev*PSI_PER_FT;
    } else { // single branch via wye
      const needBranch = (bnA.noz.NP) + FL_total(bnA.noz.gpm, [{size:'1.75', lengthFt:bnA.len}]);
      PDP = needBranch + mainFL + elev*PSI_PER_FT; // no extra wye loss for single flowing
    }

    return {
      mainSize, mainLen, elev, mainNoz,
      useWye, twoBranches, bnA, bnB, wyeLoss,
      flow, PDP: Math.round(PDP)
    };
  }

  // Keep scenarios mostly ≤ 250 psi; allow rare tougher ones
  function generateBiasedScenario(){
    let scenario;
    for(let i=0; i<12; i++){
      scenario = makeRealisticScenario();
      if(scenario.PDP <= 250) return scenario;
    }
    // If we kept hitting high PP, accept the last one with a small chance (rare >250)
    return scenario;
  }

  function drawScenario(S){
    clearPractice();

    // Draw main
    const totalPx = (S.mainLen/50)*45;
    const sx=200, sy=220; const ex=200, ey=Math.max(18, sy-totalPx);
    const pathData = `M ${sx},${sy} Q 200 ${sy-totalPx*0.6} ${ex},${ey}`;
    const base=document.createElementNS(ns,'path'); base.setAttribute('d', pathData); G_hosesP.appendChild(base);

    const shadow=document.createElementNS(ns,'path');
    shadow.setAttribute('class','hoseBase shadow'); shadow.setAttribute('d', pathData);
    G_hosesP.appendChild(shadow);

    const mainPath=document.createElementNS(ns,'path');
    mainPath.setAttribute('class',`hoseBase ${S.mainSize==='2.5'?'hose25':'hose175'}`);
    mainPath.setAttribute('d', pathData);
    const L = base.getTotalLength();
    mainPath.setAttribute('stroke-dasharray', `${L} ${L}`);
    mainPath.setAttribute('stroke-dashoffset','0');
    G_hosesP.appendChild(mainPath);

    // Draw branches
    if(S.useWye){
      // Branch A (left)
      const ax = ex-20, ay = ey-10, ay2 = Math.max(8, ay - (S.bnA.len/50)*45);
      const apath = `M ${ex},${ey} L ${ex},${ay} L ${ax},${ay} L ${ax},${ay2}`;
      const aShadow=document.createElementNS(ns,'path'); aShadow.setAttribute('class','hoseBase shadow'); aShadow.setAttribute('d',apath); G_branchesP.appendChild(aShadow);
      const aVis=document.createElementNS(ns,'path'); aVis.setAttribute('class','hoseBase hose175'); aVis.setAttribute('d',apath); G_branchesP.appendChild(aVis);

      // Branch B (right) if used
      if(S.twoBranches){
        const bx = ex+20, by = ey-10, by2 = Math.max(8, by - (S.bnB.len/50)*45);
        const bpath = `M ${ex},${ey} L ${ex},${by} L ${bx},${by} L ${bx},${by2}`;
        const bShadow=document.createElementNS(ns,'path'); bShadow.setAttribute('class','hoseBase shadow'); bShadow.setAttribute('d',bpath); G_branchesP.appendChild(bShadow);
        const bVis=document.createElementNS(ns,'path'); bVis.setAttribute('class','hoseBase hose175'); bVis.setAttribute('d',bpath); G_branchesP.appendChild(bVis);
      }
    }

    // Label
    const npLabel = S.useWye
      ? (S.twoBranches ? 'Wye (two branches)' : 'Wye (single branch)')
      : `Nozzle ${S.mainNoz.NP} psi`;
    const lbl = `${S.mainLen}′ ${S.mainSize==='2.5'?'2½″':'1¾″'} @ ${S.flow} gpm — ${npLabel}${S.elev?` — Elev ${S.elev}′`:''}`;
    const text=document.createElementNS(ns,'text'); text.setAttribute('x', ex); text.setAttribute('y', ey-10); text.setAttribute('text-anchor','middle'); text.setAttribute('fill','#eaf2ff'); text.setAttribute('font-size','12'); text.textContent = lbl; G_labelsP.appendChild(text);
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
