import { DEPT_UI_NOZZLES, DEPT_UI_HOSES } from './store.js';
import { DEPT_NOZZLE_LIBRARY } from './deptNozzles.js';

// view.lineMaster.js
// Master stream / Blitz line editor.

let msMasterStylesInjected = false;

function injectMsStyles() {
  if (msMasterStylesInjected) return;
  msMasterStylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    .ms-overlay {
      position: fixed;
      inset: 0;
      background: rgba(3, 7, 18, 0.55);
      backdrop-filter: blur(6px);
      display: flex;
      justify-content: center;
      align-items: flex-end;
      padding: 8px;
      z-index: 9999;
      box-sizing: border-box;
    }
    .ms-panel {
      width: 100%;
      max-width: 100vw;
      max-height: 88vh;
      background: #020617;
      color: #e5e7eb;
      border-radius: 16px 16px 0 0;
      border: 1px solid rgba(148,163,184,0.4);
      box-shadow: 0 18px 32px rgba(15,23,42,0.9);
      padding: 10px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    }
    .ms-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(148,163,184,0.3);
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .ms-title {
      font-size: 16px;
      font-weight: 600;
    }
    .ms-close-btn {
      width: 26px;
      height: 26px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.7);
      background: #020617;
      color: #e5e7eb;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      padding: 0;
    }
    .ms-body {
      flex: 1;
      overflow-y: auto;
      padding: 4px 2px;
      font-size: 14px;
    }
    .ms-footer {
      border-top: 1px solid rgba(148,163,184,0.3);
      padding-top: 6px;
      margin-top: 4px;
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }
    .ms-btn-primary {
      border-radius: 999px;
      border: none;
      padding: 6px 12px;
      background: #22c55e;
      color: #020617;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .ms-btn-secondary {
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.75);
      padding: 6px 12px;
      background: #020617;
      color: #e5e7eb;
      font-size: 14px;
      cursor: pointer;
    }
    .ms-row {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: 6px;
    }
    .ms-row-label {
      font-size: 13px;
      font-weight: 500;
    }
    .ms-input,
    .ms-select {
      padding: 6px 8px;
      border-radius: 8px;
      border: 1px solid rgba(55,65,81,0.9);
      background: #020617;
      color: #e5e7eb;
      font-size: 15px;
      width: 100%;
      box-sizing: border-box;
    }
    .ms-section {
      border-radius: 12px;
      border: 1px solid rgba(59,130,246,0.45);
      padding: 6px 8px;
      margin-bottom: 6px;
      background: rgba(15,23,42,0.9);
    }
    .ms-section-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #bfdbfe;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .ms-preview {
      border-radius: 10px;
      border: 1px solid rgba(37,99,235,0.85);
      background: #020617;
      padding: 8px;
      margin-top: 6px;
      font-size: 14px;
      font-weight: 600;
      text-align: center;
    }
    .ms-modes {
      display: flex;
      gap: 6px;
      margin-bottom: 6px;
    }
    .ms-mode-btn {
      flex: 1 1 0;
      padding: 5px 4px;
      border-radius: 999px;
      border: 1px solid rgba(55,65,81,0.9);
      background: rgba(15,23,42,0.9);
      color: #e5e7eb;
      cursor: pointer;
      font-size: 13px;
    }
    .ms-mode-btn.active {
      background: #022c22;
      border-color: #22c55e;
    }
    .ms-note {
      margin-top: 4px;
      font-size: 12px;
      opacity: 0.8;
    }
  `;
  document.head.appendChild(style);
}

/* --- Element helpers --- */

function msEl(tag, opts = {}, ...children) {
  const e = document.createElement(tag);
  if (opts) {
    Object.entries(opts).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k === 'className') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        e.addEventListener(k.slice(2), v);
      } else {
        e.setAttribute(k, v);
      }
    });
  }
  children.forEach(c => {
    if (c == null) return;
    if (typeof c === 'string' || typeof c === 'number') {
      e.appendChild(document.createTextNode(String(c)));
    } else {
      e.appendChild(c);
    }
  });
  return e;
}

function msNumberInput(value, onChange) {
  return msEl('input', {
    type: 'number',
    value: String(value ?? ''),
    class: 'ms-input',
    oninput: (e) => {
      const raw = e.target.value;
      if (raw === '') onChange('');
      else onChange(Number(raw));
    }
  });
}

function msSelect(options, currentId, onChange) {
  const s = msEl('select', { onchange: e => onChange(e.target.value) });
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.id;
    o.textContent = opt.label;
    if (opt.id === currentId) o.selected = true;
    s.appendChild(o);
  });
  s.className = 'ms-select';
  return s;
}

/* --- Defaults & helpers --- */

const DEFAULT_MS_NOZZLES = [
  { id: 'ms_tip_138_500', label: 'MS tip 1 3/8" – 500 gpm', gpm: 500 },
  { id: 'ms_tip_112_600', label: 'MS tip 1 1/2" – 600 gpm', gpm: 600 },
  { id: 'ms_tip_134_800', label: 'MS tip 1 3/4" – 800 gpm', gpm: 800 },
  { id: 'ms_tip_2_1000',  label: 'MS tip 2" – 1000 gpm',    gpm: 1000 },
  { id: 'ms_fog_500',     label: 'MS fog 500 gpm',          gpm: 500 },
  { id: 'ms_fog_750',     label: 'MS fog 750 gpm',          gpm: 750 },
  { id: 'ms_fog_1000',    label: 'MS fog 1000 gpm',         gpm: 1000 },
  { id: 'ms_fog_1250',    label: 'MS fog 1250 gpm',         gpm: 1250 },
];

const DEFAULT_MS_HOSES = [
  { id: '2.5', label: '2 1/2"' },
  { id: '3',   label: '3"'     },
  { id: '4',   label: '4"'     },
  { id: '5',   label: '5"'     },
];

const MS_C_BY_DIA = {
  '1.75': 15.5,
  '1.5':  24,
  '2.5':  2,
  '3':    0.8,
  '4':    0.2,
  '5':    0.08,
};

const MASTER_NP = 80;
const MASTER_APPLIANCE_LOSS = 25;
const PSI_PER_FT = 0.434;

function parseGpmFromLabel(label) {
  const m = String(label || '').match(/(\d+)\s*gpm/i);
  return m ? Number(m[1]) : 0;
}

function parseNpFromLabel(label) {
  const m = String(label || '').match(/@\s*(\d+)\s*psi/i);
  return m ? Number(m[1]) : 0;
}

// Normalize all hose labels consistently so phone & desktop show the same thing.
function formatHoseLabel(idOrLabel) {
  const raw = String(idOrLabel || '').trim();

  // If it already looks like 2.5" / 4" / 5" style, keep but normalize spacing.
  const quoteMatch = raw.match(/(\d(?:\.\d+)?)\s*"/);
  if (quoteMatch) {
    const v = quoteMatch[1];
    if (v === '1.75') return '1 3/4"';
    if (v === '1.5')  return '1 1/2"';
    if (v === '2.5')  return '2 1/2"';
    if (v === '3')    return '3"';
    if (v === '4')    return '4"';
    if (v === '5')    return '5"';
  }

  // Known internal ids, like "h_175"
  if (/^h_?175$/.test(raw)) return '1 3/4"';
  if (/^h_?15$/.test(raw))  return '1 1/2"';
  if (/^h_?25$/.test(raw))  return '2 1/2"';
  if (/^h_?3$/.test(raw))   return '3"';
  if (/^h_?4$/.test(raw))   return '4"';
  if (/^h_?5$/.test(raw))   return '5"';

  // Custom hose ids: "custom_hose_<...>"
  if (/^custom_hose_/i.test(raw)) {
    // If the id includes a diameter hint like "_175_", "_25_", etc, use that.
    if (/175/.test(raw)) return 'Custom 1 3/4"';
    if (/15/.test(raw))  return 'Custom 1 1/2"';
    if (/25/.test(raw))  return 'Custom 2 1/2"';
    if (/3/.test(raw))   return 'Custom 3"';
    if (/4/.test(raw))   return 'Custom 4"';
    if (/5/.test(raw))   return 'Custom 5"';
    return 'Custom hose';
  }

  // Text-based descriptions like "2.5 supply", "4 inch LDH"
  const numMatch = raw.match(/(\d(?:\.\d+)?)/);
  if (numMatch) {
    const v = numMatch[1];
    if (v === '1.75') return '1 3/4"';
    if (v === '1.5')  return '1 1/2"';
    if (v === '2.5')  return '2 1/2"';
    if (v === '3')    return '3"';
    if (v === '4')    return '4"';
    if (v === '5')    return '5"';
  }

  return raw;
}

// Turn internal ids like "ms_tip_138_500" OR labels that look like that
// into nice labels like 'MS tip 1 3/8" – 500 gpm' and 'MS fog 1250 gpm'.
function prettyMasterLabel(id, fallbackLabel, gpm) {
  const idStr = String(id || '');
  const labelStr = String(fallbackLabel || '');
  const source = idStr.includes('ms_') ? idStr : labelStr;
  if (!source.includes('ms_')) return fallbackLabel;

  const parts = source.split('_');
  if (parts[0] !== 'ms') return fallbackLabel;

  if (parts[1] === 'tip') {
    const boreCode = parts[2];
    const flowCode = parts[3] || gpm || parseGpmFromLabel(fallbackLabel);
    let boreText;
    switch (boreCode) {
      case '138': boreText = '1 3/8"'; break;
      case '112': boreText = '1 1/2"'; break;
      case '134': boreText = '1 3/4"'; break;
      case '2':   boreText = '2"';     break;
      default:    boreText = boreCode; break;
    }
    if (flowCode) return `MS tip ${boreText} – ${flowCode} gpm`;
    return `MS tip ${boreText}`;
  }

  if (parts[1] === 'fog') {
    const flowCode = parts[2] || gpm || parseGpmFromLabel(fallbackLabel);
    if (flowCode) return `MS fog ${flowCode} gpm`;
    return 'MS fog nozzle';
  }

  return fallbackLabel;
}

// Look up the full nozzle definition (including type, gpm, np) for a given id
// from the department nozzle library.
function msFindLibraryNozzle(id) {
  if (!id || !Array.isArray(DEPT_NOZZLE_LIBRARY)) return null;
  const sid = String(id);
  return DEPT_NOZZLE_LIBRARY.find(n => String(n.id) === sid) || null;
}

// Dept.nozzles: use DEPT_UI_NOZZLES (already scoped to Department Setup selections).
// Filter to master-stream style entries and prettify labels.
function msGetNozzleListFromDept(dept) {
  let baseRaw;

  if (Array.isArray(DEPT_UI_NOZZLES) && DEPT_UI_NOZZLES.length) {
    baseRaw = DEPT_UI_NOZZLES;
  } else if (dept && Array.isArray(dept.nozzlesAll) && dept.nozzlesAll.length) {
    baseRaw = dept.nozzlesAll;
  } else if (dept && Array.isArray(dept.nozzles) && dept.nozzles.length) {
    baseRaw = dept.nozzles;
  } else {
    baseRaw = DEFAULT_MS_NOZZLES;
  }

  if (!Array.isArray(baseRaw) || !baseRaw.length) {
    baseRaw = DEFAULT_MS_NOZZLES;
  }

  const mapped = baseRaw.map((n, idx) => {
    if (!n) return null;

    let id;
    let rawLabel;
    let gpm = 0;
    let np  = MASTER_NP;

    if (typeof n === 'string' || typeof n === 'number') {
      rawLabel = String(n);
      id = String(n);
      gpm = parseGpmFromLabel(rawLabel);
      const fromLabelNp = parseNpFromLabel(rawLabel);
      if (fromLabelNp) np = fromLabelNp;
    } else {
      id = n.id != null
        ? String(n.id)
        : String(n.value ?? n.name ?? idx);
      rawLabel = n.label || n.name || String(id);

      if (typeof n.gpm === 'number' && n.gpm > 0) {
        gpm = n.gpm;
      } else {
        gpm = parseGpmFromLabel(rawLabel);
      }

      if (typeof n.np === 'number' && n.np > 0) {
        np = n.np;
      } else {
        const fromLabelNp = parseNpFromLabel(rawLabel);
        if (fromLabelNp) np = fromLabelNp;
      }
    }

    // Pull richer metadata (including type, gpm, np) from the department nozzle library
    const meta = msFindLibraryNozzle(id);
    if (meta) {
      if (typeof meta.gpm === 'number' && meta.gpm > 0) gpm = meta.gpm;
      if (typeof meta.np  === 'number' && meta.np  > 0) np  = meta.np;
    }

    // Decide the type label we show ("Tip", "Fog", etc.)
    let typeLabel = 'Nozzle';
    const lowerId    = String(id).toLowerCase();
    const lowerLabel = (meta?.label || rawLabel || '').toLowerCase();
    const metaType   = (meta && meta.type) || '';

    if (metaType === 'fog' || lowerId.includes('fog') || lowerLabel.includes('fog')) {
      typeLabel = 'Fog';
    } else if (metaType === 'master' || lowerId.includes('ms') || lowerLabel.includes('master')) {
      // For master streams, default to "Tip" unless clearly fog.
      if (lowerId.includes('fog') || lowerLabel.includes('fog')) typeLabel = 'Fog';
      else typeLabel = 'Tip';
    } else if (metaType === 'smooth' || lowerLabel.includes('smooth')) {
      typeLabel = 'Tip';
    }

    // Build the final label from user-entered data:
    //   "Type GPM gpm @ PSI psi"
    let niceLabel;
    if (gpm && np) {
      niceLabel = `${typeLabel} ${gpm} gpm @ ${np} psi`;
    } else if (gpm) {
      niceLabel = `${typeLabel} ${gpm} gpm`;
    } else {
      // Fall back to original master label logic
      niceLabel = prettyMasterLabel(id, rawLabel, gpm) || rawLabel;
    }

    return { id, label: niceLabel, gpm };
  }).filter(Boolean);

  // Prefer only the master-stream entries if we can detect them
  const masterOnly = mapped.filter(n => {
    const idStr = String(n.id);
    const lower = n.label.toLowerCase();
    const meta = msFindLibraryNozzle(idStr);
    const isMasterType = meta && meta.type === 'master';
    return isMasterType ||
      idStr.startsWith('ms_') ||
      lower.includes('master stream') ||
      lower.includes('master fog') ||
      lower.startsWith('ms tip') ||
      lower.startsWith('ms fog') ||
      lower.startsWith('tip ') ||
      lower.startsWith('fog ');
  });

  const list = masterOnly.length ? masterOnly : mapped;
  return list.length ? list : DEFAULT_MS_NOZZLES;
}

// Dept.hoses: prefer DEPT_UI_HOSES and format sizes clearly as 2 1/2", 4", 5"
function msGetHoseListFromDept(dept) {
  let baseRaw;

  if (Array.isArray(DEPT_UI_HOSES) && DEPT_UI_HOSES.length) {
    baseRaw = DEPT_UI_HOSES;
  } else if (dept && Array.isArray(dept.hosesAll) && dept.hosesAll.length) {
    baseRaw = dept.hosesAll;
  } else if (dept && Array.isArray(dept.hoses) && dept.hoses.length) {
    baseRaw = dept.hoses;
  } else {
    baseRaw = DEFAULT_MS_HOSES;
  }

  if (!Array.isArray(baseRaw) || !baseRaw.length) {
    baseRaw = DEFAULT_MS_HOSES;
  }

  const mapped = baseRaw.map((h, idx) => {
    if (!h) return null;

    let id;
    let label;

    if (typeof h === 'string' || typeof h === 'number') {
      id = String(h);
      label = formatHoseLabel(id);
    } else {
      id = h.id != null
        ? String(h.id)
        : String(h.value ?? h.name ?? idx);
      label = h.label || h.name || String(id);
      label = formatHoseLabel(label);
    }

    let dia = msGuessDiaFromHoseLabel(label);
    return { id, label, dia };
  }).filter(Boolean);

  return mapped.length ? mapped : DEFAULT_MS_HOSES;
}

function msGuessDiaFromHoseLabel(label) {
  const txt = String(label || '').toLowerCase();
  if (txt.includes('1 3/4') || txt.includes('1.75')) return 1.75;
  if (txt.includes('1 1/2') || txt.includes('1.5'))  return 1.5;
  if (txt.includes('2 1/2') || txt.includes('2.5'))  return 2.5;
  if (txt.includes('3'))  return 3;
  if (txt.includes('4'))  return 4;
  if (txt.includes('5'))  return 5;
  return 2.5;
}

function msGetHoseLabelById(hoses, id) {
  const h = hoses.find(x => x.id === id);
  return h ? h.label : '';
}

function msCalcFL(C, gpm, lengthFt) {
  if (!C || !gpm || !lengthFt) return 0;
  const per100 = C * Math.pow(gpm / 100, 2);
  return per100 * (lengthFt / 100);
}

function msGetNozzleById(nozzles, id) {
  return nozzles.find(n => n.id === id) || null;
}

/* --- Main popup --- */

export function openMasterStreamPopup({
  dept = {},
  initial = null,
  onSave = () => {},
} = {}) {
  injectMsStyles();

  const hoses = msGetHoseListFromDept(dept);
  const nozzles = msGetNozzleListFromDept(dept);

  const firstHose = hoses[0] || DEFAULT_MS_HOSES[0];
  const firstNozzle = nozzles[0] || DEFAULT_MS_NOZZLES[0];

  const state = {
    master: {
      mountType: 'deck',
      feedLines: 1,
      nozzleId: firstNozzle.id,
      desiredGpm: firstNozzle.gpm || parseGpmFromLabel(firstNozzle.label) || 800,
      elevationFt: 0,
      supplyHoseId: firstHose.id,
      supplyLengthFt: 150,
    }
  };

  if (initial && typeof initial === 'object') {
    const src = initial.master || initial;
    if (src.mountType) state.master.mountType = src.mountType;
    if (src.feedLines != null) state.master.feedLines = src.feedLines;
    if (src.nozzleId) state.master.nozzleId = src.nozzleId;
    if (src.desiredGpm != null) state.master.desiredGpm = src.desiredGpm;
    if (src.elevationFt != null) state.master.elevationFt = src.elevationFt;
    if (src.supplyHoseId) state.master.supplyHoseId = src.supplyHoseId;
    if (src.supplyLengthFt != null) state.master.supplyLengthFt = src.supplyLengthFt;
  }

  const overlay = msEl('div', { class: 'ms-overlay' });
  const panel = msEl('div', { class: 'ms-panel' });
  overlay.appendChild(panel);

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const header = msEl(
    'div',
    { class: 'ms-header' },
    msEl('div', { class: 'ms-title', text: 'Master stream / blitz line' }),
    msEl('button', {
      type: 'button',
      class: 'ms-close-btn',
      onclick: () => close(),
    }, '✕'),
  );

  const body = msEl('div', { class: 'ms-body' });

  // Modes (future expansion)
  const modes = msEl('div', { class: 'ms-modes' });
  const modeDeck = msEl(
    'button',
    {
      type: 'button',
      class: 'ms-mode-btn active',
      onclick: () => {
        state.master.mountType = 'deck';
        modeDeck.classList.add('active');
        modeGround.classList.remove('active');
        updatePreview();
      }
    },
    'Deck gun',
  );
  const modeGround = msEl(
    'button',
    {
      type: 'button',
      class: 'ms-mode-btn',
      onclick: () => {
        state.master.mountType = 'ground';
        modeGround.classList.add('active');
        modeDeck.classList.remove('active');
        updatePreview();
      }
    },
    'Ground / portable',
  );
  modes.append(modeDeck, modeGround);

  // Sections
  const mainSection = msEl('div', { class: 'ms-section' });
  mainSection.appendChild(msEl('div', {
    class: 'ms-section-title',
    text: 'Master stream nozzle',
  }));

  // Nozzle dropdown
  const nozRow = msEl('div', { class: 'ms-row' });
  nozRow.appendChild(msEl('div', {
    class: 'ms-row-label',
    text: 'Nozzle (type / flow / pressure)',
  }));
  const nozSelect = msSelect(nozzles, state.master.nozzleId, (id) => {
    state.master.nozzleId = id;
    const n = msGetNozzleById(nozzles, id);
    if (n && n.gpm) {
      state.master.desiredGpm = n.gpm;
      gpmInput.value = String(n.gpm);
    }
    updatePreview();
  });
  nozRow.appendChild(nozSelect);
  mainSection.appendChild(nozRow);

  // Desired GPM
  const gpmRow = msEl('div', { class: 'ms-row' });
  gpmRow.appendChild(msEl('div', {
    class: 'ms-row-label',
    text: 'Desired flow (GPM)',
  }));
  const gpmInput = msNumberInput(state.master.desiredGpm, (v) => {
    state.master.desiredGpm = v === '' ? 0 : Number(v);
    updatePreview();
  });
  gpmRow.appendChild(gpmInput);
  mainSection.appendChild(gpmRow);

  // Elevation
  const elevRow = msEl('div', { class: 'ms-row' });
  elevRow.appendChild(msEl('div', {
    class: 'ms-row-label',
    text: 'Elevation at nozzle (+/- ft)',
  }));
  const elevInput = msNumberInput(state.master.elevationFt, (v) => {
    state.master.elevationFt = v === '' ? 0 : Number(v);
    updatePreview();
  });
  elevRow.appendChild(elevInput);
  mainSection.appendChild(elevRow);

  // Supply section
  const supplySection = msEl('div', { class: 'ms-section' });
  supplySection.appendChild(msEl('div', {
    class: 'ms-section-title',
    text: 'Supply line(s) to master stream',
  }));

  // Feed lines (1 or 2)
  const feedRow = msEl('div', { class: 'ms-row' });
  feedRow.appendChild(msEl('div', {
    class: 'ms-row-label',
    text: 'Number of supply lines',
  }));
  const feedSelect = msSelect(
    [
      { id: 1, label: '1 line' },
      { id: 2, label: '2 lines' },
    ],
    state.master.feedLines,
    (v) => {
      state.master.feedLines = Number(v) || 1;
      updatePreview();
    },
  );
  feedRow.appendChild(feedSelect);
  supplySection.appendChild(feedRow);

  // Supply hose
  const hoseRow = msEl('div', { class: 'ms-row' });
  hoseRow.appendChild(msEl('div', {
    class: 'ms-row-label',
    text: 'Supply hose size',
  }));
  const hoseSelect = msSelect(hoses, state.master.supplyHoseId, (id) => {
    state.master.supplyHoseId = id;
    updatePreview();
  });
  hoseRow.appendChild(hoseSelect);
  supplySection.appendChild(hoseRow);

  // Supply length
  const lenRow = msEl('div', { class: 'ms-row' });
  lenRow.appendChild(msEl('div', {
    class: 'ms-row-label',
    text: 'Supply line length (ft)',
  }));
  const lenInput = msNumberInput(state.master.supplyLengthFt, (v) => {
    state.master.supplyLengthFt = v === '' ? 0 : Number(v);
    updatePreview();
  });
  lenRow.appendChild(lenInput);
  supplySection.appendChild(lenRow);

  const preview = msEl('div', { class: 'ms-preview' });

  function computePdp() {
    const m = state.master;
    const noz = msGetNozzleById(nozzles, m.nozzleId) || nozzles[0] || DEFAULT_MS_NOZZLES[0];
    const flow = Number(m.desiredGpm) || noz.gpm || parseGpmFromLabel(noz.label) || 0;
    const dia = (msGetHoseListFromDept(dept).find(h => h.id === m.supplyHoseId) || {}).dia || 2.5;
    const C = MS_C_BY_DIA[String(dia)] || MS_C_BY_DIA['2.5'];
    const elevPsi = (Number(m.elevationFt) || 0) * PSI_PER_FT;

    // Master stream NP (80) + appliance + FL in supply, divided by number of lines
    const lineLength = Number(m.supplyLengthFt) || 0;
    const perLineFlow = m.feedLines > 0 ? flow / m.feedLines : flow;
    const fl = msCalcFL(C, perLineFlow, lineLength);

    const pdp = Math.round(MASTER_NP + MASTER_APPLIANCE_LOSS + fl + elevPsi);
    return {
      flow: Math.round(flow),
      pdp,
      fl: Math.round(fl),
      elevPsi: Math.round(elevPsi),
    };
  }

  function updatePreview() {
    const { flow, pdp, fl, elevPsi } = computePdp();
    const m = state.master;
    const hoseLabel = msGetHoseLabelById(hoses, m.supplyHoseId) || '2 1/2"';

    preview.textContent =
      `Flow: ${flow} gpm  •  PDP: ${pdp} psi  ` +
      `(${m.feedLines} x ${hoseLabel} • FL ${fl} psi • Elev ${elevPsi} psi)`;
  }

  const note = msEl('div', {
    class: 'ms-note',
    text: 'Master stream PDP uses 80 psi nozzle, 25 psi appliance, plus friction loss in the supply line(s) and elevation at the nozzle.',
  });

  body.append(modes, mainSection, supplySection, note, preview);

  const footer = document.createElement('div');
  footer.className = 'ms-footer';

  const explainBtn = msEl('button', {
    type: 'button',
    class: 'ms-btn-secondary',
    text: 'Explain math',
  });

  const cancelBtn = msEl('button', {
    type: 'button',
    class: 'ms-btn-secondary',
    text: 'Cancel',
    onclick: () => close(),
  });

  const saveBtn = msEl('button', {
    type: 'button',
    class: 'ms-btn-primary',
    text: 'Save to calc',
  });

  explainBtn.addEventListener('click', () => {
    const { flow, pdp, fl, elevPsi } = computePdp();
    const m = state.master;
    const hoseLabel = msGetHoseLabelById(hoses, m.supplyHoseId) || '2 1/2"';

    const msg =
      `Master stream PDP breakdown:\n\n` +
      `• Nozzle pressure: 80 psi\n` +
      `• Appliance loss: 25 psi\n` +
      `• Supply hose: ${m.feedLines} line(s) of ${hoseLabel} @ ${m.supplyLengthFt} ft\n` +
      `   → FL: ${fl} psi\n` +
      `• Elevation at nozzle: ${elevPsi} psi\n\n` +
      `Total PDP: ${pdp} psi for approximately ${flow} gpm.`;

    alert(msg);
  });

  saveBtn.addEventListener('click', () => {
    const lastCalc = computePdp();
    const payload = {
      mountType: state.master.mountType,
      feedLines: state.master.feedLines,
      nozzleId: state.master.nozzleId,
      desiredGpm: state.master.desiredGpm,
      elevationFt: state.master.elevationFt,
      supplyHoseId: state.master.supplyHoseId,
      supplyLengthFt: state.master.supplyLengthFt,
      lastCalc,
    };
    onSave(payload);
    close();
  });

  footer.append(explainBtn, cancelBtn, saveBtn);

  panel.append(header, body, footer);
  document.body.appendChild(overlay);

  updatePreview();
}
