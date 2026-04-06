// calc/styles.css.js
// Centralized styles for the calculator view UI.
// Keeps all editor/Wye/segment button CSS out of logic files.

import { injectStyle } from './dom.js';

export function injectCalcStyles() {
  injectStyle('calc-styles', `
    /* --- Calc Editor Layout --- */
    #tipEditor {
      font-family: system-ui, sans-serif;
    }

    /* --- Segment Switch Buttons (Main / Line A / Line B) --- */
    .segSwitch {
      display: flex;
      gap: 6px;
      margin: 8px 0 6px;
    }

    .segBtn {
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      backdrop-filter: blur(4px);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      font-size: 0.9rem;
    }

    .segBtn.active {
      background: rgba(59,130,246,0.25);
      border-color: rgba(59,130,246,0.5);
    }

    /* --- Branch block is hidden until a segment is selected --- */
    #branchBlock {
      display: none;
    }

    /* --- Form rows inside the editor --- */
    .te-row {
      margin: 6px 0;
    }

    .te-row label {
      display: block;
      font-size: 0.85rem;
      opacity: 0.8;
      margin-bottom: 2px;
    }

    .te-row select,
    .te-row input {
      width: 100%;
      padding: 6px 8px;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(0,0,0,0.2);
      color: white;
    }

    /* --- Disabled selects --- */
    select:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `);
}

export default injectCalcStyles;
