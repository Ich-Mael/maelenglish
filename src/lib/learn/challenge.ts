/*
 * Speaking challenge sends (shared by browser and server, no imports): a learner may send a unit's
 * challenge 3 times; each time a coach returns it (« À reprendre ») after the limit is reached,
 * one more send is granted, so a learner is never stuck on a returned challenge.
 */

export const MAX_CHALLENGE_SENDS = 3;

type Sends = { attempts?: number | null; extraAttempts?: number | null; mediaId?: unknown } | null | undefined;

/** Sends used (submissions made before the counter existed count as one). */
export const sendsUsed = (s: Sends) => (s ? (s.attempts ?? (s.mediaId ? 1 : 0)) : 0);
export const sendsAllowed = (s: Sends) => MAX_CHALLENGE_SENDS + (s?.extraAttempts ?? 0);
export const sendsLeft = (s: Sends) => Math.max(0, sendsAllowed(s) - sendsUsed(s));
