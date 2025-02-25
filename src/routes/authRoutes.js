const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const homeController = require('../controllers/homeController');
const { isAuth } = require('../middleware/auth');

router.get('/', homeController.getHome);

// Login routes
router.get('/auth/login', authController.getLogin);
router.post('/auth/login', authController.postLogin);

// Register routes
router.get('/auth/register', authController.getRegister);
router.post('/auth/register', authController.postRegister);

// Password reset routes
router.get('/auth/forgot-password', authController.getForgotPassword);
router.post('/auth/forgot-password', authController.postForgotPassword);
router.get('/auth/reset-password/:token', authController.getResetPassword);
router.post('/auth/reset-password/:token', authController.postResetPassword);

// Logout route
router.post('/auth/logout', isAuth, authController.logout);

module.exports = router; 