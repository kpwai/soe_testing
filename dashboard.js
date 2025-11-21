// ========================================================
// Trade Model (CP) Equilibrium Dashboard — ISIC2 + HS6
// ========================================================

// CSV paths
var EXPORTER_PATH      = "data/exporters.csv";
var ISIC_CODE_PATH     = "data/isic4_2_product_name.csv";
var HS6_CODE_PATH      = "data/hs6code.csv";
var ISIC_TARIFF_PATH   = "data/isic2tariff.csv";
var HS6_TARIFF_PATH    = "data/hs6tariff.csv";

// Global data
var exporterList = [];
var isicCodeList = [];   // { code, description }
var hs6CodeList  = [];   // { code, name }

var isicTariffData = []; // rows from isic2tariff.csv
var hs6TariffData  = []; // rows from hs6tariff.csv

var currentTab = "hs6";  // "hs6" or "hs8" (just controls which chart/table DOM gets updated)

var isicTariffLoaded = false;
var hs6TariffLoaded  = false;

// --------------------------------------------------------
// DOM Ready
// --------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
  setupTabs();
  setupExporterDropdown();

  // Load selection lists first, then tariff data, then draw
  loadExporterOptions(function () {
    loadIsicOptions(function () {
      loadHs6Options(function () {
        loadTariffCsv(ISIC_TARIFF_PATH, "isic", function () {
          loadTariffCsv(HS6_TARIFF_PATH, "hs6", function () {
            // All data loaded; initial draw
            applyFilters();
          });
        });
      });
    });
  });

  var btnApply = document.getElementById("applyFilters");
  if (btnApply) {
    btnApply.addEventListener("click", applyFilters);
  }
});

// --------------------------------------------------------
// Utility: ISIC 4_2 -> 2-digit code
// --------------------------------------------------------
function normalizeIsic2(codeRaw) {
  if (!codeRaw) return "";
  var digits = String(codeRaw).replace(/\D/g, "");  // keep digits only
  if (!digits) return "";
  if (digits.length >= 2) {
    return digits.slice(0, 2);                     // take first 2 digits
  }
  // if single digit, pad with leading zero
  return digits.padStart(2, "0");
}

// --------------------------------------------------------
// Tabs: HS6 / HS8 (just switches which chart/summary to show)
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

      // Switch content
      var tab = this.getAttribute("data-tab");
      currentTab = tab;

      var contents = document.querySelectorAll(".tab-content");
      for (var k = 0; k < contents.length; k++) {
        contents[k].classList.remove("active");
      }
      var activeDiv = document.getElementById("tab-" + tab);
      if (activeDiv) activeDiv.classList.add("active");

      // Redraw with current filters for the new visible tab
      applyFilters();
    });
  }
}

// --------------------------------------------------------
// Exporter checkbox dropdown behaviour
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
  var textSpan = document.getElementById("exporterDisplayText");
  if (!textSpan) return;

  var cbs = document.querySelectorAll(".exporter-checkbox:checked");
  if (!cbs || cbs.length === 0) {
    textSpan.textContent = "World (All Exporters)";
    return;
  }
  if (cbs.length === 1) {
    textSpan.textContent = cbs[0].value;
  } else {
    textSpan.textContent = cbs.length + " exporters selected";
  }
}

// --------------------------------------------------------
// Load exporter options from exporter.csv
// --------------------------------------------------------
function loadExporterOptions(callback) {
  Papa.parse(EXPORTER_PATH, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      exporterList = [];
      var seen = {};

      results.data.forEach(function (row) {
        var exp = (row.exporter || "").trim();
        if (!exp) return;
        if (!seen[exp]) {
          seen[exp] = true;
          exporterList.push(exp);
        }
      });

      exporterList.sort();
      buildExporterCheckboxes();
      updateExporterDisplayText();

      if (typeof callback === "function") callback();
    },
    error: function (err) {
      console.error("Error loading exporter.csv:", err);
      if (typeof callback === "function") callback();
    }
  });
}

function buildExporterCheckboxes() {
  var exporterBox = document.getElementById("exporterBox");
  if (!exporterBox) return;
  exporterBox.innerHTML = "";

  for (var i = 0; i < exporterList.length; i++) {
    var exp = exporterList[i];
    var label = document.createElement("label");
    var cb    = document.createElement("input");
    cb.type   = "checkbox";
    cb.className = "exporter-checkbox";
    cb.value  = exp;

    label.appendChild(cb);
    label.appendChild(document.createTextNode(" " + exp));
    exporterBox.appendChild(label);
  }

  // You could pre-check some if needed here
}

