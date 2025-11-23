// view.lineStandard.js
// Standard attack line popup (with optional wye).
// Minimal, safe version that lets the user define a standard line preset
// and manually set target GPM / PDP (no auto friction-loss math yet).

export function openStandardLinePopup(options) {
  options = options || {};
  const dept   = options.dept || {};
  const onSave = typeof options.onSave === "function" ? options.onSave : () => {};
  const initial = options.initial || null;

  const state = {
    mode: (initial && initial.mode) || "single", // "single" or "wye"
    single: {
      hoseSize:   (initial && initial.single && initial.single.hoseSize)   || "1 3/4\"",
      lengthFt:   (initial && initial.single && initial.single.lengthFt)   || 200,
      elevationFt:(initial && initial.single && initial.single.elevationFt)|| 0,
    },
    wye: {
      engineHoseSize: (initial && initial.wye && initial.wye.engineHoseSize) || "2 1/2\"",
      engineLengthFt: (initial && initial.wye && initial.wye.engineLengthFt) || 100,
      branchA: {
        hoseSize: (initial && initial.wye && initial.wye.branchA && initial.wye.branchA.hoseSize) || "1 3/4\"",
        lengthFt: (initial && initial.wye && initial.wye.branchA && initial.wye.branchA.lengthFt) || 150,
      },
      branchB: {
        hoseSize: (initial && initial.wye && initial.wye.branchB && initial.wye.branchB.hoseSize) || "1 3/4\"",
        lengthFt: (initial && initial.wye && initial.wye.branchB && initial.wye.branchB.lengthFt) || 150,
      },
    },
    targetGpm: (initial && initial.targetGpm) || 150,
    targetPdp: (initial && initial.targetPdp) || 150,
  };

  // ===== Overlay & panel =====
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.55)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "flex-start";
  overlay.style.justifyContent = "center";
  overlay.style.paddingTop = "40px";
  overlay.style.zIndex = "9999";

  const panel = document.createElement("div");
  panel.style.maxWidth = "520px";
  panel.style.width = "100%";
  panel.style.background = "#020617";
  panel.style.color = "#e5e7eb";
  panel.style.borderRadius = "16px";
  panel.style.boxShadow = "0 18px 30px rgba(15,23,42,0.75)";
  panel.style.border = "1px solid rgba(148,163,184,0.35)";
  panel.style.padding = "12px 14px 10px";
  panel.style.fontFamily =
    'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
  panel.style.boxSizing = "border-box";

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  // ===== Header =====
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.marginBottom = "6px";
  header.style.borderBottom = "1px solid rgba(148,163,184,0.25)";
  header.style.paddingBottom = "4px";

  const title = document.createElement("div");
  title.textContent = "Standard line setup";
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
  closeBtn.addEventListener("click", () => close());

  header.appendChild(title);
  header.appendChild(closeBtn);

  // ===== Body =====
  const body = document.createElement("div");
  body.style.maxHeight = "60vh";
  body.style.overflowY = "auto";
  body.style.fontSize = "0.85rem";

  // Mode toggle
  const modeRow = document.createElement("div");
  modeRow.style.display = "flex";
  modeRow.style.gap = "8px";
  modeRow.style.marginTop = "4px";

  const singleBtn = document.createElement("button");
  singleBtn.type = "button";
  singleBtn.textContent = "Single line";
  const wyeBtn = document.createElement("button");
  wyeBtn.type = "button";
  wyeBtn.textContent = "Line with wye";

  [singleBtn, wyeBtn].forEach((b) => {
    b.style.flex = "1 1 0";
    b.style.padding = "6px 8px";
    b.style.borderRadius = "999px";
    b.style.border = "1px solid rgba(55,65,81,0.9)";
    b.style.background = "rgba(15,23,42,0.9)";
    b.style.color = "#e5e7eb";
    b.style.cursor = "pointer";
    b.style.fontSize = "0.82rem";
  });

  function updateModeButtons() {
    if (state.mode === "single") {
      singleBtn.style.background = "#022c22";
      singleBtn.style.borderColor = "#22c55e";
      wyeBtn.style.background = "rgba(15,23,42,0.9)";
      wyeBtn.style.borderColor = "rgba(55,65,81,0.9)";
    } else {
      wyeBtn.style.background = "#022c22";
      wyeBtn.style.borderColor = "#22c55e";
      singleBtn.style.background = "rgba(15,23,42,0.9)";
      singleBtn.style.borderColor = "rgba(55,65,81,0.9)";
    }
    renderSections();
  }

  singleBtn.addEventListener("click", () => {
    state.mode = "single";
    updateModeButtons();
  });

  wyeBtn.addEventListener("click", () => {
    state.mode = "wye";
    updateModeButtons();
  });

  modeRow.appendChild(singleBtn);
  modeRow.appendChild(wyeBtn);

  // Containers for sections
  const sectionsContainer = document.createElement("div");
  sectionsContainer.style.marginTop = "8px";
  sectionsContainer.style.display = "flex";
  sectionsContainer.style.flexDirection = "column";
  sectionsContainer.style.gap = "8px";

  // Helpers to build small labeled rows
  function makeLabeledInput(labelText, type, value, onChange) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "4px";
    row.style.marginBottom = "4px";

    const label = document.createElement("label");
    label.textContent = labelText;
    label.style.fontSize = "0.8rem";
    label.style.flex = "0 0 55%";

    const input = document.createElement("input");
    input.type = type;
    input.value = value;
    input.style.flex = "1 1 0";
    input.style.padding = "4px 6px";
    input.style.borderRadius = "8px";
    input.style.border = "1px solid rgba(55,65,81,0.9)";
    input.style.background = "#020617";
    input.style.color = "#e5e7eb";
    input.style.fontSize = "0.8rem";

    input.addEventListener("input", () => {
      onChange(input.value);
      updatePreview();
    });

    row.appendChild(label);
    row.appendChild(input);
    return row;
  }

  function makeSection(titleText) {
    const box = document.createElement("div");
    box.style.border = "1px solid rgba(30,64,175,0.5)";
    box.style.borderRadius = "12px";
    box.style.padding = "6px 8px";
    box.style.background = "rgba(15,23,42,0.85)";

    const h = document.createElement("div");
    h.textContent = titleText;
    h.style.fontSize = "0.78rem";
    h.style.fontWeight = "600";
    h.style.textTransform = "uppercase";
    h.style.letterSpacing = "0.06em";
    h.style.marginBottom = "4px";
    h.style.color = "#bfdbfe";

    box.appendChild(h);
    return { box, h };
  }

  function renderSections() {
    sectionsContainer.innerHTML = "";

    if (state.mode === "single") {
      const { box } = makeSection("Single attack line");
      box.appendChild(
        makeLabeledInput(
          'Hose size (ex: 1 3/4")',
          "text",
          state.single.hoseSize,
          (v) => (state.single.hoseSize = v)
        )
      );
      box.appendChild(
        makeLabeledInput(
          "Line length (ft)",
          "number",
          state.single.lengthFt,
          (v) => (state.single.lengthFt = Number(v) || 0)
        )
      );
      box.appendChild(
        makeLabeledInput(
          "Elevation (+/- ft)",
          "number",
          state.single.elevationFt,
          (v) => (state.single.elevationFt = Number(v) || 0)
        )
      );
      sectionsContainer.appendChild(box);
    } else {
      const { box: engineBox } = makeSection("Engine to wye");
      engineBox.appendChild(
        makeLabeledInput(
          'Engine hose size (ex: 2 1/2")',
          "text",
          state.wye.engineHoseSize,
          (v) => (state.wye.engineHoseSize = v)
        )
      );
      engineBox.appendChild(
        makeLabeledInput(
          "Engine line length (ft)",
          "number",
          state.wye.engineLengthFt,
          (v) => (state.wye.engineLengthFt = Number(v) || 0)
        )
      );
      sectionsContainer.appendChild(engineBox);

      const { box: aBox } = makeSection("Branch A");
      aBox.appendChild(
        makeLabeledInput(
          'Hose size (ex: 1 3/4")',
          "text",
          state.wye.branchA.hoseSize,
          (v) => (state.wye.branchA.hoseSize = v)
        )
      );
      aBox.appendChild(
        makeLabeledInput(
          "Length (ft)",
          "number",
          state.wye.branchA.lengthFt,
          (v) => (state.wye.branchA.lengthFt = Number(v) || 0)
        )
      );
      sectionsContainer.appendChild(aBox);

      const { box: bBox } = makeSection("Branch B");
      bBox.appendChild(
        makeLabeledInput(
          'Hose size (ex: 1 3/4")',
          "text",
          state.wye.branchB.hoseSize,
          (v) => (state.wye.branchB.hoseSize = v)
        )
      );
      bBox.appendChild(
        makeLabeledInput(
          "Length (ft)",
          "number",
          state.wye.branchB.lengthFt,
          (v) => (state.wye.branchB.lengthFt = Number(v) || 0)
        )
      );
      sectionsContainer.appendChild(bBox);
    }
  }

  // Target GPM / PDP section
  const numbersSection = document.createElement("div");
  numbersSection.style.marginTop = "8px";
  numbersSection.style.border = "1px solid rgba(34,197,94,0.6)";
  numbersSection.style.borderRadius = "12px";
  numbersSection.style.padding = "6px 8px";
  numbersSection.style.background = "rgba(6,78,59,0.5)";

  const numbersTitle = document.createElement("div");
  numbersTitle.textContent = "Target GPM & PDP (manual)";
  numbersTitle.style.fontSize = "0.78rem";
  numbersTitle.style.fontWeight = "600";
  numbersTitle.style.textTransform = "uppercase";
  numbersTitle.style.letterSpacing = "0.06em";
  numbersTitle.style.marginBottom = "4px";
  numbersTitle.style.color = "#bbf7d0";

  const numbersRow = document.createElement("div");
  numbersRow.style.display = "flex";
  numbersRow.style.gap = "8px";

  const gpmInput = document.createElement("input");
  gpmInput.type = "number";
  gpmInput.value = state.targetGpm;
  gpmInput.style.flex = "1 1 0";
  gpmInput.style.padding = "4px 6px";
  gpmInput.style.borderRadius = "8px";
  gpmInput.style.border = "1px solid rgba(55,65,81,0.9)";
  gpmInput.style.background = "#020617";
  gpmInput.style.color = "#e5e7eb";
  gpmInput.style.fontSize = "0.8rem";
  gpmInput.placeholder = "Target GPM";

  gpmInput.addEventListener("input", () => {
    state.targetGpm = Number(gpmInput.value) || 0;
    updatePreview();
  });

  const pdpInput = document.createElement("input");
  pdpInput.type = "number";
  pdpInput.value = state.targetPdp;
  pdpInput.style.flex = "1 1 0";
  pdpInput.style.padding = "4px 6px";
  pdpInput.style.borderRadius = "8px";
  pdpInput.style.border = "1px solid rgba(55,65,81,0.9)";
  pdpInput.style.background = "#020617";
  pdpInput.style.color = "#e5e7eb";
  pdpInput.style.fontSize = "0.8rem";
  pdpInput.placeholder = "Target PDP";

  pdpInput.addEventListener("input", () => {
    state.targetPdp = Number(pdpInput.value) || 0;
    updatePreview();
  });

  numbersRow.appendChild(gpmInput);
  numbersRow.appendChild(pdpInput);

  const numbersHint = document.createElement("div");
  numbersHint.textContent =
    "Use these as the GPM and PDP you want for this line. Full auto math can plug in later.";
  numbersHint.style.fontSize = "0.75rem";
  numbersHint.style.marginTop = "4px";
  numbersHint.style.opacity = "0.85";

  numbersSection.appendChild(numbersTitle);
  numbersSection.appendChild(numbersRow);
  numbersSection.appendChild(numbersHint);

  // Preview
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
    const modeText = state.mode === "single" ? "Single line" : "Line with wye";
    preview.textContent =
      `${modeText} • Target GPM: ${state.targetGpm || 0} • Target PDP: ${state.targetPdp || 0} psi`;
  }

  // ===== Footer =====
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
  cancelBtn.style.background = "#020617";
  cancelBtn.style.color = "#e5e7eb";
  cancelBtn.style.cursor = "pointer";
  cancelBtn.addEventListener("click", () => close());

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save standard line";
  saveBtn.style.borderRadius = "999px";
  saveBtn.style.padding = "6px 12px";
  saveBtn.style.fontSize = "0.82rem";
  saveBtn.style.border = "none";
  saveBtn.style.background = "#22c55e";
  saveBtn.style.color = "#020617";
  saveBtn.style.fontWeight = "600";
  saveBtn.style.cursor = "pointer";

  saveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const payload = {
      type: "standard",
      mode: state.mode,
      single: { ...state.single },
      wye: {
        engineHoseSize: state.wye.engineHoseSize,
        engineLengthFt: state.wye.engineLengthFt,
        branchA: { ...state.wye.branchA },
        branchB: { ...state.wye.branchB },
      },
      targetGpm: state.targetGpm,
      targetPdp: state.targetPdp,
      lastCalc: {
        targetGpm: state.targetGpm,
        targetPdp: state.targetPdp,
      },
    };
    onSave(payload);
    close();
  });

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  // Assemble
  panel.appendChild(header);
  panel.appendChild(body);
  body.appendChild(modeRow);
  body.appendChild(sectionsContainer);
  body.appendChild(numbersSection);
  body.appendChild(preview);
  panel.appendChild(footer);

  updateModeButtons();
  updatePreview();
}
