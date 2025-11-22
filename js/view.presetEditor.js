// view.presetEditor.js
// Popup Preset Line Editor for FireOpsCalc
// Now styled to visually match the dark "Presets" panel.

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

/* Re-use visual style of btn-primary / btn-secondary from preset.js */
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
 *
 * Usage:
 *   import { openPresetEditorPopup } from './view.presetEditor.js';
 *   openPresetEditorPopup({ dept, onSave: preset => {...} });
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
    saveButton: saveBtn // we’ll wire the click after render
  });
}

/**
 * Core renderer (used by the popup, but you can also mount it directly
 * into any container if you want an embedded editor instead of popup).
 */
export function renderPresetEditor(mountEl, {
  dept = {},
  initialPreset = null,
  onSave = () => {},
  onCancel = () => {},
  saveButton = null, // optional external save button (for popup footer)
} = {}) {
  injectPresetEditorStyles();

  const hoses      = dept.hoses      || []; // [{id, label}]
  const nozzles    = dept.nozzles    || []; // [{id, label}]
  const appliances = dept.appliances || []; // [{id, label}]
  const specials   = ['Standard Line', 'Foam', 'Sprinkler', 'Standpipe'];

  // ---- initial state ----
  const defaults = {
    name: '',
    hoseSizeId: hoses[0]?.id || '',
    lengthFt: 200,
    nozzleId: nozzles[0]?.id || '',
    pressureMode: 'auto',         // 'auto' | 'manual'
    specialType: 'Standard Line',

    hasWye: false,
    wye: {
      branchA: { hoseSizeId: hoses[0]?.id || '', lengthFt: 100, nozzleId: nozzles[0]?.id || '' },
      branchB: { hoseSizeId: hoses[0]?.id || '', lengthFt: 100, nozzleId: nozzles[0]?.id || '' }
    },

    hasMaster: false,
    master: {
      applianceId: appliances[0]?.id || '',
      desiredGpm: '',
      leftFeed:  { hoseSizeId: hoses[0]?.id || '', lengthFt: 100, intakePsi: '' },
      rightFeed: { hoseSizeId: hoses[0]?.id || '', lengthFt: 100, intakePsi: '' }
    },

    foam:      { percent: 0,  eductorPsi: 200 },
    sprinkler: { areaSqFt: '', density: '', remoteHeadLossPsi: 0 },
    standpipe: { floor: '',   outletPsi: 100 }
  };

  const state = deepClone(defaults);
  if (initialPreset) Object.assign(state, initialPreset);

  // ---- small DOM helpers ----
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

  // ---- PREVIEW (placeholder – hook into real calc later) ----
  function calculatePPandGPM(currentState) {
    // TODO: replace with real FireOpsCalc engine using hose, nozzle, etc.
    let gpm = 150;
    let pp  = 150;

    if (currentState.specialType === 'Foam')       gpm += 25;
    if (currentState.specialType === 'Sprinkler')  gpm += 50;
    if (currentState.specialType === 'Standpipe')  pp  += 25;
    if (currentState.hasWye)                       gpm += 50;
    if (currentState.hasMaster) { gpm += 200; pp += 50; }

    return { gpm, pp };
  }

  // ---- BUILD UI ----
  const container = el('div', { class: 'preset-editor' });

  // Name row
  const nameRow = el('div', { class: 'pe-row pe-name' },
    el('label', { text: 'Preset name:' }),
    textInput(
      state.name,
      v => { state.name = v; updatePreview(); },
      'Example: 1 3/4" front crosslay'
    )
  );

  // Basic hose section
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
    el('label', { text: 'Nozzle:' }),
    select(nozzles, state.nozzleId, v => { state.nozzleId = v; updatePreview(); }),
    el('span', { text: 'Pressure:' }),
    pressureToggle
  );

  const specialRow = el('div', { class: 'pe-row' },
    el('label', { text: 'Line type:' }),
    (function () {
      const opts = specials.map(s => ({ id: s, label: s }));
      const s = select(opts, state.specialType, v => {
        state.specialType = v;
        renderSpecialSection();
        updatePreview();
      });
      return s;
    })()
  );

  basicSection.append(basicRow1, basicRow2, specialRow);

  // Special section container
  const specialSection = el('section', { class: 'pe-section', id: 'pe-special' });

  function renderSpecialSection() {
    specialSection.innerHTML = '';
    if (state.specialType === 'Foam') {
      specialSection.append(
        el('h3', { text: 'Foam options' }),
        el('div', { class: 'pe-row' },
          el('label', { text: 'Foam %:' }),
          numberInput(state.foam.percent, v => { state.foam.percent = v; updatePreview(); }, { step: '0.1' }),
          el('span', { text: '%' }),
          el('span', { text: 'Eductor PDP:' }),
          numberInput(state.foam.eductorPsi, v => { state.foam.eductorPsi = v; updatePreview(); }),
          el('span', { text: 'psi' })
        )
      );
    } else if (state.specialType === 'Sprinkler') {
      specialSection.append(
        el('h3', { text: 'Sprinkler options' }),
        el('div', { class: 'pe-row' },
          el('label', { text: 'Area:' }),
          numberInput(state.sprinkler.areaSqFt, v => { state.sprinkler.areaSqFt = v; updatePreview(); }),
          el('span', { text: 'ft²' }),
          el('span', { text: 'Density:' }),
          numberInput(state.sprinkler.density, v => { state.sprinkler.density = v; updatePreview(); }),
          el('span', { text: 'gpm/ft²' })
        ),
        el('div', { class: 'pe-row' },
          el('label', { text: 'Remote head loss:' }),
          numberInput(state.sprinkler.remoteHeadLossPsi, v => { state.sprinkler.remoteHeadLossPsi = v; updatePreview(); }),
          el('span', { text: 'psi' })
        )
      );
    } else if (state.specialType === 'Standpipe') {
      specialSection.append(
        el('h3', { text: 'Standpipe options' }),
        el('div', { class: 'pe-row' },
          el('label', { text: 'Floor / elevation:' }),
          textInput(state.standpipe.floor, v => { state.standpipe.floor = v; updatePreview(); }, 'e.g. 5th floor'),
          el('span', { text: 'Outlet PDP:' }),
          numberInput(state.standpipe.outletPsi, v => { state.standpipe.outletPsi = v; updatePreview(); }),
          el('span', { text: 'psi' })
        )
      );
    }
  }

  // Wye builder
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
    el('span', { text: 'Add Wye:' }),
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

  // Master Stream builder
  const masterSection = el('section', { class: 'pe-section' });
  const masterContent = el('div');

  const masterToggleGroup = (() => {
    const noBtn = el('button', {
      text: 'No',
      onclick: (e) => {
        e.preventDefault();
        state.hasMaster = false;
        refresh();
        renderMasterContent();
        updatePreview();
      }
    });
    const yesBtn = el('button', {
      text: 'Yes',
      onclick: (e) => {
        e.preventDefault();
        state.hasMaster = true;
        refresh();
        renderMasterContent();
        updatePreview();
      }
    });
    function refresh() {
      noBtn.classList.toggle('pe-toggle-on', !state.hasMaster);
      yesBtn.classList.toggle('pe-toggle-on', state.hasMaster);
    }
    refresh();
    return { groupEl: el('span', { class: 'pe-toggle-group' }, noBtn, yesBtn), refresh };
  })();

  const masterToggleRow = el('div', { class: 'pe-row' },
    el('h3', { text: 'Master stream builder' }),
    el('span', { text: 'Add master stream:' }),
    masterToggleGroup.groupEl
  );

  function feedBlock(label, fState) {
    return el('div', { class: 'pe-subsection' },
      el('h4', { text: label }),
      el('div', { class: 'pe-row' },
        el('label', { text: 'Hose size:' }),
        select(hoses, fState.hoseSizeId, v => { fState.hoseSizeId = v; updatePreview(); }),
        el('span', { text: 'Length:' }),
        numberInput(fState.lengthFt, v => { fState.lengthFt = v === '' ? 0 : v; updatePreview(); }),
        el('span', { text: 'ft' })
      ),
      el('div', { class: 'pe-row' },
        el('label', { text: 'Intake PSI:' }),
        numberInput(fState.intakePsi, v => { fState.intakePsi = v; updatePreview(); })
      )
    );
  }

  function renderMasterContent() {
    masterContent.innerHTML = '';
    if (!state.hasMaster) return;

    const applianceRow = el('div', { class: 'pe-row' },
      el('label', { text: 'Appliance:' }),
      select(appliances, state.master.applianceId, v => { state.master.applianceId = v; updatePreview(); }),
      el('span', { text: 'Desired GPM:' }),
      numberInput(state.master.desiredGpm, v => { state.master.desiredGpm = v; updatePreview(); })
    );

    masterContent.append(
      applianceRow,
      el('div', { class: 'pe-row pe-two-cols' },
        feedBlock('Left feed', state.master.leftFeed),
        feedBlock('Right feed', state.master.rightFeed)
      )
    );
  }

  masterSection.append(masterToggleRow, masterContent);

  // Preview
  const previewBar = el('div', { class: 'pe-preview' });

  function updatePreview() {
    const { gpm, pp } = calculatePPandGPM(state);
    previewBar.textContent = `Preview – GPM: ${gpm}   |   PDP: ${pp} psi`;
  }

  // Wire external save button (popup footer) if provided
  if (saveButton) {
    saveButton.onclick = (e) => {
      e.preventDefault();
      onSave(deepClone(state));
    };
  }

  // Initial render
  renderSpecialSection();
  renderWyeContent();
  renderMasterContent();
  updatePreview();

  container.append(
    nameRow,
    basicSection,
    specialSection,
    wyeSection,
    masterSection,
    previewBar
  );

  mountEl.innerHTML = '';
  mountEl.appendChild(container);
}
