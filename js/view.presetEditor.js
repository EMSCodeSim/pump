// view.presetEditor.js
// Preset editor popup: choose line type & launch dedicated builders.
// - Name is required before any type can be selected.
// - Types: standard, master, standpipe, sprinkler, foam, supply, custom.

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

  .preset-line-body {
    font-size: 0.85rem;
    line-height: 1.45;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .preset-line-footer {
    display: flex;
    flex-direction: row;
    gap: 6px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }

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

  .preset-editor {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .preset-editor section.pe-section {
    border-top: 1px solid rgba(148, 163, 184, 0.4);
    padding-top: 8px;
  }
  .preset-editor section.pe-section:first-of-type {
    border-top: none;
  }

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

  .preset-editor input[type="text"] {
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

  .pe-hint {
    font-size: 0.75rem;
    opacity: 0.8;
  }

  @media (min-width: 640px) {
    .pe-row {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }

    .pe-row > label {
      min-width: 100px;
    }

    .preset-editor input[type="text"] {
      width: auto;
      min-width: 200px;
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

// ---------- Public: open as popup ----------

export function openPresetEditorPopup({
  dept = {},
  initialPreset = null,
  onSave = () => {},
  onCancel = () => {},
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

  function close(cancelled) {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (cancelled && typeof onCancel === 'function') onCancel();
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close(true);
  });
  closeBtn.addEventListener('click', () => close(true));
  cancelBtn.addEventListener('click', () => close(true));

  renderPresetEditor(body, {
    dept,
    initialPreset,
    onSave(presetConfig) {
      onSave(presetConfig);
      close(false);
    },
    saveButton: saveBtn,
  });
}

// ---------- Core renderer ----------

export function renderPresetEditor(
  mountEl,
  { dept = {}, initialPreset = null, onSave = () => {}, saveButton = null } = {}
) {
  injectPresetEditorStyles();

  const hoses      = dept.hoses      || [];
  const nozzles    = dept.nozzles    || [];
  const appliances = dept.appliances || [];

  const defaults = {
    name: '',
    lineType: '',
    standardConfig:   null,
    masterConfig:     null,
    standpipeConfig:  null,
    sprinklerConfig:  null,
    foamConfig:       null,
    supplyConfig:     null,
    customConfig:     null,
  };

  const state = deepClone(defaults);
  if (initialPreset && typeof initialPreset === 'object') {
    Object.assign(state, initialPreset);
  }

  function el(tag, opts = {}, ...children) {
    const e = document.createElement(tag);
    if (opts.class) e.className = opts.class;
    if (opts.text) e.textContent = opts.text;
    if (opts.type) e.type = opts.type;
    if (opts.value != null) e.value = opts.value;
    if (opts.placeholder) e.placeholder = opts.placeholder;
    if (opts.for) e.htmlFor = opts.for;
    if (opts.disabled != null) e.disabled = !!opts.disabled;
    if (opts.title) e.title = opts.title;
    if (opts.onchange) e.addEventListener('change', opts.onchange);
    if (opts.onclick) e.addEventListener('click', opts.onclick);
    children.forEach((c) => e.append(c));
    return e;
  }

  const previewBar = el('div', { class: 'pe-preview' });

  function updatePreview() {
    if (!state.name.trim()) {
      previewBar.textContent = 'Enter a preset name to begin.';
      return;
    }
    if (!state.lineType) {
      previewBar.textContent = `Preset: "${state.name}" – select a build type to open its editor.`;
      return;
    }
    previewBar.textContent = `Preset: "${state.name}"   •   Type: ${state.lineType} (tap type to reopen editor)`;
  }

  const nameInput = el('input', {
    type: 'text',
    value: state.name || '',
    placeholder: 'Example: 1¾" attack 200\' 150 gpm',
    onchange: (e) => {
      state.name = e.target.value || '';
      updateTypeButtons();
      updatePreview();
    },
  });

  const nameRow = el(
    'div',
    { class: 'pe-row' },
    el('label', { text: 'Preset name:' }),
    nameInput
  );

  const typeButtons = [];

  function makeTypeButton(id, label, sublabel) {
    const btn = el(
      'button',
      {
        class: 'pe-type-btn',
        onclick: (e) => {
          e.preventDefault();
          if (!state.name.trim()) {
            alert('Enter a preset name first.');
            return;
          }
          setLineType(id, true);
        },
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
      },
    });
  }

  function openMasterConfig() {
    openMasterStreamPopup({
      dept: { hoses, appliances },
      initial: state.masterConfig || null,
      onSave(config) {
        state.masterConfig = config;
        updatePreview();
      },
    });
  }

  function openStandpipeConfig() {
    openStandpipePopup({
      dept: { hoses, nozzles },
      initial: state.standpipeConfig || null,
      onSave(config) {
        state.standpipeConfig = config;
        updatePreview();
      },
    });
  }

  function openSprinklerConfig() {
    openSprinklerPopup({
      dept: { hoses },
      initial: state.sprinklerConfig || null,
      onSave(config) {
        state.sprinklerConfig = config;
        updatePreview();
      },
    });
  }

  function openFoamConfig() {
    openFoamPopup({
      dept: { nozzles },
      initial: state.foamConfig || null,
      onSave(config) {
        state.foamConfig = config;
        updatePreview();
      },
    });
  }

  function openSupplyConfig() {
    openSupplyLinePopup({
      dept: { hoses },
      initial: state.supplyConfig || null,
      onSave(config) {
        state.supplyConfig = config;
        updatePreview();
      },
    });
  }

  function openCustomConfig() {
    openCustomBuilderPopup({
      dept: { hoses, appliances },
      initial: state.customConfig || null,
      onSave(config) {
        state.customConfig = config;
        updatePreview();
      },
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

  const typeSection = el(
    'section',
    { class: 'pe-section pe-type-section' },
    el('h3', { text: 'Choose build type' }),
    (function () {
      const grid = el(
        'div',
        { class: 'pe-type-grid' },
        makeTypeButton('standard',  'Standard line',  'Attack line (wye optional)'),
        makeTypeButton('master',    'Master stream',  'Deck gun or portable base'),
        makeTypeButton('standpipe', 'Standpipe',      'High-rise / FDC standpipe'),
        makeTypeButton('sprinkler', 'Sprinkler',      'Sprinkler / FDC supply'),
        makeTypeButton('foam',      'Foam line',      'Foam eductor / foam setup'),
        makeTypeButton('supply',    'Supply line',    'Hydrant / relay / feed line'),
        makeTypeButton('custom',    'Custom builder', 'Any layout: wyes, siamese, etc.')
      );
      return grid;
    })(),
    el('div', {
      class: 'pe-hint',
      text: 'Enter a preset name first, then tap a type to open its builder. Tap again later to reopen and edit.',
    })
  );

  const container = el('div', { class: 'preset-editor' });
  container.append(nameRow, typeSection, previewBar);

  mountEl.innerHTML = '';
  mountEl.appendChild(container);

  updateTypeButtons();
  updatePreview();

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
}
