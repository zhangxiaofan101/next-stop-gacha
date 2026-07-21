// 全局渲染编排 + 空池定向放宽的执行侧（候选计算在 logic/filter，DOM 复位在这里）。
import { CN_MAP } from "../cn-map";
import { filtered, relaxCandidates, type RelaxAction, type RelaxCandidate } from "../logic/filter";
import { litProvinces } from "../logic/map";
import { matchIntent, type IntentAction } from "../logic/searchIntent";
import type { Destination } from "../logic/types";
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

// M68：概念词→筛选 chip——点击即「应用对应筛选并清搜索词」（design 原话），setGroup 合并进该组
// 现有选中（同用户手动点一下那颗 chip 的效果，不清空该组其余已选值）。
export function applyIntent() {
  const entry = matchIntent(state.q);
  if (!entry) return;
  applyIntentAction(entry.action);
  state.q = ""; $<HTMLInputElement>("searchBox").value = "";
  syncChips(); render();
}
function applyIntentAction(a: IntentAction) {
  switch (a.type) {
    case "setGroup": state[a.key] = new Set(state[a.key]).add(a.value); break;
    case "setDistMode": state.distMode = a.mode; break;
  }
}

export function render() {
  const list = filtered(DATA, state, CUR_SEASON);
  $("grid").innerHTML = list.map(cardHTML).join("");
  $("empty").style.display = list.length ? "none" : "block";
  $("hitCount").textContent = `命中 ${list.length} / ${DATA.length}`;
  if (!list.length) {
    computeRelax();
    $("relaxBox").innerHTML = relaxCands.slice(0, 3).map((c, i) =>
      `<button class="btn relax" data-relax="${i}">${c.label} → 能救回 ${c.n} 个</button>`).join("");
  }
  // M68：搜索词命中概念词（短途/避暑/海岛…）时给一键筛选 chip，与字面命中数无关——搜「短途」
  // 全军覆没也照样出，因为它本就不指望字面命中，是「按你想要的语义直接跳筛选」的捷径
  const intent = matchIntent(state.q);
  $("intentBox").innerHTML = intent ? `<button class="btn intent" data-intent>按筛选看：${intent.label}</button>` : "";
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
