import { DEPT_UI_NOZZLES, DEPT_UI_HOSES } from './store.js';

// view.lineMaster.js
// Master stream / Blitz line editor.
//
// Behavior:
// - Deck gun mode:
//    * User ONLY chooses the nozzle (from department setup / global UI list).
//    * GPM is taken from that nozzle (if gpm/flow is defined).
//    * NP for master is locked at 80 psi.
//    * No hose / lines UI needed for pump calc.
// - Portable mode:
//    * User chooses 1 or 2 lines.
//    * ONE shared hose size (from DEPT_UI_HOSES / dept.hoses).
//    * ONE shared line length (ft).
//    * Elevation in feet.
//    * NP locked at 80 psi.
//    * PDP uses hose C (based on hose size), length, elevation, and appliance loss.
// - Bottom: big bar
//      "Master stream – Flow: X gpm | PDP: Y psi"

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
    .ms-toggle-group button {
      padding: 5px 12px;
      border-radius: 999px;
      border: 1px solid rgba(75, 85, 99, 0.9);
      background: rgba(15, 23, 42, 0.95);
      font-size: 0.85rem;
      color: #e5e7eb;
      cursor: pointer;
    }
    .ms-toggle-on {
      background: #0ea5e9;
      border-color: #0ea5e9;
      color: #020617;
      font-weight: 600;
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

    .ms-explain-overlay {
      position: fixed;
      inset: 0;
      background: rgba(3, 7, 18, 0.75);
      backdrop-filter: blur(6px);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding-top: 40px;
      z-index: 10070;
      overflow-y: auto;
    }
    .ms-explain-panel {
      max-width: 520px;
      width: 100%;
      margin: 0 12px 24px;
      background: #020617;
      border-radius: 18px;
      box-shadow:
        0 18px 30px rgba(15, 23, 42, 0.85),
        0 0 0 1px rgba(148, 163, 184, 0.45);
      padding: 14px 16px 12px;
      color: #e5e7eb;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ms-explain-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.25);
    }
    .ms-explain-title {
      font-size: 1rem;
      font-weight: 600;
    }
    .ms-explain-body {
      font-size: 0.9rem;
      line-height: 1.5;
      max-height: min(60vh, 430px);
      overflow-y: auto;
      padding-top: 4px;
      padding-bottom: 4px;
    }
    .ms-explain-body code {
      font-size: 0.85rem;
      background: rgba(15, 23, 42, 0.9);
      border-radius: 4px;
      padding: 1px 4px;
    }
    .ms-explain-footer {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      padding-top: 8px;
      border-top: 1px solid rgba(148, 163, 184, 0.25);
    }
  `;
  document.head.appendChild(style);
}

function msEl(tag, opts = {}, ...children) {
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

function msNumberInput(value, onChange, extra = {}) {
  return msEl('input', {
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

function msSelect(options, currentId, onChange) {
  const s = msEl('select', { onchange: e => onChange(e.target.value) });
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.id;
    o.textContent = opt.label;
    if (opt.id === currentId) o.selected = true;
    s.appendChild(o);
  });
  return s;
}

/* --- Defaults & helpers --- */

const DEFAULT_MS_NOZZLES = [
  { id: 'ms_500',  label: '500 gpm master',  gpm: 500 },
  { id: 'ms_750',  label: '750 gpm master',  gpm: 750 },
  { id: 'ms_1000', label: '1000 gpm master', gpm: 1000 },
  { id: 'ms_1250', label: '1250 gpm master', gpm: 1250 },
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

// Dept.nozzles come from global UI nozzle library (already filtered by Dept Setup elsewhere).
function msGetNozzleListFromDept(dept) {
  // Base library: prefer DEPT_UI_NOZZLES if present
  if (Array.isArray(DEPT_UI_NOZZLES) && DEPT_UI_NOZZLES.length) {
    return DEPT_UI_NOZZLES.map((n, idx) => {
      if (!n) return null;
      const id = n.id != null
        ? String(n.id)
        : String(n.value ?? n.name ?? idx);
      const label = n.label || n.name || String(id);
      const gpm = (typeof n.gpm === 'number' && n.gpm > 0)
        ? n.gpm
        : (typeof n.flow === 'number' && n.flow > 0
            ? n.flow
            : (typeof n.GPM === 'number' && n.GPM > 0 ? n.GPM : 0));
      return { id, label, gpm };
    }).filter(Boolean);
  }

  // Legacy dept.nozzles* shapes
  if (dept && typeof dept === 'object') {
    const allRaw = Array.isArray(dept.nozzlesAll) ? dept.nozzlesAll : [];
    const raw = allRaw.length ? allRaw : (Array.isArray(dept.nozzles) ? dept.nozzles : []);
    if (raw.length) {
      return raw.map((n, idx) => {
        if (!n) return null;
        if (typeof n === 'object') {
          const id = n.id != null
            ? String(n.id)
            : String(n.value ?? n.name ?? idx);
          const label = n.label || n.name || String(id);
          const gpm = (typeof n.gpm === 'number' && n.gpm > 0)
            ? n.gpm
            : (typeof n.flow === 'number' && n.flow > 0
                ? n.flow
                : (typeof n.GPM === 'number' && n.GPM > 0 ? n.GPM : 0));
          return { id, label, gpm };
        } else {
          const id = String(n);
          return { id, label: id, gpm: 0 };
        }
      }).filter(Boolean);
    }
  }

  // Fallback default
  return DEFAULT_MS_NOZZLES.slice();
}

// Dept.hoses can be array of strings OR array of objects.
// Prefer global DEPT_UI_HOSES (already filtered by Dept Setup).
function msGetHoseListFromDept(dept) {
  if (Array.isArray(DEPT_UI_HOSES) && DEPT_UI_HOSES.length) {
    return DEPT_UI_HOSES.map((h, idx) => {
      if (!h) return null;
      const id = h.id != null
        ? String(h.id)
        : String(h.value ?? h.name ?? idx);
      const label = h.label || h.name || String(id);
      return { id, label };
    }).filter(Boolean);
  }

  // Legacy dept.hoses* shapes
  if (dept && typeof dept === 'object') {
    const allRaw = Array.isArray(dept.hosesAll) ? dept.hosesAll : [];
    const raw = allRaw.length ? allRaw : (Array.isArray(dept.hoses) ? dept.hoses : []);
    if (raw.length) {
      return raw.map((h, idx) => {
        if (h && typeof h === 'object') {
          const id = h.id != null
            ? String(h.id)
            : String(h.value ?? h.name ?? idx);
          const label = h.label || h.name || String(id);
          return { id, label };
        } else {
          const id = String(h);
          return { id, label: id };
        }
      }).filter(Boolean);
    }
  }

  // Final fallback
  return DEFAULT_MS_HOSES;
}

function msGuessDiaFromHoseLabel(label) {
  if (!label) return 2.5;
  const m = label.match(/(\d(?:\.\d+)?)\s*"/);
  if (m) return Number(m[1]);
  if (/1 3\/4/.test(label)) return 1.75;
  if (/1¾/.test(label))     return 1.75;
  if (/1\s?1\/2/.test(label)) return 1.5;
  if (/2\s?1\/2/.test(label)) return 2.5;
  if (/3"/.test(label))     return 3;
  if (/5"/.test(label))     return 5;
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

function msGetNozzleById(list, id) {
  if (!Array.isArray(list) || !list.length) return null;
  if (!id) return list[0];
  return list.find(n => n.id === id) || list[0];
}

/* --- Core math --- */

function calcMasterNumbers(state, hoses, nozzles) {
  const m = state.master;
  const noz = msGetNozzleById(nozzles, m.nozzleId) || {};
  const totalGpm = Number(
    (typeof noz.gpm === 'number' && noz.gpm > 0)
      ? noz.gpm
      : (m.desiredGpm || 800)
  );

  const NP = MASTER_NP;
  const applianceLoss = MASTER_APPLIANCE_LOSS;
  const elevPsi = (m.elevationFt || 0) * PSI_PER_FT;

  if (m.mountType === 'deck') {
    const PDP = NP + applianceLoss + elevPsi;
    return {
      mountType: 'deck',
      gpm: Math.round(totalGpm),
      NP,
      FL: 0,
      applianceLoss: Math.round(applianceLoss),
      elevPsi: Math.round(elevPsi),
      lines: 0,
      PDP: Math.round(PDP),
    };
  }

  const lines = m.feedLines === 2 ? 2 : 1;
  const gpmPerLine = totalGpm / (lines || 1);

  const hoseLabel = msGetHoseLabelById(hoses, m.supplyHoseId);
  const dia = String(msGuessDiaFromHoseLabel(hoseLabel));
  const C = MS_C_BY_DIA[dia] || 2;
  const len = m.supplyLengthFt || 0;

  const flPerLine = msCalcFL(C, gpmPerLine, len);
  const worstFL = flPerLine;

  const PDP = NP + worstFL + applianceLoss + elevPsi;

  return {
    mountType: 'portable',
    lines,
    gpm: Math.round(totalGpm),
    NP,
    FL: Math.round(worstFL),
    applianceLoss: Math.round(applianceLoss),
    elevPsi: Math.round(elevPsi),
    PDP: Math.round(PDP),
  };
}

/* --- Public entry point --- */

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
      desiredGpm: firstNozzle.gpm || 800,
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

  const overlay = document.createElement('div');
  overlay.className = 'ms-overlay';

  const panel = document.createElement('div');
  panel.className = 'ms-panel';

  const header = document.createElement('div');
  header.className = 'ms-header';

  const title = msEl('div', { class: 'ms-title', text: 'Master stream setup' });

  const closeBtn = msEl('button', {
    class: 'ms-close',
    type: 'button',
    text: '✕',
    onclick: () => close(),
  });

  header.append(title, closeBtn);

  const body = document.createElement('div');
  body.className = 'ms-body';

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
    text: 'Save',
  });

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

  const previewBar = msEl('div', { class: 'ms-preview' });

  function updatePreview() {
    const vals = calcMasterNumbers(state, hoses, nozzles);
    previewBar.textContent =
      `Master stream – Flow: ${vals.gpm} gpm   |   PDP: ${vals.PDP} psi`;
  }

  function openExplainPopup() {
    const vals = calcMasterNumbers(state, hoses, nozzles);
    const m = state.master;
    const noz = msGetNozzleById(nozzles, m.nozzleId);

    const overlay2 = document.createElement('div');
    overlay2.className = 'ms-explain-overlay';

    const panel2 = document.createElement('div');
    panel2.className = 'ms-explain-panel';

    const header2 = document.createElement('div');
    header2.className = 'ms-explain-header';

    const title2 = msEl('div', {
      class: 'ms-explain-title',
      text: 'Master stream math breakdown',
    });

    const close2 = msEl('button', {
      class: 'ms-close',
      type: 'button',
      text: '✕',
    });

    header2.append(title2, close2);

    const body2 = document.createElement('div');
    body2.className = 'ms-explain-body';

    const modeLabel = m.mountType === 'deck' ? 'Deck gun' : 'Portable master';
    const gpm = vals.gpm;
    const NP = vals.NP;
    const lines = m.mountType === 'portable' ? vals.lines : 'n/a';

    body2.innerHTML = `
      <p>We use a master stream formula:</p>
      <p><code>PDP = NP + FL + Appliance&nbsp;Loss + Elevation</code></p>

      <p><strong>Inputs:</strong></p>
      <ul>
        <li>Mode: <code>${modeLabel}</code></li>
        <li>Nozzle: <code>${noz ? noz.label : '—'}</code></li>
        <li>Flow from nozzle: <code>${gpm} gpm</code></li>
        <li>NP for master stream: <code>${NP} psi</code></li>
        <li>Number of supply lines (portable only): <code>${lines}</code></li>
        <li>Appliance loss: <code>${vals.applianceLoss} psi</code></li>
        <li>Elevation: <code>${m.elevationFt || 0} ft → ${vals.elevPsi} psi</code></li>
      </ul>

      <p><strong>Portable supply line friction loss:</strong></p>
      <p>For portable mode we assume 1 or 2 identical supply lines.</p>
      <p>
        GPM per line:
        <br><code>GPM_per_line = total_GPM / lines</code>
      </p>
      <p>
        Then
        <br><code>FL = C × (GPM_per_line/100)² × (length/100)</code>
        <br>→ FL ≈ <code>${vals.FL} psi</code>
      </p>

      <p><strong>Final pump discharge pressure (PDP):</strong></p>
      <p>
        <code>
          PDP = ${NP} (NP) +
                ${vals.FL} (FL) +
                ${vals.applianceLoss} (appliance) +
                ${vals.elevPsi} (elev)
          = ${vals.PDP} psi
        </code>
      </p>
    `;

    const footer2 = document.createElement('div');
    footer2.className = 'ms-explain-footer';

    const ok2 = msEl('button', {
      type: 'button',
      class: 'ms-btn-primary',
      text: 'Close',
    });

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

  // --- UI: mount + nozzle + portable-only fields ---

  const mountToggle = (() => {
    const deckBtn = msEl('button', {
      text: 'Deck gun',
      onclick: (e) => {
        e.preventDefault();
        state.master.mountType = 'deck';
        refresh();
        updatePreview();
      },
    });

    const portableBtn = msEl('button', {
      text: 'Portable',
      onclick: (e) => {
        e.preventDefault();
        state.master.mountType = 'portable';
        refresh();
        updatePreview();
      },
    });

    function refresh() {
      const isDeck = state.master.mountType === 'deck';
      deckBtn.classList.toggle('ms-toggle-on', isDeck);
      portableBtn.classList.toggle('ms-toggle-on', !isDeck);

      const displayPortable = isDeck ? 'none' : '';
      feedLinesRow.style.display = displayPortable;
      hoseRow.style.display = displayPortable;
      lengthRow.style.display = displayPortable;
      elevRow.style.display = displayPortable;
    }

    const root = msEl('span', { class: 'ms-toggle-group' }, deckBtn, portableBtn);
    return { root, refresh };
  })();

  const feedToggle = (() => {
    const oneBtn = msEl('button', {
      text: '1 line',
      onclick: (e) => {
        e.preventDefault();
        state.master.feedLines = 1;
        refresh();
        updatePreview();
      },
    });
    const twoBtn = msEl('button', {
      text: '2 lines',
      onclick: (e) => {
        e.preventDefault();
        state.master.feedLines = 2;
        refresh();
        updatePreview();
      },
    });

    function refresh() {
      const lines = state.master.feedLines === 2 ? 2 : 1;
      oneBtn.classList.toggle('ms-toggle-on', lines === 1);
      twoBtn.classList.toggle('ms-toggle-on', lines === 2);
    }

    const root = msEl('span', { class: 'ms-toggle-group' }, oneBtn, twoBtn);
    return { root, refresh };
  })();

  const topSection = msEl('div', { class: 'ms-section' });

  const mountRow = msEl('div', { class: 'ms-row' },
    msEl('label', { text: 'Mount:' }),
    mountToggle.root
  );

  const nozzleRow = msEl('div', { class: 'ms-row' },
    msEl('label', { text: 'Nozzle:' }),
    msSelect(nozzles, state.master.nozzleId, (v) => {
      state.master.nozzleId = v;
      const noz = msGetNozzleById(nozzles, v);
      if (noz && typeof noz.gpm === 'number' && noz.gpm > 0) {
        state.master.desiredGpm = noz.gpm;
      }
      updatePreview();
    })
  );

  const feedLinesRow = msEl('div', { class: 'ms-row' },
    msEl('label', { text: 'Feed lines:' }),
    feedToggle.root
  );

  const hoseRow = msEl('div', { class: 'ms-row' },
    msEl('label', { text: 'Hose size:' }),
    msSelect(hoses, state.master.supplyHoseId, (v) => {
      state.master.supplyHoseId = v;
      updatePreview();
    })
  );

  const lengthRow = msEl('div', { class: 'ms-row' },
    msEl('label', { text: 'Length:' }),
    msNumberInput(state.master.supplyLengthFt, (v) => {
      state.master.supplyLengthFt = v === '' ? 0 : v;
      updatePreview();
    }),
    msEl('span', { text: 'ft (same for both lines if using 2)' })
  );

  const elevRow = msEl('div', { class: 'ms-row' },
    msEl('label', { text: 'Elevation (ft):' }),
    msNumberInput(state.master.elevationFt, (v) => {
      state.master.elevationFt = v === '' ? 0 : v;
      updatePreview();
    })
  );

  topSection.append(
    msEl('h3', { text: 'Master stream type' }),
    mountRow,
    nozzleRow,
    feedLinesRow,
    hoseRow,
    lengthRow,
    elevRow
  );

  body.append(topSection, previewBar);

  mountToggle.refresh();
  feedToggle.refresh();
  updatePreview();

  saveBtn.addEventListener('click', () => {
    const lastCalc = calcMasterNumbers(state, hoses, nozzles);
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
}
