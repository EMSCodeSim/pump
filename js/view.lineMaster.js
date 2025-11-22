// view.lineMaster.js
// Master stream / Blitz popup for a single line.
//
// - Deck gun vs Portable master
// - Feed by 1 or 2 lines
// - Each supply line: hose size + length + optional intake PSI
// - Appliance loss + elevation
// - Live GPM / PDP preview
// - "Explain math" popup
//
// Usage example (from preset editor or view.calc):
//   openMasterStreamPopup({
//     dept: { hoses, appliances },
//     initial: existingMasterConfigOrNull,
//     onSave(config) {
//       // store config.master for this preset or this line
//     }
//   });

let masterStylesInjected = false;

function injectMasterStyles() {
  if (masterStylesInjected) return;
  masterStylesInjected = true;

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
    padding-top: 40px;
    z-index: 10060;
    overflow-y: auto;
  }

  .ms-panel {
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
    .ms-panel {
      margin-top: 12px;
      border-radius: 20px;
      padding: 14px 16px 12px;
    }
  }

  .ms-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }

  .ms-title {
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .ms-close {
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
  .ms-close:hover {
    background: #111827;
  }

  .ms-body {
    font-size: 0.85rem;
    line-height: 1.45;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .ms-footer {
    display: flex;
    flex-direction: row;
    gap: 6px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }

  .ms-btn-primary,
  .ms-btn-secondary {
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

  .ms-btn-primary {
    background: linear-gradient(135deg, #38bdf8, #22c55e);
    color: #020617;
    font-weight: 600;
  }

  .ms-btn-secondary {
    background: rgba(15, 23, 42, 0.9);
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
    font-size: 0.82rem;
  }

  .ms-row span {
    font-size: 0.8rem;
  }

  .ms-panel input[type="text"],
  .ms-panel input[type="number"],
  .ms-panel select {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(55, 65, 81, 0.9);
    background: #020617;
    color: #e5e7eb;
    font-size: 0.8rem;
  }

  .ms-panel input::placeholder {
    color: rgba(148, 163, 184, 0.9);
  }

  .ms-section {
    border-top: 1px solid rgba(148, 163, 184, 0.4);
    padding-top: 8px;
    margin-top: 6px;
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

  .ms-subsection {
    border: 1px solid rgba(30, 64, 175, 0.5);
    background: rgba(15, 23, 42, 0.85);
    padding: 6px;
    border-radius: 10px;
    margin-top: 6px;
  }

  .ms-subsection h4 {
    margin: 0 0 4px 0;
    font-size: 0.8rem;
    color: #bfdbfe;
  }

  .ms-toggle-group {
    display: inline-flex;
    gap: 4px;
  }
  .ms-toggle-group button {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid rgba(75, 85, 99, 0.9);
    background: rgba(15, 23, 42, 0.9);
    font-size: 0.78rem;
    color: #e5e7eb;
    cursor: pointer;
  }
  .ms-toggle-on {
    background: #0ea5e9;
    border-color: #0ea5e9;
    color: #020617;
  }

  .ms-preview {
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
    .ms-row {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }
    .ms-row > label {
      min-width: 130px;
    }
    .ms-row input,
    .ms-row select {
      width: auto;
      min-width: 120px;
    }
    .ms-two-cols {
      display: flex;
      flex-direction: row;
      gap: 8px;
    }
    .ms-subsection {
      flex: 1 1 48%;
    }
  }

  /* Explain math popup */
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
  .ms-explain-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }
  .ms-explain-title {
    font-size: 0.95rem;
    font-weight: 600;
  }
  .ms-explain-body {
    font-size: 0.83rem;
    line-height: 1.5;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .ms-explain-body code {
    font-size: 0.8rem;
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

function msSelect(options, current, onChange) {
  const s = msEl('select', { onchange: e => onChange(e.target.value) });
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.id;
    o.textContent = opt.label;
    if (opt.id === current) o.selected = true;
    s.appendChild(o);
  });
  return s;
}

// --- Hose / FL helpers ---
// These are the same style as we used in the preset editor.

const MS_C_BY_DIA = {
  '1.75': 15.5,
  '1.5': 24,
  '2.5': 2,
  '3':   0.8,
  '4':   0.2,
  '5':   0.08,
};

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

// FL = C × (GPM/100)² × (length/100)
function msCalcFL(C, gpm, lengthFt) {
  if (!C || !gpm || !lengthFt) return 0;
  const per100 = C * Math.pow(gpm / 100, 2);
  return per100 * (lengthFt / 100);
}

// Main math for master stream
function calcMasterNumbers(state, hoses) {
  const m = state.master || {};
  const totalGpm = Number(m.desiredGpm || 800);
  const NP       = 80; // master stream NP assumption
  const lines    = m.feedLines === 2 ? 2 : 1;

  let feeds = [];
  if (lines === 1) {
    if (m.mountType === 'portable') {
      feeds = [m.blitzFeed];
    } else {
      feeds = [m.leftFeed];
    }
  } else {
    feeds = [m.leftFeed, m.rightFeed];
  }

  const gpmPerLine = totalGpm / lines;
  let worstFL = 0;

  feeds.forEach(feed => {
    if (!feed) return;
    const label = msGetHoseLabelById(hoses, feed.hoseSizeId);
    const dia   = String(msGuessDiaFromHoseLabel(label));
    const C     = MS_C_BY_DIA[dia] || 2;
    const len   = feed.lengthFt || 0;
    const fl    = msCalcFL(C, gpmPerLine, len);
    if (fl > worstFL) worstFL = fl;
  });

  const applianceLoss = m.applianceLossPsi || 25;
  const elevPsi       = (m.elevationFt || 0) * 0.434;
  const PDP           = NP + worstFL + applianceLoss + elevPsi;

  return {
    gpm: Math.round(totalGpm),
    NP,
    FL: Math.round(worstFL),
    applianceLoss: Math.round(applianceLoss),
    elevPsi: Math.round(elevPsi),
    PDP: Math.round(PDP),
    lines,
    mountType: m.mountType,
  };
}

/**
 * Master stream popup entry point
 *
 * @param {Object} opts
 *   - dept: { hoses: [{id,label}], appliances: [{id,label}] }
 *   - initial: optional existing master config
 *   - onSave: function(config) -> void
 */
export function openMasterStreamPopup({
  dept = {},
  initial = null,
  onSave = () => {},
} = {}) {
  injectMasterStyles();

  const hoses      = dept.hoses      || [];
  const appliances = dept.appliances || [];

  const state = {
    master: {
      mountType: 'deck',          // 'deck' | 'portable'
      feedLines: 1,               // 1 or 2
      applianceId: appliances[0]?.id || '',
      desiredGpm: 800,
      applianceLossPsi: 25,
      elevationFt: 0,
      leftFeed:  {
        hoseSizeId: hoses[0]?.id || '',
        lengthFt: 150,
        intakePsi: '',
      },
      rightFeed: {
        hoseSizeId: hoses[0]?.id || '',
        lengthFt: 150,
        intakePsi: '',
      },
      blitzFeed: {
        hoseSizeId: hoses[0]?.id || '',
        lengthFt: 150,
        intakePsi: '',
      },
    }
  };

  if (initial && typeof initial === 'object') {
    // shallow merge, with nested master merging
    if (initial.master) {
      Object.assign(state.master, initial.master);
    } else {
      Object.assign(state.master, initial);
    }
  }

  // --- Popup skeleton ---
  const overlay = document.createElement('div');
  overlay.className = 'ms-overlay';

  const panel = document.createElement('div');
  panel.className = 'ms-panel';

  const header = document.createElement('div');
  header.className = 'ms-header';

  const title = document.createElement('div');
  title.className = 'ms-title';
  title.textContent = 'Master stream setup';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'ms-close';
  closeBtn.textContent = '✕';

  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'ms-body';

  const footer = document.createElement('div');
  footer.className = 'ms-footer';

  const explainBtn = document.createElement('button');
  explainBtn.type = 'button';
  explainBtn.className = 'ms-btn-secondary';
  explainBtn.textContent = 'Explain math';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'ms-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'ms-btn-primary';
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
  const previewBar = msEl('div', { class: 'ms-preview' });

  function updatePreview() {
    const vals = calcMasterNumbers(state, hoses);
    previewBar.textContent =
      `Master stream – GPM: ${vals.gpm}   |   PDP: ${vals.PDP} psi`;
  }

  // --- Explain math popup ---
  function openExplainPopup() {
    const vals = calcMasterNumbers(state, hoses);
    const m = state.master;
    const mode = m.mountType === 'portable' ? 'Portable master / blitz' : 'Deck gun';
    const lines = vals.lines;

    const overlay2 = document.createElement('div');
    overlay2.className = 'ms-explain-overlay';

    const panel2 = document.createElement('div');
    panel2.className = 'ms-explain-panel';

    const header2 = document.createElement('div');
    header2.className = 'ms-explain-header';

    const title2 = document.createElement('div');
    title2.className = 'ms-explain-title';
    title2.textContent = 'Master stream math breakdown';

    const close2 = document.createElement('button');
    close2.type = 'button';
    close2.className = 'ms-close';
    close2.textContent = '✕';

    header2.append(title2, close2);

    const body2 = document.createElement('div');
    body2.className = 'ms-explain-body';

    const gpm = vals.gpm;
    const NP  = vals.NP;

    body2.innerHTML = `
      <p>We use a simple master stream formula:</p>
      <p><code>PDP = NP + FL + Appliance&nbsp;Loss + Elevation</code></p>

      <p><strong>Inputs:</strong></p>
      <ul>
        <li>Mode: <code>${mode}</code></li>
        <li>Target flow: <code>${gpm} gpm</code></li>
        <li>Number of supply lines: <code>${lines}</code></li>
        <li>Nozzle pressure (NP): <code>${NP} psi</code></li>
        <li>Appliance loss: <code>${m.applianceLossPsi || 25} psi</code></li>
        <li>Elevation: <code>${m.elevationFt || 0} ft</code></li>
      </ul>

      <p><strong>Step 1 – Split flow between lines:</strong><br>
        <code>GPM_per_line = total_GPM / lines = ${gpm} / ${lines}</code>
      </p>

      <p><strong>Step 2 – Friction loss in the worst supply line:</strong><br>
        We use <code>FL = C × (GPM_per_line/100)² × (length/100)</code> for each line,
        and take the highest value as the controlling line.<br>
        → FL ≈ <code>${vals.FL} psi</code>
      </p>

      <p><strong>Step 3 – Appliance loss:</strong><br>
        Deck gun piping or portable base, user-entered.<br>
        → Appliance loss ≈ <code>${vals.applianceLoss} psi</code>
      </p>

      <p><strong>Step 4 – Elevation:</strong><br>
        Approx <code>0.434 psi / ft</code> of vertical gain.<br>
        → Elevation ≈ <code>${vals.elevPsi} psi</code>
      </p>

      <p><strong>Final pump discharge pressure (PDP):</strong></p>
      <p>
        <code>
          PDP = ${NP} (NP) +
                ${vals.FL} (FL) +
                ${vals.applianceLoss} (appl) +
                ${vals.elevPsi} (elev)
          = ${vals.PDP} psi
        </code>
      </p>
    `;

    const footer2 = document.createElement('div');
    footer2.className = 'ms-explain-footer';

    const ok2 = document.createElement('button');
    ok2.type = 'button';
    ok2.className = 'ms-btn-primary';
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

  // --- UI building ---

  // Mount type toggle
  const mountToggle = (() => {
    const deckBtn = msEl('button', {
      text: 'Deck gun',
      onclick: (e) => {
        e.preventDefault();
        state.master.mountType = 'deck';
        refresh();
        renderFeeds();
        updatePreview();
      }
    });
    const portableBtn = msEl('button', {
      text: 'Portable',
      onclick: (e) => {
        e.preventDefault();
        state.master.mountType = 'portable';
        refresh();
        renderFeeds();
        updatePreview();
      }
    });
    function refresh() {
      deckBtn.classList.toggle('ms-toggle-on', state.master.mountType === 'deck');
      portableBtn.classList.toggle('ms-toggle-on', state.master.mountType === 'portable');
    }
    refresh();
    return { root: msEl('span', { class: 'ms-toggle-group' }, deckBtn, portableBtn), refresh };
  })();

  // Feed lines toggle
  const feedToggle = (() => {
    const oneBtn = msEl('button', {
      text: '1 line',
      onclick: (e) => {
        e.preventDefault();
        state.master.feedLines = 1;
        refresh();
        renderFeeds();
        updatePreview();
      }
    });
    const twoBtn = msEl('button', {
      text: '2 lines',
      onclick: (e) => {
        e.preventDefault();
        state.master.feedLines = 2;
        refresh();
        renderFeeds();
        updatePreview();
      }
    });
    function refresh() {
      oneBtn.classList.toggle('ms-toggle-on', state.master.feedLines !== 2);
      twoBtn.classList.toggle('ms-toggle-on', state.master.feedLines === 2);
    }
    refresh();
    return { root: msEl('span', { class: 'ms-toggle-group' }, oneBtn, twoBtn), refresh };
  })();

  const topSection = msEl('div', { class: 'ms-section' },
    msEl('h3', { text: 'Master stream type' }),
    msEl('div', { class: 'ms-row' },
      msEl('label', { text: 'Mount:' }),
      mountToggle.root
    ),
    msEl('div', { class: 'ms-row' },
      msEl('label', { text: 'Feed lines:' }),
      feedToggle.root
    ),
    msEl('div', { class: 'ms-row' },
      msEl('label', { text: 'Appliance:' }),
      msSelect(appliances, state.master.applianceId, v => { state.master.applianceId = v; updatePreview(); }),
      msEl('span', { text: 'Target GPM:' }),
      msNumberInput(state.master.desiredGpm, v => { state.master.desiredGpm = v; updatePreview(); }),
      msEl('span', { text: 'Appliance loss:' }),
      msNumberInput(state.master.applianceLossPsi, v => { state.master.applianceLossPsi = v; updatePreview(); }),
      msEl('span', { text: 'psi' })
    ),
    msEl('div', { class: 'ms-row' },
      msEl('label', { text: 'Elevation (rise):' }),
      msNumberInput(state.master.elevationFt, v => { state.master.elevationFt = v; updatePreview(); }),
      msEl('span', { text: 'ft (0 if same level)' })
    )
  );

  // Feeds section container
  const feedsSection = msEl('div', { class: 'ms-section' },
    msEl('h3', { text: 'Supply lines' })
  );
  const feedsContainer = msEl('div');
  feedsSection.appendChild(feedsContainer);

  function feedBlock(label, feedState) {
    return msEl('div', { class: 'ms-subsection' },
      msEl('h4', { text: label }),
      msEl('div', { class: 'ms-row' },
        msEl('label', { text: 'Hose size:' }),
        msSelect(hoses, feedState.hoseSizeId, v => { feedState.hoseSizeId = v; updatePreview(); }),
        msEl('span', { text: 'Length:' }),
        msNumberInput(feedState.lengthFt, v => { feedState.lengthFt = v === '' ? 0 : v; updatePreview(); }),
        msEl('span', { text: 'ft' })
      ),
      msEl('div', { class: 'ms-row' },
        msEl('label', { text: 'Intake PSI (optional):' }),
        msNumberInput(feedState.intakePsi, v => { feedState.intakePsi = v; updatePreview(); })
      )
    );
  }

  function renderFeeds() {
    feedsContainer.innerHTML = '';

    const lines = state.master.feedLines === 2 ? 2 : 1;

    if (lines === 1) {
      const feed = state.master.mountType === 'portable'
        ? state.master.blitzFeed
        : state.master.leftFeed;

      feedsContainer.append(
        msEl('div', { class: 'ms-row' },
          feedBlock('Supply line', feed)
        )
      );
    } else {
      feedsContainer.append(
        msEl('div', { class: 'ms-row ms-two-cols' },
          feedBlock('Left supply', state.master.leftFeed),
          feedBlock('Right supply', state.master.rightFeed)
        )
      );
    }
  }

  renderFeeds();

  body.append(topSection, feedsSection, previewBar);
  updatePreview();

  // Save handler – returns a compact config for this master stream setup
  saveBtn.addEventListener('click', () => {
    const payload = {
      mountType: state.master.mountType,
      feedLines: state.master.feedLines,
      applianceId: state.master.applianceId,
      desiredGpm: state.master.desiredGpm,
      applianceLossPsi: state.master.applianceLossPsi,
      elevationFt: state.master.elevationFt,
      leftFeed:  { ...state.master.leftFeed },
      rightFeed: { ...state.master.rightFeed },
      blitzFeed: { ...state.master.blitzFeed },
      lastCalc:  calcMasterNumbers(state, hoses),
    };
    onSave(payload);
    close();
  });
}
