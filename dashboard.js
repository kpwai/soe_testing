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

  // Load both datasets
  loadCsv(HS6_PATH, "hs6", function () {
    loadCsv(HS8_PATH, "hs8", function () {
      // After both loaded, initialize controls for HS6 and draw first view
      currentTab = "hs6";
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
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to load " + path);
      }
      return response.text();
    })
    .then(function (csvText) {
      var result = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true
      });

      var rows = result.data;
      var mapped = [];

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];

        // Parse date (M/D/Y)
        var d = new Date(row.date_eff);

        if (isNaN(d.getTime())) {
          // skip invalid date rows
          continue;
        }

        if (type === "hs6") {
          // HS6: importer, exporter, hs6, date_eff, tariffs, importsvaluein1000usd, affected_trade_value
          var importer = (row.importer || "").trim();
          var exporter = (row.exporter || "").trim();
          var product = (row.hs6 || "").trim();
          var tariff = parseFloat(row.tariffs || 0);
          var tradeValThousand = parseFloat(row.importsvaluein1000usd || 0);
          var tradeValue = tradeValThousand * 1000; // convert to USD

          mapped.push({
            importer: importer,
            exporter: exporter,
            product: product,
            date: d,
            tariff: isNaN(tariff) ? 0 : tariff,
            tradeValue: isNaN(tradeValue) ? 0 : tradeValue
          });
        } else if (type === "hs8") {
          // HS8: importer, exporter, product, date_eff, applied_tariff, imports_value_usd, iseu
          var importer8 = (row.importer || "").trim();
          var exporter8 = (row.exporter || "").trim();
          var product8 = (row.product || "").trim();
          var tariff8 = parseFloat(row.applied_tariff || 0);
          var tradeValue8 = parseFloat(row.imports_value_usd || 0);

          mapped.push({
            importer: importer8,
            exporter: exporter8,
            product: product8,
            date: d,
            tariff: isNaN(tariff8) ? 0 : tariff8,
            tradeValue: isNaN(tradeValue8) ? 0 : tradeValue8
          });
        }
      }

      if (type === "hs6") {
        hs6Data = mapped;
      } else {
        hs8Data = mapped;
      }

      if (typeof callback === "function") {
        callback();
      }
    })
    .catch(function (err) {
      console.error("Error loading", path, err);
      if (type === "hs6") {
        var div6 = document.getElementById("tariffChartHS6");
        if (div6) {
          div6.innerHTML = "<p style='color:red'>Failed to load HS6 data.</p>";
        }
      } else {
        var div8 = document.getElementById("tariffChartHS8");
        if (div8) {
          div8.innerHTML = "<p style='color:red'>Failed to load HS8 data.</p>";
        }
      }
      if (typeof callback === "function") {
        callback();
      }
    });
}

// --------------------------------------------------------
// Tabs: HS6 / HS8
// --------------------------------------------------------
function setupTabs() {
  var buttons = document.querySelectorAll(".tab-button");

  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener("click", function () {
      // Switch active button
      for (var j = 0; j < buttons.length; j++) {
        buttons[j].classList.remove("active");
      }
      this.classList.add("active");

      // Switch tab content
      var tab = this.getAttribute("data-tab");
      currentTab = tab;

      var contents = document.querySelectorAll(".tab-content");
      for (var k = 0; k < contents.length; k++) {
        contents[k].classList.remove("active");
      }
      var activeDiv = document.getElementById("tab-" + tab);
      if (activeDiv) {
        activeDiv.classList.add("active");
      }

      // Rebuild controls from the active dataset
      populateControlsForCurrentTab();
      applyFilters();
    });
  }
}

// --------------------------------------------------------
// Exporter checkbox dropdown behavior
// --------------------------------------------------------
function setupExporterDropdown() {
  var display = document.getElementById("exporterDisplay");
  var panel = document.getElementById("exporterBox");

  if (!display || !panel) return;

  display.addEventListener("click", function (e) {
    e.stopPropagation();
    if (panel.style.display === "block") {
      panel.style.display = "none";
    } else {
      panel.style.display = "block";
    }
  });

  document.addEventListener("click", function () {
    panel.style.display = "none";
  });

  panel.addEventListener("click", function (e) {
    e.stopPropagation();
  });
}

function updateExporterDisplayText() {
  var textSpan = document.getElementById("exporterDisplayText");
  if (!textSpan) return;

  var cbs = document.querySelectorAll(".exporter-checkbox:checked");
  if (!cbs || cbs.length === 0) {
    textSpan.textContent = "World (aggregate)";
    return;
  }

  if (cbs.length === 1) {
    textSpan.textContent = cbs[0].value;
  } else {
    textSpan.textContent = cbs.length + " exporters selected";
  }
}

