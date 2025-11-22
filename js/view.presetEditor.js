
// view.presetEditor.js
// Simple popup preset editor for FireOps Calc.

import { openMasterStreamPopup }   from "./view.lineMaster.js";
import { openStandpipePopup }      from "./view.lineStandpipe.js";
import { openFoamPopup }           from "./view.lineFoam.js";
import { openSprinklerPopup }      from "./view.lineSprinkler.js";
import { openStandardLinePopup }   from "./view.lineStandard.js";
import { openSupplyLinePopup }     from "./view.lineSupply.js";
import { openCustomBuilderPopup }  from "./view.lineCustom.js";

export function openPresetEditorPopup(options) {
  if (!options) options = {};
  const dept = options.dept || {};
  const onSave = typeof options.onSave === "function" ? options.onSave : function() {};
  const onCancel = typeof options.onCancel === "function" ? options.onCancel : function() {};

  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.right = "0";
  overlay.style.bottom = "0";
  overlay.style.background = "rgba(0,0,0,0.55)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "flex-start";
  overlay.style.justifyContent = "center";
  overlay.style.paddingTop = "40px";
  overlay.style.zIndex = "9999";

  const panel = document.createElement("div");
  panel.style.maxWidth = "480px";
  panel.style.width = "100%";
  panel.style.background = "#020617";
  panel.style.color = "#e5e7eb";
  panel.style.borderRadius = "16px";
  panel.style.boxShadow = "0 18px 30px rgba(15,23,42,0.75)";
  panel.style.border = "1px solid rgba(148,163,184,0.35)";
  panel.style.padding = "12px 14px 10px";
  panel.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
  panel.style.boxSizing = "border-box";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.marginBottom = "6px";
  header.style.borderBottom = "1px solid rgba(148,163,184,0.25)";
  header.style.paddingBottom = "4px";

  const title = document.createElement("div");
  title.textContent = "Preset line editor";
  title.style.fontSize = "0.95rem";
  title.style.fontWeight = "600";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "✕";
  closeBtn.style.width = "26px";
  closeBtn.style.height = "26px";
  closeBtn.style.borderRadius = "999px";
  closeBtn.style.border = "1px solid rgba(148,163,184,0.6)";
  closeBtn.style.background = "#020617";
  closeBtn.style.color = "#e5e7eb";
  closeBtn.style.cursor = "pointer";

  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.style.maxHeight = "60vh";
  body.style.overflowY = "auto";
  body.style.fontSize = "0.85rem";

  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.justifyContent = "flex-end";
  footer.style.gap = "6px";
  footer.style.marginTop = "8px";
  footer.style.borderTop = "1px solid rgba(148,163,184,0.25)";
  footer.style.paddingTop = "6px";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.borderRadius = "999px";
  cancelBtn.style.padding = "6px 12px";
  cancelBtn.style.fontSize = "0.82rem";
  cancelBtn.style.border = "1px solid rgba(148,163,184,0.7)";
  cancelBtn.style.cursor = "pointer";
  cancelBtn.style.background = "#020617";
  cancelBtn.style.color = "#e5e7eb";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save preset";
  saveBtn.style.borderRadius = "999px";
  saveBtn.style.padding = "6px 12px";
  saveBtn.style.fontSize = "0.82rem";
  saveBtn.style.border = "none";
  saveBtn.style.cursor = "pointer";
  saveBtn.style.background = "#22c55e";
  saveBtn.style.color = "#020617";
  saveBtn.style.fontWeight = "600";

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function close(cancelled) {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (cancelled) {
      onCancel();
    }
  }

  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) {
      close(true);
    }
  });
  closeBtn.addEventListener("click", function() { close(true); });
  cancelBtn.addEventListener("click", function() { close(true); });

  // --- simple state for this editor ---
  const state = {
    name: "",
    lineType: "",
    configs: {}
  };

  // --- name input ---
  const nameRow = document.createElement("div");
  nameRow.style.display = "flex";
  nameRow.style.flexDirection = "column";
  nameRow.style.gap = "4px";
  nameRow.style.marginTop = "4px";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Preset name:";
  nameLabel.style.fontSize = "0.82rem";
  nameLabel.style.fontWeight = "500";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = 'Example: 1 3/4\" 200 ft 150 gpm';
  nameInput.style.padding = "6px 8px";
  nameInput.style.borderRadius = "8px";
  nameInput.style.border = "1px solid rgba(55,65,81,0.9)";
  nameInput.style.background = "#020617";
  nameInput.style.color = "#e5e7eb";
  nameInput.style.fontSize = "0.8rem";
  nameInput.style.boxSizing = "border-box";

  nameInput.addEventListener("input", function() {
    state.name = nameInput.value || "";
    updateTypeButtons();
    updatePreview();
  });

  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);
  body.appendChild(nameRow);

  // --- type buttons ---
  const typeTitle = document.createElement("div");
  typeTitle.textContent = "Choose build type";
  typeTitle.style.marginTop = "10px";
  typeTitle.style.fontSize = "0.82rem";
  typeTitle.style.textTransform = "uppercase";
  typeTitle.style.letterSpacing = "0.06em";
  typeTitle.style.color = "#bfdbfe";

  body.appendChild(typeTitle);

  const typeGrid = document.createElement("div");
  typeGrid.style.display = "flex";
  typeGrid.style.flexWrap = "wrap";
  typeGrid.style.gap = "6px";
  typeGrid.style.marginTop = "6px";

  body.appendChild(typeGrid);

  const typeButtons = [];

  function makeTypeButton(id, label, sublabel) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.style.flex = "1 1 45%";
    btn.style.minWidth = "120px";
    btn.style.padding = "6px 8px";
    btn.style.borderRadius = "10px";
    btn.style.border = "1px solid rgba(55,65,81,0.9)";
    btn.style.background = "rgba(15,23,42,0.8)";
    btn.style.color = "#e5e7eb";
    btn.style.textAlign = "left";
    btn.style.cursor = "pointer";

    const titleSpan = document.createElement("div");
    titleSpan.textContent = label;
    titleSpan.style.fontSize = "0.8rem";
    titleSpan.style.fontWeight = "600";

    const subSpan = document.createElement("div");
    subSpan.textContent = sublabel || "";
    subSpan.style.fontSize = "0.72rem";
    subSpan.style.opacity = "0.8";

    btn.appendChild(titleSpan);
    btn.appendChild(subSpan);

    btn.addEventListener("click", function(e) {
      e.preventDefault();
      if (!state.name.trim()) {
        alert("Enter a preset name first.");
        return;
      }
      setLineType(id, true);
    });

    typeButtons.push({ id: id, btn: btn });
    typeGrid.appendChild(btn);
  }

  makeTypeButton("standard",  "Standard line",  "Attack line (wye optional)");
  makeTypeButton("master",    "Master stream",  "Deck gun or portable base");
  makeTypeButton("standpipe", "Standpipe",      "High-rise / FDC standpipe");
  makeTypeButton("sprinkler", "Sprinkler",      "Sprinkler / FDC supply");
  makeTypeButton("foam",      "Foam line",      "Foam eductor / foam setup");
  makeTypeButton("supply",    "Supply line",    "Hydrant / relay / feed line");
  makeTypeButton("custom",    "Custom builder", "Any layout: wyes, siamese, etc.");

  const typeHint = document.createElement("div");
  typeHint.textContent = "Enter a preset name first, then tap a type to open its builder.";
  typeHint.style.fontSize = "0.75rem";
  typeHint.style.opacity = "0.8";
  typeHint.style.marginTop = "4px";
  body.appendChild(typeHint);

  // --- preview bar ---
  const preview = document.createElement("div");
  preview.style.marginTop = "8px";
  preview.style.padding = "8px";
  preview.style.borderRadius = "10px";
  preview.style.border = "1px solid rgba(37,99,235,0.8)";
  preview.style.background = "#020617";
  preview.style.fontSize = "0.82rem";
  preview.style.fontWeight = "600";
  preview.style.textAlign = "center";

  body.appendChild(preview);

  function updatePreview() {
    if (!state.name.trim()) {
      preview.textContent = "Enter a preset name to begin.";
      return;
    }
    if (!state.lineType) {
      preview.textContent = 'Preset: "' + state.name + '" – select a build type to open its editor.';
      return;
    }
    preview.textContent = 'Preset: "' + state.name + '"   •   Type: ' + state.lineType;
  }

  function updateTypeButtons() {
    const hasName = !!state.name.trim();
    for (let i = 0; i < typeButtons.length; i++) {
      const tb = typeButtons[i];
      tb.btn.disabled = !hasName;
      if (state.lineType === tb.id) {
        tb.btn.style.borderColor = "#22c55e";
        tb.btn.style.background = "#022c22";
      } else {
        tb.btn.style.borderColor = "rgba(55,65,81,0.9)";
        tb.btn.style.background = "rgba(15,23,42,0.8)";
      }
    }
  }

  function setLineType(type, openPopup) {
    state.lineType = type;
    updateTypeButtons();
    updatePreview();

    if (openPopup) {
      if (type === "standard") {
        openStandardLinePopup({
          dept: dept,
          initial: state.configs.standard || null,
          onSave: function(cfg) { state.configs.standard = cfg; updatePreview(); }
        });
      } else if (type === "master") {
        openMasterStreamPopup({
          dept: dept,
          initial: state.configs.master || null,
          onSave: function(cfg) { state.configs.master = cfg; updatePreview(); }
        });
      } else if (type === "standpipe") {
        openStandpipePopup({
          dept: dept,
          initial: state.configs.standpipe || null,
          onSave: function(cfg) { state.configs.standpipe = cfg; updatePreview(); }
        });
      } else if (type === "sprinkler") {
        openSprinklerPopup({
          dept: dept,
          initial: state.configs.sprinkler || null,
          onSave: function(cfg) { state.configs.sprinkler = cfg; updatePreview(); }
        });
      } else if (type === "foam") {
        openFoamPopup({
          dept: dept,
          initial: state.configs.foam || null,
          onSave: function(cfg) { state.configs.foam = cfg; updatePreview(); }
        });
      } else if (type === "supply") {
        openSupplyLinePopup({
          dept: dept,
          initial: state.configs.supply || null,
          onSave: function(cfg) { state.configs.supply = cfg; updatePreview(); }
        });
      } else if (type === "custom") {
        openCustomBuilderPopup({
          dept: dept,
          initial: state.configs.custom || null,
          onSave: function(cfg) { state.configs.custom = cfg; updatePreview(); }
        });
      }
    }
  }

  updateTypeButtons();
  updatePreview();

  saveBtn.addEventListener("click", function(e) {
    e.preventDefault();
    if (!state.name.trim()) {
      alert("Please enter a preset name before saving.");
      return;
    }
    if (!state.lineType) {
      alert("Please choose a build type before saving.");
      return;
    }
    const result = {
      name: state.name,
      lineType: state.lineType,
      configs: state.configs
    };
    onSave(result);
    close(false);
  });
}

// Optional render function; just calls popup for now
export function renderPresetEditor(mountEl, options) {
  openPresetEditorPopup(options || {});
}
