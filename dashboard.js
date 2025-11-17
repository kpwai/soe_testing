// ===========================
// Dashboard.js (Test Version)
// ===========================

// Path to test CSV
const dataPath = "data.csv";

let tariffData = [];

// ===========================
// LOAD CSV
// ===========================
async function loadCSV() {
  try {
    console.log("Loading CSV:", dataPath);

    const response = await fetch(dataPath);
    if (!response.ok) throw new Error("CSV not found");

    const text = await response.text();

    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true
    });

    tariffData = parsed.data.map(function(row) {
      return {
        importer: row.importer ? row.importer.trim() : "",
        exporter: row.exporter ? row.exporter.trim() : "",
        product: row.product ? row.product.trim() : "",
        date_eff: new Date(row.date_eff),
        applied_tariff: parseFloat(row.applied_tariff || 0),
        imports_value_usd: parseFloat(row.imports_value_usd || 0)
      };
    });

    console.log("Loaded rows:", tariffData.length);

    populateDropdowns();
    applyFilters(true);

  } catch (err) {
    console.error("Error loading CSV:", err);
    document.getElementById("tariffChart").innerHTML =
      "<p style='color:red'>Failed to load CSV.</p>";
  }
}

// ===========================
// POPULATE DROPDOWNS
// ===========================
function populateDropdowns() {
  document.getElementById("importerSelect").innerHTML =
    "<option>United States</option>";

  var exporters = Array.from(new Set(tariffData.map(function(d) { return d.exporter; }))).sort();
  var products = Array.from(new Set(tariffData.map(function(d) { return d.product; }))).sort();

  populateSelect("exporterSelect", exporters, "World");
  populateSelect("productSelect", products, "All");
}

function populateSelect(id, values, defaultLabel) {
  var html = "<option value=''>" + defaultLabel + "</option>";
  for (var i = 0; i < values.length; i++) {
    html += "<option value='" + values[i] + "'>" + values[i] + "</option>";
  }
  document.getElementById(id).innerHTML = html;
}

// ===========================
// FILTER + PLOT
// ===========================
function applyFilters(isInitial) {
  var exporter = document.getElementById("exporterSelect").value;
  var product = document.getElementById("productSelect").value;

  var df = document.getElementById("dateFrom").value;
  var dt = document.getElementById("dateTo").value;

  var start = df ? new Date(df) : null;
  var end = dt ? new Date(dt) : null;

  var filtered = tariffData.filter(function(d) {
    var okExp = !exporter || d.exporter === exporter;
    var okProd = !product || d.product === product;

    var okDate = true;

    if (!isInitial) {
      if (start && d.date_eff < start) okDate = false;
      if (end && d.date_eff > end) okDate = false;
    }

    return okExp && okProd && okDate;
  });

  drawChart(filtered);
  updateSummary(filtered);
}

// ===========================
// TRUE DATE SCALE CHART
// ===========================
function drawChart(data) {
  if (data.length === 0) {
    Plotly.newPlot("tariffChart", [], { title: "No Data" });
    return;
  }

  // Build a map of date → avg tariff
  var dailyMap = {};

  data.forEach(function(d) {
    var key = d.date_eff.toLocaleDateString("en-US");
    if (!dailyMap[key]) dailyMap[key] = [];
    dailyMap[key].push(d.applied_tariff);
  });

  var dates = [];
  var values = [];

  Object.keys(dailyMap)
    .sort(function(a, b) { return new Date(a) - new Date(b); })
    .forEach(function(key) {
      dates.push(key);
      var arr = dailyMap[key];
      var avg = arr.reduce(function(a, b) { return a + b; }) / arr.length;
      values.push(avg);
    });

  var trace = {
    x: dates.map(function(d) { return new Date(d); }),
    y: values,
    mode: "lines+markers",
    line: { width: 3 },
    marker: { size: 7 }
  };

  var layout = {
    title: "Tariff Trend",
    xaxis: {
      title: "Date",
      type: "date",
      tickformat: "%m/%d/%Y"
    },
    yaxis: { title: "Tariff (%)" }
  };

  Plotly.newPlot("tariffChart", [trace], layout);
}

// ===========================
// SUMMARY TABLE
// ===========================
function updateSummary(data) {
  var tbody = document.querySelector("#summaryTable tbody");

  if (data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='7'>No data</td></tr>";
    return;
  }

  var html = "";
  var groups = {};

  data.forEach(function(d) {
    var key = d.exporter + "_" + d.date_eff.toLocaleDateString("en-US");

    if (!groups[key]) {
      groups[key] = {
        exporter: d.exporter,
        date: d.date_eff.toLocaleDateString("en-US"),
        tariffs: [],
        weighted: [],
        values: []
      };
    }

    groups[key].tariffs.push(d.applied_tariff);
    groups[key].weighted.push(d.applied_tariff * d.imports_value_usd);
    groups[key].values.push(d.imports_value_usd);
  });

  Object.values(groups).forEach(function(g) {
    var avg = g.tariffs.reduce(function(a, b) { return a + b; }) / g.tariffs.length;
    var total = g.values.reduce(function(a, b) { return a + b; });
    var weighted = g.weighted.reduce(function(a, b) { return a + b; }) / (total || 1);

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

document.getElementById("applyFilters").addEventListener("click", function() {
  applyFilters(false);
});

// Start
loadCSV();
