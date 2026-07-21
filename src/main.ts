// 入口：数据加载 + 启动编排。业务逻辑在 src/logic/（纯函数，Vitest 覆盖），
// 视图在 src/ui/（按视图切分的模板渲染模块），状态与持久化在 src/store.ts。
import "./style.css";
import type { Destination } from "./logic/types";
import { applySkinVisuals, currentSkinId, wireIllustFallbacks } from "./skins/illustrations";
import { loadLS, setData, state } from "./store";
import { buildConsole } from "./ui/console";
import { $ } from "./ui/dom";
import { wireEvents } from "./ui/events";
import { restoreOrigin, wireOriginSwitch } from "./ui/origin";
import { render, updateCountPill } from "./ui/render";
import { checkShareCode, checkShareHash } from "./ui/share";

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

// M22：已发布出发地视角索引（originId → 视角 chunk 文件名）。独立小文件而非并进 manifest
// ——manifest 保持「城市数据 chunk 文件名数组」的既有形状不动；索引取不到=只有基座上海
// 可选（出发地是增强视角，同后端「从不是可用性前提」哲学，静默降级）。
async function loadOriginsIndex(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/origins.json`);
    return res.ok ? await res.json() : {};
  } catch (e) { return {}; }
}

/* ================= 启动 ================= */
function boot() {
  loadLS();
  $<HTMLInputElement>("tripStartInput").value = state.tripStart;
  updateCountPill(); // M22：总数按当前出发地可见池计（本城卡对偶隐藏）
  buildConsole();
  render();
  checkShareHash();
  checkShareCode(); // M40：短链是增强形态，异步取回不阻塞其余启动（同后端「从不是可用性前提」哲学）
}

wireEvents();
// M46：head 内联脚本已同步钉死 data-theme（防闪烁），这里只需按它把静态装饰位（吉祥物/扭蛋机/
// 空态/自由装饰件）的图接上——不依赖 loadData()，越早跑越好，不用等城市数据回来。
wireIllustFallbacks();
applySkinVisuals(currentSkinId());
addEventListener("hashchange", checkShareHash); // 页面开着时粘贴迁移链接也能触发导入条

(async () => {
  try {
    // M22：视角索引与城市数据并行取；恢复上次出发地在首屏渲染前完成（避免先闪上海视角再跳变）
    const [data, originsIdx] = await Promise.all([loadData(), loadOriginsIndex()]);
    setData(data);
    await restoreOrigin(originsIdx);
  } catch (e) {
    document.body.insertAdjacentHTML("afterbegin",
      `<div style="padding:16px;text-align:center;color:var(--red)">数据加载失败，请刷新重试</div>`);
    throw e;
  }
  boot();
  // 出发地切换后的全量刷新（boot 之后接线：restore 阶段视角已就位，无需重复渲染）
  wireOriginSwitch(() => { updateCountPill(); render(); });
})();
