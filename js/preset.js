// preset.js
// Lightweight preset system for FireOps Calc
// - In APP mode: full preset UI + apply to pump calc
// - In WEB mode: shows info + store buttons

const STORAGE_KEY = 'fireops_presets_v1';

let state = {
  isApp: false,
  presets: [],
  triggerButtonId: 'btnPreset',
  activePresetLabelId: 'activePresetLabel',
  appStoreUrl: '',
  playStoreUrl: '',
  // Callbacks provided by view.calc.js
  getLineState: null,
  applyPresetToCalc: null,
  deptHoses: [],
  deptNozzles: [],
};

/**
 * Initialize preset system
 * @param {Object} options
 * @param {boolean} options.isApp              - true = full presets, false = info-only
 * @param {string} [options.triggerButtonId]   - ID of the "Preset" button
 * @param {string} [options.activePresetLabelId] - ID of label where active preset name shows
 * @param {function} [options.getLineState]    - (lineNumber) => { ... line state ... }  (APP ONLY)
 * @param {function} [options.applyPresetToCalc] - (presetObj) => void (APP ONLY)
 * @param {string} [options.appStoreUrl]       - App Store link for web-only panel
 * @param {string} [options.playStoreUrl]      - Play Store link for web-only panel
 */
export function setupPresets(options = {}) {
  state = {
    ...state,
    ...options,
  };

  state.isApp = !!options.isApp;

  // Load presets only in app mode
  if (state.isApp) {
    state.presets = loadPresetsFromStorage();
  }

  // Attach click handler to "Preset" button
  const triggerBtn = document.getElementById(state.triggerButtonId);
  if (triggerBtn) {
    triggerBtn.addEventListener('click', () => {
      if (state.isApp) {
        const hasNozzles =
          (state.deptNozzles && state.deptNozzles.length) ||
          (state.customNozzles && state.customNozzles.length);
        if (!hasNozzles) {
          // First time (or not configured) – run nozzle wizard first
          openDeptNozzleWizard();
        } else {
          // If department nozzles are already set, go straight to presets
          openPresetPanelApp();
        }
      } else {
        openPresetInfoPanelWeb();
      }
    });
  }
}

// =========================
// Storage
// =========================

function loadPresetsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.warn('Preset load failed:', err);
    return [];
  }
}

function savePresetsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.presets));
  } catch (err) {
    console.warn('Preset save failed:', err);
  }
}

// =========================
// Department equipment config
// =========================
const STORAGE_DEPT_KEY = 'fireops_dept_equipment_v1';

// Department NOZZLES only (for now).
// These IDs can later be tied to the main calc nozzle table.
const NOZZLES_SMOOTH = [
  { id: 'sb_78_50_160',  label: '7/8" smooth bore 160 gpm @ 50 psi' },
  { id: 'sb_1516_50_185',label: '15/16" smooth bore 185 gpm @ 50 psi' },
  { id: 'sb_1_50_210',   label: '1" smooth bore 210 gpm @ 50 psi' },
  { id: 'sb_1118_50_265',label: '1 1/8" smooth bore 265 gpm @ 50 psi' },
  { id: 'sb_114_50_325', label: '1 1/4" smooth bore 325 gpm @ 50 psi' },
];

const NOZZLES_FOG = [
  { id: 'fog_15_100_95',   label: '1½" fog 95 gpm @ 100 psi' },
  { id: 'fog_15_100_125',  label: '1½" fog 125 gpm @ 100 psi' },
  { id: 'fog_175_75_150',  label: '1¾" fog 150 gpm @ 75 psi' },
  { id: 'fog_175_100_150', label: '1¾" fog 150 gpm @ 100 psi' },
  { id: 'fog_25_100_250',  label: '2½" fog 250 gpm @ 100 psi' },
  { id: 'fog_25_100_300',  label: '2½" fog 300 gpm @ 100 psi' },
];

const NOZZLES_MASTER = [
  { id: 'ms_tip_138_500',  label: 'Master stream tip 1 3/8" – 500 gpm' },
  { id: 'ms_tip_112_600',  label: 'Master stream tip 1½" – 600 gpm' },
  { id: 'ms_tip_134_800',  label: 'Master stream tip 1¾" – 800 gpm' },
  { id: 'ms_tip_2_1000',   label: 'Master stream tip 2" – 1000 gpm' },
  { id: 'ms_fog_500',      label: 'Master fog nozzle 500 gpm' },
  { id: 'ms_fog_750',      label: 'Master fog nozzle 750 gpm' },
  { id: 'ms_fog_1000',     label: 'Master fog nozzle 1000 gpm' },
  { id: 'ms_fog_1250',     label: 'Master fog nozzle 1250 gpm' },
];

