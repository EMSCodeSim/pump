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

  // department line defaults (for line 1/2/3)
  lineDefaults: {
    1: null,
    2: null,
    3: null,
  },
};

// Default department storage shape (for safety)
const STORAGE_DEPT_DEFAULT = {
  nozzles: [],
  customNozzles: [],
  hoses: [],
  customHoses: [],
  accessories: [],
  customAccessories: [],
};

// ========== Public wiring ==========

export function setupPresets({
  isApp,
  triggerButtonId,
  appStoreUrl,
  playStoreUrl,
  getLineState,
  applyPresetToCalc,
}) {
  state.isApp = !!isApp;
  state.triggerButtonId = triggerButtonId || 'presetsBtn';
  state.appStoreUrl = appStoreUrl || '';
  state.playStoreUrl = playStoreUrl || '';
  state.getLineState = getLineState || null;
  state.applyPresetToCalc = applyPresetToCalc || null;

  // load from storage
  state.presets = loadPresetsFromStorage();
  const dept = loadDeptFromStorage();
  state.deptNozzles = dept.nozzles || [];
  state.customNozzles = dept.customNozzles || [];
  state.deptHoses = dept.hoses || [];
  state.customHoses = dept.customHoses || [];
  state.deptAccessories = dept.accessories || [];
  state.customAccessories = dept.customAccessories || [];
  state.lineDefaults = loadLineDefaultsFromStorage();

  // wire up button
  const btn = document.getElementById(state.triggerButtonId);
  if (btn) {
    btn.addEventListener('click', () => {
      openPresetMainMenu();
    });
  }
}

// Small helper to open from other views if needed
export function openPresetMainMenuFromOutside() {
  openPresetMainMenu();
}

// ========== Storage helpers ==========

function loadPresetsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.warn('Presets load failed', e);
    return [];
  }
}

function savePresetsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.presets || []));
  } catch (e) {
    console.warn('Presets save failed', e);
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
    if (!raw) return { 1: null, 2: null, 3: null };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { 1: null, 2: null, 3: null };
    return {
      1: parsed['1'] || null,
      2: parsed['2'] || null,
      3: parsed['3'] || null,
    };
  } catch (e) {
    console.warn('Line defaults load failed', e);
    return { 1: null, 2: null, 3: null };
  }
}

