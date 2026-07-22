/* 路书（HTML 渲染 + 天气异步填充；模型/文本装配在 logic/roadbook） */
import { getOrigin } from "../logic/origin";
import { ROUTE_STAY } from "../logic/constants";
import {
  filterSeasonNote, fmtMD, remapDayCodes, roadbookModel, roadbookText, shortName, skelDayLabel,
  skeletonRows, stayMonths, tripDate, type RoadbookModel,
} from "../logic/roadbook";
import type { TripItem, TripLeg } from "../logic/types";
import { fmtH } from "../logic/transport";
import { createTripShareLink } from "../services/shareApi";
import { fetchWeather, wxCacheGet, wxLine } from "../services/weather";
import { byId, state } from "../store";
import { copyText } from "./clipboard";
import { $ } from "./dom";
import { ICONS } from "./icons";
import { toast } from "./toast";

// M40：分享打开的路书是「别人的只读副本」，绝不能写进本机 state.trip（会悄悄覆盖访问者自己在编的行程）——
// 渲染/文本导出/天气填充全部改为显式接收 trip/tripStart，不再隐式读 state。
function roadbookHTML(m: RoadbookModel, tripStart: string, readonly: boolean): string {
  const now = new Date();
  const title = m.stops.map(shortName).join(" → ");
  const legLine = (l: TripLeg, note: string) => `<div class="rb-leg">${l.icon} ${note} · ${l.mode} ${fmtH(l.hours)}（约${l.km}km，估算）</div>`;
  const dayRange = (it: RoadbookModel["items"][number]) => { // 「D2–D3」＋设了出发日期时的「07-08~07-09」
    const tag = `D${it.start}${it.end > it.start ? "–D" + it.end : ""}`;
    const t1 = tripDate(it.start, tripStart);
    if (!t1) return tag;
    const t2 = tripDate(it.end, tripStart);
    return `${tag}（${fmtMD(t1)}${it.end > it.start ? " ~ " + fmtMD(t2!) : ""}）`;
  };
  const rows = skeletonRows(m.items);
  return `
  ${readonly ? `<div class="rb-shared-banner no-print">📎 来自分享链接的路书副本 · 只读，不会保存到本机行程</div>` : ""}
  <div class="rb-cover">
    <h2 class="rb-title">🧭 ${title}</h2>
    <div class="rb-meta">${m.budget.daySum} 天 · ${m.stops.length} 站 · 总里程约 ${m.budget.km}km · ${getOrigin().name}往返${tripStart ? ` · ${tripStart} 出发` : ""} · 生成于 ${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}</div>
  </div>
  <div class="rb-skel">
    <div class="rb-skel-t">🗓 逐日速览</div>
    ${rows.map(r => {
      const lb = skelDayLabel(r.n, tripStart);
      return `<div class="rb-sk-row">${lb.date ? `<span class="rb-sk-date">${lb.date}</span>` : ""}<span class="rb-sk-d">${lb.d}</span><span class="rb-sk-act">${r.act}</span><span class="rb-sk-stay">${r.stay === "🏠 回家" ? r.stay : "宿 " + r.stay}</span></div>`;
    }).join("")}
  </div>
  ${m.items.map((it, i) => {
    // M55②：设了出发日期才按停留月过滤（未设＝现状，全文展示；详情/对比页从不走这个函数不受影响）；
    // 全部句子被滤掉时省略整个 span（同样是「全滤则整行省略」，只是单位是 span 不是文本行）。
    const seasonText = tripStart ? filterSeasonNote(it.d.seasonNote, stayMonths(it.start, it.end, tripStart)) : it.d.seasonNote;
    return `
    ${legLine(it.legIn, i === 0 ? getOrigin().name + " → " + (it.legIn.gwName || it.d.name) : m.items[i - 1].d.name + " → " + it.d.name)}
    <div class="rb-day"><span class="rb-dtag">${dayRange(it)}</span></div>
    <div class="rb-stop">
      <h4><span class="emo">${it.d.emoji}</span> ${it.d.name} <span style="font-size:12px;color:var(--ink-soft);font-family:var(--sans)">（${it.d.chosenDays}天 · 方案「${it.plan.title}」${it.plan.days !== it.d.chosenDays ? "，按" + it.plan.days + "天版改编" : ""}）</span></h4>
      <div class="rb-plan">${remapDayCodes(it.plan.route, it.start)}</div>
      <div class="rb-facts">
        <span><b>🍜 别错过：</b>${it.d.food.slice(0, 4).join("、")}</span>
        ${it.d.highlights.length ? `<span><b>✨ 特色：</b>${it.d.highlights.slice(0, 2).join("；")}</span>` : ""}
        ${ROUTE_STAY.has(it.d.id) ? `<span><b>🧭 节奏：</b>路线型玩法，沿线多点换宿——按每晚落脚点分段订房，不必全程订一处</span>` : ""}
        <span><b>🏨 住宿：</b>${it.d.hotel || "以酒店 App 实查为准"}</span>
        <span><b>🚌 市内：</b>${it.d.local || "打车/公共交通"}</span>
        ${seasonText ? `<span><b>🌤 季节：</b>${seasonText}</span>` : ""}
        <span class="rb-wx" data-wx="${it.d.id}"></span>
      </div>
    </div>
    ${it.legOut ? legLine(it.legOut, it.d.name + (it.legOut.gwName ? " → " + it.legOut.gwName : "") + ` → ${getOrigin().name}（返程）`) : ""}
  `;
  }).join("")}
  <div class="trip-stats rb-budget">
    <span>💰 人均预算 <b>¥${m.budget.lo.toLocaleString()} ~ ${m.budget.hi.toLocaleString()}</b>（含大交通与住宿餐饮，不含购物）</span>
  </div>
  <div class="rb-note">※ 交通方式与时长为直线距离估算，出发前请以 12306 / 航旅 App 实际班次为准；房态与价格以酒店 App 实时为准。天气参考数据来自 <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>（<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>），经本站整理换算。</div>
  <div class="rb-actions no-print">
    <button class="big-btn blue" id="copyRbBtn">📋 复制路书文本</button>
    <button class="big-btn ghost" id="printRbBtn">${ICONS.printer} 打印 / 存 PDF</button>
    ${readonly ? "" : `<button class="big-btn ghost" id="shareRbBtn">🔗 生成分享短链</button>`}
  </div>`;
}

