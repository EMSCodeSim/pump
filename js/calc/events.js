// calc/events.js
// Lightweight event system for the calculator view.
// Uses DOM CustomEvent under a unique namespace to avoid collisions.

const BUS = document;   // simple global dispatcher; could be isolated if needed
const PREFIX = 'calc:';

export function on(eventName, handler) {
  const full = PREFIX + eventName;
  BUS.addEventListener(full, handler);
  return () => BUS.removeEventListener(full, handler);
}

export function off(eventName, handler) {
  BUS.removeEventListener(PREFIX + eventName, handler);
}

export function emit(eventName, detail = {}) {
  const full = PREFIX + eventName;
  BUS.dispatchEvent(new CustomEvent(full, { detail }));
}
