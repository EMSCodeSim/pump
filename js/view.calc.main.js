;

// GLOBAL DELEGATED HANDLER FOR + BUTTONS
document.addEventListener("click", (e) => {
  const tip = e.target.closest(".hose-end, .plus-hit, .plus-circle, .plus-sign");
  if (!tip) return;
  e.preventDefault(); e.stopPropagation();
  const key = tip.getAttribute("data-line");
  const where = tip.getAttribute("data-where");
  if (window._openTipEditor) window._openTipEditor(key, where);
});

// /js/view.calc.js
// Stage view with popup editor support, Wye-aware UI (no main nozzle when wye),
// Branch-B default nozzle = Fog 185 @ 50, diameter-based default nozzles,
// and practice-state persistence (including tender shuttle) across view switches.
//
// Requires: ./store.js, ./waterSupply.js, and bottom-sheet-editor.js (optional; this file works without it).
import {
  state,
  NOZ, COLORS, FL, FL_total, sumFt, splitIntoSections, PSI_PER_FT, seedDefaultsForKey,
  isSingleWye, activeNozzle, activeSide, sizeLabel, NOZ_LIST,
  sectionsFor, FL_total_sections, breakdownText,
  PRACTICE_SAVE_KEY, safeClone, loadSaved, saveNow, markDirty, startAutoSave, stopAutoSave,
  buildSnapshot, restoreState,
  TRUCK_W, TRUCK_H, PX_PER_50FT, CURVE_PULL, BRANCH_LIFT,
  supplyHeight, computeNeededHeightPx, truckTopY, pumpXY, mainCurve, straightBranch,
  injectStyle, clearGroup, clsFor, fmt, escapeHTML, addLabel, addTip, drawSegmentedPath,
  findNozzleId, defaultNozzleIdForSize, ensureDefaultNozzleFor, setBranchBDefaultIfEmpty,
  drawHoseBar, ppExplainHTML
} from './calcShared.js';
// Expose shared state for legacy helpers (reset scripts, etc.)
if (typeof window !== 'undefined') {
  window.state = state;
}


import { WaterSupplyUI } from './waterSupply.js';
import { setupPresets, getDeptNozzleIds, getDeptHoseDiameters } from './preset.js';
import './view.calc.enhance.js';

/*                                Main render                                 */
/* ========================================================================== */

