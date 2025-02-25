const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
    text: {
        type: String,
        required: [true, 'Option text is required']
    },
    isCorrect: {
        type: Boolean,
        default: false
    }
});

const imageSchema = new mongoose.Schema({
    url: {
        type: String,
        required: [true, 'Image URL is required']
    },
    caption: {
        type: String,
        default: ''
    }
});

const questionSchema = new mongoose.Schema({
    examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: [true, 'Exam ID is required']
    },
    type: {
        type: String,
        enum: ['MCQ', 'TrueFalse', 'ShortAnswer', 'Essay'],
        required: [true, 'Question type is required']
    },
    text: {
        type: String,
        required: [true, 'Question text is required'],
        trim: true,
        minlength: [10, 'Question text must be at least 10 characters long']
    },
    marks: {
        type: Number,
        required: [true, 'Question marks are required'],
        min: [0, 'Marks cannot be negative'],
        max: [100, 'Marks cannot exceed 100']
    },
    options: {
        type: [optionSchema],
        validate: {
            validator: function(options) {
                if (this.type === 'MCQ') {
                    return options && options.length >= 2;
                }
                return true;
            },
            message: 'MCQ questions must have at least 2 options'
        }
    },
    correctAnswer: {
        type: String,
        required: function() {
            return this.type === 'ShortAnswer' || this.type === 'TrueFalse';
        }
    },
    explanation: {
        type: String,
        trim: true
    },
    images: [imageSchema],
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        default: 'Medium'
    },
    tags: [{
        type: String,
        trim: true
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Creator ID is required']
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Validate MCQ options have exactly one correct answer
questionSchema.pre('save', function(next) {
    if (this.type === 'MCQ' && this.options) {
        const correctCount = this.options.filter(opt => opt.isCorrect).length;
        if (correctCount !== 1) {
            next(new Error('MCQ questions must have exactly one correct answer'));
        }
    }
    next();
});

// Validate TrueFalse answers
questionSchema.pre('save', function(next) {
    if (this.type === 'TrueFalse') {
        if (!['true', 'false'].includes(this.correctAnswer.toLowerCase())) {
            next(new Error('TrueFalse questions must have either "true" or "false" as the correct answer'));
        }
    }
    next();
});

// Create indexes
questionSchema.index({ examId: 1 });
questionSchema.index({ tags: 1 });
questionSchema.index({ difficulty: 1 });
questionSchema.index({ createdBy: 1 });

const Question = mongoose.model('Question', questionSchema);

module.exports = Question; 
