// =============================================================
// Disable DataTables automatic popups
// =============================================================
$.fn.dataTable.ext.errMode = "none";

// =============================================================
// File paths
// =============================================================
const EXPORTER_PATH = "data/exporters.csv";
const ISIC_CODES_PATH = "data/isic4_2_product_name.csv";
const HS6_CODES_PATH = "data/hs6code.csv";
const ISIC_TARIFF_PATH = "data/isic2tariff.csv";
const HS6_TARIFF_PATH = "data/hs6tariff.csv";

// =============================================================
// Globals
// =============================================================
let exporterList = [];
let isicCodes = [];
let hs6Codes = [];

let isicTariffData = [];
let hs6TariffData = [];

let isicLoaded = false;
let hs6Loaded = false;

// The HTML option value for "World (All Importers)" is just "World"
const WORLD_IMPORTER_VALUE = "World"; 

// =============================================================
// DOM READY
// =============================================================
document.addEventListener("DOMContentLoaded", () => {
  setupExporterDropdown();

  // Clear exporter list on load
  document.getElementById("exporterBox").innerHTML = "";
  // Reset display to reflect the initial loading state
  resetExporterDisplay("Loading Data...");

  // Load reference lists
  loadExporters(() => {
    loadIsicCodes(() => {
      loadHs6Codes(() => {
        // Load tariff datasets
        loadTariff(ISIC_TARIFF_PATH, "isic", () => {
          loadTariff(HS6_TARIFF_PATH, "hs6", () => {
            isicLoaded = true;
            hs6Loaded = true;

            // Add listeners
            document
              .getElementById("importerSelect")
              .addEventListener("change", importerChanged);

            document
              .getElementById("classSelect")
              .addEventListener("change", classificationChanged);

            document
              .getElementById("applyFilters")
              .addEventListener("click", applyFilters);

            // INITIAL RENDER
            initialLoadAndRender();
          });
        });
      });
    });
  });
});

// =============================================================
// INITIAL LOAD FUNCTION
// This function runs once data is loaded to show the default state (All Importers, HS6).
// =============================================================
function initialLoadAndRender() {
  // 1. Set default controls state (HS6 is the default classification)
  document.getElementById("importerSelect").value = WORLD_IMPORTER_VALUE;
  document.getElementById("classSelect").value = "hs6";
  disableCodeDropdowns(); // Ensure ISIC/HS6 selects are disabled

  // 2. Initial state is ALL data
  const initialData = hs6TariffData;
  const initialClass = "hs6";

  // 3. Populate Exporter Dropdown (using all data to get all unique exporters)
  populateHs6Exporters(WORLD_IMPORTER_VALUE, initialData); 

  // 4. Render with the full dataset (Exporters selected is empty array for 'World' view)
  drawChart(initialData, []);
  updateSummary(initialClass, initialData);
  updateEO(initialClass, initialData, WORLD_IMPORTER_VALUE, [], "", "", null, null);

  // 5. Enable the correct code dropdown based on the default classification
  enableHs6Only();
  populateHs6(WORLD_IMPORTER_VALUE); // Populate HS6 codes from the full dataset
}


// =============================================================
// Exporter MULTI SELECT dropdown (UI behavior)
// =============================================================
function setupExporterDropdown() {
  const disp = document.getElementById("exporterDisplay");
  const panel = document.getElementById("exporterBox");

  disp.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.style.display = panel.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", () => (panel.style.display = "none"));

  panel.addEventListener("click", (e) => e.stopPropagation());
}

function resetExporterDisplay(text) {
  document.getElementById("exporterDisplayText").textContent = text;
}

function updateExporterDisplay() {
  let cbs = document.querySelectorAll(".exporter-checkbox:checked");
  let txt = document.getElementById("exporterDisplayText");

  if (!cbs.length) txt.textContent = "World (All Exporters)";
  else if (cbs.length === 1) txt.textContent = cbs[0].value;
  else txt.textContent = `${cbs.length} exporters selected`;
}

// =============================================================
// Load supporting CSV lists
// =============================================================
function loadExporters(callback) {
  Papa.parse(EXPORTER_PATH, {
    download: true,
    header: true,
    complete: (res) => {
      let seen = {};
      exporterList = [];

      res.data.forEach((r) => {
        let e = (r.exporter || "").trim();
        if (e && !seen[e]) {
          seen[e] = true;
          exporterList.push(e);
        }
      });

      exporterList.sort();
      if (callback) callback();
    },
  });
}

