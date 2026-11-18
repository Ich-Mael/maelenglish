import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EnrollmentRequest, User } from "@/models";
import { adminEmails, countNewRequests, createRequest, listRequests, offerName, updateRequest } from "@/lib/requests";

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

const valid = { firstName: "Awa", lastName: "Ouédraogo", phoneNumber: "70 12 34 56", consent: true };

describe("sign-up requests", () => {
  it("validates required fields, phone, email and consent", async () => {
    await expect(createRequest({ ...valid, firstName: " " })).rejects.toThrow(/prénom/);
    await expect(createRequest({ ...valid, phoneNumber: "12" })).rejects.toThrow(/WhatsApp valide/);
    await expect(createRequest({ ...valid, email: "not-an-email" })).rejects.toThrow(/email/);
    await expect(createRequest({ ...valid, consent: false })).rejects.toThrow(/recontactions/);
  });

  it("normalises the phone, keeps known offers only, defaults the rest", async () => {
    const r = await createRequest({ ...valid, email: "Awa@Example.com", program: "aviation", level: "beginner", kind: "notify" });
    expect(r).toMatchObject({ phoneE164: "22670123456", email: "awa@example.com", program: "aviation", level: "beginner", kind: "notify", status: "new" });
    const other = await createRequest({ ...valid, program: "hacking", level: "expert" });
    expect(other).toMatchObject({ program: "", level: "unknown", kind: "enroll" });
    expect(offerName("coaching")).toMatch(/Coaching/);
    expect(offerName("")).toMatch(/conseiller/);
  });

  it("lists, counts and updates requests", async () => {
    const a = await createRequest(valid);
    await createRequest({ ...valid, firstName: "Bintou" });
    const staff = await User.create({ name: "M", surname: "A", username: "boss", email: "boss@example.com", role: "admin" });
    expect(await countNewRequests()).toBe(2);
    await updateRequest(String(a._id), String(staff._id), { status: "contacted", notes: "Appelée" });
    expect(await countNewRequests()).toBe(1);
    expect((await listRequests("contacted")).map((r) => r.notes)).toEqual(["Appelée"]);
    expect(await listRequests()).toHaveLength(2);
    await expect(updateRequest("nope", String(staff._id), { status: "closed" })).rejects.toThrow(/introuvable/);
    expect(await adminEmails()).toEqual(["boss@example.com"]);
    expect(await EnrollmentRequest.countDocuments()).toBe(2);
  });
});
