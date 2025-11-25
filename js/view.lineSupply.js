// view.lineSupply.js
// Simple supply line popup (hydrant → engine, engine → engine, etc.)
//
// - No nozzle
// - User enters: hose size, length, flow GPM, desired pressure at receiving end,
//   elevation change.
// - Live preview: GPM, FL, elevation psi, required PDP.
// - Explain math popup.
//
// Usage:
//   openSupplyLinePopup({
//     dept: { hoses },
//     initial: existingSupplyConfig,
//     onSave(config) { ... }
//   });

let supplyStylesInjected = false;

function injectSupplyStyles() {
  if (supplyStylesInjected) return;
  supplyStylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
  .sup-overlay {
    position: fixed;
    inset: 0;
    background: rgba(3, 7, 18, 0.55);
    backdrop-filter: blur(6px);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 40px;
    z-index: 10140;
    overflow-y: auto;
  }

  .sup-panel {
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
    .sup-panel {
      margin-top: 12px;
      border-radius: 20px;
      padding: 14px 16px 12px;
    }
  }

  .sup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }

  .sup-title {
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .sup-close {
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
  .sup-close:hover {
    background: #111827;
  }

  .sup-body {
    font-size: 0.85rem;
    line-height: 1.45;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .sup-footer {
    display: flex;
    flex-direction: row;
    gap: 6px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }

  .sup-btn-primary,
  .sup-btn-secondary {
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

  .sup-btn-primary {
    background: linear-gradient(135deg, #38bdf8, #22c55e);
    color: #020617;
    font-weight: 600;
  }

  .sup-btn-secondary {
    background: rgba(15, 23, 42, 0.9);
    color: #e5e7eb;
    border: 1px solid rgba(148, 163, 184, 0.7);
  }

  .sup-btn-primary:active,
  .sup-btn-secondary:active {
    transform: translateY(1px);
  }

  .sup-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }

  .sup-row label {
    font-weight: 500;
    font-size: 0.82rem;
  }

  .sup-row span {
    font-size: 0.8rem;
  }

  .sup-panel input[type="text"],
  .sup-panel input[type="number"],
  .sup-panel select {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(55, 65, 81, 0.9);
    background: #020617;
    color: #e5e7eb;
    font-size: 0.8rem;
  }

  .sup-panel input::placeholder {
    color: rgba(148, 163, 184, 0.9);
  }

  .sup-section {
    border-top: 1px solid rgba(148, 163, 184, 0.4);
    padding-top: 8px;
    margin-top: 6px;
  }
  .sup-section:first-of-type {
    border-top: none;
  }

  .sup-section h3 {
    margin: 0 0 4px 0;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #bfdbfe;
  }

  .sup-preview {
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
    .sup-row {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }
    .sup-row > label {
      min-width: 130px;
    }
    .sup-row input,
    .sup-row select {
      width: auto;
      min-width: 120px;
    }
  }

  /* Explain math popup */
  .sup-explain-overlay {
    position: fixed;
    inset: 0;
    background: rgba(3, 7, 18, 0.75);
    backdrop-filter: blur(6px);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 40px;
    z-index: 10150;
    overflow-y: auto;
  }
  .sup-explain-panel {
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
  .sup-explain-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }
  .sup-explain-title {
    font-size: 0.95rem;
    font-weight: 600;
  }
  .sup-explain-body {
    font-size: 0.83rem;
    line-height: 1.5;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .sup-explain-body code {
    font-size: 0.8rem;
    background: rgba(15, 23, 42, 0.9);
    border-radius: 4px;
    padding: 1px 4px;
  }
  .sup-explain-footer {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }
  `;
  document.head.appendChild(style);
}

function supEl(tag, opts = {}, ...children) {
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

function supNumberInput(value, onChange, extra = {}) {
  return supEl('input', {
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

function supSelect(options, current, onChange) {
  const s = supEl('select', { onchange: e => onChange(e.target.value) });
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.id;
    o.textContent = opt.label;
    if (opt.id === current) o.selected = true;
    s.appendChild(o);
  });
  return s;
}

// Hose / FL helpers (same C values as other tools)
const SUP_C_BY_DIA = {
  '1.75': 15.5,
  '1.5': 24,
  '2.5': 2,
  '3':   0.8,
  '4':   0.2,
  '5':   0.08,
};

function supGuessDiaFromHoseLabel(label) {
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

function supGetHoseLabelById(hoses, id) {
  const h = hoses.find(x => x.id === id);
  return h ? h.label : '';
}

// FL = C × (GPM/100)² × (length/100)
function supCalcFL(C, gpm, lengthFt) {
  if (!C || !gpm || !lengthFt) return 0;
  const per100 = C * Math.pow(gpm / 100, 2);
  return per100 * (lengthFt / 100);
}

// Supply line math:
// PDP = desiredEndPsi + FL + elevationPsi
function calcSupplyNumbers(state, hoses) {
  const gpm     = Number(state.flowGpm || 0);
  const endPsi  = Number(state.desiredEndPsi || 0);
  const elevFt  = Number(state.elevationFt || 0);
  const length  = Number(state.lengthFt || 0);

  const label = supGetHoseLabelById(hoses, state.hoseSizeId);
  const dia   = String(supGuessDiaFromHoseLabel(label));
  const C     = SUP_C_BY_DIA[dia] || 2;

  const FL       = supCalcFL(C, gpm, length);
  const elevPsi  = elevFt * 0.434;
  const PDP      = endPsi + FL + elevPsi;

  return {
    gpm: Math.round(gpm),
    FL: Math.round(FL),
    elevPsi: Math.round(elevPsi),
    desiredEndPsi: endPsi,
    PDP: Math.round(PDP),
  };
}

/**
 * Supply line popup entry point
 *
 * @param {Object} opts
 *   - dept: { hoses: [{id,label}] }
 *   - initial: optional existing supply config
 *   - onSave: function(config) -> void
 */

// Pretty label for internal hose IDs so the dropdown is easier to read.
function supplyPrettyHoseLabelFromId(id) {
  if (!id) return '';
  // Common attack line sizes
  if (id === 'h_1') return '1\" attack hose';
  if (id === 'h_15') return '1 1/2\" attack hose';
  if (id === 'h_175') return '1 3/4\" attack hose';
  if (id === 'h_2') return '2\" attack hose';
  if (id === 'h_25') return '2 1/2\" attack hose';
  if (id === 'h_3') return '3\" attack hose';

  // Supply / LDH
  if (id === 'h_3_supply') return '3\" supply line';
  if (id === 'h_4_ldh') return '4\" LDH supply';
  if (id === 'h_5_ldh') return '5\" LDH supply';

  // Wildland / booster
  if (id === 'h_w_1') return '1\" wildland hose';
  if (id === 'h_w_15') return '1 1/2\" wildland hose';
  if (id === 'h_booster_1') return '1\" booster reel';

  // Low-friction / special
  if (id === 'h_lf_175') return '1 3/4\" low-friction attack';

  // Fallback – show raw id
  return id;
}
export function openSupplyLinePopup({
  dept = {},
  initial = null,
  onSave = () => {},
  liveGpm = null,
} = {}) {
  injectSupplyStyles();

  let hoses = dept.hoses || [];

  // Ensure hose list is usable in the dropdown. If it's empty or contains
  // simple strings, normalize to objects with id/label. If there are no
  // department hoses at all, fall back to common supply sizes.
  if (!Array.isArray(hoses) || hoses.length === 0) {
    hoses = [
      { id: 'h_3_supply', label: '3\" supply line' },
      { id: 'h_4_ldh', label: '4\" LDH supply' },
      { id: 'h_5_ldh', label: '5\" LDH supply' },
    ];
  } else if (typeof hoses[0] === 'string') {
    hoses = hoses.map((h, idx) => {
      const id = String(h);
      return {
        id,
        label: supplyPrettyHoseLabelFromId(id),
      };
    });
  } else if (hoses[0] && typeof hoses[0] === 'object') {
    hoses = hoses.map((h, idx) => {
      const id = h.id != null ? String(h.id) : String(h.value ?? h.name ?? idx);
      let label = h.label || h.name || '';
      if (!label || label === id) {
        label = supplyPrettyHoseLabelFromId(id);
      }
      return { ...h, id, label };
    });
  }

  // Decide starting GPM:
  // - If a live GPM is passed from the main calc and > 0, use that.
  // - Else if the initial preset has a GPM > 0, use that.
  // - Else fall back to 1 gpm so the math still works.
  let startingGpm = 1;
  if (typeof liveGpm === 'number' && liveGpm > 0) {
    startingGpm = Math.round(liveGpm);
  } else if (initial && typeof initial === 'object' && typeof initial.flowGpm === 'number' && initial.flowGpm > 0) {
    startingGpm = initial.flowGpm;
  }

  const state = {
    hoseSizeId: hoses[0]?.id || '',
    lengthFt: 300,
    flowGpm: startingGpm,
    desiredEndPsi: 50,  // intake or discharge needed at far end
    elevationFt: 0,
  };

  if (initial && typeof initial === 'object') {
    Object.assign(state, initial);
    // If the stored preset has 0 gpm, still respect the startingGpm rule.
    if (!(typeof state.flowGpm === 'number' && state.flowGpm > 0)) {
      state.flowGpm = startingGpm;
    }
  }

  // --- Popup skeleton ---
  const overlay = document.createElement('div');
  overlay.className = 'sup-overlay';

  const panel = document.createElement('div');
  panel.className = 'sup-panel';

  const header = document.createElement('div');
  header.className = 'sup-header';

  const title = document.createElement('div');
  title.className = 'sup-title';
  title.textContent = 'Supply line setup';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'sup-close';
  closeBtn.textContent = '✕';

  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'sup-body';

  const footer = document.createElement('div');
  footer.className = 'sup-footer';

  const explainBtn = document.createElement('button');
  explainBtn.type = 'button';
  explainBtn.className = 'sup-btn-secondary';
  explainBtn.textContent = 'Explain math';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'sup-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'sup-btn-primary';
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
  previewBar.className = 'sup-preview';

  function updatePreview() {
    const vals = calcSupplyNumbers(state, hoses);
    const line1 = `Flow: ${vals.gpm} gpm  •  Desired end: ${vals.desiredEndPsi} psi`;
    const line2 = `FL: ${vals.FL} psi  •  Elevation: ${vals.elevPsi} psi  •  PDP: ${vals.PDP} psi`;
    previewBar.textContent = `${line1}   •   ${line2}`;
  }

  // --- Explain math popup ---
  function openExplainPopup() {
    const vals = calcSupplyNumbers(state, hoses);

    const overlay2 = document.createElement('div');
    overlay2.className = 'sup-explain-overlay';

    const panel2 = document.createElement('div');
    panel2.className = 'sup-explain-panel';

    const header2 = document.createElement('div');
    header2.className = 'sup-explain-header';

    const title2 = document.createElement('div');
    title2.className = 'sup-explain-title';
    title2.textContent = 'Supply line math breakdown';

    const close2 = document.createElement('button');
    close2.type = 'button';
    close2.className = 'sup-close';
    close2.textContent = '✕';

    header2.append(title2, close2);

    const body2 = document.createElement('div');
    body2.className = 'sup-explain-body';

    body2.innerHTML = `
      <p>This preset treats the hose as a simple supply line between two points.</p>

      <p><strong>Inputs:</strong></p>
      <ul>
        <li>Flow: <code>${vals.gpm} gpm</code></li>
        <li>Desired pressure at receiving end: <code>${vals.desiredEndPsi} psi</code></li>
        <li>Elevation change: <code>${state.elevationFt || 0} ft</code></li>
        <li>Hose length: <code>${state.lengthFt || 0} ft</code></li>
      </ul>

      <p><strong>Step 1 – Friction loss:</strong></p>
      <p>
        We use the standard formula
        <code>FL = C × (GPM/100)² × (length/100)</code> for the hose size you selected.<br>
        → <code>FL ≈ ${vals.FL} psi</code>
      </p>

      <p><strong>Step 2 – Elevation:</strong></p>
      <p>
        Elevation gain is ~0.434 psi per foot of rise:<br>
        <code>Elevation psi ≈ ${state.elevationFt || 0} ft × 0.434 ≈ ${vals.elevPsi} psi</code>
      </p>

      <p><strong>Step 3 – Pump discharge pressure (PDP):</strong></p>
      <p>
        We add the desired pressure at the far end plus friction loss and elevation:<br>
        <code>
          PDP = Desired_end_psi + FL + Elevation
          = ${vals.desiredEndPsi} + ${vals.FL} + ${vals.elevPsi}
          ≈ ${vals.PDP} psi
        </code>
      </p>

      <p>This gives you a quick target PDP to maintain the desired pressure at the
      receiving engine, appliance, or FDC for the flow you entered.</p>
    `;

    const footer2 = document.createElement('div');
    footer2.className = 'sup-explain-footer';

    const ok2 = document.createElement('button');
    ok2.type = 'button';
    ok2.className = 'sup-btn-primary';
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

  // --- UI sections ---

  const mainSection = supEl('div', { class: 'sup-section' },
    supEl('h3', { text: 'Supply line details' }),
    supEl('div', { class: 'sup-row' },
      supEl('label', { text: 'Hose size:' }),
      supSelect(hoses, state.hoseSizeId, v => { state.hoseSizeId = v; updatePreview(); })
    ),
    supEl('div', { class: 'sup-row' },
      supEl('label', { text: 'Hose length:' }),
      supNumberInput(state.lengthFt, v => { state.lengthFt = v === '' ? 0 : v; updatePreview(); }),
      supEl('span', { text: 'ft' })
    ),
    supEl('div', { class: 'sup-row' },
      supEl('label', { text: 'Flow:' }),
      supNumberInput(state.flowGpm, v => { state.flowGpm = v === '' ? 0 : v; updatePreview(); }),
      supEl('span', { text: 'gpm' })
    ),
    supEl('div', { class: 'sup-row' },
      supEl('label', { text: 'Desired pressure at receiving end:' }),
      supNumberInput(state.desiredEndPsi, v => { state.desiredEndPsi = v === '' ? 0 : v; updatePreview(); }),
      supEl('span', { text: 'psi (intake / discharge)' })
    ),
    supEl('div', { class: 'sup-row' },
      supEl('label', { text: 'Elevation change:' }),
      supNumberInput(state.elevationFt, v => { state.elevationFt = v === '' ? 0 : v; updatePreview(); }),
      supEl('span', { text: 'ft (positive = up hill to receiving end)' })
    )
  );

  body.append(mainSection, previewBar);
  updatePreview();

  explainBtn.addEventListener('click', openExplainPopup);

  // Save handler – returns config + lastCalc
  saveBtn.addEventListener('click', () => {
    const lastCalc = calcSupplyNumbers(state, hoses);
    const payload = {
      hoseSizeId: state.hoseSizeId,
      lengthFt: state.lengthFt,
      flowGpm: state.flowGpm,
      desiredEndPsi: state.desiredEndPsi,
      elevationFt: state.elevationFt,
      lastCalc,
    };
    onSave(payload);
    close();
  });
}
