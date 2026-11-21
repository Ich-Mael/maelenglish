import { describe, expect, it } from "vitest";
import { coachInitialName, coachLabel } from "@/lib/coach-name";

describe("coachLabel", () => {
  it("uses the coach name, adds « Coach » when missing, falls back to the first name", () => {
    expect(coachLabel({ name: "Ismaël", coachName: "Coach Ish" })).toBe("Coach Ish");
    expect(coachLabel({ name: "Ismaël", coachName: "  ish " })).toBe("Coach ish");
    expect(coachLabel({ name: "Ismaël", coachName: "coach  Ish" })).toBe("Coach Ish");
    expect(coachLabel({ name: "Awa", coachName: "" })).toBe("Coach Awa");
    expect(coachLabel({ name: "Coachella" })).toBe("Coach Coachella");
    expect(coachLabel(null)).toBe("Votre coach");
    expect(coachInitialName("Coach Ish")).toBe("Ish");
  });
});
