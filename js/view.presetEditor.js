// view.presetEditor.js
// Popup Preset Line Editor for FireOpsCalc
//
// This version:
// - Removes Blitz fire button
// - Adds Supply line button
// - Hooks each type to its own popup file:
//     * Standard line  -> view.lineStandard.js (openStandardLinePopup)
//     * Master stream  -> view.lineMaster.js   (openMasterStreamPopup)
//     * Standpipe      -> view.lineStandpipe.js(openStandpipePopup)
//     * Sprinkler      -> view.lineSprinkler.js(openSprinklerPopup)
//     * Foam line      -> view.lineFoam.js     (openFoamPopup)
//     * Supply line    -> view.lineSupply.js   (openSupplyLinePopup)
//     * Custom builder -> view.lineCustom.js   (openCustomBuilderPopup)
// - Removes internal basic hose + wye builder
// - Requires preset name BEFORE any type can be selected.

import { openMasterStreamPopup }   from './view.lineMaster.js';
import { openStandpipePopup }      from './view.lineStandpipe.js';
import { openFoamPopup }           from './view.lineFoam.js';
import { openSprinklerPopup }      from './view.lineSprinkler.js';
import { openStandardLinePopup }   from './view.lineStandard.js';
import { openSupplyLinePopup }     from './view.lineSupply.js';
import { openCustomBuilderPopup }  from './view.lineCustom.js';

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

/* Buttons */
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

/* Rows */
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

