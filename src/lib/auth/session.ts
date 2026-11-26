import "server-only";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { connectDB } from "@/lib/db";
import { baseCookie, DEVICE_COOKIE, DEVICE_MAX_AGE, SESSION_COOKIE } from "./cookies";
import { createSession, deleteSession, type SessionMeta } from "./service";

/* Cookie side of sessions — only callable from Server Actions / Route Handlers (cookies are written). */

/**
 * The visitor's IP. Render serves through Cloudflare, which sets CF-Connecting-IP / True-Client-IP
 * itself (a browser can't fake them), while the first X-Forwarded-For entry is whatever the client
 * sent — never trust it first (rate limits per IP could be bypassed).
 */
function ipOf(h: Headers): string {
  const first = (v: string | null) => (v ?? "").split(",")[0].trim();
  return first(h.get("cf-connecting-ip")) || first(h.get("true-client-ip")) || first(h.get("x-real-ip")) || first(h.get("x-forwarded-for"));
}

export async function requestMeta(): Promise<SessionMeta> {
  const h = await headers();
  const ip = ipOf(h);
  const jar = await cookies();
  let deviceId = jar.get(DEVICE_COOKIE)?.value;
  if (!deviceId) {
    deviceId = randomUUID();
    jar.set(DEVICE_COOKIE, deviceId, { ...baseCookie, maxAge: DEVICE_MAX_AGE });
  }
  return { deviceId, userAgent: h.get("user-agent") ?? "", ipAddress: ip };
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return ipOf(h) || "unknown";
}

export async function startSession(userId: SessionUserId) {
  await connectDB();
  const { token, expiresAt } = await createSession(userId, await requestMeta());
  (await cookies()).set(SESSION_COOKIE, token, { ...baseCookie, expires: expiresAt });
}

export async function endSession() {
  const jar = await cookies();
  await connectDB();
  await deleteSession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
}

type SessionUserId = Parameters<typeof createSession>[0];
