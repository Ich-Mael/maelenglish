import { describe, expect, it } from "vitest";
import { PROGRAMS } from "@/lib/catalog";
import { quizItems } from "@/lib/content";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

describe("home quiz", () => {
  it("has one item per programme, 3 distinct options, the right answer in place", () => {
    const items = quizItems();
    expect(items).toHaveLength(PROGRAMS.length);
    items.forEach((it, i) => {
      const p = PROGRAMS[i];
      const phrase = p.phrases.find((ph) => ph.en === it.en)!;
      expect(phrase).toBeTruthy();
      expect(it.options).toHaveLength(3);
      expect(new Set(it.options).size).toBe(3);
      expect(it.options[it.answer]).toBe(phrase.fr);
      expect(it.label).not.toMatch(/MaelEnglish|^for /);
    });
    // The answer is not always in the same position.
    expect(new Set(items.map((it) => it.answer)).size).toBeGreaterThan(1);
  });
});

describe("SEO files", () => {
  it("lists every programme page in the sitemap", () => {
    const urls = sitemap().map((e) => e.url);
    for (const p of PROGRAMS) expect(urls.some((u) => u.endsWith(`/programmes/${p.slug}`))).toBe(true);
    expect(urls.some((u) => u.endsWith("/coaching"))).toBe(true);
  });

  it("keeps private areas out of robots", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.disallow).toEqual(expect.arrayContaining(["/compte", "/admin", "/activer/", "/reinitialiser/"]));
  });
});
