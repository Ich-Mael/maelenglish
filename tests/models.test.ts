import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Course, Enrollment, Lesson, Module, User, accessState, isAccountActive, type EnrollmentDoc } from "@/models";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
});

const base = { name: "Awa", surname: "Ouédraogo" };

describe("User", () => {
  it("requires an email or a WhatsApp number", async () => {
    await expect(User.create({ ...base, username: "awa" })).rejects.toThrow(/email ou un numéro WhatsApp/);
    await expect(User.create({ ...base, username: "awa1", email: "awa@example.com" })).resolves.toBeTruthy();
    await expect(User.create({ ...base, username: "awa2", phoneNumber: "70 12 34 56" })).resolves.toBeTruthy();
  });

  it("normalises the phone, lowercases username and email", async () => {
    const u = await User.create({ ...base, username: "Awa.O", email: "AWA@Example.com", phoneNumber: "+226 70 12 34 56" });
    expect(u.username).toBe("awa.o");
    expect(u.email).toBe("awa@example.com");
    expect(u.phoneE164).toBe("22670123456");
    expect(u.role).toBe("user");
    expect(isAccountActive(u)).toBe(true);
  });

  it("rejects an invalid phone or email", async () => {
    await expect(User.create({ ...base, username: "x1", phoneNumber: "12" })).rejects.toThrow(/téléphone invalide/);
    await expect(User.create({ ...base, username: "x2", email: "not-an-email" })).rejects.toThrow(/adresse mail valide/);
  });

  it("allows several accounts without email, and a shared phone, but unique usernames/emails", async () => {
    await User.create({ ...base, username: "kid1", phoneNumber: "70123456" });
    await User.create({ ...base, username: "kid2", phoneNumber: "70123456", email: "" });
    await expect(User.create({ ...base, username: "KID1", phoneNumber: "70000000" })).rejects.toThrow(/duplicate key/);
    await User.create({ ...base, username: "e1", email: "same@example.com" });
    await expect(User.create({ ...base, username: "e2", email: "same@example.com" })).rejects.toThrow(/duplicate key/);
  });
});

describe("Course / Module / Lesson", () => {
  it("only accepts catalogue programmes", async () => {
    await expect(Course.create({ title: "Business A1", program: "business" })).resolves.toBeTruthy();
    await expect(Course.create({ title: "Sans programme" })).resolves.toBeTruthy();
    await expect(Course.create({ title: "X", program: "astrology" })).rejects.toThrow(/Programme MaelEnglish inconnu/);
  });

  it("validates quiz questions", async () => {
    const course = await Course.create({ title: "Essentials 1", program: "essentials" });
    const options = [{ id: "a", text: "I am" }, { id: "b", text: "I is" }];
    const mod = await Module.create({
      courseId: course._id,
      title: "Day 1",
      quiz: { title: "Quiz", questions: [{ text: "Choose", options, correctOptionId: "a" }] },
    });
    expect(mod.quiz?.questions).toHaveLength(1);

    await expect(
      Module.create({ courseId: course._id, title: "Day 2", quiz: { questions: [{ text: "Choose", options, correctOptionId: "z" }] } }),
    ).rejects.toThrow(/bonne réponse/);
    await expect(
      Module.create({ courseId: course._id, title: "Day 3", quiz: { questions: [{ text: "One", options: [options[0]], correctOptionId: "a" }] } }),
    ).rejects.toThrow(/au moins 2 réponses/);
  });

  it("validates practice exercises per kind", async () => {
    const course = await Course.create({ title: "Essentials 1", program: "essentials" });
    const mod = await Module.create({ courseId: course._id, title: "Day 1" });
    const lesson = (exercises: object[]) =>
      Lesson.create({ courseId: course._id, moduleId: mod._id, title: "Practice", type: "practice", exercises });

    const ok = await lesson([
      { kind: "choice", text: "Hello means…", options: [{ id: "a", text: "Bonjour" }, { id: "b", text: "Merci" }], correctOptionId: "a" },
      { kind: "build", text: "Nice to meet you", distractors: ["see"] },
      { kind: "order", items: ["Hello", "How are you?", "Goodbye"] },
      { kind: "match", pairs: [{ left: "pilot", right: "pilote" }, { left: "runway", right: "piste" }] },
      { kind: "listen", text: "Fasten your seatbelt" },
      { kind: "speak", text: "Good morning" },
      { kind: "gap", text: "I ___ a student", answers: ["am"] },
    ]);
    expect(ok.exercises).toHaveLength(7);
    expect(ok.exercises[0]._id).toBeTruthy();

    await expect(lesson([{ kind: "choice", text: "?", options: [{ id: "a", text: "x" }, { id: "b", text: "y" }], correctOptionId: "z" }])).rejects.toThrow(/bonne réponse/);
    await expect(lesson([{ kind: "gap", text: "No blank", answers: ["am"] }])).rejects.toThrow(/___/);
    await expect(lesson([{ kind: "match", pairs: [{ left: "a", right: "b" }] }])).rejects.toThrow(/2 paires/);
  });
});

describe("Enrollment", () => {
  it("is unique per learner and course, and checks its dates", async () => {
    const user = await User.create({ ...base, username: "learner", email: "l@example.com" });
    const course = await Course.create({ title: "Tech", program: "tech" });
    await Enrollment.create({ userId: user._id, courseId: course._id });
    await expect(Enrollment.create({ userId: user._id, courseId: course._id })).rejects.toThrow(/duplicate key/);
    const other = await Course.create({ title: "Tech 2", program: "tech" });
    await expect(
      Enrollment.create({ userId: user._id, courseId: other._id, startDate: new Date("2027-02-01"), endDate: new Date("2027-01-01") }),
    ).rejects.toThrow(/date de fin/);
  });

  it("computes the access state", () => {
    const now = new Date("2027-03-15");
    type Window = Pick<EnrollmentDoc, "status" | "startDate" | "endDate">;
    const e = (o: Partial<Window>): Window => ({ status: "active", startDate: new Date("2027-03-01"), endDate: new Date("2027-04-30"), ...o });
    expect(accessState(e({}), now)).toBe("active");
    expect(accessState(e({ endDate: null }), now)).toBe("active");
    expect(accessState(e({ startDate: new Date("2027-04-01") }), now)).toBe("not-started");
    expect(accessState(e({ endDate: new Date("2027-03-10") }), now)).toBe("expired");
    expect(accessState(e({ status: "suspended" }), now)).toBe("suspended");
    expect(accessState(e({ status: "completed" }), now)).toBe("completed");
  });
});
