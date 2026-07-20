/* 卡片渲染（模板与旧版逐字一致，M46 新增卡顶目的地照片槽位） */
import { CROWD_CLASS, REGION_COLOR, SEASONS } from "../logic/constants";
import { routeDaysText } from "../logic/roadbook";
import { parseTransitIcon } from "../logic/transport";
import type { Destination } from "../logic/types";
import { cardPhotosEnabled, destPhotoSrc, regionHeaderSrc } from "../skins/illustrations";
import { byId, CUR_SEASON, state } from "../store";
import { ICONS } from "./icons";

export const seasonsHTML = (d: Destination) => `<span class="seasons">${SEASONS.map(s =>
  `<span class="s-dot s${s} ${d.seasons.includes(s) ? "" : "off"}">${s}</span>`).join("")}</span>`;

export function cardHTML(d: Destination, i: number): string {
  const rs = REGION_COLOR[d.region] || "var(--region-fallback)";
  const isRoute = !!d.stops;
  const routeLine = isRoute ? d.stops!.map(s => byId(s.id)?.name || s.id).join(" → ") : "";
  const tripBtn = isRoute
    ? `<button class="act trip" data-addroute="${d.id}">🎫 整条装入</button>`
    : `<button class="act trip ${state.trip.some(t => t.id === d.id) ? "on" : ""}" data-trip="${d.id}">${ICONS.suitcase} 行程</button>`;
  // M46：目的地共享照片集（M44 分批铺量，皮肤无关）。M59 ⑨⑩⑫：卡位展示与否是皮肤维度
  // （cardPhotosEnabled，奶油关/山水开，票券走同一 cardHTML 路径随开关）；开图皮肤下——
  // 线路卡用所属大区题头图（regionHeaderSrc，2:1 原生，题头位契约不浅裁）；城市卡优先个图，
  // 缺图（未铺量到的城市）退大区题头兜底，两者都缺才整块不占位（与详情头图回退链同构）。
  const photo = !cardPhotosEnabled() ? "" : isRoute
    ? `<div class="c-photo" data-illust-frame><img class="illust" src="${regionHeaderSrc(d.region)}" alt="" loading="lazy" data-fallback="hide"></div>`
    : `<div class="c-photo" data-illust-frame><img class="illust" src="${destPhotoSrc(d.id)}" alt="" loading="lazy" data-fallback-src="${regionHeaderSrc(d.region)}" data-fallback="hide"></div>`;
  // M59 ④：交通图标按 transit 文案解析首个方式词，条带与名下行共用同一次解析结果，不会各自
  // 猜出不同答案（此前硬编码「✈」/「🚄」与实际内容脱节，高铁城显✈、飞机城显🚄）。
  const transitIcon = isRoute ? "" : parseTransitIcon(d.transit);
  return `
  <article class="card ${isRoute ? "route-card" : ""}" data-id="${d.id}" style="--rs:${rs}; --rc:${rs}; animation-delay:${Math.min(i * 25, 350)}ms">
    ${photo}
    <div class="c-strip">
      <span class="c-route">${isRoute ? `🎫 联程线路 · ${d.province}` : `上海 ${transitIcon} ${d.province} · ${d.region}`}</span>
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
          <div class="c-prov">${isRoute ? routeLine : `${d.province} · ${d.cost} · ${d.transit}（${d.difficulty}）`}</div>
        </span>
      </div>
      <div class="c-tagline">${d.tagline}</div>
      <div class="c-meta">
        ${seasonsHTML(d)}
        <span>📅 ${d.stops ? routeDaysText(d) : d.days.join("/") + "天"}</span>
      </div>
      <div class="c-tags">${d.tags.map(t => `<span class="mini-tag">${t}</span>`).join("")}</div>
      <div class="c-actions">
        <button class="act fav ${state.favs.includes(d.id) ? "on" : ""}" data-fav="${d.id}">${ICONS.heart} 收藏</button>
        <button class="act cmp ${state.cmp.includes(d.id) ? "on" : ""}" data-cmp="${d.id}">${ICONS.scale} 对比</button>
        ${tripBtn}
      </div>
    </div>
  </article>`;
}
