// view.lineStandard.js
// Standard attack line popup (with optional wye).
//
// - Mode: single line OR line with wye
// - Single line: hose size, length, nozzle, nozzle pressure, elevation
// - Wye: engine→wye segment + Branch A + Branch B
// - Live preview: total GPM + PDP
// - Explain math popup
//
// Usage:
//   openStandardLinePopup({
//     dept: { hoses, nozzles },
//     initial: existingStandardConfig,
//     onSave(config) { ... }
//   });

let slStylesInjected = false;

function injectStandardLineStyles() {
  if (slStylesInjected) return;
  slStylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
  .sl-overlay {
    position: fixed;
    inset: 0;
    background: rgba(3, 7, 18, 0.55);
    backdrop-filter: blur(6px);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 40px;
    z-index: 10120;
    overflow-y: auto;
  }

  .sl-panel {
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
    .sl-panel {
      margin-top: 12px;
      border-radius: 20px;
      padding: 14px 16px 12px;
    }
  }

  .sl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  }

  .sl-title {
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .sl-close {
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
  .sl-close:hover {
    background: #111827;
  }

  .sl-body {
    font-size: 0.85rem;
    line-height: 1.45;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .sl-footer {
    display: flex;
    flex-direction: row;
    gap: 6px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }

  .sl-btn-primary,
  .sl-btn-secondary {
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

  .sl-btn-primary {
    background: linear-gradient(135deg, #38bdf8, #22c55e);
    color: #020617;
    font-weight: 600;
  }

  .sl-btn-secondary {
    background: rgba(15, 23, 42, 0.9);
    color: #e5e7eb;
    border: 1px solid rgba(148, 163, 184, 0.7);
  }

  .sl-btn-primary:active,
  .sl-btn-secondary:active {
    transform: translateY(1px);
  }

  .sl-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }

  .sl-row label {
    font-weight: 500;
    font-size: 0.82rem;
  }

  .sl-row span {
    font-size: 0.8rem;
  }

  .sl-panel input[type="text"],
  .sl-panel input[type="number"],
  .sl-panel select {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(55, 65, 81, 0.9);
    background: #020617;
    color: #e5e7eb;
    font-size: 0.8rem;
  }

  .sl-panel input::placeholder {
    color: rgba(148, 163, 184, 0.9);
  }

  .sl-section {
    border-top: 1px solid rgba(148, 163, 184, 0.4);
    padding-top: 8px;
    margin-top: 6px;
  }
  .sl-section:first-of-type {
    border-top: none;
  }

  .sl-section h3 {
    margin: 0 0 4px 0;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #bfdbfe;
  }

  .sl-subsection {
    border: 1px solid rgba(30, 64, 175, 0.5);
   
