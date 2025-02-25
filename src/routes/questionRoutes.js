const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const { isAuth, isTeacher } = require('../middleware/auth');

// Question routes
router.get('/', isAuth, questionController.getQuestions);
router.get('/create', isAuth, isTeacher, questionController.getCreateQuestion);
router.post('/create', isAuth, isTeacher, questionController.postCreateQuestion);
router.get('/:id', isAuth, isTeacher, questionController.getQuestion);
router.get('/:id/edit', isAuth, isTeacher, questionController.getEditQuestion);
router.post('/:id/edit', isAuth, isTeacher, questionController.postEditQuestion);
router.delete('/:examId/questions/:id', isAuth, isTeacher, questionController.deleteQuestion);
router.post('/:id/upload-image', isAuth, isTeacher, questionController.postUploadImage);

module.exports = router; 