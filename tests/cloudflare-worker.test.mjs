// Worker 请求级测试（路由/缓存策略/旧地址退场）。跑在 @cloudflare/vitest-pool-workers 的
// 本地 workerd 沙箱里（见 vitest.workers.config.ts），用 vitest 原生 expect——沙箱没有
// nodejs_compat，不能假设 node:assert 之类的 node: 内建模块可用。这个文件只测静态资产
// 路由与重定向，不碰 /api/*，故不需要真实 KV/DO 绑定。
//
// M82 之前这里测的是「前缀剥离」：请求带 /next-stop-gacha/ 打头，Worker 削掉再查 dist/。
// 拿到自己的域名之后 dist/ 就是 host 根，没有可削的；这批断言换成「原样交给 ASSETS」，
// 另加一组旧地址 308 的断言。
import { expect, test } from "vitest";
import { handleRequest, legacyRedirect, LEGACY_PREFIX, NEW_ORIGIN } from "../cloudflare/worker.mjs";

const ORIGIN = "https://travel.xiaofan.me";
const LEGACY_HOST = "https://lab.medspiral.com";

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

// ── 新域名：路径原样交给静态资产 ────────────────────────────────────────────

test("serves the root asset without rewriting the path", async () => {
  const { env, calls } = assetEnv();
  const response = await handleRequest(new Request(`${ORIGIN}/?seed=42`), env);

  expect(calls.length).toBe(1);
  expect(calls[0].url).toBe(`${ORIGIN}/?seed=42`);
  expect(await response.text()).toBe("asset");
  expect(response.headers.get("x-content-owner")).toBe("next-stop-gacha-repo");
});

test("passes nested asset paths through untouched", async () => {
  const { env, calls } = assetEnv();
  await handleRequest(new Request(`${ORIGIN}/assets/app.css?v=3`), env);
  expect(calls[0].url).toBe(`${ORIGIN}/assets/app.css?v=3`);
});

// M37：数据从注入 index.html 改为构建期发布的 public/data/ 静态 chunk，运行时按 manifest
// fetch。显式钉住 data/ chunk（F42 后文件名带内容 hash）与 manifest 两类资产形状，
// 不只靠 assets/app.css 隐式覆盖。
test("passes data chunk and manifest paths through untouched", async () => {
  const { env, calls } = assetEnv();
  await handleRequest(new Request(`${ORIGIN}/data/manifest.json`), env);
  expect(calls[0].url).toBe(`${ORIGIN}/data/manifest.json`);

  await handleRequest(new Request(`${ORIGIN}/data/chunk-0-e2e6c2a88e.json`), env);
  expect(calls[1].url).toBe(`${ORIGIN}/data/chunk-0-e2e6c2a88e.json`);
});

// ── 旧地址：只回 308，绝不提供内容 ──────────────────────────────────────────

test("308s the legacy game path to the new origin", async () => {
  const { env, calls } = assetEnv();
  const response = await handleRequest(new Request(`${LEGACY_HOST}${LEGACY_PREFIX}/`), env);

  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe(`${NEW_ORIGIN}/`);
  // 关键：旧地址一个字节的内容都不再提供。两个域名上正文相同的话，从个人侧
  // 抓一句话去搜就能 join 回学术侧，而禁词扫描看不见这种泄漏（见 orbit
  // 仓库 .agent/design.md「隔离不变量」）。
  expect(calls.length).toBe(0);
});

test("308 keeps the query string so old share links still resolve", async () => {
  const { env } = assetEnv();
  const response = await handleRequest(
    new Request(`${LEGACY_HOST}${LEGACY_PREFIX}/?sc=ABC123&from=poster`),
    env,
  );

  expect(response.status).toBe(308);
  // ?sc= 是同步码：状态存在 Durable Object 里，与 origin 无关，所以分享出去的
  // 老链接跳过来照样能取回行程。丢了查询串就等于把这些链接作废。
  expect(response.headers.get("location")).toBe(`${NEW_ORIGIN}/?sc=ABC123&from=poster`);
});

test("308 maps the bare legacy prefix to the new root", async () => {
  const { env } = assetEnv();
  const response = await handleRequest(new Request(`${LEGACY_HOST}${LEGACY_PREFIX}`), env);
  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe(`${NEW_ORIGIN}/`);
});

test("308 preserves deep paths under the legacy prefix", async () => {
  const { env } = assetEnv();
  const response = await handleRequest(
    new Request(`${LEGACY_HOST}${LEGACY_PREFIX}/assets/main-a1b2c3d4.js`),
    env,
  );
  expect(response.headers.get("location")).toBe(`${NEW_ORIGIN}/assets/main-a1b2c3d4.js`);
});

test("legacyRedirect leaves non-legacy paths alone", () => {
  expect(legacyRedirect(new URL(`${ORIGIN}/`))).toBe(null);
  expect(legacyRedirect(new URL(`${ORIGIN}/assets/app.css`))).toBe(null);
  // 前缀必须是完整一段，`/next-stop-gacha-other/` 不算命中
  expect(legacyRedirect(new URL(`${ORIGIN}${LEGACY_PREFIX}-other/`))).toBe(null);
});

// ── 缓存策略（与 M82 无关，断言原样保留，只换掉地址里的前缀） ───────────────

// F42：assets/* 与内容 hash 命名的 data chunk 可安全 immutable 长缓存；其余（index.html、
// manifest.json 等文件名不随内容变化的入口）必须 must-revalidate，否则客户端会长期读到
// 指向旧 hash 的旧 manifest。Worker 显式覆盖 cache-control，不信任 ASSETS 上游的原始值。
test("sets long immutable cache-control for hashed assets and data chunks", async () => {
  const { env } = assetEnv(() => new Response("asset", {
    headers: { "cache-control": "public, max-age=60" }, // 上游任意值，应被覆盖
  }));

  const jsResp = await handleRequest(new Request(`${ORIGIN}/assets/index-abc123.js`), env);
  expect(jsResp.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");

  const chunkResp = await handleRequest(new Request(`${ORIGIN}/data/chunk-0-e2e6c2a88e.json`), env);
  expect(chunkResp.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
});

test("sets short must-revalidate cache-control for mutable entry points", async () => {
  const { env } = assetEnv(() => new Response("asset", {
    headers: { "cache-control": "public, max-age=60" },
  }));

  const rootResp = await handleRequest(new Request(`${ORIGIN}/`), env);
  expect(rootResp.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");

  const manifestResp = await handleRequest(new Request(`${ORIGIN}/data/manifest.json`), env);
  expect(manifestResp.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
});

test("preserves asset status and body while overriding cache-control", async () => {
  const { env } = assetEnv(() => new Response("missing", {
    status: 404,
    headers: { "cache-control": "public, max-age=60" },
  }));
  const response = await handleRequest(new Request(`${ORIGIN}/missing.js`), env);

  expect(response.status).toBe(404);
  expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
  expect(response.headers.get("x-content-owner")).toBe("next-stop-gacha-repo");
  expect(await response.text()).toBe("missing");
});
