import { DEPT_UI_NOZZLES, DEPT_UI_HOSES, setDeptUiNozzles, setDeptUiHoses } from './store.js';

// view.lineStandard.js
// Standard attack line popup (with optional wye).
//
// This version:
// - Uses the SAME department nozzle logic as master stream.
// - Always builds from department setup (DEPT_UI_NOZZLES / dept.nozzlesAll)
//   before falling back to defaults.
// - If DEPT_UI_NOZZLES is an object map instead of an array, it uses Object.values.
// - Filters by dept.nozzlesSelected, matching by BOTH id and label text,
//   so fog vs smooth-bore will not get crossed.
// - Always includes "Closed (no flow)" at the top of the list.

export function openStandardLinePopup(options) {
  options = options || {};
  const dept    = options.dept || {};
  const onSave  = typeof options.onSave === "function" ? options.onSave : () => {};
  const initial = options.initial || null;

  // Sync department hose/nozzle lists into global store lists for reuse
  if (Array.isArray(dept.nozzlesAll) && dept.nozzlesAll.length) {
    setDeptUiNozzles(dept.nozzlesAll);
  }
  if (Array.isArray(dept.hosesAll) && dept.hosesAll.length) {
    setDeptUiHoses(dept.hosesAll);
  }

  // ---- Defaults & helpers for hoses / nozzles ----
  const DEFAULT_NOZZLES = [
    { id: "fog150_50",   label: "Fog 150 gpm @ 50 psi", gpm: 150, np: 50 },
    { id: "fog185_50",   label: "Fog 185 gpm @ 50 psi", gpm: 185, np: 50 },
    { id: "sb_15_16_50", label: "SB 15/16\" 185 gpm @ 50 psi", gpm: 185, np: 50 },
    { id: "sb_1_1_8_50", label: "SB 1 1/8\" 265 gpm @ 50 psi", gpm: 265, np: 50 }
  ];

  const DEFAULT_HOSES = [
    { id: "1.75", label: "1 3/4\"", c: 15.5 },
    { id: "2.5",  label: "2 1/2\"", c: 2.0 },
    { id: "3",    label: "3\"",     c: 0.8 },
    { id: "5",    label: "5\"",     c: 0.08 }
  ];

  function prettyStdNozzleLabel(label, gpm, np) {
    const text = String(label || "");
    // If it already looks like "185 gpm @ 50 psi", keep it.
    if (/gpm/i.test(text) && /psi/i.test(text)) {
      return text;
    }
    // If it looks like "... 150@50" or "Fog 150 @ 50", expand it.
    const m = text.match(/^(.*?)(\d+)\s*@\s*(\d+)\s*$/);
    if (m) {
      const name = m[1].trim();
      const g = gpm || Number(m[2]);
      const p = np  || Number(m[3]);
      return `${name} ${g} gpm @ ${p} psi`;
    }
    return text;
  }

  // ---- Build nozzle list (department-aware, using dept UI selections) ----
  function normalizeDeptNozzleSource() {
    // 1) Prefer DEPT_UI_NOZZLES from store
    if (DEPT_UI_NOZZLES) {
      if (Array.isArray(DEPT_UI_NOZZLES) && DEPT_UI_NOZZLES.length) {
        return DEPT_UI_NOZZLES;
      }
      if (typeof DEPT_UI_NOZZLES === "object") {
        const vals = Object.values(DEPT_UI_NOZZLES).filter(Boolean);
        if (vals.length) return vals;
      }
    }
    // 2) Then dept.nozzlesAll, if passed in
    if (Array.isArray(dept.nozzlesAll) && dept.nozzlesAll.length) {
      return dept.nozzlesAll;
    }
    // 3) Then any explicit choices from options
    if (Array.isArray(options.nozzleChoices) && options.nozzleChoices.length) {
      return options.nozzleChoices;
    }
    // 4) Finally, built-in defaults
    return DEFAULT_NOZZLES;
  }

  let allNozzlesRaw = normalizeDeptNozzleSource();

  if (!Array.isArray(allNozzlesRaw) || !allNozzlesRaw.length) {
    allNozzlesRaw = DEFAULT_NOZZLES.slice();
  }

  const selectedNozzleRaw = Array.isArray(dept.nozzlesSelected)
    ? dept.nozzlesSelected
    : [];

  const selectedNozzleIdSet =
    selectedNozzleRaw.length > 0
      ? new Set(selectedNozzleRaw.map(x => String(x)))
      : null;

  function mapStdNozzle(n, idx) {
    if (!n) return null;

    let id;
    let label;
    let gpm;
    let np;

    if (typeof n === "string" || typeof n === "number") {
      id = String(n);
      label = String(n);
    } else {
      id = n.id != null ? String(n.id) : String(n.value ?? n.name ?? idx);
      label = n.label || n.name || String(id);
      if (typeof n.gpm === "number") gpm = n.gpm;
      if (typeof n.flow === "number" && gpm == null) gpm = n.flow;
      if (typeof n.np === "number")  np  = n.np;
      if (typeof n.NP === "number" && np == null)  np  = n.NP;
      if (typeof n.pressure === "number" && np == null) np = n.pressure;
    }

    label = prettyStdNozzleLabel(label, gpm, np);

    // If gpm/np still missing, try to parse from the label
    if (gpm == null) {
      const m = label.match(/(\d+)\s*gpm/i) || label.match(/(\d+)\s*@/i);
      if (m) gpm = Number(m[1]);
    }
    if (np == null) {
      const m2 = label.match(/@\s*([^0-9]*)(\d+)\s*(psi)?/i);
      if (m2) np = Number(m2[2]);
    }

    return { id, label, gpm, np };
  }

  let mappedNozzles = allNozzlesRaw.map(mapStdNozzle).filter(Boolean);

  // If department has a selected list, filter against BOTH id and label
  if (selectedNozzleIdSet && selectedNozzleIdSet.size) {
    const filtered = mappedNozzles.filter(n => {
      if (!n) return false;
      const idStr = String(n.id);
      const labelStr = String(n.label || "");
      return selectedNozzleIdSet.has(idStr) || selectedNozzleIdSet.has(labelStr);
    });
    if (filtered.length) {
      mappedNozzles = filtered;
    }
  }

  // Always include a "Closed" nozzle option at the top
  const CLOSED_NOZZLE = { id: "closed", label: "Closed (no flow)", gpm: 0, np: 0 };
  const nozzleList = [CLOSED_NOZZLE, ...mappedNozzles];

  // ---- Build hose list (department-aware, robust) ----
  function normalizeDeptHoseSource() {
    if (DEPT_UI_HOSES) {
      if (Array.isArray(DEPT_UI_HOSES) && DEPT_UI_HOSES.length) {
        return DEPT_UI_HOSES;
      }
      if (typeof DEPT_UI_HOSES === "object") {
        const vals = Object.values(DEPT_UI_HOSES).filter(Boolean);
        if (vals.length) return vals;
      }
    }
    if (Array.isArray(dept.hosesAll) && dept.hosesAll.length) {
      return dept.hosesAll;
    }
    if (Array.isArray(options.hoseChoices) && options.hoseChoices.length) {
      return options.hoseChoices;
    }
    return DEFAULT_HOSES;
  }

  let allHosesRaw = normalizeDeptHoseSource();

  if (!Array.isArray(allHosesRaw) || !allHosesRaw.length) {
    allHosesRaw = DEFAULT_HOSES.slice();
  }

  const selectedHoseRaw = Array.isArray(dept.hosesSelected)
    ? dept.hosesSelected
    : [];

  const selectedHoseIdSet =
    selectedHoseRaw.length > 0
      ? new Set(selectedHoseRaw.map(x => String(x)))
      : null;

  let hoseList;
  if (selectedHoseIdSet && selectedHoseIdSet.size) {
    const filtered = allHosesRaw.filter(h => {
      if (!h) return false;
      const idStr = String(h.id);
      const labelStr = String(h.label || "");
      return selectedHoseIdSet.has(idStr) || selectedHoseIdSet.has(labelStr);
    });
    hoseList = filtered.length ? filtered : allHosesRaw.slice();
  } else {
    hoseList = allHosesRaw.slice();
  }

  function findNozzleById(id) {
    if (id === "closed" || !id) return CLOSED_NOZZLE;
    return nozzleList.find(n => String(n.id) === String(id)) || null;
  }

  function findHoseById(id) {
    return hoseList.find(h => String(h.id) === String(id)) || null;
  }

  function defaultHoseCFromLabel(label) {
    if (!label) return 15.5;
    const text = String(label).toLowerCase();
    if (text.includes("1 3/4") || text.includes("1.75")) return 15.5;
    if (text.includes("2 1/2") || text.includes("2.5"))  return 2.0;
    if (text.includes("3"))                             return 0.8;
    if (text.includes("5"))                             return 0.08;
    return 15.5;
  }

  // Approx psi per ft of elevation
  const PSI_PER_FT = 0.434;
  // Approx wye loss
  const WYE_LOSS_PSI = 10;

  // ---- Initial state ----
  const firstHose   = hoseList[0] || DEFAULT_HOSES[0];
  const secondHose  = hoseList[1] || hoseList[0] || DEFAULT_HOSES[1] || DEFAULT_HOSES[0];
  const firstNozzle = nozzleList[1] || nozzleList[0]; // try first non-closed if exists

  const state = {
    mode:   (initial && initial.mode)   || "single", // "single" or "wye"
    targetGpm: (initial && initial.targetGpm) || 150,
    targetPdp: (initial && initial.targetPdp) || 150,

    single: {
      hoseId:      (initial && initial.single && initial.single.hoseId)      || (firstHose.id || "1.75"),
      hoseSize:    (initial && initial.single && initial.single.hoseSize)    || (firstHose.label || "1 3/4\""),
      lengthFt:    (initial && initial.single && initial.single.lengthFt)    || 200,
      elevationFt: (initial && initial.single && initial.single.elevationFt) || 0,
      nozzleId:    (initial && initial.single && initial.single.nozzleId)    || (firstNozzle && firstNozzle.id) || "closed"
    },

    wye: {
      engineHoseId:      (initial && initial.wye && initial.wye.engineHoseId)      || (secondHose.id || "2.5"),
      engineHoseSize:    (initial && initial.wye && initial.wye.engineHoseSize)    || (secondHose.label || "2 1/2\""),
      engineLengthFt:    (initial && initial.wye && initial.wye.engineLengthFt)    || 100,
      elevationFt:       (initial && initial.wye && initial.wye.elevationFt)       || 0,

      branchA: {
        hoseId:   (initial && initial.wye && initial.wye.branchA && initial.wye.branchA.hoseId)   || (firstHose.id || "1.75"),
        hoseSize: (initial && initial.wye && initial.wye.branchA && initial.wye.branchA.hoseSize) || (firstHose.label || "1 3/4\""),
        lengthFt: (initial && initial.wye && initial.wye.branchA && initial.wye.branchA.lengthFt) || 200,
        nozzleId: (initial && initial.wye && initial.wye.branchA && initial.wye.branchA.nozzleId) || (firstNozzle && firstNozzle.id) || "closed"
      },

      branchB: {
        hoseId:   (initial && initial.wye && initial.wye.branchB && initial.wye.branchB.hoseId)   || (firstHose.id || "1.75"),
        hoseSize: (initial && initial.wye && initial.wye.branchB && initial.wye.branchB.hoseSize) || (firstHose.label || "1 3/4\""),
        lengthFt: (initial && initial.wye && initial.wye.branchB && initial.wye.branchB.lengthFt) || 200,
        nozzleId: (initial && initial.wye && initial.wye.branchB && initial.wye.branchB.nozzleId) || "closed"
      }
    }
  };

  // ---- Overlay & panel (phone-friendly) ----
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.55)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "flex-end"; // bottom sheet style on phone
  overlay.style.justifyContent = "center";
  overlay.style.padding = "8px";
  overlay.style.zIndex = "9999";
  overlay.style.boxSizing = "border-box";
  overlay.style.overflowX = "hidden";

  const panel = document.createElement("div");
  panel.style.maxWidth = "100vw";
  panel.style.width = "100%";
  panel.style.maxHeight = "90vh";
  panel.style.background = "#020617";
  panel.style.color = "#e5e7eb";
  panel.style.borderRadius = "16px 16px 0 0";
  panel.style.boxShadow = "0 18px 30px rgba(15,23,42,0.75)";
  panel.style.border = "1px solid rgba(148,163,184,0.35)";
  panel.style.padding = "12px 10px 10px";
  panel.style.fontFamily =
    'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
  panel.style.boxSizing = "border-box";
  panel.style.overflow = "hidden";
  panel.style.overflowX = "hidden";

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  // ---- Header ----
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.marginBottom = "6px";
  header.style.borderBottom = "1px solid rgba(148,163,184,0.25)";
  header.style.paddingBottom = "4px";

  const title = document.createElement("div");
  title.textContent = "Standard attack line";
  title.style.fontSize = "16px";
  title.style.fontWeight = "600";
  title.style.whiteSpace = "nowrap";
  title.style.overflow = "hidden";
  title.style.textOverflow = "ellipsis";
  title.style.marginRight = "8px";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "✕";
  closeBtn.style.width = "28px";
  closeBtn.style.height = "28px";
  closeBtn.style.borderRadius = "999px";
  closeBtn.style.border = "1px solid rgba(148,163,184,0.6)";
  closeBtn.style.background = "#020617";
  closeBtn.style.color = "#e5e7eb";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "16px";
  closeBtn.addEventListener("click", () => close());

  header.appendChild(title);
  header.appendChild(closeBtn);

  // ---- Body ----
  const body = document.createElement("div");
  body.style.maxHeight = "65vh";
  body.style.overflowY = "auto";
  body.style.overflowX = "hidden";
  body.style.fontSize = "14px";
  body.style.boxSizing = "border-box";

  // Mode toggle
  const modeRow = document.createElement("div");
  modeRow.style.display = "flex";
  modeRow.style.gap = "6px";
  modeRow.style.marginTop = "4px";

  const singleBtn = document.createElement("button");
  singleBtn.type = "button";
  singleBtn.textContent = "Single";

  const wyeBtn = document.createElement("button");
  wyeBtn.type = "button";
  wyeBtn.textContent = "Wye";

  [singleBtn, wyeBtn].forEach((b) => {
    b.style.flex = "1 1 0";
    b.style.padding = "6px 4px";
    b.style.borderRadius = "999px";
    b.style.border = "1px solid rgba(55,65,81,0.9)";
    b.style.background = "rgba(15,23,42,0.9)";
    b.style.color = "#e5e7eb";
    b.style.cursor = "pointer";
    b.style.fontSize = "14px";
    b.style.whiteSpace = "nowrap";
    b.style.overflow = "hidden";
    b.style.textOverflow = "ellipsis";
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

  // Sections container
  const sectionsContainer = document.createElement("div");
  sectionsContainer.style.marginTop = "8px";
  sectionsContainer.style.display = "flex";
  sectionsContainer.style.flexDirection = "column";
  sectionsContainer.style.gap = "8px";
  sectionsContainer.style.minWidth = "0";

  // Helpers
  function makeLabeledInput(labelText, type, value, onChange) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.flexDirection = "column";
    row.style.alignItems = "stretch";
    row.style.justifyContent = "flex-start";
    row.style.gap = "2px";
    row.style.marginBottom = "4px";
    row.style.minWidth = "0";

    const label = document.createElement("label");
    label.textContent = labelText;
    label.style.fontSize = "14px";

    const input = document.createElement("input");
    input.type = type;
    input.value = value;
    input.style.padding = "6px 8px";
    input.style.borderRadius = "8px";
    input.style.border = "1px solid rgba(55,65,81,0.9)";
    input.style.background = "#020617";
    input.style.color = "#e5e7eb";
    input.style.fontSize = "16px"; // avoid iOS zoom
    input.style.minHeight = "32px";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";

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
    row.style.flexDirection = "column";
    row.style.alignItems = "stretch";
    row.style.justifyContent = "flex-start";
    row.style.gap = "2px";
    row.style.marginBottom = "4px";
    row.style.minWidth = "0";

    const label = document.createElement("label");
    label.textContent = labelText;
    label.style.fontSize = "14px";

    const sel = document.createElement("select");
    sel.style.padding = "6px 8px";
    sel.style.borderRadius = "8px";
    sel.style.border = "1px solid rgba(55,65,81,0.9)";
    sel.style.background = "#020617";
    sel.style.color = "#e5e7eb";
    sel.style.fontSize = "16px"; // avoid iOS zoom
    sel.style.minHeight = "32px";
    sel.style.width = "100%";
    sel.style.boxSizing = "border-box";
    sel.style.whiteSpace = "nowrap";
    sel.style.overflow = "hidden";
    sel.style.textOverflow = "ellipsis";
    sel.style.maxWidth = "100%";

    list.forEach(item => {
      const opt = document.createElement("option");
      const text = (item.label || item.id || "").toString();
      opt.value = item.id;
      opt.textContent = text;
      sel.appendChild(opt);
    });

    if (selectedId != null) sel.value = selectedId;

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
    box.style.minWidth = "0";

    const h = document.createElement("div");
    h.textContent = titleText;
    h.style.fontSize = "12px";
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

      // Hose size
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

      // Nozzle
      box.appendChild(
        makeSelectRow(
          "Nozzle",
          nozzleList,
          state.single.nozzleId,
          (id) => {
            state.single.nozzleId = id;
          }
        )
      );

      sectionsContainer.appendChild(box);
    } else {
      // Wye: engine line + branches
      const { box: eBox } = makeSection("Engine to wye");
      eBox.appendChild(
        makeSelectRow(
          "Engine hose size",
          hoseList,
          state.wye.engineHoseId,
          (id) => {
            state.wye.engineHoseId = id;
            const hose = findHoseById(id);
            if (hose && hose.label) {
              state.wye.engineHoseSize = hose.label;
            }
          }
        )
      );
      eBox.appendChild(
        makeLabeledInput(
          "Engine line length (ft)",
          "number",
          state.wye.engineLengthFt,
          (v) => (state.wye.engineLengthFt = Number(v) || 0)
        )
      );
      eBox.appendChild(
        makeLabeledInput(
          "Elevation at nozzle (+/- ft)",
          "number",
          state.wye.elevationFt,
          (v) => (state.wye.elevationFt = Number(v) || 0)
        )
      );
      sectionsContainer.appendChild(eBox);

      // Branch A
      const { box: aBox } = makeSection("Branch A");
      aBox.appendChild(
        makeSelectRow(
          "Hose size",
          hoseList,
          state.wye.branchA.hoseId,
          (id) => {
            state.wye.branchA.hoseId = id;
            const hose = findHoseById(id);
            if (hose && hose.label) {
              state.wye.branchA.hoseSize = hose.label;
            }
          }
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
      aBox.appendChild(
        makeSelectRow(
          "Nozzle",
          nozzleList,
          state.wye.branchA.nozzleId,
          (id) => {
            state.wye.branchA.nozzleId = id;
          }
        )
      );
      sectionsContainer.appendChild(aBox);

      // Branch B
      const { box: bBox } = makeSection("Branch B");
      bBox.appendChild(
        makeSelectRow(
          "Hose size",
          hoseList,
          state.wye.branchB.hoseId,
          (id) => {
            state.wye.branchB.hoseId = id;
            const hose = findHoseById(id);
            if (hose && hose.label) {
              state.wye.branchB.hoseSize = hose.label;
            }
          }
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
      bBox.appendChild(
        makeSelectRow(
          "Nozzle",
          nozzleList,
          state.wye.branchB.nozzleId,
          (id) => {
            state.wye.branchB.nozzleId = id;
          }
        )
      );
      sectionsContainer.appendChild(bBox);
    }
  }

  // ---- PP / GPM preview ----
  const preview = document.createElement("div");
  preview.style.marginTop = "8px";
  preview.style.padding = "8px";
  preview.style.borderRadius = "10px";
  preview.style.border = "1px solid rgba(37,99,235,0.8)";
  preview.style.background = "#020617";
  preview.style.fontSize = "14px";
  preview.style.fontWeight = "600";
  preview.style.textAlign = "center";
  preview.style.boxSizing = "border-box";

  function frictionLoss(c, gpm, lengthFt) {
    if (!c || !gpm || !lengthFt) return 0;
    const flPer100 = c * Math.pow(gpm / 100, 2);
    return flPer100 * (lengthFt / 100);
  }

  function calcSingleLine() {
    const noz = findNozzleById(state.single.nozzleId);
    const hose = findHoseById(state.single.hoseId);
    const gpm = noz && typeof noz.gpm === "number" ? noz.gpm : 0;
    const np  = noz && typeof noz.np  === "number" ? noz.np  : (noz && noz.NP) || 0;
    const lengthFt = state.single.lengthFt || 0;
    const elevFt   = state.single.elevationFt || 0;
    const c = hose && typeof hose.c === "number"
      ? hose.c
      : defaultHoseCFromLabel(state.single.hoseSize);

    const fl   = frictionLoss(c, gpm, lengthFt);
    const elev = elevFt * PSI_PER_FT;
    const pdp  = Math.round(np + fl + elev);

    return { gpm: Math.round(gpm), pdp };
  }

  function calcWyeLine() {
    // Branch A
    const nozA  = findNozzleById(state.wye.branchA.nozzleId);
    const hoseA = findHoseById(state.wye.branchA.hoseId);
    const gpmA  = nozA && typeof nozA.gpm === "number" ? nozA.gpm : 0;
    const npA   = nozA && typeof nozA.np  === "number" ? nozA.np  : (nozA && nozA.NP) || 0;
    const lenA  = state.wye.branchA.lengthFt || 0;
    const cA    = hoseA && typeof hoseA.c === "number"
      ? hoseA.c
      : defaultHoseCFromLabel(state.wye.branchA.hoseSize);

    // Branch B
    const nozB  = findNozzleById(state.wye.branchB.nozzleId);
    const hoseB = findHoseById(state.wye.branchB.hoseId);
    const gpmB  = nozB && typeof nozB.gpm === "number" ? nozB.gpm : 0;
    const npB   = nozB && typeof nozB.np  === "number" ? nozB.np  : (nozB && nozB.NP) || 0;
    const lenB  = state.wye.branchB.lengthFt || 0;
    const cB    = hoseB && typeof hoseB.c === "number"
      ? hoseB.c
      : defaultHoseCFromLabel(state.wye.branchB.hoseSize);

    const totalGpm = gpmA + gpmB;

    // Engine line (pump to wye) uses total GPM
    const hoseE = findHoseById(state.wye.engineHoseId);
    const cE    = hoseE && typeof hoseE.c === "number"
      ? hoseE.c
      : defaultHoseCFromLabel(state.wye.engineHoseSize);
    const lenE  = state.wye.engineLengthFt || 0;

    const flA = frictionLoss(cA, gpmA, lenA);
    const flB = frictionLoss(cB, gpmB, lenB);
    const flE = frictionLoss(cE, totalGpm, lenE);
    const elevPsi = (state.wye.elevationFt || 0) * PSI_PER_FT;

    const needA = npA + flA + elevPsi;
    const needB = npB + flB + elevPsi;
    const branchMax = Math.max(needA, needB);

    const pdp = Math.round(branchMax + flE + (totalGpm > 0 ? WYE_LOSS_PSI : 0));

    return { gpm: Math.round(totalGpm), pdp };
  }

  function updatePreview() {
    if (state.mode === "single") {
      const { gpm, pdp } = calcSingleLine();
      state.targetGpm = gpm;
      state.targetPdp = pdp;
      preview.textContent = `Single line • Flow: ${gpm} gpm • PDP: ${pdp} psi`;
    } else {
      const { gpm, pdp } = calcWyeLine();
      state.targetGpm = gpm;
      state.targetPdp = pdp;
      preview.textContent = `Wye line • Total flow: ${gpm} gpm • PDP: ${pdp} psi`;
    }
  }

  // ---- Footer ----
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
  cancelBtn.style.padding = "6px 10px";
  cancelBtn.style.fontSize = "14px";
  cancelBtn.style.border = "1px solid rgba(148,163,184,0.7)";
  cancelBtn.style.background = "#020617";
  cancelBtn.style.color = "#e5e7eb";
  cancelBtn.style.cursor = "pointer";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save line";
  saveBtn.style.borderRadius = "999px";
  saveBtn.style.padding = "6px 10px";
  saveBtn.style.fontSize = "14px";
  saveBtn.style.border = "none";
  saveBtn.style.background = "#22c55e";
  saveBtn.style.color = "#020617";
  saveBtn.style.fontWeight = "600";
  saveBtn.style.cursor = "pointer";

  cancelBtn.addEventListener("click", () => close());

  saveBtn.addEventListener("click", (e) => {
    e.preventDefault();

    let finalGpm, finalPdp;
    if (state.mode === "single") {
      const calc = calcSingleLine();
      finalGpm = calc.gpm;
      finalPdp = calc.pdp;
    } else {
      const calc = calcWyeLine();
      finalGpm = calc.gpm;
      finalPdp = calc.pdp;
    }

    const payload = {
      type: "standard",
      mode: state.mode,
      single: {
        hoseId:      state.single.hoseId,
        hoseSize:    state.single.hoseSize,
        lengthFt:    state.single.lengthFt,
        elevationFt: state.single.elevationFt,
        nozzleId:    state.single.nozzleId
      },
      wye: {
        engineHoseId:   state.wye.engineHoseId,
        engineHoseSize: state.wye.engineHoseSize,
        engineLengthFt: state.wye.engineLengthFt,
        elevationFt:    state.wye.elevationFt,
        branchA: { ...state.wye.branchA },
        branchB: { ...state.wye.branchB }
      },
      targetGpm: finalGpm,
      targetPdp: finalPdp,
      lastCalc: {
        targetGpm: finalGpm,
        targetPdp: finalPdp
      }
    };

    onSave(payload);
    close();
  });

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  // ---- Assemble ----
  panel.appendChild(header);
  panel.appendChild(body);
  body.appendChild(modeRow);
  body.appendChild(sectionsContainer);

  const numbersNote = document.createElement("div");
  numbersNote.style.fontSize = "12px";
  numbersNote.style.marginTop = "6px";
  numbersNote.style.opacity = "0.85";
  numbersNote.textContent =
    "GPM comes from nozzle selection (Closed = 0 gpm). PDP uses hose C, length, nozzle pressure, elevation, and (for a wye) both branches plus the engine line and wye loss.";

  body.appendChild(numbersNote);
  body.appendChild(preview);
  panel.appendChild(footer);

  updateModeButtons();
  updatePreview();
}
