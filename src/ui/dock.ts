// dock 有内容才显示（2026-07-14 用户真机使用后否决空态常驻方案，回退隐藏；显示时奶油底色与白色页面区分）
import { byId, state } from "../store";
import { $ } from "./dom";

// M86：计数脉冲——上次渲染的计数存模块级变量，只在「比上次变多」时触发一次。null 起手跳过
// 首帧：否则刚从 localStorage 恢复已有对比/行程时，开屏就白白闪一次脉冲，不是真正的「新增」。
let lastCmpCount: number | null = null;
let lastTripCount: number | null = null;
// 测试辅助：重置脉冲基线（happy-dom 里模块状态跨用例存活，beforeEach 用；下划线前缀＝非生产
// 入口，同 gacha.ts _resetGachaSession 惯例）
export function _resetDockPulse() { lastCmpCount = null; lastTripCount = null; }
function pulse(el: HTMLElement) {
  el.classList.remove("pulse");
  void el.offsetWidth; // 强制 reflow，让同一个 class 能在同一帧里被重新触发动画（而不是被去重成没变化）
  el.classList.add("pulse");
}

export function renderDock() {
  const hasCmp = state.cmp.length > 0, hasTrip = state.trip.length > 0;
  $("dock").classList.toggle("show", hasCmp || hasTrip);
  $("cmpBox").style.display = hasCmp ? "flex" : "none";
  $("tripBox").style.display = hasTrip ? "flex" : "none";

  const cmpCountEl = $("cmpCount"), tripCountEl = $("tripCount");
  cmpCountEl.textContent = `· ${state.cmp.length}`;
  tripCountEl.textContent = `· ${state.trip.length} 站`;
  if (lastCmpCount !== null && state.cmp.length > lastCmpCount) pulse(cmpCountEl);
  if (lastTripCount !== null && state.trip.length > lastTripCount) pulse(tripCountEl);
  lastCmpCount = state.cmp.length; lastTripCount = state.trip.length;

  // M86：chip 拆两区——名字区开详情（复用 data-mapdot 既有委托，events.ts 里就是「点了就 openDetail」，
  // 与地图点位共用同一套语义）、✕ 区单独移除，中间一条细分隔线；整名不再可点即删（原「点 chip=删」
  // 误触面全站最大，见 design M86），hover 划线样式随之一并去掉。
  $("cmpItems").innerHTML = state.cmp.map(id => {
    const d = byId(id)!;
    return `<span class="dock-chip">` +
      `<button class="dock-chip-name" data-mapdot="${id}" aria-label="查看${d.name}详情"><span class="emo">${d.emoji}</span>${d.name}</button>` +
      `<button class="dock-chip-x" data-rmcmp="${id}" aria-label="从对比中移除${d.name}">✕</button>` +
    `</span>`;
  }).join("");
  $("tripItems").innerHTML = state.trip.map(t => {
    const d = byId(t.id)!;
    return `<span class="dock-chip">` +
      `<button class="dock-chip-name" data-mapdot="${t.id}" aria-label="查看${d.name}详情"><span class="emo">${d.emoji}</span>${d.name}</button>` +
      `<button class="dock-chip-x" data-rmtrip="${t.id}" aria-label="从行程中移除${d.name}">✕</button>` +
    `</span>`;
  }).join("");
}
