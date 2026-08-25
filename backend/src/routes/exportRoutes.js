const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const exportController = require('../controllers/exportController');

router.use(protect);

// ── Consultant ────────────────────────────────────────────────────────────────
router.get('/consultant/referrals', authorize(['consultant']), exportController.consultantReferralsRoster);
router.get('/consultant/referrals/:id', authorize(['consultant']), exportController.consultantReferralRecord);
router.get('/consultant/lab-referrals', authorize(['consultant']), exportController.consultantLabReferralsRoster);
router.get('/consultant/lab-referrals/:id', authorize(['consultant']), exportController.consultantLabReferralRecord);

// ── Hospital ──────────────────────────────────────────────────────────────────
router.get('/hospital/records', authorize(['hospital']), exportController.hospitalRecords);
router.get('/hospital/referrals/:id', authorize(['hospital']), exportController.hospitalReferralRecord);

// ── Laboratory ────────────────────────────────────────────────────────────────
router.get('/lab/records', authorize(['laboratory']), exportController.labRecords);
router.get('/lab/referrals/:id', authorize(['laboratory']), exportController.labReferralRecord);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/referrals/:id', authorize(['admin']), exportController.adminReferralRecord);
router.get('/admin/consultants/:id', authorize(['admin']), exportController.adminConsultantFile);
router.get('/admin/hospitals/:id', authorize(['admin']), exportController.adminHospitalFile);
router.get('/admin/lab-referrals/:id', authorize(['admin']), exportController.adminLabReferralRecord);
router.get('/admin/laboratories/:id', authorize(['admin']), exportController.adminLaboratoryFile);

module.exports = router;
