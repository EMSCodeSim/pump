import { openPresetEditorPopup } from './view.presetEditor.js';
import { openStandardLinePopup }   from './view.lineStandard.js';
import { openMasterStreamPopup }   from './view.lineMaster.js';
import { openStandpipePopup }      from './view.lineStandpipe.js';
import { openSprinklerPopup }      from './view.lineSprinkler.js';
import { openFoamPopup }           from './view.lineFoam.js';
import { openSupplyLinePopup }     from './view.lineSupply.js';
import { openCustomBuilderPopup }  from './view.lineCustom.js';
import { setDeptLineDefault, NOZ } from './store.js';
// preset.js – Department presets + line presets for FireOps Calc
// - Main Presets menu from the Preset button
//   • Department Setup
//   • Line 1 / Line 2 / Line 3 quick views (editable)
//   • Saved presets list
//   • "Add preset" button
// - Department setup popup (Nozzles, Hoses, Accessories)
// - Grouped nozzle selection (smooth / fog / master / specialty + custom)
// - Hose selection (attack / supply / wildland / etc.)

const STORAGE_PRESETS_KEY = 'fireops_presets_v1';
const STORAGE_LINE_DEFAULTS_KEY = 'fireops_line_defaults_v1';
const STORAGE_DEPT_EQ = 'fireops_dept_equipment_v1';

// Global mutable state for this module
const state = {
  isApp: false,
  triggerButtonId: 'presetsBtn',
  appStoreUrl: '',
  playStoreUrl: '',
  presets: [],
  lineDefaults: {},
  deptNozzles: [],
  customNozzles: [],
  deptHoses: [],
  customHoses: [],
  deptAccessories: [],
  customAccessories: [],
  getLineState: null,
  applyPresetToCalc: null
};

// Utility to safely read JSON from localStorage
function safeReadJSON(key, fallback) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (e) {
    console.warn('safeReadJSON failed for key', key, e);
    return fallback;
  }
}

// Utility to safely write JSON to localStorage
function safeWriteJSON(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('safeWriteJSON failed for key', key, e);
  }
}

// ===============================================
// Load / save: Presets + Line Defaults + Dept Eq
// ===============================================

function loadPresetsFromStorage() {
  const data = safeReadJSON(STORAGE_PRESETS_KEY, []);
  if (!Array.isArray(data)) return [];
  return data;
}

function savePresetsToStorage(list) {
  if (!Array.isArray(list)) return;
  safeWriteJSON(STORAGE_PRESETS_KEY, list);
}

function loadLineDefaultsFromStorage() {
  const data = safeReadJSON(STORAGE_LINE_DEFAULTS_KEY, {});
  if (!data || typeof data !== 'object') return {};
  return data;
}

function saveLineDefaultsToStorage(obj) {
  if (!obj || typeof obj !== 'object') return;
  safeWriteJSON(STORAGE_LINE_DEFAULTS_KEY, obj);
}

// Department equipment is stored in a single object under STORAGE_DEPT_EQ
// {
//   nozzles: [...],
//   customNozzles: [...],
//   hoses: [...],
//   customHoses: [...],
//   accessories: [...],
//   customAccessories: [...],
// }
function loadDeptFromStorage() {
  const data = safeReadJSON(STORAGE_DEPT_EQ, {});
  if (!data || typeof data !== 'object') {
    return {
      nozzles: [],
      customNozzles: [],
      hoses: [],
      customHoses: [],
      accessories: [],
      customAccessories: []
    };
  }

  const {
    nozzles = [],
    customNozzles = [],
    hoses = [],
    customHoses = [],
    accessories = [],
    customAccessories = []
  } = data;

  return {
    nozzles: Array.isArray(nozzles) ? nozzles : [],
    customNozzles: Array.isArray(customNozzles) ? customNozzles : [],
    hoses: Array.isArray(hoses) ? hoses : [],
    customHoses: Array.isArray(customHoses) ? customHoses : [],
    accessories: Array.isArray(accessories) ? accessories : [],
    customAccessories: Array.isArray(customAccessories) ? customAccessories : []
  };
}

function saveDeptToStorage(dept) {
  if (!dept || typeof dept !== 'object') return;
  const payload = {
    nozzles: Array.isArray(dept.nozzles) ? dept.nozzles : [],
    customNozzles: Array.isArray(dept.customNozzles) ? dept.customNozzles : [],
    hoses: Array.isArray(dept.hoses) ? dept.hoses : [],
    customHoses: Array.isArray(dept.customHoses) ? dept.customHoses : [],
    accessories: Array.isArray(dept.accessories) ? dept.accessories : [],
    customAccessories: Array.isArray(dept.customAccessories) ? dept.customAccessories : []
  };
  safeWriteJSON(STORAGE_DEPT_EQ, payload);
}

// ==========================================================
// Presets Panel (top-level menu opened by Presets button)
// ==========================================================

