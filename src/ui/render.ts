// 全局渲染编排 + 空池定向放宽的执行侧（候选计算在 logic/filter，DOM 复位在这里）。
import { CN_MAP } from "../cn-map";
import { filtered, LONG_TRIP_KM, relaxCandidates, SHORT_TRIP_KM, type RelaxAction, type RelaxCandidate } from "../logic/filter";
import { litProvinces } from "../logic/map";
import { getOrigin } from "../logic/origin";
import { matchIntent, type IntentAction } from "../logic/searchIntent";
import type { Destination, GroupKey } from "../logic/types";
import { byId, CUR_SEASON, DATA, state } from "../store";
import { cardHTML } from "./cards";
import { syncChips, updateChipCounts } from "./console";
import { renderDock } from "./dock";
import { $ } from "./dom";
import { ICONS } from "./icons";

// 放宽候选缓存：render()（空网格）与 openGacha()（空蛋池）写入，data-relax 点击按下标执行
let relaxCands: RelaxCandidate[] = [];
export function computeRelax(): RelaxCandidate[] {
  relaxCands = relaxCandidates(DATA, state);
  return relaxCands;
}
export function applyRelax(i: number) {
  const c = relaxCands[i];
  if (!c) return;
  applyRelaxAction(c.action); syncChips(); render();
}
function applyRelaxAction(a: RelaxAction) {
  switch (a.type) {
    case "dropTag": state.tags.delete(a.tag); break;
    case "clearGroup": state[a.key].clear(); break;
    case "clearQ": state.q = ""; $<HTMLInputElement>("searchBox").value = ""; break;
    case "clearOnlyFav": state.onlyFav = false; $("favToggle").classList.remove("on"); break;
    case "clearNoAlt": state.noAlt = false; $("altToggle").classList.remove("on"); break;
    case "clearHideVisited": state.hideVisited = false; $("visitedToggle").classList.remove("on"); break;
    case "clearDistMode": state.distMode = null; break;
  }
}

// M68：概念词→筛选 chip——点击即「应用对应筛选并清搜索词」（design 原话）。setGroup 的合并/替换
// 按组语义分叉（F71 修复）：偏好型 OR 组（地区/季节/人气/体力/同行，design「决策机制·过滤」）选中
// 取并集——沿用旧选中会把概念词想要的语义扩大而非限定（已选「冬」时按「避暑」= {冬,夏}，冬季-only
// 卡仍会命中，与按钮承诺的「按刚输入的概念筛选」相悖），故这里改为替换该组为单一新值；AND 型的玩法
// 标签（tags）继续合并进现有选中——多个标签本就是收窄语义，合并不改变「按刚请求筛选」的直觉。
const OR_PREF_GROUPS: ReadonlySet<GroupKey> = new Set(["region", "season", "crowd", "effort", "companions"]);
export function applyIntent() {
  const entry = matchIntent(state.q);
  if (!entry) return;
  applyIntentAction(entry.action);
  state.q = ""; $<HTMLInputElement>("searchBox").value = "";
  syncChips(); render();
}
function applyIntentAction(a: IntentAction) {
  switch (a.type) {
    case "setGroup":
      state[a.key] = OR_PREF_GROUPS.has(a.key) ? new Set([a.value]) : new Set(state[a.key]).add(a.value);
      break;
    case "setDistMode": state.distMode = a.mode; break;
  }
}

// F72 修复：distMode 不新增筛选行（design 拍板），但也不能应用后就没有任何可见/可单独撤销的
// 入口——之前只能靠「清空筛选」连同其余 9 组一起清掉。复用 #intentBox 呈现一枚常驻 active chip
// （与「按筛选看」建议 chip 共存，互不冲突），单独点掉只清 distMode 一项。
export function clearDistModeFilter() {
  state.distMode = null;
  syncChips(); render();
}

// M22：头部总数胶囊与命中分母都按「当前出发地可见池」计（本城卡对偶隐藏，不把被藏的
// 本城卡算进「共 N 个」——分母诚实）。boot 与出发地切换后都走这里。
export function updateCountPill() {
  const pool = DATA.filter(d => d.id !== getOrigin().cardId);
  $("countPill").textContent = `🗺 ${pool.filter(d => !d.stops).length} 个目的地 · ${pool.filter(d => d.stops).length} 条线路 · 现在是${CUR_SEASON}天`;
}

export function render() {
  const list = filtered(DATA, state, CUR_SEASON);
  $("grid").innerHTML = list.map(cardHTML).join("");
  $("empty").style.display = list.length ? "none" : "block";
  $("hitCount").textContent = `命中 ${list.length} / ${DATA.filter(d => d.id !== getOrigin().cardId).length}`;
  if (!list.length) {
    computeRelax();
    $("relaxBox").innerHTML = relaxCands.slice(0, 3).map((c, i) =>
      `<button class="btn relax" data-relax="${i}">${c.label} → 能救回 ${c.n} 个</button>`).join("");
  }
  // M68：搜索词命中概念词（短途/避暑/海岛…）时给一键筛选 chip，与字面命中数无关——搜「短途」
  // 全军覆没也照样出，因为它本就不指望字面命中，是「按你想要的语义直接跳筛选」的捷径
  const intent = matchIntent(state.q);
  const suggestChip = intent ? `<button class="btn intent" data-intent>按筛选看：${intent.label}</button>` : "";
  // F72：distMode 生效时的常驻可撤销 chip（与上面的建议 chip 互不冲突，可同时出现）
  const distChip = state.distMode
    ? `<button class="btn intent active" data-clear-dist>已按${state.distMode === "short" ? `短途·≤${SHORT_TRIP_KM}km` : `长途·>${LONG_TRIP_KM}km`}筛选 ✕</button>`
    : "";
  $("intentBox").innerHTML = distChip + suggestChip;
  updateChipCounts();
  renderDock();
  updateFootprint();
}

// 足迹口径（F11）：地图填色、地图统计条、足迹胶囊三处同源——都走这一个函数
export function litVisitedProvinces(): string[] {
  return litProvinces(state.visited.map(byId).filter(Boolean) as Destination[], CN_MAP.prov);
}
export function updateFootprint() {
  // M50 修订：胶囊即地图入口，常显——零打卡时给引导文案而非隐藏（隐藏会连地图入口一起丢）
  const pill = $("footPill");
  const n = state.visited.length;
  pill.innerHTML = n
    ? `${ICONS.footprints} 去过 ${n} 个目的地 · 点亮 ${litVisitedProvinces().length} 个省份`
    : `${ICONS.footprints} 足迹地图 · 打卡第一站吧`;
  pill.style.display = "";
}
