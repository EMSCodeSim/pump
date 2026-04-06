// calc/renderStage.js
// Minimal stage renderer scaffold.
// Purpose: provide a clean place to render hose layout and live stats
// without mixing DOM code into business logic. Safe to expand later.

import { qs, el } from './dom.js';
import { buildCalcSnapshot } from './stateBridge.js';
import { on } from './events.js';

function fmtLine(k, L){
  const gpm = L?.gpm ?? '-';
  const sz  = L?.size ?? '-';
  const len = L?.length ?? '-';
  const elev= L?.elevation ?? '-';
  const noz = L?.nozzleId ?? '-';
  return `${k}: ${sz}"  ${gpm}gpm  ${len}ft  elev ${elev}ft  noz ${noz}`;
}

/**
 * Render the stage into a container element.
 * @param {HTMLElement} container - parent container for the stage canvas/UI
 * @param {Object} opts - optional hooks
 *   @property {() => any} getState - callback to get the shared store (if you prefer)
 */
export function renderStage(container, opts = {}) {
  const host = container || document.body;

  // Root shell
  let stage = qs(host, '#calcStage');
  if (!stage) {
    stage = el('div', { id: 'calcStage', class: 'calc-stage' }, [
      el('div', { class: 'calc-stage-header' }, 'FireOps Calc – Stage'),
      el('div', { class: 'calc-lines' }),
      el('div', { class: 'calc-notes', style: { opacity: 0.7, fontSize: '0.85rem', marginTop: '6px' } },
        'This is a scaffold. Replace with your SVG/Canvas hose layout.'
      )
    ]);
    host.appendChild(stage);
  }
  const linesEl = qs(stage, '.calc-lines');

  function renderOnce() {
    const snap = buildCalcSnapshot(); // { main, A, B }
    linesEl.innerHTML = '';
    linesEl.appendChild(el('pre', { class: 'calc-lines-pre' }, [
      fmtLine('Main', snap.main), '\n',
      fmtLine('Line A', snap.A), '\n',
      fmtLine('Line B', snap.B)
    ]));
  }

  // Initial paint
  renderOnce();

  // Repaint on editor enhancements (after user changes things)
  on('editorEnhanced', () => renderOnce());

  // Return an imperative API for future extensions (zoom, pan, etc.)
  return {
    rerender: renderOnce,
    destroy() { stage.remove(); }
  };
}

export default renderStage;
