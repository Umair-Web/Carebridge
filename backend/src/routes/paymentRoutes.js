const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

// Initiate payment (Hospital only)
router.get('/initiate-jazzcash/:admissionId', protect, paymentController.initiateJazzCashPayment);

// Callback from JazzCash (Public, with hash verification)
router.post('/jazzcash-callback', paymentController.jazzCashCallback);

module.exports = router;
