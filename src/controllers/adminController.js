const User = require('../models/User');
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const Department = require('../models/Department');
const AppError = require('../utils/AppError');
const { generateStudentResultsPDF } = require('../utils/pdfExporter');
const { generateStudentResultsExcel } = require('../utils/excelExporter');

// Admin Dashboard
exports.getDashboard = async (req, res, next) => {
    try {
        // Get system statistics
        const stats = {
            totalUsers: await User.countDocuments(),
            totalExams: await Exam.countDocuments(),
            totalResults: await Result.countDocuments(),
            totalDepartments: await Department.countDocuments()
        };

        // Get recent users
        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(5);

        // Get recent exams
        const recentExams = await Exam.find()
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 })
            .limit(5);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            stats,
            recentUsers,
            recentExams
        });
    } catch (error) {
        next(error);
    }
};

// User Management
exports.getUsers = async (req, res) => {
    try {
        // Get students with exam stats
        const students = await User.aggregate([
            { $match: { role: 'student' } },
            {
                $lookup: {
                    from: 'departments',
                    localField: 'departmentId',
                    foreignField: '_id',
                    as: 'department'
                }
            },
            {
                $lookup: {
                    from: 'results',
                    localField: '_id',
                    foreignField: 'studentId',
                    as: 'results'
                }
            },
            {
                $addFields: {
                    department: { $arrayElemAt: ['$department', 0] },
                    examCount: { $size: '$results' },
                    averageScore: {
                        $cond: {
                            if: { $gt: [{ $size: '$results' }, 0] },
                            then: { $avg: '$results.score' },
                            else: null
                        }
                    }
                }
            }
        ]);

        // Get staff members with populated departments
        const staff = await User.find({ role: { $in: ['teacher', 'admin'] } })
            .populate('departmentId', 'name')
            .lean();

        // Map the populated departmentId to department for consistency with the view
        const mappedStaff = staff.map(member => ({
            ...member,
            department: member.departmentId
        }));

        // Get departments for the add staff form
        const departments = await Department.find().lean();

        res.render('admin/users', {
            title: 'User Management',
            students,
            staff: mappedStaff,
            departments
        });
    } catch (error) {
        console.error('Error in getUsers:', error);
        req.flash('error', 'Error loading users');
        res.redirect('/');
    }
};

exports.getCreateUser = (req, res) => {
    res.render('admin/users/create', {
        title: 'Create User'
    });
};

exports.postCreateUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            req.flash('error', 'Email already registered');
            return res.redirect('/admin/users/create');
        }

        // Create user
        const user = new User({
            name,
            email,
            password,
            role
        });

        await user.save();
        req.flash('success', 'User created successfully');
        res.redirect('/admin/users');
    } catch (error) {
        console.error('Create user error:', error);
        req.flash('error', error.message || 'Error creating user');
        res.redirect('/admin/users/create');
    }
};

exports.getEditUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/admin/users');
        }

        res.render('admin/users/edit', {
            title: 'Edit User',
            user
        });
    } catch (error) {
        console.error('Get edit user error:', error);
        req.flash('error', 'Error loading user');
        res.redirect('/admin/users');
    }
};

exports.postEditUser = async (req, res) => {
    try {
        const { name, email, role, password } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/admin/users');
        }

        // Update user
        user.name = name;
        user.email = email;
        user.role = role;
        if (password) {
            user.password = password;
        }

        await user.save();
        req.flash('success', 'User updated successfully');
        res.redirect('/admin/users');
    } catch (error) {
        console.error('Edit user error:', error);
        req.flash('error', error.message || 'Error updating user');
        res.redirect(`/admin/users/${req.params.id}/edit`);
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.role === 'student') {
            // Delete associated results
            await Result.deleteMany({ studentId: user._id });
        } else {
            // For teachers, reassign or delete their exams
            await Exam.updateMany(
                { createdBy: user._id },
                { $set: { createdBy: req.user._id } }
            );
        }

        await user.remove();
        res.json({ success: true });
    } catch (error) {
        console.error('Error in deleteUser:', error);
        res.status(500).json({ error: 'Error deleting user' });
    }
};

// Department Management
exports.getDepartments = async (req, res) => {
    try {
        const departments = await Department.find().sort({ name: 1 });
        res.render('admin/departments', {
            title: 'Department Management',
            departments
        });
    } catch (error) {
        console.error('Get departments error:', error);
        req.flash('error', 'Error loading departments');
        res.redirect('/admin');
    }
};

exports.createDepartment = async (req, res) => {
    try {
        const { name, description } = req.body;
        const department = new Department({ name, description });
        await department.save();
        req.flash('success', 'Department created successfully');
        res.redirect('/admin/departments');
    } catch (error) {
        console.error('Create department error:', error);
        req.flash('error', error.message || 'Error creating department');
        res.redirect('/admin/departments');
    }
};

