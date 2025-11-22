
import { openPresetEditorPopup } from './view.presetEditor.js';
// preset.js – Department presets + line presets for FireOps Calc
// - Main Presets menu from the Preset button
//   • Department Setup
//   • Line 1 / Line 2 / Line 3 quick views (editable)
//   • Saved presets list
//   • "Add preset" button
// - Department setup popup (Nozzles, Hoses, Accessories)
// - Grouped nozzle selection (smooth / fog / master / specialty + custom)
// - Hose selection (attack / supply / wildland / low-friction + custom C)
// - Accessories selection (appliances, foam/eductors, gauges, misc + custom)
// - Line preset list stored in localStorage and applied via applyPresetToCalc

const STORAGE_KEY = 'fireops_presets_v1';
const STORAGE_DEPT_KEY = 'fireops_dept_equipment_v1';
const STORAGE_LINE_DEFAULTS_KEY = 'fireops_line_defaults_v1';

let state = {
  // wiring from setupPresets()
  isApp: false,
  triggerButtonId: 'presetsBtn',
  appStoreUrl: '',
  playStoreUrl: '',
  getLineState: null,      // function(lineNumber) -> {...}
  applyPresetToCalc: null, // function(preset)

  // presets
  presets: [],

  // department equipment
  deptNozzles: [],
  customNozzles: [],

  deptHoses: [],
  customHoses: [],

  deptAccessories: [],
  customAccessories: [],

  // department line defaults (per lineNumber)
  lineDefaults: {},
};

// === Shared styles for preset / dept popups =======================================

function injectAppPresetStyles() {
  if (document.getElementById('presetStyles')) return;

  const style = document.createElement('style');
  style.id = 'presetStyles';
  style.textContent = `
    .preset-panel-wrapper {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 12px 8px;
      box-sizing: border-box;
      background: rgba(3, 7, 18, 0.55);
      backdrop-filter: blur(6px);
    }
    .preset-panel-wrapper.hidden {
      display: none;
    }
    .preset-panel-backdrop {
      position: absolute;
      inset: 0;
    }
    .preset-panel {
      position: relative;
      max-width: 480px;
      width: 100%;
      margin: 0 auto;
      background: #020617;
      border-radius: 18px;
      box-shadow:
        0 18px 30px rgba(15, 23, 42, 0.75),
        0 0 0 1px rgba(148, 163, 184, 0.35);
      padding: 12px 14px 10px;
      color: #e5e7eb;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    @media (min-width: 640px) {
      .preset-panel {
        margin-top: 12px;
        border-radius: 20px;
        padding: 14px 16px 12px;
      }
    }
    .preset-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.25);
    }
    .preset-panel-title {
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .preset-close-btn {
      width: 26px;
      height: 26px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.6);
      background: radial-gradient(circle at 30% 30%, #1f2937, #020617);
      color: #e5e7eb;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
    }
    .preset-close-btn:hover {
      background: #111827;
    }
    .preset-panel-body {
      font-size: 0.85rem;
      line-height: 1.45;
      max-height: min(60vh, 420px);
      overflow-y: auto;
      padding-top: 4px;
      padding-bottom: 4px;
    }
    .preset-panel-body p {
      margin: 0 0 6px 0;
    }
    .preset-panel-footer {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      padding-top: 8px;
      border-top: 1px solid rgba(148, 163, 184, 0.25);
    }
    .btn-primary,
    .btn-secondary {
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 0.82rem;
      border: none;
      cursor: pointer;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .btn-primary {
      background: linear-gradient(135deg, #38bdf8, #22c55e);
      color: #020617;
      font-weight: 600;
    }
    .btn-secondary {
      background: rgba(15, 23, 42, 0.9);
      color: #e5e7eb;
      border: 1px solid rgba(148, 163, 184, 0.7);
    }
    .btn-primary:active,
    .btn-secondary:active {
      transform: translateY(1px);
    }

    /* Dept / wizard & line edit form */
    .dept-intro {
      font-size: 0.82rem;
      color: #cbd5f5;
      margin-bottom: 10px;
    }
    .dept-menu {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
    }
    @media (min-width: 480px) {
      .dept-menu {
        flex-direction: row;
        flex-wrap: wrap;
      }
      .dept-menu .btn-primary,
      .dept-menu .btn-secondary {
        flex: 1 1 120px;
        text-align: center;
        justify-content: center;
      }
    }
    .dept-columns {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 10px;
      flex-wrap: nowrap;
    }
    @media (min-width: 480px) {
      .dept-columns {
        flex-direction: row;
        flex-wrap: wrap;
      }
      .dept-column {
        flex: 1 1 200px;
      }
    }
    .dept-column h3 {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 4px 0;
      color: #bfdbfe;
    }
    .dept-list {
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(30, 64, 175, 0.5);
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .dept-option {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 0.8rem;
    }
    .dept-option input[type="checkbox"] {
      margin-top: 2px;
      width: 14px;
      height: 14px;
    }
    .dept-option span {
      flex: 1;
      word-break: break-word;
    }

    .dept-custom {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px dashed rgba(148, 163, 184, 0.4);
    }
    .dept-custom h3 {
      font-size: 0.8rem;
      font-weight: 600;
      margin: 0 0 4px 0;
      color: #e5e7eb;
    }
    .dept-custom-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 4px;
      font-size: 0.78rem;
    }
    .dept-custom-row label {
      flex: 1 1 90px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .dept-custom-row input,
    .dept-custom-row select {
      background: #020617;
      border-radius: 8px;
      border: 1px solid rgba(55, 65, 81, 0.9);
      color: #e5e7eb;
      padding: 4px 6px;
      font-size: 0.8rem;
    }

    /* Preset list bits */
    .preset-list-empty {
      font-size: 0.8rem;
      opacity: 0.8;
    }
    .preset-menu-presets {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 4px;
    }
    .preset-menu-preset-btn {
      width: 100%;
      justify-content: space-between;
      font-size: 0.8rem;
    }
    .preset-menu-preset-meta {
      display: block;
      font-size: 0.72rem;
      opacity: 0.75;
      margin-left: 4px;
    }
  `;
  document.head.appendChild(style);
}

// === Department data: nozzles + hoses + accessories ===============================

const STORAGE_DEPT_DEFAULT = {
  nozzles: [],
  customNozzles: [],
  hoses: [],
  customHoses: [],
  accessories: [],
  customAccessories: [],
};

// NOZZLES
const NOZZLES_SMOOTH = [
  { id: 'sb_78_50_160',   label: '7/8" smooth bore 160 gpm @ 50 psi' },
  { id: 'sb_1516_50_185', label: '15/16" smooth bore 185 gpm @ 50 psi' },
  { id: 'sb_1_50_210',    label: '1" smooth bore 210 gpm @ 50 psi' },
  { id: 'sb_1118_50_265', label: '1 1/8" smooth bore 265 gpm @ 50 psi' },
  { id: 'sb_114_50_325',  label: '1 1/4" smooth bore 325 gpm @ 50 psi' },
];

