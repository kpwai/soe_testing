// ========================================================
// Trade Model (CP) Equilibrium Dashboard — HS6 + ISIC2
// ========================================================

// CSV paths
const CSV_HS6 = "data/tariff_datahs6.csv";
const CSV_HS8 = "data/tariff_datahs8.csv";   // used for ISIC2

// Global datasets
let hs6Data = [];
let hs8Data = [];

// Pre-calculated exporter list (from both datasets)
let allExporters = new Set();

// Active classification: "hs6", "isic2"
let activeClassification = "";

// --------------------------------------------------------
// INITIALIZE WHEN PAGE READY
// --------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  setupExporterDropdown();

  // Load HS6 first, then HS8, then build UI
  loadCSV_HS6(() => {
    loadCSV_HS8(() => {
      populateExporterPanel();
      setupClassificationHandler();
      document.getElementById("applyFilters").addEventListener("click", applyFilters);
    });
  });
});

// --------------------------------------------------------
// LOAD HS6 CSV
// --------------------------------------------------------
function loadCSV_HS6(callback) {
  fetch(CSV_HS6)
    .then(r => r.text())
    .then(text => {
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      hs6Data = result.data.map(row => {

        const d = new Date(row.date_eff);
        if (isNaN(d)) return null;

        const exporter = (row.exporter || "").trim();
        const importer = (row.importer || "").trim();
        const hs6code = (row.hs6 || "").trim();

        const tariff = parseFloat(row.tariffs || 0);
        const tradeValue = parseFloat(row.importsvaluein1000usd || 0) * 1000;

        if (exporter) allExporters.add(exporter);

        return {
          importer,
          exporter,
          code: hs6code,
          date: d,
          tariff: isNaN(tariff) ? 0 : tariff,
          tradeValue: isNaN(tradeValue) ? 0 : tradeValue
        };
      }).filter(x => x !== null);

      console.log("HS6 Loaded:", hs6Data.length);
      callback();
    })
    .catch(err => console.error("Error loading HS6:", err));
}

// --------------------------------------------------------
// LOAD HS8 CSV (for ISIC2)
// --------------------------------------------------------
function loadCSV_HS8(callback) {
  fetch(CSV_HS8)
    .then(r => r.text())
    .then(text => {
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      hs8Data = result.data.map(row => {
        const d = new Date(row.date_eff);
        if (isNaN(d)) return null;

        const exporter = (row.exporter || "").trim();
        const importer = (row.importer || "").trim();
        const hs8code = (row.product || "").trim();

        const tariff = parseFloat(row.applied_tariff || 0);
        const tradeValue = parseFloat(row.imports_value_usd || 0);

        if (exporter) allExporters.add(exporter);

        // Convert HS8 → ISIC2 = first 2 digits of HS8
        let isic2 = hs8code.substring(0, 2);

        return {
          importer,
          exporter,
          code: isic2,
          date: d,
          tariff: isNaN(tariff) ? 0 : tariff,
          tradeValue: isNaN(tradeValue) ? 0 : tradeValue
        };
      }).filter(x => x !== null);

      console.log("HS8 Loaded (ISIC2 converted):", hs8Data.length);
      callback();
    })
    .catch(err => console.error("Error loading HS8:", err));
}

