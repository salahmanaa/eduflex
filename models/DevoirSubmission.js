const mongoose = require('mongoose');

const devoirSubmissionSchema = new mongoose.Schema({
    devoir: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Devoir',
        required: true
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fileUrl: {
        type: String,
        required: true
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
});

devoirSubmissionSchema.index({ devoir: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('DevoirSubmission', devoirSubmissionSchema); 