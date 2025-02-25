const Exam = require('../models/Exam');
const Question = require('../models/Question');
const ExamAttempt = require('../models/ExamAttempt');
const Submission = require('../models/Submission');
const Result = require('../models/Result');
const Department = require('../models/Department');
const AppError = require('../utils/AppError');
const { uploadToGoogleDrive } = require('../utils/google-drive-upload');
const fs = require('fs');

// Display list of all exams
exports.getExams = async (req, res) => {
    try {
        const query = {};
        
        // Filter by department if specified
        if (req.query.department) {
            query.department = req.query.department;
        }
        
        // Filter by status if specified
        if (req.query.status) {
            query.status = req.query.status;
        }
        
        // Filter by type if specified
        if (req.query.type) {
            query.type = req.query.type;
        }
        
        // For students, only show published exams they're allowed to take
        if (req.user.role === 'student') {
            query.status = 'PUBLISHED';
            query.$or = [
                { isPublic: true },
                { allowedStudents: req.user._id }
            ];
        }
        
        // Fetch active departments for the filter
        const departments = await Department.find({ isActive: true }).sort('name');
        
        const exams = await Exam.find(query)
            .populate('createdBy', 'username firstName lastName')
            .populate('department', 'name')
            .populate('questions', 'marks')
            .sort({ startDate: 1 });
        
        res.render('exam/list', {
            title: 'Exams',
            exams,
            departments,
            user: req.user,
            query: req.query
        });
    } catch (error) {
        console.error('Error in getExams:', error);
        req.flash('error', 'Error fetching exams');
        res.redirect('/');
    }
};

// Display exam creation form
exports.getCreateExam = async (req, res) => {
    try {
        // Only teachers and admins can create exams
        if (!['teacher', 'admin'].includes(req.user.role)) {
            req.flash('error', 'Not authorized to create exams');
            return res.redirect('/exams');
        }
        
        // Fetch active departments
        const departments = await Department.find({ isActive: true }).sort('name');
        
        res.render('exam/create', {
            title: 'Create Exam',
            user: req.user,
            departments
        });
    } catch (error) {
        console.error('Error in getCreateExam:', error);
        req.flash('error', 'Error loading exam form');
        res.redirect('/exams');
    }
};

// Handle exam creation
exports.postCreateExam = async (req, res) => {
    try {
        // Only teachers and admins can create exams
        if (!['teacher', 'admin'].includes(req.user.role)) {
            req.flash('error', 'Not authorized to create exams');
            return res.redirect('/exams');
        }

        // Validate department
        if (!req.body.department) {
            req.flash('error', 'Department is required');
            return res.redirect('/exams/create');
        }

        // Check if department exists and is active
        const department = await Department.findOne({ _id: req.body.department, isActive: true });
        if (!department) {
            req.flash('error', 'Invalid or inactive department selected');
            return res.redirect('/exams/create');
        }

        // Convert checkbox values to boolean
        const formData = {
            ...req.body,
            isPublic: req.body.isPublic === 'on',
            shuffleQuestions: req.body.shuffleQuestions === 'on',
            showResults: req.body.showResults === 'on',
            createdBy: req.user._id,
            questions: [] // Start with empty questions array
        };

        // Convert string numbers to actual numbers
        formData.duration = parseInt(formData.duration);
        formData.maxAttempts = parseInt(formData.maxAttempts);

        // If exam type is PROJECT, set default marks and publish it
        if (formData.type === 'PROJECT') {
            formData.status = 'PUBLISHED'; // Automatically publish project exams
            formData.projectTotalMarks = parseInt(formData.projectTotalMarks) || 100; // Use provided marks or default to 100
            formData.passingMarks = Math.ceil(formData.projectTotalMarks * 0.5); // Set passing marks to 50% of total
            formData.questions = []; // Project exams don't need questions
        } else {
            formData.status = 'DRAFT'; // Other exam types start as draft
            delete formData.projectTotalMarks; // Remove projectTotalMarks for non-PROJECT exams as it's calculated from questions
        }
        // Create exam
        const exam = await Exam.create(formData);

        // Update department's exams array
        await Department.findByIdAndUpdate(
            department._id,
            { $push: { exams: exam._id } }
        );
        
        req.flash('success', `Exam created successfully${formData.type === 'PROJECT' ? ' and published' : ''}`);
        res.redirect(`/exams/${exam._id}`);
    } catch (error) {
        console.error('Error in postCreateExam:', error);
        req.flash('error', error.message || 'Error creating exam');
        res.redirect('/exams/create');
    }
};

