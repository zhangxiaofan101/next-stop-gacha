/* 对比 */
import type { Destination } from "../logic/types";
import { byId, state } from "../store";
import { $ } from "./dom";
import { toast } from "./toast";

export function openCompare() {
  const ds = state.cmp.map(byId) as Destination[];
  if (ds.length < 2) { toast("至少选 2 个再比嘛"); return; }
  const row = (label: string, fn: (d: Destination) => string) => `<tr><th class="rowh">${label}</th>${ds.map(d => `<td>${fn(d)}</td>`).join("")}</tr>`;
  $("cmpTableWrap").innerHTML = `
  <table class="cmp">
    <tr><th class="rowh">目的地</th>${ds.map(d => `<td class="cityh"><button class="cmp-del" data-rmcmp="${d.id}" aria-label="移出对比：${d.name}">✕</button>${d.emoji} ${d.name}<br><span class="sm">${d.province} · ${d.region}</span></td>`).join("")}</tr>
    ${row("一句话", d => d.tagline)}
    ${row("冷热 / 花费", d => `${d.crowd} · ${d.cost}`)}
    ${row("体力", d => (d.effort.length ? d.effort.join("、") : "怎么玩都行") + (d.alt ? " · ⛰️ 高海拔" : ""))}
    ${row("同行", d => d.companions.length ? d.companions.join("、") : "谁来都合适")}
    ${row("最佳季节", d => d.seasons.join("、") + `<br><span class="sm">${d.seasonNote}</span>`)}
    ${row("建议天数", d => d.days.join(" / ") + " 天")}
    ${row("交通", d => `${d.transit}（${d.difficulty}）`)}
    ${row("美食", d => d.food.join("、"))}
    ${row("博物馆", d => d.museums.join("、") || "—")}
    ${row("古建古迹", d => d.architecture.join("、") || "—")}
    ${row("住宿", d => d.hotel || "—")}
    ${row("特色体验", d => d.highlights.map(h => "· " + h).join("<br>"))}
    ${row("方案", d => d.plans.map(p => `<b>${p.days}天 ${p.title}</b>：${p.route}`).join("<br>"))}
  </table>`;
  $("cmpOverlay").classList.add("show");
}
