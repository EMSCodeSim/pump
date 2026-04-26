Scenario file loading

The Scenario button now loads JSON-driven scenario files from:

  scenarios/scenario-index.json

The app packages from dist, so the same files are also copied to:

  dist/scenarios/scenario-index.json

To add more scenarios:
1. Add the new .json file and artwork file to scenarios/.
2. Add the .json filename to scenarios/scenario-index.json.
3. Copy the same files to dist/scenarios/ before building the mobile app.

The scenario view supports fields named answers.frictionLoss, answers.nozzlePressure, answers.elevationPressure, answers.applianceLoss, answers.totalGpm, and answers.pumpPressure.
