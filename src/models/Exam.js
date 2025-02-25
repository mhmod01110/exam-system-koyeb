const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Exam title is required"],
        trim: true,
        minlength: [3, "Title must be at least 3 characters"],
        maxlength: [100, "Title cannot exceed 100 characters"]
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, "Description cannot exceed 500 characters"]
    },
    type: {
        type: String,
        enum: {
            values: ['MCQ', 'PROJECT', 'MIXED'],
            message: "{VALUE} is not a valid exam type"
        },
        required: [true, "Exam type is required"]
    },
    projectTotalMarks: {
        type: Number,
        min: [1, "Total marks must be at least 1"],
        max: [100, "Total marks cannot exceed 100"],
        default: 100
    },
    duration: {
        type: Number, // in minutes
        required: [true, "Exam duration is required"],
        min: [5, "Duration must be at least 5 minutes"],
        max: [480, "Duration cannot exceed 8 hours"]
    },
    startDate: {
        type: Date,
        required: [true, "Start date is required"],
        default: Date.now
    },
    endDate: {
        type: Date,
        required: [true, "End date is required"],
        default: function() {
            const date = new Date();
            date.setMonth(date.getMonth() + 6);
            return date;
        }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, "Creator is required"]
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: [true, "Department is required"]
    },
    status: {
        type: String,
        enum: {
            values: ['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'],
            message: "{VALUE} is not a valid status"
        },
        default: 'PUBLISHED'
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    allowedStudents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    questions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
    }],
    shuffleQuestions: {
        type: Boolean,
        default: true
    },
    showResults: {
        type: Boolean,
        default: true
    },
    resultReleaseDate: {
        type: Date,
        default: function() {
            const date = new Date();
            date.setMonth(date.getMonth() + 7);
            return date;
        }
    },
    instructions: {
        type: String,
        trim: true
    },
    maxAttempts: {
        type: Number,
        default: 1,
        min: [1, "Maximum attempts must be at least 1"]
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for number of enrolled students
examSchema.virtual('enrolledCount').get(function() {
    return this.allowedStudents.length;
});

// Virtual for total marks
examSchema.virtual('totalMarks').get(function() {
    // For PROJECT type exams, return the stored projectTotalMarks
    if (this.type === 'PROJECT') {
        return this.projectTotalMarks || 100; // Default to 100 if not set
    }
    
    // For MCQ/MIXED exams, calculate from questions
    if (!this.questions || this.questions.length === 0) {
        return 0;
    }
    return this.questions.reduce((total, question) => total + (question.marks || 0), 0);
});

// Virtual for passing marks (50% of total marks)
examSchema.virtual('passingMarks').get(function() {
    const total = this.totalMarks;
    return Math.ceil(total * 0.5);
});

// Ensure end date is after start date
examSchema.pre('save', function(next) {
    if (this.endDate <= this.startDate) {
        next(new Error('End date must be after start date'));
    }
    next();
});

// In your Exam model file (Exam.js)
examSchema.virtual('submissions', {
    ref: 'Submission',         // The model to use
    localField: '_id',         // Find submissions where `localField`
    foreignField: 'examId'     // is equal to `foreignField`
  });
  
// Ensure virtuals are included when converting to JSON or Objects
examSchema.set('toObject', { virtuals: true });
examSchema.set('toJSON', { virtuals: true });
  

// Index for better query performance
examSchema.index({ startDate: 1, endDate: 1 });
examSchema.index({ status: 1 });
examSchema.index({ department: 1 });

module.exports = mongoose.model('Exam', examSchema); 