import { NOZ } from './store.js';
import { getDeptNozzleIds, getDeptHoseDiameters } from './preset.js';

// view.lineMaster.js
// Master stream / Blitz line editor.
//
// Behavior:
// - Deck gun mode:
//    * User chooses the master stream nozzle (from Department Setup).
//    * Flow (GPM) and NP come from that nozzle definition.
//    * Pump pressure for deck gun is fixed at 80 psi (NP only).
// - Portable mode:
//    * User chooses 1 or 2 supply lines.
//    * ONE shared hose size (from Department Setup hoses).
//    * ONE shared line length (ft).
//    * Elevation in feet.
//    * PDP uses hose C (based on diameter), length, elevation, and appliance loss.
//
// This popup does NOT manage saving department setup. It only lets the user
// choose how they are feeding the master stream for the current calc.

///////////////////////////////////////////////////////////////////////////////
// Simple DOM helpers
///////////////////////////////////////////////////////////////////////////////

let msStylesInjected = false;

function injectMsStyles() {
  if (msStylesInjected) return;
  msStylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    .ms-overlay {
      position: fixed;
      inset: 0;
      background: rgba(3, 7, 18, 0.55);
      backdrop-filter: blur(6px);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding-top: 32px;
      z-index: 10060;
      overflow-y: auto;
    }

    .ms-panel {
      position: relative;
      max-width: 520px;
      width: 100%;
      margin: 0 12px 24px;
      background: #020617;
      border-radius: 18px;
      box-shadow:
        0 20px 35px rgba(15, 23, 42, 0.9),
        0 0 0 1px rgba(148, 163, 184, 0.45);
      padding: 14px 16px 12px;
      color: #e5e7eb;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: 15px;
    }

    @media (min-width: 768px) {
      .ms-panel {
        max-width: 560px;
        padding: 16px 18px 14px;
        font-size: 16px;
      }
    }

    .ms-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.25);
    }

    .ms-title {
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ms-close {
      width: 30px;
      height: 30px;
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
    .ms-close:hover {
      background: #111827;
    }

    .ms-body {
      font-size: 0.95rem;
      line-height: 1.45;
      max-height: min(60vh, 430px);
      overflow-y: auto;
      padding-top: 4px;
      padding-bottom: 4px;
    }

    .ms-footer {
      display: flex;
      flex-direction: row;
      gap: 8px;
      justify-content: flex-end;
      padding-top: 8px;
      border-top: 1px solid rgba(148, 163, 184, 0.25);
    }

    .ms-btn-primary,
    .ms-btn-secondary {
      border-radius: 999px;
      padding: 7px 14px;
      font-size: 0.9rem;
      border: none;
      cursor: pointer;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .ms-btn-primary {
      background: linear-gradient(135deg, #38bdf8, #22c55e);
      color: #020617;
      font-weight: 600;
    }

    .ms-btn-secondary {
      background: rgba(15, 23, 42, 0.95);
      color: #e5e7eb;
      border: 1px solid rgba(148, 163, 184, 0.7);
    }

    .ms-btn-primary:active,
    .ms-btn-secondary:active {
      transform: translateY(1px);
    }

    .ms-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 6px;
    }

    .ms-row label {
      font-weight: 500;
      font-size: 0.9rem;
    }

    .ms-row span {
      font-size: 0.85rem;
      opacity: 0.9;
    }

    .ms-panel input[type="text"],
    .ms-panel input[type="number"],
    .ms-panel select {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid rgba(55, 65, 81, 0.95);
      background: #020617;
      color: #e5e7eb;
      font-size: 16px;
      min-height: 34px;
    }

    .ms-panel select {
      max-width: 100%;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    }

    .ms-panel input::placeholder {
      color: rgba(148, 163, 184, 0.9);
    }

    .ms-section {
      border-top: 1px solid rgba(148, 163, 184, 0.4);
      padding-top: 8px;
      margin-top: 8px;
    }
    .ms-section:first-of-type {
      border-top: none;
    }

    .ms-section h3 {
      margin: 0 0 4px 0;
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #bfdbfe;
    }

    .ms-toggle-group {
      display: inline-flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .ms-toggle-btn {
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid rgba(75, 85, 99, 0.9);
      background: rgba(15, 23, 42, 0.95);
      font-size: 0.85rem;
      color: #e5e7eb;
      cursor: pointer;
      min-width: 80px;
      text-align: center;
    }

    .ms-toggle-btn.ms-toggle-on {
      background: #0ea5e9;
      border-color: #0ea5e9;
      color: #020617;
      font-weight: 600;
      box-shadow: 0 0 0 1px rgba(8, 47, 73, 0.9);
    }

    .ms-preview {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: radial-gradient(circle at 0% 0%, #0f172a, #020617);
      border: 1px solid rgba(37, 99, 235, 0.95);
      font-weight: 700;
      font-size: 1rem;
      text-align: center;
      letter-spacing: 0.02em;
    }

    @media (min-width: 768px) {
      .ms-row {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .ms-row > label {
        min-width: 140px;
      }
      .ms-row input,
      .ms-row select {
        width: auto;
        min-width: 130px;
      }
    }
  `;
  document.head.appendChild(style);
}

function msEl(tag, opts, children) {
  const el = document.createElement(tag || 'div');
  const o = opts || {};
  if (o.className) el.className = o.className;
  if (o.text != null) el.textContent = o.text;
  if (o.type) el.type = o.type;
  if (o.value != null) el.value = o.value;
  if (o.placeholder) el.placeholder = o.placeholder;
  if (o.id) el.id = o.id;
  if (o.htmlFor) el.htmlFor = o.htmlFor;
  if (typeof o.onchange === 'function') el.addEventListener('change', o.onchange);
  if (typeof o.onclick === 'function') el.addEventListener('click', o.onclick);
  if (typeof o.oninput === 'function') el.addEventListener('input', o.oninput);

  if (Array.isArray(children)) {
    children.forEach(c => {
      if (c == null) return;
      el.appendChild(c);
    });
  }
  return el;
}

function msNumberInput(value, onChange, extra) {
  const ex = extra || {};
  const input = msEl('input', {
    type: 'number',
    value: value != null ? String(value) : '',
    oninput: function (e) {
      const raw = e.target.value;
      if (raw === '') {
        onChange('');
      } else {
        const num = Number(raw);
        if (!Number.isNaN(num)) {
          onChange(num);
        }
      }
    }
  });
  if (ex.step != null) input.step = String(ex.step);
  if (ex.min != null) input.min = String(ex.min);
  if (ex.max != null) input.max = String(ex.max);
  return input;
}

function msSelect(options, currentId, onChange) {
  const select = msEl('select', {
    onchange: function (e) {
      onChange(e.target.value);
    }
  });
  (options || []).forEach(function (opt) {
    const o = document.createElement('option');
    o.value = String(opt.id);
    o.textContent = opt.label;
    if (String(opt.id) === String(currentId)) {
      o.selected = true;
    }
    select.appendChild(o);
  });
  return select;
}

///////////////////////////////////////////////////////////////////////////////
// Data helpers – nozzle and hose lists
///////////////////////////////////////////////////////////////////////////////

const MASTER_NOZZLE_IDS = [
  'ms1_3_8_80',
  'ms1_1_2_80',
  'ms1_3_4_80',
  'ms2_80'
];

const MASTER_NP = 80;            // psi
const MASTER_APPLIANCE_LOSS = 25;
const PSI_PER_FT = 0.434;

// Friction-loss C values by diameter (inches as string)
const MS_C_BY_DIA = {
  '1.5': 24,
  '1.75': 15.5,
  '2.0': 8,
  '2.5': 2,
  '3': 0.8,
  '4': 0.2,
  '5': 0.08
};

function formatNozzleLabel(baseLabel, nozzle) {
  const gpm = (nozzle && typeof nozzle.gpm === 'number' && nozzle.gpm > 0)
    ? nozzle.gpm
    : null;
  const np = (nozzle && typeof nozzle.NP === 'number' && nozzle.NP > 0)
    ? nozzle.NP
    : null;

  if (gpm && np) {
    return baseLabel + ' ' + gpm + ' gpm @ ' + np + ' psi';
  }
  if (gpm) {
    return baseLabel + ' ' + gpm + ' gpm';
  }
  return baseLabel;
}

function getMasterNozzleList() {
  let selectedIds = [];
  try {
    const ids = getDeptNozzleIds && getDeptNozzleIds();
    if (Array.isArray(ids)) {
      selectedIds = ids.map(function (id) { return String(id); });
    }
  } catch (e) {
    console.warn('[MasterStream] getDeptNozzleIds failed', e);
  }

  const selectedMasterIds = MASTER_NOZZLE_IDS.filter(function (id) {
    return selectedIds.indexOf(id) !== -1;
  });

  const sourceIds = selectedMasterIds.length ? selectedMasterIds : MASTER_NOZZLE_IDS;

  const list = [];
  sourceIds.forEach(function (id) {
    const noz = NOZ[id];
    if (!noz) return;
    const baseLabel = noz.name || id;
    const label = formatNozzleLabel(baseLabel, noz);
    const gpm = typeof noz.gpm === 'number' ? noz.gpm : 0;
    const np = typeof noz.NP === 'number' ? noz.NP : MASTER_NP;
    list.push({
      id: noz.id || id,
      label: label,
      gpm: gpm,
      NP: np
    });
  });

  if (!list.length) {
    // Final ultra-safe fallback: simple labels, no NOZ data
    MASTER_NOZZLE_IDS.forEach(function (id) {
      list.push({ id: id, label: id, gpm: 0, NP: MASTER_NP });
    });
  }
  return list;
}

function formatHoseLabel(diaStr) {
  const v = String(diaStr);
  if (v === '1.75') return '1 3/4" attack/supply';
  if (v === '1.5') return '1 1/2" attack';
  if (v === '2.0' || v === '2') return '2" supply';
  if (v === '2.5') return '2 1/2" supply';
  if (v === '3') return '3" supply';
  if (v === '4') return '4" LDH supply';
  if (v === '5') return '5" LDH supply';
  return v + '" hose';
}

function getMasterHoseList() {
  let dias = [];
  try {
    const arr = getDeptHoseDiameters && getDeptHoseDiameters();
    if (Array.isArray(arr)) {
      dias = arr.slice().map(function (d) { return String(d); });
    }
  } catch (e) {
    console.warn('[MasterStream] getDeptHoseDiameters failed', e);
  }

  if (dias.length === 0) {
    dias = ['2.5', '3', '4', '5'];
  }

  // De-duplicate and sort by numeric value
  const seen = new Set();
  const sorted = dias
    .filter(function (d) {
      if (!d) return false;
      if (seen.has(d)) return false;
      seen.add(d);
      return true;
    })
    .sort(function (a, b) {
      return parseFloat(a) - parseFloat(b);
    });

  return sorted.map(function (dia) {
    return {
      id: dia,
      label: formatHoseLabel(dia)
    };
  });
}

function findNozzle(nozzles, id) {
  if (!Array.isArray(nozzles) || nozzles.length === 0) return null;
  const sid = String(id);
  for (let i = 0; i < nozzles.length; i++) {
    const n = nozzles[i];
    if (String(n.id) === sid) return n;
  }
  return nozzles[0] || null;
}

function calcMasterNumbers(state, nozzles) {
  const m = state.master;
  const noz = findNozzle(nozzles, m.nozzleId);
  const gpm = noz && typeof noz.gpm === 'number' && noz.gpm > 0
    ? noz.gpm
    : (m.desiredGpm && m.desiredGpm > 0 ? m.desiredGpm : 800);

  if (m.mountType === 'deck') {
    // Deck gun is nozzle directly on the truck: NP only, no FL or elevation.
    const NP = MASTER_NP;
    const PDP = MASTER_NP;
    return {
      mountType: 'deck',
      lines: 0,
      gpm: Math.round(gpm),
      NP: NP,
      FL: 0,
      applianceLoss: 0,
      elevPsi: 0,
      PDP: Math.round(PDP)
    };
  }

  // Portable mode
  const lines = m.feedLines === 2 ? 2 : 1;
  const gpmPerLine = gpm / (lines || 1);
  const diaStr = String(m.supplyDia || '2.5');
  const C = MS_C_BY_DIA[diaStr] != null ? MS_C_BY_DIA[diaStr] : 2;
  const len = m.supplyLengthFt || 0;

  let FL = 0;
  if (C && gpmPerLine > 0 && len > 0) {
    const per100 = C * Math.pow(gpmPerLine / 100, 2);
    FL = per100 * (len / 100);
  }

  const elevPsi = (m.elevationFt || 0) * PSI_PER_FT;
  const NP = MASTER_NP;
  const applianceLoss = MASTER_APPLIANCE_LOSS;
  const PDP = NP + FL + applianceLoss + elevPsi;

  return {
    mountType: 'portable',
    lines: lines,
    gpm: Math.round(gpm),
    NP: NP,
    FL: Math.round(FL),
    applianceLoss: Math.round(applianceLoss),
    elevPsi: Math.round(elevPsi),
    PDP: Math.round(PDP)
  };
}

///////////////////////////////////////////////////////////////////////////////
// Public entry point
///////////////////////////////////////////////////////////////////////////////

export function openMasterStreamPopup(opts) {
  const options = opts || {};
  const onSave = typeof options.onSave === 'function' ? options.onSave : function () {};

  injectMsStyles();

  const nozzles = getMasterNozzleList();
  const hoses = getMasterHoseList();

  const firstNoz = nozzles[0];
  const firstHose = hoses[0];

  const state = {
    master: {
      mountType: 'deck',
      feedLines: 1,
      nozzleId: firstNoz ? firstNoz.id : null,
      desiredGpm: firstNoz ? firstNoz.gpm : 800,
      elevationFt: 0,
      supplyDia: firstHose ? firstHose.id : '2.5',
      supplyLengthFt: 150
    }
  };

  if (options.initial && typeof options.initial === 'object') {
    const src = options.initial.master || options.initial;
    if (src.mountType) state.master.mountType = src.mountType;
    if (src.feedLines != null) state.master.feedLines = src.feedLines;
    if (src.nozzleId != null) state.master.nozzleId = src.nozzleId;
    if (src.desiredGpm != null) state.master.desiredGpm = src.desiredGpm;
    if (src.elevationFt != null) state.master.elevationFt = src.elevationFt;
    if (src.supplyDia != null) state.master.supplyDia = String(src.supplyDia);
    if (src.supplyLengthFt != null) state.master.supplyLengthFt = src.supplyLengthFt;
  }

  const overlay = msEl('div', { className: 'ms-overlay' }, []);
  const panel = msEl('div', { className: 'ms-panel' }, []);

  const header = msEl('div', { className: 'ms-header' }, []);
  const title = msEl('div', { className: 'ms-title', text: 'Master stream setup' }, []);
  const closeBtn = msEl('button', {
    className: 'ms-close',
    type: 'button',
    onclick: function () { closePopup(); }
  }, []);
  closeBtn.textContent = '✕';
  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = msEl('div', { className: 'ms-body' }, []);
  const footer = msEl('div', { className: 'ms-footer' }, []);

  const cancelBtn = msEl('button', {
    className: 'ms-btn-secondary',
    type: 'button',
    onclick: function () { closePopup(); }
  }, []);
  cancelBtn.textContent = 'Cancel';

  const saveBtn = msEl('button', {
    className: 'ms-btn-primary',
    type: 'button',
    onclick: function () {
      const vals = calcMasterNumbers(state, nozzles);
      const payload = {
        mountType: state.master.mountType,
        feedLines: state.master.feedLines,
        nozzleId: state.master.nozzleId,
        desiredGpm: state.master.desiredGpm,
        elevationFt: state.master.elevationFt,
        supplyDia: state.master.supplyDia,
        supplyLengthFt: state.master.supplyLengthFt,
        lastCalc: vals
      };
      onSave(payload);
      closePopup();
    }
  }, []);
  saveBtn.textContent = 'Save';

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  const previewBar = msEl('div', { className: 'ms-preview' }, []);
  function updatePreview() {
    const vals = calcMasterNumbers(state, nozzles);
    const text = 'Master stream – Flow: ' +
      vals.gpm + ' gpm   |   PDP: ' + vals.PDP + ' psi';
    previewBar.textContent = text;
  }

  const topSection = msEl('div', { className: 'ms-section' }, []);
  const mountRow = msEl('div', { className: 'ms-row' }, []);
  const mountLabel = msEl('label', { text: 'Mount:' }, []);

  const deckBtn = msEl('button', {
    className: 'ms-toggle-btn',
    type: 'button',
    onclick: function (e) {
      e.preventDefault();
      state.master.mountType = 'deck';
      refreshToggles();
      refreshVisibility();
      updatePreview();
    }
  }, []);
  deckBtn.textContent = 'Deck Gun';

  const portableBtn = msEl('button', {
    className: 'ms-toggle-btn',
    type: 'button',
    onclick: function (e) {
      e.preventDefault();
      state.master.mountType = 'portable';
      refreshToggles();
      refreshVisibility();
      updatePreview();
    }
  }, []);
  portableBtn.textContent = 'Portable';

  const mountToggleGroup = msEl('span', { className: 'ms-toggle-group' }, []);
  mountToggleGroup.appendChild(deckBtn);
  mountToggleGroup.appendChild(portableBtn);
  mountRow.appendChild(mountLabel);
  mountRow.appendChild(mountToggleGroup);

  const nozzleRow = msEl('div', { className: 'ms-row' }, []);
  const nozzleLabel = msEl('label', { text: 'Nozzle:' }, []);
  let nozzleSelect = msSelect(nozzles, state.master.nozzleId, function (val) {
    state.master.nozzleId = val;
    const noz = findNozzle(nozzles, val);
    if (noz && typeof noz.gpm === 'number' && noz.gpm > 0) {
      state.master.desiredGpm = noz.gpm;
    }
    updatePreview();
  });
  nozzleRow.appendChild(nozzleLabel);
  nozzleRow.appendChild(nozzleSelect);

  const feedRow = msEl('div', { className: 'ms-row' }, []);
  const feedLabel = msEl('label', { text: 'Feed lines:' }, []);
  const oneLineBtn = msEl('button', {
    className: 'ms-toggle-btn',
    type: 'button',
    onclick: function (e) {
      e.preventDefault();
      state.master.feedLines = 1;
      refreshToggles();
      updatePreview();
    }
  }, []);
  oneLineBtn.textContent = '1 line';

  const twoLineBtn = msEl('button', {
    className: 'ms-toggle-btn',
    type: 'button',
    onclick: function (e) {
      e.preventDefault();
      state.master.feedLines = 2;
      refreshToggles();
      updatePreview();
    }
  }, []);
  twoLineBtn.textContent = '2 lines';

  const feedToggleGroup = msEl('span', { className: 'ms-toggle-group' }, []);
  feedToggleGroup.appendChild(oneLineBtn);
  feedToggleGroup.appendChild(twoLineBtn);
  feedRow.appendChild(feedLabel);
  feedRow.appendChild(feedToggleGroup);

  const hoseRow = msEl('div', { className: 'ms-row' }, []);
  const hoseLabel = msEl('label', { text: 'Hose size:' }, []);
  let hoseSelect = msSelect(hoses, state.master.supplyDia, function (val) {
    state.master.supplyDia = val;
    updatePreview();
  });
  hoseRow.appendChild(hoseLabel);
  hoseRow.appendChild(hoseSelect);

  const lengthRow = msEl('div', { className: 'ms-row' }, []);
  const lengthLabel = msEl('label', { text: 'Length:' }, []);
  const lengthInput = msNumberInput(state.master.supplyLengthFt, function (val) {
    state.master.supplyLengthFt = val === '' ? 0 : val;
    updatePreview();
  }, { step: 25, min: 0 });
  const lengthUnits = msEl('span', { text: 'ft (same for both lines if using 2)' }, []);
  lengthRow.appendChild(lengthLabel);
  lengthRow.appendChild(lengthInput);
  lengthRow.appendChild(lengthUnits);

  const elevRow = msEl('div', { className: 'ms-row' }, []);
  const elevLabel = msEl('label', { text: 'Elevation (ft):' }, []);
  const elevInput = msNumberInput(state.master.elevationFt, function (val) {
    state.master.elevationFt = val === '' ? 0 : val;
    updatePreview();
  }, { step: 5 });
  elevRow.appendChild(elevLabel);
  elevRow.appendChild(elevInput);

  topSection.appendChild(msEl('h3', { text: 'Master stream type' }, []));
  topSection.appendChild(mountRow);
  topSection.appendChild(nozzleRow);
  topSection.appendChild(feedRow);
  topSection.appendChild(hoseRow);
  topSection.appendChild(lengthRow);
  topSection.appendChild(elevRow);

  body.appendChild(topSection);
  body.appendChild(previewBar);

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function refreshToggles() {
    const isDeck = state.master.mountType === 'deck';

    if (isDeck) {
      deckBtn.classList.add('ms-toggle-on');
      portableBtn.classList.remove('ms-toggle-on');
    } else {
      deckBtn.classList.remove('ms-toggle-on');
      portableBtn.classList.add('ms-toggle-on');
    }

    if (state.master.feedLines === 2) {
      twoLineBtn.classList.add('ms-toggle-on');
      oneLineBtn.classList.remove('ms-toggle-on');
    } else {
      oneLineBtn.classList.add('ms-toggle-on');
      twoLineBtn.classList.remove('ms-toggle-on');
    }
  }

  function refreshVisibility() {
    const isDeck = state.master.mountType === 'deck';
    // Deck gun: no hose, length, or elevation inputs are needed for PP (fixed 80 psi).
    feedRow.style.display = isDeck ? 'none' : '';
    hoseRow.style.display = isDeck ? 'none' : '';
    lengthRow.style.display = isDeck ? 'none' : '';
    elevRow.style.display = isDeck ? 'none' : '';
  }

  function closePopup() {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) {
      closePopup();
    }
  });

  refreshToggles();
  refreshVisibility();
  updatePreview();
}