// Display exam details
exports.getExam = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id)
            .populate('createdBy', 'username firstName lastName')
            .populate('department', 'name')
            .populate('questions')
            .populate('allowedStudents', 'username firstName lastName')
            .exec();
        
        if (!exam) {
            req.flash('error', 'Exam not found');
            return res.redirect('/exams');
        }
        
        // Check if user has permission to view this exam
        if (req.user.role === 'student') {
            if (exam.status !== 'PUBLISHED') {
                req.flash('error', 'Exam is not published, Not authorized to view this exam');
                return res.redirect('/exams');
            }
            // Only check allowedStudents if the exam is not public
            if (!exam.isPublic && !exam.allowedStudents.some(student => 
                student._id.toString() === req.user._id.toString())) {
                req.flash('error', 'Not authorized to view this exam');
                return res.redirect('/exams');
            }
        }
        
        // Get user's attempts if they're a student
        let attempts = [];
        if (req.user.role === 'student') {
            attempts = await ExamAttempt.find({
                exam: exam._id,
                student: req.user._id
            }).sort({ startTime: -1 });
        }
        
        res.render('exam/detail', {
            title: exam.title,
            exam,
            attempts,
            user: req.user
        });
    } catch (error) {
        console.error('Error in getExam:', error);
        req.flash('error', 'Error fetching exam details');
        res.redirect('/exams');
    }
};

// Display exam edit form
exports.getEditExam = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id)
            .populate('department', 'name')
            .populate('allowedStudents', 'username firstName lastName');
        
        if (!exam) {
            req.flash('error', 'Exam not found');
            return res.redirect('/exams');
        }
        
        // Check if user is authorized to edit
        if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            req.flash('error', 'Not authorized to edit this exam');
            return res.redirect('/exams');
        }

        // Fetch active departments
        const departments = await Department.find({ isActive: true }).sort('name');
        
        res.render('exam/edit', {
            title: `Edit ${exam.title}`,
            exam,
            departments,
            user: req.user
        });
    } catch (error) {
        console.error('Error in getEditExam:', error);
        req.flash('error', 'Error fetching exam for editing');
        res.redirect('/exams');
    }
};

// Handle exam update
exports.postEditExam = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        
        if (!exam) {
            req.flash('error', 'Exam not found');
            return res.redirect('/exams');
        }
        
        // Check if user is authorized to edit
        if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            req.flash('error', 'Not authorized to edit this exam');
            return res.redirect('/exams');
        }
        
        // Validate dates
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(req.body.endDate);
        
        if (endDate <= startDate) {
            req.flash('error', 'End date must be after start date');
            return res.redirect(`/exams/${exam._id}/edit`);
        }

        // Convert checkbox values to boolean
        const formData = {
            ...req.body,
            shuffleQuestions: req.body.shuffleQuestions === 'on',
            showResults: req.body.showResults === 'on',
            isPublic: req.body.isPublic === 'on'
        };
        
        // Update exam
        await Exam.findByIdAndUpdate(req.params.id, formData, {
            new: true,
            runValidators: true
        });
        
        req.flash('success', 'Exam updated successfully');
        res.redirect(`/exams/${exam._id}`);
    } catch (error) {
        console.error('Error in postEditExam:', error);
        req.flash('error', error.message || 'Error updating exam');
        res.redirect(`/exams/${req.params.id}/edit`);
    }
};

// Handle exam deletion
exports.deleteExam = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id)
            .populate('department', '_id');
        
        if (!exam) {
            req.flash('error', 'Exam not found');
            return res.redirect('/exams');
        }
        
        // Check if user is authorized to delete
        if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            req.flash('error', 'Not authorized to delete this exam');
            return res.redirect('/exams');
        }

        // Start cleanup process
        // 1. Delete all results associated with this exam
        await Result.deleteMany({ examId: exam._id });
        
        // 2. Delete all submissions associated with this exam
        await Submission.deleteMany({ examId: exam._id });
        
        // 3. Delete all attempts associated with this exam
        await ExamAttempt.deleteMany({ exam: exam._id });
        
        // 4. Delete all questions associated with this exam
        await Question.deleteMany({ examId: exam._id });

        // 5. Remove exam reference from department
        if (exam.department) {
            await Department.findByIdAndUpdate(
                exam.department._id,
                { $pull: { exams: exam._id } }
            );
        }
        
        // 6. Finally, delete the exam
        await exam.deleteOne();
        
        req.flash('success', 'Exam and all associated data deleted successfully');
        
        // If it's an AJAX request, send JSON response
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.json({ 
                success: true, 
                message: 'Exam deleted successfully',
                redirect: '/exams'
            });
        }

        // For regular form submissions, redirect
        res.redirect('/exams');
    } catch (error) {
        console.error('Error in deleteExam:', error);
        
        // If it's an AJAX request, send JSON error
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(500).json({ 
                success: false, 
                error: 'Error deleting exam'
            });
        }

        req.flash('error', 'Error deleting exam');
        res.redirect('/exams');
    }
};

