/** Does the stored text look like HTML (from the rich editor) rather than Markdown / plain text? */
export function isHtml(text: string | null | undefined): boolean {
  return /^\s*<(p|h[1-6]|ul|ol|li|div|blockquote|table|pre|strong|em|b|i|u|s|a|br|hr|span|figure)\b/i.test(text ?? "");
}
