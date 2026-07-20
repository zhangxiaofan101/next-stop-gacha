/* 详情 */
import { REGION_COLOR } from "../logic/constants";
import { routeDaysText } from "../logic/roadbook";
import { parseTransitIcon } from "../logic/transport";
import type { Destination } from "../logic/types";
import { destPhotoSrc, regionHeaderSrc } from "../skins/illustrations";
import { fetchWeather, wxInfo } from "../services/weather";
import { byId, state } from "../store";
import { seasonsHTML } from "./cards";
import { $ } from "./dom";
import { ICONS } from "./icons";

// M46：详情页头图——九区题头的首选用途（design M46）。线路卡直接用大区题头；城市卡优先目的地
// 个图（M44 分批铺量），个图缺失时退到同一张大区题头兜底，两者都缺才整块不占位（缺图不硬占）。
// M58：容器帧比随图源双态切换——个图原生 3:2（.photo 类）、题头兜底/线路卡维持 2:1；
// data-fallback-frame-toggle 告诉 illustrations.ts 的通用回退处理器「换源成功时摘掉这个类」，
// 换源（个图→题头图）与换帧比（3:2→2:1）必须同步发生，不能拿 3:2 框硬撑一张 2:1 的题头图。
// [interrupt]（M58 实现期浏览器复验抓到，2026-07-20）：headerBannerHTML 沿用至今的
// `loading="lazy"` 与 [interrupt] 一轮修过的票券卡图是同一个坑——img 插进 innerHTML 时
// `#detailOverlay` 还是 display:none，紧接着同步加 `.show`，懒加载可视观察永遇不到「从隐藏切
// 到可见」这一刻，未被浏览器缓存过的目的地个图/题头图在详情页里恒不加载（`complete:false`，
// 连网络请求都不会发出）。card 网格自身的 `.c-photo` 不受影响（图片在正常文档流里滚动进出，
// 懒加载语义本来就成立）；票券同款单图场景，改 eager 同样合理。
function headerBannerHTML(d: Destination, isRoute: boolean): string {
  const regionSrc = regionHeaderSrc(d.region);
  const img = isRoute
    ? `<img class="illust" src="${regionSrc}" alt="" loading="eager" data-fallback="hide">`
    : `<img class="illust" src="${destPhotoSrc(d.id)}" alt="" loading="eager" data-fallback-src="${regionSrc}" data-fallback="hide" data-fallback-frame-toggle="photo">`;
  return `<div class="dt-banner${isRoute ? "" : " photo"}" data-illust-frame>${img}</div>`;
}

