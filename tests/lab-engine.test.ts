import { describe, expect, it } from "vitest";
import { editDistance, matchAnswer, typoAllowed } from "@/lib/lab/match";
import { cleanMeta, starsFor } from "@/lib/lab/meta";
import { checkItem, gradeActivity } from "@/lib/lab/grade";
import { lineAt, parseTranscript, type ListeningContent } from "@/lib/lab/types";
import { reshuffle } from "@/components/lab/shell/shuffle";

describe("Lab engine", () => {
  it("converts scores to stars (≥ 50, ≥ 75, ≥ 90)", () => {
    expect([0, 49, 50, 74, 75, 89, 90, 100].map(starsFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it("cleans the common details", () => {
    expect(cleanMeta({ level: " b1 ", skills: ["listening", "nope", "listening"], theme: "calls", durationMin: "120", instructions: "  Écoutez. ", maelTip: "" })).toEqual({
      level: "B1",
      skills: ["listening"],
      theme: "calls",
      durationMin: 60,
      instructions: "Écoutez.",
      maelTip: "",
    });
    expect(cleanMeta({ level: "Z9", theme: "astrology", durationMin: "abc" })).toMatchObject({ level: "", theme: "", durationMin: 0, skills: [] });
  });

  it("matches typed answers: case, punctuation, contractions, alternatives, one typo when allowed", () => {
    expect(matchAnswer("  Postpone! ", ["postpone", "move"])).toMatchObject({ ok: true, exact: true });
    expect(matchAnswer("move", ["postpone", "move"]).matched).toBe("move");
    expect(matchAnswer("I'm late", ["I am late"]).ok).toBe(true);
    expect(matchAnswer("postpnoe", ["postpone"]).ok).toBe(false);
    expect(matchAnswer("postpnoe", ["postpone"], { typo: true })).toMatchObject({ ok: true, exact: false });
    expect(matchAnswer("postpne", ["postpone"], { typo: true }).ok).toBe(true);
    expect(matchAnswer("potspne", ["postpone"], { typo: true }).ok).toBe(false);
    expect(matchAnswer("on", ["in"], { typo: true }).ok).toBe(false); // short words: no tolerance
    expect(matchAnswer("", ["x"]).ok).toBe(false);
    expect(editDistance("abcd", "abdc")).toBe(1);
    expect([typoAllowed("A2"), typoAllowed("B1"), typoAllowed("B2"), typoAllowed("C1")]).toEqual([true, true, false, false]);
  });

  it("grades listening comprehension from first-try answers", () => {
    const c = { questions: [{ id: "q1", correctOptionId: "b" }, { id: "q2", correctOptionId: "a" }, { id: "q3", correctOptionId: "c" }] } as unknown as ListeningContent;
    expect(checkItem("listen_choose", c, "q1", "b")).toBe(true);
    expect(checkItem("listen_choose", c, "nope", "b")).toBe(false);
    expect(gradeActivity("listen_choose", c, { q1: "b", q2: "c" })).toEqual({
      items: [
        { id: "q1", correct: true },
        { id: "q2", correct: false },
        { id: "q3", correct: false },
      ],
      score: 33,
    });
  });

  it("parses timed transcript lines and finds the line of an answer", () => {
    const lines = parseTranscript("[0:00] Good morning.\n\n[0:03] Flight 512 is now boarding at gate 12.\nPlease have your pass ready.\n[0:09] Thank you.");
    expect(lines).toEqual([
      { startS: 0, text: "Good morning." },
      { startS: 3, text: "Flight 512 is now boarding at gate 12." },
      { startS: null, text: "Please have your pass ready." },
      { startS: 9, text: "Thank you." },
    ]);
    expect(lineAt(lines, 4.2)).toBe(1);
    expect(lineAt(lines, 3)).toBe(1);
    expect(lineAt(lines, 12)).toBe(3);
    expect(lineAt(lines, null)).toBe(-1);
    expect(lineAt(parseTranscript("no times here"), 5)).toBe(-1);
  });
});

describe("reshuffle (« Recommencer »)", () => {
  it("keeps every item and never repeats the order just played", () => {
    const items = ["a", "b", "c"];
    let cur = items;
    for (let n = 0; n < 50; n++) {
      const next = reshuffle(items, cur);
      expect([...next].sort()).toEqual(items);
      expect(next).not.toEqual(cur);
      cur = next;
    }
    expect(reshuffle(["only"])).toEqual(["only"]);
  });
});
