import { readCurrentUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { DictionaryError, wordAudio, type AudioVoice } from "@/lib/dictionary";

/*
 * Dictionary pronunciation: `/api/dictionary/audio?word=delay&voice=us|gb[&slow=1][&what=example]`
 * → redirect to the stored neural-voice audio (generated on first play). 404 when no voice is
 * configured: the card falls back on the dictionary recording / the browser's voice.
 */
export async function GET(req: Request) {
  const me = await readCurrentUser();
  if (!me) return new Response("Unauthorized", { status: 401 });
  const q = new URL(req.url).searchParams;
  await connectDB();
  try {
    const url = await wordAudio(me.id, q.get("word") ?? "", {
      voice: (q.get("voice") === "gb" ? "gb" : "us") as AudioVoice,
      slow: q.get("slow") === "1",
      what: q.get("what") === "example" ? "example" : "word",
    });
    if (!url) return new Response("Not found", { status: 404 });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, max-age=900" } });
  } catch (e) {
    if (!(e instanceof DictionaryError)) console.error("[dictionary] audio", e);
    return new Response(e instanceof DictionaryError ? e.message : "Unavailable", { status: e instanceof DictionaryError ? 429 : 503 });
  }
}
