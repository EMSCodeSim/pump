// view.calc.js
// Main UI (lines, presets, drawing). Water-supply concerns are delegated to waterSupply.js.

import {
  state, NOZ, NOZ_LIST, COLORS,
  FL, FL_total, sumFt, splitIntoSections, PSI_PER_FT,
  seedDefaultsForKey, isSingleWye, activeNozzle, activeSide, sizeLabel
} from './store.js';
import { WaterSupplyUI } from './waterSupply.js';

const TRUCK_W=390, TRUCK_H=260, PX_PER_50FT=45, CURVE_PULL=36, BRANCH_LIFT=10;

export async function render(container){
  container.innerHTML = `
    <section class="stack">
      <section class="wrapper card">
        <div class="stage" id="stage">
          <svg id="overlay" viewBox="0 0 390 260" preserveAspectRatio="xMidYMax meet" aria-label="Visual stage">
            <image id="truckImg" href="/assets/images/engine181.png" x="0" y="0" width="390" height="260" preserveAspectRatio="xMidYMax meet" onerror="this.setAttribute('href','/assets/images/engine181.png')"></image>
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

      <section class="card">
        <div class="kpis">
          <div class="kpi"><div>Total Flow</div><b id="GPM">— gpm</b></div>
          <div class="kpi"><div>Max PP</div><b id="PDP">— psi</b><button id="whyBtn" class="whyBtn">Why?</button></div>
        </div>

        <!-- Hydrant helper panel (logic in WaterSupplyUI) -->
        <div id="hydrantHelper" class="helperPanel" style="display:none; margin-top:10px; background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
          <div style="color:#fff; font-weight:800; margin-bottom:6px">Hydrant Residual %Drop</div>
          <div class="mini" style="color:#a9bed9; margin-bottom:8px">
            0–10% → 3× • 11–15% → 2× • 16–25% → 1× • >25% → 0×
          </div>
          <div class="row" style="display:flex; gap:10px; flex-wrap:wrap">
            <div class="field" style="min-width:140px">
              <label>Static (psi)</label>
              <input type="number" id="hydrantStatic" placeholder="80" inputmode="decimal">
            </div>
            <div class="field" style="min-width:170px">
              <label>Residual w/ 1 line (psi)</label>
              <input type="number" id="hydrantResidual" placeholder="72" inputmode="decimal">
            </div>
            <div class="field" style="min-width:150px; display:flex; align-items:flex-end">
              <button class="btn primary" id="hydrantCalcBtn" type="button">Evaluate %Drop</button>
            </div>
          </div>
          <div id="hydrantResult" class="status" style="margin-top:8px; color:#cfe6ff">Enter numbers then press <b>Evaluate %Drop</b>.</div>
        </div>

        <!-- Static/drafting tender shuttle (logic in WaterSupplyUI) -->
        <div id="staticHelper" class="helperPanel" style="display:none; margin-top:10px; background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <div>
              <div style="color:#fff; font-weight:800;">Tender Shuttle (Static Supply)</div>
              <div class="mini" style="color:#a9bed9">Assume 10% capacity loss. Start when leaving scene; stop on return full.</div>
            </div>
            <div class="pill">Total Shuttle GPM: <span id="shuttleTotalGpm">0</span></div>
          </div>
          <div class="row" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
            <div class="field" style="min-width:160px">
              <label>Tender ID / Number</label>
              <input id="tAddId" type="text" placeholder="Tender 2">
            </div>
            <div class="field" style="min-width:160px">
              <label>Capacity (gal)</label>
              <input id="tAddCap" type="number" inputmode="decimal" placeholder="3000">
            </div>
            <div class="field" style="min-width:140px; display:flex; align-items:flex-end">
              <button id="tAddBtn" class="btn primary" type="button">Add Tender</button>
            </div>
          </div>
          <div id="tenderList" style="margin-top:10px"></div>
        </div>

        <div class="linesTable is-hidden" id="linesTable"></div>
      </section>
    </section>

    <!-- Preset bottom sheet -->
    <div id="sheet" class="sheet" aria-modal="true" role="dialog">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="title">Presets</div>
        <button class="btn" id="sheetClose">Close</button>
      </div>
      <div class="mini" style="opacity:.85;margin-top:4px">Pick a preset and a line, then Apply.</div>

      <div class="preset-grid" id="presetGrid">
        <div class="preset" data-preset="standpipe">Standpipe</div>
        <div class="preset" data-preset="sprinkler">Sprinkler</div>
        <div class="preset" data-preset="foam">Foam</div>
        <div class="preset" data-preset="monitor">Monitor</div>
        <div class="preset" data-preset="aerial">Aerial</div>
      </div>

      <div class="mini" style="opacity:.85;margin-top:10px">Apply to line:</div>
      <div class="linepick" id="linePick">
        <div class="preset" data-applyline="left">Line 1</div>
        <div class="preset" data-applyline="back">Line 2</div>
        <div class="preset" data-applyline="right">Line 3</div>
      </div>
      <div class="te-actions"><button class="btn primary" id="sheetApply" disabled>Apply Preset</button></div>
    </div>
    <div id="sheetBackdrop" class="sheet-backdrop"></div>
  `;

  // small styles used by shuttle table
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
    .sheet.open{transform:translateY(0)}
    #presetGrid .preset.selected, #linePick .preset.selected { outline:2px solid var(--accent,#6ecbff); border-radius:10px; }
  `);

  // Refs
  const overlay   = container.querySelector('#overlay');
  const stage     = container.querySelector('#stage');
  const G_hoses   = container.querySelector('#hoses');
  const G_branches= container.querySelector('#branches');
  const G_labels  = container.querySelector('#labels');
  const G_tips    = container.querySelector('#tips');
  const G_supply  = container.querySelector('#supplyG');
  const truckImg  = container.querySelector('#truckImg');
  const topInfo   = container.querySelector('#topInfo');
  const PDPel     = container.querySelector('#PDP');
  const GPMel     = container.querySelector('#GPM');

  // helpers
  function injectStyle(root, cssText){ const s=document.createElement('style'); s.textContent=cssText; root.appendChild(s); }
  function clearGroup(g){ while(g.firstChild) g.removeChild(g.firstChild); }
  function supplySpace(){ return (state.supply==='drafting'||state.supply==='pressurized')?150:(state.supply==='relay'?170:0); }
  function truckTopY(viewH){ return viewH - TRUCK_H - supplySpace(); }
  function pumpXY(viewH){ const top = truckTopY(viewH); return { x: TRUCK_W*0.515, y: top + TRUCK_H*0.74 }; }
  function computeNeededHeightPx(){
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
    return Math.max(TRUCK_H + supplySpace() + 10, TRUCK_H + maxUp + 40 + supplySpace());
  }

  // instantiate supply module
  const waterSupply = new WaterSupplyUI({ container, state, pumpXY, truckTopY, G_supply, TRUCK_H });

  // ------- LINES + PRESETS WIRING (FIX) -------------------------------------------
  // ensure line objects exist
  if(!state.lines){
    state.lines = {
      left:  { label:'Line 1', visible:true,  itemsMain:[{size:'1.75', lengthFt:200}], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:NOZ.fog150_75 },
      back:  { label:'Line 2', visible:false, itemsMain:[{size:'2.5',  lengthFt:200}], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:NOZ.fog150_75 },
      right: { label:'Line 3', visible:false, itemsMain:[{size:'2.5',  lengthFt:100}], itemsLeft:[], itemsRight:[], hasWye:true,  elevFt:0, nozLeft:NOZ.fog95_50, nozRight:NOZ.fog95_50, wyeLoss:10 },
    };
  }
  if(!state.supply) state.supply = 'pressurized';

  // Line buttons: toggle visibility & bring to front (so they "do something" again)
  container.querySelectorAll('.linebtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = btn.getAttribute('data-line');
      const L = state.lines[key];
      if(!L) return;
      L.visible = !L.visible; // simple toggle
      drawAll();
    });
  });

  // Preset sheet wiring
  const sheet = container.querySelector('#sheet');
  const sheetBackdrop = container.querySelector('#sheetBackdrop');
  const presetsBtn = container.querySelector('#presetsBtn');
  const sheetClose = container.querySelector('#sheetClose');
  const presetGrid = container.querySelector('#presetGrid');
  const linePick   = container.querySelector('#linePick');
  const sheetApply = container.querySelector('#sheetApply
