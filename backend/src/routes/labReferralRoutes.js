const express = require('express');
const router = express.Router();
const {
  getLabSuggestions,
  createLabReferral,
  getMyLabReferrals,
  reReferLab,
  getLabReferralDetails,
  getLabInbox,
  getLabReferrals,
  acceptLabReferral,
  rejectLabReferral,
  uploadLabReports,
  updateLabBill,
  finalizeLabBill,
  verifyLabReferralDetailsPassword,
  changeLabReferralDetailsPassword,
} = require('../controllers/labReferralController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// ── Consultant ──────────────────────────────────────────────────────────────
router.get('/suggestions', authorize(['consultant']), getLabSuggestions);
router.post('/', authorize(['consultant']), createLabReferral);
router.get('/mine', authorize(['consultant']), getMyLabReferrals);
router.patch('/:id/re-refer', authorize(['consultant']), reReferLab);

// ── Laboratory ──────────────────────────────────────────────────────────────
router.get('/inbox', authorize(['laboratory']), getLabInbox);
router.get('/lab-all', authorize(['laboratory']), getLabReferrals);
router.patch('/:id/accept', authorize(['laboratory']), acceptLabReferral);
router.patch('/:id/reject', authorize(['laboratory']), rejectLabReferral);
router.post('/:id/reports', authorize(['laboratory']), uploadLabReports);
router.patch('/:id/bill', authorize(['laboratory']), updateLabBill);
router.patch('/:id/finalize', authorize(['laboratory']), finalizeLabBill);
router.post('/:id/verify-details-password', authorize(['laboratory']), verifyLabReferralDetailsPassword);
router.post('/:id/change-details-password', authorize(['laboratory']), changeLabReferralDetailsPassword);

// ── Shared (consultant owner | target lab | admin) ──────────────────────────
router.get('/:id', authorize(['consultant', 'laboratory', 'admin']), getLabReferralDetails);

module.exports = router;
