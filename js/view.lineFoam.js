// view.lineFoam.js
// Foam system popup builder for a single line.
//
// - Foam type: Class A / Class B
// - System type: Eductor / Around-the-pump / Batch / CAFS
// - Inputs: water GPM, foam %, foam & water tank sizes
// - Eductor-specific: rated GPM, eductor PDP
// - Live preview: water GPM, foam GPM, solution GPM, runtimes, PDP
// - "Explain math" popup explaining all steps
//
// Usage example:
//   openFoamPopup({
//     dept: { nozzles },   // optional
//     initial: existingFoamConfig,
//     onSave(config) { ... }
//   });

let foamStylesInjected = false;

function injectFoamStyles() {
  if (foamStylesInjected) return;
  foamStylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
  .fm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(3, 7, 18, 0.55);
    backdrop-filter: blur(6px);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 40px;
    z-index: 10080;
    overflow-y: auto;
  }

  .fm-panel {
    position: relative;
    max-width: 480px;
    width: 100%;
    margin: 0 12px 24px;
    background: #020617;
    border-radius: 18px;
    box-shadow:
      0 18px 30px rgba(15, 23, 42, 0.85),
      0 0 0 1px rgba(148, 163, 184, 0.45);
    padding: 12px 14px 10px;
    color: #e5e7eb;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  @media (min-width: 640px) {
    .fm-panel {
      margin-top: 12px;
      border-radius: 20px;
      padding: 14px 16px 12px;
    }
  }

  .fm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }

  .fm-title {
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .fm-close {
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
  .fm-close:hover {
    background: #111827;
  }

  .fm-body {
    font-size: 0.85rem;
    line-height: 1.45;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .fm-footer {
    display: flex;
    flex-direction: row;
    gap: 6px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }

  .fm-btn-primary,
  .fm-btn-secondary {
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

  .fm-btn-primary {
    background: linear-gradient(135deg, #38bdf8, #22c55e);
    color: #020617;
    font-weight: 600;
  }

  .fm-btn-secondary {
    background: rgba(15, 23, 42, 0.9);
    color: #e5e7eb;
    border: 1px solid rgba(148, 163, 184, 0.7);
  }

  .fm-btn-primary:active,
  .fm-btn-secondary:active {
    transform: translateY(1px);
  }

  .fm-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }

  .fm-row label {
    font-weight: 500;
    font-size: 0.82rem;
  }

  .fm-row span {
    font-size: 0.8rem;
  }

  .fm-panel input[type="text"],
  .fm-panel input[type="number"],
  .fm-panel select {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(55, 65, 81, 0.9);
    background: #020617;
    color: #e5e7eb;
    font-size: 0.8rem;
  }

  .fm-panel input::placeholder {
    color: rgba(148, 163, 184, 0.9);
  }

  .fm-section {
    border-top: 1px solid rgba(148, 163, 184, 0.4);
    padding-top: 8px;
    margin-top: 6px;
  }
  .fm-section:first-of-type {
    border-top: none;
  }

  .fm-section h3 {
    margin: 0 0 4px 0;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #bfdbfe;
  }

  .fm-subsection {
    border: 1px solid rgba(30, 64, 175, 0.5);
    background: rgba(15, 23, 42, 0.85);
    padding: 6px;
    border-radius: 10px;
    margin-top: 6px;
  }
  .fm-subsection h4 {
    margin: 0 0 4px 0;
    font-size: 0.8rem;
    color: #bfdbfe;
  }

  .fm-toggle-group {
    display: inline-flex;
    gap: 4px;
  }
  .fm-toggle-group button {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid rgba(75, 85, 99, 0.9);
    background: rgba(15, 23, 42, 0.9);
    font-size: 0.78rem;
    color: #e5e7eb;
    cursor: pointer;
  }
  .fm-toggle-on {
    background: #0ea5e9;
    border-color: #0ea5e9;
    color: #020617;
  }

  .fm-preview {
    margin-top: 8px;
    padding: 8px;
    border-radius: 10px;
    background: radial-gradient(circle at 0% 0%, #0f172a, #020617);
    border: 1px solid rgba(37, 99, 235, 0.8);
    font-weight: 600;
    font-size: 0.82rem;
    text-align: center;
  }

  @media (min-width: 640px) {
    .fm-row {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }
    .fm-row > label {
      min-width: 130px;
    }
    .fm-row input,
    .fm-row select {
      width: auto;
      min-width: 120px;
    }
    .fm-two-cols {
      display: flex;
      flex-direction: row;
      gap: 8px;
    }
    .fm-subsection {
      flex: 1 1 48%;
    }
  }

  /* Explain math popup */
  .fm-explain-overlay {
    position: fixed;
    inset: 0;
    background: rgba(3, 7, 18, 0.75);
    backdrop-filter: blur(6px);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 40px;
    z-index: 10090;
    overflow-y: auto;
  }
  .fm-explain-panel {
    max-width: 480px;
    width: 100%;
    margin: 0 12px 24px;
    background: #020617;
    border-radius: 18px;
    box-shadow:
      0 18px 30px rgba(15, 23, 42, 0.85),
      0 0 0 1px rgba(148, 163, 184, 0.45);
    padding: 12px 14px 10px;
    color: #e5e7eb;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .fm-explain-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }
  .fm-explain-title {
    font-size: 0.95rem;
    font-weight: 600;
  }
  .fm-explain-body {
    font-size: 0.83rem;
    line-height: 1.5;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .fm-explain-body code {
    font-size: 0.8rem;
    background: rgba(15, 23, 42, 0.9);
    border-radius: 4px;
    padding: 1px 4px;
  }
  .fm-explain-footer {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }
  `;
  document.head.appendChild(style);
}

function fmEl(tag, opts = {}, ...children) {
  const e = document.createElement(tag);
  if (opts.class) e.className = opts.class;
  if (opts.text) e.textContent = opts.text;
  if (opts.type) e.type = opts.type;
  if (opts.value != null) e.value = opts.value;
  if (opts.placeholder) e.placeholder = opts.placeholder;
  if (opts.for) e.htmlFor = opts.for;
  if (opts.id) e.id = opts.id;
  if (opts.onchange) e.addEventListener('change', opts.onchange);
  if (opts.onclick) e.addEventListener('click', opts.onclick);
  children.forEach(c => e.append(c));
  return e;
}

function fmNumberInput(value, onChange, extra = {}) {
  return fmEl('input', {
    type: 'number',
    value: value ?? '',
    step: extra.step ?? '1',
    min: extra.min ?? '0',
    onchange: (e) => {
      const raw = e.target.value;
      if (raw === '') onChange('');
      else onChange(Number(raw));
    }
  });
}

function fmSelect(options, current, onChange) {
  const s = fmEl('select', { onchange: e => onChange(e.target.value) });
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.id;
    o.textContent = opt.label;
    if (opt.id === current) o.selected = true;
    s.appendChild(o);
  });
  return s;
}

// Simple helper: pull GPM from nozzle label if you want to use nozzles.
function fmParseGpmFromNozzle(nozzles, nozzleId) {
  const noz = nozzles.find(n => n.id === nozzleId);
  if (!noz || !noz.label) return null;
  const m = noz.label.match(/(\d+)\s*gpm/i);
  return m ? Number(m[1]) : null;
}

// Foam math
function calcFoamNumbers(state) {
  const waterGpm     = Number(state.waterGpm || 0);
  const foamPercent  = Number(state.foamPercent || 0);
  const foamTankGal  = Number(state.foamTankGal || 0);
  const waterTankGal = Number(state.waterTankGal || 0);

  const frac    = foamPercent / 100;
  const foamGpm = waterGpm * frac;
  const solGpm  = waterGpm + foamGpm;

  let foamRuntimeMin  = null;
  let waterRuntimeMin = null;

  if (foamGpm > 0 && foamTankGal > 0) {
    foamRuntimeMin = foamTankGal / foamGpm;
  }
  if (waterGpm > 0 && waterTankGal > 0) {
    waterRuntimeMin = waterTankGal / waterGpm;
  }

  // PDP: for eductor, use eductor PDP; for others, let user-entered PDP if we add it later
  let pdp = null;
  if (state.systemType === 'eductor') {
    pdp = Number(state.eductorPdp || 200);
  } else if (state.targetPdp) {
    pdp = Number(state.targetPdp);
  }

  return {
    waterGpm:      Math.round(waterGpm),
    foamPercent,
    foamGpm:       foamGpm ? Math.round(foamGpm * 10) / 10 : 0,
    solutionGpm:   solGpm ? Math.round(solGpm * 10) / 10 : 0,
    foamRuntimeMin,
    waterRuntimeMin,
    pdp,
  };
}

/**
 * Foam popup entry point
 *
 * @param {Object} opts
 *   - dept: { nozzles: [{id,label}] } (optional)
 *   - initial: optional existing foam config
 *   - onSave: function(config) -> void
 */

// Pretty labels for hose & nozzle IDs so dropdowns are readable.
function fmPrettyHoseLabelFromId(id) {
  if (!id) return '';
  // Common attack line sizes
  if (id === 'h_1')   return '1\" attack hose';
  if (id === 'h_15')  return '1 1/2\" attack hose';
  if (id === 'h_175') return '1 3/4\" attack hose';
  if (id === 'h_2')   return '2\" attack hose';
  if (id === 'h_25')  return '2 1/2\" attack hose';
  if (id === 'h_3')   return '3\" attack hose';

  // Supply / LDH
  if (id === 'h_3_supply') return '3\" supply line';
  if (id === 'h_4_ldh')    return '4\" LDH supply';
  if (id === 'h_5_ldh')    return '5\" LDH supply';

  // Wildland / booster
  if (id === 'h_w_1')      return '1\" wildland hose';
  if (id === 'h_w_15')     return '1 1/2\" wildland hose';
  if (id === 'h_booster_1') return '1\" booster reel';

  // Low-friction / special
  if (id === 'h_lf_175')   return '1 3/4\" low-friction attack';

  // Fallback – show raw id
  return id;
}

function fmPrettyDiaFromCode(code) {
  if (!code) return '';
  if (code === '1')   return '1"';
  if (code === '15')  return '1 1/2"';
  if (code === '175') return '1 3/4"';
  if (code === '2')   return '2"';
  if (code === '25')  return '2 1/2"';
  if (code === '3')   return '3"';
  if (code === '4')   return '4"';
  if (code === '5')   return '5"';
  return code + '"';
}

function fmPrettySbTipFromCode(code) {
  if (!code) return '';
  if (code === '78')   return '7/8"';
  if (code === '1516') return '15/16"';
  if (code === '1')    return '1"';
  if (code === '118')  return '1 1/8"';
  return code + '" tip';
}

function fmPrettyNozzleLabelFromId(id) {
  if (!id) return '';

  // Pattern: fog_xd_175_75_185 → type_model_diaCode_NP_GPM
  const fogParts = id.split('_');
  if (fogParts.length === 5 && fogParts[0] === 'fog') {
    const [, model, diaCode, npRaw, gpmRaw] = fogParts;
    const dia = fmPrettyDiaFromCode(diaCode);
    const np  = Number(npRaw) || npRaw;
    const gpm = Number(gpmRaw) || gpmRaw;
    const modelLabel = model.toUpperCase();
    return dia + ' ' + modelLabel + ' fog ' + gpm + ' gpm @ ' + np + ' psi';
  }

  // Smooth bore pattern: sb_78_50_160 → tipCode_NP_GPM
  const sbMatch = id.match(/^sb_([^_]+)_([^_]+)_([^_]+)/);
  if (sbMatch) {
    const tipCode = sbMatch[1];
    const npRaw   = sbMatch[2];
    const gpmRaw  = sbMatch[3];
    const tip = fmPrettySbTipFromCode(tipCode);
    const np  = Number(npRaw) || npRaw;
    const gpm = Number(gpmRaw) || gpmRaw;
    return tip + ' smooth bore ' + gpm + ' gpm @ ' + np + ' psi';
  }

  // Generic fallback
  return id;
}

// Normalize dept hoses/nozzles into [{id,label,...}, ...]
function fmNormalizeDeptList(list, kind) {
  if (!Array.isArray(list)) return [];

  return list.map((item, idx) => {
    if (item && typeof item === 'object') {
      const id = item.id != null
        ? String(item.id)
        : String(item.value ?? item.name ?? idx);
      let label = item.label || item.name || '';

      if (!label || label === id) {
        if (kind === 'hose') {
          label = fmPrettyHoseLabelFromId(id);
        } else if (kind === 'nozzle') {
          label = fmPrettyNozzleLabelFromId(id);
        } else {
          label = id;
        }
      }

      return { ...item, id, label };
    }

    const id = String(item);
    let label = id;
    if (kind === 'hose') {
      label = fmPrettyHoseLabelFromId(id);
    } else if (kind === 'nozzle') {
      label = fmPrettyNozzleLabelFromId(id);
    }
    return { id, label, raw: item };
  });
}
export function openFoamPopup({
  dept = {},
  initial = null,
  onSave = () => {},
} = {}) {
  injectFoamStyles();

  const nozzles = fmNormalizeDeptList(dept.nozzles || [], 'nozzle');
  const hoses   = fmNormalizeDeptList(dept.hoses   || [], 'hose');

  const state = {
    foamType: 'classA',        // 'classA' | 'classB'
    systemType: 'eductor',     // 'eductor' | 'around' | 'batch' | 'cafs'
    useNozzleFlow: !!nozzles.length,
    nozzleId: nozzles[0]?.id || '',
    waterGpm: 150,
    foamPercent: 0.3,          // default Class A 0.3%
    foamTankGal: 30,
    waterTankGal: 500,
    eductorRatedGpm: 125,
    eductorPdp: 200,           // PDP for eductor
    targetPdp: '',             // generic PDP for non-eductor if you want
  };

  if (initial && typeof initial === 'object') {
    Object.assign(state, initial);
  }

  // --- Popup skeleton ---
  const overlay = document.createElement('div');
  overlay.className = 'fm-overlay';

  const panel = document.createElement('div');
  panel.className = 'fm-panel';

  const header = document.createElement('div');
  header.className = 'fm-header';

  const title = document.createElement('div');
  title.className = 'fm-title';
  title.textContent = 'Foam system setup';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'fm-close';
  closeBtn.textContent = '✕';

  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'fm-body';

  const footer = document.createElement('div');
  footer.className = 'fm-footer';

  const explainBtn = document.createElement('button');
  explainBtn.type = 'button';
  explainBtn.className = 'fm-btn-secondary';
  explainBtn.textContent = 'Explain math';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'fm-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'fm-btn-primary';
  saveBtn.textContent = 'Save';

  footer.append(explainBtn, cancelBtn, saveBtn);

  panel.append(header, body, footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener('click', () => close());
  cancelBtn.addEventListener('click', () => close());

  // --- Preview bar ---
  const previewBar = document.createElement('div');
  previewBar.className = 'fm-preview';

  function updateWaterGpmFromNozzle() {
    if (!state.useNozzleFlow) return;
    const gpm = fmParseGpmFromNozzle(nozzles, state.nozzleId);
    if (gpm != null) state.waterGpm = gpm;
  }

  function updatePreview() {
    if (state.useNozzleFlow && state.nozzleId) {
      updateWaterGpmFromNozzle();
    }
    const vals = calcFoamNumbers(state);

    let line1 = `Water: ${vals.waterGpm} gpm  |  Foam: ${vals.foamGpm} gpm @ ${vals.foamPercent}%`;
    let line2 = `Solution: ${vals.solutionGpm} gpm`;

    if (vals.foamRuntimeMin != null || vals.waterRuntimeMin != null) {
      const foamRun   = vals.foamRuntimeMin  != null ? `${vals.foamRuntimeMin.toFixed(1)} min foam`   : '—';
      const waterRun  = vals.waterRuntimeMin != null ? `${vals.waterRuntimeMin.toFixed(1)} min water` : '—';
      line2 += `  |  Tank runtime: ${foamRun}, ${waterRun}`;
    }

    if (vals.pdp != null) {
      line2 += `  |  PDP: ${Math.round(vals.pdp)} psi`;
    }

    previewBar.textContent = `${line1}   •   ${line2}`;
  }

  // --- Explain math popup ---
  function openExplainPopup() {
    const vals = calcFoamNumbers(state);
    const overlay2 = document.createElement('div');
    overlay2.className = 'fm-explain-overlay';

    const panel2 = document.createElement('div');
    panel2.className = 'fm-explain-panel';

    const header2 = document.createElement('div');
    header2.className = 'fm-explain-header';

    const title2 = document.createElement('div');
    title2.className = 'fm-explain-title';
    title2.textContent = 'Foam system math breakdown';

    const close2 = document.createElement('button');
    close2.type = 'button';
    close2.className = 'fm-close';
    close2.textContent = '✕';

    header2.append(title2, close2);

    const body2 = document.createElement('div');
    body2.className = 'fm-explain-body';

    const sysLabelMap = {
      eductor: 'In-line eductor',
      around:  'Around-the-pump',
      batch:   'Batch mix',
      cafs:    'CAFS',
    };
    const foamLabel = state.foamType === 'classB' ? 'Class B foam' : 'Class A foam';
    const sysLabel  = sysLabelMap[state.systemType] || state.systemType;

    let foamRuntime = '—';
    if (vals.foamRuntimeMin != null) {
      foamRuntime = `${vals.foamRuntimeMin.toFixed(1)} minutes`;
    }
    let waterRuntime = '—';
    if (vals.waterRuntimeMin != null) {
      waterRuntime = `${vals.waterRuntimeMin.toFixed(1)} minutes`;
    }

    const pdpText = vals.pdp != null
      ? `<li>Target PDP: <code>${Math.round(vals.pdp)} psi</code></li>`
      : '';

    body2.innerHTML = `
      <p>This foam preset assumes a ${foamLabel} using a <code>${sysLabel}</code> system.</p>

      <p><strong>Inputs:</strong></p>
      <ul>
        <li>Water flow: <code>${vals.waterGpm} gpm</code></li>
        <li>Foam percentage: <code>${vals.foamPercent || 0}%</code></li>
        <li>Foam tank: <code>${state.foamTankGal || 0} gal</code></li>
        <li>Water tank: <code>${state.waterTankGal || 0} gal</code></li>
        ${state.systemType === 'eductor' ? `
          <li>Eductor rated flow: <code>${state.eductorRatedGpm || 0} gpm</code></li>
          <li>Eductor PDP: <code>${state.eductorPdp || 0} psi</code></li>
        ` : ''}
        ${pdpText}
      </ul>

      <p><strong>Step 1 – Foam concentrate flow:</strong></p>
      <p>
        We convert foam % into a fraction and multiply by water GPM.<br>
        <code>
          Foam GPM = Water GPM × (Foam% / 100)
          = ${vals.waterGpm} × (${state.foamPercent || 0}/100)
          ≈ ${vals.foamGpm} gpm
        </code>
      </p>

      <p><strong>Step 2 – Foam solution flow:</strong></p>
      <p>
        Foam solution is water + concentrate.<br>
        <code>
          Solution GPM = Water GPM + Foam GPM
          ≈ ${vals.solutionGpm} gpm
        </code>
      </p>

      <p><strong>Step 3 – Foam tank runtime:</strong></p>
      <p>
        If foam tank is <code>${state.foamTankGal || 0} gal</code> and foam GPM is <code>${vals.foamGpm} gpm</code>:<br>
        <code>
          Runtime_foam = Tank_foam / Foam_GPM
          = ${state.foamTankGal || 0} / ${vals.foamGpm || 1}
          ≈ ${foamRuntime}
        </code>
      </p>

      <p><strong>Step 4 – Water tank runtime:</strong></p>
      <p>
        If water tank is <code>${state.waterTankGal || 0} gal</code> and water GPM is <code>${vals.waterGpm} gpm</code>:<br>
        <code>
          Runtime_water = Tank_water / Water_GPM
          = ${state.waterTankGal || 0} / ${vals.waterGpm || 1}
          ≈ ${waterRuntime}
        </code>
      </p>

      ${state.systemType === 'eductor' ? `
      <p><strong>Step 5 – Eductor PDP:</strong></p>
      <p>
        For in-line eductors we typically use a fixed PDP, such as 200 psi at the eductor inlet.<br>
        <code>
          PDP (at eductor) ≈ ${state.eductorPdp || 200} psi
        </code><br>
        Additional hose friction loss (engine → eductor and eductor → nozzle) can be added in the
        main pump calculator if you want a full FL breakdown.
      </p>
      ` : `
      <p><strong>Step 5 – Pump pressure (PDP):</strong></p>
      <p>
        For around-the-pump, batch mix, or CAFS systems, PDP depends on your hose layout and
        nozzle choice. You can store a target PDP here and use the main calculator to break out
        friction loss and elevation.
      </p>
      `}

      <p>This popup is meant to answer: "If I flow this much water at this foam percentage,
      how fast do I burn through the foam tank and water tank, and what PDP am I aiming for?"</p>
    `;

    const footer2 = document.createElement('div');
    footer2.className = 'fm-explain-footer';

    const ok2 = document.createElement('button');
    ok2.type = 'button';
    ok2.className = 'fm-btn-primary';
    ok2.textContent = 'Close';

    footer2.appendChild(ok2);

    panel2.append(header2, body2, footer2);
    overlay2.appendChild(panel2);
    document.body.appendChild(overlay2);

    function closeExplain() {
      if (overlay2.parentNode) overlay2.parentNode.removeChild(overlay2);
    }

    overlay2.addEventListener('click', (e) => {
      if (e.target === overlay2) closeExplain();
    });
    close2.addEventListener('click', closeExplain);
    ok2.addEventListener('click', closeExplain);
  }

  explainBtn.addEventListener('click', openExplainPopup);

  // --- UI: foam type + system type toggles ---

  const foamTypeToggle = (() => {
    const classABtn = fmEl('button', {
      text: 'Class A',
      onclick: (e) => {
        e.preventDefault();
        state.foamType = 'classA';
        if (!initial) {
          state.foamPercent = 0.3; // default Class A
        }
        refresh();
        updatePreview();
      }
    });
    const classBBtn = fmEl('button', {
      text: 'Class B',
      onclick: (e) => {
        e.preventDefault();
        state.foamType = 'classB';
        if (!initial) {
          state.foamPercent = 3; // default Class B mid-range
        }
        refresh();
        updatePreview();
      }
    });
    function refresh() {
      classABtn.classList.toggle('fm-toggle-on', state.foamType === 'classA');
      classBBtn.classList.toggle('fm-toggle-on', state.foamType === 'classB');
    }
    refresh();
    return { root: fmEl('span', { class: 'fm-toggle-group' }, classABtn, classBBtn), refresh };
  })();

  const systemTypeToggle = (() => {
    function makeBtn(id, label) {
      return fmEl('button', {
        text: label,
        onclick: (e) => {
          e.preventDefault();
          state.systemType = id;
          refresh();
          updatePreview();
          renderSystemSpecific();
        }
      });
    }

    const eductorBtn = makeBtn('eductor', 'Eductor');
    const aroundBtn  = makeBtn('around',  'Around-pump');
    const batchBtn   = makeBtn('batch',   'Batch mix');
    const cafsBtn    = makeBtn('cafs',    'CAFS');

    function refresh() {
      [eductorBtn, aroundBtn, batchBtn, cafsBtn].forEach(btn => {
        const id = btn.textContent.toLowerCase().includes('eductor') ? 'eductor'
                 : btn.textContent.toLowerCase().includes('around') ? 'around'
                 : btn.textContent.toLowerCase().includes('batch') ? 'batch'
                 : 'cafs';
        btn.classList.toggle('fm-toggle-on', state.systemType === id);
      });
    }
    refresh();
    return {
      root: fmEl('span', { class: 'fm-toggle-group' }, eductorBtn, aroundBtn, batchBtn, cafsBtn),
      refresh
    };
  })();

  // --- Sections ---

  const topSection = fmEl('div', { class: 'fm-section' },
    fmEl('h3', { text: 'Foam type & system' }),
    fmEl('div', { class: 'fm-row' },
      fmEl('label', { text: 'Foam type:' }),
      foamTypeToggle.root
    ),
    fmEl('div', { class: 'fm-row' },
      fmEl('label', { text: 'System type:' }),
      systemTypeToggle.root
    )
  );

  const flowSection = fmEl('div', { class: 'fm-section' },
    fmEl('h3', { text: 'Flow & percentages' })
  );

  // Nozzle + GPM row (optionally use nozzle flow if available)
  const flowRow = fmEl('div', { class: 'fm-row' });

  if (nozzles.length) {
    // Toggle: use nozzle flow vs manual GPM
    const useNozBtn = fmEl('button', {
      text: 'Use nozzle GPM',
      onclick: (e) => {
        e.preventDefault();
        state.useNozzleFlow = true;
        refresh();
        updatePreview();
      }
    });
    const manualBtn = fmEl('button', {
      text: 'Manual GPM',
      onclick: (e) => {
        e.preventDefault();
        state.useNozzleFlow = false;
        refresh();
        updatePreview();
      }
    });
    function refresh() {
      useNozBtn.classList.toggle('fm-toggle-on', state.useNozzleFlow);
      manualBtn.classList.toggle('fm-toggle-on', !state.useNozzleFlow);
    }
    refresh();

    const modeToggle = fmEl('span', { class: 'fm-toggle-group' }, useNozBtn, manualBtn);

    const nozzleSelect = fmSelect(nozzles, state.nozzleId, v => {
      state.nozzleId = v;
      if (state.useNozzleFlow) updateWaterGpmFromNozzle();
      updatePreview();
    });

    flowRow.append(
      fmEl('label', { text: 'Water flow:' }),
      modeToggle,
      fmEl('span', { text: 'Nozzle:' }),
      nozzleSelect,
      fmEl('span', { text: 'GPM:' }),
      fmNumberInput(state.waterGpm, v => { state.waterGpm = v; updatePreview(); })
    );
  } else if (hoses.length) {
    // If we have hoses but no specific foam nozzles, still show a hose dropdown
    // so the user can document which line they are foaming.
    const hoseSelect = fmSelect(hoses, state.hoseId || hoses[0]?.id || '', v => {
      state.hoseId = v;
      updatePreview();
    });
    flowRow.append(
      fmEl('label', { text: 'Water flow:' }),
      fmEl('span', { text: 'Hose:' }),
      hoseSelect,
      fmEl('span', { text: 'GPM:' }),
      fmNumberInput(state.waterGpm, v => { state.waterGpm = v; updatePreview(); })
    );
  } else {
    flowRow.append(
      fmEl('label', { text: 'Water flow:' }),
      fmNumberInput(state.waterGpm, v => { state.waterGpm = v; updatePreview(); }),
      fmEl('span', { text: 'gpm' })
    );
  }

  const percentRow = fmEl('div', { class: 'fm-row' },
    fmEl('label', { text: 'Foam %:' }),
    fmNumberInput(state.foamPercent, v => { state.foamPercent = v; updatePreview(); }, { step: '0.1' }),
    fmEl('span', { text: '%' }),
    fmEl('span', {
      text: state.foamType === 'classA'
        ? 'Typical Class A: 0.1–1%'
        : 'Typical Class B: 1–6%'
    })
  );

  const tankRow = fmEl('div', { class: 'fm-row' },
    fmEl('label', { text: 'Tank sizes:' }),
    fmEl('span', { text: 'Foam:' }),
    fmNumberInput(state.foamTankGal, v => { state.foamTankGal = v; updatePreview(); }),
    fmEl('span', { text: 'gal' }),
    fmEl('span', { text: 'Water:' }),
    fmNumberInput(state.waterTankGal, v => { state.waterTankGal = v; updatePreview(); }),
    fmEl('span', { text: 'gal' })
  );

  flowSection.append(flowRow, percentRow, tankRow);

  // System-specific section
  const systemSection = fmEl('div', { class: 'fm-section' },
    fmEl('h3', { text: 'System-specific settings' })
  );
  const systemContent = fmEl('div');

  systemSection.append(systemContent);

  function renderSystemSpecific() {
    systemContent.innerHTML = '';

    if (state.systemType === 'eductor') {
      systemContent.append(
        fmEl('div', { class: 'fm-subsection' },
          fmEl('h4', { text: 'In-line eductor' }),
          fmEl('div', { class: 'fm-row' },
            fmEl('label', { text: 'Eductor rated GPM:' }),
            fmNumberInput(state.eductorRatedGpm, v => { state.eductorRatedGpm = v; updatePreview(); }),
            fmEl('span', { text: 'gpm' })
          ),
          fmEl('div', { class: 'fm-row' },
            fmEl('label', { text: 'Eductor PDP:' }),
            fmNumberInput(state.eductorPdp, v => { state.eductorPdp = v; updatePreview(); }),
            fmEl('span', { text: 'psi at eductor inlet' })
          )
        )
      );
    } else {
      // For other systems, let user optionally store a "target PDP"
      systemContent.append(
        fmEl('div', { class: 'fm-subsection' },
          fmEl('h4', { text: 'Pump pressure target (optional)' }),
          fmEl('div', { class: 'fm-row' },
            fmEl('label', { text: 'Target PDP:' }),
            fmNumberInput(state.targetPdp, v => { state.targetPdp = v; updatePreview(); }),
            fmEl('span', { text: 'psi (from main hose calc)' })
          )
        )
      );
    }
  }

  renderSystemSpecific();

  body.append(topSection, flowSection, systemSection, previewBar);
  updatePreview();

  // Save handler – returns a compact config
  saveBtn.addEventListener('click', () => {
    const payload = {
      foamType: state.foamType,
      systemType: state.systemType,
      useNozzleFlow: state.useNozzleFlow,
      nozzleId: state.nozzleId,
      waterGpm: state.waterGpm,
      foamPercent: state.foamPercent,
      foamTankGal: state.foamTankGal,
      waterTankGal: state.waterTankGal,
      eductorRatedGpm: state.eductorRatedGpm,
      eductorPdp: state.eductorPdp,
      targetPdp: state.targetPdp,
      lastCalc: calcFoamNumbers(state),
    };
    onSave(payload);
    close();
  });
}