export async function render(container){

  // Restore saved practice "state" early (lines/supply etc.)
  const saved_at_mount = loadSaved();
  if (saved_at_mount?.state) {
    const s = saved_at_mount.state;

    // Do NOT carry over hose layouts between full page loads.
    // Let store.js seed the default engine setups again.
    if (s.lines) {
      s.lines = null;
    }

    // Also reset water supply mode each full load so users start clean.
    if ('supply' in s) {
      delete s.supply;
    }

    restoreState(s);
  }


  // Persist on hide/close
  window.addEventListener('beforeunload', ()=>{
    const pack = buildSnapshot(pickWaterSnapshotSafe());
    if (pack) saveNow(pack);
  });
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'hidden') {
      const pack = buildSnapshot(pickWaterSnapshotSafe());
      if (pack) saveNow(pack);
    }
  });

  container.innerHTML = `
    <section class="stack" data-calc-root>
      <section class="wrapper card">
        <div class="stage" id="stage">
          <svg id="stageSvg" viewBox="0 0 ${TRUCK_W} ${TRUCK_H}" preserveAspectRatio="xMidYMax meet" aria-label="Visual stage">
            <image id="truckImg" href="/assets/images/engine181.png" x="0" y="0" width="${TRUCK_W}" height="${TRUCK_H}" preserveAspectRatio="xMidYMax meet"
              onerror="this.setAttribute('href','https://fireopssim.com/pump/engine181.png')"></image>
            <g id="hoses"></g>
            <g id="branches"></g>
            <g id="labels"></g>
            <g id="tips"></g>
            <g id="supplyG"></g>
          </svg>
          <!-- Hose color key -->
          <div class="hoseKey"
               style="margin-top:8px; font-size:12px; display:flex; gap:12px; align-items:center; opacity:.85;">
            <span style="display:inline-flex; align-items:center; gap:4px;">
              <span style="width:18px; height:4px; border-radius:999px; background:#ff4b4b;"></span>
              1&nbsp;3/4″
            </span>
            <span style="display:inline-flex; align-items:center; gap:4px;">
              <span style="width:18px; height:4px; border-radius:999px; background:#3b82f6;"></span>
              2&nbsp;1/2″
            </span>
            <span style="display:inline-flex; align-items:center; gap:4px;">
              <span style="width:18px; height:4px; border-radius:999px; background:#fbbf24;"></span>
              5″
            </span>
          </div>


          <!-- Editor (opened by bottom-sheet-editor.js or our fallback) -->
          <div id="tipEditor" class="tip-editor is-hidden" role="dialog" aria-modal="true" aria-labelledby="teTitle">
            <div class="mini" id="teTitle" style="margin-bottom:6px;opacity:.9">Edit Line</div>

            <div class="te-row"><label>Where</label><input id="teWhere" readonly></div>
            <!-- Segment Switch (shown only when Wye is ON) -->
            <div id="segSwitch" class="segSwitch is-hidden" style="display:none; margin:6px 0 4px; gap:6px">
              <button type="button" class="segBtn" data-seg="main">Main</button>
              <button type="button" class="segBtn" data-seg="A">Line A</button>
              <button type="button" class="segBtn" data-seg="B">Line B</button>
            </div>


            
            <!-- Diameter: - [value] +, cycles 1 3/4, 2 1/2, 5" -->
            <div class="te-row" id="rowSize">
              <label>Diameter</label>
              <input type="hidden" id="teSize" value="1.75">
              <div class="steppers">
                <button type="button" class="stepBtn" id="sizeMinus" aria-label="Decrease hose size">−</button>
                <div class="stepVal" id="sizeLabel">1 3/4″</div>
                <button type="button" class="stepBtn" id="sizePlus" aria-label="Increase hose size">+</button>
              </div>
            </div>

            <!-- Length: - [value] +, steps of 50' -->
            <div class="te-row" id="rowLen">
              <label>Length (ft)</label>
              <input type="hidden" id="teLen" value="50">
              <div class="steppers">
                <button type="button" class="stepBtn" id="lenMinus" aria-label="Decrease length">−</button>
                <div class="stepVal" id="lenLabel">50′</div>
                <button type="button" class="stepBtn" id="lenPlus" aria-label="Increase length">+</button>
              </div>
            </div>

            <!-- Nozzle: full list from charts (NOZ_LIST) -->
            <div class="te-row" id="rowNoz">
              <label>Nozzle</label>
              <select id="teNoz"></select>
            </div>

            <!-- Elevation: - [value] +, steps of 1' -->
            <div class="te-row" id="rowElev">
              <label>Elevation (ft)</label>
              <input type="hidden" id="teElev" value="0">
              <div class="steppers">
                <button type="button" class="stepBtn" id="elevMinus" aria-label="Decrease elevation">−</button>
                <div class="stepVal" id="elevLabel">0′</div>
            <!-- Branch controls (visible only when Wye is active) -->
            <section id="branchPlusWrap" style="display:none; margin-top:10px">
              <div class="ink-strong" style="font-weight:700;margin-bottom:6px">Branches (Wye)</div>

              <!-- Branch A -->
              <div class="card" id="branchASection" style="padding:8px; margin-bottom:8px">
                <div style="font-weight:700;margin-bottom:6px">Branch A</div>
                <div class="te-row">
                  <label>Length (ft)</label>
                  <input type="hidden" id="teLenA" value="50">
                  <div class="steppers">
                    <button type="button" class="stepBtn" id="lenAMinus">−</button>
                    <div class="stepVal" id="lenALabel">50′</div>
                    <button type="button" class="stepBtn" id="lenAPlus">+</button>
                  </div>
                </div>
                <div class="te-row">
                  <label>Elevation (ft)</label>
                  <input type="hidden" id="teElevA" value="0">
                  <div class="steppers">
                    <button type="button" class="stepBtn" id="elevAMinus">−</button>
                    <div class="stepVal" id="elevALabel">0′</div>
                    <button type="button" class="stepBtn" id="elevAPlus">+</button>
                  </div>
                </div>
                <div class="te-row">
                  <label>Nozzle</label>
                  <select id="teNozA"></select>
                </div>
              </div>

              <!-- Branch B -->
              <div class="card" id="branchBSection" style="padding:8px">
                <div style="font-weight:700;margin-bottom:6px">Branch B</div>
                <div class="te-row">
                  <label>Length (ft)</label>
                  <input type="hidden" id="teLenB" value="50">
                  <div class="steppers">
                    <button type="button" class="stepBtn" id="lenBMinus">−</button>
                    <div class="stepVal" id="lenBLabel">50′</div>
                    <button type="button" class="stepBtn" id="lenBPlus">+</button>
                  </div>
                </div>
                <div class="te-row">
                  <label>Elevation (ft)</label>
                  <input type="hidden" id="teElevB" value="0">
                  <div class="steppers">
                    <button type="button" class="stepBtn" id="elevBMinus">−</button>
                    <div class="stepVal" id="elevBLabel">0′</div>
                    <button type="button" class="stepBtn" id="elevBPlus">+</button>
                  </div>
                </div>
                <div class="te-row">
                  <label>Nozzle</label>
                  <select id="teNozB"></select>
                </div>
              </div>
            </section>
            
                <button type="button" class="stepBtn" id="elevPlus" aria-label="Increase elevation">+</button>
              </div>
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
              <button class="btn" id="teCancel">Cancel</button>
              <button class="btn primary" id="teApply">Apply</button>
            </div>
          </div>

          <div class="info" id="topInfo">No lines deployed (v-preset)</div>
        </div>

        <!-- Controls -->
        <div class="controlBlock">
          <div class="controlRow">
            <div class="lineGroup">
              <button class="linebtn" data-line="left">Line 1</button>
              <button class="linebtn" data-line="back">Line 2</button>
              <button class="linebtn" data-line="right">Line 3</button>
              <button class="presetsbtn" id="presetsBtn">Presets</button>
            </div>
          </div>

          <div class="controlRow">
            <div class="lineGroup" id="presetLineButtonsRow">
              <!-- Preset line buttons (Foam, Blitz, etc.) will be injected here -->
            </div>
          </div>

          <div class="controlRow">
            <div class="actionGroup">
              <button class="supplybtn" id="hydrantBtn" title="Pressurized (Hydrant)">Hydrant</button>
              <button class="supplybtn" id="relayBtn"   title="Relay pumping helper">Relay</button>
              <button class="supplybtn" id="tenderBtn"  title="Static (Tender Shuttle)">Tender</button>
            </div>
          </div>
        </div>
      </section>

      <!-- KPIs & answer box -->
      <section class="card">
        <div class="kpis">
          <div class="kpi"><div>Total Flow</div><b id="GPM">— gpm</b></div>
          <div class="kpi"><div>Max PP</div><b id="PDP">— psi</b><button id="whyBtn" class="whyBtn">Why?</button></div>
        </div>

        <div id="supplySummary" class="supplySummary" style="margin-top:10px; display:none;"></div>

        <!-- Hydrant helper -->
        <div id="hydrantHelper" class="helperPanel" style="display:none; margin-top:10px; background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
          <div style="color:#fff; font-weight:800; margin-bottom:6px">Hydrant Residual %Drop</div>
          <div class="mini" style="color:#a9bed9; margin-bottom:8px">
            0–10% → 3×, 11–15% → 2×, 16–25% → 1×, >25% → 0× of same-size lines
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
<!-- Tender controls (minimal) -->
<div id="staticHelper" class="helperPanel" style="display:none; margin-top:10px; background:rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;">
  <!-- Hidden Tender Shuttle status container (keeps #shuttleTotalGpm for JS, but shows text only in summary card) -->
  <div class="pill shuttleMeta" style="display:none;">
    <span id="shuttleTotalGpm">0</span>
  </div>

  <div class="row" style="gap:10px; align-items:flex-end;">
    <div class="field">
      <label>Tender ID / Number</label>
      <input id="tAddId" type="text" placeholder="e.g., Tender 2">
    </div>
    <div class="field">
      <label>Capacity (gal)</label>
      <input id="tAddCap" type="number" inputmode="decimal" placeholder="e.g., 3000">
    </div>
    <div class="field">
      <button id="tAddBtn" class="btn primary" type="button">Add Tender</button>
    </div>
  </div>

  <!-- Per‑tender list with timers will render here -->
  <div id="tenderList" style="margin-top:10px"></div>
</div>


        

        
        <!-- Relay Pumping mini-app mount -->
        <div id="relayMount" class="relayMount" style="display:none; margin-top:10px;"></div>

<div class="linesTable is-hidden" id="linesTable"></div>
      </section>
    </section>

`;

  /* ----------------------------- Styles ---------------------------------- */
    /* ----------------------------- Styles ---------------------------------- */
  injectStyle(container, `
    :root, body { overflow-x: hidden; }
    [data-calc-root] { max-width: 100%; overflow-x: hidden; }
    .wrapper.card { max-width: 100%; overflow-x: hidden; }
    .stage { width: 100%; overflow: hidden; }
    #stageSvg { width: 100%; display: block; }  /* make SVG scale to container width */

    input, select, textarea, button { font-size:16px; }
    .btn, .linebtn, .supplybtn, .presetsbtn, .whyBtn { min-height:44px; padding:10px 14px; border-radius:12px; }
    .presetsbtn{display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.18);background:#0b1420;color:#eaf2ff;}
    .controlBlock { display:flex; flex-direction:column; gap:8px; margin-top:10px; }
    ...

    input, select, textarea, button { font-size:16px; }
    .btn, .linebtn, .supplybtn, .presetsbtn, .whyBtn { min-height:44px; padding:10px 14px; border-radius:12px; }
    .controlBlock { display:flex; flex-direction:column; gap:8px; margin-top:10px; }
    .controlRow { display:flex; gap:12px; justify-content:space-between; align-items:center; flex-wrap:wrap; }
    .lineGroup, .actionGroup { display:flex; gap:8px; flex-wrap:wrap; }
    .kpis { display:flex; gap:12px; flex-wrap:wrap; }
    .kpi b { font-size:20px; }
    .field label { display:block; font-weight:700; color:#dfe9ff; margin: 6px 0 4px; }
    .field input[type="text"], .field input[type="number"], .field select, .field textarea {
      width:100%; padding:10px 12px;
      border:1px solid rgba(255,255,255,.22);
/* phone KPI single-line */
try{(function(){const s=document.createElement("style");s.textContent="@media (max-width: 420px){.kpis{flex-wrap:nowrap}.kpi b{font-size:16px}.kpi{padding:6px 8px}}";document.head.appendChild(s);}())}catch(e){}
 border-radius:12px;
      background:#0b1420; color:#eaf2ff; outline:none;
    }
    .field input:focus, .field select:focus, .field textarea:focus {
      border-color:#6ecbff; box-shadow:0 0 0 3px rgba(110,203,255,.22);
    }
    .supplySummary { background:#0e151e; border:1px solid rgba(255,255,255,.12); border-radius:12px; padding:12px; color:#eaf2ff; }
    .supplySummary .row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    .supplySummary .k { color:#a9bed9; min-width:160px; }
    .supplySummary .v { font-weight:800; }

    .hoseBase{fill:none;stroke-linecap:round;stroke-linejoin:round}
    .hose5{stroke:#ecd464;stroke-width:12}
    .hose25{stroke:#6ecbff;stroke-width:9}
    .hose175{stroke:#ff6b6b;stroke-width:6}
    .shadow{stroke:rgba(0,0,0,.35);stroke-width:12}

    .hose-end{cursor:pointer;pointer-events:all}
    .plus-hit{fill:transparent;stroke:transparent}
    .plus-circle{fill:#fff;stroke:#111;stroke-width:1.5;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))}
    .plus-sign{stroke:#111;stroke-width:3;stroke-linecap:round}

    .hoseLegend{display:flex;gap:8px;align-items:center;font-size:11px;color:#cfe4ff;margin:2px 0 6px}
    .legSwatch{width:14px;height:8px;border-radius:3px;display:inline-block;border:1px solid rgba(0,0,0,.35)}
    .sw175{background:#ff6b6b} .sw25{background:#6ecbff} .sw5{background:#ecd464}

    details.math{background:#0b1a29;border:1px solid #1f3a57;border-radius:12px;padding:6px 8px;margin-top:6px}
    details.math summary{cursor:pointer;color:#cfe4ff;font-weight:700}
    .barWrap{background:#0b1320;border:1px solid #1f3a57;border-radius:10px;padding:6px;margin:6px 0}
    .barTitle{font-size:12px;color:#9fb0c8;margin-bottom:6px}
    .simpleBox{background:#0b1a29;border:1px solid #29507a;border-radius:10px;padding:8px;margin-top:6px;font-size:13px}
    .simpleBox b{color:#eaf2ff}
    .lbl{font-size:10px;fill:#0b0f14}
    .is-hidden{display:none!important}
  `);

  /* ------------------------------ DOM refs -------------------------------- */
  const stageSvg    = container.querySelector('#stageSvg');
  const G_hoses     = container.querySelector('#hoses');
  const G_branches  = container.querySelector('#branches');
  const G_labels    = container.querySelector('#labels');
  const G_tips      = container.querySelector('#tips');
  const G_supply    = container.querySelector('#supplyG');
  const truckImg    = container.querySelector('#truckImg');
  const topInfo     = container.querySelector('#topInfo');
  const PDPel       = container.querySelector('#PDP');
  const GPMel       = container.querySelector('#GPM');
  const supplySummaryEl = container.querySelector('#supplySummary');
  const linesTable  = container.querySelector('#linesTable');
  const presetButtonsRow = container.querySelector('#presetLineButtonsRow');

  const activePresetLines = {};


  // Editor fields
  const tipEditor   = container.querySelector('#tipEditor');
  const teTitle     = container.querySelector('#teTitle');
  const teWhere     = container.querySelector('#teWhere');
  const teSize      = container.querySelector('#teSize');
  const teLen       = container.querySelector('#teLen');
  const teElev      = container.querySelector('#teElev');
  const teWye       = container.querySelector('#teWye');
  const teLenA      = container.querySelector('#teLenA');
  const teLenB      = container.querySelector('#teLenB');
  const teNoz       = container.querySelector('#teNoz');
  const teNozA      = container.querySelector('#teNozA');
  const teNozB      = container.querySelector('#teNozB');
  
  /* ====== Segmented Branch UI (scoped, no globals) ====== */
  (function(){
    // Create UI right above the action buttons, only once per open
    function __ensureSegUI(whereInit){
      const tip = container.querySelector('#tipEditor'); if (!tip) return;
      const actions = tip.querySelector('.te-actions') || tip.lastElementChild;

      // Wye row, branch container, and size steppers
      const wyeRow = tip.querySelector('#teWye')?.closest('.te-row');
      const branchBlock = tip.querySelector('#branchBlock');
      const aSect = tip.querySelector('#branchASection');
      const bSect = tip.querySelector('#branchBSection');
      const sizeMinus = tip.querySelector('#sizeMinus');
      const sizePlus  = tip.querySelector('#sizePlus');

      // Remove any prior segSwitch from previous opens, then recreate
      let wrap = tip.querySelector('#segSwitch');
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      wrap = document.createElement('div');
      wrap.id = 'segSwitch';
      wrap.className = 'segSwitch';
      wrap.style.display = 'none'; // default hidden, shown when Wye ON
      const mk = (label, seg)=>{
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'segBtn';
        b.dataset.seg = seg;
        b.textContent = label;
        return b;
      };
      const bMain = mk('Main','main');
      const bA    = mk('Line A','A');
      const bB    = mk('Line B','B');
      wrap.appendChild(bMain); wrap.appendChild(bA); wrap.appendChild(bB);
      tip.insertBefore(wrap, actions);

      function setActive(seg){
        // highlight
        [bMain,bA,bB].forEach(btn=>btn.classList.toggle('active', btn.dataset.seg===seg));

        // helper show/hide with robust a11y + style guards
        const hideEl = (el)=>{ if(!el) return; el.hidden = true; el.inert = true; el.style.display='none'; el.classList.add('is-hidden'); };
        const showEl = (el)=>{ if(!el) return; el.hidden = false; el.inert = false; el.style.display=''; el.classList.remove('is-hidden'); };

        const mainShow = (seg==='main');

        // show/hide main rows
        if (wyeRow) (mainShow? showEl : hideEl)(wyeRow);
        ['#rowSize','#rowLen','#rowElev','#rowNoz'].forEach(sel=>{
          const el = tip.querySelector(sel);
          if (el) (mainShow? showEl : hideEl)(el);
        });

        // legacy compact block wrapper only when on a branch
        if (branchBlock) (seg==='A'||seg==='B' ? showEl : hideEl)(branchBlock);

        
        // Hide the opposite side rows inside the legacy compact branchBlock
        if (branchBlock){
          const rowA_len = branchBlock.querySelector('#teLenA')?.closest('.te-row') || branchBlock.querySelector('label[for="teLenA"]')?.closest('.te-row');
          const rowA_noz = branchBlock.querySelector('#teNozA')?.closest('.te-row') || branchBlock.querySelector('label:contains("Branch A noz")')?.closest('.te-row');
          const rowB_len = branchBlock.querySelector('#teLenB')?.closest('.te-row') || branchBlock.querySelector('label[for="teLenB"]')?.closest('.te-row');
          const rowB_noz = branchBlock.querySelector('#teNozB')?.closest('.te-row') || branchBlock.querySelector('label:contains("Branch B noz")')?.closest('.te-row');
          if (seg==='A'){
            if (rowA_len) showEl(rowA_len);
            if (rowA_noz) showEl(rowA_noz);
            if (rowB_len) hideEl(rowB_len);
            if (rowB_noz) hideEl(rowB_noz);
          } else if (seg==='B'){
            if (rowA_len) hideEl(rowA_len);
            if (rowA_noz) hideEl(rowA_noz);
            if (rowB_len) showEl(rowB_len);
            if (rowB_noz) showEl(rowB_noz);
          }
        }
        // Exclusively show Branch sections
        if (seg==='A'){ showEl(aSect); hideEl(bSect); }
        else if (seg==='B'){ showEl(bSect); hideEl(aSect); }
        else { hideEl(aSect); hideEl(bSect); }

        // lock branch size to 1 3/4
        const sizeLabel = tip.querySelector('#sizeLabel');
        if (!mainShow){
          if (teSize) teSize.value = '1.75';
          if (sizeLabel) sizeLabel.textContent = '1 3/4″';
          if (sizeMinus) sizeMinus.disabled = true;
          if (sizePlus)  sizePlus.disabled  = true;
        }else{
          if (sizeMinus) sizeMinus.disabled = false;
          if (sizePlus)  sizePlus.disabled  = false;
        }

        // where label polish
        if (teWhere){
          teWhere.value = seg==='main' ? 'Main (to Wye)' : (seg==='A' ? 'Line A (left of wye)' : 'Line B (right of wye)');
        }
      }
function gateWyeBySize(){
        const sizeOK = (teSize && String(teSize.value) === '2.5');
        const wyeSelect = tip.querySelector('#teWye');
        if (!sizeOK){
          // force off & hide everything Wye-related
          if (wyeSelect) wyeSelect.value = 'off';
          wrap.style.display = 'none';
          if (branchBlock) branchBlock.style.display = 'none';
        }
        // hide or show the Wye row itself
        if (wyeRow) wyeRow.style.display = sizeOK ? '' : 'none';
        return sizeOK;
      }

      function updateWyeAndButtons(){
        const isOn = tip.querySelector('#teWye')?.value === 'on';
        const sizeOK = gateWyeBySize();
        wrap.style.display = (isOn && sizeOK) ? 'flex' : 'none';
        if (!(isOn && sizeOK)){
          // collapse back to Main if user turned Wye off or size is not 2.5
          setActive('main');
        }
      }

      // Bind
      [bMain,bA,bB].forEach(btn=>btn.addEventListener('click', ()=> setActive(btn.dataset.seg)));
      const wyeSel = tip.querySelector('#teWye');
      if (wyeSel){
        wyeSel.addEventListener('change', updateWyeAndButtons);
      }
      if (sizeMinus) sizeMinus.addEventListener('click', ()=>{ setTimeout(updateWyeAndButtons,0); });
      if (sizePlus)  sizePlus .addEventListener('click', ()=>{ setTimeout(updateWyeAndButtons,0); });

      // Initial state
      updateWyeAndButtons();
      // If user clicked a branch tip to open, start there; else Main
      if (whereInit==='L') setActive('A');
      else if (whereInit==='R') setActive('B');
      else setActive('main');
    }

    // Expose short hooks (scoped to this container instance)
    container.__segEnsureUI = __ensureSegUI;
  })();
