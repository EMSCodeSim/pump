// view.lineSprinkler.js
// Sprinkler system popup builder for a single preset / line.
//
// - System type: Wet / Dry / Preaction / Deluge
// - Design area & density method (NFPA-style)
// - Hose allowance (gpm)
// - Remote head required pressure (psi)
// - Pipe loss & elevation
// - Live preview: Total GPM, PDP
// - "Explain math" popup
//
// Usage:
//   openSprinklerPopup({
//     initial: existingSprinklerConfig,
//     onSave(config) { ... }
//   });

let sprinklerStylesInjected = false;

function injectSprinklerStyles() {
  if (sprinklerStylesInjected) return;
  sprinklerStylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
  .sk-overlay {
    position: fixed;
    inset: 0;
    background: rgba(3, 7, 18, 0.55);
    backdrop-filter: blur(6px);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 40px;
    z-index: 10100;
    overflow-y: auto;
  }

  .sk-panel {
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
    .sk-panel {
      margin-top: 12px;
      border-radius: 20px;
      padding: 14px 16px 12px;
    }
  }

  .sk-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }

  .sk-title {
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .sk-close {
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
  .sk-close:hover {
    background: #111827;
  }

  .sk-body {
    font-size: 0.85rem;
    line-height: 1.45;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .sk-footer {
    display: flex;
    flex-direction: row;
    gap: 6px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }

  .sk-btn-primary,
  .sk-btn-secondary {
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

  .sk-btn-primary {
    background: linear-gradient(135deg, #38bdf8, #22c55e);
    color: #020617;
    font-weight: 600;
  }

  .sk-btn-secondary {
    background: rgba(15, 23, 42, 0.9);
    color: #e5e7eb;
    border: 1px solid rgba(148, 163, 184, 0.7);
  }

  .sk-btn-primary:active,
  .sk-btn-secondary:active {
    transform: translateY(1px);
  }

  .sk-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }

  .sk-row label {
    font-weight: 500;
    font-size: 0.82rem;
  }

  .sk-row span {
    font-size: 0.8rem;
  }

  .sk-panel input[type="text"],
  .sk-panel input[type="number"],
  .sk-panel select {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(55, 65, 81, 0.9);
    background: #020617;
    color: #e5e7eb;
    font-size: 0.8rem;
  }

  .sk-panel input::placeholder {
    color: rgba(148, 163, 184, 0.9);
  }

  .sk-section {
    border-top: 1px solid rgba(148, 163, 184, 0.4);
    padding-top: 8px;
    margin-top: 6px;
  }
  .sk-section:first-of-type {
    border-top: none;
  }

  .sk-section h3 {
    margin: 0 0 4px 0;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #bfdbfe;
  }

  .sk-subsection {
    border: 1px solid rgba(30, 64, 175, 0.5);
    background: rgba(15, 23, 42, 0.85);
    padding: 6px;
    border-radius: 10px;
    margin-top: 6px;
  }
  .sk-subsection h4 {
    margin: 0 0 4px 0;
    font-size: 0.8rem;
    color: #bfdbfe;
  }

  .sk-toggle-group {
    display: inline-flex;
    gap: 4px;
  }
  .sk-toggle-group button {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid rgba(75, 85, 99, 0.9);
    background: rgba(15, 23, 42, 0.9);
    font-size: 0.78rem;
    color: #e5e7eb;
    cursor: pointer;
  }
  .sk-toggle-on {
    background: #0ea5e9;
    border-color: #0ea5e9;
    color: #020617;
  }

  .sk-preview {
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
    .sk-row {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }
    .sk-row > label {
      min-width: 130px;
    }
    .sk-row input,
    .sk-row select {
      width: auto;
      min-width: 120px;
    }
  }

  /* Explain math popup */
  .sk-explain-overlay {
    position: fixed;
    inset: 0;
    background: rgba(3, 7, 18, 0.75);
    backdrop-filter: blur(6px);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 40px;
    z-index: 10110;
    overflow-y: auto;
  }
  .sk-explain-panel {
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
  .sk-explain-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }
  .sk-explain-title {
    font-size: 0.95rem;
    font-weight: 600;
  }
  .sk-explain-body {
    font-size: 0.83rem;
    line-height: 1.5;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .sk-explain-body code {
    font-size: 0.8rem;
    background: rgba(15, 23, 42, 0.9);
    border-radius: 4px;
    padding: 1px 4px;
  }
  .sk-explain-footer {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }
  `;
  document.head.appendChild(style);
}

function skEl(tag, opts = {}, ...children) {
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

function skNumberInput(value, onChange, extra = {}) {
  return skEl('input', {
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

// Simple sprinkler math (desktop & phone friendly):
// - designGpm = designAreaSqFt × density
// - totalGpm = designGpm + hoseAllowanceGpm
// - elevPsi = 0.434 × elevationFt
// - PDP = remoteHeadReqPsi + remotePipeLossPsi + elevPsi
function calcSprinklerNumbers(state) {
  const area      = Number(state.designAreaSqFt || 0);
  const density   = Number(state.density || 0);
  const hoseAllow = Number(state.hoseAllowanceGpm || 0);
  const headPsi   = Number(state.remoteHeadReqPsi || 7);
  const pipeLoss  = Number(state.remotePipeLossPsi || 0);
  const elevFt    = Number(state.elevationFt || 0);

  const designGpm = area * density;
  const totalGpm  = designGpm + hoseAllow;
  const elevPsi   = elevFt * 0.434;
  const pdp       = headPsi + pipeLoss + elevPsi;

  return {
    area,
    density,
    designGpm:   Math.round(designGpm * 10) / 10,
    hoseAllowanceGpm: hoseAllow,
    totalGpm:    Math.round(totalGpm * 10) / 10,
    headPsi,
    pipeLossPsi: pipeLoss,
    elevFt,
    elevPsi:     Math.round(elevPsi * 10) / 10,
    pdp:         Math.round(pdp),
  };
}

/**
 * Sprinkler popup entry point
 *
 * @param {Object} opts
 *   - initial: optional existing sprinkler config
 *   - onSave: function(config) -> void
 */
export function openSprinklerPopup({
  initial = null,
  onSave = () => {},
} = {}) {
  injectSprinklerStyles();

  const state = {
    systemType: 'wet',          // 'wet' | 'dry' | 'preaction' | 'deluge'
    designAreaSqFt: 1500,       // ft²
    density: 0.15,              // gpm/ft²
    hoseAllowanceGpm: 250,      // extra hose stream allowance
    remoteHeadReqPsi: 7,        // psi at most remote sprinkler
    remotePipeLossPsi: 15,      // riser + underground + branch line loss
    elevationFt: 0,             // elev gain above pump
  };

  if (initial && typeof initial === 'object') {
    Object.assign(state, initial);
  }

  // --- Popup skeleton ---
  const overlay = document.createElement('div');
  overlay.className = 'sk-overlay';

  const panel = document.createElement('div');
  panel.className = 'sk-panel';

  const header = document.createElement('div');
  header.className = 'sk-header';

  const title = document.createElement('div');
  title.className = 'sk-title';
  title.textContent = 'Sprinkler system setup';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'sk-close';
  closeBtn.textContent = '✕';

  header.append(title, closeBtn);

  const body = document.createElement('div');
  body.className = 'sk-body';

  const footer = document.createElement('div');
  footer.className = 'sk-footer';

  const explainBtn = document.createElement('button');
  explainBtn.type = 'button';
  explainBtn.className = 'sk-btn-secondary';
  explainBtn.textContent = 'Explain math';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'sk-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'sk-btn-primary';
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

  // --- Preview ---
  const previewBar = document.createElement('div');
  previewBar.className = 'sk-preview';

  function updatePreview() {
    const vals = calcSprinklerNumbers(state);
    previewBar.textContent =
      `Sprinkler – Flow: ${vals.totalGpm} gpm (design ${vals.designGpm} + ${vals.hoseAllowanceGpm} hose)` +
      `   •   PDP: ${vals.pdp} psi`;
  }

  // --- Explain popup ---
  function openExplainPopup() {
    const vals = calcSprinklerNumbers(state);

    const overlay2 = document.createElement('div');
    overlay2.className = 'sk-explain-overlay';

    const panel2 = document.createElement('div');
    panel2.className = 'sk-explain-panel';

    const header2 = document.createElement('div');
    header2.className = 'sk-explain-header';

    const title2 = document.createElement('div');
    title2.className = 'sk-explain-title';
    title2.textContent = 'Sprinkler system math breakdown';

    const close2 = document.createElement('button');
    close2.type = 'button';
    close2.className = 'sk-close';
    close2.textContent = '✕';

    header2.append(title2, close2);

    const body2 = document.createElement('div');
    body2.className = 'sk-explain-body';

    const systemMap = {
      wet: 'Wet pipe system',
      dry: 'Dry pipe system',
      preaction: 'Preaction system',
      deluge: 'Deluge system',
    };
    const sysLabel = systemMap[state.systemType] || state.systemType;

    body2.innerHTML = `
      <p>This sprinkler preset is based on a NFPA-style design area and density, plus hose allowance.</p>

      <p><strong>System type:</strong> <code>${sysLabel}</code></p>

      <p><strong>Step 1 – Design discharge:</strong></p>
      <p>
        We use design area × density to get the required sprinkler flow.<br>
        <code>
          Design GPM = Area × Density
          = ${vals.area} ft² × ${vals.density} gpm/ft²
          ≈ ${vals.designGpm} gpm
        </code>
      </p>

      <p><strong>Step 2 – Hose allowance:</strong></p>
      <p>
        A hose stream allowance is added to cover firefighters operating handlines off the system.<br>
        <code>
          Hose allowance = ${vals.hoseAllowanceGpm} gpm
        </code>
      </p>

      <p><strong>Step 3 – Total system flow:</strong></p>
      <p>
        <code>
          Total GPM = Design GPM + Hose allowance
          = ${vals.designGpm} + ${vals.hoseAllowanceGpm}
          ≈ ${vals.totalGpm} gpm
        </code>
      </p>

      <p><strong>Step 4 – Elevation pressure:</strong></p>
      <p>
        We approximate elevation gain as <code>0.434 psi / ft</code> of rise.<br>
        <code>
          Elevation psi = 0.434 × Elevation(ft)
          = 0.434 × ${vals.elevFt}
          ≈ ${vals.elevPsi} psi
        </code>
      </p>

      <p><strong>Step 5 – Pipe/friction losses:</strong></p>
      <p>
        Riser, underground, and branch line friction is stored as a single "remote pipe loss" value.<br>
        <code>
          Pipe loss ≈ ${vals.pipeLossPsi} psi
        </code>
      </p>

      <p><strong>Step 6 – Pressure at most remote head:</strong></p>
      <p>
        We assume the sprinkler design requires a certain pressure at the most remote head
        (often 7 psi or more, depending on the K-factor and design).<br>
        <code>
          Required head pressure = ${vals.headPsi} psi
        </code>
      </p>

      <p><strong>Final pump discharge pressure (PDP):</strong></p>
      <p>
        <code>
          PDP = Head pressure + Pipe loss + Elevation
          = ${vals.headPsi} + ${vals.pipeLossPsi} + ${vals.elevPsi}
          ≈ ${vals.pdp} psi
        </code>
      </p>

      <p>This preset answers: "If I need a ${vals.density} gpm/ft² density over ${vals.area} ft²,
      plus ${vals.hoseAllowanceGpm} gpm hose allowance, what flow and pump pressure am I aiming for
      to supply that sprinkler system?"</p>
    `;

    const footer2 = document.createElement('div');
    footer2.className = 'sk-explain-footer';

    const ok2 = document.createElement('button');
    ok2.type = 'button';
    ok2.className = 'sk-btn-primary';
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

  // --- UI: system type toggle ---
  const systemToggle = (() => {
    function makeBtn(id, label) {
      return skEl('button', {
        text: label,
        onclick: (e) => {
          e.preventDefault();
          state.systemType = id;
          refresh();
          updatePreview();
        }
      });
    }

    const wetBtn       = makeBtn('wet',       'Wet');
    const dryBtn       = makeBtn('dry',       'Dry');
    const preactionBtn = makeBtn('preaction', 'Preaction');
    const delugeBtn    = makeBtn('deluge',    'Deluge');

    function refresh() {
      const map = { Wet: 'wet', Dry: 'dry', Preaction: 'preaction', Deluge: 'deluge' };
      [wetBtn, dryBtn, preactionBtn, delugeBtn].forEach(btn => {
        const txt = btn.textContent.trim();
        const id  = map[txt];
        btn.classList.toggle('sk-toggle-on', state.systemType === id);
      });
    }
    refresh();

    return {
      root: skEl('span', { class: 'sk-toggle-group' }, wetBtn, dryBtn, preactionBtn, delugeBtn),
      refresh
    };
  })();

  const systemSection = skEl('div', { class: 'sk-section' },
    skEl('h3', { text: 'System type' }),
    skEl('div', { class: 'sk-row' },
      skEl('label', { text: 'System:' }),
      systemToggle.root
    )
  );

  const designSection = skEl('div', { class: 'sk-section' },
    skEl('h3', { text: 'Design area & density' })
  );

  const designRow = skEl('div', { class: 'sk-row' },
    skEl('label', { text: 'Design area:' }),
    skNumberInput(state.designAreaSqFt, v => { state.designAreaSqFt = v; updatePreview(); }),
    skEl('span', { text: 'ft²' }),
    skEl('span', { text: 'Density:' }),
    skNumberInput(state.density, v => { state.density = v; updatePreview(); }, { step: '0.01' }),
    skEl('span', { text: 'gpm/ft²' })
  );

  const hoseRow = skEl('div', { class: 'sk-row' },
    skEl('label', { text: 'Hose allowance:' }),
    skNumberInput(state.hoseAllowanceGpm, v => { state.hoseAllowanceGpm = v; updatePreview(); }),
    skEl('span', { text: 'gpm (NFPA hose stream allowance)' })
  );

  designSection.append(designRow, hoseRow);

  const pressureSection = skEl('div', { class: 'sk-section' },
    skEl('h3', { text: 'Pressure & elevation' })
  );

  const headRow = skEl('div', { class: 'sk-row' },
    skEl('label', { text: 'Head pressure:' }),
    skNumberInput(state.remoteHeadReqPsi, v => { state.remoteHeadReqPsi = v; updatePreview(); }),
    skEl('span', { text: 'psi at most remote sprinkler' })
  );

  const pipeRow = skEl('div', { class: 'sk-row' },
    skEl('label', { text: 'Pipe loss:' }),
    skNumberInput(state.remotePipeLossPsi, v => { state.remotePipeLossPsi = v; updatePreview(); }),
    skEl('span', { text: 'psi (riser + underground + piping)' })
  );

  const elevRow = skEl('div', { class: 'sk-row' },
    skEl('label', { text: 'Elevation gain:' }),
    skNumberInput(state.elevationFt, v => { state.elevationFt = v; updatePreview(); }),
    skEl('span', { text: 'ft above pump (0 if same level)' })
  );

  pressureSection.append(headRow, pipeRow, elevRow);

  body.append(systemSection, designSection, pressureSection, previewBar);
  updatePreview();

  // Save handler
  saveBtn.addEventListener('click', () => {
    const payload = {
      systemType: state.systemType,
      designAreaSqFt: state.designAreaSqFt,
      density: state.density,
      hoseAllowanceGpm: state.hoseAllowanceGpm,
      remoteHeadReqPsi: state.remoteHeadReqPsi,
      remotePipeLossPsi: state.remotePipeLossPsi,
      elevationFt: state.elevationFt,
      lastCalc: calcSprinklerNumbers(state),
    };
    onSave(payload);
    close();
  });
}