const NOZZLES_FOG = [
  { id: 'fog_15_100_95',       label: '1½" fog 95 gpm @ 100 psi' },
  { id: 'fog_15_100_125',      label: '1½" fog 125 gpm @ 100 psi' },
  { id: 'fog_175_75_150',      label: '1¾" fog 150 gpm @ 75 psi' },
  { id: 'fog_175_100_150',     label: '1¾" fog 150 gpm @ 100 psi' },

  // Chief XD options
  { id: 'fog_xd_175_75_150',   label: 'Chief XD 1¾" 150 gpm @ 75 psi' },
  { id: 'fog_xd_175_75_185',   label: 'Chief XD 1¾" 185 gpm @ 75 psi' },
  { id: 'fog_xd_175_50_165',   label: 'Chief XD 1¾" 165 gpm @ 50 psi' },
  { id: 'fog_xd_25_50_265',    label: 'Chief XD 2½" 265 gpm @ 50 psi' },

  { id: 'fog_25_100_250',      label: '2½" fog 250 gpm @ 100 psi' },
  { id: 'fog_25_100_300',      label: '2½" fog 300 gpm @ 100 psi' },
];

const NOZZLES_MASTER = [
  { id: 'ms_tip_138_500',  label: 'Master stream tip 1 3/8" – 500 gpm' },
  { id: 'ms_tip_112_600',  label: 'Master stream tip 1½" – 600 gpm' },
  { id: 'ms_tip_134_800',  label: 'Master stream tip 1¾" – 800 gpm' },
  { id: 'ms_tip_2_1000',   label: 'Master stream tip 2" – 1000 gpm' },
  { id: 'ms_fog_500',      label: 'Master fog nozzle 500 gpm' },
  { id: 'ms_fog_750',      label: 'Master fog nozzle 750 gpm' },
  { id: 'ms_fog_1000',     label: 'Master fog nozzle 1000 gpm' },
  { id: 'ms_fog_1250',     label: 'Master fog nozzle 1250 gpm' },
];

const NOZZLES_SPECIAL = [
  { id: 'sp_celler',        label: 'Celler nozzle' },
  { id: 'sp_piercing',      label: 'Piercing nozzle (pike pole)' },
  { id: 'sp_bresnan',       label: 'Bresnan distributor' },
  { id: 'sp_distributor',   label: 'Rotary distributor nozzle' },
  { id: 'sp_foammaster',    label: 'High expansion foam nozzle' },
  { id: 'sp_forestry',      label: 'Forestry nozzle (1")' },
  { id: 'sp_wildland_gated',label: 'Wildland gated wye / nozzle set' },
];

// HOSES
const HOSES_ATTACK = [
  { id: 'h_1',    label: '1" attack line (C ~ 12)' },
  { id: 'h_15',   label: '1½" attack line (C ~ 24)' },
  { id: 'h_175',  label: '1¾" attack line (C ~ 15)' },
  { id: 'h_2',    label: '2" attack line (C ~ 8)' },
  { id: 'h_25',   label: '2½" attack line (C ~ 2)' },
  { id: 'h_3',    label: '3" large line (C ~ 0.8)' },
];

const HOSES_SUPPLY = [
  { id: 'h_3_supply',  label: '3" supply line (C ~ 0.8)' },
  { id: 'h_4_ldh',     label: '4" LDH (C ~ 0.2)' },
  { id: 'h_5_ldh',     label: '5" LDH (C ~ 0.08)' },
];

const HOSES_WILDLAND = [
  { id: 'h_w_1',   label: '1" wildland hose' },
  { id: 'h_w_15',  label: '1½" wildland hose' },
  { id: 'h_booster_1', label: '1" booster reel' },
];

const HOSES_LOWFRICTION = [
  { id: 'h_lf_175', label: '1¾" low-friction attack (C ~ 12)' },
  { id: 'h_lf_2',   label: '2" low-friction attack (C ~ 6)' },
  { id: 'h_lf_25',  label: '2½" low-friction attack (C ~ 1.5)' },
  { id: 'h_lf_5',   label: '5" low-friction LDH (C ~ 0.06)' },
];

// ACCESSORIES
const ACCESSORIES_APPLIANCES = [
  { id: 'acc_wye',         label: 'Gated wye' },
  { id: 'acc_siamese',     label: 'Siamese' },
  { id: 'acc_water_thief', label: 'Water thief' },
  { id: 'acc_manifold',    label: 'Portable manifold' },
];

const ACCESSORIES_FOAM = [
  { id: 'acc_eductor',     label: 'Inline foam eductor' },
  { id: 'acc_foam_pro',    label: 'Foam proportioner' },
];

const ACCESSORIES_MONITORING = [
  { id: 'acc_inline_gauge', label: 'Inline pressure gauge' },
  { id: 'acc_hydrant_gate', label: 'Hydrant gate' },
];

const ACCESSORIES_MONITORS = [
  { id: 'acc_deck_gun',     label: 'Deck gun / apparatus monitor' },
  { id: 'acc_ground_monitor', label: 'Portable ground monitor' },
  { id: 'acc_blitzfire',    label: 'Blitzfire / RAM monitor' },
];

// === Storage helpers ==============================================================

function loadPresetsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Preset load failed', e);
    return [];
  }
}

function savePresetsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.presets || []));
  } catch (e) {
    console.warn('Preset save failed', e);
  }
}

function loadDeptFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_DEPT_KEY);
    if (!raw) return { ...STORAGE_DEPT_DEFAULT };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...STORAGE_DEPT_DEFAULT };
    return {
      nozzles: Array.isArray(parsed.nozzles) ? parsed.nozzles : [],
      customNozzles: Array.isArray(parsed.customNozzles) ? parsed.customNozzles : [],
      hoses: Array.isArray(parsed.hoses) ? parsed.hoses : [],
      customHoses: Array.isArray(parsed.customHoses) ? parsed.customHoses : [],
      accessories: Array.isArray(parsed.accessories) ? parsed.accessories : [],
      customAccessories: Array.isArray(parsed.customAccessories) ? parsed.customAccessories : [],
    };
  } catch (e) {
    console.warn('Dept load failed', e);
    return { ...STORAGE_DEPT_DEFAULT };
  }
}

function saveDeptToStorage() {
  try {
    const payload = {
      nozzles: state.deptNozzles || [],
      customNozzles: state.customNozzles || [],
      hoses: state.deptHoses || [],
      customHoses: state.customHoses || [],
      accessories: state.deptAccessories || [],
      customAccessories: state.customAccessories || [],
    };
    localStorage.setItem(STORAGE_DEPT_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Dept save failed', e);
  }
}


function loadLineDefaultsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_LINE_DEFAULTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.warn('Line defaults load failed', e);
    return {};
  }
}

function saveLineDefaultsToStorage() {
  try {
    const payload = state.lineDefaults || {};
    localStorage.setItem(STORAGE_LINE_DEFAULTS_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Line defaults save failed', e);
  }
}

// === Shared popup wrapper: Dept wizard ===========================================

function ensureDeptPopupWrapper() {
  injectAppPresetStyles();
  if (document.getElementById('deptPopupWrapper')) return;

  const wrap = document.createElement('div');
  wrap.id = 'deptPopupWrapper';
  wrap.className = 'preset-panel-wrapper hidden';

  wrap.innerHTML = `
    <div class="preset-panel-backdrop" data-dept-close="1"></div>
    <div class="preset-panel">
      <div class="preset-panel-header">
        <div class="preset-panel-title" id="deptPopupTitle">Presets</div>
        <button type="button" class="preset-close-btn" data-dept-close="1">✕</button>
      </div>
      <div class="preset-panel-body" id="deptPopupBody"></div>
      <div class="preset-panel-footer" id="deptPopupFooter"></div>
    </div>
  `;

  document.body.appendChild(wrap);

  wrap.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.deptClose === '1') {
      wrap.classList.add('hidden');
    }
  });
}

