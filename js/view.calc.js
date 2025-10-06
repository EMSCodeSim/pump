// /js/view.calc.js
// Stage view with popup editor support, Wye-aware UI (no main nozzle when wye),
// Branch-B default nozzle = Fog 185 @ 50, diameter-based default nozzles,
// and practice-state persistence (including tender shuttle) across view switches.
//
// Requires: ./store.js, ./waterSupply.js, and bottom-sheet-editor.js (optional; this file works without it).

import {
  state,
  NOZ,
  NOZ_LIST,
  COLORS,
  FL,
  FL_total,
  sumFt,
  splitIntoSections,
  calcDF,
  round,
  clamp,
  safeClone,
  deepMerge,
  defaultNozzleByDia,
  defaultMainNozzle,
  defaultBranchNozzle,
  isSupplyActive,
  resetPracticeState,
  practiceSaveKey,
  ensurePracticeDefaults,
  withPersistedPracticeState
} from './store.js';

import * as waterSupply from './waterSupply.js';

// Try to use the new center popup editor if available; fall back to old inline flow
let Popup = null;
try { Popup = window.BottomSheetEditor; } catch (_) {}

function h(tag, attrs={}, ...kids){
  const el = document.createElement(tag);
  Object.entries(attrs||{}).forEach(([k,v])=>{
    if (k==='style' && typeof v==='object') el.setAttribute('style', Object.entries(v).map(([a,b])=>`${a}:${b}`).join(';'));
    else if (k.startsWith('on') && typeof v==='function') el.addEventListener(k.slice(2), v);
    else if (v===true) el.setAttribute(k, k);
    else if (v!==false && v!=null) el.setAttribute(k, v);
  });
  kids.flat().forEach(k=> {
    if (k==null) return;
    if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(k));
  });
  return el;
}

function injectStyle(root, cssText){ const s=document.createElement('style'); s.textContent=cssText; root.appendChild(s); }

function formatGPM(n){ return `${round(n)}`; }
function formatPSI(n){ return `${round(n)}`; }

function truckLeftX(){ return 60; }
function truckRightX(){ return 350; }
function truckTopY(){ return 80; }
function truckMidY(){ return 150; }
function truckBotY(){ return 220; }

function drawHosePath(svg, x1,y1, x2,y2, color='#6ecbff', width=6, dash=null){
  const p = document.createElementNS('http://www.w3.org/2000/svg','path');
  p.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
  p.setAttribute('fill','none');
  p.setAttribute('stroke', color);
  p.setAttribute('stroke-width', width);
  if (dash) p.setAttribute('stroke-dasharray', dash);
  svg.appendChild(p);
  return p;
}

function drawLabel(svg, x, y, text, fg='#eaf2ff', bg='#0b0f14'){
  const g = document.createElementNS('http://www.w3.org/2000/svg','g');
  const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
  const t = document.createElementNS('http://www.w3.org/2000/svg','text');
  t.textContent = text;
  t.setAttribute('x', x);
  t.setAttribute('y', y);
  t.setAttribute('class','lbl');
  t.setAttribute('text-anchor','middle');
  t.setAttribute('dominant-baseline','central');
  g.appendChild(t);
  const bbox = { w: Math.max(20, 8*text.length), h: 14 };
  rect.setAttribute('x', x - bbox.w/2 - 4);
  rect.setAttribute('y', y - bbox.h/2 - 2);
  rect.setAttribute('width', bbox.w + 8);
  rect.setAttribute('height', bbox.h + 4);
  rect.setAttribute('rx', 6);
  rect.setAttribute('fill', bg);
  rect.setAttribute('stroke', 'rgba(255,255,255,.14)');
  g.insertBefore(rect, t);
  svg.appendChild(g);
  return g;
}

/* ------------------------------ Render -------------------------------- */

