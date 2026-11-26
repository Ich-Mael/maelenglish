/*
 * Countries offered on the public sign-up request form (owner request 2026-11-26): the learners'
 * countries first (francophone West and Central Africa), then a few others, then « Autre pays ».
 * `dial` = the calling code used when the WhatsApp number is typed without it. Pure, shared.
 */
/** `keepZero`: the leading 0 is part of the number there (Côte d'Ivoire, Congo), not a trunk prefix. */
export type Country = { code: string; name: string; dial: string; keepZero?: boolean };

export const COUNTRIES: Country[] = [
  { code: "BF", name: "Burkina Faso", dial: "226" },
  { code: "CI", name: "Côte d'Ivoire", dial: "225", keepZero: true },
  { code: "SN", name: "Sénégal", dial: "221" },
  { code: "ML", name: "Mali", dial: "223" },
  { code: "NE", name: "Niger", dial: "227" },
  { code: "TG", name: "Togo", dial: "228" },
  { code: "BJ", name: "Bénin", dial: "229" },
  { code: "GN", name: "Guinée", dial: "224" },
  { code: "CM", name: "Cameroun", dial: "237" },
  { code: "GA", name: "Gabon", dial: "241" },
  { code: "CG", name: "Congo", dial: "242", keepZero: true },
  { code: "CD", name: "RD Congo", dial: "243" },
  { code: "TD", name: "Tchad", dial: "235" },
  { code: "MR", name: "Mauritanie", dial: "222" },
  { code: "GH", name: "Ghana", dial: "233" },
  { code: "NG", name: "Nigeria", dial: "234" },
  { code: "MA", name: "Maroc", dial: "212" },
  { code: "FR", name: "France", dial: "33" },
  { code: "BE", name: "Belgique", dial: "32" },
  { code: "CA", name: "Canada", dial: "1" },
];
export const OTHER_COUNTRY = "OTHER";

export const countryOf = (code: string | null | undefined) => COUNTRIES.find((c) => c.code === code) ?? null;
/** « Burkina Faso », « Autre pays », or "" when not given. */
export const countryName = (code: string | null | undefined) => (code === OTHER_COUNTRY ? "Autre pays" : (countryOf(code)?.name ?? ""));
