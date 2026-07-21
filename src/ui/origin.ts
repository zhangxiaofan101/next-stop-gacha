/* M22 出发地切换：页头胶囊入口（足迹胶囊同区同语言）+ 弹层选择器（同 skin.ts 习语）。
   视角文件按需 fetch + 内存缓存；fetch 失败提示并维持原出发地——视角文件与核心数据同一
   可用性等级，绝不静默显示错视角（design M22）。 */
import { BASE_ORIGIN, getOrigin, ORIGINS, originById, resolveOrigin, type Origin } from "../logic/origin";
import { setOrigin } from "../logic/origin";
import type { ViewMap } from "../logic/originView";
import { applyOriginView, getOriginChoice, setOriginChoice } from "../store";
import { $ } from "./dom";
import { toast } from "./toast";

// origins.json 索引：originId → 已发布视角 chunk 文件名（构建产物，缺文件=该出发地不可选）
let published: Record<string, string> = {};
const viewCache = new Map<string, ViewMap>();

// 切换后的全量刷新由 main.ts 注入（render/countPill 都在那边编排），避免 ui 模块环形依赖
let onSwitched: () => void = () => {};
export function wireOriginSwitch(cb: () => void) { onSwitched = cb; }

export function availableOrigins(): Origin[] {
  return ORIGINS.filter(o => o.id === BASE_ORIGIN.id || published[o.id]);
}

async function fetchView(o: Origin): Promise<ViewMap | null> {
  if (o.id === BASE_ORIGIN.id) return null; // 基座视角无需文件（null=恢复基座值）
  const file = published[o.id]; // 缓存按发布文件名（带内容 hash）——换部署=换文件名，天然不吃旧缓存
  const hit = viewCache.get(file);
  if (hit) return hit;
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!res.ok) throw new Error(String(res.status));
  const view = await res.json() as ViewMap;
  viewCache.set(file, view);
  return view;
}

/** 切到指定出发地；成功返回 true。失败 toast 并维持现状（quietFail 供测试/边角关提示） */
export async function switchOrigin(id: string, opts: { silent?: boolean } = {}): Promise<boolean> {
  const o = originById(id);
  if (!o || !availableOrigins().includes(o)) return false;
  if (o.id === getOrigin().id) return true;
  try {
    const view = await fetchView(o);
    setOrigin(o);
    applyOriginView(view);
    setOriginChoice(o.id);
    onSwitched();
    updateOriginPill();
    if (!opts.silent) toast(`出发地已切换：从${o.name}出发 🛫`);
    return true;
  } catch (e) {
    toast(`${o.name}视角数据加载失败，仍从${getOrigin().name}出发`);
    return false;
  }
}

/** boot：注入已发布索引并恢复上次选择（静默成功；加载失败会有 toast 提示回落） */
export async function restoreOrigin(idx: Record<string, string>) {
  published = idx;
  updateOriginPill();
  const want = resolveOrigin(getOriginChoice(), published);
  if (want.id !== getOrigin().id) await switchOrigin(want.id, { silent: true });
}

export function updateOriginPill() {
  const pill = $("originPill");
  pill.textContent = `🛫 ${getOrigin().name}出发`;
  // 只有基座一个可选项时选择器没有意义，胶囊整个不出（视角文件发布后自动出现）
  pill.style.display = availableOrigins().length > 1 ? "" : "none";
}

export function openOrigin() {
  renderOrigin();
  $("originOverlay").classList.add("show");
}

function renderOrigin() {
  const cur = getOrigin();
  $("originBody").innerHTML = `
    <h2 style="font-family:var(--round); margin:0 0 4px">🛫 从哪出发？</h2>
    <p style="font-size:13px;color:var(--ink-soft);margin:0 0 10px">交通与抵达难度按出发地视角重算，筛选、行程与路书跟着切换。</p>
    <div class="skin-opts">
      ${availableOrigins().map(o => `<button class="btn ${o.id === cur.id ? "on" : ""}" data-origin="${o.id}">${o.name}</button>`).join("")}
    </div>`;
}

// 事件走 events.ts 文档级委托（data-origin），同 data-skin 习语；切换后原地刷新高亮
export async function selectOrigin(id: string) {
  await switchOrigin(id);
  renderOrigin();
}
