// view.presetEditor.js
// Simple preset line editor popup wired to dedicated line builder popups.

import { openMasterStreamPopup }   from "./view.lineMaster.js";
import { openStandpipePopup }      from "./view.lineStandpipe.js";
import { openFoamPopup }           from "./view.lineFoam.js";
import { openSprinklerPopup }      from "./view.lineSprinkler.js";
import { openStandardLinePopup }   from "./view.lineStandard.js";
import { openSupplyLinePopup }     from "./view.lineSupply.js";
import { openCustomBuilderPopup }  from "./view.lineCustom.js";

function cloneConfig(obj) {
  if (!obj || typeof obj !== "object") return obj;
  try {
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch (e) {}
  return JSON.parse(JSON.stringify(obj));
}

export function openPresetEditorPopup(options) {
  options = options || {};
  var dept     = options.dept || {};
  var initial  = options.initialPreset || null;
  var onSave   = typeof options.onSave === "function" ? options.onSave : function() {};
  var onCancel = typeof options.onCancel === "function" ? options.onCancel : function() {};

  var state = {
    name: "",
    lineType: "",
    standardConfig: null,
    masterConfig: null,
    standpipeConfig: null,
    sprinklerConfig: null,
    foamConfig: null,
    supplyConfig: null,
    customConfig: null
  };

  if (initial && typeof initial === "object") {
    if (initial.name) state.name = initial.name;
    if (initial.lineType) state.lineType = initial.lineType;
    if (initial.standardConfig) state.standardConfig = cloneConfig(initial.standardConfig);
    if (initial.masterConfig) state.masterConfig = cloneConfig(initial.masterConfig);
    if (initial.standpipeConfig) state.standpipeConfig = cloneConfig(initial.standpipeConfig);
    if (initial.sprinklerConfig) state.sprinklerConfig = cloneConfig(initial.sprinklerConfig);
    if (initial.foamConfig) state.foamConfig = cloneConfig(initial.foamConfig);
    if (initial.supplyConfig) state.supplyConfig = cloneConfig(initial.supplyConfig);
    if (initial.customConfig) state.customConfig = cloneConfig(initial.customConfig);
  }

  // --- overlay + panel ---

  var overlay = document.createElement("div");
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

  var panel = document.createElement("div");
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

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function close(cancelled) {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (cancelled) onCancel();
  }

  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) close(true);
  });

  // --- header ---

  var header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.marginBottom = "6px";
  header.style.borderBottom = "1px solid rgba(148,163,184,0.25)";
  header.style.paddingBottom = "4px";

  var title = document.createElement("div");
  title.textContent = "Preset line editor";
  title.style.fontSize = "0.95rem";
  title.style.fontWeight = "600";

  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "✕";
  styleCircleButton(closeBtn);
  closeBtn.addEventListener("click", function() { close(true); });

  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // --- body & footer ---

  var body = document.createElement("div");
  body.style.maxHeight = "60vh";
  body.style.overflowY = "auto";
  body.style.fontSize = "0.85rem";
  panel.appendChild(body);

  var footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.justifyContent = "flex-end";
  footer.style.gap = "6px";
  footer.style.marginTop = "8px";
  footer.style.borderTop = "1px solid rgba(148,163,184,0.25)";
  footer.style.paddingTop = "6px";
  panel.appendChild(footer);

  var cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  styleSecondaryButton(cancelBtn);
  cancelBtn.addEventListener("click", function() { close(true); });

  var saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save preset";
  stylePrimaryButton(saveBtn);

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  // --- content layout ---

  var container = document.createElement("div");

  // name row
  var nameRow = document.createElement("div");
  nameRow.style.display = "flex";
  nameRow.style.flexDirection = "column";
  nameRow.style.gap = "4px";
  nameRow.style.marginTop = "4px";

  var nameLabel = document.createElement("label");
  nameLabel.textContent = "Preset name:";
  nameLabel.style.fontSize = "0.82rem";
  nameLabel.style.fontWeight = "500";

  var nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = state.name;
  styleTextInput(nameInput);
  nameInput.placeholder = 'Example: 1¾" attack 200\' 150 gpm';

  nameInput.addEventListener("input", function() {
    state.name = nameInput.value || "";
    updateTypeButtons();
    updatePreview();
  });

  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);
  container.appendChild(nameRow);

  // type buttons title
  var typeTitle = document.createElement("div");
  typeTitle.textContent = "Choose build type";
  typeTitle.style.marginTop = "10px";
  typeTitle.style.fontSize = "0.82rem";
  typeTitle.style.textTransform = "uppercase";
  typeTitle.style.letterSpacing = "0.06em";
  typeTitle.style.color = "#bfdbfe";
  container.appendChild(typeTitle);

  var typeGrid = document.createElement("div");
  typeGrid.style.display = "flex";
  typeGrid.style.flexWrap = "wrap";
  typeGrid.style.gap = "6px";
  typeGrid.style.marginTop = "6px";
  container.appendChild(typeGrid);

  var typeHint = document.createElement("div");
  typeHint.textContent = "Enter a preset name first, then tap a type to open its builder. Tap again later to reopen and edit.";
  typeHint.style.fontSize = "0.75rem";
  typeHint.style.opacity = "0.8";
  typeHint.style.marginTop = "4px";
  container.appendChild(typeHint);

  // preview bar
  var preview = document.createElement("div");
  preview.style.marginTop = "8px";
  preview.style.padding = "8px";
  preview.style.borderRadius = "10px";
  preview.style.border = "1px solid rgba(37,99,235,0.8)";
  preview.style.background = "#020617";
  preview.style.fontSize = "0.82rem";
  preview.style.fontWeight = "600";
  preview.style.textAlign = "center";
  container.appendChild(preview);

  body.appendChild(container);

  // --- type buttons + behavior ---

  var typeButtons = [];

  function makeTypeButton(id, label, sublabel) {
    var btn = document.createElement("button");
    btn.type = "button";
    styleTypeButton(btn);

    var titleSpan = document.createElement("div");
    titleSpan.textContent = label;
    titleSpan.style.fontSize = "0.8rem";
    titleSpan.style.fontWeight = "600";

    var subSpan = document.createElement("div");
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
    var hasName = !!state.name.trim();
    for (var i = 0; i < typeButtons.length; i++) {
      var tb = typeButtons[i];
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
      dept: { hoses: dept.hoses || [], nozzles: dept.nozzles || [] },
      initial: state.standardConfig,
      onSave: function(cfg) {
        state.standardConfig = cfg;
        updatePreview();
      }
    });
  }

  function openMasterConfig() {
    openMasterStreamPopup({
      dept: { hoses: dept.hoses || [], appliances: dept.accessories || [] },
      initial: state.masterConfig,
      onSave: function(cfg) {
        state.masterConfig = cfg;
        updatePreview();
      }
    });
  }

  function openStandpipeConfig() {
    openStandpipePopup({
      dept: { hoses: dept.hoses || [], nozzles: dept.nozzles || [] },
      initial: state.standpipeConfig,
      onSave: function(cfg) {
        state.standpipeConfig = cfg;
        updatePreview();
      }
    });
  }

  function openSprinklerConfig() {
    openSprinklerPopup({
      dept: { hoses: dept.hoses || [] },
      initial: state.sprinklerConfig,
      onSave: function(cfg) {
        state.sprinklerConfig = cfg;
        updatePreview();
      }
    });
  }

  function openFoamConfig() {
    openFoamPopup({
      dept: { nozzles: dept.nozzles || [] },
      initial: state.foamConfig,
      onSave: function(cfg) {
        state.foamConfig = cfg;
        updatePreview();
      }
    });
  }

  function openSupplyConfig() {
    openSupplyLinePopup({
      dept: { hoses: dept.hoses || [] },
      initial: state.supplyConfig,
      onSave: function(cfg) {
        state.supplyConfig = cfg;
        updatePreview();
      }
    });
  }

  function openCustomConfig() {
    openCustomBuilderPopup({
      dept: { hoses: dept.hoses || [], appliances: dept.accessories || [] },
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

  // initialise preview and type buttons
  updateTypeButtons();
  updatePreview();

  // Save handler
  saveBtn.addEventListener("click", function(e) {
    e.preventDefault();
    if (!state.name.trim()) {
      alert("Please enter a preset name before saving.");
      return;
    }
    if (!state.lineType) {
      alert("Please choose a build type and configure it before saving.");
      return;
    }
    var payload = cloneConfig(state);
    onSave(payload);
    close(false);
  });
}

// Export a no-op render function to satisfy any imports that expect it
export function renderPresetEditor(mountEl, options) {
  openPresetEditorPopup(options || {});
}

// --- style helpers ---

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

function styleTypeButton(btn) {
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

function styleCircleButton(btn) {
  btn.style.width = "26px";
  btn.style.height = "26px";
  btn.style.borderRadius = "999px";
  btn.style.border = "1px solid rgba(148,163,184,0.6)";
  btn.style.background = "#020617";
  btn.style.color = "#e5e7eb";
  btn.style.cursor = "pointer";
}
