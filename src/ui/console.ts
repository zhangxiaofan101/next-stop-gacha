/* 筛选面板 */
import { COMPANIONS, CROWDS, DAY_BUCKETS, EFFORTS, PER_DAY_COST, REGIONS, SEASONS, TAGS } from "../logic/constants";
import { countWith, simulateChipClick } from "../logic/filter";
import type { GroupKey } from "../logic/types";
import { DATA, state } from "../store";
import { $ } from "./dom";
import { render } from "./render";

// M78：三个容忍型组（花费/抵达/天数）行首显性「不限」chip，占位值 data-v=""——不与该组任何
// 真实档位重叠，simulateChipClick 对天花板组传入组外值时天然清空（curCeil≠t 但补位区间为空），
// 组已空时点它落在 curCeil===t(-1) 的 no-op 分支，三态行为不需要额外分支代码，只需渲染层按
// 「组为空即点亮」补上 on/aria-pressed（不能沿用 state[key].has(v)，"" 永不在集合里）。
const UNLIMITED_CHIP = { label: "不限", v: "" };
const isChipOn = (key: GroupKey, v: string): boolean => v === "" ? state[key].size === 0 : state[key].has(v);

export function buildConsole() {
  const el = $("console");
  const group = (label: string, key: string, items: any[], valFn: (v: any) => string = v => v) => `
    <div class="fgroup">
      <div class="flabel">${label}</div>
      <div class="chips" data-key="${key}">
        ${items.map(it => {
          const v = valFn(it);
          const aria = v === "" ? ` aria-pressed="false"` : "";
          return `<button class="chip" data-v="${v}"${aria}>${typeof it === "string" ? it : it.label}</button>`;
        }).join("")}
      </div>
    </div>`;
  el.innerHTML =
    `<div class="console-bar">
      <input class="search" id="searchBox" type="search" placeholder="搜城市 / 美食 / 关键词，比如「牛肉火锅」「短途」…">
      <button class="btn" id="filterToggle" aria-expanded="false" aria-controls="consoleBody">筛选<i id="filterBadge"></i><span class="fcaret" aria-hidden="true">▼</span></button>
    </div>
    <div class="console-body" id="consoleBody">` +
    group("地区", "region", REGIONS) +
    group("季节", "season", SEASONS) +
    group("天数", "days", [UNLIMITED_CHIP, ...DAY_BUCKETS.map(b => ({ label: b.label, v: b.key }))], b => b.v) +
    group("冷热", "crowd", CROWDS) +
    // M78：天花板「以内」化+顶档裁撤——¥¥¥/折腾选中即全含=不限，冗余，chip 行不再单列；
    // 日均价从 PER_DAY_COST 拼出，不留第二份硬编码数字
    group("花费", "cost", [
      UNLIMITED_CHIP,
      { label: `¥ ≈${PER_DAY_COST["¥"]}/天内`, v: "¥" },
      { label: `¥¥ ≈${PER_DAY_COST["¥¥"]}/天内`, v: "¥¥" },
    ], c => c.v) +
    group("抵达", "difficulty", [
      UNLIMITED_CHIP,
      { label: "直达", v: "直达" },
      { label: "一次中转内", v: "一次中转" },
    ], c => c.v) +
    group("体力", "effort", EFFORTS) +
    group("同行", "companions", COMPANIONS) +
    group("玩法", "tags", TAGS) +
    `<div class="fgroup">
      <div class="flabel">偏好</div>
      <div class="chip-row">
        <button class="chip" id="altToggle">⛰️ 避开高海拔</button>
        <button class="chip" id="favToggle">♥ 只看收藏</button>
        <button class="chip" id="visitedToggle">👣 隐藏去过的</button>
      </div>
    </div>
    <div class="console-foot">
      <select class="sort" id="sortSel">
        <option value="default">推荐顺序</option>
        <option value="season">当季优先</option>
        <option value="hidden">小众优先</option>
        <option value="hot">热门优先</option>
        <option value="short">天数短 → 长</option>
        <option value="dist">距离近 → 远</option>
      </select>
      <button class="btn" id="resetConsoleBtn">清空筛选</button>
      <div class="hit" id="hitCount"></div>
    </div>
    </div>`;

  el.querySelectorAll<HTMLElement>(".chips").forEach(box => {
    box.addEventListener("click", e => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(".chip");
      if (!btn) return;
      const key = box.dataset.key as GroupKey;
      const v = btn.dataset.v!;
      // 天花板型：点第 t 档 → 选中 0..t 全部；再点当前天花板则清空。其余组 toggle。
      // 语义与「点下去还剩几个」计数共用 simulateChipClick 这一个源。
      state[key] = simulateChipClick(state, key, v);
      syncBox(box, key);
      render();
    });
  });
  syncChips(); // M78：「不限」chip 初始点亮态由当前 state 决定，不硬编码进模板
  $<HTMLInputElement>("searchBox").addEventListener("input", e => { state.q = (e.target as HTMLInputElement).value.trim(); render(); });
  $<HTMLSelectElement>("sortSel").addEventListener("change", e => { state.sort = (e.target as HTMLSelectElement).value; render(); });
  $("favToggle").addEventListener("click", e => {
    state.onlyFav = !state.onlyFav;
    (e.target as HTMLElement).classList.toggle("on", state.onlyFav);
    render();
  });
  $("altToggle").addEventListener("click", e => {
    state.noAlt = !state.noAlt;
    (e.target as HTMLElement).classList.toggle("on", state.noAlt);
    render();
  });
  $("visitedToggle").addEventListener("click", e => {
    state.hideVisited = !state.hideVisited;
    (e.target as HTMLElement).classList.toggle("on", state.hideVisited);
    render();
  });
  // F40：module 化后顶层函数不再落到 window，inline onclick="resetFilters()" 会报
  // ReferenceError——清空按钮走 addEventListener，与本函数其余按钮一致
  $("resetConsoleBtn").addEventListener("click", resetFilters);
  // M47：手机收纳——纯呈现折叠，只切 class，不碰 state/不 render，展开/收起不丢已选状态；
  // aria-expanded 随切换同步（F57：disclosure 状态对读屏可见，桌面端按钮本身 display:none 不受影响）
  $("filterToggle").addEventListener("click", e => {
    const open = el.classList.toggle("open");
    const btn = e.currentTarget as HTMLElement;
    btn.classList.toggle("on", open);
    btn.setAttribute("aria-expanded", String(open));
  });
}

