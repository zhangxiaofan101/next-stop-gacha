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

  // M83：**入口**给搬家页，其余（资产/API/深层路径）直接 308。
  //
  // 为什么不是一律 308：localStorage 按 origin 隔离，老玩家的存档只有在**这个**
  // origin 上跑一段 JS 才读得到。裸跳过去，人到了新域名看见的是空存档——收藏、
  // 打卡、行程全没了，而数据其实还在，只是再也没人去拿。
  //
  // 为什么只给入口：资产和 API 是页面发出的子请求，那个页面已经不在这儿了，
  // 给它们一张 HTML 毫无意义，只会把干脆的 404 变成更难查的 200。
  if (rest === "/") return migrationPage(target.toString());

  return Response.redirect(target.toString(), 308);
}

/**
 * 极简搬家页。一句话 + 一个按钮，没有别的内容——它必须小到构不成「和新站正文
 * 重复的一份内容」，否则就成了两个域名同文，正是隔离要避开的东西（见 orbit 仓库
 * `.agent/design.md`「隔离不变量」）。
 *
 * 存档走 URL fragment：fragment 不发给服务器，所以这份数据不经过任何后端，也不需要
 * CORS 或短链 API。带不带得动都不阻塞——读不到就直接跳。
 */
function migrationPage(targetUrl) {
  const target = JSON.stringify(targetUrl);
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>搬家了</title>
<style>
html{background:#f7f4ec}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1.5rem;
 font-family:ui-sans-serif,system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
 color:#2f2a24;text-align:center;line-height:1.7}
p{margin:0 0 1.25rem;font-size:1.05rem}
small{display:block;margin-top:1.5rem;color:#8a8175;font-size:.82rem}
a{display:inline-block;padding:.6rem 1.4rem;border:1px solid #2f2a24;border-radius:999px;
 color:#2f2a24;text-decoration:none;font-weight:700}
</style>
</head>
<body>
<main>
<p>「下一站，去哪玩」搬到新地址了。<br>正在把你的收藏和行程一起带过去…</p>
<a id="go" href="${escapeAttr(targetUrl)}">手动前往 →</a>
<small>没有自动跳转？点上面那个按钮。</small>
</main>
<script>
(function(){
  var target = ${target};
  try {
    // 只有在这个 origin 上才读得到老存档——这正是这张页面存在的唯一理由。
    var raw = localStorage.getItem("nextstop_v2");
    if (raw) {
      var parsed = JSON.parse(raw);
      // 空壳不值得带：全空的话跳过去反而会在新站弹一条没意义的提示。
      var any = ["favs","cmp","trip","visited"].some(function(k){
        return Array.isArray(parsed[k]) && parsed[k].length;
      });
      if (any) target += "#m=" + encodeURIComponent(raw);
    }
  } catch (e) { /* 隐私模式/存储被禁：带不走就算了，照跳 */ }
  document.getElementById("go").href = target;
  location.replace(target);
})();
</script>
</body>
</html>`;

  return new Response(html, {
    // 200 而不是 30x：得先跑 JS 才知道要不要带存档，重定向没有这个机会。
    // 没有 JS 的浏览器看到的就是那句话和一个手动链接，功能不残。
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // 搬家页是过渡物，别让它被缓存住——旧地址最终会整域 308 掉。
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

function escapeAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
