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
app.get("/warehouse", requireAuth, async (req, res) => {
  try {
    const company = req.session.company_name || req.session.companyName;

    const result = await db.query(
      "SELECT warehouse_id, name, usable_space FROM warehouse WHERE company_name = $1",
      [company]
    );

    const warehouses = result.rows.map((row) => ({
      id: row.warehouse_id,
      name: row.name,
      usable_space: row.usable_space
    }));

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

app.get("/inventory", requireAuth, (req, res) => {
  res.render("underConstruction.ejs");
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
