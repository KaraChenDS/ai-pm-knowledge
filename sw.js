/* AI 产品经理知识体系 · Service Worker
   策略：network-first（保证拿到最新版），失败时回退缓存（断网 / 弱网可用）
   只缓存同源的静态资源，不碰 GitHub API 的同步请求。 */
const CACHE = "ai-pm-kb-v9";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 跨域（GitHub API 等）一律直连，不缓存
  if (url.origin !== self.location.origin) return;

  // HTML 导航必须绕开 HTTP 缓存：GitHub Pages 给 HTML 设了 max-age=600，
  // 否则推送新版本后最长 10 分钟仍可能拿到旧页面。
  const isHTML = req.mode === "navigate" ||
                 (req.headers.get("accept") || "").includes("text/html");

  e.respondWith(
    fetch(req, isHTML ? { cache: "no-store" } : undefined)
      .then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => hit || caches.match("./index.html"))
      )
  );
});