// Handle exam publish
exports.publishExam = async (req, res, next) => {
    try {
        const exam = await Exam.findById(req.params.id);
        
        if (!exam) {
            throw new AppError('Exam not found', 404);
        }
        
        // Check if user is authorized to publish
        if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            throw new AppError('Not authorized to publish this exam', 403);
        }

        // Check if exam has questions
        if (!exam.questions || exam.questions.length === 0) {
            throw new AppError('Cannot publish exam without questions', 400);
        }

        // Update exam status
        exam.status = 'PUBLISHED';
        await exam.save();
        
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.json({ 
                success: true, 
                message: 'Exam published successfully',
                status: 'PUBLISHED'
            });
        }

        req.flash('success', 'Exam published successfully');
        res.redirect(`/exams/${exam._id}`);
    } catch (error) {
        next(error);
    }
};

// Handle exam unpublish
exports.unpublishExam = async (req, res, next) => {
    try {
        const exam = await Exam.findById(req.params.id);
        
        if (!exam) {
            throw new AppError('Exam not found', 404);
        }
        
        // Check if user is authorized to unpublish
        if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            throw new AppError('Not authorized to unpublish this exam', 403);
        }

        // Update exam status
        exam.status = 'DRAFT';
        await exam.save();
        
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.json({ 
                success: true, 
                message: 'Exam unpublished successfully',
                status: 'DRAFT'
            });
        }

        req.flash('success', 'Exam unpublished successfully');
        res.redirect(`/exams/${exam._id}`);
    } catch (error) {
        next(error);
    }
};

// Start exam
exports.startExam = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id)
            .populate({
                path: 'questions',
                populate: {
                    path: 'options'
                }
            });
        
        if (!exam) {
            req.flash('error', 'Exam not found');
            return res.redirect('/exams');
        }

        // Check if exam is published
        if (exam.status !== 'PUBLISHED') {
            req.flash('error', 'This exam is not available');
            return res.redirect('/exams');
        }

        // Check if student is allowed to take this exam
        if (!exam.isPublic && !exam.allowedStudents.includes(req.user._id)) {
            req.flash('error', 'You are not authorized to take this exam');
            return res.redirect('/exams');
        }

        // Check if exam is within the time window
        const now = new Date();
        if (now < exam.startDate || now > exam.endDate) {
            req.flash('error', 'This exam is not currently available');
            return res.redirect('/exams');
        }

        // Check attempt count
        const attemptCount = await ExamAttempt.countDocuments({
            exam: exam._id,
            student: req.user._id
        });

        if (attemptCount >= exam.maxAttempts) {
            req.flash('error', 'You have reached the maximum number of attempts for this exam');
            return res.redirect(`/exams/${exam._id}`);
        }

        // Calculate end time based on exam duration
        const endTime = new Date(now.getTime() + exam.duration * 60000);

        // Prepare questions array for the attempt
        let questions = exam.questions.map(question => ({
            question: question._id,
            answer: null,
            marks: 0,
            type: question.type // Store question type for reference
        }));

        // Shuffle questions if enabled
        if (exam.shuffleQuestions) {
            questions = questions.sort(() => Math.random() - 0.5);
        }

        // Create a new attempt
        const attempt = await ExamAttempt.create({
            exam: exam._id,
            student: req.user._id,
            startTime: now,
            endTime: endTime,
            status: 'IN_PROGRESS',
            attemptNumber: attemptCount + 1,
            questions: questions
        });

        // For project-type exams, redirect to project submission page
        if (exam.type === 'PROJECT') {
            return res.redirect(`/exams/${exam._id}/submit-project`);
        }

        // Redirect to attempt page
        res.redirect(`/exams/${exam._id}/attempt/${attempt._id}`);
    } catch (error) {
        console.error('Error in startExam:', error);
        req.flash('error', 'Error starting exam');
        res.redirect('/exams');
    }
};

// Display exam attempt
exports.getExamAttempt = async (req, res) => {
    try {
        const attempt = await ExamAttempt.findById(req.params.attemptId)
            .populate({
                path: 'exam',
                populate: {
                    path: 'questions',
                    populate: {
                        path: 'options'
                    }
                }
            });
        
        if (!attempt) {
            req.flash('error', 'Exam attempt not found');
            return res.redirect('/exams');
        }
        
        // Check if this attempt belongs to the student
        if (attempt.student.toString() !== req.user._id.toString()) {
            req.flash('error', 'Not authorized to view this attempt');
            return res.redirect('/exams');
        }

        // For project-type exams, redirect to project submission page
        if (attempt.exam.type === 'PROJECT') {
            return res.redirect(`/exams/${attempt.exam._id}/submit-project`);
        }
        
        // Check if attempt is still valid
        const now = new Date();
        if (now > attempt.endTime) {
            attempt.status = 'EXPIRED';
            await attempt.save();
            req.flash('error', 'Exam time has expired');
            return res.redirect(`/exams/${attempt.exam._id}`);
        }
        
        // Get shuffled questions from the exam
        let questions = attempt.exam.questions;
        if (attempt.exam.shuffleQuestions && attempt.status === 'IN_PROGRESS') {
            questions = [...questions].sort(() => Math.random() - 0.5);
        }

        res.render('exam/attempt', {
            title: `${attempt.exam.title} - Attempt`,
            attempt,
            questions,
            user: req.user,
            timeRemaining: attempt.endTime - now
        });
    } catch (error) {
        console.error('Error in getExamAttempt:', error);
        req.flash('error', 'Error loading exam attempt');
        res.redirect('/exams');
    }
};

