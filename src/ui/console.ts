/* 筛选面板 */
import { CEIL_GROUPS, COMPANIONS, CROWDS, DAY_BUCKETS, EFFORTS, REGIONS, SEASONS, TAGS } from "../logic/constants";
import { countWith, simulateChipClick } from "../logic/filter";
import type { GroupKey } from "../logic/types";
import { DATA, state } from "../store";
import { $ } from "./dom";
import { render } from "./render";

export function buildConsole() {
  const el = $("console");
  const group = (label: string, key: string, items: any[], valFn: (v: any) => string = v => v) => `
    <div class="fgroup">
      <div class="flabel">${label}</div>
      <div class="chips" data-key="${key}">
        ${items.map(it => `<button class="chip" data-v="${valFn(it)}">${typeof it === "string" ? it : it.label}</button>`).join("")}
      </div>
    </div>`;
  el.innerHTML =
    `<div class="console-bar">
      <input class="search" id="searchBox" type="search" placeholder="搜城市 / 美食 / 关键词，比如「牛肉火锅」「石窟」…">
      <button class="btn" id="filterToggle" aria-expanded="false" aria-controls="consoleBody">筛选<i id="filterBadge"></i><span class="fcaret" aria-hidden="true">▾</span></button>
    </div>
    <div class="console-body" id="consoleBody">` +
    group("地区", "region", REGIONS) +
    group("季节", "season", SEASONS) +
    group("天数", "days", DAY_BUCKETS, b => b.key) +
    group("冷热", "crowd", CROWDS) +
    group("花费", "cost", [{ label: "¥ 经济", v: "¥" }, { label: "¥¥ 适中", v: "¥¥" }, { label: "¥¥¥ 舍得花", v: "¥¥¥" }], c => c.v) +
    group("抵达", "difficulty", CEIL_GROUPS.difficulty!) +
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
      box.querySelectorAll<HTMLElement>(".chip").forEach(c => c.classList.toggle("on", state[key].has(c.dataset.v!)));
      render();
    });
  });
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
  state.q = ""; state.onlyFav = false; state.noAlt = false; state.hideVisited = false;
  $<HTMLInputElement>("searchBox").value = "";
  document.querySelectorAll(".chip.on").forEach(c => c.classList.remove("on"));
  render();
}

// 每个未选 chip 标注"点下去还剩几个"，0 置灰；已选 chip 不标（点它是取消）
export function updateChipCounts() {
  document.querySelectorAll<HTMLElement>("#console .chips").forEach(box => {
    const key = box.dataset.key as GroupKey;
    box.querySelectorAll<HTMLElement>(".chip").forEach(btn => {
      const v = btn.dataset.v!;
      const on = state[key].has(v);
      const n = on ? -1 : countWith(DATA, state, key, simulateChipClick(state, key, v));
      let i = btn.querySelector("i");
      if (!i) { i = document.createElement("i"); btn.appendChild(i); }
      i.textContent = on ? "" : String(n);
      btn.classList.toggle("zero", !on && n === 0);
    });
  });
  updateFilterBadge();
}

// 手机收纳态入口按钮上的已选计数徽章：9 个分组维度 + 3 个开关，q 不计入（搜索框本身就在收纳条上可见）
function updateFilterBadge() {
  const badge = document.getElementById("filterBadge");
  if (!badge) return;
  const groupKeys: GroupKey[] = ["region", "season", "days", "crowd", "cost", "difficulty", "effort", "companions", "tags"];
  let n = groupKeys.reduce((sum, k) => sum + (state[k].size > 0 ? 1 : 0), 0);
  if (state.noAlt) n++;
  if (state.onlyFav) n++;
  if (state.hideVisited) n++;
  badge.textContent = n > 0 ? String(n) : "";
}

export function syncChips() {
  document.querySelectorAll<HTMLElement>("#console .chips").forEach(box => {
    const set = state[box.dataset.key as GroupKey];
    box.querySelectorAll<HTMLElement>(".chip").forEach(c => c.classList.toggle("on", set.has(c.dataset.v!)));
  });
}
