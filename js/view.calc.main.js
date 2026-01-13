;

// --- legacy nozzle id normalization (keeps nozzle dropdown from "sticking") ---
function _normNozId(id){
  const s = String(id ?? '').trim();
  if (!s) return '';
  if (s === 'sb_78_50_160' || s === 'sb_7_8' || s === 'sb78' || s === 'sb_78') return 'sb7_8';
  if (s === 'sb_1516_50_185' || s === 'sb_15_16' || s === 'sb1516' || s === 'sb_1516') return 'sb15_16';
  if (s === 'sb_1_50_210') return 'sb1';
  if (s === 'sb_1_1_8_50_265') return 'sb1_1_8';
  if (s === 'sb_1_1_4_50_328') return 'sb1_1_4';
  if (s === 'chiefXD165' || s === 'chiefXD165_50') return 'chiefXD165_50';
  if (s === 'chiefXD200' || s === 'chiefXD200_75') return 'chiefXD200_75';
  if (s === 'chiefXD256' || s === 'chiefXD256_50' || s === 'chiefXD265_50') return 'chiefXD265';
  return s;
}


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

// Web vs App feature gating (Presets / Dept Setup are app-only)
function isNativeApp(){
  try{
    if (window?.Capacitor?.isNativePlatform) return !!window.Capacitor.isNativePlatform();
    const p = window?.Capacitor?.getPlatform?.();
    if (p && p !== 'web') return true;
  }catch(_e){}
  const proto = (window?.location?.protocol || '').toLowerCase();
  return proto === 'capacitor:';
}

// Helper: resolve nozzle by id, including built-ins and department custom nozzles.
function resolveNozzleById(id){
  if (!id) return null;
  
  // Map legacy/alternate ids (from older Dept Setup / Presets lists) to store.NOZ ids
  const canonicalNozzleId = (raw)=>{
    const s = String(raw||'').trim();
    if(!s) return s;
    const map = {
      // Smooth bore ids used in preset.js
      'sb_78_50_160': 'sb7_8',
      'sb_1516_50_185': 'sb15_16',
      'sb_1_50_210': 'sb1',
      'sb_1118_50_265': 'sb1_1_8',
      'sb_114_50_325': 'sb1_1_4',

      // Chief XD ids used in preset.js
      'fog_xd_175_50_165': 'chiefXD165_50',
      'fog_xd_175_50_185': 'chief185_50',
      'fog_xd_25_50_265':  'chiefXD265',

      // Common fog ids used in preset.js
      'fog_175_100_150': 'fog150_100',
      'fog_175_75_150':  'fog150_75',
      'fog_15_100_95':   'fog95_100',
      'fog_15_100_125':  'fog125_100',
    };
    return map[s] || s;
  };

  id = canonicalNozzleId(id);
try{
    // 1) Built-in map
    if (typeof NOZ === 'object' && NOZ && NOZ[id]){
      return NOZ[id];
    }

    // 2) Built-in list
    const list = Array.isArray(NOZ_LIST) ? NOZ_LIST : [];
    const fromList = list.find(n => n && n.id === id);
    if (fromList){
      return fromList;
    }

    // 3) Department custom nozzles (canonical source)
    // NOTE: Dept Setup stores custom nozzles in localStorage['fireops_dept_equipment_v1'].customNozzles.
    // The calc dropdown can show customs via other paths, but seeding default lines MUST be able to
    // resolve custom_noz_* ids without relying on any global helper.
    try{
      const raw = localStorage.getItem('fireops_dept_equipment_v1');
      if (raw){
        const dept = JSON.parse(raw);
        const customs = Array.isArray(dept?.customNozzles) ? dept.customNozzles : [];
        const found = customs.find(n => n && n.id === id);
        if (found){
          const name = found.label || found.name || found.desc || found.id || 'Custom nozzle';
          const gpm  = Number(found.gpm ?? found.flow ?? 0) || 0;
          const NP   = Number(found.NP ?? found.np ?? found.psi ?? found.pressure ?? 50) || 50;
          return { id: found.id, name, gpm, NP };
        }
      }
    }catch(_e){ /* ignore */ }

    // 4) Legacy custom nozzle helpers (older builds)
    if (typeof getDeptCustomNozzlesForCalc === 'function'){
      const customs = getDeptCustomNozzlesForCalc() || [];
      if (Array.isArray(customs) && customs.length){
        const found = customs.find(n => n && n.id === id);
        if (found){
          const name = found.label || found.name || found.desc || found.id || 'Custom nozzle';
          const gpm  = Number(found.gpm ?? found.flow ?? 0) || 0;
          const NP   = Number(found.NP ?? found.np ?? found.psi ?? found.pressure ?? 50) || 50;
          return { id: found.id, name, gpm, NP };
        }
      }
    }
  }catch(e){
    console.warn('resolveNozzleById failed for id', id, e);
  }
  return null;
}



// Use shared FL_total_sections helper directly.
// C-values (including 1 3/4" standard hose at 15.5) are now handled in calcShared.js
// so we don't re-scale here. This keeps the main Max PP and the "Why" breakdown
// perfectly in sync.
function FL_total_sections_175(flow, segments) {
  return FL_total_sections(flow, segments);
}
import { openStandardLinePopup }   from './view.lineStandard.js';
import { openMasterStreamPopup }   from './view.lineMaster.js';
import { openStandpipePopup }      from './view.lineStandpipe.js';
import { openSprinklerPopup }      from './view.lineSprinkler.js';
import { openFoamPopup }           from './view.lineFoam.js';
import { openSupplyLinePopup }     from './view.lineSupply.js';
import { openCustomBuilderPopup }  from './view.lineCustom.js';
;
// Expose shared state for legacy helpers (reset scripts, etc.)
if (typeof window !== 'undefined') {
  window.state = state;
}


import { DEPT_UI_NOZZLES, getDeptLineDefaults, getConfiguredPreconnectCount } from './store.js';
import { WaterSupplyUI } from './waterSupply.js';
import {
  setupPresets,
  getDeptNozzleIds,
  getDeptHoseDiameters,
  getDeptCustomNozzlesForCalc
} from './preset.js';
import {setDeptEquipment, setDeptSelections, getUiNozzles, } from './deptState.js';
import './view.calc.enhance.js';


/*                                Main render                                 */
/* ========================================================================== */

