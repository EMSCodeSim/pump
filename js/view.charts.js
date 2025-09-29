// ./js/view.charts.js
import { COEFF } from './store.js';

/**
 * Charts View
 * - Default: only launcher buttons visible.
 * - Sections:
 *   1) Nozzles  (Fog | Smooth Bore)
 *   2) Hose Friction Loss (horizontal hose-size buttons; FL per 100')
 *   3) Rules of Thumb
 */

export async function render(container){
  container.innerHTML = `
    <section class="stack">

      <!-- Section launchers -->
      <section class="card">
        <div class="controls" style="display:flex; gap:10px; flex-wrap:wrap">
          <button class="btn primary" id="btnShowNozzles">Nozzles</button>
          <button class="btn" id="btnShowFL">Hose Friction Loss</button>
          <button class="btn" id="btnShowRules">Rules of Thumb</button>
        </div>
        <div class="status" style="margin-top:8px">Pick a topic to view details.</div>
      </section>

      <!-- NOZZLES (hidden until pressed) -->
      <section class="card" id="nozzlesCard" style="display:none">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap">
          <div class="ink-strong" style="font-weight:700">Nozzles</div>
          <div class="seg" role="tablist" aria-label="Nozzle type">
            <button class="segBtn segOn" data-type="fog" role="tab" aria-selected="true">Fog</button>
            <button class="segBtn" data-type="sb" role="tab" aria-selected="false">Smooth Bore</button>
          </div>
        </div>

        <!-- Fog containers -->
        <div id="nozzlesFog" class="nozzWrap" style="margin-top:10px"></div>
        <!-- Smooth Bore containers -->
        <div id="nozzlesSB" class="nozzWrap" style="margin-top:10px; display:none"></div>
      </section>

      <!-- FL (hidden until pressed) -->
      <section class="card" id="flCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Friction Loss (per 100′)</div>

        <!-- Horizontal hose-size buttons -->
        <div class="hoseRow" role="tablist" aria-label="Hose size">
          <!-- buttons filled at runtime -->
        </div>

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

  // ====== Local styles (high contrast, segmented control, layout)
  injectLocalStyles(container, `
    .ink-strong { color: #ffffff; }
    .seg { display:inline-flex; background:#0f141c; border:1px solid rgba(255,255,255,.12); border-radius:12px; overflow:hidden }
    .segBtn {
      appearance:none; background:transparent; color:#cfe6ff; border:0; padding:10px 14px;
      font-weight:600; min-height:44px; cursor:pointer;
    }
    .segBtn.segOn { background:#1a2738; color:#fff; }

    .nozzWrap { display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:10px; }
    .nozzCard { background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:10px; }
    .groupHeader {
      grid-column:1/-1; margin:2px 0 6px 0; color:#fff; font-weight:800; letter-spacing:.2px;
      padding-top:4px; border-top:1px dashed rgba(255,255,255,.12);
    }
    .nozzTitle { color:#fff; font-weight:700; margin-bottom:4px; }
    .nozzSub { color:#cfe6ff; font-size:14px; }

    .hoseRow { display:flex; gap:8px; flex-wrap:wrap; }
    .hoseRow .hoser {
      appearance:none; border:1px solid rgba(255,255,255,.14); background:#131b26; color:#fff;
      border-radius:12px; padding:10px 12px; min-height:44px; font-weight:700; cursor:pointer;
    }
    .hoseRow .hoser.on { background:#2a8cff; }

    .flTable { width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; border-radius:12px; }
    .flTable th, .flTable td { padding:10px 12px; text-align:left; }
    .flTable thead th { background:#162130; color:#fff; border-bottom:1px solid rgba(255,255,255,.1); }
    .flTable tbody tr:nth-child(odd) td { background:#0e151e; color:#dfeaff; }
    .flTable tbody tr:nth-child(even) td { background:#111924; color:#dfeaff; }
    .flTable .muted { color:#a9bed9; }

    .rulesList { display:grid; gap:8px; }
    .rule {
      background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;
      display:flex; gap:10px; align-items:flex-start;
    }
    .pill {
      background:#2a8cff; color:#fff; font-weight:700;
      padding:4px 8px; border-radius:999px; font-size:12px; white-space:nowrap;
      align-self:flex-start;
    }
    .ruleTitle { color:#fff; font-weight:700; margin:0 0 2px 0; }
    .ruleText { color:#dfeaff; margin:0; }
  `);

  // ====== Data

  // Fog (handline LP & standard, plus Master Fog @100 NP)
  const FOG_HANDLINE = [
    // Standard 75 psi
    { label:'Fog 150@75', gpm:150, NP:75, note:'Handline' },
    { label:'Fog 185@75', gpm:185, NP:75, note:'Handline high-flow' },
    { label:'Fog 200@75', gpm:200, NP:75, note:'Handline high-flow' },
    { label:'Fog 250@75 (2½″)', gpm:250, NP:75, note:'2½″ line' },

    // Low-pressure ChiefXD 50 psi (incl. 265)
    { label:'ChiefXD 150@50', gpm:150, NP:50, note:'Low-pressure' },
    { label:'ChiefXD 185@50', gpm:185, NP:50, note:'Low-pressure' },
    { label:'ChiefXD 200@50', gpm:200, NP:50, note:'Low-pressure' },
    { label:'ChiefXD 265@50', gpm:265, NP:50, note:'Low-pressure (2½″ capable)' },

    // Optional legacy/common 100 psi entries (kept here for reference)
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

  // Smooth Bore — Handline 50 psi, Master 80 psi (GPM from 29.7*d^2*sqrt(NP))
  const SB_HANDLINE_50 = [
    { tip:'7/8″',  gpm:161, NP:50 },
    { tip:'15/16″',gpm:185, NP:50 },
    { tip:'1″',    gpm:210, NP:50 },
    { tip:'1 1/8″',gpm:266, NP:50 },
    { tip:'1 1/4″',gpm:328, NP:50 },
    { tip:'1 3/8″',gpm:398, NP:50 },
    { tip:'1 1/2″',gpm:473, NP:50 },
  ];
  const SB_MASTER_80 = [
    { tip:'1″',     gpm:266,  NP:80 },
    { tip:'1 1/8″', gpm:336,  NP:80 },
    { tip:'1 1/4″', gpm:415,  NP:80 },
    { tip:'1 3/8″', gpm:502,  NP:80 },
    { tip:'1 1/2″', gpm:598,  NP:80 },
    { tip:'1 3/4″', gpm:814,  NP:80 },
    { tip:'2″',     gpm:1063, NP:80 },
  ];

  // Rules of Thumb
  const RULES = [
    { tag:'Appliances',    title:'Add 10 psi over 350 gpm', text:'For appliance losses when total flow exceeds ~350 gpm, add 10 psi.' },
    { tag:'Master Stream', title:'Add 25 psi',              text:'Typical appliance loss for deck gun/monitor/master stream devices.' },
    { tag:'Standpipes',    title:'Add 25 psi + elevation',  text:'Add 25 psi for the system plus elevation (head) losses.' },
    { tag:'Sprinklers',    title:'Pump at 150 psi',         text:'A common starting point; follow FDC signage and SOGs.' },
    { tag:'Elevation',     title:'±5 psi per 10 ft',        text:'Add going uphill; subtract going downhill.' },
    { tag:'Relay Pump',    title:'Residual 20–50 psi',      text:'Maintain 20–50 psi residual at the receiving engine.' },
    { tag:'Handline SB',   title:'NP 50 psi',               text:'Smooth-bore handline nozzle pressure.' },
    { tag:'Master SB',     title:'NP 80 psi',               text:'Smooth-bore master stream nozzle pressure.' },
    { tag:'Piercing',      title:'NP 80 psi',               text:'Piercing nozzle nozzle pressure.' },
    { tag:'Cellar',        title:'NP 80 psi',               text:'Cellar nozzle nozzle pressure.' },
  ];

  // Hose sizes to display (must exist in COEFF)
  const HOSE_ORDER = ['1.75','2.5','5'];
  const HOSE_LABEL = s => s==='1.75' ? '1¾″' : (s==='2.5' ? '2½″' : s + '″');

  const GPM_SETS = {
    '1.75': [100, 150, 160, 175, 185, 200],
    '2.5':  [200, 250, 265, 300, 325],
    '5':    [500, 750, 1000, 1250]
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

  // ====== Render helpers
  function showOnly(card){
    nozzCard.style.display  = (card === nozzCard) ? 'block' : 'none';
    flCard.style.display    = (card === flCard)   ? 'block' : 'none';
    rulesCard.style.display = (card === rulesCard)? 'block' : 'none';
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
      <div class="groupHeader">Master Stream Fog</div>
      ${FOG_MASTER.map(n=>`
        <div class="nozzCard">
          <div class="nozzTitle">${escapeHTML(n.label)}</div>
          <div class="nozzSub">GPM: <b>${n.gpm}</b> — NP: <b>${n.NP} psi</b>${n.note?`<div class="muted mini">${escapeHTML(n.note)}</div>`:''}</div>
        </div>
      `).join('')}
    `;
  }

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

  function renderHoseButtons(){
    hoseRow.innerHTML = '';
    const available = HOSE_ORDER.filter(s => COEFF[s] != null);
    available.forEach((s, i)=>{
      const b = document.createElement('button');
      b.className = 'hoser' + (i===0?' on':'');
      b.dataset.size = s;
      b.textContent = `${HOSE_LABEL(s)}`;
      b.addEventListener('click', ()=>{
        hoseRow.querySelectorAll('.hoser').forEach(x=>x.classList.remove('on'));
        b.classList.add('on');
        renderFLTable(s);
      });
      hoseRow.appendChild(b);
    });
    if(available.length){
      renderFLTable(available[0]);
    }else{
      flTableWrap.innerHTML = `<div class="status alert">No hose coefficients found in store.js.</div>`;
    }
  }

  function renderFLTable(sizeKey){
    const C = COEFF[sizeKey];
    const rows = (GPM_SETS[sizeKey] || []).map(g=>{
      const per100 = C * Math.pow(g/100, 2);
      const val = per100 < 1 ? (Math.round(per100*10)/10).toFixed(1) : Math.round(per100);
      return `<tr><td>${g} gpm</td><td class="muted">C=${C}</td><td><b>${val}</b> psi / 100′</td></tr>`;
    }).join('');
    flTableWrap.innerHTML = `
      <table class="flTable" role="table" aria-label="Friction loss per 100 feet">
        <thead><tr><th>Flow</th><th class="muted">Coeff</th><th>FL per 100′</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3" class="muted">No GPM presets.</td></tr>`}</tbody>
      </table>
    `;
  }

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
    renderNozzlesFog();
    renderNozzlesSB();
    // default to Fog tab visible
    document.querySelectorAll('.segBtn').forEach(b=>{
      const on = b.dataset.type==='fog';
      b.classList.toggle('segOn', on);
      b.setAttribute('aria-selected', on?'true':'false');
    });
    fogWrap.style.display='grid'; sbWrap.style.display='none';
    showOnly(nozzCard);
  });

  btnShowFL.addEventListener('click', ()=>{
    renderHoseButtons();
    showOnly(flCard);
  });

  btnShowRules.addEventListener('click', ()=>{
    renderRules();
    showOnly(rulesCard);
  });

  // Nozzle segmented control (Fog | SB)
  container.addEventListener('click', (e)=>{
    const t = e.target.closest('.segBtn'); if(!t) return;
    const type = t.dataset.type;
    container.querySelectorAll('.segBtn').forEach(b=>{
      b.classList.toggle('segOn', b===t);
      b.setAttribute('aria-selected', b===t?'true':'false');
    });
    if(type==='fog'){ fogWrap.style.display='grid'; sbWrap.style.display='none'; }
    else { fogWrap.style.display='none'; sbWrap.style.display='grid'; }
  });

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
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
