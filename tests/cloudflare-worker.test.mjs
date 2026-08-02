// Worker 请求级测试（路由/缓存策略/旧地址退场）。跑在 @cloudflare/vitest-pool-workers 的
// 本地 workerd 沙箱里（见 vitest.workers.config.ts），用 vitest 原生 expect——沙箱没有
// nodejs_compat，不能假设 node:assert 之类的 node: 内建模块可用。这个文件只测静态资产
// 路由与重定向，不碰 /api/*，故不需要真实 KV/DO 绑定。
//
// M82 之前这里测的是「前缀剥离」：请求带 /next-stop-gacha/ 打头，Worker 削掉再查 dist/。
// 拿到自己的域名之后 dist/ 就是 host 根，没有可削的；这批断言换成「原样交给 ASSETS」，
// 另加一组旧地址 308 的断言。
import { expect, test } from "vitest";
import worker, { handleRequest, harden, legacyRedirect, LEGACY_PREFIX, NEW_ORIGIN } from "../cloudflare/worker.mjs";

const ORIGIN = "https://travel.xiaofan.me";

// 旧域名的真实值只存在于 wrangler.jsonc 的 Route 里，不进测试文件（隔离不变量，
// 见 orbit 仓库 .agent/design.md）。这里用占位主机名是**加强**而不是削弱断言：
// legacyRedirect 只看 pathname，对 host 一无所知，所以任意 host 都该得到同样的
// 308 与同样的目标——换成占位值仍然全绿，正好证明了这条无关性。
// 不读环境变量：这些用例跑在 workerd 沙箱里，`process` 不保证存在（见文件头）。
const LEGACY_HOST = "https://legacy.example.com";

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

// M83：入口给搬家页（200 + JS），不是裸 308——localStorage 按 origin 隔离，
// 老存档只有在**旧 origin 上**跑一段 JS 才读得到。裸跳过去人会看见空存档。
test("serves the migration page at the legacy entry, never a bare redirect", async () => {
  const { env, calls } = assetEnv();
  const response = await handleRequest(new Request(`${LEGACY_HOST}${LEGACY_PREFIX}/`), env);

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");

  const html = await response.text();
  expect(html).toContain("nextstop_v2");       // 真去读老存档
  expect(html).toContain("#m=");               // 通过 fragment 带走
  expect(html).toContain(`${NEW_ORIGIN}/`);    // 目的地是新域名
  // 关键：旧地址不再提供**站点内容**。这张页面只有一句话和一个按钮，构不成
  // 「和新站重复的一份正文」——两域同文会让人从个人侧一句话搜回学术侧，而禁词
  // 扫描看不见这种 join（见 orbit 仓库 .agent/design.md「隔离不变量」）。
  expect(calls.length).toBe(0);
  expect(html.length).toBeLessThan(3000);
});

test("migration page carries the query string to the new origin", async () => {
  const { env } = assetEnv();
  const response = await handleRequest(
    new Request(`${LEGACY_HOST}${LEGACY_PREFIX}/?sc=ABC123&from=poster`),
    env,
  );

  // ?sc= 是同步码：状态存在 Durable Object 里，与 origin 无关，所以分享出去的
  // 老链接跳过来照样能取回行程。丢了查询串就等于把这些链接作废。
  expect(await response.text()).toContain(`${NEW_ORIGIN}/?sc=ABC123&amp;from=poster`);
});

test("bare legacy prefix also lands on the migration page", async () => {
  const { env } = assetEnv();
  const response = await handleRequest(new Request(`${LEGACY_HOST}${LEGACY_PREFIX}`), env);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain(`${NEW_ORIGIN}/`);
});

// 资产和 API 是那张已经不存在的页面发出的子请求——给它们 HTML 只会把干脆的 404
// 变成更难查的 200。这些一律 308。
test("308s legacy sub-resource paths instead of showing the page", async () => {
  const { env, calls } = assetEnv();
  for (const p of ["/assets/main-a1b2c3d4.js", "/data/manifest.json", "/api/sync"]) {
    const response = await handleRequest(new Request(`${LEGACY_HOST}${LEGACY_PREFIX}${p}`), env);
    expect(response.status, p).toBe(308);
    expect(response.headers.get("location"), p).toBe(`${NEW_ORIGIN}${p}`);
  }
  expect(calls.length).toBe(0);
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

  // M70：出发地视角文件同为内容 hash 命名（tools/build.py），M22 起漏在短缓存分支里，补钉
  const originResp = await handleRequest(new Request(`${ORIGIN}/data/origin-guangzhou-f0b27ca235.json`), env);
  expect(originResp.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
});

test("sets short must-revalidate cache-control for mutable entry points", async () => {
  const { env } = assetEnv(() => new Response("asset", {
    headers: { "cache-control": "public, max-age=60" },
  }));

  const rootResp = await handleRequest(new Request(`${ORIGIN}/`), env);
  expect(rootResp.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");

  const manifestResp = await handleRequest(new Request(`${ORIGIN}/data/manifest.json`), env);
  expect(manifestResp.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");

  // M70：sw.js 是 SW 更新的唯一触发器——一旦被长缓存，「绝不允许装成 PWA 后永远旧版」
  // 红线就破了；两份数据索引同理是「会变但文件名不变」的入口
  const swResp = await handleRequest(new Request(`${ORIGIN}/sw.js`), env);
  expect(swResp.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");

  const originsIdxResp = await handleRequest(new Request(`${ORIGIN}/data/origins.json`), env);
  expect(originsIdxResp.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
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

// ── 安全响应头（2026-08-03 安全审查）──────────────────────────────────────
//
// 走 default export（真正的入口），不走 handleRequest：头包在最外层，只测内层
// 等于没测。

test("安全头：静态资产三个头齐全", async () => {
  const { env } = assetEnv();
  const res = await worker.fetch(new Request(`${ORIGIN}/`), env);
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
});

test("安全头：旧地址 308 那条出口也带上", async () => {
  const { env } = assetEnv();
  const res = await worker.fetch(
    new Request(`${LEGACY_HOST}${LEGACY_PREFIX}/assets/main-a1b2c3d4.js`),
    env,
  );
  expect(res.status).toBe(308);
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
});

// 反例：已有的更严格的头不能被降级。
test("安全头：只补不覆盖", () => {
  const res = harden(new Response("x", { headers: { "referrer-policy": "no-referrer" } }));
  expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
});

test("安全头：空身响应（304）能安全通过", () => {
  const res = harden(new Response(null, { status: 304 }));
  expect(res.status).toBe(304);
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
});
