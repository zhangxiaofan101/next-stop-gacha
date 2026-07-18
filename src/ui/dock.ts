// dock 有内容才显示（2026-07-14 用户真机使用后否决空态常驻方案，回退隐藏；显示时奶油底色与白色页面区分）
import { byId, state } from "../store";
import { $ } from "./dom";

export function renderDock() {
  const hasCmp = state.cmp.length > 0, hasTrip = state.trip.length > 0;
  $("dock").classList.toggle("show", hasCmp || hasTrip);
  $("cmpBox").style.display = hasCmp ? "flex" : "none";
  $("tripBox").style.display = hasTrip ? "flex" : "none";
  $("cmpItems").innerHTML = state.cmp.map(id => {
    const d = byId(id)!; return `<button class="dock-chip" data-rmcmp="${id}" aria-label="从对比中移除${d.name}">${d.emoji}${d.name} ✕</button>`;
  }).join("");
  $("tripItems").innerHTML = state.trip.map(t => {
    const d = byId(t.id)!; return `<button class="dock-chip" data-rmtrip="${t.id}" aria-label="从行程中移除${d.name}">${d.emoji}${d.name} ✕</button>`;
  }).join("");
}
