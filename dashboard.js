// =====================================
// Trade Model Dashboard (Test Version)
// Multi-Exporter + Checkbox Exporter
// =====================================

// Path to CSV (adjust if needed)
var dataPath = "data.csv";

var tariffData = [];

// =====================================
// LOAD CSV
// =====================================
async function loadCSV() {
  try {
    console.log("Loading CSV:", dataPath);

    var response = await fetch(dataPath);
    if (!response.ok) throw new Error("CSV not found");

    var text = await response.text();

    var parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true
    });

    tariffData = parsed.data.map(function(row) {
      return {
        importer: row.importer ? row.importer.trim() : "",
        exporter: row.exporter ? row.exporter.trim() : "",
        product: row.product ? row.product.trim() : "",
        date_eff: new Date(row.date_eff), // expects M/D/YYYY
        applied_tariff: parseFloat(row.applied_tariff || 0),
        imports_value_usd: parseFloat(row.imports_value_usd || 0)
      };
    });

    console.log("Loaded rows:", tariffData.length);

    populateDropdowns();
    applyFilters(true); // initial full view

  } catch (err) {
    console.error("Error loading CSV:", err);
    document.getElementById("tariffChart").innerHTML =
      "<p style='color:red'>Failed to load CSV.</p>";
  }
}

// =====================================
// POPULATE CONTROLS
// =====================================
function populateDropdowns() {
  // Importer fixed to United States
  document.getElementById("importerSelect").innerHTML =
    "<option value='United States' selected>United States</option>";

  // Exporters
  var exporters = Array.from(new Set(
    tariffData.map(function(d) { return d.exporter; })
  )).sort();

  populateExporterCheckboxes(exporters);

  // Products
  var products = Array.from(new Set(
    tariffData.map(function(d) { return d.product; })
  )).sort();

  populateSelect("productSelect", products, "All");
}

function populateSelect(id, values, defaultLabel) {
  var html = "<option value=''>" + defaultLabel + "</option>";
  for (var i = 0; i < values.length; i++) {
    html += "<option value='" + values[i] + "'>" + values[i] + "</option>";
  }
  document.getElementById(id).innerHTML = html;
}

// Build checkbox list for exporters
function populateExporterCheckboxes(exporters) {
  var box = document.getElementById("exporterBox");
  box.innerHTML = "";

  // "World" checkbox (Option A behavior)
  box.innerHTML +=
    "<label><input type='checkbox' id='exporter_world' checked> World (All exporters)</label>";

  for (var i = 0; i < exporters.length; i++) {
    var exp = exporters[i];
    box.innerHTML +=
      "<label><input type='checkbox' class='expCheck' value='" + exp + "'> " + exp + "</label>";
  }

  // World ↔ other exporters mutual exclusivity
  var worldCheck = document.getElementById("exporter_world");
  worldCheck.addEventListener("change", function() {
    if (this.checked) {
      var checks = document.querySelectorAll(".expCheck");
      for (var j = 0; j < checks.length; j++) {
        checks[j].checked = false;
      }
    }
  });

  var otherChecks = document.querySelectorAll(".expCheck");
  for (var k = 0; k < otherChecks.length; k++) {
    otherChecks[k].addEventListener("change", function() {
      if (this.checked) {
        document.getElementById("exporter_world").checked = false;
      } else {
        // If nothing else is selected, default back to World
        var anySelected = document.querySelector(".expCheck:checked");
        if (!anySelected) {
          document.getElementById("exporter_world").checked = true;
        }
      }
    });
  }
}

// Helper to get selected exporters
function getSelectedExporters() {
  var worldChecked = document.getElementById("exporter_world").checked;
  if (worldChecked) {
    return ["WORLD"];  // special flag
  }
  var checks = document.querySelectorAll(".expCheck:checked");
  var arr = [];
  for (var i = 0; i < checks.length; i++) {
    arr.push(checks[i].value);
  }
  if (arr.length === 0) {
    // Default to WORLD if nothing selected
    return ["WORLD"];
  }
  return arr;
}

// =====================================
// APPLY FILTERS
// =====================================
function applyFilters(isInitial) {
  var importer = "United States"; // fixed
  var exporters = getSelectedExporters();
  var worldMode = (exporters.length === 1 && exporters[0] === "WORLD");

  var product = document.getElementById("productSelect").value;
  var df = document.getElementById("dateFrom").value;
  var dt = document.getElementById("dateTo").value;

  var start = df ? new Date(df) : null;
  var end = dt ? new Date(dt) : null;

  var filtered = tariffData.filter(function(d) {
    // importer
    if (d.importer !== importer) return false;

    // product
    if (product && d.product !== product) return false;

    // exporter logic
    if (!worldMode) {
      if (exporters.indexOf(d.exporter) === -1) return false;
    }

    // date range
    if (!isInitial) {
      if (start && d.date_eff < start) return false;
      if (end && d.date_eff > end) return false;
    }

    return true;
  });

  drawChart(filtered, exporters, worldMode);
  updateSummary(filtered, exporters, worldMode);
}

