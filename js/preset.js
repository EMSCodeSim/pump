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
        openPresetPanelApp();
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
