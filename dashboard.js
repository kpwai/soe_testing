// ========================================================
// Trade Model (CP) Equilibrium Dashboard — ISIC2 + HS6
// ========================================================

// CSV paths
var EXPORTER_PATH    = "data/exporter.csv";
var ISIC_CODE_PATH   = "data/isic2digit.csv";
var HS6_CODE_PATH    = "data/hs6code.csv";
var ISIC_TARIFF_PATH = "data/isic2tariff.csv";
var HS6_TARIFF_PATH  = "data/hs6tariff.csv";

// Global data
var exporterList = [];
var isicCodeList = [];
var hs6CodeList  = [];

var isicTariffData = [];
var hs6TariffData  = [];

var isicTariffLoaded = false;
var hs6TariffLoaded  = false;

// --------------------------------------------------------
// DOM Ready
// --------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
  setupExporterDropdown();

  loadExporterOptions(function () {
    loadIsicOptions(function () {
      loadHs6Options(function () {
        loadTariffCsv(ISIC_TARIFF_PATH, "isic", function () {
          loadTariffCsv(HS6_TARIFF_PATH, "hs6", function () {
            // All data ready
            var btnApply = document.getElementById("applyFilters");
            if (btnApply) {
              btnApply.addEventListener("click", applyFilters);
            }
            applyFilters();
          });
        });
      });
    });
  });
});

// --------------------------------------------------------
// Utility: ISIC 4_2 -> 2-digit code
// --------------------------------------------------------
function normalizeIsic2(codeRaw) {
  if (!codeRaw) return "";
  var digits = String(codeRaw).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 2) return digits.slice(0, 2);
  return digits.padStart(2, "0");
}

// --------------------------------------------------------
// Exporter dropdown
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
// Load exporter list
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
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "exporter-checkbox";
    cb.value = exp;

    label.appendChild(cb);
    label.appendChild(document.createTextNode(" " + exp));
    exporterBox.appendChild(label);
  }
}

// --------------------------------------------------------
// Load ISIC code list (only codes shown)
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
          isicCodeList.push({ code: code2 });
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
  // keep the first "All"
  for (var i = 0; i < isicCodeList.length; i++) {
    var item = isicCodeList[i];
    var opt = document.createElement("option");
    opt.value = item.code;
    opt.textContent = item.code; // code only
    sel.appendChild(opt);
  }
}

// --------------------------------------------------------
// Load HS6 code list (only codes shown)
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
          hs6CodeList.push({ code: code });
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
  // keep the first "All"
  for (var i = 0; i < hs6CodeList.length; i++) {
    var item = hs6CodeList[i];
    var opt = document.createElement("option");
    opt.value = item.code;
    opt.textContent = item.code; // code only
    sel.appendChild(opt);
  }
}

