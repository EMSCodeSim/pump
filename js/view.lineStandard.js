// view.lineStandard.js
// Standard attack line popup (with optional wye).
// Updated: uses dept-selected hose sizes + nozzles with dropdowns.
// GPM comes from nozzle; PDP is estimated from hose, length, GPM, and elevation.

export function openStandardLinePopup(options) {
  options = options || {};
  const dept    = options.dept || {};
  const onSave  = typeof options.onSave === "function" ? options.onSave : () => {};
  const initial = options.initial || null;

  // ---- Normalize hose + nozzle lists ----
  // Expect (but do not require) shapes like:
  // dept.nozzlesAll: [{ id, label, gpm, np }, ...]
  // dept.nozzlesSelected: [id, id, ...]
  // dept.hosesAll: [{ id, label, c }, ...]
  // dept.hosesSelected: [id, id, ...]
  //
  // If dept info is missing, we fall back to simple default lists.

  const DEFAULT_NOZZLES = [
    { id: "fog150_50", label: "Fog 150 gpm @ 50 psi", gpm: 150, np: 50 },
    { id: "fog185_50", label: "Fog 185 gpm @ 50 psi", gpm: 185, np: 50 },
    { id: "sb_15_16_50", label: "Smoothbore 15/16\" @ 50 psi", gpm: 185, np: 50 },
    { id: "sb_1_1_8_50", label: "Smoothbore 1 1/8\" @ 50 psi", gpm: 265, np: 50 }
  ];

  const DEFAULT_HOSES = [
    { id: "1.75", label: "1 3/4\"", c: 15.5 },
    { id: "2.5", label: "2 1/2\"", c: 2.0 },
    { id: "3", label: "3\"", c: 0.8 },
    { id: "5", label: "5\"", c: 0.08 }
  ];

  const allNozzlesRaw = Array.isArray(dept.nozzlesAll)
    ? dept.nozzlesAll
    : (Array.isArray(options.nozzleChoices) ? options.nozzleChoices : DEFAULT_NOZZLES);

  const selectedNozzleIds = Array.isArray(dept.nozzlesSelected) && dept.nozzlesSelected.length
    ? new Set(dept.nozzlesSelected)
    : null;

  const nozzleList = selectedNozzleIds
    ? allNozzlesRaw.filter(n => selectedNozzleIds.has(n.id))
    : allNozzlesRaw.slice();

  const allHosesRaw = Array.isArray(dept.hosesAll)
    ? dept.hosesAll
    : (Array.isArray(options.hoseChoices) ? options.hoseChoices : DEFAULT_HOSES);

  const selectedHoseIds = Array.isArray(dept.hosesSelected) && dept.hosesSelected.length
    ? new Set(dept.hosesSelected)
    : null;

  const hoseList = selectedHoseIds
    ? allHosesRaw.filter(h => selectedHoseIds.has(h.id))
    : allHosesRaw.slice();

  function findNozzleById(id) {
    return nozzleList.find(n => n.id === id) || null;
  }
  function findHoseById(id) {
    return hoseList.find(h => h.id === id) || null;
  }
  function defaultHoseCFromLabel(label) {
    if (!label) return 15.5;
    const text = String(label).toLowerCase();
    if (text.includes("1 3/4") || text.includes("1.75")) return 15.5;
    if (text.includes("2 1/2") || text.includes("2.5")) return 2.0;
    if (text.includes("3")) return 0.8;
    if (text.includes("5")) return 0.08;
    return 15.5;
  }

  // ---- Initial state ----
  const state = {
    mode: (initial && initial.mode) || "single", // "single" or "wye"
    single: {
      hoseId:     (initial && initial.single && initial.single.hoseId)     || (hoseList[0]?.id || "1.75"),
      hoseSize:   (initial && initial.single && initial.single.hoseSize)   || "1 3/4\"",
      lengthFt:   (initial && initial.single && initial.single.lengthFt)   || 200,
      elevationFt:(initial && initial.single && initial.single.elevationFt)|| 0,
      nozzleId:   (initial && initial.single && initial.single.nozzleId)   || (nozzleList[0]?.id || ""),
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
    // Manual targets are still used for wye mode or fallback
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
  title.textContent = "Standard attack line";
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
    updatePreview();
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

  // Helpers to build rows
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

  function makeSelectRow(labelText, list, selectedId, onChange) {
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

    const sel = document.createElement("select");
    sel.style.flex = "1 1 0";
    sel.style.padding = "4px 6px";
    sel.style.borderRadius = "8px";
    sel.style.border = "1px solid rgba(55,65,81,0.9)";
    sel.style.background = "#020617";
    sel.style.color = "#e5e7eb";
    sel.style.fontSize = "0.8rem";

    list.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = item.label || item.id;
      sel.appendChild(opt);
    });

    if (selectedId) sel.value = selectedId;

    sel.addEventListener("change", () => {
      onChange(sel.value);
      updatePreview();
    });

    row.appendChild(label);
    row.appendChild(sel);
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

      // Hose size dropdown (from dept hoses)
      box.appendChild(
        makeSelectRow(
          "Hose size",
          hoseList,
          state.single.hoseId,
          (id) => {
            state.single.hoseId = id;
            const hose = findHoseById(id);
            if (hose && hose.label) {
              state.single.hoseSize = hose.label;
            }
          }
        )
      );

      // Length
      box.appendChild(
        makeLabeledInput(
          "Line length (ft)",
          "number",
          state.single.lengthFt,
          (v) => (state.single.lengthFt = Number(v) || 0)
        )
      );

      // Elevation
      box.appendChild(
        makeLabeledInput(
          "Elevation (+/- ft)",
          "number",
          state.single.elevationFt,
          (v) => (state.single.elevationFt = Number(v) || 0)
        )
      );

      // Nozzle dropdown (from dept nozzles)
      box.appendChild(
        makeSelectRow(
          "Nozzle",
          nozzleList,
          state.single.nozzleId,
          (id) => {
            state.single.nozzleId = id;
            const noz = findNozzleById(id);
            if (noz && typeof noz.gpm === "number") {
              state.targetGpm = noz.gpm;
            }
          }
        )
      );

      sectionsContainer.appendChild(box);
    } else {
      // Keep existing wye structure simple / manual for now
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

  // ===== Calculated PP/GPM preview =====

  const preview = document.createElement("div");
  preview.style.marginTop = "8px";
  preview.style.padding = "8px";
  preview.style.borderRadius = "10px";
  preview.style.border = "1px solid rgba(37,99,235,0.8)";
  preview.style.background = "#020617";
  preview.style.fontSize = "0.82rem";
  preview.style.fontWeight = "600";
  preview.style.textAlign = "center";

  function calcSingleLine() {
    const noz = findNozzleById(state.single.nozzleId);
    const hose = findHoseById(state.single.hoseId);
    const gpm = noz && typeof noz.gpm === "number" ? noz.gpm : (state.targetGpm || 0);
    const np  = noz && typeof noz.np  === "number" ? noz.np  : (noz && noz.NP) || 50;
    const lengthFt = state.single.lengthFt || 0;
    const elevFt   = state.single.elevationFt || 0;
    const c = hose && typeof hose.c === "number"
      ? hose.c
      : defaultHoseCFromLabel(state.single.hoseSize);

    // Simple FL: C × (gpm/100)^2 × (length/100)
    const flPer100 = c * Math.pow(gpm / 100, 2);
    const fl       = flPer100 * (lengthFt / 100);
    const elevPsi  = elevFt * 0.434;  // approx 0.434 psi/ft

    const pdp = Math.round(np + fl + elevPsi);
    return { gpm: Math.round(gpm), pdp };
  }

  function updatePreview() {
    if (state.mode === "single") {
      const { gpm, pdp } = calcSingleLine();
      preview.textContent = `Single attack line • Flow: ${gpm} gpm • Estimated PDP: ${pdp} psi`;
    } else {
      // For now, wye keeps manual GPM/PDP values
      const tg = Math.round(state.targetGpm || 0);
      const tp = Math.round(state.targetPdp || 0);
      preview.textContent = `Line with wye • Target GPM: ${tg} • Target PDP: ${tp} psi (manual entry)`;
    }
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

    let finalGpm = state.targetGpm || 0;
    let finalPdp = state.targetPdp || 0;

    if (state.mode === "single") {
      const calc = calcSingleLine();
      finalGpm = calc.gpm;
      finalPdp = calc.pdp;
    }

    const payload = {
      type: "standard",
      mode: state.mode,
      single: {
        ...state.single
      },
      wye: {
        engineHoseSize: state.wye.engineHoseSize,
        engineLengthFt: state.wye.engineLengthFt,
        branchA: { ...state.wye.branchA },
        branchB: { ...state.wye.branchB },
      },
      targetGpm: finalGpm,
      targetPdp: finalPdp,
      lastCalc: {
        targetGpm: finalGpm,
        targetPdp: finalPdp,
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

  // Section for numbers / preview
  const numbersNote = document.createElement("div");
  numbersNote.style.fontSize = "0.75rem";
  numbersNote.style.marginTop = "6px";
  numbersNote.style.opacity = "0.85";
  numbersNote.textContent =
    "GPM is set by the nozzle selection. PDP is estimated using hose C, length, nozzle pressure, and elevation.";

  body.appendChild(numbersNote);
  body.appendChild(preview);
  panel.appendChild(footer);

  updateModeButtons();
  updatePreview();
}
