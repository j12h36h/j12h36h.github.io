/* E.R.A.S. root service worker — PWA install support. */
const CACHE = 'eras-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/assets/icons/eras-app-192.png', '/assets/icons/eras-app-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('eras-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url); if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(r => r || (event.request.mode === 'navigate' ? caches.match('/index.html') : undefined))));
});
