// view.presetEditor.js
// Simple preset editor popup wired to the dedicated line builders.
//
// Types:
//  - standard  -> openStandardLinePopup
//  - master    -> openMasterStreamPopup
//  - standpipe -> openStandpipePopup
//  - sprinkler -> openSprinklerPopup
//  - foam      -> openFoamPopup
//  - supply    -> openSupplyLinePopup
//  - custom    -> openCustomBuilderPopup
//
// Name is required before type buttons are enabled.

import { openMasterStreamPopup }   from "./view.lineMaster.js";
import { openStandpipePopup }      from "./view.lineStandpipe.js";
import { openFoamPopup }           from "./view.lineFoam.js";
import { openSprinklerPopup }      from "./view.lineSprinkler.js";
import { openStandardLinePopup }   from "./view.lineStandard.js";
import { openSupplyLinePopup }     from "./view.lineSupply.js";
import { openCustomBuilderPopup }  from "./view.lineCustom.js";

function clonePreset(obj) {
  if (!obj || typeof obj !== "object") return obj;
  try {
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch (e) {}
  return JSON.parse(JSON.stringify(obj));
}

// ---------- Public: open as popup ----------

export function openPresetEditorPopup(options) {
  options = options || {};
  const dept         = options.dept || {};
  const initial      = options.initialPreset || null;
  const onSave       = typeof options.onSave === "function" ? options.onSave : function() {};
  const onCancel     = typeof options.onCancel === "function" ? options.onCancel : function() {};

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
  styleSecondaryButton(cancelBtn);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save preset";
  stylePrimaryButton(saveBtn);

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function close(cancelled) {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (cancelled) onCancel();
  }

  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) {
      close(true);
    }
  });
  closeBtn.addEventListener("click", function() { close(true); });
  cancelBtn.addEventListener("click", function() { close(true); });

  renderPresetEditor(body, {
    dept: dept,
    initialPreset: initial,
    onSave: function(presetConfig) {
      onSave(presetConfig);
      close(false);
    },
    saveButton: saveBtn
  });
}

// ---------- Core renderer (used by popup) ----------

