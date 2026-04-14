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
// AUTH + PRODUCT ROUTES
// ----------------------------------------------------------------------------------------------
app.get('/', (req, res) => res.redirect('/dashboard'));
app.use('/signup', signUpRoutes);                 // Signup root
app.use('/login', signInRoutes);                  // Login
app.use('/makeInv', makeInv);
app.use('/verify-otp', verifyOtp);
app.use('/manageInv', manageInv);
app.use('/submit-batch', addingProduct);
app.use('/retrieve-product', retrieveProduct);
app.use('/product', requireAuth, productGetter);

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

// Per-warehouse inventory list
app.get("/inventory/:warehouseId", requireAuth, async (req, res) => {
  try {
    const company = req.session.company_name || req.session.companyName;
    const warehouseId = parseInt(req.params.warehouseId);
    if (!warehouseId) return res.status(400).send('Missing warehouse ID');

    // Fetch warehouse details
    const whRes = await db.query(
      `SELECT w.warehouse_id, w.name, w.length, w.width, w.height, w.usable_space,
              COUNT(DISTINCT r.rack_id) AS rack_count,
              COUNT(DISTINCT b.bin_id) AS total_bins,
              COUNT(DISTINCT CASE WHEN b.current_load = 0 THEN b.bin_id END) AS free_bins,
              COALESCE(SUM(b.capacity),0) AS total_capacity,
              COALESCE(SUM(b.current_load),0) AS total_used
       FROM warehouse w
       LEFT JOIN racks r ON r.warehouse_id = w.warehouse_id
       LEFT JOIN bins b ON b.rack_id = r.rack_id
       WHERE w.warehouse_id = $1 AND w.company_name = $2
       GROUP BY w.warehouse_id`, [warehouseId, company]
    );
    if (!whRes.rows.length) return res.status(404).send('Warehouse not found');
    const wh = whRes.rows[0];
    const cap  = parseFloat(wh.total_capacity) || 0;
    const used = parseFloat(wh.total_used) || 0;
    const util = cap > 0 ? Math.round((used / cap) * 100) : 0;

    // Fetch all products in this warehouse
    const prodRes = await db.query(`
      SELECT p.product_id, p.name, p.sku, p.category, p.quantity, p.priority,
             p.weight, p.size, p.bin_id,
             b.bin_id as b_id,
             r.name as rack_name, r.rack_id
      FROM products p
      JOIN bins b ON p.bin_id = b.bin_id
      JOIN racks r ON b.rack_id = r.rack_id
      WHERE r.warehouse_id = $1
      ORDER BY
        CASE p.priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Normal' THEN 2 ELSE 3 END,
        p.name
    `, [warehouseId]);

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
      products: prodRes.rows
    });
  } catch (err) {
    console.error('Inventory error:', err);
    res.status(500).send('Server error');
  }
});

// Redirect plain /inventory to warehouse picker
app.get('/inventory', requireAuth, (req, res) => res.redirect('/warehouse'));

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
