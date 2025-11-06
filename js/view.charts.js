// ./js/view.charts.js
// Phone-friendly Charts view, with "Common GPM" bubbles removed.

import { COEFF } from './store.js';

/**
 * Charts View
 * - Sections:
 *   1) Nozzles  (Smooth Bore | Fog)  ← SB first, default selected
 *   2) Hose Friction Loss (horizontal hose-size buttons; FL per 100')
 *   3) Rules of Thumb
 * - Mobile polish: bigger tap targets, 16px inputs to prevent iOS zoom, responsive grids.
 */

export async function render(container){
  container.innerHTML = `
    <section class="stack">

      <!-- Section launchers -->
      <section class="card">
        <div class="controls" style="display:flex; gap:6px; flex-wrap:nowrap">
          <button class="btn primary" id="btnShowNozzles" type="button">Nozzles</button>
          <button class="btn" id="btnShowFL" type="button">Hose Friction</button>
          <button class="btn" id="btnShowRules" type="button">Rules of Thumb</button>
        </div>
        <div class="status" style="margin-top:8px">Pick a topic to view details.</div>
      </section>

      <!-- NOZZLES (hidden until pressed) -->
      <section class="card" id="nozzlesCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Nozzles</div>

        <div class="tabRow" style="display:flex; gap:6px">
          <button id="tabSB" class="tabOn" type="button">Smooth Bore</button>
          <button id="tabFog" class="tabOff" type="button">Fog</button>
        </div>

        <!-- Smooth Bore -->
        <div id="nozzlesSB" class="nozzWrap" style="margin-top:10px"></div>

        <!-- Fog -->
        <div id="nozzlesFog" class="nozzWrap" style="margin-top:10px; display:none"></div>
      </section>

      <!-- FL -->
      <section class="card" id="flCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Hose Friction</div>
        <div id="flButtons" style="display:flex; gap:6px; flex-wrap:wrap"></div>
        <div id="flResults" style="margin-top:12px"></div>
      </section>

      <!-- RULES -->
      <section class="card" id="rulesCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Rules of Thumb</div>
        <div id="rulesList"></div>
        <div class="mini" style="opacity:.95; margin-top:8px">
          Quick reference only; confirm with department SOGs/SOPs.
        </div>
      </section>

    </section>
  `;

  injectLocalStyles(container, `
/* Charts: keep launcher buttons on one row (iPhone-friendly) */
.controls{display:flex;gap:6px;flex-wrap:nowrap}
.controls .btn{flex:1 1 0;min-width:0;white-space:nowrap}
@media (max-width: 420px){
  .controls .btn{padding:8px 6px;font-size:13px;line-height:1.1}
}
  `);
  // Grab elements
  const btnShowNozzles = container.querySelector('#btnShowNozzles');
  const btnShowFL = container.querySelector('#btnShowFL');
  const btnShowRules = container.querySelector('#btnShowRules');

  const nozzCard = container.querySelector('#nozzlesCard');
  const flCard = container.querySelector('#flCard');
  const rulesCard = container.querySelector('#rulesCard');

  const tabSB = container.querySelector('#tabSB');
  const tabFog = container.querySelector('#tabFog');
  const wrapSB = container.querySelector('#nozzlesSB');
  const wrapFog = container.querySelector('#nozzlesFog');

  const flButtons = container.querySelector('#flButtons');
  const flResults = container.querySelector('#flResults');

  const rulesList = container.querySelector('#rulesList');

  function showCard(card){
    nozzCard.style.display = 'none';
    flCard.style.display = 'none';
    rulesCard.style.display = 'none';

    card.style.display = '';
  }

  // Launcher events
  btnShowNozzles.addEventListener('click', ()=> showCard(nozzCard));
  btnShowFL.addEventListener('click', ()=> showCard(flCard));
  btnShowRules.addEventListener('click', ()=> showCard(rulesCard));

  // Smooth Bore / Fog switch
  tabSB.addEventListener('click', ()=>{
    tabSB.className = "tabOn";
    tabFog.className = "tabOff";
    wrapSB.style.display = '';
    wrapFog.style.display = 'none';
  });

  tabFog.addEventListener('click', ()=>{
    tabSB.className = "tabOff";
    tabFog.className = "tabOn";
    wrapSB.style.display = 'none';
    wrapFog.style.display = '';
  });

  // Build nozzle tables
  function makeSB(){
    const sizes = [
      {tip:"1 1/8", gpm:265, np:50},
      {tip:"1 1/4", gpm:325, np:50},
      {tip:"1 3/8", gpm:500, np:80},
      {tip:"1 1/2", gpm:600, np:80},
      {tip:"1 3/4", gpm:800, np:100},
    ];
    return `
      <table class="chartTable">
        <tr><th>Tip</th><th>GPM</th><th>NP</th></tr>
        ${sizes.map(s=>`<tr><td>${s.tip}</td><td>${s.gpm}</td><td>${s.np}</td></tr>`).join('')}
      </table>
    `;
  }

  function makeFog(){
    const data = [
      {desc:"1 1/2\" Fog", gpm:150, np:75},
      {desc:"1 3/4\" Fog", gpm:185, np:50},
      {desc:"2 1/2\" Fog", gpm:250, np:75},
    ];
    return `
      <table class="chartTable">
        <tr><th>Nozzle</th><th>GPM</th><th>NP</th></tr>
        ${data.map(s=>`<tr><td>${s.desc}</td><td>${s.gpm}</td><td>${s.np}</td></tr>`).join('')}
      </table>
    `;
  }

  wrapSB.innerHTML = makeSB();
  wrapFog.innerHTML = makeFog();
  // FL Buttons
  const hoseSizes = [
    {label:'1 1/2"', c:24},
    {label:'1 3/4"', c:15.5},
    {label:'2 1/2"', c:2},
    {label:'3"', c:0.8},
    {label:'5"', c:0.08},
  ];

  flButtons.innerHTML = hoseSizes.map(h=>`
    <button class="btn" data-c="${h.c}" type="button">${h.label}</button>
  `).join('');

  flButtons.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const C = Number(btn.dataset.c);
      const flows = buildRange(50, 400, 50);
      flResults.innerHTML = `
        <table class="chartTable">
          <tr><th>GPM</th><th>FL per 100'</th></tr>
          ${flows.map(g=>{
            const fl = (C * Math.pow(g/100,2)).toFixed(1);
            return `<tr><td>${g}</td><td>${fl}</td></tr>`;
          }).join('')}
        </table>
      `;
    });
  });

  // Rules of Thumb
  const rules = [
    "1 3/4\" handline ≈ 150–185 gpm",
    "2 1/2\" handline ≈ 250–325 gpm",
    "Master stream ≈ 500–1000 gpm",
    "Friction loss ↑ with square of flow (GPM² rule)",
    "Elevation: +5 psi per 10 feet",
    "SBNP: 50 psi (handline), 80 psi (bigger tips), 100 psi (very large)",
  ];

  rulesList.innerHTML = `
    <ul class="rulesUL">
      ${rules.map(r=>`<li>${escapeHTML(r)}</li>`).join('')}
    </ul>
  `;
} // end render()

/* ========== helpers ========== */
function buildRange(start, end, step){
  const arr = [];
  for(let g=start; g<=end; g+=step) arr.push(g);
  return arr;
}

function injectLocalStyles(root, cssText){
  const style = document.createElement('style');
  style.textContent = cssText;
  root.appendChild(style);
}

function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

