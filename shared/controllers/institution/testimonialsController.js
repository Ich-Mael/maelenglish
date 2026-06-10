const catchAsync = require('../../utilities/catchAsync');
const InstitutionCourseTestimonial = require('../../../programs/institution/models/Testimonial');

module.exports.create = catchAsync(async (req, res) => {
    const { courseId } = req.params;
    const { authorName, authorTitle, content, rating, isPublished } = req.body;

    await InstitutionCourseTestimonial.create({
        courseId,
        institutionId: req.institution._id,
        authorName: authorName.trim(),
        authorTitle: authorTitle ? authorTitle.trim() : '',
        content: content.trim(),
        rating: rating ? Number(rating) : undefined,
        isPublished: isPublished === 'on' || isPublished === 'true'
    });

    req.flash('success', 'Témoignage ajouté.');
    res.redirect(`/institution/dashboard/courses/${courseId}`);
});

module.exports.togglePublished = catchAsync(async (req, res) => {
    const { courseId, tid } = req.params;
    const testimonial = await InstitutionCourseTestimonial.findOne({
        _id: tid,
        courseId,
        institutionId: req.institution._id
    });

    if (!testimonial) {
        req.flash('error', 'Témoignage introuvable.');
        return res.redirect(`/institution/dashboard/courses/${courseId}`);
    }

    testimonial.isPublished = !testimonial.isPublished;
    await testimonial.save();

    req.flash('success', testimonial.isPublished ? 'Témoignage publié.' : 'Témoignage masqué.');
    res.redirect(`/institution/dashboard/courses/${courseId}`);
});

module.exports.destroy = catchAsync(async (req, res) => {
    const { courseId, tid } = req.params;
    await InstitutionCourseTestimonial.findOneAndDelete({
        _id: tid,
        courseId,
        institutionId: req.institution._id
    });

    req.flash('success', 'Témoignage supprimé.');
    res.redirect(`/institution/dashboard/courses/${courseId}`);
});
