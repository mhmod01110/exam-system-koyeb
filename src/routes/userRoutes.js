const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isAuth } = require('../middleware/auth');

// Dashboard route
router.get('/dashboard', isAuth, userController.getDashboard);

// Profile routes
router.get('/profile', isAuth, userController.getProfile);
router.post('/profile', isAuth, userController.updateProfile);

// Student specific routes
router.get('/my-exams', isAuth, userController.getMyExams);
router.get('/results', isAuth, userController.getResults);

module.exports = router; 