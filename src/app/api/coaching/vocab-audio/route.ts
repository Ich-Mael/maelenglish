import { readCurrentUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { DictionaryError } from "@/lib/dictionary";
import { CoachingError } from "@/lib/coaching/service";
import { vocabAudio } from "@/lib/coaching/vocabulary";

/*
 * Coaching daily vocabulary read aloud —
 * `/api/coaching/vocab-audio?c=<coachingId>&v=<vocabId>&i=<itemId>&what=text|example|sentence[&s=<sentenceId>]&voice=us|gb[&slow=1]`
 * → redirect to the shared audio (made on first play: Azure, else ElevenLabs). The text always
 * comes from the database (never from the URL). 404 without a voice: the page uses the browser's.
 */
export async function GET(req: Request) {
  const me = await readCurrentUser();
  if (!me) return new Response("Unauthorized", { status: 401 });
  const q = new URL(req.url).searchParams;
  await connectDB();
  try {
    const what = q.get("what") === "example" ? "example" : q.get("what") === "sentence" ? "sentence" : "text";
    const url = await vocabAudio({ id: me.id, role: me.role }, q.get("c") ?? "", q.get("v") ?? "", q.get("i") ?? "", { what, sentenceId: q.get("s") ?? "", voice: q.get("voice") === "gb" ? "gb" : "us", slow: q.get("slow") === "1" });
    if (!url) return new Response("Not found", { status: 404 });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, max-age=900" } });
  } catch (e) {
    if (e instanceof CoachingError) return new Response(e.message, { status: 404 });
    if (!(e instanceof DictionaryError)) console.error("[coaching vocab] audio", e);
    return new Response(e instanceof DictionaryError ? e.message : "Unavailable", { status: e instanceof DictionaryError ? 429 : 503 });
  }
}
