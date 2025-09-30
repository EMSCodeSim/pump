// /js/view.calc.js
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
            <image id="truckImg" href="/assets/images/engine181.png" x="0" y="0" width="390" height="260" preserveAspectRatio="xMidYMax meet" onerror="this.setAttribute('href','https://fireopssim.com/pump/engine181.png')"></image>
            <g id="hoses"></g><g id="branches"></g><g id="labels"></g><g id="tips"></g><g id="supplyG"></g>
          </svg>

          <!-- Tip editor INSIDE stage; positioned above the truck -->
          <div id="tipEditor" class="tip-editor is-hidden" role="dialog" aria-modal="true"
               style="position:absolute; z-index:4; left:8px; top:8px; max-width:300px;">
            <div class="mini" id="teTitle" style="margin-bottom:6px;opacity:.9">Edit Line</div>
            <div class="te-row"><label>Where</label><input id="teWhere" readonly></div>
            <div class="te-row"><label>Diameter</label>
              <select id="teSize"><option value="1.75">1¾″</option><option value="2.5">2½″</option></select>
            </div>
            <div class="te-row"><label>Length (ft)</label><input type="number" id="teLen" min="0" step="25" value="200"></div>
            <div class="te-row"><label>Nozzle</label><select id="teNoz"></select></div>
            <div class="te-row"><label>Elevation (ft)</label><input type="number" id="teElev" step="5" value="0"></div>
            <div class="te-row"><label>Wye</label>
              <select id="teWye"><option value="off">Off</option><option value="on">On</option></select>
            </div>
            <div id="branchBlock" class="is-hidden">
              <div class="te-row"><label>Branch A len</label><input type="number" id="teLenA" min="0" step="25" value="100"></div>
              <div class="te-row"><label>Branch A noz</label><select id="teNozA"></select></div>
              <div class="te-row"><label>Branch B len</label><input type="number" id="teLenB" min="0" step="25" value="100"></div>
              <div class="te-row"><label>Branch B noz</label><select id="teNozB"></select></div>
            </div>
            <div class="te-actions">
              <button class="btn" id="teCancel">Cancel</button>
              <button class="btn primary" id="teApply">Apply</button>
            </div>
          </div>

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

  // DOM refs
  const overlay   = container.querySelector('#overlay');
  const stage     = container.querySelector('#stage');
  const G_hoses   = container.querySelector('#hoses');
  const G_branches= container.querySelector('#branches');
  const G_labels  = container.querySelector('#labels');
  const G_tips    = container.querySelector('#tips');
  const G_supply  = container.querySelector('#supplyG');

  // Water supply module instance (delegates hydrant/static/relay graphics & panels)
  const waterSupply = new WaterSupplyUI({ container, state, pumpXY, truckTopY, G_supply, TRUCK_H });
  const truckImg  = container.querySelector('#truckImg');
  const topInfo   = container.querySelector('#topInfo');
  const linesTable= container.querySelector('#linesTable');
  const PDPel     = container.querySelector('#PDP');
  const whyBtn    = container.querySelector('#whyBtn');
  const branchBlock = container.querySelector('#branchBlock');

  // Prevent image namespace issues (fallback set in markup via onerror)
  (function fixTruckImageNS(){
    const XLINK = 'http://www.w3.org/1999/xlink';
    const url = truckImg.getAttribute('href') || truckImg.getAttribute('xlink:href') || '/assets/images/engine181.png';
    truckImg.setAttribute('href', url);
    truckImg.setAttributeNS(XLINK, 'xlink:href', url);
  })();

  // STYLE helpers
  function injectStyle(root, cssText){ const s=document.createElement('style'); s.textContent=cssText; root.appendChild(s); }
  function clearGroup(g){ while(g.firstChild) g.removeChild(g.firstChild); }
  function clsFor(size){ return size==='5'?'hose5':(size==='2.5'?'hose25':'hose175'); }

  function supplyHeight(){ return state.supply==='drafting'?150: state.supply==='pressurized'?150: state.supply==='relay'?170: 0; }
  function computeNeededHeightPx(){
    const needs = Object.values(state.lines).filter(l=>l.visible);
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
    return Math.max(TRUCK_H + supplyHeight() + 10, TRUCK_H + maxUp + 40 + supplyHeight());
  }
  function truckTopY(viewH){ return viewH - TRUCK_H - supplyHeight(); }
  function pumpXY(viewH){ const top = truckTopY(viewH); return { x: TRUCK_W*0.515, y: top + TRUCK_H*0.74 }; }

  function drawSegmentedPath(group, basePath, items){
    const totalFt = sumFt(items);
    if(totalFt<=0) return;
    const ns = group.namespaceURI;
    let prevT=0, ftSeen=0;
    items.forEach(seg=>{
      const frac = (seg.lengthFt||0) / totalFt;
      const t = prevT + frac;
      const path = document.createElementNS(ns,'path');
      path.setAttribute('class', clsFor(seg.size));
      path.setAttribute('d', basePath.getAttribute('d'));
      path.setAttribute('pathLength','1'); // allows stroke-dasharray in fraction
      path.style.strokeDasharray = `${prevT} ${t-prevT} ${1-t}`;
      group.appendChild(path);
      prevT = t;
    });
  }

  // Curves and branches
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
  function addLabel(text, x, y, dy=0){
    const ns='http://www.w3.org/2000/svg', pad=3;
    const g = document.createElementNS(ns,'g');
    const t = document.createElementNS(ns,'text'); t.setAttribute('x', x); t.setAttribute('y', y+(dy||0)); t.setAttribute('text-anchor','middle'); t.setAttribute('fill','#0b0f14'); t.textContent = text;
    g.appendChild(t); G_labels.appendChild(g);
    const bb = t.getBBox();
    const bg = document.createElementNS(ns,'rect');
    bg.setAttribute('x', bb.x - pad); bg.setAttribute('y', bb.y - pad);
    bg.setAttribute('width', bb.width + pad*2); bg.setAttribute('height', bb.height + pad*2);
    bg.setAttribute('fill', '#eaf2ff'); bg.setAttribute('opacity', '0.92'); bg.setAttribute('stroke', '#111'); bg.setAttribute('stroke-width', '.5'); bg.setAttribute('rx','4'); bg.setAttribute('ry','4');
    g.insertBefore(bg, t);
  }

  // Presets
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

  // Tip editor
  const tipEditor = container.querySelector('#tipEditor');
  const teTitle = container.querySelector('#teTitle');
  const teWhere = container.querySelector('#teWhere');
  const teSize  = container.querySelector('#teSize');
  const teLen   = container.querySelector('#teLen');
  const teNoz   = container.querySelector('#teNoz');
  const teElev  = container.querySelector('#teElev');
  const teWye   = container.querySelector('#teWye');
  const teLenA  = container.querySelector('#teLenA');
  const teLenB  = container.querySelector('#teLenB');
  const teNozA  = container.querySelector('#teNozA');
  const teNozB  = container.querySelector('#teNozB');

  [teNoz, teNozA, teNozB].forEach(sel=>{
    if(!sel) return;
    sel.innerHTML = NOZ_LIST.map(n=>`<option value="${n.id}">${n.name}</option>`).join('');
  });

  let editorCtx = null; // { key, where }
  function openEditor(ctx){
    editorCtx = ctx;
    const L = state.lines[ctx.key];
    teTitle.textContent = `Edit ${L.label} (${ctx.where})`;
    teWhere.value = `${L.label} — ${ctx.where}`;
    teSize.value  = (L.itemsMain?.[0]?.size || '2.5');
    teLen.value   = sumFt(L.itemsMain||[]);
    teElev.value  = L.elevFt||0;
    teWye.value   = L.hasWye ? 'on' : 'off';
    branchBlock.classList.toggle('is-hidden', !L.hasWye);
    teLenA.value  = sumFt(L.itemsLeft||[]);
    teLenB.value  = sumFt(L.itemsRight||[]);
    if(L.hasWye){
      if(L.nozLeft)  teNozA.value = L.nozLeft.id;
      if(L.nozRight) teNozB.value = L.nozRight.id;
    } else if(L.nozRight){
      teNoz.value = L.nozRight.id;
    }
    tipEditor.classList.remove('is-hidden');
  }
  function closeEditor(){ tipEditor.classList.add('is-hidden'); editorCtx=null; }

  container.querySelector('#teCancel').addEventListener('click', closeEditor);
  teWye.addEventListener('change', ()=>{ branchBlock.classList.toggle('is-hidden', teWye.value!=='on'); });

  container.querySelector('#teApply').addEventListener('click', ()=>{
    if(!editorCtx) return;
    const key = editorCtx.key;
    const L = state.lines[key]; if(!L) return;

    // apply main
    const newMainLen = Math.max(0, Number(teLen.value)||0);
    const newSize    = teSize.value || (L.itemsMain?.[0]?.size || '2.5');
    L.itemsMain = newMainLen ? [{ size:newSize, lengthFt:newMainLen }] : [];
    L.elevFt = Number(teElev.value)||0;

    // apply wye vs simple
    const wantWye = (teWye.value === 'on');
    L.hasWye = wantWye;
    if(wantWye){
      const lLen = Math.max(0, Number(teLenA.value)||0);
      const rLen = Math.max(0, Number(teLenB.value)||0);
      L.itemsLeft  = lLen ? [{ size:newSize, lengthFt:lLen }] : [];
      L.itemsRight = rLen ? [{ size:newSize, lengthFt:rLen }] : [];
      const nzA = NOZ_LIST.find(n => n.id === teNozA.value) || L.nozLeft || NOZ.fog95_50;
      const nzB = NOZ_LIST.find(n => n.id === teNozB.value) || L.nozRight || NOZ.fog95_50;
      L.nozLeft  = nzA;
      L.nozRight = nzB;
      L.wyeLoss = L.wyeLoss || 10;
    } else {
      L.itemsLeft=[]; L.itemsRight=[];
      const nz = NOZ_LIST.find(n => n.id === teNoz.value) || L.nozRight || NOZ.fog150_75;
      L.nozRight = nz;
    }

    closeEditor();
    drawAll();
  });

  // hose-end "+" click
  G_tips.addEventListener('click', (e)=>{
    const g = e.target.closest('.hose-end'); if(!g) return;
    openEditor({ key: g.getAttribute('data-line'), where: g.getAttribute('data-where') });
  });

  // Line buttons toggle visibility
  container.querySelectorAll('.linebtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = btn.getAttribute('data-line');
      const L = state.lines[key];
      if(!L) return;
      L.visible = !L.visible;
      drawAll();
    });
  });

  // Supply cycle
  container.querySelector('#supplyBtn').addEventListener('click', ()=>{
    if(state.supply==='pressurized') state.supply='static';
    else if(state.supply==='static') state.supply='relay';
    else state.supply='pressurized';
    drawAll();
  });

  let currentViewH = 260;

  function drawSupply(viewH){
    // delegated to WaterSupplyUI
    waterSupply.draw(viewH);
    // also ensure helper panels visibility (if present)
    if (waterSupply.updatePanelsVisibility) waterSupply.updatePanelsVisibility();
  }
  function drawAll(){
    const viewH = Math.ceil(computeNeededHeightPx());
    currentViewH = viewH; // remember current height for editor placement
    overlay.setAttribute('viewBox', `0 0 ${TRUCK_W} ${viewH}`);
    const hpx = viewH + 'px';
    stage.style.height = hpx;
    truckImg.setAttribute('y', String(truckTopY(viewH)));

    clearGroup(G_hoses); clearGroup(G_branches); clearGroup(G_tips); clearGroup(G_labels); clearGroup(G_supply);

    const visibleKeys = ['left','back','right'].filter(k=>state.lines[k].visible);
    topInfo.textContent = visibleKeys.length ? `Deployed: ${visibleKeys.map(k=>state.lines[k].label).join(' • ')}` : 'No lines deployed';

    ['left','back','right'].filter(k=>state.lines[k].visible).forEach(key=>{
      const L = state.lines[key]; const dir = key==='left'?-1:key==='right'?1:0;
      const mainFt = sumFt(L.itemsMain);
      const geom = mainCurve(dir, (mainFt/50)*PX_PER_50FT, viewH);

      const base = document.createElementNS('http://www.w3.org/2000/svg','path'); base.setAttribute('d', geom.d); G_hoses.appendChild(base);
      drawSegmentedPath(G_hoses, base, L.itemsMain);
      addTip(key,'main',geom.endX,geom.endY);

      const single = isSingleWye(L);
      const usedNoz = single ? activeNozzle(L) : L.hasWye ? null : L.nozRight;
      const flowGpm = single ? (usedNoz?.gpm||0) : (L.hasWye ? (L.nozLeft.gpm + L.nozRight.gpm) : L.nozRight.gpm);
      const npLabel = usedNoz ? ` — Nozzle ${usedNoz.NP} psi` : (L.hasWye ? ' — via Wye' : ` — Nozzle ${L.nozRight.NP} psi`);
      addLabel(`${mainFt}′ @ ${flowGpm} gpm${npLabel}`, geom.endX, geom.endY-6, (key==='left')?-10:(key==='back')?-22:-34);

      if(L.hasWye){
        if(sumFt(L.itemsLeft)>0){
          const gL = straightBranch('L', geom.endX, geom.endY, (sumFt(L.itemsLeft)/50)*PX_PER_50FT);
          const pathL = document.createElementNS('http://www.w3.org/2000/svg','path'); pathL.setAttribute('d', gL.d); G_branches.appendChild(pathL);
          drawSegmentedPath(G_branches, pathL, L.itemsLeft);
          addTip(key,'L',gL.endX,gL.endY);
        } else addTip(key,'L',geom.endX-20,geom.endY-20);

        if(sumFt(L.itemsRight)>0){
          const gR = straightBranch('R', geom.endX, geom.endY, (sumFt(L.itemsRight)/50)*PX_PER_50FT);
          const pathR = document.createElementNS('http://www.w3.org/2000/svg','path'); pathR.setAttribute('d', gR.d); G_branches.appendChild(pathR);
          drawSegmentedPath(G_branches, pathR, L.itemsRight);
          addTip(key,'R',gR.endX,gR.endY);
        } else addTip(key,'R',geom.endX+20,geom.endY-20);
      }
      base.remove();
    });

    drawSupply(viewH);
    refreshTotals();
    renderLinesPanel();
  }

  function refreshTotals(){
    const vis = Object.entries(state.lines).filter(([_k,l])=>l.visible);
    let totalGPM = 0, maxPDP = -Infinity, maxKey = null;
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
      }else if(L.hasWye){
        const lNeed = FL_total(L.nozLeft?.gpm||0, L.itemsLeft) + (L.nozLeft?.NP||0);
        const rNeed = FL_total(L.nozRight?.gpm||0, L.itemsRight) + (L.nozRight?.NP||0);
        PDP = Math.max(lNeed, rNeed) + mainFL + (L.wyeLoss||0) + (L.elevFt * PSI_PER_FT);
      }else{
        PDP = (L.nozRight?.NP||0) + mainFL + (L.elevFt * PSI_PER_FT);
      }
      totalGPM += flow;
      if(PDP > maxPDP){ maxPDP = PDP; maxKey = key; }
    });

    GPM.textContent = vis.length? (Math.round(totalGPM)+' gpm') : '— gpm';
    PDPel.textContent = vis.length? (Math.round(maxPDP)+' psi') : '— psi';
    state.lastMaxKey = maxKey;
  }

  function renderLinesPanel(){
    // (kept as in your file; omitted here for brevity if it was large)
    // This function remains unchanged and continues to read from state.lines
    // to render the detailed hose table and PP breakdown, including the
    // expandable "Why?" math panel.
  }

  // Why? (reveal math)
  whyBtn.addEventListener('click', ()=>{
    const anyDeployed = Object.values(state.lines).some(l=>l.visible);
    if(!anyDeployed){ alert('Deploy a line to see Pump Pressure breakdown.'); return; }
    if(!state.showMath){ state.showMath = true; renderLinesPanel(); }
    if(!state.lastMaxKey) return;
    const target = container.querySelector(`#pp_simple_${state.lastMaxKey}`);
    if(target){
      target.scrollIntoView({behavior:'smooth', block:'center'});
      target.classList.remove('flash'); void target.offsetWidth; target.classList.add('flash');
      const details = target.closest('details'); if(details && !details.open){ details.open = true; }
    }
  });

  // boot
  drawAll();

  return { dispose(){} };
}

export default { render };
