import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Activity, CoachingSession, ConversationSession, Course, Enrollment, Media, Module, Step, StepProgress, Unit, User } from "@/models";
import { cleanContent } from "@/lib/lab/content";
import {
  addResource,
  addTask,
  CoachingError,
  createCoaching,
  fileAccess,
  goalsOf,
  joinSession,
  listCoachings,
  listEntries,
  markRead,
  openCoaching,
  postEntry,
  reviewChallenge,
  saveGoal,
  saveLabProgress,
  scheduleSession,
  setGoalStatus,
  setMembers,
  submitChallenge,
  taskStates,
  tasksOf,
  unreadCount,
  updateCoaching,
  type Viewer,
} from "@/lib/coaching/service";
import { runSessionReminders } from "@/lib/coaching/notify";
import { FakeVideoProvider, setVideoProviderForTests } from "@/lib/video/daily";

let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
});
afterAll(async () => {
  setVideoProviderForTests(undefined);
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  setVideoProviderForTests(undefined);
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
});

let n = 0;
async function user(role: Viewer["role"] = "user"): Promise<Viewer> {
  n++;
  const u = await User.create({ name: `U${n}`, surname: "T", username: `u${n}`, email: `u${n}@example.com`, role });
  return { id: String(u._id), role };
}

async function setup() {
  const admin = await user("admin");
  const coach = await user("english-coach");
  const awa = await user();
  const kofi = await user();
  const outsider = await user();
  const id = await createCoaching(admin, { kind: "group", memberIds: [awa.id, kofi.id], coachId: coach.id, title: "Équipe commerciale", goal: "<p>Présentations clients</p>" });
  return { admin, coach, awa, kofi, outsider, id };
}

describe("coachings and access", () => {
  it("managers open coachings; roles: coach, members, nobody else", async () => {
    const { coach, awa, outsider, id, admin } = await setup();
    await expect(createCoaching(coach, { memberIds: [awa.id], coachId: coach.id, title: "x" })).rejects.toThrow(CoachingError);
    expect((await openCoaching(coach, id)).role).toBe("coach");
    expect((await openCoaching(admin, id)).role).toBe("coach");
    expect((await openCoaching(awa, id)).role).toBe("member");
    await expect(openCoaching(outsider, id)).rejects.toThrow("not found");
    expect((await listCoachings(coach)).map(String).length).toBe(1);
    expect((await listCoachings(awa, { memberOnly: true })).length).toBe(1);
    expect((await listCoachings(outsider, { memberOnly: true })).length).toBe(0);
    // An individual coaching for one person.
    const single = await createCoaching(admin, { memberIds: [outsider.id], coachId: coach.id, title: "Entretien" });
    expect((await openCoaching(outsider, single)).coaching.kind).toBe("individual");
    // A member can't edit; the coach can't change the coach.
    await expect(updateCoaching(awa, id, { title: "Hack" })).rejects.toThrow("Only the coach");
    await expect(updateCoaching(coach, id, { coachId: admin.id })).rejects.toThrow("account managers");
    await setMembers(coach, id, [awa.id]);
    await expect(openCoaching(await user(), id)).rejects.toThrow();
  });

  it("group items and private items: a member never sees another member's", async () => {
    const { coach, awa, kofi, id } = await setup();
    await saveGoal(coach, id, { title: "Présenter en 3 minutes" });
    await saveGoal(coach, id, { title: "Travailler l'intonation", forUserId: kofi.id });
    const { coaching } = await openCoaching(awa, id);
    expect((await goalsOf(awa, coaching._id, "member")).map((g) => g.title)).toEqual(["Présenter en 3 minutes"]);
    expect((await goalsOf(kofi, coaching._id, "member")).length).toBe(2);
    expect((await goalsOf(coach, coaching._id, "coach")).length).toBe(2);
    // A member's own progress on a shared goal doesn't change the others'.
    const g = (await goalsOf(awa, coaching._id, "member"))[0];
    await setGoalStatus(awa, id, String(g._id), "done");
    const after = (await goalsOf(coach, coaching._id, "coach")).find((x) => String(x._id) === String(g._id))!;
    expect(after.status).toBe("todo");
    expect((after.memberStatus as unknown as Record<string, string>)[awa.id] ?? (after.memberStatus as unknown as Map<string, string>).get?.(awa.id)).toBe("done");
    await expect(saveGoal(coach, id, { title: "x", forUserId: (await user()).id })).rejects.toThrow("isn't in the coaching");
  });

  it("feedback threads: shared and private, read state", async () => {
    const { coach, awa, kofi, id } = await setup();
    await postEntry(coach, id, { text: "<p>Bravo à tous</p>", kind: "feedback" });
    await postEntry(coach, id, { thread: kofi.id, text: "<p>Kofi, ralentis</p>", kind: "feedback" });
    await postEntry(awa, id, { text: "<p>Merci coach</p>" });
    await expect(postEntry(awa, id, { thread: kofi.id, text: "<p>Psst</p>" })).rejects.toThrow("your own thread");
    await expect(postEntry(awa, id, { text: "<p> </p>" })).rejects.toThrow("Write a message");
    expect((await listEntries(awa, id)).map((e) => e.text)).toEqual(["<p>Bravo à tous</p>", "<p>Merci coach</p>"]);
    expect((await listEntries(kofi, id)).length).toBe(3);
    const { coaching } = await openCoaching(kofi, id);
    expect(await unreadCount(kofi, coaching._id, "member")).toBe(3);
    await markRead(kofi, id);
    expect(await unreadCount(kofi, coaching._id, "member")).toBe(0);
  });

  it("resources: links and private files, opened only by those concerned", async () => {
    const { coach, awa, kofi, id } = await setup();
    await addResource(coach, id, { title: "Vidéo modèle", url: "https://youtu.be/abc" });
    const m = await Media.create({ ownerId: coach.id, kind: "document", key: "coaching_files/document/x.pdf", mime: "application/pdf", size: 10, status: "ready", visibility: "private" });
    await addResource(coach, id, { title: "Plan de Kofi", mediaId: String(m._id), forUserId: kofi.id });
    await expect(addResource(coach, id, { title: "x", url: "ftp://x" })).rejects.toThrow("https://");
    await expect(addResource(awa, id, { title: "x", url: "https://x.y" })).rejects.toThrow("Only the coach");
    expect(await fileAccess(kofi, id, String(m._id))).toBe(true);
    expect(await fileAccess(awa, id, String(m._id))).toBe(false);
  });
});

