const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  objectives: String,
  materials: String,
  warmUp: String,
  mainActivity: String,
  practice: String,
  assessment: String,
  homework: String,
  notes: String
}, { _id: false });

const teachingResourceSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: true
  },
  chapterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chapter'
  },
  resourceType: {
    type: String,
    enum: ['lesson_plan', 'activities', 'objectives', 'notes', 'materials_needed'],
    default: 'lesson_plan'
  },
  title: { type: String, required: true },
  content: { type: contentSchema, required: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastEditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  tags: [String],
  isPublished: { type: Boolean, default: false },
  accessLevel: {
    type: String,
    enum: ['all_instructors', 'specific_instructors'],
    default: 'all_instructors'
  },
  specificInstructors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Instructor'
  }],
  viewCount: { type: Number, default: 0 }
});

// Update timestamps on save
teachingResourceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to increment view count
teachingResourceSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

module.exports = mongoose.model('TeachingResource', teachingResourceSchema);
