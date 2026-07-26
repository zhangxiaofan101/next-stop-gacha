import { apiNotFound, handleShareCreate, handleShareGet, handleSyncCreate, handleSyncGet, handleSyncPut } from "./api.mjs";
// Durable Object 类必须从 wrangler.jsonc 的 `main` 入口模块导出（F47/F48 修复，见 durableObjects.mjs 头注）。
export { RateLimiter, SyncCodeStore } from "./durableObjects.mjs";
export { LEGACY_PREFIX, NEW_ORIGIN, legacyRedirect } from "./legacy.mjs";
import { legacyRedirect } from "./legacy.mjs";

// F42：设计要求「HTML/JS 与数据分别长缓存，改数据不失效代码缓存」。Vite 的
// assets/* 文件名自带内容 hash，数据 chunk 也已改名为内容 hash（见 tools/build.py）——
// 两者都可安全 immutable 长缓存。manifest.json/index.html 是唯一会变but文件名不变
// 的入口，必须短缓存+revalidate，否则客户端会长期看着旧 manifest 指向的旧 chunk。
const HASHED_ASSET = /^\/(assets\/|data\/chunk-\d+-[0-9a-f]+\.json$)/;

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // M82：旧域名的游戏子路径一律 308 到新域名，不在这边提供内容。这条**必须和
  // base 改根路径同一次部署**——base 一旦是 "/"，产物里的资源引用就是 host-root
  // 的 /assets/*，而旧 Route 只接管 /next-stop-gacha/*，那些请求根本进不了本
  // Worker。所以旧地址不存在「还能正常玩」的中间态，只有「重定向」或「坏掉」。
  const redirect = legacyRedirect(url);
  if (redirect) return redirect;

  // M40/M41：/api/* 先于静态资产代理匹配——绝不把 API 请求转给 ASSETS（design「后端·API 与静态资产同 Worker」）。
  if (path.startsWith("/api/")) {
    if (path === "/api/share" && request.method === "POST") return handleShareCreate(request, env);
    if (path.startsWith("/api/share/") && request.method === "GET") {
      return handleShareGet(env, path.slice("/api/share/".length));
    }
    if (path === "/api/sync" && request.method === "POST") return handleSyncCreate(request, env);
    if (path.startsWith("/api/sync/") && request.method === "GET") {
      const ip = request.headers.get("cf-connecting-ip") || "unknown";
      return handleSyncGet(env, path.slice("/api/sync/".length), ip);
    }
    if (path.startsWith("/api/sync/") && request.method === "PUT") {
      return handleSyncPut(request, env, path.slice("/api/sync/".length));
    }
    return apiNotFound();
  }

  // M82 之前这里还有一层前缀剥离：请求以 /next-stop-gacha/ 打头，要削掉再去查
  // dist/。拿到自己的域名之后 dist/ 的布局就是 host 根，没有可削的东西，
  // 直接把原 request 交给 ASSETS。
  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  headers.set("x-content-owner", "next-stop-gacha-repo");
  headers.set(
    "cache-control",
    HASHED_ASSET.test(path)
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate",
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  fetch: handleRequest,
};
