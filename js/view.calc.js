// /js/view.calc.js
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

        <!-- Hydrant Residual %Drop Helper (shows only in Hydrant supply) -->
        <div id="hydrantHelper" class="helperPanel" style="display:none; margin-top:10px; background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
          <div style="color:#fff; font-weight:800; margin-bottom:6px">Hydrant Residual %Drop</div>
          <div class="mini" style="color:#a9bed9; margin-bottom:8px">
            Enter static & residual with one line flowing to estimate how many <b>additional same-size lines</b> you can add.
            Bands: 0–10% → 3×, 11–15% → 2×, 16–25% → 1×, &gt;25% → 0×.
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

      <div class="mini" style="opacity:.7;margin-top:10px">Then press “Apply to Line”.</div>
      <div style="display:flex; gap:10px; margin-top:8px">
        <button id="sheetApply" class="btn primary" disabled>Apply to Line</button>
      </div>
    </div>
    <div id="sheetBackdrop" class="backdrop"></div>
  `;

  // ======= DOM / groups =======
  const overlay = container.querySelector('#overlay');
  const stage = container.querySelector('.stage');
  const G_supply = overlay.querySelector('#G_supply');
  const G = overlay.querySelector('#G_hoses');
  const G_labels = overlay.querySelector('#G_labels');
  const G_tips = overlay.querySelector('#G_tips');

  // ======= helper funcs (drawing support) =======
  function clearGroup(g){ while(g.firstChild) g.removeChild(g.firstChild); }

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

  // NOTE: Added pillOverride to let us show "Wye 10" on the main bar (wye case)
  function drawHoseBar(containerEl, sections, gpm, npPsi, nozzleText, pillOverride=null){
    const totalLen = sumFt(sections);
    containerEl.innerHTML='';
    if(!totalLen||!gpm){
      containerEl.textContent='No hose yet';
      containerEl.style.color='#9fb0c8';
      return;
    }

    const ns='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox', `0 0 360 60`);
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    svg.setAttribute('class','hosebarSvg');

    let x=10, y=30;
    const totalPx = (totalLen/50)*PX_PER_50FT;
    const sw = totalPx>180? 10 : totalPx>90? 14 : 18;

    // segments
    sections.forEach(s=>{
      const w = (s.lengthFt/50) * PX_PER_50FT;
      const r = document.createElementNS(ns,'rect');
      r.setAttribute('x', x); r.setAttribute('y', y - sw/2);
      r.setAttribute('width', w); r.setAttribute('height', sw);
      r.setAttribute('rx','6'); r.setAttribute('fill', s.size==='1.75' ? COLORS['1.75'] : s.size==='2.5'? COLORS['2.5'] : COLORS['5']);
      svg.appendChild(r);
      x += w + 2;
    });

    // text: left label
    const left = document.createElementNS(ns,'text');
    left.setAttribute('x', 10); left.setAttribute('y', 16); left.setAttribute('class','barlabel');
    left.textContent = nozzleText;
    svg.appendChild(left);

    // text: right chip
    const npT = document.createElementNS(ns,'text');
    npT.setAttribute('x', 350); npT.setAttribute('y', 44); npT.setAttribute('class','chip');
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

  // ======= SUPPLY drawing =======
  function drawSupply(viewH){
    const G = G_supply; clearGroup(G);
    const h = supplyHeight(); if(!h) return;
    const baseY = truckTopY(viewH) + TRUCK_H + 6; const ns=G.namespaceURI;
    if(state.supply==='pressurized'){
      let hyd=document.createElementNS(ns,'rect'); hyd.setAttribute('x','50'); hyd.setAttribute('y', String(baseY+20)); hyd.setAttribute('width','80'); hyd.setAttribute('height','60');
      hyd.setAttribute('fill','#243614'); hyd.setAttribute('stroke','#7aa35e'); G.appendChild(hyd);
      let t=document.createElementNS(ns,'text'); t.setAttribute('x','90'); t.setAttribute('y', String(baseY+56)); t.setAttribute('fill','#cfe4ff'); t.setAttribute('text-anchor','middle'); t.setAttribute('font-size','12'); t.textContent='Hydrant'; G.appendChild(t);
      const pump = pumpXY(viewH);
      let hose=document.createElementNS(ns,'path');
      hose.setAttribute('d',`M 90 ${baseY+50} C 160 ${baseY+50} 240 ${baseY+50} ${pump.x} ${pump.y-20}`);
      hose.setAttribute('stroke','#ecd464'); hose.setAttribute('fill','none'); hose.setAttribute('stroke-width','8'); hose.setAttribute('stroke-linecap','round'); G.appendChild(hose);
    } else if(state.supply==='drafting'){
      let r=document.createElementNS(ns,'rect'); r.setAttribute('x','60'); r.setAttribute('y', String(baseY+30)); r.setAttribute('width','120'); r.setAttribute('height','70');
      r.setAttribute('fill','#10233b'); r.setAttribute('stroke','#4a6a9b'); G.appendChild(r);
      let t=document.createElementNS(ns,'text'); t.setAttribute('x','120'); t.setAttribute('y', String(baseY+72)); t.setAttribute('fill','#cfe4ff'); t.setAttribute('text-anchor','middle'); t.setAttribute('font-size','12'); t.textContent='Static Source'; G.appendChild(t);
      const pump = pumpXY(viewH);
      let path=document.createElementNS(ns,'path');
      path.setAttribute('d',`M ${pump.x},${pump.y} C 240 ${baseY+40}, 190 ${baseY+65}, 130 ${baseY+95}`);
      path.setAttribute('stroke','#6ecbff'); path.setAttribute('fill','none'); path.setAttribute('stroke-width','8'); path.setAttribute('stroke-linecap','round'); G.appendChild(path);
    } else if(state.supply==='relay'){
      let img=document.createElementNS(ns,'rect'); img.setAttribute('x','70'); img.setAttribute('y', String(baseY+20)); img.setAttribute('width','120'); img.setAttribute('height','60');
      img.setAttribute('fill','#1b2536'); img.setAttribute('stroke','#2b3c5a'); G.appendChild(img);
      let tt=document.createElementNS(ns,'text'); tt.setAttribute('x','130'); tt.setAttribute('y', String(baseY+45)); tt.setAttribute('fill','#cfe4ff'); tt.setAttribute('text-anchor','middle'); tt.setAttribute('font-size','12'); tt.textContent='Engine 2'; G.appendChild(tt);
      const pump = pumpXY(viewH);
      let hose=document.createElementNS(ns,'path');
      hose.setAttribute('d',`M 130 ${baseY+40} C 190 ${baseY+36} 250 ${baseY+36} ${pump.x} ${pump.y-20}`);
      hose.setAttribute('stroke','#ecd464'); hose.setAttribute('fill','none'); hose.setAttribute('stroke-width','8'); hose.setAttribute('stroke-linecap','round'); G.appendChild(hose);
    }
  }

  function drawAll(){
    const viewH = Math.ceil(computeNeededHeightPx());
    currentViewH = viewH; // remember current height for editor placement
    overlay.setAttribute('viewBox', `0 0 ${TRUCK_W} ${viewH}`);
    const hpx = viewH + 'px';
    stage.style.height = hpx;
    truckImg.setAttribute('y', String(truckTopY(viewH)));

    clearGroup(G); clearGroup(G_labels); clearGroup(G_tips);
    drawSupply(viewH);

    const lines = state.lines;
    const active = Object.entries(lines).filter(([,L])=>L.visible);

    // KPIs
    let totalGPM = 0, maxPP = 0;
    active.forEach(([key,L])=>{
      const flow = (L.nozLeft?.gpm||0) + (L.nozRight?.gpm||0);
      totalGPM += flow;
      const parts = [];
      const mainSecs = splitIntoSections(L.itemsMain);
      const mainFLs = mainSecs.map(s => FL(flow, s.size, s.lengthFt));
      const mainSum = mainFLs.reduce((a,c)=>a+c,0);
      const elev = (L.elevFt||0) * PSI_PER_FT;
      let pp = 0;
      if(!L.hasWye){
        const NP = (L.nozRight?.NP||0);
        pp = NP + mainSum + elev;
      } else {
        const leftFlow = (L.nozLeft?.gpm||0);
        const rightFlow= (L.nozRight?.gpm||0);
        const bflow = Math.max(leftFlow, rightFlow);
        const wye = 10; // default wye loss
        // main uses branch max flow
        pp = (activeNozzle(L)?.NP||0) + mainSum + elev + wye;
      }
      maxPP = Math.max(maxPP, pp);
    });
    const GPM = container.querySelector('#GPM');
    const PDP = container.querySelector('#PDP');
    GPM.textContent = totalGPM ? `${Math.round(totalGPM)} gpm` : '— gpm';
    PDP.textContent = maxPP ? `${Math.round(maxPP)} psi` : '— psi';

    // Draw each line
    active.forEach(([key,L])=>{
      // main curve
      const totalPx = (sumFt(L.itemsMain)/50)*PX_PER_50FT;
      const side = activeSide(L);
      const dir = side==='L' ? -1 : side==='R' ? 1 : 0;
      const curve = mainCurve(dir, totalPx, viewH);
      const ns='http://www.w3.org/2000/svg';
      let path = document.createElementNS(ns,'path');
      path.setAttribute('d', curve.d);
      path.setAttribute('stroke', COLORS[L.itemsMain?.[0]?.size || '1.75']);
      path.setAttribute('fill','none');
      path.setAttribute('stroke-width','10'); path.setAttribute('stroke-linecap','round');
      G.appendChild(path);

      // label main length near middle
      const mx = (pumpXY(viewH).x + curve.endX)/2, my = (pumpXY(viewH).y + curve.endY)/2 - 10;
      addLabel(`${sumFt(L.itemsMain)}′`, mx, my);

      // branch(es)
      if(L.hasWye){
        const br = straightBranch(side, curve.endX, curve.endY, (sumFt(side==='L'?L.itemsLeft:L.itemsRight)/50)*PX_PER_50FT);
        let brPath=document.createElementNS(ns,'path');
        brPath.setAttribute('d', br.d); brPath.setAttribute('stroke', COLORS[side==='L'?(L.itemsLeft?.[0]?.size||'1.75'):(L.itemsRight?.[0]?.size||'1.75')]);
        brPath.setAttribute('fill','none'); brPath.setAttribute('stroke-width','8'); brPath.setAttribute('stroke-linecap','round'); G.appendChild(brPath);
        addLabel(`${sumFt(side==='L'?L.itemsLeft:L.itemsRight)}′`, br.endX, br.endY, -8);
      }

      // tips
      if(L.hasWye){
        addTip(key, 'L', curve.endX, curve.endY-((sumFt(L.itemsLeft)/50)*PX_PER_50FT || 0));
        addTip(key, 'R', curve.endX, curve.endY-((sumFt(L.itemsRight)/50)*PX_PER_50FT || 0));
      } else {
        addTip(key, 'R', curve.endX, curve.endY);
      }
    });

    // math / why tables
    const linesTable = container.querySelector('#linesTable');
    linesTable.classList.toggle('is-hidden', active.length===0);

    active.forEach(([key,L])=>{
      const single = isSingleWye(L);
      const side = activeSide(L);
      const mathWrap = document.createElement('div');
      mathWrap.className = 'mathWrap';
      const wye = 10;
      const flow = (L.nozLeft?.gpm||0)+(L.nozRight?.gpm||0);
      const bflow = Math.max(L.nozLeft?.gpm||0, L.nozRight?.gpm||0);
      const mainSecs = splitIntoSections(L.itemsMain);
      const mainFLs = mainSecs.map(s => FL(flow, s.size, s.lengthFt));
      const mainParts = mainSecs.map((s,i)=>`${fmt(mainFLs[i])} (${fmtSegLabel(s.lengthFt, s.size)})`);
      const mainSum = mainFLs.reduce((a,c)=>a+c,0);
      const elevPsi = (L.elevFt||0) * PSI_PER_FT;
      const elevStr = `${elevPsi>=0? '+':''}${fmt(elevPsi)} psi`;

      if(!L.hasWye){
        mathWrap.innerHTML = `
          <details class="math">
            <summary>Why is PP ${fmt((L.nozRight?.NP||0)+mainSum+elevPsi)} psi?</summary>
            <div class="hoseviz">
              <div class="hoseLegend">
                <span class="legSwatch sw175"></span> 1¾″
                <span class="legSwatch sw25"></span> 2½″
                <span class="legSwatch sw5"></span> 5″
              </div>
              <div class="barWrap">
                <div class="barTitle">Main ${sumFt(L.itemsMain)}′ @ ${flow} gpm — NP ${(L.nozRight?.NP||0)} psi</div>
                <div class="hosebar" id="viz_main_${key}"></div>
              </div>
              <div class="simpleBox" id="pp_simple_${key}"></div>
            </div>
          </details>
        `;
        linesTable.appendChild(mathWrap);
        drawHoseBar(document.getElementById(`viz_main_${key}`), splitIntoSections(L.itemsMain), flow, L.nozRight?.NP||0, `Main ${sumFt(L.itemsMain)}′ @ ${flow} gpm`);
        document.getElementById(`pp_simple_${key}`).innerHTML = `
          <div><b>Simple PP:</b>
            <ul class="simpleList">
              <li><b>Nozzle Pressure</b> = ${fmt(L.nozRight?.NP||0)} psi</li>
              <li><b>Friction Loss (Main)</b> = ${mainSecs.length ? mainParts.join(' + ') : 0} = <b>${fmt(mainSum)} psi</b></li>
              <li><b>Elevation</b> = ${elevStr}</li>
            </ul>
            <div style="margin-top:6px"><b>PP = NP + Main FL ± Elev = <span class="pill">${fmt((L.nozRight?.NP||0)+mainSum+elevPsi)} psi</span></b></div>
          </div>
        `;
      } else if(single){
        const noz = activeNozzle(L);
        const brSecs = splitIntoSections(side==='L'?L.itemsLeft:L.itemsRight);
        const brFLs  = brSecs.map(s => FL(noz.gpm, s.size, s.lengthFt));
        const brParts= brSecs.map((s,i)=>`${fmt(brFLs[i])} (${fmtSegLabel(s.lengthFt, s.size)})`);
        const brSum  = brFLs.reduce((x,y)=>x+y,0);
        const total  = noz.NP + brSum + mainSum + elevPsi;
        mathWrap.innerHTML = `
          <details class="math">
            <summary>Why is PP ${fmt(total)} psi?</summary>
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
                <div class="barTitle">Branch ${sumFt(brSecs)||0}′ @ ${noz.gpm} gpm — NP ${noz.NP} psi</div>
                <div class="hosebar" id="viz_${side}_${key}"></div>
              </div>
              <div class="simpleBox" id="pp_simple_${key}"></div>
            </div>
          </details>
        `;
        linesTable.appendChild(mathWrap);

        // Main bar shows Wye loss chip instead of NP
        drawHoseBar(document.getElementById(`viz_main_${key}`), splitIntoSections(L.itemsMain), bflow, 0, `Main ${sumFt(L.itemsMain)}′ @ ${bflow} gpm`, `Wye ${wye}`);
        drawHoseBar(document.getElementById(`viz_${side}_${key}`), brSecs, noz.gpm||0, noz.NP||0, `Branch ${sumFt(brSecs)||0}′`);
        document.getElementById(`pp_simple_${key}`).innerHTML = `
          <div><b>Simple PP (Single branch via wye):</b>
            <ul class="simpleList">
              <li><b>Nozzle Pressure</b> = ${fmt(noz.NP)} psi</li>
              <li><b>Friction Loss (Main)</b> = ${mainSecs.length ? mainParts.join(' + ') : 0} = <b>${fmt(mainSum)} psi</b></li>
              <li><b>Friction Loss (Branch)</b> = ${brSecs.length ? brParts.join(' + ') : 0} = <b>${fmt(brSum)} psi</b></li>
              <li><b>Wye</b> = +${wye} psi</li>
              <li><b>Elevation</b> = ${elevStr}</li>
            </ul>
            <div style="margin-top:6px"><b>PP = NP + Main FL + Branch FL + Wye ± Elev = <span class="pill">${fmt(total)} psi</span></b></div>
          </div>
        `;
      } else {
        const leftFlow = (L.nozLeft?.gpm||0);
        const rightFlow= (L.nozRight?.gpm||0);
        const bflow = Math.max(leftFlow, rightFlow);
        const mainSecs = splitIntoSections(L.itemsMain);
        const mainFLs = mainSecs.map(s => FL(bflow, s.size, s.lengthFt));
        const mainParts = mainSecs.map((s,i)=>`${fmt(mainFLs[i])} (${fmtSegLabel(s.lengthFt, s.size)})`);
        const mainSum = mainFLs.reduce((a,c)=>a+c,0);
        const elevPsi = (L.elevFt||0) * PSI_PER_FT;
        const elevStr = `${elevPsi>=0? '+':''}${fmt(elevPsi)} psi`;

        const LFL = splitIntoSections(L.itemsLeft).map(s=>FL(L.nozLeft?.gpm||0, s.size, s.lengthFt));
        const RFL = splitIntoSections(L.itemsRight).map(s=>FL(L.nozRight?.gpm||0, s.size, s.lengthFt));
        const Lsum = LFL.reduce((a,c)=>a+c,0), Rsum = RFL.reduce((a,c)=>a+c,0);
        const total = (activeNozzle(L)?.NP||0) + mainSum + elevPsi + 10 + Math.max(Lsum, Rsum);

        mathWrap.innerHTML = `
          <details class="math">
            <summary>Why is PP ${fmt(total)} psi?</summary>
            <div class="hoseviz">
              <div class="hoseLegend">
                <span class="legSwatch sw175"></span> 1¾″
                <span class="legSwatch sw25"></span> 2½″
                <span class="legSwatch sw5"></span> 5″
              </div>
              <div class="barWrap">
                <div class="barTitle">Main ${sumFt(L.itemsMain)}′ @ ${bflow} gpm — Wye 10 psi</div>
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

        // Main bar shows Wye loss chip instead of NP
        drawHoseBar(document.getElementById(`viz_main_${key}`), splitIntoSections(L.itemsMain), bflow, 0, `Main ${sumFt(L.itemsMain)}′ @ ${bflow} gpm`, `Wye 10`);
        drawHoseBar(document.getElementById(`viz_L_${key}`), splitIntoSections(L.itemsLeft), L.nozLeft?.gpm||0, L.nozLeft?.NP||0, `Branch A ${sumFt(L.itemsLeft)||0}′`);
        drawHoseBar(document.getElementById(`viz_R_${key}`), splitIntoSections(L.itemsRight), L.nozRight?.gpm||0, L.nozRight?.NP||0, `Branch B ${sumFt(L.itemsRight)||0}′`);

        document.getElementById(`pp_simple_${key}`).innerHTML = `
          <div><b>Simple PP (Two branches via wye):</b>
            <ul class="simpleList">
              <li><b>Nozzle Pressure</b> = ${fmt(activeNozzle(L)?.NP||0)} psi</li>
              <li><b>Friction Loss (Main)</b> = ${mainSecs.length ? mainParts.join(' + ') : 0} = <b>${fmt(mainSum)} psi</b></li>
              <li><b>Friction Loss (Branches)</b> = max(${fmt(splitIntoSections(L.itemsLeft).map(s=>FL(L.nozLeft?.gpm||0, s.size, s.lengthFt)).reduce((a,c)=>a+c,0))}, ${fmt(splitIntoSections(L.itemsRight).map(s=>FL(L.nozRight?.gpm||0, s.size, s.lengthFt)).reduce((a,c)=>a+c,0))})</li>
              <li><b>Wye</b> = +10 psi</li>
              <li><b>Elevation</b> = ${elevStr}</li>
            </ul>
            <div style="margin-top:6px"><b>PP = NP + Main FL + max(Branch FL) + Wye ± Elev = <span class="pill">${fmt(total)} psi</span></b></div>
          </div>
        `;
      }
    });

    // place editable tips after drawing
    G_tips.querySelectorAll('.hose-end').forEach(el=>{
      el.addEventListener('click', ()=>{
        const key = el.getAttribute('data-line');
        const where = el.getAttribute('data-where');
        openTipEditor(key, where);
      });
    });
  }

  function fmt(n){ return Math.round(n); }
  function fmtSegLabel(ft, size){ return `${ft}′ of ${sizeLabel(size)}`; }

  // ===== tip editor =====
  let currentViewH = TRUCK_H;
  const tipEditor = container.querySelector('#tipEditor');
  const teCancel = tipEditor.querySelector('#teCancel');
  const teApply = tipEditor.querySelector('#teApply');

  function openTipEditor(key, where){
    const L = seedDefaultsForKey(key);
    tipEditor.classList.remove('is-hidden');
    tipEditor.querySelector('#teTitle').textContent = `Edit ${key==='left'?'Line 1':key==='back'?'Line 2':'Line 3'} (${where==='R'?'Nozzle':'Branch'})`;
    tipEditor.querySelector('#teWhere').value = where==='R'?'Nozzle': where==='L'?'Branch A':'Branch B';

    const sizeSel = tipEditor.querySelector('#teSize');
    sizeSel.value = (where==='R' ? (L.itemsMain?.[0]?.size || '1.75') : (where==='L' ? (L.itemsLeft?.[0]?.size || '1.75') : (L.itemsRight?.[0]?.size || '1.75')));

    const nozSel = tipEditor.querySelector('#teNoz');
    nozSel.innerHTML = NOZ_LIST.map(k=>`<option value="${k}">${NOZ[k].label}</option>`).join('');
    nozSel.value = (where==='R' ? (L.nozRight?._k || NOZ_LIST[0]) : (where==='L' ? (L.nozLeft?._k || NOZ_LIST[0]) : (L.nozRight?._k || NOZ_LIST[0])));

    tipEditor.style.top = (truckTopY(currentViewH) + 8) + 'px';

    // init lengths/elev
    tipEditor.querySelector('#teLen').value = sumFt(L.itemsMain) || 200;
    tipEditor.querySelector('#teElev').value = L.elevFt || 0;
    tipEditor.querySelector('#teWye').value = L.hasWye ? 'on' : 'off';

    // Branch block
    const bb = tipEditor.querySelector('#branchBlock');
    bb.classList.toggle('is-hidden', where==='R');
    if(where!=='R'){
      tipEditor.querySelector('#teLenA').value = sumFt(L.itemsLeft) || 100;
      tipEditor.querySelector('#teLenB').value = sumFt(L.itemsRight) || 100;

      const nozSelA = tipEditor.querySelector('#teNozA');
      const nozSelB = tipEditor.querySelector('#teNozB');
      nozSelA.innerHTML = NOZ_LIST.map(k=>`<option value="${k}">${NOZ[k].label}</option>`).join('');
      nozSelB.innerHTML = NOZ_LIST.map(k=>`<option value="${k}">${NOZ[k].label}</option>`).join('');
      nozSelA.value = (L.nozLeft?._k || NOZ_LIST[0]);
      nozSelB.value = (L.nozRight?._k || NOZ_LIST[0]);
    }
  }

  teCancel.addEventListener('click', ()=> tipEditor.classList.add('is-hidden'));
  teApply.addEventListener('click', ()=>{
    const where = tipEditor.querySelector('#teWhere').value.startsWith('Nozzle') ? 'R' : (tipEditor.querySelector('#teWhere').value.includes('A') ? 'L' : 'R');
    const key = Array.from(document.querySelectorAll('.hose-end')).find(el=>el.classList.contains('selected'))?.getAttribute('data-line') || 'left';

    const size = tipEditor.querySelector('#teSize').value;
    const len = Number(tipEditor.querySelector('#teLen').value || 0);
    const elev = Number(tipEditor.querySelector('#teElev').value || 0);
    const nozKey = tipEditor.querySelector('#teNoz').value;
    const wyeOn = tipEditor.querySelector('#teWye').value === 'on';

    const L = seedDefaultsForKey(key);
    L.itemsMain = len? [{size, lengthFt:len}] : [];
    L.elevFt = elev;
    const noz = NOZ[nozKey];

    if(where==='R'){
      L.hasWye = wyeOn || false; L.nozRight = noz;
      if(wyeOn){
        L.itemsLeft = L.itemsLeft?.length? L.itemsLeft : [{size, lengthFt:Number(tipEditor.querySelector('#teLenA').value||0)}];
        L.itemsRight = L.itemsRight?.length? L.itemsRight : [{size, lengthFt:Number(tipEditor.querySelector('#teLenB').value||0)}];
        L.nozLeft = NOZ[tipEditor.querySelector('#teNozA').value] || L.nozLeft;
        L.nozRight = NOZ[tipEditor.querySelector('#teNozB').value] || L.nozRight;
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

  // Supply toggle
  container.querySelector('#supplyBtn').addEventListener('click', ()=>{
    const order = ['none','pressurized','drafting','relay'];
    state.supply = order[(order.indexOf(state.supply)+1)%order.length];
    drawAll();
  });

  // Hydrant helper visibility synced to supply mode
  function updateHydrantHelper(){
    const helper = container.querySelector('#hydrantHelper');
    if(!helper) return;
    const isHydrant = (state.supply === 'pressurized' || state.supply === 'hydrant');
    helper.style.display = isHydrant ? 'block' : 'none';
  }
  updateHydrantHelper();

  // Hydrant %Drop calculation
  const hydrantLineSize = container.querySelector('#hydrantLineSize');
  const hydrantStatic   = container.querySelector('#hydrantStatic');
  const hydrantResidual = container.querySelector('#hydrantResidual');
  const hydrantCalcBtn  = container.querySelector('#hydrantCalcBtn');
  const hydrantResult   = container.querySelector('#hydrantResult');

  function toNum(v){ const n=Number(v); return isFinite(n)?n:NaN; }
  function sizePretty(v){ return v==='1.75'?'1¾″':(v==='2.5'?'2½″':v==='5'?'5″':''); }

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

  // Ensure helper visibility changes when supply mode cycles
  const origSupplyHandler = container.querySelector('#supplyBtn').onclick;
  container.querySelector('#supplyBtn').addEventListener('click', ()=>{
    updateHydrantHelper();
  }, { capture:false });

  // Presets sheet
  const sheet = container.querySelector('#sheet'), sheetBackdrop = container.querySelector('#sheetBackdrop');
  function openSheet(){ sheet.classList.add('show'); sheetBackdrop.style.display='block'; }
  function closeSheet(){ sheet.classList.remove('show'); sheetBackdrop.style.display='none'; selectedLine=null; container.querySelector('#sheetApply').disabled=true; }

  container.querySelector('#presetsBtn').addEventListener('click', openSheet);
  container.querySelector('#sheetClose').addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', closeSheet);

  // choose preset
  let selectedPreset=null, selectedLine=null;
  container.querySelectorAll('#presetGrid .preset').forEach(el=>{
    el.addEventListener('click', ()=>{
      container.querySelectorAll('#presetGrid .preset').forEach(n=>n.classList.remove('on'));
      el.classList.add('on'); selectedPreset = el.dataset.preset;
      maybeEnableApply();
    });
  });
  container.querySelectorAll('.linepick .preset').forEach(el=>{
    el.addEventListener('click', ()=>{
      container.querySelectorAll('.linepick .preset').forEach(n=>n.classList.remove('on'));
      el.classList.add('on'); selectedLine = el.dataset.applyline;
      maybeEnableApply();
    });
  });
  function maybeEnableApply(){
    container.querySelector('#sheetApply').disabled = !(selectedPreset && selectedLine);
  }

  container.querySelector('#sheetApply').addEventListener('click', ()=>{
    if(!selectedPreset || !selectedLine) return;
    const L = seedDefaultsForKey(selectedLine);
    // simple examples: fill out L per preset key
    if(selectedPreset==='standpipe'){
      L.itemsMain = [{size:'2.5', lengthFt:150}];
      L.nozRight = NOZ['chief185']; L.elevFt = 50; // example
    } else if(selectedPreset==='sprinkler'){
      L.itemsMain = [{size:'2.5', lengthFt:100}];
      L.nozRight = NOZ['fog200']; L.elevFt = 0;
    } else if(selectedPreset==='foam'){
      L.itemsMain = [{size:'1.75', lengthFt:200}];
      L.nozRight = NOZ['fog150']; L.elevFt = 0;
    } else if(selectedPreset==='monitor'){
      L.itemsMain = [{size:'2.5', lengthFt:150}];
      L.nozRight = NOZ['msb1250']; L.elevFt = 0;
    } else if(selectedPreset==='aerial'){
      L.itemsMain = [{size:'5', lengthFt:200}];
      L.nozRight = NOZ['msb1000']; L.elevFt = 80;
    }
    L.visible = true;
    closeSheet();
    drawAll();
  });

  // WHY scroll
  container.querySelector('#whyBtn').addEventListener('click', ()=>{
    const linesTable = container.querySelector('#linesTable');
    if(linesTable.classList.contains('is-hidden')) return;
    // flash first detail
    const target = linesTable.querySelector('.math details');
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
