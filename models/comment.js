// models/comment.js
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  content: { type: String, required: true },
  discussion: { type: mongoose.Schema.Types.ObjectId, ref: 'Discussion', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isAnswer: { type: Boolean, default: false },
  upvotes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Update discussion's isAnswered field when an answer is posted
commentSchema.post('save', async function(doc) {
  if (doc.isAnswer) {
    const Discussion = require('./discussion');
    await Discussion.findByIdAndUpdate(doc.discussion, { isAnswered: true });
  }
});

module.exports = mongoose.model('Comment', commentSchema);