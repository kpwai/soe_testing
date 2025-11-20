// ========================================================
// Trade Model (CP) Equilibrium Dashboard — HS6 + HS8
// ========================================================

// === CSV paths ===
var HS6_PATH = "data/tariff_datahs6.csv";
var HS8_PATH = "data/tariff_datahs8.csv";

// === Global data ===
var hs6Data = [];
var hs8Data = [];
var currentTab = "hs6"; // "hs6" or "hs8"

// === Fixed importer list ===
var FIXED_IMPORTERS = [
  { value: "World",        label: "World (all importers)" },
  { value: "Cambodia",     label: "Cambodia" },
  { value: "Canada",       label: "Canada" },
  { value: "China",        label: "China" },
  { value: "India",        label: "India" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "United States",  label: "United States" },
  { value: "Zimbabwe",     label: "Zimbabwe" }
];

// --------------------------------------------------------
// DOMContentLoaded
// --------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
  setupTabs();
  setupExporterDropdown();

  var applyBtn = document.getElementById("applyFilters");
  if (applyBtn) {
    applyBtn.addEventListener("click", applyFilters);
  }

  // Load HS6 first, then HS8
  loadCsv(HS6_PATH, "hs6", function () {
    loadCsv(HS8_PATH, "hs8", function () {
      currentTab = "hs6"; // default
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
    .then(function (resp) {
      if (!resp.ok) throw new Error("Failed to load " + path);
      return resp.text();
    })
    .then(function (csvText) {
      var parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true
      });

      var rows = parsed.data;
      var mapped = [];

      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var d = new Date(r.date_eff);
        if (isNaN(d)) continue; // skip invalid

        if (type === "hs6") {
          // importer,exporter,hs6,date_eff,tariffs,importsvaluein1000usd,affected_trade_value
          var importer6 = (r.importer || "").trim();
          var exporter6 = (r.exporter || "").trim();
          var product6  = (r.hs6 || "").trim();
          var tariff6   = parseFloat(r.tariffs || 0);
          var trade6k   = parseFloat(r.importsvaluein1000usd || 0);
          var trade6    = isNaN(trade6k) ? 0 : trade6k * 1000;

          mapped.push({
            importer: importer6,
            exporter: exporter6,
            product:  product6,
            date:     d,
            tariff:   isNaN(tariff6) ? 0 : tariff6,
            tradeValue: trade6
          });
        } else if (type === "hs8") {
          // importer,exporter,product,date_eff,applied_tariff,imports_value_usd,iseu
          var importer8 = (r.importer || "").trim();
          var exporter8 = (r.exporter || "").trim();
          var product8  = (r.product || "").trim();
          var tariff8   = parseFloat(r.applied_tariff || 0);
          var trade8    = parseFloat(r.imports_value_usd || 0);

          mapped.push({
            importer: importer8,
            exporter: exporter8,
            product:  product8,
            date:     d,
            tariff:   isNaN(tariff8) ? 0 : tariff8,
            tradeValue: isNaN(trade8) ? 0 : trade8
          });
        }
      }

      if (type === "hs6") hs6Data = mapped;
      else hs8Data = mapped;

      if (typeof callback === "function") callback();
    })
    .catch(function (err) {
      console.error("CSV load error:", path, err);
      if (typeof callback === "function") callback();
    });
}

// --------------------------------------------------------
// Tabs: HS6 / HS8
// --------------------------------------------------------
function setupTabs() {
  var btns = document.querySelectorAll(".tab-button");
  if (!btns.length) return;

  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener("click", function () {
      for (var j = 0; j < btns.length; j++) {
        btns[j].classList.remove("active");
      }
      this.classList.add("active");

      currentTab = this.getAttribute("data-tab");

      var contents = document.querySelectorAll(".tab-content");
      for (var k = 0; k < contents.length; k++) {
        contents[k].classList.remove("active");
      }
      var activeDiv = document.getElementById("tab-" + currentTab);
      if (activeDiv) activeDiv.classList.add("active");

      populateControlsForCurrentTab();
      applyFilters();
    });
  }
}

