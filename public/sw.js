/* eslint-disable no-undef */
/**
 * दिशाAI service worker.
 *
 * A flood is exactly when a mobile network degrades: cells lose power, everyone
 * in the area is calling at once, and the person who most needs to know whether
 * a road is passable is standing in the rain watching a blank page load. So the
 * app shell and the last set of predictions are kept on the device, and the
 * interface is required to say plainly when it is showing something remembered
 * rather than something current.
 *
 * Deliberately hand-written rather than generated. It is ~120 lines, it is the
 * only thing standing between a user and a white screen, and it needs to be
 * readable by whoever debugs it at 3am during a monsoon.
 */

const VERSION = "disha-v1";
const SHELL = `${VERSION}-shell`;
const DATA = `${VERSION}-data`;

/**
 * Never cached, under any circumstances.
 *
 * The operations dashboard is access-gated in middleware. A cached copy would
 * be readable offline with no gate in front of it, which would turn a
 * restricted view into a public one for anyone who ever held the code — so the
 * whole `/gov` tree and its API are excluded before any other rule runs.
 */
function isForbidden(url) {
  return url.pathname === "/gov" || url.pathname.startsWith("/gov/") || url.pathname.startsWith("/api/gov");
}

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icon") ||
  url.pathname === "/apple-icon.png" ||
  url.pathname === "/manifest.webmanifest";

const isData = (url) =>
  url.pathname.startsWith("/api/") || url.pathname.startsWith("/data/");

self.addEventListener("install", (event) => {
  // Only the two entry points are pre-warmed. Everything else arrives through
  // runtime caching, because Next's chunk names are content-hashed per build
  // and a hard-coded precache list goes stale the moment anything ships.
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(["/", "/app"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isForbidden(url)) return; // straight to the network, never stored

  if (isStatic(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isData(url)) {
    event.respondWith(networkFirst(request, DATA));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigation(request));
  }
});

/** Build output is content-hashed, so a hit is always correct. */
async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(SHELL);
    cache.put(request, response.clone());
  }
  return response;
}

/**
 * Fresh if we can reach the network, remembered if we cannot.
 *
 * The stored copy is stamped with the time it arrived so the app can tell the
 * difference — showing yesterday's flood map as though it were live would be
 * worse than showing nothing.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      const stamped = new Response(response.clone().body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers),
      });
      stamped.headers.set("x-disha-cached-at", new Date().toISOString());
      cache.put(request, stamped);
    }
    return response;
  } catch (error) {
    const hit = await caches.match(request);
    if (hit) return hit;
    throw error;
  }
}

async function navigation(request) {
  try {
    return await fetch(request);
  } catch (error) {
    // The exact page, then the app, then whatever shell we have. Anything is
    // better than the browser's offline dinosaur when there is water outside.
    const exact = await caches.match(request);
    if (exact) return exact;
    const app = await caches.match("/app");
    if (app) return app;
    const root = await caches.match("/");
    if (root) return root;
    throw error;
  }
}
