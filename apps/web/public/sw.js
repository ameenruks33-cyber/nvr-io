/* NVR.io service worker — shell cache + auto update notifications to installed devices */
const CACHE = 'nvr-io-shell-v1-1-23';
const PRECACHE = ['/', '/login', '/app', '/manifest.webmanifest'];
const UPDATE_URL = '/app-update.json';
const VERSION_STORE = 'nvr-sw-version';

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

function safeUpdatePath(url) {
  if (!url || typeof url !== 'string') return '/updates';
  if (!url.startsWith('/') || url.startsWith('//') || url.includes('\\')) {
    return '/updates';
  }
  return url;
}

async function readStoredVersion() {
  try {
    const cache = await caches.open(CACHE);
    const res = await cache.match(VERSION_STORE);
    if (!res) return null;
    const data = await res.json();
    return data.version || null;
  } catch {
    return null;
  }
}

async function writeStoredVersion(version) {
  const cache = await caches.open(CACHE);
  await cache.put(
    VERSION_STORE,
    new Response(JSON.stringify({ version }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function cmpVersion(a, b) {
  const pa = String(a || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

async function fetchUpdateInfo() {
  const res = await fetch(`${UPDATE_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

async function notifyClients(info) {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  for (const client of clients) {
    client.postMessage({ type: 'NVR_UPDATE_AVAILABLE', update: info });
  }
}

async function showUpdateNotification(info) {
  // Works when the user previously granted notification permission
  const icon =
    info.icons?.icon192 &&
    typeof info.icons.icon192 === 'string' &&
    info.icons.icon192.startsWith('/') &&
    !info.icons.icon192.startsWith('//')
      ? info.icons.icon192
      : '/icon-192.png';
  try {
    await self.registration.showNotification(info.title || 'NVR.io update available', {
      body: info.message || 'A new version is ready. Tap to update.',
      icon,
      badge: icon,
      tag: `nvr-update-${info.version}`,
      renotify: true,
      requireInteraction: Boolean(info.force),
      data: { url: safeUpdatePath(info.updateUrl), version: info.version },
      actions: [
        { action: 'update', title: 'Update now' },
        { action: 'later', title: 'Later' },
      ],
    });
  } catch {
    /* permission not granted or unsupported */
  }
}

async function checkForUpdateAndNotify() {
  try {
    const info = await fetchUpdateInfo();
    if (!info?.version) return null;

    const stored = await readStoredVersion();
    if (!stored) {
      await writeStoredVersion(info.version);
      return null;
    }

    if (cmpVersion(info.version, stored) > 0) {
      await notifyClients(info);
      await showUpdateNotification(info);
      return info;
    }
    return null;
  } catch {
    return null;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim())
      .then(() => checkForUpdateAndNotify()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isApiPath(url.pathname)) return;

  const sameOriginReq = new Request(url.pathname + url.search, {
    method: 'GET',
    headers: req.headers,
    credentials: req.credentials,
    cache: req.cache,
    redirect: 'follow',
  });

  // Never serve a stale update file
  if (url.pathname === UPDATE_URL) {
    event.respondWith(
      fetch(sameOriginReq, { cache: 'no-store' }).catch(() => caches.match(UPDATE_URL)),
    );
    return;
  }

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
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data.type === 'CHECK_UPDATE') {
    event.waitUntil(
      checkForUpdateAndNotify().then(async (info) => {
        if (data.markVersion && info?.version) {
          /* keep stored so we keep notifying until user updates */
        }
        if (data.ackVersion) {
          await writeStoredVersion(String(data.ackVersion));
        }
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ update: info });
        }
      }),
    );
  }
  if (data.type === 'ACK_UPDATE' && data.version) {
    event.waitUntil(
      (async () => {
        await writeStoredVersion(String(data.version));
        try {
          const notes = await self.registration.getNotifications();
          for (const n of notes) {
            if (String(n.tag || '').startsWith('nvr-update-')) {
              n.close();
            }
          }
        } catch {
          /* ignore */
        }
      })(),
    );
  }
});

// Periodic background check (Chrome/Android installed PWA)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'nvr-update-check') {
    event.waitUntil(checkForUpdateAndNotify());
  }
});

// Fallback timer while SW is alive (keeps checking while any client is open)
setInterval(() => {
  void checkForUpdateAndNotify();
}, 45_000);

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'later') return;

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
