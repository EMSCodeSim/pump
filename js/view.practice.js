// /js/view.practice.js
import { FL_total, PSI_PER_FT } from './store.js';

export async function render(container){
  container.innerHTML = `
    <section class="stack">

      <!-- Visual first (matches Calculations placement) -->
      <section class="wrapper card">
        <div class="stage">
          <svg id="overlayPractice" viewBox="0 0 390 260" preserveAspectRatio="xMidYMax meet" aria-label="Visual stage (practice)">
            <image href="https://fireopssim.com/pump/engine181.png" x="0" y="0" width="390" height="260"></image>
            <g id="hosesP"></g><g id="branchesP"></g><g id="labelsP"></g>
          </svg>
          <div class="info" id="practiceInfo">Tap <b>New Problem</b> to generate a scenario.</div>
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
          <div class="field" style="max-width:140px">
            <button class="btn" id="revealBtn" style="width:100%">Reveal</button>
          </div>
        </div>
        <div id="practiceStatus" class="status" style="margin-top:8px">No scenario loaded.</div>
      </section>

      <!-- New Problem button sits below the answer row -->
      <section class="card">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" id="newScenarioBtn">New Problem</button>
        </div>
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
  function randPick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  // ===== generator (kept intentionally simple)
  function makePractice(){
    clearPractice();

    // Main line parameters
    const sizeMain = Math.random()<0.4 ? '2.5' : '1.75';
    const lenMain = randPick([150,200,250,300]);
    const elev = randPick([0,10,20,30,40]);

    // Nozzle on main (random common choices)
    const mainNoz = randPick([
      {gpm:185, NP:50, label:'ChiefXD 185@50'},
      {gpm:150, NP:75, label:'Fog 150@75'},
      {gpm:185, NP:75, label:'Fog 185@75'},
      {gpm:265, NP:50, label:'SB 1 1/8 265@50'}
    ]);

    // Optional single branch via wye
    const withWye = Math.random() < 0.35;
    let branchLen=0, branchGpm=0, branchNP=0, wyeLoss=0;
    if(withWye){
      branchLen = randPick([50,100,150]);
      branchGpm = randPick([150,185]);
      branchNP = randPick([50,75]);
      wyeLoss = 10;
    }

    // ===== draw main path
    const totalPx = (lenMain/50)*45;
    const sx=200, sy=220; const ex=200, ey=Math.max(18, sy-totalPx);
    const pathData = `M ${sx},${sy} Q 200 ${sy-totalPx*0.6} ${ex},${ey}`;
    const base=document.createElementNS(ns,'path'); base.setAttribute('d', pathData); G_hosesP.appendChild(base);

    const shadow=document.createElementNS(ns,'path');
    shadow.setAttribute('class','hoseBase shadow'); shadow.setAttribute('d', pathData);
    G_hosesP.appendChild(shadow);

    const mainPath=document.createElementNS(ns,'path');
    mainPath.setAttribute('class',`hoseBase ${sizeMain==='2.5'?'hose25':'hose175'}`);
    mainPath.setAttribute('d', pathData);
    const L = base.getTotalLength();
    mainPath.setAttribute('stroke-dasharray', `${L} ${L}`);
    mainPath.setAttribute('stroke-dashoffset','0');
    G_hosesP.appendChild(mainPath);

    // ===== draw branch (if any)
    if(withWye){
      const bx = ex+20, by = ey-10, by2 = Math.max(8, by - (branchLen/50)*45);
      const bpath = `M ${ex},${ey} L ${ex},${by} L ${bx},${by} L ${bx},${by2}`;
      const bShadow=document.createElementNS(ns,'path'); bShadow.setAttribute('class','hoseBase shadow'); bShadow.setAttribute('d',bpath); G_branchesP.appendChild(bShadow);
      const bVis=document.createElementNS(ns,'path'); bVis.setAttribute('class','hoseBase hose175'); bVis.setAttribute('d',bpath); G_branchesP.appendChild(bVis);
    }

    // ===== compute PP
    const flow = withWye ? (branchGpm + mainNoz.gpm) : mainNoz.gpm;
    const mainFL = FL_total(flow, [{size:sizeMain, lengthFt:lenMain}]);
    let PDP=0;
    if(withWye){
      const bnFL = FL_total(branchGpm, [{size:'1.75', lengthFt:branchLen}]);
      const needA = branchNP + bnFL;
      const needB = mainNoz.NP;
      PDP = Math.max(needA, needB) + mainFL + wyeLoss + elev*PSI_PER_FT;
    } else {
      PDP = mainNoz.NP + mainFL + elev*PSI_PER_FT;
    }
    practiceAnswer = Math.round(PDP);

    // ===== labels
    const npLabel = withWye ? 'via Wye' : `Nozzle ${mainNoz.NP} psi`;
    const lbl = `${lenMain}′ @ ${withWye? (mainNoz.gpm + branchGpm) : mainNoz.gpm} gpm — ${npLabel}${elev?` — Elev ${elev}′`:''}`;
    const text=document.createElementNS(ns,'text'); text.setAttribute('x', ex); text.setAttribute('y', ey-10); text.setAttribute('text-anchor','middle'); text.setAttribute('fill','#eaf2ff'); text.setAttribute('font-size','12'); text.textContent = lbl; G_labelsP.appendChild(text);

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
