const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/labSettlementController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// ── Laboratory ──────────────────────────────────────────────────────────────
router.get('/pending-referrals', authorize(['laboratory']), ctrl.listPendingReferrals);
router.post('/', authorize(['laboratory']), ctrl.createSettlement);
router.post('/:id/receipt', authorize(['laboratory']), ctrl.uploadLabReceipt);
router.get('/mine', authorize(['laboratory']), ctrl.listLabSettlements);

// ── Admin ────────────────────────────────────────────────────────────────────
router.get('/admin', authorize(['admin']), ctrl.adminListSettlements);
router.post('/:id/verify', authorize(['admin']), ctrl.adminVerifyLabReceipt);
router.post('/:id/payout', authorize(['admin']), ctrl.adminUploadConsultantPayout);

// ── Consultant ──────────────────────────────────────────────────────────────
router.get('/consultant', authorize(['consultant']), ctrl.consultantListPayouts);
router.get('/consultant/earnings', authorize(['consultant']), ctrl.consultantLabEarnings);
router.post('/:id/consultant-verify', authorize(['consultant']), ctrl.consultantVerifyPayout);

module.exports = router;
