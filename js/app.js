// Tiny router + lazy loading
import { renderAdOnce } from './ads-guards.js';
import { getConfiguredPreconnects } from './store.js';

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

// ===========================================================
// First-time guard: require at least one configured preconnect
// ===========================================================
try{
  const pcs = (typeof getConfiguredPreconnects === 'function') ? (getConfiguredPreconnects() || []) : [];
  // If none configured, force the setup wizard.
  if (!Array.isArray(pcs) || pcs.length < 1) {
    // Avoid redirect loops if someone directly opened the setup page.
    // (app.js normally runs only on index.html)
    window.location.href = '/setup-preconnects.html';
  }
}catch(_e){
  // If anything fails here, do not blank-screen the app.
}

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
async function setView(name){
  try{
    if(currentView?.dispose) { currentView.dispose(); }
    app.innerHTML = '<div style="opacity:.7;padding:12px">Loading…</div>';
    const mod = await loaders[name]();
    const view = await mod.render(app);
    currentView = { name, dispose: view?.dispose };
    buttons.forEach(b=>b.classList.toggle('active', b.dataset.view===name));
  }catch(err){
    app.innerHTML = `<div class="card">Failed to load view: ${String(err)}</div>`;
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
