// /js/view.practice.js
import { COEFF, FL_total, FL, PSI_PER_FT } from './store.js';

const TRUCK_W = 390;
const TRUCK_H = 260;
const PX_PER_50FT = 45;
const CURVE_PULL = 36;
const BRANCH_LIFT = 10;
const TOL = 1; // fixed ±1 psi

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

        <!-- Hose color key + formulas (kept) -->
        <div class="hoseLegend" style="margin-top:8px">
          <span class="legSwatch sw175"></span> 1¾″
          <span class="legSwatch sw25"></span> 2½″
          <span class="legSwatch sw5"></span> 5″
        </div>
        <div class="mini" style="margin-top:6px;opacity:.9">
          <div><b>Friction Loss:</b> <code>FL/100′ = C × (GPM/100)²</code>, &nbsp; <code>FL(length) = FL/100′ × (length/100)</code></div>
          <div><b>C Coefficients:</b> 1¾″ = <b>${COEFF["1.75"]}</b>, 2½″ = <b>${COEFF["2.5"]}</b>, 5″ = <b>${COEFF["5"]}</b></div>
          <div style="margin-top:4px"><b>PP equations:</b>
            <ul class="simpleList" style="margin-top:4px">
              <li><b>Single line:</b> <code>PP = NP + Main FL ± Elev</code></li>
              <li><b>Single branch via wye:</b> <code>PP = NP(branch) + Branch FL + Main FL ± Elev</code></li>
              <li><b>Two-branch wye:</b> <code>PP = max(Need A, Need B) + Main FL + Wye ± Elev</code></li>
            </ul>
          </div>
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

  // ===== scenario generator (realistic; rarely >250)
  function makeRealisticScenario(){
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
      PDP = mainNoz.NP + mainFL + elevFt*PSI_PER_FT;
    }else if(twoBranches){
      const needA = bnA.noz.NP + FL_total(bnA.noz.gpm, [{size:'1.75', lengthFt:bnA.len}]);
      const needB = bnB.noz.NP + FL_total(bnB.noz.gpm, [{size:'1.75', lengthFt:bnB.len}]);
      PDP = Math.max(needA, needB) + mainFL + wyeLoss + elevFt*PSI_PER_FT;
    }else{
      const needBranch = bnA.noz.NP + FL_total(bnA.noz.gpm, [{size:'1.75', lengthFt:bnA.len}]);
      PDP = needBranch + mainFL + elevFt*PSI_PER_FT;
    }

    return {
      mainSize, mainLen, elevFt, mainNoz,
      useWye, twoBranches, bnA, bnB, wyeLoss,
      flow, PDP: Math.round(PDP)
    };
  }
  function generateBiasedScenario(){
    let S;
    for(let i=0;i<12;i++){ S = makeRealisticScenario(); if(S.PDP<=250) return S; }
    return S;
  }

  // ===== label helpers (with overlap guard)
  const placedLabels = [];
  function placeY(y){
    // If another label is within 14px vertically, bump this one up
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

    // Compute SVG height and layout
    const branchMax = S.useWye ? Math.max(S.bnA.len, S.twoBranches? S.bnB.len : 0) : 0;
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
    main.setAttribute('class', `hoseBase ${S.mainSize==='2.5'?'hose25':'hose175'}`);
    main.setAttribute('d', geom.d);
    const L = base.getTotalLength();
    main.setAttribute('stroke-dasharray', `${L} ${L}`);
    main.setAttribute('stroke-dashoffset','0');
    G_hosesP.appendChild(main);

    // BRANCHES (from the end of main)
    let aGeom=null, bGeom=null;
    if(S.useWye){
      // A (left)
      const aPx = (S.bnA.len/50)*PX_PER_50FT;
      aGeom = straightBranch('L', geom.endX, geom.endY, aPx);
      const aSh = document.createElementNS(ns,'path'); aSh.setAttribute('class','hoseBase shadow'); aSh.setAttribute('d', aGeom.d); G_branchesP.appendChild(aSh);
      const a = document.createElementNS(ns,'path'); a.setAttribute('class','hoseBase hose175'); a.setAttribute('d', aGeom.d); G_branchesP.appendChild(a);

      // B (right) if any
      if(S.twoBranches){
        const bPx = (S.bnB.len/50)*PX_PER_50FT;
        bGeom = straightBranch('R', geom.endX, geom.endY, bPx);
        const bSh = document.createElementNS(ns,'path'); bSh.setAttribute('class','hoseBase shadow'); bSh.setAttribute('d', bGeom.d); G_branchesP.appendChild(bSh);
        const b = document.createElementNS(ns,'path'); b.setAttribute('class','hoseBase hose175'); b.setAttribute('d', bGeom.d); G_branchesP.appendChild(b);
      }
    }

    // ==== LABELS ON THE GRAPHIC (only here, nothing below)
    // Rule: always show main length (and size). If wye: branches only show GPM and Elev psi.
    const elevPsi = Math.round(S.elevFt * PSI_PER_FT);

    // Main label: length + size; if no wye, also show NP and GPM
    const mainText = !S.useWye
      ? `${S.mainLen}′ ${sizeLabel(S.mainSize)} — ${S.flow} gpm — NP ${S.mainNoz.NP} psi${S.elevFt?` — Elev ${S.elevFt}′ (${elevPsi} psi)`:''}`
      : `${S.mainLen}′ ${sizeLabel(S.mainSize)}${S.elevFt?` — Elev ${S.elevFt}′ (${elevPsi} psi)`:''}`;
    addLabel(geom.endX, Math.max(12, geom.endY - 12), mainText);

    if(S.useWye){
      // Branch A label: only GPM and Elev
      addLabel(
        aGeom.endX,
        Math.max(12, aGeom.endY - 12),
        `A: ${S.bnA.noz.gpm} gpm${S.elevFt?` — Elev ${S.elevFt}′ (${elevPsi} psi)`:''}`
      );
      // Branch B label: only GPM and Elev
      if(S.twoBranches && bGeom){
        addLabel(
          bGeom.endX,
          Math.max(12, bGeom.endY - 12),
          `B: ${S.bnB.noz.gpm} gpm${S.elevFt?` — Elev ${S.elevFt}′ (${elevPsi} psi)`:''}`
        );
      }
    }
  }

  // ===== Build human-readable PP breakdown for Reveal (with explicit FL equation)
  function buildReveal(S){
    const E = S.elevFt * PSI_PER_FT;
    const mainFL = FL_total(S.flow, [{size:S.mainSize, lengthFt:S.mainLen}]);

    const flEq = (gpm, size, lenFt) => {
      const C = COEFF[size];
      const per100 = C * Math.pow(gpm/100, 2);
      const flLen = per100 * (lenFt/100);
      return { C, per100, flLen };
    };

    if(!S.useWye){
      const { C, per100, flLen } = flEq(S.flow, S.mainSize, S.mainLen);
      const total = S.mainNoz.NP + flLen + E;
      return {
        total: Math.round(total),
        html: `
          <div><b>Simple PP (Single line)</b></div>
          <ul class="simpleList">
            <li>Nozzle Pressure = <b>${S.mainNoz.NP} psi</b></li>
            <li>Main FL: <code>FL/100′ = C × (G/100)² = ${C} × (${S.flow}/100)² = ${per100.toFixed(1)}</code></li>
            <li> → <code>FL(length) = ${per100.toFixed(1)} × (${S.mainLen}/100) = ${Math.round(flLen)} psi</code></li>
            <li>Elevation = ${E>=0?'+':''}${Math.round(E)} psi</li>
          </ul>
          <div><b>PP = ${S.mainNoz.NP} + ${Math.round(flLen)} ${E>=0?'+':''}${Math.round(E)} = <span class="ok">${Math.round(total)} psi</span></b></div>
        `
      };
    }

    if(S.useWye && !S.twoBranches){
      const b = flEq(S.bnA.noz.gpm, '1.75', S.bnA.len);
      const m = flEq(S.flow, S.mainSize, S.mainLen);
      const total = S.bnA.noz.NP + b.flLen + m.flLen + E;
      return {
        total: Math.round(total),
        html: `
          <div><b>Simple PP (Single branch via wye)</b></div>
          <ul class="simpleList">
            <li>Branch NP = <b>${S.bnA.noz.NP} psi</b></li>
            <li>Branch FL: <code>FL/100′ = ${COEFF['1.75']} × (${S.bnA.noz.gpm}/100)² = ${b.per100.toFixed(1)}</code></li>
            <li> → <code>FL(length) = ${b.per100.toFixed(1)} × (${S.bnA.len}/100) = ${Math.round(b.flLen)} psi</code></li>
            <li>Main FL: <code>FL/100′ = ${COEFF[S.mainSize]} × (${S.flow}/100)² = ${m.per100.toFixed(1)}</code></li>
            <li> → <code>FL(length) = ${m.per100.toFixed(1)} × (${S.mainLen}/100) = ${Math.round(m.flLen)} psi</code></li>
            <li>Elevation = ${E>=0?'+':''}${Math.round(E)} psi</li>
          </ul>
          <div><b>PP = ${S.bnA.noz.NP} + ${Math.round(b.flLen)} + ${Math.round(m.flLen)} ${E>=0?'+':''}${Math.round(E)} = <span class="ok">${Math.round(total)} psi</span></b></div>
        `
      };
    }

    // two-branch wye
    const a = flEq(S.bnA.noz.gpm, '1.75', S.bnA.len);
    const b = flEq(S.bnB.noz.gpm, '1.75', S.bnB.len);
    const m = flEq(S.flow, S.mainSize, S.mainLen);

    const needA = S.bnA.noz.NP + a.flLen;
    const needB = S.bnB.noz.NP + b.flLen;
    const higher = Math.max(needA, needB);
    const total = higher + m.flLen + S.wyeLoss + E;

    return {
      total: Math.round(total),
      html: `
        <div><b>Simple PP (Wye)</b></div>
        <ul class="simpleList">
          <li>Branch A: <code>NeedA = NP ${S.bnA.noz.NP} + FL_A</code>, where <code>FL_A/100′ = ${COEFF['1.75']} × (${S.bnA.noz.gpm}/100)² = ${a.per100.toFixed(1)}</code>, so <code>FL_A = ${a.per100.toFixed(1)} × (${S.bnA.len}/100) = ${Math.round(a.flLen)} psi</code> → <b>${Math.round(needA)} psi</b></li>
          <li>Branch B: <code>NeedB = NP ${S.bnB.noz.NP} + FL_B</code>, where <code>FL_B/100′ = ${COEFF['1.75']} × (${S.bnB.noz.gpm}/100)² = ${b.per100.toFixed(1)}</code>, so <code>FL_B = ${b.per100.toFixed(1)} × (${S.bnB.len}/100) = ${Math.round(b.flLen)} psi</code> → <b>${Math.round(needB)} psi</b></li>
          <li>Take higher branch = <b>${Math.round(higher)} psi</b></li>
          <li>Main FL: <code>FL/100′ = ${COEFF[S.mainSize]} × (${S.flow}/100)² = ${m.per100.toFixed(1)}</code>, so <code>FL = ${m.per100.toFixed(1)} × (${S.mainLen}/100) = ${Math.round(m.flLen)} psi</code></li>
          <li>Wye loss = +<b>${S.wyeLoss} psi</b></li>
          <li>Elevation = ${E>=0?'+':''}${Math.round(E)} psi</li>
        </ul>
        <div><b>PP = ${Math.round(higher)} + ${Math.round(m.flLen)} + ${S.wyeLoss} ${E>=0?'+':''}${Math.round(E)} = <span class="ok">${Math.round(total)} psi</span></b></div>
      `
    };
  }

  // Generate & render
  function makePractice(){
    const S = generateBiasedScenario();
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
      // Keep breakdown hidden when correct (unless they press Reveal)
      workEl.innerHTML = '';
    }else{
      statusEl.innerHTML = `<span class="alert">❌ Not quite.</span> (Answer ${practiceAnswer} psi; Δ ${diff})`;
      // On miss, show the full breakdown automatically
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

  // default state
  practiceAnswer = null;
  scenario = null;

  return { dispose(){} };
}

export default { render };
