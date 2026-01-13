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

module.exports.facebookPageLike = catchAsync(async (req, res, next) => {
    if ((req.user.likedPage) || req.user.role === "admin") {
        next();
    } else {
        res.render("social_media")
    }
});

// Checking student status
module.exports.checkStudentStatus = catchAsync(async (req, res, next) => {
if(req.user.isHighSchoolStudent || req.user.role === "admin"){
    next();
}else{
    res.render("notStudent");
}
});

// checking if student belongs to a class
module.exports.classCheck = catchAsync(async (req, res, next) => {

    const schoolClass = await Class.findById(req.params.class_id);

    if ((schoolClass.students.includes(req.user.highSchool_id))) {
        next();
    } else {
        res.render("noAccess");
    }
});

// ❌ DÉPRÉCIÉ: chapterPremiumAccess remplacé par subjectPremiumAccess
// L'accès premium est maintenant géré au niveau de la matière
module.exports.chapterPremiumAccess = catchAsync(async (req, res, next) => {
    // Redirection vers la nouvelle logique sujet pour compatibilité
    const chapter = await Chapter.findById(req.params.chapter_id).populate('subjectId');
    if (!chapter || !chapter.subjectId) {
        return res.render("noAccess");
    }
    
    const subject = chapter.subjectId;
    if ((subject.premiumStudents && subject.premiumStudents.includes(req.user.highSchool_id)) || req.user.role === "admin") {
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
    
    // Vérifier si l'étudiant a accès premium à la matière
    if (subject.premiumStudents && subject.premiumStudents.includes(req.user.highSchool_id)) {
        return next();
    } else {
        req.flash('error', 'Vous n\'avez pas accès premium à cette matière');
        return res.render("noAccess");
    }
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
    
    // 4. Vérifier l'accès premium à la matière
    const chapter = exercise.chapterId;
    if (chapter && chapter.subjectId) {
        const subject = chapter.subjectId;
        if (subject.premiumStudents && subject.premiumStudents.includes(studentId)) {
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

/**
 * ✅ NOUVEAU: Middleware pour filtrer les exercices selon l'accès premium
 * Utile pour les listes d'exercices
 */
module.exports.filterExercisesByAccess = catchAsync(async (req, res, next) => {
    const studentId = req.user.highSchool_id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super-admin';
    
    // Attacher la fonction de filtrage à req pour l'utiliser dans les contrôleurs
    req.filterPremiumExercises = async (exercises) => {
        if (isAdmin) {
            return exercises; // Les admins voient tout
        }
        
        const accessibleExercises = [];
        
        for (const exercise of exercises) {
            // Les cours et exercices de compréhension sont toujours accessibles
            if (exercise.videoType === 'course' || 
                ['starterEx', 'CIAM_basic', 'practiceEx'].includes(exercise.videoType)) {
                accessibleExercises.push(exercise);
            } else if (!exercise.isPremium) {
                accessibleExercises.push(exercise);
            } else {
                const hasAccess = await hasPremiumAccessToExercise(studentId, exercise._id);
                if (hasAccess) {
                    accessibleExercises.push(exercise);
                }
            }
        }
        
        return accessibleExercises;
    };
    
    next();
});