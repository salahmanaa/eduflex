const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema({
  // References
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
    index: true
  },
  
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true
  },

  // Timing
  startedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  completedAt: {
    type: Date,
    default: null
  },
  
  expiresAt: {
    type: Date,
    required: true
  },

  // Status
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'expired', 'abandoned'],
    default: 'in_progress',
    required: true,
    index: true
  },
  
  // Answers array
  answers: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true
    },
    answer: {
      type: mongoose.Schema.Types.Mixed, // Can be string, boolean, or ObjectId
      required: true
    },
    timeSpent: {
      type: Number, // in seconds
      default: 0
    },
    answeredAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Scoring
  score: {
    type: Number, // Percentage score (0-100)
    default: 0,
    min: 0,
    max: 100
  },
  
  totalPoints: {
    type: Number, // Points earned
    default: 0,
    min: 0
  },
  
  // Quiz metadata (for quick access)
  totalQuestions: {
    type: Number,
    required: true,
    min: 1
  },

  // Detailed results (stored after completion)
  detailedResults: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    },
    questionText: String,
    type: {
      type: String,
      enum: ['multiple_choice', 'true_false', 'open_ended']
    },
    points: Number,
    earnedPoints: Number,
    isCorrect: Boolean,
    studentAnswer: mongoose.Schema.Types.Mixed,
    correctAnswer: mongoose.Schema.Types.Mixed,
    explanation: String
  }],

  // Additional metadata
  attempts: {
    type: Number,
    default: 1,
    min: 1
  },

  // Browser/device info (optional)
  userAgent: String,
  ipAddress: String,
  
  // Flags
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  // Notes (for instructor review)
  notes: String

}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'quizattempts'
});

// Indexes for better performance
quizAttemptSchema.index({ student: 1, quiz: 1 });
quizAttemptSchema.index({ student: 1, status: 1 });
quizAttemptSchema.index({ quiz: 1, status: 1 });
quizAttemptSchema.index({ course: 1, status: 1 });
quizAttemptSchema.index({ createdAt: -1 });
quizAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for cleanup

// Virtual fields
quizAttemptSchema.virtual('timeSpentTotal').get(function() {
  if (this.completedAt && this.startedAt) {
    return Math.round((this.completedAt - this.startedAt) / 1000); // in seconds
  }
  return 0;
});

quizAttemptSchema.virtual('timeSpentMinutes').get(function() {
  return Math.round(this.timeSpentTotal / 60);
});

quizAttemptSchema.virtual('isExpired').get(function() {
  return this.status === 'in_progress' && new Date() > this.expiresAt;
});

quizAttemptSchema.virtual('isActive').get(function() {
  return this.status === 'in_progress' && new Date() <= this.expiresAt;
});

quizAttemptSchema.virtual('isPassed').get(function() {
  return this.status === 'completed' && this.score >= 60; // 60% passing score
});

quizAttemptSchema.virtual('completionPercentage').get(function() {
  if (this.totalQuestions === 0) return 0;
  return Math.round((this.answers.length / this.totalQuestions) * 100);
});

// Instance methods
quizAttemptSchema.methods.addAnswer = function(questionId, answer, timeSpent = 0) {
  const existingIndex = this.answers.findIndex(
    a => a.questionId.toString() === questionId.toString()
  );
  
  const answerData = {
    questionId,
    answer,
    timeSpent,
    answeredAt: new Date()
  };
  
  if (existingIndex >= 0) {
    this.answers[existingIndex] = answerData;
  } else {
    this.answers.push(answerData);
  }
  
  return this.save();
};

quizAttemptSchema.methods.markAsExpired = function() {
  if (this.status === 'in_progress') {
    this.status = 'expired';
    return this.save();
  }
  return Promise.resolve(this);
};

