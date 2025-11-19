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

// For now, focus on department NOZZLES only.
// These IDs can later be tied to the main calc nozzle table.
const NOZZLES_SMOOTH = [
  { id: 'sb_15_50_150', label: '1½" smooth bore 150 gpm @ 50 psi' },
  { id: 'sb_15_50_185', label: '1½" smooth bore 185 gpm @ 50 psi' },
  { id: 'sb_15_80_150', label: '1½" smooth bore 150 gpm @ 80 psi' },
  { id: 'sb_2_50_265',  label: '2" smooth bore 265 gpm @ 50 psi' },
];

const NOZZLES_FOG = [
  { id: 'fog_175_75_150',  label: '1¾" fog 150 gpm @ 75 psi' },
  { id: 'fog_175_100_150', label: '1¾" fog 150 gpm @ 100 psi' },
  { id: 'fog_2_75_200',    label: '2" fog 200 gpm @ 75 psi' },
  { id: 'fog_master_1000', label: 'Master fog 1000 gpm @ 80 psi' },
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

  for (const cn of savedCustom) {
    const host = cn.type === 'smooth' ? smoothList : fogList;
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
      const type = typeEl.value === 'smooth' ? 'smooth' : 'fog';

      const id = 'custom_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      const labelParts = [name];
      if (gpm > 0) labelParts.push(gpm + ' gpm');
      if (psi > 0) labelParts.push('@ ' + psi + ' psi');
      const fullLabel = labelParts.join(' ');

      const custom = { id, label: fullLabel, type, gpm, psi };
      if (!Array.isArray(state.customNozzles)) state.customNozzles = [];
      state.customNozzles.push(custom);

      const host = type === 'smooth' ? smoothList : fogList;
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
      align-items: flex-end;
      justify-content: center;
    }
    .preset-panel-wrapper.hidden {
      display: none;
    }
    .preset-panel-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.4);
    }
    .preset-panel {
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
    }
    .preset-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      margin-bottom: 4px;
    }
    .preset-panel-title {
      font-weight: 600;
      font-size: 0.95rem;
    }
    .preset-close-btn {
      background: none;
      border: none;
      color: #fff;
      font-size: 1rem;
      padding: 4px 8px;
      cursor: pointer;
    }
    .preset-list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
      margin-bottom: 8px;
    }
    .preset-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 4px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      gap: 6px;
      font-size: 0.85rem;
    }
    .preset-row-main {
      flex: 1;
      min-width: 0;
    }
    .preset-row-name {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .preset-row-sub {
      opacity: 0.7;
      font-size: 0.8rem;
    }
    .preset-row-actions {
      display: flex;
      gap: 4px;
    }
    .preset-apply-btn,
    .preset-delete-btn {
      border: none;
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .preset-apply-btn {
      background: #00b37a;
      color: #000;
    }
    .preset-delete-btn {
      background: #333;
      color: #fff;
    }
    .preset-panel-footer {
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 6px;
      display: flex;
      justify-content: flex-end;
    }
    .preset-primary {
      border-radius: 999px;
      border: none;
      padding: 6px 12px;
      font-size: 0.85rem;
      background: #0af;
      color: #000;
      cursor: pointer;
    }
    .preset-empty {
      text-align: center;
      opacity: 0.8;
      font-size: 0.85rem;
      padding: 12px 6px;
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
      align-items: flex-end;
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
