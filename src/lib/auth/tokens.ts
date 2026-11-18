import { createHash, randomBytes } from "node:crypto";

/** Random URL-safe token (256 bits) and its sha256 — only the hash is stored. */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
