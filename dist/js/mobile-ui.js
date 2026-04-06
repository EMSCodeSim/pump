// mobile-ui.js
// Phone-first polish for any page container (no DOM rewrites).
export function applyMobileFormStyles(root=document){
  if (document.getElementById('mobileFormGlobal')) return;
  const s = document.createElement('style'); s.id='mobileFormGlobal';
  s.textContent = `
    /* Prevent iOS zoom; bigger, consistent targets */
    :root { --tap: 44px; --tapS: 40px; --fieldPad: 10px; --radius: 12px; }
    input, select, textarea, button { font-size:16px; }

    /* General card/table spacing */
    .card { border-radius: var(--radius); }
    .kpis b { font-size: 18px; }

    /* Labels + fields */
    .field label { display:block; font-weight:700; color:#dfe9ff; margin: 6px 0 4px; }
    .field input[type="text"],
    .field input[type="number"],
    .field input[type="tel"],
    .field input[type="search"],
    .field select,
    .field textarea {
      width:100%;
      padding: var(--fieldPad) calc(var(--fieldPad) + 2px);
      border:1px solid rgba(255,255,255,.22);
      border-radius: var(--radius);
      background:#0b1420; color:#eaf2ff;
      outline: none;
    }
    .field input:focus, .field select:focus, .field textarea:focus {
      border-color:#6ecbff; box-shadow:0 0 0 3px rgba(110,203,255,.22);
    }

    /* Buttons */
    .btn, .linebtn, .presetsbtn, .supplybtn, .whyBtn {
      min-height: var(--tap);
      min-width: var(--tapS);
      padding: 10px 14px;
      border-radius: var(--radius);
      touch-action: manipulation;
    }
    .linebar { gap: 8px; flex-wrap: wrap; }

    /* Grids/rows collapse nicely on phone */
    .row { display:flex; gap:10px; flex-wrap:wrap; }
    .row .field { flex: 1 1 160px; }

    /* Tables readable on phone */
    .tTable { width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; border-radius:12px; }
    .tTable thead th { background:#162130; color:#fff; padding:10px; text-align:left; border-bottom:1px solid rgba(255,255,255,.1); }
    .tTable tbody td { padding:10px; vertical-align:middle; }
    .tTable tbody tr:nth-child(odd) td { background:#0e151e; color:#dfeaff; }
    .tTable tbody tr:nth-child(even) td { background:#111924; color:#dfeaff; }

    /* Tap-friendly chips in practice pages */
    .chip, .preset, .toggle {
      min-height: var(--tapS);
      padding: 8px 12px;
      border-radius: 999px;
      border:1px solid rgba(255,255,255,.22);
      background:#0f1723; color:#eaf2ff;
      display:inline-flex; align-items:center; gap:8px;
    }
    .chip.selected, .preset.selected, .toggle[aria-pressed="true"] {
      border-color:#6ecbff; box-shadow: 0 0 0 2px rgba(110,203,255,.22) inset;
    }

    /* Inputs in header bars (search, filters) */
    .toolbar input[type="search"], .toolbar select {
      min-height: var(--tapS);
    }

    /* Sliders on phone: wider thumb area */
    input[type="range"] { touch-action: pan-y; height: var(--tapS); }
  `;
  document.head.appendChild(s);
}

export function enhanceNumericInputs(scope){
  const root = scope || document;
  root.querySelectorAll('input[type="number"]').forEach(el=>{
    if(!el.hasAttribute('inputmode')) el.setAttribute('inputmode','decimal');
    if(!el.hasAttribute('step')) el.setAttribute('step','1');
  });
  // Common text fields that should call up numeric pad
  root.querySelectorAll('input[data-numeric="true"]').forEach(el=>{
    el.setAttribute('inputmode','decimal');
    if(el.type!=='number') el.setAttribute('pattern','[0-9]*');
  });
}

export function padTouchTargets(scope){
  const root = scope || document;
  root.querySelectorAll('button, .chip, .preset, .toggle').forEach(el=>{
    const s = getComputedStyle(el);
    const h = parseFloat(s.minHeight||'0');
    if(h < 40) el.style.minHeight = '40px';
    if(el.clientWidth < 44) el.style.paddingLeft = '12px', el.style.paddingRight='12px';
  });
}
