/** Turns a video link into an embeddable source. YouTube uses the privacy-enhanced domain. */
export type VideoSource = { kind: "iframe"; src: string } | { kind: "file"; src: string } | null;

export function videoSource(url: string | null | undefined): VideoSource {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const yt = (id: string | null | undefined) => (id && /^[\w-]{6,20}$/.test(id) ? { kind: "iframe" as const, src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` } : null);
  if (host === "youtu.be") return yt(u.pathname.slice(1));
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") return yt(u.searchParams.get("v"));
    const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]+)/);
    return yt(m?.[2]);
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.match(/(\d{6,})/)?.[1];
    return id ? { kind: "iframe", src: `https://player.vimeo.com/video/${id}` } : null;
  }
  if (/\.(mp4|webm|ogg|m3u8)$/i.test(u.pathname)) return { kind: "file", src: u.toString() };
  return null;
}
