import { describe, expect, it } from "vitest";
import { isHtml, markdownToHtml, normalizeRich, plainText, sanitizeRich, textToHtml, toEditorHtml } from "@/lib/rich-text";

describe("rich text", () => {
  it("strips scripts, event handlers, dangerous links and media", () => {
    const dirty = `<p onclick="alert(1)">Hi <script>alert(1)</script><img src=x onerror=alert(1)><iframe src="https://evil"></iframe>
      <a href="javascript:alert(1)">bad</a> <a href="https://ok.example" onmouseover="x()">ok</a><style>p{}</style></p>`;
    const clean = sanitizeRich(dirty);
    expect(clean).not.toMatch(/script|onerror|onclick|onmouseover|iframe|<img|javascript:|<style/i);
    expect(clean).toContain('<a href="https://ok.example" target="_blank" rel="noopener noreferrer">ok</a>');
    expect(clean).toContain("<a target=\"_blank\" rel=\"noopener noreferrer\">bad</a>");
  });

  it("keeps the formatting the editor produces", () => {
    const html = "<h2>Titre</h2><p><strong>gras</strong> <em>it</em> <u>s</u></p><ul><li>a</li></ul><blockquote><p>astuce</p></blockquote><table><tbody><tr><td>x</td></tr></tbody></table>";
    expect(sanitizeRich(html)).toBe(html);
    expect(sanitizeRich("<h1>Big</h1><div>block</div>")).toBe("<h2>Big</h2><p>block</p>");
  });

  it("detects HTML vs Markdown and converts older content for the editor", () => {
    expect(isHtml("<p>x</p>")).toBe(true);
    expect(isHtml("## Titre\n\n**gras**")).toBe(false);
    const md = markdownToHtml("## Titre\n\n**gras** <script>x()</script>\n\n- a\n- b");
    expect(md).not.toContain("<script");
    expect(md).toBe("<h2>Titre</h2>\n<p><strong>gras</strong> x()</p>\n<ul>\n<li>a</li>\n<li>b</li>\n</ul>");
    expect(textToHtml("Bonjour <toi>\nligne 2\n\nParagraphe 2")).toBe("<p>Bonjour &lt;toi&gt;<br>ligne 2</p><p>Paragraphe 2</p>");
    expect(toEditorHtml("Bravo\nencore", "text")).toBe("<p>Bravo<br>encore</p>");
    expect(toEditorHtml("")).toBe("");
  });

  it("normalises what is saved", () => {
    expect(normalizeRich("<p>&nbsp;</p>")).toBe("");
    expect(normalizeRich("<p></p>\n<p> </p>")).toBe("");
    expect(normalizeRich("  Texte simple  ")).toBe("Texte simple");
    expect(normalizeRich('<p>ok<script>bad()</script></p>')).toBe("<p>ok</p>");
    expect(sanitizeRich('<p>a</p><p><img src=x onerror="x()"></p><p>&nbsp;</p><p>b</p>')).toBe("<p>a</p><p>b</p>");
    expect(plainText("<p>Salut &amp; <strong>bravo</strong></p>")).toBe("Salut & bravo");
  });
});
