import { defineConfig } from "vite";

// M82：base 是 "/"。
//
// 在此之前是 "/next-stop-gacha/"，因为游戏寄生在实验室域名的一个子路径上：
// 浏览器按 index.html 里写死的绝对 URL 发请求，而路由是先于 Worker 决定这个
// 请求归不归本 Worker 管的——host-root 的 /assets/* 压根进不来（F39）。
// 拿到 travel.xiaofan.me 之后 Worker 独占整个 hostname，那条约束随之消失。
//
// 反过来也成立，且是本次改动最要紧的一条：base 一变成 "/"，旧的子路径地址
// 就再也服务不了内容了。所以旧 Route 必须在同一次部署里改成 308
// （见 cloudflare/legacy.mjs），没有两边都能玩的中间态。
export default defineConfig({
  base: "/",
  build: {
    outDir: "dist",
  },
});