function openPresetPanelApp() {
  const existing = document.getElementById('presetsOverlay');
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'presetsOverlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.45)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  const panel = document.createElement('div');
  panel.style.background = '#111';
  panel.style.color = '#fff';
  panel.style.borderRadius = '12px';
  panel.style.border = '1px solid rgba(255,255,255,0.15)';
  panel.style.boxShadow = '0 12px 40px rgba(0,0,0,0.6)';
  panel.style.maxWidth = '420px';
  panel.style.width = '90%';
  panel.style.padding = '16px';
  panel.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  panel.style.maxHeight = '90vh';
  panel.style.overflowY = 'auto';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.marginBottom = '12px';

  const title = document.createElement('div');
  title.textContent = 'Presets & Department Setup';
  title.style.fontSize = '18px';
  title.style.fontWeight = '600';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.color = '#fff';
  closeBtn.style.fontSize = '18px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.addEventListener('click', () => overlay.remove());

  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const section = document.createElement('div');
  section.style.display = 'flex';
  section.style.flexDirection = 'column';
  section.style.gap = '8px';

  function makeButton(label, description, onClick) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '2px';
    wrapper.style.padding = '8px 10px';
    wrapper.style.borderRadius = '8px';
    wrapper.style.background = 'rgba(255,255,255,0.03)';
    wrapper.style.border = '1px solid rgba(255,255,255,0.08)';
    wrapper.style.cursor = 'pointer';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';

    const lbl = document.createElement('div');
    lbl.textContent = label;
    lbl.style.fontSize = '15px';
    lbl.style.fontWeight = '500';

    const chevron = document.createElement('div');
    chevron.textContent = '›';
    chevron.style.opacity = '0.7';

    row.appendChild(lbl);
    row.appendChild(chevron);

    const desc = document.createElement('div');
    desc.textContent = description;
    desc.style.fontSize = '12px';
    desc.style.opacity = '0.7';

    wrapper.appendChild(row);
    wrapper.appendChild(desc);

    wrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });

    return wrapper;
  }

  section.appendChild(
    makeButton(
      'Department Setup',
      'Pick your nozzles, hose sizes, and accessories.',
      () => {
        overlay.remove();
        openDeptWizard();
      }
    )
  );

  section.appendChild(
    makeButton(
      'Line 1 / 2 / 3 Defaults',
      'Quick presets for your main three attack lines.',
      () => {
        overlay.remove();
        openStandardLinePopup();
      }
    )
  );

  section.appendChild(
    makeButton(
      'Master Stream Defaults',
      'Deck gun and portable monitor presets.',
      () => {
        overlay.remove();
        openMasterStreamPopup();
      }
    )
  );

  section.appendChild(
    makeButton(
      'Standpipe Defaults',
      'Preconfigured high-rise / standpipe lines.',
      () => {
        overlay.remove();
        openStandpipePopup();
      }
    )
  );

  section.appendChild(
    makeButton(
      'Sprinkler / Foam / Supply / Custom',
      'More advanced presets for special setups.',
      () => {
        overlay.remove();
        openPresetEditorPopup();
      }
    )
  );

  const savedHeader = document.createElement('div');
  savedHeader.textContent = 'Saved Presets';
  savedHeader.style.marginTop = '12px';
  savedHeader.style.fontSize = '14px';
  savedHeader.style.fontWeight = '600';
  savedHeader.style.opacity = '0.8';
  section.appendChild(savedHeader);

  const savedList = document.createElement('div');
  savedList.id = 'presetsList';
  savedList.style.display = 'flex';
  savedList.style.flexDirection = 'column';
  savedList.style.gap = '4px';
  section.appendChild(savedList);

  const addBtn = document.createElement('button');
  addBtn.textContent = '＋ Add preset from current setup';
  addBtn.style.marginTop = '8px';
  addBtn.style.padding = '8px 10px';
  addBtn.style.borderRadius = '999px';
  addBtn.style.border = 'none';
  addBtn.style.background = '#ffbf00';
  addBtn.style.color = '#000';
  addBtn.style.fontSize = '14px';
  addBtn.style.fontWeight = '600';
  addBtn.style.cursor = 'pointer';
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleAddPresetFromCurrent();
  });

  section.appendChild(addBtn);

  panel.appendChild(section);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  renderSavedPresetsList(savedList);
}

function renderSavedPresetsList(container) {
  container.innerHTML = '';
  const presets = state.presets || [];
  if (!Array.isArray(presets) || presets.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'No saved presets yet.';
    empty.style.fontSize = '13px';
    empty.style.opacity = '0.75';
    container.appendChild(empty);
    return;
  }

  presets.forEach((p, index) => {
    if (!p || typeof p !== 'object') return;
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.padding = '6px 8px';
    row.style.borderRadius = '6px';
    row.style.background = 'rgba(255,255,255,0.03)';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.flexDirection = 'column';
    left.style.gap = '2px';

    const nameEl = document.createElement('div');
    nameEl.textContent = p.name || `Preset ${index + 1}`;
    nameEl.style.fontSize = '14px';
    nameEl.style.fontWeight = '500';

    const metaEl = document.createElement('div');
    metaEl.style.fontSize = '11px';
    metaEl.style.opacity = '0.7';
    const where = p.where || 'Main';
    const size = p.size || '';
    const length = p.length || '';
    metaEl.textContent = [where, size ? `${size}"` : '', length ? `${length} ft` : '']
      .filter(Boolean).join(' · ');

    left.appendChild(nameEl);
    left.appendChild(metaEl);

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '6px';

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.style.fontSize = '11px';
    applyBtn.style.padding = '4px 7px';
    applyBtn.style.borderRadius = '999px';
    applyBtn.style.border = 'none';
    applyBtn.style.background = '#2ecc71';
    applyBtn.style.color = '#000';
    applyBtn.style.cursor = 'pointer';
    applyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      applyPreset(index);
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Del';
    delBtn.style.fontSize = '11px';
    delBtn.style.padding = '4px 7px';
    delBtn.style.borderRadius = '999px';
    delBtn.style.border = 'none';
    delBtn.style.background = '#e74c3c';
    delBtn.style.color = '#000';
    delBtn.style.cursor = 'pointer';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePreset(index);
    });

    right.appendChild(applyBtn);
    right.appendChild(delBtn);

    row.appendChild(left);
    row.appendChild(right);

    container.appendChild(row);
  });
}

function handleAddPresetFromCurrent() {
  if (typeof state.getLineState !== 'function') {
    alert('Line state function is not available.');
    return;
  }

  const snapshot = state.getLineState();
  if (!snapshot || typeof snapshot !== 'object') {
    alert('Unable to read current line state.');
    return;
  }

  const name = window.prompt('Preset name?', '');
  if (!name) return;

  const presets = Array.isArray(state.presets) ? state.presets.slice() : [];
  presets.push({
    name,
    where: snapshot.where || 'Main',
    size: snapshot.size,
    length: snapshot.length,
    elev: snapshot.elev,
    wye: snapshot.wye,
    lenA: snapshot.lenA,
    lenB: snapshot.lenB,
    noz: snapshot.noz,
    nozA: snapshot.nozA,
    nozB: snapshot.nozB,
    raw: snapshot
  });

  state.presets = presets;
  savePresetsToStorage(presets);

  const list = document.getElementById('presetsList');
  if (list) {
    renderSavedPresetsList(list);
  }
}

