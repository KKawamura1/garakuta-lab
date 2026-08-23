const CACHE = "garakuta-lab-v42";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest", "./icons/icon-180.png", "./icons/icon-512.png"];
const SCOPE = new URL("./", self.location).pathname;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

// ルート直下の本編だけがindex.htmlへ退避してよい。
// 別ディレクトリのページまでindex.htmlを返すと、相対パスのCSS/JSだけが404になり、
// 「動いていないのに動いているように見える」壊れ方をする。
function isRootDocument(url) {
  return url.pathname === SCOPE || url.pathname === `${SCOPE}index.html`;
}

function unavailable(url) {
  return new Response(
    `オフラインのため ${url.pathname} を表示できません。このページはキャッシュされていません。`,
    { status: 504, headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}

function fallback(request, url) {
  return caches.match(request).then(cached => {
    if (cached) return cached;
    if (isRootDocument(url)) return caches.match("./index.html").then(root => root || unavailable(url));
    return unavailable(url);
  });
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const store = response => {
    if (!response.ok) return response;
    const copy = response.clone();
    event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    return response;
  };

  const freshFirst = event.request.mode === "navigate" || /\.(?:html|js|mjs|css)$/.test(url.pathname);
  if (freshFirst) {
    event.respondWith(fetch(event.request).then(store).catch(() => fallback(event.request, url)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached
    || fetch(event.request).then(store).catch(() => fallback(event.request, url))));
});
