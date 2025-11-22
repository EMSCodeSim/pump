// view.lineSprinkler.js
// Sprinkler / FDC supply popup for a single line.
//
// - Design area (ft²) & density (gpm/ft²)
// - Required remote head pressure + system loss
// - Elevation gain (ft)
// - 1 or 2 supply lines to FDC, each with hose size + length
// - Live preview: required flow GPM, per-line GPM, PDP
// - "Explain math" popup
//
// Usage example:
//   openSprinklerPopup({
//     dept: { hoses },           // optional
//     initial: existingConfig,   // optional
//     onSave(config) { ... }
//   });

let sprinklerStylesInjected = false;

function injectSprinklerStyles() {
  if (sprinklerStylesInjected) return;
  sprinklerStylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
  .spr-overlay {
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

  .spr-panel {
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
    .spr-panel {
      margin-top: 12px;
      border-radius: 20px;
      padding: 14px 16px 12px;
    }
  }

  .spr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }

  .spr-title {
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .spr-close {
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
  .spr-close:hover {
    background: #111827;
  }

  .spr-body {
    font-size: 0.85rem;
    line-height: 1.45;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .spr-footer {
    display: flex;
    flex-direction: row;
    gap: 6px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }

  .spr-btn-primary,
  .spr-btn-secondary {
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

  .spr-btn-primary {
    background: linear-gradient(135deg, #38bdf8, #22c55e);
    color: #020617;
    font-weight: 600;
  }

  .spr-btn-secondary {
    background: rgba(15, 23, 42, 0.9);
    color: #e5e7eb;
    border: 1px solid rgba(148, 163, 184, 0.7);
  }

  .spr-btn-primary:active,
  .spr-btn-secondary:active {
    transform: translateY(1px);
  }

  .spr-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }

  .spr-row label {
    font-weight: 500;
    font-size: 0.82rem;
  }

  .spr-row span {
    font-size: 0.8rem;
  }

  .spr-panel input[type="text"],
  .spr-panel input[type="number"],
  .spr-panel select {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(55, 65, 81, 0.9);
    background: #020617;
    color: #e5e7eb;
    font-size: 0.8rem;
  }

  .spr-panel input::placeholder {
    color: rgba(148, 163, 184, 0.9);
  }

  .spr-section {
    border-top: 1px solid rgba(148, 163, 184, 0.4);
    padding-top: 8px;
    margin-top: 6px;
  }
  .spr-section:first-of-type {
    border-top: none;
  }

  .spr-section h3 {
    margin: 0 0 4px 0;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #bfdbfe;
  }

  .spr-subsection {
    border: 1px solid rgba(30, 64, 175, 0.5);
    background: rgba(15, 23, 42, 0.85);
    padding: 6px;
    border-radius: 10px;
    margin-top: 6px;
  }
  .spr-subsection h4 {
    margin: 0 0 4px 0;
    font-size: 0.8rem;
    color: #bfdbfe;
  }

  .spr-toggle-group {
    display: inline-flex;
    gap: 4px;
  }
  .spr-toggle-group button {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid rgba(75, 85, 99, 0.9);
    background: rgba(15, 23, 42, 0.9);
    font-size: 0.78rem;
    color: #e5e7eb;
    cursor: pointer;
  }
  .spr-toggle-on {
    background: #0ea5e9;
    border-color: #0ea5e9;
    color: #020617;
  }

  .spr-preview {
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
    .spr-row {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }
    .spr-row > label {
      min-width: 130px;
    }
    .spr-row input,
    .spr-row select {
      width: auto;
      min-width: 120px;
    }
    .spr-two-cols {
      display: flex;
      flex-direction: row;
      gap: 8px;
    }
    .spr-subsection {
      flex: 1 1 48%;
    }
  }

  /* Explain math popup */
  .spr-explain-overlay {
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
  .spr-explain-panel {
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
  .spr-explain-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }
  .spr-explain-title {
    font-size: 0.95rem;
    font-weight: 600;
  }
  .spr-explain-body {
    font-size: 0.83rem;
    line-height: 1.5;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .spr-explain-body code {
    font-size: 0.8rem;
    background: rgba(15, 23, 42, 0.9);
    border-radius: 4px;
    padding: 1px 4px;
  }
  .spr-explain-footer {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }
  `;
  document.head.appendChild(style);
}

function sprEl(tag, opts = {}, ...children) {
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

function sprNumberInput(value, onChange, extra = {}) {
  return sprEl('input', {
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

function sprSelect(options, current, onChange) {
  const s = sprEl('select', { onchange: e => onChange(e.target.value) });
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
const SPR_C_BY_DIA = {
  '1.75': 15.5,
  '1.5': 24,
  '2.5': 2,
  '3':   0.8,
  '4':   0.2,
  '5':   0.08,
};

function sprGuessDiaFromHoseLabel(label) {
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

function sprGetHoseLabelById(hoses, id) {
  const h = hoses.find(x => x.id === id);
  return h ? h.label : '';
}

function sprCalcFL(C, gpm, lengthFt) {
  if (!C || !gpm || !lengthFt) return 0;
  const per100 = C * Math.pow(gpm / 100, 2);
  return per100 * (lengthFt / 100);
}

// Sprinkler math:
// Required flow = area × density
// PDP = remoteHeadPsi + FL (worst supply line) + Elev + System loss
function calcSprinklerNumbers(state, hoses) {
  const area   = Number(state.areaSqFt || 0);
  const dens   = Number(state.density || 0);
  const remote = Number(state.remoteHeadPsi || 0);
  const sys    = Number(state.systemLossPsi || 0);
  const elevFt = Number(state.elevationFt || 0);
  const lines  = state.feedLines === 2 ? 2 : 1;

  const requiredFlow = area > 0 && dens > 0 ? area * dens : 0;
  const gpmPerLine   = lines > 0 ? requiredFlow / lines : 0;

  let worstFL = 0;

  const feeds = [];
  if (lines === 1) {
    feeds.push(state.supply1);
  } else {
    feeds.push(state.supply1, state.supply2);
  }

  feeds.forEach(feed => {
    if (!feed) return;
    const label = sprGetHoseLabelById(hoses, feed.hoseSizeId);
    const dia   = String(sprGuessDiaFromHoseLabel(label));
    const C     = SPR_C_BY_DIA[dia] || 2;
    const len   = feed.lengthFt || 0;
    const fl    = sprCalcFL(C, gpmPerLine, len);
    if (fl > worstFL) worstFL = fl;
  });

  const elevPsi = elevFt * 0.434;
  const PDP     = remote + worstFL + elevPsi + sys;

  return {
    areaSqFt: area,
    density: dens,
    requiredFlowGpm: Math.round(requiredFlow),
    perLineGpm: lines > 0 ? Math.round(gpmPerLine) : 0,
    FL: Math.round(worstFL),
    elevPsi: Math.round(elevPsi),
    systemLossPsi: sys,
    remoteHeadPsi: remote,
    PDP: Math.round(PDP),
    feedLines: lines,
  };
}

/**
 * Sprinkler popup entry point
 *
 * @param {Object} opts
 *   - dept: { hoses: [{id,label}] }
 *   - initial: optional existing sprinkler config
 *   - onSave: function(config) -> void
 */
export function openSprinklerPopup({
  dept = {},
  initial = null,
  onSave = () => {},
} = {}) {
  injectSprinklerStyles();

  const hoses = dept.hoses || [];

  const state = {
    hazard: 'ordinary',        // label only for now
    areaSqFt: 1500,
    density: 0.15,             // gpm/ft²
    remoteHeadPsi: 100,        // required at remote head or base-riser
    systemLossPsi: 15,         // system losses
    elevationFt: 0,            // engine below/above FDC
    feedLines: 2,              // 1 or 2 supply lines

    supply1: {
      hoseSizeId: hoses[0]?.id || '',
      lengthFt: 150,
    },
    supply2: {
      hoseSizeId: hoses[0]?.id || '',
      lengthFt: 150,
    },
  };

  if (initial && typeof initial === 'object') {
    Object.assign(state, initial);
    if (!initial.supply1 && initial.supply) {
      state.supply1 = { ...state.supply1, ...initial.supply };
    }
  }

  // --- Popup skeleton ---
  const overlay = document.createElement('div');
  overlay.className = 'spr-overlay';

  const panel = document.createElement('div');
  panel.className = 'spr-panel';

  const header = document.createElement('div');
  header.className = 'spr-header';

  const title = document.createElement('div');
  title.className = 'spr-title';
  title.textContent = 'Sprinkler / FDC setup';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'spr-close';
  closeBtn.textContent = '✕';

  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'spr-body';

  const footer = document.createElement('div');
  footer.className = 'spr-footer';

  const explainBtn = document.createElement('button');
  explainBtn.type = 'button';
  explainBtn.className = 'spr-btn-secondary';
  explainBtn.textContent = 'Explain math';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'spr-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'spr-btn-primary';
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
  previewBar.className = 'spr-preview';

  function updatePreview() {
    const vals = calcSprinklerNumbers(state, hoses);
    const line1 = `Required flow: ${vals.requiredFlowGpm} gpm  (${vals.areaSqFt} ft² × ${vals.density} gpm/ft²)`;
    const line2 = `Lines: ${vals.feedLines}  •  Per line: ${vals.perLineGpm} gpm  •  PDP: ${vals.PDP} psi`;
    previewBar.textContent = `${line1}   •   ${line2}`;
  }

  // --- Explain math popup ---
  function openExplainPopup() {
    const vals = calcSprinklerNumbers(state, hoses);

    const overlay2 = document.createElement('div');
    overlay2.className = 'spr-explain-overlay';

    const panel2 = document.createElement('div');
    panel2.className = 'spr-explain-panel';

    const header2 = document.createElement('div');
    header2.className = 'spr-explain-header';

    const title2 = document.createElement('div');
    title2.className = 'spr-explain-title';
    title2.textContent = 'Sprinkler system math breakdown';

    const close2 = document.createElement('button');
    close2.type = 'button';
    close2.className = 'spr-close';
    close2.textContent = '✕';

    header2.append(title2, close2);

    const body2 = document.createElement('div');
    body2.className = 'spr-explain-body';

    const lines = vals.feedLines;

    body2.innerHTML = `
      <p>We treat this as supplying an automatic sprinkler system through the FDC.</p>

      <p><strong>Step 1 – Required flow from area and density:</strong></p>
      <p>
        <code>Required GPM = Area × Density</code><br>
        Area = <code>${vals.areaSqFt} ft²</code>,
        Density = <code>${vals.density} gpm/ft²</code><br>
        → <code>${vals.areaSqFt} × ${vals.density} ≈ ${vals.requiredFlowGpm} gpm</code>
      </p>

      <p><strong>Step 2 – Split between supply lines:</strong></p>
      <p>
        We divide the required flow between ${lines} supply line${lines === 1 ? '' : 's'} to the FDC.<br>
        <code>GPM_per_line = Required GPM / lines = ${vals.requiredFlowGpm} / ${lines}
        ≈ ${vals.perLineGpm} gpm</code>
      </p>

      <p><strong>Step 3 – Friction loss in supply line(s):</strong></p>
      <p>
        For each supply line to the FDC we use:<br>
        <code>FL = C × (GPM_per_line/100)² × (length/100)</code><br>
        We take the <em>worst</em> (highest) friction loss as the controlling line.<br>
        → FL ≈ <code>${vals.FL} psi</code>
      </p>

      <p><strong>Step 4 – Elevation:</strong></p>
      <p>
        Elevation gain is ~0.434 psi per foot:<br>
        <code>Elevation psi ≈ ${state.elevationFt || 0} ft × 0.434 ≈ ${vals.elevPsi} psi</code>
      </p>

      <p><strong>Step 5 – Remote head + system loss:</strong></p>
      <p>
        Remote head requirement: <code>${vals.remoteHeadPsi} psi</code><br>
        System loss (valves, riser, fittings, etc.): <code>${vals.systemLossPsi} psi</code>
      </p>

      <p><strong>Final pump discharge pressure (PDP):</strong></p>
      <p>
        <code>
          PDP = Remote head +
                FL +
                Elevation +
                System loss
          = ${vals.remoteHeadPsi} +
            ${vals.FL} +
            ${vals.elevPsi} +
            ${vals.systemLossPsi}
          ≈ ${vals.PDP} psi
        </code>
      </p>

      <p>This gives you an FDC supply preset: required GPM for the design area,
      approximate friction loss in the supply lines, and a target PDP to hit the
      remote head pressure for the system.</p>
    `;

    const footer2 = document.createElement('div');
    footer2.className = 'spr-explain-footer';

    const ok2 = document.createElement('button');
    ok2.type = 'button';
    ok2.className = 'spr-btn-primary';
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

  const hazardSection = sprEl('div', { class: 'spr-section' },
    sprEl('h3', { text: 'Design area & hazard' }),
    sprEl('div', { class: 'spr-row' },
      sprEl('label', { text: 'Hazard class (note only):' }),
      (function () {
        const selectHaz = sprEl('select', {
          onchange: (e) => {
            state.hazard = e.target.value;
          }
        });
        [
          { id: 'light',    label: 'Light hazard' },
          { id: 'ordinary', label: 'Ordinary hazard' },
          { id: 'extra',    label: 'Extra hazard' },
        ].forEach(opt => {
          const o = document.createElement('option');
          o.value = opt.id;
          o.textContent = opt.label;
          if (opt.id === state.hazard) o.selected = true;
          selectHaz.appendChild(o);
        });
        return selectHaz;
      })()
    ),
    sprEl('div', { class: 'spr-row' },
      sprEl('label', { text: 'Design area:' }),
      sprNumberInput(state.areaSqFt, v => { state.areaSqFt = v; updatePreview(); }),
      sprEl('span', { text: 'ft²' }),
      sprEl('span', { text: 'Density:' }),
      sprNumberInput(state.density, v => { state.density = v; updatePreview(); }, { step: '0.01' }),
      sprEl('span', { text: 'gpm/ft²' })
    )
  );

  const pressureSection = sprEl('div', { class: 'spr-section' },
    sprEl('h3', { text: 'Pressure & elevation' }),
    sprEl('div', { class: 'spr-row' },
      sprEl('label', { text: 'Remote head pressure:' }),
      sprNumberInput(state.remoteHeadPsi, v => { state.remoteHeadPsi = v; updatePreview(); }),
      sprEl('span', { text: 'psi at most remote point' })
    ),
    sprEl('div', { class: 'spr-row' },
      sprEl('label', { text: 'System loss:' }),
      sprNumberInput(state.systemLossPsi, v => { state.systemLossPsi = v; updatePreview(); }),
      sprEl('span', { text: 'psi (riser, valves, fittings)' })
    ),
    sprEl('div', { class: 'spr-row' },
      sprEl('label', { text: 'Elevation change:' }),
      sprNumberInput(state.elevationFt, v => { state.elevationFt = v; updatePreview(); }),
      sprEl('span', { text: 'ft (positive = engine below FDC)' })
    )
  );

  const feedLinesToggle = (() => {
    const oneBtn = sprEl('button', {
      text: '1 line',
      onclick: (e) => {
        e.preventDefault();
        state.feedLines = 1;
        refresh();
        renderFeeds();
        updatePreview();
      }
    });
    const twoBtn = sprEl('button', {
      text: '2 lines',
      onclick: (e) => {
        e.preventDefault();
        state.feedLines = 2;
        refresh();
        renderFeeds();
        updatePreview();
      }
    });
    function refresh() {
      oneBtn.classList.toggle('spr-toggle-on', state.feedLines !== 2);
      twoBtn.classList.toggle('spr-toggle-on', state.feedLines === 2);
    }
    refresh();
    return {
      root: sprEl('span', { class: 'spr-toggle-group' }, oneBtn, twoBtn),
      refresh
    };
  })();

  const supplySection = sprEl('div', { class: 'spr-section' },
    sprEl('h3', { text: 'Supply lines to FDC' }),
    sprEl('div', { class: 'spr-row' },
      sprEl('label', { text: 'Number of supply lines:' }),
      feedLinesToggle.root
    )
  );
  const supplyContent = sprEl('div');
  supplySection.appendChild(supplyContent);

  function supplyBlock(label, feedState) {
    return sprEl('div', { class: 'spr-subsection' },
      sprEl('h4', { text: label }),
      sprEl('div', { class: 'spr-row' },
        sprEl('label', { text: 'Hose size:' }),
        sprSelect(hoses, feedState.hoseSizeId, v => { feedState.hoseSizeId = v; updatePreview(); }),
        sprEl('span', { text: 'Length:' }),
        sprNumberInput(feedState.lengthFt, v => { feedState.lengthFt = v === '' ? 0 : v; updatePreview(); }),
        sprEl('span', { text: 'ft' })
      )
    );
  }

  function renderFeeds() {
    supplyContent.innerHTML = '';

    const lines = state.feedLines === 2 ? 2 : 1;

    if (lines === 1) {
      supplyContent.append(
        sprEl('div', { class: 'spr-row' },
          supplyBlock('Supply line', state.supply1)
        )
      );
    } else {
      supplyContent.append(
        sprEl('div', { class: 'spr-row spr-two-cols' },
          supplyBlock('Supply line 1', state.supply1),
          supplyBlock('Supply line 2', state.supply2)
        )
      );
    }
  }

  renderFeeds();

  body.append(hazardSection, pressureSection, supplySection, previewBar);
  updatePreview();

  explainBtn.addEventListener('click', openExplainPopup);

  // Save handler – returns compact config + lastCalc
  saveBtn.addEventListener('click', () => {
    const lastCalc = calcSprinklerNumbers(state, hoses);
    const payload = {
      hazard: state.hazard,
      areaSqFt: state.areaSqFt,
      density: state.density,
      remoteHeadPsi: state.remoteHeadPsi,
      systemLossPsi: state.systemLossPsi,
      elevationFt: state.elevationFt,
      feedLines: state.feedLines === 2 ? 2 : 1,
      supply1: { ...state.supply1 },
      supply2: { ...state.supply2 },
      requiredFlowGpm: lastCalc.requiredFlowGpm,
      lastCalc,
    };
    onSave(payload);
    close();
  });
}
