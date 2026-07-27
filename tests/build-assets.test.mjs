import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function pngDimensions(file) {
  const bytes = readFileSync(file);
  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${file.pathname} is not a PNG`,
  );
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

// F39：静态 body 的抽取/vite base 配置任一环出错，都会产出浏览器实际请求不到的资产 URL——这类错误
// 逐行核对代码抽取无法发现（错的是「运行时会怎么请求」，不是「代码写没写对」）。真跑一次 vite build，
// 从产物 index.html 里抠出真实 <script src>/<link href>，钉住它们的形状。
//
// M82：钉的东西反过来了。以前要求资产落在 /next-stop-gacha/ 前缀内（游戏寄生在实验室
// 子路径上，host-root 的 /assets/* 进不了本 Worker 的 Route）；拿到自己的域名之后，
// 要求正好相反——**必须是 host 根的绝对路径**。base 若被改回带前缀的值，浏览器会去
// travel.xiaofan.me/next-stop-gacha/assets/* 取资产，那里什么都没有。
//
// 需要真实文件系统 + 子进程，跑不进 workerd 沙箱（vitest.workers.config.ts 的 pool 环境），故独立
// 拆出这一个文件，用 `bun run test:build-assets` 单独跑 node:test；不进 verify/build 门禁——数据闸门
// 在 tools/build.py，这里只钉「构建产物的资产路径形状」，和 tests/cloudflare-*.test.mjs 一样历史上
// 就不在部署门禁上。
test("built index.html references assets that resolve through this worker's routing", () => {
  // M70：NODE_ENV 必须钉成 production——bun test 会给子进程带上 NODE_ENV=test，vite 据此把
  // import.meta.env.PROD 编译成 false，PROD 门控的 SW 注册整段被死码消除；这里测的是真实
  // 部署形态（wrangler 远端构建 NODE_ENV 未设，vite 默认 production），不是测试环境形态。
  execSync("bunx vite build", { cwd: ROOT, stdio: "pipe", env: { ...process.env, NODE_ENV: "production" } });
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]);

  assert.ok(refs.length >= 2, "expected at least a JS and a CSS reference in dist/index.html");
  for (const ref of refs) {
    assert.ok(
      ref.startsWith("/") && !ref.startsWith("/next-stop-gacha/"),
      `asset reference "${ref}" is not a host-root absolute path — ` +
      "vite base must be \"/\" now that the Worker owns the whole hostname (M82; see F39 for the old constraint)",
    );
  }

  // M70 顺手钉：meta description 里的目的地/线路计数必须等于数据真相源——此前写死的
  // 267 无声漂了三个内容批没人发现。城市数 = 发布 chunk 总条数 − routes.json 线路数。
  const total = JSON.parse(readFileSync(new URL("../dist/data/manifest.json", import.meta.url), "utf8"))
    .map((f) => JSON.parse(readFileSync(new URL(`../dist/data/${f}`, import.meta.url), "utf8")).length)
    .reduce((a, b) => a + b, 0);
  const routes = JSON.parse(readFileSync(new URL("../data/routes.json", import.meta.url), "utf8")).length;
  assert.ok(
    html.includes(`${total - routes} 个目的地 + ${routes} 条联程线路`),
    `meta description must carry the true counts (${total - routes} 城 / ${routes} 线) — update index.html when a content batch lands`,
  );

  // M84：iOS 的 apple-touch-icon 取代 manifest icon；两条都钉，避免以后只改 manifest
  // 却让主屏继续吃旧图。尺寸从真实构建产物 PNG 的 IHDR 读，不相信文件名。
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest">/);
  assert.match(
    html,
    /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png">/,
  );

  const manifest = JSON.parse(
    readFileSync(new URL("../dist/manifest.webmanifest", import.meta.url), "utf8"),
  );
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal(
    html.match(/<meta name="theme-color" content="([^"]+)">/)?.[1],
    manifest.theme_color,
    "HTML browser chrome and manifest install shell must use the same theme color",
  );
  assert.deepEqual(
    manifest.icons.map(({ src, sizes }) => [src, sizes]),
    [
      ["/icons/app-icon-192.png", "192x192"],
      ["/icons/app-icon-512.png", "512x512"],
      ["/icons/app-icon-1024.png", "1024x1024"],
    ],
  );

  for (const [file, size] of [
    ["../dist/apple-touch-icon.png", 180],
    ["../dist/icons/app-icon-192.png", 192],
    ["../dist/icons/app-icon-512.png", 512],
    ["../dist/icons/app-icon-1024.png", 1024],
  ]) {
    assert.deepEqual(
      pngDimensions(new URL(file, import.meta.url)),
      { width: size, height: size },
      `${file} must stay square at its declared size`,
    );
  }
});

// M70：Service Worker 生成产物契约。依赖上一条 test 刚跑过的 vite build（node:test 同文件
// 顺序执行）；这里真跑一次生成器，然后独立复核——生成器自带的守卫不算数，它自己也可能被改坏。
test("generated sw.js precaches the full app shell and mirrors the worker's cache semantics", () => {
  execSync("bun tools/build_sw.mjs", { cwd: ROOT, stdio: "pipe" });
  const sw = readFileSync(new URL("../dist/sw.js", import.meta.url), "utf8");

  // 版本号 = 预缓存内容聚合 hash 的前 12 位（design M70「原子接管」：内容变→版本变→SW 换版）
  assert.match(sw, /const CACHE_VERSION = "[0-9a-f]{12}";/);

  const precache = JSON.parse(sw.match(/const PRECACHE = (\[[^\]]*\])/)[1]);

  // ① 清单每一项都真实存在于 dist（预缓存 404 一项 = install 整体失败 = SW 永远装不上）
  for (const url of precache) {
    const file = url === "/" ? "index.html" : url.slice(1);
    assert.ok(
      readFileSync(new URL(`../dist/${file}`, import.meta.url)).length > 0,
      `precache entry ${url} must exist and be non-empty in dist/`,
    );
  }

  // ② 应用壳与全量数据一个不落（离线全功能的根据）；插画绝不入内（11MB，运行时缓存）
  for (const must of ["/", "/manifest.webmanifest", "/apple-touch-icon.png", "/icons/app-icon-192.png"]) {
    assert.ok(precache.includes(must), `precache must include ${must}`);
  }
  for (const dir of ["assets", "data"]) {
    for (const f of readdirSync(new URL(`../dist/${dir}`, import.meta.url))) {
      if (f.includes(" ")) continue; // iCloud「xx 2.ext」本机副本，生成器同规则跳过
      assert.ok(precache.includes(`/${dir}/${f}`), `precache must include /${dir}/${f}`);
    }
  }
  assert.ok(!precache.some((u) => u.startsWith("/illustrations/")), "illustrations must never be precached");

  // ③ 同构钉：SW 的「缓存优先」判定必须与 Worker 的 immutable 长缓存判定逐字符一致——
  // 两边对「什么是内容 hash 命名的不可变资源」的答案不许漂移
  const workerSrc = readFileSync(new URL("../cloudflare/worker.mjs", import.meta.url), "utf8");
  assert.equal(
    sw.match(/const HASHED = (\/.+\/);/)?.[1],
    workerSrc.match(/const HASHED_ASSET = (\/.+\/);/)?.[1],
    "sw.js HASHED and worker.mjs HASHED_ASSET must stay literally identical",
  );

  // ④ 行为钉：用 self 桩执行 sw.js，取分类器核对四类路由（design M70 策略总纲）
  const self = { addEventListener() {}, location: { origin: "https://travel.xiaofan.me" } };
  new Function("self", sw)(self);
  const classify = (path, origin = "https://travel.xiaofan.me") =>
    self.__classify(new URL(path, origin), "https://travel.xiaofan.me");
  assert.equal(classify("/api/sync"), "bypass");
  assert.equal(classify("https://api.open-meteo.com/v1/forecast"), "bypass");
  assert.equal(classify("/assets/index-DX9WE6y3.js"), "hashed");
  assert.equal(classify("/data/chunk-0-2f4ef3f4b5.json"), "hashed");
  assert.equal(classify("/data/origin-guangzhou-f0b27ca235.json"), "hashed");
  assert.equal(classify("/illustrations/dest/foshan.webp"), "illust");
  for (const mutable of ["/", "/data/manifest.json", "/data/origins.json", "/manifest.webmanifest", "/sw.js"]) {
    assert.equal(classify(mutable), "mutable", `${mutable} must be network-first`);
  }

  // ⑤ 注册钉：PROD 产物入口 JS 里必须带着注册代码——sw.js 生成得再对，没人注册就全是死码
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const entry = html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
  const js = readFileSync(new URL(`../dist${entry}`, import.meta.url), "utf8");
  assert.ok(js.includes("serviceWorker") && js.includes("sw.js"), "built entry JS must register /sw.js");
});
