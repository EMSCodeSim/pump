// view.lineSprinkler.js
// Simple Sprinkler / FDC preset popup
//
// This version intentionally keeps things very simple:
// - We assume a typical rule-of-thumb PDP of 150 psi for sprinklers.
// - User can change that PDP to any value they want.
// - Flow (GPM) is intentionally UNKNOWN and not calculated here.
//
// Usage example:
//   openSprinklerPopup({
//     initial: { targetPdp: 150, note: 'Default sprinkler FDC' },
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
    max-width: 420px;
    width: 100%;
    margin: 0 12px 24px;
    background: #020617;
    border-radius: 18px;
    box-shadow:
      0 18px 30px rgba(15, 23, 42, 0.85),
      0 0 0 1px rgba(148, 163, 184, 0.45);
    padding: 14px 16px 12px;
    color: #e5e7eb;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
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
    max-height: min(60vh, 360px);
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

  .spr-panel input[type="number"],
  .spr-panel input[type="text"] {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(55, 65, 81, 0.9);
    background: #020617;
    color: #e5e7eb;
    font-size: 0.82rem;
  }

  .spr-panel input::placeholder {
    color: rgba(148, 163, 184, 0.9);
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

  /* Explain popup */
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
    max-width: 420px;
    width: 100%;
    margin: 0 12px 24px;
    background: #020617;
    border-radius: 18px;
    box-shadow:
      0 18px 30px rgba(15, 23, 42, 0.85),
      0 0 0 1px rgba(148, 163, 184, 0.45);
    padding: 14px 16px 12px;
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
    max-height: min(60vh, 360px);
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

/**
 * Simpler sprinkler popup:
 * - targetPdp: number (default 150)
 * - note: optional string
 */
export function openSprinklerPopup({
  initial = null,
  onSave = () => {},
} = {}) {
  injectSprinklerStyles();

  const state = {
    targetPdp: 150,
    note: '',
  };

  if (initial && typeof initial === 'object') {
    if (initial.targetPdp != null) state.targetPdp = Number(initial.targetPdp) || 150;
    if (typeof initial.note === 'string') state.note = initial.note;
  }

  const overlay = document.createElement('div');
  overlay.className = 'spr-overlay';

  const panel = document.createElement('div');
  panel.className = 'spr-panel';

  const header = document.createElement('div');
  header.className = 'spr-header';

  const title = document.createElement('div');
  title.className = 'spr-title';
  title.textContent = 'Sprinkler / FDC preset';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'spr-close';
  closeBtn.textContent = '✕';

  header.append(title, closeBtn);

  const body = document.createElement('div');
  body.className = 'spr-body';

  const footer = document.createElement('div');
  footer.className = 'spr-footer';

  const explainBtn = document.createElement('button');
  explainBtn.type = 'button';
  explainBtn.className = 'spr-btn-secondary';
  explainBtn.textContent = 'Explain';
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
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);

  const preview = document.createElement('div');
  preview.className = 'spr-preview';

  function updatePreview() {
    preview.textContent = `Sprinkler FDC – Target PDP: ${state.targetPdp} psi (flow: unknown)`;
  }

  const pdpRow = sprEl('div', { class: 'spr-row' },
    sprEl('label', { text: 'Pump discharge pressure (PDP):' }),
    sprNumberInput(state.targetPdp, v => {
      state.targetPdp = v === '' ? 0 : v;
      updatePreview();
    }),
    sprEl('span', { text: 'psi (150 psi is a common sprinkler rule-of-thumb)' })
  );

  const noteRow = sprEl('div', { class: 'spr-row' },
    sprEl('label', { text: 'Note (optional):' }),
    sprEl('input', {
      type: 'text',
      value: state.note,
      placeholder: 'Example: Light hazard – 2 FDCs on A/B corners',
      onchange: (e) => { state.note = e.target.value || ''; }
    })
  );

  body.append(
    sprEl('p', { text: 'This tool treats sprinklers very simply: you choose a target PDP to pump to the FDC. The actual system flow (GPM) is not calculated here.' }),
    pdpRow,
    noteRow,
    preview
  );

  updatePreview();

  function openExplainPopup() {
    const overlay2 = document.createElement('div');
    overlay2.className = 'spr-explain-overlay';

    const panel2 = document.createElement('div');
    panel2.className = 'spr-explain-panel';

    const header2 = document.createElement('div');
    header2.className = 'spr-explain-header';

    const title2 = document.createElement('div');
    title2.className = 'spr-explain-title';
    title2.textContent = 'Simple sprinkler preset';

    const close2 = document.createElement('button');
    close2.type = 'button';
    close2.className = 'spr-close';
    close2.textContent = '✕';

    header2.append(title2, close2);

    const body2 = document.createElement('div');
    body2.className = 'spr-explain-body';
    body2.innerHTML = `
      <p>This sprinkler/FDC preset is intentionally simple.</p>
      <p>Many departments use a rule-of-thumb like <strong>150 psi to the FDC</strong>
      for most sprinkler connections, unless the system documentation or preplan
      says otherwise.</p>
      <p>In this tool you:</p>
      <ul>
        <li>Start at <code>150 psi</code> as the default pump discharge pressure.</li>
        <li>Optionally change that number if your preplan or SOP calls for a
            different pressure (for example, 175 psi or 200 psi).</li>
        <li>Save a short note describing the system or scenario.</li>
      </ul>
      <p>No internal flow (GPM) math is done here. This preset is simply a
      quick reminder of what <strong>PDP</strong> to use when supplying the
      sprinkler system through the FDC.</p>
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

  saveBtn.addEventListener('click', () => {
    const payload = {
      targetPdp: state.targetPdp || 0,
      note: state.note || '',
    };
    onSave(payload);
    close();
  });
}
