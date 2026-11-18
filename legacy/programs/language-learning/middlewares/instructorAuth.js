// Instructor authentication and authorization middleware

const Instructor = require('../models/Instructor');

// Check if user has english-coach role
module.exports.isInstructor = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.flash('error', 'Vous devez d\'abord vous connecter!');
    return res.redirect('/login');
  }
  
  if (req.user.role === 'english-coach') {
    return next();
  }
  
  req.flash('error', 'Vous n\'avez pas les permissions nécessaires');
  res.redirect('/');
};

// Check if instructor has access to specific course
async function hasAccessToCourse(req, res, next) {
  try {
    const instructor = await Instructor.findOne({ userId: req.user._id });
    
    if (!instructor) {
      req.flash('error', 'Instructor profile not found');
      return res.redirect('/instructor/dashboard');
    }
    
    const courseId = req.params.courseId;
    const hasAccess = instructor.assignedCourses.some(
      course => course.courseId.toString() === courseId && course.status === 'active'
    );
    
    if (hasAccess) {
      req.instructor = instructor;
      return next();
    }
    
    req.flash('error', 'You do not have access to this course');
    res.redirect('/instructor/dashboard');
  } catch (error) {
    console.error('Error checking course access:', error);
    req.flash('error', 'An error occurred');
    res.redirect('/instructor/dashboard');
  }
}

// Check if instructor has access to specific module
async function hasAccessToModule(req, res, next) {
  try {
    const instructor = await Instructor.findOne({ userId: req.user._id });
    
    if (!instructor) {
      req.flash('error', 'Instructor profile not found');
      return res.redirect('/instructor/dashboard');
    }
    
    const moduleId = req.params.moduleId;
    let hasAccess = false;
    
    // Check if instructor has access to any course that contains this module
    for (const course of instructor.assignedCourses) {
      if (course.status === 'active') {
        const hasModuleAccess = course.modulesAccess.some(
          mod => mod.toString() === moduleId
        );
        if (hasModuleAccess) {
          hasAccess = true;
          break;
        }
      }
    }
    
    if (hasAccess) {
      req.instructor = instructor;
      return next();
    }
    
    req.flash('error', 'You do not have access to this module');
    res.redirect('/instructor/dashboard');
  } catch (error) {
    console.error('Error checking module access:', error);
    req.flash('error', 'An error occurred');
    res.redirect('/instructor/dashboard');
  }
}

module.exports.hasAccessToCourse = hasAccessToCourse;
module.exports.hasAccessToModule = hasAccessToModule;
