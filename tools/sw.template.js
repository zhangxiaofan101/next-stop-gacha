/* Service Worker 模板（M70）——dist/sw.js 由 tools/build_sw.mjs 注入两个占位符后生成：
   CACHE_VERSION 的字符串值（全部预缓存内容的聚合 hash）与 PRECACHE 的数组值（URL 清单）。
   占位符字面量只允许出现在下方赋值处——生成器按首次出现替换，写进注释会被抢先吃掉。
   模板本体是纯静态脚本，绝不手改 dist/sw.js。

   策略总纲（design M70「更新策略：在线永远最新」）——SW 不改变任何在线行为：
   ① 可变入口（导航、data/manifest.json、data/origins.json 等非 hash 文件名）网络优先，
      成功回写缓存副本，失败（断网）才退缓存——联网打开必是最新版，没有「等待接管」状态机；
   ② 内容 hash 命名的不可变资源（assets/*、data/chunk-*、data/origin-*）缓存优先——文件名随
      内容变，与 Worker 侧 immutable 长缓存同构（判定正则与 cloudflare/worker.mjs HASHED_ASSET
      保持一致，tests/build-assets.test.mjs 有两处同构钉）；
   ③ 插画 stale-while-revalidate 运行时缓存——非 hash 命名、会原地更新，缓存优先会钉死旧图；
      404 从不入缓存（恒缺资产的 data-fallback 回退机制依赖真实 404/错误）；
   ④ api/* 与跨域（天气）完全不碰——离线缺席即既有降级哲学接管。 */

const CACHE_VERSION = "__CACHE_VERSION__";
const PRECACHE = __PRECACHE_MANIFEST__;

// 版本化静态缓存：activate 时清掉一切旧版本。插画运行时缓存独立且**不带版本号**——
// 「已浏览插画」是用户积累不是构建产物，不随部署清空（design M70）。
const STATIC_CACHE = "static-" + CACHE_VERSION;
const ILLUST_CACHE = "illust-v1";

const HASHED = /^\/(assets\/|data\/(chunk-\d+|origin-[a-z0-9-]+)-[0-9a-f]+\.json$)/;

// 请求分类（纯函数，tests/build-assets.test.mjs 经 self 桩提取做行为钉）
function classify(url, origin) {
  if (url.origin !== origin) return "bypass";
  const p = url.pathname;
  if (p.startsWith("/api/")) return "bypass";
  if (HASHED.test(p)) return "hashed";
  if (p.startsWith("/illustrations/")) return "illust";
  return "mutable";
}

async function putIfOk(cacheName, key, res) {
  if (res && res.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(key, res.clone());
  }
  return res;
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  return putIfOk(STATIC_CACHE, req, await fetch(req));
}

// 导航请求统一以 "/" 为缓存键：本应用单页且 Worker 对任意查询串（?sc= 短链）都回同一份
// index.html，按原始 URL 存只会积累重复壳副本。
async function networkFirst(req) {
  const isNav = req.mode === "navigate";
  const key = isNav ? "/" : req;
  try {
    return await putIfOk(STATIC_CACHE, key, await fetch(req));
  } catch (err) {
    const hit = await caches.match(key);
    if (hit) return hit;
    throw err;
  }
}

function staleWhileRevalidate(event, req) {
  return (async () => {
    const hit = await caches.match(req);
    const refetch = fetch(req).then((res) => putIfOk(ILLUST_CACHE, req, res));
    if (hit) {
      // 已有副本先出手，网络刷新在后台完成（waitUntil 保住 SW 生命周期）
      event.waitUntil(refetch.catch(() => {}));
      return hit;
    }
    return refetch.catch(() => Response.error());
  })();
}

self.addEventListener("install", (event) => {
  // addAll 原子性：任何一项取不齐整个 install 失败，老版本缓存原样服务（design M70「原子接管」）
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, ILLUST_CACHE]);
    for (const key of await caches.keys()) {
      if (!keep.has(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const kind = classify(new URL(req.url), self.location.origin);
  if (kind === "bypass") return; // 不 respondWith，浏览器原生网络路径
  if (kind === "hashed") event.respondWith(cacheFirst(req));
  else if (kind === "illust") event.respondWith(staleWhileRevalidate(event, req));
  else event.respondWith(networkFirst(req));
});

// 测试钩子：build-assets 契约测试用 new Function + self 桩执行本脚本后取 classify 做行为钉。
// 运行时无消费方，浏览器里只是 SW 全局上多一个属性。
self.__classify = classify;
