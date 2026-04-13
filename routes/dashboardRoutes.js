// routes/dashboardRoutes.js
const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");

// Show list of warehouses for the current user's company
router.get("/", dashboardController.listWarehouses);

// Show a single warehouse view (stats, items, charts, logs)
router.get("/view/:warehouseId", dashboardController.viewWarehouse);

module.exports = router;