const NOZZLES_SPECIAL = [
  { id: 'sp_celler',       label: 'Celler nozzle' },
  { id: 'sp_piercing',     label: 'Piercing nozzle (pike pole)' },
  { id: 'sp_bresnan',      label: 'Bresnan distributor' },
  { id: 'sp_distributor',  label: 'Rotary distributor nozzle' },
  { id: 'sp_foammaster',   label: 'High expansion foam nozzle' },
  { id: 'sp_forestry',     label: 'Forestry nozzle (1")' },
  { id: 'sp_wildland_gated',label:'Wildland gated wye / nozzle set' },
];
function loadDeptFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_DEPT_KEY);
    if (!raw) return { nozzles: [], customNozzles: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { nozzles: [], customNozzles: [] };
    return {
      nozzles: Array.isArray(parsed.nozzles) ? parsed.nozzles : [],
      customNozzles: Array.isArray(parsed.customNozzles) ? parsed.customNozzles : [],
    };
  } catch (err) {
    console.warn('Dept equipment load failed:', err);
    return { nozzles: [], customNozzles: [] };
  }
}

function saveDeptToStorage() {
  try {
    const payload = {
      nozzles: state.deptNozzles || [],
      customNozzles: state.customNozzles || [],
    };
    localStorage.setItem(STORAGE_DEPT_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Dept equipment save failed:', err);
  }
}

// Ensure the shared popup wrapper exists
function ensureDeptPopupWrapper() {
  // Ensure shared styles for preset panels (top-modal)
  injectAppPresetStyles();
  if (document.getElementById('deptPopupWrapper')) return;

  const wrap = document.createElement('div');
  wrap.id = 'deptPopupWrapper';
  wrap.className = 'preset-panel-wrapper hidden';

  wrap.innerHTML = `
    <div class="preset-panel-backdrop" data-dept-close="1"></div>
    <div class="preset-panel">
      <div class="preset-panel-header">
        <div class="preset-panel-title" id="deptPopupTitle">Presets</div>
        <button type="button" class="preset-close-btn" data-dept-close="1">✕</button>
      </div>
      <div class="preset-panel-body" id="deptPopupBody"></div>
      <div class="preset-panel-footer" id="deptPopupFooter"></div>
    </div>
  `;

  document.body.appendChild(wrap);

  // Generic close handler
  wrap.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.deptClose === '1') {
      wrap.classList.add('hidden');
    }
  });
}

// First screen: simple menu with a "Department setup" button
function renderDeptHomeScreen() {
  ensureDeptPopupWrapper();
  const wrap = document.getElementById('deptPopupWrapper');
  if (!wrap) return;

  const titleEl = wrap.querySelector('#deptPopupTitle');
  const bodyEl  = wrap.querySelector('#deptPopupBody');
  const footerEl= wrap.querySelector('#deptPopupFooter');
  if (!titleEl || !bodyEl || !footerEl) return;

  titleEl.textContent = 'Presets';
  bodyEl.innerHTML = `
    <p>Select what you want to configure.</p>
    <div class="dept-menu">
      <button type="button" class="btn-primary" id="deptSetupBtn">Department setup</button>
    </div>
  `;
  footerEl.innerHTML = `
    <button type="button" class="btn-secondary" data-dept-close="1">Close</button>
  `;

  const deptBtn = bodyEl.querySelector('#deptSetupBtn');
  if (deptBtn) {
    deptBtn.addEventListener('click', () => {
      renderNozzleSelectionScreen();
    });
  }

  wrap.classList.remove('hidden');
}

