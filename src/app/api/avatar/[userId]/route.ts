import { readCurrentUser } from "@/lib/auth/dal";
import { avatarKey } from "@/lib/avatar";
import { signedReadUrl } from "@/lib/storage";

/*
 * Profile photo: redirects signed-in users to a short-lived signed storage URL. Pages link
 * `/api/avatar/<id>?v=<mediaId>`, so the browser keeps the redirect for a while and a new photo
 * gets a new URL.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const me = await readCurrentUser();
  if (!me) return new Response("Unauthorized", { status: 401 });
  const key = await avatarKey((await ctx.params).userId);
  if (!key) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, max-age=60" } });
  return new Response(null, { status: 302, headers: { Location: await signedReadUrl(key), "Cache-Control": "private, max-age=900" } });
}
