// router.js

const routes = {
  home: () => loadView('./js/view.home.js'),
  pump: () => loadView('./js/view.calc.main.js'),
  info: () => loadView('./js/view.tables.js'),
  setup: () => loadView('./js/view.settings.js'),

  // 🔥 REPLACED PRACTICE WITH SCENARIO TRAINER
  practice: () => loadScenarioTrainer()
};

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  const hash = location.hash.replace('#', '') || 'home';
  const route = routes[hash];

  if (route) {
    route();
  } else {
    routes.home();
  }
}

// 🔧 Standard view loader (existing)
function loadView(path) {
  import(path)
    .then(module => {
      if (module && module.init) {
        module.init();
      }
    })
    .catch(err => {
      console.error('Error loading view:', err);
    });
}

// 🔥 NEW: Scenario Trainer loader
function loadScenarioTrainer() {
  import('../scenario-trainer/index.js')
    .then(module => {
      if (module && module.initScenarioTrainer) {
        module.initScenarioTrainer();
      }
    })
    .catch(err => {
      console.error('Error loading Scenario Trainer:', err);
    });
}
