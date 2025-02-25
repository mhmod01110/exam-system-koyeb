const Exam = require('../models/Exam');
const Result = require('../models/Result');
const User = require('../models/User');
const Question = require('../models/Question');
const Submission = require('../models/Submission');
const Department = require('../models/Department');

exports.getHome = async (req, res) => {
    try {
        // Get active departments with populated exams
        const departments = await Department.find({ isActive: true })
            .populate({
                path: 'exams',
                match: { status: 'PUBLISHED' },
                select: 'title startDate endDate allowedStudents type projectTotalMarks questions',
                options: { limit: 3 }
            })
            .sort('name');

        // If user is not logged in, render the guest view
        if (!req.session.user) {
            return res.render('index', {
                title: 'Welcome to Online Exam System',
                user: null,
                departments
            });
        }

        // For students
        if (req.session.user.role === 'student') {
            // Get upcoming exams (published exams that haven't started yet)
            const upcomingExams = await Exam.find({
                status: 'PUBLISHED',
                startDate: { $gt: new Date() }
            })
            .select('title startDate endDate duration')
            .sort({ startDate: 1 })
            .limit(5);
        
            // Get recent results
            const recentResults = await Result.find({
                studentId: req.session.user._id
            })
            .populate('examId', 'title')
            .sort({ submittedAt: -1 })
            .limit(5)
            .lean();
        
            // Format results
            const formattedResults = recentResults.map(result => ({
                ...result,
                examTitle: result.examId.title
            }));

            // For each department, determine student's level
            const departmentsWithLevels = await Promise.all(departments.map(async department => {
                // Find the latest released result for this department
                const latestResult = await Result.findOne({
                    studentId: req.session.user._id,
                    isReleased: true,
                    status: { $in: ['PASS', 'FAIL'] },
                    examId: { $in: department.exams.map(exam => exam._id) }
                })
                .sort({ createdAt: -1 })
                .lean();

                let studentLevel = 'Beginner';
                if (latestResult) {
                    const percentage = latestResult.percentage;
                    if (percentage > 70) {
                        studentLevel = 'Advanced';
                    } else if (percentage > 50) {
                        studentLevel = 'Normal';
                    }
                }

                // Convert department to a plain object without virtuals
                const departmentObj = department.toObject({ virtuals: false });
                
                // Add only the necessary exam data
                departmentObj.exams = department.exams.map(exam => ({
                    _id: exam._id,
                    title: exam.title,
                    startDate: exam.startDate,
                    endDate: exam.endDate
                }));

                return {
                    ...departmentObj,
                    studentLevel
                };
            }));
        
            return res.render('index', {
                title: 'Student Dashboard',
                user: req.session.user,
                upcomingExams,
                recentResults: formattedResults,
                departments: departmentsWithLevels
            });
        }
        
        // For teachers and admins
        let query = {};
        let submissionsQuery = {};
        
        // If teacher, only show their exams
        if (req.session.user.role === 'teacher') {
            query.createdBy = req.session.user._id;
            submissionsQuery['examId.createdBy'] = req.session.user._id;
        }

        // Get recent exams
        const recentExams = await Exam.find(query)
            .populate('questions')
            .populate('submissions')
            .sort({ createdAt: -1 })
            .limit(5);

        // Get submissions
        const submissions = await Submission.find(submissionsQuery)
            .populate('studentId', 'firstName lastName email')
            .populate('examId', 'title totalMarks createdBy')
            .sort('-submittedAt')
            .limit(50);

        // Calculate statistics
        const stats = {
            totalExams: await Exam.countDocuments(query),
            totalQuestions: await Question.countDocuments(
                req.session.user.role === 'teacher' ? { 'examId.createdBy': req.session.user._id } : {}
            ),
            totalSubmissions: await Submission.countDocuments(submissionsQuery)
        };

        // Add total users count for admin
        if (req.session.user.role === 'admin') {
            stats.totalUsers = await User.countDocuments();
        }

        return res.render('index', {
            title: 'Dashboard',
            user: req.session.user,
            recentExams,
            submissions,
            departments,
            ...stats
        });
    } catch (error) {
        console.error('Error in getHome:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
}; 