// Submit exam attempt
exports.submitExamAttempt = async (req, res) => {
    try {
        const attempt = await ExamAttempt.findById(req.params.attemptId)
            .populate({
                path: 'exam',
                populate: {
                    path: 'questions',
                    populate: {
                        path: 'options'
                    }
                }
            });

        if (!attempt) {
            req.flash('error', 'Exam attempt not found');
            return res.redirect('/exams');
        }

        // Validation checks...
        const now = new Date();
        let totalMarks = 0;
        const mcqAnswers = [];
        const tfAnswers = [];

        // Process answers for each question
        for (const question of attempt.exam.questions) {
            const answer = req.body[`answer_${question._id}`];
            
            if (!answer) continue;

            // Find the corresponding attempt question
            const attemptQuestion = attempt.questions.find(q => 
                q.question.toString() === question._id.toString()
            );

            if (question.type === 'MCQ') {
                const selectedOption = question.options.find(opt => opt._id.toString() === answer);
                const correctOption = question.options.find(opt => opt.isCorrect);
                const isCorrect = selectedOption && correctOption && 
                                selectedOption._id.toString() === correctOption._id.toString();
                const marksObtained = isCorrect ? question.marks : 0;

                mcqAnswers.push({
                    questionId: question._id,
                    selectedOption: answer,
                    isCorrect,
                    marksObtained,
                    timeSpent: 0
                });

                totalMarks += marksObtained;

                // Update attempt question
                if (attemptQuestion) {
                    attemptQuestion.answer = answer;
                    attemptQuestion.marks = marksObtained;
                }
            } else if (question.type === 'TrueFalse') {
                const isCorrect = answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
                const marksObtained = isCorrect ? question.marks : 0;

                tfAnswers.push({
                    questionId: question._id,
                    answer: answer.trim().toLowerCase(),
                    isCorrect,
                    marksObtained,
                    timeSpent: 0
                });

                totalMarks += marksObtained;

                // Update attempt question
                if (attemptQuestion) {
                    attemptQuestion.answer = answer;
                    attemptQuestion.marks = marksObtained;
                }
            }
        }

        // Update attempt
        attempt.status = 'SUBMITTED';
        attempt.submittedAt = now;
        attempt.totalMarks = totalMarks;
        await attempt.save();

        // Create submission
        const submission = await Submission.create({
            examId: attempt.exam._id,
            studentId: req.user._id,
            submissionType: attempt.exam.type,
            attemptNumber: attempt.attemptNumber,
            answers: mcqAnswers,
            tfAnswers: tfAnswers,
            status: 'SUBMITTED',
            totalMarksObtained: totalMarks,
            submittedAt: now,
            startedAt: attempt.startTime,
            completedAt: now,
            ipAddress: req.ip,
            browserInfo: req.headers['user-agent'],
            isLate: now > attempt.exam.endDate
        });

        // Create result
        await Result.create({
            examId: attempt.exam._id,
            studentId: req.user._id,
            submissionId: submission._id,
            totalMarks: attempt.exam.totalMarks,
            obtainedMarks: totalMarks,
            percentage: (totalMarks / attempt.exam.totalMarks) * 100,
            status: totalMarks >= (attempt.exam.totalMarks * 0.5) ? 'PASS' : 'FAIL',
            questionResults: [...mcqAnswers, ...tfAnswers].map(answer => ({
                questionId: answer.questionId,
                obtainedMarks: answer.marksObtained,
                totalMarks: attempt.exam.questions.find(q => 
                    q._id.toString() === answer.questionId.toString()
                ).marks,
                isCorrect: answer.isCorrect
            })),
            analytics: {
                timeSpent: Math.floor((now - attempt.startTime) / 1000),
                attemptsCount: attempt.attemptNumber,
                correctAnswers: [...mcqAnswers, ...tfAnswers].filter(a => a.isCorrect).length,
                incorrectAnswers: [...mcqAnswers, ...tfAnswers].filter(a => !a.isCorrect).length,
                skippedQuestions: attempt.exam.questions.length - (mcqAnswers.length + tfAnswers.length),
                accuracyRate: (mcqAnswers.length + tfAnswers.length) > 0 ? 
                    ([...mcqAnswers, ...tfAnswers].filter(a => a.isCorrect).length / 
                    (mcqAnswers.length + tfAnswers.length)) * 100 : 0
            }
        });

        req.flash('success', 'Exam submitted successfully');
        res.redirect(`/exams/${attempt.exam._id}`);
    } catch (error) {
        console.error('Error in submitExamAttempt:', error);
        req.flash('error', 'Error submitting exam: ' + error.message);
        res.redirect(`/exams/${req.params.id}/attempt/${req.params.attemptId}`);
    }
};

