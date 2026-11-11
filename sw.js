/* Salama! offline cache. Network-first for all assets so fresh audio and phonetics always win when online. */
const CACHE = 'salama-v4.4.8';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data/content.js',
  './js/core.js',
  './js/speech.js',
  './js/ui.js',
  './js/views/today.js',
  './js/views/course.js',
  './js/views/session.js',
  './js/views/review.js',
  './js/views/quiz.js',
  './js/views/words.js',
  './js/views/library.js',
  './js/views/edit.js',
  './js/views/progress.js',
  './js/views/settings.js',
  './js/views/record.js',
  './manifest.webmanifest',
  './media/icon.svg',
  './media/icon-192.png',
  './media/icon-512.png',
  './img/baobab-avenue.jpg',
  './img/baobab-portrait.jpg',
  './img/baobab-sunset.jpg',
  './img/highlands.jpg',
  './img/rice-terraces.jpg',
  './img/tana-1.jpg',
  './img/tana-2.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for all files (HTML, JS, CSS, data, and audio) so updated clips and phonetics are never masked by stale cache.
  event.respondWith(
    fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  );
});