export async function render(container){

  const IS_APP = isNativeApp();

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

  // ---------------------------------------------------------------------------
  // Startup behavior: default to NO lines deployed.
  // Even if the user had lines deployed last session, we start clean each load and
  // require pressing Preconnect 1/2/3 to deploy.
  // ---------------------------------------------------------------------------
  try{
    ['left','back','right'].forEach(k=>{
      if (state && state.lines && state.lines[k]) state.lines[k].visible = false;
    });
  }catch(_e){}



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
            <image id="truckImg" href="assets/engine181.png" width="${TRUCK_W}" height="${TRUCK_H}" preserveAspectRatio="xMidYMax meet" onerror="this.setAttribute('href','https://fireopssim.com/pump/engine181.png')"></image>            <g id="hoses"></g>
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
              <button class="linebtn" data-line="left">Preconnect 1</button>
              <button class="linebtn" data-line="back">Preconnect 2</button>
              <button class="linebtn" data-line="right">Preconnect 3</button>
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

  // --- Preconnect button availability (hide 2/3 unless configured) ---
  try {
    const pcCount = (typeof getConfiguredPreconnectCount === 'function') ? getConfiguredPreconnectCount() : 1;
    const b1 = container.querySelector('.linebtn[data-line="left"]');
    const b2 = container.querySelector('.linebtn[data-line="back"]');
    const b3 = container.querySelector('.linebtn[data-line="right"]');

    if (b1){
      b1.style.display = '';
      b1.disabled = false;
      b1.title = '';
    }
    if (b2){
      if (pcCount < 2){
        b2.style.display = 'none';
        b2.disabled = true;
      } else {
        b2.style.display = '';
        b2.disabled = false;
        b2.title = '';
      }
    }
    if (b3){
      if (pcCount < 3){
        b3.style.display = 'none';
        b3.disabled = true;
      } else {
        b3.style.display = '';
        b3.disabled = false;
        b3.title = '';
      }
    }
  } catch(_e) {}


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
    .linebtn.active, .presetsbtn.active, .supplybtn.active, .preset-line-btn.active { background:radial-gradient(circle at 10% 0%, #1e82ff, #1b3a72); border-color:#58b4ff; color:#f4f8ff; box-shadow:0 0 0 1px rgba(70,176,255,.3),0 10px 24px rgba(0,0,0,.6); }

    .presetsbtn{display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.18);background:#0b1420;color:#eaf2ff;}
    .controlBlock { display:flex; flex-direction:column; gap:8px; margin-top:10px; }
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


  // Extra lines created from presets (Foam, Blitz, etc.) that flow in addition to Lines 1–3
  
  const STORAGE_DEPT_KEY = 'fireops_dept_equipment_v1';

  function loadDeptForBuilders() {
    // Read raw dept config for custom labels / custom C values
    let base = {};
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_DEPT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            base = parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load dept for builders', e);
    }

    const dept = Object.assign({}, base || {});

    // =========================
    // NOZZLES
    // =========================

    // Build a map of id -> nozzle, with Department custom nozzles
    // overriding the built-ins when they share the same id.
    const nozzleMap = {};

    const builtInNozzles = Array.isArray(NOZ_LIST) ? NOZ_LIST : [];
    builtInNozzles.forEach(n => {
      if (!n || !n.id) return;
      const id = String(n.id);
      let gpm = 0;
      let np  = 0;
      if (typeof n.gpm === 'number') gpm = n.gpm;
      if (!gpm && typeof n.GPM === 'number') gpm = n.GPM;
      if (typeof n.np === 'number')  np  = n.np;
      if (!np && typeof n.NP === 'number')  np  = n.NP;

      if (NOZ && NOZ[id]) {
        const cat = NOZ[id];
        if (!gpm && typeof cat.gpm === 'number') gpm = cat.gpm;
        if (!np && typeof cat.NP === 'number')  np  = cat.NP;
      }

      nozzleMap[id] = {
        id,
        label: n.label || n.name || id,
        gpm,
        np
      };
    });

    // Add Department custom nozzles (from Department Setup), overwriting
    // any built-in with the same id so the ChiefXD label wins over SB, etc.
    let customNozzles = [];
    try {
      if (typeof getDeptCustomNozzlesForCalc === 'function') {
        customNozzles = getDeptCustomNozzlesForCalc() || [];
      }
    } catch (e) {
      console.warn('getDeptCustomNozzlesForCalc failed', e);
    }

    if (Array.isArray(customNozzles) && customNozzles.length) {
      customNozzles.forEach(n => {
        if (!n || !n.id) return;
        const id = String(n.id);
        let gpm = 0;
        let np  = 0;
        if (typeof n.gpm === 'number') gpm = n.gpm;
        if (!gpm && typeof n.GPM === 'number') gpm = n.GPM;
        if (typeof n.np === 'number')  np  = n.np;
        if (!np && typeof n.NP === 'number')  np  = n.NP;

        if (NOZ && NOZ[id]) {
          const cat = NOZ[id];
          if (!gpm && typeof cat.gpm === 'number') gpm = cat.gpm;
          if (!np && typeof cat.NP === 'number')  np  = cat.NP;
        }

        nozzleMap[id] = {
          id,
          label: n.label || n.name || id,
          gpm,
          np
        };
      });
    }

    const allNozzles = Object.values(nozzleMap);

    // Selected nozzles = EXACTLY what Department Setup picked.
    let selectedNozzleIds = [];
    try {
      if (typeof getDeptNozzleIds === 'function') {
        const ids = getDeptNozzleIds() || [];
        if (Array.isArray(ids) && ids.length) {
          selectedNozzleIds = ids.map(id => String(id)).filter(id => nozzleMap[id]);
        }
      }
    } catch (e) {
      console.warn('getDeptNozzleIds failed', e);
    }

    // ALSO include any nozzle ids referenced by Department Line Defaults (Lines 1–3).
    // This prevents a custom_noz_* default from being seeded correctly but then not
    // showing up in the Calc nozzle dropdown because it wasn't manually checked in
    // the Dept Nozzles list.
    try {
      const defs = (typeof getDeptLineDefaults === 'function') ? (getDeptLineDefaults() || {}) : {};
      const candidates = [
        defs?.line1?.nozzleId,
        defs?.line2?.nozzleId,
        defs?.line3?.nozzleId,
      ].map(_normNozId).filter(Boolean);
      candidates.forEach(id => {
        const sid = String(id);
        if (nozzleMap[sid] && !selectedNozzleIds.includes(sid)) selectedNozzleIds.push(sid);
      });
    } catch (e) {
      console.warn('Failed to include line-default nozzle ids', e);
    }

    // If Department Setup didn't pick any nozzles,
    // selectedNozzleIds stays empty - meaning "show all".
    dept.nozzlesSelected = selectedNozzleIds;

    // For local UI (line editor in this file), only show:
    //  - selected nozzles if any are selected
    //  - otherwise the full library.
    const effectiveNozzles = selectedNozzleIds.length
      ? selectedNozzleIds.map(id => nozzleMap[id]).filter(Boolean)
      : allNozzles;

    dept.nozzlesAll = effectiveNozzles;

    // =========================
    // HOSES
    // =========================

    const DEFAULT_HOSES = [
      { id: '1.75', label: '1 3/4"', c: COEFF['1.75'] ?? 15.5 },
      { id: '2.5',  label: '2 1/2"', c: COEFF['2.5']  ?? 2.0 },
      { id: '3',    label: '3"',      c: COEFF['3']    ?? 0.8 },
      { id: '4',    label: '4"',      c: COEFF['4']    ?? 0.2 },
      { id: '5',    label: '5"',      c: COEFF['5']    ?? 0.08 }
    ];

    // Diameters that the user selected in Department Setup
    let hoseDiameters = [];
    try {
      if (typeof getDeptHoseDiameters === 'function') {
        const ids = getDeptHoseDiameters() || [];
        if (Array.isArray(ids)) {
          hoseDiameters = ids.map(x => String(x));
        }
      }
    } catch (e) {
      console.warn('getDeptHoseDiameters failed', e);
    }

    // Helper to build a hose meta object for a given diameter
    const customs = Array.isArray(base.customHoses) ? base.customHoses : [];

    function metaForDiameter(dia) {
      const s = String(dia);

      // Custom hose from Department Setup?
      const custom = customs.find(h => String(h.diameter) === s);
      if (custom) {
        const c =
          typeof custom.c === 'number' ? custom.c :
          (typeof custom.flC === 'number' ? custom.flC :
           (COEFF[s] ?? 15.5));
        return {
          id: s,
          label: custom.label || custom.name || `${s}"`,
          c
        };
      }

      // Built-in defaults
      const def = DEFAULT_HOSES.find(h => h.id === s);
      if (def) return { ...def };

      // Fallback
      return {
        id: s,
        label: `${s}"`,
        c: COEFF[s] ?? 15.5
      };
    }

    const hosesAll = [];

    if (hoseDiameters.length) {
      // Only the diameters the user actually picked
      hoseDiameters.forEach(d => {
        hosesAll.push(metaForDiameter(d));
      });
      dept.hosesSelected = hoseDiameters.slice();
    } else {
      // No department selection → show default hose sizes
      DEFAULT_HOSES.forEach(h => hosesAll.push({ ...h }));
      dept.hosesSelected = [];
    }

    dept.hosesAll = hosesAll;

    // =========================
    // SYNC INTO deptState
    // =========================

    try {
      if (typeof setDeptEquipment === 'function') {
        setDeptEquipment({
          nozzlesAll: dept.nozzlesAll || [],
          hosesAll: dept.hosesAll || [],
          accessoriesAll: dept.accessoriesAll || []
        });
      }
      if (typeof setDeptSelections === 'function') {
        setDeptSelections({
          nozzleIds: dept.nozzlesSelected || [],
          hoseIds: dept.hosesSelected || []
        });
      }
    } catch (e) {
      console.warn('deptState sync failed in loadDeptForBuilders', e);
    }

    return dept;
  }
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


  
  // Populate nozzle selects, honoring Department Setup choices if available.
    /**
   * Build nozzle <option> HTML using the SAME list as Department Setup.
   *
   * Source of truth:
   *   - loadDeptForBuilders() → dept.nozzlesAll
   *     (already built from NOZ_LIST + dept custom nozzles + dept selections)
   *
   * Behavior:
   *   - If Department Setup has picked specific nozzles, only those appear.
   *   - If none are picked, full library appears.
   *   - Custom nozzles ONLY appear if selected in Department Setup.
   */
  function buildNozzleOptionsHTML() {
    let nozzles = [];

    // 1) Primary source: central deptState UI list
    try {
      if (typeof getUiNozzles === 'function') {
        const uiNozzles = getUiNozzles() || [];
        if (Array.isArray(uiNozzles) && uiNozzles.length) {
          nozzles = uiNozzles;
        }
      }
    } catch (err) {
      console.warn('buildNozzleOptionsHTML: getUiNozzles failed', err);
    }

    // 2) Secondary: derive effective list from Department Setup selections
    if (!nozzles || !nozzles.length) {
      try {
        // Selected nozzle IDs from Department Setup (if any)
        let selectedIds = [];
        if (typeof getDeptNozzleIds === 'function') {
          const ids = getDeptNozzleIds() || [];
          if (Array.isArray(ids)) {
            selectedIds = ids.map(id => String(id));
          }
        }

        // Build a map of id -> nozzle from NOZ_LIST
        const nozzleMap = {};
        const baseList = Array.isArray(NOZ_LIST) ? NOZ_LIST : [];

        baseList.forEach(n => {
          if (!n || !n.id) return;
          const id = String(n.id);
          let gpm = 0;
          let np  = 0;

          if (typeof n.gpm === 'number') gpm = n.gpm;
          if (!gpm && typeof n.GPM === 'number') gpm = n.GPM;
          if (typeof n.np === 'number')  np  = n.np;
          if (!np && typeof n.NP === 'number')  np  = n.NP;

          if (NOZ && NOZ[id]) {
            const cat = NOZ[id];
            if (!gpm && typeof cat.gpm === 'number') gpm = cat.gpm;
            if (!np && typeof cat.NP === 'number')  np  = cat.NP;
          }

          nozzleMap[id] = {
            id,
            label: n.label || n.name || id,
            gpm,
            np
          };
        });

        // Department custom nozzles: override built-ins where ids match
        let customNozzles = [];
        if (typeof getDeptCustomNozzlesForCalc === 'function') {
          const customs = getDeptCustomNozzlesForCalc() || [];
          if (Array.isArray(customs) && customs.length) {
            customNozzles = customs;
          }
        }

        customNozzles.forEach(n => {
          if (!n || !n.id) return;
          const id = String(n.id);
          let gpm = 0;
          let np  = 0;
          if (typeof n.gpm === 'number') gpm = n.gpm;
          if (!gpm && typeof n.GPM === 'number') gpm = n.GPM;
          if (typeof n.np === 'number')  np  = n.np;
          if (!np && typeof n.NP === 'number')  np  = n.NP;

          if (NOZ && NOZ[id]) {
            const cat = NOZ[id];
            if (!gpm && typeof cat.gpm === 'number') gpm = cat.gpm;
            if (!np && typeof cat.NP === 'number')  np  = cat.NP;
          }

          nozzleMap[id] = {
            id,
            label: n.label || n.name || id,
            gpm,
            np
          };
        });

        // If Department Setup picked specific nozzles, use only those.
        if (selectedIds.length) {
          nozzles = selectedIds
            .map(id => nozzleMap[id])
            .filter(Boolean);
        } else {
          // Otherwise, use the entire map as the library.
          nozzles = Object.values(nozzleMap);
        }
      } catch (e) {
        console.warn('buildNozzleOptionsHTML: dept fallback failed', e);
      }
    }

    // 3) Last-chance fallback: full NOZ_LIST so the menu is never empty
    if (!nozzles || !nozzles.length) {
      const list = Array.isArray(NOZ_LIST) ? NOZ_LIST : [];
      nozzles = list.slice();
    }

    if (!nozzles || !nozzles.length) {
      return '';
    }

    return nozzles
      .map(n => {
        if (!n) return '';
        const id = n.id != null ? String(n.id) : '';
        const label = n.label || n.name || n.desc || id || 'Nozzle';
        if (!id) return '';
        return `<option value="${id}">${label}</option>`;
      })
      .join('');
  }


function refreshNozzleSelectOptions() {
    const nozzleOptionsHTML = buildNozzleOptionsHTML();

    [teNoz, teNozA, teNozB].forEach(sel => {
      if (!sel) return;

      // Try to preserve current selection if it’s still valid
      const previous = sel.value;
      sel.innerHTML = nozzleOptionsHTML;

      if (previous && Array.from(sel.options).some(opt => opt.value === previous)) {
        sel.value = previous;
      } else if (!sel.value && sel.options.length) {
        // Default to first option if nothing is selected
        sel.selectedIndex = 0;
      }
    });
  }

  // Initial fill for all three nozzle selects in the tip editor
  refreshNozzleSelectOptions();
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


  // Preset line quick buttons (Foam, Blitz, etc.)
  function renderPresetLineButtons(){
    if (!presetButtonsRow) return;
    presetButtonsRow.innerHTML = '';
    const entries = Object.values(activePresetLines);
    if (!entries.length) return;
    entries.forEach(pl => {
      if (!pl) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'linebtn preset-line-btn active';
      btn.textContent = pl.name || 'Preset';
      btn.dataset.presetId = pl.id || '';
      presetButtonsRow.appendChild(btn);
    });
  }

  
  function openPresetLineEditor(presetLine, opts = {}){
    if (!presetLine || !presetLine.config) return;

    const onSave = typeof opts.onSave === 'function' ? opts.onSave : ()=>{};
    const onDelete = typeof opts.onDelete === 'function' ? opts.onDelete : ()=>{};

    const cfg = presetLine.config;
    const lt  = cfg.lineType || (cfg.raw && cfg.raw.lineType) || (cfg.raw && cfg.raw.type) || presetLine.lineType || null;
    const raw = cfg.raw || {};

    const dept = loadDeptForBuilders();

    function recomputeDirectFromPayload(lineType, payload){
      if (!payload || typeof payload !== 'object') return { directGpm: cfg.directGpm, directPdp: cfg.directPdp };
      const lc = payload.lastCalc || {};
      let gpm = null;
      let pdp = null;

      if (lineType === 'standard' || lineType === 'single' || lineType === 'wye' || !lineType) {
        if (typeof lc.targetGpm === 'number') gpm = lc.targetGpm;
        if (typeof lc.targetPdp === 'number') pdp = lc.targetPdp;
      } else if (lineType === 'master') {
        if (typeof lc.gpm === 'number') gpm = lc.gpm;
        if (typeof lc.PDP === 'number') pdp = lc.PDP;
      } else if (lineType === 'standpipe') {
        if (typeof lc.gpm === 'number') gpm = lc.gpm;
        if (typeof lc.PDP === 'number') pdp = lc.PDP;
      } else if (lineType === 'sprinkler') {
        if (typeof lc.requiredFlowGpm === 'number') gpm = lc.requiredFlowGpm;
        if (typeof lc.PDP === 'number') pdp = lc.PDP;
      } else if (lineType === 'foam') {
        if (typeof lc.waterGpm === 'number') gpm = lc.waterGpm;
        if (typeof lc.pdp === 'number') pdp = lc.pdp;
      } else if (lineType === 'supply') {
        if (typeof lc.gpm === 'number') gpm = lc.gpm;
        if (typeof lc.PDP === 'number') pdp = lc.PDP;
      } else if (lineType === 'custom') {
        if (typeof lc.targetFlowGpm === 'number') gpm = lc.targetFlowGpm;
        if (typeof lc.PDP === 'number') pdp = lc.PDP;
      }

      return {
        directGpm: (gpm != null ? gpm : cfg.directGpm),
        directPdp: (pdp != null ? pdp : cfg.directPdp),
      };
    }

    function handleSaveFromBuilder(newPayload){
      const payload = newPayload || raw || {};
      const direct  = recomputeDirectFromPayload(lt, payload);

      presetLine.config = {
        lineType: lt,
        raw: payload,
        directGpm: direct.directGpm,
        directPdp: direct.directPdp,
      };

      onSave(presetLine.config);
      refreshTotals();
      renderPresetLineButtons();
      markDirty();
    }

    // Route to the correct builder popup based on line type
    if (lt === 'master') {
      openMasterStreamPopup({
        dept,
        initial: raw,
        onSave: handleSaveFromBuilder,
      });
      return;
    }

    if (lt === 'standpipe') {
      openStandpipePopup({
        dept,
        initial: raw,
        onSave: handleSaveFromBuilder,
      });
      return;
    }

    if (lt === 'sprinkler') {
      openSprinklerPopup({
        dept,
        initial: raw,
        onSave: handleSaveFromBuilder,
      });
      return;
    }

    if (lt === 'foam') {
      openFoamPopup({
        dept,
        initial: raw,
        onSave: handleSaveFromBuilder,
      });
      return;
    }

    if (lt === 'supply') {
      openSupplyLinePopup({
        dept,
        initial: raw,
        onSave: handleSaveFromBuilder,
      });
      return;
    }

    if (lt === 'custom') {
      openCustomBuilderPopup({
        dept,
        initial: raw,
        onSave: handleSaveFromBuilder,
      });
      return;
    }

    // Default / unknown -> treat as standard preconnect
    openStandardLinePopup({
      dept,
      initial: raw,
      onSave: handleSaveFromBuilder,
    });
  }


  
function openPresetLineActions(id){
  const pl = activePresetLines[id];
  if (!pl) return;

  const cfg = pl.config || {};

  // Helper to make hose diameter labels phone-friendly.
  function prettyHoseSize(d){
    const s = String(d ?? '').trim();
    if (s === '' || s === 'null' || s === 'undefined') return '';
    if (s === '1.75' || s === '1 3/4' || s === '1¾') return '1 3/4"';
    if (s === '1.5'  || s === '1 1/2')                return '1 1/2"';
    if (s === '2.5'  || s === '2 1/2')                return '2 1/2"';
    if (s === '3')                                     return '3"';
    if (s === '4')                                     return '4"';
    if (s === '5')                                     return '5"';
    return s;
  }

  // Try to resolve nozzle details if they exist.
  let noz = null;
  if (cfg.nozzleId && typeof resolveNozzleById === 'function'){
    try {
      noz = resolveNozzleById(cfg.nozzleId) || null;
    } catch (_e) {
      noz = null;
    }
  }

  const lengthFt = (typeof cfg.lengthFt === 'number') ? cfg.lengthFt : null;
  const hoseSize = (cfg.hoseDiameter != null) ? prettyHoseSize(cfg.hoseDiameter) : '';

  const gpm = (typeof cfg.directGpm === 'number')
    ? cfg.directGpm
    : (noz && typeof noz.gpm === 'number' ? noz.gpm : null);

  const np = noz && (
      (typeof noz.NP === 'number')        ? noz.NP
    : (typeof noz.np === 'number')        ? noz.np
    : (typeof noz.pressure === 'number')  ? noz.pressure
    : null
  );

  const pdp = (typeof cfg.directPdp === 'number') ? cfg.directPdp : null;

  // Simple bottom-sheet style overlay
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(15,23,42,0.55)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'flex-end';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '10150';

  const panel = document.createElement('div');
  panel.style.width = '100%';
  panel.style.maxWidth = '480px';
  panel.style.margin = '0 12px 18px';
  panel.style.borderRadius = '18px';
  panel.style.background = '#020617';
  panel.style.boxShadow = '0 18px 30px rgba(15,23,42,0.9)';
  panel.style.padding = '10px 14px 12px';
  panel.style.color = '#e5e7eb';
  panel.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';

  const title = document.createElement('div');
  title.textContent = pl.name || 'Preset line';
  title.style.fontWeight = '600';
  title.style.marginBottom = '4px';

  // Info box with line details + makeup
  const info = document.createElement('div');
  info.style.fontSize = '12px';
  info.style.lineHeight = '1.4';
  info.style.marginBottom = '8px';
  info.style.padding = '6px 8px';
  info.style.borderRadius = '10px';
  info.style.background = 'rgba(15,23,42,0.95)';
  info.style.border = '1px solid rgba(55,65,81,0.9)';

  const ltText = cfg.lineType || 'Engine line';

  let html = '<div><strong>Line type:</strong> ' + ltText + '</div>';
  if (gpm != null){
    html += '<div><strong>Flow:</strong> ' + gpm + ' gpm</div>';
  }
  if (pdp != null){
    html += '<div><strong>PDP:</strong> ' + pdp + ' psi</div>';
  }

  // Makeup sentence: include hose length & size + nozzle + PP.
  let makeup = '';
  if (lengthFt != null || hoseSize || gpm != null || np != null || pdp != null){
    makeup += ltText + ' ';
    if (lengthFt != null) makeup += lengthFt + "\' ";
    if (hoseSize) makeup += hoseSize + ' ';
    if (gpm != null){
      makeup += gpm + ' gpm nozzle';
      if (np != null) makeup += ' @ ' + np + ' psi';
    }
    if (pdp != null){
      makeup += '.  PP ' + pdp + ' psi';
    }
  }

  if (makeup){
    html += '<div style="margin-top:4px;"><strong>Makeup:</strong> ' +
            makeup +
            '</div>';
  }

  info.innerHTML = html;

  const subt = document.createElement('div');
  subt.textContent = 'Review this preset line, then choose an action:';
  subt.style.fontSize = '13px';
  subt.style.opacity = '0.8';
  subt.style.marginBottom = '8px';

  
  // Row of Remove / Edit / Cancel (phone-friendly)
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.flexWrap = 'wrap';
  row.style.gap = '8px';
  row.style.marginTop = '4px';
  row.style.marginBottom = '6px';

  function makeBtn(label, variant){
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.borderRadius = '999px';
    b.style.padding = '10px 12px'; // taller tap target
    b.style.fontSize = '14px';
    b.style.border = 'none';
    b.style.cursor = 'pointer';
    b.style.whiteSpace = 'nowrap';
    if (variant === 'primary'){
      b.style.background = '#22c55e';
      b.style.color = '#020617';
      b.style.fontWeight = '600';
    } else if (variant === 'danger'){
      b.style.background = 'rgba(248,113,113,0.16)';
      b.style.color = '#fecaca';
      b.style.border = '1px solid rgba(248,113,113,0.5)';
    } else {
      b.style.background = 'rgba(148,163,184,0.12)';
      b.style.color = '#e5e7eb';
    }
    return b;
  }

  const removeBtn = makeBtn('Remove line', 'danger');
  removeBtn.style.flex = '1 1 0';
  const editBtn = makeBtn('Edit line', 'primary');
  editBtn.style.flex = '1 1 0';
  const cancelBtn = makeBtn('Cancel', 'secondary');
  cancelBtn.style.flex = '1 1 0';

  function closeOverlay(){
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  editBtn.addEventListener('click', () => {
    closeOverlay();
    const plRef = activePresetLines[id];
    if (!plRef) return;
    openPresetLineEditor(plRef, {
      onSave(edited){
        plRef.config = Object.assign({}, plRef.config || {}, edited || {});
        refreshTotals();
        renderPresetLineButtons();
        markDirty();
      }
    });
  });

  removeBtn.addEventListener('click', () => {
    delete activePresetLines[id];
    closeOverlay();
    refreshTotals();
    renderPresetLineButtons();
    markDirty();
  });

  cancelBtn.addEventListener('click', () => {
    closeOverlay();
  });

  row.appendChild(removeBtn);
  row.appendChild(editBtn);
  row.appendChild(cancelBtn);

  panel.appendChild(title);
  panel.appendChild(info);
  panel.appendChild(subt);
  panel.appendChild(row);
  overlay.appendChild(panel);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay();
  });

  document.body.appendChild(overlay);
}



  // Click handler for preset line buttons
  container.addEventListener('click', (e)=>{
    const btn = e.target.closest('.preset-line-btn');
    if (!btn) return;
    const id = btn.dataset.presetId;
    if (!id || !activePresetLines[id]) return;
    openPresetLineActions(id);
  });

  /* ---------------------------- Totals & KPIs ----------------------------- */

  
  function refreshTotals(){
    const vis = Object.entries(state.lines).filter(([_k,l])=>l.visible);
    let totalGPM = 0, maxPDP = -Infinity, maxKey = null;

    // Department lines (Preconnect 1/2/3)
    vis.forEach(([key, L])=>{
      const single = L.hasWye && isSingleWye(L);
      const flow = single ? (activeNozzle(L)?.gpm||0)
                 : L.hasWye ? (L.nozLeft?.gpm||0) + (L.nozRight?.gpm||0)
                            : (L.nozRight?.gpm||0);
      const mainFL = FL_total_sections_175(flow, L.itemsMain);
      let PDP=0;
      if(single){
        const side = activeSide(L);
        const bnSegs = side==='L' ? L.itemsLeft : L.itemsRight;
        const bnNoz  = activeNozzle(L);
        const branchFL = FL_total_sections_175(bnNoz.gpm, bnSegs);
        PDP = bnNoz.NP + branchFL + mainFL + (L.elevFt * PSI_PER_FT);
      }else if(L.hasWye){
        const lNeed = FL_total_sections_175(L.nozLeft?.gpm||0, L.itemsLeft) + (L.nozLeft?.NP||0);
        const rNeed = FL_total_sections_175(L.nozRight?.gpm||0, L.itemsRight) + (L.nozRight?.NP||0);
        PDP = Math.max(lNeed, rNeed) + mainFL + (L.wyeLoss||10) + (L.elevFt * PSI_PER_FT);
      }else{
        PDP = (L.nozRight?.NP||0) + mainFL + (L.elevFt * PSI_PER_FT);
      }
      totalGPM += flow;
      if(PDP > maxPDP){ maxPDP = PDP; maxKey = key; }
    });

    
    // Extra preset lines (Foam, Blitz, etc.) that flow in addition to Lines 1–3
    Object.values(activePresetLines).forEach(pl => {
      if (!pl || !pl.config) return;
      const cfg = pl.config;

      // If the config carries direct GPM/PDP from a builder popup, use that.
      if (typeof cfg.directGpm === 'number' && cfg.directGpm > 0) {
        totalGPM += cfg.directGpm;
        if (typeof cfg.directPdp === 'number' && cfg.directPdp > 0) {
          if (cfg.directPdp > maxPDP) maxPDP = cfg.directPdp;
        }
        return;
      }

      // Legacy/simple hose + nozzle presets (fallback path)
      const noz = (cfg.nozzleId && NOZ[cfg.nozzleId]) || null;
      if (!noz) return;
      const flow = noz.gpm || 0;
      const lengthFt = (typeof cfg.lengthFt === 'number' ? cfg.lengthFt : 0);
      const size = cfg.hoseDiameter || '1.75';
      const mainSegs = [{ size, lengthFt }];
      const mainFL = FL_total_sections_175(flow, mainSegs);
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

    // Keep quick preset buttons in sync
    renderPresetLineButtons();
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
      const single = L.hasWye && isSingleWye(L);
      const usedNoz = single ? activeNozzle(L) : L.hasWye ? null : L.nozRight;
      const flow = single ? (usedNoz?.gpm||0) : (L.hasWye ? ((L.nozLeft?.gpm||0) + (L.nozRight?.gpm||0)) : (L.nozRight?.gpm||0));

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

      // If Department filtering removed the old nozzle id from the select,
      // make sure we still show *something* by picking the first available option.
      if (teNoz && !teNoz.value && teNoz.options && teNoz.options.length > 0) {
        teNoz.selectedIndex = 0;
        const chosenId = teNoz.value;
        if (chosenId) {
          try {
            const fullList = Array.isArray(NOZ_LIST) ? NOZ_LIST : [];
            const found = fullList.find(n => n && n.id === chosenId);
            if (found) {
              L.nozRight = Object.assign({}, L.nozRight || {}, found, { id: found.id });
            } else {
              L.nozRight = Object.assign({}, L.nozRight || {}, { id: chosenId });
            }
          } catch (_e) {
            // Non-fatal: at least a visible selection is present
          }
        }
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
        const noz = resolveNozzleById(id);
        if (noz) {
          L.nozLeft = noz;
        }
        // lock branch hose size to 1.75 is handled elsewhere in calc; just recompute
        recompute();
        render();
      } catch(_){}
    });
    if (nozB) nozB.addEventListener('change', () => {
      try {
        const id = nozB.value;
        const noz = resolveNozzleById(id);
        if (noz) {
          L.nozRight = noz;
        }
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
    if (typeof refreshNozzleSelectOptions === 'function') refreshNozzleSelectOptions();
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
        if (teNoz && teNoz.value){
          const chosen = resolveNozzleById(teNoz.value);
          if (chosen){
            L.nozRight = chosen;
          } else {
            ensureDefaultNozzleFor(L,'main',size);
          }
        } else {
          ensureDefaultNozzleFor(L,'main',size);
        }
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
      const key = b.dataset.line;
      const L   = seedDefaultsForKey(key);
      const wasVisible = !!L.visible;

      // Toggle visibility
      L.visible = !L.visible;
      b.classList.toggle('active', L.visible);

      // If the line has just been turned ON, seed from Department line defaults
      if (!wasVisible && typeof getDeptLineDefaults === 'function') {
        const all = getDeptLineDefaults();
        const src =
          key === 'left'  ? all.line1 :
          key === 'back'  ? all.line2 :
          key === 'right' ? all.line3 :
          null;

        if (src && typeof src === 'object') {
          // Main hose
          const main = (L.itemsMain && L.itemsMain[0]) || {};
          if (src.hoseDiameter != null) {
            main.size = String(src.hoseDiameter);
          }
          if (typeof src.lengthFt === 'number') {
            main.lengthFt = src.lengthFt;
          }
          L.itemsMain = [main];

          // Straight line, no wye branches
          L.hasWye    = false;
          L.itemsLeft = [];
          L.itemsRight= [];

          // Elevation
          if (typeof src.elevationFt === 'number') {
            L.elevFt = src.elevationFt;
          } else if (typeof src.elevation === 'number') {
            L.elevFt = src.elevation;
          }

          // Nozzle
          // NOTE: Some Department Setup UIs historically saved the *label* (display text)
          // instead of the nozzle *id*. If we only trust src.nozzleId as an id, custom
          // nozzles will fail to seed and the line will fall back to the first option.
          const rawNoz = (src.nozzleId != null ? src.nozzleId : (src.nozzle != null ? src.nozzle : ''));
          const rawNozStr = String(rawNoz || '').trim();
          const _nid = _normNozId(rawNozStr);

          // Dept defaults may reference custom_noz_* ids which are NOT in the built-in NOZ map.
          // Always resolve through a resolver that understands custom nozzles.
          let chosen = (_nid && typeof resolveNozzleById === 'function') ? resolveNozzleById(_nid) : null;

          // EXTRA SAFETY: if Department Setup saved a label instead of an id, try to
          // map the label back to an id using the current UI nozzle list.
          if (!chosen && rawNozStr) {
            try {
              const ui = (typeof getUiNozzles === 'function') ? (getUiNozzles() || []) : [];
              if (Array.isArray(ui) && ui.length) {
                const hit = ui.find(n => {
                  const nid = String(n?.id ?? '').trim();
                  const lbl = String(n?.label ?? n?.name ?? '').trim();
                  return (nid && (nid === rawNozStr || nid === _nid)) || (lbl && lbl === rawNozStr);
                });
                if (hit) {
                  chosen = {
                    id: String(hit.id),
                    name: String(hit.label || hit.name || hit.id),
                    gpm: Number(hit.gpm ?? hit.GPM ?? 0) || 0,
                    NP: Number(hit.np ?? hit.NP ?? hit.psi ?? hit.pressure ?? 50) || 50,
                  };
                }
              }
            } catch (_e) { /* ignore */ }
          }

          if (chosen) {
            L.nozRight = chosen;
          } else if (_nid && typeof NOZ !== 'undefined' && NOZ && NOZ[_nid]) {
            L.nozRight = NOZ[_nid];
          }
        }
      }

      // Safety: ensure hose + nozzle objects exist so rendering can't crash
      if (L.visible) {
        if (!Array.isArray(L.itemsMain) || !L.itemsMain[0]) {
          L.itemsMain = [{ size: '1.75', lengthFt: 200 }];
        } else {
          if (!('size' in L.itemsMain[0]) || L.itemsMain[0].size == null) L.itemsMain[0].size = '1.75';
          if (!('lengthFt' in L.itemsMain[0]) || L.itemsMain[0].lengthFt == null) L.itemsMain[0].lengthFt = 200;
        }
        const _sz = String(L.itemsMain[0].size || '1.75');
        ensureDefaultNozzleFor(L, 'main', _sz);
        if (L.hasWye) {
          ensureDefaultNozzleFor(L, 'L', _sz);
          ensureDefaultNozzleFor(L, 'main', _sz); // nozRight for Branch A (right) if missing
        }
      }

      drawAll();
      markDirty();
    });
  });

  /* --------------------------- Supply buttons ----------------------------- */

  const hydrantBtnEl = container.querySelector('#hydrantBtn');
  if (hydrantBtnEl) {
    hydrantBtnEl.addEventListener('click', () => {
      const isOn = state.supply === 'pressurized';
      state.supply = isOn ? null : 'pressurized';
      drawAll();
      markDirty();
    });
  }

  const tenderBtnEl = container.querySelector('#tenderBtn');
  if (tenderBtnEl) {
    tenderBtnEl.addEventListener('click', () => {
      const isOn = state.supply === 'static';
      state.supply = isOn ? null : 'static';
      drawAll();
      markDirty();
    });
  }

  // Relay Pumping mini-app toggle (lazy-loads view.relay.js into relayMount)
  const relayBtn = container.querySelector('#relayBtn');
  if (relayBtn && relayMount) {
    let relayVisible = false;
    let relayLoaded  = false;

    const syncRelayFlow = () => {
      if (!relayMount) return;
      const mainGpmEl = container.querySelector('#GPM');
      if (!mainGpmEl) return;
      const txt = (mainGpmEl.textContent || '').replace(/[^0-9.]/g, '');
      const val = parseFloat(txt);
      const rpFlowInput = relayMount.querySelector('#rpFlow');
      if (rpFlowInput && val > 0) {
        rpFlowInput.value = String(Math.round(val));
      }
    };

    relayBtn.addEventListener('click', async () => {
      if (!relayLoaded) {
        try {
          const mod = await import('./view.relay.js');
          if (mod && typeof mod.render === 'function') {
            await mod.render(relayMount);
          } else {
            relayMount.innerHTML = '<div class="mini" style="color:#fca5a5">Relay module missing render(container).</div>';
          }
        } catch (err) {
          console.error('Failed to load relay view', err);
          relayMount.innerHTML = '<div class="mini" style="color:#fca5a5">Unable to load relay pumping helper.</div>';
        }
        relayLoaded = true;
      }

      // Sync flow every time we toggle Relay on
      syncRelayFlow();

      relayVisible = !relayVisible;
      relayMount.style.display = relayVisible ? 'block' : 'none';
      relayBtn.classList.toggle('active', relayVisible);

      if (relayVisible) {
        try {
          relayMount.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_e) {}
      }
    });

    // Hook into global drawAll so flow updates whenever lines/GPM change
    const oldDrawAll = drawAll;
    drawAll = function(...args){
      const result = oldDrawAll.apply(this, args);
      if (relayVisible) syncRelayFlow();
      return result;
    };
  }

// Presets button: wire to full preset system even on PC/web
  // Map line number (1/2/3) to calc state key
  function mapLineKeyFromNumber(lineNumber){
    return lineNumber === 1 ? 'left'
         : lineNumber === 2 ? 'back'
         : 'right';
  }

  // Read the current hydraulic setup for a given line so we can save as a preset
  function getLineStateFromCalc(lineNumber){
    const key = mapLineKeyFromNumber(lineNumber);
    const L = seedDefaultsForKey(key);
    if (!L) return null;
    const main = (L.itemsMain && L.itemsMain[0]) || {};
    const hoseDiameter = main.size || '';
    const lengthFt = typeof main.lengthFt === 'number' ? main.lengthFt : 0;
    const nozzle = L.nozRight || L.nozLeft || null;

    return {
      hoseDiameter,
      cValue: null,         // C is implied from hose size in the main calc for now
      lengthFt,
      nozzleId: nozzle && nozzle.id || '',
      elevation: typeof L.elevFt === 'number' ? L.elevFt : 0,
      appliances: 0
    };
  }


  // Apply a saved preset back into the calc.
  // - kind === 'lineEdit' -> update Lines 1/2/3 directly
  // - all other presets -> create extra preset lines (Foam, Blitz, etc.) whose flow
  //   is added on top of Lines 1–3.
  
  // Apply a saved preset back into the calc.
  // - kind === 'lineEdit' -> update Lines 1/2/3 directly
  // - all other presets -> create extra preset lines (Foam, Blitz, etc.) whose flow
  //   is added on top of Lines 1–3.
  
  function applyPresetToCalc(preset){
    if (!preset) return;

    // --- Special case: direct Preconnect 1/2/3 edits from the Dept line editor ----
    if (preset.kind === 'lineEdit'){
      const src = (preset && typeof preset.payload === 'object' && preset.payload)
        ? preset.payload
        : preset;

      const key = mapLineKeyFromNumber(preset.lineNumber || src.lineNumber || 1);
      const L = seedDefaultsForKey(key);
      if (!L) return;

      // Main hose segment
      const main = (L.itemsMain && L.itemsMain[0]) || {};
      if (src.hoseDiameter) {
        main.size = src.hoseDiameter;
      }
      if (typeof src.lengthFt === 'number') {
        main.lengthFt = src.lengthFt;
      }
      L.itemsMain = [main];

      // Restore as a single straight line (no wye branches)
      L.hasWye = false;
      L.itemsLeft = [];
      L.itemsRight = [];

      // Elevation
      if (typeof src.elevation === 'number') {
        L.elevFt = src.elevation;
      }

      // Nozzle
          const _nid = _normNozId(src.nozzleId);
          if (_nid && NOZ[_nid]) {
            L.nozRight = NOZ[_nid];
          }

      // Make sure line is visible & button looks active
      L.visible = true;
      const btn = container.querySelector(`.linebtn[data-line="${key}"]`);
      if (btn) btn.classList.add('active');

      // Re-draw + persist
      drawAll();
      markDirty();
      return;
    }

    // --- Helper to dig the builder config out of a preset -------------------
    function pickBuilderConfig(presetObj){
      if (!presetObj || typeof presetObj !== 'object') return null;

      // Legacy payload-only presets
      if (presetObj.payload && typeof presetObj.payload === 'object') {
        return { lineType: presetObj.lineType || null, raw: presetObj.payload };
      }

      // New Preset Line Editor format
      if (presetObj.config && typeof presetObj.config === 'object') {
        const pc   = presetObj.config;
        const lt   = presetObj.lineType || pc.lineType || null;
        const cfgs = (pc.configs && typeof pc.configs === 'object') ? pc.configs : {};

        let raw = null;
        if (lt === 'standard' || lt === 'single' || lt === 'wye') {
          raw = pc.standardConfig  || cfgs.standard  || null;
        } else if (lt === 'master') {
          raw = pc.masterConfig    || cfgs.master    || null;
        } else if (lt === 'standpipe') {
          raw = pc.standpipeConfig || cfgs.standpipe || null;
        } else if (lt === 'sprinkler') {
          raw = pc.sprinklerConfig || cfgs.sprinkler || null;
        } else if (lt === 'foam') {
          raw = pc.foamConfig      || cfgs.foam      || null;
        } else if (lt === 'supply') {
          raw = pc.supplyConfig    || cfgs.supply    || null;
        } else if (lt === 'custom') {
          raw = pc.customConfig    || cfgs.custom    || null;
        }

        if (!raw) raw = pc;
        return { lineType: lt, raw };
      }

      // Fallback: treat whole object as a generic builder payload
      return { lineType: presetObj.lineType || null, raw: presetObj };
    }

    // Map a builder payload to direct GPM/PDP numbers if possible
    function toDirectFlow(builder){
      if (!builder || typeof builder.raw !== 'object') return null;
      const lt  = builder.lineType;
      const raw = builder.raw || {};

      const lc = raw.lastCalc || {};

      // Standard preconnect (from view.lineStandard.js)
      if (lt === 'standard' || lt === 'single' || lt === 'wye') {
        const gpm = typeof lc.targetGpm === 'number' ? lc.targetGpm : null;
        const pdp = typeof lc.targetPdp === 'number' ? lc.targetPdp : null;
        if (gpm && pdp) return { directGpm: gpm, directPdp: pdp };
      }

      // Master stream (from view.lineMaster.js)
      if (lt === 'master') {
        const gpm = typeof lc.gpm === 'number' ? lc.gpm : null;
        const pdp = typeof lc.PDP === 'number' ? lc.PDP : null;
        if (gpm && pdp) return { directGpm: gpm, directPdp: pdp };
      }

      // Standpipe (from view.lineStandpipe.js)
      if (lt === 'standpipe') {
        const gpm = typeof lc.gpm === 'number' ? lc.gpm : null;
        const pdp = typeof lc.PDP === 'number' ? lc.PDP : null;
        if (gpm && pdp) return { directGpm: gpm, directPdp: pdp };
      }

      // Sprinkler (from view.lineSprinkler.js)
      if (lt === 'sprinkler') {
        const gpm = typeof lc.requiredFlowGpm === 'number' ? lc.requiredFlowGpm : null;
        const pdp = typeof lc.PDP === 'number' ? lc.PDP : null;
        if (gpm && pdp) return { directGpm: gpm, directPdp: pdp };
      }

      // Foam (from view.lineFoam.js) – use water GPM + PDP
      if (lt === 'foam') {
        const gpm = typeof lc.waterGpm === 'number' ? lc.waterGpm : null;
        const pdp = typeof lc.pdp === 'number' ? lc.pdp : null;
        if (gpm && pdp) return { directGpm: gpm, directPdp: pdp };
      }

      // Supply line (from view.lineSupply.js)
      if (lt === 'supply') {
        const gpm = typeof lc.gpm === 'number' ? lc.gpm : null;
        const pdp = typeof lc.PDP === 'number' ? lc.PDP : null;
        if (gpm && pdp) return { directGpm: gpm, directPdp: pdp };
      }

      // Custom builder (from view.lineCustom.js)
      if (lt === 'custom') {
        const gpm = typeof lc.targetFlowGpm === 'number' ? lc.targetFlowGpm : null;
        const pdp = typeof lc.PDP === 'number' ? lc.PDP : null;
        if (gpm && pdp) return { directGpm: gpm, directPdp: pdp };
      }

      return null;
    }

    const builder = pickBuilderConfig(preset);
    const direct  = toDirectFlow(builder);

    if (!direct) {
      // If we cannot extract direct GPM/PDP, bail for now.
      return;
    }

    const id = preset.id || (`preset_${Date.now()}_${Math.floor(Math.random()*1000)}`);
    const name = preset.name || `Preset ${Object.keys(activePresetLines).length + 1}`;

    activePresetLines[id] = {
      id,
      name,
      config: {
        lineType: builder.lineType || preset.lineType || null,
        raw: builder.raw || null,
        directGpm: direct.directGpm,
        directPdp: direct.directPdp,
      }
    };

    // Update totals + buttons
    refreshTotals();
    renderPresetLineButtons();
    markDirty();
  }
  if (IS_APP) {
    try {
      setupPresets({
        isApp: true,
        triggerButtonId: 'presetsBtn',
        appStoreUrl: 'https://play.google.com/store/apps/details?id=com.fireopscalc.app',
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.fireopscalc.app',
        getLineState: getLineStateFromCalc,
        applyPresetToCalc
      });
    } catch (e) {
      console.warn('setupPresets failed', e);
    }
  } else {
    // Web: Presets are app-only. Clicking takes the user to the explainer/store link.
    const b = container.querySelector('#presetsBtn');
    if (b) {
      b.textContent = 'Presets (App)';
      b.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        window.location.href = '/app-only-presets.html';
      });
    }
  }
  function enhanceTenderListStyle() {
    const rootEl = container.querySelector('#tenderList');
    if (!rootEl) return;
    rootEl.querySelectorAll('b, .tenderName, .tender-id, .title, .name').forEach(el=>{
      el.classList.add('tender-emph');
    });
  }

  /* -------------------------- Ensure editor script ------------------------ */

  (function ensureBottomSheet(){
    if (window.BottomSheetEditor) return;
    try{
      const already = Array.from(document.scripts).some(s => (s.src||'').includes('bottom-sheet-editor.js'));
      if (already) return;
      const s = document.createElement('script');
      s.src = new URL('./bottom-sheet-editor.js', import.meta.url).href;
      document.body.appendChild(s);
    }catch(e){}
  })();

  /* -------------------------------- Draw --------------------------------- */

  function drawAll(){
    const viewH = Math.ceil(computeNeededHeightPx());
    stageSvg.setAttribute('viewBox', `0 0 ${TRUCK_W} ${viewH}`);
    stageSvg.style.height = viewH + 'px';
    truckImg.setAttribute('y', String(truckTopY(viewH)));

    clearGroup(G_hoses); clearGroup(G_branches); clearGroup(G_tips); clearGroup(G_labels); clearGroup(G_supply);

    const visibleKeys = ['left','back','right'].filter(k=>state.lines[k].visible);
    topInfo.textContent = visibleKeys.length ? ('Deployed: '+visibleKeys.map(k=>state.lines[k].label).join(' • ')) : 'No lines deployed (v-preset)';

    ['left','back','right'].filter(k=>state.lines[k].visible).forEach(key=>{
      const L = state.lines[key]; const dir = key==='left'?-1:key==='right'?1:0;
      const mainFt = sumFt(L.itemsMain);
      const geom = mainCurve(dir, (mainFt/50)*PX_PER_50FT, viewH);

      const base = document.createElementNS('http://www.w3.org/2000/svg','path'); base.setAttribute('d', geom.d); G_hoses.appendChild(base);
      drawSegmentedPath(G_hoses, base, L.itemsMain);
      addTip(G_tips, key,'main',geom.endX,geom.endY);

      // Main label: if Wye present, show 'via Wye' (no nozzle mention)
      const single = L.hasWye && isSingleWye(L);
      const usedNoz = single ? activeNozzle(L) : L.hasWye ? null : L.nozRight;
      const flowGpm = single ? (usedNoz?.gpm||0) : (L.hasWye ? (L.nozLeft.gpm + L.nozRight.gpm) : L.nozRight.gpm);
      const npLabel = L.hasWye ? ' — via Wye' : (' — Nozzle '+(L.nozRight?.NP||0)+' psi');
      addLabel(G_labels, mainFt+'′ @ '+flowGpm+' gpm'+npLabel, geom.endX, geom.endY-6, (key==='left')?-10:(key==='back')?-22:-34);

      if(L.hasWye){
        if(sumFt(L.itemsLeft)>0){
          const gL = straightBranch('L', geom.endX, geom.endY, (sumFt(L.itemsLeft)/50)*PX_PER_50FT);
          const pathL = document.createElementNS('http://www.w3.org/2000/svg','path'); pathL.setAttribute('d', gL.d); G_branches.appendChild(pathL);
          drawSegmentedPath(G_branches, pathL, L.itemsLeft);
          // Branch A info bubble
          const lenLeft = sumFt(L.itemsLeft||[]);
          if(lenLeft>0 && L.nozLeft){
            const txtL = lenLeft+'′ @ '+(L.nozLeft.gpm||0)+' gpm — Nozzle '+(L.nozLeft.NP||0)+' psi';
            addLabel(G_labels, txtL, gL.endX-40, gL.endY-10, -4);
          }
          addTip(G_tips, key,'L',gL.endX,gL.endY);
        } else addTip(G_tips, key,'L',geom.endX-20,geom.endY-20);

        if(sumFt(L.itemsRight)>0){
          const gR = straightBranch('R', geom.endX, geom.endY, (sumFt(L.itemsRight)/50)*PX_PER_50FT);
          const pathR = document.createElementNS('http://www.w3.org/2000/svg','path'); pathR.setAttribute('d', gR.d); G_branches.appendChild(pathR);
          drawSegmentedPath(G_branches, pathR, L.itemsRight);
          // Branch B info bubble
          const lenRight = sumFt(L.itemsRight||[]);
          if(lenRight>0 && L.nozRight){
            const txtR = lenRight+'′ @ '+(L.nozRight.gpm||0)+' gpm — Nozzle '+(L.nozRight.NP||0)+' psi';
            addLabel(G_labels, txtR, gR.endX+40, gR.endY-10, -4);
          }
          addTip(G_tips, key,'R',gR.endX,gR.endY);
        } else addTip(G_tips, key,'R',geom.endX+20,geom.endY-20);
      }
      base.remove();
    });

    // Supply visuals & panels
    waterSupply.draw(viewH);
    if (typeof waterSupply.updatePanelsVisibility === 'function') {
      waterSupply.updatePanelsVisibility();
    }

    // KPIs, math, summary
    refreshTotals();
    renderLinesPanel();
    refreshSupplySummary();

    // Button active states
    container.querySelector('#hydrantBtn')?.classList.toggle('active', state.supply==='pressurized');
    container.querySelector('#tenderBtn')?.classList.toggle('active', state.supply==='static');

    // Line button states (Preconnect 1/2/3)
    ['left','back','right'].forEach(k => {
      const L = state.lines[k];
      const btn = container.querySelector(`.linebtn[data-line="${k}"]`);
      if (btn && L) {
        btn.classList.toggle('active', !!L.visible);
      }
    });

    // Highlight Presets button when any preset lines are active
    const presetsBtn = container.querySelector('#presetsBtn');
    if (presetsBtn) {
      presetsBtn.classList.toggle('active', Object.keys(activePresetLines || {}).length > 0);
    }

    // mark dirty after draw (belt & suspenders)
    markDirty();
  }

  // Initial draw
  drawAll();

  // Dev helper to clear saved practice
  window.__resetPractice = function(){ try { sessionStorage.removeItem(PRACTICE_SAVE_KEY); } catch(_) {} };

  
  try{ initPlusMenus(container); }catch(e){}
  return { dispose(){
    stopAutoSave();
  }};

    // (Fallback) Populate Branch A/B nozzle selects like main lines
    try {
      const nozA = root.querySelector('#teNozA');
      const nozB = root.querySelector('#teNozB');
      if (typeof fillNozzles === 'function') {
        fillNozzles(nozA);
        fillNozzles(nozB);
      }
      try {
        if (L.nozLeft && L.nozLeft.id && nozA) nozA.value = L.nozLeft.id;
        if (L.nozRight && L.nozRight.id && nozB) nozB.value = L.nozRight.id;
      } catch(_){}
      try {
        const defId = (typeof defaultNozzleIdForSize==='function') ? defaultNozzleIdForSize('1.75') : null;
        if (defId) {
          if (nozA && !nozA.value) nozA.value = defId;
          if (nozB && !nozB.value) nozB.value = defId;
        }
      } catch(_){}
    } catch(_){}
}