let currentRbTrip: TripItem[] = [];
let currentRbTripStart = "";
let rbWxGen = 0; // 防止用户改动行程后快速重开路书时，旧请求把天气写串到新渲染的节点上

function renderRoadbookOverlay(trip: TripItem[], tripStart: string, readonly: boolean) {
  currentRbTrip = trip;
  currentRbTripStart = tripStart;
  const m = roadbookModel(trip, byId);
  $("rbBody").innerHTML = roadbookHTML(m, tripStart, readonly);
  $("rbOverlay").classList.add("show");
  fillRoadbookWeather(++rbWxGen, trip);
}

export function openRoadbook() {
  if (!state.trip.length) { toast("行程还是空的"); return; }
  renderRoadbookOverlay(state.trip, state.tripStart, false);
}

// M40：/api/share 短链取回的 trip 类型载荷——只读预览，绝不写 state.trip/saveLS。
export function openSharedRoadbook(trip: TripItem[], tripStart: string) {
  renderRoadbookOverlay(trip, tripStart, true);
}

// 文本导出：天气行只读缓存（不发请求），与 design「实时天气」的静默降级口径一致。
// 导出当前打开的路书（自己的行程或分享打开的只读副本），而非总是 state.trip。
export function currentRoadbookText(): string {
  const m = roadbookModel(currentRbTrip, byId);
  return roadbookText(m, currentRbTripStart, id => {
    const days = wxCacheGet(id);
    return days ? wxLine(days) : null;
  });
}

export async function shareCurrentRoadbook() {
  // F78：把当前出发地一并固化进短链——路书的首末段/交通/预算都是按 getOrigin() 视角算的，
  // 不带出发地分享，默认视角的访客打开会被无声重算成「上海往返」。
  const code = await createTripShareLink({ trip: currentRbTrip, tripStart: currentRbTripStart || undefined, originId: getOrigin().id });
  if (!code) { toast("短链生成失败，用「复制路书文本」代替"); return; }
  copyText(`${location.origin}${import.meta.env.BASE_URL}?sc=${code}`);
}

async function fillRoadbookWeather(gen: number, trip: TripItem[]) {
  const stops = trip.map(t => byId(t.id)!);
  await Promise.all(stops.map(async d => {
    const days = await fetchWeather(d, byId);
    if (!days || gen !== rbWxGen) return;
    const el = document.querySelector(`[data-wx="${d.id}"]`);
    if (el) el.innerHTML = `<b>⛅ 未来7天参考：</b>${wxLine(days)}`;
  }));
}