// Segment switch elements
  const segSwitch  = container.querySelector('#segSwitch');
  const segBtns    = segSwitch ? Array.from(segSwitch.querySelectorAll('.segBtn')) : [];
  const branchASection = container.querySelector('#branchASection');
  const branchBSection = container.querySelector('#branchBSection');

  let currentSeg = 'main'; // 'main' | 'A' | 'B'

  function setSeg(seg){
    currentSeg = seg;

    // helper show/hide with robust a11y + style guards
    const hideEl = (el)=>{ if(!el) return; el.hidden = true; el.inert = true; el.style.display='none'; el.classList.add('is-hidden'); };
    const showEl = (el)=>{ if(!el) return; el.hidden = false; el.inert = false; el.style.display=''; el.classList.remove('is-hidden'); };

    // Highlight active button
    segBtns.forEach(b => b.classList.toggle('active', b.dataset.seg === seg));

    // Toggle visibility of rows depending on segment
    const mainRows = ['#rowSize','#rowLen','#rowElev','#rowNoz'];
    const wyeRow = container.querySelector('#teWye')?.closest('.te-row');
    mainRows.forEach(sel=>{
      const el = container.querySelector(sel);
      if (!el) return;
      (seg==='main' ? showEl : hideEl)(el);
    });
    if (wyeRow) (seg==='main' ? showEl : hideEl)(wyeRow);

    // Branch sections — show only selected branch when wye is on
    if (seg==='A'){ showEl(branchASection); hideEl(branchBSection); }
    else if (seg==='B'){ showEl(branchBSection); hideEl(branchASection); }
    else { hideEl(branchASection); hideEl(branchBSection); }

    
    // Additionally, for the legacy compact branchBlock, hide the opposite branch rows
    const branchBlock = container.querySelector('#branchBlock');
    if (branchBlock){
      const rowA_len = branchBlock.querySelector('#teLenA')?.closest('.te-row') || branchBlock.querySelector('label[for="teLenA"]')?.closest('.te-row');
      const rowA_noz = branchBlock.querySelector('#teNozA')?.closest('.te-row') || branchBlock.querySelector('label:contains("Branch A noz")')?.closest('.te-row');
      const rowB_len = branchBlock.querySelector('#teLenB')?.closest('.te-row') || branchBlock.querySelector('label[for="teLenB"]')?.closest('.te-row');
      const rowB_noz = branchBlock.querySelector('#teNozB')?.closest('.te-row') || branchBlock.querySelector('label:contains("Branch B noz")')?.closest('.te-row');
      if (seg==='A'){
        if (rowA_len) showEl(rowA_len);
        if (rowA_noz) showEl(rowA_noz);
        if (rowB_len) hideEl(rowB_len);
        if (rowB_noz) hideEl(rowB_noz);
      } else if (seg==='B'){
        if (rowA_len) hideEl(rowA_len);
        if (rowA_noz) hideEl(rowA_noz);
        if (rowB_len) showEl(rowB_len);
        if (rowB_noz) showEl(rowB_noz);
      } else {
        // main
        if (rowA_len) hideEl(rowA_len);
        if (rowA_noz) hideEl(rowA_noz);
        if (rowB_len) hideEl(rowB_len);
        if (rowB_noz) hideEl(rowB_noz);
      }
    }
    // Lock diameter on branches
    const sizeMinus = container.querySelector('#sizeMinus');
    const sizePlus  = container.querySelector('#sizePlus');
    const teSize    = container.querySelector('#teSize');
    const sizeLabel = container.querySelector('#sizeLabel');
    if (seg==='A' || seg==='B'){
      if (teSize) teSize.value = '1.75';
      if (sizeLabel) sizeLabel.textContent = '1 3/4″';
      if (sizeMinus) sizeMinus.disabled = true;
      if (sizePlus)  sizePlus.disabled  = true;
    } else {
      if (sizeMinus) sizeMinus.disabled = false;
      if (sizePlus)  sizePlus.disabled  = false;
    }

    // Update “Where” label
    const teWhere = container.querySelector('#teWhere');
    if (teWhere){
      teWhere.value = seg === 'main'
        ? 'Main (to Wye)'
        : seg === 'A'
          ? 'Line A (left of wye)'
          : 'Line B (right of wye)';
    }
  }