// Second screen: nozzle selection with smooth bore / fog lists + custom nozzle form
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

    <div class="dept-custom">
      <h3>Custom nozzle</h3>
      <div class="dept-custom-row">
        <label>Name / label
          <input type="text" id="customNozName" placeholder="Example: 1¾\" task line 160 gpm @ 75 psi">
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
    <button type="button" class="btn-secondary" data-dept-close="1">Cancel</button>
    <button type="button" class="btn-primary" id="deptNozSaveBtn">Save & continue</button>
  `;

  // Render any saved custom nozzles into the appropriate list
  const savedCustom = Array.isArray(state.customNozzles) ? state.customNozzles : [];
  const smoothList = bodyEl.querySelector('#deptSmoothList');
  const fogList    = bodyEl.querySelector('#deptFogList');
  const masterList = bodyEl.querySelector('#deptMasterList');
  const specialList= bodyEl.querySelector('#deptSpecialList');

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

  // Custom nozzle add handler
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

      const id = 'custom_' + Date.now() + '_' + Math.floor(Math.random()*1000);
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

  // Save & continue
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
      wrap.classList.add('hidden');
      // After saving, go into full preset editor
      openPresetPanelApp();
    });
  }

  wrap.classList.remove('hidden');
}
}

// Public entry: open the wizard starting at the home screen
function openDeptNozzleWizard() {
  // Load from storage into state if not already present
  const stored = loadDeptFromStorage();
  if (!Array.isArray(state.deptNozzles)) state.deptNozzles = stored.nozzles || [];
  if (!Array.isArray(state.customNozzles)) state.customNozzles = stored.customNozzles || [];
  renderDeptHomeScreen();
}

// =========================
// APP MODE: full preset UI
// =========================

function openPresetPanelApp() {
  ensureAppPresetPanelExists();
  renderPresetList();
  document.getElementById('presetPanelWrapper')?.classList.remove('hidden');
}

function closePresetPanelApp() {
  document.getElementById('presetPanelWrapper')?.classList.add('hidden');
}

function ensureAppPresetPanelExists() {
  if (document.getElementById('presetPanelWrapper')) return;

  const wrap = document.createElement('div');
  wrap.id = 'presetPanelWrapper';
  wrap.className = 'preset-panel-wrapper hidden';

  wrap.innerHTML = `
    <div class="preset-panel-backdrop" data-preset-close="1"></div>
    <div class="preset-panel">
      <div class="preset-panel-header">
        <div class="preset-panel-title">Line Presets</div>
        <button type="button" class="preset-close-btn" data-preset-close="1">✕</button>
      </div>

      <div id="presetList" class="preset-list"></div>

      <div class="preset-panel-footer">
        <button type="button" id="btnAddPreset" class="preset-primary">+ Save Current Line as Preset</button>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  // Close events
  wrap.addEventListener('click', (ev) => {
    const target = ev.target;
    if (target && target.dataset && target.dataset.presetClose === '1') {
      closePresetPanelApp();
    }
  });

  // Add preset
  const addBtn = document.getElementById('btnAddPreset');
  if (addBtn) {
    addBtn.addEventListener('click', handleAddPresetClick);
  }

  injectAppPresetStyles();
}

