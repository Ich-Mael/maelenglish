/**
 * Premium access helpers (Kalan Ba & Kalan Naaba).
 *
 * Access entries live on `subject.premiumStudents[]` and `class.naabaStudents[]`
 * as subdocuments: { student: ObjectId(HStudent), grantedAt: Date, expiresAt: Date }.
 * Access is time-limited and academic-year aligned: a grant is valid until the
 * next ACADEMIC_YEAR_END (31 August by default). Expired entries are simply
 * ignored at read time (no cron needed) and can be renewed.
 */

// End of the academic year (month is 0-indexed: 7 = August). Configurable.
const ACADEMIC_YEAR_END = { month: 7, day: 31 };

// The next academic-year-end (31 Aug 23:59:59) strictly after `from`.
function academicYearEndAfter(from = new Date()) {
  const d = new Date(from);
  let year = d.getFullYear();
  const cutoffThisYear = new Date(
    year, ACADEMIC_YEAR_END.month, ACADEMIC_YEAR_END.day, 23, 59, 59, 999
  );
  if (d > cutoffThisYear) year += 1;
  return new Date(year, ACADEMIC_YEAR_END.month, ACADEMIC_YEAR_END.day, 23, 59, 59, 999);
}

// Build a fresh grant entry for a student.
function makeGrant(studentId, now = new Date()) {
  return { student: studentId, grantedAt: now, expiresAt: academicYearEndAfter(now) };
}

// Find a student's existing access entry (active or expired), if any.
function findEntry(list, hsId) {
  if (!list || !hsId) return null;
  return list.find(
    (e) => e && e.student && e.student.toString() === hsId.toString()
  ) || null;
}

// True if the student has a non-expired access entry.
function hasActiveAccess(list, hsId, now = new Date()) {
  const e = findEntry(list, hsId);
  return !!(e && e.expiresAt && new Date(e.expiresAt) > now);
}

// Count of non-expired entries.
function activeCount(list, now = new Date()) {
  if (!list) return 0;
  return list.filter((e) => e && e.expiresAt && new Date(e.expiresAt) > now).length;
}

// Grant or renew access for a student on `list` (must be an array). Mutates the
// list only when it actually grants/renews. Returns:
//   "active"  — already has non-expired access (unchanged)
//   "renewed" — had an expired entry, refreshed it
//   "granted" — new entry pushed
function grantOrRenew(list, studentId, now = new Date()) {
  const e = findEntry(list, studentId);
  if (e && e.expiresAt && new Date(e.expiresAt) > now) return "active";
  if (e) {
    e.grantedAt = now;
    e.expiresAt = academicYearEndAfter(now);
    return "renewed";
  }
  list.push(makeGrant(studentId, now));
  return "granted";
}

module.exports = {
  ACADEMIC_YEAR_END,
  academicYearEndAfter,
  makeGrant,
  findEntry,
  hasActiveAccess,
  activeCount,
  grantOrRenew,
};