// Grade exam attempt (for essay and short answer questions)
exports.gradeExamAttempt = async (req, res) => {
    try {
        const attempt = await ExamAttempt.findById(req.params.attemptId)
            .populate('exam')
            .populate('questions.question');
        
        if (!attempt) {
            req.flash('error', 'Exam attempt not found');
            return res.redirect('/exams');
        }
        
        // Check if user is authorized to grade
        if (attempt.exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            req.flash('error', 'Not authorized to grade this attempt');
            return res.redirect('/exams');
        }
        
        let totalMarks = 0;
        
        // Update marks for each question
        for (const questionAnswer of attempt.questions) {
            const questionId = questionAnswer.question._id;
            const marks = Number(req.body[`marks_${questionId}`]);
            
            if (!isNaN(marks)) {
                questionAnswer.marks = Math.min(Math.max(marks, 0), questionAnswer.question.marks);
                totalMarks += questionAnswer.marks;
            }
        }
        
        attempt.totalMarks = totalMarks;
        attempt.gradedBy = req.user._id;
        attempt.gradedAt = new Date();
        await attempt.save();
        
        req.flash('success', 'Exam graded successfully');
        res.redirect(`/exams/${attempt.exam._id}/attempts`);
    } catch (error) {
        console.error('Error in gradeExamAttempt:', error);
        req.flash('error', 'Error grading exam');
        res.redirect(`/exams/${req.params.id}/attempts`);
    }
}; 