// --------------------------------------------------------
// Load ISIC options from isic2digit.csv
// --------------------------------------------------------
function loadIsicOptions(callback) {
  Papa.parse(ISIC_CODE_PATH, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      isicCodeList = [];
      var seen = {};

      results.data.forEach(function (row) {
        var raw = (row.isic4_2 || "").trim();
        var code2 = normalizeIsic2(raw);
        if (!code2) return;

        if (!seen[code2]) {
          seen[code2] = true;
          isicCodeList.push({
            code: code2,
            description: (row.description || "").trim()
          });
        }
      });

      isicCodeList.sort(function (a, b) {
        return a.code.localeCompare(b.code);
      });

      buildIsicSelect();
      if (typeof callback === "function") callback();
    },
    error: function (err) {
      console.error("Error loading isic2digit.csv:", err);
      if (typeof callback === "function") callback();
    }
  });
}

function buildIsicSelect() {
  var sel = document.getElementById("isicSelect");
  if (!sel) return;

  // keep the first "All" option; append the rest
  for (var i = 0; i < isicCodeList.length; i++) {
    var item = isicCodeList[i];
    var opt = document.createElement("option");
    opt.value = item.code;
    if (item.description) {
      opt.textContent = item.code + " — " + item.description;
    } else {
      opt.textContent = item.code;
    }
    sel.appendChild(opt);
  }
}

// --------------------------------------------------------
// Load HS6 options from hs6code.csv
// --------------------------------------------------------
function loadHs6Options(callback) {
  Papa.parse(HS6_CODE_PATH, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      hs6CodeList = [];
      var seen = {};

      results.data.forEach(function (row) {
        var code = (row.hs6code || "").trim();
        if (!code) return;
        if (!seen[code]) {
          seen[code] = true;
          hs6CodeList.push({
            code: code,
            name: (row.hs6name || "").trim()
          });
        }
      });

      hs6CodeList.sort(function (a, b) {
        return a.code.localeCompare(b.code);
      });

      buildHs6Select();
      if (typeof callback === "function") callback();
    },
    error: function (err) {
      console.error("Error loading hs6code.csv:", err);
      if (typeof callback === "function") callback();
    }
  });
}

function buildHs6Select() {
  var sel = document.getElementById("hs6Select");
  if (!sel) return;

  // keep the first "All" option; append the rest
  for (var i = 0; i < hs6CodeList.length; i++) {
    var item = hs6CodeList[i];
    var opt = document.createElement("option");
    opt.value = item.code;
    if (item.name) {
      opt.textContent = item.code + " — " + item.name;
    } else {
      opt.textContent = item.code;
    }
    sel.appendChild(opt);
  }
}

// --------------------------------------------------------
// Load tariff CSVs (ISIC or HS6) and map to unified structure
// --------------------------------------------------------
function loadTariffCsv(path, mode, callback) {
  fetch(path)
    .then(function (response) {
      if (!response.ok) throw new Error("Failed to load " + path);
      return response.text();
    })
    .then(function (csvText) {
      var parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true
      });
      var rows = parsed.data;
      var mapped = [];

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];

        var d = new Date(row.date_eff);
        if (isNaN(d.getTime())) {
          continue; // skip invalid date
        }

        var importer = (row.importer || "").trim();
        var exporter = (row.exporter || "").trim();
        var tariff   = parseFloat(row.tariffs || 0);
        var importsThousand = parseFloat(row.importsvaluein1000usd || 0);
        var tradeValue = isNaN(importsThousand) ? 0 : importsThousand * 1000;

        var affectedTradeValue = parseFloat(row.affected_trade_value || 0);
        var affectedShare      = parseFloat(row.affected_trade_share || 0);
        var lineShare          = parseFloat(row.affected_hs6tariff_line_share || 0);

        var code = "";
        if (mode === "isic") {
          code = normalizeIsic2(row.isic4_2 || "");
        } else if (mode === "hs6") {
          code = (row.hs6 || "").trim();
        }

        mapped.push({
          importer: importer,
          exporter: exporter,
          code: code,                      // ISIC2 or HS6
          date: d,
          tariff: isNaN(tariff) ? 0 : tariff,
          tradeValue: isNaN(tradeValue) ? 0 : tradeValue,
          affectedTradeValue: isNaN(affectedTradeValue) ? 0 : affectedTradeValue,
          affectedShare: isNaN(affectedShare) ? 0 : affectedShare,
          lineShare: isNaN(lineShare) ? 0 : lineShare
        });
      }

      if (mode === "isic") {
        isicTariffData = mapped;
        isicTariffLoaded = true;
      } else if (mode === "hs6") {
        hs6TariffData = mapped;
        hs6TariffLoaded = true;
      }

      if (typeof callback === "function") callback();
    })
    .catch(function (err) {
      console.error("Error loading", path, err);
      if (typeof callback === "function") callback();
    });
}

