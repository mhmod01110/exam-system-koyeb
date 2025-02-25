const User = require('../models/User');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const Result = require('../models/Result');
const ExamAttempt = require('../models/ExamAttempt');

// Get Dashboard
exports.getDashboard = async (req, res) => {
    try {
        const user = req.user;
        let stats = {};
        let submissions = [];
        let recentAttempts = [];
        let upcomingExams = [];

        if (user.role === 'student') {
            // Get all results for this student
            const results = await Result.find({
                studentId: user._id
            })
            .populate('examId')
            .sort('-createdAt');

            // Calculate student statistics from released results
            const releasedResults = results.filter(r => r.isReleased);
            stats = {
                totalExams: releasedResults.length,
                examsPassed: releasedResults.filter(r => r.status === 'PASS').length,
                examsFailed: releasedResults.filter(r => r.status === 'FAIL').length,
                averageScore: releasedResults.length > 0 
                    ? (releasedResults.reduce((sum, r) => sum + r.percentage, 0) / releasedResults.length).toFixed(1)
                    : 0
            };

            // Get only IN_PROGRESS attempts
            recentAttempts = await ExamAttempt.find({
                student: user._id,
                status: 'IN_PROGRESS'  // Only get attempts that are still in progress
            })
            .populate('exam')
            .sort('-startTime')
            .limit(5);

            // Get upcoming exams
            upcomingExams = await Exam.find({
                status: 'PUBLISHED',
                startDate: { $gt: new Date() },
                $or: [
                    { isPublic: true },
                    { allowedStudents: user._id }
                ]
            }).limit(5);

            // Add results to the view data
            res.locals.studentResults = results;

        } else {
            // For teachers and admins
            let query = {};
            
            // If teacher, only show their exams
            if (user.role === 'teacher') {
                query.createdBy = user._id;
            }

            // Get submissions
            const submissionsQuery = user.role === 'teacher' 
                ? { 'examId.createdBy': user._id }
                : {};

            submissions = await Submission.find(submissionsQuery)
                .populate('studentId', 'firstName lastName email')
                .populate({
                    path: 'examId',
                    select: 'title totalMarks createdBy department type projectTotalMarks',
                    populate: {
                        path: 'department',
                        select: 'name'
                    }
                })
                .sort('-submittedAt')
                .limit(50);

            // Calculate statistics
            stats = {
                totalExams: await Exam.countDocuments(query),
                activeExams: await Exam.countDocuments({ 
                    ...query, 
                    status: 'PUBLISHED',
                    endDate: { $gt: new Date() }
                }),
                totalSubmissions: await Submission.countDocuments(submissionsQuery),
                pendingGrades: await Submission.countDocuments({
                    ...submissionsQuery,
                    status: { $ne: 'GRADED' }
                })
            };
        }

        res.render('dashboard', {
            title: 'Dashboard',
            user,
            stats,
            submissions,
            recentAttempts,
            upcomingExams
        });
    } catch (error) {
        console.error('Error in getDashboard:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
};

// Get Profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.render('profile', {
            title: 'Profile',
            user
        });
    } catch (error) {
        console.error('Profile error:', error);
        req.flash('error', 'Error loading profile');
        res.redirect('/dashboard');
    }
};

// Update Profile
exports.updateProfile = async (req, res) => {
    try {
        const { name, email, currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);

        // Update basic info
        user.name = name;
        user.email = email;

        // Update password if provided
        if (currentPassword && newPassword) {
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                req.flash('error', 'Current password is incorrect');
                return res.redirect('/profile');
            }
            user.password = newPassword;
        }

        await user.save();
        req.flash('success', 'Profile updated successfully');
        res.redirect('/profile');
    } catch (error) {
        console.error('Profile update error:', error);
        req.flash('error', error.message || 'Error updating profile');
        res.redirect('/profile');
    }
};

// Get My Exams (for students)
exports.getMyExams = async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            req.flash('error', 'Access denied');
            return res.redirect('/dashboard');
        }

        const exams = await Exam.find({
            status: 'PUBLISHED',
            $or: [
                { isPublic: true },
                { allowedStudents: req.user._id }
            ]
        })
        .populate('department', 'name')
        .populate('createdBy', 'firstName lastName name')
        .populate({
            path: 'questions',
            select: 'marks' // Only select the marks field from questions
        })
        .sort({ startDate: 1 });

        // Calculate total marks and passing marks for non-project exams
        exams.forEach(exam => {
            if (exam.type !== 'PROJECT') {
                exam.totalMarks = exam.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
                exam.passingMarks = Math.ceil(exam.totalMarks * 0.5); // 50% passing mark
            }
        });

        res.render('exam/my-exams', {
            title: 'My Exams',
            exams
        });
    } catch (error) {
        console.error('My exams error:', error);
        req.flash('error', 'Error loading exams');
        res.redirect('/dashboard');
    }
};

// Get Results (for students)
exports.getResults = async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            req.flash('error', 'Access denied');
            return res.redirect('/dashboard');
        }

        const results = await Result.find({
            studentId: req.user._id
        })
        .populate({
            path: 'examId',
            select: 'title department type',
            populate: {
                path: 'department',
                select: 'name'
            }
        })
        .sort({ createdAt: -1 });

        res.render('exam/results', {
            title: 'My Results',
            results
        });
    } catch (error) {
        console.error('Results error:', error);
        req.flash('error', 'Error loading results');
        res.redirect('/dashboard');
    }
}; 