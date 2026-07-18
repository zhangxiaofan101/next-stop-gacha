// Worker 请求级测试（前缀路由/缓存策略）。跑在 @cloudflare/vitest-pool-workers 的本地 workerd 沙箱里
// （见 vitest.workers.config.ts），用 vitest 原生 expect——沙箱没有 nodejs_compat，不能假设 node:assert
// 之类的 node: 内建模块可用。这个文件只测静态资产路由，不碰 /api/*，故不需要真实 KV/DO 绑定。
import { expect, test } from "vitest";
import { handleRequest, isGamePath } from "../cloudflare/worker.mjs";

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
  expect(isGamePath("/next-stop-gacha")).toBe(true);
  expect(isGamePath("/next-stop-gacha/")).toBe(true);
  expect(isGamePath("/next-stop-gacha/assets/app.css")).toBe(true);
  expect(isGamePath("/next-stop-gacha-other/")).toBe(false);
  expect(isGamePath("/")).toBe(false);
});

test("rejects paths outside the game without touching static assets", async () => {
  const { env, calls } = assetEnv();
  const response = await handleRequest(new Request("https://lab.medspiral.com/"), env);

  expect(response.status).toBe(404);
  expect(await response.text()).toBe("Not Found");
  expect(calls.length).toBe(0);
});

test("redirects the bare prefix to the canonical trailing-slash URL", async () => {
  const { env, calls } = assetEnv();
  const response = await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha?from=poster"),
    env,
  );

  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe(
    "https://lab.medspiral.com/next-stop-gacha/?from=poster",
  );
  expect(calls.length).toBe(0);
});

test("strips the public prefix before fetching the root asset", async () => {
  const { env, calls } = assetEnv();
  const response = await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/?seed=42"),
    env,
  );

  expect(calls.length).toBe(1);
  expect(calls[0].url).toBe("https://lab.medspiral.com/?seed=42");
  expect(await response.text()).toBe("asset");
  expect(response.headers.get("x-content-owner")).toBe("next-stop-gacha-repo");
});

test("strips the prefix from nested asset paths", async () => {
  const { env, calls } = assetEnv();
  await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/assets/app.css?v=3"),
    env,
  );

  expect(calls[0].url).toBe("https://lab.medspiral.com/assets/app.css?v=3");
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
  expect(calls[0].url).toBe("https://lab.medspiral.com/data/manifest.json");

  await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/data/chunk-0-e2e6c2a88e.json"),
    env,
  );
  expect(calls[1].url).toBe("https://lab.medspiral.com/data/chunk-0-e2e6c2a88e.json");
});

test("strips the prefix from hashed Vite build assets", async () => {
  const { env, calls } = assetEnv();
  await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/assets/main-a1b2c3d4.js"),
    env,
  );
  expect(calls[0].url).toBe("https://lab.medspiral.com/assets/main-a1b2c3d4.js");
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
  expect(jsResp.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");

  const chunkResp = await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/data/chunk-0-e2e6c2a88e.json"),
    env,
  );
  expect(chunkResp.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
});

test("sets short must-revalidate cache-control for mutable entry points", async () => {
  const { env } = assetEnv(() => new Response("asset", {
    headers: { "cache-control": "public, max-age=60" },
  }));

  const rootResp = await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/"),
    env,
  );
  expect(rootResp.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");

  const manifestResp = await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/data/manifest.json"),
    env,
  );
  expect(manifestResp.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
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

  expect(response.status).toBe(404);
  expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
  expect(response.headers.get("x-content-owner")).toBe("next-stop-gacha-repo");
  expect(await response.text()).toBe("missing");
});