exports.updateDepartment = async (req, res) => {
    try {
        const { name, description } = req.body;
        await Department.findByIdAndUpdate(req.params.id, { name, description });
        req.flash('success', 'Department updated successfully');
        res.redirect('/admin/departments');
    } catch (error) {
        console.error('Update department error:', error);
        req.flash('error', 'Error updating department');
        res.redirect('/admin/departments');
    }
};

exports.deleteDepartment = async (req, res) => {
    try {
        await Department.findByIdAndDelete(req.params.id);
        req.flash('success', 'Department deleted successfully');
        res.redirect('/admin/departments');
    } catch (error) {
        console.error('Delete department error:', error);
        req.flash('error', 'Error deleting department');
        res.redirect('/admin/departments');
    }
};

// System Settings
exports.getSettings = async (req, res) => {
    try {
        // Get current settings
        const settings = {
            allowRegistration: true, // Example setting
            defaultUserRole: 'student',
            maxFileSize: 5 * 1024 * 1024, // 5MB
            allowedFileTypes: ['image/jpeg', 'image/png', 'application/pdf']
        };

        res.render('admin/settings', {
            title: 'System Settings',
            settings
        });
    } catch (error) {
        console.error('Get settings error:', error);
        req.flash('error', 'Error loading settings');
        res.redirect('/admin');
    }
};

exports.updateSettings = async (req, res) => {
    try {
        // Update settings
        const { allowRegistration, defaultUserRole, maxFileSize, allowedFileTypes } = req.body;
        
        // Save settings (implement your settings storage logic)
        
        req.flash('success', 'Settings updated successfully');
        res.redirect('/admin/settings');
    } catch (error) {
        console.error('Update settings error:', error);
        req.flash('error', 'Error updating settings');
        res.redirect('/admin/settings');
    }
};

// Reports
exports.getExamReports = async (req, res) => {
    try {
        const examStats = await Exam.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.render('admin/reports/exams', {
            title: 'Exam Reports',
            examStats
        });
    } catch (error) {
        console.error('Exam reports error:', error);
        req.flash('error', 'Error loading exam reports');
        res.redirect('/admin');
    }
};

exports.getUserReports = async (req, res) => {
    try {
        const userStats = await User.aggregate([
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.render('admin/reports/users', {
            title: 'User Reports',
            userStats
        });
    } catch (error) {
        console.error('User reports error:', error);
        req.flash('error', 'Error loading user reports');
        res.redirect('/admin');
    }
};

exports.getPerformanceReports = async (req, res) => {
    try {
        // Get all active departments
        const departments = await Department.find({ isActive: true }).sort('name');

        // Get results for the last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // Get all results grouped by department and date
        const results = await Result.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $lookup: {
                    from: 'exams',
                    localField: 'examId',
                    foreignField: '_id',
                    as: 'exam'
                }
            },
            {
                $unwind: '$exam'
            },
            {
                $lookup: {
                    from: 'departments',
                    localField: 'exam.department',
                    foreignField: '_id',
                    as: 'department'
                }
            },
            {
                $unwind: '$department'
            },
            {
                $group: {
                    _id: {
                        departmentId: '$department._id',
                        departmentName: '$department.name',
                        month: { $month: '$createdAt' },
                        year: { $year: '$createdAt' }
                    },
                    averageScore: { $avg: '$percentage' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: {
                    '_id.year': 1,
                    '_id.month': 1
                }
            }
        ]);

        // Process results into a format suitable for Chart.js
        const performanceData = {
            labels: [],
            datasets: []
        };

        // Create a map of department colors
        const departmentColors = departments.reduce((acc, dept, index) => {
            // Generate different colors for each department
            const hue = (360 / departments.length) * index;
            acc[dept._id.toString()] = `hsl(${hue}, 70%, 50%)`;
            return acc;
        }, {});

        // Get unique months for labels
        const months = [...new Set(results.map(r => `${r._id.year}-${r._id.month.toString().padStart(2, '0')}`))];
        performanceData.labels = months.map(m => {
            const [year, month] = m.split('-');
            return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        });

        // Group results by department
        const departmentData = {};
        results.forEach(result => {
            const deptId = result._id.departmentId.toString();
            if (!departmentData[deptId]) {
                departmentData[deptId] = {
                    label: result._id.departmentName,
                    data: new Array(months.length).fill(null),
                    borderColor: departmentColors[deptId],
                    tension: 0.1
                };
            }
            const monthIndex = months.indexOf(`${result._id.year}-${result._id.month.toString().padStart(2, '0')}`);
            if (monthIndex !== -1) {
                departmentData[deptId].data[monthIndex] = result.averageScore;
            }
        });

        performanceData.datasets = Object.values(departmentData);

        // Calculate overall statistics
        const overallStats = await Result.aggregate([
            {
                $group: {
                    _id: null,
                    averageScore: { $avg: '$percentage' },
                    highestScore: { $max: '$percentage' },
                    lowestScore: { $min: '$percentage' },
                    totalExams: { $sum: 1 }
                }
            }
        ]);

        res.render('admin/reports/performance', {
            title: 'Performance Reports',
            performanceData: JSON.stringify(performanceData),
            stats: overallStats[0] || {
                averageScore: 0,
                highestScore: 0,
                lowestScore: 0,
                totalExams: 0
            }
        });
    } catch (error) {
        console.error('Performance reports error:', error);
        req.flash('error', 'Error loading performance reports');
        res.redirect('/admin');
    }
};

// Get student progress page
exports.getStudentProgress = async (req, res) => {
    try {
        const studentId = req.params.id;

        // Get student details with department
        const student = await User.findById(studentId)
            .populate('departmentId', 'name');

        if (!student) {
            req.flash('error', 'Student not found');
            return res.redirect('/admin/users');
        }

        // Get exam history with details
        const examHistory = await Result.find({ studentId })
            .populate('examId', 'title passingMarks')
            .sort({ createdAt: -1 })
            .lean();

        // Calculate statistics
        const stats = {
            totalExams: examHistory.length,
            averageScore: examHistory.length > 0 ? 
                examHistory.reduce((sum, result) => sum + result.percentage, 0) / examHistory.length : 
                0,
            passedExams: examHistory.filter(result => result.status === 'PASS').length,
            failedExams: examHistory.filter(result => result.status === 'FAIL').length
        };

        // Prepare performance data for chart
        const performanceData = examHistory
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            .map(result => ({
                date: result.createdAt,
                score: result.percentage
            }));

        res.render('admin/student-progress', {
            title: `Student Progress - ${student.firstName} ${student.lastName}`,
            student,
            stats,
            examHistory,
            performanceData
        });
    } catch (error) {
        console.error('Error in getStudentProgress:', error);
        req.flash('error', 'Error loading student progress');
        res.redirect('/admin/users');
    }
};

// Add new staff member
exports.postAddStaff = async (req, res, next) => {
    try {
        const { firstName, lastName, email, role, departmentId } = req.body;

        // Check if user exists first
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new AppError('A user with this email already exists', 400);
        }

        // Create new user
        const user = await User.create({
            firstName,
            lastName,
            email,
            role,
            departmentId: departmentId || null,
            password: 'changeme123' // Temporary password
        });

        // TODO: Send email to user with temporary password

        req.flash('success', 'Staff member added successfully');
        res.redirect('/admin/users');
    } catch (error) {
        next(error);
    }
};