// --------------------------------------------------------
// Exporter multi-select dropdown (checkbox panel)
// --------------------------------------------------------
function setupExporterDropdown() {
  var display = document.getElementById("exporterDisplay");
  var panel   = document.getElementById("exporterBox");

  if (!display || !panel) return;

  display.addEventListener("click", function (e) {
    e.stopPropagation();
    panel.style.display = (panel.style.display === "block") ? "none" : "block";
  });

  document.addEventListener("click", function () {
    panel.style.display = "none";
  });

  panel.addEventListener("click", function (e) {
    e.stopPropagation();
  });
}

function updateExporterDisplayText() {
  var span = document.getElementById("exporterDisplayText");
  if (!span) return;

  var cbs = document.querySelectorAll(".exporter-checkbox:checked");
  if (!cbs.length) {
    span.textContent = "World (aggregate)";
  } else if (cbs.length === 1) {
    span.textContent = cbs[0].value;
  } else {
    span.textContent = cbs.length + " exporters selected";
  }
}

// --------------------------------------------------------
// Helpers
// --------------------------------------------------------
function getActiveData() {
  return currentTab === "hs6" ? hs6Data : hs8Data;
}

// --------------------------------------------------------
// Populate controls (importer, exporter, products, dates)
// --------------------------------------------------------
function populateControlsForCurrentTab() {
  var data = getActiveData();
  if (!data || !data.length) return;

  // === IMPORTERS: FIXED LIST, NEVER FROM DATA ===
  var importerSelect = document.getElementById("importerSelect");
  if (importerSelect) {
    importerSelect.innerHTML = "";
    for (var i = 0; i < FIXED_IMPORTERS.length; i++) {
      var opt = document.createElement("option");
      opt.value = FIXED_IMPORTERS[i].value;
      opt.textContent = FIXED_IMPORTERS[i].label;
      importerSelect.appendChild(opt);
    }
    // default to World
    importerSelect.value = "World";
  }

  // === EXPORTERS: UNION OF HS6 + HS8 ===
  var exporterBox = document.getElementById("exporterBox");
  if (exporterBox) {
    exporterBox.innerHTML = "";

    var unionData = hs6Data.concat(hs8Data);
    var expSet = {};
    for (var j = 0; j < unionData.length; j++) {
      if (unionData[j].exporter) {
        expSet[unionData[j].exporter] = true;
      }
    }
    var exporters = Object.keys(expSet).sort();

    for (var k = 0; k < exporters.length; k++) {
      var label = document.createElement("label");
      var cb    = document.createElement("input");
      cb.type   = "checkbox";
      cb.className = "exporter-checkbox";
      cb.value  = exporters[k];

      label.appendChild(cb);
      label.appendChild(document.createTextNode(" " + exporters[k]));
      exporterBox.appendChild(label);
    }

    updateExporterDisplayText();
  }

  // === PRODUCT SELECTOR ===
  var productSet = {};
  for (var p = 0; p < data.length; p++) {
    if (data[p].product) productSet[data[p].product] = true;
  }
  var products = Object.keys(productSet).sort();

  if (currentTab === "hs6") {
    var hs6Sel = document.getElementById("hs6ProductSelect");
    if (hs6Sel) {
      hs6Sel.innerHTML = "<option value=''>All HS6 codes</option>";
      for (var a = 0; a < products.length; a++) {
        hs6Sel.innerHTML += "<option value='" + products[a] + "'>" + products[a] + "</option>";
      }
    }
  } else {
    var hs8Sel = document.getElementById("hs8ProductSelect");
    if (hs8Sel) {
      hs8Sel.innerHTML = "<option value=''>All HS8 codes</option>";
      for (var b = 0; b < products.length; b++) {
        hs8Sel.innerHTML += "<option value='" + products[b] + "'>" + products[b] + "</option>";
      }
    }
  }

  // Reset dates
  var df = document.getElementById("dateFrom");
  var dt = document.getElementById("dateTo");
  if (df) df.value = "";
  if (dt) dt.value = "";
}

