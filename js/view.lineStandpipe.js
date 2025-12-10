import { DEPT_UI_NOZZLES, DEPT_UI_HOSES } from './store.js';

// view.lineStandpipe.js
// Standpipe-only popup editor for a single line (Line 1 / 2 / 3).
// - Uses same department hose/nozzle logic as view.lineStandard.js
//   (DEPT_UI_HOSES / DEPT_UI_NOZZLES, with "Closed" nozzle option).
// - Engine → standpipe hose: type + length + number of hoses
// - Floors up (or vertical feet)
// - Standpipe → nozzle hose: type + length
// - Nozzle type
// - Live GPM & PDP preview
// - "Explain math" button shows breakdown window

/* -------------------------------------------------------------------------- */
/*  Shared hose / nozzle helpers (mirrored from view.lineStandard.js)         */
/* -------------------------------------------------------------------------- */

function parseGpmFromLabel(label) {
  const m = String(label || '').match(/(\d+)\s*gpm/i);
  return m ? Number(m[1]) : 0;
}

function parseNpFromLabel(label) {
  const m = String(label || '').match(/@\s*(\d+)\s*psi/i);
  return m ? Number(m[1]) : 0;
}

// Turn internal hose ids into nice labels that match on desktop/phone.
function formatHoseLabel(idOrLabel) {
  const raw = String(idOrLabel || '').trim();

  // Already looks like 2.5" / 4" / 5"
  const quoteMatch = raw.match(/(\d(?:\.\d+)?)\s*"/);
  if (quoteMatch) {
    const v = quoteMatch[1];
    if (v === '1.75') return '1 3/4"';
    if (v === '1.5')  return '1 1/2"';
    if (v === '2.5')  return '2 1/2"';
    if (v === '3')    return '3"';
    if (v === '4')    return '4"';
    if (v === '5')    return '5"';
  }

  // Internal IDs like h_175
  if (/^h_?175$/i.test(raw)) return '1 3/4"';
  if (/^h_?15$/i.test(raw))  return '1 1/2"';
  if (/^h_?25$/i.test(raw))  return '2 1/2"';
  if (/^h_?3$/i.test(raw))   return '3"';
  if (/^h_?4$/i.test(raw))   return '4"';
  if (/^h_?5$/i.test(raw))   return '5"';

  // Custom hose ids: "custom_hose_<...>"
  if (/^custom_hose_/i.test(raw)) {
    if (/175/.test(raw)) return 'Custom 1 3/4"';
    if (/15/.test(raw))  return 'Custom 1 1/2"';
    if (/25/.test(raw))  return 'Custom 2 1/2"';
    if (/\b3\b/.test(raw))   return 'Custom 3"';
    if (/\b4\b/.test(raw))   return 'Custom 4"';
    if (/\b5\b/.test(raw))   return 'Custom 5"';
    return 'Custom hose';
  }

  // Text like "2.5 supply", "4 inch LDH"
  const numMatch = raw.match(/(\d(?:\.\d+)?)/);
  if (numMatch) {
    const v = numMatch[1];
    if (v === '1.75') return '1 3/4"';
    if (v === '1.5')  return '1 1/2"';
    if (v === '2.5')  return '2 1/2"';
    if (v === '3')    return '3"';
    if (v === '4')    return '4"';
    if (v === '5')    return '5"';
  }

  return raw;
}

const DEFAULT_NOZZLES = [
  { id: 'fog150_50',   label: 'Fog 150 gpm @ 50 psi', gpm: 150, np: 50 },
  { id: 'fog185_50',   label: 'Fog 185 gpm @ 50 psi', gpm: 185, np: 50 },
  { id: 'sb_15_16_50', label: '7/8" smooth bore 160 gpm @ 50 psi', gpm: 160, np: 50 },
  { id: 'sb_1_1_8_50', label: '1 1/8" smooth bore 265 gpm @ 50 psi', gpm: 265, np: 50 },
];

const DEFAULT_HOSES = [
  { id: '1.75', label: '1 3/4"' },
  { id: '2.5',  label: '2 1/2"' },
  { id: '3',    label: '3"'     },
  { id: '5',    label: '5"'     },
];

const SMOOTH_TIP_GPM_MAP = {
  '7/8': 160,
  '15/16': 185,
  '1': 210,
  '1 1/8': 265,
  '1 1/4': 325,
};

function extractSmoothTipFromLabel(label) {
  const txt = String(label || '');

  // 15/16", 7/8", 1 1/8", 1 1/4"
  const frac = txt.match(/(\d+\s*\d*\/\d+)\s*"/);
  if (frac) {
    return frac[1].replace(/\s+/g, ' ');
  }

  // 7/8, 15/16 without quotes
  const frac2 = txt.match(/(\d+\/\d+)/);
  if (frac2) return frac2[1];

  return '';
}

function prettifyNozzle(id, label, gpm, np) {
  const idStr = String(id || '');
  let lbl = label ? String(label) : idStr;
  const lowerLbl = lbl.toLowerCase();
  const lowerId = idStr.toLowerCase();

  const hasGpmPsiWords = /gpm/i.test(lbl) && /psi/i.test(lbl);

  // --- Smooth bores --------------------------------------------------------
  if (lowerId.startsWith('sb') || lowerLbl.includes('smooth')) {
    if (!/smooth/i.test(lbl)) {
      lbl = 'Smooth ' + lbl;
    }

    let gFromLabel = parseGpmFromLabel(lbl);
    let pFromLabel = parseNpFromLabel(lbl);

    let tip = extractSmoothTipFromLabel(lbl);

    if (!gFromLabel && tip && SMOOTH_TIP_GPM_MAP[tip]) {
      gFromLabel = SMOOTH_TIP_GPM_MAP[tip];
    }
    if (!pFromLabel) pFromLabel = 50; // default if needed

    if (!gpm && gFromLabel) gpm = gFromLabel;
    if (!np && pFromLabel)  np  = pFromLabel;

    if (tip && gpm && np) {
      lbl = `Smooth ${tip}" ${gpm} gpm @ ${np} psi`;
    }

    return { label: lbl, gpm, np };
  }

  // --- Fog and everything else --------------------------------------------
  if (hasGpmPsiWords) {
    const gFrom = parseGpmFromLabel(lbl);
    const pFrom = parseNpFromLabel(lbl);
    if (!gpm && gFrom) gpm = gFrom;
    if (!np && pFrom)  np  = pFrom;
    return { label: lbl, gpm, np };
  }

  // FOG patterns based on id if available
  if (lowerId.includes('fog')) {
    const nums = idStr.match(/\d+/g) || [];
    if (nums.length >= 2) {
      const p = Number(nums[nums.length - 2]);
      const g = Number(nums[nums.length - 1]);
      if (!gpm && g) gpm = g;
      if (!np && p)  np  = p;
    }
    const gFrom = parseGpmFromLabel(lbl);
    const pFrom = parseNpFromLabel(lbl);
    if (!gpm && gFrom) gpm = gFrom;
    if (!np && pFrom)  np  = pFrom || 50;

    if (gpm && np) {
      lbl = `Fog ${gpm} gpm @ ${np} psi`;
    } else if (gpm) {
      lbl = `Fog ${gpm} gpm`;
    } else {
      lbl = 'Fog nozzle';
    }

    return { label: lbl, gpm, np };
  }

  // Generic: if we have numbers but no words, just format "XXX gpm @ YY psi"
  if (!hasGpmPsiWords) {
    const gFrom = parseGpmFromLabel(lbl);
    const pFrom = parseNpFromLabel(lbl);
    if (!gpm && gFrom) gpm = gFrom;
    if (!np && pFrom)  np  = pFrom;

    if (gpm && np) {
      lbl = `${lbl} ${gpm} gpm @ ${np} psi`;
    } else if (gpm) {
      lbl = `${lbl} ${gpm} gpm`;
    }
  }

  return { label: lbl, gpm, np };
}

// Department → hose list (same behavior as Standard line)
function getHoseListFromDept(dept) {
  if (Array.isArray(DEPT_UI_HOSES) && DEPT_UI_HOSES.length) {
    return DEPT_UI_HOSES.map((h, idx) => {
      if (!h) return null;
      const id = h.id != null ? String(h.id) : String(h.value ?? h.name ?? idx);
      const baseLabel = h.label || h.name || String(id);
      return {
        id,
        label: formatHoseLabel(baseLabel),
        c: typeof h.c === 'number' ? h.c : undefined,
      };
    }).filter(Boolean);
  }

  if (dept && typeof dept === 'object') {
    const allRaw = Array.isArray(dept.hosesAll) ? dept.hosesAll : [];
    const raw = allRaw.length ? allRaw : (Array.isArray(dept.hoses) ? dept.hoses : []);
    if (raw.length) {
      return raw.map((h, idx) => {
        if (h && typeof h === 'object') {
          const id = h.id != null ? String(h.id) : String(h.value ?? h.name ?? idx);
          const baseLabel = h.label || h.name || String(id);
          return {
            id,
            label: formatHoseLabel(baseLabel),
            c: typeof h.c === 'number' ? h.c : undefined,
          };
        } else {
          const id = String(h);
          return { id, label: formatHoseLabel(id) };
        }
      }).filter(Boolean);
    }
  }

  return DEFAULT_HOSES;
}

// Department → nozzle list (no master-stream filter; includes prettified fog / smooth)
function getNozzleListFromDept(dept) {
  let baseRaw;

  if (Array.isArray(DEPT_UI_NOZZLES) && DEPT_UI_NOZZLES.length) {
    baseRaw = DEPT_UI_NOZZLES;
  } else if (dept && Array.isArray(dept.nozzlesAll) && dept.nozzlesAll.length) {
    baseRaw = dept.nozzlesAll;
  } else if (dept && Array.isArray(dept.nozzles) && dept.nozzles.length) {
    baseRaw = dept.nozzles;
  } else {
    baseRaw = DEFAULT_NOZZLES;
  }

  if (!Array.isArray(baseRaw) || !baseRaw.length) {
    baseRaw = DEFAULT_NOZZLES;
  }

  const mapped = baseRaw.map((n, idx) => {
    if (!n) return null;

    let id;
    let label;
    let gpm = 0;
    let np = 0;

    if (typeof n === 'string' || typeof n === 'number') {
      id = String(n);
      label = String(n);
      gpm = parseGpmFromLabel(label);
      np  = parseNpFromLabel(label);
    } else {
      id = n.id != null ? String(n.id) : String(n.value ?? n.name ?? idx);
      label = n.label || n.name || String(id);
      if (typeof n.gpm === 'number') gpm = n.gpm;
      if (typeof n.flow === 'number' && !gpm) gpm = n.flow;
      if (typeof n.np === 'number')  np  = n.np;
      if (typeof n.NP === 'number' && !np) np = n.NP;
      if (typeof n.pressure === 'number' && !np) np = n.pressure;
    }

    const pretty = prettifyNozzle(id, label, gpm, np);
    return {
      id,
      label: pretty.label,
      gpm: pretty.gpm || 0,
      np:  pretty.np  || 0,
    };
  }).filter(Boolean);

  return mapped.length ? mapped : DEFAULT_NOZZLES;
}

function findNozzleById(list, id) {
  if (!id) return null;
  return list.find(n => String(n.id) === String(id)) || null;
}

/* -------------------------------------------------------------------------- */
/*  Standpipe-specific helpers                                                */
/* -------------------------------------------------------------------------- */

let standpipeStylesInjected = false;

function injectStandpipeStyles() {
  if (standpipeStylesInjected) return;
  standpipeStylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
  .sp-overlay {
    position: fixed;
    inset: 0;
    background: rgba(3, 7, 18, 0.55);
    backdrop-filter: blur(6px);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 40px;
    z-index: 10050;
    overflow-y: auto;
  }

  .sp-panel {
    position: relative;
    max-width: 480px;
    width: 100%;
    margin: 0 12px 24px;
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
    .sp-panel {
      margin-top: 12px;
      border-radius: 20px;
      padding: 14px 16px 12px;
    }
  }

  .sp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }

  .sp-title {
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .sp-close {
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
  .sp-close:hover {
    background: #111827;
  }

  .sp-body {
    font-size: 0.85rem;
    line-height: 1.45;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .sp-footer {
    display: flex;
    flex-direction: row;
    gap: 6px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }

  .sp-btn-primary,
  .sp-btn-secondary {
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

  .sp-btn-primary {
    background: linear-gradient(135deg, #38bdf8, #22c55e);
    color: #020617;
    font-weight: 600;
  }

  .sp-btn-secondary {
    background: rgba(15, 23, 42, 0.9);
    color: #e5e7eb;
    border: 1px solid rgba(148, 163, 184, 0.7);
  }

  .sp-btn-primary:active,
  .sp-btn-secondary:active {
    transform: translateY(1px);
  }

  .sp-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }

  .sp-row label {
    font-weight: 500;
    font-size: 0.82rem;
  }

  .sp-row span {
    font-size: 0.8rem;
  }

  .sp-panel input[type="text"],
  .sp-panel input[type="number"],
  .sp-panel select {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(55, 65, 81, 0.9);
    background: #020617;
    color: #e5e7eb;
    font-size: 0.8rem;
  }

  .sp-panel input::placeholder {
    color: rgba(148, 163, 184, 0.9);
  }

  .sp-section {
    border-top: 1px solid rgba(148, 163, 184, 0.4);
    padding-top: 8px;
    margin-top: 6px;
  }
  .sp-section:first-of-type {
    border-top: none;
  }

  .sp-section h3 {
    margin: 0 0 4px 0;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #bfdbfe;
  }

  .sp-preview {
    margin-top: 8px;
    padding: 8px;
    border-radius: 10px;
    background: radial-gradient(circle at 0% 0%, #0f172a, #020617);
    border: 1px solid rgba(37, 99, 235, 0.8);
    font-weight: 600;
    font-size: 0.82rem;
    text-align: center;
  }

  @media (min-width: 640px) {
    .sp-row {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }
    .sp-row > label {
      min-width: 130px;
    }
    .sp-row input,
    .sp-row select {
      width: auto;
      min-width: 120px;
    }
  }

  /* Explain math popup */
  .sp-explain-body {
    font-size: 0.83rem;
    line-height: 1.5;
  }
  .sp-explain-body code {
    font-size: 0.8rem;
    background: rgba(15, 23, 42, 0.9);
    border-radius: 4px;
    padding: 1px 4px;
  }

  /* Rule-of-thumb button highlight */
  .sp-rule25-active {
    background: linear-gradient(135deg, #22c55e, #4ade80) !important;
    color: #022c22 !important;
    border-color: rgba(34, 197, 94, 0.9) !important;
  }
  `;
  document.head.appendChild(style);
}

function spEl(tag, opts = {}, ...children) {
  const e = document.createElement(tag);
  if (opts.class) e.className = opts.class;
  if (opts.text) e.textContent = opts.text;
  if (opts.type) e.type = opts.type;
  if (opts.value != null) e.value = opts.value;
  if (opts.placeholder) e.placeholder = opts.placeholder;
  if (opts.for) e.htmlFor = opts.for;
  if (opts.id) e.id = opts.id;
  if (opts.onchange) e.addEventListener('change', opts.onchange);
  if (opts.onclick) e.addEventListener('click', opts.onclick);
  children.forEach(c => e.append(c));
  return e;
}

function spNumberInput(value, onChange, extra = {}) {
  return spEl('input', {
    type: 'number',
    value: value ?? '',
    step: extra.step ?? '1',
    min: extra.min ?? '0',
    onchange: (e) => {
      const raw = e.target.value;
      if (raw === '') onChange('');
      else onChange(Number(raw));
    }
  });
}

function spSelect(options, current, onChange) {
  const s = spEl('select', { onchange: e => onChange(e.target.value) });
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.id;
    o.textContent = opt.label;
    if (opt.id === current) o.selected = true;
    s.appendChild(o);
  });
  return s;
}

// --- Simple helpers to estimate GPM / NP from nozzle (uses dept logic) ---

function parseGpmFromNozzle(nozzles, nozzleId) {
  const noz = findNozzleById(nozzles, nozzleId);
  if (!noz) return nozzleId === 'closed' ? 0 : 150;
  if (typeof noz.gpm === 'number') return noz.gpm;
  if (!noz.label) return 150;
  const m = noz.label.match(/(\d+)\s*gpm/i);
  return m ? Number(m[1]) : 150;
}

function parseNpFromNozzle(nozzles, nozzleId) {
  const noz = findNozzleById(nozzles, nozzleId);
  if (!noz) return nozzleId === 'closed' ? 0 : 100;
  if (typeof noz.np === 'number') return noz.np;
  if (!noz.label) return 100;
  const m = noz.label.match(/@\s*(\d+)\s*psi/i);
  return m ? Number(m[1]) : 100;
}

// Simple C-value mapping (approx) by hose diameter (inches)
const SP_C_BY_DIA = {
  '1.75': 15.5,
  '1.5': 24,
  '2.5': 2,
  '3':   0.8,
  '4':   0.2,
  '5':   0.08,
};

// If you store diameters in the dept.hoses objects, you can use that instead.
// Here we'll try to guess from label.
function guessDiaFromHoseLabel(label) {
  if (!label) return 2.5;
  const m = label.match(/(\d(?:\.\d+)?)\s*"/);
  if (m) return Number(m[1]);
  if (/1 3\/4/.test(label)) return 1.75;
  if (/1¾/.test(label))     return 1.75;
  if (/1\s?1\/2/.test(label)) return 1.5;
  if (/2\s?1\/2/.test(label)) return 2.5;
  if (/3"/.test(label))     return 3;
  if (/5"/.test(label))     return 5;
  return 2.5;
}

function getHoseLabelById(hoses, id) {
  const h = hoses.find(x => String(x.id) === String(id));
  return h ? h.label : '';
}

// Friction loss: FL = C * (GPM/100)^2 * (length/100)
function calcFL(C, gpm, lengthFt) {
  if (!C || !gpm || !lengthFt) return 0;
  const per100 = C * Math.pow(gpm / 100, 2);
  return per100 * (lengthFt / 100);
}

// Elevation: 5 psi per floor as a simple model (or ~0.434 psi/ft)
function calcElevationPsi(floorsUp) {
  if (!floorsUp) return 0;
  return floorsUp * 5;
}

/**
 * Standpipe popup entry point
 *
 * @param {Object} opts
 *   - dept: { hosesAll/nozzlesAll/etc. }, but main source is DEPT_UI_* from store.js
 *   - initial: optional existing config to seed the form
 *   - onSave: function(config) -> void
 */
export function openStandpipePopup({
  dept = {},
  initial = null,
  onSave = () => {},
} = {}) {
  injectStandpipeStyles();

  // Use same dept-driven logic as Standard line
  const hoseList   = getHoseListFromDept(dept);
  const nozzleList = getNozzleListFromDept(dept);

  const CLOSED_NOZZLE = { id: 'closed', label: 'Closed (no flow)', gpm: 0, np: 0 };
  const allNozzles = [CLOSED_NOZZLE, ...nozzleList];

  const firstHose = hoseList[0] || DEFAULT_HOSES[0];
  const firstNozzle = allNozzles[1] || allNozzles[0];

  const state = {
    engineHoseId: firstHose.id,
    engineLengthFt: 200,
    engineHoseCount: 1,     // number of hoses feeding the FDC

    floorsUp: 3,
    systemLossPsi: 0,       // single system loss value (editable, +25 button adjusts this)
    addRule25: false,       // just for button highlight / state

    attackHoseId: firstHose.id,
    attackLengthFt: 150,
    nozzleId: firstNozzle.id,
  };

  if (initial && typeof initial === 'object') {
    Object.assign(state, initial);
  }

  // --- Popup skeleton ---
  const overlay = document.createElement('div');
  overlay.className = 'sp-overlay';

  const panel = document.createElement('div');
  panel.className = 'sp-panel';

  const header = document.createElement('div');
  header.className = 'sp-header';

  const title = document.createElement('div');
  title.className = 'sp-title';
  title.textContent = 'Standpipe setup';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'sp-close';
  closeBtn.textContent = '✕';

  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'sp-body';

  const footer = document.createElement('div');
  footer.className = 'sp-footer';

  const explainBtn = document.createElement('button');
  explainBtn.type = 'button';
  explainBtn.className = 'sp-btn-secondary';
  explainBtn.textContent = 'Explain math';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'sp-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'sp-btn-primary';
  saveBtn.textContent = 'Save';

  footer.append(explainBtn, cancelBtn, saveBtn);

  panel.append(header, body, footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener('click', () => close());
  cancelBtn.addEventListener('click', () => close());

  // --- GPM / PDP calc + preview ---
  const previewBar = spEl('div', { class: 'sp-preview' });

  function calcStandpipeNumbers() {
    const gpm   = parseGpmFromNozzle(allNozzles, state.nozzleId);
    const np    = parseNpFromNozzle(allNozzles, state.nozzleId);

    // Engine → standpipe
    const engLabel = getHoseLabelById(hoseList, state.engineHoseId);
    const engDia   = String(guessDiaFromHoseLabel(engLabel));
    const C1       = SP_C_BY_DIA[engDia] || 2;
    const hosesParallel = Math.max(1, state.engineHoseCount || 1);

    // Parallel hoses: effective C drops by n² (approx)
    const C1eff    = C1 / (hosesParallel * hosesParallel);
    const FL1      = calcFL(C1eff, gpm, state.engineLengthFt || 0);

    // Standpipe → nozzle
    const atkLabel = getHoseLabelById(hoseList, state.attackHoseId);
    const atkDia   = String(guessDiaFromHoseLabel(atkLabel));
    const C2       = SP_C_BY_DIA[atkDia] || 2;
    const FL2      = calcFL(C2, gpm, state.attackLengthFt || 0);

    const elev     = calcElevationPsi(state.floorsUp || 0);
    const system   = state.systemLossPsi || 0;  // already includes any +25 adjustments
    const PDP      = np + FL1 + FL2 + elev + system;

    return {
      gpm,
      np,
      FL1: Math.round(FL1),
      FL2: Math.round(FL2),
      elev: Math.round(elev),
      system: Math.round(system),
      PDP: Math.round(PDP),
      hosesParallel,
    };
  }

  function updatePreview() {
    const { gpm, PDP, hosesParallel } = calcStandpipeNumbers();
    const hoseText = hosesParallel > 1 ? ` (${hosesParallel} hoses to FDC)` : '';
    previewBar.textContent = `Standpipe – GPM: ${gpm}   |   PDP: ${PDP} psi${hoseText}`;
  }

  // --- Explain math popup ---
  function openExplainPopup() {
    const vals = calcStandpipeNumbers();

    const o = document.createElement('div');
    o.className = 'sp-overlay';

    const p = document.createElement('div');
    p.className = 'sp-panel';

    const h = document.createElement('div');
    h.className = 'sp-header';

    const t = document.createElement('div');
    t.className = 'sp-title';
    t.textContent = 'Standpipe math breakdown';

    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'sp-close';
    x.textContent = '✕';

    h.append(t, x);

    const b = document.createElement('div');
    b.className = 'sp-body sp-explain-body';

    const gpm = vals.gpm;
    const np  = vals.np;

    const engLabel = getHoseLabelById(hoseList, state.engineHoseId);
    const atkLabel = getHoseLabelById(hoseList, state.attackHoseId);

    const ruleText = state.addRule25
      ? ' (includes +25 psi rule-of-thumb)'
      : '';

    b.innerHTML = `
      <p>We are using a simple standpipe formula:</p>
      <p><code>PDP = NP + FL₁ + FL₂ + Elevation + System&nbsp;Loss</code></p>

      <p><strong>Inputs:</strong></p>
      <ul>
        <li>Nozzle: ${state.nozzleId || ''} → approx <code>${gpm} gpm</code> @ <code>${np} psi</code></li>
        <li>Engine → standpipe hose: <code>${engLabel || state.engineHoseId || 'unknown'}</code>,
            length <code>${state.engineLengthFt || 0} ft</code>,
            hoses in parallel: <code>${vals.hosesParallel}</code></li>
        <li>Standpipe → nozzle hose: <code>${atkLabel || state.attackHoseId || 'unknown'}</code>,
            length <code>${state.attackLengthFt || 0} ft</code></li>
        <li>Floors up / elevation: <code>${state.floorsUp || 0}</code></li>
        <li>System loss: <code>${vals.system} psi</code>${ruleText}</li>
      </ul>

      <p><strong>Step 1 – Friction loss (engine → standpipe):</strong><br>
        We use FL = C × (GPM/100)² × (length/100). With ${vals.hosesParallel} hose(s) in parallel,
        we lower C accordingly.<br>
        → FL₁ ≈ <code>${vals.FL1} psi</code>
      </p>

      <p><strong>Step 2 – Friction loss (standpipe → nozzle):</strong><br>
        Same formula with the attack hose C and length.<br>
        → FL₂ ≈ <code>${vals.FL2} psi</code>
      </p>

      <p><strong>Step 3 – Elevation:</strong><br>
        Approx 5 psi per floor up.<br>
        → Elevation ≈ <code>${vals.elev} psi</code>
      </p>

      <p><strong>Step 4 – System loss:</strong><br>
        User-entered system loss value${state.addRule25 ? ', including the +25 psi rule-of-thumb if toggled' : ''}.<br>
        → System loss ≈ <code>${vals.system} psi</code>
      </p>

      <p><strong>Final pump discharge pressure (PDP):</strong></p>
      <p>
        <code>
          PDP = ${np} (NP) +
                ${vals.FL1} (FL₁) +
                ${vals.FL2} (FL₂) +
                ${vals.elev} (elev) +
                ${vals.system} (system)
          = ${vals.PDP} psi
        </code>
      </p>
    `;

    const f = document.createElement('div');
    f.className = 'sp-footer';

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'sp-btn-primary';
    ok.textContent = 'Close';

    f.appendChild(ok);

    p.append(h, b, f);
    o.appendChild(p);
    document.body.appendChild(o);

    function closeExplain() {
      if (o.parentNode) o.parentNode.removeChild(o);
    }

    o.addEventListener('click', (e) => {
      if (e.target === o) closeExplain();
    });
    x.addEventListener('click', closeExplain);
    ok.addEventListener('click', closeExplain);
  }

  explainBtn.addEventListener('click', () => {
    openExplainPopup();
  });

  // --- Build form ---

  const engineSection = spEl('div', { class: 'sp-section' },
    spEl('h3', { text: 'Engine → standpipe (FDC)' }),
    spEl('div', { class: 'sp-row' },
      spEl('label', { text: 'Hose type:' }),
      spSelect(hoseList, state.engineHoseId, v => { state.engineHoseId = v; updatePreview(); }),
      spEl('span', { text: 'Hoses:' }),
      spNumberInput(
        state.engineHoseCount,
        v => {
          const n = v || 1;
          state.engineHoseCount = n < 1 ? 1 : n;
          updatePreview();
        },
        { min: '1', step: '1' }
      ),
      spEl('span', { text: 'Length:' }),
      spNumberInput(state.engineLengthFt, v => { state.engineLengthFt = v || 0; updatePreview(); }),
      spEl('span', { text: 'ft' })
    )
  );

  // System loss input needs a reference so the button can update it
  let systemLossInput;

  const elevationSection = spEl('div', { class: 'sp-section' },
    spEl('h3', { text: 'Elevation & system' }),
    spEl('div', { class: 'sp-row' },
      spEl('label', { text: 'Floors up:' }),
      spNumberInput(state.floorsUp, v => { state.floorsUp = v || 0; updatePreview(); }),
      spEl('span', { text: '≈ 5 psi / floor' })
    ),
    (function () {
      systemLossInput = spNumberInput(
        state.systemLossPsi,
        v => {
          state.systemLossPsi = v || 0;
          updatePreview();
        }
      );
      return spEl('div', { class: 'sp-row' },
        spEl('label', { text: 'System loss:' }),
        systemLossInput,
        spEl('span', { text: 'psi (valves, PRVs, etc.)' })
      );
    })(),
    spEl('div', { class: 'sp-row' },
      spEl('label', { text: '' }),
      (function() {
        const btn = spEl('button', {
          class: 'sp-btn-secondary',
          text: state.addRule25 ? 'Rule of thumb +25 psi (on)' : 'Apply +25 psi rule of thumb',
        });
        if (state.addRule25) {
          btn.classList.add('sp-rule25-active');
        }
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          if (!state.addRule25) {
            // Turn ON: add +25 psi to whatever is in the box
            state.systemLossPsi = (state.systemLossPsi || 0) + 25;
            state.addRule25 = true;
          } else {
            // Turn OFF: remove 25 psi (but not below 0)
            state.systemLossPsi = Math.max(0, (state.systemLossPsi || 0) - 25);
            state.addRule25 = false;
          }
          systemLossInput.value = state.systemLossPsi;
          if (state.addRule25) {
            btn.textContent = 'Rule of thumb +25 psi (on)';
            btn.classList.add('sp-rule25-active');
          } else {
            btn.textContent = 'Apply +25 psi rule of thumb';
            btn.classList.remove('sp-rule25-active');
          }
          updatePreview();
        });
        return btn;
      })()
    )
  );

  const attackSection = spEl('div', { class: 'sp-section' },
    spEl('h3', { text: 'Standpipe → nozzle' }),
    spEl('div', { class: 'sp-row' },
      spEl('label', { text: 'Attack hose type:' }),
      spSelect(hoseList, state.attackHoseId, v => { state.attackHoseId = v; updatePreview(); }),
      spEl('span', { text: 'Length:' }),
      spNumberInput(state.attackLengthFt, v => { state.attackLengthFt = v || 0; updatePreview(); }),
      spEl('span', { text: 'ft' })
    ),
    spEl('div', { class: 'sp-row' },
      spEl('label', { text: 'Nozzle:' }),
      spSelect(allNozzles, state.nozzleId, v => { state.nozzleId = v; updatePreview(); })
    )
  );

  body.append(engineSection, elevationSection, attackSection, previewBar);
  updatePreview();

  // Save handler – returns a compact config for this line
  saveBtn.addEventListener('click', () => {
    const payload = {
      type: 'standpipe',
      engineHoseId: state.engineHoseId,
      engineLengthFt: state.engineLengthFt,
      engineHoseCount: state.engineHoseCount,
      floorsUp: state.floorsUp,
      systemLossPsi: state.systemLossPsi,
      addRule25: state.addRule25,
      attackHoseId: state.attackHoseId,
      attackLengthFt: state.attackLengthFt,
      nozzleId: state.nozzleId,
      // Optional: cache last-calculated PDP/GPM
      lastCalc: calcStandpipeNumbers(),
    };
    onSave(payload);
    close();
  });
}

// === exports (same pattern as Standard line) ===
export default openStandpipePopup;
