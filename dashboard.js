// ========================================================
// Trade Model (CP) Equilibrium Dashboard — HS6 + HS8
// ========================================================

// CSV paths
var HS6_PATH = "data/tariff_datahs6.csv";
var HS8_PATH = "data/tariff_datahs8.csv";

// Global data
var hs6Data = [];
var hs8Data = [];
var currentTab = "hs6"; // "hs6" or "hs8"

// When DOM ready
document.addEventListener("DOMContentLoaded", function () {
  setupTabs();
  setupExporterDropdown();

  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  // Load HS6 first, then HS8, then initialize UI
  loadCsv(HS6_PATH, "hs6", function () {
    loadCsv(HS8_PATH, "hs8", function () {

      currentTab = "hs6"; // default tab
      populateControlsForCurrentTab();
      applyFilters();

    });
  });
});

// --------------------------------------------------------
// Load CSV and map to unified structure
// --------------------------------------------------------
function loadCsv(path, type, callback) {
  fetch(path)
    .then(resp => resp.text())
    .then(csvText => {
      var parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true
      });

      var rows = parsed.data;
      var mapped = [];

      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var d = new Date(r.date_eff);

        if (isNaN(d)) continue;

        if (type === "hs6") {
          mapped.push({
            importer: (r.importer || "").trim(),
            exporter: (r.exporter || "").trim(),
            product: (r.hs6 || "").trim(),
            date: d,
            tariff: parseFloat(r.tariffs || 0),
            tradeValue: parseFloat(r.importsvaluein1000usd || 0) * 1000
          });

        } else if (type === "hs8") {
          mapped.push({
            importer: (r.importer || "").trim(),
            exporter: (r.exporter || "").trim(),
            product: (r.product || "").trim(),
            date: d,
            tariff: parseFloat(r.applied_tariff || 0),
            tradeValue: parseFloat(r.imports_value_usd || 0)
          });
        }
      }

      if (type === "hs6") hs6Data = mapped;
      else hs8Data = mapped;

      if (callback) callback();
    })
    .catch(err => console.error("CSV load error:", path, err));
}

// --------------------------------------------------------
// Tabs
// --------------------------------------------------------
function setupTabs() {
  var btns = document.querySelectorAll(".tab-button");

  btns.forEach(btn => {
    btn.addEventListener("click", function () {

      // switch highlight
      btns.forEach(b => b.classList.remove("active"));
      this.classList.add("active");

      // switch active tab
      currentTab = this.getAttribute("data-tab");

      // show the correct container
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      document.getElementById("tab-" + currentTab).classList.add("active");

      // reload controls, redraw
      populateControlsForCurrentTab();
      applyFilters();

    });
  });
}

// --------------------------------------------------------
// Exporter dropdown
// --------------------------------------------------------
function setupExporterDropdown() {
  var disp = document.getElementById("exporterDisplay");
  var panel = document.getElementById("exporterBox");

  disp.addEventListener("click", function (e) {
    e.stopPropagation();
    panel.style.display = panel.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", function () {
    panel.style.display = "none";
  });
}

function updateExporterDisplayText() {
  var cbs = document.querySelectorAll(".exporter-checkbox:checked");
  var span = document.getElementById("exporterDisplayText");

  if (!span) return;

  if (cbs.length === 0) span.innerHTML = "World (aggregate)";
  else if (cbs.length === 1) span.innerHTML = cbs[0].value;
  else span.innerHTML = cbs.length + " exporters selected";
}

// --------------------------------------------------------
// Active dataset
// --------------------------------------------------------
function getActiveData() {
  return currentTab === "hs6" ? hs6Data : hs8Data;
}

