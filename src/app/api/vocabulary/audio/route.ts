import { readCurrentUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { DictionaryError } from "@/lib/dictionary";
import { dailyExampleAudio } from "@/lib/vocabulary";

/*
 * « My daily vocabulary »: an example sentence read aloud —
 * `/api/vocabulary/audio?word=shift&i=0&voice=us|gb[&slow=1]` → redirect to the shared audio
 * (made on first play: Azure, else ElevenLabs). 404 without a voice: the page uses the browser's.
 */
export async function GET(req: Request) {
  const me = await readCurrentUser();
  if (!me) return new Response("Unauthorized", { status: 401 });
  const q = new URL(req.url).searchParams;
  await connectDB();
  try {
    const url = await dailyExampleAudio(me.id, q.get("word") ?? "", Number(q.get("i") ?? "0"), { voice: q.get("voice") === "gb" ? "gb" : "us", slow: q.get("slow") === "1" });
    if (!url) return new Response("Not found", { status: 404 });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, max-age=900" } });
  } catch (e) {
    if (!(e instanceof DictionaryError)) console.error("[vocabulary] audio", e);
    return new Response(e instanceof DictionaryError ? e.message : "Unavailable", { status: e instanceof DictionaryError ? 429 : 503 });
  }
}