function updateSegSwitchVisibility(){
    const wyeOn = teWye && teWye.value === 'on';
    if (segSwitch){
      // Hide seg switch UI completely; logic still works but buttons are not shown
      segSwitch.style.display = 'none';
    }
    if (!wyeOn){
      // Wye turned OFF → back to main and hide both branches
      setSeg('main');
      return;
    }
    // Wye turned ON → keep whatever segment matches the clicked "+" (main, A, or B)
    setSeg(currentSeg);
  }

  // Bind seg buttons
  segBtns.forEach(btn=>btn.addEventListener('click', ()=> setSeg(btn.dataset.seg)));

  const branchBlock = container.querySelector('#branchBlock');
  const rowNoz      = container.querySelector('#rowNoz');


  // Populate nozzle selects, prioritizing Department Setup choices if available
  function buildNozzleOptionsHTML() {
    const fullList = Array.isArray(NOZ_LIST) ? NOZ_LIST : [];
    let deptIds = [];

    try {
      if (typeof getDeptNozzleIds === 'function') {
        const ids = getDeptNozzleIds() || [];
        if (Array.isArray(ids)) {
          deptIds = ids.filter(x => typeof x === 'string' && x.trim().length > 0);
        }
      }
    } catch (_e) {
      deptIds = [];
    }

    // If department has selected nozzles, show ONLY those.
    if (deptIds.length) {
      const deptSet = new Set(deptIds);
      const deptOpts = fullList
        .filter(n => n && n.id && deptSet.has(n.id))
        .map(n => `<option value="${n.id}">${n.name || n.label || n.id}</option>`)
        .join('');

      // If none of the ids matched the known nozzle list, fall back to plain full list
      if (!deptOpts) {
        return fullList
          .map(n => `<option value="${n.id}">${n.name || n.label || n.id}</option>`)
          .join('');
      }

      return deptOpts;
    }

    // Default: full list only (no department config yet)
    return fullList
      .map(n => `<option value="${n.id}">${n.name || n.label || n.id}</option>`)
      .join('');
  }

  const nozzleOptionsHTML = buildNozzleOptionsHTML();
  [teNoz, teNozA, teNozB].forEach(sel => {
    if (!sel) return;
    sel.innerHTML = nozzleOptionsHTML;
  });


  // Panels controlled by waterSupply.js
  const hydrantHelper = container.querySelector('#hydrantHelper');
  const staticHelper  = container.querySelector('#staticHelper');
  const relayMount    = container.querySelector('#relayMount');

  /* -------------------------- Water Supply wiring ------------------------- */

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
      hydrantResult:   '#hydrantResult',
      tTripAll:        '#tTripAll',
      tTripApplyAll:  '#tTripApplyAll'}
  });

  
  
  // Tender Shuttle: Round Trip apply-to-all + autofill + compact styles
  try {
    const tTripAllEl = container.querySelector('#tTripAll');
    const tTripApplyAllEl = container.querySelector('#tTripApplyAll');
    if (tTripApplyAllEl) {
      tTripApplyAllEl.addEventListener('click', ()=>{
        const minutes = (tTripAllEl ? parseFloat(tTripAllEl.getAttribute('data-min') || (tTripAllEl.textContent||'0')) : 0) || 0;
        let applied = false;
        try {
          if (waterSupply && typeof waterSupply.setAllRoundTripMinutes === 'function') {
            waterSupply.setAllRoundTripMinutes(minutes);
            applied = true;
          }
        } catch(e){}
        if (!applied) {
          const list = container.querySelectorAll('#tenderList input[name="trip"], #tenderList input[data-role="trip"]');
          list.forEach(inp => {
            inp.value = String(minutes);
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          });
          document.dispatchEvent(new CustomEvent('tender-apply-trip', { detail: { minutes } }));
        }
        try { refreshSupplySummary(); markDirty(); } catch(_){}
      });
    }
    let __tripAutofilled = false;
    const tenderListEl = container.querySelector('#tenderList');
    if (tenderListEl) {
      tenderListEl.addEventListener('input', (e)=>{
        const t = e.target;
        if (__tripAutofilled || !t) return;
        const isTrip = (t.name === 'trip') || (t.dataset.role === 'trip');
        if (!isTrip) return;
        const v = parseFloat(t.value);
        if (v > 0) {
          if (tTripAllEl && (tTripAllEl.getAttribute('data-min') === '0' || tTripAllEl.textContent === '—' || !tTripAllEl.textContent)) {
            tTripAllEl.setAttribute('data-min', String(v));
            tTripAllEl.textContent = String(v);
            __tripAutofilled = true;
          }
        }
      });
    }
  } catch(_){}

  (function(){
    try{
      const css = `
        .shuttleMeta .btn{ padding:6px 10px; font-size:12px; }
        @media (max-width:520px){
          .shuttleMeta{ width:100%; justify-content:space-between; }
          .shuttleMeta .gpmLine{ font-weight:700; }
          .shuttleMeta .tripCtrl input{ width:70px; }
          .helperPanel .field label{ font-size:12px; }
        }`;
      const st = document.createElement('style');
      st.textContent = css;
      document.head.appendChild(st);
    }catch(_){}
  })();
// Global Round Trip apply-to-all
  try {
    const tTripAllEl = container.querySelector('#tTripAll');
    const tTripApplyAllEl = container.querySelector('#tTripApplyAll');
    if (tTripApplyAllEl) {
      tTripApplyAllEl.addEventListener('click', ()=>{
        const minutes = (tTripAllEl ? parseFloat(tTripAllEl.getAttribute('data-min') || (tTripAllEl.textContent||'0')) : 0) || 0;
        let applied = false;
        try {
          if (waterSupply && typeof waterSupply.setAllRoundTripMinutes === 'function') {
            waterSupply.setAllRoundTripMinutes(minutes);
            applied = true;
          }
        } catch(e){}
        if (!applied) {
          // Fallback: set all tender "trip" inputs in the list and dispatch input events
          const list = container.querySelectorAll('#tenderList input[name="trip"], #tenderList input[data-role="trip"]');
          list.forEach(inp => {
            inp.value = String(minutes);
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          });
          // Dispatch a custom event for any listeners
          const evt = new CustomEvent('tender-apply-trip', { detail: { minutes } });
          document.dispatchEvent(evt);
        }
        // Recompute summary if present
        try {
          refreshSupplySummary();
          markDirty();
        } catch(_){}
      });
    }
  } catch(_){}
