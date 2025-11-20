// ========================================================
// Trade Model (CP) Equilibrium Dashboard — Classification Version
// Uses small lookup CSVs for controls + big tariff CSVs for trends
// ========================================================

// ---- CONFIG: file paths ----
var IMPORTERS_LIST_PATH = "data/importers_list.csv";   // col: importer
var EXPORTERS_LIST_PATH = "data/exporters_list.csv";   // col: exporter
var ISIC2_LIST_PATH     = "data/isic2_list.csv";       // col: isic2
var HS6_LIST_PATH       = "data/hs6_list.csv";         // col: hs6

var HS6_TARIFF_PATH     = "data/tariff_datahs6.csv";   // HS6 file
var HS8_TARIFF_PATH     = "data/tariff_datahs8.csv";   // HS8 (ISIC2) file

// ---- LOOKUP ARRAYS ----
var lookupImporters = [];   // ["World", "Cambodia", ...]
var lookupExporters = [];   // ["Afghanistan", ...]
var lookupIsic2     = [];   // ["01","02",...]
var lookupHs6       = [];   // ["040299",...]


// ---- TARIFF DATA (unified shape) ----
// Each row: { importer, exporter, code, date, tariff, tradeValue }
var hs6Data = [];
var hs8Data = [];

// ========================================================
// ON DOM READY
// ========================================================
document.addEventListener("DOMContentLoaded", function () {
  setupExporterDropdownUI();

  // Hook classification change → populate codeSelect
  var clsSel = document.getElementById("classificationSelect");
  if (clsSel) {
    clsSel.addEventListener("change", function () {
      populateCodeSelect();
    });
  }

  var applyBtn = document.getElementById("applyFilters");
  if (applyBtn) {
    applyBtn.addEventListener("click", applyFilters);
  }

  // Load lookups + big data in parallel
  Promise.all([
    loadLookupCSV(IMPORTERS_LIST_PATH, "importers"),
    loadLookupCSV(EXPORTERS_LIST_PATH, "exporters"),
    loadLookupCSV(ISIC2_LIST_PATH, "isic2"),
    loadLookupCSV(HS6_LIST_PATH, "hs6"),
    loadTariffCSV(HS6_TARIFF_PATH, "hs6"),
    loadTariffCSV(HS8_TARIFF_PATH, "hs8")
  ])
  .then(function () {
    populateStaticControls();   // importers, exporters, classification, code
    applyFilters();             // initial view
  })
  .catch(function (err) {
    console.error("Error initializing dashboard:", err);
    var chartDiv = document.getElementById("tariffChart");
    if (chartDiv) {
      chartDiv.innerHTML =
        "<p style='color:red'>Failed to load dashboard data. Please check CSV paths.</p>";
    }
  });
});

// ========================================================
// LOAD SMALL LOOKUP CSVs
// ========================================================
function loadLookupCSV(path, type) {
  return fetch(path)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to fetch " + path);
      }
      return response.text();
    })
    .then(function (text) {
      var result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true
      });

      var rows = result.data;
      var values = [];

      if (type === "importers") {
        for (var i = 0; i < rows.length; i++) {
          var v = (rows[i].importer || "").trim();
          if (v) values.push(v);
        }
        lookupImporters = dedupe(values);
      } else if (type === "exporters") {
        for (var j = 0; j < rows.length; j++) {
          var e = (rows[j].exporter || "").trim();
          if (e) values.push(e);
        }
        lookupExporters = dedupe(values);
      } else if (type === "isic2") {
        for (var k = 0; k < rows.length; k++) {
          var c = (rows[k].isic2 || "").trim();
          if (c) values.push(c);
        }
        lookupIsic2 = dedupe(values);
      } else if (type === "hs6") {
        for (var h = 0; h < rows.length; h++) {
          var h6 = (rows[h].hs6 || "").trim();
          if (h6) values.push(h6);
        }
        lookupHs6 = dedupe(values);
      }
    });
}

function dedupe(arr) {
  var seen = {};
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var v = arr[i];
    if (!seen[v]) {
      seen[v] = true;
      out.push(v);
    }
  }
  return out;
}

// ========================================================
// LOAD BIG TARIFF CSVs (HS6 & HS8) into unified shape
// ========================================================
function loadTariffCSV(path, kind) {
  return fetch(path)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to fetch " + path);
      }
      return response.text();
    })
    .then(function (text) {
      var result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true
      });

      var rows = result.data;
      var mapped = [];

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];

        var d = new Date(row.date_eff);
        if (isNaN(d.getTime())) continue; // skip bad date

        if (kind === "hs6") {
          // importer,exporter,hs6,date_eff,tariffs,importsvaluein1000usd,affected_trade_value
          var imp = (row.importer || "").trim();
          var exp = (row.exporter || "").trim();
          var code = (row.hs6 || "").trim();
          var tar = parseFloat(row.tariffs || 0);
          var valTh = parseFloat(row.importsvaluein1000usd || 0);
          var val = valTh * 1000; // convert to USD

          mapped.push({
            importer: imp,
            exporter: exp,
            code: code,
            date: d,
            tariff: isNaN(tar) ? 0 : tar,
            tradeValue: isNaN(val) ? 0 : val
          });
        } else {
          // HS8 file used for ISIC2 (or aggregated codes)
          // importer,exporter,product,date_eff,applied_tariff,imports_value_usd,iseu
          var imp8 = (row.importer || "").trim();
          var exp8 = (row.exporter || "").trim();
          var code8 = (row.product || "").trim();  // treat as classification code
          var tar8 = parseFloat(row.applied_tariff || 0);
          var val8 = parseFloat(row.imports_value_usd || 0);

          mapped.push({
            importer: imp8,
            exporter: exp8,
            code: code8,
            date: d,
            tariff: isNaN(tar8) ? 0 : tar8,
            tradeValue: isNaN(val8) ? 0 : val8
          });
        }
      }

      if (kind === "hs6") {
        hs6Data = mapped;
      } else {
        hs8Data = mapped;
      }
    });
}

