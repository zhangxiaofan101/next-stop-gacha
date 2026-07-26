// M82：旧地址的退场。
//
// 搬家之前，游戏寄生在实验室域名的一个子路径上（Route 只接管
// `<旧域名>/next-stop-gacha/*`，Lab 首页归 Lab 仓库）。拿到 travel.xiaofan.me
// 之后，构建 base 从 `/next-stop-gacha/` 改成 `/`——产物里的资源引用随之变成
// host-root 的 `/assets/*`，而那些路径不在旧 Route 的匹配范围里，根本进不了本
// Worker。**所以旧地址没有「还能正常玩」的中间态**：同一次部署里，它要么变成
// 重定向，要么直接坏掉。这个文件就是「变成重定向」。
//
// 独立成小文件、不 import 任何 `cloudflare:` 专属模块，理由和它取代的
// gamePath.mjs 一样：纯 Node/Bun 环境下的测试要能直接 import 这个纯函数，
// 不必连带拉进 durableObjects.mjs 对 `cloudflare:workers` 的依赖。
//
// 隔离不变量（见 orbit 仓库 .agent/design.md）：这里出现旧域名是允许的——
// 方向是**旧 → 新**，且只在请求打到旧域名时才发出。travel.xiaofan.me 自己
// 提供的任何响应都不含这个字符串。

export const LEGACY_PREFIX = "/next-stop-gacha";
export const NEW_ORIGIN = "https://travel.xiaofan.me";

/**
 * 旧域名的游戏路径 → 新域名同一位置。命中返回 308，否则返回 null（交给正常处理）。
 *
 * 308 而不是 301/302：老链接里有 `?sc=<同步码>` 这类查询串，308 明确要求
 * 客户端保持方法与请求体不变，语义上也是「永久搬走了，别再来了」。查询串
 * 由 URL 对象原样带过去——分享出去的行程链接因此照常能打开，落在新域名上
 * 仍然凭同步码从 Durable Object 取回状态，和 origin 无关。
 */
export function legacyRedirect(url) {
  const path = url.pathname;
  if (path !== LEGACY_PREFIX && !path.startsWith(`${LEGACY_PREFIX}/`)) return null;

  // 削掉前缀；裸前缀（无尾斜杠）映射到新域名根路径。
  const rest = path.slice(LEGACY_PREFIX.length) || "/";
  const target = new URL(rest, NEW_ORIGIN);
  target.search = url.search;
  target.hash = url.hash;

  return Response.redirect(target.toString(), 308);
}