export async function render(container){

  // fresh default if coming from a new load; otherwise restore practice state
  ensurePracticeDefaults(state);

  container.innerHTML = `
    <section class="stack">
      <section class="card">
        <div class="controlBlock">
          <div class="controlRow">
            <div class="lineGroup">
              <button class="linebtn" data-line="left">Line 1</button>
              <button class="linebtn" data-line="back">Line 2</button>
              <button class="linebtn" data-line="right">Line 3</button>
            </div>
            <div class="actionGroup">
              <button class="presetsbtn" id="presetsBtn">Presets</button>
            </div>
          </div>

          <div class="controlRow">
            <div class="actionGroup">
              <button class="supplybtn" id="hydrantBtn" title="Pressurized (Hydrant)">Hydrant</button>
              <button class="supplybtn" id="tenderBtn" title="Tender shuttle">Tender</button>
              <button class="supplybtn" id="relayBtn"   title="Relay pump">Relay</button>
            </div>
            <div class="actionGroup">
              <button class="btn" id="resetBtn" title="Clear current setup">Clear</button>
            </div>
          </div>
        </div>

        <div class="wrapper">
          <svg id="stageSvg" viewBox="0 0 420 260" style="width:100%;height:auto;display:block;background:transparent;border-radius:12px">
            <defs></defs>
            <image href="/assets/images/engine181.png" x="0" y="0" width="420" height="260" preserveAspectRatio="xMidYMid meet"></image>

            <g id="hoses"></g>
            <g id="branches"></g>
            <g id="labels"></g>

            <!-- [+] hotspots -->
            <g id="hotspots">
              <g class="hot" data-edit="left">
                <circle cx="40" cy="150" r="12" fill="#0e2036" stroke="#29507a" />
                <text x="40" y="150" text-anchor="middle" dominant-baseline="central" fill="#eaf2ff" font-size="14">+</text>
              </g>
              <g class="hot" data-edit="back">
                <circle cx="210" cy="210" r="12" fill="#0e2036" stroke="#29507a" />
                <text x="210" y="210" text-anchor="middle" dominant-baseline="central" fill="#eaf2ff" font-size="14">+</text>
              </g>
              <g class="hot" data-edit="right">
                <circle cx="380" cy="150" r="12" fill="#0e2036" stroke="#29507a" />
                <text x="380" y="150" text-anchor="middle" dominant-baseline="central" fill="#eaf2ff" font-size="14">+</text>
              </g>
            </g>
          </svg>
        </div>
      </section>

      <!-- KPIs & answer box -->
      <section class="card">
        <div class="kpis">
          <!-- Total Flow -->
          <div class="kpi" id="kpiFlow">
            <div class="kpiLabel">Total Flow</div>
            <div class="kpiValue">
              <b id="GPM" aria-live="polite">—</b>
              <span class="kpiUnit">gpm</span>
            </div>
          </div>

          <!-- Max PP -->
          <div class="kpi" id="kpiPdp">
            <div class="kpiLabel">Max PP</div>
            <div class="kpiValue">
              <b id="PDP" aria-live="polite">—</b>
              <span class="kpiUnit">psi</span>
            </div>
            <button class="whyBtn" id="whyBtn" type="button">Why?</button>
          </div>
        </div>

        <div id="supplySummary" class="supplySummary" style="margin-top:10px; display:none;"></div>

        <!-- Hydrant helper -->
        <div id="hydrantHelper" class="helperPanel" style="display:none; margin-top:10px; background:#0b1320; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
          <div style="color:#fff; font-weight:800; margin-bottom:6px">Hydrant Residual %Drop</div>
          <div class="mini" style="color:#a9bed9; margin-bottom:8px">
            0–10% → 3×, 11–15% → 2×, 16–25% → 1×, >25% → 0× of same-size lines
          </div>
          <div class="fieldRow" style="display:flex; gap:10px; flex-wrap:wrap">
            <div class="field" style="min-width:150px">
              <label>Line size</label>
              <select id="hydrantLineSize">
                <option value="1.75">1¾″</option>
                <option value="2.5">2½″</option>
              </select>
            </div>
            <div class="field" style="min-width:150px">
              <label>Static (psi)</label>
              <input type="number" id="hydrantStatic" placeholder="e.g., 80" inputmode="decimal">
            </div>
            <div class="field" style="min-width:170px">
              <label>Residual w/ 1 line (psi)</label>
              <input type="number" id="hydrantResidual" placeholder="e.g., 72" inputmode="decimal">
            </div>
            <div class="field" style="min-width:150px; display:flex; align-items:flex-end">
              <button class="btn primary" id="hydrantCalcBtn" type="button">Evaluate %Drop</button>
            </div>
          </div>
          <div id="hydrantResult" class="status" style="margin-top:8px; background:#0b1a29; border:1px solid #1f3a57; border-radius:10px; padding:8px; color:#cfe6ff">Enter numbers then press <b>Evaluate %Drop</b>.</div>
        </div>

        <!-- Tender shuttle -->
        <div id="tenderPanel" class="helperPanel" style="display:none; margin-top:10px; background:#0b1320; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <div style="color:#fff; font-weight:800;">Tender Shuttle</div>
            <div class="pill" style="background:#0b1a29;border:1px solid #1f3a57;border-radius:999px;padding:6px 10px">
              Total Shuttle GPM: <span id="shuttleTotalGpm">0</span>
            </div>
          </div>

          <div style="margin-top:8px; display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end">
            <div class="field" style="min-width:160px">
              <label>Tender ID / Number</label>
              <input id="tAddId" type="text" placeholder="e.g., Tender 2">
            </div>
            <div class="field" style="min-width:160px">
              <label>Capacity (gal)</label>
              <input id="tAddCap" type="number" inputmode="decimal" placeholder="e.g., 3000">
            </div>
            <div class="field" style="min-width:160px">
              <label>Round-trip (min)</label>
              <input id="tAddTrip" type="number" inputmode="decimal" placeholder="e.g., 12">
            </div>
            <div class="field" style="min-width:160px">
              <label>Fill time (min)</label>
              <input id="tAddFill" type="number" inputmode="decimal" placeholder="e.g., 6">
            </div>
            <div class="field" style="min-width:140px; display:flex; align-items:flex-end">
              <button id="tAddBtn" class="btn primary" type="button">Add Tender</button>
            </div>
          </div>

          <div id="tenderList" style="margin-top:10px; display:grid; gap:8px;"></div>
        </div>
      </section>

      <!-- Lines table -->
      <section class="card">
        <div class="simpleBox"><b>Lines</b> (tap + to edit, Wye hides main nozzle; Branch-B default Fog 185 @50)</div>
        <div class="linesTable is-hidden" id="linesTable"></div>
      </section>
    </section>

    <!-- Presets bottom sheet -->
    <div id="sheet" class="sheet" aria-modal="true" role="dialog" style="display:none">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="title">Presets</div>
        <button class="btn" id="sheetClose">Close</button>
      </div>
      <div class="mini" style="opacity:.85;margin-top:4px">Pick a setup, then choose line to apply.</div>

      <div class="preset-grid" id="presetGrid">
        <div class="preset" data-preset="standpipe">Standpipe</div>
        <div class="preset" data-preset="sprinkler">Sprinkler</div>
        <div class="preset" data-preset="foam">Foam</div>
        <div class="preset" data-preset="monitor">Monitor</div>
        <div class="preset" data-preset="aerial">Aerial</div>
      </div>

      <div class="mini" style="margin-top:10px">Apply to line:</div>
      <div class="linepick">
        <div class="preset" data-applyline="left">Line 1</div>
        <div class="preset" data-applyline="back">Line 2</div>
        <div class="preset" data-applyline="right">Line 3</div>
      </div>

      <div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end">
        <button class="btn" id="sheetApply" disabled>Apply</button>
      </div>
    </div>
    <div id="sheetBackdrop" class="sheetBackdrop"></div>
  `;

  injectStyle(container, `
    input, select, textarea, button { font-size:16px; }
    .btn, .linebtn, .supplybtn, .presetsbtn, .whyBtn { min-height:44px; padding:10px 14px; border-radius:12px; }
    .controlBlock { display:flex; flex-direction:column; gap:8px; margin-top:10px; }
    .controlRow { display:flex; gap:12px; justify-content:space-between; align-items:center; flex-wrap:wrap; }
    .lineGroup, .actionGroup { display:flex; gap:8px; flex-wrap:wrap; }
    .kpis { display:flex; gap:12px; flex-wrap:wrap; }
    .kpi b { font-size:20px; }
    .field label { display:block; font-weight:700; color:#dfe9ff; margin: 6px 0 4px; }
    .field input[type="text"], .field input[type="number"], .field select, .field textarea {
      width:100%; padding:10px 12px;
      border:1px solid rgba(255,255,255,.22); border-radius:12px;
      background:#0b1420; color:#eaf2ff; outline:none;
    }
    .field input:focus, .field select:focus, .field textarea:focus {
      border-color:#6ecbff; box-shadow:0 0 0 3px rgba(110,203,255,.22);
    }
    .sheet{ position:fixed; left:0; right:0; bottom:0; z-index:9999; background:#0e151e;
      border-top:1px solid rgba(255,255,255,.12); border-radius:16px 16px 0 0; transform:translateY(100%); transition:transform .25s ease;
      max-height: 80dvh; overflow:auto; padding:12px; }
    .sheet.show{ transform:translateY(0); }
    .sheetBackdrop{ position:fixed; inset:0; background:rgba(0,0,0,.45); display:none; z-index:9998; }
    .sheetBackdrop.show{ display:block; }
    .preset-grid, .linepick{ display:flex; gap:8px; flex-wrap:wrap; margin-top:6px }
    .preset{ background:#0b1a29; border:1px solid #1f3a57; border-radius:10px; padding:8px 10px; cursor:pointer; }
    .preset:active{ transform:translateY(1px); }
    .title{ font-weight:800; color:#eaf2ff }
    .mini{ font-size:12px; color:#a9bed9 }
    .status{ font-size:13px; }
    .linesTable .row { display:grid; grid-template-columns: 120px 1fr auto; align-items:center; gap:8px; }
    .simpleBox{background:#0b1a29;border:1px solid #29507a;border-radius:10px;padding:8px;margin-top:6px;font-size:13px}
    .lbl{font-size:10px;fill:#0b0f14}
    .is-hidden{display:none!important}
    /* KPI layout overrides for alignment and Why? in-card */
    .kpis{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:8px;
    }
    .kpi{
      display:grid;
      grid-template-columns: 1fr auto;
      grid-template-rows: auto auto;
      align-items:center;
      background:#0b1320;
      border:1px solid rgba(255,255,255,.14);
      border-radius:12px;
      padding:8px 10px;
      color:#cfe4ff;
    }
    .kpi .kpiLabel{
      grid-column:1 / -1;
      font-size:12px;
      opacity:.9;
      margin-bottom:2px;
    }
    .kpi .kpiValue{
      grid-column:1 / 2;
      justify-self:start;
      display:flex;
      align-items:baseline;
      gap:6px;
    }
    .kpi .kpiValue b{
      font-size:28px;
      line-height:1;
      color:#eaf2ff;
    }
    .kpi .kpiUnit{
      font-size:14px;
      opacity:.85;
    }
    .kpi .whyBtn{
      grid-column:2 / 3;
      justify-self:end;
      background:#0b1a29;
      border:1px solid #1f3a57;
      color:#eaf2ff;
      border-radius:999px;
      padding:6px 9px;
      font-size:12px;
      cursor:pointer;
    }
    .kpi .whyBtn:active{ transform:translateY(1px); }
    @media (max-width:360px){
      .kpi .kpiValue b{ font-size:24px; }
    }
  `);

  /* ------------------------------ DOM refs -------------------------------- */
  const stageSvg    = container.querySelector('#stageSvg');
  const G_hoses     = container.querySelector('#hoses');
  const G_branches  = container.querySelector('#branches');
  const G_labels    = container.querySelector('#labels');

  const G_supply    = container.querySelector('#supplySummary');
  const tenderPanel = container.querySelector('#tenderPanel');
  const hydrantHelper = container.querySelector('#hydrantHelper');

  const GPMel       = container.querySelector('#GPM');
  const PDPel       = container.querySelector('#PDP');

  const ids = {
    // tender inputs
    tAddId:        '#tAddId',
    tAddCap:       '#tAddCap',
    tAddTrip:      '#tAddTrip',
    tAddFill:      '#tAddFill',
    tAddBtn:       '#tAddBtn',
    tenderList:    '#tenderList',
    shuttleTotalGpm: '#shuttleTotalGpm',
    hydrantLineSize: '#hydrantLineSize',
    hydrantStatic:   '#hydrantStatic',
    hydrantResidual: '#hydrantResidual',
    hydrantCalcBtn:  '#hydrantCalcBtn',
    hydrantResult:   '#hydrantResult'
  };

  // Helper to pick the best snapshot API if present
  function pickWaterSnapshotSafe(){
    try {
      if (typeof waterSupply.getSnapshot === 'function') return waterSupply.getSnapshot();
      if (typeof waterSupply.snapshot    === 'function') return waterSupply.snapshot();
    } catch(_){}
    return null;
  }

  /* ------------------------------- Drawing -------------------------------- */

  function clearGroup(g){ while (g.firstChild) g.removeChild(g.firstChild); }

  function drawScene(){
    clearGroup(G_hoses); clearGroup(G_branches); clearGroup(G_labels);

    const vis = ['left','back','right'].filter(k => state.lines[k]?.deployed);

    // Hose rendering
    vis.forEach((key, idx)=>{
      const L = state.lines[key];
      const fromX = key==='left' ? truckLeftX()
                  : key==='right'? truckRightX()
                  : truckMidY() && 210;
      const fromY = key==='back' ? truckBotY() : truckMidY();
      const toX   = key==='left' ? 20 : key==='right' ? 400 : 210;
      const toY   = key==='back' ? 240 : (key==='left'? 110 : 110);

      drawHosePath(G_hoses, fromX, fromY, toX, toY, COLORS.hose[(L.dia||'1.75')], 6);
      if (L.hasWye){
        const bx = key==='left' ? 80 : key==='right' ? 340 : 210;
        drawHosePath(G_branches, bx, toY, bx-40, toY-20, COLORS.branch, 4, '6 6');
        drawHosePath(G_branches, bx, toY, bx+40, toY-20, COLORS.branch, 4, '6 6');
        drawLabel(G_labels, bx-40, toY-28, `${L.nozLeft?.gpm||185}gpm/${L.nozLeft?.NP||50}`, '#fff');
        drawLabel(G_labels, bx+40, toY-28, `${L.nozRight?.gpm||185}gpm/${L.nozRight?.NP||50}`, '#fff');
      } else if (L.noz){
        drawLabel(G_labels, toX, toY-18, `${L.noz.gpm}gpm/${L.noz.NP}`, '#fff');
      }
    });

    // KPIs
    let totalGPM = 0, maxPDP = -Infinity, maxKey = null;

    vis.forEach((key)=>{
      const L = state.lines[key];
      const calc = calcDF(L);
      const flow = calc.gpm||0;
      totalGPM += flow;
      const v = Math.round(calc.pdp||0);
      if (v>maxPDP){ maxPDP=v; maxKey=key; }
    });

    GPMel.textContent = vis.length? Math.round(totalGPM) : '—';

    if (vis.length){
      const v = isFinite(maxPDP)? maxPDP : 0;
      PDPel.textContent = v;
    }else{
      PDPel.textContent = '—';
    }
  }

  /* ------------------------------ Hydrant %Drop ---------------------------- */
  function hydrantEvaluate(staticPsi, residualPsi, size){
    const s = Number(staticPsi||0), r = Number(residualPsi||0); if (!s || !r || r>=s) return null;
    const dropPct = Math.round( ((s-r)/s) * 100 );
    const linesByPct = dropPct<=10 ? 3 : (dropPct<=15 ? 2 : (dropPct<=25 ? 1 : 0));
    const g = h('div',{}, 
      h('div',{}, `Drop = ${dropPct}% → you can likely add ${linesByPct} more ${size==='1.75'?'1¾′':'2½′'} lines of similar flow.`)
    );
    return { pct: dropPct, lines: linesByPct, node: g };
  }

  /* --------------------------------- Tender -------------------------------- */

  function tenderGpmFor(cap, trip, fill){
    const C = Number(cap||0), T = Number(trip||0), F = Number(fill||0);
    if (!C || (!T && !F)) return 0;
    const minutes = Math.max(0.1, T + F);
    return Math.round( (C / (minutes*60)) * 100 ) / 100;
  }

  function renderTenderList(){
    const list = container.querySelector(ids.tenderList);
    list.innerHTML = '';
    let sum = 0;
    state.tenders.forEach((t, idx)=>{
      const gpm = tenderGpmFor(t.cap, t.trip, t.fill);
      sum += gpm;
      const row = h('div', { class:'row', style:{ display:'grid', gridTemplateColumns:'1fr 120px 100px 100px 100px auto', gap:'8px', alignItems:'center' } },
        h('div',{}, t.id || `Tender ${idx+1}`),
        h('div',{}, `${t.cap||0} gal`),
        h('div',{}, `${t.trip||0} min`),
        h('div',{}, `${t.fill||0} min`),
        h('div',{}, `${gpm} gpm`),
        h('button', { class:'btn', onClick:()=>{ state.tenders.splice(idx,1); renderTenderList(); updateSupplySummary(); } }, 'Remove')
      );
      list.appendChild(row);
    });
    const tot = container.querySelector(ids.shuttleTotalGpm);
    if (tot) tot.textContent = Math.round(sum);
  }

  /* ------------------------------- Presets -------------------------------- */

  const sheet = container.querySelector('#sheet'), sheetBackdrop = container.querySelector('#sheetBackdrop');
  let chosenPreset=null, chosenLine=null;
  function openSheet(){ sheet.style.display='block'; sheet.classList.add('show'); sheetBackdrop.style.display='block'; }
  function closeSheet(){ sheet.classList.remove('show'); sheet.style.display='none'; sheetBackdrop.style.display='none'; chosenPreset=null; chosenLine=null; container.querySelector('#sheetApply').disabled=true; }
  container.querySelector('#presetsBtn').addEventListener('click', openSheet);
  container.querySelector('#sheetClose').addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', closeSheet);
  container.querySelector('#presetGrid').addEventListener('click',(e)=>{
    const p = e.target.closest('.preset'); if(!p) return;
    chosenPreset = p.dataset.preset;
    container.querySelectorAll('#presetGrid .preset').forEach(x=>x.style.outline='none');
    p.style.outline = '2px solid var(--accent)';
    updateSheetApply();
  });
  container.querySelector('.linepick').addEventListener('click',(e)=>{
    const p = e.target.closest('.preset'); if(!p) return;
    chosenLine = p.dataset.applyline;
    container.querySelectorAll('.linepick .preset').forEach(x=>x.style.outline='none');
    p.style.outline = '2px solid var(--accent)';
    updateSheetApply();
  });
  function updateSheetApply(){ container.querySelector('#sheetApply').disabled = !(chosenPreset && chosenLine); }
  container.querySelector('#sheetApply').addEventListener('click', ()=>{
    if (!(chosenPreset && chosenLine)) return;
    // Apply your preset logic; this retains your existing rules
    if (chosenPreset==='standpipe'){
      state.lines[chosenLine] = deepMerge(state.lines[chosenLine]||{}, {
        deployed:true, dia:'2.5', len:200, hasWye:false, noz: defaultNozzleByDia('2.5')
      });
    } else if (chosenPreset==='sprinkler'){
      state.lines[chosenLine] = deepMerge(state.lines[chosenLine]||{}, {
        deployed:true, dia:'2.5', len:150, hasWye:false, noz: defaultNozzleByDia('2.5')
      });
    } else if (chosenPreset==='foam'){
      state.lines[chosenLine] = deepMerge(state.lines[chosenLine]||{}, {
        deployed:true, dia:'1.75', len:150, hasWye:false, noz: defaultNozzleByDia('1.75')
      });
    } else if (chosenPreset==='monitor'){
      state.lines[chosenLine] = deepMerge(state.lines[chosenLine]||{}, {
        deployed:true, dia:'2.5', len:100, hasWye:false, noz: defaultNozzleByDia('2.5')
      });
    } else if (chosenPreset==='aerial'){
      state.lines[chosenLine] = deepMerge(state.lines[chosenLine]||{}, {
        deployed:true, dia:'5', len:150, hasWye:false, noz:null
      });
    }
    closeSheet();
    syncLinesTable();
    drawScene();
  });

  /* ------------------------------- Events -------------------------------- */

  // Why?
  container.querySelector('#whyBtn').addEventListener('click', ()=>{
    const msg = `PP = NP + FL + Elev (+ appliance${state.supply==='tender'?', tender loss':''})`;
    alert(msg);
  });

  // Supply buttons
  container.querySelector('#hydrantBtn').addEventListener('click', ()=>{
    state.supply = 'hydrant';
    tenderPanel.style.display='none';
    hydrantHelper.style.display='block';
    updateSupplySummary();
  });
  container.querySelector('#tenderBtn').addEventListener('click', ()=>{
    state.supply = 'tender';
    hydrantHelper.style.display='none';
    tenderPanel.style.display='block';
    renderTenderList();
    updateSupplySummary();
  });
  container.querySelector('#relayBtn').addEventListener('click', ()=>{
    state.supply = 'relay';
    hydrantHelper.style.display='none';
    tenderPanel.style.display='none';
    updateSupplySummary();
  });

  // Reset/clear
  container.querySelector('#resetBtn').addEventListener('click', ()=>{
    resetPracticeState(state);
    tenderPanel.style.display='none';
    hydrantHelper.style.display='none';
    updateSupplySummary();
    syncLinesTable();
    drawScene();
  });

  // Tender add
  container.querySelector(ids.tAddBtn).addEventListener('click', ()=>{
    const id   = container.querySelector(ids.tAddId).value.trim() || `Tender ${state.tenders.length+1}`;
    const cap  = Number(container.querySelector(ids.tAddCap).value||0);
    const trip = Number(container.querySelector(ids.tAddTrip).value||0);
    const fill = Number(container.querySelector(ids.tAddFill).value||0);
    state.tenders.push({ id, cap, trip, fill });
    container.querySelector(ids.tAddId).value='';
    container.querySelector(ids.tAddCap).value='';
    container.querySelector(ids.tAddTrip).value='';
    container.querySelector(ids.tAddFill).value='';
    renderTenderList();
    updateSupplySummary();
  });

  // Hydrant %Drop
  container.querySelector(ids.hydrantCalcBtn).addEventListener('click', ()=>{
    const size = container.querySelector(ids.hydrantLineSize).value;
    const st   = container.querySelector(ids.hydrantStatic).value;
    const rs   = container.querySelector(ids.hydrantResidual).value;
    const res  = hydrantEvaluate(st, rs, size);
    const el   = container.querySelector(ids.hydrantResult);
    if (!res){ el.textContent='Check values (Residual must be < Static).'; return; }
    el.innerHTML=''; el.appendChild(res.node);
  });

  // Hotspots → Editor
  container.querySelectorAll('#hotspots .hot').forEach(hot=>{
    hot.addEventListener('click', ()=>{
      const key = hot.getAttribute('data-edit');
      const L = state.lines[key] || {};
      if (Popup?.buildLineEditorForm){
        const form = Popup.buildLineEditorForm({
          size: L.dia || '1.75',
          lengthFt: L.len || 200,
          elevFt: L.elev || 0,
          hasWye: !!L.hasWye,
          nozzle: L.hasWye ? null : (L.noz ? { id:L.noz.id, gpm:L.noz.gpm, np:L.noz.NP, label:L.noz.label } : defaultMainNozzle(L.dia||'1.75'))
        });
        Popup.open({
          title: `Edit ${key[0].toUpperCase()+key.slice(1)} Line`,
          node: form,
          initialFocus: '#bseLen',
          onApply: ()=>{
            const data = form.readValues();
            // Apply rules: if Wye -> no main nozzle; defaults by dia otherwise
            const dia = data.size;
            const updated = {
              deployed: true,
              dia,
              len: data.lengthFt,
              elev: data.elevFt,
              hasWye: data.hasWye
            };
            if (data.hasWye){
              updated.noz = null;
              updated.nozLeft  = defaultBranchNozzle('left');  // Fog 185@50
              updated.nozRight = defaultBranchNozzle('right'); // Fog 185@50
            } else {
              updated.noz = data.nozzle ? { id:data.nozzle.id, gpm:data.nozzle.gpm, NP:data.nozzle.np, label:data.nozzle.label }
                                        : defaultMainNozzle(dia);
              updated.nozLeft = null; updated.nozRight = null;
            }
            state.lines[key] = deepMerge(state.lines[key]||{}, updated);
            syncLinesTable();
            drawScene();
          }
        });
      } else {
        // Fallback (no Popup): toggle deployed
        state.lines[key] = deepMerge(state.lines[key]||{}, { deployed: !state.lines[key]?.deployed });
        syncLinesTable();
        drawScene();
      }
    });
  });

  /* ----------------------------- Lines Table ------------------------------ */

  function renderLineRow(key, L){
    const d = L||{};
    const dia = d.dia || '1.75';
    const hasW = !!d.hasWye;
    const nozText = hasW ? '— (Wye)' : (d.noz ? `${d.noz.gpm}@${d.noz.NP}` : '—');
    const row = h('div', { class:'row' },
      h('div',{}, `${key[0].toUpperCase()+key.slice(1)}`),
      h('div',{}, `${dia}"  •  ${d.len||0}′  •  ${nozText}`),
      h('div',{},
        h('button', { class:'btn', onClick:()=> {
          const menu = document.querySelector(`[data-edit="${key}"]`);
          menu?.dispatchEvent(new Event('click', { bubbles:true }));
        }}, 'Edit')
      )
    );
    return row;
  }

  function syncLinesTable(){
    const t = container.querySelector('#linesTable');
    const vis = ['left','back','right'].filter(k => state.lines[k]?.deployed);
    if (!vis.length){ t.classList.add('is-hidden'); t.innerHTML=''; return; }
    t.classList.remove('is-hidden');
    t.innerHTML='';
    vis.forEach(k => t.appendChild(renderLineRow(k, state.lines[k])));
  }

  /* --------------------------- Supply Summary ----------------------------- */

  function updateSupplySummary(){
    if (!state.supply){ G_supply.style.display='none'; G_supply.textContent=''; drawScene(); return; }
    G_supply.style.display='block';
    if (state.supply==='tender'){
      const g = state.tenders.reduce((sum,t)=> sum + tenderGpmFor(t.cap,t.trip,t.fill), 0);
      G_supply.innerHTML = `
        <div class="simpleBox">
          <div><b>Tender shuttle</b></div>
          <div class="row"><span class="k">Tenders</span><span class="v">${state.tenders.length}</span></div>
          <div class="row"><span class="k">Total Shuttle GPM</span><span class="v"><b>${Math.round(g)}</b> gpm</span></div>
        </div>
      `;
    } else if (state.supply==='hydrant'){
      G_supply.innerHTML = `
        <div class="simpleBox">
          <b>Hydrant</b> — use Residual %Drop helper to estimate additional same-size lines.
        </div>
      `;
    } else if (state.supply==='relay'){
      G_supply.innerHTML = `<div class="simpleBox"><b>Relay</b> — set intermediate PDP as needed.</div>`;
    }
    drawScene();
  }

  /* --------------------------- Practice persistence ----------------------- */

  // Auto-save practice state periodically
  let __saveInterval = null;
  function startAutoSave(){
    stopAutoSave();
    __saveInterval = setInterval(()=>{
      try{
        const snap = buildSnapshot(pickWaterSnapshotSafe());
        sessionStorage.setItem(practiceSaveKey, JSON.stringify(snap));
      }catch(_){}
    }, 1500);
  }
  function stopAutoSave(){
    if (__saveInterval) clearInterval(__saveInterval);
    __saveInterval = null;
  }

  // Build a combined snapshot: full sim state + optional water supply snapshot
  function buildSnapshot(waterSnapshot){
    return safeClone({
      state,                // entire sim state (lines, supply, etc.)
      water: waterSnapshot || null
    });
  }

  // Applies snapshot back into the app state (used when returning from Charts)
  function applySnapshot(snap){
    if (!snap) return;
    if (snap.state) deepMerge(state, snap.state);
    if (snap.water && typeof waterSupply.restoreSnapshot === 'function'){
      try { waterSupply.restoreSnapshot(snap.water); } catch(_){}
    }
    syncLinesTable(); updateSupplySummary(); drawScene();
  }

  // On entry: try to load any saved practice snapshot (unless fresh load cleared)
  withPersistedPracticeState(applySnapshot);

  // Initial renders
  syncLinesTable();
  updateSupplySummary();
  drawScene();
  startAutoSave();

  // Cleanup when view destroyed (if your router supports)
  return ()=> stopAutoSave();
}

export default { render };
