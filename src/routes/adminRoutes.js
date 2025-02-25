const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuth, isAdmin } = require('../middleware/auth');

// Admin dashboard
router.get('/admin', isAuth, isAdmin, adminController.getDashboard);

// User management
router.get('/admin/users', isAuth, isAdmin, adminController.getUsers);
router.get('/admin/users/create', isAuth, isAdmin, adminController.getCreateUser);
router.post('/admin/users/create', isAuth, isAdmin, adminController.postCreateUser);
router.get('/admin/users/:id/edit', isAuth, isAdmin, adminController.getEditUser);
router.post('/admin/users/:id/edit', isAuth, isAdmin, adminController.postEditUser);
router.post('/admin/users/staff', isAuth, isAdmin, adminController.postAddStaff);
router.post('/admin/users/:id/toggle-status', isAuth, isAdmin, adminController.postToggleUserStatus);
router.delete('/admin/users/:id', isAuth, isAdmin, adminController.deleteUser);

// Department management
router.get('/admin/departments', isAuth, isAdmin, adminController.getDepartments);
router.post('/admin/departments', isAuth, isAdmin, adminController.createDepartment);
router.put('/admin/departments/:id', isAuth, isAdmin, adminController.updateDepartment);
router.delete('/admin/departments/:id', isAuth, isAdmin, adminController.deleteDepartment);

// System settings
router.get('/admin/settings', isAuth, isAdmin, adminController.getSettings);
router.post('/admin/settings', isAuth, isAdmin, adminController.updateSettings);

// Reports
router.get('/admin/reports/exams', isAuth, isAdmin, adminController.getExamReports);
router.get('/admin/reports/users', isAuth, isAdmin, adminController.getUserReports);
router.get('/admin/reports/performance', isAuth, isAdmin, adminController.getPerformanceReports);

// Student progress routes
router.get('/admin/users/students/:id', isAuth, isAdmin, adminController.getStudentProgress);
router.get('/admin/users/students/:id/export-pdf', isAuth, isAdmin, adminController.getExportPDF);
router.get('/admin/users/students/:id/export-excel', isAuth, isAdmin, adminController.getExportExcel);

module.exports = router; 