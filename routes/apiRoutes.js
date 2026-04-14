const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController.js');
const { requireAuth } = require('../middleware/auth.js');

// Protect these with auth if they are making DB adjustments
router.get('/warehouse/list', requireAuth, apiController.listWarehouses);
router.post('/inventory/retrieve', requireAuth, apiController.retrieveProduct);
router.post('/inventory/add', requireAuth, apiController.addProduct);
router.get('/inventory/search', requireAuth, apiController.searchProduct);
router.get('/warehouse/stats', requireAuth, apiController.getStats);
router.post('/warehouse/reorganize', requireAuth, apiController.reorganizeBins);

module.exports = router;