// === Department setup: home menu ==================================================

function renderDeptHomeScreen() {
  ensureDeptPopupWrapper();
  const wrap = document.getElementById('deptPopupWrapper');
  if (!wrap) return;

  const titleEl = wrap.querySelector('#deptPopupTitle');
  const bodyEl  = wrap.querySelector('#deptPopupBody');
  const footerEl= wrap.querySelector('#deptPopupFooter');
  if (!titleEl || !bodyEl || !footerEl) return;

  titleEl.textContent = 'Department setup';

  bodyEl.innerHTML = `
    <p class="dept-intro">
      Choose what you want to configure for your department. You can set up nozzles,
      hoses, and common accessories, then save line presets that match your rigs.
    </p>
    <div class="dept-menu">
      <button type="button" class="btn-primary" id="deptNozzlesBtn">Nozzles</button>
      <button type="button" class="btn-secondary" id="deptHosesBtn">Hoses</button>
      <button type="button" class="btn-secondary" id="deptAccessoriesBtn">Accessories</button>
    </div>

    <p class="dept-intro" style="margin-top:12px; margin-bottom:4px;">
      Department line defaults
    </p>
    <div class="dept-menu" style="margin-bottom:8px;">
      <button type="button" class="btn-secondary preset-line-default-btn" data-line="1">Line 1 default</button>
      <button type="button" class="btn-secondary preset-line-default-btn" data-line="2">Line 2 default</button>
      <button type="button" class="btn-secondary preset-line-default-btn" data-line="3">Line 3 default</button>
    </div>
  `;

  footerEl.innerHTML = `
    <button type="button" class="btn-secondary" data-dept-close="1">Close</button>
  `;

  const nozBtn = bodyEl.querySelector('#deptNozzlesBtn');
  if (nozBtn) nozBtn.addEventListener('click', () => renderNozzleSelectionScreen());

  const hoseBtn = bodyEl.querySelector('#deptHosesBtn');
  if (hoseBtn) hoseBtn.addEventListener('click', () => renderHoseSelectionScreen());

  const accBtn = bodyEl.querySelector('#deptAccessoriesBtn');
  if (accBtn) accBtn.addEventListener('click', () => renderAccessorySelectionScreen());

  // Line defaults buttons inside Department setup home
  bodyEl.querySelectorAll('.preset-line-default-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const line = Number(btn.getAttribute('data-line') || '1');
      renderDeptLineDefaultsScreen(line);
    });
  });

  wrap.classList.remove('hidden');
}

// === Nozzle selection screen ======================================================

function renderNozzleSelectionScreen() {
  ensureDeptPopupWrapper();
  const wrap = document.getElementById('deptPopupWrapper');
  if (!wrap) return;

  const titleEl = wrap.querySelector('#deptPopupTitle');
  const bodyEl  = wrap.querySelector('#deptPopupBody');
  const footerEl= wrap.querySelector('#deptPopupFooter');
  if (!titleEl || !bodyEl || !footerEl) return;

  titleEl.textContent = 'Department nozzles';

  const smoothHtml = NOZZLES_SMOOTH.map(n => `
    <label class="dept-option">
      <input type="checkbox" data-noz-id="${n.id}">
      <span>${n.label}</span>
    </label>
  `).join('');

  const fogHtml = NOZZLES_FOG.map(n => `
    <label class="dept-option">
      <input type="checkbox" data-noz-id="${n.id}">
      <span>${n.label}</span>
    </label>
  `).join('');

  const masterHtml = NOZZLES_MASTER.map(n => `
    <label class="dept-option">
      <input type="checkbox" data-noz-id="${n.id}">
      <span>${n.label}</span>
    </label>
  `).join('');

  const specialHtml = NOZZLES_SPECIAL.map(n => `
    <label class="dept-option">
      <input type="checkbox" data-noz-id="${n.id}">
      <span>${n.label}</span>
    </label>
  `).join('');

  bodyEl.innerHTML = `
    <p class="dept-intro">
      Check the nozzles your department actually carries. These will be used in future
      updates to shorten nozzle dropdowns and presets.
    </p>

    <div class="dept-columns">
      <div class="dept-column">
        <h3>Smooth bore</h3>
        <div class="dept-list" id="deptSmoothList">
          ${smoothHtml}
        </div>
      </div>
      <div class="dept-column">
        <h3>Fog / Combination</h3>
        <div class="dept-list" id="deptFogList">
          ${fogHtml}
        </div>
      </div>
      <div class="dept-column">
        <h3>Master stream</h3>
        <div class="dept-list" id="deptMasterList">
          ${masterHtml}
        </div>
      </div>
      <div class="dept-column">
        <h3>Specialty</h3>
        <div class="dept-list" id="deptSpecialList">
          ${specialHtml}
        </div>
      </div>
    </div>

    <div class="dept-custom">
      <h3>Custom nozzle</h3>
      <div class="dept-custom-row">
        <label>Name / label
          <input type="text" id="customNozName" placeholder="Example: 1 3/4&quot; attack line 160 gpm @ 75 psi">
        </label>
      </div>
      <div class="dept-custom-row">
        <label>GPM
          <input type="number" id="customNozGpm" inputmode="numeric" placeholder="160">
        </label>
        <label>Nozzle PSI
          <input type="number" id="customNozPsi" inputmode="numeric" placeholder="75">
        </label>
        <label>Type
          <select id="customNozType">
            <option value="smooth">Smooth bore</option>
            <option value="fog">Fog / Combo</option>
            <option value="master">Master stream</option>
            <option value="special">Specialty</option>
          </select>
        </label>
      </div>
      <div class="dept-custom-row">
        <button type="button" class="btn-secondary" id="customNozAddBtn">Add custom nozzle</button>
      </div>
    </div>
  `;

  footerEl.innerHTML = `
    <button type="button" class="btn-secondary" id="deptNozBackBtn">Back</button>
    <button type="button" class="btn-primary" id="deptNozSaveBtn">Save</button>
  `;

  const smoothList = bodyEl.querySelector('#deptSmoothList');
  const fogList    = bodyEl.querySelector('#deptFogList');
  const masterList = bodyEl.querySelector('#deptMasterList');
  const specialList= bodyEl.querySelector('#deptSpecialList');

  // Render saved custom nozzles
  const savedCustom = Array.isArray(state.customNozzles) ? state.customNozzles : [];
  for (const cn of savedCustom) {
    let host = null;
    if (cn.type === 'smooth') host = smoothList;
    else if (cn.type === 'fog') host = fogList;
    else if (cn.type === 'master') host = masterList;
    else host = specialList || fogList;
    if (!host) continue;
    const row = document.createElement('label');
    row.className = 'dept-option';
    row.innerHTML = `
      <input type="checkbox" data-noz-id="${cn.id}">
      <span>${cn.label}</span>
    `;
    host.appendChild(row);
  }

  // Pre-check based on state.deptNozzles
  const selected = new Set(state.deptNozzles || []);
  bodyEl.querySelectorAll('input[data-noz-id]').forEach((cb) => {
    const id = cb.getAttribute('data-noz-id');
    if (id && selected.has(id)) cb.checked = true;
  });

  const addBtn = bodyEl.querySelector('#customNozAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const nameEl = bodyEl.querySelector('#customNozName');
      const gpmEl  = bodyEl.querySelector('#customNozGpm');
      const psiEl  = bodyEl.querySelector('#customNozPsi');
      const typeEl = bodyEl.querySelector('#customNozType');
      if (!nameEl || !gpmEl || !psiEl || !typeEl) return;

      const name = String(nameEl.value || '').trim();
      if (!name) {
        alert('Please enter a name/label for the custom nozzle.');
        return;
      }
      const gpm = Number(gpmEl.value || 0);
      const psi = Number(psiEl.value || 0);
      let type = String(typeEl.value || 'fog');
      if (!['smooth','fog','master','special'].includes(type)) type = 'fog';

      const id = 'custom_noz_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      const labelParts = [name];
      if (gpm > 0) labelParts.push(gpm + ' gpm');
      if (psi > 0) labelParts.push('@ ' + psi + ' psi');
      const fullLabel = labelParts.join(' ');

      const custom = { id, label: fullLabel, type, gpm, psi };
      if (!Array.isArray(state.customNozzles)) state.customNozzles = [];
      state.customNozzles.push(custom);

      let host = null;
      if (type === 'smooth') host = smoothList;
      else if (type === 'fog') host = fogList;
      else if (type === 'master') host = masterList;
      else host = specialList || fogList;

      if (host) {
        const row = document.createElement('label');
        row.className = 'dept-option';
        row.innerHTML = `
          <input type="checkbox" data-noz-id="${id}" checked>
          <span>${fullLabel}</span>
        `;
        host.appendChild(row);
      }

      saveDeptToStorage();

      nameEl.value = '';
      gpmEl.value = '';
      psiEl.value = '';
    });
  }

  const backBtn = footerEl.querySelector('#deptNozBackBtn');
  if (backBtn) backBtn.addEventListener('click', () => renderDeptHomeScreen());

  const saveBtn = footerEl.querySelector('#deptNozSaveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const chosen = [];
      bodyEl.querySelectorAll('input[data-noz-id]').forEach((cb) => {
        if (cb.checked) {
          const id = cb.getAttribute('data-noz-id');
          if (id) chosen.push(id);
        }
      });
      state.deptNozzles = chosen;
      saveDeptToStorage();
      const wrap2 = document.getElementById('deptPopupWrapper');
      if (wrap2) wrap2.classList.add('hidden');
      openPresetMainMenu();
    });
  }

  wrap.classList.remove('hidden');
}

