import { readLocal, storageDriver, verifyLocalSignature, writeLocal } from "@/lib/storage";
import { mimeForKey } from "@/lib/media-rules";

/*
 * Local storage driver endpoint (development only — storageDriver() refuses « local » in
 * production). URLs are HMAC-signed and expire (src/lib/storage.ts). GET supports Range
 * requests: Safari needs them to play audio.
 */

const MAX = 60 * 1024 * 1024;

function params(req: Request) {
  const u = new URL(req.url);
  return { op: u.searchParams.get("op"), key: u.searchParams.get("key") ?? "", exp: Number(u.searchParams.get("exp")), sig: u.searchParams.get("sig") ?? "" };
}

export async function PUT(req: Request) {
  if (storageDriver() !== "local") return new Response("Not found", { status: 404 });
  const p = params(req);
  if (p.op !== "put" || !verifyLocalSignature("put", p.key, p.exp, p.sig)) return new Response("Forbidden", { status: 403 });
  const data = new Uint8Array(await req.arrayBuffer());
  if (data.byteLength > MAX) return new Response("Too large", { status: 413 });
  await writeLocal(p.key, data);
  return new Response(null, { status: 200 });
}

export async function GET(req: Request) {
  if (storageDriver() !== "local") return new Response("Not found", { status: 404 });
  const p = params(req);
  if (p.op !== "get" || !verifyLocalSignature("get", p.key, p.exp, p.sig)) return new Response("Forbidden", { status: 403 });
  let file: Buffer;
  try {
    file = await readLocal(p.key);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const type = mimeForKey(p.key);
  const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=600" };
  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), file.length - 1) : file.length - 1;
    if (start > end || start >= file.length) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.length}` } });
    return new Response(new Uint8Array(file.subarray(start, end + 1)), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${file.length}`, "Content-Length": String(end - start + 1) } });
  }
  return new Response(new Uint8Array(file), { headers: { ...headers, "Content-Length": String(file.length) } });
}
