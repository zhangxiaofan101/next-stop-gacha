/* M70：Service Worker 生成器——构建后置步骤（package.json "build" 里跟在 vite build 后），
   扫描 dist/ 产出预缓存清单与内容版本号，注入 tools/sw.template.js 写出 dist/sw.js。

   预缓存边界（design M70「离线覆盖面」）：应用壳 + 全量数据 ≈2MB——
   ① 固定入口：/（index.html）、manifest.webmanifest、apple-touch-icon.png、icons/app-icon-192.png
      （512/1024px 图标只在安装动作时被系统取用，不占离线预算）；
   ② 扫描 dist/assets/（hash 命名的 JS/CSS/字体全量）与 dist/data/（chunk/origin/两份索引全量）。
   illustrations/ 绝不入清单（11MB，走 SW 运行时 stale-while-revalidate）。

   版本号 = 清单每项「URL + 文件内容」的聚合 sha256 前 12 位：任何预缓存内容变化（哪怕
   index.html 一字节）都产出新 sw.js，驱动浏览器按 SW 生命周期原子换版。 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");

// URL → dist 内相对文件路径
const FIXED = new Map([
  ["/", "index.html"],
  ["/manifest.webmanifest", "manifest.webmanifest"],
  ["/apple-touch-icon.png", "apple-touch-icon.png"],
  ["/icons/app-icon-192.png", "icons/app-icon-192.png"],
]);

// iCloud 同步会在本机落「xx 2.ext」空格副本（state 🟡 有案底）——含空格文件名一律不进清单，
// 否则本机构建的 sw.js 会预缓存一堆线上不存在的 404，install 永远失败。
function scanDir(sub) {
  return readdirSync(join(DIST, sub))
    .filter((f) => !f.includes(" ") && statSync(join(DIST, sub, f)).isFile())
    .sort()
    .map((f) => [`/${sub}/${f}`, `${sub}/${f}`]);
}

const entries = [...FIXED, ...scanDir("assets"), ...scanDir("data")];

// 自洽守卫：构建产物形状变了（脚本/样式/数据索引缺失）宁可炸构建也不发一个装不上的 SW
const urls = entries.map(([u]) => u);
const expect = [
  [/^\/assets\/index-[\w-]+\.js$/, "入口 JS"],
  [/^\/assets\/index-[\w-]+\.css$/, "入口 CSS"],
  [/^\/data\/manifest\.json$/, "数据清单"],
  [/^\/data\/origins\.json$/, "视角索引"],
  [/^\/data\/chunk-\d+-[0-9a-f]+\.json$/, "数据 chunk"],
  [/^\/data\/origin-[a-z0-9-]+-[0-9a-f]+\.json$/, "视角文件"],
];
for (const [re, label] of expect) {
  if (!urls.some((u) => re.test(u))) {
    console.error(`!! 预缓存清单缺${label}（${re}）——dist/ 形状不对，先跑完整构建`);
    process.exit(1);
  }
}
if (urls.some((u) => u.startsWith("/illustrations/"))) {
  console.error("!! 插画混进了预缓存清单——违反 design M70 离线覆盖面边界");
  process.exit(1);
}

const hash = createHash("sha256");
let totalBytes = 0;
for (const [url, file] of entries) {
  const buf = readFileSync(join(DIST, file));
  if (!buf.length) {
    console.error(`!! 预缓存项 ${url} 是空文件`);
    process.exit(1);
  }
  totalBytes += buf.length;
  hash.update(url).update("\0").update(buf);
}
const version = hash.digest("hex").slice(0, 12);

const template = readFileSync(join(ROOT, "tools", "sw.template.js"), "utf8");
const out = template
  .replace("__CACHE_VERSION__", version)
  .replace("__PRECACHE_MANIFEST__", JSON.stringify(urls, null, 1));
writeFileSync(join(DIST, "sw.js"), out);
console.log(`sw.js 生成完毕：版本 ${version}，预缓存 ${urls.length} 项 / ${(totalBytes / 1024 / 1024).toFixed(2)}MB`);
