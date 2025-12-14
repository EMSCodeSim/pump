// deptNozzles.js
// Single source of truth for Department Setup nozzle checklist.
//
// We export a function so it always reflects the latest catalog
// (including any custom nozzles added during this session).

import { getDeptNozzles } from './store.js';

export function getDeptNozzleLibrary(){
  const list = getDeptNozzles() || [];
  return list.map(n => ({ id: n.id, label: n.label || n.name || n.id }));
}