// =====================================
// CHART (TRUE DATE SCALING + MULTI EXPORTER)
// =====================================
function drawChart(data, exporters, worldMode) {
  var chartDiv = document.getElementById("tariffChart");

  if (!data || data.length === 0) {
    Plotly.newPlot(chartDiv, [], { title: "No Data" });
    return;
  }

  var traces = [];

  // =========================================
  // WORLD MODE (aggregated)
  // =========================================
  if (worldMode) {
    var grouped = {};

    data.forEach(function(d) {
      var dateKey = d.date_eff.toLocaleDateString("en-US");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(d.applied_tariff);
    });

    var dates = [];
    var values = [];

    Object.keys(grouped)
      .sort(function(a, b) { return new Date(a) - new Date(b); })
      .forEach(function(key) {
        dates.push(new Date(key));  // TRUE DATE OBJECT
        var arr = grouped[key];
        var avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        values.push(avg);
      });

    traces.push({
      x: dates,
      y: values,
      mode: "lines+markers",
      name: "World",
      line: { shape: "hv", width: 3, color: "#003366" },
      marker: { size: 8, color: "#003366" }
    });

  }

  // =========================================
  // MULTI-EXPORTER MODE
  // =========================================
  else {
    var dateSet = new Set();
    data.forEach(d => dateSet.add(d.date_eff.toLocaleDateString("en-US")));

    var sortedKeys = Array.from(dateSet).sort((a, b) => new Date(a) - new Date(b));
    var sortedDates = sortedKeys.map(k => new Date(k));

    exporters.forEach(function(exp) {
      var rows = data.filter(d => d.exporter === exp);

      var daily = {};

      rows.forEach(d => {
        var k = d.date_eff.toLocaleDateString("en-US");
        if (!daily[k]) daily[k] = [];
        daily[k].push(d.applied_tariff);
      });

      var yvals = sortedKeys.map(function(dk) {
        if (!daily[dk]) return null;
        var arr = daily[dk];
        return arr.reduce((a, b) => a + b, 0) / arr.length;
      });

      traces.push({
        x: sortedDates,
        y: yvals,
        mode: "lines+markers",
        name: exp,
        line: { shape: "hv", width: 3 },
        marker: { size: 8 }
      });
    });
  }

  // =========================================
  // TRUE DATE SCALING FIX
  // =========================================
  var layout = {
    title: worldMode ? "World Tariff Trend" : "Exporter Comparison",
    xaxis: {
      title: "Date",
      type: "date",              // ⭐ TRUE DATE SCALE
      tickformat: "%m/%d/%Y",
      tickangle: -45
    },
    yaxis: { title: "Tariff (%)" },
    font: { family: "Georgia, serif", size: 14 },
    plot_bgcolor: "#fff",
    paper_bgcolor: "#fff"
  };

  Plotly.newPlot(chartDiv, traces, layout);
}

// =====================================
// SUMMARY TABLE
// =====================================
function updateSummary(data, exporters, worldMode) {
  var tbody = document.querySelector("#summaryTable tbody");
  var summaryTitle = document.getElementById("summary-title");

  if (!data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='7'>No data</td></tr>";
    summaryTitle.textContent = "";
    return;
  }

  var product = document.getElementById("productSelect").value || "All products";

  var exporterLabel;
  if (worldMode) {
    exporterLabel = "World";
  } else {
    exporterLabel = exporters.join(", ");
  }

  summaryTitle.textContent =
    "United States imports from " + exporterLabel + " — " + product;

  // Group by exporter + date
  var groups = {};

  data.forEach(function(d) {
    var dateStr = d.date_eff.toLocaleDateString("en-US");
    var key = d.exporter + "_" + dateStr;

    if (!groups[key]) {
      groups[key] = {
        exporter: d.exporter,
        date: dateStr,
        tariffs: [],
        weighted: [],
        values: []
      };
    }

    groups[key].tariffs.push(d.applied_tariff);
    groups[key].weighted.push(d.applied_tariff * d.imports_value_usd);
    groups[key].values.push(d.imports_value_usd);
  });

  var html = "";
  Object.values(groups).forEach(function(g) {
    var avg = g.tariffs.reduce(function(a, b) { return a + b; }, 0) / g.tariffs.length;
    var total = g.values.reduce(function(a, b) { return a + b; }, 0);
    var weighted = g.weighted.reduce(function(a, b) { return a + b; }, 0) / (total || 1);

    html +=
      "<tr>" +
        "<td>" + g.exporter + "</td>" +
        "<td>" + g.date + "</td>" +
        "<td>" + avg.toFixed(3) + "</td>" +
        "<td>" + weighted.toFixed(3) + "</td>" +
        "<td>" + total.toFixed(3) + "</td>" +
        "<td>100%</td>" +
        "<td>100%</td>" +
      "</tr>";
  });

  tbody.innerHTML = html;
}

// =====================================
// EVENTS + INIT
// =====================================
document.getElementById("applyFilters").addEventListener("click", function() {
  applyFilters(false);
});

loadCSV();
