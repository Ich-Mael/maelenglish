const { Course } = require('../../../shared/models/courses');
const catchAsync = require('../../../shared/utilities/catchAsync');

module.exports.checkCourseAccess = catchAsync(async (req, res, next) => {
    // 1. Get Course ID
    const { course_id } = req.params;
    
    // 2. Fetch Course to get Title (needed because specialProgram stores Title, not ID)
    // Optimize: select only title
    const course = await Course.findById(course_id).select('title');
    
    if (!course) {
        req.flash('error', 'Cours non trouvé.');
        return res.redirect('/programs/language-learning/general-english-boost/my-courses');
    }

    // 3. Check Admin/Instructor roles - bypass check
    if (req.user && (req.user.role === 'admin' || req.user.role === 'super-admin' || req.user.role === 'english-coach' || req.user.role === 'instructor')) {
        return next();
    }

    // 4. Find Enrollment in specialProgram
    // We look for a matching course title in the user's special programs
    const userPrograms = req.user.specialProgram || [];
    const enrollment = userPrograms.find(p => p.courseTitle === course.title);

    // 5. Logic: 
    // If NO enrollment record found -> It might be a legacy enrollment (only in coursesTaken).
    // We allow access if it's in coursesTaken but no dates are defined (Backward Compatibility).
    // If it IS in specialProgram, we MUST check dates.

    if (!enrollment) {
        // Double check if they are in coursesTaken at least
        const isEnrolled = req.user.coursesTaken.some(id => id.toString() === course_id);
        if (isEnrolled) {
            // Legacy enrollment without dates -> Allow access
            return next();
        } else {
            req.flash('error', 'Vous n\'êtes pas inscrit à ce cours.');
            return res.redirect('/programs/language-learning/general-english-boost/my-courses');
        }
    }

    // 6. Check Dates
    const now = new Date();
    const startDate = enrollment.startDate ? new Date(enrollment.startDate) : null;
    const endDate = enrollment.endDate ? new Date(enrollment.endDate) : null;

    // Check Start Date
    if (startDate && now < startDate) {
        req.flash('error', `Ce cours ne sera accessible qu'à partir du ${startDate.toLocaleDateString('fr-FR')}.`);
        return res.redirect('/programs/language-learning/general-english-boost/my-courses');
    }

    // Check End Date
    if (endDate && now > endDate) {
        req.flash('error', `Votre accès à ce cours a expiré le ${endDate.toLocaleDateString('fr-FR')}. Veuillez contacter l'administration pour prolonger votre accès.`);
        return res.redirect('/programs/language-learning/general-english-boost/my-courses');
    }

    // 7. Access Granted
    next();
});
