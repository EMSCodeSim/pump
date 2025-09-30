// view.calc.js
// Main calc & UI: lines, presets, drawing. Water supply module is imported.

import {
  state, NOZ, NOZ_LIST, COLORS,
  FL, FL_total, sumFt, splitIntoSections, PSI_PER_FT,
  isSingleWye, activeNozzle, activeSide, sizeLabel
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

        <!-- HYDRANT %DROP -->
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

        <!-- STATIC / DRAFTING: TENDER SHUTTLE -->
        <div id="staticHelper" class="helperPanel" style="display:none; margin-top:10px; background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <div>
              <div style="color:#fff; font-weight:800;">Tender Shuttle (Static Supply)</div>
              <div class="mini" style="color:#a9bed9">Assume 10% capacity loss. Start on depart; stop on return full.</div>
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

  // Styles for shuttle table & preset selection visuals
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

  // Simple visual hose renderer (keeps UI responsive even without older path code)
  function drawHosePath(group, d, color, width){
    const ns = group.namespaceURI || 'http://www.w3.org/2000/svg';
    const p = document.createElementNS(ns,'path');
    p.setAttribute('d', d);
    p.setAttribute('stroke', color || '#6ecbff');
    p.setAttribute('stroke-width', String(width || 10));
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke-linecap','round');
    group.appendChild(p);
  }

  function mainCurve(dir, totalPx, viewH){
    const {x:sx,y:sy} = pumpXY(viewH);
    const ex = dir===-1 ? sx - 110 : dir===1 ? sx + 110 : sx;
    const ey = Math.max(10, sy - totalPx);
    const cx = (sx+ex)/2 + (dir===-1?-CURVE_PULL:dir===1?CURVE_PULL:0);
    const cy = sy - (sy-ey)*0.48;
    return { d:`M ${sx},${sy} Q ${cx},${cy} ${ex},${ey}`, endX:ex, endY:ey };
  }
  function straightBranch(side, startX, startY, totalPx){
    const dir = side==='L'?-1:1, x = startX + dir*20, y1 = startY - BRANCH_LIFT, y2 = Math.max(8, y1 - totalPx);
    return { d:`M ${startX},${startY} L ${startX},${y1} L ${x},${y1} L ${x},${y2}`, endX:x, endY:y2 };
  }
  function addTip(key, where, x, y){
    const ns='http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns,'g');
    g.setAttribute('class','hose-end'); g.setAttribute('data-line',key); g.setAttribute('data-where',where);
    const hit = document.createElementNS(ns,'rect'); hit.setAttribute('x', x-20); hit.setAttribute('y', y-20); hit.setAttribute('width', 40); hit.setAttribute('height', 40); hit.setAttribute('fill','transparent');
    const c = document.createElementNS(ns,'circle'); c.setAttribute('cx',x); c.setAttribute('cy',y); c.setAttribute('r',14); c.setAttribute('fill','#eaf2ff'); c.setAttribute('stroke','#20324f');
    const v = document.createElementNS(ns,'line'); v.setAttribute('x1',x); v.setAttribute('y1',y-6); v.setAttribute('x2',x); v.setAttribute('y2',y+6); v.setAttribute('stroke','#0b0f14');
    const h = document.createElementNS(ns,'line'); h.setAttribute('x1',x-6); h.setAttribute('y1',y); h.setAttribute('x2',x+6); h.setAttribute('y2',y); h.setAttribute('stroke','#0b0f14');
    g.appendChild(hit); g.appendChild(c); g.appendChild(v); g.appendChild(h); G_tips.appendChild(g);
  }

  // water-supply module
  const waterSupply = new WaterSupplyUI({ container, state, pumpXY, truckTopY, G_supply, TRUCK_H });

  // baseline state if missing
  if(!state.lines){
    state.lines = {
      left:  { label:'Line 1', visible:true,  itemsMain:[{size:'1.75', lengthFt:200}], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:NOZ.fog150_75 },
      back:  { label:'Line 2', visible:false, itemsMain:[{size:'2.5',  lengthFt:200}], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:NOZ.fog150_75 },
      right: { label:'Line 3', visible:false, itemsMain:[{size:'2.5',  lengthFt:100}], itemsLeft:[], itemsRight:[], hasWye:true,  elevFt:0, nozLeft:NOZ.fog95_50, nozRight:NOZ.fog95_50, wyeLoss:10 },
    };
  }
  if(!state.supply) state.supply = 'pressurized';

  // LINE BUTTONS — toggle visibility and redraw
  container.querySelectorAll('.linebtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = btn.getAttribute('data-line');
      const L = state.lines[key];
      if(!L) return;
      L.visible = !L.visible;
      drawAll();
    });
  });

  // PRESETS bottom sheet — pick preset & line, then apply
  const sheet = container.querySelector('#sheet');
  const sheetBackdrop = container.querySelector('#sheetBackdrop');
  const presetsBtn = container.querySelector('#presetsBtn');
  const sheetClose = container.querySelector('#sheetClose');
  const presetGrid = container.querySelector('#presetGrid');
  const linePick   = container.querySelector('#linePick');
  const sheetApply = container.querySelector('#sheetApply');

  let chosenPreset = null, chosenLine = null;

  function openSheet(){ sheet.classList.add('open'); sheetBackdrop.classList.add('show'); }
  function closeSheet(){ sheet.classList.remove('open'); sheetBackdrop.classList.remove('show'); }
  presetsBtn.addEventListener('click', openSheet);
  sheetClose.addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', closeSheet);

  presetGrid.addEventListener('click', (e)=>{
    const p = e.target.closest('.preset'); if(!p) return;
    chosenPreset = p.dataset.preset;
    presetGrid.querySelectorAll('.preset').forEach(x=>x.classList.remove('selected'));
    p.classList.add('selected');
    updateSheetApply();
  });
  linePick.addEventListener('click', (e)=>{
    const p = e.target.closest('.preset'); if(!p) return;
    chosenLine = p.dataset.applyline;
    linePick.querySelectorAll('.preset').forEach(x=>x.classList.remove('selected'));
    p.classList.add('selected');
    updateSheetApply();
  });
  function updateSheetApply(){ sheetApply.disabled = !(chosenPreset && chosenLine); }

  sheetApply.addEventListener('click', ()=>{
    if(!(chosenPreset && chosenLine)) return;
    applyPresetTo(chosenPreset, chosenLine);
    closeSheet();
    chosenPreset=null; chosenLine=null;
    presetGrid.querySelectorAll('.preset').forEach(x=>x.classList.remove('selected'));
    linePick.querySelectorAll('.preset').forEach(x=>x.classList.remove('selected'));
    updateSheetApply();
  });

  function clearLine(L){ L.itemsMain=[]; L.itemsLeft=[]; L.itemsRight=[]; L.hasWye=false; L.elevFt=0; }
  function applyPresetTo(preset, key){
    const L = state.lines[key]; if(!L) return;
    clearLine(L); L.visible = true;
    switch(preset){
      case 'standpipe': L.itemsMain=[{size:'2.5', lengthFt:0}];   L.nozRight=NOZ.fog150_75; L.hasWye=false; L.elevFt=60; break;
      case 'sprinkler': state.supply='pressurized'; L.itemsMain=[{size:'2.5', lengthFt:50}]; L.nozRight=NOZ.fog150_75; L.hasWye=false; break;
      case 'foam':      L.itemsMain=[{size:'1.75', lengthFt:200}]; L.nozRight=NOZ.fog150_75; L.hasWye=false; L.elevFt=0; break;
      case 'monitor':   L.itemsMain=[{size:'2.5', lengthFt:200}];  L.nozRight=NOZ.sb1_1_8;   L.hasWye=false; L.elevFt=0; break;
      case 'aerial':    state.supply='pressurized'; L.itemsMain=[{size:'2.5', lengthFt:150}]; L.nozRight=NOZ.sb1_1_8; L.hasWye=false; L.elevFt=80; break;
    }
    drawAll();
  }

  // SUPPLY cycle button
  container.querySelector('#supplyBtn').addEventListener('click', ()=>{
    if(state.supply==='pressurized') state.supply='static';
    else if(state.supply==='static') state.supply='relay';
    else state.supply='pressurized';
    drawAll();
  });

  // MAIN DRAW — keeps UI snappy and shows supply graphic + deployed lines summary
  function drawAll(){
    const viewH = Math.ceil(computeNeededHeightPx());
    overlay.setAttribute('viewBox', `0 0 ${TRUCK_W} ${viewH}`);
    stage.style.height = viewH + 'px';
    truckImg.setAttribute('y', String(truckTopY(viewH)));

    clearGroup(G_hoses); clearGroup(G_branches); clearGroup(G_tips); clearGroup(G_labels);
    waterSupply.draw(viewH);
    waterSupply.updatePanelsVisibility();

    // Basic main-line visualization & tips so changes are obvious
    ['left','back','right'].forEach((key)=>{
      const L = state.lines[key]; if(!L || !L.visible) return;
      const dir = key==='left'?-1:key==='right'?1:0;
      const mainFt = sumFt(L.itemsMain||[]);
      const geom = mainCurve(dir, (mainFt/50)*PX_PER_50FT, viewH);
      drawHosePath(G_hoses, geom.d, '#6ecbff', 10);
      addTip(key,'main',geom.endX,geom.endY);

      if(L.hasWye){
        if(sumFt(L.itemsLeft)>0){
          const gL = straightBranch('L', geom.endX, geom.endY, (sumFt(L.itemsLeft)/50)*PX_PER_50FT);
          drawHosePath(G_branches, gL.d, '#6ecbff', 8);
          addTip(key,'L',gL.endX,gL.endY);
        }
        if(sumFt(L.itemsRight)>0){
          const gR = straightBranch('R', geom.endX, geom.endY, (sumFt(L.itemsRight)/50)*PX_PER_50FT);
          drawHosePath(G_branches, gR.d, '#6ecbff', 8);
          addTip(key,'R',gR.endX,gR.endY);
        }
      }
    });

    const visibleKeys = ['left','back','right'].filter(k=>state.lines[k]?.visible);
    topInfo.textContent = visibleKeys.length ? ('Deployed: '+visibleKeys.map(k=>state.lines[k].label || ({left:'Line 1',back:'Line 2',right:'Line 3'}[k])).join(' • ')) : 'No lines deployed';

    refreshTotals();
  }

  // TOTALS
  function refreshTotals(){
    const vis = Object.entries(state.lines||{}).filter(([_k,l])=>l.visible);
    let totalGPM = 0, maxPDP = -Infinity;
    vis.forEach(([_key, L])=>{
      const single = isSingleWye(L);
      const flow = single ? (activeNozzle(L)?.gpm||0)
                 : L.hasWye ? (L.nozLeft?.gpm||0) + (L.nozRight?.gpm||0)
                            : (L.nozRight?.gpm||0);
      const mainFL = FL_total(flow, L.itemsMain||[]);
      let PDP=0;
      if(single){
        const side = activeSide(L);
        const bnSegs = side==='L' ? (L.itemsLeft||[]) : (L.itemsRight||[]);
        const bnNoz  = activeNozzle(L);
        const branchFL = FL_total(bnNoz?.gpm||0, bnSegs);
        PDP = (bnNoz?.NP||0) + branchFL + mainFL + (L.elevFt * PSI_PER_FT);
      }else if(L.hasWye){
        const lNeed = (L.nozLeft?.NP||0) + FL_total(L.nozLeft?.gpm||0, L.itemsLeft||[]);
        const rNeed = (L.nozRight?.NP||0) + FL_total(L.nozRight?.gpm||0, L.itemsRight||[]);
        PDP = Math.max(lNeed, rNeed) + mainFL + (L.wyeLoss||10) + (L.elevFt * PSI_PER_FT);
      }else{
        PDP = (L.nozRight?.NP||0) + mainFL + (L.elevFt * PSI_PER_FT);
      }
      totalGPM += flow;
      if(PDP > maxPDP) maxPDP = PDP;
    });

    const GPMel = container.querySelector('#GPM');
    const PDPel = container.querySelector('#PDP');
    if(vis.length){
      GPMel.textContent = Math.round(totalGPM)+' gpm';
      PDPel.textContent = Math.round(maxPDP)+' psi';
    } else {
      GPMel.textContent = '— gpm';
      PDPel.textContent = '— psi';
    }
  }

  // SUPPLY cycle button (wired)
  container.querySelector('#supplyBtn').addEventListener('click', ()=>{
    if(state.supply==='pressurized') state.supply='static';
    else if(state.supply==='static') state.supply='relay';
    else state.supply='pressurized';
    drawAll();
  });

  // Click on hose-end "tip" opens placeholder (kept simple)
  G_tips.addEventListener('click', (e)=>{
    const g = e.target.closest('.hose-end'); if(!g) return;
    const line = g.getAttribute('data-line');
    const where= g.getAttribute('data-where');
    alert('Edit '+line+' ('+where+') — editor wiring can be restored here without affecting supply module.');
  });

  // initial draw
  drawAll();
}