// --------------------------------------------------------
// Controls population (per active tab)
// --------------------------------------------------------
function getActiveData() {
  return currentTab === "hs6" ? hs6Data : hs8Data;
}

function populateControlsForCurrentTab() {
  var data = getActiveData();
  if (!data || data.length === 0) return;

  // Importers
  var importerSelect = document.getElementById("importerSelect");
  importerSelect.innerHTML = "";

  var importersSet = {};
  for (var i = 0; i < data.length; i++) {
    importersSet[data[i].importer] = true;
  }
  var importers = Object.keys(importersSet).sort();

  // Add "All importers"
  var optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "All importers";
  importerSelect.appendChild(optAll);

  for (var j = 0; j < importers.length; j++) {
    var op = document.createElement("option");
    op.value = importers[j];
    op.textContent = importers[j];
    importerSelect.appendChild(op);
  }

  // Exporters
  var exporterBox = document.getElementById("exporterBox");
  exporterBox.innerHTML = "";

  var exportersSet = {};
  for (var k = 0; k < data.length; k++) {
    exportersSet[data[k].exporter] = true;
  }
  var exporters = Object.keys(exportersSet).sort();

  for (var e = 0; e < exporters.length; e++) {
    var exp = exporters[e];
    var label = document.createElement("label");
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "exporter-checkbox";
    cb.value = exp;

    label.appendChild(cb);
    label.appendChild(document.createTextNode(" " + exp));
    exporterBox.appendChild(label);
  }

  updateExporterDisplayText();

  // Products
  var productSelect = document.getElementById("productSelect");
  productSelect.innerHTML = "";

  var pAll = document.createElement("option");
  pAll.value = "";
  pAll.textContent = "All products";
  productSelect.appendChild(pAll);

  var productSet = {};
  for (var p = 0; p < data.length; p++) {
    productSet[data[p].product] = true;
  }
  var products = Object.keys(productSet).sort();

  for (var q = 0; q < products.length; q++) {
    var po = document.createElement("option");
    po.value = products[q];
    po.textContent = products[q];
    productSelect.appendChild(po);
  }

  // Reset date filters
  document.getElementById("dateFrom").value = "";
  document.getElementById("dateTo").value = "";
}

// --------------------------------------------------------
// Apply filters based on controls
// --------------------------------------------------------
function applyFilters() {
  var data = getActiveData();
  if (!data || data.length === 0) return;

  var importerVal = document.getElementById("importerSelect").value;
  var productVal = document.getElementById("productSelect").value;
  var dateFromVal = document.getElementById("dateFrom").value;
  var dateToVal = document.getElementById("dateTo").value;

  var startDate = dateFromVal ? new Date(dateFromVal) : null;
  var endDate = dateToVal ? new Date(dateToVal) : null;

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

    if (importerVal && d.importer !== importerVal) {
      continue;
    }

    if (productVal && d.product !== productVal) {
      continue;
    }

    if (selectedExporters.length > 0) {
      if (selectedExporters.indexOf(d.exporter) === -1) {
        continue;
      }
    }

    if (startDate && d.date < startDate) {
      continue;
    }
    if (endDate && d.date > endDate) {
      continue;
    }

    filtered.push(d);
  }

  // Draw chart and summary for the active tab
  if (currentTab === "hs6") {
    drawChart("hs6", filtered, selectedExporters);
    updateSummary("hs6", filtered, selectedExporters);
  } else {
    drawChart("hs8", filtered, selectedExporters);
    updateSummary("hs8", filtered, selectedExporters);
  }
}

