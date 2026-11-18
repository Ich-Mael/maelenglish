import { describe, expect, it } from "vitest";
import { displayPhone, looksLikePhone, normalizePhone } from "@/lib/phone";

describe("phone", () => {
  it("normalises local and international numbers", () => {
    expect(normalizePhone("+226 70 12 34 56")).toBe("22670123456");
    expect(normalizePhone("0022670123456")).toBe("22670123456");
    expect(normalizePhone("70 12 34 56")).toBe("22670123456");
    expect(normalizePhone("070123456")).toBe("22670123456");
    expect(normalizePhone("+33 6 12 34 56 78")).toBe("33612345678");
  });

  it("rejects things that are not phone numbers", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("+12")).toBeNull();
    expect(normalizePhone("+1234567890123456")).toBeNull();
  });

  it("formats for display and detects phone-like identifiers", () => {
    expect(displayPhone("22670123456")).toBe("+226 70 12 34 56");
    expect(displayPhone("33612345678")).toBe("+33612345678");
    expect(looksLikePhone("+226 70 12 34 56")).toBe(true);
    expect(looksLikePhone("ismael")).toBe(false);
    expect(looksLikePhone("a@b.co")).toBe(false);
  });
});
