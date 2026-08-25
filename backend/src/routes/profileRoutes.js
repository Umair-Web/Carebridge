const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { protect } = require('../middleware/auth');

router.get('/me', protect, profileController.getProfile);
router.put('/me', protect, profileController.updateProfile);
router.post('/documents', protect, profileController.upsertProfileDocument);
router.post('/favorites', protect, profileController.toggleFavoriteHospital);
router.post('/change-password', protect, profileController.changePassword);

module.exports = router;
