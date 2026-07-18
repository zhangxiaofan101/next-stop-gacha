import { defineConfig } from "vitest/config";

// 决策层单测（M38 基线）。tests/ 目录下是 node:test 风格的 Worker 请求级测试，
// 由 `bun test tests/` 跑，故 include 只圈 src 内的 *.test.ts，两套互不误伤。
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
