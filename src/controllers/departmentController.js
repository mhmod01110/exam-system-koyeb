const Department = require('../models/Department');
const Exam = require('../models/Exam');
const AppError = require('../utils/AppError');
const { uploadToGoogleDrive } = require('../utils/google-drive-upload');
const Result = require('../models/Result');

// Get all departments
exports.getDepartments = async (req, res) => {
    try {
        const departments = await Department.find()
            .sort('name');

        res.render('department/list', {
            title: 'Departments',
            departments,
            user: req.user
        });
    } catch (error) {
        console.error('Error fetching departments:', error);
        req.flash('error', 'Error fetching departments');
        res.redirect('/');
    }
};

// Get department creation form
exports.getCreateDepartment = async (req, res) => {
    try {
        res.render('department/create', {
            title: 'Create Department',
            user: req.user
        });
    } catch (error) {
        console.error('Error loading department form:', error);
        req.flash('error', 'Error loading department form');
        res.redirect('/departments');
    }
};

// Create new department
exports.postCreateDepartment = async (req, res) => {
    try {
        const { name, description } = req.body;

        await Department.create({
            name,
            description,
            isActive: true
        });

        req.flash('success', 'Department created successfully');
        res.redirect('/departments');
    } catch (error) {
        console.error('Error creating department:', error);
        if (error.code === 11000) {
            req.flash('error', 'A department with this name already exists');
        } else {
            req.flash('error', 'Error creating department');
        }
        res.redirect('/departments/create');
    }
};

// Get department edit form
exports.getEditDepartment = async (req, res) => {
    try {
        const department = await Department.findById(req.params.id);

        if (!department) {
            req.flash('error', 'Department not found');
            return res.redirect('/departments');
        }

        res.render('department/edit', {
            title: `Edit ${department.name}`,
            department,
            user: req.user
        });
    } catch (error) {
        console.error('Error loading department:', error);
        req.flash('error', 'Error loading department');
        res.redirect('/departments');
    }
};

// Update department
exports.updateDepartment = async (req, res) => {
    try {
        const { name, description, isActive } = req.body;
        
        const department = await Department.findByIdAndUpdate(
            req.params.id,
            {
                name,
                description,
                isActive: isActive === 'on'
            },
            { new: true, runValidators: true }
        );

        if (!department) {
            req.flash('error', 'Department not found');
            return res.redirect('/departments');
        }

        req.flash('success', 'Department updated successfully');
        res.redirect('/departments');
    } catch (error) {
        console.error('Error updating department:', error);
        if (error.code === 11000) {
            req.flash('error', 'A department with this name already exists');
        } else {
            req.flash('error', 'Error updating department');
        }
        res.redirect(`/departments/${req.params.id}/edit`);
    }
};

// Delete department
exports.deleteDepartment = async (req, res) => {
    try {
        const department = await Department.findById(req.params.id);

        if (!department) {
            return res.status(404).json({ error: 'Department not found' });
        }

        // Check if department has any exams
        const examsCount = await Exam.countDocuments({ department: department._id });
        if (examsCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete department with associated exams. Please delete or reassign exams first.' 
            });
        }

        await department.remove();
        
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.json({ success: true });
        }

        req.flash('success', 'Department deleted successfully');
        res.redirect('/departments');
    } catch (error) {
        console.error('Error deleting department:', error);
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(500).json({ error: 'Error deleting department' });
        }
        req.flash('error', 'Error deleting department');
        res.redirect('/departments');
    }
};

// Get department exams
exports.getDepartmentExams = async (req, res) => {
    try {
        const department = await Department.findById(req.params.id)
            .populate({
                path: 'exams',
                match: { 
                    status: 'PUBLISHED',
                    ...(req.user.role === 'student' && {
                        $or: [
                            { isPublic: true },
                            { allowedStudents: req.user._id }
                        ]
                    })
                },
                populate: {
                    path: 'createdBy',
                    select: 'firstName lastName'
                }
            });

        if (!department) {
            req.flash('error', 'Department not found');
            return res.redirect('/');
        }

        res.render('department/exams', {
            title: `${department.name} - Exams`,
            department,
            user: req.user
        });
    } catch (error) {
        console.error('Error fetching department exams:', error);
        req.flash('error', 'Error fetching department exams');
        res.redirect('/');
    }
};

// Get department materials
exports.getDepartmentMaterials = async (req, res) => {
    try {
        const department = await Department.findById(req.params.id);

        if (!department) {
            req.flash('error', 'Department not found');
            return res.redirect('/');
        }

        let studentLevel = 'all';
        
        // If user is a student, determine their level based on exam results
        if (req.user.role === 'student') {
            // Find the student's most recent released result in this department
            const latestResult = await Result.findOne({
                studentId: req.user._id,
                examId: { $in: department.exams },
                isReleased: true,
                status: { $in: ['PASS', 'FAIL'] }
            })
            .sort({ createdAt: -1 });

            if (latestResult) {
                const percentage = latestResult.percentage;
                
                // Determine student level based on percentage
                if (percentage <= 59) {
                    studentLevel = 'Beginner';
                } else if (percentage <= 84) {
                    studentLevel = 'Normal';
                } else {
                    studentLevel = 'Advanced';
                }
            } else {
                // If no released result found, start with beginner
                studentLevel = 'Beginner';
            }
        }
        // console.log(studentLevel);
        // console.log(latestResult);
        // console.log(percentage);

        res.render('department/materials', {
            title: `${department.name} - Study Materials`,
            department,
            user: req.user,
            studentLevel
        });
    } catch (error) {
        console.error('Error fetching department materials:', error);
        req.flash('error', 'Error fetching department materials');
        res.redirect('/');
    }
};

// Add material to department
exports.addMaterial = async (req, res) => {
    try {
        const department = await Department.findById(req.params.id);

        if (!department) {
            req.flash('error', 'Department not found');
            return res.redirect('/');
        }

        const { title, description, sourceType, level } = req.body;
        let url;

        if (sourceType === 'file') {
            if (!req.files || !req.files.file) {
                req.flash('error', 'No file uploaded');
                return res.redirect(`/departments/${department._id}/materials`);
            }

            const file = req.files.file;
            url = await uploadToGoogleDrive(file, 'DepartmentMaterials');
        } else {
            url = req.body.url;
            if (!url) {
                req.flash('error', 'URL is required');
                return res.redirect(`/departments/${department._id}/materials`);
            }
        }

        department.materials.push({
            title,
            url,
            description,
            level
        });

        await department.save();

        req.flash('success', 'Material added successfully');
        res.redirect(`/departments/${department._id}/materials`);
    } catch (error) {
        console.error('Error adding material:', error);
        req.flash('error', 'Error adding material');
        res.redirect(`/departments/${req.params.id}/materials`);
    }
};

// Delete material
exports.deleteMaterial = async (req, res) => {
    try {
        const department = await Department.findById(req.params.id);

        if (!department) {
            return res.status(404).json({ error: 'Department not found' });
        }

        department.materials = department.materials.filter(
            material => material._id.toString() !== req.params.materialId
        );

        await department.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting material:', error);
        res.status(500).json({ error: 'Error deleting material' });
    }
}; 