export function renderPresetEditor(mountEl, options) {
  options = options || {};
  const dept         = options.dept || {};
  const initial      = options.initialPreset || null;
  const onSave       = typeof options.onSave === "function" ? options.onSave : function() {};
  const saveButton   = options.saveButton || null;

  const hoses      = dept.hoses      || [];
  const nozzles    = dept.nozzles    || [];
  const appliances = dept.appliances || [];

  const defaults = {
    name: "",
    lineType: "",
    standardConfig:   null,
    masterConfig:     null,
    standpipeConfig:  null,
    sprinklerConfig:  null,
    foamConfig:       null,
    supplyConfig:     null,
    customConfig:     null
  };

  const state = clonePreset(defaults);
  if (initial && typeof initial === "object") {
    Object.assign(state, initial);
  }

  function makeRow(labelText, inputEl) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.flexDirection = "column";
    row.style.gap = "4px";
    row.style.marginTop = "8px";

    const label = document.createElement("label");
    label.textContent = labelText;
    label.style.fontSize = "0.82rem";
    label.style.fontWeight = "500";

    row.appendChild(label);
    row.appendChild(inputEl);
    return row;
  }

  const container = document.createElement("div");

  // --- Name row (required) ---

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = state.name || "";
  nameInput.placeholder = 'Example: 1¾" attack 200\' 150 gpm';
  styleTextInput(nameInput);

  nameInput.addEventListener("input", function() {
    state.name = nameInput.value || "";
    updateTypeButtons();
    updatePreview();
  });

  const nameRow = makeRow("Preset name:", nameInput);

  // --- Type buttons ---

  const typeButtons = [];

  function makeTypeButton(id, label, sublabel) {
    const btn = document.createElement("button");
    btn.type = "button";
    styleTypeBtn(btn);
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
    return btn;
  }

  const typeGrid = document.createElement("div");
  typeGrid.style.display = "flex";
  typeGrid.style.flexWrap = "wrap";
  typeGrid.style.gap = "6px";
  typeGrid.style.marginTop = "6px";

  typeGrid.appendChild(makeTypeButton("standard",  "Standard line",  "Attack line (wye optional)"));
  typeGrid.appendChild(makeTypeButton("master",    "Master stream",  "Deck gun or portable base"));
  typeGrid.appendChild(makeTypeButton("standpipe", "Standpipe",      "High-rise / FDC standpipe"));
  typeGrid.appendChild(makeTypeButton("sprinkler", "Sprinkler",      "Sprinkler / FDC supply"));
  typeGrid.appendChild(makeTypeButton("foam",      "Foam line",      "Foam eductor / foam setup"));
  typeGrid.appendChild(makeTypeButton("supply",    "Supply line",    "Hydrant / relay / feed line"));
  typeGrid.appendChild(makeTypeButton("custom",    "Custom builder", "Any layout: wyes, siamese, etc."));

  const typeTitle = document.createElement("div");
  typeTitle.textContent = "Choose build type";
  typeTitle.style.marginTop = "10px";
  typeTitle.style.fontSize = "0.82rem";
  typeTitle.style.textTransform = "uppercase";
  typeTitle.style.letterSpacing = "0.06em";
  typeTitle.style.color = "#bfdbfe";

  const typeHint = document.createElement("div");
  typeHint.textContent = "Enter a preset name first, then tap a type to open its builder. Tap again later to reopen and edit.";
  typeHint.style.fontSize = "0.75rem";
  typeHint.style.opacity = "0.8";
  typeHint.style.marginTop = "4px";

  // --- Preview ---

  const preview = document.createElement("div");
  preview.style.marginTop = "8px";
  preview.style.padding = "8px";
  preview.style.borderRadius = "10px";
  preview.style.border = "1px solid rgba(37,99,235,0.8)";
  preview.style.background = "#020617";
  preview.style.fontSize = "0.82rem";
  preview.style.fontWeight = "600";
  preview.style.textAlign = "center";

  function updatePreview() {
    if (!state.name.trim()) {
      preview.textContent = "Enter a preset name to begin.";
      return;
    }
    if (!state.lineType) {
      preview.textContent = 'Preset: "' + state.name + '" – select a build type to open its editor.';
      return;
    }
    preview.textContent = 'Preset: "' + state.name + '"   •   Type: ' + state.lineType + " (tap type to reopen editor)";
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

  function openStandardConfig() {
    openStandardLinePopup({
      dept: { hoses: hoses, nozzles: nozzles },
      initial: state.standardConfig,
      onSave: function(cfg) {
        state.standardConfig = cfg;
        updatePreview();
      }
    });
  }

  function openMasterConfig() {
    openMasterStreamPopup({
      dept: { hoses: hoses, appliances: appliances },
      initial: state.masterConfig,
      onSave: function(cfg) {
        state.masterConfig = cfg;
        updatePreview();
      }
    });
  }

  function openStandpipeConfig() {
    openStandpipePopup({
      dept: { hoses: hoses, nozzles: nozzles },
      initial: state.standpipeConfig,
      onSave: function(cfg) {
        state.standpipeConfig = cfg;
        updatePreview();
      }
    });
  }

  function openSprinklerConfig() {
    openSprinklerPopup({
      dept: { hoses: hoses },
      initial: state.sprinklerConfig,
      onSave: function(cfg) {
        state.sprinklerConfig = cfg;
        updatePreview();
      }
    });
  }

  function openFoamConfig() {
    openFoamPopup({
      dept: { nozzles: nozzles },
      initial: state.foamConfig,
      onSave: function(cfg) {
        state.foamConfig = cfg;
        updatePreview();
      }
    });
  }

  function openSupplyConfig() {
    openSupplyLinePopup({
      dept: { hoses: hoses },
      initial: state.supplyConfig,
      onSave: function(cfg) {
        state.supplyConfig = cfg;
        updatePreview();
      }
    });
  }

  function openCustomConfig() {
    openCustomBuilderPopup({
      dept: { hoses: hoses, appliances: appliances },
      initial: state.customConfig,
      onSave: function(cfg) {
        state.customConfig = cfg;
        updatePreview();
      }
    });
  }

  function setLineType(type, openPopup) {
    state.lineType = type;
    updateTypeButtons();
    if (openPopup) {
      if (type === "standard")  openStandardConfig();
      else if (type === "master")    openMasterConfig();
      else if (type === "standpipe") openStandpipeConfig();
      else if (type === "sprinkler") openSprinklerConfig();
      else if (type === "foam")      openFoamConfig();
      else if (type === "supply")    openSupplyConfig();
      else if (type === "custom")    openCustomConfig();
    }
    updatePreview();
  }

  container.appendChild(nameRow);
  container.appendChild(typeTitle);
  container.appendChild(typeGrid);
  container.appendChild(typeHint);
  container.appendChild(preview);

  mountEl.innerHTML = "";
  mountEl.appendChild(container);

  updateTypeButtons();
  updatePreview();

  if (saveButton) {
    saveButton.onclick = function(e) {
      e.preventDefault();
      if (!state.name.trim()) {
        alert("Please enter a preset name before saving.");
        return;
      }
      if (!state.lineType) {
        alert("Please choose a build type and configure it before saving.");
        return;
      }
      onSave(clonePreset(state));
    };
  }
}

// ---------- tiny style helpers ----------

function styleTextInput(input) {
  input.style.padding = "6px 8px";
  input.style.borderRadius = "8px";
  input.style.border = "1px solid rgba(55,65,81,0.9)";
  input.style.background = "#020617";
  input.style.color = "#e5e7eb";
  input.style.fontSize = "0.8rem";
  input.style.boxSizing = "border-box";
  input.style.width = "100%";
}

function styleTypeBtn(btn) {
  btn.style.flex = "1 1 45%";
  btn.style.minWidth = "120px";
  btn.style.padding = "6px 8px";
  btn.style.borderRadius = "10px";
  btn.style.border = "1px solid rgba(55,65,81,0.9)";
  btn.style.background = "rgba(15,23,42,0.8)";
  btn.style.color = "#e5e7eb";
  btn.style.textAlign = "left";
  btn.style.cursor = "pointer";
}

function stylePrimaryButton(btn) {
  btn.style.borderRadius = "999px";
  btn.style.padding = "6px 12px";
  btn.style.fontSize = "0.82rem";
  btn.style.border = "none";
  btn.style.cursor = "pointer";
  btn.style.background = "#22c55e";
  btn.style.color = "#020617";
  btn.style.fontWeight = "600";
}

function styleSecondaryButton(btn) {
  btn.style.borderRadius = "999px";
  btn.style.padding = "6px 12px";
  btn.style.fontSize = "0.82rem";
  btn.style.border = "1px solid rgba(148,163,184,0.7)";
  btn.style.cursor = "pointer";
  btn.style.background = "#020617";
  btn.style.color = "#e5e7eb";
}
