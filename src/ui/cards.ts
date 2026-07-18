/* 卡片渲染（模板与旧版逐字一致） */
import { CROWD_CLASS, REGION_COLOR, SEASONS } from "../logic/constants";
import { routeDaysText } from "../logic/roadbook";
import type { Destination } from "../logic/types";
import { byId, CUR_SEASON, state } from "../store";

export const seasonsHTML = (d: Destination) => `<span class="seasons">${SEASONS.map(s =>
  `<span class="s-dot s${s} ${d.seasons.includes(s) ? "" : "off"}">${s}</span>`).join("")}</span>`;

export function cardHTML(d: Destination, i: number): string {
  const rs = REGION_COLOR[d.region] || "#cde9ff";
  const isRoute = !!d.stops;
  const routeLine = isRoute ? d.stops!.map(s => byId(s.id)?.name || s.id).join(" → ") : "";
  const tripBtn = isRoute
    ? `<button class="act trip" data-addroute="${d.id}">🎫 整条装入</button>`
    : `<button class="act trip ${state.trip.some(t => t.id === d.id) ? "on" : ""}" data-trip="${d.id}">🧳 行程</button>`;
  return `
  <article class="card ${isRoute ? "route-card" : ""}" data-id="${d.id}" style="--rs:${rs}; --rc:${rs}; animation-delay:${Math.min(i * 25, 350)}ms">
    <div class="c-strip">
      <span class="c-route">${isRoute ? `🎫 联程线路 · ${d.province}` : `上海 ✈ ${d.province} · ${d.region}`}</span>
      <span class="c-badges">
        ${!isRoute && state.visited.includes(d.id) ? `<span class="badge visitedb">✓ 去过</span>` : ""}
        ${isRoute ? `<span class="badge routeb">线路卡</span>` : ""}
        ${d.seasons.includes(CUR_SEASON) ? `<span class="badge now">当季</span>` : ""}
        ${d.alt ? `<span class="badge altb">⛰️ 高海拔</span>` : ""}
        <span class="badge ${CROWD_CLASS[d.crowd]}">${d.crowd}</span>
      </span>
    </div>
    <div class="c-body">
      <div class="c-name-row">
        <span class="c-emoji">${d.emoji}</span>
        <span>
          <span class="c-name">${d.name}</span>
          <div class="c-prov">${isRoute ? routeLine : `${d.province} · ${d.cost} · 🚄 ${d.transit}（${d.difficulty}）`}</div>
        </span>
      </div>
      <div class="c-tagline">${d.tagline}</div>
      <div class="c-meta">
        ${seasonsHTML(d)}
        <span>📅 ${d.stops ? routeDaysText(d) : d.days.join("/") + "天"}</span>
      </div>
      <div class="c-tags">${d.tags.map(t => `<span class="mini-tag">${t}</span>`).join("")}</div>
      <div class="c-actions">
        <button class="act fav ${state.favs.includes(d.id) ? "on" : ""}" data-fav="${d.id}">♥ 收藏</button>
        <button class="act cmp ${state.cmp.includes(d.id) ? "on" : ""}" data-cmp="${d.id}">⚖️ 对比</button>
        ${tripBtn}
      </div>
    </div>
  </article>`;
}
