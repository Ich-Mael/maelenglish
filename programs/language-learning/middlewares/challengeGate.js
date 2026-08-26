/**
 * English Challenge — day-by-day drip + instructor-reviewed checkpoint gating.
 *
 * A challenge course's Modules are "Days" (ordered by `order`). For each
 * enrolled student:
 *   - time is the ceiling  : a day can't open before the calendar reaches it
 *                            (Day 1 opens on the enrollment start day)
 *   - checkpoints are floor : Day N+1 opens only once Day N's checkpoint
 *                            (its instructor-graded module assignment) is APPROVED
 *   unlockedDay = min(daysSinceStart + 1, highestApprovedCheckpointDay + 1)
 *
 * A behind learner can catch up to today; a missed/unapproved checkpoint keeps
 * the next day hard-locked (no auto-drop). Admins/coaches preview everything.
 */
const { Course, Module } = require('../../../shared/models/courses');
const AssignmentSubmission = require('../../../shared/models/assignmentSubmission');
const catchAsync = require('../../../shared/utilities/catchAsync');

const DAY_MS = 24 * 60 * 60 * 1000;
const GEB_BASE = '/programs/language-learning/general-english-boost';

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isAdminOrCoach(user) {
  return !!user && ['admin', 'super-admin', 'english-coach', 'instructor'].includes(user.role);
}

/**
 * Pure state computation (no DB) — unit-testable.
 * @param {Array}  modules      day-modules, already ordered; each {_id,title,isCheckpointRequired}
 * @param {Date}   start        student's enrollment start (Day 1)
 * @param {Object} subByModule  map moduleId(string) -> { status } for module_assignment
 * @param {Boolean} isAdmin     admin/coach preview (no gating)
 * @param {Date}   now          current time (defaults to now)
 */
function computeChallengeState({ modules, start, subByModule = {}, isAdmin = false, now = new Date() }) {
  const totalDays = modules.length;
  const startDay = startOfDay(start);
  const today = startOfDay(now);
  const elapsedDays = Math.max(0, Math.floor((today - startDay) / DAY_MS)); // 0 on start day
  const timeCeilingDay = isAdmin ? totalDays : elapsedDays + 1;

  // highest consecutively-approved day (rest days auto-pass)
  let highestApprovedDay = 0;
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    const day = i + 1;
    if (!m.isCheckpointRequired) { highestApprovedDay = day; continue; }
    const sub = subByModule[String(m._id)];
    if (sub && sub.status === 'graded') { highestApprovedDay = day; }
    else break;
  }

  const unlockedDay = isAdmin ? totalDays : Math.min(timeCeilingDay, highestApprovedDay + 1);

  const days = modules.map((m, i) => {
    const day = i + 1;
    const sub = subByModule[String(m._id)];
    const checkpointStatus = !m.isCheckpointRequired
      ? 'not_required'
      : (sub ? sub.status : 'not_submitted'); // pending | graded | returned | not_submitted
    const accessible = isAdmin || day <= unlockedDay;

    let state;
    if (isAdmin) state = 'unlocked';
    else if (day < unlockedDay) state = 'done';
    else if (day === unlockedDay) {
      state = 'current';
      if (m.isCheckpointRequired && checkpointStatus === 'pending') state = 'pending_review';
      else if (m.isCheckpointRequired && checkpointStatus === 'returned') state = 'redo';
    } else if (day <= timeCeilingDay) state = 'locked_checkpoint';
    else state = 'locked_time';

    return {
      day,
      moduleId: m._id,
      title: m.title,
      isCheckpointRequired: m.isCheckpointRequired,
      checkpointStatus,
      accessible,
      state,
    };
  });

  return {
    isChallenge: true,
    totalDays,
    start: startDay,
    elapsedDays,
    timeCeilingDay,
    highestApprovedDay,
    unlockedDay,
    currentDay: Math.min(unlockedDay, totalDays),
    streak: highestApprovedDay,
    days,
    dayAccessible(day) { return isAdmin || (day >= 1 && day <= unlockedDay); },
  };
}

/**
 * DB-backed state for a student on a challenge course.
 * @param {Object} user   req.user
 * @param {Object} course Course doc (needs _id, title, modules)
 */
async function getChallengeState(user, course) {
  const modules = await Module.find({ _id: { $in: course.modules || [] } })
    .sort({ order: 1, createdAt: 1 })
    .select('_id title order isCheckpointRequired')
    .lean();

  const isAdmin = isAdminOrCoach(user);

  // Student start = their specialProgram enrollment start (Day 1); fallback: today.
  const enrollment = (user.specialProgram || []).find(p => p.courseTitle === course.title);
  const start = enrollment && enrollment.startDate ? enrollment.startDate : new Date();

  let subByModule = {};
  if (!isAdmin) {
    const subs = await AssignmentSubmission.find({
      userId: user._id,
      courseId: course._id,
      assignmentType: 'module_assignment',
    }).select('moduleId status').lean();
    subs.forEach(s => { if (s.moduleId) subByModule[String(s.moduleId)] = s; });
  }

  return computeChallengeState({ modules, start, subByModule, isAdmin });
}

/**
 * Middleware: block URL-jumping to a locked day's content on a challenge course.
 * No-op for non-challenge courses. Expects :course_id and :module_id params.
 */
const checkChallengeDayAccess = catchAsync(async (req, res, next) => {
  const course = await Course.findById(req.params.course_id).select('title modules isChallenge');
  if (!course || !course.isChallenge) return next();
  if (isAdminOrCoach(req.user)) return next();

  const state = await getChallengeState(req.user, course);
  const entry = state.days.find(d => String(d.moduleId) === String(req.params.module_id));
  if (!entry) return next(); // module not part of the ordered days — don't block

  if (!entry.accessible) {
    req.flash('error', entry.state === 'locked_time'
      ? "Ce jour n'est pas encore ouvert — revenez le moment venu."
      : "Terminez et faites valider le point de contrôle du jour précédent pour débloquer ce jour.");
    return res.redirect(`${GEB_BASE}/${course._id}/challenge`);
  }
  next();
});

module.exports = {
  computeChallengeState,
  getChallengeState,
  checkChallengeDayAccess,
  isAdminOrCoach,
  GEB_BASE,
};
