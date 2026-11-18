/** Cookie names and options, shared by the server code and the proxy (no server-only imports here). */
export const SESSION_COOKIE = "me_session";
export const DEVICE_COOKIE = "me_device";

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // seconds, mirrors SESSION_TTL_MS
export const DEVICE_MAX_AGE = 5 * 365 * 24 * 60 * 60;

export const baseCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/** Only same-site relative paths are accepted as post-login destinations (no open redirect). */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