/* Inputs & selects */
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
.pe-type-btn:disabled {
  opacity: 0.4;
  cursor: default;
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

/* Name row */
.pe-name {
  margin-top: 0;
}

/* Hint text */
.pe-hint {
  font-size: 0.75rem;
  opacity: 0.8;
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

  .preset-editor input[type="text"],
  .preset-editor input[type="number"],
  .preset-editor select {
    width: auto;
    min-width: 160px;
  }
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
  saveButton = null,
} = {}) {
  injectPresetEditorStyles();

  const hoses      = dept.hoses      || []; // [{id, label}]
  const nozzles    = dept.nozzles    || []; // not used directly here but kept for future
  const appliances = dept.appliances || [];

  // === initial state ===
  const defaults = {
    name: '',
    lineType: '',         // standard | master | standpipe | sprinkler | foam | supply | custom

    // Configs from external builders:
    standardConfig:   null,
    masterConfig:     null,
    standpipeConfig:  null,
    sprinklerConfig:  null,
    foamConfig:       null,
    supplyConfig:     null,
    customConfig:     null,
  };

  const state = deepClone(defaults);
  if (initialPreset) {
    Object.assign(state, initialPreset);
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
    if (opts.disabled != null) e.disabled = !!opts.disabled;
    if (opts.title) e.title = opts.title;
    if (opts.onchange) e.addEventListener('change', opts.onchange);
    if (opts.onclick) e.addEventListener('click', opts.onclick);
    children.forEach(c => e.append(c));
    return e;
  }

  // --- PREVIEW BAR ---

  const previewBar = el('div', { class: 'pe-preview' });

  function extractGpmAndPdpFromLastCalc(lastCalc, fallbackGpm, fallbackPdp) {
    if (!lastCalc || typeof lastCalc !== 'object') {
      return { gpm: fallbackGpm, pp: fallbackPdp };
    }

    let gpm =
      lastCalc.gpm ??
      lastCalc.GPM ??
      lastCalc.flowGpm ??
      lastCalc.solutionGpm ??
      lastCalc.waterGpm ??
      lastCalc.requiredFlowGpm ??
      lastCalc.targetFlowGpm ??
      fallbackGpm;

    let pp =
      lastCalc.PDP ??
      lastCalc.pdp ??
      lastCalc.pp ??
      lastCalc.pumpPsi ??
      fallbackPdp;

    return {
      gpm: Math.round(Number(gpm || 0)),
      pp:  Math.round(Number(pp  || 0)),
    };
  }

  function calculatePPandGPM(currentState) {
    const type = currentState.lineType;

    if (type === 'standard' && currentState.standardConfig?.lastCalc) {
      return extractGpmAndPdpFromLastCalc(currentState.standardConfig.lastCalc, 150, 150);
    }
    if (type === 'master' && currentState.masterConfig?.lastCalc) {
      return extractGpmAndPdpFromLastCalc(currentState.masterConfig.lastCalc, 500, 150);
    }
    if (type === 'standpipe' && currentState.standpipeConfig?.lastCalc) {
      return extractGpmAndPdpFromLastCalc(currentState.standpipeConfig.lastCalc, 150, 150);
    }
    if (type === 'sprinkler' && currentState.sprinklerConfig?.lastCalc) {
      return extractGpmAndPdpFromLastCalc(currentState.sprinklerConfig.lastCalc, 250, 150);
    }
    if (type === 'foam' && currentState.foamConfig?.lastCalc) {
      return extractGpmAndPdpFromLastCalc(currentState.foamConfig.lastCalc, 95, 200);
    }
    if (type === 'supply' && currentState.supplyConfig?.lastCalc) {
      return extractGpmAndPdpFromLastCalc(currentState.supplyConfig.lastCalc, 500, 80);
    }
    if (type === 'custom' && currentState.customConfig?.lastCalc) {
      return extractGpmAndPdpFromLastCalc(currentState.customConfig.lastCalc, 300, 150);
    }

    // Fallback if nothing configured yet
    switch (type) {
      case 'standard':  return { gpm: 150, pp: 150 };
      case 'master':    return { gpm: 500, pp: 150 };
      case 'standpipe': return { gpm: 150, pp: 175 };
      case 'sprinkler': return { gpm: 250, pp: 150 };
      case 'foam':      return { gpm: 95,  pp: 200 };
      case 'supply':    return { gpm: 500, pp: 80 };
      case 'custom':    return { gpm: 300, pp: 150 };
      default:          return { gpm: 0,   pp: 0 };
    }
  }

  function updatePreview() {
    if (!state.lineType) {
      previewBar.textContent = 'Enter a preset name, then choose a build type to open its editor.';
      return;
    }
    const { gpm, pp } = calculatePPandGPM(state);
    previewBar.textContent = `Preview – Type: ${state.lineType || 'none'}   •   GPM: ${gpm}   •   PDP: ${pp} psi`;
  }

  // --- NAME FIELD (REQUIRED BEFORE TYPE SELECTION) ---

  const nameInput = el('input', {
    type: 'text',
    value: state.name || '',
    placeholder: 'Example: 1¾\" attack 200\' 150 gpm',
    onchange: e => {
      state.name = e.target.value || '';
      updateTypeButtons();
      updatePreview();
    }
  });

  const nameRow = el('div', { class: 'pe-row pe-name' },
    el('label', { text: 'Preset name:' }),
    nameInput
  );

  // --- TYPE BUTTONS ---

  const typeButtons = [];

  function makeTypeButton(id, label, sublabel) {
    const btn = el('button', {
      class: 'pe-type-btn',
      onclick: (e) => {
        e.preventDefault();
        if (!state.name.trim()) {
          // Guard in case disabled attribute isn't respected somewhere
          alert('Enter a preset name first.');
          return;
        }
        setLineType(id, true); // true => open popup
      }
    },
      document.createTextNode(label),
      el('span', { text: sublabel || '' })
    );
    typeButtons.push({ id, btn });
    return btn;
  }

  function updateTypeButtons() {
    const hasName = !!state.name.trim();
    typeButtons.forEach(({ id, btn }) => {
      btn.classList.toggle('pe-type-active', state.lineType === id);
      btn.disabled = !hasName;
    });
  }

  function openStandardConfig() {
    openStandardLinePopup({
      dept: { hoses, nozzles },
      initial: state.standardConfig || null,
      onSave(config) {
        state.standardConfig = config;
        updatePreview();
      }
    });
  }

  function openMasterConfig() {
    openMasterStreamPopup({
      dept: { hoses, appliances },
      initial: state.masterConfig || null,
      onSave(config) {
        state.masterConfig = config;
        updatePreview();
      }
    });
  }

  function openStandpipeConfig() {
    openStandpipePopup({
      dept: { hoses, nozzles },
      initial: state.standpipeConfig || null,
      onSave(config) {
        state.standpipeConfig = config;
        updatePreview();
      }
    });
  }

  function openSprinklerConfig() {
    openSprinklerPopup({
      dept: { hoses },
      initial: state.sprinklerConfig || null,
      onSave(config) {
        state.sprinklerConfig = config;
        updatePreview();
      }
    });
  }

  function openFoamConfig() {
    openFoamPopup({
      dept: { nozzles },
      initial: state.foamConfig || null,
      onSave(config) {
        state.foamConfig = config;
        updatePreview();
      }
    });
  }

  function openSupplyConfig() {
    openSupplyLinePopup({
      dept: { hoses },
      initial: state.supplyConfig || null,
      onSave(config) {
        state.supplyConfig = config;
        updatePreview();
      }
    });
  }

  function openCustomConfig() {
    openCustomBuilderPopup({
      dept: { hoses, appliances },
      initial: state.customConfig || null,
      onSave(config) {
        state.customConfig = config;
        updatePreview();
      }
    });
  }

  function setLineType(type, openPopup) {
    state.lineType = type;
    updateTypeButtons();
    if (openPopup) {
      if (type === 'standard')  openStandardConfig();
      if (type === 'master')    openMasterConfig();
      if (type === 'standpipe') openStandpipeConfig();
      if (type === 'sprinkler') openSprinklerConfig();
      if (type === 'foam')      openFoamConfig();
      if (type === 'supply')    openSupplyConfig();
      if (type === 'custom')    openCustomConfig();
    }
    updatePreview();
  }

  const typeSection = el('section', { class: 'pe-section pe-type-section' },
    el('h3', { text: 'Choose build type' }),
    (function () {
      const grid = el('div', { class: 'pe-type-grid' },
        makeTypeButton('standard',  'Standard line',  'Attack line (with wye option)'),
        makeTypeButton('master',    'Master stream',  'Deck gun or portable base'),
        makeTypeButton('standpipe', 'Standpipe',      'High-rise / FDC standpipe'),
        makeTypeButton('sprinkler', 'Sprinkler',      'Sprinkler / FDC supply'),
        makeTypeButton('foam',      'Foam line',      'Foam eductor / foam setup'),
        makeTypeButton('supply',    'Supply line',    'Hydrant / relay / feed line'),
        makeTypeButton('custom',    'Custom builder', 'Mix wyes, siamese, appliances')
      );
      return grid;
    })(),
    el('div', { class: 'pe-hint', text: 'Enter a preset name first, then tap a type to open its builder. Tap the same type again to reopen and edit.' })
  );

  // --- LAYOUT CONTAINER ---

  const container = el('div', { class: 'preset-editor' });

  function renderLayout() {
    container.innerHTML = '';
    container.append(
      nameRow,
      typeSection,
      previewBar
    );
  }

  // Initial setup
  renderLayout();
  updateTypeButtons();
  updatePreview();

  // Hook save button to return the whole preset structure
  if (saveButton) {
    saveButton.onclick = (e) => {
      e.preventDefault();
      if (!state.name.trim()) {
        alert('Please enter a preset name before saving.');
        return;
      }
      if (!state.lineType) {
        alert('Please choose a build type and configure it before saving.');
        return;
      }
      onSave(deepClone(state));
    };
  }

  mountEl.innerHTML = '';
  mountEl.appendChild(container);
}