// === Hose selection screen ========================================================

function renderHoseSelectionScreen() {
  ensureDeptPopupWrapper();
  const wrap = document.getElementById('deptPopupWrapper');
  if (!wrap) return;

  const titleEl = wrap.querySelector('#deptPopupTitle');
  const bodyEl  = wrap.querySelector('#deptPopupBody');
  const footerEl= wrap.querySelector('#deptPopupFooter');
  if (!titleEl || !bodyEl || !footerEl) return;

  titleEl.textContent = 'Department hoses';

  const attackHtml = HOSES_ATTACK.map(h => `
    <label class="dept-option">
      <input type="checkbox" data-hose-id="${h.id}">
      <span>${h.label}</span>
    </label>
  `).join('');

  const supplyHtml = HOSES_SUPPLY.map(h => `
    <label class="dept-option">
      <input type="checkbox" data-hose-id="${h.id}">
      <span>${h.label}</span>
    </label>
  `).join('');

  const wildHtml = HOSES_WILDLAND.map(h => `
    <label class="dept-option">
      <input type="checkbox" data-hose-id="${h.id}">
      <span>${h.label}</span>
    </label>
  `).join('');

  const lowHtml = HOSES_LOWFRICTION.map(h => `
    <label class="dept-option">
      <input type="checkbox" data-hose-id="${h.id}">
      <span>${h.label}</span>
    </label>
  `).join('');

  bodyEl.innerHTML = `
    <p class="dept-intro">
      Check the hose sizes your department carries. Low-friction and custom hoses with C values
      can be added here and used later in your line presets and calculations.
    </p>

    <div class="dept-columns">
      <div class="dept-column">
        <h3>Attack lines</h3>
        <div class="dept-list" id="deptHoseAttackList">
          ${attackHtml}
        </div>
      </div>
      <div class="dept-column">
        <h3>Supply</h3>
        <div class="dept-list" id="deptHoseSupplyList">
          ${supplyHtml}
        </div>
      </div>
      <div class="dept-column">
        <h3>Wildland / Booster</h3>
        <div class="dept-list" id="deptHoseWildList">
          ${wildHtml}
        </div>
      </div>
      <div class="dept-column">
        <h3>Low-friction hose</h3>
        <div class="dept-list" id="deptHoseLFList">
          ${lowHtml}
        </div>
      </div>
    </div>

    <div class="dept-custom">
      <h3>Custom hose</h3>
      <div class="dept-custom-row">
        <label>Name / label
          <input type="text" id="customHoseName" placeholder="Example: 1 3/4&quot; low-friction preconnect">
        </label>
      </div>
      <div class="dept-custom-row">
        <label>Diameter (inches)
          <input type="number" id="customHoseDia" inputmode="decimal" placeholder="1.75">
        </label>
        <label>C value
          <input type="number" id="customHoseC" inputmode="decimal" placeholder="15">
        </label>
        <label>Category
          <select id="customHoseCategory">
            <option value="attack">Attack</option>
            <option value="supply">Supply</option>
            <option value="wildland">Wildland / Booster</option>
            <option value="lowfriction">Low-friction</option>
          </select>
        </label>
      </div>
      <div class="dept-custom-row">
        <button type="button" class="btn-secondary" id="customHoseAddBtn">Add custom hose</button>
      </div>
    </div>
  `;

  footerEl.innerHTML = `
    <button type="button" class="btn-secondary" id="deptHoseBackBtn">Back</button>
    <button type="button" class="btn-primary" id="deptHoseSaveBtn">Save</button>
  `;

  const attackList = bodyEl.querySelector('#deptHoseAttackList');
  const supplyList = bodyEl.querySelector('#deptHoseSupplyList');
  const wildList   = bodyEl.querySelector('#deptHoseWildList');
  const lfList     = bodyEl.querySelector('#deptHoseLFList');

  // Render saved custom hoses
  const savedCustomHoses = Array.isArray(state.customHoses) ? state.customHoses : [];
  for (const ch of savedCustomHoses) {
    let host = null;
    if (ch.category === 'attack') host = attackList;
    else if (ch.category === 'supply') host = supplyList;
    else if (ch.category === 'wildland') host = wildList;
    else host = lfList || supplyList;
    if (!host) continue;
    const row = document.createElement('label');
    row.className = 'dept-option';
    row.innerHTML = `
      <input type="checkbox" data-hose-id="${ch.id}">
      <span>${ch.label}</span>
    `;
    host.appendChild(row);
  }

  // Pre-check based on state.deptHoses
  const hSelected = new Set(state.deptHoses || []);
  bodyEl.querySelectorAll('input[data-hose-id]').forEach((cb) => {
    const id = cb.getAttribute('data-hose-id');
    if (id && hSelected.has(id)) cb.checked = true;
  });

  const addBtn = bodyEl.querySelector('#customHoseAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const nameEl = bodyEl.querySelector('#customHoseName');
      const diaEl  = bodyEl.querySelector('#customHoseDia');
      const cEl    = bodyEl.querySelector('#customHoseC');
      const catEl  = bodyEl.querySelector('#customHoseCategory');
      if (!nameEl || !diaEl || !cEl || !catEl) return;

      const name = String(nameEl.value || '').trim();
      if (!name) {
        alert('Please enter a name/label for the custom hose.');
        return;
      }
      const dia = Number(diaEl.value || 0);
      const c   = Number(cEl.value || 0);
      let cat   = String(catEl.value || 'attack');
      if (!['attack','supply','wildland','lowfriction'].includes(cat)) {
        cat = 'attack';
      }

      const id = 'custom_hose_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      const labelParts = [name];
      if (dia > 0) labelParts.push(dia + '"');
      if (c > 0) labelParts.push('(C ' + c + ')');
      const fullLabel = labelParts.join(' ');

      const custom = { id, label: fullLabel, diameter: dia, cValue: c, category: cat };
      if (!Array.isArray(state.customHoses)) state.customHoses = [];
      state.customHoses.push(custom);

      let host = null;
      if (cat === 'attack') host = attackList;
      else if (cat === 'supply') host = supplyList;
      else if (cat === 'wildland') host = wildList;
      else host = lfList || supplyList;

      if (host) {
        const row = document.createElement('label');
        row.className = 'dept-option';
        row.innerHTML = `
          <input type="checkbox" data-hose-id="${id}" checked>
          <span>${fullLabel}</span>
        `;
        host.appendChild(row);
      }

      saveDeptToStorage();

      nameEl.value = '';
      diaEl.value  = '';
      cEl.value    = '';
    });
  }

  const backBtn = footerEl.querySelector('#deptHoseBackBtn');
  if (backBtn) backBtn.addEventListener('click', () => renderDeptHomeScreen());

  const saveBtn = footerEl.querySelector('#deptHoseSaveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const chosen = [];
      bodyEl.querySelectorAll('input[data-hose-id]').forEach((cb) => {
        if (cb.checked) {
          const id = cb.getAttribute('data-hose-id');
          if (id) chosen.push(id);
        }
      });
      state.deptHoses = chosen;
      saveDeptToStorage();
      const wrap2 = document.getElementById('deptPopupWrapper');
      if (wrap2) wrap2.classList.add('hidden');
      openPresetMainMenu();
    });
  }

  wrap.classList.remove('hidden');
}