function loadIsicCodes(callback) {
  Papa.parse(ISIC_CODES_PATH, {
    download: true,
    header: true,
    complete: (res) => {
      let seen = {};
      isicCodes = [];

      res.data.forEach((r) => {
        let raw = (r.isic4_2 || "").trim();
        let two = normalizeIsic(raw);
        if (two && !seen[two]) {
          seen[two] = true;
          isicCodes.push(two);
        }
      });

      isicCodes.sort();
      if (callback) callback();
    },
  });
}

function loadHs6Codes(callback) {
  Papa.parse(HS6_CODES_PATH, {
    download: true,
    header: true,
    complete: (res) => {
      let seen = {};
      hs6Codes = [];

      res.data.forEach((r) => {
        let code = (r.hs6code || "").trim();
        if (code && !seen[code]) {
          seen[code] = true;
          hs6Codes.push(code);
        }
      });

      hs6Codes.sort();
      if (callback) callback();
    },
  });
}

function normalizeIsic(raw) {
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.length >= 2) return d.slice(0, 2);
  return d.padStart(2, "0");
}

// =============================================================
// Load tariff datasets
// =============================================================
function loadTariff(path, mode, callback) {
  Papa.parse(path, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (res) => {
      let out = [];

      res.data.forEach((row) => {
        let d = new Date(row.date_eff);
        if (isNaN(d)) return;

        let importer = (row.importer || "").trim();
        let exporter = (row.exporter || "").trim();

        let tariff = parseFloat(row.tariffs || 0) || 0;

        let importsK = parseFloat(row.importsvaluein1000usd || 0) || 0;
        let tradeValue = importsK * 1000;

        let code = mode === "isic"
          ? normalizeIsic(row.isic4_2 || "")
          : (row.hs6 || "").trim();

        let affectedTv = parseFloat(row.affected_trade_value || 0) || 0;
        let share = parseFloat(row.affected_trade_share || 0) || 0;
        let lineShare = parseFloat(row.affected_hs6tariff_line_share || 0) || 0;

        out.push({
          importer,
          exporter,
          code,
          date: d,
          tariff,
          tradeValue,
          affectedTv,
          share,
          lineShare,
        });
      });

      if (mode === "isic") isicTariffData = out;
      else hs6TariffData = out;

      if (callback) callback();
    },
  });
}

// =============================================================
// Importer changed (reset everything else)
// =============================================================
function importerChanged() {
  let importer = document.getElementById("importerSelect").value;
  let cls = document.getElementById("classSelect").value;
  
  // 1. Reset the dependent controls
  resetExporterDisplay("Select Classification First");
  disableCodeDropdowns();
  clearExporterList();
  document.getElementById("isicSelect").value = "";
  document.getElementById("hs6Select").value = "";

  // 2. If World is selected, reset classification to force re-render/logic below
  if (importer === WORLD_IMPORTER_VALUE) {
    document.getElementById("classSelect").value = "";
    resetExporterDisplay("World (All Exporters)");
    return;
  }
  
  // 3. If a specific importer AND classification are already selected, update the dependent controls
  if (importer && cls) {
    if (cls === "isic") {
        enableIsicOnly();
        populateIsic(importer);
        populateIsicExporters(importer);
    } else if (cls === "hs6") {
        enableHs6Only();
        populateHs6(importer);
        populateHs6Exporters(importer);
    }
  } else {
      // If importer changes to a specific country, but classification hasn't been chosen yet.
      document.getElementById("classSelect").value = "";
  }
}

function clearExporterList() {
  document.getElementById("exporterBox").innerHTML = "";
}

// =============================================================
// Classification changed → Load exporters & codes
// =============================================================
function classificationChanged() {
  let importer = document.getElementById("importerSelect").value;
  let cls = document.getElementById("classSelect").value;

  clearExporterList();
  disableCodeDropdowns();

  if (!importer || importer === WORLD_IMPORTER_VALUE) {
    // If classification is changed while 'World' is selected, alert the user
    // and reset the classification selector.
    alert("Please select a specific Importer country first to view its codes and exporters.");
    document.getElementById("classSelect").value = "";
    return;
  }

  if (cls === "isic") {
    enableIsicOnly();
    populateIsic(importer);
    populateIsicExporters(importer);
  }

  if (cls === "hs6") {
    enableHs6Only();
    populateHs6(importer);
    populateHs6Exporters(importer);
  }
}

