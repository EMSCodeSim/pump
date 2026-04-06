// ./js/view.charts.js
// Charts/Tables view with clean submenus + micro calculators.
// Fixes link buttons by handling [data-openurl] clicks FIRST (global delegation).

import { COEFF } from './store.js';

export async function render(container){
  container.innerHTML = `
    <section class="stack">

      <!-- Section launchers -->
      <section class="card">
        <div class="controls" style="display:flex; gap:6px; flex-wrap:nowrap; overflow-x:auto; -webkit-overflow-scrolling:touch; padding-bottom:2px">
          <button class="btn primary" id="btnShowNozzles" type="button">Nozzles</button>
          <button class="btn" id="btnShowFL" type="button">Hose Friction</button>
          <button class="btn" id="btnShowRules" type="button">Rules</button>
          <button class="btn" id="btnShowMore" type="button">More</button>
        </div>
        <div class="status" style="margin-top:8px">Pick a topic to view details.</div>
      </section>

      <!-- NOZZLES -->
      <section class="card" id="nozzlesCard" style="display:none">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap">
          <div class="ink-strong" style="font-weight:700">Nozzles</div>
          <div class="seg" role="tablist" aria-label="Nozzle type">
            <button class="segBtn segOn" data-type="sb" role="tab" aria-selected="true" type="button">Smooth Bore</button>
            <button class="segBtn" data-type="fog" role="tab" aria-selected="false" type="button">Fog</button>
            <button class="segBtn" data-type="special" role="tab" aria-selected="false" type="button">Specialty</button>
          </div>
        </div>

        <div id="nozzlesSB" class="nozzWrap" style="margin-top:10px"></div>
        <div id="nozzlesFog" class="nozzWrap" style="margin-top:10px; display:none"></div>
        <div id="nozzlesSpecial" class="nozzWrap" style="margin-top:10px; display:none"></div>
      </section>

      <!-- FL -->
      <section class="card" id="flCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Friction Loss (per 100′)</div>

        <div class="flModeRow" style="margin-bottom:8px">
          <div class="seg" role="tablist" aria-label="Hose friction mode">
            <button class="segBtn segOn" data-flmode="standard" role="tab" aria-selected="true" type="button">
              Standard hose
            </button>
            <button class="segBtn" data-flmode="low" role="tab" aria-selected="false" type="button">
              Low-friction hose
            </button>
          </div>
        </div>

        <div class="hoseRow" role="tablist" aria-label="Hose size"></div>

        <div id="flTableWrap" style="margin-top:8px"></div>
        <div class="mini" style="opacity:.95; margin-top:6px">
          FL equation: <code>FL_per100 = C × (GPM/100)²</code>
        </div>

        <div class="divider"></div>

        <!-- Mini FL tool -->
        <div class="ink-strong" style="font-weight:800; margin-bottom:6px">Quick FL Calculator</div>
        <div class="grid2">
          <label class="field">
            <span>Hose size</span>
            <select id="flCalcSize">
              <option value="1.75">1¾"</option>
              <option value="2.5">2½"</option>
              <option value="4">4"</option>
              <option value="5">5"</option>
            </select>
          </label>
          <label class="field">
            <span>GPM</span>
            <input id="flCalcGpm" inputmode="numeric" placeholder="e.g. 185" />
          </label>
          <label class="field">
            <span>Length (ft)</span>
            <input id="flCalcLen" inputmode="numeric" placeholder="e.g. 200" />
          </label>
          <div class="field">
            <span>&nbsp;</span>
            <button class="btn primary" id="flCalcBtn" type="button">Calculate FL</button>
          </div>
        </div>
        <div id="flCalcOut" class="status" style="margin-top:8px; display:none"></div>
      </section>

      <!-- RULES -->
      <section class="card" id="rulesCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Rules of Thumb</div>
        <div id="rulesList"></div>
        <div class="mini" style="opacity:.95; margin-top:8px">
          Quick reference only; confirm with your department’s SOGs/SOPs.
        </div>
      </section>

      <!-- MORE (submenu) -->
      <section class="card" id="moreCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">More</div>
        <div class="moreGrid">
          <button class="btn" id="btnShowEq" type="button">Equations</button>
          <button class="btn" id="btnShowWS" type="button">Water Supply</button>
          <button class="btn" id="btnShowWL" type="button">Wildland</button>
          <button class="btn" id="btnShowHM" type="button">HazMat</button>
          <button class="btn" id="btnShowNFPA" type="button">NFPA / Standards</button>
        </div>
        <div class="mini" style="opacity:.9; margin-top:10px">
          NFPA items are link-out only. Wildland + ERG links open official sources.
        </div>
      </section>

      <!-- EQUATIONS -->
      <section class="card" id="eqCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Equations</div>

        <!-- Micro tools -->
        <div class="toolCard">
          <div class="toolTitle">PDP Calculator</div>
          <div class="mini">PDP = NP + FL + Appliance ± Elevation</div>
          <div class="grid2">
            <label class="field"><span>NP (psi)</span><input id="pdpNp" inputmode="numeric" placeholder="e.g. 50"/></label>
            <label class="field"><span>FL (psi)</span><input id="pdpFl" inputmode="numeric" placeholder="e.g. 60"/></label>
            <label class="field"><span>Appliance (psi)</span><input id="pdpAp" inputmode="numeric" placeholder="e.g. 10"/></label>
            <label class="field"><span>Elevation (psi)</span><input id="pdpEl" inputmode="numeric" placeholder="e.g. 20 (up) or -10 (down)"/></label>
            <div class="field"><span>&nbsp;</span><button class="btn primary" id="pdpBtn" type="button">Calculate PDP</button></div>
          </div>
          <div id="pdpOut" class="status" style="margin-top:8px; display:none"></div>
        </div>

        <div class="toolCard">
          <div class="toolTitle">Smooth Bore Flow</div>
          <div class="mini">GPM = 29.7 × d² × √NP (d in inches)</div>
          <div class="grid2">
            <label class="field"><span>Tip diameter (in)</span><input id="sbD" inputmode="decimal" placeholder='e.g. 1.125'/></label>
            <label class="field"><span>NP (psi)</span><input id="sbNp" inputmode="numeric" placeholder="e.g. 50"/></label>
            <div class="field"><span>&nbsp;</span><button class="btn primary" id="sbBtn" type="button">Calculate GPM</button></div>
          </div>
          <div id="sbOut" class="status" style="margin-top:8px; display:none"></div>
        </div>

        <div class="toolCard">
          <div class="toolTitle">Required Fire Flow (quick)</div>
          <div class="mini">RFF ≈ (L×W÷3) × % involved × floors</div>
          <div class="grid2">
            <label class="field"><span>Length (ft)</span><input id="ffL" inputmode="numeric" placeholder="e.g. 40"/></label>
            <label class="field"><span>Width (ft)</span><input id="ffW" inputmode="numeric" placeholder="e.g. 30"/></label>
            <label class="field"><span>% involved</span><input id="ffPct" inputmode="numeric" placeholder="e.g. 50"/></label>
            <label class="field"><span>Floors involved</span><input id="ffFloors" inputmode="numeric" placeholder="e.g. 1"/></label>
            <div class="field"><span>&nbsp;</span><button class="btn primary" id="ffBtn" type="button">Calculate RFF</button></div>
          </div>
          <div id="ffOut" class="status" style="margin-top:8px; display:none"></div>
        </div>

        <div class="toolCard">
          <div class="toolTitle">Water Weight</div>
          <div class="mini">1 gal ≈ 8.33 lb</div>
          <div class="grid2">
            <label class="field"><span>Gallons</span><input id="wtGal" inputmode="numeric" placeholder="e.g. 1000"/></label>
            <div class="field"><span>&nbsp;</span><button class="btn primary" id="wtBtn" type="button">Calculate weight</button></div>
          </div>
          <div id="wtOut" class="status" style="margin-top:8px; display:none"></div>
        </div>

        <div class="divider"></div>
        <div id="eqList"></div>
      </section>

      <!-- WATER SUPPLY -->
      <section class="card" id="wsCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Water Supply</div>

        <div class="toolCard">
          <div class="toolTitle">Pitot Hydrant Flow (quick)</div>
          <div class="mini">Q ≈ 29.83 × Cd × d² × √P</div>
          <div class="grid2">
            <label class="field"><span>Outlet d (in)</span><input id="pitD" inputmode="decimal" placeholder="e.g. 2.5"/></label>
            <label class="field"><span>Pitot P (psi)</span><input id="pitP" inputmode="numeric" placeholder="e.g. 25"/></label>
            <label class="field"><span>Cd</span><input id="pitCd" inputmode="decimal" placeholder="e.g. 0.9"/></label>
            <div class="field"><span>&nbsp;</span><button class="btn primary" id="pitBtn" type="button">Calculate GPM</button></div>
          </div>
          <div id="pitOut" class="status" style="margin-top:8px; display:none"></div>
          <div class="mini" style="opacity:.9; margin-top:6px">
            Tip: Cd varies by outlet/stream—use your department’s worksheet values.
          </div>
        </div>

        <div class="divider"></div>
        <div id="wsList"></div>
      </section>

      <!-- WILDLAND -->
      <section class="card" id="wlCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Wildland</div>

        <div class="toolCard">
          <div class="toolTitle">Slope / Elevation PSI</div>
          <div class="mini">Rule: ~5 psi per 10 ft (uphill add, downhill subtract)</div>
          <div class="grid2">
            <label class="field"><span>Elevation change (ft)</span><input id="elFt" inputmode="numeric" placeholder="e.g. 30 (up) or -20 (down)"/></label>
            <div class="field"><span>&nbsp;</span><button class="btn primary" id="elBtn" type="button">Convert to psi</button></div>
          </div>
          <div id="elOut" class="status" style="margin-top:8px; display:none"></div>
        </div>

        <div class="divider"></div>
        <div id="wlList"></div>
      </section>

      <!-- HAZMAT -->
      <section class="card" id="hmCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">HazMat (Quick)</div>
        <div id="hmList"></div>
      </section>

      <!-- NFPA / STANDARDS (LINKS) -->
      <section class="card" id="nfpaCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">NFPA / Standards (Links)</div>
        <div id="nfpaList"></div>
      </section>

    </section>
  `;

  // --- local styles
  injectLocalStyles(container, `
    input, select, textarea, button { font-size:16px; }
    .btn, .segBtn, .hoser { min-height:44px; padding:10px 14px; touch-action: manipulation; }
    .btn:focus-visible, .segBtn:focus-visible, .hoser:focus-visible, input:focus-visible, select:focus-visible {
      outline: 3px solid rgba(110,203,255,.85); outline-offset: 2px;
    }

    .ink-strong { color: #ffffff; }
    .seg { display:inline-flex; background:#0f141c; border:1px solid rgba(255,255,255,.12); border-radius:12px; overflow:hidden }
    .segBtn { appearance:none; background:transparent; color:#cfe6ff; border:0; font-weight:700; cursor:pointer; }
    .segBtn.segOn { background:#1a2738; color:#fff; }

    .controls{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch}
    .controls .btn{flex:0 0 auto;min-width:0;white-space:nowrap}
    @media (max-width: 420px){
      .controls .btn{padding:8px 10px;font-size:13px;line-height:1.1}
    }

    .nozzWrap { display:grid; gap:10px; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
    @media (max-width: 480px) { .nozzWrap { grid-template-columns: 1fr; } }
    .nozzCard { background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px; }
    .groupHeader {
      grid-column:1/-1; margin:2px 0 6px 0; color:#fff; font-weight:800; letter-spacing:.2px;
      padding-top:4px; border-top:1px dashed rgba(255,255,255,.12);
    }
    .nozzTitle { color:#fff; font-weight:700; margin-bottom:4px; }
    .nozzSub { color:#cfe6ff; font-size:14px; }

    .hoseRow { display:flex; gap:8px; flex-wrap:wrap; }
    .hoseRow .hoser {
      appearance:none; border:1px solid rgba(255,255,255,.14); background:#131b26; color:#fff;
      border-radius:12px; font-weight:800; cursor:pointer;
    }
    .hoseRow .hoser.on { background:#2a8cff; }

    .flTable { width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; border-radius:12px; }
    .flTable th, .flTable td { padding:12px; text-align:left; font-size:15px; }
    .flTable thead th { background:#162130; color:#fff; border-bottom:1px solid rgba(255,255,255,.1); position:sticky; top:0; z-index:1; }
    .flTable tbody tr:nth-child(odd) td { background:#0e151e; color:#dfeaff; }
    .flTable tbody tr:nth-child(even) td { background:#111924; color:#dfeaff; }
    .flTable .muted { color:#a9bed9; }

    .rulesList { display:grid; gap:8px; }
    .rule {
      background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;
      display:flex; gap:10px; align-items:flex-start;
    }
    .pill {
      background:#2a8cff; color:#fff; font-weight:800;
      padding:6px 10px; border-radius:999px; font-size:12px; white-space:nowrap;
      align-self:flex-start;
    }
    .ruleTitle { color:#fff; font-weight:800; margin:0 0 2px 0; }
    .ruleText { color:#dfeaff; margin:0; line-height:1.35; }

    .moreGrid{display:grid; gap:8px; grid-template-columns: repeat(2, minmax(0, 1fr));}
    @media (max-width: 420px){ .moreGrid{grid-template-columns:1fr;} }

    .linkRow{display:flex; gap:8px; flex-wrap:wrap; margin-top:8px}
    .btn.small{min-height:40px; padding:8px 12px; font-weight:800}
    .btn.ghost{background:#131b26; border:1px solid rgba(255,255,255,.14)}
    .btn.ghost:hover{filter:brightness(1.05)}

    .divider{height:1px; background:rgba(255,255,255,.10); margin:14px 0;}

    .toolCard{
      background:#0e151e;
      border:1px solid rgba(255,255,255,.10);
      border-radius:14px;
      padding:12px;
      margin-bottom:12px;
    }
    .toolTitle{color:#fff; font-weight:900; margin-bottom:4px;}
    .grid2{display:grid; gap:10px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top:10px;}
    @media (max-width: 560px){ .grid2{grid-template-columns:1fr;} }
    .field{display:flex; flex-direction:column; gap:6px;}
    .field span{color:#cfe6ff; font-weight:800; font-size:13px;}
    .field input, .field select{
      background:#101826; color:#fff;
      border:1px solid rgba(255,255,255,.14);
      border-radius:12px;
      padding:10px 12px;
      min-height:44px;
    }
  `);

  // ====== Data

  const SB_HANDLINE_50 = [
    { tip:'7/8"',  gpm:161, NP:50 },
    { tip:'15/16"',gpm:185, NP:50 },
    { tip:'1"',    gpm:210, NP:50 },
    { tip:'1 1/8"',gpm:266, NP:50 },
    { tip:'1 1/4"',gpm:328, NP:50 },
    { tip:'1 3/8"',gpm:398, NP:50 },
    { tip:'1 1/2"',gpm:473, NP:50 },
  ];
  const SB_MASTER_80 = [
    { tip:'1"',     gpm:266,  NP:80 },
    { tip:'1 1/8"', gpm:336,  NP:80 },
    { tip:'1 1/4"', gpm:415,  NP:80 },
    { tip:'1 3/8"', gpm:502,  NP:80 },
    { tip:'1 1/2"', gpm:598,  NP:80 },
    { tip:'1 3/4"', gpm:814,  NP:80 },
    { tip:'2"',     gpm:1063, NP:80 },
  ];

  const FOG_HANDLINE = [
    { label:'Fog 150@75', gpm:150, NP:75, note:'Handline' },
    { label:'Fog 185@75', gpm:185, NP:75, note:'Handline high-flow' },
    { label:'Fog 200@75', gpm:200, NP:75, note:'Handline high-flow' },
    { label:'Fog 250@75 (2½")', gpm:250, NP:75, note:'2½" line' },
    { label:'ChiefXD 150@50', gpm:150, NP:50, note:'Low-pressure' },
    { label:'ChiefXD 185@50', gpm:185, NP:50, note:'Low-pressure' },
    { label:'ChiefXD 200@50', gpm:200, NP:50, note:'Low-pressure' },
    { label:'ChiefXD 265@50', gpm:265, NP:50, note:'Low-pressure (2½" capable)' },
    { label:'Fog 95@100',  gpm:95,  NP:100, note:'Legacy in some depts' },
    { label:'Fog 125@100', gpm:125, NP:100, note:'Legacy in some depts' },
    { label:'Fog 150@100', gpm:150, NP:100, note:'Legacy in some depts' },
    { label:'Fog 200@100', gpm:200, NP:100, note:'Legacy in some depts' },
    { label:'Fog 250@100', gpm:250, NP:100, note:'Legacy in some depts' },
  ];
  const FOG_MASTER = [
    { label:'Master Fog 500@100',  gpm:500,  NP:100, note:'Monitor/deck gun' },
    { label:'Master Fog 750@100',  gpm:750,  NP:100, note:'Monitor/deck gun' },
    { label:'Master Fog 1000@100', gpm:1000, NP:100, note:'Monitor/deck gun' },
    { label:'Master Fog 1250@100', gpm:1250, NP:100, note:'Monitor/deck gun' },
  ];
  const SPECIALTY_NOZZLES = [
    { label:'Piercing nozzle ~125 gpm', gpm:125, NP:100, note:'Penetrates roofs/walls; often 80–100 psi NP.' },
    { label:'Bresnan cellar nozzle ~250 gpm', gpm:250, NP:50, note:'Rotating cellar/basement nozzle.' },
    { label:'Water curtain nozzle', gpm:95, NP:50, note:'Exposure protection; check manufacturer specs.' },
    { label:'Foam/air-aspirating nozzle', gpm:95, NP:100, note:'Used with Class A/B foam eductors.' },
  ];

  const RULES = [
    { tag:'Appliances',    title:'Add 10 psi over 350 gpm', text:'For appliance losses when total flow exceeds ~350 gpm, add 10 psi.' },
    { tag:'Master Stream', title:'Add 25 psi',              text:'Typical appliance loss for deck gun/monitor/master stream devices.' },
    { tag:'Standpipes',    title:'Add 25 psi + elevation',  text:'Add 25 psi for the system plus elevation (head) losses.' },
    { tag:'Sprinklers',    title:'Pump at 150 psi',         text:'A common starting point; follow FDC signage and SOGs.' },
    { tag:'Elevation',     title:'±5 psi per 10 ft',        text:'Add going uphill; subtract going downhill or per floor (~10 ft).' },
    { tag:'Relay Pump',    title:'Residual 20–50 psi',      text:'Maintain 20–50 psi residual at the receiving engine.' },
    { tag:'Handline SB',   title:'NP 50 psi',               text:'Smooth-bore handline nozzle pressure.' },
    { tag:'Master SB',     title:'NP 80 psi',               text:'Smooth-bore master stream nozzle pressure.' },
    { tag:'Hydrant',       title:'Residual drop rule',      text:'~10% drop = good; 15–20% = caution; 25%+ = system near max capacity (common guidance).' },
    { tag:'Supply',        title:'Supply line max flow',    text:'5″: ~1000–1500 gpm; 4″: ~800–1000 gpm; 2½″: ~300–350 gpm before FL becomes excessive.' },
    { tag:'Foam',          title:'Class A vs Class B',      text:'Class A: ~0.1–1%; Class B: ~1–6% depending on product and fuel; follow label/SOPs.' },
    { tag:'Foam',          title:'Eductor pressure',        text:'Many inline eductors require ~200 psi inlet and correct hose layout; follow manufacturer.' },
    { tag:'Acronyms',      title:'RECEO-VS',                text:'Rescue, Exposures, Confinement, Extinguishment, Overhaul, Ventilation, Salvage.' },
  ];

  const EQUATIONS = [
    { tag:'PDP', title:'Pump Discharge Pressure', text:'PDP = NP + FL + Appliance ± Elevation.' },
    { tag:'FL', title:'Friction loss per 100′', text:'FL_per100 = C × (GPM/100)². Total FL = FL_per100 × (Length/100).' },
    { tag:'SB', title:'Smooth bore flow', text:'GPM = 29.7 × d² × √NP (d in inches, NP in psi).' },
    { tag:'Fire Flow', title:'Required Fire Flow (quick)', text:'RFF ≈ (L×W÷3) × % involved × floors involved (quick method; SOP may differ).' },
    { tag:'Weight', title:'Water weight', text:'1 gal ≈ 8.33 lb. 1000 gal ≈ 8,330 lb.' },
    { tag:'Relay', title:'Residual target', text:'Many crews target ~20–50 psi residual at the receiving engine (match SOP).' }
  ];

  const WATER_SUPPLY = [
    { tag:'Hydrant', title:'Static / Residual / Pitot', text:'Record static, flow from a second hydrant/outlet, then record residual while flowing.' },
    { tag:'Hydrant', title:'Pitot flow', text:'Q ≈ 29.83 × Cd × d² × √P (Q gpm, d inches, P pitot psi).' },
    { tag:'Drafting', title:'Drafting reminders', text:'Prime early, keep hard suction airtight, minimize elbows, and watch net lift.' },
    { tag:'Tender', title:'Tender weight', text:'1,000 gal ≈ 8,330 lb. Know axle limits and fill site access.' },
    { tag:'Relay', title:'Spacing principle', text:'Set a target residual at the receiving engine and let friction loss determine engine spacing.' },
  ];

  const WILDLAND = [
    { tag:'Safety', title:'LCES', text:'Lookouts, Communications, Escape routes, Safety zones.' },
    { tag:'Orders', title:'10 Standard Firefighting Orders', text:'Use official NWCG references below.' },
    { tag:'Watch Outs', title:'18 Watch Out Situations', text:'Use official NWCG references below.' },
    { tag:'Ops', title:'Progressive hose lay', text:'Add pressure for terrain + appliances; protect hose from heat/rollover.' },
  ];

  const HAZMAT = [
    { tag:'Approach', title:'Isolation first', text:'Size up from a distance, uphill/upwind, isolate, deny entry, request HazMat early.' },
    { tag:'ID', title:'UN/NA number + placard', text:'Use 4-digit ID and placard class to find the correct ERG guide.' },
    { tag:'ERG', title:'Green Pages', text:'ERG green pages provide initial isolation + protective action distances for TIH materials.' },
    { tag:'PPE', title:'PPE is product-driven', text:'Default defensive until product confirmed; follow ERG and HazMat tech guidance.' },
  ];

  const NFPA_LINKS = [
    {
      tag:'NFPA',
      title:'Free Access to NFPA codes & standards (official)',
      text:'NFPA provides free online access (account required).',
      links: [
        { label:'Open Free Access', url:'https://www.nfpa.org/for-professionals/codes-and-standards/list-of-codes-and-standards/free-access' },
      ]
    },
    {
      tag:'NFPA',
      title:'NFPA 1710 (career dept organization & deployment)',
      text:'Deployment / staffing / response performance topics.',
      links: [
        { label:'NFPA 1710 page', url:'https://www.nfpa.org/codes-and-standards/nfpa-1710-standard-development/1710' },
      ]
    },
    {
      tag:'ERG',
      title:'Emergency Response Guidebook (ERG) 2024 (official)',
      text:'Official PHMSA ERG page + PDF.',
      links: [
        { label:'ERG official page', url:'https://www.phmsa.dot.gov/training/hazmat/erg/emergency-response-guidebook-erg' },
        { label:'ERG 2024 PDF', url:'https://www.phmsa.dot.gov/sites/phmsa.dot.gov/files/2024-04/ERG2024-Eng-Web-a.pdf' },
      ]
    },
    {
      tag:'NWCG',
      title:'NWCG wildland safety (official)',
      text:'Official wildland firefighter safety references.',
      links: [
        { label:'10 Standard Orders', url:'https://www.nwcg.gov/6mfs/operational-engagement/10-standard-firefighting-orders' },
        { label:'18 Watch Outs', url:'https://www.nwcg.gov/publications/18-watch-out-situations-pms-118' },
        { label:'LCES', url:'https://www.nwcg.gov/6mfs/operational-engagement/lookouts-lces' },
      ]
    },
  ];

  const HOSE_ORDER = ['1.75','2.5','4','5'];
  const HOSE_LABEL = s =>
    s==='1.75' ? '1¾"' :
    s==='2.5'  ? '2½"' :
    `${s}"`;

  const GPM_SETS = {
    '1.75': [95, 125, 150, 160, 175, 185, 200],
    '2.5':  [150, 185, 200, 250, 265, 300, 325, 400, 500, 600],
    '4':    [400, 500, 600, 800, 1000],
    '5':    [500, 750, 800, 1000, 1250],
  };

  // Low-friction C values (edit to your preference)
  const LOW_C = { '1.75': 13, '2.5': 1.5, '4': 0.8, '5': 0.05 };

  // ====== DOM refs
  const btnShowNozzles = container.querySelector('#btnShowNozzles');
  const btnShowFL = container.querySelector('#btnShowFL');
  const btnShowRules = container.querySelector('#btnShowRules');
  const btnShowMore = container.querySelector('#btnShowMore');

  const nozzCard = container.querySelector('#nozzlesCard');
  const flCard = container.querySelector('#flCard');
  const rulesCard = container.querySelector('#rulesCard');
  const moreCard = container.querySelector('#moreCard');

  const eqCard = container.querySelector('#eqCard');
  const wsCard = container.querySelector('#wsCard');
  const wlCard = container.querySelector('#wlCard');
  const hmCard = container.querySelector('#hmCard');
  const nfpaCard = container.querySelector('#nfpaCard');

  const fogWrap = container.querySelector('#nozzlesFog');
  const sbWrap  = container.querySelector('#nozzlesSB');
  const specialWrap = container.querySelector('#nozzlesSpecial');
  const hoseRow = container.querySelector('.hoseRow');
  const flTableWrap = container.querySelector('#flTableWrap');
  const rulesList = container.querySelector('#rulesList');

  const eqList = container.querySelector('#eqList');
  const wsList = container.querySelector('#wsList');
  const wlList = container.querySelector('#wlList');
  const hmList = container.querySelector('#hmList');
  const nfpaList = container.querySelector('#nfpaList');

  const flModeButtons = Array.from(container.querySelectorAll('[data-flmode]'));
  let currentFLMode = 'standard';

  // ====== Global click delegation (FIXES LINKS)
  container.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-openurl]');
    if (openBtn){
      const url = openBtn.getAttribute('data-openurl');
      if (url){
        // Use noopener for safety; most devices allow this from user click.
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      return;
    }
  });

  // ====== Render helpers
  function hideAll(){
    [nozzCard, flCard, rulesCard, moreCard, eqCard, wsCard, wlCard, hmCard, nfpaCard].forEach(c => c.style.display = 'none');
  }
  function show(card){
    hideAll();
    card.style.display = 'block';
  }
  function getCoeff(sizeKey){
    if (currentFLMode === 'low') return (LOW_C[sizeKey] ?? COEFF[sizeKey]);
    return COEFF[sizeKey];
  }
  function setFLMode(mode){
    currentFLMode = (mode === 'low') ? 'low' : 'standard';
    flModeButtons.forEach(btn => {
      const on = btn.dataset.flmode === currentFLMode;
      btn.classList.toggle('segOn', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    renderHoseButtons();
  }

  // --- NOZZLES
  function renderNozzlesSB(){
    sbWrap.innerHTML = `
      <div class="groupHeader">Handline Smooth Bore (50 psi NP)</div>
      ${SB_HANDLINE_50.map(n=>`
        <div class="nozzCard">
          <div class="nozzTitle">${escapeHTML(n.tip)}</div>
          <div class="nozzSub">GPM: <b>${n.gpm}</b> — NP: <b>${n.NP} psi</b></div>
        </div>
      `).join('')}
      <div class="groupHeader">Master Stream Smooth Bore (80 psi NP)</div>
      ${SB_MASTER_80.map(n=>`
        <div class="nozzCard">
          <div class="nozzTitle">${escapeHTML(n.tip)}</div>
          <div class="nozzSub">GPM: <b>${n.gpm}</b> — NP: <b>${n.NP} psi</b></div>
        </div>
      `).join('')}
    `;
  }
  function renderNozzlesFog(){
    fogWrap.innerHTML = `
      <div class="groupHeader">Handline Fog</div>
      ${FOG_HANDLINE.map(n=>`
        <div class="nozzCard">
          <div class="nozzTitle">${escapeHTML(n.label)}</div>
          <div class="nozzSub">GPM: <b>${n.gpm}</b> — NP: <b>${n.NP} psi</b>${n.note?`<div class="muted mini">${escapeHTML(n.note)}</div>`:''}</div>
        </div>
      `).join('')}
      <div class="groupHeader">Master Stream Fog (100 psi NP)</div>
      ${FOG_MASTER.map(n=>`
        <div class="nozzCard">
          <div class="nozzTitle">${escapeHTML(n.label)}</div>
          <div class="nozzSub">GPM: <b>${n.gpm}</b> — NP: <b>${n.NP} psi</b>${n.note?`<div class="muted mini">${escapeHTML(n.note)}</div>`:''}</div>
        </div>
      `).join('')}
    `;
  }
  function renderNozzlesSpecial(){
    specialWrap.innerHTML = `
      <div class="groupHeader">Specialty / Special Purpose Nozzles</div>
      ${SPECIALTY_NOZZLES.map(n=>`
        <div class="nozzCard">
          <div class="nozzTitle">${escapeHTML(n.label)}</div>
          <div class="nozzSub">
            ${n.gpm ? `Approx. GPM: <b>${n.gpm}</b> — ` : ''}
            ${n.NP ? `NP: <b>${n.NP} psi</b>` : ''}
            ${n.note?`<div class="muted mini">${escapeHTML(n.note)}</div>`:''}
          </div>
        </div>
      `).join('')}
    `;
  }

  // --- FL table
  function renderHoseButtons(){
    hoseRow.innerHTML = '';
    const available = HOSE_ORDER.filter(s => getCoeff(s) != null);

    HOSE_ORDER.forEach((s, i)=>{
      const b = document.createElement('button');
      const hasC = getCoeff(s) != null;
      b.className = 'hoser' + ((i===0 && hasC)?' on':'');
      b.dataset.size = s;
      b.type = 'button';
      b.textContent = `${HOSE_LABEL(s)}`;
      if(hasC){
        b.addEventListener('click', ()=>{
          hoseRow.querySelectorAll('.hoser').forEach(x=>x.classList.remove('on'));
          b.classList.add('on');
          renderFLTable(s);
        });
      } else {
        b.style.opacity = .5;
        b.style.pointerEvents = 'none';
        b.title = 'Missing C in this mode';
      }
      hoseRow.appendChild(b);
    });

    if(available.length){
      renderFLTable(available[0]);
      hoseRow.querySelectorAll('.hoser').forEach(btn => {
        btn.classList.toggle('on', btn.dataset.size === String(available[0]));
      });
    }else{
      flTableWrap.innerHTML = `<div class="status alert">No hose coefficients found.</div>`;
    }
  }

  function renderFLTable(sizeKey){
    const C = getCoeff(sizeKey);
    if(C == null){
      flTableWrap.innerHTML = `<div class="status alert">Missing C for ${HOSE_LABEL(sizeKey)}.</div>`;
      return;
    }
    const list = GPM_SETS[sizeKey] || [];
    const rows = list.map(g=>{
      const per100 = C * Math.pow(g/100, 2);
      const val = per100 < 1 ? (Math.round(per100*10)/10).toFixed(1) : Math.round(per100);
      return `<tr><td>${g} gpm</td><td class="muted">C=${C}</td><td><b>${val}</b> psi / 100′</td></tr>`;
    }).join('');
    flTableWrap.innerHTML = `
      <div style="max-width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch">
        <table class="flTable" role="table" aria-label="Friction loss per 100 feet">
          <thead><tr><th>Flow</th><th class="muted">Coeff</th><th>FL per 100′</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="3" class="muted">No GPM values.</td></tr>`}</tbody>
        </table>
      </div>
    `;
  }

  // --- Lists
  function renderRules(){ rulesList.innerHTML = renderPills(RULES); }
  function renderEquationsList(){ eqList.innerHTML = renderPills(EQUATIONS); }
  function renderWaterSupplyList(){ wsList.innerHTML = renderPills(WATER_SUPPLY); }
  function renderWildlandList(){
    wlList.innerHTML = renderPills(WILDLAND, [
      { label:'10 Standard Orders (NWCG)', url:'https://www.nwcg.gov/6mfs/operational-engagement/10-standard-firefighting-orders' },
      { label:'18 Watch Outs (NWCG)', url:'https://www.nwcg.gov/publications/18-watch-out-situations-pms-118' },
      { label:'LCES (NWCG)', url:'https://www.nwcg.gov/6mfs/operational-engagement/lookouts-lces' },
    ]);
  }
  function renderHazmatList(){
    hmList.innerHTML = renderPills(HAZMAT, [
      { label:'ERG Official Page', url:'https://www.phmsa.dot.gov/training/hazmat/erg/emergency-response-guidebook-erg' },
      { label:'ERG 2024 PDF', url:'https://www.phmsa.dot.gov/sites/phmsa.dot.gov/files/2024-04/ERG2024-Eng-Web-a.pdf' },
    ]);
  }
  function renderNfpa(){
    nfpaList.innerHTML = `
      <div class="rulesList">
        ${NFPA_LINKS.map(item => `
          <div class="rule">
            <span class="pill">${escapeHTML(item.tag)}</span>
            <div style="flex:1">
              <div class="ruleTitle">${escapeHTML(item.title)}</div>
              <p class="ruleText">${escapeHTML(item.text)}</p>
              ${item.links?.length ? `
                <div class="linkRow">
                  ${item.links.map(l => `
                    <button class="btn small ghost" type="button" data-openurl="${escapeHTML(l.url)}">${escapeHTML(l.label)}</button>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderPills(list, links=null){
    const body = `
      <div class="rulesList">
        ${list.map(r => `
          <div class="rule">
            <span class="pill">${escapeHTML(r.tag)}</span>
            <div>
              <div class="ruleTitle">${escapeHTML(r.title)}</div>
              <p class="ruleText">${escapeHTML(r.text)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    const linkRow = links?.length ? `
      <div class="linkRow" style="margin-top:10px">
        ${links.map(l => `<button class="btn small ghost" type="button" data-openurl="${escapeHTML(l.url)}">${escapeHTML(l.label)}</button>`).join('')}
      </div>
    ` : '';
    return body + linkRow;
  }

  // ====== View navigation
  btnShowNozzles.addEventListener('click', ()=>{
    renderNozzlesSB(); renderNozzlesFog(); renderNozzlesSpecial();
    container.querySelectorAll('.segBtn[data-type]').forEach(b=>{
      const on = b.dataset.type==='sb';
      b.classList.toggle('segOn', on);
      b.setAttribute('aria-selected', on?'true':'false');
    });
    sbWrap.style.display='grid';
    fogWrap.style.display='none';
    specialWrap.style.display='none';
    show(nozzCard);
  });

  btnShowFL.addEventListener('click', ()=>{
    setFLMode(currentFLMode);
    show(flCard);
  });

  btnShowRules.addEventListener('click', ()=>{
    renderRules();
    show(rulesCard);
  });

  btnShowMore.addEventListener('click', ()=> show(moreCard));

  // More submenu buttons
  container.querySelector('#btnShowEq').addEventListener('click', ()=>{
    renderEquationsList();
    wireEquationTools();
    show(eqCard);
  });
  container.querySelector('#btnShowWS').addEventListener('click', ()=>{
    renderWaterSupplyList();
    wireWaterSupplyTools();
    show(wsCard);
  });
  container.querySelector('#btnShowWL').addEventListener('click', ()=>{
    renderWildlandList();
    wireWildlandTools();
    show(wlCard);
  });
  container.querySelector('#btnShowHM').addEventListener('click', ()=>{
    renderHazmatList();
    show(hmCard);
  });
  container.querySelector('#btnShowNFPA').addEventListener('click', ()=>{
    renderNfpa();
    show(nfpaCard);
  });

  // Nozzle segmented control
  container.addEventListener('click', (e)=>{
    const seg = e.target.closest('.segBtn');
    if(!seg) return;

    // FL mode seg buttons
    if (seg.dataset.flmode){
      setFLMode(seg.dataset.flmode);
      return;
    }

    // Nozzle type seg buttons
    const type = seg.dataset.type;
    if(!type) return;

    container.querySelectorAll('.segBtn[data-type]').forEach(b=>{
      const on = b === seg;
      b.classList.toggle('segOn', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    if(type === 'sb'){
      sbWrap.style.display = 'grid';
      fogWrap.style.display = 'none';
      specialWrap.style.display = 'none';
    } else if(type === 'fog'){
      sbWrap.style.display = 'none';
      fogWrap.style.display = 'grid';
      specialWrap.style.display = 'none';
    } else if(type === 'special'){
      sbWrap.style.display = 'none';
      fogWrap.style.display = 'none';
      specialWrap.style.display = 'grid';
    }
  });

  // ====== Wire FL mini tool
  wireFlTool();

  function wireFlTool(){
    const sizeEl = container.querySelector('#flCalcSize');
    const gpmEl  = container.querySelector('#flCalcGpm');
    const lenEl  = container.querySelector('#flCalcLen');
    const outEl  = container.querySelector('#flCalcOut');
    const btnEl  = container.querySelector('#flCalcBtn');

    btnEl.addEventListener('click', ()=>{
      const size = String(sizeEl.value);
      const gpm = toNum(gpmEl.value);
      const len = toNum(lenEl.value);
      const C = getCoeff(size);

      if (!isFinite(gpm) || gpm <= 0 || !isFinite(len) || len <= 0){
        showOut(outEl, 'Enter valid GPM and length.');
        return;
      }
      if (C == null){
        showOut(outEl, `No coefficient (C) for ${HOSE_LABEL(size)}.`);
        return;
      }
      const flPer100 = C * Math.pow(gpm/100, 2);
      const total = flPer100 * (len/100);
      showOut(outEl,
        `C=${C}. FL/100′ = ${round1(flPer100)} psi. Total FL for ${len}′ = ${round1(total)} psi.`
      );
    });
  }

  // ====== Wire Equation micro tools (called when opening Equations)
  function wireEquationTools(){
    // PDP
    const pdpBtn = container.querySelector('#pdpBtn');
    const pdpOut = container.querySelector('#pdpOut');
    pdpBtn.onclick = () => {
      const np = toNum(container.querySelector('#pdpNp').value) || 0;
      const fl = toNum(container.querySelector('#pdpFl').value) || 0;
      const ap = toNum(container.querySelector('#pdpAp').value) || 0;
      const el = toNum(container.querySelector('#pdpEl').value) || 0;
      const pdp = np + fl + ap + el;
      showOut(pdpOut, `PDP = ${round1(pdp)} psi (NP ${np} + FL ${fl} + Appl ${ap} + Elev ${el}).`);
    };

    // Smooth bore flow
    const sbBtn = container.querySelector('#sbBtn');
    const sbOut = container.querySelector('#sbOut');
    sbBtn.onclick = () => {
      const d = toNum(container.querySelector('#sbD').value);
      const np = toNum(container.querySelector('#sbNp').value);
      if (!isFinite(d) || d <= 0 || !isFinite(np) || np <= 0){
        showOut(sbOut, 'Enter a valid diameter and NP.');
        return;
      }
      const gpm = 29.7 * d * d * Math.sqrt(np);
      showOut(sbOut, `Estimated flow ≈ ${Math.round(gpm)} gpm (d=${d}", NP=${np} psi).`);
    };

    // Fire flow quick
    const ffBtn = container.querySelector('#ffBtn');
    const ffOut = container.querySelector('#ffOut');
    ffBtn.onclick = () => {
      const L = toNum(container.querySelector('#ffL').value);
      const W = toNum(container.querySelector('#ffW').value);
      const pct = toNum(container.querySelector('#ffPct').value);
      const floors = toNum(container.querySelector('#ffFloors').value) || 1;
      if (!isFinite(L) || L<=0 || !isFinite(W) || W<=0 || !isFinite(pct) || pct<0){
        showOut(ffOut, 'Enter valid length, width, and % involved.');
        return;
      }
      const involved = Math.max(0, Math.min(100, pct)) / 100;
      const base = (L * W) / 3;
      const rff = base * involved * Math.max(1, floors);
      showOut(ffOut, `RFF ≈ ${Math.round(rff)} gpm (base ${Math.round(base)} × ${(involved*100).toFixed(0)}% × floors ${Math.max(1,floors)}).`);
    };

    // Water weight
    const wtBtn = container.querySelector('#wtBtn');
    const wtOut = container.querySelector('#wtOut');
    wtBtn.onclick = () => {
      const gal = toNum(container.querySelector('#wtGal').value);
      if (!isFinite(gal) || gal < 0){
        showOut(wtOut, 'Enter valid gallons.');
        return;
      }
      const lbs = gal * 8.33;
      const tons = lbs / 2000;
      showOut(wtOut, `${gal} gal ≈ ${Math.round(lbs)} lb (${tons.toFixed(2)} tons).`);
    };
  }

  // ====== Water Supply tool (pitot)
  function wireWaterSupplyTools(){
    const pitBtn = container.querySelector('#pitBtn');
    const pitOut = container.querySelector('#pitOut');
    pitBtn.onclick = () => {
      const d = toNum(container.querySelector('#pitD').value);
      const P = toNum(container.querySelector('#pitP').value);
      const Cd = toNum(container.querySelector('#pitCd').value);
      if (!isFinite(d) || d<=0 || !isFinite(P) || P<=0 || !isFinite(Cd) || Cd<=0){
        showOut(pitOut, 'Enter valid outlet diameter, pitot pressure, and Cd.');
        return;
      }
      const q = 29.83 * Cd * d * d * Math.sqrt(P);
      showOut(pitOut, `Estimated flow ≈ ${Math.round(q)} gpm (d=${d}", P=${P} psi, Cd=${Cd}).`);
    };
  }

  // ====== Wildland tool (elevation ft -> psi)
  function wireWildlandTools(){
    const elBtn = container.querySelector('#elBtn');
    const elOut = container.querySelector('#elOut');
    elBtn.onclick = () => {
      const ft = toNum(container.querySelector('#elFt').value);
      if (!isFinite(ft)){
        showOut(elOut, 'Enter a valid elevation change in feet.');
        return;
      }
      const psi = (ft / 10) * 5;
      const sign = psi >= 0 ? 'add' : 'subtract';
      showOut(elOut, `${ft} ft ≈ ${round1(psi)} psi (${sign} to PDP).`);
    };
  }

  // ====== Init default
  btnShowNozzles.click();

  return { dispose(){} };
}

export default { render };

/* ========== helpers ========== */
function injectLocalStyles(root, cssText){
  const style = document.createElement('style');
  style.textContent = cssText;
  root.appendChild(style);
}
function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[m]));
}
function toNum(v){
  if (v == null) return NaN;
  const s = String(v).trim().replace(/,/g,'');
  if (!s) return NaN;
  return Number(s);
}
function round1(n){
  return (Math.round(n*10)/10).toFixed(1);
}
function showOut(el, msg){
  el.style.display = 'block';
  el.textContent = msg;
}
