// Tiny router + lazy loading
import { renderAdOnce } from './ads-guards.js';

// === AdSense (web-only) ===
// Replace slot IDs with your real AdSense ad unit slot IDs after approval.
const ADS_CLIENT = 'ca-pub-9414291143716298';
const SLOT_TABLES_BOTTOM = 'REPLACE_WITH_SLOT_ID';

const app = document.getElementById('app');
const buttons = Array.from(document.querySelectorAll('.navbtn'));
let currentView = null; // { name, dispose?() }

const loaders = {
  calc:      () => import('./view.calc.js'),
  practice:  () => import('./view.practice.js'),
  charts:    () => import('./view.charts.js'),
  settings:  () => import('./view.settings.js'),
};

// === Charts overlay support ===
let chartsOverlay = document.getElementById('chartsOverlay');
let chartsMount = document.getElementById('chartsMount');
let chartsClose = document.getElementById('closeCharts');
let chartsDispose = null;

async function openCharts(){
  if(!chartsOverlay) return;
  chartsOverlay.style.display = 'block';
  // Lazy load charts view into the overlay without touching the current view
  chartsMount.innerHTML = '<div style="opacity:.7;padding:12px">Loading charts…</div>';
  try{
    const mod = await loaders.charts();
    const res = await mod.render(chartsMount); // may return { dispose }
    chartsDispose = res?.dispose || null;

    // Non-intrusive ad at the very bottom of reference tables (only inject once)
    try{
      renderAdOnce({
        key: 'tables_bottom',
        container: chartsMount,
        position: 'bottom',
        client: ADS_CLIENT,
        slot: SLOT_TABLES_BOTTOM,
        format: 'auto',
        style: 'display:block; margin:16px 0;',
      });
    } catch (e) {
      // Ads are best-effort; never break the overlay.
    }
  }catch(err){
    chartsMount.innerHTML = '<div class="card">Failed to load charts: ' + String(err) + '</div>';
  }
}

function closeCharts(){
  if(chartsDispose) { try { chartsDispose(); } catch(_){} chartsDispose = null; }
  if(chartsMount) chartsMount.innerHTML = '';
  if(chartsOverlay) chartsOverlay.style.display = 'none';
}

if(chartsClose){ chartsClose.addEventListener('click', closeCharts); }
if(chartsOverlay){ chartsOverlay.addEventListener('click', (e)=>{ if(e.target === chartsOverlay) closeCharts(); }); }

// ---- view swapping for calc/practice/settings ----
function withTimeout(promise, ms, label){
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);
}

async function setView(name){
  try{
    if(currentView?.dispose) { currentView.dispose(); }

    // Show loading immediately
    if (app) {
      app.innerHTML = '<div style="opacity:.7;padding:12px">Loading…</div>';
    }

    // If module import hangs (cache/missing file), fail gracefully instead of infinite Loading...
    const mod = await withTimeout(loaders[name](), 4000, `Load view "${name}"`);

    // Render view
    const view = await withTimeout(mod.render(app), 4000, `Render view "${name}"`);

    currentView = { name, dispose: view?.dispose };
    buttons.forEach(b=>b.classList.toggle('active', b.dataset.view===name));
  }catch(err){
    const msg = String(err);

    if (app) {
      app.innerHTML = `
        <div class="card">
          <div style="font-weight:800;margin-bottom:6px;">App failed to load</div>
          <div style="opacity:.85;margin-bottom:10px;">${msg}</div>

          <button class="btn primary" id="btnSetup">Run Preconnect Setup</button>
          <button class="btn" id="btnReload" style="margin-left:8px;">Hard Reload</button>

          <div style="opacity:.7;margin-top:10px;font-size:.9em;">
            If this keeps happening, clear site data for fireopscalc.com (cache + storage).
          </div>
        </div>
      `;

      const s = document.getElementById("btnSetup");
      if (s) s.onclick = () => window.location.href = "/setup-preconnects.html";

      const r = document.getElementById("btnReload");
      if (r) r.onclick = () => window.location.reload();
    }
  }
}

// Intercept bottom-nav clicks: open overlay for Charts, swap view for others
buttons.forEach(b => b.addEventListener('click', ()=> {
  const v = b.dataset.view;

  if(v === 'charts'){
    openCharts();
    return;
  }

  // If coming back to calc from practice, force a full page reload
  if (v === 'calc' && currentView?.name === 'practice') {
    window.location.reload();
    return;
  }

  setView(v);
}));

setView('calc'); // initial