describe("tasks on existing content", () => {
  async function content() {
    const c = await Course.create({ title: "Business English" });
    const mo = await Module.create({ courseId: c._id, order: 1, title: "M" });
    const u = await Unit.create({ courseId: c._id, moduleId: mo._id, order: 1, title: "U" });
    const st = await Step.create({ courseId: c._id, moduleId: mo._id, unitId: u._id, position: 1, kind: "lesson", title: "L", content: {} });
    const lab = await Activity.create({ type: "match_pairs", title: "Greetings", status: "ready", content: cleanContent("match_pairs", { pairs: [{ id: "a", left: "Hi", right: "Salut" }, { id: "b", left: "Bye", right: "Au revoir" }] }) });
    const ch = await Activity.create({ type: "speaking_challenge", title: "Pitch", status: "ready", content: cleanContent("speaking_challenge", { instructions: "<p>Présentez-vous</p>", maxSeconds: 60 }) });
    const rp = await Activity.create({ type: "role_play", title: "Client call", status: "ready", content: cleanContent("role_play", { aiRole: "a client", learnerRole: "a seller", setting: "A call", goals: ["Greet"], openingLine: "Hello?" }) });
    return { c, st, lab, ch, rp };
  }

  it("assigns a course (enrols), a Lab activity, a challenge and a role-play; states per member", async () => {
    const { coach, awa, kofi, id } = await setup();
    const { c, st, lab, ch, rp } = await content();
    await addTask(coach, id, { kind: "course", courseId: String(c._id) });
    expect(await Enrollment.countDocuments({ courseId: c._id })).toBe(2);
    const labTask = (await addTask(coach, id, { kind: "lab", activityId: String(lab._id) })).task;
    const chTask = (await addTask(coach, id, { kind: "challenge", activityId: String(ch._id), forUserId: kofi.id })).task;
    await addTask(coach, id, { kind: "roleplay", activityId: String(rp._id) });
    await expect(addTask(coach, id, { kind: "lab", activityId: String(ch._id) })).rejects.toThrow("doesn't match");

    const { coaching } = await openCoaching(awa, id);
    expect((await tasksOf(awa, coaching._id, "member")).length).toBe(3); // not Kofi's challenge
    // Awa does the lesson, the Lab task and a role-play call.
    await StepProgress.create({ userId: awa.id, stepId: st._id, courseId: c._id, completedAt: new Date() });
    await saveLabProgress(awa.id, String(labTask._id), 80);
    await ConversationSession.create({ userId: awa.id, activityId: rp._id, title: "x", status: "debriefed", score: 70, provider: "fake", agentId: "a" });
    // Kofi sends his challenge; the coach returns it, he resends.
    const rec = await Media.create({ ownerId: kofi.id, kind: "recording", key: "students_audio/recording/x.webm", mime: "audio/webm", size: 9, durationS: 30, status: "ready", visibility: "private" });
    const sub = (await submitChallenge(kofi, String(chTask._id), String(rec._id))).submission;
    await expect(submitChallenge(awa, String(chTask._id), String(rec._id))).rejects.toThrow();
    await expect(reviewChallenge(coach, String(sub._id), { decision: "returned" })).rejects.toThrow("Explain");
    await reviewChallenge(coach, String(sub._id), { decision: "returned", comment: "<p>Plus lentement</p>" });
    const again = (await submitChallenge(kofi, String(chTask._id), String(rec._id))).submission;
    expect([again.status, (again.history ?? []).length]).toEqual(["pending", 1]);

    const states = await taskStates(await tasksOf(coach, coaching._id, "coach"), [awa.id, kofi.id]);
    const byKind = Object.fromEntries((await tasksOf(coach, coaching._id, "coach")).map((t) => [t.kind, states[String(t._id)]]));
    expect(byKind.course[awa.id].done).toBe(true);
    expect(byKind.course[kofi.id].done).toBe(false);
    expect(byKind.lab[awa.id].label).toBe("80%");
    expect(byKind.roleplay[awa.id].score).toBe(70);
    expect(Object.keys(byKind.challenge)).toEqual([kofi.id]);
    expect(byKind.challenge[kofi.id].label).toContain("waiting");
  });
});

