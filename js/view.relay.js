// /js/view.relay.js
// Relay Pumping calculator module for FireOps Calc
// - Required Flow can be initialized from main calc #GPM (if present)
// - Default intake is 30 psi
// - "Explain Math" button shows step-by-step calculations

export async function render(container) {
  container.innerHTML = `
    <section class="stack card" style="padding:16px">
      <h2 style="margin:0 0 6px">Relay Pumping</h2>
      <div class="mini" style="margin-bottom:14px;opacity:.8">
        Calculate relay engine spacing, PDP, and intake targets for long lays.
      </div>

      <div class="field">
        <label>Required Flow (GPM)</label>
        <input id="rpFlow" type="number" inputmode="numeric" placeholder="1000" value="1000">
      </div>

      <div class="field">
        <label>Target Intake Pressure (psi)</label>
        <input id="rpIntake" type="number" inputmode="numeric" placeholder="20–50" value="30">
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

      <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
        <button id="rpCalc" class="btn primary">Calculate</button>
        <button id="rpClear" class="btn">Clear</button>
        <button id="rpExplain" class="btn">Explain Math</button>
      </div>

      <section id="rpResults" style="margin-top:18px"></section>
      <section id="rpExplainBox" style="margin-top:12px"></section>
    </section>
  `;

  // DOM refs
  const flow       = container.querySelector('#rpFlow');
  const intake     = container.querySelector('#rpIntake');
  const hose       = container.querySelector('#rpHose');
  const cField     = container.querySelector('#rpC');
  const customWrap = container.querySelector('#rpCustomWrap');
  const dist       = container.querySelector('#rpDist');
  const engines    = container.querySelector('#rpEngines');
  const mode       = container.querySelector('#rpMode');
  const results    = container.querySelector('#rpResults');
  const explainBox = container.querySelector('#rpExplainBox');

  const calcBtn    = container.querySelector('#rpCalc');
  const clearBtn   = container.querySelector('#rpClear');
  const explainBtn = container.querySelector('#rpExplain');

  // 🔹 Try to initialize Required Flow from main calc total GPM (#GPM) if present
  try {
    const mainGpmEl = document.querySelector('#GPM');
    if (mainGpmEl) {
      const txt = (mainGpmEl.textContent || '').replace(/[^0-9.]/g, '');
      const val = parseFloat(txt);
      if (val > 0) {
        flow.value = String(Math.round(val));
      }
    }
  } catch (_e) {}

  hose.addEventListener('change', () => {
    customWrap.style.display = hose.value === 'custom' ? '' : 'none';
  });

  let lastCalc = null; // store details for Explain Math

  clearBtn.addEventListener('click', () => {
    flow.value   = '1000';
    intake.value = '30';
    hose.value   = '0.08';
    cField.value = '0.10';
    dist.value   = '3000';
    engines.value = '';
    mode.value    = 'even';
    customWrap.style.display = 'none';
    results.innerHTML = '';
    explainBox.innerHTML = '';
    lastCalc = null;
  });

  calcBtn.addEventListener('click', () => {
    results.innerHTML = '';
    explainBox.innerHTML = '';

    const gpm      = +flow.value || 0;
    const tip      = +intake.value || 0;
    const totalFt  = +dist.value || 0;
    let   c        = hose.value === 'custom' ? (+cField.value || 0.1) : +hose.value;
    const modeVal  = mode.value;

    if (gpm <= 0 || tip <= 0 || totalFt <= 0 || c <= 0) {
      results.innerHTML = `<div class="mini" style="color:#ff6b6b">Enter valid GPM, intake, hose C, and distance.</div>`;
      lastCalc = null;
      return;
    }

    const flPer100 = c * Math.pow(gpm / 100, 2);     // psi per 100'
    const maxFt    = Math.floor((tip / flPer100) * 100); // max distance per engine

    if (!Number.isFinite(maxFt) || maxFt <= 0) {
      results.innerHTML = `<div class="mini" style="color:#ff6b6b">
        At this GPM, C value, and intake, you cannot safely move water — friction loss is too high.
      </div>`;
      lastCalc = null;
      return;
    }

    let n = +engines.value || Math.ceil(totalFt / maxFt);
    if (n < 1) n = 1;

    const spanBase = modeVal === 'even'
      ? totalFt / n
      : Math.min(maxFt, totalFt / n);

    const enginesArr = [];
    let remaining = totalFt;

    for (let i = 0; i < n; i++) {
      const isLast = i === n - 1;
      const spanFt = isLast ? remaining : spanBase;
      remaining -= spanFt;

      const flSpan = flPer100 * (spanFt / 100);
      const pdp    = flSpan + tip;

      enginesArr.push({
        index: i + 1,
        distanceFt: spanFt,
        flSpan,
        pdp,
      });
    }

    const totalFL = flPer100 * (totalFt / 100);

    // Store details for Explain Math
    lastCalc = {
      gpm,
      tip,
      totalFt,
      c,
      flPer100,
      maxFt,
      n,
      mode: modeVal,
      engines: enginesArr,
      totalFL,
    };

    // ==== Results UI ====
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

    enginesArr.forEach(e => {
      html += `
        <tr style="text-align:center;">
          <td>E${e.index}</td>
          <td>${e.distanceFt.toFixed(0)}</td>
          <td>${e.flSpan.toFixed(1)}</td>
          <td>${Math.round(e.pdp)}</td>
        </tr>`;
    });

    html += `</tbody></table>`;

    results.innerHTML = html;
  });

  explainBtn.addEventListener('click', () => {
    explainBox.innerHTML = '';

    if (!lastCalc) {
      explainBox.innerHTML = `
        <div class="mini" style="color:#fbbf24">
          Run a relay calculation first, then tap "Explain Math."
        </div>`;
      return;
    }

    const {
      gpm,
      tip,
      totalFt,
      c,
      flPer100,
      maxFt,
      n,
      mode: modeVal,
      engines: enginesArr,
      totalFL,
    } = lastCalc;

    const modeLabel = modeVal === 'even' ? 'Even spacing' : 'Max distance per engine';

    explainBox.innerHTML = `
      <div class="mini" style="margin-bottom:6px; color:#a5b4fc;">
        How these relay numbers were calculated:
      </div>
      <div style="font-size:13px; line-height:1.5; color:#e5e7eb;">
        <b>1. Friction loss per 100 ft</b><br>
        Formula: FL/100′ = C × (GPM ÷ 100)²<br>
        = ${c.toFixed(2)} × (${gpm.toFixed(0)} ÷ 100)²
        = ${c.toFixed(2)} × ${(gpm/100).toFixed(2)}²
        ≈ <b>${flPer100.toFixed(2)} psi / 100′</b>
      </div>
      <div style="font-size:13px; line-height:1.5; margin-top:8px; color:#e5e7eb;">
        <b>2. Maximum distance per engine at ${tip.toFixed(0)} psi intake</b><br>
        We allow each engine to lose up to the intake pressure in friction loss:<br>
        Max distance = (Intake ÷ (FL/100′)) × 100′<br>
        = (${tip.toFixed(0)} ÷ ${flPer100.toFixed(2)}) × 100′
        ≈ <b>${maxFt.toFixed(0)} ft per engine</b>
      </div>
      <div style="font-size:13px; line-height:1.5; margin-top:8px; color:#e5e7eb;">
        <b>3. Number of engines needed</b><br>
        Total lay = ${totalFt.toFixed(0)} ft<br>
        Engines ≈ Total lay ÷ Max distance per engine<br>
        = ${totalFt.toFixed(0)} ÷ ${maxFt.toFixed(0)}
        ≈ ${ (totalFt / maxFt).toFixed(2) } → <b>${n} engines</b> (rounded up)
      </div>
      <div style="font-size:13px; line-height:1.5; margin-top:8px; color:#e5e7eb;">
        <b>4. Spacing mode:</b> ${modeLabel}<br>
        Total friction loss across the entire lay is:<br>
        Total FL = (Total lay ÷ 100′) × FL/100′<br>
        = (${(totalFt/100).toFixed(2)} × ${flPer100.toFixed(2)})
        ≈ <b>${totalFL.toFixed(1)} psi</b>
      </div>
      <div style="font-size:13px; line-height:1.5; margin-top:8px; color:#e5e7eb;">
        <b>5. PDP for each relay engine</b><br>
        For each engine, PDP = Intake + FL for that span.<br>
        Example engine spans:
        <ul style="margin:4px 0 0 18px; padding:0; list-style:disc;">
          ${enginesArr.map(e => `
            <li>E${e.index}: span ${e.distanceFt.toFixed(0)} ft,
              FL ≈ ${e.flSpan.toFixed(1)} psi,
              PDP ≈ ${Math.round(e.pdp)} psi
            </li>`).join('')}
        </ul>
      </div>
    `;
  });
}
