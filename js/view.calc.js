// view.calc.js
// Uses past-file line math (ppExplainHTML, segmented bars) and keeps water-supply in waterSupply.js.
// Color coding: 1¾″ = red, 2½″ = blue, 5″ = yellow.
// Defaults: L1 & L2: 200′ of 1¾″ @ 185 gpm / 50 psi; L3: 250′ of 2½″ @ 265 gpm / 50 psi.

import {
  state, NOZ, NOZ_LIST, COLORS,
  FL, FL_total, sumFt, splitIntoSections, PSI_PER_FT,
  seedDefaultsForKey, isSingleWye, activeNozzle, activeSide, sizeLabel
} from './store.js';
import { WaterSupplyUI } from './waterSupply.js';

const TRUCK_W=390, TRUCK_H=260, PX_PER_50FT=45, CURVE_PULL=36, BRANCH_LIFT=10;

function findNozzleBy(targetGpm, targetNP){
  if(!NOZ_LIST?.length) return null;
  let best=null, bestErr=Infinity;
  for(const n of NOZ_LIST){
    const dg = Math.abs((n.gpm||0) - targetGpm);
    const dn = Math.abs((n.NP||0) - targetNP);
    const err = dg*1.0 + dn*2.0;
    if(err < bestErr){ best=n; bestErr=err; }
  }
  return best;
}

