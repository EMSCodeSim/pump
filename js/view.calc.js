// view.calc.js
// Main calc & UI (lines, presets, drawing, tip “+” editor).
// Water-supply graphics & helper panels are delegated to waterSupply.js.

import {
  state, NOZ, NOZ_LIST,
  FL_total, sumFt, PSI_PER_FT,
  isSingleWye, activeNozzle, activeSide
} from './store.js';
import { WaterSupplyUI } from './waterSupply.js';

const TRUCK_W=390, TRUCK_H=260, PX_PER_50FT=45, CURVE_PULL=36, BRANCH_LIFT=10;

// -------- helpers to find a nozzle close to target specs (keeps your store.js data authoritative)
function findNozzleBy(targetGpm, targetNP){
  if(!NOZ_LIST?.length) return null;
  let best=null, bestErr=Infinity;
  for(const n of NOZ_LIST){
    const dg = Math.abs((n.gpm||0) - targetGpm);
    const dn = Math.abs((n.NP||0) - targetNP);
    const err = dg*1.0 + dn*2.0; // weight NP a bit more
    if(err < bestErr){ best=n; bestErr=err; }
  }
  return best;
}

export async function render(container){
  // ---------- DOM ----------
  container.innerHTML = `
    <section class="stack">
      <section class="wrapper card">
        <div class="stage" id="stage">
          <svg id="overlay" viewBox="0 0 390 260" preserveAspectRatio="xMidYMax meet" aria-label="Visual stage">
            <image id="truckImg" href="/assets/images/engine181.png" x="0" y="0" width="390" height="260" preserveAspectRatio="xMidYMax meet"></image>
            <g id="hoses"></g><g id="branches"></g><g id="labels"></g><g id="tips"></g><g id="supplyG"></g>
          </svg>

          <!-- Inline tip editor -->
          <div id="tipEditor" class="tip-editor is-hidden" role="dialog" aria-modal="true"
               style="position:absolute; z-index:4; left:8px; top:8px; max-width:320px;">
            <div class="mini" id="teTitle" style="margin-bottom:6px;opacity:.9">Edit Line</div>
            <div class="te-row"><label>Line</label><input id="teWhere" readonly></div>
            <div class="te-row">
              <label>Diameter</label>
              <select id="teSize">
                <option value="1.75">1¾″</option>
                <option value="2.5">2½″</option>
                <option value="5">5″</option>
              </select>
            </div>
            <div class="te-row"><label>Main Length (ft)</label><input type="number" id="teLen" min="0" step="25"></div>
            <div class="te-row"><label>Elevation (ft)</label><input type="number" id="teElev" step="5"></div>
            <div class="te-row">
              <label>Wye</label>
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

        <!-- HYDRANT %DROP (markup only; logic in waterSupply.js) -->
        <div id="hydrantHelper" class="helperPanel" style="display:none; margin-top:10px; background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
          <div style="color:#fff; font-weight:800; margin-bottom:6px">Hydrant Residual %Drop</div>
          <div class="mini" style="color:#a9bed9; margin-bottom:8px">
            0–10% → 3× • 11–15% → 2× • 16–25% → 1× • &gt;25% → 0×
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

        <!-- STATIC / DRAFTING: TENDER SHUTTLE (markup only; logic in waterSupply.js) -->
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

  // ---------- styles (restore deployed look + NEW color coding) ----------
  injectStyle(container, `
    .pill{display:inline-block;padding:4px 10px;border-radius:999px;background:#1a2738;color:#fff;border:1px solid rgba(255,255,255,.2);font-weight:800}
    .sheet.open{transform:translateY(0)}
    #presetGrid .preset.selected, #linePick .preset.selected{outline:2px solid var(--accent,#6ecbff);border-radius:10px}

    /* Hose colors (as requested) */
    .hose175{stroke:#ff4a4a;stroke-width:10;fill:none;stroke-linecap:round} /* red */
    .hose25{stroke:#2e7dff;stroke-width:12;fill:none;stroke-linecap:round}  /* blue */
    .hose5{stroke:#ffd84a;stroke-width:16;fill:none;stroke-linecap:round}   /* yellow */
    .branch{stroke-width:8}
    .lbl{fill:#0b0f14;font-size:12px}

    /* Deployed look for buttons */
    .linebtn{border:1px solid rgba(255,255,255,.25);background:#0f1723;color:#e8f1ff;padding:6px 10px;border-radius:10px}
    .linebtn[aria-pressed="true"]{background:#173252;border-color:#6ecbff;box-shadow:0 0 0 2px rgba(110,203,255,.25) inset}
    /* Lines table / math panel */
    .linesTable{margin-top:10px}
    .ppRow{border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px;margin:8px 0;background:#0f1723;color:#dfe9ff}
    .ppRow .hdr{font-weight:800;margin-bottom:6px}
    .ppRow .tiny{opacity:.9}
    .ppRow details{margin-top:6px}
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

  // ---------- firetruck image (href + xlink:href fallback) ----------
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

  // ---------- DEFAULTS (as requested)
  // Line 1: 200′ of 1¾″, 185 GPM @ 50 psi
  // Line 2: 200′ of 1¾″, 185 GPM @ 50 psi
  // Line 3: 250′ of 2½″, 265 GPM @ 50 psi
  if(!state.lines){
    const noz185_50 = findNozzleBy(185,50) || NOZ.fog95_50 || NOZ.fog150_75 || NOZ_LIST?.[0];
    const noz265_50 = findNozzleBy(265,50) || NOZ.sb1_1_8 || NOZ_LIST?.[0];
    state.lines = {
      left:  { label:'Line 1', visible:true,  itemsMain:[{size:'1.75', lengthFt:200}], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:noz185_50 },
      back:  { label:'Line 2', visible:true,  itemsMain:[{size:'1.75', lengthFt:200}], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:noz185_50 },
      right: { label:'Line 3', visible:false, itemsMain:[{size:'2.5',  lengthFt:250}], itemsLeft:[], itemsRight:[], hasWye:false, elevFt:0, nozRight:noz265_50 },
    };
  }
  if(!state.supply) state.supply = 'pressurized';

  // ---------- init water-supply (from working waterSupply.js) ----------
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
      case 'standpipe': L.itemsMain=[{size:'2.5', lengthFt:0}];   L.nozRight=findNozzleBy(150,75) || L.nozRight; L.hasWye=false; L.elevFt=60; break;
      case 'sprinkler': state.supply='pressurized'; L.itemsMain=[{size:'2.5', lengthFt:50}]; L.nozRight=findNozzleBy(150,75)||L.nozRight; L.hasWye=false; break;
      case 'foam':      L.itemsMain=[{size:'1.75', lengthFt:200}]; L.nozRight=findNozzleBy(185,50)||L.nozRight; L.hasWye=false; L.elevFt=0; break;
      case 'monitor':   L.itemsMain=[{size:'2.5', lengthFt:200}];  L.nozRight=findNozzleBy(265,50)||L.nozRight; L.hasWye=false; L.elevFt=0; break;
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
      const nzA = NOZ_LIST.find(n => n.id === teNozA.value) || L.nozLeft || findNozzleBy(185,50) || NOZ_LIST?.[0];
      const nzB = NOZ_LIST.find(n => n.id === teNozB.value) || L.nozRight || findNozzleBy(185,50) || NOZ_LIST?.[0];
      L.nozLeft  = nzA;
      L.nozRight = nzB;
      L.wyeLoss = L.wyeLoss || 10;
    } else {
      L.itemsLeft=[]; L.itemsRight=[];
      const nz = NOZ_LIST.find(n => n.id === teNoz.value) || L.nozRight || findNozzleBy(185,50) || NOZ_LIST?.[0];
      L.nozRight = nz;
    }

    closeEditor();
    drawAll();
  });

  // Click a "+" tip to open editor
  G_tips.addEventListener('click', (e)=>{
    const g = e.target.closest('.hose-end'); if(!g) return;
    openEditor({ key: g.getAttribute('data-line'), where: g.getAttribute('data-where') });
  });

  // ---------- LINE BUTTONS (deployed look) ----------
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

    // Clear
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

      // Main path w/ size-based color
      const mainSize = L.itemsMain?.[0]?.size || '2.5';
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d', geom.d);
      path.setAttribute('class', mainSize==='1.75'?'hose175':(mainSize==='5'?'hose5':'hose25'));
      G_hoses.appendChild(path);

      addTip(key,'main',geom.endX,geom.endY);

      // Label (flow + NP)
      const single = isSingleWye(L);
      const usedNoz = single ? activeNozzle(L) : L.hasWye ? null : L.nozRight;
      const flowGpm = single ? (usedNoz?.gpm||0) : (L.hasWye ? ((L.nozLeft?.gpm||0)+(L.nozRight?.gpm||0)) : (L.nozRight?.gpm||0));
      const npText  = usedNoz ? `NP ${usedNoz.NP}` : (L.hasWye ? 'Wye' : `NP ${L.nozRight?.NP||0}`);
      addLabel(`${mainFt}′ @ ${flowGpm} gpm — ${npText}`, geom.endX, Math.max(12, geom.endY-8));

      // Branches if wye
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
    syncLineButtons(); // keep button latch in sync if state changes elsewhere
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

  // ---------- WHY? MATH PANEL ----------
  function renderLinesPanel(){
    const keys = ['left','back','right'].filter(k=>state.lines[k]?.visible);
    if(!keys.length){ linesTable.classList.add('is-hidden'); linesTable.innerHTML=''; return; }

    let html = '';
    keys.forEach(k=>{
      const L = state.lines[k];
      const single = isSingleWye(L);
      const flow = single ? (activeNozzle(L)?.gpm||0)
                 : L.hasWye ? (L.nozLeft?.gpm||0) + (L.nozRight?.gpm||0)
                            : (L.nozRight?.gpm||0);
      const mainFL = FL_total(flow, L.itemsMain||[]);
      let PDP=0, rows=[];
      if(single){
        const side = activeSide(L);
        const bnSegs = side==='L' ? (L.itemsLeft||[]) : (L.itemsRight||[]);
        const bnNoz  = activeNozzle(L);
        const branchFL = FL_total(bnNoz?.gpm||0, bnSegs);
        PDP = (bnNoz?.NP||0) + branchFL + mainFL + (L.elevFt * PSI_PER_FT);
        rows.push(`Nozzle (${bnNoz?.name||'—'}) NP = <b>${bnNoz?.NP||0}</b> psi`);
        rows.push(`Branch FL (${bnNoz?.gpm||0} gpm) = <b>${Math.round(branchFL)}</b> psi`);
        rows.push(`Main FL (${flow} gpm) = <b>${Math.round(mainFL)}</b> psi`);
        rows.push(`Elevation (${L.elevFt||0}′) = <b>${Math.round(L.elevFt*PSI_PER_FT)}</b> psi`);
      }else if(L.hasWye){
        const lFlow=L.nozLeft?.gpm||0, rFlow=L.nozRight?.gpm||0;
        const lNeed = (L.nozLeft?.NP||0) + FL_total(lFlow, L.itemsLeft||[]);
        const rNeed = (L.nozRight?.NP||0) + FL_total(rFlow, L.itemsRight||[]);
        const controlling = (lNeed>=rNeed)?'Left':'Right';
        PDP = Math.max(lNeed, rNeed) + mainFL + (L.wyeLoss||10) + (L.elevFt * PSI_PER_FT);
        rows.push(`Left: NP ${L.nozLeft?.NP||0} + FL(${lFlow} gpm) ${Math.round(FL_total(lFlow, L.itemsLeft||[]))} = <b>${Math.round(lNeed)}</b> psi`);
        rows.push(`Right: NP ${L.nozRight?.NP||0} + FL(${rFlow} gpm) ${Math.round(FL_total(rFlow, L.itemsRight||[]))} = <b>${Math.round(rNeed)}</b> psi`);
        rows.push(`Main FL (${flow} gpm) = <b>${Math.round(mainFL)}</b> psi`);
        rows.push(`Wye appliance loss = <b>${Math.round(L.wyeLoss||10)}</b> psi`);
        rows.push(`Elevation (${L.elevFt||0}′) = <b>${Math.round(L.elevFt*PSI_PER_FT)}</b> psi`);
        rows.push(`<i>Controlling side:</i> <b>${controlling}</b>`);
      }else{
        PDP = (L.nozRight?.NP||0) + mainFL + (L.elevFt * PSI_PER_FT);
        rows.push(`Nozzle (${L.nozRight?.name||'—'}) NP = <b>${L.nozRight?.NP||0}</b> psi`);
        rows.push(`Main FL (${L.nozRight?.gpm||0} gpm) = <b>${Math.round(mainFL)}</b> psi`);
        rows.push(`Elevation (${L.elevFt||0}′) = <b>${Math.round(L.elevFt*PSI_PER_FT)}</b> psi`);
      }

      html += `
        <div class="ppRow" id="pp_simple_${k}">
          <div class="hdr">${L.label} — PDP <b>${Math.round(PDP)}</b> psi</div>
          <div class="tiny">Length: ${sumFt(L.itemsMain||[])}′ ${L.hasWye? '• Wye' : ''} ${L.elevFt? `• Elev ${L.elevFt}′` : ''}</div>
          <details>
            <summary>Show math</summary>
            <ul>${rows.map(r=>`<li>${r}</li>`).join('')}</ul>
          </details>
        </div>
      `;
    });

    linesTable.innerHTML = html;
    linesTable.classList.remove('is-hidden');
  }

  // Why? (reveal math and focus controlling line)
  whyBtn.addEventListener('click', ()=>{
    const anyDeployed = Object.values(state.lines||{}).some(l=>l.visible);
    if(!anyDeployed){ alert('Deploy a line to see Pump Pressure breakdown.'); return; }
    state.showMath = true;
    renderLinesPanel();
    const target = state.lastMaxKey ? container.querySelector(`#pp_simple_${state.lastMaxKey}`) : null;
    if(target){
      target.scrollIntoView({behavior:'smooth', block:'center'});
      target.classList.remove('flash'); void target.offsetWidth; target.classList.add('flash');
      const details = target.querySelector('details'); if(details && !details.open) details.open = true;
    }
  });

  // ---------- initial draw ----------
  // Ensure default buttons show deployed for Line 1 & 2 per request
  state.lines.left.visible = (state.lines.left.visible!==false);
  state.lines.back.visible = (state.lines.back.visible!==false);
  syncLineButtons();
  drawAll();
}

export default { render };
