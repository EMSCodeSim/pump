// /js/view.calc.js (functional entry so screen isn't blank)

import { injectCalcStyles } from './calc/styles.css.js';
import { on, emit } from './calc/events.js';
import { qs, el } from './calc/dom.js';
import renderStage from './calc/renderStage.js';

// Initialize the calculator view
export function initCalcView(container) {
  if (!container) throw new Error('initCalcView: container is required');

  // Inject styles once
  injectCalcStyles(container);

  // Clear and mount a visible shell
  container.innerHTML = '';

  // Header bar
  const header = el('div', {
    style: {
      background: 'rgba(255,255,255,0.05)',
      padding: '12px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      alignItems: 'center',
      fontWeight: '600',
      fontSize: '1.1rem'
    }
  }, 'FireOps Calc');

  container.appendChild(header);

  // Stage area so something shows on screen
  const stageHost = el('div', {
    id: 'stageHost',
    style: {
      padding: '16px',
      color: 'white'
    }
  });
  container.appendChild(stageHost);

  // Render scaffolding stage so UI isn't blank
  renderStage(stageHost);

  // Legacy bridge for opening the tip editor
  window.__announceTipEditorOpen = function(where = 'main', ctn = container) {
    emit('tipEditorOpened', { container: ctn, where });
  };

  // (optional) rerender stage after editor is enhanced
  on('editorEnhanced', () => {
    // In future: rerender stage after changes
    // For now, nothing needed.
  });
}

// Legacy/compat helper
export function render(container) {
  return initCalcView(container);
}

export default render;
