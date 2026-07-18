// 入口：数据加载 + 启动编排。业务逻辑在 src/logic/（纯函数，Vitest 覆盖），
// 视图在 src/ui/（按视图切分的模板渲染模块），状态与持久化在 src/store.ts。
import "./style.css";
import type { Destination } from "./logic/types";
import { CUR_SEASON, DATA, loadLS, setData, state } from "./store";
import { buildConsole } from "./ui/console";
import { $ } from "./ui/dom";
import { wireEvents } from "./ui/events";
import { render } from "./ui/render";
import { checkShareHash } from "./ui/share";

// ================= M37 数据外置 =================
// 目的地/线路数据不再注入本文件，而是由 tools/build.py 校验后发布到 public/data/
// 的静态 chunk（见 data/manifest.json 列出的固定顺序），运行时并行 fetch 后按该顺序
// 拼接，与旧版单文件构建时 `merged = sorted(...)` 产出的全局顺序等价——顺序影响
// filtered() 默认（未选排序方式时）的展示顺序，故拼接顺序不可用 fetch 完成顺序代替。
async function loadData(): Promise<Destination[]> {
  // import.meta.env.BASE_URL（= vite.config.ts 的 base，"/next-stop-gacha/"）而非相对路径：
  // 相对路径在当前唯一入口下也能凑巧解析对，但显式用 Vite 的 base 常量不依赖调用时机/页面
  // URL 形状，与 F39 的教训一致——资产引用必须落在 Worker 路由前缀内，不能假设隐式解析。
  const base = import.meta.env.BASE_URL;
  const manifest: string[] = await fetch(`${base}data/manifest.json`).then(r => r.json());
  const chunks: Destination[][] = await Promise.all(manifest.map(f => fetch(`${base}data/${f}`).then(r => r.json())));
  return chunks.flat();
}

/* ================= 启动 ================= */
function boot() {
  loadLS();
  $<HTMLInputElement>("tripStartInput").value = state.tripStart;
  $("countPill").textContent = `🗺 ${DATA.filter(d => !d.stops).length} 个目的地 · ${DATA.filter(d => d.stops).length} 条线路 · 现在是${CUR_SEASON}天`;
  buildConsole();
  render();
  checkShareHash();
}

wireEvents();
addEventListener("hashchange", checkShareHash); // 页面开着时粘贴迁移链接也能触发导入条

(async () => {
  try {
    setData(await loadData());
  } catch (e) {
    document.body.insertAdjacentHTML("afterbegin",
      `<div style="padding:16px;text-align:center;color:#ef6461">数据加载失败，请刷新重试</div>`);
    throw e;
  }
  boot();
})();
