// calc/initBranchMenus.js
// Handles the “+ menu” behavior for Main, Line A, and Line B.
// This module wires the small popup menus that set length, nozzle,
// elevation, and other per-line adjustments. It does NOT apply Wye logic.
// Wye behavior is exclusively in segmentWye.js.

import { qs, qsa, show, hide, on } from './dom.js';
import { emit } from './events.js';

/**
 * Initializes the + menu for a specific hose segment.
 * `lineKey` = "main", "A", or "B"
 */
export function initPlusMenu(container, lineKey) {
  const tip = qs(container, '#tipEditor');
  if (!tip) return;

  const menu = qs(tip, `.plusMenu[data-line="${lineKey}"]`);
  const btn = qs(tip, `.plusBtn[data-line="${lineKey}"]`);

  if (!menu || !btn) return;

  // Hide menu initially
  hide(menu);

  // Toggle menu visibility
  on(btn, 'click', (e) => {
    e.stopPropagation();
    const isVisible = menu.style.display !== 'none';
    if (isVisible) hide(menu);
    else show(menu);
  });

  // Apply handlers inside the menu
  qsa(menu, '[data-action]').forEach(actBtn => {
    on(actBtn, 'click', () => {
      const action = actBtn.dataset.action;
      emit('plusMenu:action', { lineKey, action });
      hide(menu);
    });
  });

  // Clicking anywhere outside closes the menu
  on(document, 'click', () => hide(menu));
}

/**
 * Initialize all + menus for main, A, and B.
 */
export function initAllPlusMenus(container) {
  ['main', 'A', 'B'].forEach(key => initPlusMenu(container, key));
}

export default initAllPlusMenus;
