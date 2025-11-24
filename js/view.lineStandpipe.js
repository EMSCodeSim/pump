// view.lineStandpipe.js
// Standpipe-only popup editor for a single line (Line 1 / 2 / 3).
// - Engine → standpipe hose: type + length
// - Floors up (or vertical feet)
// - Standpipe → nozzle hose: type + length
// - Nozzle type
// - Live GPM & PDP preview
// - "Explain math" button shows breakdown window

let standpipeStylesInjected = false;

function injectStandpipeStyles() {
  if (standpipeStylesInjected) return;
  standpipeStylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
  .sp-overlay {
    position: fixed;
    inset: 0;
    background: rgba(3, 7, 18, 0.55);
    backdrop-filter: blur(6px);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 40px;
    z-index: 10050;
    overflow-y: auto;
  }

  .sp-panel {
    position: relative;
    max-width: 480px;
    width: 100%;
    margin: 0 12px 24px;
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
    .sp-panel {
      margin-top: 12px;
      border-radius: 20px;
      padding: 14px 16px 12px;
    }
  }

  .sp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }

  .sp-title {
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .sp-close {
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
  .sp-close:hover {
    background: #111827;
  }

  .sp-body {
    font-size: 0.85rem;
    line-height: 1.45;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .sp-footer {
    display: flex;
    flex-direction: row;
    gap: 6px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }

  .sp-btn-primary,
  .sp-btn-secondary {
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

  .sp-btn-primary {
    background: linear-gradient(135deg, #38bdf8, #22c55e);
    color: #020617;
    font-weight: 600;
  }

  .sp-btn-secondary {
    background: rgba(15, 23, 42, 0.9);
    color: #e5e7eb;
    border: 1px solid rgba(148, 163, 184, 0.7);
  }

  .sp-btn-primary:active,
  .sp-btn-secondary:active {
    transform: translateY(1px);
  }

  .sp-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }

  .sp-row label {
    font-weight: 500;
    font-size: 0.82rem;
  }

  .sp-row span {
    font-size: 0.8rem;
  }

  .sp-panel input[type="text"],
  .sp-panel input[type="number"],
  .sp-panel select {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(55, 65, 81, 0.9);
    background: #020617;
    color: #e5e7eb;
    font-size: 0.8rem;
  }

  .sp-panel input::placeholder {
    color: rgba(148, 163, 184, 0.9);
  }

  .sp-section {
    border-top: 1px solid rgba(148, 163, 184, 0.4);
    padding-top: 8px;
    margin-top: 6px;
  }
  .sp-section:first-of-type {
    border-top: none;
  }

  .sp-section h3 {
    margin: 0 0 4px 0;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #bfdbfe;
  }

  .sp-preview {
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
    .sp-row {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }
    .sp-row > label {
      min-width: 130px;
    }
    .sp-row input,
    .sp-row select {
      width: auto;
      min-width: 120px;
    }
  }

  /* Explain math popup */
  .sp-explain-body {
    font-size: 0.83rem;
    line-height: 1.5;
  }
  .sp-explain-body code {
    font-size: 0.8rem;
    background: rgba(15, 23, 42, 0.9);
    border-radius: 4px;
    padding: 1px 4px;
  }
  `;
  document.head.appendChild(style);
}

function spEl(tag, opts = {}, ...children) {
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

function spNumberInput(value, onChange, extra = {}) {
  return spEl('input', {
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

function spSelect(options, current, onChange) {
  const s = spEl('select', { onchange: e => onChange(e.target.value) });
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.id;
    o.textContent = opt.label;
    if (opt.id === current) o.selected = true;
    s.appendChild(o);
  });
  return s;
}

// --- Simple helpers to estimate GPM / NP from nozzle label ---
// Expects labels like "1 3/4\" fog 150 gpm @ 75 psi"

function parseGpmFromNozzle(nozzles, nozzleId) {
  const noz = nozzles.find(n => n.id === nozzleId);
  if (!noz || !noz.label) return 150;
  const m = noz.label.match(/(\d+)\s*gpm/i);
  return m ? Number(m[1]) : 150;
}

function parseNpFromNozzle(nozzles, nozzleId) {
  const noz = nozzles.find(n => n.id === nozzleId);
  if (!noz || !noz.label) return 100;
  const m = noz.label.match(/@\s*(\d+)\s*psi/i);
  return m ? Number(m[1]) : 100;
}

// Simple C-value mapping (approx) by hose diameter (inches)
const SP_C_BY_DIA = {
  '1.75': 15.5,
  '1.5': 24,
  '2.5': 2,
  '3':   0.8,
  '4':   0.2,
  '5':   0.08,
};
const SP_DEPT_STORAGE_KEY = 'fireops_dept_equipment_v1';

// Normalize a single dept item (string or object) into { id, label, ...rest }
function spNormalizeDeptItem(item, fallbackPrefix, index) {
  if (item && typeof item === 'object') {
    const id = item.id != null
      ? String(item.id)
      : String(item.value ?? item.name ?? `${fallbackPrefix}_${index}`);
    const label = item.label || item.name || String(id);
    return { id, label, ...item };
  }
  const id = String(item);
  return { id, label: id, raw: item };
}

// Get normalized hoses/nozzles for standpipe editor.
// Preference order:
//   1) deptParam.hoses / deptParam.nozzles if present
//   2) localStorage["fireops_dept_equipment_v1"]
function spGetDeptEquipment(deptParam = {}) {
  let rawHoses = [];
  let rawNozzles = [];

  if (deptParam && (Array.isArray(deptParam.hoses) || Array.isArray(deptParam.nozzles))) {
    rawHoses = Array.isArray(deptParam.hoses) ? deptParam.hoses : [];
    rawNozzles = Array.isArray(deptParam.nozzles) ? deptParam.nozzles : [];
  } else {
    try {
      const json = localStorage.getItem(SP_DEPT_STORAGE_KEY);
      if (json) {
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object') {
          rawHoses = Array.isArray(parsed.hoses) ? parsed.hoses : [];
          rawNozzles = Array.isArray(parsed.nozzles) ? parsed.nozzles : [];
        }
      }
    } catch (e) {
      console.warn('Standpipe dept load failed', e);
    }
  }

  const hoses = rawHoses.map((h, i) => spNormalizeDeptItem(h, 'hose', i));
  const nozzles = rawNozzles.map((n, i) => spNormalizeDeptItem(n, 'noz', i));

  return { hoses, nozzles };
}



// If you store diameters in the dept.hoses objects, you can use that instead.
// Here we'll try to guess from label.
function guessDiaFromHoseLabel(label) {
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

function getHoseLabelById(hoses, id) {
  const h = hoses.find(x => x.id === id);
  return h ? h.label : '';
}

// Friction loss: FL = C * (GPM/100)^2 * (length/100)
function calcFL(C, gpm, lengthFt) {
  if (!C || !gpm || !lengthFt) return 0;
  const per100 = C * Math.pow(gpm / 100, 2);
  return per100 * (lengthFt / 100);
}

// Elevation: 5 psi per floor as a simple model (or ~0.434 psi/ft)
function calcElevationPsi(floorsUp) {
  if (!floorsUp) return 0;
  return floorsUp * 5;
}

/**
 * Standpipe popup entry point
 *
 * @param {Object} opts
 *   - dept: { hoses: [{id,label}], nozzles: [{id,label}] }
 *   - initial: optional existing config to seed the form
 *   - onSave: function(config) -> void
 */
export function openStandpipePopup({
  dept = {},
  initial = null,
  onSave = () => {},
} = {}) {
  injectStandpipeStyles();

  const { hoses, nozzles } = spGetDeptEquipment(dept);

  const state = {
    engineHoseId: hoses[0]?.id || '',
    engineLengthFt: 200,

    floorsUp: 3,        // or vertical distance
    systemLossPsi: 25,  // standpipe system loss (valves, PRVs, etc.)

    attackHoseId: hoses[0]?.id || '',
    attackLengthFt: 150,
    nozzleId: nozzles[0]?.id || '',
  };

  if (initial && typeof initial === 'object') {
    Object.assign(state, initial);
  }

  // --- Popup skeleton ---
  const overlay = document.createElement('div');
  overlay.className = 'sp-overlay';

  const panel = document.createElement('div');
  panel.className = 'sp-panel';

  const header = document.createElement('div');
  header.className = 'sp-header';

  const title = document.createElement('div');
  title.className = 'sp-title';
  title.textContent = 'Standpipe setup';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'sp-close';
  closeBtn.textContent = '✕';

  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'sp-body';

  const footer = document.createElement('div');
  footer.className = 'sp-footer';

  const explainBtn = document.createElement('button');
  explainBtn.type = 'button';
  explainBtn.className = 'sp-btn-secondary';
  explainBtn.textContent = 'Explain math';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'sp-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'sp-btn-primary';
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

  // --- GPM / PDP calc + preview ---
  const previewBar = spEl('div', { class: 'sp-preview' });

  function calcStandpipeNumbers() {
    const gpm   = parseGpmFromNozzle(nozzles, state.nozzleId);
    const np    = parseNpFromNozzle(nozzles, state.nozzleId);

    // Engine → standpipe
    const engLabel = getHoseLabelById(hoses, state.engineHoseId);
    const engDia   = String(guessDiaFromHoseLabel(engLabel));
    const C1       = SP_C_BY_DIA[engDia] || 2;
    const FL1      = calcFL(C1, gpm, state.engineLengthFt || 0);

    // Standpipe → nozzle
    const atkLabel = getHoseLabelById(hoses, state.attackHoseId);
    const atkDia   = String(guessDiaFromHoseLabel(atkLabel));
    const C2       = SP_C_BY_DIA[atkDia] || 2;
    const FL2      = calcFL(C2, gpm, state.attackLengthFt || 0);

    const elev     = calcElevationPsi(state.floorsUp || 0);
    const system   = state.systemLossPsi || 0;

    const PDP      = np + FL1 + FL2 + elev + system;

    return {
      gpm,
      np,
      FL1: Math.round(FL1),
      FL2: Math.round(FL2),
      elev: Math.round(elev),
      system: Math.round(system),
      PDP: Math.round(PDP),
    };
  }

  function updatePreview() {
    const { gpm, PDP } = calcStandpipeNumbers();
    previewBar.textContent = `Standpipe – GPM: ${gpm}   |   PDP: ${PDP} psi`;
  }

  // --- Explain math popup ---
  function openExplainPopup() {
    const vals = calcStandpipeNumbers();

    const o = document.createElement('div');
    o.className = 'sp-overlay';

    const p = document.createElement('div');
    p.className = 'sp-panel';

    const h = document.createElement('div');
    h.className = 'sp-header';

    const t = document.createElement('div');
    t.className = 'sp-title';
    t.textContent = 'Standpipe math breakdown';

    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'sp-close';
    x.textContent = '✕';

    h.append(t, x);

    const b = document.createElement('div');
    b.className = 'sp-body sp-explain-body';

    const gpm = vals.gpm;
    const np  = vals.np;

    const engLabel = getHoseLabelById(hoses, state.engineHoseId);
    const atkLabel = getHoseLabelById(hoses, state.attackHoseId);

    b.innerHTML = `
      <p>We are using a simple standpipe formula:</p>
      <p><code>PDP = NP + FL₁ + FL₂ + Elevation + System&nbsp;Loss</code></p>

      <p><strong>Inputs:</strong></p>
      <ul>
        <li>Nozzle: ${state.nozzleId || ''} → approx <code>${gpm} gpm</code> @ <code>${np} psi</code></li>
        <li>Engine → standpipe hose: <code>${engLabel || state.engineHoseId || 'unknown'}</code>,
            length <code>${state.engineLengthFt || 0} ft</code></li>
        <li>Standpipe → nozzle hose: <code>${atkLabel || state.attackHoseId || 'unknown'}</code>,
            length <code>${state.attackLengthFt || 0} ft</code></li>
        <li>Floors up / elevation: <code>${state.floorsUp || 0}</code></li>
        <li>System loss (valves, PRVs, fittings): <code>${vals.system} psi</code></li>
      </ul>

      <p><strong>Step 1 – Friction loss (engine → standpipe):</strong><br>
        We use FL = C × (GPM/100)² × (length/100)<br>
        → FL₁ ≈ <code>${vals.FL1} psi</code>
      </p>

      <p><strong>Step 2 – Friction loss (standpipe → nozzle):</strong><br>
        Same formula with the attack hose C and length.<br>
        → FL₂ ≈ <code>${vals.FL2} psi</code>
      </p>

      <p><strong>Step 3 – Elevation:</strong><br>
        Approx 5 psi per floor up.<br>
        → Elevation ≈ <code>${vals.elev} psi</code>
      </p>

      <p><strong>Step 4 – System loss:</strong><br>
        User-entered estimate for standpipe valves, PRVs, etc.<br>
        → System loss ≈ <code>${vals.system} psi</code>
      </p>

      <p><strong>Final pump discharge pressure (PDP):</strong></p>
      <p>
        <code>
          PDP = ${np} (NP) +
                ${vals.FL1} (FL₁) +
                ${vals.FL2} (FL₂) +
                ${vals.elev} (elev) +
                ${vals.system} (system)
          = ${vals.PDP} psi
        </code>
      </p>
    `;

    const f = document.createElement('div');
    f.className = 'sp-footer';

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'sp-btn-primary';
    ok.textContent = 'Close';

    f.appendChild(ok);

    p.append(h, b, f);
    o.appendChild(p);
    document.body.appendChild(o);

    function closeExplain() {
      if (o.parentNode) o.parentNode.removeChild(o);
    }

    o.addEventListener('click', (e) => {
      if (e.target === o) closeExplain();
    });
    x.addEventListener('click', closeExplain);
    ok.addEventListener('click', closeExplain);
  }

  explainBtn.addEventListener('click', () => {
    openExplainPopup();
  });

  // --- Build form ---
  const engineSection = spEl('div', { class: 'sp-section' },
    spEl('h3', { text: 'Engine → standpipe (FDC)' }),
    spEl('div', { class: 'sp-row' },
      spEl('label', { text: 'Hose type:' }),
      spSelect(hoses, state.engineHoseId, v => { state.engineHoseId = v; updatePreview(); }),
      spEl('span', { text: 'Length:' }),
      spNumberInput(state.engineLengthFt, v => { state.engineLengthFt = v || 0; updatePreview(); }),
      spEl('span', { text: 'ft' })
    )
  );

  const elevationSection = spEl('div', { class: 'sp-section' },
    spEl('h3', { text: 'Elevation & system' }),
    spEl('div', { class: 'sp-row' },
      spEl('label', { text: 'Floors up:' }),
      spNumberInput(state.floorsUp, v => { state.floorsUp = v || 0; updatePreview(); }),
      spEl('span', { text: '≈ 5 psi / floor' })
    ),
    spEl('div', { class: 'sp-row' },
      spEl('label', { text: 'System loss:' }),
      spNumberInput(state.systemLossPsi, v => { state.systemLossPsi = v || 0; updatePreview(); }),
      spEl('span', { text: 'psi (valves, PRVs, etc.)' })
    )
  );

  const attackSection = spEl('div', { class: 'sp-section' },
    spEl('h3', { text: 'Standpipe → nozzle' }),
    spEl('div', { class: 'sp-row' },
      spEl('label', { text: 'Attack hose type:' }),
      spSelect(hoses, state.attackHoseId, v => { state.attackHoseId = v; updatePreview(); }),
      spEl('span', { text: 'Length:' }),
      spNumberInput(state.attackLengthFt, v => { state.attackLengthFt = v || 0; updatePreview(); }),
      spEl('span', { text: 'ft' })
    ),
    spEl('div', { class: 'sp-row' },
      spEl('label', { text: 'Nozzle:' }),
      spSelect(nozzles, state.nozzleId, v => { state.nozzleId = v; updatePreview(); })
    )
  );

  body.append(engineSection, elevationSection, attackSection, previewBar);
  updatePreview();

  // Save handler – returns a compact config for this line
  saveBtn.addEventListener('click', () => {
    const payload = {
      type: 'standpipe',
      engineHoseId: state.engineHoseId,
      engineLengthFt: state.engineLengthFt,
      floorsUp: state.floorsUp,
      systemLossPsi: state.systemLossPsi,
      attackHoseId: state.attackHoseId,
      attackLengthFt: state.attackLengthFt,
      nozzleId: state.nozzleId,
      // Optional: cache last-calculated PDP/GPM
      lastCalc: calcStandpipeNumbers(),
    };
    onSave(payload);
    close();
  });
}
