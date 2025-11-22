// view.lineCustom.js
// Custom builder popup for arbitrary hose/appliance layouts.
//
// - Global: target flow (GPM), required pressure at remote point, total elevation
// - Segments list in order from engine → remote point:
//     * Hose segment: hose size + length
//     * Wye: engine→wye hose + Branch A + Branch B
//     * Siamese (dual feed): two supply lines into one appliance
//     * Appliance: department appliance or custom label
// - Preview: approximate total FL + PDP
// - Explain math popup.
//
// Usage:
//   openCustomBuilderPopup({
//     dept: { hoses, appliances },
//     initial: existingCustomConfig,
//     onSave(config) { ... }
//   });

let customStylesInjected = false;

function injectCustomStyles() {
  if (customStylesInjected) return;
  customStylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
  .cb-overlay {
    position: fixed;
    inset: 0;
    background: rgba(3, 7, 18, 0.55);
    backdrop-filter: blur(6px);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 40px;
    z-index: 10160;
    overflow-y: auto;
  }

  .cb-panel {
    position: relative;
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

  @media (min-width: 640px) {
    .cb-panel {
      margin-top: 12px;
      border-radius: 20px;
      padding: 14px 16px 12px;
    }
  }

  .cb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }

  .cb-title {
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .cb-close {
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
  .cb-close:hover {
    background: #111827;
  }

  .cb-body {
    font-size: 0.85rem;
    line-height: 1.45;
    max-height: min(60vh, 440px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .cb-footer {
    display: flex;
    flex-direction: row;
    gap: 6px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }

  .cb-btn-primary,
  .cb-btn-secondary {
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

  .cb-btn-primary {
    background: linear-gradient(135deg, #38bdf8, #22c55e);
    color: #020617;
    font-weight: 600;
  }

  .cb-btn-secondary {
    background: rgba(15, 23, 42, 0.9);
    color: #e5e7eb;
    border: 1px solid rgba(148, 163, 184, 0.7);
  }

  .cb-btn-primary:active,
  .cb-btn-secondary:active {
    transform: translateY(1px);
  }

  .cb-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }

  .cb-row label {
    font-weight: 500;
    font-size: 0.82rem;
  }

  .cb-row span {
    font-size: 0.8rem;
  }

  .cb-panel input[type="text"],
  .cb-panel input[type="number"],
  .cb-panel select {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(55, 65, 81, 0.9);
    background: #020617;
    color: #e5e7eb;
    font-size: 0.8rem;
  }

  .cb-panel input::placeholder {
    color: rgba(148, 163, 184, 0.9);
  }

  .cb-section {
    border-top: 1px solid rgba(148, 163, 184, 0.4);
    padding-top: 8px;
    margin-top: 6px;
  }
  .cb-section:first-of-type {
    border-top: none;
  }

  .cb-section h3 {
    margin: 0 0 4px 0;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #bfdbfe;
  }

  .cb-chiprow {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .cb-chip {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px dashed rgba(148, 163, 184, 0.75);
    background: rgba(15, 23, 42, 0.85);
    font-size: 0.78rem;
    cursor: pointer;
  }

  .cb-chip:hover {
    border-style: solid;
  }

  .cb-seglist {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 6px;
  }

  .cb-segcard {
    border-radius: 10px;
    border: 1px solid rgba(55, 65, 81, 0.9);
    background: rgba(15, 23, 42, 0.9);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .cb-seghead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .cb-segtitle {
    font-size: 0.8rem;
    font-weight: 600;
  }

  .cb-segmeta {
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .cb-segbtnbar {
    display: flex;
    gap: 4px;
  }

  .cb-mini-btn {
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.8);
    background: transparent;
    color: #e5e7eb;
    font-size: 0.72rem;
    padding: 2px 8px;
    cursor: pointer;
  }

  .cb-mini-btn.danger {
    border-color: rgba(239, 68, 68, 0.9);
    color: #fecaca;
  }

  .cb-subsection {
    border-radius: 8px;
    border: 1px solid rgba(30, 64, 175, 0.65);
    background: rgba(15, 23, 42, 0.9);
    padding: 4px 6px;
    margin-top: 4px;
  }

  .cb-subsection h4 {
    margin: 0 0 2px 0;
    font-size: 0.78rem;
    color: #bfdbfe;
  }

  .cb-preview {
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
    .cb-row {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }
    .cb-row > label {
      min-width: 130px;
    }
    .cb-row input,
    .cb-row select {
      width: auto;
      min-width: 120px;
    }
    .cb-sub-two-cols {
      display: flex;
      flex-direction: row;
      gap: 6px;
    }
    .cb-sub-two-cols .cb-row {
      flex: 1 1 48%;
    }
  }

  /* Explain math popup */
  .cb-explain-overlay {
    position: fixed;
    inset: 0;
    background: rgba(3, 7, 18, 0.75);
    backdrop-filter: blur(6px);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 40px;
    z-index: 10170;
    overflow-y: auto;
  }
  .cb-explain-panel {
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
  .cb-explain-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }
  .cb-explain-title {
    font-size: 0.95rem;
    font-weight: 600;
  }
  .cb-explain-body {
    font-size: 0.83rem;
    line-height: 1.5;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .cb-explain-body code {
    font-size: 0.8rem;
    background: rgba(15, 23, 42, 0.9);
    border-radius: 4px;
    padding: 1px 4px;
  }
  .cb-explain-footer {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }
  `;
  document.head.appendChild(style);
}

function cbEl(tag, opts = {}, ...children) {
  const e = document.createElement(tag);
  if (opts.class) e.className = opts.class;
  if (opts.text) e.textContent = opts.text;
  if (opts.type) e.type = opts.type;
  if (opts.value != null) e.value = opts.value;
  if (opts.placeholder) e.placeholder = opts.placeholder;
  if (opts.for) e.htmlFor = opts.for;
  if (opts.id) e.id = opts.id;
  if (opts.title) e.title = opts.title;
  if (opts.onchange) e.addEventListener('change', opts.onchange);
  if (opts.onclick) e.addEventListener('click', opts.onclick);
  children.forEach(c => e.append(c));
  return e;
}

function cbNumberInput(value, onChange, extra = {}) {
  return cbEl('input', {
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

function cbSelect(options, current, onChange) {
  const s = cbEl('select', { onchange: e => onChange(e.target.value) });
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.id;
    o.textContent = opt.label;
    if (opt.id === current) o.selected = true;
    s.appendChild(o);
  });
  return s;
}

// --- Friction loss helpers (same C map as other tools) ---

const CB_C_BY_DIA = {
  '1.75': 15.5,
  '1.5': 24,
  '2.5': 2,
  '3':   0.8,
  '4':   0.2,
  '5':   0.08,
};

function cbGuessDiaFromHoseLabel(label) {
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

function cbGetHoseLabelById(hoses, id) {
  const h = hoses.find(x => x.id === id);
  return h ? h.label : '';
}

function cbCalcFL(C, gpm, lengthFt) {
  if (!C || !gpm || !lengthFt) return 0;
  const per100 = C * Math.pow(gpm / 100, 2);
  return per100 * (lengthFt / 100);
}

// --- Custom network math (approximate) ---
// state: { targetFlowGpm, remotePsi, totalElevationFt, segments: [...] }
function calcCustomNumbers(state, hoses) {
  const gpm     = Number(state.targetFlowGpm || 0);
  const remote  = Number(state.remotePsi || 0);
  const elevFt  = Number(state.totalElevationFt || 0);
  const segs    = state.segments || [];

  let totalFL = 0;

  segs.forEach(seg => {
    if (seg.type === 'hose') {
      const label = cbGetHoseLabelById(hoses, seg.hoseSizeId);
      const dia   = String(cbGuessDiaFromHoseLabel(label));
      const C     = CB_C_BY_DIA[dia] || 2;
      totalFL += cbCalcFL(C, gpm, seg.lengthFt || 0);
    }

    if (seg.type === 'wye') {
      // Engine → wye section carries full flow
      const engLabel = cbGetHoseLabelById(hoses, seg.engineHoseSizeId);
      const engDia   = String(cbGuessDiaFromHoseLabel(engLabel));
      const engC     = CB_C_BY_DIA[engDia] || 2;
      const engFL    = cbCalcFL(engC, gpm, seg.engineLengthFt || 0);

      const branchFlow = gpm > 0 ? gpm / 2 : 0;

      function branchFL(branch) {
        const label = cbGetHoseLabelById(hoses, branch.hoseSizeId);
        const dia   = String(cbGuessDiaFromHoseLabel(label));
        const C     = CB_C_BY_DIA[dia] || 2;
        return cbCalcFL(C, branchFlow, branch.lengthFt || 0);
      }

      const flA = branchFL(seg.branchA || {});
      const flB = branchFL(seg.branchB || {});
      const worstBranches = Math.max(flA, flB);

      totalFL += engFL + worstBranches;
    }

    if (seg.type === 'siamese') {
      const branchFlow = gpm > 0 ? gpm / 2 : 0;

      function lineFL(line) {
        const label = cbGetHoseLabelById(hoses, line.hoseSizeId);
        const dia   = String(cbGuessDiaFromHoseLabel(label));
        const C     = CB_C_BY_DIA[dia] || 2;
        return cbCalcFL(C, branchFlow, line.lengthFt || 0);
      }

      const fl1 = lineFL(seg.line1 || {});
      const fl2 = lineFL(seg.line2 || {});
      const worst = Math.max(fl1, fl2);
      totalFL += worst;
    }

    // Appliances currently assumed 0 psi loss in this preview – they are for structure only
  });

  const elevPsi = elevFt * 0.434;
  const PDP     = remote + totalFL + elevPsi;

  return {
    targetFlowGpm: Math.round(gpm),
    remotePsi: remote,
    totalFL: Math.round(totalFL),
    elevationFt: elevFt,
    elevationPsi: Math.round(elevPsi),
    PDP: Math.round(PDP),
    segmentsCount: segs.length,
  };
}

// --- Main popup entry point ---

export function openCustomBuilderPopup({
  dept = {},
  initial = null,
  onSave = () => {},
} = {}) {
  injectCustomStyles();

  const hoses      = dept.hoses      || [];
  const appliances = dept.appliances || [];

  const state = {
    targetFlowGpm: 400,
    remotePsi: 100,
    totalElevationFt: 0,
    segments: [],
  };

  if (initial && typeof initial === 'object') {
    Object.assign(state, initial);
    if (!Array.isArray(state.segments)) state.segments = [];
  }

  const overlay = document.createElement('div');
  overlay.className = 'cb-overlay';

  const panel = document.createElement('div');
  panel.className = 'cb-panel';

  const header = document.createElement('div');
  header.className = 'cb-header';

  const title = document.createElement('div');
  title.className = 'cb-title';
  title.textContent = 'Custom layout builder';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'cb-close';
  closeBtn.textContent = '✕';

  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'cb-body';

  const footer = document.createElement('div');
  footer.className = 'cb-footer';

  const explainBtn = document.createElement('button');
  explainBtn.type = 'button';
  explainBtn.className = 'cb-btn-secondary';
  explainBtn.textContent = 'Explain math';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cb-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'cb-btn-primary';
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
  previewBar.className = 'cb-preview';

  function updatePreview() {
    const vals = calcCustomNumbers(state, hoses);
    const line1 = `Flow: ${vals.targetFlowGpm} gpm  •  Remote: ${vals.remotePsi} psi`;
    const line2 = `Segments: ${vals.segmentsCount}  •  FL: ${vals.totalFL} psi  •  Elevation: ${vals.elevationPsi} psi  •  PDP: ${vals.PDP} psi`;
    previewBar.textContent = `${line1}   •   ${line2}`;
  }

  // --- Explain math popup ---

  function openExplainPopup() {
    const vals = calcCustomNumbers(state, hoses);

    const overlay2 = document.createElement('div');
    overlay2.className = 'cb-explain-overlay';

    const panel2 = document.createElement('div');
    panel2.className = 'cb-explain-panel';

    const header2 = document.createElement('div');
    header2.className = 'cb-explain-header';

    const title2 = document.createElement('div');
    title2.className = 'cb-explain-title';
    title2.textContent = 'Custom layout math breakdown';

    const close2 = document.createElement('button');
    close2.type = 'button';
    close2.className = 'cb-close';
    close2.textContent = '✕';

    header2.append(title2, close2);

    const body2 = document.createElement('div');
    body2.className = 'cb-explain-body';

    body2.innerHTML = `
      <p>This builder lets you describe almost any layout: single lines, wyes,
      siamese/dual feeds, and appliances in between.</p>

      <p><strong>Global inputs:</strong></p>
      <ul>
        <li>Target flow at the remote point: <code>${vals.targetFlowGpm} gpm</code></li>
        <li>Required pressure at the remote point: <code>${vals.remotePsi} psi</code></li>
        <li>Total elevation change engine → remote: <code>${vals.elevationFt || 0} ft</code></li>
        <li>Segments in the layout: <code>${vals.segmentsCount}</code></li>
      </ul>

      <p><strong>Friction loss model:</strong></p>
      <p>
        For each hose segment we use the standard equation<br>
        <code>FL = C × (GPM/100)² × (length/100)</code>, using the C for the hose size
        you selected.
      </p>

      <p><strong>Wyes:</strong></p>
      <p>
        We assume the engine→wye section carries the <em>full</em> target flow, and that
        each branch carries roughly half. We calculate:
      </p>
      <ul>
        <li>FL(engine→wye) at full flow</li>
        <li>FL(branch A) at half flow</li>
        <li>FL(branch B) at half flow</li>
      </ul>
      <p>
        and add <code>FL(engine→wye) + max(FL(A), FL(B))</code> to the total.
      </p>

      <p><strong>Siamese / dual feeds:</strong></p>
      <p>
        We assume each supply line carries half the target flow. We calculate the FL for
        each line at half flow and add the <em>worst</em> line's loss to the total.
      </p>

      <p><strong>Appliances:</strong></p>
      <p>
        Appliances in this builder are treated as structural only (0 psi loss in the
        preview). If you want to assign drops to specific appliances later, you can add a
        fixed psi to your remote point requirement.
      </p>

      <p><strong>Elevation and final PDP:</strong></p>
      <p>
        Elevation gain is estimated as <code>0.434 psi/ft</code>:<br>
        <code>Elevation psi ≈ ${vals.elevationFt || 0} ft × 0.434 ≈ ${vals.elevationPsi} psi</code>
      </p>
      <p>
        Then we estimate pump discharge pressure:<br>
        <code>
          PDP = Remote psi + Total FL + Elevation psi
          = ${vals.remotePsi} + ${vals.totalFL} + ${vals.elevationPsi}
          ≈ ${vals.PDP} psi
        </code>
      </p>

      <p>This is intentionally a simplified model so you can build almost any layout and
      still get a quick "ballpark" PDP and a saved structure for use in FireOps Calc.</p>
    `;

    const footer2 = document.createElement('div');
    footer2.className = 'cb-explain-footer';

    const ok2 = document.createElement('button');
    ok2.type = 'button';
    ok2.className = 'cb-btn-primary';
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

  // --- Segment UI helpers ---

  let segIdCounter = 1;

  function makeHoseSeg() {
    return {
      id: `seg-${segIdCounter++}`,
      type: 'hose',
      hoseSizeId: hoses[0]?.id || '',
      lengthFt: 200,
    };
  }

  function makeWyeSeg() {
    return {
      id: `seg-${segIdCounter++}`,
      type: 'wye',
      engineHoseSizeId: hoses[0]?.id || '',
      engineLengthFt: 100,
      branchA: { hoseSizeId: hoses[0]?.id || '', lengthFt: 100 },
      branchB: { hoseSizeId: hoses[0]?.id || '', lengthFt: 100 },
    };
  }

  function makeSiameseSeg() {
    return {
      id: `seg-${segIdCounter++}`,
      type: 'siamese',
      line1: { hoseSizeId: hoses[0]?.id || '', lengthFt: 200 },
      line2: { hoseSizeId: hoses[0]?.id || '', lengthFt: 200 },
    };
  }

  function makeApplianceSeg() {
    return {
      id: `seg-${segIdCounter++}`,
      type: 'appliance',
      applianceId: appliances[0]?.id || '',
      customLabel: '',
    };
  }

  function segTypeLabel(seg) {
    switch (seg.type) {
      case 'hose':    return 'Hose segment';
      case 'wye':     return 'Wye (split)';
      case 'siamese': return 'Siamese / dual feed';
      case 'appliance': return 'Appliance';
      default:        return 'Segment';
    }
  }

  function applianceLabelById(id) {
    const a = appliances.find(x => x.id === id);
    return a ? a.label : (id || '');
  }

  const segmentsSection = cbEl('div', { class: 'cb-section' },
    cbEl('h3', { text: 'Segments (engine → remote)' })
  );

  const addRow = cbEl('div', { class: 'cb-row' },
    cbEl('label', { text: 'Add segment:' }),
    cbEl('div', { class: 'cb-chiprow' },
      cbEl('button', {
        class: 'cb-chip',
        text: 'Hose',
        onclick: (e) => { e.preventDefault(); state.segments.push(makeHoseSeg()); renderSegments(); updatePreview(); }
      }),
      cbEl('button', {
        class: 'cb-chip',
        text: 'Wye',
        onclick: (e) => { e.preventDefault(); state.segments.push(makeWyeSeg()); renderSegments(); updatePreview(); }
      }),
      cbEl('button', {
        class: 'cb-chip',
        text: 'Siamese / dual feed',
        onclick: (e) => { e.preventDefault(); state.segments.push(makeSiameseSeg()); renderSegments(); updatePreview(); }
      }),
      cbEl('button', {
        class: 'cb-chip',
        text: 'Appliance',
        onclick: (e) => { e.preventDefault(); state.segments.push(makeApplianceSeg()); renderSegments(); updatePreview(); }
      })
    )
  );

  const segListEl = cbEl('div', { class: 'cb-seglist' });

  function renderSegments() {
    segListEl.innerHTML = '';

    if (!state.segments.length) {
      segListEl.append(
        cbEl('div', { class: 'cb-row' },
          cbEl('span', { text: 'No segments yet. Add hose, wyes, siamese feeds, or appliances above.' })
        )
      );
      return;
    }

    state.segments.forEach((seg, idx) => {
      const card = cbEl('div', { class: 'cb-segcard' });

      const head = cbEl('div', { class: 'cb-seghead' });

      const left = cbEl('div');
      left.append(
        cbEl('div', { class: 'cb-segtitle', text: `Segment ${idx + 1} – ${segTypeLabel(seg)}` }),
        cbEl('div', { class: 'cb-segmeta', text: seg.type === 'appliance'
          ? (seg.customLabel || applianceLabelById(seg.applianceId) || 'Unlabeled appliance')
          : ''
        })
      );

      const btnBar = cbEl('div', { class: 'cb-segbtnbar' });

      const upBtn = cbEl('button', {
        class: 'cb-mini-btn',
        text: '↑',
        title: 'Move up',
        onclick: (e) => {
          e.preventDefault();
          if (idx === 0) return;
          const tmp = state.segments[idx - 1];
          state.segments[idx - 1] = state.segments[idx];
          state.segments[idx] = tmp;
          renderSegments();
          updatePreview();
        }
      });

      const downBtn = cbEl('button', {
        class: 'cb-mini-btn',
        text: '↓',
        title: 'Move down',
        onclick: (e) => {
          e.preventDefault();
          if (idx === state.segments.length - 1) return;
          const tmp = state.segments[idx + 1];
          state.segments[idx + 1] = state.segments[idx];
          state.segments[idx] = tmp;
          renderSegments();
          updatePreview();
        }
      });

      const delBtn = cbEl('button', {
        class: 'cb-mini-btn danger',
        text: 'Delete',
        onclick: (e) => {
          e.preventDefault();
          state.segments.splice(idx, 1);
          renderSegments();
          updatePreview();
        }
      });

      btnBar.append(upBtn, downBtn, delBtn);
      head.append(left, btnBar);
      card.append(head);

      // Details per type
      if (seg.type === 'hose') {
        card.append(
          cbEl('div', { class: 'cb-subsection' },
            cbEl('h4', { text: 'Hose' }),
            cbEl('div', { class: 'cb-row' },
              cbEl('label', { text: 'Hose size:' }),
              cbSelect(hoses, seg.hoseSizeId, v => { seg.hoseSizeId = v; updatePreview(); }),
              cbEl('span', { text: 'Length:' }),
              cbNumberInput(seg.lengthFt, v => { seg.lengthFt = v === '' ? 0 : v; updatePreview(); }),
              cbEl('span', { text: 'ft' })
            )
          )
        );
      } else if (seg.type === 'wye') {
        const engineBlock = cbEl('div', { class: 'cb-subsection' },
          cbEl('h4', { text: 'Engine → wye' }),
          cbEl('div', { class: 'cb-row' },
            cbEl('label', { text: 'Hose size:' }),
            cbSelect(hoses, seg.engineHoseSizeId, v => { seg.engineHoseSizeId = v; updatePreview(); }),
            cbEl('span', { text: 'Length:' }),
            cbNumberInput(seg.engineLengthFt, v => { seg.engineLengthFt = v === '' ? 0 : v; updatePreview(); }),
            cbEl('span', { text: 'ft' })
          )
        );

        const branchABlock = cbEl('div', { class: 'cb-subsection' },
          cbEl('h4', { text: 'Branch A' }),
          cbEl('div', { class: 'cb-row' },
            cbEl('label', { text: 'Hose size:' }),
            cbSelect(hoses, seg.branchA.hoseSizeId, v => { seg.branchA.hoseSizeId = v; updatePreview(); }),
            cbEl('span', { text: 'Length:' }),
            cbNumberInput(seg.branchA.lengthFt, v => { seg.branchA.lengthFt = v === '' ? 0 : v; updatePreview(); }),
            cbEl('span', { text: 'ft' })
          )
        );

        const branchBBlock = cbEl('div', { class: 'cb-subsection' },
          cbEl('h4', { text: 'Branch B' }),
          cbEl('div', { class: 'cb-row' },
            cbEl('label', { text: 'Hose size:' }),
            cbSelect(hoses, seg.branchB.hoseSizeId, v => { seg.branchB.hoseSizeId = v; updatePreview(); }),
            cbEl('span', { text: 'Length:' }),
            cbNumberInput(seg.branchB.lengthFt, v => { seg.branchB.lengthFt = v === '' ? 0 : v; updatePreview(); }),
            cbEl('span', { text: 'ft' })
          )
        );

        const branchesWrapper = cbEl('div', { class: 'cb-sub-two-cols' }, branchABlock, branchBBlock);

        card.append(engineBlock, branchesWrapper);
      } else if (seg.type === 'siamese') {
        const line1Block = cbEl('div', { class: 'cb-subsection' },
          cbEl('h4', { text: 'Line 1' }),
          cbEl('div', { class: 'cb-row' },
            cbEl('label', { text: 'Hose size:' }),
            cbSelect(hoses, seg.line1.hoseSizeId, v => { seg.line1.hoseSizeId = v; updatePreview(); }),
            cbEl('span', { text: 'Length:' }),
            cbNumberInput(seg.line1.lengthFt, v => { seg.line1.lengthFt = v === '' ? 0 : v; updatePreview(); }),
            cbEl('span', { text: 'ft' })
          )
        );

        const line2Block = cbEl('div', { class: 'cb-subsection' },
          cbEl('h4', { text: 'Line 2' }),
          cbEl('div', { class: 'cb-row' },
            cbEl('label', { text: 'Hose size:' }),
            cbSelect(hoses, seg.line2.hoseSizeId, v => { seg.line2.hoseSizeId = v; updatePreview(); }),
            cbEl('span', { text: 'Length:' }),
            cbNumberInput(seg.line2.lengthFt, v => { seg.line2.lengthFt = v === '' ? 0 : v; updatePreview(); }),
            cbEl('span', { text: 'ft' })
          )
        );

        const linesWrapper = cbEl('div', { class: 'cb-sub-two-cols' }, line1Block, line2Block);
        card.append(linesWrapper);
      } else if (seg.type === 'appliance') {
        card.append(
          cbEl('div', { class: 'cb-subsection' },
            cbEl('h4', { text: 'Appliance' }),
            cbEl('div', { class: 'cb-row' },
              cbEl('label', { text: 'Department appliance:' }),
              cbSelect(
                [{ id: '', label: '— none / custom —' }, ...appliances],
                seg.applianceId || '',
                v => { seg.applianceId = v; updatePreview(); }
              )
            ),
            cbEl('div', { class: 'cb-row' },
              cbEl('label', { text: 'Custom label (optional):' }),
              cbEl('input', {
                type: 'text',
                value: seg.customLabel || '',
                placeholder: 'Example: RAM, ground monitor, gated wye',
                onchange: e => { seg.customLabel = e.target.value; renderSegments(); updatePreview(); }
              })
            )
          )
        );
      }

      segListEl.append(card);
    });
  }

  // --- Global controls ---

  const globalsSection = cbEl('div', { class: 'cb-section' },
    cbEl('h3', { text: 'Global target for this layout' }),
    cbEl('div', { class: 'cb-row' },
      cbEl('label', { text: 'Target flow:' }),
      cbNumberInput(state.targetFlowGpm, v => { state.targetFlowGpm = v === '' ? 0 : v; updatePreview(); }),
      cbEl('span', { text: 'gpm at remote point' })
    ),
    cbEl('div', { class: 'cb-row' },
      cbEl('label', { text: 'Required pressure at remote point:' }),
      cbNumberInput(state.remotePsi, v => { state.remotePsi = v === '' ? 0 : v; updatePreview(); }),
      cbEl('span', { text: 'psi (nozzle / appliance)' })
    ),
    cbEl('div', { class: 'cb-row' },
      cbEl('label', { text: 'Total elevation change:' }),
      cbNumberInput(state.totalElevationFt, v => { state.totalElevationFt = v === '' ? 0 : v; updatePreview(); }),
      cbEl('span', { text: 'ft (positive = engine below remote point)' })
    )
  );

  segmentsSection.append(addRow, segListEl);

  body.append(globalsSection, segmentsSection, previewBar);
  renderSegments();
  updatePreview();

  explainBtn.addEventListener('click', openExplainPopup);

  // Save handler – returns config + lastCalc
  saveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const lastCalc = calcCustomNumbers(state, hoses);
    const payload = {
      targetFlowGpm: state.targetFlowGpm,
      remotePsi: state.remotePsi,
      totalElevationFt: state.totalElevationFt,
      segments: state.segments.map(seg => JSON.parse(JSON.stringify(seg))),
      lastCalc,
    };
    onSave(payload);
    close();
  });
}