// --------------------------------------------------------
// Apply filters based on controls
// --------------------------------------------------------
function applyFilters() {
  if (!isicTariffLoaded || !hs6TariffLoaded) {
    // Data not ready yet
    return;
  }

  var importerSel = document.getElementById("importerSelect");
  var isicSel     = document.getElementById("isicSelect");
  var hs6Sel      = document.getElementById("hs6Select");
  var dateFromEl  = document.getElementById("dateFrom");
  var dateToEl    = document.getElementById("dateTo");

  if (!importerSel || !isicSel || !hs6Sel) return;

  var importerVal = importerSel.value;
  var isicVal     = isicSel.value;
  var hs6Val      = hs6Sel.value;
  var dateFromVal = dateFromEl.value;
  var dateToVal   = dateToEl.value;

  // Classification selection rule:
  // - if both selected → show message & abort
  // - if ISIC selected → use ISIC tariff data
  // - if HS6 selected → use HS6 tariff data
  // - if none selected → default to HS6 data (all products)
  if (isicVal && hs6Val) {
    alert("Please select only one classification (ISIC or HS6).");
    var eoDiv = document.getElementById("eoContent");
    if (eoDiv) {
      eoDiv.innerHTML = "<p>Please select only one classification (ISIC or HS6).</p>";
    }
    return;
  }

  var mode;
  var baseData;

  if (isicVal) {
    mode = "isic";
    baseData = isicTariffData;
  } else if (hs6Val) {
    mode = "hs6";
    baseData = hs6TariffData;
  } else {
    // both empty → treat as ALL products, use HS6 file by default
    mode = "hs6";
    baseData = hs6TariffData;
  }

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

  // Filter data
  var filtered = [];
  for (var j = 0; j < baseData.length; j++) {
    var row = baseData[j];

    if (importerVal && row.importer !== importerVal) {
      continue;
    }

    if (mode === "isic" && isicVal && row.code !== isicVal) {
      continue;
    }
    if (mode === "hs6" && hs6Val && row.code !== hs6Val) {
      continue;
    }

    if (selectedExporters.length > 0 &&
        selectedExporters.indexOf(row.exporter) === -1) {
      continue;
    }

    if (startDate && row.date < startDate) continue;
    if (endDate   && row.date > endDate)   continue;

    filtered.push(row);
  }

  // Draw chart and summary for the active tab (HS6 or HS8 containers)
  drawChart(currentTab, filtered, selectedExporters);
  updateSummary(currentTab, filtered, selectedExporters, mode, isicVal, hs6Val);
  updateEOSection(mode, filtered, isicVal, hs6Val, importerVal, selectedExporters, dateFromVal, dateToVal);
}

