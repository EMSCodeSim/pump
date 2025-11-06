// ./js/view.charts.js
// Phone-friendly Charts view, updated per user request.
// - Added extended nozzle list including Chief XD fogs
// - Removed attack-line rules of thumb
// - Added pumping, standpipe, cellar, piercing, foam, sprinkler rules

import { COEFF } from './store.js';

/**
 * Charts View
 * Sections:
 * 1) Nozzles (Smooth Bore | Fog | Chief XD Fog)
 * 2) Hose Friction
 * 3) Rules of Thumb (Pumping, Cellar, Piercing, Foam, Standpipe, Sprinkler)
 */

export async function render(container){
  container.innerHTML = `
    <section class="stack">

      <!-- Launcher Buttons -->
      <section class="card">
        <div class="controls" style="display:flex; gap:6px; flex-wrap:nowrap">
          <button class="btn primary" id="btnShowNozzles" type="button">Nozzles</button>
          <button class="btn" id="btnShowFL" type="button">Hose Friction</button>
          <button class="btn" id="btnShowRules" type="button">Rules of Thumb</button>
        </div>
        <div class="status" style="margin-top:8px">Pick a topic to view details.</div>
      </section>

      <!-- NOZZLES -->
      <section class="card" id="nozzlesCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Nozzles</div>

        <div class="tabRow" style="display:flex; gap:6px; flex-wrap:nowrap">
          <button id="tabSB" class="tabOn" type="button">Smooth Bore</button>
          <button id="tabFog" class="tabOff" type="button">Fog</button>
          <button id="tabChief" class="tabOff" type="button">Chief XD Fog</button>
        </div>

        <!-- Panels -->
        <div id="nozzlesSB" class="nozzWrap" style="margin-top:10px"></div>
        <div id="nozzlesFog" class="nozzWrap" style="margin-top:10px; display:none"></div>
        <div id="nozzlesChief" class="nozzWrap" style="margin-top:10px; display:none"></div>
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

  /* Style fixes for iPhone */
  injectLocalStyles(container, `
.controls{display:flex;gap:6px;flex-wrap:nowrap}
.controls .btn{flex:1 1 0;min-width:0;white-space:nowrap}
@media (max-width:420px){
  .controls .btn{padding:8px 6px;font-size:13px;line-height:1.1}
}
  `);

  /* Grabs */
  const btnShowNozzles = container.querySelector('#btnShowNozzles');
  const btnShowFL = container.querySelector('#btnShowFL');
  const btnShowRules = container.querySelector('#btnShowRules');

  const nozzCard = container.querySelector('#nozzlesCard');
  const flCard = container.querySelector('#flCard');
  const rulesCard = container.querySelector('#rulesCard');

  const tabSB = container.querySelector('#tabSB');
  const tabFog = container.querySelector('#tabFog');
  const tabChief = container.querySelector('#tabChief');

  const wrapSB = container.querySelector('#nozzlesSB');
  const wrapFog = container.querySelector('#nozzlesFog');
  const wrapChief = container.querySelector('#nozzlesChief');

  const flButtons = container.querySelector('#flButtons');
  const flResults = container.querySelector('#flResults');

  const rulesList = container.querySelector('#rulesList');

  function showCard(card){
    nozzCard.style.display = 'none';
    flCard.style.display = 'none';
    rulesCard.style.display = 'none';
    card.style.display = '';
  }

  btnShowNozzles.addEventListener('click', ()=> showCard(nozzCard));
  btnShowFL.addEventListener('click', ()=> showCard(flCard));
  btnShowRules.addEventListener('click', ()=> showCard(rulesCard));

  /* TAB SWITCHING */
  tabSB.addEventListener('click', ()=>{
    tabSB.className = "tabOn";
    tabFog.className = "tabOff";
    tabChief.className = "tabOff";
    wrapSB.style.display = '';
    wrapFog.style.display = 'none';
    wrapChief.style.display = 'none';
  });

  tabFog.addEventListener('click', ()=>{
    tabSB.className = "tabOff";
    tabFog.className = "tabOn";
    tabChief.className = "tabOff";
    wrapSB.style.display = 'none';
    wrapFog.style.display = '';
    wrapChief.style.display = 'none';
  });

  tabChief.addEventListener('click', ()=>{
    tabSB.className = "tabOff";
    tabFog.className = "tabOff";
    tabChief.className = "tabOn";
    wrapSB.style.display = 'none';
    wrapFog.style.display = 'none';
    wrapChief.style.display = '';
  });

  /* NOZZLE TABLES */

  function makeSB(){
    const sizes = [
      {tip:"7/8\"", gpm:160, np:50},
      {tip:"15/16\"", gpm:185, np:50},
      {tip:"1\"", gpm:210, np:50},
      {tip:"1 1/8\"", gpm:265, np:50},
      {tip:"1 1/4\"", gpm:325, np:50},
      {tip:"1 3/8\"", gpm:500, np:80},
      {tip:"1 1/2\"", gpm:600, np:80},
      {tip:"1 3/4\"", gpm:800, np:100},
    ];
    return `
      <table class="chartTable">
        <tr><th>Tip</th><th>GPM</th><th>NP (psi)</th></tr>
        ${sizes.map(s=>`<tr><td>${s.tip}</td><td>${s.gpm}</td><td>${s.np}</td></tr>`).join('')}
      </table>
    `;
  }

  function makeFog(){
    const data = [
      {desc:"1½\" Fog", gpm:150, np:75},
      {desc:"1¾\" Fog", gpm:185, np:50},
      {desc:"2½\" Fog", gpm:250, np:75},
      {desc:"Combo Fog 95", gpm:95, np:100},
      {desc:"Combo Fog 125", gpm:125, np:100},
      {desc:"Combo Fog 150", gpm:150, np:100},
      {desc:"Variable Fog 75–200", gpm:"75–200", np:100},
    ];
    return `
      <table class="chartTable">
        <tr><th>Nozzle</th><th>Flow</th><th>NP</th></tr>
        ${data.map(s=>`<tr><td>${s.desc}</td><td>${s.gpm}</td><td>${s.np}</td></tr>`).join('')}
      </table>
    `;
  }

  function makeChief(){
    const data = [
      {desc:"Chief XD 1½\" 150 gpm", gpm:150, np:50},
      {desc:"Chief XD 1½\" 175 gpm", gpm:175, np:50},
      {desc:"Chief XD 1½\" 200 gpm", gpm:200, np:50},
      {desc:"Chief XD 1¾\" 185 gpm", gpm:185, np:50},
      {desc:"Chief XD 2½\" 250 gpm", gpm:250, np:50},
      {desc:"Chief XD Break Apart 150/185/200", gpm:"Varies", np:50},
    ];
    return `
      <table class="chartTable">
        <tr><th>Chief XD Model</th><th>GPM</th><th>NP</th></tr>
        ${data.map(s=>`<tr><td>${s.desc}</td><td>${s.gpm}</td><td>${s.np}</td></tr>`).join('')}
      </table>
    `;
  }

  wrapSB.innerHTML = makeSB();
  wrapFog.innerHTML = makeFog();
  wrapChief.innerHTML = makeChief();

  /* HOSE FRICTION SECTION */

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
          <tr><th>GPM</th><th>FL / 100'</th></tr>
          ${flows.map(g=>{
            const fl = (C * Math.pow(g/100,2)).toFixed(1);
            return `<tr><td>${g}</td><td>${fl}</td></tr>`;
          }).join('')}
        </table>
      `;
    });
  });

  /* RULES OF THUMB – UPDATED */

  const rules = [
    /* Pumping */
    "Standpipe starting point: 150 psi + elevation",
    "Sprinkler FDC: 150 psi unless signage indicates otherwise",
    "Master Stream: Smooth Bore 80 psi NP, Fog 100 psi NP",
    "Elevation: +5 psi per floor",
    "LDH friction loss: ~1 psi per 100 ft at 1000 gpm",

    /* Special Nozzles */
    "Cellar Nozzle: ~250–300 gpm @ 100 psi NP",
    "Piercing Nozzle: 90–200 gpm @ 100 psi NP (start around 150 psi pump)",

    /* Foam */
    "Class A Foam: 0.3–1%",
    "Class B Hydrocarbon: 3%",
    "Class B Polar Solvent: 6%",
    "Foam Eductor: Needs ~200 psi inlet, ≤150 ft hose between eductor & nozzle",

    /* Standpipe */
    "High-rise rule: 150–175 psi pump for fire attack floors",
    "PRVs may limit flow—verify early",
    "Use 2½\" with smooth bore preferred in standpipe ops",

    /* Sprinkler */
    "Do not shut down sprinklers early—system holds the fire",
    "Supply all FDC inlets if present",
  ];

  rulesList.innerHTML = `
    <ul class="rulesUL">
      ${rules.map(r=>`<li>${escapeHTML(r)}</li>`).join('')}
    </ul>
  `;
} // end render()

/* Helpers */
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
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[m]));
}