// --------------------------------------------------------
// Load tariff CSV (ISIC or HS6)
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
        if (isNaN(d.getTime())) continue;

        var importer = (row.importer || "").trim();
        var exporter = (row.exporter || "").trim();
        var tariff   = parseFloat(row.tariffs || 0);
        var importsK = parseFloat(row.importsvaluein1000usd || 0);
        var tradeValue = isNaN(importsK) ? 0 : importsK * 1000;

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
          code: code,
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
      } else {
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
// Apply filters and update chart + summary + EO
// --------------------------------------------------------
function applyFilters() {
  if (!isicTariffLoaded || !hs6TariffLoaded) return;

  var importerSel = document.getElementById("importerSelect");
  var isicSel     = document.getElementById("isicSelect");
  var hs6Sel      = document.getElementById("hs6Select");
  var dateFromEl  = document.getElementById("dateFrom");
  var dateToEl    = document.getElementById("dateTo");

  var importerVal = importerSel ? importerSel.value : "";
  var isicVal     = isicSel ? isicSel.value : "";
  var hs6Val      = hs6Sel ? hs6Sel.value : "";
  var dateFromVal = dateFromEl ? dateFromEl.value : "";
  var dateToVal   = dateToEl ? dateToEl.value : "";

  // Rule: if both ISIC and HS6 selected => stop
  if (isicVal && hs6Val) {
    alert("Please select only one classification (ISIC or HS6).");
    var eoDiv = document.getElementById("eoContent");
    if (eoDiv) {
      eoDiv.innerHTML = "<p>Please select only one classification (ISIC or HS6).</p>";
    }
    // Hide tables
    showISICSummaryTable(false);
    showHS6SummaryTable(false);
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
    // none selected => HS6 default
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

  var filtered = [];
  for (var j = 0; j < baseData.length; j++) {
    var row = baseData[j];

    if (importerVal && row.importer !== importerVal) continue;

    if (mode === "isic" && isicVal && row.code !== isicVal) continue;
    if (mode === "hs6"  && hs6Val  && row.code !== hs6Val)  continue;

    if (selectedExporters.length > 0 &&
        selectedExporters.indexOf(row.exporter) === -1) continue;

    if (startDate && row.date < startDate) continue;
    if (endDate && row.date > endDate) continue;

    filtered.push(row);
  }

  drawChartMain(filtered, selectedExporters);
  updateSummary(mode, filtered);
  updateEOSection(mode, filtered, isicVal, hs6Val, importerVal, selectedExporters, dateFromVal, dateToVal);
}

// --------------------------------------------------------
// Main chart
// --------------------------------------------------------
function drawChartMain(data, selectedExporters) {
  var chartDiv = document.getElementById("tariffChartMain");
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
    var grouped = {};
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var dk = d.date.toLocaleDateString("en-US");
      if (!grouped[dk]) grouped[dk] = [];
      grouped[dk].push(d.tariff);
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
    var dateSet = {};
    for (var dIndex = 0; dIndex < data.length; dIndex++) {
      var d2 = data[dIndex];
      var dk2 = d2.date.toLocaleDateString("en-US");
      dateSet[dk2] = true;
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
        var key = row.date.toLocaleDateString("en-US");
        if (!daily[key]) daily[key] = [];
        daily[key].push(row.tariff);
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
    title: "Tariff Trend",
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
// Summary tables (ISIC: 5 cols, HS6: 7 cols)
// --------------------------------------------------------
function showISICSummaryTable(show) {
  var tISIC = document.getElementById("summaryTableISIC");
  var tHS6  = document.getElementById("summaryTableHS6");
  if (!tISIC || !tHS6) return;
  tISIC.style.display = show ? "table" : "none";
  if (show) tHS6.style.display = "none";
}

function showHS6SummaryTable(show) {
  var tISIC = document.getElementById("summaryTableISIC");
  var tHS6  = document.getElementById("summaryTableHS6");
  if (!tISIC || !tHS6) return;
  tHS6.style.display = show ? "table" : "none";
  if (show) tISIC.style.display = "none";
}

function formatShare(value) {
  if (isNaN(value)) return "";
  if (value <= 1) return (value * 100).toFixed(2) + "%";
  return value.toFixed(2) + "%";
}

function updateSummary(mode, data) {
  var isicTableId = "summaryTableISIC";
  var hs6TableId  = "summaryTableHS6";

  if (mode === "isic") {
    showISICSummaryTable(true);
    showHS6SummaryTable(false);
  } else {
    showISICSummaryTable(false);
    showHS6SummaryTable(true);
  }

  if (!data || data.length === 0) {
    // No data: reset DataTables and show 1 row
    if (mode === "isic") {
      if ($.fn.DataTable.isDataTable("#" + isicTableId)) {
        $("#" + isicTableId).DataTable().destroy();
      }
      var tbodyI = document.querySelector("#" + isicTableId + " tbody");
      tbodyI.innerHTML =
        "<tr>" +
        "<td colspan='5' style='text-align:center;'>No data available</td>" +
        "</tr>";
      $("#" + isicTableId).DataTable({
        paging: false,
        searching: false,
        info: false,
        ordering: false
      });
    } else {
      if ($.fn.DataTable.isDataTable("#" + hs6TableId)) {
        $("#" + hs6TableId).DataTable().destroy();
      }
      var tbodyH = document.querySelector("#" + hs6TableId + " tbody");
      tbodyH.innerHTML =
        "<tr>" +
        "<td colspan='7' style='text-align:center;'>No data available</td>" +
        "</tr>";
      $("#" + hs6TableId).DataTable({
        paging: false,
        searching: false,
        info: false,
        ordering: false
      });
    }
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

  if (mode === "isic") {
    if ($.fn.DataTable.isDataTable("#" + isicTableId)) {
      $("#" + isicTableId).DataTable().destroy();
    }
    var tbodyISIC = document.querySelector("#" + isicTableId + " tbody");

    var htmlRowsI = "";
    for (var gI = 0; gI < groups.length; gI++) {
      var g = groups[gI];

      var sumTar = 0;
      for (var t = 0; t < g.tariffs.length; t++) sumTar += g.tariffs[t];
      var simpleAvg = g.tariffs.length ? sumTar / g.tariffs.length : 0;

      var sumVal = 0;
      for (var v = 0; v < g.tradeValues.length; v++) sumVal += g.tradeValues[v];

      var sumWV = 0;
      for (var w = 0; w < g.weightedTariffs.length; w++) sumWV += g.weightedTariffs[w];
      var tradeWeighted = sumVal ? sumWV / sumVal : 0;

      var sumAffected = 0;
      for (var av = 0; av < g.affectedTradeValues.length; av++) sumAffected += g.affectedTradeValues[av];

      htmlRowsI +=
        "<tr>" +
        "<td>" + g.exporter + "</td>" +
        "<td>" + g.date + "</td>" +
        "<td>" + simpleAvg.toFixed(3) + "</td>" +
        "<td>" + tradeWeighted.toFixed(3) + "</td>" +
        "<td>" + sumAffected.toFixed(0) + "</td>" +
        "</tr>";
    }

    tbodyISIC.innerHTML = htmlRowsI;
    $("#" + isicTableId).DataTable({
      pageLength: 5,
      order: [[1, "asc"]]
    });

  } else { // HS6 mode
    if ($.fn.DataTable.isDataTable("#" + hs6TableId)) {
      $("#" + hs6TableId).DataTable().destroy();
    }
    var tbodyHS6 = document.querySelector("#" + hs6TableId + " tbody");

    var htmlRowsH = "";
    for (var gH = 0; gH < groups.length; gH++) {
      var g2 = groups[gH];

      var sumTar2 = 0;
      for (var t2 = 0; t2 < g2.tariffs.length; t2++) sumTar2 += g2.tariffs[t2];
      var simpleAvg2 = g2.tariffs.length ? sumTar2 / g2.tariffs.length : 0;

      var sumVal2 = 0;
      for (var v2 = 0; v2 < g2.tradeValues.length; v2++) sumVal2 += g2.tradeValues[v2];

      var sumWV2 = 0;
      for (var w2 = 0; w2 < g2.weightedTariffs.length; w2++) sumWV2 += g2.weightedTariffs[w2];
      var tradeWeighted2 = sumVal2 ? sumWV2 / sumVal2 : 0;

      var sumAffected2 = 0;
      for (var av2 = 0; av2 < g2.affectedTradeValues.length; av2++) sumAffected2 += g2.affectedTradeValues[av2];

      var sumAS2 = 0;
      for (var as2 = 0; as2 < g2.affectedShares.length; as2++) sumAS2 += g2.affectedShares[as2];
      var avgShare2 = g2.affectedShares.length ? sumAS2 / g2.affectedShares.length : 0;

      var sumLS2 = 0;
      for (var ls2 = 0; ls2 < g2.lineShares.length; ls2++) sumLS2 += g2.lineShares[ls2];
      var avgLineShare2 = g2.lineShares.length ? sumLS2 / g2.lineShares.length : 0;

      htmlRowsH +=
        "<tr>" +
        "<td>" + g2.exporter + "</td>" +
        "<td>" + g2.date + "</td>" +
        "<td>" + simpleAvg2.toFixed(3) + "</td>" +
        "<td>" + tradeWeighted2.toFixed(3) + "</td>" +
        "<td>" + sumAffected2.toFixed(0) + "</td>" +
        "<td>" + formatShare(avgShare2) + "</td>" +
        "<td>" + formatShare(avgLineShare2) + "</td>" +
        "</tr>";
    }

    tbodyHS6.innerHTML = htmlRowsH;
    $("#" + hs6TableId).DataTable({
      pageLength: 5,
      order: [[1, "asc"]]
    });
  }
}

// --------------------------------------------------------
// EO Documentation
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
