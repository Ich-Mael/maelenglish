const express = require('express');
const router = express.Router();
const Instructor = require('../models/Instructor');
const TeachingResource = require('../models/TeachingResource');
const { isInstructor, hasAccessToCourse, hasAccessToModule } = require('../middlewares/instructorAuth');

// Instructor Dashboard
router.get('/dashboard', isInstructor, async (req, res) => {
  try {
    const instructor = await Instructor.findOne({ userId: req.user._id })
      .populate('assignedCourses.courseId')
      .populate('assignedCourses.modulesAccess');
    
    if (!instructor) {
      req.flash('error', 'Instructor profile not found');
      return res.redirect('/');
    }
    
    // Get active courses
    const activeCourses = instructor.assignedCourses.filter(c => c.status === 'active');
    
    // Count total resources available
    const moduleIds = activeCourses.flatMap(c => c.modulesAccess.map(m => m._id));
    const resourcesCount = await TeachingResource.countDocuments({
      moduleId: { $in: moduleIds },
      isPublished: true
    });
    
    res.render('instructor/dashboard', {
      instructor,
      activeCourses,
      resourcesCount,
      title: 'Instructor Dashboard'
    });
  } catch (error) {
    console.error('Error loading instructor dashboard:', error);
    req.flash('error', 'An error occurred');
    res.redirect('/');
  }
});

// My Courses
router.get('/courses', isInstructor, async (req, res) => {
  try {
    const instructor = await Instructor.findOne({ userId: req.user._id })
      .populate('assignedCourses.courseId')
      .populate('assignedCourses.modulesAccess');
    
    const activeCourses = instructor.assignedCourses.filter(c => c.status === 'active');
    
    res.render('instructor/courses', {
      instructor,
      courses: activeCourses,
      title: 'My Courses'
    });
  } catch (error) {
    console.error('Error loading courses:', error);
    req.flash('error', 'An error occurred');
    res.redirect('/instructor/dashboard');
  }
});

// Course Details
router.get('/courses/:courseId', isInstructor, hasAccessToCourse, async (req, res) => {
  try {
    const instructor = req.instructor;
    const courseAssignment = instructor.assignedCourses.find(
      c => c.courseId.toString() === req.params.courseId
    );
    
    // Populate modules with their resources count
    const modulesWithResources = await Promise.all(
      courseAssignment.modulesAccess.map(async (moduleId) => {
        const Module = require('../models/Module');
        const module = await Module.findById(moduleId);
        const resourcesCount = await TeachingResource.countDocuments({
          moduleId: moduleId,
          isPublished: true
        });
        return {
          ...module.toObject(),
          resourcesCount
        };
      })
    );
    
    res.render('instructor/course-details', {
      course: courseAssignment.courseId,
      modules: modulesWithResources,
      title: `Course: ${courseAssignment.courseId.name}`
    });
  } catch (error) {
    console.error('Error loading course details:', error);
    req.flash('error', 'An error occurred');
    res.redirect('/instructor/courses');
  }
});

// Module Resources
router.get('/resources/module/:moduleId', isInstructor, hasAccessToModule, async (req, res) => {
  try {
    const resources = await TeachingResource.find({
      moduleId: req.params.moduleId,
      isPublished: true,
      $or: [
        { accessLevel: 'all_instructors' },
        { accessLevel: 'specific_instructors', specificInstructors: req.instructor._id }
      ]
    }).populate('chapterId').sort({ createdAt: -1 });
    
    const Module = require('../models/Module');
    const module = await Module.findById(req.params.moduleId);
    
    res.render('instructor/resources', {
      module,
      resources,
      title: `Resources: ${module.name}`
    });
  } catch (error) {
    console.error('Error loading resources:', error);
    req.flash('error', 'An error occurred');
    res.redirect('/instructor/dashboard');
  }
});

// View Resource
router.get('/resources/view/:resourceId', isInstructor, async (req, res) => {
  try {
    const resource = await TeachingResource.findById(req.params.resourceId)
      .populate('courseId')
      .populate('moduleId')
      .populate('chapterId');
    
    if (!resource) {
      req.flash('error', 'Resource not found');
      return res.redirect('/instructor/dashboard');
    }
    
    // Check if instructor has access to this module
    const instructor = await Instructor.findOne({ userId: req.user._id });
    let hasAccess = false;
    
    for (const course of instructor.assignedCourses) {
      if (course.status === 'active') {
        const hasModuleAccess = course.modulesAccess.some(
          mod => mod.toString() === resource.moduleId._id.toString()
        );
        if (hasModuleAccess) {
          hasAccess = true;
          break;
        }
      }
    }
    
    if (!hasAccess) {
      req.flash('error', 'You do not have access to this resource');
      return res.redirect('/instructor/dashboard');
    }
    
    // Increment view count
    await resource.incrementViewCount();
    
    res.render('instructor/resource-view', {
      resource,
      title: resource.title
    });
  } catch (error) {
    console.error('Error viewing resource:', error);
    req.flash('error', 'An error occurred');
    res.redirect('/instructor/dashboard');
  }
});

// Track resource view (AJAX endpoint)
router.post('/resources/:resourceId/track-view', isInstructor, async (req, res) => {
  try {
    const resource = await TeachingResource.findById(req.params.resourceId);
    if (resource) {
      await resource.incrementViewCount();
      res.json({ success: true, viewCount: resource.viewCount });
    } else {
      res.status(404).json({ success: false, message: 'Resource not found' });
    }
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
