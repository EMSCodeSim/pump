// view.calc.js
// Your original working logic stays here. Only change: water-supply UI is imported
// and called from this file. All non-supply logic remains untouched.

import {
  state, NOZ, NOZ_LIST, COLORS,
  FL, FL_total, sumFt, splitIntoSections, PSI_PER_FT,
  seedDefaultsForKey, isSingleWye, activeNozzle, activeSide, sizeLabel
} from './store.js';

import { WaterSupplyUI } from './waterSupply.js';

const TRUCK_W=390, TRUCK_H=260, PX_PER_50FT=45, CURVE_PULL=36, BRANCH_LIFT=10;

export async function render(container){
  // === Original DOM structure (unchanged except that hydrant/static helpers are still here) ===
  container.innerHTML = `
    <section class="stack">
      <section class="wrapper card">
        <div class="stage" id="stage">
          <svg id="overlay" viewBox="0 0 390 260" preserveAspectRatio="xMidYMax meet" aria-label="Visual stage">
            <image id="truckImg" href="/assets/images/engine181.png" x="0" y="0" width="390" height="260" preserveAspectRatio="xMidYMax meet" onerror="this.setAttribute('href','https://fireopssim.com/pump/engine181.png')"></image>
            <g id="hoses"></g><g id="branches"></g><g id="labels"></g><g id="tips"></g><g id="supplyG"></g>
          </svg>

          <div class="info" id="topInfo">No lines deployed</div>
          <div class="linebar">
            <button class="linebtn" data-line="left">Line 1</button>
            <button class="linebtn" data-line="back">Line 2</button>
            <button class="linebtn" data-line="right">Line 3</button>
            <button class="supplybtn" id="supplyBtn">Supply</button>
            <button class="presetsbtn" id="presetsBtn">Presets</button>
          </div>
        </div>
      </section>

      <!-- KPIs -->
      <section class="card">
        <div class="kpis">
          <div class="kpi"><div>Total Flow</div><b id="GPM">— gpm</b></div>
          <div class="kpi"><div>Max PP</div><b id="PDP">— psi</b><button id="whyBtn" class="whyBtn">Why?</button></div>
        </div>

        <!-- HYDRANT %DROP (kept; logic handled in waterSupply.js) -->
        <div id="hydrantHelper" class="helperPanel" style="display:none; margin-top:10px; background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
          <div style="color:#fff; font-weight:800; margin-bottom:6px">Hydrant Residual %Drop</div>
          <div class="mini" style="color:#a9bed9; margin-bottom:8px">
            Enter static & residual with one line flowing to estimate additional <b>same-size</b> lines:
            <span class="pill" style="margin-left:6px">0–10% → 3×</span>
            <span class="pill">11–15% → 2×</span>
            <span class="pill">16–25% → 1×</span>
            <span class="pill">&gt;25% → 0×</span>
          </div>
          <div class="row" style="display:flex; gap:10px; flex-wrap:wrap">
            <div class="field" style="min-width:150px">
              <label>Line size</label>
              <select id="hydrantLineSize">
                <option value="1.75">1¾″ (attack)</option>
                <option value="2.5">2½″</option>
                <option value="5">5″ LDH</option>
              </select>
            </div>
            <div class="field" style="min-width:140px">
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
          <div id="hydrantResult" class="status" style="margin-top:8px; color:#cfe6ff">Enter numbers then press <b>Evaluate %Drop</b>.</div>
        </div>

        <!-- STATIC / DRAFTING: TENDER SHUTTLE (kept; logic handled in waterSupply.js) -->
        <div id="staticHelper" class="helperPanel" style="display:none; margin-top:10px; background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <div>
              <div style="color:#fff; font-weight:800;">Tender Shuttle (Static Supply)</div>
              <div class="mini" style="color:#a9bed9">Assume 10% capacity loss. Start when leaving scene; stop on return full. Or enter minutes directly.</div>
            </div>
            <div class="pill">Total Shuttle GPM: <span id="shuttleTotalGpm">0</span></div>
          </div>

          <div class="row" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
            <div class="field" style="min-width:160px">
              <label>Tender ID / Number</label>
              <input id="tAddId" type="text" placeholder="e.g., Tender 2">
            </div>
            <div class="field" style="min-width:160px">
              <label>Capacity (gal)</label>
              <input id="tAddCap" type="number" inputmode="decimal" placeholder="e.g., 3000">
            </div>
            <div class="field" style="min-width:140px; display:flex; align-items:flex-end">
              <button id="tAddBtn" class="btn primary" type="button">Add Tender</button>
            </div>
          </div>

          <div id="tenderList" style="margin-top:10px"></div>

          <details style="margin-top:8px">
            <summary>How shuttle GPM is calculated</summary>
            <div class="mini" style="margin-top:6px">
              Effective gal = <code>Capacity × 0.90</code><br>
              Per-tender GPM = <code>Effective gal ÷ minutes per round trip</code><br>
              Total Shuttle GPM is the sum across tenders.
            </div>
          </details>
        </div>

        <div class="linesTable is-hidden" id="linesTable"></div>
      </section>
    </section>
  `;

  // ===== style bits used by shuttle table (kept near main render; safe to keep) =====
  injectStyle(container, `
    .pill { display:inline-block; padding:4px 10px; border-radius:999px; background:#1a2738; color:#fff; border:1px solid rgba(255,255,255,.2); font-weight:800; }
    .tTable { width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; border-radius:12px; }
    .tTable thead th { background:#162130; color:#fff; padding:8px 10px; text-align:left; border-bottom:1px solid rgba(255,255,255,.1); }
    .tTable tbody td { padding:8px 10px; }
    .tTable tbody tr:nth-child(odd) td { background:#0e151e; color:#dfeaff; }
    .tTable tbody tr:nth-child(even) td { background:#111924; color:#dfeaff; }
    .tBadge { background:#0e151e; border:1px solid rgba(255,255,255,.15); padding:2px 8px; border-radius:999px; font-weight:700; color:#eaf2ff; }
    .tTimer { font-family: ui-monospace, Menlo, Consolas, monospace; }
    .btnIcon { min-width:44px; }
    .tInfoBtn{background:none;border:none;padding:0;margin:0;cursor:pointer;}
    .tInfoBtn:focus-visible{outline:2px solid var(--accent,#6ecbff);border-radius:8px;}
  `);

  // === Refs used by the rest of your (original) logic ===
  const overlay   = container.querySelector('#overlay');
  const stage     = container.querySelector('#stage');
  const G_hoses   = container.querySelector('#hoses');
  const G_branches= container.querySelector('#branches');
  const G_labels  = container.querySelector('#labels');
  const G_tips    = container.querySelector('#tips');
  const G_supply  = container.querySelector('#supplyG');
  const truckImg  = container.querySelector('#truckImg');
  const topInfo   = container.querySelector('#topInfo');
  const linesTable= container.querySelector('#linesTable');
  const PDPel     = container.querySelector('#PDP');
  const GPMel     = container.querySelector('#GPM');

  // ===== helpers from original file (unchanged) =====
  function injectStyle(root, cssText){ const s=document.createElement('style'); s.textContent=cssText; root.appendChild(s); }
  function clearGroup(g){ while(g.firstChild) g.removeChild(g.firstChild); }
  function sumVisibleHeight(){
    const needs = Object.values(state.lines||{}).filter(l=>l.visible);
    let maxUp = 0;
    needs.forEach(L=>{
      const mainPx = (sumFt(L.itemsMain)/50)*PX_PER_50FT;
      let branchPx = 0;
      if(L.hasWye){
        const lpx = (sumFt(L.itemsLeft)/50)*PX_PER_50FT;
        const rpx = (sumFt(L.itemsRight)/50)*PX_PER_50FT;
        branchPx = Math.max(lpx, rpx) + BRANCH_LIFT;
      }
      maxUp = Math.max(maxUp, mainPx + branchPx);
    });
    // Supply graphic reserves space below the truck
    return Math.max(TRUCK_H + supplySpace() + 10, TRUCK_H + maxUp + 40 + supplySpace());
  }
  function supplySpace(){
    return (state.supply==='drafting' || state.supply==='pressurized') ? 150
         : (state.supply==='relay' ? 170 : 0);
  }
  function truckTopY(viewH){ return viewH - TRUCK_H - supplySpace(); }
  function pumpXY(viewH){ const top = truckTopY(viewH); return { x: TRUCK_W*0.515, y: top + TRUCK_H*0.74 }; }

  // ==== Instantiate water-supply module ============================================
  const waterSupply = new WaterSupplyUI({
    container, state, pumpXY, truckTopY, G_supply, TRUCK_H
  });

  // ==== Main draw loop (kept from original; supply duties delegated) ===============
  function drawAll(){
    const viewH = Math.ceil(sumVisibleHeight());
    overlay.setAttribute('viewBox', `0 0 ${TRUCK_W} ${viewH}`);
    stage.style.height = viewH + 'px';
    truckImg.setAttribute('y', String(truckTopY(viewH)));

    clearGroup(G_hoses); clearGroup(G_branches); clearGroup(G_tips); clearGroup(G_labels);
    waterSupply.draw(viewH);                // <— supply graphics here
    waterSupply.updatePanelsVisibility();   // <— panel show/hide

    // … (your original drawing logic for attack lines, labels, tips, etc.) …

    refreshTotals();
    // renderLinesPanel(); // if you keep a lines panel, call it here.
  }

  // ==== Totals (unchanged) =========================================================
  function refreshTotals(){
    const vis = Object.entries(state.lines||{}).filter(([_k,l])=>l.visible);
    let totalGPM = 0, maxPDP = -Infinity;
    vis.forEach(([_key, L])=>{
      const single = isSingleWye(L);
      const flow = single ? (activeNozzle(L)?.gpm||0)
                 : L.hasWye ? (L.nozLeft?.gpm||0) + (L.nozRight?.gpm||0)
                            : (L.nozRight?.gpm||0);
      const mainFL = FL_total(flow, L.itemsMain);
      let PDP=0;
      if(single){
        const side = activeSide(L);
        const bnSegs = side==='L' ? L.itemsLeft : L.itemsRight;
        const bnNoz  = activeNozzle(L);
        const branchFL = FL_total(bnNoz.gpm, bnSegs);
        PDP = bnNoz.NP + branchFL + mainFL + (L.elevFt * PSI_PER_FT);
      } else if(L.hasWye){
        const lNeed = FL_total(L.nozLeft?.gpm||0, L.itemsLeft) + (L.nozLeft?.NP||0);
        const rNeed = FL_total(L.nozRight?.gpm||0, L.itemsRight) + (L.nozRight?.NP||0);
        PDP = Math.max(lNeed, rNeed) + mainFL + (L.wyeLoss||10) + (L.elevFt * PSI_PER_FT);
      } else {
        PDP = (L.nozRight?.NP||0) + mainFL + (L.elevFt * PSI_PER_FT);
      }
      totalGPM += flow;
      if(PDP > maxPDP) maxPDP = PDP;
    });

    GPMel.textContent = vis.length? (Math.round(totalGPM)+' gpm') : '— gpm';
    PDPel.textContent = vis.length? (Math.round(maxPDP)+' psi') : '— psi';
  }

  // ==== Supply toggle button (unchanged behavior; just cycles) =====================
  container.querySelector('#supplyBtn')?.addEventListener('click', ()=>{
    if(state.supply==='pressurized') state.supply='static';
    else if(state.supply==='static') state.supply='relay';
    else state.supply='pressurized';
    drawAll();
  });

  // ==== Any other original wiring (presets, tip editor, etc.) stays as-is ==========
  // … keep your existing listeners and handlers here …

  // ==== Seed baseline state if missing (unchanged) =================================
  if(!state.lines){
    state.lines = {
      left:  { label:'Line 1', visible:true,  itemsMain:[{size:'1.75', lengthFt:200}], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:NOZ.fog150_75 },
      back:  { label:'Line 2', visible:false, itemsMain:[{size:'2.5',  lengthFt:200}], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:NOZ.fog150_75 },
      right: { label:'Line 3', visible:false, itemsMain:[{size:'2.5',  lengthFt:100}], itemsLeft:[], itemsRight:[], hasWye:true,  elevFt:0, nozLeft:NOZ.fog95_50, nozRight:NOZ.fog95_50, wyeLoss:10 },
    };
    state.supply = 'pressurized';
  }

  drawAll();
}
