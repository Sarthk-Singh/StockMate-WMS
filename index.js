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
const session = require('./session.js');

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

// Middleware ---------------------------------------------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));     // Serve /public correctly
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(session);
app.set("views", path.join(__dirname, "views"));


// ----------------------------------------------------------------------------------------------
// AUTH + PRODUCT ROUTES
// ----------------------------------------------------------------------------------------------
app.use('/', signUpRoutes);                 // Signup root
app.use('/signin', signInRoutes);           // Login
app.use('/makeInv', makeInv);
app.use('/verify-otp', verifyOtp);
app.use('/manageInv', manageInv);
app.use('/submit-batch', addingProduct);
app.use('/retrieve-product', retrieveProduct);
app.use('/product', productGetter);

// ----------------------------------------------------------------------------------------------
// NEW DASHBOARD ROUTES
// ----------------------------------------------------------------------------------------------
app.use('/dashboard', dashboardRoutes);
// Now your dashboard loads the warehouse list page + warehouse view page
// /dashboard               -> warehouse cards
// /dashboard/view/:id     -> full fancy dashboard


// ----------------------------------------------------------------------------------------------
// Home Route 
// ----------------------------------------------------------------------------------------------
app.get("/home", (req, res) => {

  // Fix session company name key
  const cname = req.session.company_name || req.session.companyName;

  const addedProduct = req.session.addedProduct || false;
  const warehouseMsg = req.session.warehouseMsg || false;
  req.session.warehouseMsg = null;
  req.session.addedProduct = null;

  res.render("home", {
    addedProduct,
    warehouseMsg,
    name: req.session.name,
    email: req.session.email,
    cname,
    rack: req.session.rackId,
    bin: req.session.BinId
  });

  console.log("warehouseMsg:", req.session.warehouseMsg, "addedProduct:", req.session.addedProduct);
});


// ----------------------------------------------------------------------------------------------
// Warehouse Listing (Old Page)
// ----------------------------------------------------------------------------------------------
app.get("/warehouse", async (req, res) => {
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
app.get("/storage", (req, res) => {
  res.render("underConstruction.ejs");
});


// Listen --------------------------------------------------------------------------------------------------------
app.listen(process.env.PORT || 3000, () => {
  console.log("Server is Running at Port 3000");
});