describe("live sessions", () => {
  it("embedded call in the window (coach = owner), fallback link, reminders once", async () => {
    const { coach, awa, kofi, id } = await setup();
    const start = new Date(Date.now() + 30 * 60_000);
    const { session } = await scheduleSession(coach, id, { startsAt: start.toISOString(), durationMin: 60 });
    const indiv = (await scheduleSession(coach, id, { startsAt: start.toISOString(), forUserId: kofi.id })).session;
    await expect(joinSession(awa, String(indiv._id))).rejects.toThrow("not found");

    // Too early, then in the window with Daily.
    expect(await joinSession(awa, String(session._id), new Date(start.getTime() - 20 * 60_000))).toMatchObject({ mode: "none", reason: "not_open" });
    setVideoProviderForTests(new FakeVideoProvider());
    const now = new Date(start.getTime() - 5 * 60_000);
    const j1 = await joinSession(awa, String(session._id), now);
    const j2 = await joinSession(coach, String(session._id), now);
    expect(j1).toMatchObject({ mode: "embed", url: `https://fake.daily.co/me-${session._id}` });
    expect(j1.mode === "embed" && j1.token.endsWith("guest")).toBe(true);
    expect(j2.mode === "embed" && j2.token.endsWith("owner")).toBe(true);
    // Without Daily: the coaching's meeting link, else nothing.
    setVideoProviderForTests(null);
    expect(await joinSession(awa, String(session._id), now)).toMatchObject({ mode: "none", reason: "no_video" });
    await updateCoaching(coach, id, { meetingUrl: "https://meet.google.com/abc" });
    expect(await joinSession(awa, String(session._id), now)).toEqual({ mode: "link", url: "https://meet.google.com/abc" });

    // Reminders: the « 1 hour » one is sent once.
    const r1 = await runSessionReminders(new Date(start.getTime() - 50 * 60_000));
    const r2 = await runSessionReminders(new Date(start.getTime() - 40 * 60_000));
    expect(r1.sent).toBeGreaterThan(0);
    expect(r2.sent).toBe(0);
    expect((await CoachingSession.findById(session._id))!.remindersSent).toContain("hour");
    void Types;
  });
});
