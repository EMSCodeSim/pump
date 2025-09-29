// /js/view.practice.js
import { COEFF, FL_total, PSI_PER_FT } from './store.js';

const TRUCK_W = 390;
const TRUCK_H = 260;
const PX_PER_50FT = 45;
const CURVE_PULL = 36;
const BRANCH_LIFT = 10;
const TOL = 1; // fixed ±1 psi

// Master stream defaults (typical)
const MS_CHOICES = [
  { gpm: 500, NP: 80, appliance: 25 },
  { gpm: 750, NP: 80, appliance: 25 },
  { gpm: 1000, NP: 80, appliance: 25 }
];

export async function render(container){
  container.innerHTML = `
    <section class="stack">

      <!-- Controls ABOVE the truck -->
      <section class="card" style="padding-bottom:6px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:space-between">
          <div>
            <b>Practice Mode</b>
            <div class="sub">Use the info on the graphic to find Pump Pressure (PP).</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" id="newScenarioBtn">New Problem</button>
            <button class="btn" id="revealBtn">Reveal</button>
          </div>
        </div>
      </section>

      <!-- Visual (truck first) -->
      <section class="wrapper card">
        <div class="stage" id="stageP">
          <svg id="overlayPractice" preserveAspectRatio="xMidYMax meet" aria-label="Visual stage (practice)">
            <image id="truckImgP" href="https://fireopssim.com/pump/engine181.png" x="0" y="0" width="390" height="260" preserveAspectRatio="xMidYMax meet"></image>
            <g id="hosesP"></g><g id="branchesP"></g><g id="labelsP"></g>
          </svg>
        </div>

        <!-- Hose color key + Equations (NO master-stream equation shown) -->
        <div class="hoseLegend" style="margin-top:8px">
          <span class="legSwatch sw175"></span> 1¾″
          <span class="legSwatch sw25"></span> 2½″
          <span class="legSwatch sw5"></span> 5″
        </div>
        <div class="mini" style="margin-top:6px;opacity:.9">
          <div><b>Friction Loss:</b> <code>FL = C × (GPM/100)² × (length/100)</code></div>
          <div><b>PP (single line):</b> <code>PP = NP + Main FL ± Elev</code></div>
          <div><b>PP (two-branch wye):</b> <code>PP = max(Need A, Need B) + Main FL + Wye ± Elev</code></div>
          <div style="margin-top:4px"><b>C Coefficients:</b> 1¾″ = <b>${COEFF["1.75"]}</b>, 2½″ = <b>${COEFF["2.5"]}</b>, 5″ = <b>${COEFF["5"]}</b></div>
        </div>

        <!-- Status text / reveal work -->
        <div id="practiceInfo" class="status" style="margin-top:8px">Tap <b>New Problem</b> to generate a scenario.</div>
        <div id="work" class="math" style="margin-top:8px"></div>
      </section>

      <!-- Answer row (fixed ±1) -->
      <section class="card">
        <div class="row" style="align-items:flex-end">
          <div class="field" style="max-width:220px">
            <label>Your PP answer (psi)</label>
            <input type="number" id="ppGuess" placeholder="e.g., 145">
          </div>
          <div class="field" style="max-width:160px">
            <button class="btn primary" id="checkBtn" style="width:100%">Check (±${TOL})</button>
          </div>
        </div>
        <div id="practiceStatus" class="status" style="margin-top:8px">No scenario loaded.</div>
      </section>

    </section>
  `;

  // ===== DOM refs
  const stageEl = container.querySelector('#stageP');
  const svg = container.querySelector('#overlayPractice');
  const truckImg = container.querySelector('#truckImgP');
  const G_hosesP = container.querySelector('#hosesP');
  const G_branchesP = container.querySelector('#branchesP');
  const G_labelsP = container.querySelector('#labelsP');
  const practiceInfo = container.querySelector('#practiceInfo');
  const statusEl = container.querySelector('#practiceStatus');
  const workEl = container.querySelector('#work');

  const ns = 'http://www.w3.org/2000/svg';
  let practiceAnswer = null;
  let scenario = null; // keep last scenario for reveal

  // ===== geometry helpers (matches calc view)
  function computeViewHeight(mainFt, branchMaxFt){
    const mainPx = (mainFt/50)*PX_PER_50FT;
   
