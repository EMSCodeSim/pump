// view.presetEditor.js
// Popup Preset Line Editor for FireOpsCalc

let presetEditorStylesInjected = false;

function injectPresetEditorStyles() {
  if (presetEditorStylesInjected) return;
  presetEditorStylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
/* ==== PRESET EDITOR – POPUP & MOBILE FIRST ==== */

.preset-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 40px;
  z-index: 9999;
  overflow-y: auto;
}

.preset-editor {
  background: #ffffff;
  padding: 12px;
  margin: 16px;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.25);
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 15px;
  max-width: 480px;
  width: 100%;
  box-sizing: border-box;
}

/* Sections */
.preset-editor section.pe-section {
  border-top: 1px solid #ddd;
  padding-top: 8px;
}

/* Rows: mobile = stacked vertical */
.pe-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}

.pe-row label {
  font-weight: 500;
}

/* Inputs & selects full-width on phone */
.preset-editor input[type="text"],
.preset-editor input[type="number"],
.preset-editor select {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #ccc;
}

/* Smaller inline spans (units, etc.) */
.pe-row span {
  font-size: 0.9em;
}

/* Subsections (branches / feeds) – full width on phone */
.pe-subsection {
  border: 1px solid #eee;
  padding: 6px;
  border-radius: 4px;
  margin-top: 6px;
}

/* Toggle buttons */
.pe-toggle-group {
  display: inline-flex;
  gap: 4px;
}

.pe-toggle-group button {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid #ccc;
  background: #f5f5f5;
  font-size: 0.9em;
}

.pe-toggle-on {
  background: #007aff;
  border-color: #007aff;
  color: #fff;
}

/* Name row */
.pe-name input {
  width: 100%;
}

/* Preview bar */
.pe-preview {
  margin-top: 8px;
  padding: 8px;
  border-radius: 4px;
  background: #f3f6ff;
  font-weight: 600;
  text-align: center;
}

/* Actions */
.pe-actions {
  display: flex;
  flex-direction: row;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}

.pe-actions button {
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  font-weight: 600;
  cursor: pointer;
}

.pe-save {
  background: #007aff;
  color: #fff;
}

.pe-cancel {
  background: #eee;
}

/* ====== DESKTOP / TABLET ENHANCEMENTS ====== */
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
 * Open the preset editor as a popup overlay.
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
  overlay.className = 'preset-overlay';

  const mount = document.createElement('div');
  overlay.appendChild(mount);
  document.body.appendChild(overlay);

  function close(cancelled = true) {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (cancelled && typeof onCancel === 'function') {
      onCancel();
    }
  }

  // Click outside to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close(true);
  });

  renderPresetEditor(mount, {
    dept,
    initialPreset,
    onSave(presetConfig) {
      if (typeof onSave === 'function') onSave(presetConfig);
      close(false);
    },
    onCancel() {
      close(true);
    }
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
  onCancel = () => {}
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
      onchange: e => onChange(e.target.value === '' ? '' : Number(e.target.value))
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
      'Example: 1 3/4" Crosslay'
    )
  );

  // Basic hose section
  const basicSection = el('section', { class: 'pe-section' },
    el('h3', { text: 'Hose & Basic Setup' })
  );

  const basicRow1 = el('div', { class: 'pe-row' },
    el('label', { text: 'Hose size:' }),
    select(hoses, state.hoseSizeId, v => { state.hoseSizeId = v; updatePreview(); }),
    el('span', { text: 'Total length:' }),
    numberInput(state.lengthFt, v => { state.lengthFt = v === '' ? 0 : v; updatePreview(); }),
    el('span', { text: 'ft' })
  );

  const basicRow2 = el('div', { class: 'pe-row' },
    el('label', { text: 'Nozzle:' }),
    select(nozzles, state.nozzleId, v => { state.nozzleId = v; updatePreview(); }),
    el('span', { text: 'Pressure:' }),
    (function () {
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
    })()
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
        el('h3', { text: 'Foam Options' }),
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
        el('h3', { text: 'Sprinkler Options' }),
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
        el('h3', { text: 'Standpipe Options' }),
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

  const wyeToggleRow = el('div', { class: 'pe-row' },
    el('h3', { text: 'Wye / Branch Builder' }),
    el('span', { text: 'Add Wye:' }),
    (function () {
      const noBtn = el('button', {
        text: 'No',
        onclick: (e) => {
          e.preventDefault();
          state.hasWye = false;
          renderWyeContent();
          updatePreview();
        }
      });
      const yesBtn = el('button', {
        text: 'Yes',
        onclick: (e) => {
          e.preventDefault();
          state.hasWye = true;
          renderWyeContent();
          updatePreview();
        }
      });
      function refresh() {
        noBtn.classList.toggle('pe-toggle-on', !state.hasWye);
        yesBtn.classList.toggle('pe-toggle-on', state.hasWye);
      }
      refresh();
      const group = el('span', { class: 'pe-toggle-group' }, noBtn, yesBtn);
      // re-run when state changes:
      const origRender = renderWyeContent;
      renderWyeContent = function () {
        origRender();
        refresh();
      };
      return group;
    })()
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

  const masterToggleRow = el('div', { class: 'pe-row' },
    el('h3', { text: 'Master Stream Builder' }),
    el('span', { text: 'Add Master Stream:' }),
    (function () {
      const noBtn = el('button', {
        text: 'No',
        onclick: (e) => {
          e.preventDefault();
          state.hasMaster = false;
          renderMasterContent();
          updatePreview();
        }
      });
      const yesBtn = el('button', {
        text: 'Yes',
        onclick: (e) => {
          e.preventDefault();
          state.hasMaster = true;
          renderMasterContent();
          updatePreview();
        }
      });
      function refresh() {
        noBtn.classList.toggle('pe-toggle-on', !state.hasMaster);
        yesBtn.classList.toggle('pe-toggle-on', state.hasMaster);
      }
      refresh();
      const group = el('span', { class: 'pe-toggle-group' }, noBtn, yesBtn);
      const origRender = renderMasterContent;
      renderMasterContent = function () {
        origRender();
        refresh();
      };
      return group;
    })()
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

  // Preview & actions
  const previewBar = el('div', { class: 'pe-preview' });

  function updatePreview() {
    const { gpm, pp } = calculatePPandGPM(state);
    previewBar.textContent = `Preview – GPM: ${gpm}   |   PDP: ${pp} psi`;
  }

  const actionsRow = el('div', { class: 'pe-actions' },
    el('button', {
      class: 'pe-save',
      text: 'Save preset',
      onclick: (e) => {
        e.preventDefault();
        onSave(deepClone(state));
      }
    }),
    el('button', {
      class: 'pe-cancel',
      text: 'Cancel',
      onclick: (e) => {
        e.preventDefault();
        onCancel();
      }
    })
  );

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
    previewBar,
    actionsRow
  );

  mountEl.innerHTML = '';
  mountEl.appendChild(container);
}
