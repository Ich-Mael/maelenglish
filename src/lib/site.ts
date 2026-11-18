import { WHATSAPP_NUMBER } from "./catalog";

/** Site-wide constants for the public pages. */
export const SITE_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
export const SITE_NAME = "MaelEnglish";
export const SLOGAN = "Speak the Language of Your Profession";

export const PHONE_DISPLAY = "+226 67 32 31 31";
export const PHONE_TEL = `+${WHATSAPP_NUMBER}`;

/** Sign-up form, optionally with a programme / offer pre-selected. */
export function signupHref(program?: string): string {
  return program ? `/inscription?programme=${encodeURIComponent(program)}` : "/inscription";
}

export function waLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const COACHING_WA = waLink("Bonjour, je souhaite un coaching MaelEnglish. Mon métier et mon objectif : ");
export const CHALLENGE_WA = waLink("Bonjour, je souhaite rejoindre un MaelEnglish Challenge.");

/** « MaelEnglish for Business » → ["MaelEnglish", "for Business"]. */
export function splitBrand(name: string): [string, string] {
  return ["MaelEnglish", name.replace(/^MaelEnglish\s*/, "")];
}
