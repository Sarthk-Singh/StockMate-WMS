// Requires ----------------------------------------------------------------------------------------------------------
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const dotenv = require('dotenv').config();

// Custom Require ------------------------------------------------------------------------------------------------------------
const db = require('./db.js');
const mailer = require('./mailer.js');
const session = require('express-session');
const { requireAuth } = require('./middleware/auth.js');

// Routes Include ----------------------------------------------------------------------------------------------------
const signInRoutes = require('./routes/signinroutes.js');
const signUpRoutes = require('./routes/signuproutes.js');
const makeInv = require('./routes/makeInv.js');
const verifyOtp = require('./routes/VerificationOtpRoute.js');
const manageInv = require('./routes/manageInv.js');
const addingProduct  = require('./routes/addingProduct.js');
const retrieveProduct = require('./routes/retrieveProduct.js');
const productGetter = require('./routes/productRouter.js');

// NEW Dashboard route (your upgraded one)
const dashboardRoutes = require('./routes/dashboardRoutes.js');

// API Algorithmic Routes (Knapsack + Hashing)
const apiRoutes = require('./routes/apiRoutes.js');

// Middleware ---------------------------------------------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));     // Serve /public correctly
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // Required for Modal JSON fetch payloads
app.set("view engine", "ejs");
app.use(session({
    secret: process.env.SESSION_SECRET || "xyz123secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 86400000 }
}));
app.set("views", path.join(__dirname, "views"));


// ----------------------------------------------------------------------------------------------
// AUTH + CORE ROUTES
// ----------------------------------------------------------------------------------------------
app.get('/', (req, res) => res.redirect('/dashboard'));
app.use('/signup', signUpRoutes);
app.use('/login', signInRoutes);
app.use('/makeInv', makeInv);
app.use('/verify-otp', verifyOtp);
// Note: /manageInv, /submit-batch, /retrieve-product, /product removed — superseded by /inventory routes

// ----------------------------------------------------------------------------------------------
// NEW DASHBOARD ROUTES
// ----------------------------------------------------------------------------------------------
app.use('/dashboard', requireAuth, dashboardRoutes);
app.use('/', apiRoutes); // Mounts /inventory & /warehouse local algorithms
// Now your dashboard loads the warehouse list page + warehouse view page
// /dashboard               -> warehouse cards
// /dashboard/view/:id     -> full fancy dashboard

// ----------------------------------------------------------------------------------------------
// Warehouse Listing (Old Page)
// ----------------------------------------------------------------------------------------------
// Warehouse Listing
app.get("/warehouse", requireAuth, async (req, res) => {
  try {
    const company = req.session.company_name || req.session.companyName;

    const result = await db.query(`
      SELECT
        w.warehouse_id,
        w.name,
        w.length,
        w.width,
        w.height,
        w.usable_space,
        COUNT(DISTINCT r.rack_id) AS rack_count,
        COUNT(DISTINCT b.bin_id) AS total_bins,
        COUNT(DISTINCT CASE WHEN b.current_load = 0 THEN b.bin_id END) AS free_bins,
        COALESCE(SUM(b.capacity), 0) AS total_capacity,
        COALESCE(SUM(b.current_load), 0) AS total_used
      FROM warehouse w
      LEFT JOIN racks r ON r.warehouse_id = w.warehouse_id
      LEFT JOIN bins b ON b.rack_id = r.rack_id
      WHERE w.company_name = $1
      GROUP BY w.warehouse_id, w.name, w.length, w.width, w.height, w.usable_space
      ORDER BY w.name
    `, [company]);

    const warehouses = result.rows.map(row => {
      const cap   = parseFloat(row.total_capacity) || 0;
      const used  = parseFloat(row.total_used) || 0;
      const util  = cap > 0 ? Math.round((used / cap) * 100) : 0;
      return {
        id:           row.warehouse_id,
        name:         row.name,
        usable_space: parseFloat(row.usable_space) || 0,
        rackCount:    parseInt(row.rack_count) || 0,
        totalBins:    parseInt(row.total_bins) || 0,
        freeBins:     parseInt(row.free_bins) || 0,
        utilPercent:  util > 100 ? 100 : util,
        availSqft:    Math.round(cap - used)
      };
    });

    res.render("warehousese", { warehouses });

  } catch (err) {
    console.error("Error fetching warehouses:", err);
    res.status(500).send("Internal Server Error");
  }
});


