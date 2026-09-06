const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/labAdminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize(['admin']));

router.get('/', ctrl.listLabs);
router.get('/referrals', ctrl.listLabReferrals);
router.patch('/referrals/:id/details-view-access', ctrl.setLabReferralDetailsViewAccess);
router.patch('/referrals/:id', ctrl.updateLabReferral);
router.get('/payouts', ctrl.listLabPayouts);
router.post('/forgot-access-password', ctrl.forgotLabProfileAccessPassword);
router.patch('/access-password', ctrl.changeLabProfileAccessPassword);
router.post('/verify-access', ctrl.verifyLabAccessPassword);
router.post('/:id/verify-access', ctrl.verifyLabProfileAccess);
router.get('/:id', ctrl.getLab);
router.get('/:id/consultant-overrides', ctrl.listLabConsultantOverrides);
router.post('/:id/consultant-overrides', ctrl.setLabConsultantOverride);
router.patch('/:id/status', ctrl.setLabStatus);
router.patch('/:id', ctrl.updateLab);

module.exports = router;
