// view.presetEditor.js
// Popup Preset Line Editor for FireOpsCalc
// - Type picker: Standard, Blitz, Master, Standpipe, Sprinkler, Foam, Custom
// - Each type shows its own mini-menu
// - Global GPM / PDP preview
// - Uses separate popups for Master Stream, Foam, Sprinkler

import { openMasterStreamPopup } from './view.lineMaster.js';
import { openFoamPopup }          from './view.lineFoam.js';
import { openSprinklerPopup }     from './view.lineSprinkler.js';

let presetEditorStylesInjected = false;

function injectPresetEditorStyles() {
  if (presetEditorStylesInjected) return;
  presetEditorStylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
/* ==== PRESET LINE EDITOR – POPUP & DARK THEME ==== */

.preset-line-overlay {
  position: fixed;
  inset: 0;
  background: rgba(3, 7, 18, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 40px;
  z-index: 9999;
  overflow-y: auto;
}

/* Panel matches the look of .preset-panel from preset.js */
.preset-line-panel {
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
  .preset-line-panel {
    margin-top: 12px;
    border-radius: 20px;
    padding: 14px 16px 12px;
  }
}

/* Header row (title + close) */
.preset-line-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
}

.preset-line-title {
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.preset-line-close {
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
.preset-line-close:hover {
  background: #111827;
}

/* Body is scrollable form */
.preset-line-body {
  font-size: 0.85rem;
  line-height: 1.45;
  max-height: min(60vh, 420px);
  overflow-y: auto;
  padding-top: 4px;
  padding-bottom: 4px;
}

/* Footer: buttons */
.preset-line-footer {
  display: flex;
  flex-direction: row;
  gap: 6px;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
}

/* Buttons match btn-primary / btn-secondary vibe */
.pe-btn-primary,
.pe-btn-secondary {
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

.pe-btn-primary {
  background: linear-gradient(135deg, #38bdf8, #22c55e);
  color: #020617;
  font-weight: 600;
}

.pe-btn-secondary {
  background: rgba(15, 23, 42, 0.9);
  color: #e5e7eb;
  border: 1px solid rgba(148, 163, 184, 0.7);
}

.pe-btn-primary:active,
.pe-btn-secondary:active {
  transform: translateY(1px);
}

/* ==== FORM LAYOUT (MOBILE FIRST) ==== */

.preset-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Sections */
.preset-editor section.pe-section {
  border-top: 1px solid rgba(148, 163, 184, 0.4);
  padding-top: 8px;
}
.preset-editor section.pe-section:first-of-type {
  border-top: none;
}

/* Rows: stacked on phone, horizontal on wider screens */
.pe-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}

.pe-row label {
  font-weight: 500;
  font-size: 0.82rem;
}

/* Inputs & selects full width on phone */
.preset-editor input[type="text"],
.preset-editor input[type="number"],
.preset-editor select {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid rgba(55, 65, 81, 0.9);
  background: #020617;
  color: #e5e7eb;
  font-size: 0.8rem;
}

.preset-editor input::placeholder {
  color: rgba(148, 163, 184, 0.9);
}

/* Subsections (branches / feeds) – card inside panel */
.pe-subsection {
  border: 1px solid rgba(30, 64, 175, 0.5);
  background: rgba(15, 23, 42, 0.85);
  padding: 6px;
  border-radius: 10px;
  margin-top: 6px;
}

.pe-subsection h4 {
  margin: 0 0 4px 0;
  font-size: 0.8rem;
  color: #bfdbfe;
}

/* Toggle pill group */
.pe-toggle-group {
  display: inline-flex;
  gap: 4px;
}

.pe-toggle-group button {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(75, 85, 99, 0.9);
  background: rgba(15, 23, 42, 0.9);
  font-size: 0.78rem;
  color: #e5e7eb;
  cursor: pointer;
}

.pe-toggle-on {
  background: #0ea5e9;
  border-color: #0ea5e9;
  color: #020617;
}

/* Type selection grid */
.pe-type-section h3 {
  margin: 0 0 6px 0;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #bfdbfe;
}

.pe-type-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pe-type-btn {
  flex: 1 1 45%;
  min-width: 120px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1px solid rgba(55, 65, 81, 0.9);
  background: rgba(15, 23, 42, 0.8);
  color: #e5e7eb;
  font-size: 0.78rem;
  text-align: left;
  cursor: pointer;
}
.pe-type-btn span {
  display: block;
  font-size: 0.72rem;
  opacity: 0.8;
}
.pe-type-btn.pe-type-active {
  border-color: #22c55e;
  background: radial-gradient(circle at 0% 0%, #022c22, #020617);
}

/* Preview bar */
.pe-preview {
  margin-top: 8px;
  padding: 8px;
  border-radius: 10px;
  background: radial-gradient(circle at 0% 0%, #0f172a, #020617);
  border: 1px solid rgba(37, 99, 235, 0.8);
  font-weight: 600;
  font-size: 0.82rem;
  text-align: center;
}

/* Name row margin tweak */
.pe-name {
  margin-top: 0;
}

/* Desktop / tablet enhancements */
@media (min-width: 640px) {
  .pe-row {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }

  .pe-row > label {
    min-width: 100px;
  }

  .pe-two-cols {
    display: flex;
    flex-direction: row;
    gap: 8px;
  }

  .pe-subsection {
    flex: 1 1 48%;
  }

  .preset-editor input[type="text"],
  .preset-editor input[type="number"],
  .preset-editor select {
    width: auto;
    min-width: 120px;
  }
}

/* Explain-math popup styling (used by Standpipe) */
.pe-explain-overlay {
  position: fixed;
  inset: 0;
  background: rgba(3, 7, 18, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 40px;
  z-index: 10050;
  overflow-y: auto;
}
.pe-explain-panel {
  max-width: 480px;
  width: 100%;
  margin: 0 12px 24px;
  background: #020617;
  border-radius: 18px;
  box-shadow:
    0 18px 30px rgba(15, 23, 42, 0.85),
    0 0 0 1px rgba(148, 163, 184, 0.45);
  padding: 12px 14px 10px;
  color: #e5e7eb;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pe-explain-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
}
.pe-explain-title {
  font-size: 0.95rem;
  font-weight: 600;
}
.pe-explain-body {
  font-size: 0.83rem;
  line-height: 1.5;
  max-height: min(60vh, 420px);
  overflow-y: auto;
  padding-top: 4px;
  padding-bottom: 4px;
}
.pe-explain-body code {
  font-size: 0.8rem;
  background: rgba(15, 23, 42, 0.9);
  border-radius: 4px;
  padding: 1px 4px;
}
.pe-explain-footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
}
  `;
  document.head.appendChild(style);
}

function deepClone(obj) {
  if (obj == null) return obj;
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Open the preset line editor as a popup overlay.
 */
export function openPresetEditorPopup({
  dept = {},
  initialPreset = null,
  onSave = () => {},
  onCancel = () => {}
} = {}) {
  injectPresetEditorStyles();

  const overlay = document.createElement('div');
  overlay.className = 'preset-line-overlay';

  const panel = document.createElement('div');
  panel.className = 'preset-line-panel';

  const header = document.createElement('div');
  header.className = 'preset-line-header';

  const titleEl = document.createElement('div');
  titleEl.className = 'preset-line-title';
  titleEl.textContent = 'Preset line editor';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'preset-line-close';
  closeBtn.textContent = '✕';

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'preset-line-body';

  const footer = document.createElement('div');
  footer.className = 'preset-line-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'pe-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'pe-btn-primary';
  saveBtn.textContent = 'Save preset';

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function close(cancelled = true) {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (cancelled && typeof onCancel === 'function') onCancel();
  }

  // Close on outside click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close(true);
  });
  closeBtn.addEventListener('click', () => close(true));
  cancelBtn.addEventListener('click', () => close(true));

  // Render the inner editor into body
  renderPresetEditor(body, {
    dept,
    initialPreset,
    onSave(presetConfig) {
      if (typeof onSave === 'function') onSave(presetConfig);
      close(false);
    },
    onCancel() {
      close(true);
    },
    saveButton: saveBtn
  });
}

/**
 * Core renderer (used by the popup, but you can also mount it directly).
 */
export function renderPresetEditor(mountEl, {
  dept = {},
  initialPreset = null,
  onSave = () => {},
  onCancel = () => {},
  saveButton = null,
} = {}) {
  injectPresetEditorStyles();

  const hoses      = dept.hoses      || []; // [{id, label}]
  const nozzles    = dept.nozzles    || []; // [{id, label}]
  const appliances = dept.appliances || []; // [{id, label}]

  // === initial state ===
  const defaults = {
    name: '',
    lineType: 'standard',         // standard | blitz | master | standpipe | sprinkler | foam | custom

    hoseSizeId: hoses[0]?.id || '',
    lengthFt: 200,
    nozzleId: nozzles[0]?.id || '',
    pressureMode: 'auto',         // 'auto' | 'manual'

    hasWye: false,
    wye: {
      branchA: { hoseSizeId: hoses[0]?.id || '', lengthFt: 100, nozzleId: nozzles[0]?.id || '' },
      branchB: { hoseSizeId: hoses[0]?.id || '', lengthFt: 100, nozzleId: nozzles[0]?.id || '' }
    },

    // Master / Blitz summary – detailed config in view.lineMaster.js
    hasMaster: false,
    master: {
      mountType: 'deck',
      feedLines: 1,
      applianceId: appliances[0]?.id || '',
      desiredGpm: 800,
      applianceLossPsi: 25,
      elevationFt: 0,
      leftFeed:  { hoseSizeId: hoses[0]?.id || '', lengthFt: 150, intakePsi: '' },
      rightFeed: { hoseSizeId: hoses[0]?.id || '', lengthFt: 150, intakePsi: '' },
      blitzFeed: { hoseSizeId: hoses[0]?.id || '', lengthFt: 150, intakePsi: '' },
      lastCalc: null
    },

    // Foam config is handled by view.lineFoam.js
    foam: {
      lastCalc: null
    },

    // Sprinkler config is handled by view.lineSprinkler.js
    sprinkler: {
      lastCalc: null
    },

    // Standpipe stays inline here
    standpipe: {
      floor: '',
      outletPsi: 100,
      floorsUp: 0,
      systemLossPsi: 25,
      attackHoseId: hoses[0]?.id || '',
      attackLengthFt: 150,
    },
  };

  const state = deepClone(defaults);
  if (initialPreset) {
    Object.assign(state, initialPreset);

    if (initialPreset.master) {
      Object.assign(state.master, initialPreset.master);
      if (state.master.mountType === 'mounted') state.master.mountType = 'deck';
      if (state.master.mountType === 'base')    state.master.mountType = 'portable';
    }
    if (initialPreset.foam) {
      state.foam = { ...state.foam, ...initialPreset.foam };
    }
    if (initialPreset.sprinkler) {
      state.sprinkler = { ...state.sprinkler, ...initialPreset.sprinkler };
    }
    if (initialPreset.standpipe) {
      Object.assign(state.standpipe, initialPreset.standpipe);
    }
  }

  // === helpers ===
  function el(tag, opts = {}, ...children) {
    const e = document.createElement(tag);
    if (opts.class) e.className = opts.class;
    if (opts.text) e.textContent = opts.text;
    if (opts.type) e.type = opts.type;
    if (opts.value != null) e.value = opts.value;
    if (opts.placeholder) e.placeholder = opts.placeholder;
    if (opts.for) e.htmlFor = opts.for;
    if (opts.id) e.id = opts.id;
    if (opts.disabled) e.disabled = true;
    if (opts.min != null) e.min = opts.min;
    if (opts.step != null) e.step = opts.step;
    if (opts.checked != null) e.checked = !!opts.checked;
    if (opts.title) e.title = opts.title;
    if (opts.onchange) e.addEventListener('change', opts.onchange);
    if (opts.onclick) e.addEventListener('click', opts.onclick);
    children.forEach(c => e.append(c));
    return e;
  }

  function select(options, current, onChange) {
    const s = el('select', { onchange: e => onChange(e.target.value) });
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.id;
      o.textContent = opt.label;
      if (opt.id === current) o.selected = true;
      s.appendChild(o);
    });
    return s;
  }

  function numberInput(value, onChange, extra = {}) {
    return el('input', {
      type: 'number',
      value: value ?? '',
      step: extra.step ?? '1',
      min: extra.min ?? '0',
      onchange: e => {
        const raw = e.target.value;
        if (raw === '') {
          onChange('');
        } else {
          onChange(Number(raw));
        }
      }
    });
  }

  function textInput(value, onChange, placeholder = '') {
    return el('input', {
      type: 'text',
      value: value ?? '',
      placeholder,
      onchange: e => onChange(e.target.value)
    });
  }

  // --- Nozzle & hose helpers for standpipe/master math ---
  function parseGpmFromNozzle(nozzleId) {
    const noz = nozzles.find(n => n.id === nozzleId);
    if (!noz || !noz.label) return 150;
    const m = noz.label.match(/(\d+)\s*gpm/i);
    return m ? Number(m[1]) : 150;
  }

  function parseNpFromNozzle(nozzleId) {
    const noz = nozzles.find(n => n.id === nozzleId);
    if (!noz || !noz.label) return 100;
    const m = noz.label.match(/@\s*(\d+)\s*psi/i);
    return m ? Number(m[1]) : 100;
  }

  const SP_C_BY_DIA = {
    '1.75': 15.5,
    '1.5': 24,
    '2.5': 2,
    '3':   0.8,
    '4':   0.2,
    '5':   0.08,
  };

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

  function getHoseLabelById(id) {
    const h = hoses.find(x => x.id === id);
    return h ? h.label : '';
  }

  function calcFL(C, gpm, lengthFt) {
    if (!C || !gpm || !lengthFt) return 0;
    const per100 = C * Math.pow(gpm / 100, 2);
    return per100 * (lengthFt / 100);
  }

  function calcElevationPsi(floorsUp) {
    if (!floorsUp) return 0;
    return floorsUp * 5;
  }

  // --- Standpipe numbers ---
  function calcStandpipeNumbers(currentState) {
    const gpm = parseGpmFromNozzle(currentState.nozzleId);
    const np  = parseNpFromNozzle(currentState.nozzleId);

    const engineHoseLabel = getHoseLabelById(currentState.hoseSizeId);
    const engineDia       = String(guessDiaFromHoseLabel(engineHoseLabel));
    const C1              = SP_C_BY_DIA[engineDia] || 2;
    const FL1             = calcFL(C1, gpm, currentState.lengthFt || 0);

    const spState = currentState.standpipe || {};
    const atkHoseId     = spState.attackHoseId || currentState.hoseSizeId;
    const atkLengthFt   = spState.attackLengthFt || currentState.lengthFt || 0;
    const attackHoseLbl = getHoseLabelById(atkHoseId);
    const attackDia     = String(guessDiaFromHoseLabel(attackHoseLbl));
    const C2            = SP_C_BY_DIA[attackDia] || 2;
    const FL2           = calcFL(C2, gpm, atkLengthFt);

    const floorsUp      = spState.floorsUp ?? 0;
    const elev          = calcElevationPsi(floorsUp);
    const systemLoss    = spState.systemLossPsi ?? 25;

    const PDP           = np + FL1 + FL2 + elev + systemLoss;

    return {
      gpm,
      np,
      FL1: Math.round(FL1),
      FL2: Math.round(FL2),
      elev: Math.round(elev),
      system: Math.round(systemLoss),
      PDP: Math.round(PDP),
      engineHoseLabel,
      attackHoseLabel,
      floorsUp,
    };
  }

  // --- Master stream numbers (preview only; main config handled by view.lineMaster.js) ---
  function calcMasterNumbers(currentState) {
    const m = currentState.master || {};
    const gpm = Number(m.desiredGpm || 800);
    const NP  = 80; // standard master stream NP assumption

    const lines = m.feedLines === 2 ? 2 : 1;

    let feeds = [];
    if (lines === 1) {
      if (m.mountType === 'portable') {
        feeds = [m.blitzFeed];
      } else {
        feeds = [m.leftFeed];
      }
    } else {
      feeds = [m.leftFeed, m.rightFeed];
    }

    let FL = 0;
    const gpmPerLine = gpm / lines;
    feeds.forEach(feed => {
      if (!feed) return;
      const label = getHoseLabelById(feed.hoseSizeId);
      const dia   = String(guessDiaFromHoseLabel(label));
      const C     = SP_C_BY_DIA[dia] || 2;
      const len   = feed.lengthFt || 0;
      const fl    = calcFL(C, gpmPerLine, len);
      if (fl > FL) FL = fl;
    });

    const applianceLoss = m.applianceLossPsi || 25;
    const elevPsi       = (m.elevationFt || 0) * 0.434;
    const PDP           = NP + FL + applianceLoss + elevPsi;

    return {
      gpm: Math.round(gpm),
      NP,
      FL: Math.round(FL),
      applianceLoss: Math.round(applianceLoss),
      elevPsi: Math.round(elevPsi),
      PDP: Math.round(PDP),
      lines,
      mountType: m.mountType,
    };
  }

  // === PREVIEW (type-aware) ===
  function calculatePPandGPM(currentState) {
    // Standpipe uses inline math
    if (currentState.lineType === 'standpipe') {
      const vals = calcStandpipeNumbers(currentState);
      return { gpm: vals.gpm, pp: vals.PDP };
    }

    // Master / Blitz: prefer lastCalc from popup, otherwise local calc
    if (currentState.lineType === 'master' || currentState.lineType === 'blitz') {
      if (currentState.master && currentState.master.lastCalc) {
        const lc = currentState.master.lastCalc;
        return { gpm: lc.gpm || lc.totalGpm || 800, pp: lc.PDP || lc.pdp || 150 };
      }
      const vals = calcMasterNumbers(currentState);
      return { gpm: vals.gpm, pp: vals.PDP };
    }

    // Foam: use popup math if available
    if (currentState.lineType === 'foam') {
      if (currentState.foam && currentState.foam.lastCalc) {
        const lc = currentState.foam.lastCalc;
        const gpm = lc.solutionGpm || lc.waterGpm || 150;
        const pp  = lc.pdp || currentState.foam.eductorPdp || 200;
        return { gpm: Math.round(gpm), pp: Math.round(pp) };
      }
      // Fallback
      return { gpm: 150, pp: 200 };
    }

    // Sprinkler: use popup math if available
    if (currentState.lineType === 'sprinkler') {
      if (currentState.sprinkler && currentState.sprinkler.lastCalc) {
        const lc = currentState.sprinkler.lastCalc;
        const gpm = lc.totalGpm || lc.designGpm || 300;
        const pp  = lc.pdp || 150;
        return { gpm: Math.round(gpm), pp: Math.round(pp) };
      }
      // Fallback
      return { gpm: 300, pp: 150 };
    }

    // Other / custom placeholder logic
    let gpm = 150;
    let pp  = 150;

    switch (currentState.lineType) {
      case 'standard':
        gpm = 150;
        if (currentState.hasWye) gpm += 50;
        break;
      case 'custom':
      default:
        gpm = 200;
        if (currentState.hasMaster) gpm += 200;
        if (currentState.hasWye) gpm += 50;
        break;
    }

    return { gpm: Math.round(gpm), pp: Math.round(pp) };
  }

  // === UI skeleton ===
  const container = el('div', { class: 'preset-editor' });

  // --- TYPE SELECTION ---
  const typeButtons = [];

  function makeTypeButton(id, label, sublabel) {
    const btn = el('button', {
      class: 'pe-type-btn',
      onclick: (e) => {
        e.preventDefault();
        setLineType(id);
      }
    },
      document.createTextNode(label),
      el('span', { text: sublabel || '' })
    );
    typeButtons.push({ id, btn });
    return btn;
  }

  function updateTypeButtons() {
    typeButtons.forEach(({ id, btn }) => {
      btn.classList.toggle('pe-type-active', state.lineType === id);
    });
  }

  function setLineType(type) {
    state.lineType = type;
    if (type === 'standard') {
      state.hasMaster = false;
    } else if (type === 'blitz' || type === 'master') {
      state.hasMaster = true;
    }
    updateTypeButtons();
    renderLayout();
    updatePreview();
  }

  const typeSection = el('section', { class: 'pe-section pe-type-section' },
    el('h3', { text: 'Select preset type' }),
    (function () {
      const grid = el('div', { class: 'pe-type-grid' },
        makeTypeButton('standard',  'Standard line',  'Attack line, optional wye'),
        makeTypeButton('blitz',     'Blitz fire',     'Portable blitz / RAM'),
        makeTypeButton('master',    'Master stream',  'Deck gun or portable'),
        makeTypeButton('standpipe', 'Standpipe',      'High-rise / FDC lines'),
        makeTypeButton('sprinkler', 'Sprinkler',      'System / FDC supply'),
        makeTypeButton('foam',      'Foam line',      'Eductor / foam setup'),
        makeTypeButton('custom',    'Custom builder', 'Mix wyes, foam, master, etc.')
      );
      return grid;
    })()
  );

  // --- NAME ROW ---
  const nameRow = el('div', { class: 'pe-row pe-name' },
    el('label', { text: 'Preset name:' }),
    textInput(
      state.name,
      v => { state.name = v; updatePreview(); },
      'Example: Deck gun 1000 gpm'
    )
  );

  // --- BASIC SECTION ---
  const basicSection = el('section', { class: 'pe-section' },
    el('h3', { text: 'Hose & basic setup' })
  );

  const basicRow1 = el('div', { class: 'pe-row' },
    el('label', { text: 'Hose size:' }),
    select(hoses, state.hoseSizeId, v => { state.hoseSizeId = v; updatePreview(); }),
    el('span', { text: 'Total length:' }),
    numberInput(state.lengthFt, v => { state.lengthFt = v === '' ? 0 : v; updatePreview(); }),
    el('span', { text: 'ft' })
  );

  const pressureToggle = (() => {
    const autoBtn = el('button', {
      text: 'Auto',
      onclick: (e) => {
        e.preventDefault();
        state.pressureMode = 'auto';
        refresh();
        updatePreview();
      }
    });
    const manBtn = el('button', {
      text: 'Manual',
      onclick: (e) => {
        e.preventDefault();
        state.pressureMode = 'manual';
        refresh();
        updatePreview();
      }
    });
    function refresh() {
      autoBtn.classList.toggle('pe-toggle-on', state.pressureMode === 'auto');
      manBtn.classList.toggle('pe-toggle-on', state.pressureMode === 'manual');
    }
    refresh();
    return el('span', { class: 'pe-toggle-group' }, autoBtn, manBtn);
  })();

  const basicRow2 = el('div', { class: 'pe-row' },
    el('label', { text: 'Nozzle / tip:' }),
    select(nozzles, state.nozzleId, v => { state.nozzleId = v; updatePreview(); }),
    el('span', { text: 'Pressure mode:' }),
    pressureToggle
  );

  basicSection.append(basicRow1, basicRow2);

  // --- Standpipe explain popup ---
  function openStandpipeExplainPopup() {
    const vals = calcStandpipeNumbers(state);

    const overlay = document.createElement('div');
    overlay.className = 'pe-explain-overlay';

    const panel = document.createElement('div');
    panel.className = 'pe-explain-panel';

    const header = document.createElement('div');
    header.className = 'pe-explain-header';

    const title = document.createElement('div');
    title.className = 'pe-explain-title';
    title.textContent = 'Standpipe math breakdown';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'preset-line-close';
    closeBtn.textContent = '✕';

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'pe-explain-body';

    const gpm = vals.gpm;
    const np  = vals.np;

    body.innerHTML = `
      <p>We use a simple standpipe formula:</p>
      <p><code>PDP = NP + FL₁ + FL₂ + Elevation + System&nbsp;Loss</code></p>

      <p><strong>Inputs:</strong></p>
      <ul>
        <li>Nozzle: <code>${state.nozzleId || ''}</code> → approx <code>${gpm} gpm</code> @ <code>${np} psi</code></li>
        <li>Engine → standpipe hose: <code>${vals.engineHoseLabel || 'engine hose'}</code>,
            length <code>${state.lengthFt || 0} ft</code></li>
        <li>Standpipe → nozzle hose: <code>${vals.attackHoseLabel || 'attack hose'}</code>,
            length <code>${(state.standpipe && state.standpipe.attackLengthFt) || state.lengthFt || 0} ft</code></li>
        <li>Floors up / elevation: <code>${vals.floorsUp || 0}</code></li>
        <li>System loss (valves, PRVs, fittings): <code>${vals.system} psi</code></li>
      </ul>

      <p><strong>Step 1 – Friction loss (engine → standpipe):</strong><br>
        <code>FL₁ = C₁ × (GPM/100)² × (length/100)</code><br>
        → FL₁ ≈ <code>${vals.FL1} psi</code>
      </p>

      <p><strong>Step 2 – Friction loss (standpipe → nozzle):</strong><br>
        <code>FL₂ = C₂ × (GPM/100)² × (length/100)</code><br>
        → FL₂ ≈ <code>${vals.FL2} psi</code>
      </p>

      <p><strong>Step 3 – Elevation:</strong><br>
        Approx 5 psi per floor up.<br>
        → Elevation ≈ <code>${vals.elev} psi</code>
      </p>

      <p><strong>Step 4 – System loss:</strong><br>
        User-estimated loss for standpipe valves, PRVs, etc.<br>
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

    const footer = document.createElement('div');
    footer.className = 'pe-explain-footer';

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'pe-btn-primary';
    okBtn.textContent = 'Close';

    footer.appendChild(okBtn);

    panel.append(header, body, footer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    function closeExplain() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeExplain();
    });
    closeBtn.addEventListener('click', closeExplain);
    okBtn.addEventListener('click', closeExplain);
  }

  // --- SPECIAL SECTION (foam / sprinkler / standpipe / custom) ---
  const specialSection = el('section', { class: 'pe-section', id: 'pe-special' });

  function renderSpecialSection() {
    specialSection.innerHTML = '';

    const targets = [];
    if (state.lineType === 'foam')      targets.push('foam');
    if (state.lineType === 'sprinkler') targets.push('sprinkler');
    if (state.lineType === 'standpipe') targets.push('standpipe');
    if (state.lineType === 'custom')    targets.push('foam','sprinkler','standpipe');

    if (!targets.length) return;

    // FOAM: button opens view.lineFoam.js popup
    if (targets.includes('foam')) {
      const foamHeader = el('h3', { text: 'Foam options' });

      const summaryText = (() => {
        const lc = state.foam && state.foam.lastCalc;
        if (!lc) return 'No foam setup yet. Tap "Configure foam system" to build one.';
        const water = lc.waterGpm ?? 0;
        const foam  = lc.foamGpm ?? 0;
        const sol   = lc.solutionGpm ?? (water + foam);
        const pdp   = lc.pdp ?? '—';
        return `Flow ~${sol} gpm (water ${water} + foam ${foam}) • PDP ~${pdp} psi`;
      })();

      const row = el('div', { class: 'pe-row' },
        el('label', { text: 'Foam system:' }),
        el('span', { text: summaryText }),
        el('button', {
          class: 'pe-btn-secondary',
          text: 'Configure foam system',
          onclick: (e) => {
            e.preventDefault();
            openFoamPopup({
              dept: { nozzles },
              initial: state.foam,
              onSave(config) {
                state.foam = config;
                // Make sure preview uses foam for this preset
                state.lineType = state.lineType === 'custom' ? state.lineType : 'foam';
                updateTypeButtons();
                renderSpecialSection();
                updatePreview();
              }
            });
          }
        })
      );

      specialSection.append(foamHeader, row);
    }

    // SPRINKLER: button opens view.lineSprinkler.js popup
    if (targets.includes('sprinkler')) {
      const sprHeader = el('h3', { text: 'Sprinkler options' });

      const summaryText = (() => {
        const lc = state.sprinkler && state.sprinkler.lastCalc;
        if (!lc) return 'No sprinkler setup yet. Tap "Configure sprinkler system" to build one.';
        const flow = lc.totalGpm ?? lc.designGpm ?? 0;
        const pdp  = lc.pdp ?? '—';
        return `Flow ~${flow} gpm • PDP ~${pdp} psi`;
      })();

      const row = el('div', { class: 'pe-row' },
        el('label', { text: 'Sprinkler system:' }),
        el('span', { text: summaryText }),
        el('button', {
          class: 'pe-btn-secondary',
          text: 'Configure sprinkler system',
          onclick: (e) => {
            e.preventDefault();
            openSprinklerPopup({
              initial: state.sprinkler,
              onSave(config) {
                state.sprinkler = config;
                state.lineType = state.lineType === 'custom' ? state.lineType : 'sprinkler';
                updateTypeButtons();
                renderSpecialSection();
                updatePreview();
              }
            });
          }
        })
      );

      specialSection.append(sprHeader, row);
    }

    // STANDPIPE: keep inline mini-editor + explain math popup
    if (targets.includes('standpipe')) {
      const spState = state.standpipe || {};

      const section = el('div', null,
        el('h3', { text: 'Standpipe options' }),
        el('div', { class: 'pe-row' },
          el('label', { text: 'Floors up:' }),
          numberInput(spState.floorsUp ?? 0, v => {
            state.standpipe.floorsUp = v || 0;
            updatePreview();
          }),
          el('span', { text: '≈ 5 psi / floor' })
        ),
        el('div', { class: 'pe-row' },
          el('label', { text: 'System loss:' }),
          numberInput(spState.systemLossPsi ?? 25, v => {
            state.standpipe.systemLossPsi = v || 0;
            updatePreview();
          }),
          el('span', { text: 'psi (valves, PRVs, etc.)' })
        ),
        el('div', { class: 'pe-row' },
          el('label', { text: 'Standpipe → nozzle hose:' }),
          select(
            hoses,
            spState.attackHoseId || state.hoseSizeId,
            v => {
              state.standpipe.attackHoseId = v;
              updatePreview();
            }
          ),
          el('span', { text: 'Length:' }),
          numberInput(spState.attackLengthFt ?? state.lengthFt ?? 150, v => {
            state.standpipe.attackLengthFt = v || 0;
            updatePreview();
          }),
          el('span', { text: 'ft' })
        ),
        el('div', { class: 'pe-row' },
          el('label', { text: 'Nozzle:' }),
          select(
            nozzles,
            state.nozzleId,
            v => { state.nozzleId = v; updatePreview(); }
          )
        ),
        el('div', { class: 'pe-row' },
          el('span', { text: '' }),
          el('button', {
            class: 'pe-btn-secondary',
            text: 'Explain math',
            onclick: (e) => {
              e.preventDefault();
              openStandpipeExplainPopup();
            }
          })
        )
      );

      specialSection.append(section);
    }
  }

  // --- WYE SECTION (standard + custom) ---
  const wyeSection = el('section', { class: 'pe-section' });
  const wyeContent = el('div');

  const wyeToggleGroup = (() => {
    const noBtn = el('button', {
      text: 'No',
      onclick: (e) => {
        e.preventDefault();
        state.hasWye = false;
        refresh();
        renderWyeContent();
        updatePreview();
      }
    });
    const yesBtn = el('button', {
      text: 'Yes',
      onclick: (e) => {
        e.preventDefault();
        state.hasWye = true;
        refresh();
        renderWyeContent();
        updatePreview();
      }
    });
    function refresh() {
      noBtn.classList.toggle('pe-toggle-on', !state.hasWye);
      yesBtn.classList.toggle('pe-toggle-on', state.hasWye);
    }
    refresh();
    return { groupEl: el('span', { class: 'pe-toggle-group' }, noBtn, yesBtn), refresh };
  })();

  const wyeToggleRow = el('div', { class: 'pe-row' },
    el('h3', { text: 'Wye / branch builder' }),
    el('span', { text: 'Add wye:' }),
    wyeToggleGroup.groupEl
  );

  function branchBlock(label, bState) {
    return el('div', { class: 'pe-subsection' },
      el('h4', { text: label }),
      el('div', { class: 'pe-row' },
        el('label', { text: 'Hose size:' }),
        select(hoses, bState.hoseSizeId, v => { bState.hoseSizeId = v; updatePreview(); }),
        el('span', { text: 'Length:' }),
        numberInput(bState.lengthFt, v => { bState.lengthFt = v === '' ? 0 : v; updatePreview(); }),
        el('span', { text: 'ft' })
      ),
      el('div', { class: 'pe-row' },
        el('label', { text: 'Nozzle:' }),
        select(nozzles, bState.nozzleId, v => { bState.nozzleId = v; updatePreview(); })
      )
    );
  }

  function renderWyeContent() {
    wyeContent.innerHTML = '';
    if (!state.hasWye) return;
    wyeContent.append(
      el('div', { class: 'pe-row pe-two-cols' },
        branchBlock('Branch A', state.wye.branchA),
        branchBlock('Branch B', state.wye.branchB)
      )
    );
  }

  wyeSection.append(wyeToggleRow, wyeContent);

  // --- MASTER / BLITZ SECTION (summary + button to popup) ---
  const masterSection = el('section', { class: 'pe-section' });

  function renderMasterSection() {
    masterSection.innerHTML = '';

    if (
      state.lineType !== 'blitz' &&
      state.lineType !== 'master' &&
      state.lineType !== 'custom'
    ) {
      return;
    }

    const isBlitz = state.lineType === 'blitz';

    masterSection.append(
      el('h3', {
        text: isBlitz ? 'Blitz fire setup' : 'Master stream builder'
      })
    );

    const lc = state.master && state.master.lastCalc
      ? state.master.lastCalc
      : calcMasterNumbers(state);

    const mode = state.master.mountType === 'portable'
      ? 'Portable / Blitz'
      : 'Deck gun';

    const lines = state.master.feedLines === 2 ? 2 : 1;

    const summaryRow = el('div', { class: 'pe-row' },
      el('label', { text: 'Current master setup:' }),
      el('span', {
        text: lc && lc.gpm
          ? `${mode}, ${lines} line${lines > 1 ? 's' : ''} – ~${lc.gpm} gpm, PDP ~${lc.PDP || lc.pdp || 150} psi`
          : 'No master stream setup yet. Tap "Configure master stream" to build one.'
      })
    );

    const btnRow = el('div', { class: 'pe-row' },
      el('span', { text: '' }),
      el('button', {
        class: 'pe-btn-secondary',
        text: 'Configure master stream',
        onclick: (e) => {
          e.preventDefault();
          openMasterStreamPopup({
            dept: { hoses, appliances },
            initial: state.master,
            onSave(config) {
              state.master = config;
              state.hasMaster = true;
              // Ensure type stays master/blitz/custom – don't override
              renderMasterSection();
              updatePreview();
            }
          });
        }
      })
    );

    masterSection.append(summaryRow, btnRow);
  }

  // --- PREVIEW BAR ---
  const previewBar = el('div', { class: 'pe-preview' });

  function updatePreview() {
    const { gpm, pp } = calculatePPandGPM(state);
    previewBar.textContent = `Preview – GPM: ${gpm}   |   PDP: ${pp} psi`;
  }

  // --- SAVE HANDLER ---
  if (saveButton) {
    saveButton.onclick = (e) => {
      e.preventDefault();
      onSave(deepClone(state));
    };
  }

  // --- LAYOUT RENDERING ---
  function renderLayout() {
    container.innerHTML = '';

    container.append(typeSection, nameRow, basicSection);

    renderSpecialSection();
    if (specialSection.innerHTML.trim()) {
      container.append(specialSection);
    }

    if (state.lineType === 'standard' || state.lineType === 'custom') {
      wyeToggleGroup.refresh && wyeToggleGroup.refresh();
      renderWyeContent();
      container.append(wyeSection);
    }

    if (state.lineType === 'blitz' || state.lineType === 'master' || state.lineType === 'custom') {
      renderMasterSection();
      container.append(masterSection);
    }

    container.append(previewBar);
  }

  // Initial render
  updateTypeButtons();
  renderSpecialSection();
  renderWyeContent();
  renderMasterSection();
  updatePreview();
  renderLayout();

  mountEl.innerHTML = '';
  mountEl.appendChild(container);
}