// Helper to pick the best snapshot API if present
  function pickWaterSnapshotSafe(){
    try {
      if (typeof waterSupply.getSnapshot === 'function') return waterSupply.getSnapshot();
      if (typeof waterSupply.snapshot    === 'function') return waterSupply.snapshot();
      if (typeof waterSupply.export      === 'function') return waterSupply.export();
    } catch {}
    // Best-effort DOM fallback if no API:
    try {
      const tenders = [];
      const list = container.querySelectorAll('#tenderList [data-tender]');
      list.forEach(node=>{
        tenders.push({
          id: node.getAttribute('data-id') || node.querySelector('.tenderName')?.textContent?.trim(),
          cap: +(node.getAttribute('data-cap') || node.querySelector('[data-cap]')?.textContent || 0)
        });
      });
      const gpm = +(container.querySelector('#shuttleTotalGpm')?.textContent || 0);
      return { tenders, shuttle: { totalGpm: gpm } };
    } catch {}
    return null;
  }

  // Restore water snapshot after WaterSupplyUI exists
  try {
    const snap = saved_at_mount?.water;
    if (snap && typeof waterSupply.restoreSnapshot === 'function') {
      waterSupply.restoreSnapshot(snap);
    } else if (snap && typeof waterSupply.setSnapshot === 'function') {
      waterSupply.setSnapshot(snap);
    } else if (snap && typeof waterSupply.import === 'function') {
      waterSupply.import(snap);
    } else if (snap) {
      // Fallback: try common field names on state
      if (snap.tenders) state.tenders = snap.tenders;
      if (snap.shuttle) state.shuttle = snap.shuttle;
    }
  } catch {}

  // Start autosave heartbeat (includes water snapshot)
  startAutoSave(()=>{
    const waterSnap = pickWaterSnapshotSafe();
    return buildSnapshot(waterSnap);
  });

  // Observe Tender Shuttle UI to persist on changes, too
  const tenderListEl = container.querySelector('#tenderList');
  const shuttleEl    = container.querySelector('#shuttleTotalGpm');
  const mo = new MutationObserver(() => {
    enhanceTenderListStyle();
    refreshSupplySummary();
    markDirty();
  });
  if (tenderListEl) mo.observe(tenderListEl, {childList:true, subtree:true, characterData:true});
  if (shuttleEl)    mo.observe(shuttleEl,    {childList:true, subtree:true, characterData:true});

  /* ---------------------------- Totals & KPIs ----------------------------- */

  function renderPresetLineButtons(){
    if (!presetButtonsRow) return;
    presetButtonsRow.innerHTML = '';
    const entries = Object.values(activePresetLines);
    if (!entries.length) return;
    entries.forEach(pl => {
      if (!pl) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'linebtn preset-line-btn';
      btn.textContent = pl.name || 'Preset';
      btn.dataset.presetId = pl.id || '';
      presetButtonsRow.appendChild(btn);
    });
  }

  function openPresetLineEditor(presetLine, opts = {}){
    const onSave = typeof opts.onSave === 'function' ? opts.onSave : ()=>{};
    const onDelete = typeof opts.onDelete === 'function' ? opts.onDelete : ()=>{};

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const panel = document.createElement('div');
    panel.style.background = '#020617';
    panel.style.color = '#e5e7eb';
    panel.style.borderRadius = '16px';
    panel.style.padding = '16px';
    panel.style.width = '100%';
    panel.style.maxWidth = '420px';
    panel.style.boxSizing = 'border-box';
    panel.style.boxShadow = '0 18px 30px rgba(15,23,42,0.75)';
    overlay.appendChild(panel);

    const cfg = (presetLine && presetLine.config) ? presetLine.config : {};

    panel.innerHTML = `
      <h3 style="margin:0 0 8px;font-size:1rem;font-weight:600;">
        ${presetLine.name || 'Preset line'}
      </h3>
      <p style="margin:0 0 12px;font-size:0.85rem;opacity:0.85;">
        Edit hose, length, nozzle, and elevation for this preset line.
      </p>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:0.85rem;">
        <label>Hose diameter (inches)
          <input id="plHose" type="number" inputmode="decimal" style="width:100%;margin-top:2px;"
                 value="${cfg.hoseDiameter ?? ''}">
        </label>
        <label>Length (ft)
          <input id="plLen" type="number" inputmode="numeric" style="width:100%;margin-top:2px;"
                 value="${(typeof cfg.lengthFt === 'number' ? cfg.lengthFt : (cfg.lengthFt ?? ''))}">
        </label>
        <label>Nozzle ID
          <input id="plNoz" type="text" style="width:100%;margin-top:2px;"
                 value="${cfg.nozzleId ?? ''}">
        </label>
        <label>Elevation (+/- ft)
          <input id="plElev" type="number" inputmode="numeric" style="width:100%;margin-top:2px;"
                 value="${(typeof cfg.elevation === 'number' ? cfg.elevation : (cfg.elevation ?? 0))}">
        </label>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
        <button type="button" id="plDeleteBtn" class="btn" style="background:#7f1d1d;color:#fee2e2;">
          Remove line
        </button>
        <button type="button" id="plCancelBtn" class="btn" style="background:#0f172a;">
          Cancel
        </button>
        <button type="button" id="plSaveBtn" class="btn btn-primary">
          Save
        </button>
      </div>
    `;

    function close(){
      overlay.remove();
    }

    panel.querySelector('#plCancelBtn')?.addEventListener('click', ()=>{
      close();
    });
    panel.querySelector('#plDeleteBtn')?.addEventListener('click', ()=>{
      close();
      onDelete();
    });
    panel.querySelector('#plSaveBtn')?.addEventListener('click', ()=>{
      const hose = panel.querySelector('#plHose');
      const len  = panel.querySelector('#plLen');
      const noz  = panel.querySelector('#plNoz');
      const elev = panel.querySelector('#plElev');

      const edited = {
        hoseDiameter: hose && hose.value ? hose.value.trim() : '',
        lengthFt: len && len.value ? Number(len.value) : null,
        nozzleId: noz && noz.value ? noz.value.trim() : '',
        elevation: elev && elev.value ? Number(elev.value) : 0,
      };
      close();
      onSave(edited);
    });

    document.body.appendChild(overlay);
  }

  function refreshTotals(){
    const vis = Object.entries(state.lines).filter(([_k,l])=>l.visible);
    let totalGPM = 0, maxPDP = -Infinity, maxKey = null;

    // Department lines (Line 1/2/3)
    vis.forEach(([key, L])=>{
      const single = isSingleWye(L);
      const flow = single ? (activeNozzle(L)?.gpm||0)
                 : L.hasWye ? (L.nozLeft?.gpm||0) + (L.nozRight?.gpm||0)
                            : (L.nozRight?.gpm||0);
      const mainFL = FL_total_sections(flow, L.itemsMain);
      let PDP=0;
      if(single){
        const side = activeSide(L);
        const bnSegs = side==='L' ? L.itemsLeft : L.itemsRight;
        const bnNoz  = activeNozzle(L);
        const branchFL = FL_total_sections(bnNoz.gpm, bnSegs);
        PDP = bnNoz.NP + branchFL + mainFL + (L.elevFt * PSI_PER_FT);
      }else if(L.hasWye){
        const lNeed = FL_total_sections(L.nozLeft?.gpm||0, L.itemsLeft) + (L.nozLeft?.NP||0);
        const rNeed = FL_total_sections(L.nozRight?.gpm||0, L.itemsRight) + (L.nozRight?.NP||0);
        PDP = Math.max(lNeed, rNeed) + mainFL + (L.wyeLoss||10) + (L.elevFt * PSI_PER_FT);
      }else{
        PDP = (L.nozRight?.NP||0) + mainFL + (L.elevFt * PSI_PER_FT);
      }
      totalGPM += flow;
      if(PDP > maxPDP){ maxPDP = PDP; maxKey = key; }
    });

    // Extra preset lines (Foam, Blitz, etc.) that flow in addition to Lines 1–3.
    Object.values(activePresetLines).forEach(pl => {
      if (!pl || !pl.config) return;
      const cfg = pl.config;
      const noz = (cfg.nozzleId && NOZ[cfg.nozzleId]) || null;
      if (!noz) return;
      const flow = noz.gpm || 0;
      const lengthFt = (typeof cfg.lengthFt === 'number' ? cfg.lengthFt : 0);
      const size = cfg.hoseDiameter || '1.75';
      const mainSegs = [{ size, lengthFt }];
      const mainFL = FL_total_sections(flow, mainSegs);
      const elevFt = (typeof cfg.elevation === 'number' ? cfg.elevation : 0);
      const PDP = noz.NP + mainFL + (elevFt * PSI_PER_FT);
      totalGPM += flow;
      if (PDP > maxPDP) { maxPDP = PDP; }
    });

    state.lastMaxKey = maxKey;
    const anyLines = vis.length || Object.keys(activePresetLines).length;
    GPMel.textContent = anyLines ? (Math.round(totalGPM)+' gpm') : '— gpm';
    PDPel.classList.remove('orange','red');
    if(anyLines){
      const v = Math.round(maxPDP);
      PDPel.textContent = v+' psi';
      if(v>250) PDPel.classList.add('red');
      else if(v>200) PDPel.classList.add('orange');
    }else{
      PDPel.textContent = '— psi';
    }
  }

  /* --------------------------- Lines math panel --------------------------- */

  function renderLinesPanel(){
    const anyDeployed = Object.values(state.lines).some(l=>l.visible);
    if(!anyDeployed || !state.showMath){ linesTable.innerHTML=''; linesTable.classList.add('is-hidden'); return; }
    linesTable.classList.remove('is-hidden'); linesTable.innerHTML='';

    ['left','back','right'].forEach(key=>{
      const L = state.lines[key];
      const row = document.createElement('div'); row.className='lineRow';
      const segs = L.itemsMain.length ? L.itemsMain.map(s=>s.lengthFt+'′ '+sizeLabel(s.size)).join(' + ') : 'empty';
      const single = isSingleWye(L);
      const usedNoz = single ? activeNozzle(L) : L.hasWye ? null : L.nozRight;
      const flow = single ? (usedNoz?.gpm||0) : (L.hasWye ? (L.nozLeft.gpm + L.nozRight.gpm) : L.nozRight.gpm);

      const head = document.createElement('div'); head.className='lineHeader'; head.innerHTML = `
        <span class="title">${L.label}</span>
        <span class=\"tag\">Main: ${breakdownText(L.itemsMain)}</span>
        <span class="tag">Flow: ${flow} gpm</span>
        <span class="tag">${L.visible? 'DEPLOYED':'not deployed'}</span>
      `;
      row.appendChild(head);
      linesTable.appendChild(row);

      if(L.visible){
        const bflow = flow;
        const wrap = document.createElement('div');

        if(L.hasWye && !single){
          const wye = (L.wyeLoss ?? 10);
          wrap.innerHTML = `
            <details class="math" open>
              <summary>Line math</summary>
              <div class="hoseviz">
                <div class="hoseLegend">
                  <span class="legSwatch sw175"></span> 1¾″
                  <span class="legSwatch sw25"></span> 2½″
                  <span class="legSwatch sw5"></span> 5″
                </div>
                <div class="barWrap">
                  <div class="barTitle">Main ${breakdownText(L.itemsMain)} @ ${bflow} gpm — Wye ${wye} psi</div>
                  <div class="hosebar" id="viz_main_${key}"></div>
                </div>
                <div class="barWrap">
                  <div class="barTitle">Branch A ${breakdownText(L.itemsLeft)} @ ${L.nozLeft.gpm} gpm — NP ${L.nozLeft.NP} psi</div>
                  <div class="hosebar" id="viz_L_${key}"></div>
                </div>
                <div class="barWrap">
                  <div class="barTitle">Branch B ${breakdownText(L.itemsRight)} @ ${L.nozRight.gpm} gpm — NP ${L.nozRight.NP} psi</div>
                  <div class="hosebar" id="viz_R_${key}"></div>
                </div>
                <div class="simpleBox" id="pp_simple_${key}"></div>
              </div>
            </details>
          `;
          linesTable.appendChild(wrap);

          drawHoseBar(document.getElementById('viz_main_'+key), sectionsFor(L.itemsMain), bflow, 0, 'Main '+breakdownText(L.itemsMain)+' @ '+bflow+' gpm', 'Wye '+wye);
          drawHoseBar(document.getElementById('viz_L_'+key), sectionsFor(L.itemsLeft), L.nozLeft?.gpm||0, L.nozLeft?.NP||0, 'Branch A '+breakdownText(L.itemsLeft));
          drawHoseBar(document.getElementById('viz_R_'+key), sectionsFor(L.itemsRight), L.nozRight?.gpm||0, L.nozRight?.NP||0, 'Branch B '+breakdownText(L.itemsRight));
          document.getElementById('pp_simple_'+key).innerHTML = ppExplainHTML(L);

        } else if(single){
          const side = activeSide(L);
          const bnSegs = side==='L'? L.itemsLeft : L.itemsRight;
          const bnTitle = side==='L' ? 'Branch A' : 'Branch B';
          const noz = activeNozzle(L);
          const wye = (L.wyeLoss ?? 10);

          wrap.innerHTML = `
            <details class="math" open>
              <summary>Line math</summary>
              <div class="hoseviz">
                <div class="hoseLegend">
                  <span class="legSwatch sw175"></span> 1¾″
                  <span class="legSwatch sw25"></span> 2½″
                  <span class="legSwatch sw5"></span> 5″
                </div>
                <div class="barWrap">
                  <div class="barTitle">Main ${breakdownText(L.itemsMain)} @ ${bflow} gpm — via Wye</div>
                  <div class="hosebar" id="viz_main_${key}"></div>
                </div>
                <div class="barWrap">
                  <div class="barTitle">${bnTitle} ${breakdownText(bnSegs)} @ ${noz.gpm} gpm — NP ${noz.NP} psi</div>
                  <div class="hosebar" id="viz_BR_${key}"></div>
                </div>
                <div class="simpleBox" id="pp_simple_${key}"></div>
              </div>
            </details>
          `;
          linesTable.appendChild(wrap);

          drawHoseBar(document.getElementById('viz_main_'+key), sectionsFor(L.itemsMain), bflow, 0, 'Main '+breakdownText(L.itemsMain)+' @ '+bflow+' gpm', 'Wye '+wye);
          drawHoseBar(document.getElementById('viz_BR_'+key), sectionsFor(bnSegs), noz?.gpm||0, noz?.NP||0, bnTitle+' '+(sumFt(bnSegs)||0)+'′');
          document.getElementById('pp_simple_'+key).innerHTML = ppExplainHTML(L);

        } else {
          wrap.innerHTML = `
            <details class="math" open>
              <summary>Line math</summary>
              <div class="hoseviz">
                <div class="hoseLegend">
                  <span class="legSwatch sw175"></span> 1¾″
                  <span class="legSwatch sw25"></span> 2½″
                  <span class="legSwatch sw5"></span> 5″
                </div>
                <div class="barWrap">
                  <div class="barTitle">Main ${breakdownText(L.itemsMain)} @ ${bflow} gpm — NP ${L.nozRight.NP} psi</div>
                  <div class="hosebar" id="viz_main_${key}"></div>
                </div>
                <div class="simpleBox" id="pp_simple_${key}"></div>
              </div>
            </details>
          `;
          linesTable.appendChild(wrap);

          drawHoseBar(document.getElementById('viz_main_'+key), sectionsFor(L.itemsMain), bflow, (L.nozRight?.NP||0), 'Main '+breakdownText(L.itemsMain)+' @ '+bflow+' gpm');
          document.getElementById('pp_simple_'+key).innerHTML = ppExplainHTML(L);
        }
      }
    });
  }

  /* ------------------------ Hydrant/Tender summary ------------------------ */

  function refreshSupplySummary(){
    const box = supplySummaryEl; if(!box) return;
    let html = '';
    if (state.supply === 'pressurized') {
      html = `<div class="row"><span class="k">Supply Mode</span><span class="v">Hydrant (pressurized)</span></div>`;
    } else if (state.supply === 'static') {
      const g = +(container.querySelector('#shuttleTotalGpm')?.textContent||0);
      html = `
        <div class="row"><span class="k">Supply Mode</span><span class="v">Tender shuttle</span></div>
        <div class="row"><span class="k">Total Shuttle GPM</span><span class="v"><b>${Math.round(g)}</b> gpm</span></div>
      `;
    }
    if (html) { box.innerHTML = html; box.style.display = 'block'; }
    else { box.innerHTML = ''; box.style.display = 'none'; }
  }

  /* ------------------------------ Why? button ----------------------------- *//* ------------------------------ Why? button ----------------------------- */

  container.querySelector('#whyBtn').addEventListener('click', ()=>{
    const anyDeployed = Object.values(state.lines).some(l=>l.visible);
    if(!anyDeployed){ alert('Deploy a line to see Pump Pressure breakdown.'); return; }
    if(!state.showMath){ state.showMath = true; renderLinesPanel(); }
    if(!state.lastMaxKey) return;
    const target = container.querySelector('#pp_simple_'+state.lastMaxKey);
    if(target){
      target.scrollIntoView({behavior:'smooth', block:'center'});
      const details = target.closest('details'); if(details && !details.open){ details.open = true; }
    }
  });

  /* ------------------------- Tip editor interactions ---------------------- */

  let editorContext=null;

  function setBranchABEditorDefaults(key){
    if(teNozA) teNozA.value = (state.lines[key].nozLeft?.id) || teNozA.value;
    if(teNozB) teNozB.value = (state.lines[key].nozRight?.id) || teNozB.value;
    if(teLenA) teLenA.value = (state.lines[key].itemsLeft[0]?.lengthFt)||0;
    if(teLenB) teLenB.value = (state.lines[key].itemsRight[0]?.lengthFt)||0;
  }

  function showHideMainNozzleRow(){
    const where = teWhere?.value?.toLowerCase();
    const wyeOn = teWye?.value==='on';
    if(rowNoz) rowNoz.style.display = (where==='main' && wyeOn) ? 'none' : '';
  }

  
