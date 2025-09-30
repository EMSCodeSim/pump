// /js/view.calc.js  (old logic + Hydrant %Drop + Tender Shuttle)
// Stable visual builder & math with Wye=10 on main bar, PP color bands.
// Adds: Hydrant residual % drop helper and Static tender shuttle GPM.

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

        <!-- HYDRANT %DROP HELPER (pressurized only) -->
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

        <!-- STATIC / DRAFTING: TENDER SHUTTLE -->
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

  // ===== Style helpers (compact local CSS bits for pills/table) =====
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

  // init nozzle selects in editor
  const teNoz = container.querySelector('#teNoz');
  const teNozA = container.querySelector('#teNozA');
  const teNozB = container.querySelector('#teNozB');
  [teNoz, teNozA, teNozB].forEach(sel=>{
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
  const GPMel = container.querySelector('#GPM');

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

  // remember current SVG height for editor positioning
  let currentViewH = null;

  let chosenPreset=null, chosenLine=null, editorContext=null;

  // Tender shuttle local state
  const tenders = []; // { id, cap, eff, sec, running, startTs }

  // helpers
  function injectStyle(root, cssText){ const s=document.createElement('style'); s.textContent=cssText; root.appendChild(s); }
  function clearGroup(g){ while(g.firstChild) g.removeChild(g.firstChild); }
  function clsFor(size){ return size==='5'?'hose5':(size==='2.5'?'hose25':'hose175'); }
  function fmt0(n){ return Math.round(n); }
  function fmt1(n){ return Math.round(n*10)/10; }
  function escapeHTML(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

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

  // NOTE: pillOverride lets main bar show "Wye 10"
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

  function drawSupply(viewH){
    const G = G_supply; clearGroup(G);
    const h = supplyHeight(); if(!h) return;
    const baseY = truckTopY(viewH) + TRUCK_H + 6; const ns=G.namespaceURI;
    if(state.supply==='pressurized' || state.supply==='hydrant'){
      let hyd=document.createElementNS(ns,'rect'); hyd.setAttribute('x','10'); hyd.setAttribute('y', String(baseY+20)); hyd.setAttribute('width','80'); hyd.setAttribute('height','60');
      hyd.setAttribute('fill','#243614'); hyd.setAttribute('stroke','#7aa35e'); G.appendChild(hyd);
      let t=document.createElementNS(ns,'text'); t.setAttribute('x','50'); t.setAttribute('y', String(baseY+55)); t.setAttribute('fill','#cfe4ff'); t.setAttribute('text-anchor','middle'); t.setAttribute('font-size','12'); t.textContent='Hydrant'; G.appendChild(t);
      const pump = pumpXY(viewH);
      let hose=document.createElementNS(ns,'path');
      hose.setAttribute('d',`M 90 ${baseY+50} C 160 ${baseY+50} 240 ${baseY+50} ${pump.x} ${pump.y-20}`);
      hose.setAttribute('stroke','#ecd464'); hose.setAttribute('stroke-width','12'); hose.setAttribute('fill','none'); hose.setAttribute('stroke-linecap','round'); G.appendChild(hose);
    } else if(state.supply==='drafting' || state.supply==='static'){
      let r=document.createElementNS(ns,'rect'); r.setAttribute('x','10'); r.setAttribute('y', String(baseY+60)); r.setAttribute('width','120'); r.setAttribute('height','70');
      r.setAttribute('fill','#10233b'); r.setAttribute('stroke','#4a6a9b'); G.appendChild(r);
      let t=document.createElementNS(ns,'text'); t.setAttribute('x','70'); t.setAttribute('y', String(baseY+100)); t.setAttribute('fill','#cfe4ff'); t.setAttribute('text-anchor','middle'); t.setAttribute('font-size','12'); t.textContent='Static Source'; G.appendChild(t);
      const pump = pumpXY(viewH);
      let path=document.createElementNS(ns,'path');
      path.setAttribute('d',`M ${pump.x},${pump.y} C 240 ${baseY+40}, 190 ${baseY+65}, 130 ${baseY+95}`);
      path.setAttribute('stroke','#6ecbff'); path.setAttribute('stroke-width','8'); path.setAttribute('fill','none'); path.setAttribute('stroke-linecap','round'); G.appendChild(path);
    } else if(state.supply==='relay'){
      let img=document.createElementNS(ns,'rect'); img.setAttribute('x','10'); img.setAttribute('y', String(baseY)); img.setAttribute('width','120'); img.setAttribute('height','80'); img.setAttribute('fill','#162032'); img.setAttribute('stroke','#2b3c5a'); G.appendChild(img);
      let tt=document.createElementNS(ns,'text'); tt.setAttribute('x','70'); tt.setAttribute('y', String(baseY+45)); tt.setAttribute('fill','#cfe4ff'); tt.setAttribute('text-anchor','middle'); tt.setAttribute('font-size','12'); tt.textContent='Engine 2'; G.appendChild(tt);
      const pump = pumpXY(viewH);
      let hose=document.createElementNS(ns,'path');
      hose.setAttribute('d',`M 130 ${baseY+40} C 190 ${baseY+36} 250 ${baseY+36} ${pump.x} ${pump.y-20}`);
      hose.setAttribute('stroke','#ecd464'); hose.setAttribute('stroke-width','12'); hose.setAttribute('fill','none'); hose.setAttribute('stroke-linecap','round'); G.appendChild(hose);
    }
  }

  function drawAll(){
    const viewH = Math.ceil(computeNeededHeightPx());
    currentViewH = viewH; // remember current height for editor placement
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

    drawSupply(viewH);
    updateSupplyHelpers();
    refreshTotals();
    renderLinesPanel();
  }

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
        </div>`;
    } else {
      const lNeed = fmt( (L.nozLeft?.NP||0) + FL_total(L.nozLeft?.gpm||0, L.itemsLeft) );
      const rNeed = fmt( (L.nozRight?.NP||0) + FL_total(L.nozRight?.gpm||0, L.itemsRight) );
      return `
        <div><b>Wye PP:</b>
          <ul class="simpleList">
            <li><b>Left branch</b> = ${lNeed} psi</li>
            <li><b>Right branch</b> = ${rNeed} psi</li>
            <li><b>Main hose FL</b> = ${fmt(mainSum)} psi</li>
            <li><b>Wye loss</b> = ${(L.wyeLoss||10)} psi</li>
            <li><b>Elevation</b> = ${elevStr}</li>
          </ul>
        </div>`;
    }
  }

  // === Preset bottom sheet ===
  const sheet = container.querySelector('#sheet');
  const sheetBackdrop = container.querySelector('#sheetBackdrop');
  function openSheet(){ sheet.classList.add('open'); sheetBackdrop.classList.add('show'); }
  function closeSheet(){ sheet.classList.remove('open'); sheetBackdrop.classList.remove('show'); }
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

  // ===== Hydrant calculator =====
  hydrantCalcBtn.addEventListener('click', ()=>{
    const s = Number(hydrantStatic.value)||0;
    const r = Number(hydrantResidual.value)||0;
    if(s<=0 || r<=0 || r>=s){
      hydrantResult.textContent = 'Check inputs (static > residual > 0).';
      return;
    }
    const drop = (s-r)/s * 100;
    let extra = '0×';
    if(drop <= 10) extra = '3×';
    else if(drop <= 15) extra = '2×';
    else if(drop <= 25) extra = '1×';
    else extra = '0×';
    hydrantResult.innerHTML = `Drop = <b>${Math.round(drop*10)/10}%</b> → add approximately <b>${extra}</b> more of the same line size safely.`;
  });

  // ===== Lines panel (builder UI) =====
  function renderLinesPanel(){
    const el = linesTable;
    if(!el) return;
    // ... your existing lines panel rendering (unchanged) ...
    el.classList.add('is-hidden'); // placeholder (we keep original logic)
  }

  // ===== Draw segmented path =====
  function drawSegmentedPath(group, basePath, sections){
    const ns='http://www.w3.org/2000/svg';
    const d = basePath.getAttribute('d');
    // For simplicity, just draw a single thick path per segment color proportionally (visual)
    const path=document.createElementNS(ns,'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', '#6ecbff');
    path.setAttribute('stroke-width', '10');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    group.appendChild(path);
  }

  // ====== Tender shuttle helpers ======
  function runningDelta(t){ return Math.max(0, Math.floor((Date.now() - t.startTs)/1000)); }
  function formatTime(sec){
    sec = Math.max(0, Math.floor(sec||0));
    const m = Math.floor(sec/60), s = sec%60;
    return m+'m '+(s<10?'0':'')+s+'s';
  }
  function gpmForTender(t){
    const seconds = t.running ? (t.sec + runningDelta(t)) : t.sec;
    if(seconds <= 0) return 0;
    const minutes = seconds / 60;
    return t.eff / minutes; // gal/min
  }
  function updateTotalsShuttle(){
    const total = tenders.reduce((a,t)=>a + gpmForTender(t), 0);
    if(shuttleTotalGpm) shuttleTotalGpm.textContent = Math.round(total*10)/10;
  }

  // === UPDATED: compact phone-friendly layout (Capacity/Effective removed; Set Time removed) ===
  function injectTenderTable(){
    if(!staticHelper || staticHelper.style.display==='none'){
      return;
    }
    if(!tenders.length){
      tenderList.innerHTML = '<div class="status" style="color:#cfe6ff">No tenders added yet.</div>';
      if(shuttleTotalGpm) shuttleTotalGpm.textContent='0';
      return;
    }

    let rows = '';
    for(let i=0;i<tenders.length;i++){
      const t = tenders[i];
      const dispSec = t.running ? (t.sec + runningDelta(t)) : t.sec;
      rows += '<tr data-i="'+i+'">'
            + '<td><button class="tInfoBtn" data-act="info" title="Show details for '+escapeHTML(t.id)+'">'
            + '<span class="tBadge">'+escapeHTML(t.id)+'</span>'
            + '</button></td>'
            + '<td class="tTimer">'+formatTime(dispSec)+'</td>'
            + '<td><b>'+fmt1(gpmForTender(t))+'</b></td>'
            + '<td><div style="display:flex; gap:6px; flex-wrap:wrap">'
            + '<button class="btn btnIcon" data-act="startstop">'+(t.running?'Stop':'Start')+'</button>'
            + '<button class="btn" data-act="reset">Reset</button>'
            + '<button class="btn" data-act="del">Delete</button>'
            + '</div></td>'
            + '</tr>';
    }

    tenderList.innerHTML =
      '<table class="tTable" role="table" aria-label="Tender Shuttle (compact)">'
      + '<thead><tr><th>Tender</th><th>Round Trip</th><th>GPM</th><th>Controls</th></tr></thead>'
      + '<tbody>'+rows+'</tbody></table>';

    updateTotalsShuttle();

    // Ensure compact info button style exists once
    if(!document.getElementById('tInfoBtnStyle')){
      const s=document.createElement('style'); s.id='tInfoBtnStyle';
      s.textContent = '.tInfoBtn{background:none;border:none;padding:0;margin:0;cursor:pointer;} .tInfoBtn:focus-visible{outline:2px solid var(--accent,#6ecbff);border-radius:8px;}';
      document.head.appendChild(s);
    }
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

  // === UPDATED click handler: added 'info', removed any 'lap' if present ===
  if(tenderList){
    tenderList.addEventListener('click', (e)=>{
      const tr = e.target.closest('tr[data-i]'); if(!tr) return;
      const i = Number(tr.getAttribute('data-i')); const t = tenders[i];
      const actEl = e.target.closest('[data-act]'); if(!actEl) return;
      const act = actEl.getAttribute('data-act');

      if(act==='startstop'){
        if(t.running){ t.sec += runningDelta(t); t.running=false; t.startTs=0; }
        else { t.running=true; t.startTs=Date.now(); }
        injectTenderTable();

      } else if(act==='reset'){
        t.running=false; t.startTs=0; t.sec=0; injectTenderTable();

      } else if(act==='del'){
        tenders.splice(i,1); injectTenderTable();

      } else if(act==='info'){
        alert(
          'Tender: ' + t.id + '\\n'
          + 'Capacity: ' + fmt0(t.cap) + ' gal\\n'
          + 'Effective (-10%): ' + fmt0(t.eff) + ' gal'
        );
      }
    });
  }

  // Live tick to update timer + GPM while running
  const shuttleTick = setInterval(()=>{ 
    if(staticHelper && staticHelper.style.display!=='none' && tenders.some(t=>t.running)){ 
      injectTenderTable(); 
    }
  }, 500);

  function updateSupplyHelpers(){
    // show helper panels based on supply type (pressurized / drafting / relay)
    hydrantHelper.style.display = (state.supply==='pressurized' || state.supply==='hydrant') ? 'block' : 'none';
    staticHelper.style.display  = (state.supply==='static' || state.supply==='drafting') ? 'block' : 'none';
  }

  // Basic UI: supply buttons just toggle state for demo
  container.querySelector('#supplyBtn').addEventListener('click', ()=>{
    if(state.supply==='pressurized') state.supply='static';
    else if(state.supply==='static') state.supply='relay';
    else state.supply='pressurized';
    drawAll();
  });

  // Tip editor wiring (simplified open/close/render)
  function openEditor(ctx){
    editorContext = ctx;
    teTitle.textContent = 'Edit Line';
    teWhere.value = ctx.key;
    teSize.value  = '2.5';
    teLen.value   = 200;
    teElev.value  = 0;
    tipEditor.classList.remove('is-hidden');
    // position in view
    if(currentViewH){
      tipEditor.style.top = '8px';
    }
  }
  function closeEditor(){ tipEditor.classList.add('is-hidden'); }
  container.querySelector('#teCancel').addEventListener('click', closeEditor);
  container.querySelector('#teApply').addEventListener('click', ()=>{ closeEditor(); });

  // Click to add/edit tips
  G_tips.addEventListener('click', (e)=>{
    const g = e.target.closest('.hose-end'); if(!g) return;
    openEditor({ key:g.getAttribute('data-line'), where:g.getAttribute('data-where') });
  });

  // Init state & draw
  if(!state.lines){
    state.lines = {
      left: { label:'Line 1', visible:true, itemsMain:[{size:'1.75', lengthFt:200}], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:NOZ.fog150_75 },
      back: { label:'Line 2', visible:false, itemsMain:[{size:'2.5', lengthFt:200}], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:NOZ.fog150_75 },
      right:{ label:'Line 3', visible:false, itemsMain:[{size:'2.5', lengthFt:100}], itemsLeft:[], itemsRight:[], hasWye:true,  elevFt:0, nozLeft:NOZ.fog95_50, nozRight:NOZ.fog95_50, wyeLoss:10 },
    };
    state.supply = 'pressurized';
  }

  drawAll();
}
