// view.presetEditor.js
// TEMP TEST FILE – just to verify the view loads without syntax errors.

export function openPresetEditorPopup() {
  alert('Preset editor test: file loaded and function called.');
}

export function renderPresetEditor(mountEl) {
  if (!mountEl) return;
  mountEl.innerHTML = `
    <div style="
      padding: 12px;
      color: #e5e7eb;
      background:#020617;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    ">
      <h2 style="margin:0 0 8px 0;font-size:16px;">Preset editor test</h2>
      <p style="font-size:13px;line-height:1.4;">
        If you can see this, <code>view.presetEditor.js</code> loaded without syntax errors.
      </p>
    </div>
  `;
}
