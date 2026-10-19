/* 북한산 배드민턴 랠리 클럽 — 서비스 워커 (오프라인 실행 / 홈 화면 앱) */
const CACHE = 'bm-cache-v1';   // 같은 github.io 주소의 탁구 앱 캐시(pp-cache)는 건드리지 않음
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png?v=1', './icon-512.png?v=1'];
const CDN = /(^|\.)cdn\.tailwindcss\.com$|(^|\.)cdn\.jsdelivr\.net$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('bd-cache') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/google\.com$|googleusercontent\.com$/.test(url.hostname)) return;      // 시트 API는 항상 네트워크
  if (url.origin === self.location.origin) {                                   // 앱 파일: 네트워크 우선 → 실패 시 캐시
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  if (CDN.test(url.hostname)) {                                                // CDN: 캐시 우선
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })));
  }
});
/* 종료 알림 탭 → 앱 화면으로 */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
