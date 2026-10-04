// SketchForge service worker: installable, offline-capable app shell.
//
// PwaRegistration registers this file as `sw.js?build=<build id>`. Every build
// therefore registers a new worker with its own cache, and activating it
// deletes the caches of earlier builds, so a redeploy never keeps serving
// stale assets.
//
// Strategies (same-origin GET requests only; API routes are never handled):
// - page navigations: network first, falling back to the cached app shell and
//   then to offline.html;
// - /_next/static/ (content-hashed, immutable): cache first;
// - everything else in public/ (icons, OCCT runtime, manifest, ...): stale
//   while revalidate, so a changed file is picked up on the next load.

const BUILD_ID = new URL(self.location.href).searchParams.get("build") || "dev";
const CACHE_PREFIX = "sketchforge-";
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;
const SHELL_URL = new URL("./", self.location.href).href;
const OFFLINE_URL = new URL("./offline.html", self.location.href).href;
const API_PATH = new URL("./api/", self.location.href).pathname;
const STATIC_PATH = new URL("./_next/static/", self.location.href).pathname;

function cacheable(response) {
  return response && response.ok && response.type === "basic";
}

async function putInCache(key, response) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(key, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // Bypass the HTTP cache so a new build never precaches the previous shell.
      .then((cache) => cache.addAll([SHELL_URL, OFFLINE_URL].map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function handleNavigation(event) {
  const { request } = event;
  // The app is a single page; store it once, without the ?editor=&project= query.
  const url = new URL(request.url);
  url.search = "";
  const key = url.href;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (cacheable(response)) {
          event.waitUntil(putInCache(key, response.clone()));
        }
        return response;
      })
      .catch(async () => (await caches.match(key)) ?? (await caches.match(SHELL_URL)) ?? (await caches.match(OFFLINE_URL)) ?? Response.error()),
  );
}

function handleImmutable(event) {
  const { request } = event;
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (cacheable(response)) {
            event.waitUntil(putInCache(request, response.clone()));
          }
          return response;
        }),
    ),
  );
}

function handleStaleWhileRevalidate(event) {
  const { request } = event;
  const network = fetch(request).then((response) => {
    if (cacheable(response)) {
      event.waitUntil(putInCache(request, response.clone()));
    }
    return response;
  });
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Refresh in the background; the next load gets the new copy.
        event.waitUntil(network.catch(() => undefined));
        return cached;
      }
      return network;
    }),
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith(API_PATH) ||
    // Partial (range) responses cannot be cached; let the browser handle them.
    request.headers.has("range")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    handleNavigation(event);
  } else if (url.pathname.startsWith(STATIC_PATH)) {
    handleImmutable(event);
  } else {
    handleStaleWhileRevalidate(event);
  }
});
