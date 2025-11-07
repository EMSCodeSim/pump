// ./js/view.charts.js
// Charts view with Wildland + hose friction common-GPMs + Chief XD 2½" 265 @ 50 psi.
//
// Buttons: Nozzles, Hose Friction, Rules of Thumb, Wildland
// Wildland card: flame length chart, LCES, 10 Orders, 18 Watch-Outs,
// hose lay tips, pump-and-roll, safety zone calculator, spotting distances,
// weather factors, hand signals, ICS quick ref, map symbology.

import { COEFF } from './store.js';

export async function render(container){
  container.innerHTML = `
    <section class="stack">

      <!-- Launcher Buttons -->
      <section class="card">
        <div class="controls chartsButtons" style="display:flex; gap:6px; flex-wrap:wrap">
          <button class="btn primary" id="btnShowNozzles" type="button">Nozzles</button>
          <button class="btn" id="btnShowFL" type="button">Hose Friction</button>
          <button class="btn" id="btnShowRules" type="button">Rules of Thumb</button>
          <button class="btn" id="btnShowWildland" type="button">Wildland</button>
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
        <div id="flCommonWrap" style="margin-top:12px"></div>
      </section>

      <!-- RULES -->
      <section class="card" id="rulesCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Rules of Thumb</div>
        <div id="rulesList"></div>
        <div class="mini" style="opacity:.95; margin-top:8px">
          Quick reference only; confirm with department SOGs/SOPs.
        </div>
      </section>

      <!-- WILDLAND -->
      <section class="card" id="wildCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Wildland Reference</div>

        <h4 class="subhead">Flame Length vs Tactics</h4>
        <div id="wlFlame"></div>

        <div class="grid2">
          <div>
            <h4 class="subhead">LCES</h4>
            <ul class="tight">
              <li><b>L</b>ookouts</li>
              <li><b>C</b>ommunications</li>
              <li><b>E</b>scape Routes</li>
              <li><b>S</b>afety Zones</li>
            </ul>
          </div>
          <div>
            <h4 class="subhead">Safety Zone Estimator</h4>
            <div class="row" style="display:flex; gap:6px; align-items:center">
              <label for="wlFlameFt" class="mini">Flame height (ft)</label>
              <input id="wlFlameFt" type="number" inputmode="decimal" placeholder="e.g., 8" style="width:90px">
              <button id="wlCalcZone" class="btn small" type="button">Calc</button>
            </div>
            <div class="mini" id="wlZoneOut" style="margin-top:6px; opacity:.9"></div>
          </div>
        </div>

        <div class="grid2">
          <div>
            <h4 class="subhead">10 Standard Orders</h4>
            <ol class="tight small" id="wlOrders"></ol>
          </div>
          <div>
            <h4 class="subhead">18 Watch-Outs</h4>
            <ol class="tight small" id="wlWatchouts"></ol>
          </div>
        </div>

        <h4 class="subhead">Hose Lays & Pump-and-Roll</h4>
        <ul class="tight">
          <li>Progressive lay basics; plan packs per distance.</li>
          <li>Forestry 1″: ~6 psi / 100′; Forestry 1½″: ~2 psi / 100′ (rule of thumb).</li>
          <li>Pump-and-roll: keep PDP ~50–85 psi for safe nozzle handling.</li>
        </ul>

        <div class="grid2">
          <div>
            <h4 class="subhead">Spotting Distance (typical)</h4>
            <ul class="tight">
              <li>Grass: ~0.1–0.3 mi</li>
              <li>Brush: ~0.25–1 mi</li>
              <li>Timber: ~1–5 mi</li>
            </ul>
          </div>
          <div>
            <h4 class="subhead">Weather Factors</h4>
            <ul class="tight">
              <li>RH &lt; 20% → explosive potential</li>
              <li>Wind &gt; 10 mph → head fire formation</li>
              <li>Slope: rate of spread ↑ with grade</li>
            </ul>
          </div>
        </div>

        <div class="grid2">
          <div>
            <h4 class="subhead">Common Hand Signals</h4>
            <ul class="tight">
              <li>Stop / Go / Move L–R</li>
              <li>Need water / Need help</li>
            </ul>
          </div>
          <div>
            <h4 class="subhead">ICS Quick Ref (Wildland)</h4>
            <ul class="tight">
              <li>ENGB, FFT1, FFT2, SOFR</li>
              <li>DIVS, TFLD, DOZB, STEN</li>
            </ul>
          </div>
        </div>

        <h4 class="subhead">Map Symbology (Simplified)</h4>
        <ul class="tight">
          <li>Completed / Uncompleted line</li>
          <li>Dozer line, Drop points</li>
          <li>Safety zones, Escape routes</li>
        </ul>

        <div class="mini" style="opacity:.95; margin-top:8px">
          Quick reference only; follow NWCG/FH and your agency’s SOGs.
        </div>
      </section>

    </section>
  `;

  // Local styles (phone layout puts Wildland button on second row)
  injectLocalStyles(container, `
.controls.chartsButtons .btn{flex:1 1 0;min-width:0;white-space:nowrap}
@media (max-width:420px){
  .controls.chartsButtons .btn{flex:1 1 48%; padding:8px 6px; font-size:13px; line-height:1.1}
  #btnShowWildland{flex-basis:100%; order:99;} /* force Wildland onto its own second row */
}
.grid2{display:grid; grid-template-columns:1fr 1fr; gap:10px; align-items:start}
@media (max-width:560px){ .grid2{grid-template-columns:1fr} }
.subhead{margin:12px 0 6px 0; font-weight:700}
.tight{margin:0; padding-left:18px}
.tight li{margin:2px 0}
.small{font-size:.95em}
.chartTable{width:100%; border-collapse:collapse}
.chartTable th,.chartTable td{border-bottom:1px solid rgba(0,0,0,.08); padding:6px 8px; text-align:left}
.tabOn{background:#0b2b45;color:#fff;border-radius:6px;padding:6px 10px}
.tabOff{background:#e8f0f7;color:#0b2b45;border-radius:6px;padding:6px 10px}
  `);

  /* Grabs */
  const btnShowNozzles = container.querySelector('#btnShowNozzles');
  const btnShowFL = container.querySelector('#btnShowFL');
  const btnShowRules = container.querySelector('#btnShowRules');
  const btnShowWildland = container.querySelector('#btnShowWildland');

  const nozzCard = container.querySelector('#nozzlesCard');
  const flCard = container.querySelector('#flCard');
  const rulesCard = container.querySelector('#rulesCard');
  const wildCard = container.querySelector('#wildCard');

  const tabSB = container.querySelector('#tabSB');
  const tabFog = container.querySelector('#tabFog');
  const tabChief = container.querySelector('#tabChief');

  const wrapSB = container.querySelector('#nozzlesSB');
  const wrapFog = container.querySelector('#nozzlesFog');
  const wrapChief = container.querySelector('#nozzlesChief');

  const flButtons = container.querySelector('#flButtons');
  const flResults = container.querySelector('#flResults');
  const flCommonWrap = container.querySelector('#flCommonWrap');

  const rulesList = container.querySelector('#rulesList');

  /* Navigation */
  function showCard(card){
    nozzCard.style.display = 'none';
    flCard.style.display = 'none';
    rulesCard.style.display = 'none';
    wildCard.style.display = 'none';
    card.style.display = '';
  }
  btnShowNozzles.addEventListener('click', ()=> showCard(nozzCard));
  btnShowFL.addEventListener('click', ()=> showCard(flCard));
  btnShowRules.addEventListener('click', ()=> showCard(rulesCard));
  btnShowWildland.addEventListener('click', ()=> showCard(wildCard));

  /* Tabs for Nozzles */
  tabSB.addEventListener('click', ()=>{
    tabSB.className = "tabOn"; tabFog.className = "tabOff"; tabChief.className = "tabOff";
    wrapSB.style.display = ''; wrapFog.style.display = 'none'; wrapChief.style.display = 'none';
  });
  tabFog.addEventListener('click', ()=>{
    tabSB.className = "tabOff"; tabFog.className = "tabOn"; tabChief.className = "tabOff";
    wrapSB.style.display = 'none'; wrapFog.style.display = ''; wrapChief.style.display = 'none';
  });
  tabChief.addEventListener('click', ()=>{
    tabSB.className = "tabOff"; tabFog.className = "tabOn"; tabChief.className = "tabOn";
    wrapSB.style.display = 'none'; wrapFog.style.display = 'none'; wrapChief.style.display = '';
  });

  /* Nozzle tables */
  wrapSB.innerHTML = makeSB();
  wrapFog.innerHTML = makeFog();
  wrapChief.innerHTML = makeChief();

  /* Hose friction */
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

  const commonFlows = [95, 125, 150, 160, 175, 185, 200, 250, 265, 300];

  flButtons.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const C = Number(btn.dataset.c);
      // Standard sweep table
      const sweep = buildRange(50, 400, 50);
      flResults.innerHTML = `
        <table class="chartTable">
          <tr><th>GPM</th><th>FL / 100'</th></tr>
          ${sweep.map(g=>{
            const fl = (C * Math.pow(g/100,2)).toFixed(1);
            return `<tr><td>${g}</td><td>${fl}</td></tr>`;
          }).join('')}
        </table>
      `;
      // Common nozzle GPMs table (includes 185 and 265)
      flCommonWrap.innerHTML = `
        <div class="mini" style="margin-bottom:6px; opacity:.9">Common nozzle flows</div>
        <table class="chartTable">
          <tr><th>GPM</th><th>FL / 100'</th></tr>
          ${commonFlows.map(g=>{
            const fl = (C * Math.pow(g/100,2)).toFixed(1);
            return `<tr><td>${g}</td><td>${fl}</td></tr>`;
          }).join('')}
        </table>
      `;
    });
  });

  /* Rules of Thumb list (non-attack-line per user request) */
  const rules = [
    "Standpipe starting point: 150 psi + elevation",
    "Sprinkler FDC: 150 psi unless signage indicates otherwise",
    "Master Stream: Smooth Bore 80 psi NP, Fog 100 psi NP",
    "Elevation: +5 psi per floor",
    "LDH friction loss: ~1 psi per 100 ft at 1000 gpm",
    "Cellar Nozzle: ~250–300 gpm @ 100 psi NP",
    "Piercing Nozzle: 90–200 gpm @ 100 psi NP (start around 150 psi pump)",
    "Class A Foam: 0.3–1%",
    "Class B Hydrocarbon: 3%, Polar Solvent: 6%",
    "Foam Eductor: ~200 psi inlet, ≤150 ft hose to nozzle",
    "High-rise rule: 150–175 psi pump for fire attack floors",
    "PRVs may limit flow—verify early",
    "Use 2½\" with smooth bore preferred in standpipe ops",
    "Do not shut down sprinklers early—system holds the fire",
    "Supply all FDC inlets if present"
  ];
  rulesList.innerHTML = `
    <ul class="rulesUL">
      ${rules.map(r=>`<li>${escapeHTML(r)}</li>`).join('')}
    </ul>
  `;

  /* Wildland: flame length table */
  const flameRows = [
    ["0–4 ft","Direct attack possible","Hand tools, engines, hose lays"],
    ["4–8 ft","Too hot for direct near head","Engines, dozers, aircraft"],
    ["8–11 ft","Fireline ineffective","Indirect attack, long-range ops"],
    [">11 ft","Crowning/long spotting","Indirect only; safety zones"]
  ];
  container.querySelector('#wlFlame').innerHTML = `
    <table class="chartTable">
      <tr><th>Flame Length</th><th>Behavior</th><th>Tactics</th></tr>
      ${flameRows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}
    </table>
  `;

  // Wildland: Orders & Watchouts
  const orders = [
    "Keep informed on fire weather conditions.",
    "Know what your fire is doing at all times.",
    "Base all actions on current and expected behavior.",
    "Identify escape routes and safety zones; make them known.",
    "Post lookouts when there is possible danger.",
    "Be alert, keep calm, think clearly, act decisively.",
    "Maintain prompt communications.",
    "Give clear instructions and ensure they are understood.",
    "Maintain control of your forces at all times.",
    "Fight fire aggressively, having provided for safety first."
  ];
  const watchouts = [
    "Fire not scouted and sized up.",
    "In country not seen in daylight.",
    "Safety zones and escape routes not identified.",
    "Unfamiliar with weather and local factors influencing fire behavior.",
    "Uninformed on strategy, tactics, and hazards.",
    "Instructions and assignments not clear.",
    "No communication link with crew/supervisors.",
    "Constructing line without safe anchor point.",
    "Building fireline downhill with fire below.",
    "Attempting frontal assault on fire.",
    "Unburned fuel between you and fire.",
    "Cannot see main fire; not in contact with someone who can.",
    "On a hillside where rolling material can ignite fuel below.",
    "Weather becoming hotter and drier.",
    "Wind increases and/or changes direction.",
    "Getting frequent spot fires across line.",
    "Terrain and fuels make escape to safety zones difficult.",
    "Taking a nap near the fire line."
  ];
  container.querySelector('#wlOrders').innerHTML = orders.map(o=>`<li>${escapeHTML(o)}</li>`).join('');
  container.querySelector('#wlWatchouts').innerHTML = watchouts.map(w=>`<li>${escapeHTML(w)}</li>`).join('');

  // Safety zone calculator
  const fInput = container.querySelector('#wlFlameFt');
  const fBtn = container.querySelector('#wlCalcZone');
  const fOut = container.querySelector('#wlZoneOut');
  fBtn?.addEventListener('click', ()=>{
    const ft = Math.max(0, Number(fInput?.value||0));
    // Simple rule: radius ~ 4x flame height; diameter ~ 8x
    const radius = ft * 4;
    const diameter = ft * 8;
    fOut.textContent = `Suggested safety zone radius ≈ ${radius} ft (diameter ≈ ${diameter} ft). Increase for wind/topography.`;
  });
}

/* --- Helpers --- */
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

/* Nozzle tables rendered inline to keep file self-contained */

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
    {desc:"Chief XD 2½\" 265 gpm", gpm:265, np:50},   // Added per request
    {desc:"Chief XD Break Apart 150/185/200", gpm:"Varies", np:50},
  ];
  return `
    <table class="chartTable">
      <tr><th>Chief XD Model</th><th>GPM</th><th>NP</th></tr>
      ${data.map(s=>`<tr><td>${s.desc}</td><td>${s.gpm}</td><td>${s.np}</td></tr>`).join('')}
    </table>
  `;
}
