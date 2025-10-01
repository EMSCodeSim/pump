// /js/view.calc.js
// Calculations view with original hose/math logic preserved.
// Update per request:
//  • Under the fire truck: "Line 1", "Line 2", "Line 3", and "Presets" buttons (single row).
//  • Below that: replace Supply with two buttons: "Hydrant" and "Tender".
//      - Hydrant → shows hydrant graphics & math (pressurized mode)
//      - Tender  → shows tender shuttle graphics & math (static mode)
//  • Hydrant/Tender switch state.supply without cycling, and WaterSupplyUI handles panels/graphics.

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

          <!-- Tip editor -->
          <div id="tipEditor" class="tip-editor is-hidden" role="dialog" aria-modal="true"
               style="position:absolute; z-index:4; left:8px; top:8px; max-width:300px;">
            <div class="mini" id="teTitle" style="margin-bottom:6px;opacity:.9">Edit Line</div>
            <div class="te-row"><label>Where</label><input id="teWhere" readonly></div>
            <div class="te-row"><label>Diameter</label>
              <select id="teSize"><option value="1.75">1¾″</option><option value="2.5">2½″</option><option value="5">5″</option></select>
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
        </div>

        <!-- Controls (never cover the truck) -->
        <div class="controlBlock">
          <!-- Row 1: Line buttons + Presets -->
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
          <!-- Row 2: Hydrant and Tender (replaces Supply cycle) -->
          <div class="controlRow">
            <div class="actionGroup">
              <button class="supplybtn" id="hydrantBtn" title="Pressurized (Hydrant)">Hydrant</button>
              <button class="supplybtn" id="tenderBtn"  title="Static (Tender Shuttle)">Tender</button>
            </div>
          </div>
        </div>
      </section>

      <!-- KPIs -->
      <section class="card">
        <div class="kpis">
          <div class="kpi"><div>Total Flow</div><b id="GPM">— gpm</b></div>
          <div class="kpi"><div>Max PP</div><b id="PDP">— psi</b><button id="whyBtn" class="whyBtn">Why?</button></div>
        </div>

        <!-- Supply Summary -->
        <div id="supplySummary" class="supplySummary" style="margin-top:10px; display:none;"></div>

        <!-- Hydrant panel (pressurized) -->
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

        <!-- Tender Shuttle panel (static) -->
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

    <!-- Preset bottom sheet -->
    <div id="sheet" class="sheet" aria-modal="true" role="dialog">
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

      <div class="mini" style="opacity:.85;margin-top:10px">Apply to:</div>
      <div class="linepick">
        <div class="preset" data-applyline="left">Line 1</div>
        <div class="preset" data-applyline="back">Line 2</div>
        <div class="preset" data-applyline="right">Line 3</div>
      </div>
      <div class="te-actions"><button class="btn primary" id="sheetApply" disabled>Apply Preset</button></div>
    </div>
    <div id="sheetBackdrop" class="sheet-backdrop"></div>
  `;

  // ===== Mobile polish
  injectStyle(container, `
    input, select, textarea, button { font-size:16px; } /* prevent iOS zoom */
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
    .supplySummary {
      background:#0e151e; border:1px solid rgba(255,255,255,.12); border-radius:12px; padding:12px;
      color:#eaf2ff;
    }
    .supplySummary .row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    .supplySummary .k { color:#a9bed9; min-width:150px; }
    .supplySummary .v { font-weight:800; }
  `);

  // init nozzle selects in editor
  const teNoz = container.querySelector('#teNoz');
  const teNozA = container.querySelector('#teNozA');
  const teNozB = container.querySelector('#teNozB');
  [teNoz, teNozA, teNozB].forEach(sel=>{
    if(!sel) return;
    sel.innerHTML = NOZ_LIST.map(n=>`<option value="${n.id}">${n.name}</option>`).join('');
  });

  // DOM refs
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
  const whyBtn    = container.querySelector('#whyBtn');
  const branchBlock = container.querySelector('#branchBlock');
  const tipEditor = container.querySelector('#tipEditor');
  const teTitle = container.querySelector('#teTitle');
  const teWhere = container.querySelector('#teWhere');
  const teSize  = container.querySelector('#teSize');
  const teLen   = container.querySelector('#teLen');
  const teElev  = container.querySelector('#teElev');
  const teWye   = container.querySelector('#teWye');
  const teLenA  = container.querySelector('#teLenA');
  const teLenB  = container.querySelector('#teLenB');
  const GPMel   = container.querySelector('#GPM');
  const supplySummaryEl = container.querySelector('#supplySummary');

  // Panels for supply
  const hydrantHelper = container.querySelector('#hydrantHelper');
  const staticHelper  = container.querySelector('#staticHelper');

  // remember current SVG height for editor positioning
  let currentViewH = null;
  let chosenPreset=null, chosenLine=null, editorContext=null;

  function injectStyle(root, cssText){ const s=document.createElement('style'); s.textContent=cssText; root.appendChild(s); }
  function clearGroup(g){ while(g.firstChild) g.removeChild(g.firstChild); }
  function clsFor(size){ return size==='5'?'hose5':(size==='2.5'?'hose25':'hose175'); }
  function fmt0(n){ return Math.round(n); }
  function escapeHTML(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  function supplyHeight(){
    return state.supply==='drafting'?150: state.supply==='pressurized'?150: state.supply==='relay'?170: state.supply==='static'?150: 0;
  }
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
  function addLabel(text, x, y, dy=0){
    const ns='http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns,'g');
    const pad = 4;
    const t = document.createElementNS(ns,'text');
    t.setAttribute('class','lbl'); t.setAttribute('x', x); t.setAttribute('y', y+dy); t.setAttribute('text-anchor','middle'); t.textContent = text;
    g.appendChild(t); G_labels.appendChild(g);
    const bb = t.getBBox();
    const bg = document.createElementNS(ns,'rect');
    bg.setAttribute('x', bb.x - pad); bg.setAttribute('y', bb.y - pad);
    bg.setAttribute('width', bb.width + pad*2); bg.setAttribute('height', bb.height + pad*2);
    bg.setAttribute('fill', '#eaf2ff'); bg.setAttribute('opacity', '0.92'); bg.setAttribute('stroke', '#111'); bg.setAttribute('stroke-width', '.5'); bg.setAttribute('rx','4'); bg.setAttribute('ry','4');
    g.insertBefore(bg, t);
  }
  function addTip(key, where, x, y){
    const ns='http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns,'g');
    g.setAttribute('class','hose-end'); g.setAttribute('data-line',key); g.setAttribute('data-where',where);
    const hit = document.createElementNS(ns,'rect'); hit.setAttribute('class','plus-hit'); hit.setAttribute('x', x-20); hit.setAttribute('y', y-20); hit.setAttribute('width', 40); hit.setAttribute('height', 40);
    const c = document.createElementNS(ns,'circle'); c.setAttribute('class','plus-circle'); c.setAttribute('cx',x); c.setAttribute('cy',y); c.setAttribute('r',14);
    const v = document.createElementNS(ns,'line'); v.setAttribute('class','plus-sign'); v.setAttribute('x1',x); v.setAttribute('y1',y-6); v.setAttribute('x2',x); v.setAttribute('y2',y+6);
    const h = document.createElementNS(ns,'line'); h.setAttribute('class','plus-sign'); h.setAttribute('x1',x-6); h.setAttribute('y1',y); h.setAttribute('x2',x+6); h.setAttribute('y2',y);
    g.appendChild(hit); g.appendChild(c); g.appendChild(v); g.appendChild(h); G_tips.appendChild(g);
  }

  function drawSegmentedPath(group, basePath, segs){
    const ns = 'http://www.w3.org/2000/svg';
    const sh = document.createElementNS(ns,'path');
    sh.setAttribute('class','hoseBase shadow'); sh.setAttribute('d', basePath.getAttribute('d')); group.appendChild(sh);
    const total = basePath.getTotalLength(); let offset = 0;
    const totalPx = (sumFt(segs)/50)*PX_PER_50FT || 1;
    segs.forEach(seg=>{
      const px = (seg.lengthFt/50)*PX_PER_50FT;
      const portion = Math.min(total, (px/totalPx)*total);
      const p = document.createElementNS(ns,'path');
      p.setAttribute('class', 'hoseBase '+clsFor(seg.size));
      p.setAttribute('d', basePath.getAttribute('d'));
      p.setAttribute('stroke-dasharray', portion+' '+total);
      p.setAttribute('stroke-dashoffset', -offset);
      group.appendChild(p);
      offset += portion;
    });
  }

  // ===== Lines totals & Why
  function refreshTotals(){
    const vis = Object.entries(state.lines).filter(([_k,l])=>l.visible);
    let totalGPM = 0, maxPDP = -Infinity, maxKey = null;
    vis.forEach(([key, L])=>{
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
        PDP = Math.max(lNeed, rNeed) + mainFL + (L.wyeLoss||10) + (L.elevFt * PSI_PER_FT);
      }else{
        PDP = (L.nozRight?.NP||0) + mainFL + (L.elevFt * PSI_PER_FT);
      }
      totalGPM += flow;
      if(PDP > maxPDP){ maxPDP = PDP; maxKey = key; }
    });
    state.lastMaxKey = maxKey;
    GPMel.textContent = vis.length? (Math.round(totalGPM)+' gpm') : '— gpm';
    PDPel.classList.remove('orange','red');
    if(vis.length){
      const v = Math.round(maxPDP);
      PDPel.textContent = v+' psi';
      if(v>250) PDPel.classList.add('red');
      else if(v>200) PDPel.classList.add('orange');
    }else{
      PDPel.textContent = '— psi';
    }
  }

  function fmt(n){ return Math.round(n); }
  function fmtSegLabel(lenFt, size){ return lenFt+'′ '+sizeLabel(size); }

  function drawHoseBar(containerEl, sections, gpm, npPsi, nozzleText, pillOverride=null){
    const totalLen = sumFt(sections);
    containerEl.innerHTML='';
    if(!totalLen||!gpm){
      containerEl.textContent='No hose yet';
      containerEl.style.color='#9fb0c8';
      containerEl.style.fontSize='12px';
      return;
    }
    const W = Math.max(300, Math.min(containerEl.clientWidth||360, 720)), NP_W=64, H=54;
    const svgNS='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(svgNS,'svg');
    svg.setAttribute('width','100%'); svg.setAttribute('height',H);
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);

    if(nozzleText){
      const t=document.createElementNS(svgNS,'text'); t.setAttribute('x',8); t.setAttribute('y',12);
      t.setAttribute('fill','#cfe4ff'); t.setAttribute('font-size','12'); t.textContent=nozzleText;
      svg.appendChild(t);
    }

    const innerW=W-16-NP_W;
    const track=document.createElementNS(svgNS,'rect');
    track.setAttribute('x',8); track.setAttribute('y',20);
    track.setAttribute('width',innerW); track.setAttribute('height',18);
    track.setAttribute('fill','#0c1726'); track.setAttribute('stroke','#20324f');
    track.setAttribute('rx',6); track.setAttribute('ry',6);
    svg.appendChild(track);

    let x=8;
    sections.forEach(seg=>{
      const segW=(seg.lengthFt/totalLen)*innerW;
      const r=document.createElementNS(svgNS,'rect');
      r.setAttribute('x',x); r.setAttribute('y',20);
      r.setAttribute('width',Math.max(segW,1)); r.setAttribute('height',18);
      r.setAttribute('fill',COLORS[seg.size]||'#888');
      r.setAttribute('stroke','rgba(0,0,0,.35)');
      r.setAttribute('rx',5); r.setAttribute('ry',5);
      svg.appendChild(r);

      const fl=FL(gpm,seg.size,seg.lengthFt);
      const t=document.createElementNS(svgNS,'text');
      t.setAttribute('fill','#0b0f14'); t.setAttribute('font-size','11');
      t.setAttribute('font-family','ui-monospace,Menlo,Consolas,monospace');
      t.setAttribute('text-anchor','middle'); t.setAttribute('x',x+segW/2); t.setAttribute('y',34);
      t.textContent=''+seg.lengthFt+'′ • '+Math.round(fl)+' psi';
      svg.appendChild(t);

      x+=segW;
    });

    const pill=document.createElementNS(svgNS,'rect');
    pill.setAttribute('x',innerW+8+6); pill.setAttribute('y',20);
    pill.setAttribute('width',64-12); pill.setAttribute('height',18);
    pill.setAttribute('fill','#eaf2ff'); pill.setAttribute('stroke','#20324f');
    pill.setAttribute('rx',6); pill.setAttribute('ry',6);
    svg.appendChild(pill);

    const npT=document.createElementNS(svgNS,'text');
    npT.setAttribute('x',innerW+8+(64-12)/2); npT.setAttribute('y',33);
    npT.setAttribute('text-anchor','middle'); npT.setAttribute('fill','#0b0f14'); npT.setAttribute('font-size','11');
    npT.textContent = pillOverride ? pillOverride : ('NP '+npPsi);
    svg.appendChild(npT);

    containerEl.appendChild(svg);
  }

  function ppExplainHTML(L){
    const single = isSingleWye(L);
    const side = activeSide(L);
    const flow = single ? (activeNozzle(L)?.gpm||0)
               : L.hasWye ? (L.nozLeft?.gpm||0)+(L.nozRight?.gpm||0)
                          : (L.nozRight?.gpm||0);
    const mainSecs = splitIntoSections(L.itemsMain);
    const mainFLs = mainSecs.map(s => FL(flow, s.size, s.lengthFt));
    const mainParts = mainSecs.map((s,i)=>fmt(mainFLs[i])+' ('+fmtSegLabel(s.lengthFt, s.size)+')');
    const mainSum = mainFLs.reduce((a,c)=>a+c,0);
    const elevPsi = (L.elevFt||0) * PSI_PER_FT;
    const elevStr = (elevPsi>=0? '+':'')+fmt(elevPsi)+' psi';

    if(!L.hasWye){
      return `
        <div><b>Simple PP:</b>
          <ul class="simpleList">
            <li><b>Nozzle Pressure</b> = ${fmt(L.nozRight?.NP||0)} psi</li>
            <li><b>Friction Loss (Main)</b> = ${mainSecs.length ? mainParts.join(' + ') : 0} = <b>${fmt(mainSum)} psi</b></li>
            <li><b>Elevation</b> = ${elevStr}</li>
          </ul>
          <div style="margin-top:6px"><b>PP = NP + Main FL ± Elev = ${fmt(L.nozRight?.NP||0)} + ${fmt(mainSum)} ${elevStr} = <span style="color:var(--ok)">${fmt((L.nozRight?.NP||0)+mainSum+elevPsi)} psi</span></b></div>
        </div>
      `;
    } else if(single){
      const noz = activeNozzle(L);
      const bnSegs = side==='L'? L.itemsLeft : L.itemsRight;
      const bnSecs = splitIntoSections(bnSegs);
      const brFLs  = bnSecs.map(s => FL(noz.gpm, s.size, s.lengthFt));
      const brParts= bnSecs.map((s,i)=>fmt(brFLs[i])+' ('+fmtSegLabel(s.lengthFt, s.size)+')');
      const brSum  = brFLs.reduce((x,y)=>x+y,0);
      const total  = noz.NP + brSum + mainSum + elevPsi;
      return `
        <div><b>Simple PP (Single branch via wye):</b>
          <ul class="simpleList">
            <li><b>Nozzle Pressure</b> = ${fmt(noz.NP)} psi</li>
            <li><b>Branch FL</b> = ${bnSecs.length ? brParts.join(' + ') : 0} = <b>${fmt(brSum)} psi</b></li>
            <li><b>Main FL</b> = ${mainSecs.length ? mainParts.join(' + ') : 0} = <b>${fmt(mainSum)} psi</b></li>
            <li><b>Elevation</b> = ${elevStr}</li>
          </ul>
          <div style="margin-top:6px"><b>PP = NP + Branch FL + Main FL ± Elev = ${fmt(noz.NP)} + ${fmt(brSum)} + ${fmt(mainSum)} ${elevStr} = <span style="color:var(--ok)">${fmt(total)} psi</span></b></div>
        </div>
      `;
    } else {
      const aSecs = splitIntoSections(L.itemsLeft);
      const bSecs = splitIntoSections(L.itemsRight);
      const aFLs = aSecs.map(s => FL(L.nozLeft?.gpm||0, s.size, s.lengthFt));
      const bFLs = bSecs.map(s => FL(L.nozRight?.gpm||0, s.size, s.lengthFt));
      const aNeed = (L.nozLeft?.NP||0) + aFLs.reduce((x,y)=>x+y,0);
      const bNeed = (L.nozRight?.NP||0)+ bFLs.reduce((x,y)=>x+y,0);
      const maxNeed = Math.max(aNeed, bNeed);
      const wyeLoss = (L.wyeLoss||10);
      const total = maxNeed + mainSum + wyeLoss + elevPsi;
      return `
        <div><b>Simple PP (Wye):</b>
          <ul class="simpleList">
            <li><b>Branch A need</b> = ${Math.round(aNeed)} psi</li>
            <li><b>Branch B need</b> = ${Math.round(bNeed)} psi</li>
            <li><b>Take the higher branch</b> = <b>${Math.round(maxNeed)} psi</b></li>
            <li><b>Main FL</b> = ${mainSecs.length ? mainParts.join(' + ') : 0} = <b>${fmt(mainSum)} psi</b></li>
            <li><b>Wye</b> = +${wyeLoss} psi</li>
            <li><b>Elevation</b> = ${elevStr}</li>
          </ul>
          <div style="margin-top:6px"><b>PP = max(A,B) + Main FL + Wye ± Elev = ${fmt(maxNeed)} + ${fmt(mainSum)} + ${fmt(wyeLoss)} ${elevStr} = <span style="color:var(--ok)">${fmt(total)} psi</span></b></div>
        </div>
      `;
    }
  }

  function renderLinesPanel(){
    const anyDeployed = Object.values(state.lines).some(l=>l.visible);
    if(!anyDeployed || !state.showMath){ linesTable.innerHTML=''; linesTable.classList.add('is-hidden'); return; }
    linesTable.classList.remove('is-hidden'); linesTable.innerHTML='';

    ['left','back','right'].forEach(key=>{
      const L = state.lines[key];
      const row = document.createElement('div'); row.className='lineRow';
      const segs = L.itemsMain.length ? L.itemsMain.map(s=>s.lengthFt+'′ '+sizeLabel(s.size)).join(' + ') : 'empty';
      const single = isSingleWye(L);
      const usedNoz = single ? activeNozzle(L) : L.nozRight;
      const flow = single ? (usedNoz?.gpm||0) : (L.hasWye ? (L.nozLeft.gpm + L.nozRight.gpm) : L.nozRight.gpm);

      const head = document.createElement('div'); head.className='lineHeader'; head.innerHTML = `
        <span class="title">${L.label}</span>
        <span class="tag">Main: ${sumFt(L.itemsMain)}′ (${segs})</span>
        <span class="tag">Flow: ${flow} gpm</span>
        <span class="tag">${L.visible? 'DEPLOYED':'not deployed'}</span>
      `;
      row.appendChild(head);
      linesTable.appendChild(row);

      if(L.visible){
        const bflow = flow;
        const mathWrap = document.createElement('div');

        if(L.hasWye && !single){
          const wye = (L.wyeLoss ?? 10);
          mathWrap.innerHTML = `
            <details class="math" open>
              <summary>Line math</summary>
              <div class="hoseviz">
                <div class="hoseLegend">
                  <span class="legSwatch sw175"></span> 1¾″
                  <span class="legSwatch sw25"></span> 2½″
                  <span class="legSwatch sw5"></span> 5″
                </div>
                <div class="barWrap">
                  <div class="barTitle">Main ${sumFt(L.itemsMain)}′ @ ${bflow} gpm — Wye ${wye} psi</div>
                  <div class="hosebar" id="viz_main_${key}"></div>
                </div>
                <div class="barWrap">
                  <div class="barTitle">Branch A ${sumFt(L.itemsLeft)||0}′ @ ${L.nozLeft.gpm} gpm — NP ${L.nozLeft.NP} psi</div>
                  <div class="hosebar" id="viz_L_${key}"></div>
                </div>
                <div class="barWrap">
                  <div class="barTitle">Branch B ${sumFt(L.itemsRight)||0}′ @ ${L.nozRight.gpm} gpm — NP ${L.nozRight.NP} psi</div>
                  <div class="hosebar" id="viz_R_${key}"></div>
                </div>
                <div class="simpleBox" id="pp_simple_${key}"></div>
              </div>
            </details>
          `;
          linesTable.appendChild(mathWrap);

          drawHoseBar(document.getElementById('viz_main_'+key), splitIntoSections(L.itemsMain), bflow, (L.nozRight?.NP||0), 'Main '+sumFt(L.itemsMain)+'′ @ '+bflow+' gpm', 'Wye '+wye);
          drawHoseBar(document.getElementById('viz_L_'+key), splitIntoSections(L.itemsLeft), L.nozLeft?.gpm||0, L.nozLeft?.NP||0, 'Branch A '+(sumFt(L.itemsLeft)||0)+'′');
          drawHoseBar(document.getElementById('viz_R_'+key), splitIntoSections(L.itemsRight), L.nozRight?.gpm||0, L.nozRight?.NP||0, 'Branch B '+(sumFt(L.itemsRight)||0)+'′');
          document.getElementById('pp_simple_'+key).innerHTML = ppExplainHTML(L);

        } else if(single){
          const side = activeSide(L);
          const bnSegs = side==='L'? L.itemsLeft : L.itemsRight;
          const bnTitle = side==='L' ? 'Branch A' : 'Branch B';
          const noz = activeNozzle(L);

          mathWrap.innerHTML = `
            <details class="math" open>
              <summary>Line math</summary>
              <div class="hoseviz">
                <div class="hoseLegend">
                  <span class="legSwatch sw175"></span> 1¾″
                  <span class="legSwatch sw25"></span> 2½″
                  <span class="legSwatch sw5"></span> 5″
                </div>
                <div class="barWrap">
                  <div class="barTitle">Main ${sumFt(L.itemsMain)}′ @ ${bflow} gpm — NP ${noz.NP} psi</div>
                  <div class="hosebar" id="viz_main_${key}"></div>
                </div>
                <div class="barWrap">
                  <div class="barTitle">${bnTitle} ${sumFt(bnSegs)||0}′ @ ${noz.gpm} gpm</div>
                  <div class="hosebar" id="viz_BR_${key}"></div>
                </div>
                <div class="simpleBox" id="pp_simple_${key}"></div>
              </div>
            </details>
          `;
          linesTable.appendChild(mathWrap);

          drawHoseBar(document.getElementById('viz_main_'+key), splitIntoSections(L.itemsMain), bflow, (noz?.NP||0), 'Main '+sumFt(L.itemsMain)+'′ @ '+bflow+' gpm');
          drawHoseBar(document.getElementById('viz_BR_'+key), splitIntoSections(bnSegs), bflow, (noz?.NP||0), bnTitle+' '+(sumFt(bnSegs)||0)+'′');
          document.getElementById('pp_simple_'+key).innerHTML = ppExplainHTML(L);

        } else {
          mathWrap.innerHTML = `
            <details class="math" open>
              <summary>Line math</summary>
              <div class="hoseviz">
                <div class="hoseLegend">
                  <span class="legSwatch sw175"></span> 1¾″
                  <span class="legSwatch sw25"></span> 2½″
                  <span class="legSwatch sw5"></span> 5″
                </div>
                <div class="barWrap">
                  <div class="barTitle">Main ${sumFt(L.itemsMain)}′ @ ${bflow} gpm — NP ${L.nozRight.NP} psi</div>
                  <div class="hosebar" id="viz_main_${key}"></div>
                </div>
                <div class="simpleBox" id="pp_simple_${key}"></div>
              </div>
            </details>
          `;
          linesTable.appendChild(mathWrap);

          drawHoseBar(document.getElementById('viz_main_'+key), splitIntoSections(L.itemsMain), bflow, (L.nozRight?.NP||0), 'Main '+sumFt(L.itemsMain)+'′ @ '+bflow+' gpm');
          document.getElementById('pp_simple_'+key).innerHTML = ppExplainHTML(L);
        }
      }
    });
  }

  // ===== Interactions =====
  overlay.addEventListener('click', (e)=>{
    const tip = e.target.closest('.hose-end'); if(!tip) return;
    const key = tip.getAttribute('data-line'); const where = tip.getAttribute('data-where');
    const L = seedDefaultsForKey(key);
    L.visible = true;
    editorContext = {key, where};
    teTitle.textContent = L.label+' — '+(where==='main'?'Main':'Branch '+where);
    teWhere.value = where.toUpperCase();
    teElev.value = L.elevFt||0;
    teWye.value  = L.hasWye? 'on':'off';

    if(where==='main'){
      const seg = L.itemsMain[0] || {size:'1.75',lengthFt:200};
      teSize.value = seg.size; teLen.value = seg.lengthFt||0;
      const nozId = (isSingleWye(L)? (activeNozzle(L)?.id) : L.nozRight.id) || L.nozRight.id;
      teNoz.value = nozId;
    } else if(where==='L'){
      const seg = L.itemsLeft[0] || {size:'1.75',lengthFt:100};
      teSize.value = seg.size; teLen.value = seg.lengthFt; teNoz.value = (L.nozLeft?.id)||'chiefXD';
    } else {
      const seg = L.itemsRight[0] || {size:'1.75',lengthFt:100};
      teSize.value = seg.size; teLen.value = seg.lengthFt; teNoz.value = (L.nozRight?.id)||'chiefXD265';
    }

    branchBlock.classList.toggle('is-hidden', teWye.value==='off');
    if(teNozA) teNozA.value = (L.nozLeft?.id)||'chiefXD';
    if(teNozB) teNozB.value = (L.nozRight?.id)||'chiefXD265';
    if(teLenA) teLenA.value = (L.itemsLeft[0]?.lengthFt)||0;
    if(teLenB) teLenB.value = (L.itemsRight[0]?.lengthFt)||0;

    tipEditor.style.visibility = 'hidden';
    tipEditor.classList.remove('is-hidden');

    const edW = tipEditor.offsetWidth || 300;
    const edH = tipEditor.offsetHeight || 240;

    const pump = pumpXY(currentViewH || 260);
    const truckTop = truckTopY(currentViewH || 260);

    const srect = stage.getBoundingClientRect();
    let left = pump.x - edW/2;
    let top  = truckTop - edH - 8;

    left = Math.max(8, Math.min(left, srect.width - edW - 8));
    top  = Math.max(8, Math.min(top, srect.height - edH - 8));

    tipEditor.style.left = left + 'px';
    tipEditor.style.top  = top + 'px';
    tipEditor.style.visibility = 'visible';
  });

  teWye.addEventListener('change', ()=>{ branchBlock.classList.toggle('is-hidden', teWye.value==='off'); });
  container.querySelector('#teCancel').addEventListener('click', ()=>{
    tipEditor.classList.add('is-hidden');
  });
  container.querySelector('#teApply').addEventListener('click', ()=>{
    if(!editorContext) return;
    const {key, where} = editorContext; const L = state.lines[key];
    const size = teSize.value; const len = Math.max(0, +teLen.value||0);
    const noz = (NOZ[container.querySelector('#teNoz').value]);
    const elev=+teElev.value||0; const wyeOn = teWye.value==='on';
    L.elevFt = elev;
    if(where==='main'){
      L.itemsMain = [{size, lengthFt:len}];
      if(!wyeOn){
        L.hasWye=false; L.itemsLeft=[]; L.itemsRight=[]; L.nozRight = noz;
      }else{
        L.hasWye=true;
        const lenA = Math.max(0, +teLenA?.value||0);
        const lenB = Math.max(0, +teLenB?.value||0);
        L.itemsLeft  = lenA? [{size:'1.75',lengthFt:lenA}] : [];
        L.itemsRight = lenB? [{size:'1.75',lengthFt:lenB}] : [];
        L.nozLeft  = NOZ[teNozA?.value] || L.nozLeft;
        L.nozRight = NOZ[teNozB?.value] || L.nozRight;
      }
    } else if(where==='L'){
      L.hasWye = wyeOn || true; L.itemsLeft = len? [{size, lengthFt:len}] : []; L.nozLeft = noz;
    } else {
      L.hasWye = wyeOn || true; L.itemsRight = len? [{size, lengthFt:len}] : []; L.nozRight = noz;
    }
    L.visible = true; tipEditor.classList.add('is-hidden'); drawAll();
  });

  // Line toggle buttons
  container.querySelectorAll('.linebtn').forEach(b=>{
    b.addEventListener('click', ()=>{
      const key=b.dataset.line; const L=seedDefaultsForKey(key);
      L.visible = !L.visible; b.classList.toggle('active', L.visible);
      drawAll();
    });
  });

  // ===== Water Supply (delegated) =====
  const waterSupply = new WaterSupplyUI({
    container, state,
    pumpXY, truckTopY,
    G_supply, TRUCK_H,
    ids: {
      hydrantHelper: '#hydrantHelper',
      staticHelper:  '#staticHelper',
      tAddId:        '#tAddId',
      tAddCap:       '#tAddCap',
      tAddBtn:       '#tAddBtn',
      tenderList:    '#tenderList',
      shuttleTotalGpm: '#shuttleTotalGpm',
      hydrantLineSize: '#hydrantLineSize',
      hydrantStatic:   '#hydrantStatic',
      hydrantResidual: '#hydrantResidual',
      hydrantCalcBtn:  '#hydrantCalcBtn',
      hydrantResult:   '#hydrantResult'
    }
  });

  // New explicit buttons for Hydrant/Tender
  container.querySelector('#hydrantBtn').addEventListener('click', ()=>{
    state.supply = 'pressurized'; // hydrant mode
    drawAll();
  });
  container.querySelector('#tenderBtn').addEventListener('click', ()=>{
    state.supply = 'static'; // tender shuttle mode
    drawAll();
  });

  // Presets sheet
  const sheet = container.querySelector('#sheet'), sheetBackdrop = container.querySelector('#sheetBackdrop');
  function openSheet(){ sheet.classList.add('show'); sheetBackdrop.style.display='block'; }
  function closeSheet(){ sheet.classList.remove('show'); sheetBackdrop.style.display='none'; chosenPreset=null; chosenLine=null; container.querySelector('#sheetApply').disabled=true; }
  container.querySelector('#presetsBtn').addEventListener('click', openSheet);
  container.querySelector('#sheetClose').addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', closeSheet);
  container.querySelector('#presetGrid').addEventListener('click',(e)=>{
    const p = e.target.closest('.preset'); if(!p) return;
    chosenPreset = p.dataset.preset;
    container.querySelectorAll('#presetGrid .preset').forEach(x=>x.style.outline='none');
    p.style.outline = '2px solid var(--accent)'; updateSheetApply();
  });
  container.querySelector('.linepick').addEventListener('click',(e)=>{
    const p = e.target.closest('.preset'); if(!p) return;
    chosenLine = p.dataset.applyline;
    container.querySelectorAll('.linepick .preset').forEach(x=>x.style.outline='none');
    p.style.outline = '2px solid var(--accent)'; updateSheetApply();
  });
  function updateSheetApply(){ container.querySelector('#sheetApply').disabled = !(chosenPreset && chosenLine); }
  container.querySelector('#sheetApply').addEventListener('click', ()=>{ if(!(chosenPreset && chosenLine)) return; applyPresetTo(chosenPreset, chosenLine); closeSheet(); });
  function clearLine(L){ L.itemsMain=[]; L.itemsLeft=[]; L.itemsRight=[]; L.hasWye=false; L.elevFt=0; }
  function applyPresetTo(preset, key){
    const L = state.lines[key]; clearLine(L); L.visible = true;
    switch(preset){
      case 'standpipe': L.itemsMain=[{size:'2.5', lengthFt:0}]; L.hasWye=false; L.nozRight=NOZ.fog150_75; L.elevFt=60; break;
      case 'sprinkler': state.supply='pressurized'; L.itemsMain=[{size:'2.5', lengthFt:50}]; L.nozRight=NOZ.fog150_75; L.hasWye=false; break;
      case 'foam': L.itemsMain=[{size:'1.75', lengthFt:200}]; L.nozRight=NOZ.fog150_75; L.hasWye=false; L.elevFt=0; break;
      case 'monitor': L.itemsMain=[{size:'2.5', lengthFt:200}]; L.nozRight=NOZ.sb1_1_8; L.hasWye=false; L.elevFt=0; break;
      case 'aerial': state.supply='pressurized'; L.itemsMain=[{size:'2.5', lengthFt:150}]; L.nozRight=NOZ.sb1_1_8; L.hasWye=false; L.elevFt=80; break;
    }
    drawAll();
  }

  // Why? (reveal math)
  whyBtn.addEventListener('click', ()=>{
    const anyDeployed = Object.values(state.lines).some(l=>l.visible);
    if(!anyDeployed){ alert('Deploy a line to see Pump Pressure breakdown.'); return; }
    if(!state.showMath){ state.showMath = true; renderLinesPanel(); }
    if(!state.lastMaxKey) return;
    const target = container.querySelector('#pp_simple_'+state.lastMaxKey);
    if(target){
      target.scrollIntoView({behavior:'smooth', block:'center'});
      target.classList.remove('flash'); void target.offsetWidth; target.classList.add('flash');
      const details = target.closest('details'); if(details && !details.open){ details.open = true; }
    }
  });

  // ===== Supply Summary (simple, readable) =====
  function refreshSupplySummary(){
    supplySummaryEl.style.display = 'none';
    let html = '';

    if(state.supply === 'static'){ // tender shuttle
      const g = +(container.querySelector('#shuttleTotalGpm')?.textContent||0);
      html = `
        <div class="row"><span class="k">Supply Mode</span><span class="v">Tender shuttle</span></div>
        <div class="row"><span class="k">Shuttle GPM</span><span class="v">${Math.round(g)} gpm</span></div>
        <div class="mini" style="margin-top:6px;color:#cfe6ff">Shuttle GPM updates after each full round trip is recorded.</div>
      `;
    } else if(state.supply === 'pressurized'){ // hydrant
      const res = container.querySelector('#hydrantResult')?.textContent?.trim() || 'Use % drop method to estimate additional same-size lines.';
      html = `
        <div class="row"><span class="k">Supply Mode</span><span class="v">Pressurized (Hydrant)</span></div>
        <div class="row"><span class="k">Guide</span><span class="v">Residual % Drop method</span></div>
        <div class="mini" style="margin-top:6px;color:#cfe6ff">${escapeHTML(res)}</div>
      `;
    } else if(state.supply === 'relay'){
      html = `
        <div class="row"><span class="k">Supply Mode</span><span class="v">Relay</span></div>
        <div class="mini" style="margin-top:6px;color:#cfe6ff">Maintain 20–50 psi residual at receiving engine; add/adjust engines based on distance and desired flow.</div>
      `;
    }

    if(html){
      supplySummaryEl.innerHTML = html;
      supplySummaryEl.style.display = 'block';
    }
  }

  // ===== Draw (supply via waterSupply) =====
  function drawAll(){
    const viewH = Math.ceil(computeNeededHeightPx());
    currentViewH = viewH;
    overlay.setAttribute('viewBox', `0 0 ${TRUCK_W} ${viewH}`);
    stage.style.height = viewH + 'px';
    truckImg.setAttribute('y', String(truckTopY(viewH)));

    clearGroup(G_hoses); clearGroup(G_branches); clearGroup(G_tips); clearGroup(G_labels); clearGroup(G_supply);

    const visibleKeys = ['left','back','right'].filter(k=>state.lines[k].visible);
    topInfo.textContent = visibleKeys.length ? ('Deployed: '+visibleKeys.map(k=>state.lines[k].label).join(' • ')) : 'No lines deployed';

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
      const npLabel = usedNoz ? (' — Nozzle '+usedNoz.NP+' psi') : (L.hasWye ? ' — via Wye' : (' — Nozzle '+L.nozRight.NP+' psi'));
      addLabel(mainFt+'′ @ '+flowGpm+' gpm'+npLabel, geom.endX, geom.endY-6, (key==='left')?-10:(key==='back')?-22:-34);

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

    // Supply visuals & panel visibility handled by waterSupply.js
    waterSupply.draw(viewH);
    if (typeof waterSupply.updatePanelsVisibility === 'function') {
      waterSupply.updatePanelsVisibility(); // should show hydrantHelper when pressurized, staticHelper when static
    }

    refreshTotals();
    renderLinesPanel();
    refreshSupplySummary();

    // Button active states for Hydrant/Tender
    const hb = container.querySelector('#hydrantBtn');
    const tb = container.querySelector('#tenderBtn');
    hb?.classList.toggle('active', state.supply==='pressurized');
    tb?.classList.toggle('active', state.supply==='static');
  }

  // boot
  drawAll();

  return { dispose(){ /* WaterSupplyUI may clean up timers internally */ } };
}

export default { render };