// === Accessories selection screen =================================================

function renderAccessorySelectionScreen() {
  ensureDeptPopupWrapper();
  const wrap = document.getElementById('deptPopupWrapper');
  if (!wrap) return;

  const titleEl = wrap.querySelector('#deptPopupTitle');
  const bodyEl  = wrap.querySelector('#deptPopupBody');
  const footerEl= wrap.querySelector('#deptPopupFooter');
  if (!titleEl || !bodyEl || !footerEl) return;

  titleEl.textContent = 'Department accessories';

  const appHtml = ACCESSORIES_APPLIANCES.map(a => `
    <label class="dept-option">
      <input type="checkbox" data-acc-id="${a.id}">
      <span>${a.label}</span>
    </label>
  `).join('');

  const foamHtml = ACCESSORIES_FOAM.map(a => `
    <label class="dept-option">
      <input type="checkbox" data-acc-id="${a.id}">
      <span>${a.label}</span>
    </label>
  `).join('');

  const monHtml = ACCESSORIES_MONITORING.map(a => `
    <label class="dept-option">
      <input type="checkbox" data-acc-id="${a.id}">
      <span>${a.label}</span>
    </label>
  `).join('');

  const devHtml = ACCESSORIES_MONITORS.map(a => `
    <label class="dept-option">
      <input type="checkbox" data-acc-id="${a.id}">
      <span>${a.label}</span>
    </label>
  `).join('');

  bodyEl.innerHTML = `
    <p class="dept-intro">
      Select accessories and appliances commonly used in your operations. These can later be
      tied into scenarios, notes, or pump card references.
    </p>

    <div class="dept-columns">
      <div class="dept-column">
        <h3>Appliances</h3>
        <div class="dept-list" id="deptAccAppList">
          ${appHtml}
        </div>
      </div>
      <div class="dept-column">
        <h3>Foam / Eductor</h3>
        <div class="dept-list" id="deptAccFoamList">
          ${foamHtml}
        </div>
      </div>
      <div class="dept-column">
        <h3>Gauges / Gates</h3>
        <div class="dept-list" id="deptAccMonList">
          ${monHtml}
        </div>
      </div>
      <div class="dept-column">
        <h3>Monitors</h3>
        <div class="dept-list" id="deptAccDevList">
          ${devHtml}
        </div>
      </div>
    </div>

    <div class="dept-custom">
      <h3>Custom accessory</h3>
      <div class="dept-custom-row">
        <label>Name / label
          <input type="text" id="customAccName" placeholder="Example: High-rise pack w/ inline gauge">
        </label>
      </div>
      <div class="dept-custom-row">
        <label>Category
          <select id="customAccCategory">
            <option value="appliance">Appliance</option>
            <option value="foam">Foam / Eductor</option>
            <option value="monitoring">Gauge / Gate</option>
            <option value="monitor">Monitor / Device</option>
          </select>
        </label>
      </div>
      <div class="dept-custom-row">
        <button type="button" class="btn-secondary" id="customAccAddBtn">Add custom accessory</button>
      </div>
    </div>
  `;

  footerEl.innerHTML = `
    <button type="button" class="btn-secondary" id="deptAccBackBtn">Back</button>
    <button type="button" class="btn-primary" id="deptAccSaveBtn">Save</button>
  `;

  const appList = bodyEl.querySelector('#deptAccAppList');
  const foamList= bodyEl.querySelector('#deptAccFoamList');
  const monList = bodyEl.querySelector('#deptAccMonList');
  const devList = bodyEl.querySelector('#deptAccDevList');

  const savedCustomAcc = Array.isArray(state.customAccessories) ? state.customAccessories : [];
  for (const ca of savedCustomAcc) {
    let host = null;
    if (ca.category === 'appliance') host = appList;
    else if (ca.category === 'foam') host = foamList;
    else if (ca.category === 'monitoring') host = monList;
    else host = devList || appList;
    if (!host) continue;
    const row = document.createElement('label');
    row.className = 'dept-option';
    row.innerHTML = `
      <input type="checkbox" data-acc-id="${ca.id}">
      <span>${ca.label}</span>
    `;
    host.appendChild(row);
  }

  const accSelected = new Set(state.deptAccessories || []);
  bodyEl.querySelectorAll('input[data-acc-id]').forEach((cb) => {
    const id = cb.getAttribute('data-acc-id');
    if (id && accSelected.has(id)) cb.checked = true;
  });

  const addBtn = bodyEl.querySelector('#customAccAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const nameEl = bodyEl.querySelector('#customAccName');
      const catEl  = bodyEl.querySelector('#customAccCategory');
      if (!nameEl || !catEl) return;

      const name = String(nameEl.value || '').trim();
      if (!name) {
        alert('Please enter a name/label for the accessory.');
        return;
      }
      let cat = String(catEl.value || 'appliance');
      if (!['appliance','foam','monitoring','monitor'].includes(cat)) {
        cat = 'appliance';
      }

      const id = 'custom_acc_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      const fullLabel = name;

      const custom = { id, label: fullLabel, category: cat };
      if (!Array.isArray(state.customAccessories)) state.customAccessories = [];
      state.customAccessories.push(custom);

      let host = null;
      if (cat === 'appliance') host = appList;
      else if (cat === 'foam') host = foamList;
      else if (cat === 'monitoring') host = monList;
      else host = devList || appList;

      if (host) {
        const row = document.createElement('label');
        row.className = 'dept-option';
        row.innerHTML = `
          <input type="checkbox" data-acc-id="${id}" checked>
          <span>${fullLabel}</span>
        `;
        host.appendChild(row);
      }

      saveDeptToStorage();
      nameEl.value = '';
    });
  }

  const backBtn = footerEl.querySelector('#deptAccBackBtn');
  if (backBtn) backBtn.addEventListener('click', () => renderDeptHomeScreen());

  const saveBtn = footerEl.querySelector('#deptAccSaveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const chosen = [];
      bodyEl.querySelectorAll('input[data-acc-id]').forEach((cb) => {
        if (cb.checked) {
          const id = cb.getAttribute('data-acc-id');
          if (id) chosen.push(id);
        }
      });
      state.deptAccessories = chosen;
      saveDeptToStorage();
      const wrap2 = document.getElementById('deptPopupWrapper');
      if (wrap2) wrap2.classList.add('hidden');
      openPresetMainMenu();
    });
  }

  wrap.classList.remove('hidden');
}

