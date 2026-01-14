
// view.practice.merged.v4.js
// UI COPY CONSISTENCY UPDATE
// - Standardizes wording across PDP / ADJUST / REVERSE / DECISION CHECK
// - Dynamically updates labels, placeholders, and buttons
// - NO logic changes from merged.v3

// IMPORTANT:
// This file assumes your existing merged.v3 logic.
// If you diff this against merged.v3, changes are limited to:
//  - prompt text
//  - labels / placeholders
//  - feedback strings

export const UI_COPY = {
  headerSubtext: 'Use the diagram and prompt to answer the question.',

  chips: {
    PDP: 'PDP CALCULATION',
    ADJUST: 'ADJUSTMENT',
    REVERSE: 'REVERSE CALCULATION',
    CHECK: 'DECISION CHECK',
  },

  prompts: {
    PDP: 'Calculate the required Pump Discharge Pressure (PDP).',
    ADJUST: 'Based on this change, what is the NEW required PDP?',
    CHECK: limit => `Is this setup acceptable with a ${limit} psi pump limit?`,
  },

  input: {
    psiLabel: 'Your answer (psi)',
    psiPlaceholder: 'Enter pressure in psi',
    gpmLabel: 'Your answer (gpm)',
    gpmPlaceholder: 'Enter flow in gpm',
    ynLabel: 'Your answer (Y / N)',
    ynPlaceholder: 'Enter Y or N',
  },

  buttons: {
    checkPsi: 'Check (±5 psi)',
    checkYN: 'Check (Y/N)',
  },

  feedback: {
    correct: {
      PDP: 'Correct. This is the required pump discharge pressure.',
      ADJUST: 'Correct. Pump pressure adjusted appropriately.',
      REVERSE: 'Correct. You isolated the correct value.',
      CHECK_Y: 'Correct. This setup is within safe operating limits.',
      CHECK_N: 'Correct. This setup exceeds safe operating limits.',
    },
    incorrect: {
      PDP: 'Not quite. Review nozzle pressure, friction loss, and elevation.',
      ADJUST: 'Not quite. Recalculate using the updated setup.',
      REVERSE: 'Not quite. Work backward from the total PDP.',
      CHECK: 'Not quite. Compare required PDP to the pump limit.',
    },
  },

  revealLead: {
    PDP: 'Pump to meet the highest required pressure.',
    ADJUST: 'Changes in flow or elevation affect friction loss and required pressure.',
    REVERSE: 'Work backward from PDP by removing known values.',
    CHECK: 'Pump operators must verify operations stay within equipment limits.',
  },
};

export default UI_COPY;
