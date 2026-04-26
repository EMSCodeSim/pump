FireOps Scenario Trainer Lab

Direct test path after deployment:
/scenario-trainer/index.html

This folder is intentionally standalone. It does not replace Practice Mode yet.
When ready, link the Practice button to this folder or replace view.practice.js with a redirect/import.

Files:
- index.html
- scenario-trainer.css
- scenario-trainer.js
- scenarios.js

Scenario data is stored in scenarios.js for now so it can run locally and inside Android WebView without fetch/CORS issues.
