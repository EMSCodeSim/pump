// tabs-fixed.js
// More defensive controller for Calculations / Practice / Charts tabs.
// Ensures ONLY the active view can receive clicks, so the stage '+' is never covered.

document.addEventListener('DOMContentLoaded', () => {
  const tabCalc     = document.querySelector('[data-tab="calc"], button#tabCalc, [data-role="tab-calc"]');
  const tabPractice = document.querySelector('[data-tab="practice"], button#tabPractice, [data-role="tab-practice"]');
  const tabCharts   = document.querySelector('[data-tab="charts"], button#tabCharts, [data-role="tab-charts"]');

  const calcView     = document.querySelector('#calcView, [data-view="calc"]');
  const practiceView = document.querySelector('#practiceView, [data-view="practice"]');
  const chartsView   = document.querySelector('#chartsView, [data-view="charts"]');

  function exists(el, name){
    if(!el) console.warn('tabs-fixed.js: missing element for', name);
    return !!el;
  }

  if (!exists(tabCalc,'tabCalc') || !exists(tabPractice,'tabPractice') || !exists(calcView,'calcView') || !exists(practiceView,'practiceView')) {
    // We still proceed, but behavior may be partial.
  }

  function activate(view){
    [calcView, practiceView, chartsView].forEach(v=>{
      if(!v) return;
      const active = (v === view);
      v.style.display = active ? 'block' : 'none';
      v.style.pointerEvents = active ? 'auto' : 'none';
    });
  }

  function setActiveTab(activeTab){
    [tabCalc, tabPractice, tabCharts].forEach(t=>{
      if(!t) return;
      if(t === activeTab) t.classList.add('is-active');
      else t.classList.remove('is-active');
    });
  }

  function showCalc(){
    activate(calcView);
    setActiveTab(tabCalc);
  }
  function showPractice(){
    activate(practiceView);
    setActiveTab(tabPractice);
  }
  function showCharts(){
    activate(chartsView);
    setActiveTab(tabCharts);
  }

  if (tabCalc) tabCalc.addEventListener('click', (e)=>{ e.preventDefault(); showCalc(); });
  if (tabPractice) tabPractice.addEventListener('click', (e)=>{ e.preventDefault(); showPractice(); });
  if (tabCharts) tabCharts.addEventListener('click', (e)=>{ e.preventDefault(); showCharts(); });

  // Default to Calculations on load
  showCalc();
});
