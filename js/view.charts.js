// js/view.charts.js
// Reference charts overlay: friction loss tables with Standard vs Low-Friction hose toggle

// Simple friction loss function
function calcFL(c, gpm) {
  const x = gpm / 100;
  const fl = c * x * x;
  // round to 1 decimal
  return Math.round(fl * 10) / 10;
}

// Hose + flow presets for the charts
const HOSE_PRESETS = {
  '1.75': {
    label: '1 3/4" Attack Line',
    gpms: [95, 125, 150, 175, 200, 225]
  },
  '2.5': {
    label: '2 1/2" Attack / Supply',
    gpms: [150, 180, 200, 230, 250, 300]
  },
  '3': {
    label: '3" Supply',
    gpms: [250, 300, 350, 400, 450, 500]
  },
  '5': {
    label: '5" LDH Supply',
    gpms: [500, 750, 1000, 1250, 1500, 1750]
  }
};

// C values: tweak as needed to match your department’s standards
const C_STANDARD = {
  '1.75': 15,   // typical standard attack hose
  '2.5': 2,
  '3': 0.8,
  '5': 0.08
};

const C_LOW = {
  '1.75': 13,   // lower friction "combat ready" style hose
  '2.5': 1.5,
  '3': 0.7,
  '5': 0.05
};

function buildFrictionCards(mode) {
  const cards = [];

  const C_TABLE = mode === 'low' ? C_LOW : C_STANDARD;
  const modeLabel = mode === 'low' ? 'Low-Friction Hose (C↓)' : 'Standard Hose';

  for (const key of Object.keys(HOSE_PRESETS)) {
    const cfg = HOSE_PRESETS[key];
    const c = C_TABLE[key];
    if (c == null) continue;

    let rows = '';
    for (const gpm of cfg.gpms) {
      const fl = calcFL(c, gpm);
      rows += `
        <tr>
          <td>${gpm}</td>
          <td>${fl}</td>
        </tr>
      `;
    }

    cards.push(`
      <section class="card charts-card">
        <header class="card-header">
          <div class="card-title">${cfg.label}</div>
          <div class="card-subtitle">C = ${c}</div>
        </header>
        <div class="card-body">
          <table class="charts-table">
            <thead>
              <tr>
                <th>GPM</th>
                <th>FL per 100'</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </section>
    `);
  }

  return `
    <div class="charts-section">
      <h4>${modeLabel} – Friction Loss per 100'</h4>
      <p class="charts-note">
        FL = C × (GPM ÷ 100)² &nbsp; · &nbsp;
        Values are approximate and rounded to 0.1 PSI.
      </p>
      ${cards.join('')}
    </div>
  `;
}

export async function render(container) {
  container.innerHTML = `
    <div class="charts-root">
      <div class="charts-toolbar">
        <button type="button" class="charts-modebtn active" data-mode="standard">
          Standard hose
        </button>
        <button type="button" class="charts-modebtn" data-mode="low">
          Low-friction hose
        </button>
      </div>

      <div id="chartsContent"></div>

      <p class="charts-footnote">
        C values are configurable – adjust in <code>view.charts.js</code> to match your department’s hose.
      </p>
    </div>
  `;

  const contentEl = container.querySelector('#chartsContent');
  const modeButtons = Array.from(
    container.querySelectorAll('.charts-modebtn')
  );

  function setMode(mode) {
    // Update active button styling
    modeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Rebuild friction loss cards
    contentEl.innerHTML = buildFrictionCards(mode);
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode || 'standard';
      setMode(mode);
    });
  });

  // Initial view
  setMode('standard');

  // Optional cleanup hook
  return {
    dispose() {
      // No global listeners to clean up; wiping container is enough
      container.innerHTML = '';
    }
  };
}
