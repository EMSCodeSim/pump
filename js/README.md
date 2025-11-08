
# FireOps Calc — View Refactor (Module Scaffold)

This folder contains a sliced-up version of `view.calc.js` so the popup editor and calc view are easier to maintain.

## Files

- `view.calc.js` — entrypoint/orchestrator (import this instead of the giant file)
- `calc/dom.js` — tiny DOM helpers
- `calc/events.js` — small event bus using `CustomEvent` (prefix `calc:`)
- `calc/styles.css.js` — central CSS injector for the view/editor
- `calc/validators.js` — rules like “Wye only on 2.5”, segment helpers
- `calc/nozzleOptions.js` — nozzle select builders + Fog 185 @ 50 default
- `calc/segmentWye.js` — Main / Line A / Line B logic and Wye gating
- `calc/editorUI.js` — called each time `#tipEditor` opens; wires `segmentWye`
- `calc/initBranchMenus.js` — “+ menu” scaffolding for Main/A/B
- `calc/stateBridge.js` — read/write editor ↔︎ store.js lines
- `calc/friction.js` — pure wrappers for FL / totals (from `store.js`)
- `calc/renderStage.js` — minimal stage renderer scaffold

## How to Use

1. **Keep your existing `store.js` and `waterSupply.js`.**  
   These modules import from them the same way the original file did.

2. **Import the new entrypoint somewhere you previously booted the calc view:**
   ```js
   import { initCalcView } from './view.calc.js';
   const container = document.getElementById('app'); // or your existing shell
   initCalcView(container);
   ```

3. **Announce the tip editor opening so the segmented Wye UI can attach** (pick one):
   - Call the provided bridge when you open the editor:
     ```js
     // where: 'main' | 'L' | 'R'
     window.__announceTipEditorOpen(where, container);
     ```
   - Or emit on the event bus if you prefer:
     ```js
     import { emit } from './calc/events.js';
     emit('tipEditorOpened', { container, where });
     ```

4. **Ensure your editor HTML includes:**
   - `#tipEditor` (root of the popup)
   - `#segSwitch` with three buttons: `.segBtn[data-seg="main"|"A"|"B"]`  
     (or programmatically add them — `segmentWye` only needs the wrapper and buttons)
   - `#branchBlock` containing two `.card`s (Line A and Line B) with IDs `#branchASection` and `#branchBSection`
   - The standard fields the old editor already had:
     - `#teSize` (hidden/current diameter), `#sizeMinus`, `#sizePlus`
     - `#teWye` (select with `'on'`/`'off'`)
     - `#teWhere` (read-only display)
     - `#rowSize`, `#rowLen`, `#rowElev`, `#rowNoz` (main rows shown only on “Main”)
     - `#teNozA`, `#teNozB` (branch nozzle selects)
     - `#teLen`, `#teElev` (shared inputs), etc.

5. **Branch rules already handled:**
   - Wye is only shown/allowed when `#teSize` is `2.5`
   - When editing A/B: size is locked to `1.75` and the main rows hide
   - Branch nozzles default to Fog 185 @ 50 if empty (keeps other options available)

## Notes

- `segmentWye` never mutates your store directly — it only toggles the editor UI. Use `stateBridge.js` to apply changes when the user hits **Apply**.
- The stage renderer here is a scaffold (`calc/renderStage.js`). Replace with your SVG/canvas visualization later, but it will keep your app from erroring now.