// Display detailed exam result
exports.getExamResultDetails = async (req, res) => {
    try {
        const { examId, resultId } = req.params;

        // Fetch the result with all necessary data
        const result = await Result.findById(resultId)
            .populate('examId')
            .populate('studentId', 'username firstName lastName')
            .populate({
                path: 'submissionId',
                populate: [{
                    path: 'answers.questionId',
                    model: 'Question',
                    populate: {
                        path: 'options'
                    }
                }, {
                    path: 'tfAnswers.questionId',
                    model: 'Question'
                }]
            });

        if (!result) {
            req.flash('error', 'Result not found');
            return res.redirect('/exams');
        }

        // Get the attempt information
        const attempt = await ExamAttempt.findOne({
            exam: examId,
            student: result.studentId._id,
            status: 'SUBMITTED'
        }).sort('-submittedAt');

        // Security check - only allow viewing if:
        // 1. The student who took the exam
        // 2. Admin
        // 3. Teacher who created the exam
        // 4. Results have been released
        if (result.studentId._id.toString() !== req.user._id.toString() && 
            req.user.role !== 'admin' && 
            result.examId.createdBy.toString() !== req.user._id.toString()) {
            
            if (!result.isReleased) {
                req.flash('error', 'Results have not been released yet');
                return res.redirect('/exams');
            }

            req.flash('error', 'Not authorized to view these results');
            return res.redirect('/exams');
        }

        // If student is viewing and results are not released yet
        if (result.studentId._id.toString() === req.user._id.toString() && 
            !result.isReleased && 
            req.user.role === 'student') {
            req.flash('error', 'Results have not been released yet');
            return res.redirect('/exams');
        }

        // Fetch the exam with questions
        const exam = await Exam.findById(examId)
            .populate({
                path: 'questions',
                populate: {
                    path: 'options'
                }
            });

        if (!exam) {
            req.flash('error', 'Exam not found');
            return res.redirect('/exams');
        }

        // Combine all answers for display
        const submission = result.submissionId;
        const allAnswers = [
            ...(submission.answers || []).map(answer => ({
                ...answer.toObject(),
                type: 'MCQ'
            })),
            ...(submission.tfAnswers || []).map(answer => ({
                ...answer.toObject(),
                type: 'TrueFalse'
            }))
        ];

        // Sort answers based on question order in exam if needed
        const questionOrder = exam.questions.reduce((acc, q, idx) => {
            acc[q._id.toString()] = idx;
            return acc;
        }, {});

        allAnswers.sort((a, b) => {
            const aIdx = questionOrder[a.questionId._id.toString()] || 0;
            const bIdx = questionOrder[b.questionId._id.toString()] || 0;
            return aIdx - bIdx;
        });

        // Format time spent
        let timeSpent = '00:00:00';
        if (attempt && attempt.submittedAt && attempt.startTime) {
            const totalSeconds = Math.floor((new Date(attempt.submittedAt) - new Date(attempt.startTime)) / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            timeSpent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        res.render('exam/result-details', {
            title: `${exam.title} - Results`,
            exam,
            result,
            submission,
            allAnswers,
            attempt,
            timeSpent,
            user: req.user
        });

    } catch (error) {
        console.error('Error in getExamResultDetails:', error);
        req.flash('error', 'Error fetching exam result details');
        res.redirect('/exams');
    }
}; 

// Get Submission Details
exports.getSubmissionDetails = async (req, res) => {
    try {
        const { examId, submissionId } = req.params;

        // Fetch the submission with all necessary data
        const submission = await Submission.findById(submissionId)
            .populate('studentId', 'username firstName lastName email')
            .populate('examId')
            .populate({
                path: 'answers.questionId',
                model: 'Question',
                populate: {
                    path: 'options'
                }
            })
            .populate({
                path: 'tfAnswers.questionId',
                model: 'Question'
            });

        if (!submission) {
            req.flash('error', 'Submission not found');
            return res.redirect('/dashboard');
        }

        // Security check - only allow the teacher who created the exam or admin to view
        if (submission.examId.createdBy.toString() !== req.user._id.toString() && 
            req.user.role !== 'admin') {
            req.flash('error', 'Not authorized to view this submission');
            return res.redirect('/dashboard');
        }

        // Fetch the exam with questions
        const exam = await Exam.findById(examId)
            .populate({
                path: 'questions',
                populate: {
                    path: 'options'
                }
            });

        if (!exam) {
            req.flash('error', 'Exam not found');
            return res.redirect('/dashboard');
        }

        // Combine all answers for display
        const allAnswers = [
            ...(submission.answers || []).map(answer => ({
                ...answer.toObject(),
                type: 'MCQ'
            })),
            ...(submission.tfAnswers || []).map(answer => ({
                ...answer.toObject(),
                type: 'TrueFalse'
            }))
        ];

        // Sort answers based on question order in exam
        const questionOrder = exam.questions.reduce((acc, q, idx) => {
            acc[q._id.toString()] = idx;
            return acc;
        }, {});

        allAnswers.sort((a, b) => {
            const aIdx = questionOrder[a.questionId._id.toString()] || 0;
            const bIdx = questionOrder[b.questionId._id.toString()] || 0;
            return aIdx - bIdx;
        });

        // Get the result associated with this submission
        const result = await Result.findOne({ submissionId: submission._id });

        res.render('exam/submission-details', {
            title: `Review Submission - ${exam.title}`,
            submission,
            exam,
            result,
            allAnswers,
            user: req.user
        });

    } catch (error) {
        console.error('Error in getSubmissionDetails:', error);
        req.flash('error', 'Error fetching submission details');
        res.redirect('/dashboard');
    }
}; 

// Release exam results
exports.releaseResults = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }
        
        // Check if user is authorized to release results
        if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to release results for this exam'
            });
        }

        // Update all results for this exam to be released
        await Result.updateMany(
            { examId: exam._id },
            { isReleased: true }
        );
        
        return res.json({
            success: true,
            message: 'Results released successfully'
        });
    } catch (error) {
        console.error('Error in releaseResults:', error);
        return res.status(500).json({
            success: false,
            message: 'Error releasing results'
        });
    }
}; 

// Get project submission page
exports.getProjectSubmission = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.examId);
        
        if (!exam || exam.type !== 'PROJECT') {
            req.flash('error', 'Invalid exam or exam type');
            return res.redirect('/exams');
        }

        // Find the current attempt
        const currentAttempt = await ExamAttempt.findOne({
            exam: exam._id,
            student: req.user._id,
            status: 'IN_PROGRESS'
        }).sort('-startTime');

        if (!currentAttempt) {
            req.flash('error', 'No active attempt found. Please start the exam first.');
            return res.redirect(`/exams/${exam._id}`);
        }

        // Get existing submission if any
        const existingSubmission = await Submission.findOne({
            examId: exam._id,
            studentId: req.user._id,
            status: 'SUBMITTED'
        }).sort('-submittedAt');

        res.render('exam/project-submission', {
            title: `${exam.title} - Project Submission`,
            exam,
            currentAttempt,
            existingSubmission,
            user: req.user
        });
    } catch (error) {
        console.error('Error in getProjectSubmission:', error);
        req.flash('error', 'Error loading project submission page');
        res.redirect('/exams');
    }
};

