import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { isGamePath } from "../cloudflare/gamePath.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// F39：静态 body 的抽取/vite base 配置任一环出错，都会产出浏览器实际请求不到的资产 URL——这类错误
// 逐行核对代码抽取无法发现（错的是「运行时会怎么请求」，不是「代码写没写对」）。真跑一次 vite build，
// 从产物 index.html 里抠出真实 <script src>/<link href>，钉住它们必须落在 GAME_PREFIX 内。
//
// 需要真实文件系统 + 子进程，跑不进 workerd 沙箱（vitest.workers.config.ts 的 pool 环境），故独立
// 拆出这一个文件，用 `bun run test:build-assets` 单独跑 node:test；不进 verify/build 门禁——数据闸门
// 在 tools/build.py，这里只钉「构建产物的资产路径形状」，和 tests/cloudflare-*.test.mjs 一样历史上
// 就不在部署门禁上。
test("built index.html references assets that resolve through this worker's routing", () => {
  execSync("bunx vite build", { cwd: ROOT, stdio: "pipe" });
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]);

  assert.ok(refs.length >= 2, "expected at least a JS and a CSS reference in dist/index.html");
  for (const ref of refs) {
    assert.ok(
      isGamePath(ref),
      `asset reference "${ref}" does not start with ${JSON.stringify("/next-stop-gacha")} — ` +
      "the browser would request it outside this Worker's route and get a 404 (see F39)",
    );
  }
});
