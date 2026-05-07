// models/Quiz.js
const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    instructor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    questions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
    }],
    timeLimit: {
        type: Number, // in minutes
        required: true,
        default: 30
    },
    points: {
        type: Number,
        default: 0
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date
    },
    shuffleQuestions: {
        type: Boolean,
        default: false
    },
    showResults: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
    },
    participants: [{
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        startTime: Date,
        endTime: Date,
        score: Number,
        completed: Boolean,
        answers: [{
            question: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Question'
            },
            answer: Boolean,
            isCorrect: Boolean
        }]
    
    }]
}, {
    timestamps: true
});

// Virtual for calculating quiz end date
quizSchema.virtual('calculatedEndDate').get(function() {
    if (this.startDate && this.timeLimit) {
        return new Date(this.startDate.getTime() + (this.timeLimit * 60000));
    }
    return null;
});

module.exports = mongoose.model('Quiz', quizSchema);