// --------------------------------------------------------
// Draw chart for active tab (HS6/HS8) — true date scaling
// --------------------------------------------------------
function drawChart(tabId, data, selectedExporters) {
  var chartDivId = (tabId === "hs6") ? "tariffChartHS6" : "tariffChartHS8";
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
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var dateKey = d.date.toLocaleDateString("en-US");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(d.tariff);
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
      var avg = arr.length ? sum / arr.length : 0;

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
      line: { shape: "hv", width: 3 },
      marker: { size: 8 }
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
          yvals.push(arr2.length ? sum2 / arr2.length : 0);
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
function formatShare(value) {
  if (isNaN(value)) return "";
  if (value <= 1) {
    return (value * 100).toFixed(2) + "%";
  }
  return value.toFixed(2) + "%";
}

function updateSummary(tabId, data, selectedExporters, mode, isicVal, hs6Val) {
  var tableId = (tabId === "hs6") ? "summaryTableHS6" : "summaryTableHS8";
  var tbody = document.querySelector("#" + tableId + " tbody");
  if (!tbody) return;

  if (!data || data.length === 0) {
    if ($.fn.DataTable.isDataTable("#" + tableId)) {
      $("#" + tableId).DataTable().destroy();
    }
    tbody.innerHTML = "<tr><td colspan='7'>No data available</td></tr>";
    $("#" + tableId).DataTable({
      pageLength: 5,
      searching: false,
      info: false,
      lengthChange: false
    });
    return;
  }

  // Group by exporter + date
  var grouped = {};
  for (var i = 0; i < data.length; i++) {
    var d = data[i];
    var dateKey = d.date.toLocaleDateString("en-US");
    var key = d.exporter + "_" + dateKey;

    if (!grouped[key]) {
      grouped[key] = {
        exporter: d.exporter,
        date: dateKey,
        tariffs: [],
        weightedTariffs: [],
        tradeValues: [],
        affectedTradeValues: [],
        affectedShares: [],
        lineShares: []
      };
    }

    grouped[key].tariffs.push(d.tariff);
    grouped[key].weightedTariffs.push(d.tariff * d.tradeValue);
    grouped[key].tradeValues.push(d.tradeValue);

    grouped[key].affectedTradeValues.push(d.affectedTradeValue);
    grouped[key].affectedShares.push(d.affectedShare);
    grouped[key].lineShares.push(d.lineShare);
  }

  var groups = Object.keys(grouped).map(function (k) { return grouped[k]; });

  var htmlRows = "";
  for (var gIndex = 0; gIndex < groups.length; gIndex++) {
    var g = groups[gIndex];

    // Simple average tariff
    var sumTar = 0;
    for (var t = 0; t < g.tariffs.length; t++) sumTar += g.tariffs[t];
    var simpleAvg = g.tariffs.length ? sumTar / g.tariffs.length : 0;

    // Trade-weighted average tariff
    var sumVal = 0;
    for (var v = 0; v < g.tradeValues.length; v++) sumVal += g.tradeValues[v];

    var sumWV = 0;
    for (var w = 0; w < g.weightedTariffs.length; w++) sumWV += g.weightedTariffs[w];
    var tradeWeighted = sumVal ? sumWV / sumVal : 0;

    // Affected trade value
    var sumAffectedVal = 0;
    for (var av = 0; av < g.affectedTradeValues.length; av++) sumAffectedVal += g.affectedTradeValues[av];

    // Average shares
    var sumAS = 0;
    for (var as = 0; as < g.affectedShares.length; as++) sumAS += g.affectedShares[as];
    var avgShare = g.affectedShares.length ? sumAS / g.affectedShares.length : 0;

    var sumLS = 0;
    for (var ls = 0; ls < g.lineShares.length; ls++) sumLS += g.lineShares[ls];
    var avgLineShare = g.lineShares.length ? sumLS / g.lineShares.length : 0;

    htmlRows +=
      "<tr>" +
      "<td>" + g.exporter + "</td>" +
      "<td>" + g.date + "</td>" +
      "<td>" + simpleAvg.toFixed(3) + "</td>" +
      "<td>" + tradeWeighted.toFixed(3) + "</td>" +
      "<td>" + sumAffectedVal.toFixed(0) + "</td>" +
      "<td>" + formatShare(avgShare) + "</td>" +
      "<td>" + formatShare(avgLineShare) + "</td>" +
      "</tr>";
  }

  if ($.fn.DataTable.isDataTable("#" + tableId)) {
    $("#" + tableId).DataTable().destroy();
  }
  tbody.innerHTML = htmlRows;
  $("#" + tableId).DataTable({
    pageLength: 5,
    order: [[1, "asc"]]
  });
}

// --------------------------------------------------------
// Executive Order (EO) Documentation section
// --------------------------------------------------------
function updateEOSection(mode, data, isicVal, hs6Val, importerVal, selectedExporters, dateFromVal, dateToVal) {
  var eoDiv = document.getElementById("eoContent");
  if (!eoDiv) return;

  if (!data || data.length === 0) {
    eoDiv.innerHTML = "<p>No Executive Order (EO) related tariff actions found for the current filters.</p>";
    return;
  }

  var classText = "All classifications";
  if (mode === "isic" && isicVal) {
    classText = "ISIC 2-digit code " + isicVal;
  } else if (mode === "hs6" && hs6Val) {
    classText = "HS6 code " + hs6Val;
  }

  var importerText = importerVal || "All importers";

  var exporterText;
  if (!selectedExporters || selectedExporters.length === 0) {
    exporterText = "World (All exporters)";
  } else if (selectedExporters.length === 1) {
    exporterText = selectedExporters[0];
  } else {
    exporterText = "Selected exporters (" + selectedExporters.length + ")";
  }

  var dateText = "All available dates";
  if (dateFromVal || dateToVal) {
    var fromStr = dateFromVal || "…";
    var toStr   = dateToVal   || "…";
    dateText = fromStr + " to " + toStr;
  }

  // Very simple EO count: rows with non-zero affected trade value
  var eoCount = 0;
  for (var i = 0; i < data.length; i++) {
    if (data[i].affectedTradeValue && data[i].affectedTradeValue !== 0) {
      eoCount++;
    }
  }

  eoDiv.innerHTML =
    "<p><strong>Filters:</strong> " +
    importerText + " imports from " + exporterText +
    " for " + classText + " over " + dateText + ".</p>" +
    "<p><strong>EO-related tariff actions (rows with non-zero affected trade value):</strong> " +
    eoCount + ".</p>" +
    "<p>This documentation section can be extended with specific Executive Order references or detailed legal text underpinning the tariff actions reflected in the data.</p>";
}