// --------------------------------------------------------
// Populate importers, exporters, products dynamically
// --------------------------------------------------------
function populateControlsForCurrentTab() {
  var data = getActiveData();
  if (!data.length) return;

  // IMPORTERS
  var impSel = document.getElementById("importerSelect");
  impSel.innerHTML = "";

  var impSet = [...new Set(data.map(d => d.importer))].sort();

  impSel.innerHTML = `<option value="">All importers</option>` +
    impSet.map(i => `<option value="${i}">${i}</option>`).join("");

  // EXPORTERS (checkbox)
  var exporterBox = document.getElementById("exporterBox");
  exporterBox.innerHTML = "";

  var expSet = [...new Set(data.map(d => d.exporter))].sort();

  expSet.forEach(e => {
    exporterBox.innerHTML +=
      `<label><input type='checkbox' class='exporter-checkbox' value='${e}'> ${e}</label>`;
  });

  updateExporterDisplayText();

  // PRODUCT SELECTOR (HS6 uses hs6ProductSelect, HS8 uses hs8ProductSelect)
  var productSet = [...new Set(data.map(d => d.product))].sort();

  if (currentTab === "hs6") {
    var pSel = document.getElementById("hs6ProductSelect");
    pSel.innerHTML = `<option value="">All HS6 codes</option>` +
      productSet.map(p => `<option value="${p}">${p}</option>`).join("");
  } else {
    var pSel8 = document.getElementById("hs8ProductSelect");
    pSel8.innerHTML = `<option value="">All HS8 codes</option>` +
      productSet.map(p => `<option value="${p}">${p}</option>`).join("");
  }

  // Reset date inputs
  document.getElementById("dateFrom").value = "";
  document.getElementById("dateTo").value = "";
}

// --------------------------------------------------------
// Apply filters
// --------------------------------------------------------
function applyFilters() {
  var data = getActiveData();
  if (!data.length) return;

  var importerVal = document.getElementById("importerSelect").value;

  var productVal =
    currentTab === "hs6"
      ? document.getElementById("hs6ProductSelect").value
      : document.getElementById("hs8ProductSelect").value;

  var dateFromVal = document.getElementById("dateFrom").value;
  var dateToVal = document.getElementById("dateTo").value;

  var start = dateFromVal ? new Date(dateFromVal) : null;
  var end = dateToVal ? new Date(dateToVal) : null;

  var selectedExporters = [...document.querySelectorAll(".exporter-checkbox:checked")]
    .map(cb => cb.value);

  updateExporterDisplayText();

  var filtered = data.filter(d => {
    if (importerVal && d.importer !== importerVal) return false;
    if (productVal && d.product !== productVal) return false;
    if (selectedExporters.length && !selectedExporters.includes(d.exporter)) return false;
    if (start && d.date < start) return false;
    if (end && d.date > end) return false;
    return true;
  });

  drawChart(currentTab, filtered, selectedExporters);
  updateSummary(currentTab, filtered, selectedExporters);
}

