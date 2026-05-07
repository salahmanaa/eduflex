const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  phone: { type: String },
  birthDate: { type: Date },
  profilePhoto: { type: String, default: '/assets/images/default-profile.png' },
  role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
  createdAt: { type: Date, default: Date.now }
});

userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.set('toObject', { virtuals: true });
userSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', userSchema);