// --------------------------------------------------------
// EXPORTER DROPDOWN UI
// --------------------------------------------------------
function setupExporterDropdown() {
  const box = document.getElementById("exporterBox");
  const display = document.getElementById("exporterDisplay");

  display.addEventListener("click", e => {
    e.stopPropagation();
    box.style.display = box.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", () => box.style.display = "none");
}

function populateExporterPanel() {
  const box = document.getElementById("exporterBox");
  box.innerHTML = "";

  const exporters = [...allExporters].sort();

  exporters.forEach(exp => {
    const lbl = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "exporter-checkbox";
    cb.value = exp;

    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(" " + exp));
    box.appendChild(lbl);
  });
}

function getSelectedExporters() {
  const checkboxes = document.querySelectorAll(".exporter-checkbox:checked");
  return Array.from(checkboxes).map(cb => cb.value);
}

function updateExporterDisplay() {
  const selected = getSelectedExporters();
  const text = document.getElementById("exporterDisplayText");

  if (selected.length === 0) text.textContent = "World (aggregate)";
  else if (selected.length === 1) text.textContent = selected[0];
  else text.textContent = `${selected.length} exporters selected`;
}

// --------------------------------------------------------
// CLASSIFICATION SWITCHING (HS6 or ISIC2)
// --------------------------------------------------------
function setupClassificationHandler() {
  const cls = document.getElementById("classificationSelect");
  cls.addEventListener("change", () => {
    activeClassification = cls.value;
    showCorrectClassificationDetail();
    populateClassificationDetailOptions();
  });
}

function showCorrectClassificationDetail() {
  const label = document.getElementById("classificationDetailLabel");
  const hs6Sel = document.getElementById("hs6ProductSelect");
  const isicSel = document.getElementById("isicSelect");

  hs6Sel.style.display = "none";
  isicSel.style.display = "none";
  label.textContent = "";

  if (activeClassification === "hs6") {
    label.textContent = "HS6 product:";
    hs6Sel.style.display = "block";
  } else if (activeClassification === "isic2") {
    label.textContent = "ISIC 2-digit:";
    isicSel.style.display = "block";
  }
}

function populateClassificationDetailOptions() {
  if (activeClassification === "hs6") {
    const sel = document.getElementById("hs6ProductSelect");
    sel.innerHTML = `<option value="">All products</option>`;

    const codes = new Set(hs6Data.map(x => x.code));
    [...codes].sort().forEach(c => {
      sel.innerHTML += `<option value="${c}">${c}</option>`;
    });
  }

  if (activeClassification === "isic2") {
    const sel = document.getElementById("isicSelect");
    sel.innerHTML = `<option value="">All ISIC</option>`;

    const codes = new Set(hs8Data.map(x => x.code));
    [...codes].sort().forEach(c => {
      sel.innerHTML += `<option value="${c}">${c}</option>`;
    });
  }
}

// --------------------------------------------------------
// FILTER + DRAW
// --------------------------------------------------------
function applyFilters() {
  updateExporterDisplay();

  if (!activeClassification) {
    alert("Please select a classification first.");
    return;
  }

  const importer = document.getElementById("importerSelect").value;
  const exporters = getSelectedExporters();
  const dateFrom = document.getElementById("dateFrom").value;
  const dateTo = document.getElementById("dateTo").value;

  const start = dateFrom ? new Date(dateFrom) : null;
  const end = dateTo ? new Date(dateTo) : null;

  let codeFilter = "";
  if (activeClassification === "hs6")
    codeFilter = document.getElementById("hs6ProductSelect").value;
  else
    codeFilter = document.getElementById("isicSelect").value;

  const data = activeClassification === "hs6" ? hs6Data : hs8Data;

  // FILTERING
  const out = data.filter(d => {

    if (importer && d.importer !== importer) return false;

    if (exporters.length > 0 && !exporters.includes(d.exporter)) return false;

    if (codeFilter && d.code !== codeFilter) return false;

    if (start && d.date < start) return false;
    if (end && d.date > end) return false;

    return true;
  });

  drawChart(out, exporters);
  updateSummary(out, exporters);
}

// --------------------------------------------------------
// DRAW TRUE-SCALED DATE-TREND
// --------------------------------------------------------
function drawChart(data, exporters) {
  const div = document.getElementById("tariffChart");

  if (!data || data.length === 0) {
    Plotly.newPlot(div, [], { title: "No data available" });
    return;
  }

  const worldMode = exporters.length === 0;
  let traces = [];
  let tickvals = [];
  let ticktext = [];

  if (worldMode) {
    let grouped = {};

    data.forEach(d => {
      let k = d.date.toLocaleDateString("en-US");
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(d.tariff);
    });

    const keys = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

    let dates = [];
    let vals = [];

    keys.forEach(k => {
      dates.push(new Date(k));
      vals.push(avg(grouped[k]));
    });

    tickvals = dates;
    ticktext = keys;

    traces.push({
      x: dates,
      y: vals,
      mode: "lines+markers",
      name: "World",
      line: { shape: "hv", width: 3, color: "#003366" },
      marker: { size: 8, color: "#003366" }
    });

  } else {
    let allDates = new Set();

    data.forEach(d => {
      allDates.add(d.date.toLocaleDateString("en-US"));
    });

    const keys = [...allDates].sort((a, b) => new Date(a) - new Date(b));
    const dates = keys.map(k => new Date(k));

    tickvals = dates;
    ticktext = keys;

    exporters.forEach(exp => {
      let grouped = {};

      data.forEach(d => {
        if (d.exporter !== exp) return;
        let k = d.date.toLocaleDateString("en-US");
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(d.tariff);
      });

      let yvals = keys.map(k => grouped[k] ? avg(grouped[k]) : null);

      traces.push({
        x: dates,
        y: yvals,
        mode: "lines+markers",
        name: exp,
        line: { shape: "hv", width: 2 },
        marker: { size: 7 }
      });
    });
  }

  Plotly.newPlot(div, traces, {
    title: (activeClassification === "hs6" ? "HS6" : "ISIC 2-digit") + " Tariff Trend",
    xaxis: {
      type: "date",
      tickmode: "array",
      tickvals,
      ticktext,
      tickangle: -45
    },
    yaxis: { title: "Tariff (%)" },
    showlegend: !worldMode,
    font: { family: "Georgia, serif", size: 14 }
  });
}

// --------------------------------------------------------
// SUMMARY TABLE
// --------------------------------------------------------
function updateSummary(data, exporters) {
  const tbody = document.querySelector("#summaryTable tbody");
  const title = document.getElementById("summary-title");

  if (!data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='7'>No data available</td></tr>";
    title.textContent = "";
    return;
  }

  let importer = document.getElementById("importerSelect").value || "World";
  let productLabel = "All products";

  if (activeClassification === "hs6") {
    productLabel = document.getElementById("hs6ProductSelect").value || "All HS6";
  } else {
    productLabel = document.getElementById("isicSelect").value || "All ISIC2";
  }

  let exporterLabel =
      exporters.length === 0 ? "World" :
      exporters.length === 1 ? exporters[0] :
      "Multiple exporters";

  title.textContent = `${importer} imports from ${exporterLabel} — ${productLabel}`;

  let grouped = {};

  data.forEach(d => {
    let dk = d.date.toLocaleDateString("en-US");
    let k = d.exporter + "_" + dk;

    if (!grouped[k]) {
      grouped[k] = {
        exporter: d.exporter,
        date: dk,
        tariffs: [],
        weighted: [],
        values: []
      };
    }

    grouped[k].tariffs.push(d.tariff);
    grouped[k].weighted.push(d.tariff * d.tradeValue);
    grouped[k].values.push(d.tradeValue);
  });

  let html = "";

  Object.values(grouped).forEach(g => {
    let avgT = avg(g.tariffs);
    let totalV = sum(g.values);
    let wAvg = totalV ? sum(g.weighted) / totalV : 0;

    html += `
      <tr>
        <td>${g.exporter}</td>
        <td>${g.date}</td>
        <td>${avgT.toFixed(3)}</td>
        <td>${wAvg.toFixed(3)}</td>
        <td>${totalV.toFixed(0)}</td>
        <td>100%</td>
        <td>100%</td>
      </tr>`;
  });

  if ($.fn.DataTable.isDataTable("#summaryTable")) {
    $("#summaryTable").DataTable().destroy();
  }
  tbody.innerHTML = html;

  $("#summaryTable").DataTable({
    pageLength: 5,
    order: [[1, "asc"]]
  });
}

// --------------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------------
function avg(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}
