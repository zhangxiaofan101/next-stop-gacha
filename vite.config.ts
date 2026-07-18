import { defineConfig } from "vite";

// F39：base 必须是 /next-stop-gacha/，不是 "/"——前缀剥离发生在请求已经到达
// Worker 之后（用于查询 dist/ 内部的 ASSETS 绑定），但浏览器是先按 index.html 里
// 写的绝对 URL 发请求，路由（lab.medspiral.com/next-stop-gacha/*）先于 Worker 决定
// 这个请求归不归本 Worker 管。host-root 的 /assets/* 根本进不了这个 Worker。
export default defineConfig({
  base: "/next-stop-gacha/",
  build: {
    outDir: "dist",
  },
});