// Submit project exam
exports.submitProjectExam = async (req, res) => {
    try {
        const { examId } = req.params;
        let fileUrl;
        
        // Check if exam exists and is of type PROJECT
        const exam = await Exam.findById(examId);
        if (!exam || exam.type !== 'PROJECT') {
            req.flash('error', 'Invalid exam or exam type');
            return res.redirect('/exams');
        }

        // Find current attempt
        const currentAttempt = await ExamAttempt.findOne({
            exam: exam._id,
            student: req.user._id,
            status: 'IN_PROGRESS'
        }).sort('-startTime');

        if (!currentAttempt) {
            req.flash('error', 'No active attempt found. Please start the exam first.');
            return res.redirect(`/exams/${examId}`);
        }

        // Check if file is uploaded
        if (!req.files || !req.files.projectFile) {
            req.flash('error', 'Please upload a file');
            return res.redirect(`/exams/${examId}/submit-project`);
        }

        const projectFile = req.files.projectFile;

        // Validate file type
        const allowedTypes = ['application/pdf', 'application/zip', 'application/x-rar-compressed', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg', 'video/mp4', 'video/mov', 'video/avi', 'video/mkv', 'video/webm'];
        if (!allowedTypes.includes(projectFile.mimetype)) {
            req.flash('error', 'Invalid file type. Please upload a supported file type.');
            return res.redirect(`/exams/${examId}/submit-project`);
        }

        // Get the latest submission to determine the next attempt number
        const latestSubmission = await Submission.findOne({
            examId: exam._id,
            studentId: req.user._id
        }).sort('-attemptNumber');

        const nextAttemptNumber = latestSubmission ? latestSubmission.attemptNumber + 1 : 1;

        // Check if max attempts reached
        if (nextAttemptNumber > exam.maxAttempts) {
            req.flash('error', 'Maximum attempts reached for this exam.');
            return res.redirect(`/exams/${examId}`);
        }

        // Try to upload file first
        try {
            // Create folder name using exam title and ID
            const folderName = `${exam.title.replace(/[^a-zA-Z0-9]/g, '_')}_${exam._id}`;
            
            // Upload file to Google Drive
            fileUrl = await uploadToGoogleDrive({
                name: projectFile.name,
                mimetype: projectFile.mimetype,
                tempFilePath: projectFile.tempFilePath
            }, folderName);
        } catch (uploadError) {
            console.error('Google Drive upload error:', uploadError);
            req.flash('error', 'Error uploading file. Please try again.');
            return res.redirect(`/exams/${examId}/submit-project`);
        }

        // Only proceed with database operations if file upload was successful
        if (fileUrl) {
            // Create submission record
            const submission = await Submission.create({
                examId: exam._id,
                studentId: req.user._id,
                submissionType: 'PROJECT',
                attemptNumber: nextAttemptNumber,
                projectSubmission: {
                    fileUrl,
                    fileName: projectFile.name,
                    fileSize: projectFile.size,
                    fileType: projectFile.mimetype,
                    submittedAt: new Date()
                },
                status: 'SUBMITTED',
                startedAt: currentAttempt.startTime,
                submittedAt: new Date()
            });

            // Update attempt status
            currentAttempt.status = 'SUBMITTED';
            currentAttempt.submittedAt = new Date();
            await currentAttempt.save();

            // Create initial result record with FAIL status (will be updated when graded)
            await Result.create({
                examId: exam._id,
                studentId: req.user._id,
                submissionId: submission._id,
                totalMarks: exam.projectTotalMarks || exam.totalMarks,
                obtainedMarks: 0, // Will be updated by teacher
                percentage: 0, // Will be updated by teacher
                status: 'FAIL', // Initial status before grading
                isReleased: false,
                analytics: {
                    timeSpent: Math.floor((new Date() - currentAttempt.startTime) / 1000),
                    attemptsCount: nextAttemptNumber,
                    correctAnswers: 0, // Not applicable for projects
                    incorrectAnswers: 0, // Not applicable for projects
                    skippedQuestions: 0, // Not applicable for projects
                    accuracyRate: 0 // Will be updated based on marks
                }
            });

            req.flash('success', 'Project submitted successfully');
            return res.redirect(`/exams/${examId}`);
        }

        // If we get here, something went wrong with the file upload
        req.flash('error', 'Error uploading file. Please try again.');
        return res.redirect(`/exams/${examId}/submit-project`);
    } catch (error) {
        console.error('Error in submitProjectExam:', error);
        req.flash('error', 'Error submitting project');
        return res.redirect(`/exams/${req.params.examId}/submit-project`);
    }
};

// Grade project submission
exports.gradeProjectSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { marks, feedback } = req.body;

        if (!marks || !feedback) {
            return res.status(400).json({ 
                success: false, 
                error: 'Marks and feedback are required' 
            });
        }

        const submission = await Submission.findById(submissionId)
            .populate({
                path: 'examId',
                select: 'projectTotalMarks passingMarks createdBy'
            });

        if (!submission) {
            return res.status(404).json({ 
                success: false, 
                error: 'Submission not found' 
            });
        }

        // Check if user is authorized to grade
        if (submission.examId.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                error: 'Not authorized to grade this submission' 
            });
        }

        // Validate marks against project total marks
        const parsedMarks = Number(marks);
        if (isNaN(parsedMarks) || parsedMarks < 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid marks value'
            });
        }

        if (parsedMarks > submission.examId.projectTotalMarks) {
            return res.status(400).json({
                success: false,
                error: `Marks cannot exceed the total marks (${submission.examId.projectTotalMarks})`
            });
        }

        // Update submission with grades
        submission.projectSubmission.marksObtained = parsedMarks;
        submission.projectSubmission.feedback = {
            text: feedback,
            givenAt: new Date(),
            givenBy: req.user._id
        };
        submission.projectSubmission.gradedBy = req.user._id;
        submission.projectSubmission.gradedAt = new Date();
        submission.totalMarksObtained = parsedMarks;
        submission.status = 'GRADED';

        await submission.save();

        // First find and update the result to ensure it exists
        const existingResult = await Result.findOne({
            examId: submission.examId._id,
            studentId: submission.studentId,
            submissionId: submission._id
        });

        if (!existingResult) {
            // Create new result if it doesn't exist
            await Result.create({
                examId: submission.examId._id,
                studentId: submission.studentId,
                submissionId: submission._id,
                totalMarks: submission.examId.projectTotalMarks,
                obtainedMarks: parsedMarks,
                percentage: (parsedMarks / submission.examId.projectTotalMarks) * 100,
                status: parsedMarks >= submission.examId.passingMarks ? 'PASS' : 'FAIL',
                evaluatedBy: req.user._id,
                evaluatedAt: new Date(),
                feedback: {
                    general: feedback,
                    givenBy: req.user._id,
                    givenAt: new Date()
                },
                analytics: {
                    accuracyRate: (parsedMarks / submission.examId.projectTotalMarks) * 100
                }
            });
        } else {
            // Update existing result
            existingResult.totalMarks = submission.examId.projectTotalMarks;
            existingResult.obtainedMarks = parsedMarks;
            existingResult.percentage = (parsedMarks / submission.examId.projectTotalMarks) * 100;
            existingResult.status = parsedMarks >= submission.examId.passingMarks ? 'PASS' : 'FAIL';
            existingResult.evaluatedBy = req.user._id;
            existingResult.evaluatedAt = new Date();
            existingResult.feedback = {
                general: feedback,
                givenBy: req.user._id,
                givenAt: new Date()
            };
            existingResult.analytics.accuracyRate = (parsedMarks / submission.examId.projectTotalMarks) * 100;
            
            await existingResult.save();
        }

        return res.json({ 
            success: true,
            message: 'Project graded successfully'
        });
    } catch (error) {
        console.error('Error in gradeProjectSubmission:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'Error grading submission'
        });
    }
}; 