// Toggle user status
exports.postToggleUserStatus = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            throw new AppError('User not found', 404);
        }

        user.isActive = !user.isActive;
        await user.save();

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
};

// Export student progress as PDF
exports.getExportPDF = async (req, res, next) => {
    try {
        const studentId = req.params.id;
        
        // Get student results with populated exam details
        const results = await Result.find({ studentId })
            .populate('examId', 'title type duration')
            .populate('studentId', 'firstName lastName email')
            .sort({ createdAt: -1 });

        if (!results || results.length === 0) {
            throw new AppError('No results found for this student', 404);
        }

        // Prepare data for PDF generation
        const student = results[0].studentId;
        const totalExams = results.length;
        const averagePercentage = results.reduce((sum, r) => sum + r.percentage, 0) / totalExams;
        const passedExams = results.filter(r => r.status === 'PASS').length;

        const data = {
            student,
            results,
            summary: {
                totalExams,
                averagePercentage,
                passedExams
            }
        };

        // Generate PDF
        const doc = generateStudentResultsPDF(data);
        
        // Set response headers
        const filename = `student_results_${studentId}_${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Pipe to response
        doc.pipe(res);
        doc.end();

    } catch (error) {
        next(error);
    }
};

// Export student progress as Excel
exports.getExportExcel = async (req, res, next) => {
    try {
        const studentId = req.params.id;
        
        // Get student results with populated exam details
        const results = await Result.find({ studentId })
            .populate('examId', 'title type duration')
            .populate('studentId', 'firstName lastName email')
            .sort({ createdAt: -1 });

        if (!results || results.length === 0) {
            throw new AppError('No results found for this student', 404);
        }

        // Prepare data for Excel generation
        const student = results[0].studentId;
        const totalExams = results.length;
        const averagePercentage = results.reduce((sum, r) => sum + r.percentage, 0) / totalExams;
        const passedExams = results.filter(r => r.status === 'PASS').length;

        const data = {
            student,
            results,
            summary: {
                totalExams,
                averagePercentage,
                passedExams
            }
        };

        // Generate Excel workbook
        const workbook = await generateStudentResultsExcel(data);
        
        // Set response headers
        const filename = `student_results_${studentId}_${Date.now()}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        next(error);
    }
}; 