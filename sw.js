/*
  オフライン用の仕組み（サービスワーカー）
  ------------------------------------------------------------
  一度ページを開くと、ページ一式を端末の中にしまっておきます。
  圏外や機内モードでも、しまっておいたものを出して表示します。

  - ページ（html）… ネットにつながるときは最新を取りに行き、しまい直す。
                     つながらない・3秒待っても返事がないときは、しまっておいたものを使う。
  - 書体（Google Fonts）… 一度読んだ分をしまっておき、次からはそれを使う。
  ページを直したら、下の VERSION を1つ上げると、古いしまい物が片付きます。
*/
const VERSION = 'v7';
const PAGES = 'oto-pages-' + VERSION;
const FONTS = 'oto-fonts-' + VERSION;
const CORE = [
  './',
  './index.html',
  './okuru.html',
  './e.html',
  './file.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // 同じ yannsi.github.io にある他の作品の保存は消さない（自分の古い版だけ消す）
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('oto-') && k !== PAGES && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ネットを先に試し、だめならしまっておいたもの
async function networkFirst(req) {
  const cache = await caches.open(PAGES);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, ng) => setTimeout(() => ng(new Error('timeout')), 3000)),
    ]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (_) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return (await cache.match('./okuru.html')) || Response.error();
    return Response.error();
  }
}

// しまっておいたものを先に使い、なければネット
async function cacheFirst(req) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch (_) {
    return Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) { e.respondWith(networkFirst(req)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req));
  }
});
