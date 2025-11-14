// tabs.js
// Simple controller for the Calculations / Practice tabs so that
// the inactive view cannot intercept clicks (especially the + hose tip).

document.addEventListener('DOMContentLoaded', () => {
  const tabCalc     = document.querySelector('[data-tab="calc"]');
  const tabPractice = document.querySelector('[data-tab="practice"]');

  const calcView     = document.querySelector('#calcView');      // <-- adjust ID to your calc container
  const practiceView = document.querySelector('#practiceView');  // <-- adjust ID to your practice container

  if (!tabCalc || !tabPractice || !calcView || !practiceView) {
    console.warn('tabs.js: could not find tabs or views; check IDs/selectors.');
    return;
  }

  function showCalc() {
    tabCalc.classList.add('is-active');
    tabPractice.classList.remove('is-active');

    // Only Calculations is visible & clickable
    calcView.style.display = 'block';
    calcView.style.pointerEvents = 'auto';

    practiceView.style.display = 'none';
    practiceView.style.pointerEvents = 'none';
  }

  function showPractice() {
    tabPractice.classList.add('is-active');
    tabCalc.classList.remove('is-active');

    practiceView.style.display = 'block';
    practiceView.style.pointerEvents = 'auto';

    calcView.style.display = 'none';
    calcView.style.pointerEvents = 'none';
  }

  // Wire up click handlers
  tabCalc.addEventListener('click', (e) => {
    e.preventDefault();
    showCalc();
  });

  tabPractice.addEventListener('click', (e) => {
    e.preventDefault();
    showPractice();
  });

  // Initial state: show Calculations
  showCalc();
});