export async function render(container){
  container.innerHTML = `
    <section class="stack">
      <section class="wrapper card">
        <div class="stage" id="stage">
          <svg id="overlay" viewBox="0 0 390 260" preserveAspectRatio="xMidYMax meet" aria-label="Visual stage">
            <image id="truckImg" href="/assets/images/engine181.png" x="0" y="0" width="390" height="260" preserveAspectRatio="xMidYMax meet"></image>
            <g id="hoses"></g><g id="branches"></g><g id="labels"></g><g id="tips"></g><g id="supplyG"></g>
          </svg>

          <!-- Tip editor -->
          <div id="tipEditor" class="tip-editor is-hidden" role="dialog" aria-modal="true"
               style="position:absolute; z-index:4; left:8px; top:8px; max-width:320px;">
            <div class="mini" id="teTitle" style="margin-bottom:6px;opacity:.9">Edit Line</div>
            <div class="te-row"><label>Line</label><input id="teWhere" readonly></div>
            <div class="te-row"><label>Diameter</label>
              <select id="teSize">
                <option value="1.75">1¾″</option>
                <option value="2.5">2½″</option>
                <option value="5">5″</option>
              </select>
            </div>
            <div class="te-row"><label>Main Length (ft)</label><input type="number" id="teLen" min="0" step="25"></div>
            <div class="te-row"><label>Elevation (ft)</label><input type="number" id="teElev" step="5"></div>
            <div class="te-row"><label>Wye</label>
              <select id="teWye"><option value="off">Off</option><option value="on">On</option></select>
            </div>
            <div id="branchBlock" class="is-hidden">
              <div class="te-row"><label>Branch L len</label><input type="number" id="teLenA" min="0" step="25"></div>
              <div class="te-row"><label>Branch L nozzle</label><select id="teNozA"></select></div>
              <div class="te-row"><label>Branch R len</label><input type="number" id="teLenB" min="0" step="25"></div>
              <div class="te-row"><label>Branch R nozzle</label><select id="teNozB"></select></div>
            </div>
            <div class="te-row"><label>Nozzle (single)</label><select id="teNoz"></select></div>
            <div class="te-actions" style="display:flex;gap:8px;margin-top:6px">
              <button class="btn" id="teCancel" type="button">Cancel</button>
              <button class="btn primary" id="teApply" type="button">Apply</button>
            </div>
          </div>

          <div class="info" id="topInfo">No lines deployed</div>
          <div class="linebar">
            <button class="linebtn" data-line="left"  type="button" aria-pressed="true">Line 1</button>
            <button class="linebtn" data-line="back"  type="button" aria-pressed="true">Line 2</button>
            <button class="linebtn" data-line="right" type="button" aria-pressed="false">Line 3</button>
            <button class="supplybtn" id="supplyBtn" type="button">Supply</button>
            <button class="presetsbtn" id="presetsBtn" type="button">Presets</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="kpis">
          <div class="kpi"><div>Total Flow</div><b id="GPM">— gpm</b></div>
          <div class="kpi"><div>Max PP</div><b id="PDP">— psi</b><button id="whyBtn" class="whyBtn" type="button">Why?</button></div>
        </div>

        <div class="linesTable is-hidden" id="linesTable"></div>
      </section>
    </section>

    <!-- Preset bottom sheet -->
    <div id="sheet" class="sheet" aria-modal="true" role="dialog">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="title">Presets</div>
        <button class="btn" id="sheetClose" type="button">Close</button>
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
      <div class="te-actions"><button class="btn primary" id="sheetApply" type="button" disabled>Apply Preset</button></div>
    </div>
    <div id="sheetBackdrop" class="sheet-backdrop"></div>
  `;

  // ---------- styles ----------
  injectStyle(container, `
    .sheet.open{transform:translateY(0)}
    #presetGrid .preset.selected, #linePick .preset.selected{outline:2px solid var(--accent,#6ecbff);border-radius:10px}

    /* Hose colors (requested): red 1¾″, blue 2½″, yellow 5″ */
    .hose175{stroke:#ff4a4a;stroke-width:10;fill:none;stroke-linecap:round}
    .hose25{stroke:#2e7dff;stroke-width:12;fill:none;stroke-linecap:round}
    .hose5{stroke:#ffd84a;stroke-width:16;fill:none;stroke-linecap:round}
    .branch{stroke-width:8}
    .lbl{fill:#0b0f14;font-size:12px}

    /* Deployed look for buttons */
    .linebtn{border:1px solid rgba(255,255,255,.25);background:#0f1723;color:#e8f1ff;padding:6px 10px;border-radius:10px}
    .linebtn[aria-pressed="true"]{background:#173252;border-color:#6ecbff;box-shadow:0 0 0 2px rgba(110,203,255,.25) inset}

    /* Lines table / math panel (from past file) */
    .linesTable{margin-top:10px}
    .lineRow{border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px;margin:8px 0;background:#0f1723;color:#dfe9ff}
    .lineHeader{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:6px}
    .lineHeader .title{font-weight:800}
    .lineHeader .tag{font-size:12px;opacity:.9;background:#10233b;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:2px 6px}
    .hoseLegend{font-size:12px;color:#cfe4ff;display:flex;gap:10px;margin-bottom:4px}
    .legSwatch{display:inline-block;width:18px;height:8px;border-radius:4px;vertical-align:middle;margin-right:4px;border:1px solid rgba(0,0,0,.35)}
    .sw175{background:#ff4a4a}.sw25{background:#2e7dff}.sw5{background:#ffd84a}
    .barWrap{margin:6px 0}
    .barTitle{font-size:12px;color:#a9bed9;margin-bottom:2px}
    .simpleBox{margin-top:6px;font-size:13px}
    .flash{animation:hl 1.2s ease 1}
    @keyframes hl{0%{box-shadow:0 0 0 0 rgba(110,203,255,.0)}40%{box-shadow:0 0 0 3px rgba(110,203,255,.35)}100%{box-shadow:0 0 0 0 rgba(110,203,255,.0)}}
  `);

  // ---------- refs ----------
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
  const linesTable= container.querySelector('#linesTable');
  const whyBtn    = container.querySelector('#whyBtn');

  // ---------- image fallback ----------
  (function fixTruckImageNS(){
    const XLINK = 'http://www.w3.org/1999/xlink';
    const url = truckImg.getAttribute('href') || truckImg.getAttribute('xlink:href') || '/assets/images/engine181.png';
    truckImg.setAttribute('href', url);
    truckImg.setAttributeNS(XLINK, 'xlink:href', url);
    truckImg.addEventListener('error', () => {
      const fallback = 'https://fireopssim.com/pump/engine181.png';
      truckImg.setAttribute('href', fallback);
      truckImg.setAttributeNS(XLINK, 'xlink:href', fallback);
    }, { once:true });
  })();

  // ---------- helpers ----------
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
  function addLabel(text, x, y){
    const ns='http://www.w3.org/2000/svg', pad=3;
    const g = document.createElementNS(ns,'g');
    const t = document.createElementNS(ns,'text'); t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('text-anchor','middle'); t.setAttribute('fill','#0b0f14'); t.textContent = text;
    g.appendChild(t); G_labels.appendChild(g);
    const bb = t.getBBox();
    const bg = document.createElementNS(ns,'rect');
    bg.setAttribute('x', bb.x - pad); bg.setAttribute('y', bb.y - pad);
    bg.setAttribute('width', bb.width + pad*2); bg.setAttribute('height', bb.height + pad*2);
    bg.setAttribute('fill', '#eaf2ff'); bg.setAttribute('opacity', '0.92'); bg.setAttribute('stroke', '#111'); bg.setAttribute('stroke-width', '.5'); bg.setAttribute('rx','4'); bg.setAttribute('ry','4');
    g.insertBefore(bg, t);
  }

  // ---------- DEFAULTS ----------
  if(!state.lines){
    const noz185_50 = findNozzleBy(185,50) || NOZ.fog150_75 || NOZ_LIST?.[0];
    const noz265_50 = findNozzleBy(265,50) || NOZ.sb1_1_8 || NOZ_LIST?.[0];
    state.lines = {
      left:  { label:'Line 1', visible:true,  itemsMain:[{size:'1.75', lengthFt:200}], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:noz185_50 },
      back:  { label:'Line 2', visible:true,  itemsMain:[{size:'1.75', lengthFt:200}], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:noz185_50 },
      right: { label:'Line 3', visible:false, itemsMain:[{size:'2.5',  lengthFt:250}], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:noz265_50 },
    };
  }
  if(!state.supply) state.supply = 'pressurized';

  // ---------- init water-supply module (delegated) ----------
  const waterSupply = new WaterSupplyUI({ container, state, pumpXY, truckTopY, G_supply, TRUCK_H });

  // ---------- PRESETS ----------
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
      case 'foam':      L.itemsMain=[{size:'1.75', lengthFt:200}]; L.nozRight=findNozzleBy(185,50)||L.nozRight;  L.hasWye=false; L.elevFt=0; break;
      case 'monitor':   L.itemsMain=[{size:'2.5', lengthFt:200}];  L.nozRight=findNozzleBy(265,50)||L.nozRight;  L.hasWye=false; L.elevFt=0; break;
      case 'aerial':    state.supply='pressurized'; L.itemsMain=[{size:'2.5', lengthFt:150}]; L.nozRight=findNozzleBy(265,50)||L.nozRight; L.hasWye=false; L.elevFt=80; break;
    }
    drawAll();
  }

  // ---------- TIP “+” EDITOR ----------
  const tipEditor = container.querySelector('#tipEditor');
  const teTitle = container.querySelector('#teTitle');
  const teWhere = container.querySelector('#teWhere');
  const teSize  = container.querySelector('#teSize');
  const teLen   = container.querySelector('#teLen');
  const teElev  = container.querySelector('#teElev');
  const teWye   = container.querySelector('#teWye');
  const teLenA  = container.querySelector('#teLenA');
  const teLenB  = container.querySelector('#teLenB');
  const teNoz   = container.querySelector('#teNoz');
  const teNozA  = container.querySelector('#teNozA');
  const teNozB  = container.querySelector('#teNozB');
  const branchBlock = container.querySelector('#branchBlock');

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

    const newMainLen = Math.max(0, Number(teLen.value)||0);
    const newSize    = teSize.value || (L.itemsMain?.[0]?.size || '2.5');
    L.itemsMain = newMainLen ? [{ size:newSize, lengthFt:newMainLen }] : [];
    L.elevFt = Number(teElev.value)||0;

    const wantWye = (teWye.value === 'on');
    L.hasWye = wantWye;
    if(wantWye){
      const lLen = Math.max(0, Number(teLenA.value)||0);
      const rLen = Math.max(0, Number(teLenB.value)||0);
      L.itemsLeft  = lLen ? [{ size:newSize, lengthFt:lLen }] : [];
      L.itemsRight = rLen ? [{ size:newSize, lengthFt:rLen }] : [];
      const nzA = NOZ_LIST.find(n => n.id === teNozA.value) || L.nozLeft || NOZ_LIST?.[0];
      const nzB = NOZ_LIST.find(n => n.id === teNozB.value) || L.nozRight || NOZ_LIST?.[0];
      L.nozLeft  = nzA;
      L.nozRight = nzB;
      L.wyeLoss = L.wyeLoss || 10;
    } else {
      L.itemsLeft=[]; L.itemsRight=[];
      const nz = NOZ_LIST.find(n => n.id === teNoz.value) || L.nozRight || NOZ_LIST?.[0];
      L.nozRight = nz;
    }

    closeEditor();
    drawAll();
  });

  G_tips.addEventListener('click', (e)=>{
    const g = e.target.closest('.hose-end'); if(!g) return;
    openEditor({ key: g.getAttribute('data-line'), where: g.getAttribute('data-where') });
  });

  // ---------- LINE BUTTONS ----------
  const lineBtns = Array.from(container.querySelectorAll('.linebtn'));
  function syncLineButtons(){
    lineBtns.forEach(btn=>{
      const key = btn.getAttribute('data-line');
      btn.setAttribute('aria-pressed', String(!!state.lines[key]?.visible));
    });
  }
  lineBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = btn.getAttribute('data-line');
      const L = state.lines[key];
      if(!L) return;
      L.visible = !L.visible;
      syncLineButtons();
      drawAll();
    });
  });

  // ---------- SUPPLY cycle ----------
  container.querySelector('#supplyBtn').addEventListener('click', ()=>{
    if(state.supply==='pressurized') state.supply='static';
    else if(state.supply==='static') state.supply='relay';
    else state.supply='pressurized';
    drawAll();
  });

  // ---------- DRAW ----------
  function drawAll(){
    const viewH = Math.ceil(computeNeededHeightPx());
    overlay.setAttribute('viewBox', `0 0 ${TRUCK_W} ${viewH}`);
    stage.style.height = viewH + 'px';
    truckImg.setAttribute('y', String(truckTopY(viewH)));

    clearGroup(G_hoses); clearGroup(G_branches); clearGroup(G_tips); clearGroup(G_labels); clearGroup(G_supply);

    // Supply (delegated)
    waterSupply.draw(viewH);
    waterSupply.updatePanelsVisibility?.();

    // Lines
    const visibleKeys = ['left','back','right'].filter(k=>state.lines[k]?.visible);
    visibleKeys.forEach(key=>{
      const L = state.lines[key]; const dir = key==='left'?-1:key==='right'?1:0;
      const mainFt = sumFt(L.itemsMain||[]);
      const geom = mainCurve(dir, (mainFt/50)*PX_PER_50FT, viewH);

      const mainSize = L.itemsMain?.[0]?.size || '2.5';
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d', geom.d);
      path.setAttribute('class', mainSize==='1.75'?'hose175':(mainSize==='5'?'hose5':'hose25'));
      G_hoses.appendChild(path);

      addTip(key,'main',geom.endX,geom.endY);

      const single = isSingleWye(L);
      const usedNoz = single ? activeNozzle(L) : L.hasWye ? null : L.nozRight;
      const flowGpm = single ? (usedNoz?.gpm||0) : (L.hasWye ? ((L.nozLeft?.gpm||0)+(L.nozRight?.gpm||0)) : (L.nozRight?.gpm||0));
      const npText  = usedNoz ? `NP ${usedNoz.NP}` : (L.hasWye ? 'Wye' : `NP ${L.nozRight?.NP||0}`);
      addLabel(`${mainFt}′ @ ${flowGpm} gpm — ${npText}`, geom.endX, Math.max(12, geom.endY-8));

      if(L.hasWye){
        if(sumFt(L.itemsLeft)>0){
          const gL = straightBranch('L', geom.endX, geom.endY, (sumFt(L.itemsLeft)/50)*PX_PER_50FT);
          const pL = document.createElementNS('http://www.w3.org/2000/svg','path');
          pL.setAttribute('d', gL.d);
          const sizeL = L.itemsLeft?.[0]?.size || mainSize;
          pL.setAttribute('class', (sizeL==='1.75'?'hose175':(sizeL==='5'?'hose5':'hose25')) + ' branch');
          G_branches.appendChild(pL);
          addTip(key,'L',gL.endX,gL.endY);
        } else addTip(key,'L',geom.endX-20,geom.endY-20);

        if(sumFt(L.itemsRight)>0){
          const gR = straightBranch('R', geom.endX, geom.endY, (sumFt(L.itemsRight)/50)*PX_PER_50FT);
          const pR = document.createElementNS('http://www.w3.org/2000/svg','path');
          pR.setAttribute('d', gR.d);
          const sizeR = L.itemsRight?.[0]?.size || mainSize;
          pR.setAttribute('class', (sizeR==='1.75'?'hose175':(sizeR==='5'?'hose5':'hose25')) + ' branch');
          G_branches.appendChild(pR);
          addTip(key,'R',gR.endX,gR.endY);
        } else addTip(key,'R',geom.endX+20,geom.endY-20);
      }
    });

    topInfo.textContent = visibleKeys.length
      ? ('Deployed: '+visibleKeys.map(k=>state.lines[k].label || ({left:'Line 1',back:'Line 2',right:'Line 3'}[k])).join(' • '))
      : 'No lines deployed';

    refreshTotals();
    syncLineButtons();
    if(state.showMath) renderLinesPanel(); else linesTable.classList.add('is-hidden');
  }

  // ---------- TOTALS ----------
  function refreshTotals(){
    const vis = Object.entries(state.lines||{}).filter(([_k,l])=>l.visible);
    let totalGPM = 0, maxPDP = -Infinity, maxKey = null;
    vis.forEach(([key, L])=>{
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
      if(PDP > maxPDP){ maxPDP = PDP; maxKey = key; }
    });

    GPMel.textContent = vis.length? (Math.round(totalGPM)+' gpm') : '— gpm';
    PDPel.textContent = vis.length? (Math.round(maxPDP)+' psi') : '— psi';
    state.lastMaxKey = maxKey;
  }

  // ---------- WHY? MATH PANEL (from past file) ----------
  function fmt(n){ return Math.round(n); }
  function fmtSegLabel(lenFt, size){ return `${lenFt}′ ${sizeLabel(size)}`; }

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

  function ppExplainHTML(L){
    const single = isSingleWye(L);
    const side = activeSide(L);
    const flow = single ? (activeNozzle(L)?.gpm||0)
               : L.hasWye ? (L.nozLeft?.gpm||0)+(L.nozRight?.gpm||0)
                          : (L.nozRight?.gpm||0);
    const mainSecs = splitIntoSections(L.itemsMain||[]);
    const mainFLs = mainSecs.map(s => FL(flow, s.size, s.lengthFt));
    const mainParts = mainSecs.map((s,i)=>`${fmt(mainFLs[i])} (${fmtSegLabel(s.lengthFt, s.size)})`);
    const mainSum = mainFLs.reduce((a,c)=>a+c,0);
    const elevPsi = (L.elevFt||0) * PSI_PER_FT;
    const elevStr = `${elevPsi>=0? '+':''}${fmt(elevPsi)} psi`;

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
      const brSecs = splitIntoSections(side==='L'?(L.itemsLeft||[]):(L.itemsRight||[]));
      const brFLs  = brSecs.map(s => FL(noz?.gpm||0, s.size, s.lengthFt));
      const brParts= brSecs.map((s,i)=>`${fmt(brFLs[i])} (${fmtSegLabel(s.lengthFt, s.size)})`);
      const brSum  = brFLs.reduce((x,y)=>x+y,0);
      const total  = (noz?.NP||0) + brSum + mainSum + elevPsi;
      return `
        <div><b>Simple PP (Single branch via wye):</b>
          <ul class="simpleList">
            <li><b>Nozzle Pressure</b> = ${fmt(noz?.NP||0)} psi</li>
            <li><b>Branch FL</b> = ${brSecs.length ? brParts.join(' + ') : 0} = <b>${fmt(brSum)} psi</b></li>
            <li><b>Main FL</b> = ${mainSecs.length ? mainParts.join(' + ') : 0} = <b>${fmt(mainSum)} psi</b></li>
            <li><b>Elevation</b> = ${elevStr}</li>
          </ul>
          <div style="margin-top:6px"><b>PP = NP + Branch FL + Main FL ± Elev = ${fmt(noz?.NP||0)} + ${fmt(brSum)} + ${fmt(mainSum)} ${elevStr} = <span style="color:var(--ok)">${fmt(total)} psi</span></b></div>
        </div>
      `;
    } else {
      const aSecs = splitIntoSections(L.itemsLeft||[]);
      const bSecs = splitIntoSections(L.itemsRight||[]);
      const aFLs = aSecs.map(s => FL(L.nozLeft?.gpm||0, s.size, s.lengthFt));
      const bFLs = bSecs.map(s => FL(L.nozRight?.gpm||0, s.size, s.lengthFt));
      const aNeed = (L.nozLeft?.NP||0) + aFLs.reduce((x,y)=>x+y,0);
      const bNeed = (L.nozRight?.NP||0)+ bFLs.reduce((x,y)=>x+y,0);
      const maxNeed = Math.max(aNeed, bNeed);
      const wyeLoss = L.wyeLoss||10;
      const total = maxNeed + mainSum + wyeLoss + elevPsi;
      return `
        <div><b>Simple PP (Wye):</b>
          <ul class="simpleList">
            <li><b>Branch A need</b> = ${Math.round(aNeed)} psi</li>
            <li><b>Branch B need</b> = ${Math.round(bNeed)} psi</li>
            <li><b>Take the higher branch</b> = <b>${Math.round(maxNeed)} psi</b></li>
            <li><b>Main FL</b> = ${mainSecs.length ? mainParts.join(' + ') : 0} = <b>${fmt(mainSum)} psi</b></li>
            ${wyeLoss? `<li><b>Wye loss</b> = +${wyeLoss} psi</li>` : ``}
            <li><b>Elevation</b> = ${elevStr}</li>
          </ul>
          <div style="margin-top:6px"><b>PP = max(A,B) + Main FL ${wyeLoss?`+ Wye`:``} ± Elev = ${fmt(maxNeed)} + ${fmt(mainSum)} ${wyeLoss?`+ ${fmt(wyeLoss)} `:``}${elevStr} = <span style="color:var(--ok)">${fmt(total)} psi</span></b></div>
        </div>
      `;
    }
  }

  function renderLinesPanel(){
    const anyDeployed = Object.values(state.lines||{}).some(l=>l.visible);
    if(!anyDeployed || !state.showMath){ linesTable.innerHTML=''; linesTable.classList.add('is-hidden'); return; }
    linesTable.classList.remove('is-hidden'); linesTable.innerHTML='';

    ['left','back','right'].forEach(key=>{
      const L = state.lines[key];
      const row = document.createElement('div'); row.className='lineRow';
      const segs = L.itemsMain?.length ? L.itemsMain.map(s=>`${s.lengthFt}′ ${sizeLabel(s.size)}`).join(' + ') : 'empty';
      const single = isSingleWye(L);
      const usedNoz = single ? activeNozzle(L) : L.nozRight;
      const flow = single ? (usedNoz?.gpm||0) : (L.hasWye ? ((L.nozLeft?.gpm||0) + (L.nozRight?.gpm||0)) : (L.nozRight?.gpm||0));

      const head = document.createElement('div'); head.className='lineHeader'; head.innerHTML = `
        <span class="title">${L.label}</span>
        <span class="tag">Main: ${sumFt(L.itemsMain||[])}′ (${segs})</span>
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
                  <div class="barTitle">Main ${sumFt(L.itemsMain||[])}′ @ ${bflow} gpm — Wye ${wye} psi</div>
                  <div class="hosebar" id="viz_main_${key}"></div>
                </div>
                <div class="barWrap">
                  <div class="barTitle">Branch A ${sumFt(L.itemsLeft||[])||0}′ @ ${L.nozLeft?.gpm||0} gpm — NP ${L.nozLeft?.NP||0} psi</div>
                  <div class="hosebar" id="viz_L_${key}"></div>
                </div>
                <div class="barWrap">
                  <div class="barTitle">Branch B ${sumFt(L.itemsRight||[])||0}′ @ ${L.nozRight?.gpm||0} gpm — NP ${L.nozRight?.NP||0} psi</div>
                  <div class="hosebar" id="viz_R_${key}"></div>
                </div>
                <div class="simpleBox" id="pp_simple_${key}"></div>
              </div>
            </details>
          `;
          linesTable.appendChild(mathWrap);

          drawHoseBar(document.getElementById(`viz_main_${key}`), splitIntoSections(L.itemsMain||[]), bflow, (L.nozRight?.NP||0), `Main ${sumFt(L.itemsMain||[])}′ @ ${bflow} gpm`, `Wye ${wye}`);
          drawHoseBar(document.getElementById(`viz_L_${key}`), splitIntoSections(L.itemsLeft||[]), L.nozLeft?.gpm||0, L.nozLeft?.NP||0, `Branch A ${sumFt(L.itemsLeft||[])||0}′`);
          drawHoseBar(document.getElementById(`viz_R_${key}`), splitIntoSections(L.itemsRight||[]), L.nozRight?.gpm||0, L.nozRight?.NP||0, `Branch B ${sumFt(L.itemsRight||[])||0}′`);
          document.getElementById(`pp_simple_${key}`).innerHTML = ppExplainHTML(L);

        } else if(single){
          const side = activeSide(L);
          const bnSegs = side==='L'? (L.itemsLeft||[]) : (L.itemsRight||[]);
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
                  <div class="barTitle">Main ${sumFt(L.itemsMain||[])}′ @ ${bflow} gpm — NP ${noz?.NP||0} psi</div>
                  <div class="hosebar" id="viz_main_${key}"></div>
                </div>
                <div class="barWrap">
                  <div class="barTitle">${bnTitle} ${sumFt(bnSegs)||0}′ @ ${noz?.gpm||0} gpm</div>
                  <div class="hosebar" id="viz_BR_${key}"></div>
                </div>
                <div class="simpleBox" id="pp_simple_${key}"></div>
              </div>
            </details>
          `;
          linesTable.appendChild(mathWrap);

          drawHoseBar(document.getElementById(`viz_main_${key}`), splitIntoSections(L.itemsMain||[]), bflow, (noz?.NP||0), `Main ${sumFt(L.itemsMain||[])}′ @ ${bflow} gpm`);
          drawHoseBar(document.getElementById(`viz_BR_${key}`), splitIntoSections(bn
