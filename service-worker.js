/*
 * Простой сервис‑воркер для кэширования статических ресурсов и работы оффлайн.
 * Кеширует основные файлы приложения при установке и отдает их из кеша при
 * запросах, что позволяет работать без подключения к сети.
 */

const CACHE_NAME = 'my-helth-cache-v1';
const ASSETS = [
  '/',
  './',
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', event => {
  // Очистка старых кешей
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    })
  );
});