// view.calc.js
// Main calculations view (render + draw). Works with bottom-sheet-editor.js for
// phone-friendly popup editing of line settings.
//
// Load order:
// <script type="module" src="/js/view.calc.js"></script>
// <script src="/js/bottom-sheet-editor.js"></script>

import {
  state,
  NOZ,
  NOZ_LIST,
  FL,
  seedDefaultsForKey,
  activeNozzle,
  isSingleWye
} from './store.js';

import { WaterSupplyUI } from './waterSupply.js';

// ---------- Tunables ----------
const TRUCK_W = 390;
const TRUCK_H = 260;
const CURVE_PULL = 36;

// ---------- Utilities ----------
function injectStyle(root, css) {
  const s = document.createElement('style');
  s.textContent = css;
  root.appendChild(s);
}
function clearGroup(g) { while (g.firstChild) g.removeChild(g.firstChild); }
function clsFor(size) { return (size === '5' ? 'hose5' : (size === '2.5' ? 'hose25' : 'hose175')); }
function fmt(n) { return Math.round(n); }
function pumpXY(viewH) { return { x: TRUCK_W / 2, y: viewH - 36 }; }
function pathBetween(x1, y1, x2, y2) {
  const dx = (x2 - x1), dy = (y2 - y1); const d = Math.hypot(dx, dy);
  const c = Math.max(20, Math.min(CURVE_PULL, d * .3));
  return `M ${x1} ${y1} C ${x1 + c} ${y1}, ${x2 - c} ${y2}, ${x2} ${y2}`;
}

