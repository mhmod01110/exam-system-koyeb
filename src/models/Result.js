const mongoose = require('mongoose');

const questionResultSchema = new mongoose.Schema({
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true
    },
    obtainedMarks: {
        type: Number,
        required: true,
        min: 0
    },
    totalMarks: {
        type: Number,
        required: true,
        min: 0
    },
    isCorrect: {
        type: Boolean,
        required: true
    },
    feedback: String,
    timeTaken: Number // in seconds
});

const resultSchema = new mongoose.Schema({
    examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: [true, "Exam ID is required"],
        index: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, "Student ID is required"],
        index: true
    },
    submissionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Submission',
        required: [true, "Submission ID is required"],
        unique: true
    },
    totalMarks: {
        type: Number,
        required: [true, "Total marks is required"],
        min: [0, "Total marks cannot be negative"]
    },
    obtainedMarks: {
        type: Number,
        required: [true, "Obtained marks is required"],
        min: [0, "Obtained marks cannot be negative"],
        validate: {
            validator: function(value) {
                return value <= this.totalMarks;
            },
            message: "Obtained marks cannot exceed total marks"
        }
    },
    percentage: {
        type: Number,
        min: 0,
        max: 100
    },
    grade: {
        type: String,
        enum: {
            values: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
            message: "{VALUE} is not a valid grade"
        }
    },
    status: {
        type: String,
        enum: {
            values: ['PASS', 'FAIL', 'PENDING_REVIEW', 'UNDER_REVIEW', 'CANCELLED'],
            message: "{VALUE} is not a valid status"
        },
        required: [true, "Status is required"]
    },
    isReleased: {
        type: Boolean,
        default: false
    },
    questionResults: [questionResultSchema],
    evaluatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    evaluatedAt: {
        type: Date
    },
    publishedAt: {
        type: Date
    },
    feedback: {
        general: String,
        strengths: [String],
        improvements: [String],
        givenBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        givenAt: Date
    },
    analytics: {
        timeSpent: Number, // in seconds
        attemptsCount: Number,
        correctAnswers: Number,
        incorrectAnswers: Number,
        skippedQuestions: Number,
        accuracyRate: Number // percentage
    },
    flags: {
        appealRequested: {
            type: Boolean,
            default: false
        },
        appealStatus: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED', 'RESOLVED'],
            default: 'PENDING'
        },
        appealReason: String,
        appealResolution: String,
        appealResolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        appealResolvedAt: Date
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
resultSchema.index({ examId: 1, studentId: 1 });
resultSchema.index({ status: 1 });
resultSchema.index({ evaluatedAt: 1 });

// Virtual for pass percentage
resultSchema.virtual('passPercentage').get(function() {
    return (this.obtainedMarks / this.totalMarks) * 100;
});

// Pre-save middleware
resultSchema.pre('save', function(next) {
    // Calculate percentage
    this.percentage = (this.obtainedMarks / this.totalMarks) * 100;
    
    // Calculate grade based on percentage
    if (this.percentage >= 90) this.grade = 'A+';
    else if (this.percentage >= 80) this.grade = 'A';
    else if (this.percentage >= 75) this.grade = 'B+';
    else if (this.percentage >= 70) this.grade = 'B';
    else if (this.percentage >= 65) this.grade = 'C+';
    else if (this.percentage >= 60) this.grade = 'C';
    else if (this.percentage >= 50) this.grade = 'D';
    else this.grade = 'F';

    // Calculate analytics
    if (this.questionResults && this.questionResults.length > 0) {
        this.analytics = {
            timeSpent: this.questionResults.reduce((total, qr) => total + (qr.timeTaken || 0), 0),
            correctAnswers: this.questionResults.filter(qr => qr.isCorrect).length,
            incorrectAnswers: this.questionResults.filter(qr => !qr.isCorrect).length,
            skippedQuestions: 0, // This should be calculated based on your business logic
            accuracyRate: (this.questionResults.filter(qr => qr.isCorrect).length / this.questionResults.length) * 100
        };
    }

    next();
});

module.exports = mongoose.model('Result', resultSchema); 