/**
 * Migration: convert existing Module.videoLinks (EngCourseVideo) and
 * Module.Assignment (Practice) into the new Lesson model.
 *
 * Usage:
 *   node scripts/migrate-to-lessons.js            # dry-run (no writes)
 *   node scripts/migrate-to-lessons.js --execute  # apply changes
 *
 * Safe to re-run: skips modules that already have lessons.
 */

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const mongoose = require('mongoose');
const { Module, Course, EngCourseVideo, Practice } = require('../shared/models/courses');
const Lesson = require('../shared/models/lesson');

const DRY_RUN = !process.argv.includes('--execute');

async function migrate() {
    await mongoose.connect(process.env.APP_DB || 'mongodb://localhost:27017/afrohk');
    console.log(`\n🔄 Migration: EngCourseVideo + Practice → Lesson`);
    console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'EXECUTE'}\n`);

    const courses = await Course.find().populate('modules');
    let totalModules = 0, migratedModules = 0, skippedModules = 0,
        totalLessons = 0, errors = 0;

    for (const course of courses) {
        for (const moduleId of course.modules) {
            const mod = await Module.findById(moduleId)
                .populate('videoLinks')
                .populate('Assignment');

            if (!mod) continue;
            totalModules++;

            // Skip if already migrated (has lessons)
            if (mod.lessons && mod.lessons.length > 0) {
                skippedModules++;
                continue;
            }

            const hasVideos    = mod.videoLinks && mod.videoLinks.length > 0;
            const hasPractices = mod.Assignment && mod.Assignment.length > 0;

            if (!hasVideos && !hasPractices) {
                skippedModules++;
                continue;
            }

            console.log(`  Module: "${mod.title}" (Course: "${course.title}")`);
            const createdLessonIds = [];
            let order = 1;

            // Convert videoLinks → Lesson (video)
            for (const video of (mod.videoLinks || [])) {
                const lessonData = {
                    moduleId:     mod._id,
                    courseId:     course._id,
                    title:        video.title || `Leçon vidéo ${order}`,
                    type:         'video',
                    order,
                    videoUrl:     video.engCourseLink || '',
                    description:  video.lessonType || ''
                };

                if (DRY_RUN) {
                    console.log(`    [DRY] Would create video lesson: "${lessonData.title}" (order ${order})`);
                } else {
                    const lesson = await Lesson.create(lessonData);
                    createdLessonIds.push(lesson._id);
                    console.log(`    ✓ Created video lesson: "${lesson.title}"`);
                }
                order++;
                totalLessons++;
            }

            // Convert Assignment (Practice) → Lesson (practice_quiz)
            for (const practice of (mod.Assignment || [])) {
                const lessonData = {
                    moduleId:    mod._id,
                    courseId:    course._id,
                    title:       practice.title || `Exercice ${order}`,
                    type:        'practice_quiz',
                    order,
                    description: practice.category || '',
                    practiceQuiz: { questions: [] } // links can't be auto-converted to questions
                };

                if (DRY_RUN) {
                    console.log(`    [DRY] Would create practice lesson: "${lessonData.title}" (order ${order})`);
                } else {
                    const lesson = await Lesson.create(lessonData);
                    createdLessonIds.push(lesson._id);
                    console.log(`    ✓ Created practice lesson: "${lesson.title}"`);
                }
                order++;
                totalLessons++;
            }

            // Update module to reference new lessons
            if (!DRY_RUN && createdLessonIds.length > 0) {
                mod.lessons = createdLessonIds;
                await mod.save();
            }

            migratedModules++;
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Modules scanned : ${totalModules}`);
    console.log(`   Migrated        : ${migratedModules}`);
    console.log(`   Skipped (clean) : ${skippedModules}`);
    console.log(`   Lessons created : ${totalLessons} ${DRY_RUN ? '(dry run)' : ''}`);
    if (errors > 0) console.log(`   ⚠ Errors        : ${errors}`);

    if (DRY_RUN) {
        console.log(`\n⚠  DRY RUN — no changes written. Re-run with --execute to apply.\n`);
    } else {
        console.log(`\n✅ Migration complete.\n`);
    }

    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
