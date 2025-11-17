// relayPumping.js
// Simple Relay Pumping calculator view for FireOps Calc
// Usage example:
//   import { mountRelayPumpingView } from './relayPumping.js';
//   mountRelayPumpingView(document.getElementById('app'));

export function mountRelayPumpingView(rootEl = document.getElementById('app')) {
  if (!rootEl) {
    console.warn('mountRelayPumpingView: no root element found');
    return { dispose() {} };
  }

  // Clear existing content
  rootEl.innerHTML = '';

  // ---- Helpers ----
  const HOSE_TYPES = [
    { id: '5', label: '5" LDH (C = 0.08)', c: 0.08 },
    { id: '4', label: '4" LDH (C = 0.20)', c: 0.20 },
    { id: '3', label: '3" hose (C = 0.80)', c: 0.80 },
    { id: 'custom', label: 'Custom C value', c: 0.10 },
  ];

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function parseNum(input, fallback = 0) {
    const v = Number(input);
    return Number.isFinite(v) ? v : fallback;
  }

  // ---- Layout container ----
  const wrapper = createEl('div', 'relay-wrap');
  rootEl.appendChild(wrapper);

  // Basic minimal styles (safe to override from your main CSS)
  const style = document.createElement('style');
  style.textContent = `
    .relay-wrap {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
      max-width: 900px;
      margin: 0 auto;
      box-sizing: border-box;
    }
    .relay-header {
      text-align: center;
    }
    .relay-header h2 {
      margin: 0 0 0.25rem;
      font-size: 1.4rem;
    }
    .relay-header p {
      margin: 0;
      font-size: 0.9rem;
      opacity: 0.8;
    }
    .relay-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }
    .relay-card {
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      border: 1px solid rgba(0,0,0,0.1);
      background: rgba(255,255,255,0.9);
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    }
    .relay-card h3 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
    }
    .relay-field {
      display: flex;
      flex-direction: column;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
    }
    .relay-field label {
      margin-bottom: 0.25rem;
    }
    .relay-field input,
    .relay-field select {
      padding: 0.3rem 0.4rem;
      font-size: 0.9rem;
      border-radius: 0.25rem;
      border: 1px solid rgba(0,0,0,0.2);
    }
    .relay-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }
    .relay-small {
      font-size: 0.8rem;
      opacity: 0.8;
    }
    .relay-btn-row {
      display: flex;
      justify-content: flex-start;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .relay-btn {
      padding: 0.4rem 0.8rem;
      font-size: 0.9rem;
      border-radius: 0.35rem;
      border: none;
      cursor: pointer;
    }
    .relay-btn-primary {
      background: #d62828;
      color: #fff;
    }
    .relay-btn-secondary {
      background: #eee;
    }
    .relay-summary {
      font-size: 0.9rem;
      line-height: 1.4;
    }
    .relay-summary b {
      font-weight: 600;
    }
    .relay-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      margin-top: 0.5rem;
    }
    .relay-table th,
    .relay-table td {
      border: 1px solid rgba(0,0,0,0.1);
      padding: 0.3rem 0.4rem;
      text-align: center;
    }
    .relay-table th {
      background: rgba(0,0,0,0.04);
    }
    .relay-warning {
      color: #b00020;
      font-size: 0.85rem;
      margin-top: 0.25rem;
    }
  `;
  rootEl.appendChild(style);

  // ---- Header ----
  const header = createEl('div', 'relay-header');
  header.appendChild(createEl('h2', null, 'Relay Pumping'));
  header.appendChild(
    createEl(
      'p',
      null,
      'Calculate relay engine spacing, PDP, and intake pressure targets for long supply lines.'
    )
  );
  wrapper.appendChild(header);

  // ---- Input cards ----
  const grid = createEl('div', 'relay-grid');
  wrapper.appendChild(grid);

  // Card 1: Flow and intake
  const cardFlow = createEl('div', 'relay-card');
  cardFlow.appendChild(createEl('h3', null, 'Attack Flow & Intake Target'));

  const fldGpm = createEl('div', 'relay-field');
  fldGpm.appendChild(createEl('label', null, 'Total required flow (GPM)'));
  const inpGpm = document.createElement('input');
  inpGpm.type = 'number';
  inpGpm.inputMode = 'numeric';
  inpGpm.placeholder = 'e.g. 1000';
  inpGpm.value = '1000';
  fldGpm.appendChild(inpGpm);
  cardFlow.appendChild(fldGpm);

  const fldIntake = createEl('div', 'relay-field');
  fldIntake.appendChild(createEl('label', null, 'Target intake pressure (psi)'));
  const inpIntake = document.createElement('input');
  inpIntake.type = 'number';
  inpIntake.inputMode = 'numeric';
  inpIntake.placeholder = '20–30';
  inpIntake.value = '25';
  fldIntake.appendChild(inpIntake);
  const intakeHint = createEl(
    'div',
    'relay-small',
    'Most departments aim for 20–30 psi to reduce cavitation risk.'
  );
  fldIntake.appendChild(intakeHint);
  cardFlow.appendChild(fldIntake);

  grid.appendChild(cardFlow);

  // Card 2: Hose and distance
  const cardHose = createEl('div', 'relay-card');
  cardHose.appendChild(createEl('h3', null, 'Hose & Total Distance'));

  const fldHose = createEl('div', 'relay-field');
  fldHose.appendChild(createEl('label', null, 'Supply hose'));
  const selHose = document.createElement('select');
  HOSE_TYPES.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h.id;
    opt.textContent = h.label;
    selHose.appendChild(opt);
  });
  selHose.value = '5';
  fldHose.appendChild(selHose);
  cardHose.appendChild(fldHose);

  const fldC = createEl('div', 'relay-field');
  fldC.appendChild(createEl('label', null, 'Custom C value'));
  const inpC = document.createElement('input');
  inpC.type = 'number';
  inpC.step = '0.01';
  inpC.placeholder = 'e.g. 0.08';
  inpC.value = '0.10';
  fldC.appendChild(inpC);
  const cHint = createEl(
    'div',
    'relay-small',
    'Only used when "Custom C" hose type is selected.'
  );
  fldC.appendChild(cHint);
  cardHose.appendChild(fldC);

  const fldDistance = createEl('div', 'relay-field');
  fldDistance.appendChild(createEl('label', null, 'Total supply lay length (ft)'));
  const inpDistance = document.createElement('input');
  inpDistance.type = 'number';
  inpDistance.inputMode = 'numeric';
  inpDistance.placeholder = 'e.g. 3000';
  inpDistance.value = '3000';
  fldDistance.appendChild(inpDistance);
  cardHose.appendChild(fldDistance);

  grid.appendChild(cardHose);

  // Card 3: Engines & options
  const cardEngines = createEl('div', 'relay-card');
  cardEngines.appendChild(createEl('h3', null, 'Relay Engines'));

  const fldEngines = createEl('div', 'relay-field');
  fldEngines.appendChild(
    createEl('label', null, 'Number of relay engines (leave blank to auto-calculate)')
  );
  const inpEngines = document.createElement('input');
  inpEngines.type = 'number';
  inpEngines.inputMode = 'numeric';
  inpEngines.placeholder = 'Auto';
  fldEngines.appendChild(inpEngines);
  cardEngines.appendChild(fldEngines);

  const fldMode = createEl('div', 'relay-field');
  fldMode.appendChild(
    createEl(
      'label',
      null,
      'Engine spacing mode'
    )
  );
  const selMode = document.createElement('select');
  selMode.innerHTML = `
    <option value="even">Even spacing along total lay</option>
    <option value="max">Use max distance allowed per engine</option>
  `;
  fldMode.appendChild(selMode);
  cardEngines.appendChild(fldMode);

  const btnRow = createEl('div', 'relay-btn-row');
  const btnCalc = createEl('button', 'relay-btn relay-btn-primary', 'Calculate relay setup');
  const btnClear = createEl('button', 'relay-btn relay-btn-secondary', 'Clear');
  btnRow.appendChild(btnCalc);
  btnRow.appendChild(btnClear);
  cardEngines.appendChild(btnRow);

  grid.appendChild(cardEngines);

  // ---- Results ----
  const resultsCard = createEl('div', 'relay-card');
  resultsCard.appendChild(createEl('h3', null, 'Results'));

  const summaryDiv = createEl('div', 'relay-summary');
  const warningDiv = createEl('div', 'relay-warning');
  const tableWrap = createEl('div', null);

  resultsCard.appendChild(summaryDiv);
  resultsCard.appendChild(warningDiv);
  resultsCard.appendChild(tableWrap);

  wrapper.appendChild(resultsCard);

  // ---- Core calculation logic ----
  function getCValue() {
    const id = selHose.value;
    const preset = HOSE_TYPES.find(h => h.id === id);
    if (id === 'custom') {
      const customC = parseNum(inpC.value, preset?.c ?? 0.1);
      return customC > 0 ? customC : (preset?.c ?? 0.1);
    }
    return preset ? preset.c : 0.08;
  }

  function doCalc() {
    summaryDiv.textContent = '';
    warningDiv.textContent = '';
    tableWrap.innerHTML = '';

    const gpm = parseNum(inpGpm.value, 0);
    const targetIntake = parseNum(inpIntake.value, 0);
    const totalDistFt = parseNum(inpDistance.value, 0);
    const c = getCValue();

    if (gpm <= 0 || totalDistFt <= 0 || targetIntake <= 0 || c <= 0) {
      warningDiv.textContent = 'Enter valid GPM, intake pressure, hose C value, and distance.';
      return;
    }

    // FL per 100' = C * (GPM/100)^2
    const flPer100 = c * Math.pow(gpm / 100, 2);

    // Max distance per engine before FL eats up intake target
    const maxDistPerEngineFt =
      flPer100 > 0 ? Math.floor((targetIntake / flPer100) * 100) : 0;

    if (!maxDistPerEngineFt || maxDistPerEngineFt <= 0) {
      warningDiv.textContent =
        'At this GPM and C value, the target intake is too low for a safe relay.';
      return;
    }

    let enginesRequested = parseNum(inpEngines.value, NaN);
    if (!Number.isFinite(enginesRequested) || enginesRequested <= 0) {
      enginesRequested = Math.max(1, Math.ceil(totalDistFt / maxDistPerEngineFt));
    } else {
      enginesRequested = Math.max(1, Math.round(enginesRequested));
    }

    const mode = selMode.value;

    // Determine spacing per engine span
    let segmentDistFt;
    if (mode === 'max') {
      segmentDistFt = Math.min(maxDistPerEngineFt, Math.ceil(totalDistFt / enginesRequested));
    } else {
      // even spacing
      segmentDistFt = totalDistFt / enginesRequested;
    }

    const engines = [];
    let cumulativeDist = 0;

    for (let i = 0; i < enginesRequested; i++) {
      let span = segmentDistFt;
      // Make sure we don't exceed total distance on last engine
      if (i === enginesRequested - 1) {
        span = totalDistFt - cumulativeDist;
      }

      const span100 = span / 100;
      const flSpan = flPer100 * span100; // psi
      const pdp = flSpan + targetIntake;

      engines.push({
        index: i + 1,
        distanceFt: span,
        distanceTotalFt: cumulativeDist + span,
        flSpan,
        pdp,
      });

      cumulativeDist += span;
    }

    // If our total span is still short due to rounding, adjust last engine
    if (cumulativeDist < totalDistFt && engines.length > 0) {
      const diff = totalDistFt - cumulativeDist;
      const last = engines[engines.length - 1];
      last.distanceFt += diff;
      last.distanceTotalFt += diff;
      const span100 = last.distanceFt / 100;
      last.flSpan = flPer100 * span100;
      last.pdp = last.flSpan + targetIntake;
    }

    const totalFL = flPer100 * (totalDistFt / 100);

    // ---- Summary text ----
    const hoseLabel = HOSE_TYPES.find(h => h.id === selHose.value)?.label || 'Hose';
    summaryDiv.innerHTML = `
      <div>
        Flow: <b>${gpm.toFixed(0)} gpm</b> using <b>${hoseLabel}</b><br>
        Target intake: <b>${targetIntake.toFixed(0)} psi</b><br>
        Total lay: <b>${totalDistFt.toFixed(0)} ft</b><br>
        Friction loss: <b>${totalFL.toFixed(1)} psi</b> across entire lay<br>
        Max distance per engine at this intake: <b>${maxDistPerEngineFt.toFixed(0)} ft</b><br>
        Suggested relay engines: <b>${enginesRequested}</b>
      </div>
    `;

    // ---- Warnings ----
    const worstPDP = engines.reduce((max, e) => Math.max(max, e.pdp), 0);
    const warnings = [];

    if (maxDistPerEngineFt < 500) {
      warnings.push(
        'Very short max distance per engine — consider lowering GPM, using larger hose, or accepting a higher intake target.'
      );
    }
    if (worstPDP > 250) {
      warnings.push(
        'Highest PDP exceeds 250 psi — check hose ratings, consider more engines or lower flow.'
      );
    }
    if (enginesRequested === 1 && totalDistFt > maxDistPerEngineFt) {
      warnings.push(
        'One engine may not safely handle this lay length at the desired intake. Add another relay engine.'
      );
    }

    warningDiv.textContent = warnings.join(' ');

    // ---- Engine table ----
    const table = document.createElement('table');
    table.className = 'relay-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Engine</th>
        <th>Span length (ft)</th>
        <th>Cumulative distance (ft)</th>
        <th>FL for span (psi)</th>
        <th>Suggested PDP (psi)</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    engines.forEach(e => {
      const tr = document.createElement('tr');
      const pdpRounded = Math.round(e.pdp);
      tr.innerHTML = `
        <td>E${e.index}</td>
        <td>${e.distanceFt.toFixed(0)}</td>
        <td>${e.distanceTotalFt.toFixed(0)}</td>
        <td>${e.flSpan.toFixed(1)}</td>
        <td>${pdpRounded}</td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    tableWrap.appendChild(table);
  }

  function doClear() {
    inpGpm.value = '1000';
    inpIntake.value = '25';
    selHose.value = '5';
    inpC.value = '0.10';
    inpDistance.value = '3000';
    inpEngines.value = '';
    selMode.value = 'even';
    summaryDiv.textContent = '';
    warningDiv.textContent = '';
    tableWrap.innerHTML = '';
  }

  btnCalc.addEventListener('click', doCalc);
  btnClear.addEventListener('click', doClear);

  // Initial pass (optional)
  doCalc();

  // Return disposable for your router
  return {
    dispose() {
      btnCalc.removeEventListener('click', doCalc);
      btnClear.removeEventListener('click', doClear);
      if (rootEl.contains(wrapper)) rootEl.removeChild(wrapper);
      if (rootEl.contains(style)) rootEl.removeChild(style);
    },
  };
}