// Sync stepper labels (diameter, length, elevation) with hidden values
function refreshEditorVisualsFromFields(){
  try{
    const root = container || document;
    if(!root) return;

    // Diameter label
    const sizeInput = root.querySelector('#teSize');
    const sizeLabelEl = root.querySelector('#sizeLabel');
    if(sizeInput && sizeLabelEl){
      const val = String(sizeInput.value||'').trim();
      let label = val;
      if(val === '1.75') label = '1 3/4″';
      else if(val === '2.5') label = '2 1/2″';
      else if(val === '5') label = '5″';
      sizeLabelEl.textContent = label;
    }

    // Length label
    const lenInput = root.querySelector('#teLen');
    const lenLabelEl = root.querySelector('#lenLabel');
    if(lenInput && lenLabelEl){
      const v = parseInt(lenInput.value||'0',10) || 0;
      lenLabelEl.textContent = `${v}′`;
    }

    // Elevation label
    const elevInput = root.querySelector('#teElev');
    const elevLabelEl = root.querySelector('#elevLabel');
    if(elevInput && elevLabelEl){
      const v = parseInt(elevInput.value||'0',10) || 0;
      elevLabelEl.textContent = `${v}′`;
    }
  }catch(_){}
}

function onOpenPopulateEditor(key, where, opts = {}){ window._openTipEditor = onOpenPopulateEditor; 
    const L = seedDefaultsForKey(key);
    L.visible = true;
    editorContext = {key, where};

    // Optional: hide elevation controls when launched from Presets
    const hideElev = opts && opts.hideElevation;
    try {
      const rowElevMain = container.querySelector('#rowElev');
      if (rowElevMain) {
        if (hideElev) hideEl(rowElevMain); else showEl(rowElevMain);
      }

      ['#teElevA', '#teElevB'].forEach(sel => {
        const elevInput = container.querySelector(sel);
        if (!elevInput) return;
        const row = elevInput.closest('.te-row');
        if (!row) return;
        if (hideElev) hideEl(row); else showEl(row);
      });
    } catch (_e) {
      // Non-fatal: editor still works even if we couldn't toggle elevation rows
    }


    const whereLabel = where==='main'?'Main':('Branch '+where);
    teTitle.textContent = (L.label || key.toUpperCase())+' — '+whereLabel;
    teWhere.value = where.toUpperCase();
    teElev.value = L.elevFt||0;
    teWye.value  = L.hasWye? 'on':'off';

    if(where==='main'){
      const mainSegs = Array.isArray(L.itemsMain) && L.itemsMain.length
        ? L.itemsMain
        : [{ size: '1.75', lengthFt: 200 }];
      const sizeMain = mainSegs[0].size || '1.75';
      const totalLenMain = sumFt(mainSegs);
      teSize.value = sizeMain;
      teLen.value = totalLenMain || mainSegs[0].lengthFt || 0;

      // Main nozzle: prefer existing, otherwise ensure a default based on diameter
      if (L.nozRight?.id && teNoz){
        teNoz.value = L.nozRight.id;
      } else {
        ensureDefaultNozzleFor(L, 'main', sizeMain);
        if (L.nozRight?.id && teNoz) teNoz.value = L.nozRight.id;
      }

      // For a Wye, also make sure branches have their defaults seeded
      if (L.hasWye) {
        setBranchBDefaultIfEmpty(L); // ensure B default when wye on
      }
    } else if(where==='L'){
      const seg = L.itemsLeft[0] || {size:'1.75',lengthFt:100};
      teSize.value = seg.size; teLen.value = seg.lengthFt;
      ensureDefaultNozzleFor(L,'L',seg.size);
      if(teNoz) teNoz.value = (L.nozLeft?.id)||teNoz.value;
    } else {
      const seg = L.itemsRight[0] || {size:'1.75',lengthFt:100};
      teSize.value = seg.size; teLen.value = seg.lengthFt;
      setBranchBDefaultIfEmpty(L);
    }

    // After populating hidden values, sync the visible stepper labels
    refreshEditorVisualsFromFields();

    setBranchABEditorDefaults(key);
    showHideMainNozzleRow();
  }
  // Branch nozzle change listeners (mirror main lines)
  try {
    const nozA = tip.querySelector('#teNozA');
    const nozB = tip.querySelector('#teNozB');
    if (nozA) nozA.addEventListener('change', () => {
      try {
        const id = nozA.value;
        if (id && NOZ && NOZ[id]) { L.nozLeft = NOZ[id]; }
        // lock branch hose size to 1.75 is handled elsewhere in calc; just recompute
        recompute();
        render();
      } catch(_){}
    });
    if (nozB) nozB.addEventListener('change', () => {
      try {
        const id = nozB.value;
        if (id && NOZ && NOZ[id]) { L.nozRight = NOZ[id]; }
        recompute();
        render();
      } catch(_){}
    });
  } catch(_){}


  // Change of diameter in editor → update default nozzle (when applicable)
  teSize?.addEventListener('change', ()=>{
    if(!editorContext) return;
    const {key, where} = editorContext;
    const L = state.lines[key];
    const size = teSize.value;
    if (where==='main' && teWye.value!=='on'){
      ensureDefaultNozzleFor(L,'main',size);
      if (L.nozRight?.id && teNoz) teNoz.value = L.nozRight.id;
    } else if (where==='L'){
      ensureDefaultNozzleFor(L,'L',size);
      if (L.nozLeft?.id && teNoz) teNoz.value = L.nozLeft.id;
    } else if (where==='R'){
      // Branch B keeps its “Fog 185 @ 50” rule if empty; otherwise honor size default
      if (!(L.nozRight?.id)) setBranchBDefaultIfEmpty(L);
    }
  });

  // Delegate click on "+"
  stageSvg.addEventListener('click', (e)=>{
    const tip = e.target.closest('.hose-end'); if(!tip) return;
    e.preventDefault(); e.stopPropagation();
    const key = tip.getAttribute('data-line'); const where = tip.getAttribute('data-where');
    onOpenPopulateEditor(key, where);
    if (container && container.__segEnsureUI) container.__segEnsureUI(where);
// Initialize segment selection based on clicked tip
    if (where==='L') setSeg('A'); else if (where==='R') setSeg('B'); else setSeg('main');
    updateSegSwitchVisibility();
if (window.BottomSheetEditor && typeof window.BottomSheetEditor.open === 'function'){
      window.BottomSheetEditor.open();
    } else {
      // Minimal fallback
      tipEditor.classList.remove('is-hidden');
      tipEditor.classList.add('is-open');
    }
  });

  // Keep rowNoz visibility in sync when Wye changes in-editor
  teWye?.addEventListener('change', ()=>{
    const branchWrap = popupEl?.querySelector?.("#branchPlusWrap");
    if(branchWrap){ const on = teWye.value==="on"; branchWrap.style.display = on? "": "none"; if(on) initBranchPlusMenus(popupEl); }
    const wyeOn = teWye.value==='on';
    if (editorContext?.where==='main' && wyeOn){
      const L = state.lines[editorContext.key];
      setBranchBDefaultIfEmpty(L);
      if(teNozB && L?.nozRight?.id) teNozB.value = L.nozRight.id;
    }
    showHideMainNozzleRow();
  });

  // Apply updates; close panel handled by bottom-sheet-editor.js (auto-close there)
  container.querySelector('#teApply').addEventListener('click', ()=>{
    if(!editorContext) return;
    const {key, where} = editorContext; const L = state.lines[key];
    const size = teSize.value; const len = Math.max(0, +teLen.value||0);
    const elev=+teElev.value||0; const wyeOn = teWye.value==='on';
    L.elevFt = elev;

    if(where==='main'){
      L.itemsMain = [{size, lengthFt:len}];
      if(!wyeOn){
        L.hasWye=false; L.itemsLeft=[]; L.itemsRight=[];
        // default nozzle by diameter if unset OR use chosen
        if (teNoz && teNoz.value && NOZ[teNoz.value]) L.nozRight = NOZ[teNoz.value];
        else ensureDefaultNozzleFor(L,'main',size);
      }else{
        L.hasWye=true;
        const lenA = Math.max(0, +teLenA?.value||0);
        const lenB = Math.max(0, +teLenB?.value||0);
        L.itemsLeft  = lenA? [{size:'1.75',lengthFt:lenA}] : [];
        L.itemsRight = lenB? [{size:'1.75',lengthFt:lenB}] : [];
        if (teNozA?.value && NOZ[teNozA.value]) L.nozLeft  = NOZ[teNozA.value];
        // Branch B default if empty
        if (!(L.nozRight?.id)){
          setBranchBDefaultIfEmpty(L);
        }
        if (teNozB?.value && NOZ[teNozB.value]) L.nozRight = NOZ[teNozB.value];
      }
    } else if(where==='L'){
      L.hasWye = wyeOn || true; L.itemsLeft = len? [{size, lengthFt:len}] : [];
      if (teNoz?.value && NOZ[teNoz.value]) L.nozLeft = NOZ[teNoz.value];
      else ensureDefaultNozzleFor(L,'L',size);
    } else {
      L.hasWye = wyeOn || true; L.itemsRight = len? [{size, lengthFt:len}] : [];
      if (!(L.nozRight?.id)){
        setBranchBDefaultIfEmpty(L);
      }
      if (typeof teNozB!=='undefined' && teNozB && teNozB.value && NOZ[teNozB.value]) L.nozRight = NOZ[teNozB.value];
    }

    L.visible = true; drawAll(); markDirty();
  });

  /* ---------------------------- Line toggles ------------------------------ */

  container.querySelectorAll('.linebtn').forEach(b=>{
    b.addEventListener('click', ()=>{
      const key=b.dataset.line; const L=seedDefaultsForKey(key);
      L.visible = !L.visible; b.classList.toggle('active', L.visible);
      drawAll(); markDirty();
    });
  });

  container.addEventListener('click', (e)=>{
    const btn = e.target.closest('.preset-line-btn');
    if (!btn) return;
    const id = btn.dataset.presetId;
    const pl = activePresetLines[id];
    if (!pl) return;

    openPresetLineEditor(pl, {
      onSave(edited){
        pl.config = Object.assign({}, pl.config || {}, edited || {});
        refreshTotals();
        renderPresetLineButtons();
        markDirty();
      },
      onDelete(){
        delete activePresetLines[id];
        refreshTotals();
        renderPresetLineButtons();
        markDirty();
      }
    });
  });