// === Dept wizard entry ============================================================

function openDeptWizard() {
  const dept = loadDeptFromStorage();
  state.deptNozzles = dept.nozzles;
  state.customNozzles = dept.customNozzles;
  state.deptHoses = dept.hoses;
  state.customHoses = dept.customHoses;
  state.deptAccessories = dept.accessories;
  state.customAccessories = dept.customAccessories;
  renderDeptHomeScreen();
}

// === App Preset panel wrapper (top-level presets menu) ============================

function ensureAppPresetPanelExists() {
  injectAppPresetStyles();
  if (document.getElementById('appPresetWrapper')) return;

  const wrap = document.createElement('div');
  wrap.id = 'appPresetWrapper';
  wrap.className = 'preset-panel-wrapper hidden';

  wrap.innerHTML = `
    <div class="preset-panel-backdrop" data-app-preset-close="1"></div>
    <div class="preset-panel">
      <div class="preset-panel-header">
        <div class="preset-panel-title">Presets</div>
        <button type="button" class="preset-close-btn" data-app-preset-close="1">✕</button>
      </div>
      <div class="preset-panel-body" id="appPresetBody"></div>
      <div class="preset-panel-footer" id="appPresetFooter"></div>
    </div>
  `;

  document.body.appendChild(wrap);

  wrap.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.appPresetClose === '1') {
      wrap.classList.add('hidden');
    }
  });
}

// === Line detail screen (Line 1 / Line 2 / Line 3) – EDITABLE =====================

function renderLineInfoScreen(lineNumber) {
  ensureAppPresetPanelExists();
  const wrap = document.getElementById('appPresetWrapper');
  if (!wrap) return;
  const body   = wrap.querySelector('#appPresetBody');
  const footer = wrap.querySelector('#appPresetFooter');
  const titleEl= wrap.querySelector('.preset-panel-title');
  if (!body || !footer || !titleEl) return;

  const current = state.getLineState ? (state.getLineState(lineNumber) || {}) : {};

  const hoseVal = current.hoseDiameter ?? '';
  const lenVal  = (typeof current.lengthFt === 'number' ? current.lengthFt : (current.lengthFt ?? ''));
  const nozVal  = current.nozzleId ?? '';
  const psiVal  = (typeof current.nozzlePsi === 'number' ? current.nozzlePsi : (current.nozzlePsi ?? ''));

  titleEl.textContent = `Line ${lineNumber} setup`;

  body.innerHTML = `
    <p class="dept-intro">
      Edit the Line ${lineNumber} setup here. This does not change the main line until you
      hit "Apply to line". You can also save this as a reusable preset.
    </p>
    <div class="dept-list">
      <div class="dept-custom-row">
        <label>Hose diameter (inches)
          <input type="number" id="lineEditHoseDia" inputmode="decimal" value="${hoseVal}">
        </label>
        <label>Length (ft)
          <input type="number" id="lineEditLength" inputmode="numeric" value="${lenVal}">
        </label>
      </div>
      <div class="dept-custom-row">
        <label>Nozzle ID / label
          <input type="text" id="lineEditNozId" value="${nozVal}">
        </label>
        <label>Nozzle PSI
          <input type="number" id="lineEditNozPsi" inputmode="numeric" value="${psiVal}">
        </label>
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn-secondary" id="lineBackBtn">Back</button>
    <button type="button" class="btn-secondary" id="lineRefreshBtn">Refresh from calc</button>
    <button type="button" class="btn-secondary" id="lineApplyBtn">Apply to line</button>
    <button type="button" class="btn-primary" id="lineSavePresetBtn">Save as preset</button>
  `;

  function readEditedLineState() {
    const hoseEl = body.querySelector('#lineEditHoseDia');
    const lenEl  = body.querySelector('#lineEditLength');
    const nozEl  = body.querySelector('#lineEditNozId');
    const psiEl  = body.querySelector('#lineEditNozPsi');
    const edited = { ...(state.getLineState ? (state.getLineState(lineNumber) || {}) : {}) };

    if (hoseEl) {
      const v = hoseEl.value.trim();
      edited.hoseDiameter = v ? Number(v) : null;
    }
    if (lenEl) {
      const v = lenEl.value.trim();
      edited.lengthFt = v ? Number(v) : null;
    }
    if (nozEl) {
      edited.nozzleId = nozEl.value.trim();
    }
    if (psiEl) {
      const v = psiEl.value.trim();
      edited.nozzlePsi = v ? Number(v) : null;
    }
    return edited;
  }

  footer.querySelector('#lineBackBtn')?.addEventListener('click', () => {
    openPresetMainMenu();
  });

  footer.querySelector('#lineRefreshBtn')?.addEventListener('click', () => {
    if (!state.getLineState) return;
    const latest = state.getLineState(lineNumber) || {};
    const hoseEl = body.querySelector('#lineEditHoseDia');
    const lenEl  = body.querySelector('#lineEditLength');
    const nozEl  = body.querySelector('#lineEditNozId');
    const psiEl  = body.querySelector('#lineEditNozPsi');
    if (hoseEl) hoseEl.value = latest.hoseDiameter ?? '';
    if (lenEl)  lenEl.value  = (typeof latest.lengthFt === 'number' ? latest.lengthFt : (latest.lengthFt ?? ''));
    if (nozEl)  nozEl.value  = latest.nozzleId ?? '';
    if (psiEl)  psiEl.value  = (typeof latest.nozzlePsi === 'number' ? latest.nozzlePsi : (latest.nozzlePsi ?? ''));
  });

  footer.querySelector('#lineApplyBtn')?.addEventListener('click', () => {
    if (!state.applyPresetToCalc) {
      alert('Apply function not wired yet.');
      return;
    }
    const edited = readEditedLineState();
    const tempPreset = {
      id: null,
      name: `Line ${lineNumber} (edited)`,
      lineNumber,
      summary: '',
      payload: edited,
    };
    state.applyPresetToCalc(tempPreset);
    const wrap2 = document.getElementById('appPresetWrapper');
    if (wrap2) wrap2.classList.add('hidden');
  });

  footer.querySelector('#lineSavePresetBtn')?.addEventListener('click', () => {
    const edited = readEditedLineState();
    const defaultName = `Line ${lineNumber} preset`;
    const name = prompt('Preset name', defaultName);
    if (!name) return;

    const summaryParts = [];
    if (edited.hoseDiameter) summaryParts.push(edited.hoseDiameter + '"');
    if (typeof edited.lengthFt === 'number') summaryParts.push(edited.lengthFt + ' ft');
    if (edited.nozzleId) summaryParts.push('Nozzle: ' + edited.nozzleId);
    const summary = summaryParts.join(' • ');

    const preset = {
      id: 'preset_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name,
      lineNumber,
      summary,
      payload: edited,
    };

    if (!Array.isArray(state.presets)) state.presets = [];
    state.presets.push(preset);
    savePresetsToStorage();
    openPresetMainMenu();
  });

  wrap.classList.remove('hidden');
}

