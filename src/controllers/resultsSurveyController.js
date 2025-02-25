const Result = require('../models/Result');
const Exam = require('../models/Exam');
const Department = require('../models/Department');
const User = require('../models/User');

// Get the main Results Survey page
exports.getResultsSurvey = async (req, res) => {
    try {
        // Get active departments for filtering
        const departments = await Department.find({ isActive: true }).sort('name');
        
        // Get all exams for filtering
        const exams = await Exam.find()
            .populate('department', 'name')
            .sort('-createdAt');

        // Get all students for filtering
        const students = await User.find({ role: 'student' })
            .populate('departmentId', 'name')
            .sort('firstName lastName');

        res.render('results-survey/index', {
            title: 'Results Survey',
            departments,
            exams,
            students
        });
    } catch (error) {
        console.error('Error in getResultsSurvey:', error);
        req.flash('error', 'Error loading Results Survey');
        res.redirect('/dashboard');
    }
};

// Get exam results analysis
exports.getExamResults = async (req, res) => {
    try {
        const { examId } = req.query;
        
        // First get the exam to ensure proper population of questions
        const exam = await Exam.findById(examId)
            .populate('questions', 'marks')
            .lean();

        if (!exam) {
            return res.json({
                results: [],
                stats: {
                    totalStudents: 0,
                    averageScore: 0,
                    passRate: 0,
                    highestScore: 0,
                    lowestScore: 0,
                    standardDeviation: 0
                }
            });
        }

        // Calculate total marks based on exam type
        const totalMarks = exam.type === 'PROJECT' ? 
            (exam.projectTotalMarks || 100) : 
            (exam.questions || []).reduce((sum, q) => sum + (q.marks || 0), 0);
        
        const results = await Result.find({ examId })
            .populate('studentId', 'firstName lastName')
            .lean();

        if (results.length === 0) {
            return res.json({ 
                results: [], 
                stats: {
                    totalStudents: 0,
                    averageScore: 0,
                    passRate: 0,
                    highestScore: 0,
                    lowestScore: 0,
                    standardDeviation: 0
                }
            });
        }

        // Calculate statistics
        const stats = {
            totalStudents: results.length,
            averageScore: results.reduce((sum, r) => sum + r.percentage, 0) / results.length,
            passRate: (results.filter(r => r.status === 'PASS').length / results.length) * 100,
            highestScore: Math.max(...results.map(r => r.percentage)),
            lowestScore: Math.min(...results.map(r => r.percentage))
        };

        // Calculate standard deviation
        const mean = stats.averageScore;
        const squareDiffs = results.map(r => Math.pow(r.percentage - mean, 2));
        stats.standardDeviation = Math.sqrt(squareDiffs.reduce((sum, diff) => sum + diff, 0) / results.length);

        // Add exam info to results
        const resultsWithExamInfo = results.map(result => ({
            ...result,
            examTitle: exam.title,
            totalMarks,
            examType: exam.type
        }));

        res.json({ results: resultsWithExamInfo, stats });
    } catch (error) {
        console.error('Error in getExamResults:', error);
        res.status(500).json({ error: 'Error fetching exam results' });
    }
};

// Get department results analysis
exports.getDepartmentResults = async (req, res) => {
    try {
        const { departmentId } = req.query;
        
        // First get all exams in the department
        const exams = await Exam.find({ department: departmentId })
            .populate('questions', 'marks')
            .lean();

        if (exams.length === 0) {
            return res.json({ results: [] });
        }

        // Get results for all exams
        const examIds = exams.map(exam => exam._id);
        const results = await Result.find({ examId: { $in: examIds } })
            .populate('studentId', 'firstName lastName')
            .lean();

        // Group results by exam
        const examResults = exams.map(exam => {
            const examTotalMarks = exam.type === 'PROJECT' ? 
                (exam.projectTotalMarks || 100) : 
                (exam.questions || []).reduce((sum, q) => sum + (q.marks || 0), 0);

            const examSpecificResults = results.filter(r => r.examId.toString() === exam._id.toString());
            
            return {
                examId: exam._id,
                examTitle: exam.title,
                totalMarks: examTotalMarks,
                averageScore: examSpecificResults.length > 0 ? 
                    examSpecificResults.reduce((sum, r) => sum + r.percentage, 0) / examSpecificResults.length : 0,
                passRate: examSpecificResults.length > 0 ?
                    (examSpecificResults.filter(r => r.status === 'PASS').length / examSpecificResults.length) * 100 : 0,
                totalStudents: examSpecificResults.length
            };
        });

        res.json({ results: examResults });
    } catch (error) {
        console.error('Error in getDepartmentResults:', error);
        res.status(500).json({ error: 'Error fetching department results' });
    }
};

// Get student results analysis
exports.getStudentResults = async (req, res) => {
    try {
        const { studentId } = req.query;
        
        // First get all results for the student
        const results = await Result.find({ studentId }).lean();

        if (results.length === 0) {
            return res.json({
                results: [],
                stats: {
                    totalExams: 0,
                    averageScore: 0,
                    passRate: 0,
                    byDepartment: {}
                }
            });
        }

        // Get all related exams with populated questions
        const examIds = results.map(r => r.examId);
        const exams = await Exam.find({ _id: { $in: examIds } })
            .populate('questions', 'marks')
            .populate('department', 'name')
            .lean();

        // Create a map of exam data
        const examMap = exams.reduce((map, exam) => {
            map[exam._id.toString()] = {
                title: exam.title,
                type: exam.type,
                department: exam.department,
                totalMarks: exam.type === 'PROJECT' ? 
                    (exam.projectTotalMarks || 100) : 
                    (exam.questions || []).reduce((sum, q) => sum + (q.marks || 0), 0)
            };
            return map;
        }, {});

        // Enhance results with exam data
        const enhancedResults = results.map(result => ({
            ...result,
            examInfo: examMap[result.examId.toString()]
        }));

        // Calculate statistics
        const stats = {
            totalExams: results.length,
            averageScore: results.reduce((sum, r) => sum + r.percentage, 0) / results.length,
            passRate: (results.filter(r => r.status === 'PASS').length / results.length) * 100,
            byDepartment: {}
        };

        // Group results by department
        enhancedResults.forEach(result => {
            const deptName = result.examInfo.department?.name || 'Uncategorized';
            if (!stats.byDepartment[deptName]) {
                stats.byDepartment[deptName] = {
                    totalExams: 0,
                    averageScore: 0,
                    scores: []
                };
            }
            stats.byDepartment[deptName].totalExams++;
            stats.byDepartment[deptName].scores.push(result.percentage);
        });

        // Calculate department averages
        Object.values(stats.byDepartment).forEach(dept => {
            dept.averageScore = dept.scores.reduce((sum, score) => sum + score, 0) / dept.scores.length;
        });

        res.json({ results: enhancedResults, stats });
    } catch (error) {
        console.error('Error in getStudentResults:', error);
        res.status(500).json({ error: 'Error fetching student results' });
    }
}; 