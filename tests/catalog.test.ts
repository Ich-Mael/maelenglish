import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROGRAMS, PROGRAM_SLUGS, findProgram, formatFor, programPhoto, whatsappLink } from "@/lib/catalog";

describe("catalog", () => {
  it("has unique slugs, Essentials first and featured", () => {
    expect(new Set(PROGRAM_SLUGS).size).toBe(PROGRAMS.length);
    expect(PROGRAMS[0].slug).toBe("essentials");
    expect(PROGRAMS[0].featured).toBe(true);
  });

  it("references photos that exist in public/", () => {
    for (const p of PROGRAMS) {
      for (const path of Object.values(programPhoto(p))) {
        expect(existsSync(join(process.cwd(), "public", path)), path).toBe(true);
      }
    }
  });

  it("finds programmes by slug", () => {
    expect(findProgram("business")?.name).toBe("MaelEnglish for Business");
    expect(findProgram("nope")).toBeNull();
    expect(findProgram("")).toBeNull();
  });

  it("puts the programme duration first in its format", () => {
    expect(formatFor(findProgram("essentials")!)[0].label).toBe("8 semaines par niveau");
    expect(formatFor(findProgram("tech")!)[0].label).toBe("12 semaines");
  });

  it("builds WhatsApp links naming the programme", () => {
    const link = whatsappLink(findProgram("health"));
    expect(link.startsWith("https://wa.me/22653344444?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("m'inscrire à MaelEnglish for Health");
    expect(decodeURIComponent(whatsappLink({ ...findProgram("health")!, status: "soon" }))).toContain("être prévenu(e)");
    expect(decodeURIComponent(whatsappLink())).toContain("informations");
  });
});

describe("shortProgramName", () => {
  it("drops the brand (and « for ») for cards and lists", async () => {
    const { shortProgramName, findProgram } = await import("@/lib/catalog");
    expect(shortProgramName(findProgram("aviation")!)).toBe("Aviation");
    expect(shortProgramName(findProgram("civil-engineering")!)).toBe("Civil Engineering");
    expect(shortProgramName(findProgram("essentials")!)).toBe("MaelEnglish Essentials");
  });
});
