import { describe, expect, it } from "vitest";
import { canManageAccount } from "@/lib/admin/users";

describe("who may act on an account (reset links, devices, deactivation, edits)", () => {
  it("admins: everyone; account managers: only learners and English coaches", () => {
    const admin = { role: "admin" }, manager = { role: "account-manager" }, coach = { role: "english-coach" };
    expect(["user", "english-coach", "instructor", "account-manager", "admin", "super-admin"].map((role) => canManageAccount(admin, { role }))).toEqual([true, true, true, true, true, true]);
    expect(["user", "english-coach", "instructor", "account-manager", "admin", "super-admin"].map((role) => canManageAccount(manager, { role }))).toEqual([true, true, false, false, false, false]);
    expect(canManageAccount(coach, { role: "user" })).toBe(false);
  });
});