// ========================================================
// UI SETUP: EXPORTER MULTI-SELECT (checkbox panel)
// ========================================================
function setupExporterDropdownUI() {
  var display = document.getElementById("exporterDisplay");
  var panel = document.getElementById("exporterBox");

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
  var display = document.getElementById("exporterDisplay");
  if (!display) return;

  // Assume: first span inside exporterDisplay is the text span
  var textSpan = display.querySelector("span");
  if (!textSpan) return;

  var cbs = document.querySelectorAll(".exporter-checkbox:checked");

  if (!cbs || cbs.length === 0) {
    textSpan.textContent = "World (all exporters)";
  } else if (cbs.length === 1) {
    textSpan.textContent = cbs[0].value;
  } else {
    textSpan.textContent = cbs.length + " exporters selected";
  }
}

// ========================================================
// POPULATE STATIC CONTROLS (importer, exporter, classification, code)
// ========================================================
function populateStaticControls() {
  // Importers
  var importerSelect = document.getElementById("importerSelect");
  if (importerSelect) {
    importerSelect.innerHTML = "";
    for (var i = 0; i < lookupImporters.length; i++) {
      var opt = document.createElement("option");
      opt.value = lookupImporters[i];
      opt.textContent = lookupImporters[i];
      importerSelect.appendChild(opt);
    }
    // If "World" exists, select it by default
    for (var j = 0; j < importerSelect.options.length; j++) {
      if (importerSelect.options[j].value === "World") {
        importerSelect.selectedIndex = j;
        break;
      }
    }
  }

  // Exporters: checkboxes
  var exporterBox = document.getElementById("exporterBox");
  if (exporterBox) {
    exporterBox.innerHTML = "";
    for (var e = 0; e < lookupExporters.length; e++) {
      var exp = lookupExporters[e];
      var lbl = document.createElement("label");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "exporter-checkbox";
      cb.value = exp;

      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(" " + exp));
      exporterBox.appendChild(lbl);
    }
  }
  updateExporterDisplayText();

  // Classification select is assumed to be already in HTML:
  // <select id="classificationSelect">
  //   <option value="isic2">ISIC 2 digit</option>
  //   <option value="hs6">HS6 product level</option>
  // </select>
  populateCodeSelect();
}

// Populate codeSelect based on current classification
function populateCodeSelect() {
  var clsSel = document.getElementById("classificationSelect");
  var codeSel = document.getElementById("codeSelect");
  if (!clsSel || !codeSel) return;

  var cls = clsSel.value;   // "isic2" or "hs6"

  codeSel.innerHTML = "";
  var optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "All codes";
  codeSel.appendChild(optAll);

  var list = cls === "hs6" ? lookupHs6 : lookupIsic2;

  for (var i = 0; i < list.length; i++) {
    var op = document.createElement("option");
    op.value = list[i];
    op.textContent = list[i];
    codeSel.appendChild(op);
  }
}

// ========================================================
// APPLY FILTERS
// ========================================================
function applyFilters() {
  var clsSel = document.getElementById("classificationSelect");
  if (!clsSel) return;

  var cls = clsSel.value;          // "isic2" -> hs8Data, "hs6" -> hs6Data
  var data = (cls === "hs6") ? hs6Data : hs8Data;

  if (!data || data.length === 0) {
    drawChart([], [], false);
    updateSummary([], []);
    return;
  }

  var importerVal = document.getElementById("importerSelect").value; // "World" or specific
  var codeVal = document.getElementById("codeSelect").value;

  var dateFromVal = document.getElementById("dateFrom").value;
  var dateToVal   = document.getElementById("dateTo").value;

  var startDate = dateFromVal ? new Date(dateFromVal) : null;
  var endDate   = dateToVal   ? new Date(dateToVal)   : null;

  // exporters: multi-select
  var cbs = document.querySelectorAll(".exporter-checkbox");
  var selectedExporters = [];
  for (var i = 0; i < cbs.length; i++) {
    if (cbs[i].checked) selectedExporters.push(cbs[i].value);
  }

  updateExporterDisplayText();

  var filtered = [];
  for (var j = 0; j < data.length; j++) {
    var row = data[j];

    // Importer filter
    if (importerVal && importerVal !== "World") {
      if (row.importer !== importerVal) continue;
    }

    // Code filter (ISIC2 or HS6)
    if (codeVal && row.code !== codeVal) continue;

    // Exporter filter: if none selected → world (no filter)
    if (selectedExporters.length > 0) {
      if (selectedExporters.indexOf(row.exporter) === -1) continue;
    }

    // Date range
    if (startDate && row.date < startDate) continue;
    if (endDate && row.date > endDate) continue;

    filtered.push(row);
  }

  drawChart(filtered, selectedExporters);
  updateSummary(filtered, selectedExporters);
}

