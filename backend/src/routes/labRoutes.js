const express = require('express');
const router = express.Router();
const {
  getProfile,
  getDashboardStats,
  getTestCatalog,
  addTest,
  updateTest,
  deleteTest,
} = require('../controllers/labController');
const teamController = require('../controllers/teamController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize(['laboratory']));

// Team / staff logins for this laboratory (owner + added sub-users, equal access)
router.get('/users', teamController.listLabUsers);
router.post('/users', teamController.addLabUser);
router.delete('/users/:id', teamController.removeLabUser);

router.get('/me', getProfile);
router.get('/dashboard', getDashboardStats);
router.get('/tests', getTestCatalog);
router.post('/tests', addTest);
router.patch('/tests/:testId', updateTest);
router.delete('/tests/:testId', deleteTest);

module.exports = router;
