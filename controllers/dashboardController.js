// controllers/dashboardController.js
const QuickChart = require("quickchart-js");
const pool = require("../db"); // adjust if your db file is in a different path

// Helper to safe-cast numeric
const toNum = v => (v === null || typeof v === "undefined") ? 0 : Number(v);

module.exports = {
  // GET /dashboard
  listWarehouses: async (req, res) => {
    try {
      const company = req.session && req.session.company_name;
      if (!company) return res.redirect("/signin"); // or handle auth as you prefer

      const q = `SELECT * FROM warehouse WHERE company_name = $1 ORDER BY name`;
      const { rows: warehouses } = await pool.query(q, [company]);

      return res.render("dashboard", { warehouses, company });
    } catch (err) {
      console.error("listWarehouses error:", err);
      return res.status(500).send("Server error");
    }
  },

  // GET /dashboard/view/:warehouseId
  viewWarehouse: async (req, res) => {
    try {
      const warehouseId = Number(req.params.warehouseId);
      if (!warehouseId) return res.status(400).send("Missing warehouse id");

      // fetch warehouse
      const wareQ = `SELECT * FROM warehouse WHERE warehouse_id = $1`;
      const { rows: wareRows } = await pool.query(wareQ, [warehouseId]);
      const warehouse = wareRows[0];
      if (!warehouse) return res.status(404).send("Warehouse not found");

      // items in warehouse (join via racks -> bins -> products)
      const itemsQ = `
        SELECT p.product_id, p.name, p.quantity, p.priority, p.inserted_at, p.size, p.weight, p.bin_id, p.rack_id
        FROM products p
        JOIN bins b ON p.bin_id = b.bin_id
        JOIN racks r ON b.rack_id = r.rack_id
        WHERE r.warehouse_id = $1
        ORDER BY p.inserted_at DESC
      `;
      const { rows: items } = await pool.query(itemsQ, [warehouseId]);

      // used & free space from bins
      const binsQ = `
        SELECT
          COALESCE(SUM(current_load),0) AS used,
          COALESCE(SUM(capacity - current_load),0) AS free,
          COALESCE(SUM(capacity),0) AS total_capacity
        FROM bins
        WHERE warehouse_id = $1
      `;
      const { rows: binStatsRows } = await pool.query(binsQ, [warehouseId]);
      const binStats = binStatsRows[0] || { used: 0, free: 0, total_capacity: 0 };
      const used = toNum(binStats.used);
      const free = toNum(binStats.free);
      const totalCapacity = toNum(binStats.total_capacity);

      // Basic numeric stats
      const totalItems = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      const uniqueSkus = new Set(items.map(i => i.name)).size;

      // Recent activity logs (optional table: activity_logs)
      let logs = [];
      try {
        const logsQ = `
          SELECT * FROM activity_logs
          WHERE warehouse_id = $1
          ORDER BY created_at DESC
          LIMIT 20
        `;
        const { rows: logRows } = await pool.query(logsQ, [warehouseId]);
        logs = logRows;
      } catch (e) {
        // if table doesn't exist, continue with empty logs
        console.warn("activity_logs fetch failed (maybe table missing):", e.message);
        logs = [];
      }

      // Build server-side charts (QuickChart URLs)
      // Bar chart for top N products by quantity (limit labels length)
      const topItems = items.slice(0, 20); // limit to 20 for chart clarity
      const barChart = new QuickChart();
      barChart.setWidth(800).setHeight(400);
      barChart.setConfig({
        type: "bar",
        data: {
          labels: topItems.map(i => i.name),
          datasets: [{
            label: "Quantity",
            data: topItems.map(i => Number(i.quantity) || 0),
            backgroundColor: 'rgba(54, 162, 235, 0.7)'
          }]
        },
        options: {
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { ticks: { maxRotation: 45, minRotation: 0 } },
            y: { beginAtZero: true }
          }
        }
      });

      // Pie chart for used vs free
      const pieChart = new QuickChart();
      pieChart.setWidth(500).setHeight(320);
      pieChart.setConfig({
        type: "pie",
        data: {
          labels: ["Used", "Free"],
          datasets: [{
            data: [used, free],
            backgroundColor: ['#ef4444', '#10b981']
          }]
        },
        options: {
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });

      // Get URLs (QuickChart will produce an image URL)
      const barUrl = barChart.getUrl();
      const pieUrl = pieChart.getUrl();

      return res.render("warehouseView", {
        warehouse,
        items,
        used,
        free,
        totalCapacity,
        totalItems,
        uniqueSkus,
        barUrl,
        pieUrl,
        logs
      });
    } catch (err) {
      console.error("viewWarehouse error:", err);
      return res.status(500).send("Server error");
    }
  }
};