// ========================================================
// DRAW CHART (TRUE DATE SCALING, LABEL EVERY DOT)
// ========================================================
function drawChart(data, selectedExporters) {
  var chartDiv = document.getElementById("tariffChart");
  if (!chartDiv) return;

  if (!data || data.length === 0) {
    Plotly.newPlot(chartDiv, [], { title: "No data available" });
    return;
  }

  var worldMode = !selectedExporters || selectedExporters.length === 0;
  var traces = [];
  var tickvals = [];
  var ticktext = [];

  if (worldMode) {
    // Aggregate all exporters per date
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

      dates.push(new Date(k));   // REAL date
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
      var r = data[dIndex];
      var dk = r.date.toLocaleDateString("en-US");
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

      // tariffs by date for this exporter
      var daily = {};
      for (var rIndex = 0; rIndex < data.length; rIndex++) {
        var row = data[rIndex];
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
    title: "Tariff Trend",
    xaxis: {
      title: "Date",
      type: "date",
      tickmode: "array",   // force labels for each dot
      tickvals: tickvals,
      ticktext: ticktext,
      tickangle: -45,
      automargin: true
    },
    yaxis: { title: "Tariff (%)" },
    font: { family: "Georgia, serif", size: 14 },
    plot_bgcolor: "#fff",
    paper_bgcolor: "#fff",
    showlegend: !worldMode
  };

  Plotly.newPlot(chartDiv, traces, layout);
}

// ========================================================
// SUMMARY TABLE (single table, HS6 or HS8 depending on classification)
// ========================================================
function updateSummary(data, selectedExporters) {
  var tbody = document.querySelector("#summaryTable tbody");
  var titleEl = document.getElementById("summary-title");

  if (!tbody || !titleEl) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='7'>No data available</td></tr>";
    titleEl.textContent = "";
    return;
  }

  var importerSel = document.getElementById("importerSelect").value;
  var importerLabel = importerSel || "World";

  var exporterLabel;
  if (!selectedExporters || selectedExporters.length === 0) {
    exporterLabel = "World";
  } else if (selectedExporters.length === 1) {
    exporterLabel = selectedExporters[0];
  } else {
    exporterLabel = "Selected exporters";
  }

  var clsSel = document.getElementById("classificationSelect");
  var codeSel = document.getElementById("codeSelect");
  var codeLabel = (codeSel && codeSel.value) ? codeSel.value : "All codes";
  var clsLabel = clsSel ? clsSel.options[clsSel.selectedIndex].text : "";

  titleEl.textContent =
    importerLabel + " imports from " + exporterLabel +
    " — " + clsLabel + " : " + codeLabel;

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
        values: []
      };
    }

    grouped[key].tariffs.push(d.tariff);
    grouped[key].weightedTariffs.push(d.tariff * d.tradeValue);
    grouped[key].values.push(d.tradeValue);
  }

  var groups = Object.keys(grouped).map(function (k) { return grouped[k]; });

  var htmlRows = "";
  for (var g = 0; g < groups.length; g++) {
    var grp = groups[g];

    var sumTar = 0;
    for (var t = 0; t < grp.tariffs.length; t++) sumTar += grp.tariffs[t];
    var simpleAvg = grp.tariffs.length ? sumTar / grp.tariffs.length : 0;

    var sumVal = 0;
    for (var v = 0; v < grp.values.length; v++) sumVal += grp.values[v];

    var sumWV = 0;
    for (var w = 0; w < grp.weightedTariffs.length; w++) sumWV += grp.weightedTariffs[w];
    var tradeWeighted = sumVal ? sumWV / sumVal : 0;

    htmlRows +=
      "<tr>" +
        "<td>" + grp.exporter + "</td>" +
        "<td>" + grp.date + "</td>" +
        "<td>" + simpleAvg.toFixed(3) + "</td>" +
        "<td>" + tradeWeighted.toFixed(3) + "</td>" +
        "<td>" + sumVal.toFixed(3) + "</td>" +
        "<td>100%</td>" +
        "<td>100%</td>" +
      "</tr>";
  }

  // If you're using DataTables:
  if (window.jQuery && $.fn.DataTable && $.fn.DataTable.isDataTable("#summaryTable")) {
    $("#summaryTable").DataTable().destroy();
  }
  tbody.innerHTML = htmlRows;

  if (window.jQuery && $.fn.DataTable) {
    $("#summaryTable").DataTable({
      pageLength: 5,
      order: [[1, "asc"]]
    });
  }
}
