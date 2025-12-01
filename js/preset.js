import { openPresetEditorPopup } from './view.presetEditor.js';
import { openStandardLinePopup }   from './view.lineStandard.js';
import { openMasterStreamPopup }   from './view.lineMaster.js';
import { openStandpipePopup }      from './view.lineStandpipe.js';
import { openSprinklerPopup }      from './view.lineSprinkler.js';
import { openFoamPopup }           from './view.lineFoam.js';
import { openSupplyLinePopup }     from './view.lineSupply.js';
import { openCustomBuilderPopup }  from './view.lineCustom.js';
import { setDeptLineDefault, NOZ, NOZ_LIST } from './store.js';
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

const STORAGE_KEY = 'fireops_presets_v2';
const STORAGE_DEPT_KEY = 'fireops_dept_v2';
const STORAGE_LINE_DEFAULTS_KEY = 'fireops_dept_line_defaults_v1';

const state = {
  isApp: false,
  triggerButtonId: 'presetsBtn',
  appStoreUrl: '',
  playStoreUrl: '',

  // live, normalized views (within the popup)
  presets: [],
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
    .preset-panel {
      width: min(980px, 100%);
      max-height: 100%;
      overflow: hidden;
      border-radius: 18px;
      background: radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 55%),
                  radial-gradient(circle at top right, rgba(52,211,153,0.18), transparent 55%),
                  rgba(15, 23, 42, 0.97);
      color: #f9fafb;
      box-shadow:
        0 18px 60px rgba(15, 23, 42, 0.85),
        0 0 0 1px rgba(148, 163, 184, 0.25),
        inset 0 0 0 1px rgba(15, 23, 42, 0.6);
      display: flex;
      flex-direction: column;
      border: 1px solid rgba(148, 163, 184, 0.3);
      backdrop-filter: blur(10px);
    }
    .preset-panel-header {
      padding: 14px 18px 10px 18px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.35);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .preset-panel-header .title {
      font-size: 17px;
      font-weight: 600;
      letter-spacing: 0.02em;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .preset-panel-header .title span.badge {
      font-size: 11px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.55);
      color: #e5e7eb;
    }
    .preset-panel-header .close-btn {
      border: none;
      background: rgba(15, 23, 42, 0.9);
      color: #e5e7eb;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      box-shadow:
        0 0 0 1px rgba(148,163,184,0.4),
        0 10px 30px rgba(15,23,42,0.75);
    }
    .preset-panel-header .close-btn:hover {
      background: rgba(15, 23, 42, 1);
      transform: translateY(-0.5px);
    }
    .preset-panel-header .close-btn span.x {
      font-size: 16px;
      line-height: 1;
    }

    .preset-panel-body {
      padding: 12px 18px 12px 18px;
      overflow: auto;
      flex: 1;
    }

    .preset-panel-footer {
      padding: 10px 18px 12px 18px;
      border-top: 1px solid rgba(148, 163, 184, 0.35);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      background: radial-gradient(circle at top, rgba(15, 23, 42, 0.85), rgba(15,23,42,1));
    }

    .preset-section-title {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #9ca3af;
      margin-bottom: 8px;
    }
    .preset-intro {
      font-size: 13px;
      color: #cbd5f5;
      margin-bottom: 12px;
      line-height: 1.5;
    }

    .preset-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.2fr);
      gap: 12px;
    }
    @media (max-width: 800px) {
      .preset-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .preset-card {
      border-radius: 16px;
      background:
        radial-gradient(circle at top left, rgba(59,130,246,0.12), transparent 60%),
        radial-gradient(circle at bottom right, rgba(56,189,248,0.14), transparent 60%),
        rgba(15,23,42,0.96);
      border: 1px solid rgba(148, 163, 184, 0.25);
      box-shadow:
        0 10px 40px rgba(15, 23, 42, 0.85),
        0 0 0 1px rgba(15,23,42,0.8);
      padding: 10px 12px 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
      overflow: hidden;
    }
    .preset-card::before {
      content: '';
      position: absolute;
      inset: -40%;
      background:
        radial-gradient(circle at top left, rgba(59,130,246,0.11), transparent 60%),
        radial-gradient(circle at bottom right, rgba(56,189,248,0.11), transparent 60%);
      opacity: 0.7;
      pointer-events: none;
    }
    .preset-card-header {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .preset-card-header h3 {
      font-size: 14px;
      font-weight: 600;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .preset-card-header h3 span.subtitle {
      font-size: 11px;
      font-weight: 400;
      color: #9ca3af;
    }
    .preset-card-body {
      position: relative;
      z-index: 1;
      font-size: 13px;
      color: #e5e7eb;
    }
    .preset-card-actions {
      position: relative;
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }

    .btn {
      padding: 5px 10px;
      border-radius: 999px;
      border: none;
      font-size: 13px;
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
      border: 1px solid rgba(148, 163, 184, 0.35);
      font-weight: 500;
    }
    .btn-ghost {
      background: transparent;
      color: #9ca3af;
      border-radius: 999px;
      border: 1px solid transparent;
    }
    .btn-ghost:hover {
      border-color: rgba(148, 163, 184, 0.45);
      background: rgba(15, 23, 42, 0.8);
      color: #e5e7eb;
    }

    .preset-tag {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 2px 6px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(148, 163, 184, 0.5);
      color: #9ca3af;
    }

    .preset-list {
      margin-top: 8px;
      max-height: 260px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .preset-list-item {
      border-radius: 12px;
      padding: 6px 8px;
      border: 1px solid rgba(31, 41, 55, 0.9);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      background: radial-gradient(circle at top right, rgba(56,189,248,0.16), transparent 60%),
                  rgba(15,23,42,0.96);
      margin-bottom: 6px;
    }
    .preset-list-item-main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 13px;
    }
    .preset-list-item-main .title {
      font-weight: 500;
      color: #e5e7eb;
    }
    .preset-list-item-main .meta {
      font-size: 11px;
      color: #9ca3af;
    }

    .preset-list-item-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .preset-pill {
      border-radius: 999px;
      font-size: 12px;
      padding: 4px 9px;
      background: rgba(15,23,42,0.85);
      border: 1px solid rgba(148,163,184,0.45);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .preset-pill span.label {
      color: #e5e7eb;
      font-weight: 500;
    }
    .preset-pill span.desc {
      font-size: 11px;
      color: #9ca3af;
    }

    .preset-panel-footer .left {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      font-size: 11px;
      color: #9ca3af;
    }
    .preset-panel-footer .right {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    /* Department setup layouts */
    .dept-columns {
      display: grid;
      grid-template-columns: repeat(3, minmax(0,1fr));
      gap: 10px;
      margin-top: 8px;
    }
    @media (max-width: 900px) {
      .dept-columns {
        grid-template-columns: repeat(2, minmax(0,1fr));
      }
    }
    @media (max-width: 640px) {
      .dept-columns {
        grid-template-columns: minmax(0,1fr);
      }
    }

    .dept-column {
      border-radius: 12px;
      background: rgba(15,23,42,0.95);
      border: 1px solid rgba(55,65,81,0.9);
      padding: 8px 9px;
      position: relative;
      overflow: hidden;
    }
    .dept-column h3 {
      font-size: 13px;
      font-weight: 600;
      margin: 0 0 4px 0;
      color: #e5e7eb;
    }
    .dept-column h3 span.sub {
      font-size: 11px;
      font-weight: 400;
      color: #9ca3af;
      margin-left: 4px;
    }
    .dept-list {
      max-height: 210px;
      overflow-y: auto;
      padding-right: 4px;
      padding-top: 4px;
    }

    .dept-option {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 12px;
      padding: 3px 4px;
      border-radius: 8px;
      border: 1px solid transparent;
      color: #e5e7eb;
    }
    .dept-option:hover {
      border-color: rgba(148,163,184,0.5);
      background: rgba(15,23,42,0.95);
    }
    .dept-option input[type="checkbox"] {
      margin-top: 2px;
    }
    .dept-option span {
      flex: 1;
    }

    .dept-intro {
      font-size: 13px;
      color: #cbd5f5;
      margin-bottom: 8px;
      line-height: 1.5;
    }

    .dept-custom-section {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed rgba(75,85,99,0.9);
    }
    .dept-custom-section h4 {
      font-size: 12px;
      font-weight: 600;
      margin: 0 0 4px 0;
      color: #e5e7eb;
    }
    .dept-custom-row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0,1fr));
      gap: 6px;
      margin-bottom: 6px;
    }
    @media (max-width: 640px) {
      .dept-custom-row {
        grid-template-columns: repeat(2, minmax(0,1fr));
      }
    }
    .dept-custom-row label {
      display: flex;
      flex-direction: column;
      font-size: 11px;
      color: #9ca3af;
    }
    .dept-custom-row input,
    .dept-custom-row select {
      margin-top: 2px;
      border-radius: 8px;
      border: 1px solid rgba(55,65,81,0.9);
      background: rgba(15,23,42,0.95);
      color: #e5e7eb;
      padding: 4px 6px;
      font-size: 12px;
    }
    .dept-custom-row button {
      margin-top: 16px;
    }

    .dept-footer-note {
      font-size: 11px;
      color: #9ca3af;
    }

    /* Line defaults editor */
    .line-defaults-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0,1fr));
      gap: 10px;
      margin-top: 8px;
    }
    @media (max-width: 800px) {
      .line-defaults-grid {
        grid-template-columns: minmax(0,1fr);
      }
    }
    .line-default-card {
      border-radius: 12px;
      background: rgba(15,23,42,0.96);
      border: 1px solid rgba(55,65,81,0.95);
      padding: 8px 9px;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .line-default-card h3 {
      font-size: 13px;
      font-weight: 600;
      margin: 0 0 4px 0;
    }
    .line-default-card label {
      display: flex;
      flex-direction: column;
      font-size: 11px;
      color: #9ca3af;
    }
    .line-default-card input,
    .line-default-card select {
      margin-top: 2px;
      border-radius: 8px;
      border: 1px solid rgba(55,65,81,0.9);
      background: rgba(15,23,42,0.95);
      color: #e5e7eb;
      padding: 4px 6px;
      font-size: 12px;
    }
    .line-default-card button {
      align-self: flex-start;
      margin-top: 4px;
    }
  `;
  document.head.appendChild(style);
}

// === LocalStorage helpers =========================================================

function loadPresetsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.warn('Preset load failed', e);
    return [];
  }
}

function savePresetsToStorage() {
  try {
    const payload = Array.isArray(state.presets) ? state.presets : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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
  { id: 'sb_118_50_265',  label: '1 1/8" smooth bore 265 gpm @ 50 psi' },
  { id: 'sb_114_50_325',  label: '1 1/4" smooth bore 325 gpm @ 50 psi' },
];

const NOZZLES_FOG = [
  { id: 'fog_175_50_150', label: '1 3/4" fog 150 gpm @ 50 psi' },
  { id: 'fog_175_50_185', label: '1 3/4" fog 185 gpm @ 50 psi' },
  { id: 'fog_175_75_150', label: '1 3/4" fog 150 gpm @ 75 psi' },
  { id: 'fog_175_75_185', label: '1 3/4" fog 185 gpm @ 75 psi' },
  { id: 'fog_25_50_250',  label: '2 1/2" fog 250 gpm @ 50 psi' },
  { id: 'fog_25_75_250',  label: '2 1/2" fog 250 gpm @ 75 psi' },

  { id: 'fog_175_100_150', label: '1 3/4" fog 150 gpm @ 100 psi' },
  { id: 'fog_175_100_185', label: '1 3/4" fog 185 gpm @ 100 psi' },

  { id: 'fog_xd_175_50_185',   label: 'Chief XD 1¾" 185 gpm @ 50 psi' },
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
];

const NOZZLES_SPECIAL = [
  { id: 'cellar_nozzle',   label: 'Cellar nozzle' },
  { id: 'piercing_nozzle', label: 'Piercing nozzle' },
  { id: 'bent_tip_nozzle', label: 'Bresnan or bent-tip nozzle' },
];

// Map department nozzle ids to calc nozzle ids (store.NOZ)
const DEPT_NOZ_TO_CALC_NOZ = {
  // smooth
  'sb_78_50_160':   'sb7_8',
  'sb_1516_50_185': 'sb15_16',
  'sb_1_50_210':    'sb1',
  'sb_118_50_265':  'sb1_1_8',
  'sb_114_50_325':  'sb1_1_4',

  // fog 1.75
  'fog_175_50_150': 'fog150_50',
  'fog_175_50_185': 'chief185_50', // your original "chief185_50" mapping
  'fog_175_75_150': 'fog150_75',
  'fog_175_75_185': 'fog150_75',   // or your preferred mapping

  // fog 2.5
  'fog_25_50_250':  'fog250_50',
  'fog_25_75_250':  'fog250_75',

  'fog_175_100_150': 'fog150_100',
  'fog_175_100_185': 'fog150_100', // approximate

  // Chief XD style
  'fog_xd_175_50_185':  'chiefXD',
  'fog_xd_175_75_185':  'chiefXD200_75',
  'fog_xd_175_50_165':  'fog150_50',   // approximate
  'fog_xd_25_50_265':   'chiefXD265',

  // 2.5 @ 100 psi
  'fog_25_100_250': 'fog250_50',
  'fog_25_100_300': 'fog250_75',

  // Master stream mapping
  'ms_tip_138_500': 'ms1_3_8_80',
  'ms_tip_112_600': 'ms1_1_2_80',
  'ms_tip_134_800': 'ms1_3_4_80',
  'ms_tip_2_1000':  'ms1_3_4_80',   // approximate
  'ms_fog_500':     'ms1_3_8_80',
  'ms_fog_750':     'ms1_3_4_80',
};

// HOSES
const HOSES_ATTACK = [
  { id: 'h_1',      label: '1" attack hose' },
  { id: 'h_15',     label: '1 1/2" attack hose' },
  { id: 'h_175',    label: '1 3/4" attack hose' },
  { id: 'h_2',      label: '2" attack hose' },
  { id: 'h_25',     label: '2 1/2" attack hose' },
];

const HOSES_SUPPLY = [
  { id: 'h_3_supply', label: '3" supply hose' },
  { id: 'h_4_ldh',    label: '4" LDH' },
  { id: 'h_5_ldh',    label: '5" LDH' },
];

const HOSES_WILDLAND = [
  { id: 'h_w_1',    label: '1" wildland hose' },
  { id: 'h_w_15',   label: '1 1/2" wildland hose' },
  { id: 'h_booster_1', label: '1" booster line' },
];

const HOSES_LOWFRICTION = [
  { id: 'h_lf_175', label: '1 3/4" low-friction hose' },
  { id: 'h_lf_2',   label: '2" low-friction hose' },
  { id: 'h_lf_25',  label: '2 1/2" low-friction hose' },
  { id: 'h_lf_5',   label: '5" low-friction hose' },
];

// ACCESSORIES
const ACCESSORIES_APPLIANCES = [
  { id: 'wye_2_15',   label: 'Gated wye 2 x 1.5"' },
  { id: 'wye_25_2',   label: 'Gated wye 2.5" to 2 x 1.5"' },
  { id: 'siamesed',   label: 'Siamese appliance' },
];

const ACCESSORIES_FOAM = [
  { id: 'foam_eductor_95',  label: 'Foam eductor 95 gpm' },
  { id: 'foam_eductor_125', label: 'Foam eductor 125 gpm' },
];

const ACCESSORIES_MISC = [
  { id: 'inline_gauge', label: 'Inline gauge' },
  { id: 'reverse_lay',  label: 'Reverse lay pack' },
];


// === Department equipment helpers (normalized views) ===============================

// Normalize a single hose/nozzle/accessory item (string or object) so everything
// looks like { id, label, ...rest }. Not exported.
function normalizeDeptItem(item, fallbackPrefix, index) {
  if (item && typeof item === 'object') {
    const id = item.id != null
      ? String(item.id)
      : String(item.value ?? item.name ?? `${fallbackPrefix}_${index}`);
    const label = item.label || item.name || String(id);
    return { id, label, ...item };
  }
  const id = String(item);
  return { id, label: id, raw: item };
}

function buildNozzleSets() {
  const smooth = NOZZLES_SMOOTH.map((n, i) => normalizeDeptItem(n, 'smooth', i));
  const fog    = NOZZLES_FOG.map((n, i) => normalizeDeptItem(n, 'fog', i));
  const master = NOZZLES_MASTER.map((n, i) => normalizeDeptItem(n, 'master', i));
  const special= NOZZLES_SPECIAL.map((n, i) => normalizeDeptItem(n, 'special', i));
  return { smooth, fog, master, special };
}

function buildHoseSets() {
  const attack = HOSES_ATTACK.map((h, i) => normalizeDeptItem(h, 'attack', i));
  const supply = HOSES_SUPPLY.map((h, i) => normalizeDeptItem(h, 'supply', i));
  const wild   = HOSES_WILDLAND.map((h, i) => normalizeDeptItem(h, 'wild', i));
  const lf     = HOSES_LOWFRICTION.map((h, i) => normalizeDeptItem(h, 'lf', i));
  return { attack, supply, wild, lf };
}

function buildAccessorySets() {
  const appl = ACCESSORIES_APPLIANCES.map((a, i) => normalizeDeptItem(a, 'appl', i));
  const foam = ACCESSORIES_FOAM.map((a, i) => normalizeDeptItem(a, 'foam', i));
  const misc = ACCESSORIES_MISC.map((a, i) => normalizeDeptItem(a, 'misc', i));
  return { appl, foam, misc };
}

function getDeptEquipment() {
  const raw = loadDeptFromStorage();
  const { smooth, fog, master, special } = buildNozzleSets();
  const { attack, supply, wild, lf } = buildHoseSets();
  const { appl, foam, misc } = buildAccessorySets();

  // Normalize + merge
  const normNozzles = [];
  const normHoses = [];
  const normAccessories = [];

  if (Array.isArray(raw.nozzles)) {
    raw.nozzles.forEach((id, idx) => {
      const norm = normalizeDeptItem(id, 'nozzle', idx);
      normNozzles.push(norm);
    });
  }

  if (Array.isArray(raw.customNozzles)) {
    raw.customNozzles.forEach((n, idx) => {
      const norm = normalizeDeptItem(n, 'cnoz', idx);
      normNozzles.push(norm);
    });
  }

  if (Array.isArray(raw.hoses)) {
    raw.hoses.forEach((id, idx) => {
      const norm = normalizeDeptItem(id, 'hose', idx);
      normHoses.push(norm);
    });
  }

  if (Array.isArray(raw.customHoses)) {
    raw.customHoses.forEach((h, idx) => {
      const norm = normalizeDeptItem(h, 'chose', idx);
      normHoses.push(norm);
    });
  }

  if (Array.isArray(raw.accessories)) {
    raw.accessories.forEach((id, idx) => {
      const norm = normalizeDeptItem(id, 'acc', idx);
      normAccessories.push(norm);
    });
  }

  if (Array.isArray(raw.customAccessories)) {
    raw.customAccessories.forEach((a, idx) => {
      const norm = normalizeDeptItem(a, 'cacc', idx);
      normAccessories.push(norm);
    });
  }

  return {
    nozzles: normNozzles,
    hoses: normHoses,
    accessories: normAccessories,
  };
}

/**
 * Convenience: nozzle list for dropdowns.
 * Returns [{ id, label, gpm?, ... }, ...]
 */
export function getDeptNozzleOptions() {
  const dept = getDeptEquipment();
  return Array.isArray(dept.nozzles) ? dept.nozzles : [];
}

/**
 * Convenience: hose list for dropdowns.
 * Returns [{ id, label, ... }, ..]
 */
export function getDeptHoseOptions() {
  const dept = getDeptEquipment();
  return Array.isArray(dept.hoses) ? dept.hoses : [];
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

export function getDeptLineDefaults() {
  try {
    if (!state.lineDefaults || !Object.keys(state.lineDefaults).length) {
      state.lineDefaults = loadLineDefaultsFromStorage();
    }
    return state.lineDefaults || {};
  } catch (e) {
    console.warn('getDeptLineDefaults failed', e);
    return {};
  }
}



// Ensure department custom nozzles are registered in the main nozzle library.
// This lets them appear in calc dropdowns and be used in hydraulic math.
function ensureCustomNozzlesInStore(dept) {
  try {
    if (!dept || !Array.isArray(dept.customNozzles)) return;
    const customs = dept.customNozzles;
    customs.forEach((cn) => {
      if (!cn || !cn.id) return;
      const id = String(cn.id).trim();
      if (!id) return;

      // Avoid clobbering existing definitions
      if (!NOZ[id]) {
        const gpm = Number(cn.gpm || 0) || 0;
        const NP  = Number(cn.psi || cn.NP || 0) || 0;
        const name = cn.label || cn.name || id;
        const obj = { id, name, gpm, NP };
        NOZ[id] = obj;

        if (Array.isArray(NOZ_LIST) && !NOZ_LIST.some(n => n && String(n.id) === id)) {
          NOZ_LIST.push(obj);
        }
      }
    });
  } catch (e) {
    console.warn('ensureCustomNozzlesInStore failed', e);
  }
}

export function getDeptNozzleIds() {
  try {
    const dept = loadDeptFromStorage();
    if (!dept || typeof dept !== 'object') return [];

    // Make sure any department custom nozzles are present in the main NOZ/NOZ_LIST
    ensureCustomNozzlesInStore(dept);

    const result = [];
    const seen = new Set();

    const customIds = new Set(
      Array.isArray(dept.customNozzles)
        ? dept.customNozzles
            .map(cn => cn && cn.id != null ? String(cn.id).trim() : '')
            .filter(Boolean)
        : []
    );

    if (Array.isArray(dept.nozzles)) {
      dept.nozzles.forEach(raw => {
        if (typeof raw !== 'string') return;
        const trimmed = raw.trim();
        if (!trimmed) return;

        const mapped = DEPT_NOZ_TO_CALC_NOZ[trimmed];
        let finalId = null;

        if (typeof mapped === 'string' && NOZ[mapped]) {
          finalId = mapped;
        } else if (customIds.has(trimmed) && NOZ[trimmed]) {
          // Custom nozzle selected by its own id
          finalId = trimmed;
        }

        if (finalId && !seen.has(finalId)) {
          seen.add(finalId);
          result.push(finalId);
        }
      });
    }

    return result;
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

  state.presets = loadPresetsFromStorage();
  const dept = loadDeptFromStorage();
  state.deptNozzles = dept.nozzles || [];
  state.customNozzles = dept.customNozzles || [];
  state.deptHoses = dept.hoses || [];
  state.customHoses = dept.customHoses || [];
  state.deptAccessories = dept.accessories || [];
  state.customAccessories = dept.customAccessories || [];
  state.lineDefaults = loadLineDefaultsFromStorage();

  injectAppPresetStyles();
  ensurePresetTrigger();
}

// === Department setup: home menu ==================================================

function ensureDeptPopupWrapper() {
  let wrap = document.getElementById('deptPopupWrapper');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'deptPopupWrapper';
    wrap.className = 'preset-panel-wrapper hidden';
    wrap.innerHTML = `
      <div class="preset-panel">
        <div class="preset-panel-header">
          <div class="title">
            <span>FireOps Calc</span>
            <span class="badge">Department</span>
          </div>
          <button type="button" class="close-btn" id="deptCloseBtn">
            <span class="x">✕</span>
            <span>Close</span>
          </button>
        </div>
        <div class="preset-panel-body">
          <h2 id="deptPopupTitle" class="preset-section-title">Department setup</h2>
          <div id="deptPopupBody"></div>
        </div>
        <div class="preset-panel-footer">
          <div class="left">
            <span class="dept-footer-note">
              Changes are saved locally on this device. Use the main Presets menu to build line presets.
            </span>
          </div>
          <div class="right">
            <button type="button" class="btn-ghost" id="deptBackToPresetsBtn">Back to presets</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const closeBtn = wrap.querySelector('#deptCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        wrap.classList.add('hidden');
      });
    }
    const backBtn = wrap.querySelector('#deptBackToPresetsBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        wrap.classList.add('hidden');
        openPresetMainMenu();
      });
    }
  }
  return wrap;
}

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
      hoses, and common accessories, then save line presets that reflect your actual rigs.
    </p>
    <div class="preset-grid">
      <div class="preset-card">
        <div class="preset-card-header">
          <h3>
            Nozzles
            <span class="subtitle">Smooth, fog, master, specialty + custom</span>
          </h3>
          <span class="preset-tag">Step 1</span>
        </div>
        <div class="preset-card-body">
          Pick which nozzles you actually carry, then add any custom ones with their GPM and nozzle pressure.
        </div>
        <div class="preset-card-actions">
          <button type="button" class="btn-primary" id="deptNozzlesBtn">Configure nozzles</button>
        </div>
      </div>
      <div class="preset-card">
        <div class="preset-card-header">
          <h3>
            Hoses
            <span class="subtitle">Attack, supply, wildland, low-friction + custom C</span>
          </h3>
          <span class="preset-tag">Step 2</span>
        </div>
        <div class="preset-card-body">
          Select your hose sizes and add low-friction/custom hose with C values for charts and future features.
        </div>
        <div class="preset-card-actions">
          <button type="button" class="btn-primary" id="deptHosesBtn">Configure hoses</button>
        </div>
      </div>
      <div class="preset-card">
        <div class="preset-card-header">
          <h3>
            Accessories
            <span class="subtitle">Wyes, foam eductors, gauges, misc</span>
          </h3>
          <span class="preset-tag">Optional</span>
        </div>
        <div class="preset-card-body">
          Track common appliances and accessories for use in future presets and checklists.
        </div>
        <div class="preset-card-actions">
          <button type="button" class="btn-secondary" id="deptAccessoriesBtn">Configure accessories</button>
        </div>
      </div>
    </div>
  `;

  footerEl.innerHTML = `
    <div class="left">
      <span>Pro tip: set up nozzles and hoses first, then use line presets for quick attack lines.</span>
    </div>
    <div class="right">
      <button type="button" class="btn-secondary" id="deptLineDefaultsBtn">Department line defaults</button>
    </div>
  `;

  const nozBtn = bodyEl.querySelector('#deptNozzlesBtn');
  if (nozBtn) nozBtn.addEventListener('click', () => renderNozzleSelectionScreen());

  const hoseBtn = bodyEl.querySelector('#deptHosesBtn');
  if (hoseBtn) hoseBtn.addEventListener('click', () => renderHoseSelectionScreen());

  const accBtn = bodyEl.querySelector('#deptAccessoriesBtn');
  if (accBtn) accBtn.addEventListener('click', () => renderAccessoriesSelectionScreen());

  const lineDefaultsBtn = footerEl.querySelector('#deptLineDefaultsBtn');
  if (lineDefaultsBtn) lineDefaultsBtn.addEventListener('click', () => renderDeptLineDefaultsScreen());

  wrap.classList.remove('hidden');
}

// === Department line defaults screen ==============================================

function renderDeptLineDefaultsScreen() {
  ensureDeptPopupWrapper();
  const wrap = document.getElementById('deptPopupWrapper');
  if (!wrap) return;

  const titleEl = wrap.querySelector('#deptPopupTitle');
  const bodyEl  = wrap.querySelector('#deptPopupBody');
  const footerEl= wrap.querySelector('#deptPopupFooter');
  if (!titleEl || !bodyEl || !footerEl) return;

  titleEl.textContent = 'Department line defaults';

  const nozzles = getDeptNozzleOptions();
  const hoses = getDeptHoseOptions();
  const lineDefaults = getDeptLineDefaults();

  function buildLineCard(lineNumber) {
    const key = String(lineNumber);
    const cfg = lineDefaults[key] || {};
    const currentNozId = cfg.nozzleId || '';
    const currentHoseId = cfg.hoseId || '';
    const currentLen = cfg.lengthFt ?? '';
    const currentElev = cfg.elevationFt ?? '';

    const nozOptions = nozzles.map(n => {
      const id = String(n.id || '');
      const label = String(n.label || n.name || id);
      const selected = id === currentNozId ? 'selected' : '';
      return `<option value="${id}" ${selected}>${label}</option>`;
    }).join('');

    const hoseOptions = hoses.map(h => {
      const id = String(h.id || '');
      const label = String(h.label || h.name || id);
      const selected = id === currentHoseId ? 'selected' : '';
      return `<option value="${id}" ${selected}>${label}</option>`;
    }).join('');

    return `
      <div class="line-default-card">
        <h3>Line ${lineNumber}</h3>
        <label>
          Nozzle
          <select data-line="${key}" data-field="nozzleId">
            <option value="">(No default nozzle)</option>
            ${nozOptions}
          </select>
        </label>
        <label>
          Hose
          <select data-line="${key}" data-field="hoseId">
            <option value="">(No default hose)</option>
            ${hoseOptions}
          </select>
        </label>
        <label>
          Length (ft)
          <input type="number" inputmode="numeric" data-line="${key}" data-field="lengthFt" value="${currentLen}">
        </label>
        <label>
          Elevation (+/- ft)
          <input type="number" inputmode="numeric" data-line="${key}" data-field="elevationFt" value="${currentElev}">
        </label>
        <button type="button" class="btn-secondary" data-line="${key}" data-action="saveLineDefault">
          Save Line ${lineNumber} defaults
        </button>
      </div>
    `;
  }

  bodyEl.innerHTML = `
    <p class="dept-intro">
      Set default hose, nozzle, length, and elevation for Line 1, Line 2, and Line 3. These defaults
      will be used for new calculations, but you can still change them on the main screen.
    </p>
    <div class="line-defaults-grid">
      ${buildLineCard(1)}
      ${buildLineCard(2)}
      ${buildLineCard(3)}
    </div>
  `;

  footerEl.innerHTML = `
    <button type="button" class="btn-secondary" id="lineDefaultsBackBtn">Back</button>
    <button type="button" class="btn-ghost" id="lineDefaultsResetBtn">Reset to blank</button>
  `;

  const backBtn = footerEl.querySelector('#lineDefaultsBackBtn');
  if (backBtn) backBtn.addEventListener('click', () => renderDeptHomeScreen());

  const resetBtn = footerEl.querySelector('#lineDefaultsResetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!confirm('Reset all department line defaults to blank?')) return;
      state.lineDefaults = {};
      saveLineDefaultsToStorage();
      renderDeptLineDefaultsScreen();
    });
  }

  bodyEl.querySelectorAll('[data-action="saveLineDefault"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const line = btn.getAttribute('data-line');
      if (!line) return;
      const cfg = state.lineDefaults[line] || {};
      bodyEl.querySelectorAll(`[data-line="${line}"][data-field]`).forEach(el => {
        const field = el.getAttribute('data-field');
        if (!field) return;
        const val = el.value;
        if (field === 'lengthFt' || field === 'elevationFt') {
          const num = Number(val);
          if (!Number.isNaN(num)) cfg[field] = num;
        } else {
          cfg[field] = val || '';
        }
      });
      state.lineDefaults[line] = cfg;
      saveLineDefaultsToStorage();
      alert(`Line ${line} defaults saved.`);
    });
  });

  wrap.classList.remove('hidden');
}

// === Department nozzles screen ====================================================

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

    <div class="dept-custom-section">
      <h4>Custom nozzle</h4>
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

  const dept = loadDeptFromStorage();
  state.deptNozzles = dept.nozzles || [];
  state.customNozzles = dept.customNozzles || [];

  const smoothList  = bodyEl.querySelector('#deptSmoothList');
  const fogList     = bodyEl.querySelector('#deptFogList');
  const masterList  = bodyEl.querySelector('#deptMasterList');
  const specialList = bodyEl.querySelector('#deptSpecialList');

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

// === Department hoses screen ======================================================

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
        <h3>Supply / LDH</h3>
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
        <h3>Low-friction</h3>
        <div class="dept-list" id="deptHoseLFList">
          ${lowHtml}
        </div>
      </div>
    </div>

    <div class="dept-custom-section">
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
            <option value="supply">Supply / LDH</option>
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

  const dept = loadDeptFromStorage();
  state.deptHoses = dept.hoses || [];
  state.customHoses = dept.customHoses || [];

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
      const diameter = Number(diaEl.value || 0);
      const C = Number(cEl.value || 0);
      let cat = String(catEl.value || 'attack');
      if (!['attack','supply','wildland','lowfriction'].includes(cat)) cat = 'attack';

      const id = 'custom_hose_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      const parts = [name];
      if (diameter > 0) parts.push(diameter + '"');
      if (!Number.isNaN(C) && C > 0) parts.push('C=' + C);
      const fullLabel = parts.join(' ');

      const custom = { id, label: fullLabel, category: cat, diameter, C };
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
      diaEl.value = '';
      cEl.value = '';
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

// === Department accessories screen ================================================

function renderAccessoriesSelectionScreen() {
  ensureDeptPopupWrapper();
  const wrap = document.getElementById('deptPopupWrapper');
  if (!wrap) return;

  const titleEl = wrap.querySelector('#deptPopupTitle');
  const bodyEl  = wrap.querySelector('#deptPopupBody');
  const footerEl= wrap.querySelector('#deptPopupFooter');
  if (!titleEl || !bodyEl || !footerEl) return;

  titleEl.textContent = 'Department accessories';

  const applHtml = ACCESSORIES_APPLIANCES.map(a => `
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

  const miscHtml = ACCESSORIES_MISC.map(a => `
    <label class="dept-option">
      <input type="checkbox" data-acc-id="${a.id}">
      <span>${a.label}</span>
    </label>
  `).join('');

  bodyEl.innerHTML = `
    <p class="dept-intro">
      Track common appliances and accessories that your department carries. These can be linked
      to presets and future features.
    </p>

    <div class="dept-columns">
      <div class="dept-column">
        <h3>Appliances</h3>
        <div class="dept-list" id="deptAccApplList">
          ${applHtml}
        </div>
      </div>
      <div class="dept-column">
        <h3>Foam / Eductors</h3>
        <div class="dept-list" id="deptAccFoamList">
          ${foamHtml}
        </div>
      </div>
      <div class="dept-column">
        <h3>Misc / Tools</h3>
        <div class="dept-list" id="deptAccMiscList">
          ${miscHtml}
        </div>
      </div>
    </div>

    <div class="dept-custom-section">
      <h4>Custom accessory</h4>
      <div class="dept-custom-row">
        <label>Name / label
          <input type="text" id="customAccName" placeholder="Example: Standpipe kit">
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

  const dept = loadDeptFromStorage();
  state.deptAccessories = dept.accessories || [];
  state.customAccessories = dept.customAccessories || [];

  const applList = bodyEl.querySelector('#deptAccApplList');
  const foamList = bodyEl.querySelector('#deptAccFoamList');
  const miscList = bodyEl.querySelector('#deptAccMiscList');

  const savedCustom = Array.isArray(state.customAccessories) ? state.customAccessories : [];
  for (const ca of savedCustom) {
    const row = document.createElement('label');
    row.className = 'dept-option';
    row.innerHTML = `
      <input type="checkbox" data-acc-id="${ca.id}">
      <span>${ca.label}</span>
    `;
    miscList.appendChild(row);
  }

  const aSelected = new Set(state.deptAccessories || []);
  bodyEl.querySelectorAll('input[data-acc-id]').forEach((cb) => {
    const id = cb.getAttribute('data-acc-id');
    if (id && aSelected.has(id)) cb.checked = true;
  });

  const addBtn = bodyEl.querySelector('#customAccAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const nameEl = bodyEl.querySelector('#customAccName');
      if (!nameEl) return;
      const name = String(nameEl.value || '').trim();
      if (!name) {
        alert('Please enter a name/label for the custom accessory.');
        return;
      }
      const id = 'custom_acc_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      const label = name;

      const custom = { id, label };
      if (!Array.isArray(state.customAccessories)) state.customAccessories = [];
      state.customAccessories.push(custom);

      const row = document.createElement('label');
      row.className = 'dept-option';
      row.innerHTML = `
        <input type="checkbox" data-acc-id="${id}" checked>
        <span>${label}</span>
      `;
      miscList.appendChild(row);

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

// === Main Presets menu (line presets + Department setup entry) ====================

function ensurePresetTrigger() {
  const btnId = state.triggerButtonId || 'presetsBtn';
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (btn._presetBound) return;
  btn._presetBound = true;

  btn.addEventListener('click', () => {
    openPresetMainMenu();
  });

  if (typeof window !== 'undefined') {
    window.openDeptWizard = () => {
      try {
        renderDeptHomeScreen();
      } catch (e) {
        console.warn('openDeptWizard() is not defined; cannot open Department setup wizard.');
      }
    };
  }
}

function openPresetMainMenu() {
  injectAppPresetStyles();
  let wrap = document.getElementById('presetPanelWrapper');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'presetPanelWrapper';
    wrap.className = 'preset-panel-wrapper';
    wrap.innerHTML = `
      <div class="preset-panel">
        <div class="preset-panel-header">
          <div class="title">
            <span>FireOps Calc</span>
            <span class="badge">Presets</span>
          </div>
          <button type="button" class="close-btn" id="presetCloseBtn">
            <span class="x">✕</span>
            <span>Close</span>
          </button>
        </div>
        <div class="preset-panel-body">
          <h2 class="preset-section-title">Presets &amp; Department setup</h2>
          <p class="preset-intro">
            Build attack line presets that match your rigs, then quickly apply them to Line 1, 2, or 3.
            Department setup keeps nozzles and hoses consistent with your equipment.
          </p>
          <div class="preset-grid" id="presetGrid"></div>
          <div class="preset-section-title" style="margin-top:12px;">Saved presets</div>
          <div class="preset-list" id="presetList"></div>
        </div>
        <div class="preset-panel-footer">
          <div class="left">
            <span>Presets and department settings are saved locally and do not require an account.</span>
          </div>
          <div class="right">
            <button type="button" class="btn-ghost" id="presetStoreBtn">Get the app</button>
            <button type="button" class="btn-primary" id="presetAddBtn">Add preset</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const closeBtn = wrap.querySelector('#presetCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        wrap.classList.add('hidden');
      });
    }

    const storeBtn = wrap.querySelector('#presetStoreBtn');
    if (storeBtn) {
      storeBtn.addEventListener('click', () => {
        if (state.isApp) return;
        if (state.playStoreUrl) {
          window.open(state.playStoreUrl, '_blank');
        } else if (state.appStoreUrl) {
          window.open(state.appStoreUrl, '_blank');
        } else {
          alert('App store links are not configured yet.');
        }
      });
    }

    const addBtn = wrap.querySelector('#presetAddBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        openPresetEditorPopup({ onSave: handlePresetSave });
      });
    }
  }

  const grid = wrap.querySelector('#presetGrid');
  const listEl = wrap.querySelector('#presetList');
  if (!grid || !listEl) return;

  state.presets = loadPresetsFromStorage();

  grid.innerHTML = `
    <div class="preset-card">
      <div class="preset-card-header">
        <h3>
          Department setup
          <span class="subtitle">Nozzles, hoses, accessories, line defaults</span>
        </h3>
        <span class="preset-tag">Config</span>
      </div>
      <div class="preset-card-body">
        Keep your hose sizes, nozzles, and accessories in sync with your department. These settings
        are used for line defaults and future presets.
      </div>
      <div class="preset-card-actions">
        <button type="button" class="btn-primary" id="openDeptSetupBtn">Open Department setup</button>
      </div>
    </div>
    <div class="preset-card">
      <div class="preset-card-header">
        <h3>
          Line 1 preset
          <span class="subtitle">Attack line / preconnect</span>
        </h3>
        <span class="preset-tag">Line 1</span>
      </div>
      <div class="preset-card-body">
        Quickly save and apply your most common Line 1 configuration (e.g., 1 3/4" 200' preconnect).
      </div>
      <div class="preset-card-actions">
        <button type="button" class="btn-secondary" data-line="1" id="editLine1PresetBtn">Edit Line 1 preset</button>
      </div>
    </div>
    <div class="preset-card">
      <div class="preset-card-header">
        <h3>
          Line 2 preset
          <span class="subtitle">Backup line / 2½"</span>
        </h3>
        <span class="preset-tag">Line 2</span>
      </div>
      <div class="preset-card-body">
        Save your common Line 2 configuration, such as a 2½" backup line or leader line.
      </div>
      <div class="preset-card-actions">
        <button type="button" class="btn-secondary" data-line="2" id="editLine2PresetBtn">Edit Line 2 preset</button>
      </div>
    </div>
    <div class="preset-card">
      <div class="preset-card-header">
        <h3>
          Line 3 preset
          <span class="subtitle">Specialty / wildland / other</span>
        </h3>
        <span class="preset-tag">Line 3</span>
      </div>
      <div class="preset-card-body">
        Use Line 3 for specialty or wildland setups, or another 1 3/4" preconnect.
      </div>
      <div class="preset-card-actions">
        <button type="button" class="btn-secondary" data-line="3" id="editLine3PresetBtn">Edit Line 3 preset</button>
      </div>
    </div>
  `;

  const deptBtn = grid.querySelector('#openDeptSetupBtn');
  if (deptBtn) {
    deptBtn.addEventListener('click', () => {
      renderDeptHomeScreen();
    });
  }

  grid.querySelectorAll('[id^="editLine"][id$="PresetBtn"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const lineStr = btn.getAttribute('data-line') || '';
      const lineNumber = Number(lineStr);
      if (!lineNumber || lineNumber < 1 || lineNumber > 3) return;
      openPresetEditorPopup({
        lineNumber,
        onSave: handlePresetSave,
      });
    });
  });

  renderPresetList(listEl);
  wrap.classList.remove('hidden');
}

