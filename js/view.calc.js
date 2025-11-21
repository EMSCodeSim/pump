// Thin wrapper so the router can keep importing "./view.calc.js"
// All the real logic now lives in "./view.calc.main.js"

import { render as innerRender } from './view.calc.main.js';

export async function render(container) {
  return innerRender(container);
}
