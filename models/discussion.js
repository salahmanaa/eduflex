// models/discussion.js
const mongoose = require('mongoose');

const discussionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { 
    type: String, 
    required: true,
    enum: ['web', 'ia', 'data', 'design', 'general']
  },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  views: { type: Number, default: 0 },
  upvotes: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  isAnswered: { type: Boolean, default: false },
  tags: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
discussionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get recent questions for teachers
discussionSchema.statics.getRecentQuestionsForTeacher = async function(teacherId, limit = 5) {
  try {
    // Get courses taught by this teacher
    const Course = require('./Course');
    const teacherCourses = await Course.find({ instructor: teacherId }).select('_id');
    const courseIds = teacherCourses.map(course => course._id);

    // Get recent discussions from teacher's courses or general discussions
    const discussions = await this.find({
      $or: [
        { course: { $in: courseIds } },
        { category: { $in: ['ia', 'data', 'web', 'design'] } } // General tech categories
      ]
    })
    .populate('author', 'firstName lastName')
    .populate('course', 'title')
    .sort({ createdAt: -1 })
    .limit(limit);

    return discussions;
  } catch (error) {
    console.error('Error getting recent questions for teacher:', error);
    throw error;
  }
};

// Static method to get unanswered questions
discussionSchema.statics.getUnansweredQuestions = async function(limit = 10) {
  return this.find({ isAnswered: false })
    .populate('author', 'firstName lastName')
    .populate('course', 'title')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Instance method to mark as answered
discussionSchema.methods.markAsAnswered = function() {
  this.isAnswered = true;
  return this.save();
};

// Virtual for time ago
discussionSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffInMinutes = Math.floor((now - this.createdAt) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'À l\'instant';
  if (diffInMinutes < 60) return `Il y a ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''}`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Il y a ${diffInHours} heure${diffInHours > 1 ? 's' : ''}`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `Il y a ${diffInDays} jour${diffInDays > 1 ? 's' : ''}`;
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  return `Il y a ${diffInWeeks} semaine${diffInWeeks > 1 ? 's' : ''}`;
});

module.exports = mongoose.model('Discussion', discussionSchema);