// --------------------------------------------------------
// Apply filters
// --------------------------------------------------------
function applyFilters() {
  var data = getActiveData();
  if (!data || !data.length) return;

  var importerSel = document.getElementById("importerSelect");
  var importerVal = importerSel ? importerSel.value : "World"; // default

  var productVal = "";
  if (currentTab === "hs6") {
    var p6 = document.getElementById("hs6ProductSelect");
    productVal = p6 ? p6.value : "";
  } else {
    var p8 = document.getElementById("hs8ProductSelect");
    productVal = p8 ? p8.value : "";
  }

  var dateFromVal = document.getElementById("dateFrom") ? document.getElementById("dateFrom").value : "";
  var dateToVal   = document.getElementById("dateTo")   ? document.getElementById("dateTo").value   : "";

  var startDate = dateFromVal ? new Date(dateFromVal) : null;
  var endDate   = dateToVal   ? new Date(dateToVal)   : null;

  var exporterChecks = document.querySelectorAll(".exporter-checkbox");
  var selectedExporters = [];
  for (var i = 0; i < exporterChecks.length; i++) {
    if (exporterChecks[i].checked) {
      selectedExporters.push(exporterChecks[i].value);
    }
  }

  updateExporterDisplayText();

  var filtered = [];
  for (var j = 0; j < data.length; j++) {
    var d = data[j];

    // Importer filter:
    // - if "World" => no filter (all records)
    // - if specific importer, filter strictly
    if (importerVal && importerVal !== "World" && d.importer !== importerVal) {
      continue;
    }

    // Product filter
    if (productVal && d.product !== productVal) {
      continue;
    }

    // Exporter filter (if any checked)
    if (selectedExporters.length > 0 && selectedExporters.indexOf(d.exporter) === -1) {
      continue;
    }

    // Date range
    if (startDate && d.date < startDate) continue;
    if (endDate && d.date > endDate)   continue;

    filtered.push(d);
  }

  drawChart(currentTab, filtered, selectedExporters);
  updateSummary(currentTab, filtered, selectedExporters);
}

// --------------------------------------------------------
// Draw chart with true date scaling
// --------------------------------------------------------
function drawChart(tabId, data, selectedExporters) {
  var divId = (tabId === "hs6") ? "tariffChartHS6" : "tariffChartHS8";
  var chartDiv = document.getElementById(divId);
  if (!chartDiv) return;

  if (!data || !data.length) {
    Plotly.newPlot(chartDiv, [], { title: "No data available" });
    return;
  }

  var worldMode = (selectedExporters.length === 0);
  var traces = [];
  var tickvals = [];
  var ticktext = [];

  if (worldMode) {
    // Aggregate over ALL exporters per date
    var grouped = {};
    data.forEach(function(d) {
      var dk = d.date.toLocaleDateString("en-US");
      if (!grouped[dk]) grouped[dk] = [];
      grouped[dk].push(d.tariff);
    });

    var keys = Object.keys(grouped).sort(function(a, b) {
      return new Date(a) - new Date(b);
    });

    var dates = [];
    var values = [];

    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var arr = grouped[k];
      var sum = 0;
      for (var s = 0; s < arr.length; s++) sum += arr[s];
      var avg = sum / arr.length;

      dates.push(new Date(k));
      values.push(avg);
    }

    tickvals = dates;
    ticktext = keys;

    traces.push({
      x: dates,
      y: values,
      mode: "lines+markers",
      name: "World",
      line: { shape: "hv", width: 3, color: "#003366" },
      marker: { size: 8, color: "#003366" }
    });

  } else {
    // Multi-exporter comparison
    var dateSet = {};
    data.forEach(function(d) {
      var key = d.date.toLocaleDateString("en-US");
      dateSet[key] = true;
    });

    var sortedKeys = Object.keys(dateSet).sort(function(a, b) {
      return new Date(a) - new Date(b);
    });
    tickvals = sortedKeys.map(function(k) { return new Date(k); });
    ticktext = sortedKeys;

    // Build one line per exporter
    for (var e = 0; e < selectedExporters.length; e++) {
      var exp = selectedExporters[e];
      var daily = {};

      data.forEach(function(d) {
        if (d.exporter !== exp) return;
        var dk = d.date.toLocaleDateString("en-US");
        if (!daily[dk]) daily[dk] = [];
        daily[dk].push(d.tariff);
      });

      var yvals = [];
      for (var k2 = 0; k2 < sortedKeys.length; k2++) {
        var key2 = sortedKeys[k2];
        if (!daily[key2]) {
          yvals.push(null);
        } else {
          var arr2 = daily[key2];
          var sum2 = 0;
          for (var m = 0; m < arr2.length; m++) sum2 += arr2[m];
          yvals.push(sum2 / arr2.length);
        }
      }

      traces.push({
        x: tickvals,
        y: yvals,
        mode: "lines+markers",
        name: exp,
        line: { shape: "hv", width: 2 },
        marker: { size: 7 }
      });
    }
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

  Plotly.newPlot(chartDiv, traces, layout);
}