// === Preset list rendering & editing =============================================

function renderPresetList(listEl) {
  const all = loadPresetsFromStorage();
  state.presets = all;

  if (!all.length) {
    listEl.innerHTML = `
      <div class="preset-pill">
        <span class="label">No presets yet</span>
        <span class="desc">Use "Add preset" or the line preset buttons to create one.</span>
      </div>
    `;
    return;
  }

  listEl.innerHTML = all.map((p, index) => {
    const title = p.name || `Preset ${index + 1}`;
    const lineLabel = p.lineNumber ? `Line ${p.lineNumber}` : 'Any line';
    const details = [];
    if (p.hoseDiameter) details.push(`${p.hoseDiameter}" hose`);
    if (p.lengthFt) details.push(`${p.lengthFt}′`);
    if (p.nozzleId) details.push(`Nozzle ${p.nozzleId}`);
    const meta = details.join(' • ');
    return `
      <div class="preset-list-item" data-index="${index}">
        <div class="preset-list-item-main">
          <div class="title">${title}</div>
          <div class="meta">${lineLabel}${meta ? ' • '+meta : ''}</div>
        </div>
        <div class="preset-list-item-actions">
          <button type="button" class="btn-secondary" data-action="apply" data-index="${index}">Apply</button>
          <button type="button" class="btn-ghost" data-action="edit" data-index="${index}">Edit</button>
          <button type="button" class="btn-ghost" data-action="delete" data-index="${index}">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      const indexStr = btn.getAttribute('data-index');
      const index = Number(indexStr);
      if (!Number.isInteger(index) || index < 0 || index >= state.presets.length) return;

      if (action === 'apply') {
        applyPresetToCalc(index);
      } else if (action === 'edit') {
        openPresetEditorPopup({
          preset: state.presets[index],
          index,
          onSave: handlePresetSave,
        });
      } else if (action === 'delete') {
        if (!confirm('Delete this preset?')) return;
        state.presets.splice(index, 1);
        savePresetsToStorage();
        renderPresetList(listEl);
      }
    });
  });
}

function handlePresetSave(preset, index) {
  if (!preset) return;
  const all = Array.isArray(state.presets) ? state.presets.slice() : [];
  if (typeof index === 'number' && index >= 0 && index < all.length) {
    all[index] = preset;
  } else {
    all.push(preset);
  }
  state.presets = all;
  savePresetsToStorage();

  const listEl = document.getElementById('presetList');
  if (listEl) renderPresetList(listEl);
}


// === Applying a preset to the calc view ==========================================

function applyPresetToCalc(index) {
  try {
    const presets = loadPresetsFromStorage();
    if (!Array.isArray(presets) || !presets[index]) {
      alert('Preset not found.');
      return;
    }
    const preset = presets[index];

    if (!window || !window.state || !window.state.lines) {
      alert('Pump view is not ready yet. Open the main calc screen first.');
      return;
    }

    const targetLine = preset.lineNumber || 1;
    const key = String(targetLine);
    const L = window.state.lines[key];
    if (!L) {
      alert('Target line not found in the current calc view.');
      return;
    }

    // If preset has a direct PDP, just set that
    if (typeof preset.directPdp === 'number' && preset.directPdp > 0) {
      L.directPdp = preset.directPdp;
      alert(`Applied preset "${preset.name || ('Preset '+(index+1))}" to Line ${targetLine}.`);
      if (typeof window.render === 'function') window.render(document.getElementById('app'));
      return;
    }

    const hoseDiameter = preset.hoseDiameter || '1.75';
    const lengthFt = typeof preset.lengthFt === 'number' ? preset.lengthFt : 200;

    L.size = hoseDiameter;
    L.itemsMain = [{ size: hoseDiameter, lengthFt }];

    L.hasWye = !!preset.hasWye;

    L.itemsLeft = [];
    L.itemsRight = [];

    if (L.hasWye) {
      const lenLeft = typeof preset.lenA === 'number' ? preset.lenA : Math.floor(lengthFt/2);
      const lenRight = typeof preset.lenB === 'number' ? preset.lenB : Math.floor(lengthFt/2);
      L.itemsLeft = [{ size: hoseDiameter, lengthFt: lenLeft }];
      L.itemsRight = [{ size: hoseDiameter, lengthFt: lenRight }];
    }

    L.elevFt = typeof preset.elevationFt === 'number' ? preset.elevationFt : 0;

    L.nozLeft = null;
    L.nozRight = null;

    if (preset.nozzleId && NOZ[preset.nozzleId]) {
      L.nozRight = NOZ[preset.nozzleId];
    }

    alert(`Applied preset "${preset.name || ('Preset '+(index+1))}" to Line ${targetLine}.`);
    if (typeof window.render === 'function') {
      window.render(document.getElementById('app'));
    }
  } catch (e) {
    console.warn('applyPresetToCalc failed', e);
    alert('Failed to apply preset. See console for details.');
  }
}

export { handlePresetSave };
