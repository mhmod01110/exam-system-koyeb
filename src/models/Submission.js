const mongoose = require('mongoose');

const mcqAnswerSchema = new mongoose.Schema({
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: [true, "Question ID is required"]
    },
    selectedOption: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Option',
        required: [true, "Selected option is required"]
    },
    isCorrect: {
        type: Boolean,
        default: false
    },
    marksObtained: {
        type: Number,
        default: 0
    },
    timeSpent: {
        type: Number, // in seconds
        default: 0
    }
});

// New schema for True/False answers
const tfAnswerSchema = new mongoose.Schema({
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: [true, "Question ID is required"]
    },
    answer: {
        type: String,
        required: [true, "Answer is required"]
    },
    isCorrect: {
        type: Boolean,
        default: false
    },
    marksObtained: {
        type: Number,
        default: 0
    },
    timeSpent: {
        type: Number, // in seconds
        default: 0
    }
});

const projectSubmissionSchema = new mongoose.Schema({
    fileUrl: {
        type: String,
        required: [true, "File URL is required"]
    },
    fileName: {
        type: String,
        required: [true, "File name is required"]
    },
    fileSize: {
        type: Number, // in bytes
        required: [true, "File size is required"]
    },
    fileType: {
        type: String,
        required: [true, "File type is required"]
    },
    submittedAt: {
        type: Date,
        default: Date.now
    },
    feedback: {
        text: String,
        givenAt: Date,
        givenBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    marksObtained: {
        type: Number,
        min: [0, "Marks cannot be negative"]
    },
    gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    gradedAt: {
        type: Date
    },
    plagiarismScore: {
        type: Number,
        min: 0,
        max: 100
    }
});

const submissionSchema = new mongoose.Schema({
    examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    submissionType: {
        type: String,
        enum: ['MCQ', 'PROJECT', 'MIXED'],
        required: true
    },
    attemptNumber: {
        type: Number,
        required: true,
        min: 1
    },
    answers: [{
        questionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Question'
        },
        selectedOption: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Option'
        },
        isCorrect: Boolean,
        marksObtained: Number,
        timeSpent: Number
    }],
    tfAnswers: [tfAnswerSchema],
    projectSubmission: projectSubmissionSchema,
    status: {
        type: String,
        enum: ['DRAFT', 'SUBMITTED', 'GRADED'],
        default: 'DRAFT'
    },
    totalMarksObtained: {
        type: Number,
        default: 0
    },
    submittedAt: Date,
    startedAt: Date,
    completedAt: Date,
    ipAddress: String,
    browserInfo: String,
    isLate: {
        type: Boolean,
        default: false
    },
    lateSubmissionReason: {
        type: String
    },
    flags: {
        suspiciousActivity: {
            type: Boolean,
            default: false
        },
        tabSwitches: {
            type: Number,
            default: 0
        },
        technicalIssues: [{
            issue: String,
            timestamp: Date
        }]
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Ensure unique submission per student per exam per attempt
submissionSchema.index({ examId: 1, studentId: 1, attemptNumber: 1 }, { unique: true });

// Calculate time spent before saving
submissionSchema.pre('save', function(next) {
    if (this.completedAt && this.startedAt) {
        this.timeSpent = Math.floor((this.completedAt - this.startedAt) / 1000);
    }
    next();
});

module.exports = mongoose.model('Submission', submissionSchema);
