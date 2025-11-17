// /js/view.relay.js
// Self-contained Relay Pumping calculator module for FireOps Calc

export async function render(container) {
  container.innerHTML = `
    <section class="stack card" style="padding:16px">
      <h2 style="margin:0 0 6px">Relay Pumping</h2>
      <div class="mini" style="margin-bottom:14px;opacity:.8">
        Calculate intake pressure, spacing, and PDP for relay engines.
      </div>

      <div class="field">
        <label>Required Flow (GPM)</label>
        <input id="rpFlow" type="number" inputmode="numeric" placeholder="1000" value="1000">
      </div>

      <div class="field">
        <label>Target Intake Pressure (psi)</label>
        <input id="rpIntake" type="number" inputmode="numeric" placeholder="20–30" value="25">
      </div>

      <div class="field">
        <label>Supply Hose Type</label>
        <select id="rpHose">
          <option value="0.08">5″ LDH (C = 0.08)</option>
          <option value="0.20">4″ LDH (C = 0.20)</option>
          <option value="0.80">3″ (C = 0.80)</option>
          <option value="custom">Custom C Value</option>
        </select>
      </div>

      <div class="field" id="rpCustomWrap" style="display:none">
        <label>Custom C Value</label>
        <input id="rpC" type="number" step="0.01" placeholder="0.10" value="0.10">
      </div>

      <div class="field">
        <label>Total Lay Length (ft)</label>
        <input id="rpDist" type="number" inputmode="numeric" placeholder="3000" value="3000">
      </div>

      <div class="field">
        <label>Number of Relay Engines (optional)</label>
        <input id="rpEngines" type="number" placeholder="Auto">
      </div>

      <div class="field">
        <label>Spacing Mode</label>
        <select id="rpMode">
          <option value="even">Even spacing</option>
          <option value="max">Use maximum safe distance</option>
        </select>
      </div>

      <div style="margin-top:12px; display:flex; gap:8px;">
        <button id="rpCalc" class="btn primary">Calculate</button>
        <button id="rpClear" class="btn">Clear</button>
      </div>

      <section id="rpResults" style="margin-top:18px"></section>
    </section>
  `;

  // DOM refs
  const flow = container.querySelector('#rpFlow');
  const intake = container.querySelector('#rpIntake');
  const hose = container.querySelector('#rpHose');
  const cField = container.querySelector('#rpC');
  const customWrap = container.querySelector('#rpCustomWrap');
  const dist = container.querySelector('#rpDist');
  const engines = container.querySelector('#rpEngines');
  const mode = container.querySelector('#rpMode');
  const results = container.querySelector('#rpResults');

  hose.addEventListener('change', () => {
    customWrap.style.display = hose.value === 'custom' ? '' : 'none';
  });

  const calcBtn = container.querySelector('#rpCalc');
  const clearBtn = container.querySelector('#rpClear');

  clearBtn.addEventListener('click', () => {
    flow.value = '1000';
    intake.value = '25';
    hose.value = '0.08';
    cField.value = '0.10';
    dist.value = '3000';
    engines.value = '';
    mode.value = 'even';
    customWrap.style.display = 'none';
    results.innerHTML = '';
  });

  calcBtn.addEventListener('click', () => {
    const gpm = +flow.value || 0;
    const tip = +intake.value || 0;
    const totalFt = +dist.value || 0;
    let c = hose.value === 'custom' ? (+cField.value || 0.1) : +hose.value;

    if (gpm <= 0 || tip <= 0 || totalFt <= 0 || c <= 0) {
      results.innerHTML = `<div class="mini" style="color:#ff6b6b">Enter valid numbers.</div>`;
      return;
    }

    const flPer100 = c * Math.pow(gpm / 100, 2);
    const maxFt = Math.floor((tip / flPer100) * 100);
    let n = +engines.value || Math.ceil(totalFt / maxFt);

    const span = mode.value === 'even' ? totalFt / n : Math.min(maxFt, totalFt / n);

    let html = `
      <div class="kpi"><div>Total Flow</div><b>${gpm} gpm</b></div>
      <div class="kpi"><div>Target Intake</div><b>${tip} psi</b></div>
      <div class="kpi"><div>Max per Engine</div><b>${maxFt} ft</b></div>
      <div class="kpi"><div>Relay Engines</div><b>${n}</b></div>
      <hr style="margin:14px 0; opacity:.4">
      <table style="width:100%; font-size:14px; border-collapse:collapse">
        <thead>
          <tr style="background:#0b1420; color:#eaf2ff">
            <th>Engine</th>
            <th>Span (ft)</th>
            <th>FL (psi)</th>
            <th>PDP (psi)</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (let i = 1; i <= n; i++) {
      const segFt = i === n ? totalFt - span * (n - 1) : span;
      const fl = flPer100 * (segFt / 100);
      const pdp = fl + tip;

      html += `
        <tr style="text-align:center;">
          <td>E${i}</td>
          <td>${segFt.toFixed(0)}</td>
          <td>${fl.toFixed(1)}</td>
          <td>${Math.round(pdp)}</td>
        </tr>`;
    }

    html += `</tbody></table>`;

    results.innerHTML = html;
  });
}
