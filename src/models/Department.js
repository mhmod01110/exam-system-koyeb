const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Department name is required'],
        unique: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    exams: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam'
    }],
    materials: [{
        title: String,
        url: {
            type: String,
            required: true
        },
        description: String,
        level: {
            type: String,
            required: true,
            enum: ['Beginner', 'Normal', 'Advanced'],
            default: 'Normal'
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Add indexes
departmentSchema.index({ name: 1 });

module.exports = mongoose.model('Department', departmentSchema); 