/* 行程规划（行程单渲染 + 顺路彩蛋展示；决策全部在 logic/itinerary） */
import { getOrigin } from "../logic/origin";
import { REGION_COLOR, TRIP_MAX } from "../logic/constants";
import { bestInsertion, nearestNeighborOrder, onwaySuggestions, tripLegs, tripStops } from "../logic/itinerary";
import { tripBudget } from "../logic/budget";
import { fmtH } from "../logic/transport";
import { byId, DATA, saveLS, state } from "../store";
import { $ } from "./dom";
import { ICONS } from "./icons";
import { render } from "./render";
import { toast } from "./toast";

export function autoOrder() {
  state.trip = nearestNeighborOrder(state.trip, byId);
  saveLS(); renderTrip(); render();
  toast("已按顺路顺序重排 🧭");
}

export function renderTrip() {
  const listEl = $("stopList");
  const stops = tripStops(state.trip, byId);
  if (!stops.length) {
    listEl.innerHTML = `<p style="color:var(--ink-soft);text-align:center;padding:20px 0">行程还是空的，去卡片上点「${ICONS.suitcase} 行程」加几站吧</p>`;
    $("tripStats").innerHTML = "";
    $("tripSugg").innerHTML = "";
    return;
  }
  const legs = tripLegs(stops, byId);
  let html = `<div class="leg-line"><span class="dash"></span>🏠 ${getOrigin().name}出发 · ${legs[0].icon} ${legs[0].mode} ${fmtH(legs[0].hours)}（约${legs[0].km}km）${legs[0].gwName ? " → " + legs[0].gwName + "（进线门户）" : ""}</div>`;
  stops.forEach((d, i) => {
    html += `
    <div class="stop" data-idx="${i}">
      <span class="stop-idx">${i + 1}</span>
      <span class="c-emoji" style="width:36px;height:36px;font-size:18px;--rs:${REGION_COLOR[d.region]};background:${REGION_COLOR[d.region]}"><span class="emo">${d.emoji}</span></span>
      <span class="stop-name">${d.name}<br><span class="sm">${d.province} · ${d.crowd}</span></span>
      <span class="stop-ctrl">
        <select data-days="${i}" title="这一站玩几天">
          ${(d.fromRoute ? Array.from({ length: Math.max(...d.days) }, (_, k) => k + 1) : [...new Set([...d.days, d.chosenDays])]).sort((a, b) => a - b).map(n => `<option value="${n}" ${n === d.chosenDays ? "selected" : ""}>${n}天</option>`).join("")}
        </select>
        <button class="mini" data-up="${i}" title="上移">↑</button>
        <button class="mini" data-down="${i}" title="下移">↓</button>
        <button class="mini" data-del="${i}" title="移除">✕</button>
      </span>
    </div>`;
    const leg = legs[i + 1];
    html += `<div class="leg-line"><span class="dash"></span>${leg.icon} ${leg.mode} ${fmtH(leg.hours)}（约${leg.km}km）${i === stops.length - 1 ? (leg.gwName ? " · 经" + leg.gwName + `返回${getOrigin().name} 🏠` : ` · 返回${getOrigin().name} 🏠`) : ""}</div>`;
  });
  listEl.innerHTML = html;

  const b = tripBudget(stops, legs);
  $("tripStats").innerHTML = `
    <span>🗓 全程 <b>${b.daySum} 天</b>（不含赶路损耗）</span>
    <span>📏 总里程 <b>约 ${b.km} km</b></span>
    <span>💰 人均预算 <b>¥${b.lo.toLocaleString()} ~ ${b.hi.toLocaleString()}</b></span>`;

  // 顺路彩蛋（M28）：候选计算见 logic/itinerary.onwaySuggestions（两类同池混排，尊重开关）
  const near = onwaySuggestions(DATA, state, byId);
  $("tripSugg").innerHTML = near.length
    ? `💡 顺路彩蛋（顺路捡一站 / 到站顺游）：` + near.map(x =>
      `<button class="chip" data-onway="${x.d.id}" style="margin-left:6px"><span class="emo">${x.d.emoji}</span> ${x.d.name} · ${x.near ? `距${x.near.name.split(" · ")[0]}约${Math.max(1, Math.round(x.add))}km` : `+绕${Math.max(1, Math.round(x.add))}km`} ＋</button>`).join("")
    : "";
}

export function insertOnWay(id: string) {
  const d = byId(id);
  if (!d || d.stops || state.trip.some(t => t.id === id)) return;
  if (state.trip.length >= TRIP_MAX) { toast(`一次行程最多 ${TRIP_MAX} 站，贪多嚼不烂～`); return; }
  const { add, at } = bestInsertion(d, tripStops(state.trip, byId), byId);
  if (!isFinite(add)) return; // 防御：无可插的陆路段（正常情况下按钮就不会渲染）
  state.trip.splice(at, 0, { id, days: Math.min(...d.days) });
  saveLS(); render(); renderTrip();
  toast(`已顺路插到第 ${at + 1} 站：${d.name}`);
}

export function openTrip() { renderTrip(); $("tripOverlay").classList.add("show"); }
