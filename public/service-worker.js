const CACHE_NAME = 'sb2-cache-v8-crop-fix';
const OFFLINE_URL = '/offline';

// File essenziali da cachare immediatamente
const STATIC_FILES = [
  '/',
  '/offline',
  '/css/styles.css',
  '/css/toggle.css',
  '/css/tailwind-custom.css',
  '/js/tailwind-standalone.js',
  '/manifest.json',
  '/images/visibility.svg',
  '/images/visibility_off.svg'
  // NOTA: Altri JS esclusi dal pre-cache per essere sempre fresh
];

// Installazione - cache solo i file essenziali (esclusi JS)
self.addEventListener('install', event => {
  console.log('[SW] Installing Service Worker v8 with crop fix');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching essential files (excluding JS)');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] Essential files cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Error during caching:', error);
      })
  );
});

// Attivazione - pulisci cache vecchie
self.addEventListener('activate', event => {
  console.log('[SW] Activating Service Worker v8');
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
        console.log('[SW] Service Worker activated with smart strategies');
        return self.clients.claim();
      })
  );
});

// Strategia intelligente differenziata per tipo di risorsa
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignora richieste non HTTP/HTTPS e richieste POST/PUT/DELETE
  if (!request.url.startsWith('http') || request.method !== 'GET') {
    return;
  }

  // STRATEGIA 1: JavaScript - SEMPRE FRESH (Network Only)
  // ECCEZIONE: Framework stabili come Tailwind possono essere cachati
  if (isJavaScriptFile(request.url)) {
    // Tailwind standalone è un framework stabile - può essere cachato
    if (request.url.includes('tailwind-standalone.js')) {
      console.log('[SW] Tailwind Framework - Cache First:', request.url);
      event.respondWith(
        caches.match(request)
          .then(cachedResponse => {
            if (cachedResponse) {
              console.log('[SW] Tailwind served from cache:', request.url);
              return cachedResponse;
            }
            return fetch(request)
              .then(response => {
                if (response.status === 200) {
                  caches.open(CACHE_NAME)
                    .then(cache => cache.put(request, response.clone()));
                }
                return response;
              });
          })
      );
      return;
    }
    
    // Altri JS - sempre fresh
    console.log('[SW] JS file - Network Only (always fresh):', request.url);
    event.respondWith(
      fetch(request)
        .then(response => {
          console.log('[SW] JS served fresh from network:', request.url);
          return response;
        })
        .catch(() => {
          console.log('[SW] JS not available offline:', request.url);
          return new Response('JavaScript not available offline', { 
            status: 503,
            statusText: 'Service Unavailable'
          });
        })
    );
    return;
  }

  // STRATEGIA 2: CSS e Immagini - Cache First con Background Update
  if (isCSSOrImageFile(request.url)) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          // Se trovato in cache, servilo immediatamente
          if (cachedResponse) {
            console.log('[SW] CSS/Image served from cache:', request.url);
            
            // Background update: aggiorna la cache in background
            fetch(request)
              .then(freshResponse => {
                if (freshResponse.status === 200) {
                  caches.open(CACHE_NAME)
                    .then(cache => {
                      console.log('[SW] CSS/Image cache updated in background:', request.url);
                      cache.put(request, freshResponse.clone());
                    });
                }
              })
              .catch(() => {
                console.log('[SW] Background update failed for:', request.url);
              });
            
            return cachedResponse;
          }
          
          // Se non in cache, scarica e crea cache
          return fetch(request)
            .then(response => {
              if (response.status === 200) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    console.log('[SW] CSS/Image cached for first time:', request.url);
                    cache.put(request, responseToCache);
                  });
              }
              return response;
            });
        })
        .catch(error => {
          console.error('[SW] Error serving CSS/Image:', error);
          return new Response('Resource not available offline', { status: 503 });
        })
    );
    return;
  }

  // STRATEGIA 3: HTML Pages - Network First con Cache Fallback
  if (isHTMLRequest(request)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Se la risposta è OK, memorizzala in cache per uso offline
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                console.log('[SW] HTML page cached:', request.url);
                cache.put(request, responseClone);
              })
              .catch(error => console.log('[SW] HTML cache error:', error));
          }
          console.log('[SW] HTML served fresh from network:', request.url);
          return response;
        })
        .catch(() => {
          // Se la rete non è disponibile, prova dalla cache
          console.log('[SW] Network failed, trying cache for HTML:', request.url);
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                console.log('[SW] HTML served from cache (offline):', request.url);
                return cachedResponse;
              }
              // Se non è in cache, mostra la pagina offline
              console.log('[SW] Serving offline page for:', request.url);
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }

  // STRATEGIA 4: API Calls - Network Only (no cache)
  if (isAPICall(request.url)) {
    console.log('[SW] API call - Network Only:', request.url);
    event.respondWith(
      fetch(request)
        .catch(() => {
          return new Response(JSON.stringify({ 
            error: 'API not available offline',
            offline: true 
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // STRATEGIA 5: Altri file statici - Cache First
  if (isStaticResource(request.url)) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            console.log('[SW] Static resource served from cache:', request.url);
            return cachedResponse;
          }
          
          return fetch(request)
            .then(response => {
              if (response.status === 200) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    console.log('[SW] Static resource cached:', request.url);
                    cache.put(request, responseToCache);
                  });
              }
              return response;
            });
        })
        .catch(error => {
          console.error('[SW] Error serving static resource:', error);
          return new Response('Resource not available offline', { status: 503 });
        })
    );
    return;
  }

  // Default: passa attraverso senza caching
  console.log('[SW] Default strategy - pass through:', request.url);
});

// Funzioni helper per identificare i tipi di file
function isJavaScriptFile(url) {
  return url.includes('.js') || url.includes('/js/');
}

function isCSSOrImageFile(url) {
  return url.includes('/css/') || 
         url.includes('/images/') || 
         url.endsWith('.css') ||
         url.endsWith('.svg') ||
         url.endsWith('.png') ||
         url.endsWith('.jpg') ||
         url.endsWith('.jpeg') ||
         url.endsWith('.gif') ||
         url.endsWith('.webp') ||
         url.endsWith('.ico');
}

function isHTMLRequest(request) {
  return request.headers.get('Accept') && 
         request.headers.get('Accept').includes('text/html');
}

function isAPICall(url) {
  return url.includes('/api/') || 
         url.includes('/review/') ||
         url.includes('/auth/') ||
         url.includes('/admin/');
}

function isStaticResource(url) {
  return url.includes('/manifest.json') ||
         url.endsWith('.woff') ||
         url.endsWith('.woff2') ||
         url.endsWith('.ttf') ||
         url.endsWith('.eot');
}

// Gestione messaggi dal main thread per aggiornamenti
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING message - updating immediately');
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker v6 loaded with smart caching strategies:');
console.log('[SW] - JavaScript: Network Only (always fresh)');
console.log('[SW] - CSS/Images: Cache First + Background Update');
console.log('[SW] - HTML: Network First + Cache Fallback');
console.log('[SW] - API: Network Only');
console.log('[SW] - Static: Cache First');