// --------------------------------------------------------
// Summary tables (per tab)
// --------------------------------------------------------
function updateSummary(tabId, data, selectedExporters) {
  var tableId = (tabId === "hs6") ? "summaryTableHS6" : "summaryTableHS8";
  var titleId = (tabId === "hs6") ? "summary-title-hs6" : "summary-title-hs8";

  var tbody = document.querySelector("#" + tableId + " tbody");
  var title = document.getElementById(titleId);
  if (!tbody || !title) return;

  if (!data || !data.length) {
    tbody.innerHTML = "<tr><td colspan='7'>No data available</td></tr>";
    title.textContent = "";
    return;
  }

  var importerSel = document.getElementById("importerSelect");
  var importerVal = importerSel ? importerSel.value : "World";

  var importerLabel =
    (!importerVal || importerVal === "World") ? "World (all importers)" : importerVal;

  var productVal = "";
  if (tabId === "hs6") {
    var p6 = document.getElementById("hs6ProductSelect");
    productVal = p6 && p6.value ? p6.value : "All HS6 codes";
  } else {
    var p8 = document.getElementById("hs8ProductSelect");
    productVal = p8 && p8.value ? p8.value : "All HS8 codes";
  }

  var exporterLabel;
  if (!selectedExporters.length) {
    exporterLabel = "World";
  } else if (selectedExporters.length === 1) {
    exporterLabel = selectedExporters[0];
  } else {
    exporterLabel = "Selected exporters";
  }

  title.textContent = importerLabel + " imports from " + exporterLabel + " — " + productVal;

  // Group by exporter + date
  var grouped = {};
  data.forEach(function(d) {
    var dateKey = d.date.toLocaleDateString("en-US");
    var key = d.exporter + "_" + dateKey;

    if (!grouped[key]) {
      grouped[key] = {
        exporter: d.exporter,
        date: dateKey,
        tariffs: [],
        weightedTariffs: [],
        values: []
      };
    }

    grouped[key].tariffs.push(d.tariff);
    grouped[key].weightedTariffs.push(d.tariff * d.tradeValue);
    grouped[key].values.push(d.tradeValue);
  });

  var rows = Object.values(grouped);
  var html = "";

  rows.forEach(function(g) {
    var sumTar = g.tariffs.reduce(function(a, b) { return a + b; }, 0);
    var simpleAvg = g.tariffs.length ? sumTar / g.tariffs.length : 0;

    var sumVal = g.values.reduce(function(a, b) { return a + b; }, 0);
    var sumWV  = g.weightedTariffs.reduce(function(a, b) { return a + b; }, 0);
    var tradeWeighted = sumVal ? (sumWV / sumVal) : 0;

    html +=
      "<tr>" +
      "<td>" + g.exporter + "</td>" +
      "<td>" + g.date + "</td>" +
      "<td>" + simpleAvg.toFixed(3) + "</td>" +
      "<td>" + tradeWeighted.toFixed(3) + "</td>" +
      "<td>" + sumVal.toFixed(3) + "</td>" +
      "<td>100%</td>" +
      "<td>100%</td>" +
      "</tr>";
  });

  tbody.innerHTML = html;

  if ($.fn.DataTable && $.fn.DataTable.isDataTable("#" + tableId)) {
    $("#" + tableId).DataTable().destroy();
  }

  $("#" + tableId).DataTable({
    pageLength: 5,
    order: [[1, "asc"]]
  });
}
