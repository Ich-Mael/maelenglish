import { describe, expect, it } from "vitest";
import { enrollmentEmail } from "@/lib/email";

describe("enrolment email", () => {
  const base = { firstName: "Awa", courseTitle: "MaelEnglish Essentials", startDate: "19 novembre 2026", endDate: "30 janvier 2027", courseUrl: "https://example.com/apprendre/1" };

  it("shows the course image, the dates, what the learner will achieve and a button to the course", () => {
    const m = enrollmentEmail({ ...base, imageUrl: "https://example.com/images/photos/meeting-1280.jpg", objectives: ["Tenir une conversation", "Gagner en confiance"] });
    expect(m.subject).toBe("Bienvenue dans MaelEnglish Essentials !");
    expect(m.html).toContain('src="https://example.com/images/photos/meeting-1280.jpg"');
    expect(m.html).toContain("Du 19 novembre 2026 au 30 janvier 2027");
    expect(m.html).toContain("Ce que vous saurez faire");
    expect(m.html).toContain("Tenir une conversation");
    expect(m.html).toContain('href="https://example.com/apprendre/1"');
    expect(m.text).toContain("- Gagner en confiance");
  });

  it("falls back to the course description, works without image or end date, and escapes text", () => {
    const m = enrollmentEmail({ ...base, courseTitle: "Anglais <b>pro</b>", endDate: null, summary: "Réunions & e-mails" });
    expect(m.html).not.toContain("<img src=\"undefined");
    expect(m.html).toContain("À partir du 19 novembre 2026");
    expect(m.html).toContain("Au programme");
    expect(m.html).toContain("Réunions &#38; e-mails");
    expect(m.html).toContain("Anglais &#60;b&#62;pro&#60;/b&#62;");
  });
});