function saveLineDefaultsToStorage() {
  try {
    const payload = {
      1: state.lineDefaults[1] || null,
      2: state.lineDefaults[2] || null,
      3: state.lineDefaults[3] || null,
    };
    localStorage.setItem(STORAGE_LINE_DEFAULTS_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Line defaults save failed', e);
  }
}

// ========== DOM helpers ==========

function createOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'preset-overlay';
  overlay.innerHTML = `
    <div class="preset-backdrop"></div>
    <div class="preset-panel">
      <div class="preset-panel-inner"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function closeOverlay(overlay) {
  if (!overlay) return;
  overlay.remove();
}

function clearPanel(panelInner) {
  while (panelInner.firstChild) {
    panelInner.removeChild(panelInner.firstChild);
  }
}

// Ensure styles
function injectPresetStyles() {
  if (document.getElementById('preset-styles')) return;
  const style = document.createElement('style');
  style.id = 'preset-styles';
  style.textContent = `
  .preset-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
  }
  .preset-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(4px);
  }
  .preset-panel {
    position: relative;
    z-index: 1;
    max-width: 480px;
    width: 100%;
    margin: 40px auto;
    padding: 0 12px;
    box-sizing: border-box;
  }
  .preset-panel-inner {
    background: #020617;
    color: #e5e7eb;
    border-radius: 16px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    box-shadow: 0 20px 40px rgba(15, 23, 42, 0.9);
    padding: 10px 12px 12px;
    max-height: calc(100vh - 80px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 0.9rem;
  }
  .preset-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
    padding-bottom: 4px;
  }
  .preset-header h2 {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0;
  }
  .preset-close-btn {
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.7);
    background: #020617;
    color: #e5e7eb;
    width: 26px;
    height: 26px;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .preset-body {
    flex: 1;
    overflow-y: auto;
    padding-right: 4px;
  }
  .preset-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }
  .preset-section {
    margin-bottom: 10px;
  }
  .preset-section h3 {
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #bfdbfe;
    margin: 0 0 4px 0;
  }
  .preset-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.6);
    background: #020617;
    color: #e5e7eb;
    padding: 6px 10px;
    font-size: 0.8rem;
    cursor: pointer;
    gap: 6px;
  }
  .preset-btn-primary {
    border-color: transparent;
    background: linear-gradient(135deg, #22c55e, #38bdf8);
    color: #020617;
    font-weight: 600;
  }
  .preset-btn-danger {
    border-color: rgba(248, 113, 113, 0.8);
    color: #fecaca;
  }
  .preset-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .preset-list-item {
    border-radius: 10px;
    border: 1px solid rgba(30, 64, 175, 0.65);
    padding: 6px 8px;
    margin-bottom: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: radial-gradient(circle at 0 0, #0f172a, #020617);
  }
  .preset-list-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;
  }
  .preset-list-item-name {
    font-weight: 600;
    font-size: 0.85rem;
  }
  .preset-list-item-line {
    font-size: 0.75rem;
    opacity: 0.85;
  }
  .preset-list-item-summary {
    font-size: 0.75rem;
    opacity: 0.9;
  }
  .preset-list-item-actions {
    display: flex;
    gap: 4px;
    margin-top: 4px;
    flex-wrap: wrap;
  }
  .preset-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .preset-chip {
    border-radius: 999px;
    padding: 2px 6px;
    font-size: 0.7rem;
    border: 1px solid rgba(148, 163, 184, 0.6);
    color: #e5e7eb;
  }
  .preset-chip-tag {
    border-color: rgba(45, 212, 191, 0.7);
    color: #a5f3fc;
  }
  .preset-text-sm {
    font-size: 0.8rem;
  }
  .preset-text-xs {
    font-size: 0.72rem;
  }
  .preset-flex-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .preset-label {
    display: block;
    font-size: 0.8rem;
    margin-bottom: 2px;
  }
  .preset-input,
  .preset-select {
    width: 100%;
    box-sizing: border-box;
    padding: 4px 6px;
    border-radius: 8px;
    border: 1px solid rgba(55, 65, 81, 0.9);
    background: #020617;
    color: #e5e7eb;
    font-size: 0.8rem;
  }
  .preset-row {
    margin-bottom: 6px;
  }
  .preset-row-inline {
    display: flex;
    gap: 6px;
  }
  .preset-row-inline > * {
    flex: 1 1 0;
  }
  .preset-subtext {
    font-size: 0.72rem;
    opacity: 0.8;
    margin-top: 2px;
  }
  .preset-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: 999px;
    padding: 2px 6px;
    font-size: 0.72rem;
    background: rgba(15, 23, 42, 0.9);
    border: 1px solid rgba(148, 163, 184, 0.7);
  }
  .preset-pill-label {
    opacity: 0.9;
  }
  .preset-pill-value {
    opacity: 1;
    font-weight: 600;
  }
  `;
  document.head.appendChild(style);
}

// ========== Main menu ==========

function openPresetMainMenu() {
  injectPresetStyles();
  const overlay = createOverlay();
  const panelInner = overlay.querySelector('.preset-panel-inner');
  clearPanel(panelInner);

  const header = document.createElement('div');
  header.className = 'preset-header';
  const title = document.createElement('h2');
  title.textContent = 'Presets & department setup';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'preset-close-btn';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => closeOverlay(overlay));
  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'preset-body';

  const footer = document.createElement('div');
  footer.className = 'preset-footer';

  // Section: Department setup
  const deptSection = document.createElement('div');
  deptSection.className = 'preset-section';
  const deptTitle = document.createElement('h3');
  deptTitle.textContent = 'Department setup';
  const deptDesc = document.createElement('div');
  deptDesc.className = 'preset-text-xs';
  deptDesc.textContent = 'Define hoses, nozzles, and accessories used in your department.';
  const deptBtnRow = document.createElement('div');
  deptBtnRow.className = 'preset-flex-row';

  const deptBtn = document.createElement('button');
  deptBtn.className = 'preset-btn';
  deptBtn.innerHTML = '✎ Edit department setup';
  deptBtn.addEventListener('click', () => {
    openDepartmentSetupModal(overlay);
  });

  deptBtnRow.appendChild(deptBtn);
  deptSection.appendChild(deptTitle);
  deptSection.appendChild(deptDesc);
  deptSection.appendChild(deptBtnRow);

  // Section: Line defaults (Line 1 / 2 / 3)
  const lineSection = document.createElement('div');
  lineSection.className = 'preset-section';
  const lineTitle = document.createElement('h3');
  lineTitle.textContent = 'Line defaults (1 / 2 / 3)';

  const lineDesc = document.createElement('div');
  lineDesc.className = 'preset-text-xs';
  lineDesc.textContent = 'Set the default hose/nozzle/accessory for Line 1, 2, and 3. These load when the app opens.';

  const lineRow = document.createElement('div');
  lineRow.className = 'preset-flex-row';

  [1, 2, 3].forEach((lineNumber) => {
    const pill = document.createElement('button');
    pill.className = 'preset-pill';
    pill.style.minWidth = '90px';
    pill.addEventListener('click', () => {
      openLineDefaultEditor(overlay, lineNumber);
    });

    const labelSpan = document.createElement('span');
    labelSpan.className = 'preset-pill-label';
    labelSpan.textContent = `Line ${lineNumber}`;

    const valueSpan = document.createElement('span');
    valueSpan.className = 'preset-pill-value';

    const def = state.lineDefaults[lineNumber];
    if (def && def.name) {
      valueSpan.textContent = def.name;
    } else {
      valueSpan.textContent = 'Not set';
      valueSpan.style.opacity = '0.7';
    }

    pill.appendChild(labelSpan);
    pill.appendChild(valueSpan);
    lineRow.appendChild(pill);
  });

  lineSection.appendChild(lineTitle);
  lineSection.appendChild(lineDesc);
  lineSection.appendChild(lineRow);

  // Section: Saved presets
  const presetsSection = document.createElement('div');
  presetsSection.className = 'preset-section';
  const presetsTitle = document.createElement('h3');
  presetsTitle.textContent = 'Saved presets';

  const presetsDesc = document.createElement('div');
  presetsDesc.className = 'preset-text-xs';
  presetsDesc.textContent = 'Quick-load lines with preconfigured hose, nozzle, and appliances.';

  const presetsList = document.createElement('ul');
  presetsList.className = 'preset-list';

  if (!state.presets || state.presets.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'preset-text-xs';
    empty.textContent = 'No presets saved yet. Use "Add preset" to capture a line setup.';
    presetsSection.appendChild(presetsTitle);
    presetsSection.appendChild(presetsDesc);
    presetsSection.appendChild(empty);
  } else {
    state.presets.forEach((preset) => {
      const li = document.createElement('li');
      li.className = 'preset-list-item';

      const headerRow = document.createElement('div');
      headerRow.className = 'preset-list-item-header';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'preset-list-item-name';
      nameDiv.textContent = preset.name || 'Unnamed preset';

      const lineDiv = document.createElement('div');
      lineDiv.className = 'preset-list-item-line';
      lineDiv.textContent = preset.lineNumber ? `Line ${preset.lineNumber}` : 'Line: current calc';

      headerRow.appendChild(nameDiv);
      headerRow.appendChild(lineDiv);

      const summaryDiv = document.createElement('div');
      summaryDiv.className = 'preset-list-item-summary';
      summaryDiv.textContent = preset.summary || '(no summary stored)';

      const actionsRow = document.createElement('div');
      actionsRow.className = 'preset-list-item-actions';

      const applyBtn = document.createElement('button');
      applyBtn.className = 'preset-btn preset-btn-primary';
      applyBtn.textContent = 'Apply to calc';
      applyBtn.addEventListener('click', () => {
        if (!state.applyPresetToCalc) {
          alert('Preset system not fully wired yet (applyPresetToCalc missing).');
          return;
        }
        state.applyPresetToCalc(preset);
        closeOverlay(overlay);
      });

      const renameBtn = document.createElement('button');
      renameBtn.className = 'preset-btn';
      renameBtn.textContent = 'Rename';
      renameBtn.addEventListener('click', () => {
        const newName = prompt('New preset name:', preset.name || '');
        if (!newName) return;
        preset.name = newName;
        savePresetsToStorage();
        openPresetMainMenu(); // re-render
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'preset-btn preset-btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        if (!confirm('Delete this preset?')) return;
        state.presets = state.presets.filter((p) => p !== preset);
        savePresetsToStorage();
        openPresetMainMenu(); // re-render
      });

      actionsRow.appendChild(applyBtn);
      actionsRow.appendChild(renameBtn);
      actionsRow.appendChild(deleteBtn);

      li.appendChild(headerRow);
      li.appendChild(summaryDiv);
      li.appendChild(actionsRow);

      presetsList.appendChild(li);
    });

    presetsSection.appendChild(presetsTitle);
    presetsSection.appendChild(presetsDesc);
    presetsSection.appendChild(presetsList);
  }

  // Footer buttons
  const addPresetBtn = document.createElement('button');
  addPresetBtn.className = 'preset-btn preset-btn-primary';
  addPresetBtn.textContent = 'Add preset from current calc';
  addPresetBtn.addEventListener('click', () => {
    handleAddPresetClick();
  });

  const closeFooterBtn = document.createElement('button');
  closeFooterBtn.className = 'preset-btn';
  closeFooterBtn.textContent = 'Close';
  closeFooterBtn.addEventListener('click', () => {
    closeOverlay(overlay);
  });

  footer.appendChild(addPresetBtn);
  footer.appendChild(closeFooterBtn);

  body.appendChild(deptSection);
  body.appendChild(lineSection);
  body.appendChild(presetsSection);

  panelInner.appendChild(header);
  panelInner.appendChild(body);
  panelInner.appendChild(footer);
}

// ========== Department setup modal ==========

function openDepartmentSetupModal(parentOverlay) {
  injectPresetStyles();
  const overlay = createOverlay();
  const panelInner = overlay.querySelector('.preset-panel-inner');
  clearPanel(panelInner);

  const header = document.createElement('div');
  header.className = 'preset-header';
  const title = document.createElement('h2');
  title.textContent = 'Department setup';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'preset-close-btn';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => closeOverlay(overlay));
  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'preset-body';

  const footer = document.createElement('div');
  footer.className = 'preset-footer';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'preset-btn preset-btn-primary';
  saveBtn.textContent = 'Save department setup';
  saveBtn.addEventListener('click', () => {
    saveDeptToStorage();
    closeOverlay(overlay);
    if (parentOverlay) {
      openPresetMainMenu(); // re-open main preset menu
    }
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'preset-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    closeOverlay(overlay);
  });

  footer.appendChild(saveBtn);
  footer.appendChild(cancelBtn);

  // Build editable sections for nozzles, hoses, accessories
  const nozzleSection = buildNozzleSection();
  const hoseSection = buildHoseSection();
  const accessorySection = buildAccessorySection();

  body.appendChild(nozzleSection);
  body.appendChild(hoseSection);
  body.appendChild(accessorySection);

  panelInner.appendChild(header);
  panelInner.appendChild(body);
  panelInner.appendChild(footer);
}

// ... [keeping all your existing nozzle/hose/accessory editors, helpers, etc. unchanged] ...

// (Skipping forward to the line default editor and add preset logic)

// ========== Line default editor ==========

function openLineDefaultEditor(parentOverlay, lineNumber) {
  injectPresetStyles();
  const overlay = createOverlay();
  const panelInner = overlay.querySelector('.preset-panel-inner');
  clearPanel(panelInner);

  const header = document.createElement('div');
  header.className = 'preset-header';
  const title = document.createElement('h2');
  title.textContent = `Line ${lineNumber} default setup`;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'preset-close-btn';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => closeOverlay(overlay));
  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'preset-body';

  const footer = document.createElement('div');
  footer.className = 'preset-footer';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'preset-btn preset-btn-primary';
  saveBtn.textContent = 'Save default';
  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim() || `Line ${lineNumber} default`;
    const hoseId = hoseSelect.value || null;
    const nozzleId = nozzleSelect.value || null;
    const accessoryIds = Array.from(accessorySelect.selectedOptions).map((opt) => opt.value);

    state.lineDefaults[lineNumber] = {
      name,
      hoseId,
      nozzleId,
      accessoryIds,
    };
    saveLineDefaultsToStorage();
    closeOverlay(overlay);
    if (parentOverlay) {
      openPresetMainMenu(); // re-open main menu to show updated label
    }
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'preset-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => closeOverlay(overlay));

  footer.appendChild(saveBtn);
  footer.appendChild(cancelBtn);

  // Build form
  const form = document.createElement('div');

  const nameRow = document.createElement('div');
  nameRow.className = 'preset-row';
  const nameLabel = document.createElement('label');
  nameLabel.className = 'preset-label';
  nameLabel.textContent = 'Label (how this default is shown):';
  const nameInput = document.createElement('input');
  nameInput.className = 'preset-input';
  nameInput.type = 'text';

  const existing = state.lineDefaults[lineNumber];
  if (existing && existing.name) {
    nameInput.value = existing.name;
  } else {
    nameInput.value = `Line ${lineNumber} default`;
  }

  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);
  form.appendChild(nameRow);

  // Hose select
  const hoseRow = document.createElement('div');
  hoseRow.className = 'preset-row';
  const hoseLabel = document.createElement('label');
  hoseLabel.className = 'preset-label';
  hoseLabel.textContent = 'Hose:';
  const hoseSelect = document.createElement('select');
  hoseSelect.className = 'preset-select';

  const hoseDefaultOpt = document.createElement('option');
  hoseDefaultOpt.value = '';
  hoseDefaultOpt.textContent = 'Leave hose as-is';
  hoseSelect.appendChild(hoseDefaultOpt);

  state.deptHoses.forEach((hose) => {
    const opt = document.createElement('option');
    opt.value = hose.id;
    opt.textContent = hose.name || hose.label || hose.id;
    hoseSelect.appendChild(opt);
  });
  state.customHoses.forEach((hose) => {
    const opt = document.createElement('option');
    opt.value = hose.id;
    opt.textContent = hose.name || hose.label || hose.id;
    hoseSelect.appendChild(opt);
  });

  if (existing && existing.hoseId) {
    hoseSelect.value = existing.hoseId;
  }

  hoseRow.appendChild(hoseLabel);
  hoseRow.appendChild(hoseSelect);
  form.appendChild(hoseRow);

  // Nozzle select
  const nozzleRow = document.createElement('div');
  nozzleRow.className = 'preset-row';
  const nozzleLabel = document.createElement('label');
  nozzleLabel.className = 'preset-label';
  nozzleLabel.textContent = 'Nozzle:';
  const nozzleSelect = document.createElement('select');
  nozzleSelect.className = 'preset-select';

  const nozzleDefaultOpt = document.createElement('option');
  nozzleDefaultOpt.value = '';
  nozzleDefaultOpt.textContent = 'Leave nozzle as-is';
  nozzleSelect.appendChild(nozzleDefaultOpt);

  state.deptNozzles.forEach((noz) => {
    const opt = document.createElement('option');
    opt.value = noz.id;
    opt.textContent = noz.name || noz.label || noz.id;
    nozzleSelect.appendChild(opt);
  });
  state.customNozzles.forEach((noz) => {
    const opt = document.createElement('option');
    opt.value = noz.id;
    opt.textContent = noz.name || noz.label || noz.id;
    nozzleSelect.appendChild(opt);
  });

  if (existing && existing.nozzleId) {
    nozzleSelect.value = existing.nozzleId;
  }

  nozzleRow.appendChild(nozzleLabel);
  nozzleRow.appendChild(nozzleSelect);
  form.appendChild(nozzleRow);

  // Accessories multi-select
  const accRow = document.createElement('div');
  accRow.className = 'preset-row';
  const accLabel = document.createElement('label');
  accLabel.className = 'preset-label';
  accLabel.textContent = 'Accessories:';
  const accessorySelect = document.createElement('select');
  accessorySelect.className = 'preset-select';
  accessorySelect.multiple = true;
  accessorySelect.size = 4;

  const existingAccIds = (existing && existing.accessoryIds) || [];

  [...state.deptAccessories, ...state.customAccessories].forEach((acc) => {
    const opt = document.createElement('option');
    opt.value = acc.id;
    opt.textContent = acc.name || acc.label || acc.id;
    if (existingAccIds.includes(acc.id)) {
      opt.selected = true;
    }
    accessorySelect.appendChild(opt);
  });

  accRow.appendChild(accLabel);
  accRow.appendChild(accessorySelect);
  form.appendChild(accRow);

  body.appendChild(form);
  panelInner.appendChild(header);
  panelInner.appendChild(body);
  panelInner.appendChild(footer);
}

// ========== Add preset from current calc (REWIRED) ==========

function handleAddPresetClick() {
  // Use department equipment from storage to drive the preset editor builders
  const dept = loadDeptFromStorage() || {};

  openPresetEditorPopup({
    dept,
    initialPreset: null,
    onSave(presetConfig) {
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

      // Re-open or refresh the main preset menu view if available
      if (typeof openPresetMainMenu === 'function') {
        openPresetMainMenu();
      }
    }
  });
}

// Simple info panel for web-only mode (currently forwards to main menu)
function openPresetInfoPanelWeb() {
  openPresetMainMenu();
}

// Export legacy name for web
export function openPresetInfo() {
  openPresetInfoPanelWeb();
}
