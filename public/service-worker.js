const CACHE_NAME = 'sb2-cache-v3';
const OFFLINE_URL = '/offline';

// File essenziali da cachare
const STATIC_FILES = [
  '/',
  '/offline',
  '/css/styles.css',
  '/css/toggle.css',
  '/js/scripts.js',
  '/manifest.json',
  '/images/visibility.svg',
  '/images/visibility_off.svg'
];

// Installazione - cache solo i file essenziali
self.addEventListener('install', event => {
  console.log('[SW] Installing Service Worker v3');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching essential files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] All essential files cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Error during caching:', error);
      })
  );
});

// Attivazione - pulisci cache vecchie
self.addEventListener('activate', event => {
  console.log('[SW] Activating Service Worker v3');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Removing old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated and controlling all tabs');
        return self.clients.claim();
      })
  );
});

// Strategia intelligente di caching
self.addEventListener('fetch', event => {
  const { request } = event;
  
  // Ignora richieste non HTTP/HTTPS e richieste POST/PUT/DELETE
  if (!request.url.startsWith('http') || request.method !== 'GET') {
    return;
  }
  
  // Cache-first per risorse statiche
  if (isStaticResource(request.url)) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            console.log('[SW] Static resource served from cache:', request.url);
            return response;
          }
          return fetch(request)
            .then(fetchResponse => {
              if (fetchResponse.status === 200) {
                const responseToCache = fetchResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(request, responseToCache))
                  .catch(error => console.log('[SW] Cache put error:', error));
              }
              return fetchResponse;
            });
        })
        .catch(error => {
          console.error('[SW] Error serving static resource:', error);
          return new Response('Resource not available offline', { status: 503 });
        })
    );
  }
  // Network-first per pagine dinamiche
  else {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Se la risposta è OK e è una pagina HTML, memorizzala in cache
          if (response.status === 200 && isHTMLRequest(request)) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, responseClone))
              .catch(error => console.log('[SW] Cache put error:', error));
          }
          return response;
        })
        .catch(() => {
          // Se la rete non è disponibile, prova dalla cache
          return caches.match(request)
            .then(response => {
              if (response) {
                console.log('[SW] Page served from cache (offline):', request.url);
                return response;
              }
              // Se è una richiesta HTML e non è in cache, mostra la pagina offline
              if (isHTMLRequest(request)) {
                console.log('[SW] Serving offline page for:', request.url);
                return caches.match(OFFLINE_URL);
              }
              // Per altre risorse, restituisci un errore 503
              throw new Error('Resource not available offline');
            })
            .catch(error => {
              console.error('[SW] Error serving offline content:', error);
              return new Response('Service Unavailable', { status: 503 });
            });
        })
    );
  }
});

// Funzioni helper
function isStaticResource(url) {
  return url.includes('/css/') || 
         url.includes('/js/') || 
         url.includes('/images/') || 
         url.includes('/manifest.json') ||
         url.endsWith('.svg') ||
         url.endsWith('.png') ||
         url.endsWith('.jpg') ||
         url.endsWith('.ico');
}

function isHTMLRequest(request) {
  return request.headers.get('Accept') && 
         request.headers.get('Accept').includes('text/html');
}

// Gestione messaggi dal main thread per aggiornamenti
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING message');
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker v3 loaded and ready');
