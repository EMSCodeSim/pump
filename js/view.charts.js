// ./js/view.charts.js
// Phone-friendly Charts view, with "Common GPM" bubbles removed.

import { COEFF } from './store.js';

/**
 * Charts View
 * - Sections:
 *   1) Nozzles  (Smooth Bore | Fog | Specialty)  ← SB first, default selected
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
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap">
          <div class="ink-strong" style="font-weight:700">Nozzles</div>
          <div class="seg" role="tablist" aria-label="Nozzle type">
            <button class="segBtn segOn" data-type="sb" role="tab" aria-selected="true" type="button">Smooth Bore</button>
            <button class="segBtn" data-type="fog" role="tab" aria-selected="false" type="button">Fog</button>
          </div>
        </div>

        <!-- Smooth Bore first -->
        <div id="nozzlesSB" class="nozzWrap" style="margin-top:10px"></div>
        <!-- Fog / Specialty second -->
        <div id="nozzlesFog" class="nozzWrap" style="margin-top:10px; display:none"></div>
      </section>

      <!-- FL (hidden until pressed) -->
      <section class="card" id="flCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Friction Loss (per 100′)</div>

        <!-- Standard vs Low-friction toggle -->
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

        <!-- Horizontal hose-size buttons -->
        <div class="hoseRow" role="tablist" aria-label="Hose size"></div>

        <div id="flTableWrap" style="margin-top:8px"></div>
        <div class="mini" style="opacity:.95; margin-top:6px">
          FL equation: <code>FL_per100 = C × (GPM/100)²</code>
        </div>
      </section>

      <!-- RULES OF THUMB (hidden until pressed) -->
      <section class="card" id="rulesCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Rules of Thumb</div>
        <div id="rulesList"></div>
        <div class="mini" style="opacity:.95; margin-top:8px">
          Quick reference only; confirm with your department’s SOGs/SOPs.
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
  // ====== Local styles (original + mobile polish)
  injectLocalStyles(container, `
    /* Prevent iOS zoom; bigger tap targets + clearer focus */
    input, select, textarea, button { font-size:16px; }
    .btn, .segBtn, .hoser { min-height:44px; padding:10px 14px; touch-action: manipulation; }
    .btn:focus-visible, .segBtn:focus-visible, .hoser:focus-visible {
      outline: 3px solid rgba(110,203,255,.85); outline-offset: 2px;
    }

    /* Layout */
    .ink-strong { color: #ffffff; }
    .seg { display:inline-flex; background:#0f141c; border:1px solid rgba(255,255,255,.12); border-radius:12px; overflow:hidden }
    .segBtn {
      appearance:none; background:transparent; color:#cfe6ff; border:0;
      font-weight:700; cursor:pointer;
    }
    .segBtn.segOn { background:#1a2738; color:#fff; }

    /* Responsive nozzle card grid */
    .nozzWrap {
      display:grid; gap:10px;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    }
    @media (max-width: 480px) {
      .nozzWrap { grid-template-columns: 1fr; }
    }
    .nozzCard { background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px; }
    .groupHeader {
      grid-column:1/-1; margin:2px 0 6px 0; color:#fff; font-weight:800; letter-spacing:.2px;
      padding-top:4px; border-top:1px dashed rgba(255,255,255,.12);
    }
    .nozzTitle { color:#fff; font-weight:700; margin-bottom:4px; }
    .nozzSub { color:#cfe6ff; font-size:14px; }

    /* Hose row buttons */
    .hoseRow { display:flex; gap:8px; flex-wrap:wrap; }
    .hoseRow .hoser {
      appearance:none; border:1px solid rgba(255,255,255,.14); background:#131b26; color:#fff;
      border-radius:12px; font-weight:800; cursor:pointer;
    }
    .hoseRow .hoser.on { background:#2a8cff; }

    /* FL table */
    .flTable { width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; border-radius:12px; }
    .flTable th, .flTable td { padding:12px; text-align:left; font-size:15px; }
    .flTable thead th { background:#162130; color:#fff; border-bottom:1px solid rgba(255,255,255,.1); position:sticky; top:0; z-index:1; }
    .flTable tbody tr:nth-child(odd) td { background:#0e151e; color:#dfeaff; }
    .flTable tbody tr:nth-child(even) td { background:#111924; color:#dfeaff; }
    .flTable .muted { color:#a9bed9; }
    .flTable tr.hi td { outline:2px solid #2a8cff; outline-offset:-2px; }

    /* Rules list */
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

    /* Reduce horizontal bounce on small screens */
    @media (max-width: 420px) {
      .controls { gap:6px; }
      .btn.primary { flex: 1 1 auto; }
    }
  `);

  // ====== Data

  // Smooth Bore — Handline 50 psi, Master 80 psi
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

  // Fog (handline LP & standard, plus Master Fog @100 NP)
  const FOG_HANDLINE = [
    { label:'Fog 150@75', gpm:150, NP:75, note:'Handline' },
    { label:'Fog 185@75', gpm:185, NP:75, note:'Handline high-flow' },
    { label:'Fog 200@75', gpm:200, NP:75, note:'Handline high-flow' },
    { label:'Fog 250@75 (2½")', gpm:250, NP:75, note:'2½" line' },
    { label:'ChiefXD 150@50', gpm:150, NP:50, note:'Low-pressure' },
    { label:'ChiefXD 185@50', gpm:185, NP:50, note:'Low-pressure' },
    { label:'ChiefXD 200@50', gpm:200, NP:50, note:'Low-pressure' },
    { label:'ChiefXD 265@50', gpm:265, NP:50, note:'Low-pressure (2½" capable)' },
    // Optional 100 psi legacy
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

  // Specialty / special purpose nozzles
  const SPECIALTY_NOZZLES = [
    { label:'Piercing nozzle ~125 gpm', gpm:125, NP:100, note:'Penetrates roofs/walls; often 80–100 psi NP.' },
    { label:'Bresnan cellar nozzle ~250 gpm', gpm:250, NP:50, note:'Rotating cellar/basement nozzle.' },
    { label:'Water curtain nozzle', gpm:95, NP:50, note:'Exposure protection; check manufacturer specs.' },
    { label:'Foam/air-aspirating nozzle', gpm:95, NP:100, note:'Used with Class A/B foam eductors.' },
  ];

  // Rules of Thumb (expanded)
  const RULES = [
    // Existing appliance / elevation / standpipe / sprinkler / NP rules
    { tag:'Appliances',    title:'Add 10 psi over 350 gpm', text:'For appliance losses when total flow exceeds ~350 gpm, add 10 psi.' },
    { tag:'Master Stream', title:'Add 25 psi',              text:'Typical appliance loss for deck gun/monitor/master stream devices.' },
    { tag:'Standpipes',    title:'Add 25 psi + elevation',  text:'Add 25 psi for the system plus elevation (head) losses.' },
    { tag:'Sprinklers',    title:'Pump at 150 psi',         text:'A common starting point; follow FDC signage and SOGs.' },
    { tag:'Elevation',     title:'±5 psi per 10 ft',        text:'Add going uphill; subtract going downhill or per floor (~10 ft).' },
    { tag:'Relay Pump',    title:'Residual 20–50 psi',      text:'Maintain 20–50 psi residual at the receiving engine.' },
    { tag:'Handline SB',   title:'NP 50 psi',               text:'Smooth-bore handline nozzle pressure.' },
    { tag:'Master SB',     title:'NP 80 psi',               text:'Smooth-bore master stream nozzle pressure.' },
    { tag:'Piercing',      title:'NP 80 psi',               text:'Piercing nozzle nozzle pressure (check local spec).' },
    { tag:'Cellar',        title:'NP 80 psi',               text:'Cellar nozzle nozzle pressure.' },

    // Hydrant residual drop
    { tag:'Hydrant',       title:'Residual drop rule',      text:'~10% drop = good; 15–20% = caution; 25%+ = system near max capacity.' },

    // Supply line max efficient flow
    { tag:'Supply',        title:'Supply line max flow',    text:'5″: ~1000–1500 gpm; 4″: ~800–1000 gpm; 2½″: ~300–350 gpm before FL becomes excessive.' },

    // Standpipe high-rise fire
    { tag:'Standpipes',    title:'High-rise starting PDP',  text:'Common starting point is 150 psi minimum unless SOPs/signage state otherwise.' },

    // Attack line quick references
    { tag:'Attack Line',   title:'1¾″ initial PDP',         text:'Many departments start around 150 psi depending on nozzle and hose layout.' },
    { tag:'Attack Line',   title:'2½″ target flow',         text:'A common big-line target is ~250 gpm for large fire attack.' },

    // Wildland rules category
    { tag:'Wildland',      title:'Elevation in wildland',   text:'Add 5 psi per 10 ft elevation gain in progressive hose lays.' },
    { tag:'Wildland',      title:'Progressive lay losses',  text:'Add 10–25 psi for gated wyes and appliances in a progressive lay.' },
    { tag:'Wildland',      title:'Forestry line flows',     text:'1″ ≈ 30–60 gpm; 1½″ ≈ 60–125 gpm (confirm with local SOPs).' },
    { tag:'Wildland',      title:'Pump-and-roll',           text:'Maintain roughly 50–100 psi at the pump, adjusted for terrain and nozzle.' },

    // Master stream effective reach + water weight
    { tag:'Master Stream', title:'Effective reach',         text:'Best reach at correct NP: 80 psi SB, 100 psi fog; avoid under-pumping master streams.' },
    { tag:'Master Stream', title:'500 gpm = 1 ton/min',     text:'500 gpm is roughly 1 ton of water per minute (8.33 lb/gal, 60 gal/min per 500 gpm).' },

    // Foam operations
    { tag:'Foam',          title:'Class A vs Class B',      text:'Class A: ~0.1–1%; Class B: ~1–6% depending on product and fuel; always follow label/SOPs.' },
    { tag:'Foam',          title:'Eductor pressure',        text:'Most inline eductors require ~200 psi at the inlet and proper pick-up height/length.' },

    // Equations & quick tips
    { tag:'Equations',     title:'Smooth bore GPM',         text:'GPM = 29.7 × d² × √NP (d in inches, NP in psi).' },
    { tag:'Equations',     title:'1¾″ FL rule',             text:'For many mid-range flows, FL ≈ 2Q² per 100′ (Q = gpm/100); refine with full calc when needed.' },
    { tag:'Equations',     title:'2½″ FL rule',             text:'For 2½″ hose, FL ≈ Q² per 100′ (Q = gpm/100) as a quick estimate.' },
    { tag:'Equations',     title:'Water weight',            text:'1 gallon of water ≈ 8.33 lb; 1 cubic foot ≈ 7.48 gallons.' },

    // Fire acronyms – structure
    { tag:'Acronyms – Structure', title:'COAL WAS WEALTH',  text:'Construction, Occupancy, Area, Life hazard, Water supply, Auxiliary appliances, Street, Weather, Exposures, Apparatus & personnel, Location & extent, Time, Height.' },
    { tag:'Acronyms – Structure', title:'RECEO-VS',         text:'Rescue, Exposures, Confinement, Extinguishment, Overhaul, Ventilation, Salvage.' },

    // Fire acronyms – wildland
    { tag:'Acronyms – Wildland',  title:'LCES',             text:'Lookouts, Communications, Escape routes, Safety zones.' },
    { tag:'Acronyms – Wildland',  title:'10 & 18',          text:'Know the 10 Standard Firefighting Orders and 18 Watch Out Situations (NWCG).' },
  ];

  // Hose sizes to display — (3" removed)
  const HOSE_ORDER = ['1.75','2.5','5'];
  const HOSE_LABEL = s =>
    s==='1.75' ? '1¾"' :
    s==='2.5'  ? '2½"' :
    `${s}"`;

  // FL ranges: aligned with common nozzle GPMs (incl. 185 & 265)
  const GPM_SETS = {
    '1.75': [95, 125, 150, 160, 175, 185, 200],
    '2.5':  [150, 185, 200, 250, 265, 300, 325, 400, 500, 600],
    '5':    [500, 750, 800, 1000, 1250],
  };

  // Low-friction C values (approximate; adjust as needed)
  const LOW_C = {
    '1.75': 13,   // lower FL "combat-ready" style 1¾"
    '2.5':  1.5,
    '5':    0.05,
  };

  // ====== DOM refs
  const btnShowNozzles = container.querySelector('#btnShowNozzles');
  const btnShowFL = container.querySelector('#btnShowFL');
  const btnShowRules = container.querySelector('#btnShowRules');

  const nozzCard = container.querySelector('#nozzlesCard');
  const flCard = container.querySelector('#flCard');
  const rulesCard = container.querySelector('#rulesCard');

  const fogWrap = container.querySelector('#nozzlesFog');
  const sbWrap  = container.querySelector('#nozzlesSB');
  const hoseRow = container.querySelector('.hoseRow');
  const flTableWrap = container.querySelector('#flTableWrap');
  const rulesList = container.querySelector('#rulesList');

  const flModeButtons = Array.from(container.querySelectorAll('[data-flmode]'));
  let currentFLMode = 'standard'; // 'standard' | 'low'

  // ====== Render helpers
  function showOnly(card){
    nozzCard.style.display  = (card === nozzCard) ? 'block' : 'none';
    flCard.style.display    = (card === flCard)   ? 'block' : 'none';
    rulesCard.style.display = (card === rulesCard)? 'block' : 'none';
  }

  // Get C based on current mode
  function getCoeff(sizeKey){
    if (currentFLMode === 'low') {
      const cLow = LOW_C[sizeKey];
      if (cLow != null) return cLow;
      // If no low-friction C defined, fall back to standard so the table still works
    }
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

  // --- FL
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
      // select the first hose that has a C in this mode
      renderFLTable(available[0]);
      hoseRow.querySelectorAll('.hoser').forEach(btn => {
        btn.classList.toggle('on', btn.dataset.size === String(available[0]));
      });
    }else{
      flTableWrap.innerHTML = `<div class="status alert">No hose coefficients found for ${currentFLMode === 'low' ? 'low-friction' : 'standard'} mode (expected keys: 1.75, 2.5, 5).</div>`;
    }
  }

  function renderFLTable(sizeKey){
    const C = getCoeff(sizeKey);
    if(C == null){
      flTableWrap.innerHTML = `<div class="status alert">Missing C for ${HOSE_LABEL(sizeKey)} in ${currentFLMode === 'low' ? 'low-friction' : 'standard'} mode.</div>`;
      return;
    }
    const list = GPM_SETS[sizeKey] || [];
    const rows = list.map(g=>{
      const per100 = C * Math.pow(g/100, 2);
      const val = per100 < 1 ? (Math.round(per100*10)/10).toFixed(1) : Math.round(per100);
      return `<tr data-g="${g}"><td>${g} gpm</td><td class="muted">C=${C}</td><td><b>${val}</b> psi / 100′</td></tr>`;
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

  // --- RULES
  function renderRules(){
    rulesList.innerHTML = `
      <div class="rulesList">
        ${RULES.map(r => `
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
  }

  // ====== Interactions
  btnShowNozzles.addEventListener('click', ()=>{
    renderNozzlesSB();
    renderNozzlesFog();
    container.querySelectorAll('.segBtn[data-type]').forEach(b=>{
      const on = b.dataset.type==='sb';
      b.classList.toggle('segOn', on);
      b.setAttribute('aria-selected', on?'true':'false');
    });
    sbWrap.style.display='grid'; fogWrap.style.display='none';
    showOnly(nozzCard);
  });

  btnShowFL.addEventListener('click', ()=>{
    // ensure mode buttons reflect current mode and tables are fresh
    setFLMode(currentFLMode);
    showOnly(flCard);
  });

  btnShowRules.addEventListener('click', ()=>{
    renderRules();
    showOnly(rulesCard);
  });

  // Nozzle segmented control (SB | Fog)
  container.addEventListener('click', (e)=>{
    const t = e.target.closest('.segBtn'); if(!t) return;
    const type = t.dataset.type;
    // Ignore seg buttons that aren't for nozzles (i.e., FL mode buttons)
    if(!type) return;

    container.querySelectorAll('.segBtn[data-type]').forEach(b=>{
      b.classList.toggle('segOn', b===t);
      b.setAttribute('aria-selected', b===t?'true':'false');
    });
    if(type==='sb'){ sbWrap.style.display='grid'; fogWrap.style.display='none'; }
    else { sbWrap.style.display='none'; fogWrap.style.display='grid'; }
  });

  // FL mode segmented control (standard | low-friction)
  flModeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setFLMode(btn.dataset.flmode || 'standard');
    });
  });

  return { dispose(){} };
}

export default { render };

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
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[m]));
}
