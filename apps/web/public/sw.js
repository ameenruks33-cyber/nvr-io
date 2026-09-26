/* NVR.io service worker — shell cache + update notifications */
const CACHE = 'nvr-io-shell-v2';
const PRECACHE = ['/', '/login', '/manifest.webmanifest', '/icon-192.png'];

function isApiPath(pathname) {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/gallery/') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/users/') ||
    pathname.startsWith('/records/') ||
    pathname.startsWith('/payments/') ||
    pathname.startsWith('/health')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API / auth / data requests
  if (isApiPath(url.pathname)) return;

  // Re-fetch only same-origin URLs already filtered above (not attacker-controlled)
  const sameOriginReq = new Request(url.pathname + url.search, {
    method: 'GET',
    headers: req.headers,
    credentials: req.credentials,
    cache: req.cache,
    redirect: 'follow',
  });

  // Always network-first for the update file
  if (url.pathname === '/app-update.json') {
    event.respondWith(
      fetch(sameOriginReq)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(url.pathname, copy));
          return res;
        })
        .catch(() => caches.match(url.pathname)),
    );
    return;
  }

  // App shell pages/assets: network first, fall back to cache
  event.respondWith(
    fetch(sameOriginReq)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('/'))),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let target = '/updates';
  const raw = event.notification.data?.url;
  if (
    typeof raw === 'string' &&
    raw.startsWith('/') &&
    !raw.startsWith('//') &&
    !raw.includes('\\')
  ) {
    target = raw;
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
