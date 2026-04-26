Scenario Trainer Overlay System

What changed:
- Added a Show Labels / Hide Labels toggle above the scenario image.
- Images stay reusable with no text baked into the artwork.
- Labels are generated as HTML overlays from scenario data.
- If a scenario has no custom overlays array, default overlays are created from line/wye/master stream/standpipe data.

Optional custom JSON format:
"overlays": [
  { "text": "200' 2½ supply", "top": "63%", "left": "35%", "className": "supply" },
  { "text": "A: 150' 1¾ 150 GPM @ 50", "top": "43%", "left": "70%", "className": "attack" }
]

Class options:
- supply
- attack
- appliance
- nozzle
- primary

Direct test path:
/scenario-trainer/index.html