// =============================================================
// Enable / Disable dropdowns
// =============================================================
function disableCodeDropdowns() {
  let isic = document.getElementById("isicSelect");
  let hs6 = document.getElementById("hs6Select");

  isic.disabled = true;
  hs6.disabled = true;

  isic.value = "";
  hs6.value = "";
}

function enableIsicOnly() {
  document.getElementById("isicSelect").disabled = false;
  document.getElementById("hs6Select").disabled = true;
}

function enableHs6Only() {
  document.getElementById("isicSelect").disabled = true;
  document.getElementById("hs6Select").disabled = false;
}

// =============================================================
// Populate ISIC and exporters
// =============================================================
function populateIsic(importer) {
  let sel = document.getElementById("isicSelect");
  sel.innerHTML = "<option value=''>All</option>";

  let set = {};
  
  // Determine source data: if importer is 'World', use all ISIC data; otherwise, filter.
  let sourceData = importer === WORLD_IMPORTER_VALUE 
    ? isicTariffData 
    : isicTariffData.filter(r => r.importer === importer);

  sourceData.forEach((r) => {
    if (r.code) set[r.code] = true;
  });

  Object.keys(set)
    .sort()
    .forEach((c) => {
      let opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
}

function populateIsicExporters(importer, optionalData) {
  let box = document.getElementById("exporterBox");
  box.innerHTML = "";

  let set = {};
  
  // Determine source data: use optionalData (for initial load) or filter based on importer.
  let sourceData = optionalData || (importer === WORLD_IMPORTER_VALUE 
    ? isicTariffData 
    : isicTariffData.filter(r => r.importer === importer));


  sourceData.forEach((r) => {
    if (r.exporter) set[r.exporter] = true;
  });

  let arr = Object.keys(set).sort();

  if (!arr.length) {
    resetExporterDisplay("No exporters found");
    return;
  }

  arr.forEach((exp) => {
    let label = document.createElement("label");
    let cb = document.createElement("input");
    cb.type = "checkbox";
    cb.classList.add("exporter-checkbox");
    cb.value = exp;
    cb.addEventListener("change", updateExporterDisplay);

    label.appendChild(cb);
    label.appendChild(document.createTextNode(" " + exp));
    box.appendChild(label);
  });

  resetExporterDisplay("World (All Exporters)");
}

// =============================================================
// Populate HS6 and exporters
// =============================================================
function populateHs6(importer) {
  let sel = document.getElementById("hs6Select");
  sel.innerHTML = "<option value=''>All</option>";

  let set = {};
  
  // Determine source data: if importer is 'World', use all HS6 data; otherwise, filter.
  let sourceData = importer === WORLD_IMPORTER_VALUE 
    ? hs6TariffData 
    : hs6TariffData.filter(r => r.importer === importer);

  sourceData.forEach((r) => {
    if (r.code) set[r.code] = true;
  });

  Object.keys(set)
    .sort()
    .forEach((c) => {
      let opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
}

function populateHs6Exporters(importer, optionalData) {
  let box = document.getElementById("exporterBox");
  box.innerHTML = "";

  let set = {};

  // Determine source data: use optionalData (for initial load) or filter based on importer.
  let sourceData = optionalData || (importer === WORLD_IMPORTER_VALUE 
    ? hs6TariffData 
    : hs6TariffData.filter(r => r.importer === importer));
  
  sourceData.forEach((r) => {
    if (r.exporter) set[r.exporter] = true;
  });

  let arr = Object.keys(set).sort();

  if (!arr.length) {
    resetExporterDisplay("No exporters found");
    return;
  }

  arr.forEach((exp) => {
    let label = document.createElement("label");
    let cb = document.createElement("input");
    cb.type = "checkbox";
    cb.classList.add("exporter-checkbox");
    cb.value = exp;
    cb.addEventListener("change", updateExporterDisplay);

    label.appendChild(cb);
    label.appendChild(document.createTextNode(" " + exp));
    box.appendChild(label);
  });

  resetExporterDisplay("World (All Exporters)");
}

// =============================================================
// APPLY FILTERS
// =============================================================
function applyFilters() {
  let importer = document.getElementById("importerSelect").value;
  let cls = document.getElementById("classSelect").value;

  let isicC = document.getElementById("isicSelect").value;
  let hs6C = document.getElementById("hs6Select").value;

  if (!cls) {
    alert("Please select classification.");
    return;
  }

  if (!importer) {
    alert("Please select importer.");
    return;
  }

  if (isicC && hs6C) {
    alert("Please select only one classification.");
    return;
  }

  let from = document.getElementById("dateFrom").value
    ? new Date(document.getElementById("dateFrom").value)
    : null;

  let to = document.getElementById("dateTo").value
    ? new Date(document.getElementById("dateTo").value)
    : null;

  let selectedExp = [];
  document.querySelectorAll(".exporter-checkbox:checked").forEach((x) =>
    selectedExp.push(x.value)
  );

  let base = cls === "isic" ? isicTariffData : hs6TariffData;

  let filtered = base.filter((r) => {
    // 1. Importer Filter: If "World" is selected, skip the importer filter.
    if (importer !== WORLD_IMPORTER_VALUE && r.importer !== importer) return false;

    // 2. Code Filter: Allow 'All' (empty string) to pass.
    if (cls === "isic" && isicC && isicC !== "" && r.code !== isicC) return false;
    if (cls === "hs6" && hs6C && hs6C !== "" && r.code !== hs6C) return false;

    // 3. Exporter Filter: If selectedExp is empty, it means 'All Exporters' for the current Importer/World, so skip the filter.
    if (selectedExp.length && !selectedExp.includes(r.exporter)) return false;

    // 4. Date Filter
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;

    return true;
  });

  // Render the results
  drawChart(filtered, selectedExp);
  updateSummary(cls, filtered);
  updateEO(cls, filtered, importer, selectedExp, isicC, hs6C, from, to);
}

// =============================================================
// DRAW CHART (MODIFIED for true date scaling)
// =============================================================
function drawChart(data, selExp) {
  let div = document.getElementById("tariffChartMain");

  if (!data.length) {
    Plotly.newPlot(div, [], { title: "No data available" });
    return;
  }

  let world = selExp.length === 0;

  let dateList = {};
  data.forEach((r) => {
    dateList[r.date.toLocaleDateString("en-US")] = true;
  });

  let sortedDates = Object.keys(dateList)
    .sort((a, b) => new Date(a) - new Date(b))
    .map((x) => new Date(x));

  let traces = [];

  if (world) {
    let group = {};

    data.forEach((r) => {
      let d = r.date.toLocaleDateString("en-US");
      group[d] = group[d] || [];
      group[d].push(r.tariff);
    });

    let ys = sortedDates.map((d) => {
      let k = d.toLocaleDateString("en-US");
      let arr = group[k] || [];
      if (!arr.length) return 0;
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    });

    traces.push({
      x: sortedDates,
      y: ys,
      mode: "lines+markers",
      name: "World",
    });
  } else {
    selExp.forEach((exp) => {
      let group = {};

      data.forEach((r) => {
        let d = r.date.toLocaleDateString("en-US");
        if (r.exporter !== exp) return;
        group[d] = group[d] || [];
        group[d].push(r.tariff);
      });

      let ys = sortedDates.map((d) => {
        let k = d.toLocaleDateString("en-US");
        let arr = group[k] || [];
        if (!arr.length) return null;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
      });

      traces.push({
        x: sortedDates,
        y: ys,
        mode: "lines+markers",
        name: exp,
      });
    });
  }

  // --- MODIFICATION HERE: Explicitly set axis type to 'date' ---
  Plotly.newPlot(div, traces, {
    title: "Tariff Trend",
    xaxis: { title: "Date", type: "date" }, 
    yaxis: { title: "Tariff (%)" },
  });
  // -----------------------------------------------------------
}

// =============================================================
// SUMMARY TABLE
// =============================================================
function updateSummary(mode, data) {
  let tableIS = $("#summaryTableISIC");
  let tableHS = $("#summaryTableHS6");

  tableIS.hide();
  tableHS.hide();

  if (!data.length) return;

  let grouped = {};

  data.forEach((r) => {
    let dkey = r.date.toLocaleDateString("en-US");
    let key = r.exporter + "_" + dkey;

    if (!grouped[key]) {
      grouped[key] = {
        exporter: r.exporter,
        date: dkey,
        tariffs: [],
        weighted: [],
        tv: [],
        aff: [],
        share: [],
        line: [],
      };
    }

    grouped[key].tariffs.push(r.tariff);
    grouped[key].weighted.push(r.tariff * r.tradeValue);
    grouped[key].tv.push(r.tradeValue);
    grouped[key].aff.push(r.affectedTv);
    grouped[key].share.push(r.share);
    grouped[key].line.push(r.lineShare);
  });

  let rows = Object.values(grouped);

  // Determine which table to show and destroy any existing DataTables instances
  if (mode === "isic") {
    if ($.fn.DataTable.isDataTable("#summaryTableISIC"))
      $("#summaryTableISIC").DataTable().destroy();

    let tb = document.querySelector("#summaryTableISIC tbody");
    tb.innerHTML = "";

    rows.forEach((g) => {
      tb.innerHTML += `
      <tr>
        <td>${g.exporter}</td>
        <td>${g.date}</td>
        <td>${avg(g.tariffs).toFixed(3)}</td>
        <td>${weightedAvg(g.weighted, g.tv).toFixed(3)}</td>
        <td>${sum(g.aff).toFixed(0)}</td>
      </tr>`;
    });

    tableIS.show();
    $("#summaryTableISIC").DataTable({ pageLength: 5 });

  } else { // mode === "hs6"
    if ($.fn.DataTable.isDataTable("#summaryTableHS6"))
      $("#summaryTableHS6").DataTable().destroy();

    let tb = document.querySelector("#summaryTableHS6 tbody");
    tb.innerHTML = "";

    rows.forEach((g) => {
      tb.innerHTML += `
      <tr>
        <td>${g.exporter}</td>
        <td>${g.date}</td>
        <td>${avg(g.tariffs).toFixed(3)}</td>
        <td>${weightedAvg(g.weighted, g.tv).toFixed(3)}</td>
        <td>${sum(g.aff).toFixed(0)}</td>
        <td>${(avg(g.share) * 100).toFixed(2)}%</td>
        <td>${(avg(g.line) * 100).toFixed(2)}%</td>
      </tr>`;
    });

    tableHS.show();
    $("#summaryTableHS6").DataTable({ pageLength: 5 });
  }
}

function avg(a) {
  if (!a.length) return 0;
  return a.reduce((x, y) => x + y, 0) / a.length;
}

function sum(a) {
  return a.reduce((x, y) => x + y, 0);
}

function weightedAvg(wv, tv) {
  let sw = sum(wv);
  let st = sum(tv);
  if (!st) return 0;
  return sw / st;
}

// =============================================================
// EO SECTION
// =============================================================
function updateEO(mode, data, importer, exporters, isicC, hs6C, from, to) {
  let div = document.getElementById("eoContent");

  if (!data.length) {
    div.innerHTML = "<p>No EO-related data.</p>";
    return;
  }

  let clsTxt = mode === "isic"
    ? `ISIC ${isicC || "All"}`
    : `HS6 ${hs6C || "All"}`;

  let expTxt =
    exporters.length === 0
      ? "World"
      : exporters.length === 1
      ? exporters[0]
      : `${exporters.length} exporters`;

  let dt = "All Dates";
  if (from || to) {
    let f = from ? from.toLocaleDateString("en-US") : "…";
    let t = to ? to.toLocaleDateString("en-US") : "…";
    dt = `${f} → ${t}`;
  }

  let eoCount = data.filter((x) => x.affectedTv > 0).length;

  div.innerHTML = `
    <p><strong>Importer:</strong> ${importer}</p>
    <p><strong>Exporter:</strong> ${expTxt}</p>
    <p><strong>Classification:</strong> ${clsTxt}</p>
    <p><strong>Date Range:</strong> ${dt}</p>
    <p><strong>EO-related actions:</strong> ${eoCount}</p>
  `;
}