function applyPreset(index) {
  if (typeof state.applyPresetToCalc !== 'function') {
    alert('Apply preset function is not available.');
    return;
  }
  const presets = Array.isArray(state.presets) ? state.presets : [];
  const p = presets[index];
  if (!p) return;
  state.applyPresetToCalc(p.raw);
}

function deletePreset(index) {
  const presets = Array.isArray(state.presets) ? state.presets.slice() : [];
  if (!presets[index]) return;
  presets.splice(index, 1);
  state.presets = presets;
  savePresetsToStorage(presets);

  const list = document.getElementById('presetsList');
  if (list) {
    renderSavedPresetsList(list);
  }
}

// ======================================
// Department Setup: Wizard / Overlays
// ======================================

function openDeptWizard() {
  const existing = document.getElementById('deptSetupOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'deptSetupOverlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.65)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const panel = document.createElement('div');
  panel.style.background = '#111';
  panel.style.color = '#fff';
  panel.style.borderRadius = '12px';
  panel.style.border = '1px solid rgba(255,255,255,0.18)';
  panel.style.boxShadow = '0 16px 50px rgba(0,0,0,0.7)';
  panel.style.maxWidth = '520px';
  panel.style.width = '94%';
  panel.style.maxHeight = '90vh';
  panel.style.overflow = 'hidden';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.padding = '10px 12px';
  header.style.borderBottom = '1px solid rgba(255,255,255,0.14)';

  const title = document.createElement('div');
  title.textContent = 'Department Setup';
  title.style.fontSize = '17px';
  title.style.fontWeight = '600';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.color = '#fff';
  closeBtn.style.fontSize = '18px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.addEventListener('click', () => overlay.remove());

  header.appendChild(title);
  header.appendChild(closeBtn);

  const tabRow = document.createElement('div');
  tabRow.style.display = 'flex';
  tabRow.style.borderBottom = '1px solid rgba(255,255,255,0.12)';

  const tabs = [
    { id: 'nozzles', label: 'Nozzles' },
    { id: 'hoses', label: 'Hoses' },
    { id: 'accessories', label: 'Accessories' }
  ];

  const content = document.createElement('div');
  content.style.flex = '1';
  content.style.overflowY = 'auto';
  content.style.padding = '10px 12px';
  content.id = 'deptSetupContent';

  let activeTabId = 'nozzles';

  function renderTabButtons() {
    tabRow.innerHTML = '';
    tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.textContent = tab.label;
      btn.style.flex = '1';
      btn.style.padding = '8px 0';
      btn.style.border = 'none';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '13px';
      btn.style.fontWeight = '500';
      btn.style.background = (tab.id === activeTabId) ? '#1f1f1f' : '#151515';
      btn.style.color = tab.id === activeTabId ? '#ffbf00' : '#fff';
      btn.addEventListener('click', () => {
        activeTabId = tab.id;
        renderTabButtons();
        renderActiveTab();
      });
      tabRow.appendChild(btn);
    });
  }

  function renderActiveTab() {
    const dept = loadDeptFromStorage();
    if (activeTabId === 'nozzles') {
      renderNozzleSelector(content, dept);
    } else if (activeTabId === 'hoses') {
      renderHoseSelector(content, dept);
    } else if (activeTabId === 'accessories') {
      renderAccessorySelector(content, dept);
    }
  }

  renderTabButtons();
  renderActiveTab();

  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.justifyContent = 'flex-end';
  footer.style.padding = '8px 12px';
  footer.style.borderTop = '1px solid rgba(255,255,255,0.14)';

  const closeFooterBtn = document.createElement('button');
  closeFooterBtn.textContent = 'Close';
  closeFooterBtn.style.padding = '6px 10px';
  closeFooterBtn.style.borderRadius = '8px';
  closeFooterBtn.style.border = 'none';
  closeFooterBtn.style.background = '#444';
  closeFooterBtn.style.color = '#fff';
  closeFooterBtn.style.cursor = 'pointer';
  closeFooterBtn.style.fontSize = '13px';
  closeFooterBtn.addEventListener('click', () => overlay.remove());

  footer.appendChild(closeFooterBtn);

  panel.appendChild(header);
  panel.appendChild(tabRow);
  panel.appendChild(content);
  panel.appendChild(footer);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

// ======================================
// Nozzle Selection
// ======================================

const SMOOTH_BORE_NOZZLES = [
  { id: 'sb78_50',   label: 'Smooth 7/8" @ 50 psi' },
  { id: 'sb1516_50', label: 'Smooth 15/16" @ 50 psi' },
  { id: 'sb1_50',    label: 'Smooth 1" @ 50 psi' },
  { id: 'sb114_50',  label: 'Smooth 1 1/4" @ 50 psi' },
  { id: 'sb138_80',  label: 'Smooth 1 3/8" @ 80 psi' },
  { id: 'sb112_80',  label: 'Smooth 1 1/2" @ 80 psi' },
  { id: 'sb134_80',  label: 'Smooth 1 3/4" @ 80 psi' },
  { id: 'sb2_80',    label: 'Smooth 2" @ 80 psi' }
];

const FOG_NOZZLES = [
  { id: 'fog150_75', label: 'Fog 150 gpm @ 75 psi' },
  { id: 'fog150_50', label: 'Fog 150 gpm @ 50 psi' },
  { id: 'fog175_75', label: 'Fog 175 gpm @ 75 psi' },
  { id: 'fog175_50', label: 'Fog 175 gpm @ 50 psi' },
  { id: 'fog185_75', label: 'Fog 185 gpm @ 75 psi' },
  { id: 'fog185_50', label: 'Fog 185 gpm @ 50 psi' },
  { id: 'fog200_75', label: 'Fog 200 gpm @ 75 psi' },
  { id: 'fog200_50', label: 'Fog 200 gpm @ 50 psi' }
];

