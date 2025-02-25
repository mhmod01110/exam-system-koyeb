const express = require('express');
const router = express.Router();
const { isAuth, isTeacher, isAdmin } = require('../middleware/auth');
const departmentController = require('../controllers/departmentController');

// Department management routes (admin only)
router.get('/', isAuth, departmentController.getDepartments);
router.get('/create', isAuth, isAdmin, departmentController.getCreateDepartment);
router.post('/', isAuth, isAdmin, departmentController.postCreateDepartment);
router.get('/:id/edit', isAuth, isAdmin, departmentController.getEditDepartment);
router.put('/:id', isAuth, isAdmin, departmentController.updateDepartment);
router.delete('/:id', isAuth, isAdmin, departmentController.deleteDepartment);

// Department content routes (accessible by all authenticated users)
router.get('/:id/exams', isAuth, departmentController.getDepartmentExams);
router.get('/:id/materials', isAuth, departmentController.getDepartmentMaterials);

// Material management routes (teachers and admins)
router.post('/:id/materials', isAuth, isTeacher, departmentController.addMaterial);
router.delete('/:id/materials/:materialId', isAuth, isTeacher, departmentController.deleteMaterial);

module.exports = router; 