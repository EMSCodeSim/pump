// view.presetEditor.js
// Popup Preset Line Editor for FireOpsCalc
// - Type picker (standard, blitz, master, standpipe, sprinkler, foam, custom)
// - Basic hose + nozzle setup + optional wye
// - For Master / Standpipe / Foam, opens dedicated popups:
//     view.lineMaster.js      -> openMasterStreamPopup
//     view.lineStandpipe.js   -> openStandpipePopup
//     view.lineFoam.js        -> openFoamPopup
// - Each popup returns a config with lastCalc we use for the preview bar.

import { openMasterStreamPopup }   from './view.lineMaster.js';
import { openStandpipePopup }     from './view.lineStandpipe.js';
import { openFoamPopup }          from './view.lineFoam.js';

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

/* Subsections (branches) – card inside panel */
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

    // External popup configs:
    masterConfig:    null,  // from openMasterStreamPopup
    standpipeConfig: null,  // from openStandpipePopup
    foamConfig:      null,  // from openFoamPopup
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

  // --- Type buttons ---

  const typeButtons = [];

  function makeTypeButton(id, label, sublabel) {
    const btn = el('button', {
      class: 'pe-type-btn',
      onclick: (e) => {
        e.preventDefault();
        setLineType(id, true); // true = open popup when relevant
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

  function setLineType(type, openPopup) {
    state.lineType = type;
    updateTypeButtons();
    renderLayout();
    if (openPopup) {
      if (type === 'master')    openMasterConfig();
      if (type === 'standpipe') openStandpipeConfig();
      if (type === 'foam')      openFoamConfig();
    }
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

  // --- SPECIAL SECTION (foam / sprinkler / standpipe / master shortcuts) ---
  const specialSection = el('section', { class: 'pe-section', id: 'pe-special' });

  function renderSpecialSection() {
    specialSection.innerHTML = '';

    // For now, this just shows "configure" shortcuts for the external popups,
    // plus sprinkler placeholder fields.
    const targets = [];
    if (state.lineType === 'foam')      targets.push('foam');
    if (state.lineType === 'standpipe') targets.push('standpipe');
    if (state.lineType === 'master')    targets.push('master');
    if (state.lineType === 'sprinkler') targets.push('sprinkler');
    if (state.lineType === 'custom')    targets.push('foam', 'standpipe', 'master', 'sprinkler');

    if (!targets.length) return;

    if (targets.includes('foam')) {
      specialSection.append(
        el('h3', { text: 'Foam options' }),
        el('div', { class: 'pe-row' },
          el('span', { text: 'Open foam setup:' }),
          el('button', {
            class: 'pe-btn-secondary',
            text: 'Configure foam system…',
            onclick: (e) => {
              e.preventDefault();
              openFoamConfig();
            }
          })
        )
      );
    }

    if (targets.includes('standpipe')) {
      specialSection.append(
        el('h3', { text: 'Standpipe options' }),
        el('div', { class: 'pe-row' },
          el('span', { text: 'Open standpipe setup:' }),
          el('button', {
            class: 'pe-btn-secondary',
            text: 'Configure standpipe…',
            onclick: (e) => {
              e.preventDefault();
              openStandpipeConfig();
            }
          })
        )
      );
    }

    if (targets.includes('master')) {
      specialSection.append(
        el('h3', { text: 'Master stream options' }),
        el('div', { class: 'pe-row' },
          el('span', { text: 'Open master stream setup:' }),
          el('button', {
            class: 'pe-btn-secondary',
            text: 'Configure master stream…',
            onclick: (e) => {
              e.preventDefault();
              openMasterConfig();
            }
          })
        )
      );
    }

    if (targets.includes('sprinkler')) {
      specialSection.append(
        el('h3', { text: 'Sprinkler options (placeholder)' }),
        el('div', { class: 'pe-row' },
          el('span', { text: 'Sprinkler presets will be added here.' })
        )
      );
    }
  }

  // --- PREVIEW BAR ---
  const previewBar = el('div', { class: 'pe-preview' });

  function calculatePPandGPM(currentState) {
    // If external popup configs have lastCalc, use them.
    if (currentState.lineType === 'master' && currentState.masterConfig?.lastCalc) {
      const lc = currentState.masterConfig.lastCalc;
      const gpm = lc.gpm ?? lc.GPM ?? 0;
      const pp  = lc.PDP ?? lc.pp ?? lc.pdp ?? 0;
      return { gpm: Math.round(gpm), pp: Math.round(pp) };
    }

    if (currentState.lineType === 'standpipe' && currentState.standpipeConfig?.lastCalc) {
      const lc = currentState.standpipeConfig.lastCalc;
      const gpm = lc.gpm ?? lc.GPM ?? 0;
      const pp  = lc.PDP ?? lc.pp ?? lc.pdp ?? 0;
      return { gpm: Math.round(gpm), pp: Math.round(pp) };
    }

    if (currentState.lineType === 'foam' && currentState.foamConfig?.lastCalc) {
      const lc = currentState.foamConfig.lastCalc;
      const gpm = lc.solutionGpm ?? lc.waterGpm ?? lc.gpm ?? 0;
      const pp  = lc.pdp ?? lc.PDP ?? 0;
      return { gpm: Math.round(gpm), pp: Math.round(pp || 150) };
    }

    // Placeholder / simple preview for other types.
    let gpm = 150;
    let pp  = 150;

    switch (currentState.lineType) {
      case 'standard':
        gpm = 150;
        if (currentState.hasWye) gpm += 50;
        break;
      case 'blitz':
        gpm = 500;
        pp  = 150;
        break;
      case 'sprinkler':
        gpm = 250;
        pp  = 150;
        break;
      case 'custom':
      default:
        gpm = 200;
        if (currentState.hasWye) gpm += 50;
        if (currentState.masterConfig) gpm += 200;
        break;
    }

    return { gpm: Math.round(gpm), pp: Math.round(pp) };
  }

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
  const container = el('div', { class: 'preset-editor' });

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

    container.append(previewBar);
  }

  // Initial render
  updateTypeButtons();
  renderWyeContent();
  renderSpecialSection();
  updatePreview();
  renderLayout();

  mountEl.innerHTML = '';
  mountEl.appendChild(container);
}