function renderPresetList() {
  const listEl = document.getElementById('presetList');
  if (!listEl) return;

  if (!state.presets.length) {
    listEl.innerHTML = `
      <div class="preset-empty">
        No presets yet.<br />
        Use <strong>"Save Current Line as Preset"</strong> to create one.
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';
  state.presets.forEach((preset, idx) => {
    const row = document.createElement('div');
    row.className = 'preset-row';

    row.innerHTML = `
      <div class="preset-row-main">
        <div class="preset-row-name">${escapeHtml(preset.name || 'Preset')}</div>
        <div class="preset-row-sub">
          Line ${preset.lineNumber ?? '?'} • ${preset.hoseDiameter || '?""'}" • ${preset.lengthFt || '?'}'
        </div>
      </div>
      <div class="preset-row-actions">
        <button type="button" class="preset-apply-btn" data-preset-idx="${idx}">Use</button>
        <button type="button" class="preset-delete-btn" data-preset-idx="${idx}">Del</button>
      </div>
    `;

    listEl.appendChild(row);
  });

  // Attach handlers
  listEl.querySelectorAll('.preset-apply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.presetIdx);
      applyPresetByIndex(idx);
    });
  });

  listEl.querySelectorAll('.preset-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.presetIdx);
      deletePresetByIndex(idx);
    });
  });
}

function handleAddPresetClick() {
  if (typeof state.getLineState !== 'function') {
    alert('Preset system not wired: missing getLineState callback.');
    return;
  }

  // Ask which line to capture
  const lineStr = prompt('Save which line as a preset? (1, 2, or 3)', '1');
  if (!lineStr) return;

  const lineNumber = Number(lineStr);
  if (![1, 2, 3].includes(lineNumber)) {
    alert('Please enter 1, 2, or 3.');
    return;
  }

  // Ask for preset name
  const name = prompt('Preset name (e.g. "Blitz 2½ – 265 GPM")', '');
  if (!name) return;

  const lineState = state.getLineState(lineNumber);
  if (!lineState) {
    alert('Unable to read line state. Check getLineState implementation.');
    return;
  }

  const preset = {
    id: `preset_${Date.now()}`,
    name,
    lineNumber,
    hoseDiameter: lineState.hoseDiameter,
    cValue: lineState.cValue,
    lengthFt: lineState.lengthFt,
    nozzleId: lineState.nozzleId,
    elevation: lineState.elevation,
    appliances: lineState.appliances,
  };

  state.presets.push(preset);
  savePresetsToStorage();
  renderPresetList();
}

function applyPresetByIndex(idx) {
  const preset = state.presets[idx];
  if (!preset) return;

  if (typeof state.applyPresetToCalc !== 'function') {
    alert('Preset system not wired: missing applyPresetToCalc callback.');
    return;
  }

  // Let the main calc logic handle applying fields + recalculating + updating UI
  state.applyPresetToCalc(preset);

  // Show active preset name on screen
  setActivePresetLabel(preset);

  // Close the panel
  closePresetPanelApp();
}

function deletePresetByIndex(idx) {
  if (idx < 0 || idx >= state.presets.length) return;
  const confirmDel = confirm('Delete this preset?');
  if (!confirmDel) return;
  state.presets.splice(idx, 1);
  savePresetsToStorage();
  renderPresetList();
}

function setActivePresetLabel(preset) {
  const labelEl = document.getElementById(state.activePresetLabelId);
  if (!labelEl) return;

  if (!preset) {
    labelEl.textContent = '';
    labelEl.classList.add('hidden');
    return;
  }

  labelEl.textContent = `Preset L${preset.lineNumber}: ${preset.name}`;
  labelEl.classList.remove('hidden');
}

// Inject some simple styles for the panel so it looks okay everywhere
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
    .preset-panel-wrapper.hidden {
      display: none;
    }
    .preset-panel-backdrop {
      position: absolute;
      inset: 0;
    }
    .preset-panel {
      position: relative;
      max-width: 480px;
      width: 100%;
      margin: 0 auto;
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
      .preset-panel {
        margin-top: 12px;
        border-radius: 20px;
        padding: 14px 16px 12px;
      }
    }
    .preset-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.25);
    }
    .preset-panel-title {
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .preset-close-btn {
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
    .preset-close-btn:hover {
      background: #111827;
    }
    .preset-panel-body {
      font-size: 0.85rem;
      line-height: 1.45;
      max-height: min(60vh, 420px);
      overflow-y: auto;
      padding-top: 4px;
      padding-bottom: 4px;
    }
    .preset-panel-body p {
      margin: 0 0 6px 0;
    }
    .preset-panel-footer {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      padding-top: 8px;
      border-top: 1px solid rgba(148, 163, 184, 0.25);
    }
    .btn-primary,
    .btn-secondary {
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 0.82rem;
      border: none;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-primary {
      background: linear-gradient(135deg, #38bdf8, #22c55e);
      color: #020617;
      font-weight: 600;
    }
    .btn-secondary {
      background: rgba(15, 23, 42, 0.9);
      color: #e5e7eb;
      border: 1px solid rgba(148, 163, 184, 0.7);
    }
    .btn-primary:active,
    .btn-secondary:active {
      transform: translateY(1px);
    }

    /* Dept / nozzle wizard */
    .dept-intro {
      font-size: 0.82rem;
      color: #cbd5f5;
      margin-bottom: 10px;
    }
    .dept-menu {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
    }
    .dept-columns {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 10px;
      flex-wrap: nowrap;
    }
    @media (min-width: 480px) {
      .dept-columns {
        flex-direction: row;
        flex-wrap: wrap;
      }
      .dept-column {
        flex: 1 1 200px;
      }
    }
    .dept-column h3 {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 4px 0;
      color: #bfdbfe;
    }
    .dept-list {
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(30, 64, 175, 0.5);
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .dept-option {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 0.8rem;
    }
    .dept-option input[type="checkbox"] {
      margin-top: 2px;
      width: 14px;
      height: 14px;
    }
    .dept-option span {
      flex: 1;
      word-break: break-word;
    }

    .dept-custom {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px dashed rgba(148, 163, 184, 0.4);
    }
    .dept-custom h3 {
      font-size: 0.8rem;
      font-weight: 600;
      margin: 0 0 4px 0;
      color: #e5e7eb;
    }
    .dept-custom-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 4px;
      font-size: 0.78rem;
    }
    .dept-custom-row label {
      flex: 1 1 90px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .dept-custom-row input,
    .dept-custom-row select {
      background: #020617;
      border-radius: 8px;
      border: 1px solid rgba(55, 65, 81, 0.9);
      color: #e5e7eb;
      padding: 4px 6px;
      font-size: 0.8rem;
    }

    /* Existing preset list styles (kept, just slightly tuned) */
    .preset-list-empty {
      font-size: 0.8rem;
      opacity: 0.8;
    }
    .preset-row {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      padding: 6px 0;
      border-bottom: 1px solid rgba(30, 41, 59, 0.9);
      font-size: 0.8rem;
    }
    .preset-row:last-child {
      border-bottom: none;
    }
    .preset-row-main {
      min-width: 0;
    }
    .preset-row-title {
      font-weight: 500;
      font-size: 0.82rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .preset-row-sub {
      opacity: 0.75;
      font-size: 0.75rem;
    }
    .preset-row-actions {
      display: flex;
      gap: 4px;
    }
    .preset-apply-btn,
    .preset-delete-btn {
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 0.72rem;
      cursor: pointer;
      border: none;
    }
    .preset-apply-btn {
      background: #22c55e;
      color: #020617;
    }
    .preset-delete-btn {
      background: #111827;
      color: #e5e7eb;
    }
  `;
  document.head.appendChild(style);
}

// =========================
// WEB MODE: info + store links
// =========================

function openPresetInfoPanelWeb() {
  ensureWebInfoPanelExists();
  document.getElementById('presetInfoWrapper')?.classList.remove('hidden');
}

function closePresetInfoPanelWeb() {
  document.getElementById('presetInfoWrapper')?.classList.add('hidden');
}

function ensureWebInfoPanelExists() {
  if (document.getElementById('presetInfoWrapper')) return;

  const wrap = document.createElement('div');
  wrap.id = 'presetInfoWrapper';
  wrap.className = 'preset-info-wrapper hidden';

  const hasAppStore = !!state.appStoreUrl;
  const hasPlayStore = !!state.playStoreUrl;

  wrap.innerHTML = `
    <div class="preset-panel-backdrop" data-preset-info-close="1"></div>
    <div class="preset-info-panel">
      <div class="preset-panel-header">
        <div class="preset-panel-title">Line Presets (App Only)</div>
        <button type="button" class="preset-close-btn" data-preset-info-close="1">✕</button>
      </div>
      <div class="preset-info-body">
        <p>
          In the FireOps Calc <strong>mobile app</strong>, you can create quick-line presets like:
        </p>
        <ul>
          <li><strong>Blitz 2½ – 265 GPM</strong></li>
          <li><strong>High-Rise 2½ – 200'</strong></li>
          <li><strong>Foam Handline – 1¾</strong></li>
        </ul>
        <p>
          Each preset saves hose size, length, C value, nozzle, elevation, and appliances.
          Tapping a preset instantly updates the pump calculation (GPM and PP) and shows the preset name on screen.
        </p>
        ${hasAppStore || hasPlayStore ? `
          <p>Get the app to unlock presets:</p>
          <div class="preset-store-buttons">
            ${hasAppStore ? `<a href="${state.appStoreUrl}" target="_blank" rel="noopener" class="preset-store-btn">App Store</a>` : ''}
            ${hasPlayStore ? `<a href="${state.playStoreUrl}" target="_blank" rel="noopener" class="preset-store-btn">Google Play</a>` : ''}
          </div>
        ` : `
          <p>The mobile app with presets will be available soon.</p>
        `}
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  wrap.addEventListener('click', (ev) => {
    const t = ev.target;
    if (t && t.dataset && t.dataset.presetInfoClose === '1') {
      closePresetInfoPanelWeb();
    }
  });

  injectWebPresetInfoStyles();
}

function injectWebPresetInfoStyles() {
  if (document.getElementById('presetInfoStyles')) return;

  const style = document.createElement('style');
  style.id = 'presetInfoStyles';
  style.textContent = `
    .preset-info-wrapper {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: flex-start; /* moved to top */
      justify-content: center;
    }
    .preset-info-wrapper.hidden {
      display: none;
    }
    .preset-info-panel {
      position: relative;
      width: 100%;
      max-width: 480px;
      max-height: 80vh;
      background: #111;
      color: #fff;
      border-radius: 16px 16px 0 0;
      padding: 8px 12px 12px;
      box-shadow: 0 -4px 12px rgba(0,0,0,0.5);
      z-index: 1;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      font-size: 0.9rem;
    }
    .preset-info-body ul {
      margin: 4px 0 8px;
      padding-left: 18px;
    }
    .preset-store-buttons {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
    }
    .preset-store-btn {
      text-decoration: none;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 0.85rem;
      background: #0af;
      color: #000;
      font-weight: 600;
    }
  `;
  document.head.appendChild(style);
}

// =========================
// Helpers
// =========================

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