export function resetFilters() {
  (["region", "season", "days", "crowd", "cost", "difficulty", "effort", "companions", "tags"] as GroupKey[]).forEach(k => state[k].clear());
  state.q = ""; state.onlyFav = false; state.noAlt = false; state.hideVisited = false; state.distMode = null;
  $<HTMLInputElement>("searchBox").value = "";
  syncChips(); // 三组全空后「不限」chip 应重新点亮，不能只摘 .on（M78 前是直接摘，恰好没有需要重新点亮的 chip）
  render();
}

// 每个未选 chip 标注"点下去还剩几个"，0 置灰；已选 chip 不标（点它是取消）。
// 「不限」chip 的 on 判定见 isChipOn：为空即已不限，非空时按 simulateChipClick 算清空该组能救回几个
export function updateChipCounts() {
  document.querySelectorAll<HTMLElement>("#console .chips").forEach(box => {
    const key = box.dataset.key as GroupKey;
    box.querySelectorAll<HTMLElement>(".chip").forEach(btn => {
      const v = btn.dataset.v!;
      const on = isChipOn(key, v);
      const n = on ? -1 : countWith(DATA, state, key, simulateChipClick(state, key, v));
      let i = btn.querySelector("i");
      if (!i) { i = document.createElement("i"); btn.appendChild(i); }
      i.textContent = on ? "" : String(n);
      btn.classList.toggle("zero", !on && n === 0);
    });
  });
  updateFilterBadge();
}

// 手机收纳态入口按钮上的已选计数徽章：9 个分组维度 + 3 个开关 + distMode，q 不计入（搜索框本身
// 就在收纳条上可见）。F72：distMode 此前未计入徽章——只开短途/长途时徽章显示为空，看起来像
// 「无筛选生效」，与扭蛋池说明暗中限距离一样是不可见幽灵筛选，一并补上。
function updateFilterBadge() {
  const badge = document.getElementById("filterBadge");
  if (!badge) return;
  const groupKeys: GroupKey[] = ["region", "season", "days", "crowd", "cost", "difficulty", "effort", "companions", "tags"];
  let n = groupKeys.reduce((sum, k) => sum + (state[k].size > 0 ? 1 : 0), 0);
  if (state.noAlt) n++;
  if (state.onlyFav) n++;
  if (state.hideVisited) n++;
  if (state.distMode) n++;
  badge.textContent = n > 0 ? String(n) : "";
}

// 单个 chip 行的 on/aria-pressed 同步——点击回调与 syncChips() 共用，避免两处判定漂移
function syncBox(box: HTMLElement, key: GroupKey) {
  box.querySelectorAll<HTMLElement>(".chip").forEach(c => {
    const v = c.dataset.v!;
    const on = isChipOn(key, v);
    c.classList.toggle("on", on);
    if (v === "") c.setAttribute("aria-pressed", String(on)); // 仅「不限」chip 补 aria——其余 chip 的读屏语言不在本次改动范围内
  });
}

export function syncChips() {
  document.querySelectorAll<HTMLElement>("#console .chips").forEach(box => syncBox(box, box.dataset.key as GroupKey));
}
