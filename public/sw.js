/*
 * MaelEnglish service worker.
 * - static assets (/_next/static, /images, /icons): cache-first (file names are hashed / stable);
 * - page navigations: network-first, the last good copy of learner and public pages is kept,
 *   so lessons already opened (or downloaded with « Disponible hors ligne ») work offline;
 * - offline fallback page /offline.html (plain HTML);
 * - never caches POST (server actions), admin, auth or account pages.
 * Bump VERSION to invalidate the caches.
 */
const VERSION = "v3";
const STATIC = `me-static-${VERSION}`;
const PAGES = `me-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html"; // self-contained (no Next.js scripts), always renders
const NO_CACHE = /^\/(admin|api|compte|connexion|activer|reinitialiser|installation|mot-de-passe-oublie)(\/|$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC);
      await cache.addAll([OFFLINE_URL, "/images/maelenglish-logo.png", "/icons/icon-192.png", "/icons/icon-512.png"]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith("me-") && key !== STATIC && key !== PAGES) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

const isStatic = (url) => url.pathname.startsWith("/_next/static/") || /^\/(images|icons)\//.test(url.pathname) || url.pathname === "/icon.png" || url.pathname === OFFLINE_URL;

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

/** Page cache key ignores PWA tracking params so /mes-cours and /mes-cours?source=pwa share a copy. */
function pageKey(url) {
  const u = new URL(url);
  u.searchParams.delete("source");
  u.hash = "";
  return u.toString();
}

async function networkFirstPage(request) {
  const url = new URL(request.url);
  const cacheable = !NO_CACHE.test(url.pathname);
  try {
    const res = await fetch(request);
    if (cacheable && res.ok && res.type === "basic" && !res.redirected) {
      const cache = await caches.open(PAGES);
      cache.put(pageKey(request.url), res.clone());
    }
    return res;
  } catch {
    if (cacheable) {
      const hit = await (await caches.open(PAGES)).match(pageKey(request.url));
      if (hit) return hit;
    }
    return (await caches.match(OFFLINE_URL)) ?? new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isStatic(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate") event.respondWith(networkFirstPage(request));
});

/** Download pages (and the scripts / styles they need) for offline use. */
async function downloadPages(urls, port) {
  const pages = await caches.open(PAGES);
  const assets = await caches.open(STATIC);
  let done = 0;
  for (const path of urls) {
    try {
      const res = await fetch(path, { credentials: "same-origin", headers: { "X-ME-Offline": "1" } });
      if (res.ok && !res.redirected) {
        const html = await res.clone().text();
        await pages.put(pageKey(new URL(path, self.location.origin).toString()), res);
        const found = new Set();
        for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) found.add(m[1]);
        await Promise.all(
          [...found].map(async (a) => {
            if (await assets.match(a)) return;
            const r = await fetch(a);
            if (r.ok) await assets.put(a, r);
          }),
        );
      }
    } catch {
      /* keep going: one failed page shouldn't stop the download */
    }
    done++;
    port?.postMessage({ type: "progress", done, total: urls.length });
  }
  port?.postMessage({ type: "done", done, total: urls.length });
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "download" && Array.isArray(data.urls)) event.waitUntil(downloadPages(data.urls, event.ports[0]));
  if (data.type === "clear") event.waitUntil(caches.delete(PAGES));
});