const MASTER_STREAM_NOZZLES = [
  { id: 'ms1_3_8_80', label: 'Master 1 3/8" 500 gpm @ 80 psi' },
  { id: 'ms1_1_2_80', label: 'Master 1 1/2" 600 gpm @ 80 psi' },
  { id: 'ms1_3_4_80', label: 'Master 1 3/4" 800 gpm @ 80 psi' },
  { id: 'ms2_80',     label: 'Master 2" 1000 gpm @ 80 psi' },
  { id: 'msfog500',   label: 'Master Fog 500 gpm' },
  { id: 'msfog750',   label: 'Master Fog 750 gpm' },
  { id: 'msfog1000',  label: 'Master Fog 1000 gpm' },
  { id: 'msfog1250',  label: 'Master Fog 1250 gpm' }
];

const SPECIALTY_NOZZLES = [
  { id: 'piercing', label: 'Piercing nozzle' },
  { id: 'blitz',    label: 'Blitzfire / Ground monitor' },
  { id: 'cellar',   label: 'Cellar / Bresnan' },
  { id: 'water_can',label: 'Water can / extinguisher' }
];

function renderNozzleSelector(container, dept) {
  container.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = 'Select the nozzles your department carries.';
  title.style.fontSize = '14px';
  title.style.marginBottom = '8px';

  const sub = document.createElement('div');
  sub.textContent = 'These will be the only options that show up in the main calculator and line presets.';
  sub.style.fontSize = '12px';
  sub.style.opacity = '0.75';
  sub.style.marginBottom = '8px';

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = '10px';

  const selected = new Set(
    Array.isArray(dept.nozzles)
      ? dept.nozzles.map(x => String(x)) : []
  );

  function makeGroup(label, items, groupKey) {
    const box = document.createElement('div');
    box.style.border = '1px solid rgba(255,255,255,0.12)';
    box.style.borderRadius = '8px';
    box.style.padding = '6px 8px';

    const header = document.createElement('div');
    header.textContent = label;
    header.style.fontSize = '13px';
    header.style.fontWeight = '600';
    header.style.marginBottom = '4px';

    const list = document.createElement('div');
    list.style.display = 'grid';
    list.style.gridTemplateColumns = '1fr 1fr';
    list.style.gap = '4px 8px';
    list.style.fontSize = '12px';

    items.forEach(item => {
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '4px';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = item.id;
      checkbox.checked = selected.has(item.id);

      const span = document.createElement('span');
      span.textContent = item.label;

      row.appendChild(checkbox);
      row.appendChild(span);

      list.appendChild(row);
    });

    box.appendChild(header);
    box.appendChild(list);
    return box;
  }

  wrapper.appendChild(makeGroup('Smooth bore', SMOOTH_BORE_NOZZLES, 'smooth'));
  wrapper.appendChild(makeGroup('Fog nozzles', FOG_NOZZLES, 'fog'));
  wrapper.appendChild(makeGroup('Master streams', MASTER_STREAM_NOZZLES, 'master'));
  wrapper.appendChild(makeGroup('Specialty', SPECIALTY_NOZZLES, 'specialty'));

  const customBox = document.createElement('div');
  customBox.style.border = '1px solid rgba(255,255,255,0.12)';
  customBox.style.borderRadius = '8px';
  customBox.style.padding = '6px 8px';

  const customHeader = document.createElement('div');
  customHeader.textContent = 'Custom nozzles';
  customHeader.style.fontSize = '13px';
  customHeader.style.fontWeight = '600';
  customHeader.style.marginBottom = '4px';

  const customList = document.createElement('div');
  customList.style.display = 'flex';
  customList.style.flexDirection = 'column';
  customList.style.gap = '4px';

  function renderCustomList() {
    customList.innerHTML = '';
    const customs = Array.isArray(dept.customNozzles) ? dept.customNozzles : [];
    customs.forEach((n, idx) => {
      if (!n) return;
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '4px';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '4px';

      const id = n.id || `custom_noz_${idx}`;
      const label = n.label || n.name || `Custom nozzle ${idx + 1}`;
      const gpm = (typeof n.gpm === 'number' ? n.gpm : (typeof n.flow === 'number' ? n.flow : null));
      const np = (typeof n.np === 'number'
        ? n.np
        : (typeof n.NP === 'number' ? n.NP : (typeof n.pressure === 'number' ? n.pressure : null)));

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = id;
      checkbox.checked = selected.has(id);

      const span = document.createElement('span');
      span.textContent = gpm && np
        ? `${label} – ${gpm} gpm @ ${np} psi`
        : label;

      left.appendChild(checkbox);
      left.appendChild(span);

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Del';
      delBtn.style.fontSize = '11px';
      delBtn.style.padding = '2px 6px';
      delBtn.style.borderRadius = '6px';
      delBtn.style.border = 'none';
      delBtn.style.background = '#e74c3c';
      delBtn.style.color = '#000';
      delBtn.style.cursor = 'pointer';

      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const arr = Array.isArray(dept.customNozzles) ? dept.customNozzles.slice() : [];
        arr.splice(idx, 1);
        dept.customNozzles = arr;
        saveDeptToStorage(dept);
        renderCustomList();
      });

      row.appendChild(left);
      row.appendChild(delBtn);
      customList.appendChild(row);
    });

    if (customList.children.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No custom nozzles yet.';
      empty.style.fontSize = '12px';
      empty.style.opacity = '0.7';
      customList.appendChild(empty);
    }
  }

  renderCustomList();

  const addCustomBtn = document.createElement('button');
  addCustomBtn.textContent = 'Add custom nozzle';
  addCustomBtn.style.marginTop = '6px';
  addCustomBtn.style.padding = '4px 8px';
  addCustomBtn.style.borderRadius = '999px';
  addCustomBtn.style.border = 'none';
  addCustomBtn.style.background = '#3498db';
  addCustomBtn.style.color = '#000';
  addCustomBtn.style.fontSize = '12px';
  addCustomBtn.style.cursor = 'pointer';

  addCustomBtn.addEventListener('click', () => {
    const label = window.prompt('Label (e.g. "Chief XD 165 @ 50 psi")?', '');
    if (!label) return;
    const gpmStr = window.prompt('Flow (gpm)?', '');
    if (!gpmStr) return;
    const gpm = Number(gpmStr);
    if (!gpm || !Number.isFinite(gpm)) return;
    const npStr = window.prompt('Nozzle pressure (psi)?', '50');
    const np = Number(npStr || '50');
    const id = `custom_noz_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const custom = {
      id,
      label,
      gpm,
      np
    };

    const arr = Array.isArray(dept.customNozzles) ? dept.customNozzles.slice() : [];
    arr.push(custom);
    dept.customNozzles = arr;

    const sel = new Set(
      Array.isArray(dept.nozzles)
        ? dept.nozzles.map(x => String(x))
        : []
    );
    sel.add(id);
    dept.nozzles = Array.from(sel);

    saveDeptToStorage(dept);
    renderNozzleSelector(container, dept);
  });

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save nozzles';
  saveBtn.style.marginTop = '8px';
  saveBtn.style.alignSelf = 'flex-end';
  saveBtn.style.padding = '6px 10px';
  saveBtn.style.borderRadius = '8px';
  saveBtn.style.border = 'none';
  saveBtn.style.background = '#2ecc71';
  saveBtn.style.color = '#000';
  saveBtn.style.cursor = 'pointer';
  saveBtn.style.fontSize = '13px';

  saveBtn.addEventListener('click', () => {
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const selectedIds = [];
    checkboxes.forEach(cb => {
      if (cb.checked) {
        selectedIds.push(cb.value);
      }
    });
    dept.nozzles = selectedIds;
    saveDeptToStorage(dept);
    alert('Nozzle selection saved.');
  });

  customBox.appendChild(customHeader);
  customBox.appendChild(customList);
  customBox.appendChild(addCustomBtn);

  wrapper.appendChild(customBox);
  wrapper.appendChild(saveBtn);

  container.appendChild(title);
  container.appendChild(sub);
  container.appendChild(wrapper);
}

// ======================================
// Hose Selection
// ======================================

const ATTACK_HOSES = [
  { id: 'h_1',        label: '1"' },
  { id: 'h_15',       label: '1 1/2"' },
  { id: 'h_175',      label: '1 3/4"' },
  { id: 'h_2',        label: '2"' },
  { id: 'h_25',       label: '2 1/2"' }
];

const SUPPLY_HOSES = [
  { id: 'h_3',        label: '3"' },
  { id: 'h_3_supply', label: '3" supply' },
  { id: 'h_4_ldh',    label: '4" LDH' },
  { id: 'h_5_ldh',    label: '5" LDH' }
];

const WILDLAND_HOSES = [
  { id: 'h_w_1',      label: '1" wildland' },
  { id: 'h_w_15',     label: '1 1/2" wildland' },
  { id: 'h_booster_1',label: '1" booster' }
];

const LOW_FRICTION_ATTACK = [
  { id: 'h_lf_175',   label: '1 3/4" low-friction' },
  { id: 'h_lf_2',     label: '2" low-friction' },
  { id: 'h_lf_25',    label: '2 1/2" low-friction' },
  { id: 'h_lf_5',     label: '5" low-friction' }
];

function renderHoseSelector(container, dept) {
  container.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = 'Select hose sizes your department carries.';
  title.style.fontSize = '14px';
  title.style.marginBottom = '8px';

  const sub = document.createElement('div');
  sub.textContent = 'These diameters drive friction loss (C values) in the main calculator and presets.';
  sub.style.fontSize = '12px';
  sub.style.opacity = '0.75';
  sub.style.marginBottom = '8px';

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = '10px';

  const selected = new Set(
    Array.isArray(dept.hoses)
      ? dept.hoses.map(x => String(x))
      : []
  );

  function makeGroup(label, items) {
    const box = document.createElement('div');
    box.style.border = '1px solid rgba(255,255,255,0.12)';
    box.style.borderRadius = '8px';
    box.style.padding = '6px 8px';

    const header = document.createElement('div');
    header.textContent = label;
    header.style.fontSize = '13px';
    header.style.fontWeight = '600';
    header.style.marginBottom = '4px';

    const list = document.createElement('div');
    list.style.display = 'grid';
    list.style.gridTemplateColumns = '1fr 1fr';
    list.style.gap = '4px 8px';
    list.style.fontSize = '12px';

    items.forEach(item => {
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '4px';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = item.id;
      checkbox.checked = selected.has(item.id);

      const span = document.createElement('span');
      span.textContent = item.label;

      row.appendChild(checkbox);
      row.appendChild(span);

      list.appendChild(row);
    });

    box.appendChild(header);
    box.appendChild(list);
    return box;
  }

  wrapper.appendChild(makeGroup('Attack lines', ATTACK_HOSES));
  wrapper.appendChild(makeGroup('Supply lines', SUPPLY_HOSES));
  wrapper.appendChild(makeGroup('Wildland / Booster', WILDLAND_HOSES));
  wrapper.appendChild(makeGroup('Low-friction / high-flow', LOW_FRICTION_ATTACK));

  const customBox = document.createElement('div');
  customBox.style.border = '1px solid rgba(255,255,255,0.12)';
  customBox.style.borderRadius = '8px';
  customBox.style.padding = '6px 8px';

  const customHeader = document.createElement('div');
  customHeader.textContent = 'Custom hose sizes';
  customHeader.style.fontSize = '13px';
  customHeader.style.fontWeight = '600';
  customHeader.style.marginBottom = '4px';

  const customList = document.createElement('div');
  customList.style.display = 'flex';
  customList.style.flexDirection = 'column';
  customList.style.gap = '4px';

  function renderCustomHoseList() {
    customList.innerHTML = '';
    const customs = Array.isArray(dept.customHoses) ? dept.customHoses : [];
    customs.forEach((h, idx) => {
      if (!h) return;
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '4px';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '4px';

      const id = h.id || `custom_hose_${idx}`;
      const label = h.label || h.name || `Custom hose ${idx + 1}`;
      const dia = (typeof h.diameter === 'number' ? h.diameter : null);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = id;
      checkbox.checked = selected.has(id);

      const span = document.createElement('span');
      span.textContent = dia
        ? `${label} – ${dia}" hose`
        : label;

      left.appendChild(checkbox);
      left.appendChild(span);

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Del';
      delBtn.style.fontSize = '11px';
      delBtn.style.padding = '2px 6px';
      delBtn.style.borderRadius = '6px';
      delBtn.style.border = 'none';
      delBtn.style.background = '#e74c3c';
      delBtn.style.color = '#000';
      delBtn.style.cursor = 'pointer';

      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const arr = Array.isArray(dept.customHoses) ? dept.customHoses.slice() : [];
        arr.splice(idx, 1);
        dept.customHoses = arr;
        saveDeptToStorage(dept);
        renderCustomHoseList();
      });

      row.appendChild(left);
      row.appendChild(delBtn);
      customList.appendChild(row);
    });

    if (customList.children.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No custom hose sizes yet.';
      empty.style.fontSize = '12px';
      empty.style.opacity = '0.7';
      customList.appendChild(empty);
    }
  }

  renderCustomHoseList();

  const addCustomBtn = document.createElement('button');
  addCustomBtn.textContent = 'Add custom hose size';
  addCustomBtn.style.marginTop = '6px';
  addCustomBtn.style.padding = '4px 8px';
  addCustomBtn.style.borderRadius = '999px';
  addCustomBtn.style.border = 'none';
  addCustomBtn.style.background = '#3498db';
  addCustomBtn.style.color = '#000';
  addCustomBtn.style.fontSize = '12px';
  addCustomBtn.style.cursor = 'pointer';

  addCustomBtn.addEventListener('click', () => {
    const label = window.prompt('Label (e.g. "2 1/2\" combat 600")?', '');
    if (!label) return;
    const diaStr = window.prompt('Diameter in inches (e.g. 1.75, 2.5, 4, 5)?', '');
    const dia = Number(diaStr);
    if (!dia || !Number.isFinite(dia)) return;

    const id = `custom_hose_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const custom = {
      id,
      label,
      diameter: dia
    };

    const arr = Array.isArray(dept.customHoses) ? dept.customHoses.slice() : [];
    arr.push(custom);
    dept.customHoses = arr;

    const sel = new Set(
      Array.isArray(dept.hoses)
        ? dept.hoses.map(x => String(x))
        : []
    );
    sel.add(id);
    dept.hoses = Array.from(sel);

    saveDeptToStorage(dept);
    renderHoseSelector(container, dept);
  });

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save hoses';
  saveBtn.style.marginTop = '8px';
  saveBtn.style.alignSelf = 'flex-end';
  saveBtn.style.padding = '6px 10px';
  saveBtn.style.borderRadius = '8px';
  saveBtn.style.border = 'none';
  saveBtn.style.background = '#2ecc71';
  saveBtn.style.color = '#000';
  saveBtn.style.cursor = 'pointer';
  saveBtn.style.fontSize = '13px';

  saveBtn.addEventListener('click', () => {
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const selectedIds = [];
    checkboxes.forEach(cb => {
      if (cb.checked) {
        selectedIds.push(cb.value);
      }
    });
    dept.hoses = selectedIds;
    saveDeptToStorage(dept);
    alert('Hose selection saved.');
  });

  customBox.appendChild(customHeader);
  customBox.appendChild(customList);
  customBox.appendChild(addCustomBtn);

  wrapper.appendChild(customBox);
  wrapper.appendChild(saveBtn);

  container.appendChild(title);
  container.appendChild(sub);
  container.appendChild(wrapper);
}

// ======================================
// Accessories Selection (simplified)
// ======================================

const ACCESSORY_ITEMS = [
  { id: 'wye2_1_5', label: '2.5" to (2) 1.5" gated wye' },
  { id: 'wye2_1_75', label: '2.5" to (2) 1.75" gated wye' },
  { id: 'wye2_2', label: '2.5" to (2) 2" gated wye' },
  { id: 'standpipe_pack', label: 'High-rise / standpipe pack' },
  { id: 'foam_eductor', label: 'Foam eductor' },
  { id: 'foam_portable', label: 'Portable foam unit' }
];

function renderAccessorySelector(container, dept) {
  container.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = 'Accessories & special equipment.';
  title.style.fontSize = '14px';
  title.style.marginBottom = '8px';

  const sub = document.createElement('div');
  sub.textContent = 'These items can be referenced in presets and help match your department layout.';
  sub.style.fontSize = '12px';
  sub.style.opacity = '0.75';
  sub.style.marginBottom = '8px';

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = '10px';

  const selected = new Set(
    Array.isArray(dept.accessories)
      ? dept.accessories.map(x => String(x))
      : []
  );

  const builtInBox = document.createElement('div');
  builtInBox.style.border = '1px solid rgba(255,255,255,0.12)';
  builtInBox.style.borderRadius = '8px';
  builtInBox.style.padding = '6px 8px';

  const header = document.createElement('div');
  header.textContent = 'Common accessories';
  header.style.fontSize = '13px';
  header.style.fontWeight = '600';
  header.style.marginBottom = '4px';

  const list = document.createElement('div');
  list.style.display = 'grid';
  list.style.gridTemplateColumns = '1fr 1fr';
  list.style.gap = '4px 8px';
  list.style.fontSize = '12px';

  ACCESSORY_ITEMS.forEach(item => {
    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '4px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = item.id;
    checkbox.checked = selected.has(item.id);

    const span = document.createElement('span');
    span.textContent = item.label;

    row.appendChild(checkbox);
    row.appendChild(span);
    list.appendChild(row);
  });

  builtInBox.appendChild(header);
  builtInBox.appendChild(list);

  wrapper.appendChild(builtInBox);

  const customBox = document.createElement('div');
  customBox.style.border = '1px solid rgba(255,255,255,0.12)';
  customBox.style.borderRadius = '8px';
  customBox.style.padding = '6px 8px';

  const customHeader = document.createElement('div');
  customHeader.textContent = 'Custom accessories';
  customHeader.style.fontSize = '13px';
  customHeader.style.fontWeight = '600';
  customHeader.style.marginBottom = '4px';

  const customList = document.createElement('div');
  customList.style.display = 'flex';
  customList.style.flexDirection = 'column';
  customList.style.gap = '4px';

  function renderCustomAccList() {
    customList.innerHTML = '';
    const customs = Array.isArray(dept.customAccessories) ? dept.customAccessories : [];
    customs.forEach((a, idx) => {
      if (!a) return;
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '4px';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '4px';

      const id = a.id || `custom_acc_${idx}`;
      const label = a.label || a.name || `Custom accessory ${idx + 1}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = id;
      checkbox.checked = selected.has(id);

      const span = document.createElement('span');
      span.textContent = label;

      left.appendChild(checkbox);
      left.appendChild(span);

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Del';
      delBtn.style.fontSize = '11px';
      delBtn.style.padding = '2px 6px';
      delBtn.style.borderRadius = '6px';
      delBtn.style.border = 'none';
      delBtn.style.background = '#e74c3c';
      delBtn.style.color = '#000';
      delBtn.style.cursor = 'pointer';

      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const arr = Array.isArray(dept.customAccessories) ? dept.customAccessories.slice() : [];
        arr.splice(idx, 1);
        dept.customAccessories = arr;
        saveDeptToStorage(dept);
        renderCustomAccList();
      });

      row.appendChild(left);
      row.appendChild(delBtn);
      customList.appendChild(row);
    });

    if (customList.children.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No custom accessories yet.';
      empty.style.fontSize = '12px';
      empty.style.opacity = '0.7';
      customList.appendChild(empty);
    }
  }

  renderCustomAccList();

  const addCustomBtn = document.createElement('button');
  addCustomBtn.textContent = 'Add custom accessory';
  addCustomBtn.style.marginTop = '6px';
  addCustomBtn.style.padding = '4px 8px';
  addCustomBtn.style.borderRadius = '999px';
  addCustomBtn.style.border = 'none';
  addCustomBtn.style.background = '#3498db';
  addCustomBtn.style.color = '#000';
  addCustomBtn.style.fontSize = '12px';
  addCustomBtn.style.cursor = 'pointer';

  addCustomBtn.addEventListener('click', () => {
    const label = window.prompt('Accessory label?', '');
    if (!label) return;

    const id = `custom_acc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const custom = {
      id,
      label
    };

    const arr = Array.isArray(dept.customAccessories) ? dept.customAccessories.slice() : [];
    arr.push(custom);
    dept.customAccessories = arr;

    const sel = new Set(
      Array.isArray(dept.accessories)
        ? dept.accessories.map(x => String(x))
        : []
    );
    sel.add(id);
    dept.accessories = Array.from(sel);

    saveDeptToStorage(dept);
    renderAccessorySelector(container, dept);
  });

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save accessories';
  saveBtn.style.marginTop = '8px';
  saveBtn.style.alignSelf = 'flex-end';
  saveBtn.style.padding = '6px 10px';
  saveBtn.style.borderRadius = '8px';
  saveBtn.style.border = 'none';
  saveBtn.style.background = '#2ecc71';
  saveBtn.style.color = '#000';
  saveBtn.style.cursor = 'pointer';
  saveBtn.style.fontSize = '13px';

  saveBtn.addEventListener('click', () => {
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const selectedIds = [];
    checkboxes.forEach(cb => {
      if (cb.checked) {
        selectedIds.push(cb.value);
      }
    });
    dept.accessories = selectedIds;
    saveDeptToStorage(dept);
    alert('Accessories saved.');
  });

  customBox.appendChild(customHeader);
  customBox.appendChild(customList);
  customBox.appendChild(addCustomBtn);

  wrapper.appendChild(customBox);
  wrapper.appendChild(saveBtn);

  container.appendChild(title);
  container.appendChild(sub);
  container.appendChild(wrapper);
}

// =====================================================
// Mapping: Dept nozzle labels → internal hydraulic IDs
// =====================================================

const DEPT_NOZ_TO_CALC_NOZ = {
  // Smooth bore labels
  'Smooth 7/8" @ 50 psi': 'sb78_50',
  'Smooth 15/16" @ 50 psi': 'sb1516_50',
  'Smooth 1" @ 50 psi': 'sb1_50',
  'Smooth 1 1/4" @ 50 psi': 'sb114_50',
  'Smooth 1 3/8" @ 80 psi': 'sb138_80',
  'Smooth 1 1/2" @ 80 psi': 'sb112_80',
  'Smooth 1 3/4" @ 80 psi': 'sb134_80',
  'Smooth 2" @ 80 psi': 'sb2_80',

  // Fog labels
  'Fog 150 gpm @ 75 psi': 'fog150_75',
  'Fog 150 gpm @ 50 psi': 'fog150_50',
  'Fog 175 gpm @ 75 psi': 'fog175_75',
  'Fog 175 gpm @ 50 psi': 'fog175_50',
  'Fog 185 gpm @ 75 psi': 'fog185_75',
  'Fog 185 gpm @ 50 psi': 'fog185_50',
  'Fog 200 gpm @ 75 psi': 'fog200_75',
  'Fog 200 gpm @ 50 psi': 'fog200_50',

  // Master stream labels
  'Master 1 3/8" 500 gpm @ 80 psi': 'ms1_3_8_80',
  'Master 1 1/2" 600 gpm @ 80 psi': 'ms1_1_2_80',
  'Master 1 3/4" 800 gpm @ 80 psi': 'ms1_3_4_80',
  'Master 2" 1000 gpm @ 80 psi': 'ms2_80',
  'Master Fog 500 gpm': 'msfog500',
  'Master Fog 750 gpm': 'msfog750',
  'Master Fog 1000 gpm': 'msfog1000',
  'Master Fog 1250 gpm': 'msfog1250',

  // Specialty nozzle labels
  'Piercing nozzle': 'piercing',
  'Blitzfire / Ground monitor': 'blitz',
  'Cellar / Bresnan': 'cellar',
  'Water can / extinguisher': 'water_can',

  // Chief XD fog options – map to dedicated hydraulic IDs
  'Chief XD 165 gpm @ 50 psi': 'chiefXD165_50',
  'Chief XD 185 gpm @ 50 psi': 'chief185_50',
  'Chief XD 265 gpm @ 50 psi': 'chiefXD265',

  // Backwards-compat: older key formats
  'fog_xd_175_75_150': 'fog150_75',
  'fog_xd_175_50_165': 'chiefXD165_50',
  'fog_xd_175_50_185': 'chief185_50',
  'fog_xd_25_50_265': 'chiefXD265',

  'ms_tip_138_500': 'ms1_3_8_80',
  'ms_tip_112_600': 'ms1_1_2_80',
  'ms_tip_134_800': 'ms1_3_4_80',
  'ms_tip_2_1000': 'ms2_80',
  'ms_fog_500': 'ms1_3_8_80',
  'ms_fog_750': 'ms1_1_2_80',
  'ms_fog_1000': 'ms2_80',
  'ms_fog_1250': 'ms2_80'
};

// =====================================================
// **UPDATED** Dept nozzle / hose helpers for calc view
// =====================================================

export function getDeptNozzleIds() {
  try {
    const dept = loadDeptFromStorage();
    if (!dept || typeof dept !== 'object') return [];

    const result = [];
    const seen = new Set();

    // Normalize the raw selections list (what the user actually checked
    // in the Department Setup → Nozzles screen).
    const rawSelected = Array.isArray(dept.nozzles) ? dept.nozzles : [];
    const selectedSet = new Set(
      rawSelected
        .map(v => (v == null ? '' : String(v).trim()))
        .filter(Boolean)
    );

    // 1) Built-in department nozzles (checkbox list)
    rawSelected.forEach(raw => {
      if (raw == null) return;
      const trimmed = String(raw).trim();
      if (!trimmed) return;

      let mapped = null;

      // New style: dept.nozzles stores internal nozzle IDs
      // that already exist in NOZ (e.g. 'fog185_50', 'sb1516_50', etc.).
      if (NOZ && Object.prototype.hasOwnProperty.call(NOZ, trimmed)) {
        mapped = trimmed;
      } else {
        // Legacy style: dept.nozzles stored a display label that
        // must be mapped via DEPT_NOZ_TO_CALC_NOZ.
        const viaMap = DEPT_NOZ_TO_CALC_NOZ[trimmed];
        if (typeof viaMap === 'string' && viaMap) {
          mapped = viaMap;
        }
      }

      if (mapped && !seen.has(mapped)) {
        seen.add(mapped);
        result.push(mapped);
      }
    });

    // 2) Custom nozzles
    // Only include a custom nozzle if it is actually selected in dept.nozzles.
    if (Array.isArray(dept.customNozzles) && selectedSet.size) {
      dept.customNozzles.forEach((n, idx) => {
        if (!n || typeof n !== 'object') return;

        const rawId = (n.id || n.calcId || n.key || `custom_noz_${idx}`);
        const id = String(rawId).trim();
        if (!id) return;

        // In the current Department Setup, dept.nozzles stores the custom
        // nozzle id when its checkbox is checked. For older saves we also
        // check against the label in case that was stored instead.
        const label = (n.label || n.name || n.desc || '').trim();

        const isSelected =
          selectedSet.has(id) ||
          (label && selectedSet.has(label));

        if (!isSelected) return;

        if (!seen.has(id)) {
          seen.add(id);
          result.push(id);
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

    // Normalize the raw hose selections (what the user checked in
    // Department Setup → Hoses).
    const rawSelected = Array.isArray(dept.hoses) ? dept.hoses : [];
    const selectedIds = new Set(
      rawSelected
        .map(v => (v == null ? '' : String(v).trim()))
        .filter(Boolean)
    );

    // 1) Built-in hose selections
    rawSelected.forEach(id => {
      if (id == null) return;
      const key = String(id).trim();
      if (!key) return;
      const dia = HOSE_ID_TO_DIA[key];
      if (dia) outSet.add(dia);
    });

    // 2) Custom hoses with explicit diameters
    if (Array.isArray(dept.customHoses) && selectedIds.size) {
      dept.customHoses.forEach((h, idx) => {
        if (!h) return;

        const rawId = h.id || h.key || `custom_hose_${idx}`;
        const id = String(rawId).trim();
        const label = (h.label || h.name || '').trim();

        // Only include if this custom hose was actually selected.
        const isSelected =
          (id && selectedIds.has(id)) ||
          (label && selectedIds.has(label));

        if (!isSelected) return;

        if (typeof h.diameter === 'number' && h.diameter > 0) {
          const dia = String(h.diameter);
          outSet.add(dia);
        }
      });
    }

    return Array.from(outSet).sort((a, b) => parseFloat(a) - parseFloat(b));
  } catch (e) {
    console.warn('getDeptHoseDiameters failed', e);
    return [];
  }
}

// ======================================
// Presets setup + global hook
// ======================================

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

// Global hook so About → Department setup opens the Department wizard overlay
if (typeof window !== 'undefined') {
  window.fireopsOpenDeptSetup = function () {
    try {
      if (typeof openDeptWizard === 'function') {
        openDeptWizard();
      } else {
        console.warn('openDeptWizard() is not defined; cannot open Department setup wizard.');
      }
    } catch (e) {
      console.warn('Failed to open Department setup wizard:', e);
    }
  };
}

// =====================================================
// Expose department custom nozzles for calc view
// =====================================================
export function getDeptCustomNozzlesForCalc() {
  try {
    const dept = loadDeptFromStorage();
    if (!dept || typeof dept !== 'object') return [];
    const customs = Array.isArray(dept.customNozzles) ? dept.customNozzles : [];
    // Normalize into { id, label, gpm, np }
    return customs.map((n, idx) => {
      if (!n || typeof n !== 'object') return null;
      const id = n.id || n.calcId || n.key || `custom_noz_${idx}`;
      const label = n.label || n.name || n.desc || id;
      const gpm = typeof n.gpm === 'number'
        ? n.gpm
        : (typeof n.flow === 'number' ? n.flow : null);
      const np = typeof n.np === 'number'
        ? n.np
        : (typeof n.NP === 'number' ? n.NP : (typeof n.pressure === 'number' ? n.pressure : null));
      return { id, label, gpm, np };
    }).filter(Boolean);
  } catch (e) {
    console.warn('getDeptCustomNozzlesForCalc failed', e);
    return [];
  }
}
