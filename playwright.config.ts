import { defineConfig, devices } from "@playwright/test";

// M66：皮肤视觉回归快照——独立于 verify 主链（重、依赖浏览器二进制，见 design M66）。
// 本地手动工具，同 build_illustrations.py/build_fonts.py 的「不进 Cloudflare 远端构建」理由：
// 跑法 `bun run test:visual`（对比既有基线）/ `bun run test:visual:update`（改动确认后重拍基线）。
// 基线图受 Chromium 版本/操作系统字体渲染影响——本项目基线在本机（macOS/arm64）拍摄，换机器
// 重拍前先跑一次确认是否只是环境噪声（见 tests/visual/README.md）。
export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  expect: {
    toHaveScreenshot: {
      // 待机动画（FAB 呼吸/wiggle/彩带等）与字体子像素渲染的容忍——皮肤 token 级别的真实改动
      // （色板/描边/圆角/资产替换）远超此阈值，不会被容忍值吞掉。
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
      // F73：默认 5s 断言超时在 fullyParallel 多页面并发抢字体加载时偶发撞线（实跑复现
      // cream-detail 超时）；测试代码已显式 await document.fonts.ready 把字体等待挪出这条超时
      // 预算，这里再给并发抢占本身留余量。
      timeout: 10_000,
    },
  },
  use: {
    baseURL: "http://localhost:4173/next-stop-gacha/",
    viewport: { width: 1280, height: 900 },
    colorScheme: "light",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173/next-stop-gacha/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
