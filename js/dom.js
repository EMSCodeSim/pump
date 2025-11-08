// calc/dom.js
// Small DOM utilities used throughout the calculator view.
// All functions are pure helpers; nothing here touches business logic.

export const qs = (root, sel) => root.querySelector(sel);
export const qsa = (root, sel) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') Object.assign(e.style, v);
    else e.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c) e.appendChild(c);
  }
  return e;
}

export function on(elm, evt, fn) {
  elm.addEventListener(evt, fn);
  return () => elm.removeEventListener(evt, fn);
}

export const show = (elm, disp='') => { if (elm) elm.style.display = disp; };
export const hide = (elm) => { if (elm) elm.style.display = 'none'; };

export function injectStyle(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = css;
  document.head.appendChild(s);
}
