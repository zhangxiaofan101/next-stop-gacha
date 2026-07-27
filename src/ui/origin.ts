/* M22 出发地切换：标语句尾内联文字钮入口 + 弹层选择器（同 skin.ts 习语）。
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

// 请求世代号（同 gacha.ts myGen / roadbook.ts rbWxGen 习语）：latest-request-wins。
// switchOrigin 每次调用（含下面同城早退分支）都先自增——「点当前城市」也要作废在途的异城 fetch，
// 否则悬起的旧请求晚到时会把界面从用户最后一次点击的城市拽走（F80）。
let gen = 0;

// 切换后的全量刷新由 main.ts 注入（render/countPill 都在那边编排），避免 ui 模块环形依赖
let onSwitched: () => void = () => {};
export function wireOriginSwitch(cb: () => void) { onSwitched = cb; }

export function availableOrigins(): Origin[] {
  return ORIGINS.filter(o => o.id === BASE_ORIGIN.id || published[o.id]);
}

async function fetchViewFile(file: string): Promise<ViewMap> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!res.ok) throw new Error(String(res.status));
  return await res.json() as ViewMap;
}

/** 重取视角索引（F92）。origins.json 是非 hash 命名的可变文件：SW 网络优先，断网才退缓存，
    而缓存里那份必与当前版本的视角文件同版（同一次预缓存取齐）——所以联网离线都拿得到「当下这版」的文件名。
    取不到（离线且无缓存/404/坏 JSON）返回 null，调用方按「索引没能刷新」处理。 */
async function refreshIndex(): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/origins.json`);
    if (!res.ok) return null;
    published = await res.json() as Record<string, string>;
    return published;
  } catch (e) { return null; }
}

async function fetchView(o: Origin): Promise<ViewMap | null> {
  if (o.id === BASE_ORIGIN.id) return null; // 基座视角无需文件（null=恢复基座值）
  const file = published[o.id]; // 缓存按发布文件名（带内容 hash）——换部署=换文件名，天然不吃旧缓存
  const hit = viewCache.get(file);
  if (hit) return hit;
  try {
    const view = await fetchViewFile(file);
    viewCache.set(file, view);
    return view;
  } catch (e) {
    // F92 版本漂移自修复：页面开着的这段时间里发过新版本——内存里的索引还指着旧 hash 文件名，
    // 而那个文件线上已不存在（SW 激活时也把旧版本缓存一并清了，见 tools/sw.template.js activate）。
    // 视角文件是全站唯一「按需才取」的 hash 资产，故这一处自修复就补齐了整个暴露面：重取索引拿
    // 新文件名再试一次。名字没变或索引也取不到=不是版本漂移这回事，照旧抛出走 toast 降级。
    const idx = await refreshIndex();
    const next = idx?.[o.id];
    if (!next || next === file) throw e;
    const view = await fetchViewFile(next);
    viewCache.set(next, view);
    return view;
  }
}

/** 切到指定出发地；成功（或已在途中被作废）返回值见下方注释。失败 toast 并维持现状（silent 供测试/边角关提示）。
    persist（默认 true）：是否把这次选择写进 localStorage 记忆——F78 打开分享副本时按分享者视角切一眼，
    persist:false 跳过记忆那一步（不覆盖访客自己的出发地偏好），其余副作用（换值/onSwitched 刷新/胶囊）照常。 */
export async function switchOrigin(id: string, opts: { silent?: boolean; persist?: boolean } = {}): Promise<boolean> {
  const my = ++gen; // 自增必须在同城早退判断之前，见上方 gen 声明处注释
  const o = originById(id);
  if (!o || !availableOrigins().includes(o)) return false;
  if (o.id === getOrigin().id) return true;
  try {
    const view = await fetchView(o);
    // 世代号对不上=在 await 期间已被更晚一次 switchOrigin（含同城早退）作废：静默放弃，
    // 不 setOrigin/不 applyView/不写 LS/不 toast——现状已经是用户最后一次点击落地的结果，不去动它。
    // 返回值选 false 而非 true：本次调用终究没能把出发地切到 o.id（语义="switched to o.id?"），
    // 与"无效 id / 不可选"两条早退路径的 false 语义一致；现有调用方（selectOrigin/restoreOrigin）
    // 都不看返回值，此处怎么选都不影响它们，选 false 只是让语义更准确。
    if (my !== gen) return false;
    setOrigin(o);
    applyOriginView(view);
    if (opts.persist !== false) setOriginChoice(o.id); // F78：分享副本切视角传 persist:false，不写记忆
    onSwitched();
    updateOriginPill();
    if (!opts.silent) toast(`出发地已切换：从${o.name}出发 🛫`);
    return true;
  } catch (e) {
    // 同上：已作废的请求，失败也不再打扰用户（早不是当前意图了）
    if (my !== gen) return false;
    toast(`${o.name}视角数据加载失败，仍从${getOrigin().name}出发`);
    return false;
  }
}

/** boot：注入已发布索引并恢复上次选择（静默成功；加载失败会有 toast 提示回落）。
    走 switchOrigin 同一个 gen 计数——boot 本身单发不受影响，纯粹是语义统一。 */
export async function restoreOrigin(idx: Record<string, string>) {
  published = idx;
  updateOriginPill();
  const want = resolveOrigin(getOriginChoice(), published);
  if (want.id !== getOrigin().id) await switchOrigin(want.id, { silent: true });
}

export function updateOriginPill() {
  const pill = $("originPill");
  pill.textContent = `${getOrigin().name}出发`;
  // 只有基座一个可选项时选择器没有意义，入口整个不出（视角文件发布后自动出现）
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
