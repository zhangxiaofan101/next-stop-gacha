import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Worker/Durable Object 请求级测试（F47/F48 修复后需要真实本地 workerd + DO 语义，见 tests/ 内测试
// 文件头注——手写 fakeKV 证明不了并发场景）。与 vitest.config.ts（src/**/*.test.ts，纯函数决策层，
// 跑在 jsdom）分离成两个配置，各自用 --config 显式调用，include 互斥不重叠。
// `cloudflareTest` 是当前版本（0.18.x）的配置方式——旧文档里的 `defineWorkersConfig` 已经不存在了。
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
  test: {
    include: ["tests/**/*.test.mjs"],
    // 两者都需要真实文件系统/子进程（execSync 起 vite build / python3+cwebp），workerd 沙箱跑不了，
    // 各自跑 `bun run test:build-assets`，见文件头注
    exclude: ["tests/build-assets.test.mjs", "tests/build-illustrations.test.mjs"],
  },
});
