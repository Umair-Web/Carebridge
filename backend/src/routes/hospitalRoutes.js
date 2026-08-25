const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getHospitalAnalytics,
  getReferralPipeline,
  getBeds,
  updateBeds,
  listDoctors,
  addDoctor,
  updateDoctor,
  deleteDoctor,
} = require('../controllers/hospitalController');
const admissionController = require('../controllers/admissionController');
const teamController = require('../controllers/teamController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize(['hospital']));

// Team / staff logins for this hospital (owner + added sub-users, equal access)
router.get('/users', teamController.listHospitalUsers);
router.post('/users', teamController.addHospitalUser);
router.delete('/users/:id', teamController.removeHospitalUser);

router.get('/dashboard', getDashboardStats);
router.get('/analytics', getHospitalAnalytics);
router.get('/financial-ledger', require('../controllers/hospitalController').getFinancialLedger);
router.get('/referrals-pipeline', getReferralPipeline);
router.get('/beds', getBeds);
router.patch('/beds', updateBeds);
router.patch('/departments', require('../controllers/hospitalController').updateDepartments);

router.get('/doctors', listDoctors);
router.post('/doctors', addDoctor);
router.patch('/doctors/:id', updateDoctor);
router.delete('/doctors/:id', deleteDoctor);

router.get('/admissions', admissionController.listAdmissions);
router.post('/admissions', admissionController.createAdmission);
router.patch('/admissions/:id', admissionController.updateAdmission);
router.post('/admissions/:id/complete', admissionController.completeAdmission);

module.exports = router;
