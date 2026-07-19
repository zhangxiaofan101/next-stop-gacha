/* 详情 */
import { REGION_COLOR } from "../logic/constants";
import { routeDaysText } from "../logic/roadbook";
import type { Destination } from "../logic/types";
import { fetchWeather, wxInfo } from "../services/weather";
import { byId, state } from "../store";
import { seasonsHTML } from "./cards";
import { $ } from "./dom";

function detailHTML(d: Destination): string {
  const sec = (title: string, inner: string) => inner ? `<div class="dt-sec"><h3>${title}</h3>${inner}</div>` : "";
  const chips = (arr: string[], cls = "") => arr.length ? `<div class="dt-chips">${arr.map(x => `<span class="dt-chip ${cls}">${x}</span>`).join("")}</div>` : "";
  const rs = REGION_COLOR[d.region] || "var(--region-fallback)";
  const isRoute = !!d.stops;
  const inTrip = state.trip.some(t => t.id === d.id);
  const tripBtn = isRoute
    ? `<button class="big-btn" data-addroute="${d.id}">🎫 整条装入行程单</button>`
    : `<button class="big-btn ${inTrip ? "ghost" : ""}" data-trip="${d.id}">${inTrip ? "已在行程 ✓（点击移除）" : "🧳 加入行程"}</button>`;
  const isVisited = state.visited.includes(d.id);
  // 打卡去过：只有城市记录才有意义，线路卡按站点/城市算，不给这个按钮
  const visitBtn = isRoute ? "" : `<button class="big-btn ${isVisited ? "ghost" : "green"}" data-visited="${d.id}">${isVisited ? "✓ 去过了（点击取消）" : "👣 打卡去过"}</button>`;
  return `
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
      <span>🚄 ${d.transit}（${d.difficulty}）</span>
      <span>🥾 ${d.effort.length ? d.effort.join(" / ") : "怎么玩都行"}</span>
      <span>👥 ${d.companions.length ? d.companions.join(" / ") : "谁来都合适"}</span>
    </div>
    <div class="dt-meta"><span>🌤 ${d.seasonNote}</span></div>
    ${d.alt ? `<div class="dt-meta"><span>⛰️ 主要游玩区海拔 2500m+，注意高原反应，头两天慢一点</span></div>` : ""}
    ${sec("🍜 当地美食", chips(d.food, "food"))}
    ${sec("🏛 博物馆", chips(d.museums))}
    ${sec("🏯 古建古迹", chips(d.architecture))}
    ${sec("✨ 特色体验", d.highlights.length ? `<ul class="dt-list">${d.highlights.map(h => `<li>${h}</li>`).join("")}</ul>` : "")}
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
      <button class="big-btn blue" data-cmp="${d.id}">⚖️ 加入对比</button>
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
