// calc/validators.js
// Pure logic helpers that enforce rules for the calculator UI.
// No DOM access, no state mutation — just booleans and simple checks.

/**
 * A Wye may only be placed on a 2.5" line.
 */
export function canUseWye(sizeInches) {
  return String(sizeInches) === '2.5';
}

/**
 * Determines whether a branch (A or B) should be editable.
 * Branches only exist when the Wye is ON *and* the main size is 2.5".
 */
export function canEditBranch({ wye, size }) {
  return wye === 'on' && String(size) === '2.5';
}

/**
 * Should the UI show the segment switch (Main / Line A / Line B)?
 */
export function shouldShowSegmentSwitch({ wye, size }) {
  return wye === 'on' && String(size) === '2.5';
}

/**
 * Returns the forced diameter for branch lines.
 * All branch legs must be 1.75".
 */
export function forcedBranchDiameter() {
  return '1.75';
}

/**
 * Returns true if this is the main line (not A or B).
 */
export function isMain(seg) {
  return seg === 'main';
}

/**
 * Returns true if this is line A.
 */
export function isBranchA(seg) {
  return seg === 'A';
}

/**
 * Returns true if this is line B.
 */
export function isBranchB(seg) {
  return seg === 'B';
}

/**
 * Ensures segment value is valid.
 */
export function normalizeSegment(seg) {
  if (seg === 'A' || seg === 'B' || seg === 'main') return seg;
  return 'main';
}
