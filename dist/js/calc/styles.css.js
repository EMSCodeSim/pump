// calc/styles.css.js
// Centralized styles for the calculator view UI.
// Keeps all editor/Wye/segment button CSS out of logic files.

import { injectStyle } from './dom.js';

export function injectCalcStyles() {
  injectStyle('calc-styles', `
    /* --- Calc Editor Layout --- */
    #tipEditor {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 1.35;
      -webkit-text-size-adjust: 100%;
    }

    /* --- Segment Switch Buttons (Main / Line A / Line B) --- */
    .segSwitch {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 12px 0 12px;
    }

    .segBtn {
      flex: 1 1 110px;
      min-height: 48px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.18);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, transform 0.05s;
      font-size: 1rem;
      font-weight: 700;
      color: #fff;
      text-align: center;
      appearance: none;
      -webkit-appearance: none;
      touch-action: manipulation;
    }

    .segBtn:active {
      transform: scale(0.98);
    }

    .segBtn.active {
      background: rgba(59,130,246,0.28);
      border-color: rgba(59,130,246,0.62);
      box-shadow: 0 0 0 1px rgba(59,130,246,0.18) inset;
    }

    /* --- Branch block is hidden until a segment is selected --- */
    #branchBlock {
      display: none;
      margin-top: 10px;
    }

    /* --- Form rows inside the editor --- */
    .te-row {
      margin: 12px 0;
    }

    .te-row label {
      display: block;
      font-size: 1rem;
      font-weight: 700;
      opacity: 0.95;
      margin-bottom: 6px;
      color: #fff;
    }

    .te-row select,
    .te-row input,
    .te-row button,
    #tipEditor select,
    #tipEditor input,
    #tipEditor button {
      width: 100%;
      min-height: 48px;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.22);
      background: rgba(0,0,0,0.28);
      color: #fff;
      font-size: 16px;
      line-height: 1.2;
      box-sizing: border-box;
      appearance: none;
      -webkit-appearance: none;
      -webkit-border-radius: 12px;
      touch-action: manipulation;
    }

    .te-row select,
    #tipEditor select {
      padding-right: 38px;
      background-image:
        linear-gradient(45deg, transparent 50%, rgba(255,255,255,0.9) 50%),
        linear-gradient(135deg, rgba(255,255,255,0.9) 50%, transparent 50%);
      background-position:
        calc(100% - 18px) calc(50% - 3px),
        calc(100% - 12px) calc(50% - 3px);
      background-size: 6px 6px, 6px 6px;
      background-repeat: no-repeat;
    }

    .te-row input::placeholder,
    #tipEditor input::placeholder {
      color: rgba(255,255,255,0.55);
    }

    .te-row select:focus,
    .te-row input:focus,
    .te-row button:focus,
    #tipEditor select:focus,
    #tipEditor input:focus,
    #tipEditor button:focus {
      outline: none;
      border-color: rgba(59,130,246,0.75);
      box-shadow: 0 0 0 2px rgba(59,130,246,0.20);
    }

    /* --- Disabled selects --- */
    select:disabled,
    input:disabled,
    button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    /* --- Better spacing for stacked editor controls --- */
    #tipEditor .row,
    #tipEditor .fieldRow,
    #tipEditor .buttonRow,
    #tipEditor .controlRow {
      margin: 10px 0;
    }

    /* --- Mobile / Android friendly adjustments --- */
    @media (max-width: 768px) {
      #tipEditor {
        font-size: 16px;
      }

      .segSwitch {
        gap: 12px;
        margin: 14px 0;
      }

      .segBtn {
        min-height: 52px;
        padding: 14px 16px;
        font-size: 1.02rem;
        border-radius: 14px;
      }

      .te-row {
        margin: 14px 0;
      }

      .te-row label {
        font-size: 1rem;
        margin-bottom: 7px;
      }

      .te-row select,
      .te-row input,
      .te-row button,
      #tipEditor select,
      #tipEditor input,
      #tipEditor button {
        min-height: 52px;
        padding: 14px 16px;
        font-size: 16px;
        border-radius: 14px;
      }
    }

    /* --- Extra small phone screens --- */
    @media (max-width: 420px) {
      .segBtn {
        flex: 1 1 100%;
      }

      .te-row label {
        font-size: 0.98rem;
      }
    }
  `);
}

export default injectCalcStyles;