// === Main Presets menu ===========================================================


function renderDeptLineDefaultsScreen(lineNumber) {
  ensureDeptPopupWrapper();
  const wrap = document.getElementById('deptPopupWrapper');
  if (!wrap) return;

  const titleEl = wrap.querySelector('#deptPopupTitle');
  const bodyEl  = wrap.querySelector('#deptPopupBody');
  const footerEl= wrap.querySelector('#deptPopupFooter');
  if (!titleEl || !bodyEl || !footerEl) return;

  const key = 'line' + String(lineNumber);
  const currentDefaults = (state.lineDefaults && state.lineDefaults[key]) || {};

  const hoseVal = currentDefaults.hoseDiameter ?? '';
  const lenVal  = (typeof currentDefaults.lengthFt === 'number'
    ? currentDefaults.lengthFt
    : (currentDefaults.lengthFt ?? ''));
  const nozVal  = currentDefaults.nozzleId ?? '';
  const psiVal  = (typeof currentDefaults.nozzlePsi === 'number'
    ? currentDefaults.nozzlePsi
    : (currentDefaults.nozzlePsi ?? ''));

  titleEl.textContent = `Line ${lineNumber} department default`;

  bodyEl.innerHTML = `
    <p class="dept-intro">
      Set the default configuration for Line ${lineNumber}. This is your rig/department
      starting point and does <strong>not</strong> change automatically when you adjust
      lines on the main calculator screen.
    </p>
    <div class="dept-list">
      <div class="dept-custom-row">
        <label>Hose diameter (inches)
          <input type="number" id="deptLineHoseDia" inputmode="decimal" value="${hoseVal}">
        </label>
        <label>Length (ft)
          <input type="number" id="deptLineLength" inputmode="numeric" value="${lenVal}">
        </label>
      </div>
      <div class="dept-custom-row">
        <label>Nozzle ID / label
          <input type="text" id="deptLineNozId" value="${nozVal}">
        </label>
        <label>Nozzle PSI
          <input type="number" id="deptLineNozPsi" inputmode="numeric" value="${psiVal}">
        </label>
      </div>
    </div>
  `;

  footerEl.innerHTML = `
    <button type="button" class="btn-secondary" id="deptLineBackBtn">Back</button>
    <button type="button" class="btn-primary" id="deptLineSaveBtn">Save default</button>
  `;

  footerEl.querySelector('#deptLineBackBtn')?.addEventListener('click', () => {
    // Go back to main Presets menu instead of dept home
    const wrap2 = document.getElementById('deptPopupWrapper');
    if (wrap2) wrap2.classList.add('hidden');
    openPresetMainMenu();
  });

  footerEl.querySelector('#deptLineSaveBtn')?.addEventListener('click', () => {
    const hoseEl = bodyEl.querySelector('#deptLineHoseDia');
    const lenEl  = bodyEl.querySelector('#deptLineLength');
    const nozEl  = bodyEl.querySelector('#deptLineNozId');
    const psiEl  = bodyEl.querySelector('#deptLineNozPsi');

    const next = { ...(state.lineDefaults && state.lineDefaults[key] ? state.lineDefaults[key] : {}) };

    if (hoseEl) {
      const v = hoseEl.value.trim();
      next.hoseDiameter = v ? Number(v) : null;
    }
    if (lenEl) {
      const v = lenEl.value.trim();
      next.lengthFt = v ? Number(v) : null;
    }
    if (nozEl) {
      next.nozzleId = nozEl.value.trim();
    }
    if (psiEl) {
      const v = psiEl.value.trim();
      next.nozzlePsi = v ? Number(v) : null;
    }

    if (!state.lineDefaults) state.lineDefaults = {};
    state.lineDefaults[key] = next;
    saveLineDefaultsToStorage();

    const wrap2 = document.getElementById('deptPopupWrapper');
    if (wrap2) wrap2.classList.add('hidden');
    openPresetMainMenu();
  });

  wrap.classList.remove('hidden');
}