// Get all submissions for an exam
exports.getExamSubmissions = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.examId)
            .populate('department', 'name')
            .populate('createdBy', 'firstName lastName');

        if (!exam) {
            req.flash('error', 'Exam not found');
            return res.redirect('/exams');
        }

        // Check if user is authorized to view submissions
        if (exam.createdBy._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            req.flash('error', 'Not authorized to view submissions');
            return res.redirect('/exams');
        }

        // Get all submissions for this exam
        const submissions = await Submission.find({ examId: exam._id })
            .populate('studentId', 'firstName lastName email')
            .populate({
                path: 'examId',
                populate: {
                    path: 'department',
                    select: 'name'
                }
            })
            .sort('-submittedAt');

        res.render('exam/submissions-list', {
            title: `${exam.title} - Submissions`,
            exam,
            submissions,
            user: req.user
        });
    } catch (error) {
        console.error('Error in getExamSubmissions:', error);
        req.flash('error', 'Error fetching submissions');
        res.redirect('/exams');
    }
};

// Get grading interface for a submission
exports.getGradeSubmission = async (req, res) => {
    try {
        const { examId, submissionId } = req.params;
        
        const submission = await Submission.findById(submissionId)
            .populate('studentId', 'firstName lastName email')
            .populate('examId');

        if (!submission) {
            req.flash('error', 'Submission not found');
            return res.redirect(`/exams/${examId}/submissions`);
        }

        // Check if user is authorized to grade
        if (submission.examId.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            req.flash('error', 'Not authorized to grade this submission');
            return res.redirect(`/exams/${examId}/submissions`);
        }

        res.render('exam/grade-submission', {
            title: 'Grade Submission',
            submission,
            user: req.user
        });
    } catch (error) {
        console.error('Error in getGradeSubmission:', error);
        req.flash('error', 'Error loading grading interface');
        res.redirect(`/exams/${req.params.examId}/submissions`);
    }
}; 