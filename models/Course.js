const mongoose = require('mongoose');

const contentItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'pdf', 'video', 'quiz'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  content: {
    textContent: String,
    fileName: String,
    fileUrl: String,
    filePath: String
  },
  order: {
    type: Number,
    default: 0
  }
});

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Intelligence Artificielle', 'Développement Web', 'Data Science', 'Marketing Digital', 'Cybersécurité', 'Mobile', 'Base de données']
  },
  level: {
    type: String,
    required: true,
    enum: ['Débutant', 'Intermédiaire', 'Avancé', 'Expert']
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  thumbnail: {
    type: String, // URL or file path
    default: null
  },
  // ADD THE MISSING courseCode FIELD
  courseCode: {
    type: String,
    unique: true,
    sparse: true, // This allows multiple null values until the field is set
    uppercase: true,
    match: /^[A-Z0-9]{6}$/
  },
  content: [contentItemSchema],
  students: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    enrolledAt: {
      type: Date,
      default: Date.now
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  maxStudents: {
    type: Number,
    default: 100
  },
  tags: [String],
  duration: {
    type: Number, // in hours
    default: 0
  },
  price: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// FIXED: Generate unique course code before saving
courseSchema.pre('save', async function(next) {
  // Only generate courseCode if it's a new document and doesn't have a courseCode
  if (this.isNew && !this.courseCode) {
    try {
      this.courseCode = await generateUniqueCourseCode(this.constructor);
      console.log('Generated course code:', this.courseCode);
    } catch (error) {
      console.error('Error generating course code:', error);
      return next(error);
    }
  }

  // Validate format if we have a courseCode
  if (this.courseCode && !this.courseCode.match(/^[A-Z0-9]{6}$/)) {
    return next(new Error('Invalid course code format'));
  }
  next();
});

// IMPROVED: Helper function to generate unique course code
async function generateUniqueCourseCode(CourseModel) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let attempts = 0;
  const maxAttempts = 20; // Increased attempts

  while (attempts < maxAttempts) {
    // Generate a 6-character code
    const code = Array.from({ length: 6 }, () => 
      characters.charAt(Math.floor(Math.random() * characters.length))
    ).join('');

    try {
      // Check if this code already exists
      const exists = await CourseModel.findOne({ courseCode: code });
      if (!exists) {
        console.log('Generated unique course code:', code);
        return code;
      }
      console.log('Course code already exists, retrying:', code);
    } catch (error) {
      console.error('Database check failed:', error);
      throw new Error('Failed to check course code uniqueness');
    }
    attempts++;
  }

  // If we couldn't generate a unique random code, create a timestamp-based one
  const timestamp = Date.now().toString();
  const fallbackCode = 'C' + timestamp.slice(-5); // C + last 5 digits of timestamp
  console.log('Using fallback course code:', fallbackCode);
  
  // Double-check the fallback code doesn't exist
  const fallbackExists = await CourseModel.findOne({ courseCode: fallbackCode });
  if (fallbackExists) {
    // If even the fallback exists, add random suffix
    const randomSuffix = Math.random().toString(36).substring(2, 4).toUpperCase();
    return fallbackCode.slice(0, 4) + randomSuffix;
  }
  
  return fallbackCode;
}

// Instance methods
courseSchema.methods.addStudent = function(studentId) {
  const isEnrolled = this.students.some(student => 
    student.studentId.toString() === studentId.toString()
  );
  
  if (!isEnrolled && this.students.length < this.maxStudents) {
    this.students.push({ studentId });
    return this.save();
  }
  return false;
};

courseSchema.methods.removeStudent = function(studentId) {
  this.students = this.students.filter(student => 
    student.studentId.toString() !== studentId.toString()
  );
  return this.save();
};

courseSchema.methods.updateStudentProgress = function(studentId, progress) {
  const student = this.students.find(student => 
    student.studentId.toString() === studentId.toString()
  );
  
  if (student) {
    student.progress = Math.max(0, Math.min(100, progress));
    return this.save();
  }
  return false;
};

// Static methods
courseSchema.statics.findByInstructor = function(instructorId) {
  return this.find({ instructor: instructorId }).populate('instructor', 'firstName lastName email');
};

courseSchema.statics.findByStudent = function(studentId) {
  return this.find({ 'students.studentId': studentId })
    .populate('instructor', 'firstName lastName email');
};

courseSchema.statics.findByCourseCode = function(courseCode) {
  return this.findOne({ courseCode: courseCode.toUpperCase() });
};

// Virtual for student count
courseSchema.virtual('studentCount').get(function() {
  if (!this.students) return 0;
  return this.students.length;
});

// Virtual for enrollment status
courseSchema.virtual('canEnroll').get(function() {
  if (!this.students) return false;
  return this.isActive && this.students.length < this.maxStudents;
});

// Ensure virtual fields are serialized
courseSchema.set('toJSON', { virtuals: true });
courseSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Course', courseSchema);