quizAttemptSchema.methods.calculateScore = function(quiz) {
  if (!quiz || !quiz.questions) {
    throw new Error('Quiz with questions is required to calculate score');
  }
  
  let totalScore = 0;
  let maxScore = 0;
  const detailedResults = [];
  
  for (const question of quiz.questions) {
    maxScore += question.points;
    
    const studentAnswer = this.answers.find(
      a => a.questionId.toString() === question._id.toString()
    );
    
    let isCorrect = false;
    let earnedPoints = 0;
    
    if (studentAnswer) {
      if (question.type === 'multiple_choice') {
        const selectedOption = question.options.find(
          opt => opt._id.toString() === studentAnswer.answer.toString()
        );
        isCorrect = selectedOption && selectedOption.isCorrect;
      } else if (question.type === 'true_false') {
        isCorrect = question.correctAnswer === studentAnswer.answer;
      } else if (question.type === 'open_ended') {
        const correctAnswer = question.correctAnswer.toLowerCase().trim();
        const studentAnswerText = studentAnswer.answer.toLowerCase().trim();
        isCorrect = correctAnswer === studentAnswerText;
      }
      
      if (isCorrect) {
        earnedPoints = question.points;
        totalScore += earnedPoints;
      }
    }
    
    detailedResults.push({
      questionId: question._id,
      questionText: question.questionText,
      type: question.type,
      points: question.points,
      earnedPoints,
      isCorrect,
      studentAnswer: studentAnswer ? studentAnswer.answer : null,
      correctAnswer: question.type === 'multiple_choice' ? 
        question.options.find(opt => opt.isCorrect)?._id : question.correctAnswer,
      explanation: question.explanation
    });
  }
  
  this.score = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  this.totalPoints = totalScore;
  this.maxPoints = maxScore;
  this.detailedResults = detailedResults;
  
  return {
    score: this.score,
    totalPoints: this.totalPoints,
    maxPoints: this.maxPoints,
    detailedResults: this.detailedResults
  };
};

quizAttemptSchema.methods.completeAttempt = function(quiz) {
  if (this.status !== 'in_progress') {
    throw new Error('Can only complete attempts that are in progress');
  }
  
  this.calculateScore(quiz);
  this.status = 'completed';
  this.completedAt = new Date();
  
  return this.save();
};

// Static methods
quizAttemptSchema.statics.findActiveAttempt = function(studentId, quizId) {
  return this.findOne({
    student: studentId,
    quiz: quizId,
    status: 'in_progress'
  });
};

quizAttemptSchema.statics.getStudentStats = function(studentId) {
  return this.aggregate([
    { $match: { student: new mongoose.Types.ObjectId(studentId) } },
    {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        completedAttempts: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        averageScore: {
          $avg: { $cond: [{ $eq: ['$status', 'completed'] }, '$score', null] }
        },
        bestScore: { $max: '$score' }
      }
    }
  ]);
};

quizAttemptSchema.statics.getQuizStats = function(quizId) {
  return this.aggregate([
    { $match: { quiz: new mongoose.Types.ObjectId(quizId), status: 'completed' } },
    {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        averageScore: { $avg: '$score' },
        highestScore: { $max: '$score' },
        lowestScore: { $min: '$score' },
        passRate: {
          $avg: { $cond: [{ $gte: ['$score', 60] }, 1, 0] }
        }
      }
    }
  ]);
};

// Pre-save middleware
quizAttemptSchema.pre('save', function(next) {
  // Auto-expire if past expiration time
  if (this.status === 'in_progress' && new Date() > this.expiresAt) {
    this.status = 'expired';
  }
  
  // Ensure completedAt is set when status is completed
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// Post-save middleware for logging
quizAttemptSchema.post('save', function(doc) {
  if (doc.status === 'completed') {
    console.log(`Quiz attempt completed: Student ${doc.student}, Quiz ${doc.quiz}, Score: ${doc.score}%`);
  }
});

// Ensure virtual fields are included in JSON output
quizAttemptSchema.set('toJSON', { virtuals: true });
quizAttemptSchema.set('toObject', { virtuals: true });

const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);

module.exports = QuizAttempt;