/* === Plus-menu steppers for Diameter, Length, Elevation, Nozzle === */

function initPlusMenus(root){
  // Build hose diameter sequence from department setup if available,
  // otherwise fall back to standard 1.75 / 2.5 / 5.
  let sizeSeq = [];
  try {
    if (typeof getDeptHoseDiameters === 'function') {
      const diams = getDeptHoseDiameters() || [];
      if (Array.isArray(diams) && diams.length) {
        sizeSeq = diams
          .map(d => {
            const val = String(d).trim();
            if (!val) return null;
            const plain =
              val === '1.75' ? '1 3/4″' :
              val === '1.5'  ? '1 1/2″' :
              val === '2.0'  ? '2″' :
              val === '2.5'  ? '2 1/2″' :
              val === '3'    ? '3″' :
              val === '4'    ? '4″' :
              val === '5'    ? '5″' :
              val + '"';
            return { val, labelPlain: plain };
          })
          .filter(Boolean);
      }
    }
  } catch (_e) {
    sizeSeq = [];
  }

  if (!sizeSeq.length) {
    sizeSeq = [
      { val: "1.75", labelPlain: "1 3/4″" },
      { val: "2.5",  labelPlain: "2 1/2″" },
      { val: "5",    labelPlain: "5″" }
    ];
  }

  const teSize = root.querySelector('#teSize');
  const sizeLabel = root.querySelector('#sizeLabel');
  const sizeMinus = root.querySelector('#sizeMinus');
  const sizePlus = root.querySelector('#sizePlus');
  let sizeIdx = Math.max(0, sizeSeq.findIndex(s => s.val === (teSize?.value || "1.75")));
  function drawSize(){ const item = sizeSeq[sizeIdx] || sizeSeq[0]; if(teSize) teSize.value = item.val; if(sizeLabel) sizeLabel.textContent = item.labelPlain; }
  function stepSize(d){ sizeIdx = (sizeIdx + d + sizeSeq.length) % sizeSeq.length; drawSize(); }
  sizeMinus?.addEventListener('click', ()=> stepSize(-1));
  sizePlus?.addEventListener('click', ()=> stepSize(+1));
  drawSize();

  const teLen = root.querySelector('#teLen');
  const lenLabel = root.querySelector('#lenLabel');
  const lenMinus = root.querySelector('#lenMinus');
  const lenPlus = root.querySelector('#lenPlus');
  const LEN_STEP=50, LEN_MIN=0, LEN_MAX=3000;
  function parseLen(){ return Math.max(LEN_MIN, Math.min(LEN_MAX, parseInt(teLen?.value||'0',10)||0)); }
  function drawLen(){ if(lenLabel) lenLabel.textContent = `${parseLen()}′`; }
  function stepLen(d){ let v = parseLen()+d; v=Math.max(LEN_MIN,Math.min(LEN_MAX,v)); if(teLen) teLen.value=String(v); drawLen(); }
  lenMinus?.addEventListener('click', ()=> stepLen(-LEN_STEP));
  lenPlus?.addEventListener('click', ()=> stepLen(+LEN_STEP));
  drawLen();

  const teElev = root.querySelector('#teElev');
  const elevLabel = root.querySelector('#elevLabel');
  const elevMinus = root.querySelector('#elevMinus');
  const elevPlus = root.querySelector('#elevPlus');
  const ELEV_STEP=10, ELEV_MIN=-500, ELEV_MAX=500;
  function parseElev(){ const v=parseInt(teElev?.value||'0',10); return isNaN(v)?0:Math.max(ELEV_MIN,Math.min(ELEV_MAX,v)); }
  function drawElev(){ if(elevLabel) elevLabel.textContent = `${parseElev()}′`; }
  function stepElev(d){ let v=parseElev()+d; v=Math.max(ELEV_MIN,Math.min(ELEV_MAX,v)); if(teElev) teElev.value=String(v); drawElev(); }
  elevMinus?.addEventListener('click', ()=> stepElev(-ELEV_STEP));
  elevPlus?.addEventListener('click', ()=> stepElev(+ELEV_STEP));
  drawElev();

  const teNoz = root.querySelector('#teNoz');
  if(teNoz && Array.isArray(NOZ_LIST)){
    teNoz.innerHTML = NOZ_LIST.map(n => {
      const label = n.name || n.desc || n.id || 'Nozzle';
      const val = n.id ?? label;
      return `<option value="${val}">${label}</option>`;
    }).join('');
  }

  if(!root.__plusMenuStyles){
    const s=document.createElement('style');
    s.textContent = `.te-row{display:grid;grid-template-columns:120px 1fr;gap:8px;align-items:center;margin:8px 0}
.steppers{display:flex;align-items:center;gap:8px;background:#0b1a29;border:1px solid var(--edge);border-radius:10px;padding:6px}
.stepBtn{background:#0b1320;border:1px solid var(--edge);border-radius:10px;color:#e9f1ff;font-weight:700;min-width:36px;height:36px}
.stepBtn:active{transform:translateY(1px)}
.stepVal{flex:1;text-align:center;font-weight:700}
@media (max-width:480px){.te-row{grid-template-columns:100px 1fr}.stepBtn{min-width:34px;height:34px}}`;
    root.appendChild(s);
    root.__plusMenuStyles = true;
  }
}


