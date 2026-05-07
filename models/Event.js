const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  start: {
    type: Date,
    required: true
  },
  end: {
    type: Date,
    required: true
  },
  allDay: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    enum: ['course', 'practical', 'exam', 'live', 'special'],
    default: 'course'
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  location: {
    type: String,
    trim: true
  },
  reminder: {
    enabled: {
      type: Boolean,
      default: false
    },
    time: {
      type: Number, // minutes before event
      default: 15
    }
  },
  color: {
    type: String,
    default: '#5461FF'
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    interval: {
      type: Number,
      default: 1
    },
    endDate: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
eventSchema.index({ start: 1, end: 1 });
eventSchema.index({ instructor: 1 });
eventSchema.index({ students: 1 });
eventSchema.index({ course: 1 });

// Virtual for duration
eventSchema.virtual('duration').get(function() {
  return this.end - this.start;
});

// Instance methods
eventSchema.methods.isOverlapping = function(otherEvent) {
  return this.start < otherEvent.end && this.end > otherEvent.start;
};

eventSchema.methods.isToday = function() {
  const today = new Date();
  const eventDate = new Date(this.start);
  return eventDate.toDateString() === today.toDateString();
};

eventSchema.methods.isUpcoming = function() {
  const now = new Date();
  return this.start > now;
};

// Static methods
eventSchema.statics.findByDateRange = function(startDate, endDate, userId = null) {
  // Include events that overlap the range, not just those fully inside
  const dateOverlap = {
    $or: [
      // Events that start within the range
      { start: { $gte: startDate, $lte: endDate } },
      // Events that end within the range
      { end: { $gte: startDate, $lte: endDate } },
      // Events that span the whole range
      { start: { $lte: startDate }, end: { $gte: endDate } }
    ]
  };
  let query = dateOverlap;
  if (userId) {
    query = {
      $and: [
        dateOverlap,
        { $or: [ { instructor: userId }, { students: userId } ] }
      ]
    };
  }
  return this.find(query).populate('course instructor students');
};

eventSchema.statics.findTodayEvents = function(userId = null) {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  
  return this.findByDateRange(startOfDay, endOfDay, userId);
};

eventSchema.statics.findUpcomingEvents = function(userId = null, limit = 10) {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const query = { start: { $gte: startOfDay } };
  if (userId) {
    query.$or = [
      { instructor: userId },
      { students: userId }
    ];
  }
  return this.find(query)
    .populate('course instructor students')
    .sort({ start: 1 })
    .limit(limit);
};

module.exports = mongoose.model('Event', eventSchema); 