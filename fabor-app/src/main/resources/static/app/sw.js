// Caches the app shell only. API responses are never cached: balances and loan data must always be live.
const SHELL = 'fabor-app-shell-v1';
const FILES = ['/app/index.html', '/app/app.css', '/app/app.js', '/app/icon.svg', '/app/manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SHELL).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !FILES.includes(url.pathname)) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));   // network first, shell as the offline fallback
});
