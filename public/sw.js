// Service Worker for PWA
const CACHE_NAME = "violin-fingering-v1";
const urlsToCache = [
  "/",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll 대신 개별적으로 추가하여 일부 실패해도 계속 진행
      return Promise.allSettled(
        urlsToCache.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`Failed to cache ${url}:`, err);
            return null;
          })
        )
      );
    })
  );
  // 설치 즉시 활성화
  self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  // GET 요청만 캐싱
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      
      // 네트워크 요청 시도
      return fetch(event.request).catch(() => {
        // 네트워크 실패 시 기본 응답 반환 (오프라인 지원)
        if (event.request.destination === "document") {
          return caches.match("/");
        }
        return new Response("Offline", { status: 503 });
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
});