// --------------------------------------------------------
// Draw Chart (true date scaling)
// --------------------------------------------------------
function drawChart(tabId, data, selectedExporters) {
  var divId = tabId === "hs6" ? "tariffChartHS6" : "tariffChartHS8";
  var div = document.getElementById(divId);

  if (!data.length) {
    Plotly.newPlot(div, [], { title: "No data available" });
    return;
  }

  var worldMode = selectedExporters.length === 0;
  var traces = [];
  var tickvals = [];
  var ticktext = [];

  // ===== WORLD MODE =====
  if (worldMode) {
    var grouped = {};

    data.forEach(d => {
      var key = d.date.toLocaleDateString("en-US");
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(d.tariff);
    });

    var ks = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

    var dates = ks.map(k => new Date(k));
    var values = ks.map(k => grouped[k].reduce((a, b) => a + b) / grouped[k].length);

    tickvals = dates;
    ticktext = ks;

    traces.push({
      x: dates,
      y: values,
      mode: "lines+markers",
      name: "World",
      line: { shape: "hv", width: 3, color: "#003366" },
      marker: { size: 8, color: "#003366" }
    });

  } else {
    // ===== MULTI EXPORTER MODE =====
    var dateKeys = [...new Set(data.map(d => d.date.toLocaleDateString("en-US")))]
      .sort((a, b) => new Date(a) - new Date(b));

    tickvals = dateKeys.map(k => new Date(k));
    ticktext = dateKeys;

    selectedExporters.forEach(exp => {
      var grouped = {};

      data.forEach(d => {
        if (d.exporter !== exp) return;
        var k = d.date.toLocaleDateString("en-US");
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(d.tariff);
      });

      var yvals = dateKeys.map(k => {
        if (!grouped[k]) return null;
        return grouped[k].reduce((a, b) => a + b) / grouped[k].length;
      });

      traces.push({
        x: tickvals,
        y: yvals,
        mode: "lines+markers",
        name: exp,
        line: { shape: "hv", width: 2 },
        marker: { size: 7 }
      });
    });
  }

  var layout = {
    title: (tabId === "hs6" ? "HS6" : "HS8") + " Tariff Trend",
    xaxis: {
      title: "Date",
      type: "date",
      tickmode: "array",
      tickvals: tickvals,
      ticktext: ticktext,
      tickangle: -45
    },
    yaxis: { title: "Tariff (%)" },
    font: { family: "Georgia, serif", size: 14 },
    plot_bgcolor: "#fff",
    paper_bgcolor: "#fff",
    showlegend: !worldMode
  };

  Plotly.newPlot(div, traces, layout);
}

// --------------------------------------------------------
// Summary Tables (HS6 / HS8)
// --------------------------------------------------------
function updateSummary(tabId, data, selectedExporters) {
  var tableId = tabId === "hs6" ? "summaryTableHS6" : "summaryTableHS8";
  var titleId = tabId === "hs6" ? "summary-title-hs6" : "summary-title-hs8";

  var tbody = document.querySelector("#" + tableId + " tbody");
  var title = document.getElementById(titleId);

  if (!data.length) {
    tbody.innerHTML = "<tr><td colspan='7'>No data available</td></tr>";
    title.textContent = "";
    return;
  }

  var importer = document.getElementById("importerSelect").value || "All importers";
  var product =
    tabId === "hs6"
      ? document.getElementById("hs6ProductSelect").value || "All HS6 codes"
      : document.getElementById("hs8ProductSelect").value || "All HS8 codes";

  var exporterLabel =
    selectedExporters.length === 0
      ? "World"
      : selectedExporters.length === 1
        ? selectedExporters[0]
        : "Selected exporters";

  title.textContent = importer + " imports from " + exporterLabel + " — " + product;

  var grouped = {};

  data.forEach(d => {
    var dk = d.date.toLocaleDateString("en-US");
    var key = d.exporter + "_" + dk;

    if (!grouped[key]) {
      grouped[key] = {
        exporter: d.exporter,
        date: dk,
        tariffs: [],
        values: [],
        weightedTariffs: []
      };
    }
    grouped[key].tariffs.push(d.tariff);
    grouped[key].values.push(d.tradeValue);
    grouped[key].weightedTariffs.push(d.tariff * d.tradeValue);
  });

  var html = "";
  Object.values(grouped).forEach(g => {
    var avg = g.tariffs.reduce((a, b) => a + b) / g.tariffs.length;
    var total = g.values.reduce((a, b) => a + b);
    var wavg = g.weightedTariffs.reduce((a, b) => a + b) / total;

    html +=
      "<tr>" +
      "<td>" + g.exporter + "</td>" +
      "<td>" + g.date + "</td>" +
      "<td>" + avg.toFixed(3) + "</td>" +
      "<td>" + wavg.toFixed(3) + "</td>" +
      "<td>" + total.toFixed(3) + "</td>" +
      "<td>100%</td>" +
      "<td>100%</td>" +
      "</tr>";
  });

  tbody.innerHTML = html;

  if ($.fn.DataTable.isDataTable("#" + tableId)) {
    $("#" + tableId).DataTable().destroy();
  }

  $("#" + tableId).DataTable({
    pageLength: 5,
    order: [[1, "asc"]]
  });
}
