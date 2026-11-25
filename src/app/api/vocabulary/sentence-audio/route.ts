import { readCurrentUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { DictionaryError } from "@/lib/dictionary";
import { ownSentenceAudio } from "@/lib/vocabulary";

/*
 * « My own sentences » read aloud (shadowing practice) —
 * `/api/vocabulary/sentence-audio?word=shift&id=<sentenceId>&voice=us|gb[&slow=1]` → redirect to the
 * shared audio (made on first play). Only the learner's own sentences; the text comes from the
 * database. 404 without a voice: the page uses the browser's.
 */
export async function GET(req: Request) {
  const me = await readCurrentUser();
  if (!me) return new Response("Unauthorized", { status: 401 });
  const q = new URL(req.url).searchParams;
  await connectDB();
  try {
    const url = await ownSentenceAudio(me.id, q.get("word") ?? "", q.get("id") ?? "", { voice: q.get("voice") === "gb" ? "gb" : "us", slow: q.get("slow") === "1" });
    if (!url) return new Response("Not found", { status: 404 });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, max-age=900" } });
  } catch (e) {
    if (!(e instanceof DictionaryError)) console.error("[vocabulary] sentence audio", e);
    return new Response(e instanceof DictionaryError ? e.message : "Unavailable", { status: e instanceof DictionaryError ? 429 : 503 });
  }
}
