// /js/view.charts.js
import { COEFF, NOZ, NOZ_LIST } from './store.js';

export async function render(container){
  container.innerHTML = `
    <section class="stack">
      <!-- Nozzle Browser -->
      <section class="card">
        <h3 style="margin:4px 0 10px">Nozzles</h3>

        <details class="math" open>
          <summary style="font-weight:700">Fog Nozzles</summary>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:8px" id="fogGrid"></div>
        </details>

        <details class="math" open>
          <summary style="font-weight:700">Smooth Bore Tips</summary>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:8px" id="sbGrid"></div>
        </details>

        <details class="math" open>
          <summary style="font-weight:700">ChiefXD</summary>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:8px" id="cxdGrid"></div>
        </details>
      </section>

      <!-- Friction Loss Explorer -->
      <section class="card">
        <h3 style="margin:4px 0 10px">Friction Loss Explorer (per 100′)</h3>

        <div class="row" style="gap:10px;align-items:flex-end;flex-wrap:wrap">
          <div class="field" style="min-width:160px">
            <label>Hose Size</label>
            <select id="hoseSize">
              <option value="1.75">1¾″ (C=${COEFF["1.75"]})</option>
              <option value="2.5">2½″ (C=${COEFF["2.5"]})</option>
              <option value="5">5″ (C=${COEFF["5"]})</option>
            </select>
          </div>

          <div class="field" style="min-width:120px">
            <label>From (gpm)</label>
            <input type="number" id="gpmFrom" value="100" min="1" step="5">
          </div>
          <div class="field" style="min-width:120px">
            <label>To (gpm)</label>
            <input type="number" id="gpmTo" value="300" min="1" step="5">
          </div>
          <div class="field" style="min-width:120px">
            <label>Step (gpm)</label>
            <input type="number" id="gpmStep" value="25" min="1" step="1">
          </div>

          <div class="field" style="min-width:160px">
            <button class="btn primary" id="genBtn" style="width:100%">Generate</button>
          </div>
        </div>

        <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap">
          <div class="mini" style="opacity:.8">Quick ranges:</div>
          <button class="btn" data-quick="attack">150–250 by 25</button>
          <button class="btn" data-quick="big">250–500 by 50</button>
          <button class="btn" data-quick="wide">100–400 by 50</button>
        </div>

        <div id="flTableWrap" style="margin-top:10px"></div>
        <div class="status" id="flNote" style="margin-top:6px;color:#9fb0c8">
          Formula: <code>FL/100′ = C × (gpm/100)²</code>. Coefficients from your app constants.
        </div>
      </section>
    </section>
  `;

  // ---- Build nozzle cards
  const fogGrid = container.querySelector('#fogGrid');
  const sbGrid  = container.querySelector('#sbGrid');
  const cxdGrid = container.querySelector('#cxdGrid');

  // Group existing nozzles and supplement with a few very common ones
  const fogList = [
    // From your store:
    NOZ.fog125_75, NOZ.fog150_75, NOZ.fog185_75, NOZ.fog200_75,
    // A common 250@75 fog for 2½"
    {id:'fog250_75_extra', grp:'Fog', name:'Fog 250@75', gpm:250, NP:75}
  ].filter(Boolean);

  const sbList = [
    NOZ.sb7_8, NOZ.sb15_16, NOZ.sb1_1_8,
    // Optionally include 1¼" (~325 gpm @ 50) if you want a bigger master stream tip:
    {id:'sb1_1_4', grp:'Smooth Bore', name:'SB 1¼″ (325@50)', gpm:325, NP:50}
  ].filter(Boolean);

  const chiefList = [
    NOZ.chiefXD, NOZ.chiefXD265
  ].filter(Boolean);

  function nozzleCard(n){
    const el = document.createElement('div');
    el.className = 'preset';
    el.style.textAlign='left';
    el.innerHTML = `
      <div style="font-weight:700">${n.name}</div>
      <div style="font-size:12px;opacity:.85">Flow <b>${n.gpm} gpm</b> @ NP <b>${n.NP} psi</b></div>
    `;
    return el;
  }
  fogList.forEach(n=> fogGrid.appendChild(nozzleCard(n)));
  sbList.forEach(n=> sbGrid.appendChild(nozzleCard(n)));
  chiefList.forEach(n=> cxdGrid.appendChild(nozzleCard(n)));

  // ---- Friction Loss Explorer
  const hoseSize = container.querySelector('#hoseSize');
  const gpmFrom  = container.querySelector('#gpmFrom');
  const gpmTo    = container.querySelector('#gpmTo');
  const gpmStep  = container.querySelector('#gpmStep');
  const genBtn   = container.querySelector('#genBtn');
  const flTableWrap = container.querySelector('#flTableWrap');

  function clampRange(a,b){
    let from = Math.max(1, Math.min(a,b));
    let to   = Math.max(1, Math.max(a,b));
    if(to === from) to = from + 1;
    return {from, to};
  }

  function buildFLTable(){
    const size = hoseSize.value;
    const C = COEFF[size] || 0;
    const step = Math.max(1, +gpmStep.value||25);
    const {from, to} = clampRange(+gpmFrom.value||100, +gpmTo.value||300);

    const rows = [];
    for(let g=from; g<=to; g+=step){
      const Q = g/100;
      const fl = C*(Q*Q); // per 100'
      rows.push({gpm:g, fl:Math.round(fl*10)/10});
    }

    // Build table
    const t = document.createElement('table');
    t.innerHTML = `
      <caption>FL per 100′ — ${size==='1.75'?'1¾″':(size==='2.5'?'2½″':'5″')} (C=${C})</caption>
      <thead><tr><th>GPM</th><th>FL / 100′ (psi)</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td>${r.gpm}</td><td>${r.fl}</td></tr>`).join('')}</tbody>
    `;
    flTableWrap.innerHTML = '';
    flTableWrap.appendChild(t);
  }

  genBtn.addEventListener('click', buildFLTable);

  // Quick range buttons
  container.querySelectorAll('[data-quick]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const type = btn.getAttribute('data-quick');
      if(type==='attack'){ gpmFrom.value=150; gpmTo.value=250; gpmStep.value=25; }
      else if(type==='big'){ gpmFrom.value=250; gpmTo.value=500; gpmStep.value=50; hoseSize.value='2.5'; }
      else if(type==='wide'){ gpmFrom.value=100; gpmTo.value=400; gpmStep.value=50; }
      buildFLTable();
    });
  });

  // Build an initial table by default
  buildFLTable();

  return { dispose(){} };
}

export default { render };