function openPresetMainMenu() {
  ensureAppPresetPanelExists();
  const wrap = document.getElementById('appPresetWrapper');
  if (!wrap) return;
  const body   = wrap.querySelector('#appPresetBody');
  const footer = wrap.querySelector('#appPresetFooter');
  const titleEl= wrap.querySelector('.preset-panel-title');
  if (!body || !footer || !titleEl) return;

  titleEl.textContent = 'Presets';

  const presets = state.presets || [];
  const savedHtml = presets.length
    ? presets.map(p => `
        <button type="button"
                class="btn-secondary preset-menu-preset-btn"
                data-preset-id="${p.id}">
          <span>${p.name}</span>
          <span class="preset-menu-preset-meta">
            Line ${p.lineNumber || 1}${p.summary ? ' • ' + p.summary : ''}
          </span>
        </button>
      `).join('')
    : `<div class="preset-list-empty">No saved presets yet.</div>`;

  body.innerHTML = `
    <div class="dept-menu" style="margin-bottom:8px;">
      <button type="button" class="btn-primary" id="presetDeptSetupBtn">
        Department setup
      </button>
    </div>


    <p class="dept-intro" style="margin-top:6px; margin-bottom:4px;">
      Quick line setup
    </p>
    <div class="dept-menu" style="margin-bottom:8px;">
      <button type="button" class="btn-secondary preset-line-btn" data-line="1">Line 1 (scene)</button>
      <button type="button" class="btn-secondary preset-line-btn" data-line="2">Line 2 (scene)</button>
      <button type="button" class="btn-secondary preset-line-btn" data-line="3">Line 3 (scene)</button>
    </div>

    <p class="dept-intro" style="margin-top:6px; margin-bottom:4px;">
      Saved presets
    </p>
    <div class="preset-menu-presets" id="presetSavedList">
      ${savedHtml}
    </div>
  `;

  footer.innerHTML = `
    <button type="button" class="btn-secondary" data-app-preset-close="1">Close</button>
    <button type="button" class="btn-primary" id="presetAddPresetBtn">Add preset</button>
  `;

  // Department setup button
  const deptBtn = body.querySelector('#presetDeptSetupBtn');
  if (deptBtn) {
    deptBtn.addEventListener('click', () => {
      wrap.classList.add('hidden');
      openDeptWizard();
    });
  }

  // Line buttons (scene-only quick editors)
  body.querySelectorAll('.preset-line-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const line = Number(btn.getAttribute('data-line') || '1');
      renderLineInfoScreen(line);
    });
  });

  // Department line default buttons (open separate defaults editor)
  body.querySelectorAll('.preset-line-default-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const line = Number(btn.getAttribute('data-line') || '1');
      renderDeptLineDefaultsScreen(line);
    });
  });

  // Saved preset buttons: apply directly when clicked
  body.querySelectorAll('.preset-menu-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-preset-id');
      const preset = (state.presets || []).find(p => p.id === id);
      if (!preset || !state.applyPresetToCalc) return;
      state.applyPresetToCalc(preset);
      wrap.classList.add('hidden');
    });
  });

  // Add preset button: saves current Line 1 by default (user can rename)
  const addBtn = footer.querySelector('#presetAddPresetBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      handleAddPresetClick();
      openPresetMainMenu(); // refresh list
    });
  }

  wrap.classList.remove('hidden');
}

// Legacy helper: keep name but point to new main menu
function openPresetPanelApp() {
  openPresetMainMenu();
}

// === Add preset from current calc (defaults to Line 1) ===========================

function handleAddPresetClick() {
  // New flow: open the dedicated Preset Line Editor popup
  // instead of directly capturing the current line state.
  const dept = loadDeptFromStorage() || {};

  openPresetEditorPopup({
    dept,
    initialPreset: null,
    onSave(presetConfig) {
      // Minimal save path for now: store the config in state.presets
      const name = (presetConfig && presetConfig.name) || 'New preset';

      const preset = {
        id: 'preset_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        name,
        lineType: presetConfig && presetConfig.lineType,
        config: presetConfig || {},
      };

      if (!Array.isArray(state.presets)) state.presets = [];
      state.presets.push(preset);
      savePresetsToStorage();

      // Re-open the main preset panel to show the new preset
      if (typeof openPresetPanelApp === 'function') {
        openPresetPanelApp();
      }
    }
  });
}

// Simple info panel for web-only mode (currently forwards to main menu)
function openPresetInfoPanelWeb() {
  openPresetMainMenu();
}

// === Public API ===================================================================


export function getDeptLineDefaults() {
  return state.lineDefaults || {};
}


export function getDeptNozzleIds() {
  try {
    const dept = loadDeptFromStorage();
    if (!dept || typeof dept !== 'object') return [];
    const out = [];
    if (Array.isArray(dept.nozzles)) {
      dept.nozzles.forEach(id => {
        if (typeof id === 'string' && id.trim().length) out.push(id.trim());
      });
    }
    if (Array.isArray(dept.customNozzles)) {
      dept.customNozzles.forEach(n => {
        if (!n) return;
        if (typeof n === 'string') {
          const v = n.trim();
          if (v.length) out.push(v);
        } else if (typeof n.id === 'string') {
          const v = n.id.trim();
          if (v.length) out.push(v);
        }
      });
    }
    return out;
  } catch (e) {
    console.warn('getDeptNozzleIds failed', e);
    return [];
  }
}

export function getDeptHoseDiameters() {
  try {
    const dept = loadDeptFromStorage();
    if (!dept || typeof dept !== 'object') return [];
    const outSet = new Set();

    // Map built-in hose IDs to diameters (in inches, as strings used by COEFF)
    const HOSE_ID_TO_DIA = {
      'h_1':        '1',
      'h_15':       '1.5',
      'h_175':      '1.75',
      'h_2':        '2.0',
      'h_25':       '2.5',
      'h_3':        '3',
      'h_3_supply': '3',
      'h_4_ldh':    '4',
      'h_5_ldh':    '5',
      'h_w_1':      '1',
      'h_w_15':     '1.5',
      'h_booster_1':'1',
      'h_lf_175':   '1.75',
      'h_lf_2':     '2.0',
      'h_lf_25':    '2.5',
      'h_lf_5':     '5',
    };

    // Built-in hose selections
    if (Array.isArray(dept.hoses)) {
      dept.hoses.forEach(id => {
        if (typeof id !== 'string') return;
        const key = id.trim();
        const dia = HOSE_ID_TO_DIA[key];
        if (dia) outSet.add(dia);
      });
    }

    // Custom hoses with explicit diameters
    if (Array.isArray(dept.customHoses)) {
      dept.customHoses.forEach(h => {
        if (!h) return;
        if (typeof h.diameter === 'number' && h.diameter > 0) {
          const dia = String(h.diameter);
          outSet.add(dia);
        }
      });
    }

    return Array.from(outSet).sort((a,b) => parseFloat(a) - parseFloat(b));
  } catch (e) {
    console.warn('getDeptHoseDiameters failed', e);
    return [];
  }
}

export function setupPresets(opts = {}) {
  state.isApp = !!opts.isApp;
  state.triggerButtonId = opts.triggerButtonId || 'presetsBtn';
  state.appStoreUrl = opts.appStoreUrl || '';
  state.playStoreUrl = opts.playStoreUrl || '';
  state.getLineState = typeof opts.getLineState === 'function' ? opts.getLineState : null;
  state.applyPresetToCalc = typeof opts.applyPresetToCalc === 'function' ? opts.applyPresetToCalc : null;

  // Always load from storage so it works in web + app
  state.presets = loadPresetsFromStorage();
  state.lineDefaults = loadLineDefaultsFromStorage();
  const dept = loadDeptFromStorage();
  state.deptNozzles = dept.nozzles;
  state.customNozzles = dept.customNozzles;
  state.deptHoses = dept.hoses;
  state.customHoses = dept.customHoses;
  state.deptAccessories = dept.accessories;
  state.customAccessories = dept.customAccessories;

  const triggerBtn = document.getElementById(state.triggerButtonId);
  if (!triggerBtn) return;

  triggerBtn.addEventListener('click', () => {
    // Always show full menu
    openPresetPanelApp();
  });
}
