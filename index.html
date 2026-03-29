// view.lineFoam.js
// Simpler foam popup builder for a single line.
//
// Goals:
// - Make foam setup easier to understand
// - Use guided sections
// - Show only the fields that matter
// - Add common foam % presets
// - Give a cleaner summary card
// - Add a batch-mix helper

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
    padding-top: 32px;
    z-index: 10080;
    overflow-y: auto;
  }

  .fm-panel {
    position: relative;
    max-width: 560px;
    width: 100%;
    margin: 0 12px 24px;
    background: #020617;
    border-radius: 18px;
    box-shadow:
      0 18px 30px rgba(15, 23, 42, 0.85),
      0 0 0 1px rgba(148, 163, 184, 0.45);
    padding: 12px 14px 12px;
    color: #e5e7eb;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  @media (min-width: 640px) {
    .fm-panel {
      margin-top: 12px;
      border-radius: 20px;
      padding: 14px 16px 14px;
    }
  }

  .fm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }

  .fm-title {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .fm-close {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.6);
    background: radial-gradient(circle at 30% 30%, #1f2937, #020617);
    color: #e5e7eb;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
  }
  .fm-close:hover {
    background: #111827;
  }

  .fm-body {
    font-size: 0.88rem;
    line-height: 1.45;
    max-height: min(68vh, 620px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .fm-footer {
    display: flex;
    flex-direction: row;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }

  .fm-btn-primary,
  .fm-btn-secondary {
    border-radius: 999px;
    padding: 7px 14px;
    font-size: 0.86rem;
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
    font-weight: 700;
  }

  .fm-btn-secondary {
    background: rgba(15, 23, 42, 0.95);
    color: #e5e7eb;
    border: 1px solid rgba(148, 163, 184, 0.7);
  }

  .fm-btn-primary:active,
  .fm-btn-secondary:active {
    transform: translateY(1px);
  }

  .fm-section {
    border-top: 1px solid rgba(148, 163, 184, 0.25);
    padding-top: 10px;
    margin-top: 10px;
  }
  .fm-section:first-of-type {
    border-top: none;
    margin-top: 0;
    padding-top: 0;
  }

  .fm-section h3 {
    margin: 0 0 8px 0;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #93c5fd;
  }

  .fm-help {
    font-size: 0.8rem;
    color: #cbd5e1;
    opacity: 0.92;
    margin-top: 2px;
  }

  .fm-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }

  .fm-row label {
    font-weight: 600;
    font-size: 0.84rem;
  }

  .fm-row span {
    font-size: 0.82rem;
  }

  .fm-panel input[type="text"],
  .fm-panel input[type="number"],
  .fm-panel select {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid rgba(55, 65, 81, 0.95);
    background: #020617;
    color: #e5e7eb;
    font-size: 0.86rem;
    min-height: 38px;
  }

  .fm-panel input::placeholder {
    color: rgba(148, 163, 184, 0.9);
  }

  .fm-toggle-group {
    display: inline-flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .fm-toggle-group button {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid rgba(75, 85, 99, 0.9);
    background: rgba(15, 23, 42, 0.95);
    font-size: 0.82rem;
    color: #e5e7eb;
    cursor: pointer;
  }

  .fm-toggle-on {
    background: #0ea5e9 !important;
    border-color: #0ea5e9 !important;
    color: #020617 !important;
    font-weight: 700;
  }

  .fm-chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  .fm-chip {
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid rgba(59, 130, 246, 0.45);
    background: rgba(15, 23, 42, 0.92);
    color: #dbeafe;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .fm-chip:hover {
    background: rgba(30, 41, 59, 1);
  }

  .fm-grid-2 {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  @media (min-width: 640px) {
    .fm-grid-2 {
      grid-template-columns: 1fr 1fr;
    }
  }

  .fm-card {
    border: 1px solid rgba(30, 64, 175, 0.45);
    background: rgba(15, 23, 42, 0.88);
    border-radius: 12px;
    padding: 10px;
  }

  .fm-card h4 {
    margin: 0 0 6px 0;
    font-size: 0.83rem;
    color: #bfdbfe;
  }

  .fm-summary {
    margin-top: 10px;
    padding: 10px;
    border-radius: 12px;
    background: radial-gradient(circle at 0% 0%, #0f172a, #020617);
    border: 1px solid rgba(37, 99, 235, 0.8);
  }

  .fm-summary-title {
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #93c5fd;
    margin-bottom: 8px;
    font-weight: 700;
  }

  .fm-summary-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }

  @media (min-width: 640px) {
    .fm-summary-grid {
      grid-template-columns: 1fr 1fr;
      column-gap: 14px;
    }
  }

  .fm-summary-item {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 0.84rem;
  }

  .fm-summary-item strong {
    color: #e2e8f0;
    font-weight: 600;
  }

  .fm-summary-item span {
    color: #f8fafc;
    font-weight: 700;
    text-align: right;
  }

  .fm-note {
    margin-top: 8px;
    font-size: 0.8rem;
    color: #cbd5e1;
  }

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
    max-width: 520px;
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
  if (opts.text != null) e.textContent = opts.text;
  if (opts.type) e.type = opts.type;
  if (opts.value != null) e.value = opts.value;
  if (opts.placeholder) e.placeholder = opts.placeholder;
  if (opts.for) e.htmlFor = opts.for;
  if (opts.id) e.id = opts.id;
  if (opts.html != null) e.innerHTML = opts.html;
  if (opts.onchange) e.addEventListener('change', opts.onchange);
  if (opts.onclick) e.addEventListener('click', opts.onclick);
  children.forEach(c => e.append(c));
  return e;
}

function fmNumberInput(value, onChange, extra = {}) {
  const input = fmEl('input', {
    type: 'number',
    value: value ?? '',
    step: extra.step ?? '1',
    min: extra.min ?? '0',
    placeholder: extra.placeholder || '',
    onchange: (e) => {
      const raw = e.target.value;
      if (raw === '') onChange('');
      else onChange(Number(raw));
    }
  });
  if (extra.disabled) input.disabled = true;
  return input;
}

function fmSelect(options, current, onChange) {
  const s = fmEl('select', { onchange: e => onChange(e.target.value) });
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.id;
    o.textContent = opt.label;
    if (String(opt.id) === String(current)) o.selected = true;
    s.appendChild(o);
  });
  return s;
}

function fmToggleGroup(items, currentValue, onChange) {
  const root = fmEl('span', { class: 'fm-toggle-group' });
  const buttons = items.map(item => {
    const btn = fmEl('button', {
      type: 'button',
      text: item.label,
      onclick: (e) => {
        e.preventDefault();
        onChange(item.id);
        refresh();
      }
    });
    root.appendChild(btn);
    return { btn, id: item.id };
  });

  function refresh() {
    buttons.forEach(({ btn, id }) => {
      btn.classList.toggle('fm-toggle-on', String(currentValue()) === String(id));
    });
  }

  refresh();
  return { root, refresh };
}

function fmFormatMinutes(v) {
  if (v == null || !isFinite(v)) return '—';
  return `${Math.round(v * 10) / 10} min`;
}

function fmRound1(v) {
  if (!isFinite(v)) return 0;
  return Math.round(v * 10) / 10;
}

function fmParseGpmFromNozzle(nozzles, nozzleId) {
  const noz = nozzles.find(n => String(n.id) === String(nozzleId));
  if (!noz || !noz.label) return null;
  const m = String(noz.label).match(/(\d+)\s*gpm/i);
  return m ? Number(m[1]) : null;
}

function calcFoamNumbers(state) {
  const waterGpm     = Number(state.waterGpm || 0);
  const foamPercent  = Number(state.foamPercent || 0);
  const foamTankGal  = Number(state.foamTankGal || 0);
  const waterTankGal = Number(state.waterTankGal || 0);

  const frac = foamPercent / 100;
  const foamGpm = waterGpm * frac;
  const solutionGpm = waterGpm + foamGpm;

  let foamRuntimeMin = null;
  let waterRuntimeMin = null;

  if (foamGpm > 0 && foamTankGal > 0) {
    foamRuntimeMin = foamTankGal / foamGpm;
  }
  if (waterGpm > 0 && waterTankGal > 0) {
    waterRuntimeMin = waterTankGal / waterGpm;
  }

  let pdp = null;
  if (state.systemType === 'eductor') {
    pdp = Number(state.eductorPdp || 200);
  } else if (state.targetPdp !== '' && state.targetPdp != null) {
    pdp = Number(state.targetPdp || 0);
  }

  const batchFoamNeededGal = waterTankGal > 0
    ? waterTankGal * frac
    : 0;

  return {
    waterGpm: Math.round(waterGpm),
    foamPercent: foamPercent,
    foamGpm: fmRound1(foamGpm),
    solutionGpm: fmRound1(solutionGpm),
    foamRuntimeMin,
    waterRuntimeMin,
    pdp,
    batchFoamNeededGal: fmRound1(batchFoamNeededGal),
  };
}

function _fmDeptEquipRead() {
  try {
    const raw = localStorage.getItem('fireops_dept_equipment_v1');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function _fmGetCustomHoseById(id) {
  const dept = _fmDeptEquipRead();
  const list = dept && Array.isArray(dept.customHoses) ? dept.customHoses : [];
  return list.find(h => h && h.id === id) || null;
}

function _fmDiaToLabel(dia) {
  const raw = String(dia ?? '').trim();
  if (!raw) return '';
  if (/^1\s*3\/4$/i.test(raw)) return '1 3/4"';
  if (/^1\s*1\/2$/i.test(raw)) return '1 1/2"';
  if (/^2\s*1\/2$/i.test(raw)) return '2 1/2"';
  const f = Number(raw);
  if (!isFinite(f)) return '';
  const map = {1:'1"', 1.5:'1 1/2"', 1.75:'1 3/4"', 2:'2"', 2.5:'2 1/2"', 3:'3"', 4:'4"', 5:'5"'};
  for (const k of Object.keys(map)) {
    if (Math.abs(f - Number(k)) < 1e-6) return map[k];
  }
  return `${f}"`;
}

function _fmCleanC(v) {
  const n = Number(v);
  if (!isFinite(n)) return '';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function fmPrettyHoseLabelFromId(id) {
  if (!id) return '';
  if (id === 'h_1') return '1" attack hose';
  if (id === 'h_15') return '1 1/2" attack hose';
  if (id === 'h_175') return '1 3/4" attack hose';
  if (id === 'h_2') return '2" attack hose';
  if (id === 'h_25') return '2 1/2" attack hose';
  if (id === 'h_3') return '3" attack hose';
  if (id === 'h_3_supply') return '3" supply line';
  if (id === 'h_4_ldh') return '4" LDH supply';
  if (id === 'h_5_ldh') return '5" LDH supply';
  if (id === 'h_w_1') return '1" wildland hose';
  if (id === 'h_w_15') return '1 1/2" wildland hose';
  if (id === 'h_booster_1') return '1" booster reel';
  if (id === 'h_lf_175') return '1 3/4" low-friction attack';
  return id;
}

function fmFormatHoseLabel(hoseOrId) {
  const raw = typeof hoseOrId === 'object'
    ? String(hoseOrId?.id ?? hoseOrId?.value ?? hoseOrId?.name ?? '')
    : String(hoseOrId || '').trim();

  const obj = (hoseOrId && typeof hoseOrId === 'object') ? hoseOrId : null;

  if (/^custom_hose_/i.test(raw)) {
    const saved = _fmGetCustomHoseById(raw);
    const h = (obj || saved) ? { ...(saved || {}), ...(obj || {}) } : null;
    const diaLbl = h ? (_fmDiaToLabel(h.diameter ?? h.dia ?? h.size) || '') : '';
    const cVal = h ? (h.c ?? h.C ?? h.flC ?? h.coeff) : null;
    const cTxt = _fmCleanC(cVal);
    if (diaLbl && cTxt) return `${diaLbl} C${cTxt}`;
    if (diaLbl) return `${diaLbl} C`;
    return 'Custom C';
  }

  if (obj && (obj.diameter || obj.dia || obj.size)) {
    const base = _fmDiaToLabel(obj.diameter ?? obj.dia ?? obj.size) || raw;
    const cTxt = _fmCleanC(obj.c ?? obj.C ?? obj.flC ?? obj.coeff);
    return cTxt ? `${base} C${cTxt}` : base;
  }

  return fmPrettyHoseLabelFromId(raw);
}

function fmPrettyDiaFromCode(code) {
  if (!code) return '';
  if (code === '1') return '1"';
  if (code === '15') return '1 1/2"';
  if (code === '175') return '1 3/4"';
  if (code === '2') return '2"';
  if (code === '25') return '2 1/2"';
  if (code === '3') return '3"';
  if (code === '4') return '4"';
  if (code === '5') return '5"';
  return code + '"';
}

function fmPrettySbTipFromCode(code) {
  if (!code) return '';
  if (code === '78') return '7/8"';
  if (code === '1516') return '15/16"';
  if (code === '1') return '1"';
  if (code === '118') return '1 1/8"';
  return code + '" tip';
}

function fmPrettyNozzleLabelFromId(id) {
  if (!id) return '';

  const fogParts = String(id).split('_');
  if (fogParts.length === 5 && fogParts[0] === 'fog') {
    const [, model, diaCode, npRaw, gpmRaw] = fogParts;
    const dia = fmPrettyDiaFromCode(diaCode);
    const np = Number(npRaw) || npRaw;
    const gpm = Number(gpmRaw) || gpmRaw;
    const modelLabel = model.toUpperCase();
    return `${dia} ${modelLabel} fog ${gpm} gpm @ ${np} psi`;
  }

  const sbMatch = String(id).match(/^sb_([^_]+)_([^_]+)_([^_]+)/);
  if (sbMatch) {
    const tipCode = sbMatch[1];
    const npRaw = sbMatch[2];
    const gpmRaw = sbMatch[3];
    const tip = fmPrettySbTipFromCode(tipCode);
    const np = Number(npRaw) || npRaw;
    const gpm = Number(gpmRaw) || gpmRaw;
    return `${tip} smooth bore ${gpm} gpm @ ${np} psi`;
  }

  return id;
}

function fmNormalizeDeptList(list, kind) {
  if (!Array.isArray(list)) return [];

  return list.map((item, idx) => {
    if (item && typeof item === 'object') {
      const id = item.id != null
        ? String(item.id)
        : String(item.value ?? item.name ?? idx);
      let label = item.label || item.name || '';

      if (!label || label === id) {
        if (kind === 'hose') label = fmFormatHoseLabel({ ...item, id });
        else if (kind === 'nozzle') label = fmPrettyNozzleLabelFromId(id);
        else label = id;
      }

      return { ...item, id, label };
    }

    const id = String(item);
    let label = id;
    if (kind === 'hose') label = fmFormatHoseLabel({ id });
    if (kind === 'nozzle') label = fmPrettyNozzleLabelFromId(id);
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
  const hoses = fmNormalizeDeptList(dept.hoses || [], 'hose');

  const state = {
    foamType: 'classA',
    systemType: 'eductor',
    flowSource: nozzles.length ? 'nozzle' : 'manual',
    nozzleId: nozzles[0]?.id || '',
    hoseId: hoses[0]?.id || '',
    waterGpm: 150,
    foamPercent: 0.3,
    foamTankGal: 30,
    waterTankGal: 500,
    eductorRatedGpm: 125,
    eductorPdp: 200,
    targetPdp: '',
  };

  if (initial && typeof initial === 'object') {
    Object.assign(state, initial);

    if (typeof initial.useNozzleFlow === 'boolean') {
      state.flowSource = initial.useNozzleFlow ? 'nozzle' : 'manual';
    } else if (!state.flowSource) {
      state.flowSource = nozzles.length ? 'nozzle' : 'manual';
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'fm-overlay';

  const panel = document.createElement('div');
  panel.className = 'fm-panel';

  const header = document.createElement('div');
  header.className = 'fm-header';

  const title = document.createElement('div');
  title.className = 'fm-title';
  title.textContent = 'Foam line setup';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'fm-close';
  closeBtn.textContent = '✕';

  header.append(title, closeBtn);

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
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);

  const foamTypeToggle = fmToggleGroup([
    { id: 'classA', label: 'Class A' },
    { id: 'classB', label: 'Class B' },
  ], () => state.foamType, (val) => {
    state.foamType = val;
    if (val === 'classA' && (!state.foamPercent || state.foamPercent >= 1)) {
      state.foamPercent = 0.3;
    }
    if (val === 'classB' && (!state.foamPercent || state.foamPercent < 1)) {
      state.foamPercent = 3;
    }
    rerender();
  });

  const systemTypeToggle = fmToggleGroup([
    { id: 'eductor', label: 'Inline eductor' },
    { id: 'around', label: 'Around-the-pump' },
    { id: 'batch', label: 'Batch mix' },
    { id: 'cafs', label: 'CAFS' },
  ], () => state.systemType, (val) => {
    state.systemType = val;
    rerender();
  });

  const flowSourceToggle = fmToggleGroup([
    { id: 'nozzle', label: 'Use nozzle flow' },
    { id: 'manual', label: 'Enter flow manually' },
  ], () => state.flowSource, (val) => {
    state.flowSource = val;
    rerender();
  });

  const summaryCard = fmEl('div', { class: 'fm-summary' });
  const summaryGrid = fmEl('div', { class: 'fm-summary-grid' });
  summaryCard.append(
    fmEl('div', { class: 'fm-summary-title', text: 'Foam summary' }),
    summaryGrid
  );

  function updateWaterGpmFromNozzle() {
    if (state.flowSource !== 'nozzle') return;
    const gpm = fmParseGpmFromNozzle(nozzles, state.nozzleId);
    if (gpm != null) state.waterGpm = gpm;
  }

  function getFoamPresetButtons() {
    const presets = state.foamType === 'classA'
      ? [
          { label: 'Mop up 0.3%', value: 0.3 },
          { label: 'Wet line 0.5%', value: 0.5 },
          { label: 'Heavy Class A 1%', value: 1.0 },
        ]
      : [
          { label: 'Hydrocarbon 3%', value: 3 },
          { label: 'Polar solvent 6%', value: 6 },
          { label: 'Light Class B 1%', value: 1 },
        ];

    const row = fmEl('div', { class: 'fm-chip-group' });
    presets.forEach(p => {
      row.appendChild(fmEl('button', {
        class: 'fm-chip',
        type: 'button',
        text: p.label,
        onclick: (e) => {
          e.preventDefault();
          state.foamPercent = p.value;
          rerender();
        }
      }));
    });
    return row;
  }

  function updateSummary() {
    updateWaterGpmFromNozzle();
    const vals = calcFoamNumbers(state);

    summaryGrid.innerHTML = '';

    const items = [
      ['Foam type', state.foamType === 'classB' ? 'Class B' : 'Class A'],
      ['System', state.systemType === 'eductor'
        ? 'Inline eductor'
        : state.systemType === 'around'
          ? 'Around-the-pump'
          : state.systemType === 'batch'
            ? 'Batch mix'
            : 'CAFS'],
      ['Water flow', `${vals.waterGpm} gpm`],
      ['Foam mix', `${vals.foamPercent}%`],
      ['Foam concentrate', `${vals.foamGpm} gpm`],
      ['Total solution', `${vals.solutionGpm} gpm`],
      ['Foam runtime', fmFormatMinutes(vals.foamRuntimeMin)],
      ['Water runtime', fmFormatMinutes(vals.waterRuntimeMin)],
    ];

    if (vals.pdp != null) {
      items.push(['Target PDP', `${Math.round(vals.pdp)} psi`]);
    }

    if (state.systemType === 'batch' && Number(state.waterTankGal || 0) > 0) {
      items.push(['Foam to add', `${vals.batchFoamNeededGal} gal`]);
    }

    items.forEach(([label, value]) => {
      summaryGrid.appendChild(
        fmEl('div', { class: 'fm-summary-item' },
          fmEl('strong', { text: label }),
          fmEl('span', { text: value })
        )
      );
    });

    let noteText = 'Use this summary to quickly see flow, mix, runtime, and pump pressure target.';
    if (state.systemType === 'batch') {
      noteText = `Batch mix helper: add about ${vals.batchFoamNeededGal} gallons of concentrate to ${Number(state.waterTankGal || 0)} gallons of water.`;
    } else if (state.systemType === 'eductor') {
      noteText = 'Inline eductor mode uses the eductor inlet pump pressure you enter below.';
    }
    const old = summaryCard.querySelector('.fm-note');
    if (old) old.remove();
    summaryCard.appendChild(fmEl('div', { class: 'fm-note', text: noteText }));
  }

  function openExplainPopup() {
    updateWaterGpmFromNozzle();
    const vals = calcFoamNumbers(state);

    const overlay2 = document.createElement('div');
    overlay2.className = 'fm-explain-overlay';

    const panel2 = document.createElement('div');
    panel2.className = 'fm-explain-panel';

    const header2 = document.createElement('div');
    header2.className = 'fm-explain-header';

    const title2 = document.createElement('div');
    title2.className = 'fm-explain-title';
    title2.textContent = 'Foam math breakdown';

    const close2 = document.createElement('button');
    close2.type = 'button';
    close2.className = 'fm-close';
    close2.textContent = '✕';

    header2.append(title2, close2);

    const body2 = document.createElement('div');
    body2.className = 'fm-explain-body';

    const runtimeFoamText = vals.foamRuntimeMin != null ? `${fmRound1(vals.foamRuntimeMin)} minutes` : '—';
    const runtimeWaterText = vals.waterRuntimeMin != null ? `${fmRound1(vals.waterRuntimeMin)} minutes` : '—';

    body2.innerHTML = `
      <p><strong>Water flow:</strong> <code>${vals.waterGpm} gpm</code></p>
      <p><strong>Foam percentage:</strong> <code>${vals.foamPercent}%</code></p>

      <p><strong>Foam concentrate flow:</strong></p>
      <p><code>Foam GPM = Water GPM × (Foam% / 100)</code></p>
      <p><code>${vals.waterGpm} × (${vals.foamPercent} / 100) = ${vals.foamGpm} gpm</code></p>

      <p><strong>Total finished solution:</strong></p>
      <p><code>Solution GPM = Water GPM + Foam GPM = ${vals.solutionGpm} gpm</code></p>

      <p><strong>Foam tank runtime:</strong></p>
      <p><code>${Number(state.foamTankGal || 0)} gal / ${vals.foamGpm || 1} gpm = ${runtimeFoamText}</code></p>

      <p><strong>Water tank runtime:</strong></p>
      <p><code>${Number(state.waterTankGal || 0)} gal / ${vals.waterGpm || 1} gpm = ${runtimeWaterText}</code></p>

      ${state.systemType === 'batch' ? `
        <p><strong>Batch mix helper:</strong></p>
        <p><code>Foam needed = Water tank gallons × (Foam% / 100)</code></p>
        <p><code>${Number(state.waterTankGal || 0)} × (${vals.foamPercent} / 100) = ${vals.batchFoamNeededGal} gal</code></p>
      ` : ''}

      ${vals.pdp != null ? `
        <p><strong>Target pump pressure:</strong></p>
        <p><code>${Math.round(vals.pdp)} psi</code></p>
      ` : ''}

      <p>This popup is meant to help answer: how much foam am I using, how long will the tanks last, and what pressure target am I trying to hold?</p>
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

  function renderFlowSection() {
    const section = fmEl('div', { class: 'fm-section' },
      fmEl('h3', { text: '3. What are you flowing?' })
    );

    if (nozzles.length) {
      section.appendChild(
        fmEl('div', { class: 'fm-row' },
          fmEl('label', { text: 'Flow source' }),
          flowSourceToggle.root
        )
      );

      if (state.flowSource === 'nozzle') {
        section.appendChild(
          fmEl('div', { class: 'fm-row' },
            fmEl('label', { text: 'Nozzle' }),
            fmSelect(nozzles, state.nozzleId, (v) => {
              state.nozzleId = v;
              updateWaterGpmFromNozzle();
              updateSummary();
            })
          )
        );
      }
    }

    if (hoses.length) {
      section.appendChild(
        fmEl('div', { class: 'fm-row' },
          fmEl('label', { text: 'Hose' }),
          fmSelect(hoses, state.hoseId, (v) => {
            state.hoseId = v;
            updateSummary();
          })
        )
      );
    }

    section.appendChild(
      fmEl('div', { class: 'fm-row' },
        fmEl('label', { text: 'Water flow (GPM)' }),
        fmNumberInput(state.waterGpm, (v) => {
          state.waterGpm = v;
          updateSummary();
        }, { disabled: state.flowSource === 'nozzle' && nozzles.length })
      )
    );

    return section;
  }

  function renderPercentSection() {
    return fmEl('div', { class: 'fm-section' },
      fmEl('h3', { text: '4. Foam percentage' }),
      fmEl('div', { class: 'fm-help', text: state.foamType === 'classA'
        ? 'Class A often runs around 0.1% to 1%.'
        : 'Class B often runs around 1% to 6%, depending on product and fuel.' }),
      fmEl('div', { class: 'fm-row' },
        fmEl('label', { text: 'Foam %' }),
        fmNumberInput(state.foamPercent, (v) => {
          state.foamPercent = v;
          updateSummary();
        }, { step: '0.1' })
      ),
      getFoamPresetButtons()
    );
  }

  function renderSystemSpecificSection() {
    const section = fmEl('div', { class: 'fm-section' },
      fmEl('h3', { text: '5. System details' })
    );

    if (state.systemType === 'eductor') {
      section.appendChild(
        fmEl('div', { class: 'fm-grid-2' },
          fmEl('div', { class: 'fm-card' },
            fmEl('h4', { text: 'Inline eductor settings' }),
            fmEl('div', { class: 'fm-row' },
              fmEl('label', { text: 'Eductor rated flow' }),
              fmNumberInput(state.eductorRatedGpm, (v) => {
                state.eductorRatedGpm = v;
                updateSummary();
              })
            ),
            fmEl('div', { class: 'fm-row' },
              fmEl('label', { text: 'Eductor inlet PDP' }),
              fmNumberInput(state.eductorPdp, (v) => {
                state.eductorPdp = v;
                updateSummary();
              })
            )
          ),
          fmEl('div', { class: 'fm-card' },
            fmEl('h4', { text: 'Quick reminder' }),
            fmEl('div', { class: 'fm-help', text: 'Use the eductor inlet pressure your department runs, often around 200 psi. Match your nozzle and hose package to the eductor setup.' })
          )
        )
      );
      return section;
    }

    if (state.systemType === 'batch') {
      section.appendChild(
        fmEl('div', { class: 'fm-card' },
          fmEl('h4', { text: 'Batch mix helper' }),
          fmEl('div', { class: 'fm-help', text: 'Enter your water tank size and foam % below. The summary card will tell you how many gallons of concentrate to add.' })
        )
      );
      return section;
    }

    section.appendChild(
      fmEl('div', { class: 'fm-card' },
        fmEl('h4', { text: 'Pump pressure target' }),
        fmEl('div', { class: 'fm-row' },
          fmEl('label', { text: 'Target PDP (optional)' }),
          fmNumberInput(state.targetPdp, (v) => {
            state.targetPdp = v;
            updateSummary();
          })
        ),
        fmEl('div', { class: 'fm-help', text: 'Use this if you already know the pressure target from the main hose calculator.' })
      )
    );

    return section;
  }

  function renderTankSection() {
    return fmEl('div', { class: 'fm-section' },
      fmEl('h3', { text: '6. Available tank volume' }),
      fmEl('div', { class: 'fm-grid-2' },
        fmEl('div', { class: 'fm-card' },
          fmEl('h4', { text: 'Foam concentrate tank' }),
          fmEl('div', { class: 'fm-row' },
            fmEl('label', { text: 'Foam gallons' }),
            fmNumberInput(state.foamTankGal, (v) => {
              state.foamTankGal = v;
              updateSummary();
            })
          )
        ),
        fmEl('div', { class: 'fm-card' },
          fmEl('h4', { text: 'Water tank' }),
          fmEl('div', { class: 'fm-row' },
            fmEl('label', { text: 'Water gallons' }),
            fmNumberInput(state.waterTankGal, (v) => {
              state.waterTankGal = v;
              updateSummary();
            })
          )
        )
      )
    );
  }

  function rerender() {
    body.innerHTML = '';

    foamTypeToggle.refresh();
    systemTypeToggle.refresh();
    flowSourceToggle.refresh();

    const introSection = fmEl('div', { class: 'fm-section' },
      fmEl('h3', { text: '1. Foam type' }),
      fmEl('div', { class: 'fm-row' },
        fmEl('label', { text: 'Choose foam type' }),
        foamTypeToggle.root
      ),
      fmEl('div', { class: 'fm-help', text: state.foamType === 'classA'
        ? 'Class A is usually used for ordinary combustibles, wet lines, mop up, and exposures.'
        : 'Class B is usually used for flammable liquids and fuel-related incidents.' })
    );

    const systemSection = fmEl('div', { class: 'fm-section' },
      fmEl('h3', { text: '2. How are you making foam?' }),
      fmEl('div', { class: 'fm-row' },
        fmEl('label', { text: 'Choose system' }),
        systemTypeToggle.root
      ),
      fmEl('div', { class: 'fm-help', text:
        state.systemType === 'eductor'
          ? 'Use this when you are flowing through an inline eductor.'
          : state.systemType === 'around'
            ? 'Use this when your apparatus is proportioning through an around-the-pump setup.'
            : state.systemType === 'batch'
              ? 'Use this when you are mixing concentrate directly into a water tank.'
              : 'Use this when the apparatus is producing compressed air foam.' })
    );

    body.append(
      introSection,
      systemSection,
      renderFlowSection(),
      renderPercentSection(),
      renderSystemSpecificSection(),
      renderTankSection(),
      summaryCard
    );

    updateSummary();
  }

  rerender();

  saveBtn.addEventListener('click', () => {
    updateWaterGpmFromNozzle();

    const payload = {
      foamType: state.foamType,
      systemType: state.systemType,
      flowSource: state.flowSource,
      useNozzleFlow: state.flowSource === 'nozzle',
      nozzleId: state.nozzleId,
      hoseId: state.hoseId,
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
