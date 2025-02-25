const mongoose = require('mongoose');

const examAttemptSchema = new mongoose.Schema({
    exam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: [true, 'Exam reference is required']
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Student reference is required']
    },
    startTime: {
        type: Date,
        required: [true, 'Start time is required'],
        default: Date.now
    },
    endTime: {
        type: Date,
        required: [true, 'End time is required']
    },
    submittedAt: {
        type: Date
    },
    status: {
        type: String,
        enum: {
            values: ['IN_PROGRESS', 'SUBMITTED', 'EXPIRED'],
            message: '{VALUE} is not a valid status'
        },
        default: 'IN_PROGRESS'
    },
    questions: [{
        question: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Question',
            required: true
        },
        answer: {
            type: String,
            default: ''
        },
        marks: {
            type: Number,
            default: 0,
            min: [0, 'Marks cannot be negative']
        }
    }],
    totalMarks: {
        type: Number,
        default: 0,
        min: [0, 'Total marks cannot be negative']
    },
    gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    gradedAt: {
        type: Date
    },
    attemptNumber: {
        type: Number,
        required: true,
        min: [1, 'Attempt number must be at least 1']
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for checking if attempt is completed
examAttemptSchema.virtual('isCompleted').get(function() {
    return this.status === 'SUBMITTED' || this.status === 'EXPIRED';
});

// Virtual for checking if attempt is graded
examAttemptSchema.virtual('isGraded').get(function() {
    return !!this.gradedAt;
});

// Virtual for time remaining
examAttemptSchema.virtual('timeRemaining').get(function() {
    if (this.status !== 'IN_PROGRESS') return 0;
    const now = new Date();
    return Math.max(0, this.endTime - now);
});

// Pre-save middleware to set attempt number
examAttemptSchema.pre('save', async function(next) {
    if (this.isNew) {
        const count = await this.constructor.countDocuments({
            exam: this.exam,
            student: this.student
        });
        this.attemptNumber = count + 1;
    }
    next();
});

// Indexes for better query performance
examAttemptSchema.index({ exam: 1, student: 1 });
examAttemptSchema.index({ status: 1 });
examAttemptSchema.index({ startTime: 1, endTime: 1 });

module.exports = mongoose.model('ExamAttempt', examAttemptSchema); 