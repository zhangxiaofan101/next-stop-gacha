import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// base "/" 而非 "/next-stop-gacha/"：Worker 在把请求转给静态资产服务前已经剥离了
// /next-stop-gacha 前缀（见 cloudflare/worker.mjs），dist/ 内部因此按站点根路径自referencing。
export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: "dist",
  },
});
