// controllers/dashboardController.js
const QuickChart = require("quickchart-js");
const pool = require("../db");

const toNum = v => (v === null || typeof v === "undefined") ? 0 : Number(v);

// Helper: human-readable relative time
function timeAgo(date) {
    const now = Date.now();
    const diff = now - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
}

// Helper: dot color from action type
function dotColor(action) {
    if (!action) return '#cbd5e1';
    const a = action.toLowerCase();
    if (a.includes('add') || a.includes('creat')) return '#378ADD';
    if (a.includes('reorgani') || a.includes('optimiz')) return '#3B6D11';
    if (a.includes('retriev') || a.includes('remov') || a.includes('delet')) return '#A32D2D';
    if (a.includes('alert') || a.includes('warn')) return '#854F0B';
    return '#cbd5e1';
}

module.exports = {
    // GET /dashboard
    listWarehouses: async (req, res) => {
        try {
            const company = req.session && (req.session.company_name || req.session.companyName);
            const userName = req.session && (req.session.name || req.session.userName || 'there');

            // ── 1. Total products across entire company ──────────────────────
            let totalProducts = 0;
            try {
                const r = await pool.query(`
                    SELECT COUNT(*) as c FROM products p
                    JOIN bins b ON p.bin_id = b.bin_id
                    JOIN racks r ON b.rack_id = r.rack_id
                    JOIN warehouse w ON r.warehouse_id = w.warehouse_id
                    WHERE w.company_name = $1
                `, [company]);
                totalProducts = toNum(r.rows[0]?.c);
            } catch(e) {
                // products table may be empty — fine
            }

            // ── 2. Space utilization across all bins ─────────────────────────
            let spacePercent = 0;
            let totalBins = 0;
            let freeBins = 0;
            try {
                const r = await pool.query(`
                    SELECT
                        COUNT(b.bin_id) as total_bins,
                        COUNT(CASE WHEN b.current_load = 0 THEN 1 END) as free_bins,
                        COALESCE(SUM(b.capacity), 0) as total_cap,
                        COALESCE(SUM(b.current_load), 0) as total_used
                    FROM bins b
                    JOIN racks r ON b.rack_id = r.rack_id
                    JOIN warehouse w ON r.warehouse_id = w.warehouse_id
                    WHERE w.company_name = $1
                `, [company]);
                const row = r.rows[0];
                totalBins  = toNum(row?.total_bins);
                freeBins   = toNum(row?.free_bins);
                const cap  = toNum(row?.total_cap);
                const used = toNum(row?.total_used);
                spacePercent = cap > 0 ? Math.round((used / cap) * 100) : 0;
            } catch(e) {}

            // ── 3. Low-stock items (quantity <= 10), capped at 5 for sidebar ──
            let lowStockItems = [];
            let lowStockCount = 0;
            try {
                const r = await pool.query(`
                    SELECT p.name, p.quantity FROM products p
                    JOIN bins b ON p.bin_id = b.bin_id
                    JOIN racks rk ON b.rack_id = rk.rack_id
                    JOIN warehouse w ON rk.warehouse_id = w.warehouse_id
                    WHERE w.company_name = $1 AND p.quantity <= 10
                    ORDER BY p.quantity ASC
                    LIMIT 5
                `, [company]);
                lowStockItems = r.rows;
                lowStockCount = r.rows.length;
            } catch(e) {}

            // ── 4. Recent activity log (last 5 entries) ───────────────────────
            let activityLog = [];
            try {
                // Try our apiController's activity_log table first
                const r = await pool.query(`
                    SELECT action, detail, created_at FROM activity_log
                    ORDER BY created_at DESC
                    LIMIT 5
                `);
                activityLog = r.rows.map(row => ({
                    action: row.action,
                    detail: row.detail,
                    timeAgo: timeAgo(row.created_at),
                    dotColor: dotColor(row.action)
                }));
            } catch(e) {
                // Table might not exist yet — just leave empty
            }

            // ── 5. Warehouses for the "Add Product" step wizard ───────────────
            let warehouses = [];
            try {
                const r = await pool.query(
                    `SELECT warehouse_id, name, usable_space FROM warehouse WHERE company_name = $1 ORDER BY name`,
                    [company]
                );
                warehouses = r.rows;
            } catch(e) {}

            // ── 6. Greeting time of day ───────────────────────────────────────
            const hour = new Date().getHours();
            const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

            // ── 7. Space health label ─────────────────────────────────────────
            const spaceHealth = spacePercent > 85 ? 'Critical' : spacePercent > 65 ? 'Moderate' : 'Healthy';
            const spaceHealthClass = spacePercent > 85 ? 'indicator-warning' : 'indicator-positive';

            return res.render("dashboard", {
                name: userName,
                greeting,
                totalProducts,
                spacePercent,
                spaceHealth,
                spaceHealthClass,
                lowStockCount,
                lowStockItems,
                totalBins,
                freeBins,
                activityLog,
                warehouses,
                company
            });

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

            const wareQ = `SELECT * FROM warehouse WHERE warehouse_id = $1`;
            const { rows: wareRows } = await pool.query(wareQ, [warehouseId]);
            const warehouse = wareRows[0];
            if (!warehouse) return res.status(404).send("Warehouse not found");

            const itemsQ = `
                SELECT p.product_id, p.name, p.quantity, p.priority, p.inserted_at, p.size, p.weight, p.bin_id, p.rack_id
                FROM products p
                JOIN bins b ON p.bin_id = b.bin_id
                JOIN racks r ON b.rack_id = r.rack_id
                WHERE r.warehouse_id = $1
                ORDER BY p.inserted_at DESC
            `;
            const { rows: items } = await pool.query(itemsQ, [warehouseId]);

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

            const totalItems = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
            const uniqueSkus = new Set(items.map(i => i.name)).size;

            let logs = [];
            try {
                const logsQ = `
                    SELECT action, detail, created_at FROM activity_log
                    ORDER BY created_at DESC LIMIT 20
                `;
                const { rows: logRows } = await pool.query(logsQ);
                logs = logRows;
            } catch (e) {
                console.warn("activity_log fetch failed:", e.message);
            }

            const topItems = items.slice(0, 20);
            const barChart = new QuickChart();
            barChart.setWidth(800).setHeight(400);
            barChart.setConfig({
                type: "bar",
                data: {
                    labels: topItems.map(i => i.name),
                    datasets: [{
                        label: "Quantity",
                        data: topItems.map(i => Number(i.quantity) || 0),
                        backgroundColor: 'rgba(55, 138, 221, 0.7)'
                    }]
                },
                options: {
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { maxRotation: 45, minRotation: 0 } },
                        y: { beginAtZero: true }
                    }
                }
            });

            const pieChart = new QuickChart();
            pieChart.setWidth(500).setHeight(320);
            pieChart.setConfig({
                type: "pie",
                data: {
                    labels: ["Used", "Free"],
                    datasets: [{
                        data: [used, free],
                        backgroundColor: ['#A32D2D', '#3B6D11']
                    }]
                },
                options: { plugins: { legend: { position: 'bottom' } } }
            });

            const barUrl = barChart.getUrl();
            const pieUrl = pieChart.getUrl();

            return res.render("warehouseView", {
                warehouse, items, used, free, totalCapacity,
                totalItems, uniqueSkus, barUrl, pieUrl, logs
            });
        } catch (err) {
            console.error("viewWarehouse error:", err);
            return res.status(500).send("Server error");
        }
    }
};