export default { render };


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

  const teNoz  = root.querySelector('#teNoz');
  const teNozA = root.querySelector('#teNozA');
  const teNozB = root.querySelector('#teNozB');

  if ((teNoz || teNozA || teNozB) && Array.isArray(NOZ_LIST)) {
    // Start with built-in nozzles
    let list = Array.isArray(NOZ_LIST) ? [...NOZ_LIST] : [];

    // Merge in department custom nozzles if available
    try {
      if (typeof getDeptCustomNozzlesForCalc === 'function') {
        const customs = getDeptCustomNozzlesForCalc() || [];
        if (Array.isArray(customs) && customs.length) {
          list = list.concat(customs);
        }
      }
    } catch (e) {
      console.warn('Dept custom nozzles load failed', e);
    }

    // If department selected specific nozzles, filter to that set
    try {
      if (typeof getDeptNozzleIds === 'function') {
        const ids = getDeptNozzleIds() || [];
        if (Array.isArray(ids) && ids.length) {
          const allowed = new Set(ids.map(id => String(id)));
          const filtered = list.filter(n => n && allowed.has(String(n.id)));
          if (filtered.length) {
            list = filtered;
          }
        }
      }
    } catch (e) {
      console.warn('Dept nozzle filter failed', e);
    }

    // Overlay labels from deptState's UI list so ChiefXD tips keep their Department label
    let uiById = null;
    try {
      if (typeof getUiNozzles === 'function') {
        const uiNozzles = getUiNozzles() || [];
        if (Array.isArray(uiNozzles) && uiNozzles.length) {
          uiById = new Map(
            uiNozzles
              .filter(n => n && n.id != null)
              .map(n => [String(n.id), n])
          );
        }
      }
    } catch (e) {
      console.warn('deptState getUiNozzles failed', e);
    }

    const optionsHtml = list.map(n => {
      if (!n) return '';
      const id = n.id != null ? String(n.id) : '';
      if (!id) return '';
      const fromUi = uiById && uiById.get(id);
      const label =
        (fromUi && (fromUi.label || fromUi.name || fromUi.desc)) ||
        n.label || n.name || n.desc || id || 'Nozzle';
      const val = id;
      return `<option value="${val}">${label}</option>`;
    }).join('');

    if (teNoz)  teNoz.innerHTML  = optionsHtml;
    if (teNozA) teNozA.innerHTML = optionsHtml;
    if (teNozB) teNozB.innerHTML = optionsHtml;
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
  if (!sel || !Array.isArray(NOZ_LIST)) return;

  // Start from full nozzle library
  let nozList = NOZ_LIST.slice();

  // Try to filter by department-selected nozzles, if available
  try {
    if (typeof getDeptNozzleIds === 'function') {
      const ids = getDeptNozzleIds() || [];
      if (Array.isArray(ids) && ids.length) {
        const allowed = new Set(ids.map(id => String(id)));
        const filtered = nozList.filter(n => n && allowed.has(String(n.id)));
        if (filtered.length) {
          nozList = filtered;
        }
      }
    }
  } catch (_e) {
    // Non-fatal: if anything goes wrong, just fall back to the full list
  }

  sel.innerHTML = nozList.map(n => {
    const baseLabel = n.name || n.desc || n.id || 'Nozzle';
    const np = (n && (n.NP ?? n.np ?? n.psi ?? n.pressure));
    const hasPsi = /\bpsi\b/i.test(String(baseLabel));
    const label = (!hasPsi && (np !== null && np !== undefined && np !== '')) ? `${baseLabel} @ ${np} psi` : baseLabel;
    const val = (n && n.id != null) ? n.id : baseLabel;
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
