const User = require("../../../shared/models/user");
const catchAsync = require("../../../shared/utilities/catchAsync");

const {
    Class,
    Chapter,
    Subject,
    HStudent,
    HTeacher,
    HSCourseVideo,
} = require("../features/kalan/model");
const { hasActiveAccess } = require("../features/kalan/premiumAccess");

const isAdmin = (user) => user && (user.role === "admin" || user.role === "super-admin");

module.exports.facebookPageLike = catchAsync(async (req, res, next) => {
    if (req.user.likedPage || isAdmin(req.user)) {
        next();
    } else {
        res.render("social_media")
    }
});

// Checking student status
module.exports.checkStudentStatus = catchAsync(async (req, res, next) => {
if(req.user.isHighSchoolStudent || isAdmin(req.user)){
    next();
}else{
    res.render("notStudent");
}
});

// checking if student belongs to a class
module.exports.classCheck = catchAsync(async (req, res, next) => {

    const schoolClass = await Class.findById(req.params.class_id);

    if (!schoolClass) {
        return res.status(404).render("noAccess", { statusCode: 404, message: "Classe introuvable" });
    }

    // Admins can preview any class; students must belong to it.
    if (isAdmin(req.user) || schoolClass.students.includes(req.user.highSchool_id)) {
        next();
    } else {
        res.render("noAccess");
    }
});

// ✅ NOUVEAU: Middleware pour vérifier l'accès premium à une matière
module.exports.subjectPremiumAccess = catchAsync(async (req, res, next) => {
    const subject = await Subject.findById(req.params.subject_id);
    
    if (!subject) {
        req.flash('error', 'Matière non trouvée');
        return res.redirect('back');
    }
    
    // Les admins ont toujours accès
    if (req.user.role === "admin" || req.user.role === "super-admin") {
        return next();
    }
    
    const hsId = req.user.highSchool_id;

    // Kalan Ba: accès premium actif à cette matière
    if (hasActiveAccess(subject.premiumStudents, hsId)) {
        return next();
    }

    // Kalan Naaba: accès premium actif à toute la classe (bundle)
    const schoolClass = subject.classId ? await Class.findById(subject.classId).select("naabaStudents") : null;
    if (schoolClass && hasActiveAccess(schoolClass.naabaStudents, hsId)) {
        return next();
    }

    req.flash('error', 'Vous n\'avez pas accès premium à cette matière');
    return res.render("noAccess");
});

/**
 * ✅ MODIFIÉ: Vérifie si un étudiant a accès premium à un exercice spécifique
 * Nouvelle hiérarchie de vérification:
 * 1. Les cours (course) sont toujours gratuits → accès libre
 * 2. Les exercices de compréhension (starterEx, CIAM_basic, practiceEx) sont toujours gratuits → accès libre
 * 3. Si exercise.isPremium === false → accès libre
 * 4. Si l'étudiant a accès premium à la matière (subject.premiumStudents[]) → accès aux exercices premium
 */
async function hasPremiumAccessToExercise(studentId, exerciseId) {
    const exercise = await HSCourseVideo.findById(exerciseId).populate({
        path: 'chapterId',
        populate: { path: 'subjectId' }
    });
    
    if (!exercise) {
        return false;
    }
    
    // 1. Les cours sont toujours gratuits
    if (exercise.videoType === 'course') {
        return true;
    }
    
    // 2. Les exercices de compréhension sont toujours gratuits
    const freeTypes = ['starterEx', 'CIAM_basic', 'practiceEx'];
    if (freeTypes.includes(exercise.videoType)) {
        return true;
    }
    
    // 3. Si l'exercice n'est pas premium, accès libre
    if (!exercise.isPremium) {
        return true;
    }
    
    // 4. Vérifier l'accès premium actif à la matière (Kalan Ba) ou à la classe (Kalan Naaba)
    const chapter = exercise.chapterId;
    if (chapter && chapter.subjectId) {
        const subject = chapter.subjectId;
        if (hasActiveAccess(subject.premiumStudents, studentId)) {
            return true;
        }
        const schoolClass = subject.classId ? await Class.findById(subject.classId).select("naabaStudents") : null;
        if (schoolClass && hasActiveAccess(schoolClass.naabaStudents, studentId)) {
            return true;
        }
    }
    
    return false;
}

/**
 * ✅ NOUVEAU: Middleware pour vérifier l'accès premium à un exercice
 */
module.exports.checkExercisePremiumAccess = catchAsync(async (req, res, next) => {
    const { exercise_id } = req.params;
    const studentId = req.user.highSchool_id;
    
    // Les admins ont toujours accès
    if (req.user.role === 'admin' || req.user.role === 'super-admin') {
        return next();
    }
    
    // Vérifier si l'étudiant a accès
    const hasAccess = await hasPremiumAccessToExercise(studentId, exercise_id);
    
    if (!hasAccess) {
        req.flash('error', 'Vous n\'avez pas accès premium à cet exercice');
        return res.redirect('back');
    }
    
    next();
});