function detailHTML(d: Destination): string {
  const sec = (title: string, inner: string) => inner ? `<div class="dt-sec"><h3>${title}</h3>${inner}</div>` : "";
  const chips = (arr: string[], cls = "") => arr.length ? `<div class="dt-chips">${arr.map(x => `<span class="dt-chip ${cls}">${x}</span>`).join("")}</div>` : "";
  const rs = REGION_COLOR[d.region] || "var(--region-fallback)";
  const isRoute = !!d.stops;
  // M59 ④ 收尾：dt-meta 交通行图标与卡片同源解析（此前硬编码 🚄，高铁城/飞机城同病）。
  // 线路卡不同于 cards.ts 的「不显示」——详情页真的展示线路 transit（首末大交通文案，方式词齐全），一并解析。
  const transitIcon = parseTransitIcon(d.transit);
  const inTrip = state.trip.some(t => t.id === d.id);
  const tripBtn = isRoute
    ? `<button class="big-btn" data-addroute="${d.id}">🎫 整条装入行程单</button>`
    : `<button class="big-btn ${inTrip ? "ghost" : ""}" data-trip="${d.id}">${inTrip ? "已在行程 ✓（点击移除）" : `${ICONS.suitcase} 加入行程`}</button>`;
  const isVisited = state.visited.includes(d.id);
  // 打卡去过：只有城市记录才有意义，线路卡按站点/城市算，不给这个按钮
  const visitBtn = isRoute ? "" : `<button class="big-btn ${isVisited ? "ghost" : "green"}" data-visited="${d.id}">${isVisited ? "✓ 去过了（点击取消）" : `${ICONS.footprints} 打卡去过`}</button>`;
  return `
    ${headerBannerHTML(d, isRoute)}
    <div class="dt-head">
      <span class="c-emoji dt-emoji" style="--rs:${rs};background:${rs}">${d.emoji}</span>
      <div>
        <h2 class="dt-name">${d.name}</h2>
        <div class="dt-sub">${isRoute ? `🎫 联程线路 · ${d.province}` : `${d.province} · ${d.region} · ${d.crowd} · ${d.cost}`}</div>
      </div>
    </div>
    <div class="dt-tagline">${d.tagline}</div>
    ${isRoute ? sec("🗺 途经站点", `<ol class="dt-list">${d.stops!.map(s => {
      const city = byId(s.id); return `<li>${city ? `${city.emoji} ${city.name}` : s.id} · 建议 ${s.days} 天</li>`;
    }).join("")}</ol>`) : ""}
    <div class="dt-meta">
      ${seasonsHTML(d)}
      <span>📅 ${d.stops ? `${routeDaysText(d)}（各站天数装入行程单后可调）` : `建议 ${d.days.join(" / ")} 天`}</span>
      <span>${transitIcon} ${d.transit}（${d.difficulty}）</span>
      <span>🥾 ${d.effort.length ? d.effort.join(" / ") : "怎么玩都行"}</span>
      <span>👥 ${d.companions.length ? d.companions.join(" / ") : "谁来都合适"}</span>
    </div>
    <div class="dt-meta"><span>🌤 ${d.seasonNote}</span></div>
    ${d.alt ? `<div class="dt-meta"><span>⛰️ 主要游玩区海拔 2500m+，注意高原反应，头两天慢一点</span></div>` : ""}
    ${sec("🍜 当地美食", chips(d.food, "food"))}
    ${sec("🏛 博物馆", chips(d.museums))}
    ${sec("🏯 古建古迹", chips(d.architecture, "arch"))}
    ${sec("✨ 特色体验", d.highlights.length ? `<ul class="dt-list highlight">${d.highlights.map(h => `<li>${h}</li>`).join("")}</ul>` : "")}
    <div id="wxSec"></div>
    ${sec("🏨 住宿参考", d.hotel ? `<div class="note-box hotel">${d.hotel}</div>` : "")}
    ${sec("🚌 当地交通", d.local ? `<div class="note-box">${d.local}</div>` : "")}
    ${sec("🗓 行程方案", d.plans.map(p => `
      <div class="plan">
        <span class="plan-days">${p.days}天</span>
        <div><div class="plan-title">${p.title}</div><div class="plan-route">${p.route}</div></div>
      </div>`).join(""))}
    <div class="dt-actrow">
      ${tripBtn}
      <button class="big-btn blue" data-cmp="${d.id}">${ICONS.scale} 加入对比</button>
      ${visitBtn}
    </div>`;
}

export function openDetail(id: string) {
  const d = byId(id); if (!d) return;
  $("detailBody").innerHTML = detailHTML(d);
  $("detailOverlay").classList.add("show");
  fillDetailWeather(d);
}
// 详情页 7 天预报：异步填充，用 data-id 核对——避免用户快速换卡片时把旧请求的结果写串
async function fillDetailWeather(d: Destination) {
  const box = document.getElementById("wxSec");
  if (!box) return;
  box.dataset.id = d.id;
  const days = await fetchWeather(d, byId);
  if (!days || box.dataset.id !== d.id) return;
  const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const startOfDay = (t: Date) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const todayTs = startOfDay(new Date());
  const cells = days.map(x => {
    const [y, m, dd] = x.dt.split("-").map(Number);
    const dt = new Date(y, m - 1, dd);
    const diff = Math.round((startOfDay(dt) - todayTs) / 86400000);
    const label = diff === 0 ? "今天" : diff === 1 ? "明天" : WEEK[dt.getDay()];
    const info = wxInfo(x.code);
    return `<div class="wx-day"><div>${label}</div><div>${info.e}</div><div>${x.hi}°/${x.lo}°</div></div>`;
  }).join("");
  box.innerHTML = `<div class="dt-sec"><h3>⛅ 未来 7 天${d.stops ? " · 起点站" : ""}</h3><div class="wx-row">${cells}</div><div class="wx-note">数据 <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>（<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a> · 经本站整理换算）· 出发前以天气 App 为准</div></div>`;
}