// ---------- Main render ----------
export async function render(container) {
  container.innerHTML = `
    <section class="stack" data-calc-root>
      <section class="wrapper card">
        <div class="above">
          <div class="hoseLegend">
            <span class="legSwatch sw175"></span> 1¾″
            <span class="legSwatch sw25"></span> 2½″
            <span class="legSwatch sw5"></span> 5″
          </div>
        </div>

        <div class="stageWrap">
          <svg id="stage" viewBox="0 0 ${TRUCK_W} ${TRUCK_H}" role="img" aria-label="Pump panel, hose layout">
            <defs>
              <linearGradient id="ppGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#1c2836"/>
                <stop offset="100%" stop-color="#0b1017"/>
              </linearGradient>
            </defs>

            <!-- Hoses and overlays -->
            <g id="hoses"></g>
            <g id="branches"></g>
            <g id="labels"></g>
            <g id="tips"></g>
            <g id="supplyG"></g>

            <image id="truckImg" href="./img/pump_truck.svg"
                   x="0" y="0" width="${TRUCK_W}" height="${TRUCK_H}"
                   preserveAspectRatio="xMidYMid slice"/>
          </svg>

          <!-- Inline tip editor markup (bottom-sheet-editor.js will make this a bottom sheet) -->
          <div id="tipEditor" class="tip-editor is-hidden" role="dialog" aria-modal="true" aria-labelledby="teTitle">
            <div class="mini" id="teTitle" style="margin-bottom:6px;opacity:.9">Edit Line</div>

            <div class="te-row"><label>Where</label><input id="teWhere" readonly></div>

            <div class="te-row"><label>Diameter</label>
              <select id="teSize">
                <option value="1.75">1¾″</option>
                <option value="2.5">2½″</option>
                <option value="5">5″</option>
              </select>
            </div>

            <div class="te-row"><label>Length (ft)</label>
              <input type="number" id="teLen" min="0" step="25" value="200">
            </div>

            <div class="te-row"><label>Nozzle</label>
              <select id="teNoz"></select>
            </div>

            <div class="te-row"><label>Elevation (ft)</label>
              <input type="number" id="teElev" step="5" value="0">
            </div>

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
              <button class="btn" id="teCancel" type="button">Cancel</button>
              <button class="btn primary" id="teApply" type="button">Apply</button>
            </div>
          </div>

          <div class="info" id="topInfo">No lines deployed</div>
        </div>

        <!-- Controls below the truck -->
        <div id="overlay">
          <div class="controlBlock">
            <div class="controlRow">
              <div class="lineGroup">
                <button class="linebtn" data-line="left">Line 1</button>
                <button class="linebtn" data-line="back">Line 2</button>
                <button class="linebtn" data-line="right">Line 3</button>
              </div>
              <button id="presetsBtn" class="presetsbtn">Presets</button>
            </div>

            <div class="controlRow">
              <div class="actionGroup">
                <button class="supplybtn" id="hydrantBtn" title="Pressurized (Hydrant)">Hydrant</button>
                <button class="supplybtn" id="tenderBtn"  title="Static (Tender Shuttle)">Tender</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- KPIs + Supply Summaries -->
      <section class="card">
        <div class="kpis">
          <div class="kpi"><div class="mini">Total Flow</div><b id="GPM">0</b></div>
          <div class="kpi"><div class="mini">PDP</div><b id="PDP">0</b></div>
          <div class="kpi"><div class="mini">Why?</div><button id="whyBtn" class="btn">Show</button></div>
        </div>

        <div id="supplySummary" class="supplySummary">
          <div class="row"><span class="k">Supply Mode:</span> <span class="v" id="ssMode">—</span></div>
          <div class="row" id="hydrantRow" style="display:none"><span class="k">Hydrant:</span> <span class="v" id="hydrantResult">—</span></div>
          <div class="row" id="staticRow" style="display:none"><span class="k">Shuttle GPM:</span> <span class="v" id="shuttleTotalGpm">0</span></div>
        </div>

        <!-- Hydrant helper -->
        <div id="hydrantHelper" class="helper is-hidden">
          <div class="mini">Hydrant residual drop calculator</div>
          <div class="row">
            <label>Static (psi)</label>
            <input id="hydrantStatic" type="number" inputmode="decimal" placeholder="e.g., 70">
          </div>
          <div class="row">
            <label>Residual (psi)</label>
            <input id="hydrantResidual" type="number" inputmode="decimal" placeholder="e.g., 60">
          </div>
          <div class="row">
            <label>Largest flowing line size</label>
            <select id="hydrantLineSize">
              <option value="1.75">1¾″</option>
              <option value="2.5">2½″</option>
              <option value="5">5″</option>
            </select>
          </div>
          <div class="row">
            <button id="hydrantCalcBtn" class="btn primary">Calculate</button>
          </div>
        </div>

        <!-- Tender/static helper -->
        <div id="staticHelper" class="helper is-hidden">
          <div class="mini">Tender shuttle calculator</div>
          <div class="row">
            <div class="field">
              <label>Tender ID</label>
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
              Total shuttle GPM = sum of all tenders.
            </div>
          </details>
          <div class="mini" style="margin-top:8px">Total Shuttle GPM: <b id="shuttleTotalGpm">0</b></div>
        </div>
      </section>

      <!-- Presets -->
      <section id="sheet" class="sheet is-hidden" aria-hidden="true" role="dialog" aria-label="Presets">
        <div class="sheetHeader">
          <div class="mini" style="opacity:.8">Choose a preset</div>
          <button id="sheetClose" class="btn">Close</button>
        </div>
        <div class="linepick">
          <div class="preset" data-preset="standpipe">Standpipe</div>
          <div class="preset" data-preset="sprinkler">Sprinkler</div>
          <div class="preset" data-preset="foam">Foam</div>
          <div class="preset" data-preset="monitor">Monitor</div>
          <div class="preset" data-preset="aerial">Aerial / Elevated</div>
        </div>
      </section>

      <div id="sheetBackdrop" class="sheet-backdrop"></div>
      <div id="tipBackdrop" class="sheet-backdrop"></div>
    </section>
  `;

  // ---------- Styles ----------
  injectStyle(container, `
    input, select, textarea, button { font-size:16px; }
    .btn, .linebtn, .supplybtn, .presetsbtn, .whyBtn { min-height:44px; padding:10px 14px; border-radius:12px; }
    .controlBlock { display:flex; flex-direction:column; gap:8px; margin-top:10px; }
    .controlRow { display:flex; gap:12px; justify-content:space-between; align-items:center; flex-wrap:wrap; }
    .lineGroup, .actionGroup { display:flex; gap:8px; flex-wrap:wrap; }
    .kpis { display:flex; gap:12px; flex-wrap:wrap; }
    .kpi b { font-size:20px; }
    .field label { display:block; font-weight:700; color:#dfe9ff; margin: 6px 0 4px; }
    .field input[type="text"], .field input[type="number"], .field select, .field textarea {
      width:100%; padding:10px 12px; border:1px solid rgba(255,255,255,.22); border-radius:12px;
      background:#0b1420; color:#eaf2ff; outline:none;
    }
    .field input:focus, .field select:focus, .field textarea:focus {
      border-color:#6ecbff; box-shadow:0 0 0 3px rgba(110,203,255,.22);
    }
    .supplySummary {
      background:#0e151e; border:1px solid rgba(255,255,255,.12);
      border-radius:12px; padding:12px; color:#eaf2ff;
      margin-top:8px;
    }
    .supplySummary .row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    .supplySummary .k { color:#a9bed9; min-width:160px; }
    .supplySummary .v { font-weight:800; }

    .stageWrap{ position:relative }
    #overlay{ position:absolute; inset:auto 0 0 0; padding:10px; pointer-events:none }
    #overlay .controlBlock{ pointer-events:auto }

    .info{ position:absolute; left:10px; top:10px; background:rgba(0,0,0,.45); color:#fff; padding:4px 6px; border-radius:6px; font-size:12px; }
    #stage{ background:#0b1017; border-radius:12px; display:block; width:100%; height:auto }
    #truckImg{ pointer-events:none; user-select:none }

    /* Hose look */
    .hoseBase{fill:none;stroke-linecap:round;stroke-linejoin:round}
    .hose5{stroke:#ecd464;stroke-width:12}
    .hose25{stroke:#6ecbff;stroke-width:9}
    .hose175{stroke:#ff6b6b;stroke-width:6}
    .shadow{stroke:rgba(0,0,0,.35);stroke-width:12}

    /* + hit targets at line ends */
    .hose-end{cursor:pointer;pointer-events:all}
    .plus-hit{fill:transparent;stroke:transparent;rx:16;ry:16;width:56px;height:56px}
    .plus-circle{fill:#fff;stroke:#111;stroke-width:1.5;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))}
    .plus-sign{stroke:#111;stroke-width:3;stroke-linecap:round}

    .hoseLegend{display:flex;gap:8px;align-items:center;font-size:11px;color:#cfe4ff;margin:2px 0 6px}
    .legSwatch{width:14px;height:8px;border-radius:3px;display:inline-block;border:1px solid rgba(0,0,0,.35)}
    .sw175{background:#ff6b6b} .sw25{background:#6ecbff} .sw5{background:#ecd464}

    details.math{background:#0b1a29;border:1px solid #1f3a57;border-radius:12px;padding:6px 8px;margin-top:6px}
    details.math summary{cursor:pointer;color:#cfe4ff;font-weight:700}
    .barWrap{background:#0b1320;border:1px solid #1f3a57;border-radius:10px;padding:6px;margin:6px 0}
    .barTitle{font-size:12px;color:#9fb0c8;margin-bottom:6px}
    .bar{height:10px;border-radius:999px;background:linear-gradient(90deg,#0f3050,#1a4e7d);position:relative;overflow:hidden}
    .bar::after{content:"";position:absolute;inset:0;background:rgba(110,203,255,.18);mix-blend-mode:screen}

    /* Presets sheet */
    .sheet{ position:fixed; inset:auto 0 0 0; background:#0e151e; border-top:1px solid rgba(255,255,255,.1); border-top-left-radius:16px; border-top-right-radius:16px; transform:translateY(100%); transition:transform .26s ease; z-index:1000; }
    .sheet:not(.is-hidden){ transform:translateY(0) }
    .sheetHeader{ display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.08)}
    .sheet-backdrop{ position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:999; display:none }

    .linebtn, .presetsbtn, .supplybtn, .whyBtn { background:#0e151e; border:1px solid rgba(255,255,255,.1); color:#e6f0ff }
    .linebtn.active, .supplybtn.active, .presetsbtn.active { outline:2px solid #4fa3ff; outline-offset: 0 }

    .linepick{ display:flex; gap:8px; padding:10px 12px; flex-wrap:wrap; }
    .preset{ background:#0b1017; border:1px solid rgba(255,255,255,.12); border-radius:10px; padding:10px 12px; cursor:pointer; user-select:none }
    .preset.selected{ border-color:#4fa3ff; box-shadow:0 0 0 2px rgba(79,163,255,.35) inset }
  `);

  // ---------- DOM references ----------
  const stage        = container.querySelector('#stage');
  const G_hoses      = container.querySelector('#hoses');
  const G_branches   = container.querySelector('#branches');
  const G_labels     = container.querySelector('#labels');
  const G_tips       = container.querySelector('#tips');
  const G_supply     = container.querySelector('#supplyG');

  const GPMel        = container.querySelector('#GPM');
  const PDPel        = container.querySelector('#PDP');
  const topInfo      = container.querySelector('#topInfo');

  const teTitle      = container.querySelector('#teTitle');
  const teWhere      = container.querySelector('#teWhere');
  const teSize       = container.querySelector('#teSize');
  const teLen        = container.querySelector('#teLen');
  const teNoz        = container.querySelector('#teNoz');
  const teElev       = container.querySelector('#teElev');
  const teWye        = container.querySelector('#teWye');
  const teLenA       = container.querySelector('#teLenA');
  const teLenB       = container.querySelector('#teLenB');
  const teNozA       = container.querySelector('#teNozA');
  const teNozB       = container.querySelector('#teNozB');
  const branchBlock  = container.querySelector('#branchBlock');

  const ssMode       = container.querySelector('#ssMode');
  const hydrantRow   = container.querySelector('#hydrantRow');
  const staticRow    = container.querySelector('#staticRow');
  const hydrantResEl = container.querySelector('#hydrantResult');

  // ---------- Populate nozzle selects ----------
  function fillNozzleSelect(sel, defId) {
    if (!sel) return;
    sel.innerHTML = '';
    NOZ_LIST.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n.id;
      opt.textContent = n.label || n.id;
      if (n.id === defId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ---------- Build static hose group holders ----------
  (function buildStaticGroups(){
    const ns = 'http://www.w3.org/2000/svg';
    ['left','back','right'].forEach(id=>{
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('id', 'hose_'+id);
      G_hoses.appendChild(g);
    });
  })();

  // ---------- Add + tip ----------
  function addTip(key, where, x, y) {
    const ns = 'http://www.w3.org/2000/svg';
    const g  = document.createElementNS(ns, 'g');
    g.setAttribute('class','hose-end');
    g.setAttribute('data-line', key);
    g.setAttribute('data-where', where);

    const hit = document.createElementNS(ns,'rect');
    hit.setAttribute('class','plus-hit');
    hit.setAttribute('x', x-28); hit.setAttribute('y', y-28);
    hit.setAttribute('width', 56); hit.setAttribute('height', 56);

    const c = document.createElementNS(ns,'circle');
    c.setAttribute('class','plus-circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 16);

    const v = document.createElementNS(ns,'line'); v.setAttribute('class','plus-sign');
    v.setAttribute('x1', x); v.setAttribute('y1', y-7); v.setAttribute('x2', x); v.setAttribute('y2', y+7);

    const h = document.createElementNS(ns,'line'); h.setAttribute('class','plus-sign');
    h.setAttribute('x1', x-7); h.setAttribute('y1', y); h.setAttribute('x2', x+7); h.setAttribute('y2', y);

    g.appendChild(hit); g.appendChild(c); g.appendChild(v); g.appendChild(h);
    G_tips.appendChild(g);
  }

  // ---------- Draw all ----------
  function drawAll() {
    const viewH = stage.viewBox.baseVal.height || TRUCK_H;

    // clear dynamic layers
    clearGroup(G_tips); clearGroup(G_branches); clearGroup(G_labels); // keep G_hoses if you draw complex paths

    // (Example end coords; your real geometry likely differs)
    const ends = {
      left:  { x: TRUCK_W - 80, y: 120 },
      back:  { x: TRUCK_W - 52, y: 144 },
      right: { x: TRUCK_W - 24, y: 168 }
    };

    // Build + tips at ends for active lines
    ['left','back','right'].forEach((key)=>{
      const L = seedDefaultsForKey(key);
      const btn = container.querySelector(`.linebtn[data-line="${key}"]`);
      if (btn) btn.classList.toggle('active', !!L.visible);

      if (!L.visible) return;
      const e = ends[key];
      addTip(key, 'main', e.x, e.y);
      if (L.hasWye) {
        addTip(key, 'L', e.x - 20, e.y - 18);
        addTip(key, 'R', e.x + 20, e.y - 18);
      }
    });

    // Supply drawing & panel visibility
    waterSupply.draw(viewH);
    if (typeof waterSupply.updatePanelsVisibility === 'function') {
      waterSupply.updatePanelsVisibility();
    }

    // KPIs
    refreshTotals();
  }

  // ---------- Totals ----------
  function refreshTotals(){
    const totalGPM = Object.values(state.lines).reduce((acc, L)=>{
      if (!L.visible) return acc;
      const noz = activeNozzle(L);
      return acc + (noz?.gpm || 0);
    }, 0);

    const pdp = Object.values(state.lines).reduce((acc, L)=>{
      if (!L.visible) return acc;
      // If you have a real FL calc per segment/nozzle, call it here.
      // This placeholder keeps UI ticking; replace with your function.
      const base = (activeNozzle(L)?.np || 50);
      return Math.max(acc, base + (L.elevFt||0));
    }, 0);

    GPMel.textContent = fmt(totalGPM);
    PDPel.textContent = fmt(pdp);

    // Supply summary labels
    ssMode.textContent = state.supply === 'pressurized' ? 'Hydrant (pressurized)' : 'Static (tender shuttle)';
    hydrantRow.style.display = state.supply === 'pressurized' ? '' : 'none';
    staticRow.style.display  = state.supply === 'static' ? '' : 'none';
    if (state.supply === 'pressurized') {
      hydrantResEl.textContent = state.hydrant?.lastResult || '—';
    }
  }

  // ---------- Presets UI ----------
  const sheet        = container.querySelector('#sheet');
  const presetsBtn   = container.querySelector('#presetsBtn');
  const sheetClose   = container.querySelector('#sheetClose');
  const sheetBackdrop= container.querySelector('#sheetBackdrop');

  presetsBtn.addEventListener('click', ()=>{
    sheet.classList.toggle('is-hidden');
    sheetBackdrop.style.display = sheet.classList.contains('is-hidden') ? 'none' : 'block';
  });
  sheetClose.addEventListener('click', ()=>{
    sheet.classList.add('is-hidden');
    sheetBackdrop.style.display = 'none';
  });
  sheetBackdrop.addEventListener('click', ()=>{
    sheet.classList.add('is-hidden');
    sheetBackdrop.style.display = 'none';
  });

  // ---------- Tip editor: populate fields on "+" click ----------
  // NOTE: We DO NOT open or position the editor here; bottom-sheet-editor.js will do that.
  stage.addEventListener('click', (e)=>{
    const tip = e.target.closest('.hose-end'); if(!tip) return;
    const key = tip.getAttribute('data-line'); const where = tip.getAttribute('data-where');
    const L = seedDefaultsForKey(key);
    L.visible = true;

    // Title + where
    const whereLabel = (where === 'main' ? 'Main' : (where === 'L' ? 'Branch L' : 'Branch R'));
    teTitle.textContent = (L.label || key.toUpperCase()) + ' — ' + whereLabel;
    teWhere.value = where.toUpperCase();

    // Elevation + Wye
    teElev.value = L.elevFt || 0;
    teWye.value  = L.hasWye ? 'on' : 'off';

    // Nozzle lists
    if (where === 'main') {
      fillNozzleSelect(teNoz, (isSingleWye(L) ? activeNozzle(L)?.id : L.nozRight?.id) || activeNozzle(L)?.id);
    } else if (where === 'L') {
      fillNozzleSelect(teNoz, L.nozLeft?.id);
    } else {
      fillNozzleSelect(teNoz, L.nozRight?.id);
    }
    fillNozzleSelect(teNozA, L.nozLeft?.id);
    fillNozzleSelect(teNozB, L.nozRight?.id);

    // Length + Size (basic defaults if missing)
    let seg = null;
    if (where === 'main') {
      seg = L.itemsMain?.[0] || { size:'1.75', lengthFt:200 };
    } else if (where === 'L') {
      seg = L.itemsLeft?.[0] || { size:'1.75', lengthFt:100 };
    } else {
      seg = L.itemsRight?.[0] || { size:'1.75', lengthFt:100 };
    }
    teSize.value = String(seg.size);
    teLen.value  = String(seg.lengthFt ?? 0);

    // Branch fields
    branchBlock.classList.toggle('is-hidden', teWye.value !== 'on');
    teLenA && (teLenA.value = String(L.itemsLeft?.[0]?.lengthFt ?? 0));
    teLenB && (teLenB.value = String(L.itemsRight?.[0]?.lengthFt ?? 0));
  });

  // ---------- Apply / Cancel (Apply updates state only; add-on closes the sheet) ----------
  container.querySelector('#teApply').addEventListener('click', ()=>{
    const where = String(teWhere.value || 'MAIN').toUpperCase();
    // Find current editing line based on the title prefix we set (safe heuristic)
    const label = (teTitle.textContent || '');
    const key = label.includes('Line 1') || label.includes('LEFT')  ? 'left' :
                label.includes('Line 2') || label.includes('BACK')  ? 'back' :
                label.includes('Line 3') || label.includes('RIGHT') ? 'right' : (['left','back','right'].find(k=>label.toUpperCase().includes(k.toUpperCase())) || 'left');

    const L = state.lines[key] || seedDefaultsForKey(key);
    const size = String(teSize.value);
    const len  = Math.max(0, +teLen.value || 0);
    const elev = +teElev.value || 0;

    const noz = NOZ[String(teNoz.value)] || activeNozzle(L);
    const wyeOn = (String(teWye.value) === 'on');

    if (where === 'MAIN') {
      L.itemsMain = len ? [{ size, lengthFt: len }] : [];
      L.elevFt    = elev;
      if (wyeOn) {
        L.hasWye = true;
        const lenA = Math.max(0, +teLenA?.value || 0);
        const lenB = Math.max(0, +teLenB?.value || 0);
        L.itemsLeft  = lenA ? [{ size: '1.75', lengthFt: lenA }] : [];
        L.itemsRight = lenB ? [{ size: '1.75', lengthFt: lenB }] : [];
        L.nozLeft  = NOZ[String(teNozA?.value)] || L.nozLeft;
        L.nozRight = NOZ[String(teNozB?.value)] || L.nozRight;
      } else {
        L.hasWye = false;
        L.nozRight = noz; // single tip on main
      }
    } else if (where === 'L') {
      L.hasWye = true;
      L.itemsLeft = len ? [{ size, lengthFt: len }] : [];
      L.nozLeft   = noz;
    } else {
      L.hasWye = true;
      L.itemsRight = len ? [{ size, lengthFt: len }] : [];
      L.nozRight   = noz;
    }

    L.visible = true;
    drawAll(); // refresh
  });

  container.querySelector('#teCancel').addEventListener('click', ()=>{
    // no state changes; bottom-sheet-editor.js will close the sheet
  });

  // Wye toggle shows/hides branch block (add-on also wires this, but keeping here is fine)
  teWye.addEventListener('change', ()=>{
    branchBlock.classList.toggle('is-hidden', teWye.value !== 'on');
  });

  // ---------- Line toggle buttons ----------
  container.querySelectorAll('.linebtn').forEach(b=>{
    b.addEventListener('click', ()=>{
      const key = b.dataset.line;
      const L = seedDefaultsForKey(key);
      L.visible = !L.visible;
      b.classList.toggle('active', !!L.visible);
      drawAll();
    });
  });

  // ---------- Hydrant / Tender mode ----------
  function updateSupplyButtons(){
    container.querySelector('#hydrantBtn')?.classList.toggle('active', state.supply === 'pressurized');
    container.querySelector('#tenderBtn')?.classList.toggle('active', state.supply === 'static');
  }

  container.querySelector('#hydrantBtn').addEventListener('click', ()=>{
    state.supply = 'pressurized';
    updateSupplyButtons();
    waterSupply.showPanel('hydrant');
    refreshTotals();
  });
  container.querySelector('#tenderBtn').addEventListener('click', ()=>{
    state.supply = 'static';
    updateSupplyButtons();
    waterSupply.showPanel('tender');
    refreshTotals();
  });

  // ---------- Why button (placeholder) ----------
  container.querySelector('#whyBtn').addEventListener('click', ()=>{
    const anyDeployed = Object.values(state.lines).some(l=>l.visible);
    if (!anyDeployed) { alert('No lines deployed yet'); return; }
    alert('PDP math breakdown coming soon'); // swap with your own modal/details
  });

  // ---------- Water Supply integration ----------
  const waterSupply = new WaterSupplyUI({
    container, state, pumpXY, TRUCK_H, G_supply,
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
    },
    onSupplyChange: ()=>{ updateSupplyButtons(); refreshTotals(); },
    onTenderUpdate: ()=>{ refreshTotals(); }
  });
  updateSupplyButtons();

  // ---------- Initial draw ----------
  drawAll();

  // ---------- Return disposer (if needed) ----------
  return { dispose(){ /* add any cleanup if you attach timers */ } };
}

export default { render };