// Delete Warehouse ----------------------------------------------------------------------------------------------
app.post("/warehouse/delete/:id", async (req, res) => {
  try {
    const company = req.session.company_name || req.session.companyName;
    const warehouseId = req.params.id;

    await db.query(
      "DELETE FROM warehouse WHERE warehouse_id = $1 AND company_name = $2",
      [warehouseId, company]
    );

    res.redirect("/warehouse");
  } catch (err) {
    console.error("Error deleting warehouse:", err);
    res.status(500).send("Internal Server Error");
  }
});


// Temporary route ----------------------------------------------------------------------------------------------
app.get("/storage", requireAuth, (req, res) => {
  res.render("underConstruction.ejs");
});

// ──────────────────────────────────────────────────────────────
// INVENTORY: CSV TEMPLATE DOWNLOAD
// ──────────────────────────────────────────────────────────────
app.get('/inventory/csv-template', requireAuth, (req, res) => {
  const csv = [
    'name,quantity,size,weight,priority,warehouse',
    'Steel Bearings,100,0.5,2.0,High,Main Warehouse',
    'Copper Tubing,50,1.2,4.5,Medium,Main Warehouse',
    'Cardboard Boxes,200,0.8,0.3,Low,Main Warehouse'
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="stockmate_template.csv"');
  res.send(csv);
});

// ──────────────────────────────────────────────────────────────
// INVENTORY: SINGLE PRODUCT ADD  (POST /inventory/add)
// Uses existing apiController knapsack Best Fit logic
// ──────────────────────────────────────────────────────────────
app.post('/inventory/add', requireAuth, async (req, res) => {
  try {
    const { name, quantity, weight, size, priority, warehouse_id } = req.body;
    const qNum = parseInt(quantity) || 1;
    const sNum = parseFloat(size) || 1;
    const itemWeight = sNum * qNum;
    const compName = req.session.company_name || req.session.companyName || '';

    // Verify the warehouse belongs to this company
    const whCheck = await db.query(
      'SELECT warehouse_id, name FROM warehouse WHERE warehouse_id = $1 AND company_name = $2',
      [warehouse_id, compName]
    );
    if (!whCheck.rows.length) return res.json({ success: false, error: 'Warehouse not found for your company.' });
    const whName = whCheck.rows[0].name;

    // Best-Fit Decreasing bin selection
    const binsRes = await db.query(`
      SELECT b.* FROM bins b
      JOIN racks r ON b.rack_id = r.rack_id
      WHERE r.warehouse_id = $1
      ORDER BY b.bin_id ASC
    `, [warehouse_id]);

    let bestBin = null, tightestFit = Infinity;
    for (const b of binsRes.rows) {
      const remain = parseFloat(b.capacity) - parseFloat(b.current_load || 0);
      if (remain >= itemWeight && (remain - itemWeight) < tightestFit) {
        tightestFit = remain - itemWeight;
        bestBin = b;
      }
    }
    if (!bestBin) return res.json({ success: false, error: `No bin has enough space. Need ${itemWeight.toFixed(2)} m³.` });

    let prioInt = 1;
    if (priority === 'High') prioInt = 2;
    if (priority === 'Low')  prioInt = 0;

    await db.query(
      `INSERT INTO products (name, size, weight, quantity, priority, warehouse, company_name, bin_id, rack_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [name, sNum, parseFloat(weight)||0, qNum, prioInt, whName, compName, bestBin.bin_id, bestBin.rack_id]
    );
    await db.query('UPDATE bins SET current_load = current_load + $1 WHERE bin_id = $2', [itemWeight, bestBin.bin_id]);
    await db.query(
      'INSERT INTO activity_log (action, detail, user_id) VALUES ($1,$2,$3)',
      ['Product added', `${name} → Bin ${bestBin.bin_id} (${whName})`, req.session.userId || null]
    );
    return res.json({ success: true, binAssigned: bestBin.bin_id, remainingSpace: tightestFit });
  } catch (err) {
    console.error('Add product error:', err);
    return res.json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// INVENTORY: BULK CSV ADD  (POST /inventory/bulk-add)
// ──────────────────────────────────────────────────────────────
app.post('/inventory/bulk-add', requireAuth, async (req, res) => {
  try {
    const { rows, warehouse_id } = req.body;
    const compName = req.session.company_name || req.session.companyName || '';
    if (!rows || !rows.length) return res.json({ success: false, error: 'No rows provided.' });

    // Verify warehouse belongs to this company
    const whCheck = await db.query(
      'SELECT warehouse_id, name FROM warehouse WHERE warehouse_id = $1 AND company_name = $2',
      [warehouse_id, compName]
    );
    if (!whCheck.rows.length) return res.json({ success: false, error: 'Warehouse not found.' });
    const whName = whCheck.rows[0].name;

    // Load all bins for this warehouse once
    const binsRes = await db.query(`
      SELECT b.* FROM bins b
      JOIN racks r ON b.rack_id = r.rack_id
      WHERE r.warehouse_id = $1 ORDER BY b.bin_id ASC
    `, [warehouse_id]);

    // Keep a mutable copy of current_load so we can track within-upload fills
    const bins = binsRes.rows.map(b => ({ ...b, current_load: parseFloat(b.current_load)||0 }));

    let added = 0, skipped = 0;
    const errors = [];

    for (const row of rows) {
      const name     = (row.name || '').trim();
      const qty      = parseInt(row.quantity) || 0;
      const size     = parseFloat(row.size) || 0;
      const weight   = parseFloat(row.weight) || 0;
      const priority = (row.priority || 'Medium').trim();
      const rowWh    = (row.warehouse || '').trim().toLowerCase();

      // Skip if name empty
      if (!name || qty < 1 || size <= 0) { skipped++; errors.push(`Row skipped: invalid data (name=${name})`); continue; }

      // Skip if warehouse name provided and doesn't match (case-insensitive)
      if (rowWh && rowWh !== whName.toLowerCase()) {
        skipped++;
        errors.push(`"${name}" skipped: warehouse "${row.warehouse}" doesn't match "${whName}"`);
        continue;
      }

      const itemWeight = size * qty;

      // Best-fit
      let bestBin = null, tightestFit = Infinity;
      for (const b of bins) {
        const remain = parseFloat(b.capacity) - b.current_load;
        if (remain >= itemWeight && (remain - itemWeight) < tightestFit) {
          tightestFit = remain - itemWeight;
          bestBin = b;
        }
      }
      if (!bestBin) { skipped++; errors.push(`"${name}" skipped: no bin with ${itemWeight.toFixed(2)} m³ free`); continue; }

      let prioInt = 1;
      if (priority.toLowerCase() === 'high') prioInt = 2;
      if (priority.toLowerCase() === 'low')  prioInt = 0;

      await db.query(
        `INSERT INTO products (name, size, weight, quantity, priority, warehouse, company_name, bin_id, rack_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [name, size, weight, qty, prioInt, whName, compName, bestBin.bin_id, bestBin.rack_id]
      );
      await db.query('UPDATE bins SET current_load = current_load + $1 WHERE bin_id = $2', [itemWeight, bestBin.bin_id]);

      // Update local tracking so subsequent rows see updated load
      bestBin.current_load += itemWeight;
      added++;
    }

    if (added > 0) {
      await db.query(
        'INSERT INTO activity_log (action, detail, user_id) VALUES ($1,$2,$3)',
        ['CSV Import', `${added} product(s) added to ${whName}`, req.session.userId || null]
      );
    }

    return res.json({ success: true, added, skipped, errors });
  } catch (err) {
    console.error('Bulk add error:', err);
    return res.json({ success: false, error: err.message });
  }
});

// Per-warehouse inventory list
app.get("/inventory/:warehouseId", requireAuth, async (req, res) => {
  try {
    const company = req.session.company_name || req.session.companyName;
    const warehouseId = parseInt(req.params.warehouseId);
    if (!warehouseId) return res.status(400).send('Missing warehouse ID');

    // Fetch warehouse + real stats
    const whRes = await db.query(`
      SELECT w.warehouse_id, w.name,
             COUNT(DISTINCT r.rack_id) AS rack_count,
             COUNT(DISTINCT b.bin_id) AS total_bins,
             COUNT(DISTINCT CASE WHEN b.current_load = 0 THEN b.bin_id END) AS free_bins,
             COALESCE(SUM(b.capacity),0) AS total_capacity,
             COALESCE(SUM(b.current_load),0) AS total_used
      FROM warehouse w
      LEFT JOIN racks r ON r.warehouse_id = w.warehouse_id
      LEFT JOIN bins b ON b.rack_id = r.rack_id
      WHERE w.warehouse_id = $1 AND w.company_name = $2
      GROUP BY w.warehouse_id
    `, [warehouseId, company]);
    if (!whRes.rows.length) return res.status(404).send('Warehouse not found');
    const wh = whRes.rows[0];
    const cap  = parseFloat(wh.total_capacity) || 0;
    const used = parseFloat(wh.total_used) || 0;
    const util = cap > 0 ? Math.round((used / cap) * 100) : 0;

    // Fetch products — using ONLY real schema columns
    const prodRes = await db.query(`
      SELECT p.product_id, p.name, p.weight, p.size, p.quantity, p.priority,
             p.inserted_at, p.bin_id, p.rack_id,
             r.name AS rack_name
      FROM products p
      JOIN bins b ON p.bin_id = b.bin_id
      JOIN racks r ON b.rack_id = r.rack_id
      WHERE r.warehouse_id = $1
      ORDER BY p.priority DESC, p.name
    `, [warehouseId]);

    // Map priority integer to label
    const prioLabel = { 2: 'High', 1: 'Medium', 0: 'Low' };
    const products = prodRes.rows.map(p => ({
      ...p,
      priorityLabel: prioLabel[p.priority] || 'Medium'
    }));

    res.render('productList', {
      warehouse: {
        id:          wh.warehouse_id,
        name:        wh.name,
        rackCount:   parseInt(wh.rack_count) || 0,
        totalBins:   parseInt(wh.total_bins) || 0,
        freeBins:    parseInt(wh.free_bins) || 0,
        utilPercent: util,
        availSqft:   Math.round(cap - used)
      },
      products
    });
  } catch (err) {
    console.error('Inventory error:', err);
    res.status(500).send('Server error: ' + err.message);
  }
});

// All-products inventory page (global, across all warehouses for this company)
app.get('/inventory', requireAuth, async (req, res) => {
  try {
    const company = req.session.company_name || req.session.companyName;

    const prodRes = await db.query(`
      SELECT p.product_id, p.name, p.weight, p.size, p.quantity, p.priority,
             p.warehouse, p.inserted_at, p.bin_id, p.rack_id,
             r.name AS rack_name,
             w.name AS warehouse_name, w.warehouse_id
      FROM products p
      JOIN bins b ON p.bin_id = b.bin_id
      JOIN racks r ON b.rack_id = r.rack_id
      JOIN warehouse w ON r.warehouse_id = w.warehouse_id
      WHERE p.company_name = $1
      ORDER BY p.priority DESC, p.name
    `, [company]);

    const prioLabel = { 2: 'High', 1: 'Medium', 0: 'Low' };
    const products = prodRes.rows.map(p => ({
      ...p,
      priorityLabel: prioLabel[p.priority] || 'Medium'
    }));

    // Summary stats
    const totalProducts = products.length;
    const lowStock = products.filter(p => p.quantity <= 10).length;

    res.render('inventoryAll', { products, totalProducts, lowStock, company });
  } catch (err) {
    console.error('Global inventory error:', err);
    res.status(500).send('Server error: ' + err.message);
  }
});

app.get("/reports", requireAuth, (req, res) => {
  res.render("underConstruction.ejs");
});

app.get("/settings", requireAuth, (req, res) => {
  res.render("settings", { 
      name: req.session.name || "Sarthak", 
      email: req.session.email || "sarthak@stockmate.com" 
  });
});

app.post("/logout", (req, res) => {
  if (!req.session) return res.redirect('/login');
  
  req.session.destroy((err) => {
    if (err) console.error("Session destruction error:", err);
    res.clearCookie('connect.sid');
    res.redirect("/login");
  });
});


// Listen --------------------------------------------------------------------------------------------------------
app.listen(process.env.PORT || 3000, () => {
  console.log("Server is Running at Port 3000");
});
