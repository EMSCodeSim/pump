FireOps Scenario Button Fix - Single Line Pack

This patch makes the Scenarios button load the uploaded single-line scenario pack.

Main files:
- js/view.practice.js
- dist/js/view.practice.js
- scenarios/scenario-index.json
- dist/scenarios/scenario-index.json
- scenarios/single_line_preconnect_001.png
- scenarios/single_line_extended_002.png
- scenarios/single_line_heavy_003.png
- dist/scenarios/single_line_preconnect_001.png
- dist/scenarios/single_line_extended_002.png
- dist/scenarios/single_line_heavy_003.png

Important:
- Capacitor uses dist/, so the images and JSON must exist inside dist/scenarios/.
- Old scenario JSON/SVG files can remain in the folder, but they are no longer referenced by scenario-index.json.
- The loader now supports scenario-index.json as a manifest object or as a raw array of scenarios.