// Branch plus-menus for Wye
function initBranchPlusMenus(root){
  const LEN_STEP=50, LEN_MIN=0, LEN_MAX=3000;
  const ELEV_STEP=10, ELEV_MIN=-500, ELEV_MAX=500;

  function makeLen(elHidden, elLabel, minusBtn, plusBtn){
    function parse(){ return Math.max(LEN_MIN, Math.min(LEN_MAX, parseInt(elHidden?.value||'50',10)||50)); }
    function draw(){ if(elLabel) elLabel.textContent = `${parse()}′`; }
    function step(d){ let v = parse() + d; v = Math.max(LEN_MIN, Math.min(LEN_MAX, v)); if(elHidden) elHidden.value = String(v); draw(); }
    minusBtn?.addEventListener('click', ()=> step(-LEN_STEP));
    plusBtn?.addEventListener('click', ()=> step(+LEN_STEP));
    draw();
  }

  function makeElev(elHidden, elLabel, minusBtn, plusBtn){
    function parse(){ const v = parseInt(elHidden?.value||'0',10); return isNaN(v)?0:Math.max(ELEV_MIN, Math.min(ELEV_MAX, v)); }
    function draw(){ if(elLabel) elLabel.textContent = `${parse()}′`; }
    function step(d){ let v = parse() + d; v = Math.max(ELEV_MIN, Math.min(ELEV_MAX, v)); if(elHidden) elHidden.value = String(v); draw(); }
    minusBtn?.addEventListener('click', ()=> step(-ELEV_STEP));
    plusBtn?.addEventListener('click', ()=> step(+ELEV_STEP));
    draw();
  }

  function fillNozzles(sel){
    try{
      if(!sel || !Array.isArray(NOZ_LIST)) return;
    }catch(e){}
    if(!sel) return;
    sel.innerHTML = NOZ_LIST.map(n=>{
      const label = n.name || n.desc || n.id || 'Nozzle';
      const val = n.id ?? label;
      return `<option value="${val}">${label}</option>`;
    }).join('');
  }

  // Branch A
  makeLen(
    root.querySelector('#teLenA'),
    root.querySelector('#lenALabel'),
    root.querySelector('#lenAMinus'),
    root.querySelector('#lenAPlus')
  );
  makeElev(
    root.querySelector('#teElevA'),
    root.querySelector('#elevALabel'),
    root.querySelector('#elevAMinus'),
    root.querySelector('#elevAPlus')
  );
  fillNozzles(root.querySelector('#teNozA'));

  // Branch B
  makeLen(
    root.querySelector('#teLenB'),
    root.querySelector('#lenBLabel'),
    root.querySelector('#lenBMinus'),
    root.querySelector('#lenBPlus')
  );
  makeElev(
    root.querySelector('#teElevB'),
    root.querySelector('#elevBLabel'),
    root.querySelector('#elevBMinus'),
    root.querySelector('#elevBPlus')
  );
  fillNozzles(root.querySelector('#teNozB'));
}


/* AUTO-RESET & PRESETS-HIDE ON LOAD */
;


    document.addEventListener('tender-trip-stopped', (ev)=>{
      try{
        const mins = ev && ev.detail && parseFloat(ev.detail.minutes);
        if (mins && mins > 0){
          const el = container.querySelector('#tTripAll');
          if (el){
            el.setAttribute('data-min', String(mins));
            el.textContent = String(mins);
          }
        }
      }catch(_){}
    });
    
(function(){
  try{
    const st = document.createElement('style');
    st.textContent = `
    .segSwitch{display:flex;gap:6px;margin:6px 0 4px}
    .segBtn{padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.2)}
    .segBtn.active{background:rgba(59,130,246,.25);border-color:rgba(59,130,246,.6)}
.pillVal{padding:2px 6px;border-radius:6px;background:rgba(255,255,255,.08);font-variant-numeric:tabular-nums}

    .segSwitch{display:flex;align-items:center;justify-content:flex-start;flex-wrap:wrap}
    .segBtn{padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);font-size:.85rem}
    .segBtn.active{background:var(--brand,rgba(59,130,246,.25));border-color:rgba(59,130,246,.6)}
    `;
    document.head.appendChild(st);
  }catch(_){}
})();




/* ==========================================================================
   Wye "+ menus" toolbar (Main / Left / Right)
   Non-destructive: operates on DOM only; no reliance on outer variables.
   Appears only when Wye = On and size = 2.5". Hides legacy segSwitch.
   ========================================================================== */
