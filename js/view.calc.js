// /js/view.calc.js
// Preserves: visual builder, PP math (with Wye=10 chip on main when applicable), Hydrant %Drop,
// presets, Why button & colorized PP, etc. Adds: Tender Shuttle GPM when Supply=Static (drafting).

import {
  state, NOZ, NOZ_LIST, COLORS,
  FL, FL_total, sumFt, splitIntoSections, PSI_PER_FT,
  seedDefaultsForKey, isSingleWye, activeNozzle, activeSide, sizeLabel
} from './store.js';

const TRUCK_W=390, TRUCK_H=260, PX_PER_50FT=45, CURVE_PULL=36, BRANCH_LIFT=10;

export async function render(container){
  container.innerHTML = `
    <section class="stack">
      <section class="wrapper card">
        <div class="stage" id="stage">
          <svg id="overlay" viewBox="0 0 390 260" preserveAspectRatio="xMidYMax meet" aria-label="Visual stage">
            <image id="truckImg" href="/assets/images/engine181.png" x="0" y="0" width="390" height="260" preserveAspectRatio="xMidYMax meet"></image>
            <g id="G_supply"></g>
            <g id="G_hoses"></g>
            <g id="G_labels"></g>
            <g id="G_tips"></g>
          </svg>

          <!-- Tip editor (above truck) -->
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

        <!-- Hydrant Residual %Drop (pressurized only) -->
        <div id="hydrantHelper" class="helperPanel" style="display:none; margin-top:10px; background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
          <div style="color:#fff; font-weight:800; margin-bottom:6px">Hydrant Residual %Drop</div>
          <div class="mini" style="color:#a9bed9; margin-bottom:8px">
            Enter static & residual with one line flowing to estimate how many <b>additional same-size lines</b> you can add:
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
          <div id="hydrantResult" class="status" style="margin-top:8px; color:#cfe6ff">Select size, enter pressures, then press <b>Evaluate %Drop</b>.</div>
        </div>

        <!-- Tender Shuttle (static/drafting only) -->
        <div id="staticHelper" class="helperPanel" style="display:none; margin-top:10px; background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <div>
              <div style="color:#fff; font-weight:800;">Tender Shuttle (Static Supply)</div>
              <div class="mini" style="color:#a9bed9">10% capacity loss assumed. Start when leaving scene; stop on return full. You can also enter minutes directly.</div>
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
              Effective gallons per trip = <code>Capacity × 0.90</code><br>
              Per-tender GPM = <code>(Effective gallons ÷ minutes per round trip)</code><br>
              Total Shuttle GPM = sum of all tender GPM.
            </div>
          </details>
        </div>

        <div class="linesTable is-hidden" id="linesTable"></div>
      </section>
    </section>

    <!-- Presets bottom sheet -->
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

  // ========== Local styles for shuttle + pills ==========
  injectLocalStyles(container, `
    .pill { display:inline-block; padding:4px 10px; border-radius:999px; background:#1a2738; color:#fff; border:1px solid rgba(255,255,255,.2); font-weight:800; }
    .tTable { width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; border-radius:12px; }
    .tTable thead th { background:#162130; color:#fff; padding:8px 10px; text-align:left; border-bottom:1px solid rgba(255,255,255,.1); }
    .tTable tbody td { padding:8px 10px; }
    .tTable tbody tr:nth-child(odd) td { background:#0e151e; color:#dfeaff; }
    .tTable tbody tr:nth-child(even) td { background:#111924; color:#dfeaff; }
    .tBadge { background:#0e151e; border:1px solid rgba(255,255,255,.15); padding:2px 8px; border-radius:999px; font-weight:700; }
    .tTimer { font-family: ui-monospace, Menlo, Consolas, monospace; }
    .btnIcon { min-width:44px; }
  `);

  // ========== DOM refs ==========
  const overlay = container.querySelector('#overlay');
  const stage = container.querySelector('.stage');
  const G_supply = overlay.querySelector('#G_supply');
  const G = overlay.querySelector('#G_hoses');
  const G_labels = overlay.querySelector('#G_labels');
  const G_tips = overlay.querySelector('#G_tips');
  const truckImg = container.querySelector('#truckImg');

  const GPMel = container.querySelector('#GPM');
  const PDPel = container.querySelector('#PDP');
  const topInfo = container.querySelector('#topInfo');
  const linesTable= container.querySelector('#linesTable');

  // editor refs
  const tipEditor = container.querySelector('#tipEditor');
  const branchBlock = container.querySelector('#branchBlock');
  const teTitle = container.querySelector('#teTitle');
  const teWhere = container.querySelector('#teWhere');
  const teSize  = container.querySelector('#teSize');
  const teLen   = container.querySelector('#teLen');
  const teElev  = container.querySelector('#teElev');
  const teWye   = container.querySelector('#teWye');
  const teNoz   = container.querySelector('#teNoz');
  const teNozA  = container.querySelector('#teNozA');
  const teNozB  = container.querySelector('#teNozB');
  const teLenA  = container.querySelector('#teLenA');
  const teLenB  = container.querySelector('#teLenB');

  // Hydrant helper refs
  const hydrantHelper = container.querySelector('#hydrantHelper');
  const hydrantLineSize = container.querySelector('#hydrantLineSize');
  const hydrantStatic   = container.querySelector('#hydrantStatic');
  const hydrantResidual = container.querySelector('#hydrantResidual');
  const hydrantCalcBtn  = container.querySelector('#hydrantCalcBtn');
  const hydrantResult   = container.querySelector('#hydrantResult');

  // Static (tender) refs
  const staticHelper = container.querySelector('#staticHelper');
  const tAddId = container.querySelector('#tAddId');
  const tAddCap = container.querySelector('#tAddCap');
  const tAddBtn = container.querySelector('#tAddBtn');
  const tenderList = container.querySelector('#tenderList');
  const shuttleTotalGpm = container.querySelector('#shuttleTotalGpm');

  // init nozzle selects in editor
  [teNoz, teNozA, teNozB].forEach(sel=>{
    sel.innerHTML = NOZ_LIST.map(k=>`<option value="${k}">${NOZ[k].label}</option>`).join('');
  });

  // remember current view height for editor placement
  let currentViewH = TRUCK_H;
  let editorContext=null;

  // Tender shuttle local state
  const tenders = []; // { id, cap, eff, sec, running, startTs }

  // ===== Helpers =====
  function injectLocalStyles(root, cssText){ const style = document.createElement('style'); style.textContent = cssText; root.appendChild(style); }
  function clearGroup(g){ while(g.firstChild) g.removeChild(g.firstChild); }
  function toNum(v){ const n=Number(v); return isFinite(n)?n:NaN; }
  function sizePretty(v){ return v==='1.75'?'1¾″':(v==='2.5'?'2½″':v==='5'?'5″':''); }
  function fmt(n){ return Math.round(n); }
  function fmt0(n){ return Math.round(n); }
  function fmt1(n){ return Math.round(n*10)/10; }
  function fmtSegLabel(ft, size){ return `${ft}′ of ${sizeLabel(size)}`; }

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
      t.textContent=`${seg.lengthFt}′ • ${Math.round(fl)} psi`;
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
    npT.textContent = pillOverride ?? `NP ${npPsi}`;
    svg.appendChild(npT);

    containerEl.appendChild(svg);
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
    bg.setAttribute('fill', '#eaf2ff'); bg.setAttribute('opacity','.5'); bg.setAttribute('rx','4'); bg.setAttribute('ry','4');
    g.insertBefore(bg, t);
  }
  function addTip(key, where, x, y){
    const ns='http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns,'g');
    g.setAttribute('class','hose-end'); g.setAttribute('data-line',key); g.setAttribute('data-where',where);
    const hit = document.createElementNS(ns,'rect'); hit.setAttribute('x',x-20); hit.setAttribute('y',y-20); hit.setAttribute('width', 40); hit.setAttribute('height', 40);
    const c = document.createElementNS(ns,'circle'); c.setAttribute('cx',x); c.setAttribute('cy',y); c.setAttribute('r',14);
    const v = document.createElementNS(ns,'line'); v.setAttribute('x1',x); v.setAttribute('y1',y-6); v.setAttribute('x2',x); v.setAttribute('y2',y+6);
    const h = document.createElementNS(ns,'line'); h.setAttribute('x1',x-6); h.setAttribute('y1',y); h.setAttribute('x2',x+6); h.setAttribute('y2',y);
    g.appendChild(hit); g.appendChild(c); g.appendChild(v); g.appendChild(h); G_tips.appendChild(g);
  }

  // Supply drawing
  function drawSupply(viewH){
    const Gg = G_supply; clearGroup(Gg);
    const h = supplyHeight(); if(!h) return;
    const baseY = truckTopY(viewH) + TRUCK_H + 6; const ns=Gg.namespaceURI;
    if(state.supply==='pressurized'){
      let hyd=document.createElementNS(ns,'rect'); hyd.setAttribute('x','50'); hyd.setAttribute('y', String(baseY+20)); hyd.setAttribute('width','80'); hyd.setAttribute('height','60');
      hyd.setAttribute('fill','#243614'); hyd.setAttribute('stroke','#7aa35e'); Gg.appendChild(hyd);
      let t=document.createElementNS(ns,'text'); t.setAttribute('x','90'); t.setAttribute('y', String(baseY+56)); t.setAttribute('fill','#cfe4ff'); t.setAttribute('text-anchor','middle'); t.setAttribute('font-size','12'); t.textContent='Hydrant'; Gg.appendChild(t);
      const pump = pumpXY(viewH);
      let hose=document.createElementNS(ns,'path');
      hose.setAttribute('d',`M 90 ${baseY+50} C 160 ${baseY+50} 240 ${baseY+50} ${pump.x} ${pump.y-20}`);
      hose.setAttribute('stroke','#ecd464'); hose.setAttribute('fill','none'); hose.setAttribute('stroke-width','8'); hose.setAttribute('stroke-linecap','round'); Gg.appendChild(hose);
    } else if(state.supply==='drafting'){
      let r=document.createElementNS(ns,'rect'); r.setAttribute('x','60'); r.setAttribute('y', String(baseY+30)); r.setAttribute('width','120'); r.setAttribute('height','70');
      r.setAttribute('fill','#10233b'); r.setAttribute('stroke','#4a6a9b'); Gg.appendChild(r);
      let t=document.createElementNS(ns,'text'); t.setAttribute('x','120'); t.setAttribute('y', String(baseY+72)); t.setAttribute('fill','#cfe4ff'); t.setAttribute('text-anchor','middle'); t.setAttribute('font-size','12'); t.textContent='Static Source'; Gg.appendChild(t);
      const pump = pumpXY(viewH);
      let path=document.createElementNS(ns,'path');
      path.setAttribute('d',`M ${pump.x},${pump.y} C 240 ${baseY+40}, 190 ${baseY+65}, 130 ${baseY+95}`);
      path.setAttribute('stroke','#6ecbff'); path.setAttribute('fill','none'); path.setAttribute('stroke-width','8'); path.setAttribute('stroke-linecap','round'); Gg.appendChild(path);
    } else if(state.supply==='relay'){
      let img=document.createElementNS(ns,'rect'); img.setAttribute('x','70'); img.setAttribute('y', String(baseY+20)); img.setAttribute('width','120'); img.setAttribute('height','60');
      img.setAttribute('fill','#1b2536'); img.setAttribute('stroke','#2b3c5a'); Gg.appendChild(img);
      let tt=document.createElementNS(ns,'text'); tt.setAttribute('x','130'); tt.setAttribute('y', String(baseY+45)); tt.setAttribute('fill','#cfe4ff'); tt.setAttribute('text-anchor','middle'); tt.setAttribute('font-size','12'); tt.textContent='Engine 2'; Gg.appendChild(tt);
      const pump = pumpXY(viewH);
      let hose=document.createElementNS(ns,'path');
      hose.setAttribute('d',`M 130 ${baseY+40} C 190 ${baseY+36} 250 ${baseY+36} ${pump.x} ${pump.y-20}`);
      hose.setAttribute('stroke','#ecd464'); hose.setAttribute('fill','none'); hose.setAttribute('stroke-width','8'); hose.setAttribute('stroke-linecap','round'); Gg.appendChild(hose);
    }
  }

  // Draw everything
  function drawAll(){
    const viewH = Math.ceil(computeNeededHeightPx());
    currentViewH = viewH;
    overlay.setAttribute('viewBox', `0 0 ${TRUCK_W} ${viewH}`);
    stage.style.height = viewH + 'px';
    truckImg.setAttribute('y', String(truckTopY(viewH)));

    clearGroup(G); clearGroup(G_labels); clearGroup(G_tips); clearGroup(G_supply);
    drawSupply(viewH);

    const lines = state.lines;
    const active = Object.entries(lines).filter(([,L])=>L.visible);

    // KPIs
    let totalGPM = 0, maxPP = 0;
    active.forEach(([key,L])=>{
      const flow = (L.nozLeft?.gpm||0) + (L.nozRight?.gpm||0);
      totalGPM += flow;

      const mainSecs = splitIntoSections(L.itemsMain);
      const mainSum = mainSecs.map(s => FL(flow, s.size, s.lengthFt)).reduce((a,c)=>a+c,0);
      const elev = (L.elevFt||0) * PSI_PER_FT;
      let pp = 0;
      if(!L.hasWye){
        const NP = (L.nozRight?.NP||0);
        pp = NP + mainSum + elev;
      } else {
        const wye = 10;
        const maxBranchNeed = Math.max(
          (L.nozLeft?.NP||0) + splitIntoSections(L.itemsLeft).map(s=>FL(L.nozLeft?.gpm||0,s.size,s.lengthFt)).reduce((a,c)=>a+c,0),
          (L.nozRight?.NP||0)+ splitIntoSections(L.itemsRight).map(s=>FL(L.nozRight?.gpm||0,s.size,s.lengthFt)).reduce((a,c)=>a+c,0)
        );
        pp = maxBranchNeed + mainSum + wye + elev;
      }
      maxPP = Math.max(maxPP, pp);
    });

    GPMel.textContent = active.length ? `${Math.round(totalGPM)} gpm` : '— gpm';
    PDPel.classList.remove('orange','red');
    if(active.length){
      const v = Math.round(maxPP);
      PDPel.textContent = `${v} psi`;
      if(v>250) PDPel.classList.add('red');
      else if(v>200) PDPel.classList.add('orange');
    }else{
      PDPel.textContent = '— psi';
    }

    // labels + tips
    active.forEach(([key,L])=>{
      const side = activeSide(L);
      const dir = side==='L' ? -1 : side==='R' ? 1 : 0;
      const totalPx = (sumFt(L.itemsMain)/50)*PX_PER_50FT;
      const curve = mainCurve(dir, totalPx, viewH);
      const ns='http://www.w3.org/2000/svg';
      let path = document.createElementNS(ns,'path');
      path.setAttribute('d', curve.d);
      path.setAttribute('stroke', COLORS[L.itemsMain?.[0]?.size || '1.75']);
      path.setAttribute('fill','none');
      path.setAttribute('stroke-width','10'); path.setAttribute('stroke-linecap','round');
      G.appendChild(path);

      const mx = (pumpXY(viewH).x + curve.endX)/2, my = (pumpXY(viewH).y + curve.endY)/2 - 10;
      addLabel(`${sumFt(L.itemsMain)}′`, mx, my);

      if(L.hasWye){
        const br = straightBranch(side, curve.endX, curve.endY, (sumFt(side==='L'?L.itemsLeft:L.itemsRight)/50)*PX_PER_50FT);
        let brPath=document.createElementNS(ns,'path');
        brPath.setAttribute('d', br.d); brPath.setAttribute('stroke', COLORS[side==='L'?(L.itemsLeft?.[0]?.size||'1.75'):(L.itemsRight?.[0]?.size||'1.75')]);
        brPath.setAttribute('fill','none'); brPath.setAttribute('stroke-width','8'); brPath.setAttribute('stroke-linecap','round'); G.appendChild(brPath);
        addLabel(`${sumFt(side==='L'?L.itemsLeft:L.itemsRight)}′`, br.endX, br.endY, -8);
      }

      if(L.hasWye){
        addTip(key, 'L', curve.endX, curve.endY-((sumFt(L.itemsLeft)/50)*PX_PER_50FT || 0));
        addTip(key, 'R', curve.endX, curve.endY-((sumFt(L.itemsRight)/50)*PX_PER_50FT || 0));
      } else {
        addTip(key, 'R', curve.endX, curve.endY);
      }
    });

    updateSupplyHelpers();
    renderLinesPanel();
  }

  // ===== Supply helpers visibility =====
  function updateSupplyHelpers(){
    const isHydrant = (state.supply === 'pressurized' || state.supply === 'hydrant');
    const isStatic  = (state.supply === 'drafting');
    if(hydrantHelper) hydrantHelper.style.display = isHydrant ? 'block' : 'none';
    if(staticHelper)  staticHelper.style.display  = isStatic  ? 'block' : 'none';
    if(isStatic) injectTenderTable(); // ensure table renders when switching in
  }

  // ===== Hydrant %Drop logic =====
  hydrantCalcBtn?.addEventListener('click', ()=>{
    const size = hydrantLineSize?.value || '1.75';
    const stat = toNum(hydrantStatic?.value);
    const res  = toNum(hydrantResidual?.value);
    if(!(stat>0)){ hydrantResult.innerHTML = '<span class="status alert" style="color:#ffc0c0">Enter a valid <b>Static</b> pressure.</span>'; return; }
    if(!(res>0)){ hydrantResult.innerHTML = '<span class="status alert" style="color:#ffc0c0">Enter a valid <b>Residual</b> pressure.</span>'; return; }
    if(res>stat){ hydrantResult.innerHTML = '<span class="status alert" style="color:#ffc0c0">Residual cannot exceed Static.</span>'; return; }
    const dropPct = ((stat-res)/stat)*100;
    let addl=0, band='';
    if(dropPct<=10){ addl=3; band='0–10%'; }
    else if(dropPct<=15){ addl=2; band='11–15%'; }
    else if(dropPct<=25){ addl=1; band='16–25%'; }
    else { addl=0; band='>25%'; }
    const tone = addl>=2?'#c9ffd1':addl===1?'#ffe2a6':'#ffc0c0';
    hydrantResult.innerHTML = `
      <div class="status" style="color:${tone}">
        Drop = <b>${(Math.round(dropPct*10)/10).toFixed(1)}%</b> <span class="pill" style="background:#1a2738;border:1px solid rgba(255,255,255,.2);color:#fff">${band}</span><br>
        You can add <b>${addl}</b> more <b>${sizePretty(size)}</b> line${addl===1?'':'s'} at the same flow.
      </div>`;
  });

  // ===== Lines panel (Why math kept) =====
  function ppExplainHTML(L){
    const single = isSingleWye(L);
    const side = activeSide(L);
    const flow = single ? (activeNozzle(L)?.gpm||0)
               : L.hasWye ? (L.nozLeft?.gpm||0)+(L.nozRight?.gpm||0)
                          : (L.nozRight?.gpm||0);
    const mainSecs = splitIntoSections(L.itemsMain);
    const mainFLs = mainSecs.map(s => FL(flow, s.size, s.lengthFt));
    const mainParts = mainSecs.map((s,i)=>`${fmt(mainFLs[i])} (${fmtSegLabel(s.lengthFt, s.size)})`);
    const mainSum = mainFLs.reduce((a,c)=>a+c,0);
    const elevPsi = (L.elevFt||0) * PSI_PER_FT;
    const elevStr = `${elevPsi>=0? '+':''}${fmt(elevPsi)} psi`;

    if(!L.hasWye){
      const total = (L.nozRight?.NP||0)+mainSum+elevPsi;
      return `
        <div><b>Simple PP:</b>
          <ul class="simpleList">
            <li><b>Nozzle Pressure</b> = ${fmt(L.nozRight?.NP||0)} psi</li>
            <li><b>Friction Loss (Main)</b> = ${mainSecs.length ? mainParts.join(' + ') : 0} = <b>${fmt(mainSum)} psi</b></li>
            <li><b>Elevation</b> = ${elevStr}</li>
          </ul>
          <div style="margin-top:6px"><b>PP = NP + Main FL ± Elev = <span class="pill">${fmt(total)} psi</span></b></div>
        </div>`;
    } else if(single){
      const noz = activeNozzle(L);
      const brSecs = splitIntoSections(side==='L'?L.itemsLeft:L.itemsRight);
      const brFLs  = brSecs.map(s => FL(noz.gpm, s.size, s.lengthFt));
      const brParts= brSecs.map((s,i)=>`${fmt(brFLs[i])} (${fmtSegLabel(s.lengthFt, s.size)})`);
      const brSum  = brFLs.reduce((x,y)=>x+y,0);
      const total  = noz.NP + brSum + mainSum + elevPsi;
      return `
        <div><b>Simple PP (Single branch via wye):</b>
          <ul class="simpleList">
            <li><b>Nozzle Pressure</b> = ${fmt(noz.NP)} psi</li>
            <li><b>Friction Loss (Branch)</b> = ${brSecs.length ? brParts.join(' + ') : 0} = <b>${fmt(brSum)} psi</b></li>
            <li><b>Friction Loss (Main)</b> = ${mainSecs.length ? mainParts.join(' + ') : 0} = <b>${fmt(mainSum)} psi</b></li>
            <li><b>Elevation</b> = ${elevStr}</li>
          </ul>
          <div style="margin-top:6px"><b>PP = NP + Branch FL + Main FL ± Elev = <span class="pill">${fmt(total)} psi</span></b></div>
        </div>`;
    } else {
      const aSecs = splitIntoSections(L.itemsLeft);
      const bSecs = splitIntoSections(L.itemsRight);
      const aFLs = aSecs.map(s => FL(L.nozLeft?.gpm||0, s.size, s.lengthFt));
      const bFLs = bSecs.map(s => FL(L.nozRight?.gpm||0, s.size, s.lengthFt));
      const aNeed = (L.nozLeft?.NP||0) + aFLs.reduce((x,y)=>x+y,0);
      const bNeed = (L.nozRight?.NP||0)+ bFLs.reduce((x,y)=>x+y,0);
      const maxNeed = Math.max(aNeed, bNeed);
      const wyeLoss = 10;
      const total = maxNeed + mainSum + wyeLoss + elevPsi;
      return `
        <div><b>Simple PP (Two branches via wye):</b>
          <ul class="simpleList">
            <li><b>Branch A need</b> = ${Math.round(aNeed)} psi</li>
            <li><b>Branch B need</b> = ${Math.round(bNeed)} psi</li>
            <li><b>Take the higher branch</b> = <b>${Math.round(maxNeed)} psi</b></li>
            <li><b>Main FL</b> = ${mainSecs.length ? mainParts.join(' + ') : 0} = <b>${fmt(mainSum)} psi</b></li>
            <li><b>Wye</b> = +10 psi</li>
            <li><b>Elevation</b> = ${elevStr}</li>
          </ul>
          <div style="margin-top:6px"><b>PP = max(A,B) + Main FL + Wye ± Elev = <span class="pill">${fmt(total)} psi</span></b></div>
        </div>`;
    }
  }

  function renderLinesPanel(){
    const anyDeployed = Object.values(state.lines).some(l=>l.visible);
    if(!anyDeployed || !state.showMath){ linesTable.innerHTML=''; linesTable.classList.add('is-hidden'); return; }
    linesTable.classList.remove('is-hidden'); linesTable.innerHTML='';

    ['left','back','right'].forEach(key=>{
      const L = state.lines[key]; if(!L.visible) return;
      const row = document.createElement('div'); row.className='lineRow';
      const segs = L.itemsMain.length ? L.itemsMain.map(s=>`${s.lengthFt}′ ${sizeLabel(s.size)}`).join(' + ') : 'empty';
      const single = isSingleWye(L);
      const usedNoz = single ? activeNozzle(L) : L.nozRight;
      const flow = single ? (usedNoz?.gpm||0) : (L.hasWye ? (L.nozLeft.gpm + L.nozRight.gpm) : L.nozRight.gpm);

      row.innerHTML = `
        <div class="lineHeader">
          <span class="title">${L.label}</span>
          <span class="tag">Main: ${sumFt(L.itemsMain)}′ (${segs})</span>
          <span class="tag">Flow: ${flow} gpm</span>
          <span class="tag">${L.visible? 'DEPLOYED':'not deployed'}</span>
        </div>
        <details class="math" open>
          <summary>Line math</summary>
          <div class="hoseviz">
            <div class="hoseLegend">
              <span class="legSwatch sw175"></span> 1¾″
              <span class="legSwatch sw25"></span> 2½″
              <span class="legSwatch sw5"></span> 5″
            </div>
            <div class="barWrap">
              <div class="barTitle">${
                L.hasWye
                  ? \`Main ${sumFt(L.itemsMain)}′ @ ${Math.max(L.nozLeft?.gpm||0,L.nozRight?.gpm||0)} gpm — Wye 10 psi\`
                  : \`Main ${sumFt(L.itemsMain)}′ @ ${flow} gpm — NP ${L.nozRight?.NP||0} psi\`
              }</div>
              <div class="hosebar" id="viz_main_${key}"></div>
            </div>
            ${
              L.hasWye
              ? `
                <div class="barWrap">
                  <div class="barTitle">Branch A ${sumFt(L.itemsLeft)||0}′ @ ${L.nozLeft?.gpm||0} gpm — NP ${L.nozLeft?.NP||0} psi</div>
                  <div class="hosebar" id="viz_L_${key}"></div>
                </div>
                <div class="barWrap">
                  <div class="barTitle">Branch B ${sumFt(L.itemsRight)||0}′ @ ${L.nozRight?.gpm||0} gpm — NP ${L.nozRight?.NP||0} psi</div>
                  <div class="hosebar" id="viz_R_${key}"></div>
                </div>
              ` : ``
            }
            <div class="simpleBox" id="pp_simple_${key}"></div>
          </div>
        </details>
      `;
      linesTable.appendChild(row);

      // hose bars
      if(L.hasWye){
        const bflow = Math.max(L.nozLeft?.gpm||0, L.nozRight?.gpm||0);
        drawHoseBar(document.getElementById(`viz_main_${key}`), splitIntoSections(L.itemsMain), bflow, 0, `Main ${sumFt(L.itemsMain)}′ @ ${bflow} gpm`, `Wye 10`);
        drawHoseBar(document.getElementById(`viz_L_${key}`), splitIntoSections(L.itemsLeft), L.nozLeft?.gpm||0, L.nozLeft?.NP||0, `Branch A ${sumFt(L.itemsLeft)||0}′`);
        drawHoseBar(document.getElementById(`viz_R_${key}`), splitIntoSections(L.itemsRight), L.nozRight?.gpm||0, L.nozRight?.NP||0, `Branch B ${sumFt(L.itemsRight)||0}′`);
      } else {
        drawHoseBar(document.getElementById(`viz_main_${key}`), splitIntoSections(L.itemsMain), flow, L.nozRight?.NP||0, `Main ${sumFt(L.itemsMain)}′ @ ${flow} gpm`);
      }
      document.getElementById(`pp_simple_${key}`).innerHTML = ppExplainHTML(L);
    });
  }

  // ===== Tip editor =====
  overlay.addEventListener('click', (e)=>{
    const tip = e.target.closest('.hose-end'); if(!tip) return;
    const key = tip.getAttribute('data-line'); const where = tip.getAttribute('data-where');
    const L = seedDefaultsForKey(key);
    L.visible = true;
    editorContext = {key, where};
    teTitle.textContent = `${L.label} — ${where==='R'?'Nozzle':where==='L'?'Branch A':where==='main'?'Main':'Branch B'}`;
    teWhere.value = where.toUpperCase();
    teElev.value = L.elevFt||0;
    teWye.value  = L.hasWye? 'on':'off';

    const setNozList = () => {
      teNoz.innerHTML = NOZ_LIST.map(k=>`<option value="${k}">${NOZ[k].label}</option>`).join('');
    };
    setNozList();

    if(where==='main' || where==='R'){
      const seg = L.itemsMain[0] || {size:'1.75',lengthFt:200};
      teSize.value = seg.size; teLen.value = seg.lengthFt||0;
      teNoz.value = (L.nozRight?._k) || NOZ_LIST[0];
    } else if(where==='L'){
      const seg = L.itemsLeft[0] || {size:'1.75',lengthFt:100};
      teSize.value = seg.size; teLen.value = seg.lengthFt||0;
      teNoz.value = (L.nozLeft?._k) || NOZ_LIST[0];
    } else {
      const seg = L.itemsRight[0] || {size:'1.75',lengthFt:100};
      teSize.value = seg.size; teLen.value = seg.lengthFt||0;
      teNoz.value = (L.nozRight?._k) || NOZ_LIST[0];
    }

    branchBlock.classList.toggle('is-hidden', teWye.value==='off');
    teNozA.innerHTML = NOZ_LIST.map(k=>`<option value="${k}">${NOZ[k].label}</option>`).join('');
    teNozB.innerHTML = NOZ_LIST.map(k=>`<option value="${k}">${NOZ[k].label}</option>`).join('');
    teNozA.value = (L.nozLeft?._k)||NOZ_LIST[0];
    teNozB.value = (L.nozRight?._k)||NOZ_LIST[0];
    teLenA.value = (L.itemsLeft[0]?.lengthFt)||100;
    teLenB.value = (L.itemsRight[0]?.lengthFt)||100;

    // position editor
    tipEditor.style.visibility = 'hidden';
    tipEditor.classList.remove('is-hidden');
    const edW = tipEditor.offsetWidth || 300;
    const edH = tipEditor.offsetHeight || 240;
    const { x: pumpX } = pumpXY(currentViewH || 260);
    const truckTop = truckTopY(currentViewH || 260);
    const srect = stage.getBoundingClientRect();
    let left = pumpX - edW/2;
    let top  = truckTop - edH - 8;
    left = Math.max(8, Math.min(left, srect.width - edW - 8));
    top  = Math.max(8, Math.min(top, srect.height - edH - 8));
    tipEditor.style.left = left + 'px';
    tipEditor.style.top  = top + 'px';
    tipEditor.style.visibility = 'visible';
  });

  teWye.addEventListener('change', ()=>{ branchBlock.classList.toggle('is-hidden', teWye.value==='off'); });
  container.querySelector('#teCancel').addEventListener('click', ()=> tipEditor.classList.add('is-hidden'));
  container.querySelector('#teApply').addEventListener('click', ()=>{
    if(!editorContext) return;
    const {key, where} = editorContext; const L = state.lines[key];
    const size = teSize.value; const len = Math.max(0, +teLen.value||0);
    const noz = (NOZ[container.querySelector('#teNoz').value]);
    const elev=+teElev.value||0; const wyeOn = teWye.value==='on';
    L.elevFt = elev;
    if(where==='main' || where==='R'){
      L.itemsMain = [{size, lengthFt:len}];
      if(!wyeOn){
        L.hasWye=false; L.itemsLeft=[]; L.itemsRight=[]; L.nozRight = noz;
      }else{
        L.hasWye=true;
        const lenA = Math.max(0, +teLenA.value||0);
        const lenB = Math.max(0, +teLenB.value||0);
        L.itemsLeft  = lenA? [{size, lengthFt:lenA}] : [];
        L.itemsRight = lenB? [{size, lengthFt:lenB}] : [];
        L.nozLeft  = NOZ[container.querySelector('#teNozA').value] || L.nozLeft;
        L.nozRight = NOZ[container.querySelector('#teNozB').value] || L.nozRight;
      }
    } else if(where==='L'){
      L.hasWye = wyeOn || true; L.itemsLeft = len? [{size, lengthFt:len}] : []; L.nozLeft = noz;
    } else {
      L.hasWye = wyeOn || true; L.itemsRight = len? [{size, lengthFt:len}] : []; L.nozRight = noz;
    }
    L.visible = true; tipEditor.classList.add('is-hidden'); drawAll();
  });

  // Toggle lines
  container.querySelectorAll('.linebtn').forEach(b=>{
    b.addEventListener('click', ()=>{
      const key=b.dataset.line; const L=seedDefaultsForKey(key);
      L.visible = !L.visible; b.classList.toggle('active', L.visible);
      drawAll();
    });
  });

  // Cycle Supply (none -> hydrant -> drafting -> relay)
  container.querySelector('#supplyBtn').addEventListener('click', ()=>{
    const order = ['none','pressurized','drafting','relay'];
    state.supply = order[(order.indexOf(state.supply)+1)%order.length];
    drawAll();
  });

  // Presets sheet
  const sheet = container.querySelector('#sheet'), sheetBackdrop = container.querySelector('#sheetBackdrop');
  function openSheet(){ sheet.classList.add('show'); sheetBackdrop.style.display='block'; }
  function closeSheet(){ sheet.classList.remove('show'); sheetBackdrop.style.display='none'; container.querySelector('#sheetApply').disabled=true; }
  container.querySelector('#presetsBtn').addEventListener('click', openSheet);
  container.querySelector('#sheetClose').addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', closeSheet);

  let chosenPreset=null, chosenLine=null;
  container.querySelector('#presetGrid').addEventListener('click',(e)=>{
    const p = e.target.closest('.preset'); if(!p) return;
    chosenPreset = p.dataset.preset;
    container.querySelectorAll('#presetGrid .preset').forEach(x=>x.classList.remove('on'));
    p.classList.add('on'); maybeEnableApply();
  });
  container.querySelector('.linepick').addEventListener('click',(e)=>{
    const p = e.target.closest('.preset'); if(!p) return;
    chosenLine = p.dataset.applyline;
    container.querySelectorAll('.linepick .preset').forEach(x=>x.classList.remove('on'));
    p.classList.add('on'); maybeEnableApply();
  });
  function maybeEnableApply(){ container.querySelector('#sheetApply').disabled = !(chosenPreset && chosenLine); }
  container.querySelector('#sheetApply').addEventListener('click', ()=>{
    if(!(chosenPreset && chosenLine)) return;
    const L = seedDefaultsForKey(chosenLine);
    // example presets (keep light)
    if(chosenPreset==='standpipe'){
      L.itemsMain = [{size:'2.5', lengthFt:150}];
      L.nozRight = NOZ['chief185']; L.elevFt = 50; L.hasWye=false;
    } else if(chosenPreset==='sprinkler'){
      state.supply='pressurized';
      L.itemsMain = [{size:'2.5', lengthFt:100}];
      L.nozRight = NOZ['fog200']; L.elevFt = 0; L.hasWye=false;
    } else if(chosenPreset==='foam'){
      L.itemsMain = [{size:'1.75', lengthFt:200}];
      L.nozRight = NOZ['fog150']; L.elevFt = 0; L.hasWye=false;
    } else if(chosenPreset==='monitor'){
      L.itemsMain = [{size:'2.5', lengthFt:150}];
      L.nozRight = NOZ['msb1000']; L.elevFt = 0; L.hasWye=false;
    } else if(chosenPreset==='aerial'){
      state.supply='pressurized';
      L.itemsMain = [{size:'5', lengthFt:200}];
      L.nozRight = NOZ['msb1000']; L.elevFt = 80; L.hasWye=false;
    }
    L.visible = true;
    closeSheet();
    drawAll();
  });

  // Why? button (FIXED syntax here)
  container.querySelector('#whyBtn').addEventListener('click', ()=>{
    const anyDeployed = Object.values(state.lines).some(l=>l.visible);
    if(!anyDeployed){ alert('Deploy a line to see Pump Pressure breakdown.'); return; }
    state.showMath = true;
    renderLinesPanel();
    const target = linesTable.querySelector('details.math, .math details');
    if(target){
      if (typeof target.open !== 'undefined') target.open = true;
      target.scrollIntoView({behavior:'smooth', block:'center'});
    }
  });

  // ===== Tender shuttle logic =====
  function runningDelta(t){
    if(!t.running || !t.startTs) return 0;
    return Math.max(0, Math.floor((Date.now() - t.startTs)/1000));
  }
  function gpmForTender(t){
    const seconds = t.running ? (t.sec + runningDelta(t)) : t.sec;
    if(seconds <= 0) return 0;
    const minutes = seconds / 60;
    return t.eff / minutes; // gal/min
  }
  function updateTotalsShuttle(){
    const total = tenders.reduce((a,t)=>a + gpmForTender(t), 0);
    shuttleTotalGpm.textContent = fmt1(total);
  }
  function injectTenderTable(){
    if(!staticHelper || staticHelper.style.display==='none'){
      return;
    }
    if(!tenders.length){
      tenderList.innerHTML = `<div class="status" style="color:#cfe6ff">No tenders added yet.</div>`;
      shuttleTotalGpm.textContent = '0';
      return;
    }
    tenderList.innerHTML = `
      <table class="tTable" role="table" aria-label="Tender Shuttle">
        <thead>
          <tr>
            <th>Tender</th>
            <th>Capacity</th>
            <th>Effective (-10%)</th>
            <th>Round Trip Time</th>
            <th>GPM</th>
            <th>Controls</th>
          </tr>
        </thead>
        <tbody>
          ${tenders.map((t,i)=>`
            <tr data-i="${i}">
              <td><span class="tBadge">${escapeHTML(t.id)}</span></td>
              <td>${fmt0(t.cap)} gal</td>
              <td>${fmt0(t.eff)} gal</td>
              <td class="tTimer">${formatTime(t.running ? t.sec + runningDelta(t) : t.sec)}</td>
              <td><b>${fmt1(gpmForTender(t))}</b></td>
              <td>
                <div style="display:flex; gap:6px; flex-wrap:wrap">
                  <button class="btn btnIcon" data-act="startstop">${t.running?'Stop':'Start'}</button>
                  <button class="btn" data-act="lap">Set Time</button>
                  <button class="btn" data-act="reset">Reset</button>
                  <button class="btn" data-act="del">Delete</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    updateTotalsShuttle();
  }
  function addTender(id, cap){
    const capNum = Number(cap);
    if(!id || !(capNum>0)) return;
    tenders.push({ id, cap: capNum, eff: Math.round(capNum*0.9), sec: 0, running: false, startTs: 0 });
    injectTenderTable();
  }
  tAddBtn.addEventListener('click', ()=>{
    addTender((tAddId.value||'Tender').trim(), tAddCap.value);
    tAddId.value=''; tAddCap.value='';
  });
  tenderList.addEventListener('click', (e)=>{
    const tr = e.target.closest('tr[data-i]'); if(!tr) return;
    const i = +tr.dataset.i; const t = tenders[i];
    const act = e.target.closest('[data-act]')?.dataset.act; if(!act) return;
    if(act==='startstop'){
      if(t.running){ t.sec += runningDelta(t); t.running=false; t.startTs=0; }
      else { t.running=true; t.startTs=Date.now(); }
      injectTenderTable();
    }else if(act==='lap'){
      if(t.running){ t.sec += runningDelta(t); t.running=false; t.startTs=0; }
      const mm = prompt(`Enter round-trip minutes for ${t.id} (or leave blank to keep ${fmt1(t.sec/60)} min):`, '');
      if(mm && !isNaN(+mm) && +mm>0){ t.sec = Math.round(+mm * 60); }
      injectTenderTable();
    }else if(act==='reset'){
      t.running=false; t.startTs=0; t.sec=0; injectTenderTable();
    }else if(act==='del'){
      tenders.splice(i,1); injectTenderTable();
    }
  });
  // light timer repaint
  const shuttleTick = setInterval(()=>{ if(staticHelper && staticHelper.style.display!=='none' && tenders.some(t=>t.running)){ injectTenderTable(); }}, 500);

  // Boot
  drawAll();

  // Cleanup
  return { dispose(){ clearInterval(shuttleTick); } };
}

export default { render };

// ===== Small utilities =====
function escapeHTML(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function formatTime(sec){
  sec = Math.max(0, Math.floor(sec||0));
  const m = Math.floor(sec/60), s = sec%60;
  return `${m}m ${s.toString().padStart(2,'0')}s`;
}
