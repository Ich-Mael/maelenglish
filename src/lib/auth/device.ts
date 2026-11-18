/** Rough device description from a User-Agent (shown to the learner and admins, never used for security). */
export type DeviceInfo = {
  deviceType: "mobile" | "tablet" | "desktop";
  os: string;
  browser: string;
};

export function describeUserAgent(ua: string): DeviceInfo {
  const s = ua || "";
  const tablet = /iPad|Tablet|(Android(?!.*Mobile))/i.test(s);
  const mobile = !tablet && /Mobi|iPhone|iPod|Android/i.test(s);

  let os = "Inconnu";
  if (/Android/i.test(s)) os = `Android ${s.match(/Android ([\d.]+)/i)?.[1] ?? ""}`.trim();
  else if (/iPhone|iPad|iPod/i.test(s)) os = `iOS ${(s.match(/OS ([\d_]+)/)?.[1] ?? "").replace(/_/g, ".")}`.trim();
  else if (/Windows/i.test(s)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(s)) os = "macOS";
  else if (/CrOS/i.test(s)) os = "ChromeOS";
  else if (/Linux/i.test(s)) os = "Linux";

  let browser = "Navigateur";
  if (/EdgA?\//.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/SamsungBrowser/.test(s)) browser = "Samsung Internet";
  else if (/Firefox|FxiOS/.test(s)) browser = "Firefox";
  else if (/Chrome|CriOS/.test(s)) browser = "Chrome";
  else if (/Safari/.test(s)) browser = "Safari";

  return { deviceType: tablet ? "tablet" : mobile ? "mobile" : "desktop", os, browser };
}
