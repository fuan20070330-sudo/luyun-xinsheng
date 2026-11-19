'use strict';
const CACHE_NAME = 'luyun-xinsheng-v3.8.0';
const ASSETS = [
  './',
  './index.html',
  './proof.html',
  './manifest.webmanifest',
  './assets/favicon.svg',
  './css/styles.css',
  './js/config.js',
  './js/api-client.js',
  './js/data.js',
  './js/gateway-client.js',
  './js/renderer.js',
  './js/app.js',
  './shared/engine.js',
  './shared/quality.js',
  './shared/memory-graph.js',
  './shared/culture-dna.js',
  './shared/evidence-gaps.js',
  './shared/content-passport.js',
  './shared/proof-engine.js',
  './shared/claim-analyzer.js',
  './shared/draft-reviser.js',
  './shared/evidence-gate.js',
  './shared/platform-checker.js',
  './shared/ad-copy-craft.js',
  './shared/generator.js'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!/^https?:/.test(event.request.url)) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response && response.ok && new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    if (event.request.mode === 'navigate') return caches.match('./index.html');
    return new Response('', { status: 503, statusText: 'Offline asset unavailable' });
  }));
});
