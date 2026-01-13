const mongoose = require('mongoose');

const instructorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: String,
  specializations: [String],
  bio: String,
  profileImage: String,
  assignedCourses: [{
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
    },
    modulesAccess: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module'
    }],
    assignedDate: { type: Date, default: Date.now },
    status: { 
      type: String, 
      enum: ['active', 'inactive'],
      default: 'active'
    }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamps on save
instructorSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for full name
instructorSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('Instructor', instructorSchema);
