// models/Question.js
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    quiz: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        required: true
    },
    questionText: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['multiple_choice', 'true_false', 'short_answer', 'checkbox'],
        required: true
    },
    // For true/false and open-ended questions
    correctAnswer: {
        type: mongoose.Schema.Types.Mixed,
        required: function() {
            return this.type === 'true_false' || this.type === 'open_ended';
        },
        validate: {
            validator: function(v) {
                if (this.type === 'true_false') {
                    return typeof v === 'boolean' || v === 'true' || v === 'false';
                } else if (this.type === 'open_ended') {
                    return typeof v === 'string' && v.trim().length > 0;
                }
                return true;
            },
            message: props => {
                if (this.type === 'true_false') {
                    return 'La réponse doit être Vrai ou Faux';
                } else if (this.type === 'open_ended') {
                    return 'La réponse ne peut pas être vide';
                }
                return 'Réponse incorrecte';
            }
        }
    },
    // For multiple choice questions (future extension)
    options: [{
        text: String,
        isCorrect: Boolean
    }],
    explanation: {
        type: String,
        trim: true
    },
    points: {
        type: Number,
        default: 1
    },
    order: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Question', questionSchema);