const express = require('express');
const router = express.Router();
const {
  getSuggestions,
  createReferral,
  getMyReferrals,
  getHospitalInbox,
  getHospitalReferrals,
  updateReferralStatus,
  getReferralDetails,
  getConsultantEarnings,
  getHospitalDoctors,
  addClinicalNote,
  updateReferralByConsultant,
  createWithdrawalRequest,
  verifyReferralDetailsPassword,
} = require('../controllers/referralController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// ── Consultant ────────────────────────────────────────────────────────────────
router.get('/hospitals/:id/doctors', authorize(['consultant', 'hospital']), getHospitalDoctors);
router.get('/suggestions', authorize(['consultant']), getSuggestions);
router.post('/', authorize(['consultant']), createReferral);
router.get('/mine', authorize(['consultant']), getMyReferrals);
router.get('/earnings', authorize(['consultant']), getConsultantEarnings);
router.post('/withdraw', authorize(['consultant']), createWithdrawalRequest);

// ── Hospital ──────────────────────────────────────────────────────────────────
router.get('/inbox', authorize(['hospital']), getHospitalInbox);
router.get('/hospital-all', authorize(['hospital']), getHospitalReferrals);

router.patch('/:id/accept', authorize(['hospital']), (req, res, next) => {
  req.body = { ...req.body, status: 'accepted' };
  updateReferralStatus(req, res, next);
});
router.patch('/:id/reject', authorize(['hospital']), (req, res, next) => {
  req.body = { ...req.body, status: 'rejected' };
  updateReferralStatus(req, res, next);
});

router.post('/:id/verify-details-password', authorize(['consultant', 'hospital', 'admin']), verifyReferralDetailsPassword);
router.get('/:id', authorize(['consultant', 'hospital']), getReferralDetails);
router.patch('/:id', authorize(['consultant']), updateReferralByConsultant);
router.patch('/:id/status', authorize(['hospital']), updateReferralStatus);
router.post('/:id/notes', authorize(['consultant', 'hospital']), addClinicalNote);

module.exports = router;
