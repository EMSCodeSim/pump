// /js/view.practice.js
// Phone-friendly Practice page for hydraulics drills.
// Uses your shared store helpers (NFPA 0.05 psi/ft + appliance loss: +10 psi only if total GPM > 350).
//
// What this page lets you practice:
//   • Pick hose size + segments (one or more), GPM, and elevation
//   • Optional appliance at the line (auto 0/10 psi rule)
//   • Optional nozzle NP (from your nozzle catalog) or manual NP override
//   • See PDP and a clear “Why?” breakdown
//
// Mobile UX:
//   • Prevents iOS zoom (16px inputs), bigger tap targets, clean spacing
//   • Works without changing global app state (this page is sandboxed)

import {
  COEFF,
  PSI_PER_FT,
  FL,
  FL_total,
  sumFt,
  sizeLabel,
  NOZ,
  NOZ_LIST,
  computeApplianceLoss,
} from './store.js';

import {
  applyMobileFormStyles,
  enhanceNumericInputs,
  padTouchTargets,
} from './mobile-ui.js';

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

function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

function rnd(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function rndInt(min, max){ return Math.floor(Math.random()*(max-min+1)) + min; }

function round1(n){ return Math.round(n*10)/10; }
function round0(n){ return Math.round(n); }

// ———————————————————————————————————————————————————————————————
// PDP math helpers (reuse your shared store abstractions)
// ———————————————————————————————————————————————————————————————

function currentNozzle(selection, manualNP) {
  if (selection === 'manual') {
    return { name: 'Manual', NP: Number(manualNP) || 0, gpm: null, id: 'manual' };
  }
  const n = NOZ[selection];
  return n || { name: 'None', NP: 0, gpm: null, id: 'none' };
}

function calcPDP({ segs, gpm, elevFt, applianceOn, nozzleNP }) {
  const NP = nozzleNP || 0;
  const mainFL = FL_total(gpm, segs);
  const elevPsi = (Number(elevFt) || 0) * PSI_PER_FT;
  const appl = applianceOn ? computeApplianceLoss(gpm) : 0;
  const PDP = mainFL + elevPsi + appl + NP;
  return {
    PDP: round0(PDP),
    parts: { mainFL: round1(mainFL), elevPsi: round1(elevPsi), appl: round1(appl), NP: round1(NP) }
  };
}

// ———————————————————————————————————————————————————————————————
// Scenario generator (practice problems)
// ———————————————————————————————————————————————————————————————

function genSeg(size, ft){
  return { size, lengthFt: ft };
}

function makeWyeScenario() {
  // 2-line wye, equal length branches
  const mainSize = '2.5';
  const branchSize = '1.75';
  const gpmEach = rnd([120, 125, 130, 140, 150, 160]);
  const totalGPM = gpmEach * 2;

  // ONLY 50' MULTIPLES — removed 75
  let lenChoices = [50,100,150];

  const branchLen = rnd(lenChoices);
  const mainLen = rnd([100, 150, 200]);

  const elevFt = rnd([ -10, 0, 10, 20 ]);
  const applianceOn = true; // at the wye if GPM > 350 this will add +10 automatically

  const nozzleNP = rnd([ 50, 75, 100 ]); // fog/auto/solid mix

  const segs = [
    genSeg(mainSize, mainLen),
    genSeg(branchSize, branchLen),
    genSeg(branchSize, branchLen),
  ];

  return {
    kind: 'wye',
    text: `2-line wye: ${branchSize}" x ${branchLen}' each, into ${mainSize}" x ${mainLen}'. ${gpmEach} gpm per branch.`,
    gpm: totalGPM,
    elevFt,
    nozzleNP,
    applianceOn,
    segs,
    branch: { gpmEach, count: 2, size: branchSize, len: branchLen },
    main: { size: mainSize, len: mainLen }
  };
}

function makeSingleLineScenario() {
  const size = rnd(['1.75','2.5']);
  const gpm = size === '1.75' ? rnd([120,125,130,140,150,160,180]) : rnd([200,250,265,300,325,350]);
  const elevFt = rnd([-10, 0, 10, 20, 30]);

  // 50’ multiples only
  const lenChoices = [100,150,200,250,300];
  const lengthFt = rnd(lenChoices);

  const nozzleNP = rnd([50, 75, 100]);
  const applianceOn = gpm > 350; // realistic cut-in

  const segs = [ genSeg(size, lengthFt) ];
  return {
    kind: 'single',
    text: `${size}" x ${lengthFt}' flowing ${gpm} gpm`,
    gpm,
    elevFt,
    nozzleNP,
    applianceOn,
    segs
  };
}

function makeMasterStreamScenario() {
  // master stream often on 2.5" or 5"
  const size = rnd(['2.5', '5']);
  const gpm = rnd([400, 500, 600, 700, 800]);
  const elevFt = rnd([-10,0,10,20]);

  // 50’ multiples only
  const lenChoices = [100,150,200,250,300];
  const lengthFt = rnd(lenChoices);

  const nozzleNP = rnd([80, 100]);
  const applianceOn = true;

  const segs = [ genSeg(size, lengthFt) ];

  return {
    kind: 'master',
    text: `Master stream ${size}" x ${lengthFt}' flowing ${gpm} gpm`,
    gpm,
    elevFt,
    nozzleNP,
    applianceOn,
    segs
  };
}

function generateScenario() {
  const which = rnd(['wye', 'single', 'master', 'single', 'wye']);
  if (which === 'wye') return makeWyeScenario();
  if (which === 'master') return makeMasterStreamScenario();
  return makeSingleLineScenario();
}

// ———————————————————————————————————————————————————————————————
// Render practice UI
// ———————————————————————————————————————————————————————————————

function render(container) {
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
    </style>

    <section class="card">
      <div class="row" style="align-items:center; justify-content:space-between">
        <div>
          <b>Practice Mode</b>
          <div class="sub">Use the graphic info to find Pump Pressure (PP).</div>
        </div>
        <!-- BUTTON ORDER & LABELS UPDATED: New Question → Equations → Reveal -->
        <div class="practice-actions" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" id="newScenarioBtn">New Question</button>
          <button class="btn" id="eqToggleBtn">Equations</button>
          <button class="btn" id="revealBtn">Reveal</button>
        </div>
      </div>
    </section>

    <section class="wrapper card">
      <div class="stage" id="stageP">
        <svg id="overlayPractice" preserveAspectRatio="xMidYMax meet" aria-label="Visual stage (practice)"></svg>
      </div>

      <!-- Equations (hidden by default) -->
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

    <section class="card">
      <div class="row" style="align-items:flex-end">
        <div class="field" style="min-width:140px">
          <label>Hose Size</label>
          <select id="hoseSize">
            ${SIZES.map(s=>`<option value="${s}">${s}"</option>`).join('')}
          </select>
        </div>
        <div class="field" style="min-width:140px">
          <label>Flow (gpm)</label>
          <input type="number" id="gpm" value="150" step="5" inputmode="decimal">
        </div>
        <div class="field" style="min-width:140px">
          <label>Elevation (ft)</label>
          <input type="number" id="elev" value="0" step="5" inputmode="decimal">
        </div>
        <div class="field" style="min-width:140px">
          <label>Appliance</label>
          <select id="applianceOn">
            <option value="auto">Auto (0/+10)</option>
            <option value="on">Force +10</option>
            <option value="off">None</option>
          </select>
        </div>
        <div class="field" style="min-width:200px">
          <label>Nozzle</label>
          <select id="nozSel">
            <option value="none">None</option>
            ${NOZ_LIST.map(k=>`<option value="${k}">${NOZ[k].name} (NP ${NOZ[k].NP})</option>`).join('')}
            <option value="manual">Manual NP…</option>
          </select>
        </div>
        <div class="field" id="manualNPWrap" style="display:none; min-width:140px">
          <label>Manual NP</label>
          <input type="number" id="manualNP" value="50" step="5" inputmode="decimal">
        </div>
      </div>

      <!-- Segments editor -->
      <div id="segWrap" style="margin-top:12px"></div>

      <div class="row" style="margin-top:10px">
        <button class="btn" id="addSegBtn" type="button">+ Add Segment</button>
        <div style="opacity:.7; font-size:13px">All lengths use 50’ multiples in practice mode.</div>
      </div>
    </section>
  `;

  applyMobileFormStyles(container);
  padTouchTargets(container.querySelectorAll('button, input, select'));
  enhanceNumericInputs(container.querySelectorAll('input[type=number]'));

  const overlay = container.querySelector('#overlayPractice');
  const eqBox = container.querySelector('#eqBox');
  const eqToggleBtn = container.querySelector('#eqToggleBtn');
  const practiceInfo = container.querySelector('#practiceInfo');
  const workEl = container.querySelector('#work');
  const statusEl = container.querySelector('#status');

  let eqVisible = false;
  let scenario = null;
  let practiceAnswer = null;

  // ————————————————————————————————————
  // Segments editor
  // ————————————————————————————————————
  const segWrap = container.querySelector('#segWrap');
  const hoseSizeSel = container.querySelector('#hoseSize');
  hoseSizeSel.value = '1.75';

  let segs = [ genSeg(hoseSizeSel.value, 150) ];

  function renderSegs(){
    segWrap.innerHTML = '';
    segs.forEach((seg, idx)=>{
      const row = el(`
        <div class="row seg" data-i="${idx}">
          <div class="field" style="min-width:140px">
            <label>Diameter</label>
            <select class="segSize"></select>
          </div>
          <div class="field" style="min-width:140px">
            <label>Length (ft)</label>
            <input class="segLen" type="number" inputmode="decimal" step="50" min="0" value="${Number(seg.lengthFt)||0}">
          </div>
          <div class="field" style="min-width:120px; display:flex; align-items:flex-end">
            <button class="btn segDel" type="button" title="Remove segment">Remove</button>
          </div>
        </div>
      `);
      row.querySelector('.segSize').append(...SIZES.map(s=>option(s, `${s}"`)));
      row.querySelector('.segSize').value = seg.size;

      // enforce 50’ multiples
      const lenInput = row.querySelector('.segLen');
      lenInput.addEventListener('change', ()=>{
        const v = Math.max(0, Number(lenInput.value)||0);
        const snapped = Math.round(v/50)*50;
        lenInput.value = snapped;
        segs[idx].lengthFt = snapped;
      });

      row.querySelector('.segSize').addEventListener('change', (e)=>{
        segs[idx].size = e.target.value;
      });

      row.querySelector('.segDel').addEventListener('click', ()=>{
        segs.splice(idx,1);
        if(segs.length===0) segs.push(genSeg(hoseSizeSel.value, 100));
        renderSegs();
      });

      segWrap.appendChild(row);
    });
  }
  renderSegs();

  container.querySelector('#addSegBtn').addEventListener('click', ()=>{
    segs.push(genSeg(hoseSizeSel.value, 100));
    renderSegs();
  });

  hoseSizeSel.addEventListener('change', ()=>{
    // when base size changes, update existing segs' size to keep math simple
    segs = segs.map(s=>({ ...s, size: hoseSizeSel.value }));
    renderSegs();
  });

  // Nozzle manual NP toggle
  const nozSel = container.querySelector('#nozSel');
  const manualNPWrap = container.querySelector('#manualNPWrap');
  const manualNP = container.querySelector('#manualNP');
  nozSel.addEventListener('change', ()=>{
    manualNPWrap.style.display = nozSel.value === 'manual' ? 'block' : 'none';
  });

  // ————————————————————————————————————
  // Drawing
  // ————————————————————————————————————
  function drawScenario(S){
    overlay.innerHTML = `
      <g>
        <rect x="0" y="0" width="100%" height="100%" fill="#f8fafc" rx="12"></rect>
        <text x="12" y="24" font-size="14" fill="#0f172a">${S.text}</text>
      </g>
    `;
  }

  // Reveal builder (explain work)
  function buildReveal(S){
    const appl = S.applianceOn ? computeApplianceLoss(S.gpm) : 0;
    const NP = S.nozzleNP || 0;
    const fl = FL_total(S.gpm, S.segs);
    const elevPsi = (S.elevFt||0) * PSI_PER_FT;
    const total = round0(fl + elevPsi + appl + NP);
    const lines = [
      `Flow: ${S.gpm} gpm`,
      `Friction loss: ${round1(fl)} psi`,
      `Elevation: ${round1(elevPsi)} psi (${S.elevFt||0} ft)`,
      `Appliance: ${round1(appl)} psi`,
      `Nozzle pressure: ${round1(NP)} psi`,
      `—`,
      `Pump Pressure ≈ ${total} psi`
    ];
    return { total, lines };
  }

  function renderWork(lines){
    workEl.innerHTML = lines.map(l=>`<div>${l}</div>`).join('');
  }

  // Equations panel
  function renderEquations(S){
    if(!S) return `<div>Equations will reference the current scenario.</div>`;
    const list = [
      `FL = C × (Q/100)^2 × L`,
      `PDP = ΣFL + Elevation + Appliance + NP`,
      `Elevation ≈ ${PSI_PER_FT} psi/ft`
    ];
    return `<div>${list.map(x=>`<div>• ${x}</div>`).join('')}</div>`;
  }

  // Scenario creation + reset UI state
  const TOL = 5; // ± allowable
  function makePractice(){
    const S = generateScenario();
    scenario = S;

    // Refresh equations panel (scenario-aware) if visible
    if(eqVisible){
      eqBox.innerHTML = renderEquations(scenario);
    }

    const rev = buildReveal(S);
    practiceAnswer = rev.total;
    drawScenario(S);
    practiceInfo.textContent = `Scenario ready — enter your PP below (±${TOL} psi).`;
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
      renderWork(rev.lines);
    }else{
      statusEl.textContent = `❌ Not quite. Try again or tap Reveal.`;
    }
  });

  container.querySelector('#showBuildBtn').addEventListener('click', ()=>{
    if(!scenario){ statusEl.textContent = 'Generate a problem first.'; return; }
    const rev = buildReveal(scenario);
    renderWork(rev.lines);
  });

  // Toggle equations
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

  // Header quick buttons (optional external events)
  const onNew = ()=> makePractice();
  const onEq  = ()=>{
    eqVisible = !eqVisible;
    if(eqVisible){
      eqBox.innerHTML = renderEquations(scenario);
      eqBox.style.display = 'block';
      eqToggleBtn.textContent = 'Hide Equations';
    }else{
      eqBox.style.display = 'none';
      eqToggleBtn.textContent = 'Equations';
    }
  };

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
