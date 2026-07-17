import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { handleRequest, isGamePath } from "../cloudflare/worker.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function assetEnv(handler) {
  const calls = [];
  return {
    calls,
    env: {
      ASSETS: {
        async fetch(request) {
          calls.push(request);
          return handler?.(request) ?? new Response("asset", {
            headers: { "content-type": "text/plain" },
          });
        },
      },
    },
  };
}

test("recognizes only the game prefix", () => {
  assert.equal(isGamePath("/next-stop-gacha"), true);
  assert.equal(isGamePath("/next-stop-gacha/"), true);
  assert.equal(isGamePath("/next-stop-gacha/assets/app.css"), true);
  assert.equal(isGamePath("/next-stop-gacha-other/"), false);
  assert.equal(isGamePath("/"), false);
});

test("rejects paths outside the game without touching static assets", async () => {
  const { env, calls } = assetEnv();
  const response = await handleRequest(new Request("https://lab.medspiral.com/"), env);

  assert.equal(response.status, 404);
  assert.equal(await response.text(), "Not Found");
  assert.equal(calls.length, 0);
});

test("redirects the bare prefix to the canonical trailing-slash URL", async () => {
  const { env, calls } = assetEnv();
  const response = await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha?from=poster"),
    env,
  );

  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get("location"),
    "https://lab.medspiral.com/next-stop-gacha/?from=poster",
  );
  assert.equal(calls.length, 0);
});

test("strips the public prefix before fetching the root asset", async () => {
  const { env, calls } = assetEnv();
  const response = await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/?seed=42"),
    env,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://lab.medspiral.com/?seed=42");
  assert.equal(await response.text(), "asset");
  assert.equal(response.headers.get("x-content-owner"), "next-stop-gacha-repo");
});

test("strips the prefix from nested asset paths", async () => {
  const { env, calls } = assetEnv();
  await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/assets/app.css?v=3"),
    env,
  );

  assert.equal(calls[0].url, "https://lab.medspiral.com/assets/app.css?v=3");
});

// M37：数据从注入 index.html 改为构建期发布的 public/data/ 静态 chunk，运行时按 manifest
// fetch；Worker 的前缀剥离对 dist/ 内任意资产路径都是同一套通用逻辑，这里显式钉住 data/
// chunk（F42 后文件名带内容 hash）与 manifest 两类新资产形状，不只靠旧版就有的
// assets/app.css 隐式覆盖。
test("strips the prefix from data chunk and manifest paths", async () => {
  const { env, calls } = assetEnv();
  await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/data/manifest.json"),
    env,
  );
  assert.equal(calls[0].url, "https://lab.medspiral.com/data/manifest.json");

  await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/data/chunk-0-e2e6c2a88e.json"),
    env,
  );
  assert.equal(calls[1].url, "https://lab.medspiral.com/data/chunk-0-e2e6c2a88e.json");
});

test("strips the prefix from hashed Vite build assets", async () => {
  const { env, calls } = assetEnv();
  await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/assets/main-a1b2c3d4.js"),
    env,
  );
  assert.equal(calls[0].url, "https://lab.medspiral.com/assets/main-a1b2c3d4.js");
});

// F42：assets/* 与内容 hash 命名的 data chunk 可安全 immutable 长缓存；其余（index.html、
// manifest.json 等文件名不随内容变化的入口）必须 must-revalidate，否则客户端会长期读到
// 指向旧 hash 的旧 manifest。Worker 显式覆盖 cache-control，不信任 ASSETS 上游的原始值。
test("sets long immutable cache-control for hashed assets and data chunks", async () => {
  const { env } = assetEnv(() => new Response("asset", {
    headers: { "cache-control": "public, max-age=60" }, // 上游任意值，应被覆盖
  }));

  const jsResp = await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/assets/index-abc123.js"),
    env,
  );
  assert.equal(jsResp.headers.get("cache-control"), "public, max-age=31536000, immutable");

  const chunkResp = await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/data/chunk-0-e2e6c2a88e.json"),
    env,
  );
  assert.equal(chunkResp.headers.get("cache-control"), "public, max-age=31536000, immutable");
});

test("sets short must-revalidate cache-control for mutable entry points", async () => {
  const { env } = assetEnv(() => new Response("asset", {
    headers: { "cache-control": "public, max-age=60" },
  }));

  const rootResp = await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/"),
    env,
  );
  assert.equal(rootResp.headers.get("cache-control"), "public, max-age=0, must-revalidate");

  const manifestResp = await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/data/manifest.json"),
    env,
  );
  assert.equal(manifestResp.headers.get("cache-control"), "public, max-age=0, must-revalidate");
});

test("preserves asset status and body while overriding cache-control", async () => {
  const { env } = assetEnv(() => new Response("missing", {
    status: 404,
    headers: { "cache-control": "public, max-age=60" },
  }));
  const response = await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/missing.js"),
    env,
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert.equal(response.headers.get("x-content-owner"), "next-stop-gacha-repo");
  assert.equal(await response.text(), "missing");
});

// F39：静态 body 的抽取/vite base 配置任一环出错，都会产出浏览器实际请求不到的资产 URL——
// 这类错误逐行核对代码抽取无法发现（错的是「运行时会怎么请求」，不是「代码写没写对」）。
// 真跑一次 vite build，从产物 index.html 里抠出真实 <script src>/<link href>，钉住它们必须
// 落在 GAME_PREFIX 内（否则请求根本进不了这个 Worker），并验证前缀剥离后能命中期望的 ASSETS 路径。
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
