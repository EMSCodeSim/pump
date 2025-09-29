// /js/view.charts.js
import { COEFF, NOZ } from './store.js';

export async function render(container){
  container.innerHTML = `
    <section class="stack">
      <!-- Nozzle Browser -->
      <section class="card">
        <h3 style="margin:4px 0 10px">Nozzles</h3>

        <details class="math" open>
          <summary style="font-weight:700">Fog Nozzles</summary>
          <div id="fogGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:8px"></div>
        </details>

        <details class="math" open>
          <summary style="font-weight:700">Smooth Bore Tips</summary>
          <div id="sbGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:8px"></div>
        </details>

        <details class="math" open>
          <summary style="font-weight:700">ChiefXD</summary>
          <div id="cxdGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:8px"></div>
        </details>
      </section>

      <!-- Vertical Hose Size buttons + Common GPM quick chart -->
      <section class="card">
        <h3 style="margin:4px 0 8px">Friction Loss (per 100′) — Quick Chart</h3>

        <div style="display:grid;grid-template-columns: 160px 1fr; gap:12px; align-items:start">
          <!-- Vertical buttons -->
          <div id="hoseBtns" style="display:flex;flex-direction:column;gap:8px">
            <button class="preset" data-size="1.75" style="text-align:left">1¾″ (C=${COEFF["1.75"]})</button>
            <button class="preset" data-size="2.5"  style="text-align:left">2½″ (C=${COEFF["2.5"]})</button>
            <button class="preset" data-size="5"    style="text-align:left">5″ (C=${COEFF["5"]})</button>
          </div>

          <!-- Chart output -->
          <div>
            <div class="mini" style="opacity:.85;margin-bottom:6px">
              Select a hose size on the left to see common GPMs and the friction loss per 100′.
              Formula: <code>FL/100′ = C × (gpm/100)²</code>
            </div>
            <div id="quickChartWrap"></div>
          </div>
        </div>
      </section>
    </section>
  `;

  // --- Build nozzle cards
  const fogGrid = container.querySelector('#fogGrid');
  const sbGrid  = container.querySelector('#sbGrid');
  const cxdGrid = container.querySelector('#cxdGrid');

  const fogList = [
    NOZ.fog125_75, NOZ.fog150_75, NOZ.fog185_75, NOZ.fog200_75,
    {id:'fog250_75_extra', grp:'Fog', name:'Fog 250@75', gpm:250, NP:75}
  ].filter(Boolean);

  const sbList = [
    NOZ.sb7_8, NOZ.sb15_16, NOZ.sb1_1_8,
    {id:'sb1_1_4', grp:'Smooth Bore', name:'SB 1¼″ (325@50)', gpm:325, NP:50}
  ].filter(Boolean);

  const chiefList = [ NOZ.chiefXD, NOZ.chiefXD265 ].filter(Boolean);

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

  // --- Quick FL chart per hose size
  const btnsWrap = container.querySelector('#hoseBtns');
  const chartWrap = container.querySelector('#quickChartWrap');

  const COMMON_GPM = {
    "1.75": [100, 150, 185],         // per your example
    "2.5":  [200, 250, 300],
    "5":    [500, 750, 1000],
  };

  function sizeLabel(sz){
    return sz==='2.5' ? '2½″' : (sz==='1.75' ? '1¾″' : '5″');
  }

  function renderQuickChart(size){
    const C = COEFF[size] || 0;
    const gps = COMMON_GPM[size] || [];
    const rows = gps.map(g=>{
      const Q = g/100;
      const fl = C * (Q*Q);
      return {gpm:g, fl: Math.round(fl*10)/10};
    });

    // table
    const table = document.createElement('table');
    table.innerHTML = `
      <caption>FL per 100′ — ${sizeLabel(size)} (C=${C})</caption>
      <thead><tr><th>GPM</th><th>FL / 100′ (psi)</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td>${r.gpm}</td><td>${r.fl}</td></tr>`).join('')}</tbody>
    `;
    chartWrap.innerHTML = '';
    chartWrap.appendChild(table);
  }

  // button interactions
  function setActive(size){
    btnsWrap.querySelectorAll('.preset').forEach(b=>{
      const on = b.getAttribute('data-size')===size;
      b.style.outline = on ? '2px solid var(--accent)' : 'none';
    });
  }

  btnsWrap.addEventListener('click', e=>{
    const b = e.target.closest('.preset');
    if(!b) return;
    const size = b.getAttribute('data-size');
    setActive(size);
    renderQuickChart(size);
  });

  // default selection: 1.75
  setActive('1.75');
  renderQuickChart('1.75');

  return { dispose(){} };
}

export default { render };
