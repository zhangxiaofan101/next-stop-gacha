import { defineConfig } from "vitest/config";

// 决策层单测（M38 基线）。tests/ 目录下是跑在真实本地 workerd 沙箱里的 Worker/DO 请求级测试
// （见 vitest.workers.config.ts，`bun run test` 或随 `verify` 一并跑），故 include 只圈 src 内的
// *.test.ts，两套配置各自 --config 显式调用，互不误伤。
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