// --------------------------------------------------------
// Draw chart (HS6 or HS8) with true date scaling
// --------------------------------------------------------
function drawChart(tabId, data, selectedExporters) {
  var chartDivId = tabId === "hs6" ? "tariffChartHS6" : "tariffChartHS8";
  var chartDiv = document.getElementById(chartDivId);

  if (!chartDiv) return;

  if (!data || data.length === 0) {
    Plotly.newPlot(chartDiv, [], { title: "No data available" });
    return;
  }

  var worldMode = selectedExporters.length === 0;
  var traces = [];
  var tickvals = [];
  var ticktext = [];

  if (worldMode) {
    // Aggregate over all exporters per date
    var grouped = {};
    var key;

    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var dateKey = d.date.toLocaleDateString("en-US");
      key = dateKey;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(d.tariff);
    }

    var keys = Object.keys(grouped).sort(function (a, b) {
      return new Date(a) - new Date(b);
    });

    var dates = [];
    var values = [];

    for (var j = 0; j < keys.length; j++) {
      var k = keys[j];
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
    // Multi-exporter lines
    var dateSet = {};
    for (var dIndex = 0; dIndex < data.length; dIndex++) {
      var d2 = data[dIndex];
      var dk = d2.date.toLocaleDateString("en-US");
      dateSet[dk] = true;
    }

    var sortedKeys = Object.keys(dateSet).sort(function (a, b) {
      return new Date(a) - new Date(b);
    });
    var sortedDates = [];
    for (var sd = 0; sd < sortedKeys.length; sd++) {
      sortedDates.push(new Date(sortedKeys[sd]));
    }

    tickvals = sortedDates;
    ticktext = sortedKeys;

    for (var e = 0; e < selectedExporters.length; e++) {
      var exp = selectedExporters[e];

      // collect tariffs by date for this exporter
      var daily = {};
      for (var r = 0; r < data.length; r++) {
        var row = data[r];
        if (row.exporter !== exp) continue;
        var dayKey = row.date.toLocaleDateString("en-US");
        if (!daily[dayKey]) daily[dayKey] = [];
        daily[dayKey].push(row.tariff);
      }

      var yvals = [];
      for (var k2 = 0; k2 < sortedKeys.length; k2++) {
        var sk = sortedKeys[k2];
        if (!daily[sk]) {
          yvals.push(null);
        } else {
          var arr2 = daily[sk];
          var sum2 = 0;
          for (var a = 0; a < arr2.length; a++) sum2 += arr2[a];
          yvals.push(sum2 / arr2.length);
        }
      }

      traces.push({
        x: sortedDates,
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
// Summary table (HS6 / HS8)
// --------------------------------------------------------
function updateSummary(tabId, data, selectedExporters) {
  var tableId = tabId === "hs6" ? "summaryTableHS6" : "summaryTableHS8";
  var titleId = tabId === "hs6" ? "summary-title-hs6" : "summary-title-hs8";

  var tbody = document.querySelector("#" + tableId + " tbody");
  var titleEl = document.getElementById(titleId);

  if (!tbody || !titleEl) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='7'>No data available</td></tr>";
    titleEl.textContent = "";
    return;
  }

  var importerSel = document.getElementById("importerSelect").value;
  var importerLabel = importerSel ? importerSel : "All importers";

  var exporterLabel;
  if (!selectedExporters || selectedExporters.length === 0) {
    exporterLabel = "World";
  } else if (selectedExporters.length === 1) {
    exporterLabel = selectedExporters[0];
  } else {
    exporterLabel = "Selected exporters";
  }

  var productSel = document.getElementById("productSelect").value;
  var productLabel = productSel ? productSel : "All products";

  titleEl.textContent =
    importerLabel + " imports from " + exporterLabel + " — " + productLabel;

  // Group by exporter + date
  var grouped = {};
  var i;
  for (i = 0; i < data.length; i++) {
    var d = data[i];
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
  }

  var groups = Object.keys(grouped).map(function (k) {
    return grouped[k];
  });

  // Build HTML rows
  var htmlRows = "";
  for (i = 0; i < groups.length; i++) {
    var g = groups[i];

    var sumTar = 0;
    for (var t = 0; t < g.tariffs.length; t++) sumTar += g.tariffs[t];
    var simpleAvg = g.tariffs.length ? sumTar / g.tariffs.length : 0;

    var sumVal = 0;
    for (var v = 0; v < g.values.length; v++) sumVal += g.values[v];

    var sumWV = 0;
    for (var w = 0; w < g.weightedTariffs.length; w++) sumWV += g.weightedTariffs[w];
    var tradeWeighted = sumVal ? sumWV / sumVal : 0;

    htmlRows +=
      "<tr>" +
      "<td>" + g.exporter + "</td>" +
      "<td>" + g.date + "</td>" +
      "<td>" + simpleAvg.toFixed(3) + "</td>" +
      "<td>" + tradeWeighted.toFixed(3) + "</td>" +
      "<td>" + sumVal.toFixed(3) + "</td>" +
      "<td>100%</td>" +
      "<td>100%</td>" +
      "</tr>";
  }

  // Rebuild DataTable
  if ($.fn.DataTable.isDataTable("#" + tableId)) {
    $("#" + tableId).DataTable().destroy();
  }
  tbody.innerHTML = htmlRows;
  $("#" + tableId).DataTable({
    pageLength: 5,
    order: [[1, "asc"]]
  });
}
