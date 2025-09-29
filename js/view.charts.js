// /js/view.charts.js
import { COEFF, NOZ } from './store.js';

export async function render(container){
  container.innerHTML = `
    <section class="stack">
      <!-- Nozzle Browser (Horizontal Tabs) -->
      <section class="card">
        <h3 style="margin:4px 0 10px">Nozzles</h3>

        <div class="row" style="gap:8px; flex-wrap:wrap; align-items:flex-end; margin-bottom:8px">
          <div class="tabbar" id="nozTabs" style="display:flex; gap:6px; flex-wrap:wrap">
            <button class="btn tab active" data-tab="fog">Fog</button>
            <button class="btn tab" data-tab="sb">Smooth Bore</button>
          </div>
        </div>

        <div id="nozContent"></div>
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

  // ---------- Nozzle Browser (Tabs) ----------
  const nozContent = container.querySelector('#nozContent');
  const nozTabs = container.querySelector('#nozTabs');

  // Fog @ 100 psi (common handline fogs) + ChiefXD (from your app)
  const FOG_100 = [
    { name: 'Fog 95 @ 100 psi',  gpm: 95,  NP: 100 },
    { name: 'Fog 115 @ 100 psi', gpm: 115, NP: 100 },
    { name: 'Fog 125 @ 100 psi', gpm: 125, NP: 100 },
    { name: 'Fog 150 @ 100 psi', gpm: 150, NP: 100 },
    { name: 'Fog 175 @ 100 psi', gpm: 175, NP: 100 },
    { name: 'Fog 200 @ 100 psi', gpm: 200, NP: 100 },
    { name: 'Fog 250 @ 100 psi', gpm: 250, NP: 100 },
  ];

  // ChiefXD examples (commonly used in your app)
  const CHIEF_XD = [
    { name: NOZ?.chiefXD?.name || 'ChiefXD 185 @ 50 psi', gpm: NOZ?.chiefXD?.gpm ?? 185, NP: NOZ?.chiefXD?.NP ?? 50 },
    { name: NOZ?.chiefXD265?.name || 'ChiefXD 265 @ 50 psi', gpm: NOZ?.chiefXD265?.gpm ?? 265, NP: NOZ?.chiefXD265?.NP ?? 50 },
  ];

  // Smooth Bore handline tips @ 50 psi
  // GPM ≈ 29.7 * d^2 * sqrt(NP)  (NP=50)
  function tipGpm(d, NP=50){
    const g = 29.7 * (d*d) * Math.sqrt(NP);
    return Math.round(g); // whole number; matches common tables closely
  }
  const SB_TIPS = [
    { tip: '7/8″',   d: 0.875 },
    { tip: '15/16″', d: 0.9375 },
    { tip: '1″',     d: 1.0 },
    { tip: '1 1/8″', d: 1.125 },
    { tip: '1 1/4″', d: 1.25 },
    { tip: '1 1/2″', d: 1.5 },
  ].map(x => ({ name: `SB ${x.tip} @ 50 psi`, gpm: tipGpm(x.d, 50), NP: 50 }));

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

  function renderFog(){
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="mini" style="opacity:.85;margin-bottom:6px">
        Common fog handline settings at <b>100 psi</b> nozzle pressure. Below are also popular <b>ChiefXD</b> nozzles.
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px" id="fogList"></div>
      <h4 style="margin:12px 0 6px">ChiefXD</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px" id="cxdList"></div>
    `;
    nozContent.innerHTML = '';
    nozContent.appendChild(wrap);
    const fogList = wrap.querySelector('#fogList');
    FOG_100.forEach(n => fogList.appendChild(nozzleCard(n)));
    const cxdList = wrap.querySelector('#cxdList');
    CHIEF_XD.forEach(n => cxdList.appendChild(nozzleCard(n)));
  }

  function renderSB(){
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="mini" style="opacity:.85;margin-bottom:6px">
        Smooth bore handline tips at <b>50 psi</b> nozzle pressure.
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px" id="sbList"></div>
    `;
    nozContent.innerHTML = '';
    nozContent.appendChild(wrap);
    const sbList = wrap.querySelector('#sbList');
    SB_TIPS.forEach(n => sbList.appendChild(nozzleCard(n)));
  }

  function setActiveTab(tab){
    nozTabs.querySelectorAll('.tab').forEach(b=>{
      b.classList.toggle('active', b.getAttribute('data-tab')===tab);
    });
    if(tab==='fog') renderFog(); else renderSB();
  }

  nozTabs.addEventListener('click', (e)=>{
    const b = e.target.closest('.tab'); if(!b) return;
    setActiveTab(b.getAttribute('data-tab'));
  });

  // default tab
  setActiveTab('fog');

  // ---------- Friction Loss Quick Chart ----------
  const btnsWrap = container.querySelector('#hoseBtns');
  const chartWrap = container.querySelector('#quickChartWrap');

  const COMMON_GPM = {
    "1.75": [100, 150, 185],
    "2.5":  [200, 250, 300],
    "5":    [500, 750, 1000],
  };

  function sizeLabel(sz){
    return sz==='2.5' ? '2½″' : (sz==='1.75' ? '1¾″' : '5″');
  }

  function buildFLTable(size){
    const C = COEFF[size] || 0;
    const gps = COMMON_GPM[size] || [];
    const rows = gps.map(g=>{
      const Q = g/100;
      const fl = C * (Q*Q);
      return {gpm:g, fl: Math.round(fl*10)/10};
    });

    const t = document.createElement('table');
    t.innerHTML = `
      <caption>FL per 100′ — ${sizeLabel(size)} (C=${C})</caption>
      <thead><tr><th>GPM</th><th>FL / 100′ (psi)</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td>${r.gpm}</td><td>${r.fl}</td></tr>`).join('')}</tbody>
    `;
    chartWrap.innerHTML = '';
    chartWrap.appendChild(t);
  }

  function setActiveSize(size){
    btnsWrap.querySelectorAll('.preset').forEach(b=>{
      const on = b.getAttribute('data-size')===size;
      b.style.outline = on ? '2px solid var(--accent)' : 'none';
    });
    buildFLTable(size);
  }

  btnsWrap.addEventListener('click', e=>{
    const b = e.target.closest('.preset'); if(!b) return;
    setActiveSize(b.getAttribute('data-size'));
  });

  // Default quick chart: 1.75
  setActiveSize('1.75');

  return { dispose(){} };
}

export default { render };
