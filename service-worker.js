const CACHE_NAME = 'nexus-ai-assistant-v1';
// These are the minimal files required to start the app.
// Other assets will be cached on-the-fly by the fetch handler.
const urlsToCache = [
  '/',
  '/index.html',
];

// Install event: cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event: serve cached content when offline, but let API calls through
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Do not cache API calls to Google GenAI to ensure fresh responses
  if (request.url.includes('generativelanguage.googleapis.com')) {
    event.respondWith(fetch(request));
    return;
  }
  
  // For all other requests, use a cache-first strategy.
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Not in cache - fetch from network, then cache it for next time
        return fetch(request).then(
          (response) => {
            // Check if we received a valid response. Don't cache errors.
            if (!response || response.status !== 200) {
              return response;
            }
            // Also, don't cache opaque responses (from no-cors requests to third-party CDNs)
            // as we can't check their validity. Let them be fetched every time, 
            // but they will often be in the browser's HTTP cache anyway.
            if(response.type === 'opaque') {
                return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
