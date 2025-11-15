// ./js/view.charts.js
// Phone-friendly Charts view, with "Common GPM" bubbles removed.

import { COEFF } from './store.js';

/**
 * Charts View
 * - Sections:
 *   1) Nozzles  (Smooth Bore | Fog)  ← SB first, default selected
 *   2) Hose Friction Loss (horizontal hose-size buttons; FL per 100')
 *   3) Rules of Thumb
 * - Mobile polish: bigger tap targets, 16px inputs to prevent iOS zoom, responsive grids.
 */

export async function render(container){
  container.innerHTML = `
    <section class="stack">

      <!-- Section launchers -->
      <section class="card">
        <div class="controls" style="display:flex; gap:6px; flex-wrap:nowrap">
          <button class="btn primary" id="btnShowNozzles" type="button">Nozzles</button>
          <button class="btn" id="btnShowFL" type="button">Hose Friction</button>
          <button class="btn" id="btnShowRules" type="button">Rules of Thumb</button>
        </div>
        <div class="status" style="margin-top:8px">Pick a topic to view details.</div>
      </section>

      <!-- NOZZLES (hidden until pressed) -->
      <section class="card" id="nozzlesCard" style="display:none">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap">
          <div class="ink-strong" style="font-weight:700">Nozzles</div>
          <div class="seg" role="tablist" aria-label="Nozzle type">
            <button class="segBtn segOn" data-type="sb" role="tab" aria-selected="true" type="button">Smooth Bore</button>
            <button class="segBtn" data-type="fog" role="tab" aria-selected="false" type="button">Fog</button>
          </div>
        </div>

        <!-- Smooth Bore first -->
        <div id="nozzlesSB" class="nozzWrap" style="margin-top:10px"></div>
        <!-- Fog second -->
        <div id="nozzlesFog" class="nozzWrap" style="margin-top:10px; display:none"></div>
      </section>

      <!-- FL (hidden until pressed) -->
      <section class="card" id="flCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Friction Loss (per 100′)</div>

        <!-- Horizontal hose-size buttons -->
        <div class="hoseRow" role="tablist" aria-label="Hose size"></div>

        <div id="flTableWrap" style="margin-top:8px"></div>
        <div class="mini" style="opacity:.95; margin-top:6px">
          FL equation: <code>FL_per100 = C × (GPM/100)²</code>
        </div>
      </section>

      <!-- RULES OF THUMB (hidden until pressed) -->
      <section class="card" id="rulesCard" style="display:none">
        <div class="ink-strong" style="font-weight:700; margin-bottom:8px">Rules of Thumb</div>
        <div id="rulesList"></div>
        <div class="mini" style="opacity:.95; margin-top:8px">
          Quick reference only; confirm with your department’s SOGs/SOPs.
        </div>
      </section>

    </section>
  `;

  
  injectLocalStyles(container, `
/* Charts: keep launcher buttons on one row (iPhone-friendly) */
.controls{display:flex;gap:6px;flex-wrap:nowrap}
.controls .btn{flex:1 1 0;min-width:0;white-space:nowrap}
@media (max-width: 420px){
  .controls .btn{padding:8px 6px;font-size:13px;line-height:1.1}
}
`);
// ====== Local styles (original + mobile polish)
  injectLocalStyles(container, `
    /* Prevent iOS zoom; bigger tap targets + clearer focus */
    input, select, textarea, button { font-size:16px; }
    .btn, .segBtn, .hoser { min-height:44px; padding:10px 14px; touch-action: manipulation; }
    .btn:focus-visible, .segBtn:focus-visible, .hoser:focus-visible {
      outline: 3px solid rgba(110,203,255,.85); outline-offset: 2px;
    }

    /* Layout */
    .ink-strong { color: #ffffff; }
    .seg { display:inline-flex; background:#0f141c; border:1px solid rgba(255,255,255,.12); border-radius:12px; overflow:hidden }
    .segBtn {
      appearance:none; background:transparent; color:#cfe6ff; border:0;
      font-weight:700; cursor:pointer;
    }
    .segBtn.segOn { background:#1a2738; color:#fff; }

    /* Responsive nozzle card grid */
    .nozzWrap {
      display:grid; gap:10px;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    }
    @media (max-width: 480px) {
      .nozzWrap { grid-template-columns: 1fr; }
    }
    .nozzCard { background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px; }
    .groupHeader {
      grid-column:1/-1; margin:2px 0 6px 0; color:#fff; font-weight:800; letter-spacing:.2px;
      padding-top:4px; border-top:1px dashed rgba(255,255,255,.12);
    }
    .nozzTitle { color:#fff; font-weight:700; margin-bottom:4px; }
    .nozzSub { color:#cfe6ff; font-size:14px; }

    /* Hose row buttons */
    .hoseRow { display:flex; gap:8px; flex-wrap:wrap; }
    .hoseRow .hoser {
      appearance:none; border:1px solid rgba(255,255,255,.14); background:#131b26; color:#fff;
      border-radius:12px; font-weight:800; cursor:pointer;
    }
    .hoseRow .hoser.on { background:#2a8cff; }

    /* FL table */
    .flTable { width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; border-radius:12px; }
    .flTable th, .flTable td { padding:12px; text-align:left; font-size:15px; }
    .flTable thead th { background:#162130; color:#fff; border-bottom:1px solid rgba(255,255,255,.1); position:sticky; top:0; z-index:1; }
    .flTable tbody tr:nth-child(odd) td { background:#0e151e; color:#dfeaff; }
    .flTable tbody tr:nth-child(even) td { background:#111924; color:#dfeaff; }
    .flTable .muted { color:#a9bed9; }
    .flTable tr.hi td { outline:2px solid #2a8cff; outline-offset:-2px; }

    /* Rules list */
    .rulesList { display:grid; gap:8px; }
    .rule {
      background:#0e151e; border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:12px;
      display:flex; gap:10px; align-items:flex-start;
    }
    .pill {
      background:#2a8cff; color:#fff; font-weight:800;
      padding:6px 10px; border-radius:999px; font-size:12px; white-space:nowrap;
      align-self:flex-start;
    }
    .ruleTitle { color:#fff; font-weight:800; margin:0 0 2px 0; }
    .ruleText { colo
