import "server-only";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { connectDB } from "@/lib/db";
import { baseCookie, DEVICE_COOKIE, DEVICE_MAX_AGE, SESSION_COOKIE } from "./cookies";
import { createSession, deleteSession, type SessionMeta } from "./service";

/* Cookie side of sessions — only callable from Server Actions / Route Handlers (cookies are written). */

export async function requestMeta(): Promise<SessionMeta> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
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
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
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
