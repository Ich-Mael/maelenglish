const express = require('express');
const router = express.Router();
const Instructor = require('../../models/Instructor');
const User = require('../../../../shared/models/user');
const { isAdmin } = require('../../../../shared/middlewares/auth');

// List all instructors
router.get('/', isAdmin, async (req, res) => {
  try {
    const instructors = await Instructor.find()
      .populate('userId')
      .populate('assignedCourses.courseId')
      .sort({ createdAt: -1 });
    
    res.render('admin/instructors/index', {
      instructors,
      title: 'Manage Instructors'
    });
  } catch (error) {
    console.error('Error listing instructors:', error);
    req.flash('error', 'An error occurred while loading instructors');
    res.redirect('/admin');
  }
});

// Show create instructor form
router.get('/new', isAdmin, async (req, res) => {
  try {
    // Get users with english-coach role who don't have instructor profile yet
    const instructorUsers = await User.find({ role: 'english-coach' });
    const existingInstructors = await Instructor.find().select('userId');
    const existingUserIds = existingInstructors.map(i => i.userId.toString());
    
    const availableUsers = instructorUsers.filter(
      user => !existingUserIds.includes(user._id.toString())
    );
    
    res.render('admin/instructors/new', {
      availableUsers,
      title: 'Create Instructor'
    });
  } catch (error) {
    console.error('Error loading create form:', error);
    req.flash('error', 'An error occurred');
    res.redirect('/admin/instructors');
  }
});

// Create instructor
router.post('/', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.body.userId);
    
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/maelenglish/admin/instructors/new');
    }
    
    const instructor = new Instructor({
      userId: user._id,
      firstName: user.name,
      lastName: user.surname,
      email: user.email,
      specializations: Array.isArray(req.body.specializations) ? req.body.specializations : (req.body.specializations ? [req.body.specializations] : []),
      bio: req.body.bio || '',
      profileImage: user.imageUrl
    });
    
    await instructor.save();
    
    req.flash('success', 'Instructor created successfully');
    res.redirect(`/maelenglish/admin/instructors/${instructor._id}`);
  } catch (error) {
    console.error('Error creating instructor:', error);
    req.flash('error', 'An error occurred while creating instructor');
    res.redirect('/maelenglish/admin/instructors/new');
  }
});

// View instructor details
router.get('/:id', isAdmin, async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id)
      .populate('userId')
      .populate('assignedCourses.courseId')
      .populate('assignedCourses.modulesAccess');
    
    if (!instructor) {
      req.flash('error', 'Instructor not found');
      return res.redirect('/admin/instructors');
    }
    
    res.render('admin/instructors/view', {
      instructor,
      title: `Instructor: ${instructor.firstName} ${instructor.lastName}`
    });
  } catch (error) {
    console.error('Error viewing instructor:', error);
    req.flash('error', 'An error occurred');
    res.redirect('/admin/instructors');
  }
});

// Show edit instructor form
router.get('/:id/edit', isAdmin, async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id).populate('userId');
    
    if (!instructor) {
      req.flash('error', 'Instructor not found');
      return res.redirect('/admin/instructors');
    }
    
    res.render('admin/instructors/edit', {
      instructor,
      title: 'Edit Instructor'
    });
  } catch (error) {
    console.error('Error loading edit form:', error);
    req.flash('error', 'An error occurred');
    res.redirect('/admin/instructors');
  }
});

// Update instructor
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id);
    
    if (!instructor) {
      req.flash('error', 'Instructor not found');
      return res.redirect('/admin/instructors');
    }
    
    instructor.specializations = Array.isArray(req.body.specializations) ? req.body.specializations : (req.body.specializations ? [req.body.specializations] : []);
    instructor.bio = req.body.bio;
    instructor.updatedAt = Date.now();
    
    await instructor.save();
    
    req.flash('success', 'Instructor updated successfully');
    res.redirect(`/admin/instructors/${instructor._id}`);
  } catch (error) {
    console.error('Error updating instructor:', error);
    req.flash('error', 'An error occurred while updating instructor');
    res.redirect(`/admin/instructors/${req.params.id}/edit`);
  }
});

// Delete instructor
// Delete instructor and revert user role
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id);
    
    if (!instructor) {
      req.flash('error', 'Instructor not found');
      return res.redirect('/maelenglish/admin/instructors');
    }

    // Find and update the associated user
    await User.findByIdAndUpdate(instructor.userId, { role: 'user' });

    // Delete the instructor profile
    await Instructor.findByIdAndDelete(req.params.id);
    
    req.flash('success', 'Instructor profile deleted and user role reverted to "user"');
    res.redirect('/maelenglish/admin/instructors');
  } catch (error) {
    console.error('Error deleting instructor:', error);
    req.flash('error', 'An error occurred while deleting instructor');
    res.redirect('/maelenglish/admin/instructors');
  }
});

// Show assign course form
router.get('/:id/assign-course', isAdmin, async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id)
      .populate('userId')
      .populate('assignedCourses.courseId');
    
    if (!instructor) {
      req.flash('error', 'Instructor not found');
      return res.redirect('/admin/instructors');
    }
    
    // Get all courses from shared models
    const { Course } = require('../../../../shared/models/courses');
    
    const courses = await Course.find();
    
    res.render('admin/instructors/assign-course', {
      instructor,
      courses,
      title: 'Assign Course to Instructor'
    });
  } catch (error) {
    console.error('Error loading assign course form:', error);
    req.flash('error', 'An error occurred');
    res.redirect(`/admin/instructors/${req.params.id}`);
  }
});

// Assign course to instructor
router.post('/:id/assign-course', isAdmin, async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id);
    
    if (!instructor) {
      req.flash('error', 'Instructor not found');
      return res.redirect('/maelenglish/admin/instructors');
    }
    
    const { courseId } = req.body;
    
    // Check if course is already assigned
    const existingAssignment = instructor.assignedCourses.find(
      c => c.courseId.toString() === courseId
    );
    
    if (existingAssignment) {
      req.flash('error', 'This course is already assigned to this instructor');
      return res.redirect(`/maelenglish/admin/instructors/${instructor._id}`);
    }
    
    // Add new assignment without modules
    instructor.assignedCourses.push({
      courseId,
      modulesAccess: [], // Empty modules array
      assignedDate: Date.now(),
      status: 'active'
    });
    
    await instructor.save();
    
    req.flash('success', 'Course assigned successfully');
    res.redirect(`/maelenglish/admin/instructors/${instructor._id}`);
  } catch (error) {
    console.error('Error assigning course:', error);
    req.flash('error', 'An error occurred while assigning course');
    res.redirect(`/maelenglish/admin/instructors/${req.params.id}/assign-course`);
  }
});

// Unassign course from instructor
router.delete('/:id/unassign-course/:courseId', isAdmin, async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id);
    
    if (!instructor) {
      req.flash('error', 'Instructor not found');
      return res.redirect('/maelenglish/admin/instructors');
    }
    
    instructor.assignedCourses = instructor.assignedCourses.filter(
      c => c.courseId.toString() !== req.params.courseId
    );
    
    await instructor.save();
    
    req.flash('success', 'Course unassigned successfully');
    res.redirect(`/maelenglish/admin/instructors/${instructor._id}`);
  } catch (error) {
    console.error('Error unassigning course:', error);
    req.flash('error', 'An error occurred');
    res.redirect(`/maelenglish/admin/instructors/${req.params.id}`);
  }
});

module.exports = router;
