/* Service Worker：让系统可离线打开、可安装到手机/电脑桌面
 * 策略：应用外壳（页面/CSS/JS/图标）缓存优先；规则包 policy.json 网络优先（保证政策及时更新） */
var CACHE = 'hitech-assess-v1';
var SHELL = [
  './', './index.html', './manifest.webmanifest',
  './assets/styles.css', './assets/rule-engine.js', './assets/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // 规则包：网络优先，失败回落缓存（保证政策随时更新）
  if (url.pathname.indexOf('/rules/') >= 0 || url.pathname.indexOf('policy.json') >= 0) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      }).catch(function () { return caches.match(e.request); })
    );
    return;
  }

  // 应用外壳：缓存优先，后台更新
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      var net = fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
