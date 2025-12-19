// Minimal service worker for PWA installability
// Offline caching and push notifications intentionally omitted for MVP

const CACHE_NAME = 'loba-tracker-v2';

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed v2');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated v2');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - no offline caching for MVP
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests entirely (let browser handle them)
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip Supabase API requests - let them go directly to network
  if (url.hostname.includes('supabase')) {
    return;
  }
  
  // Skip API requests
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/rest/')) {
    return;
  }
  
  // For all other GET requests, pass through to network
  // Only use respondWith for static assets we want to potentially cache
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Return nothing on failure - will show network error
        return new Response('Offline', { status: 503 });
      })
    );
  }
  // For HTML and other requests, don't intercept - let browser handle directly
});
