// =============================================================
// Disable DataTables automatic popups
// =============================================================
$.fn.dataTable.ext.errMode = "none";

// =============================================================
// File paths
// =============================================================
const EXPORTER_PATH = "data/exporters.csv";
// NOTE: Reverting to the known working file name for ISIC codes.
const ISIC_CODES_PATH = "data/isic2digit.csv"; 
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
// =============================================================
function initialLoadAndRender() {
  // 1. Set default controls state (HS6 is the default classification)
  document.getElementById("importerSelect").value = WORLD_IMPORTER_VALUE;
  document.getElementById("classSelect").value = "hs6";
  disableCodeDropdowns(); 

  // 2. Initial state is ALL data
  const initialData = hs6TariffData;
  const initialClass = "hs6";

  // 3. Populate Exporter Dropdown 
  populateHs6Exporters(WORLD_IMPORTER_VALUE, initialData); 

  // 4. Render with the full dataset (World view)
  drawChart(initialData, [], true, initialClass, null); 
  updateSummary(initialClass, initialData);
  updateEO(initialClass, initialData, WORLD_IMPORTER_VALUE, [], "", "", null, null);

  // 5. Enable the correct code dropdown 
  enableHs6Only();
  populateHs6(WORLD_IMPORTER_VALUE); 
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
        // Assuming column header is 'isic4_2'
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
        // Ensure we only proceed with valid dates
        if (isNaN(d.getTime())) return;

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
// Importer / Classification Change Handlers
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

  // 2. FIX: If World is selected, auto-set classification to HS6 and apply filters
  if (importer === WORLD_IMPORTER_VALUE) {
    document.getElementById("classSelect").value = "hs6";
    resetExporterDisplay("World (All Exporters)");
    applyFilters(); // Trigger render immediately
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

function classificationChanged() {
  let importer = document.getElementById("importerSelect").value;
  let cls = document.getElementById("classSelect").value;

  clearExporterList();
  disableCodeDropdowns();

  if (!importer || importer === WORLD_IMPORTER_VALUE) {
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
// Dropdown Enable/Disable
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
// Populate Dropdowns
// =============================================================
function populateIsic(importer) {
  let sel = document.getElementById("isicSelect");
  sel.innerHTML = "<option value=''>All</option>";

  let set = {};
  
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

function populateHs6(importer) {
  let sel = document.getElementById("hs6Select");
  sel.innerHTML = "<option value=''>All</option>";

  let set = {};
  
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
  
  const worldMode = selectedExp.length === 0;

  let base = cls === "isic" ? isicTariffData : hs6TariffData;

  let filtered = base.filter((r) => {
    // Defensive check for invalid dates
    if (r.date && isNaN(r.date.getTime())) return false;

    if (importer !== WORLD_IMPORTER_VALUE && r.importer !== importer) return false;

    if (cls === "isic" && isicC && isicC !== "" && r.code !== isicC) return false;
    if (cls === "hs6" && hs6C && hs6C !== "" && r.code !== hs6C) return false;

    if (!worldMode && !selectedExp.includes(r.exporter)) return false;

    if (from && r.date < from) return false;
    if (to && r.date > to) return false;

    return true;
  });

  // --- LOGIC: DETERMINE CODE TITLE ---
  let selectedCode = null;
  if (cls === 'hs6' && hs6C) {
      selectedCode = `HS6 Tariff Line ${hs6C}`;
  } else if (cls === 'isic' && isicC) {
      selectedCode = `ISIC4 2 Digit Tariff Line ${isicC}`;
  } else {
      // Use classification name if no specific code is selected
      selectedCode = cls === 'hs6' ? 'HS6 Tariff Line' : 'ISIC4 2 Digit Tariff Line';
  }
  
  drawChart(filtered, selectedExp, worldMode, cls, selectedCode); 
  updateSummary(cls, filtered);
  updateEO(cls, filtered, importer, selectedExp, isicC, hs6C, from, to);
}

// =============================================================
// DRAW CHART
// =============================================================
function drawChart(data, exporters, worldMode, classification, codeTitle) {
  var chartDiv = document.getElementById("tariffChartMain");

  if (!data || data.length === 0) {
    Plotly.newPlot(chartDiv, [], { title: "No Data" });
    return;
  }

  var traces = [];
  
  // --- SET CHART TITLE ---
  let chartTitle;
  if (codeTitle) {
      chartTitle = `${codeTitle}`;
  } else if (worldMode) {
      chartTitle = "HS6 Tariff Line";
  } else {
      chartTitle = "Tariff Lines – Selected Exporters";
  }
  // ------------------------------------


  // WORLD MODE (aggregated)
  if (worldMode) {
    var grouped = {};

    data.forEach(function (d) {
      var ds = d.date.toLocaleDateString("en-US"); 
      if (!grouped[ds]) grouped[ds] = [];
      grouped[ds].push(d.tariff);
    });

    var allDates = [];
    var allLabels = [];
    var allValues = [];

    Object.keys(grouped)
      .sort((a, b) => new Date(a) - new Date(b))
      .forEach(function (key) {
        allDates.push(new Date(key));
        allLabels.push(key);

        var arr = grouped[key];
        var avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        allValues.push(avg);
      });

    traces.push({
      x: allDates,
      y: allValues,
      mode: "lines+markers",
      name: "World",
      line: { shape: "hv", width: 3, color: "#003366" },
      marker: { size: 8, color: "#003366" }
    });

    var layout = {
      title: chartTitle,
      xaxis: {
        title: "Date",
        type: "date",
        tickmode: "array",
        tickvals: allDates,
        ticktext: allLabels,
        tickangle: -45
      },
      yaxis: { title: "Tariff (%)" },
      font: { family: "Georgia, serif", size: 12 },
      plot_bgcolor: "#fff",
      paper_bgcolor: "#fff",
      showlegend: false
    };

    Plotly.newPlot(chartDiv, traces, layout);
    return;
  }

  // MULTI-EXPORTER MODE
  var dateSet = new Set();
  data.forEach(d => dateSet.add(d.date.toLocaleDateString("en-US")));

  var allLabels = Array.from(dateSet).sort((a,b) => new Date(a) - new Date(b));
  var allDates = allLabels.map(label => new Date(label));

  exporters.forEach(function (exp) {
    var rows = data.filter(d => d.exporter === exp);
    if (rows.length === 0) return;

    var dailyMap = {};
    rows.forEach(d => {
      var ds = d.date.toLocaleDateString("en-US");
      if (!dailyMap[ds]) dailyMap[ds] = [];
      dailyMap[ds].push(d.tariff);
    });

    var x = [];
    var y = [];

    allLabels.forEach(function (label) {
      if (dailyMap[label]) {
        var arr = dailyMap[label];
        var avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        x.push(new Date(label));
        y.push(avg);
      }
    });

    traces.push({
      x: x,
      y: y,
      mode: "lines+markers",
      name: exp,
      line: { shape: "hv", width: 3 },
      marker: { size: 8 }
    });
  });

  var layout = {
    title: chartTitle,
    xaxis: {
      title: "Date",
      type: "date",
      tickmode: "array",
      tickvals: allDates,
      ticktext: allLabels,
      tickangle: -45
    },
    yaxis: { title: "Tariff (%)" },
    font: { family: "Georgia, serif", size: 12 },
    plot_bgcolor: "#fff",
    paper_bgcolor: "#fff",
    showlegend: true
  };

  Plotly.newPlot(chartDiv, traces, layout);
}

// =============================================================
// SUMMARY TABLE (FIXED DATATABLES RE-INITIALIZATION)
// =============================================================
function updateSummary(mode, data) {
  let tableIS = $("#summaryTableISIC");
  let tableHS = $("#summaryTableHS6");

  // --- DESTROY EXISTING DATATABLES INSTANCES ---
  // Use destroy(true) to remove the DataTable functionality and clear the table body/wrapper.
  // We then ensure the <tbody> is empty before appending new rows.
  
  if ($.fn.DataTable.isDataTable("#summaryTableISIC")) {
    // Clear and destroy the DataTable instance completely
    tableIS.DataTable().destroy(true); 
    // DataTables destroy(true) removes the parent wrapper and pagination elements.
  }
  if ($.fn.DataTable.isDataTable("#summaryTableHS6")) {
    tableHS.DataTable().destroy(true);
  }

  // NOTE: If destroy(true) doesn't perfectly restore your <table> tag 
  // structure in the DOM for re-initialization, you might need to use 
  // manual recreation, but destroy(true) is the recommended standard.

  // Hide both tables initially
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

  // Now process and show the correct table
  if (mode === "isic") {
    let tb = document.querySelector("#summaryTableISIC tbody");
    // Ensure the table body is empty after destruction, or if destroy(true) fails to clean it up
    tb.innerHTML = ""; 

    rows.forEach((g) => {
      tb.innerHTML += `
      <tr>
        <td>${g.exporter}</td>
        <td>${g.date}</td>
        <td>${avg(g.tariffs).toFixed(2)}</td>
        <td>${weightedAvg(g.weighted, g.tv).toFixed(2)}</td>
        <td>${sum(g.aff).toFixed(0)}</td>
      </tr>`;
    });

    tableIS.show();
    // Re-initialize DataTable after rows are inserted
    $("#summaryTableISIC").DataTable({ pageLength: 5 });

  } else { // mode === "hs6"
    let tb = document.querySelector("#summaryTableHS6 tbody");
    tb.innerHTML = "";

    rows.forEach((g) => {
      tb.innerHTML += `
      <tr>
        <td>${g.exporter}</td>
        <td>${g.date}</td>
        <td>${avg(g.tariffs).toFixed(2)}</td>
        <td>${weightedAvg(g.weighted, g.tv).toFixed(2)}</td>
        <td>${sum(g.aff).toFixed(0)}</td>
        <td>100%</td>
        <td>100%</td>
      </tr>`;
    });

    tableHS.show();
    // Re-initialize DataTable after rows are inserted
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
