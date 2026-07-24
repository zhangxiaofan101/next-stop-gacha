/* 路书（HTML 渲染 + 天气异步填充；模型/文本装配在 logic/roadbook） */
import { CN_MAP } from "../cn-map";
import { getOrigin } from "../logic/origin";
import { ROUTE_STAY } from "../logic/constants";
import {
  filterSeasonNote, fmtMD, remapDayCodes, roadbookModel, roadbookText, shortName, skelDayLabel,
  skeletonRows, stayMonths, tripDate, type RoadbookModel,
} from "../logic/roadbook";
import { buildRouteMap } from "../logic/routeMap";
import { tripRouteHint, type RouteHint } from "../logic/routeOptimal";
import type { TripItem, TripLeg } from "../logic/types";
import { fmtH } from "../logic/transport";
import { createTripShareLink } from "../services/shareApi";
import { fetchWeather, wxCacheGet, wxLine } from "../services/weather";
import { autoOrder } from "./trip";
import { byId, state } from "../store";
import { copyText } from "./clipboard";
import { $ } from "./dom";
import { ICONS } from "./icons";
import { toast } from "./toast";

// M79：路线图 SVG——省界为底（细描边、低对比），出发地空心双圈 + 各站序号点，按行程序连线，
// 末站回出发地的收尾段画虚线（区别去回程）。换算公式与 ui/mapview.ts 足迹地图同源
// （logic/map.ts 的 projectPoint），viewBox 裁剪逻辑在 logic/routeMap.ts。
function routeMapSVG(m: RoadbookModel): string {
  const rm = buildRouteMap(getOrigin(), m.stops);
  // 缩放基准：与 viewBox 跨度成比例的描边宽/点半径/字号，保证近邻小跨度行程与跨省大跨度
  // 行程视觉观感一致（不会出现小跨度下线条被相对撑得极粗、或大跨度下细得看不见）。
  const unit = Math.max(rm.w, rm.h) / 100;
  const provPaths = CN_MAP.prov.map(p => `<path class="rb-map-prov" d="${p.d}" stroke-width="${(unit * .15).toFixed(2)}"></path>`).join("");
  const lineW = (unit * .45).toFixed(2);
  let routeD = `M${rm.origin.x},${rm.origin.y}`;
  rm.stops.forEach(p => { routeD += ` L${p.x},${p.y}`; });
  const last = rm.stops.length ? rm.stops[rm.stops.length - 1] : rm.origin;
  const returnD = `M${last.x},${last.y} L${rm.origin.x},${rm.origin.y}`;
  // 点/圈/字号乘数按渲染宽度约 300~480px（.rb-map-wrap svg 的实际显示尺寸）反推——保证换算后
  // 显示出来是约 9~11px 的可读字号/约 7~8px 点半径，不随行程跨度大小而忽大忽小。
  const oR1 = (unit * 2.3).toFixed(2), oR2 = (unit * 1.1).toFixed(2);
  const labelFont = (unit * 1.9).toFixed(2), numFont = (unit * 2.1).toFixed(2), dotR = (unit * 1.8).toFixed(2);
  const originMark = `
    <circle class="rb-map-origin" cx="${rm.origin.x}" cy="${rm.origin.y}" r="${oR1}" fill="none" stroke-width="${lineW}"></circle>
    <circle class="rb-map-origin" cx="${rm.origin.x}" cy="${rm.origin.y}" r="${oR2}" fill="none" stroke-width="${lineW}"></circle>
    <text class="rb-map-label" x="${rm.origin.x}" y="${rm.origin.y - Number(oR1) - unit * .8}" text-anchor="middle" font-size="${labelFont}">${getOrigin().name}</text>`;
  const dots = rm.stops.map((p, i) => `
    <circle class="rb-map-dot" cx="${p.x}" cy="${p.y}" r="${dotR}" stroke-width="${(unit * .35).toFixed(2)}"></circle>
    <text class="rb-map-num" x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" font-size="${numFont}">${i + 1}</text>
    <text class="rb-map-label" x="${p.x}" y="${p.y - Number(dotR) - unit * .8}" text-anchor="middle" font-size="${labelFont}">${shortName(m.stops[i])}</text>`).join("");
  return `<div class="rb-map-wrap"><svg viewBox="${rm.viewBox}" xmlns="http://www.w3.org/2000/svg">
    ${provPaths}
    <path class="rb-map-route" d="${routeD}" fill="none" stroke-width="${lineW}"></path>
    <path class="rb-map-return" d="${returnD}" fill="none" stroke-width="${lineW}" stroke-dasharray="5,4"></path>
    ${originMark}
    ${dots}
  </svg></div>`;
}

// 地图下方一行：全程直线里程恒显（hav 取整，明示估算）；行程 ≥2 站时追加最优提示——
// 非最优且省距达阈值（20km）给「一键按最优」，否则明示已顺路；<2 站没有绕路语义，不显示这段。
function routeHintLine(hint: RouteHint, stopCount: number, readonly: boolean): string {
  const total = `📏 全程直线约 ${Math.round(hint.currentKm)} km（估算）`;
  if (stopCount < 2) return `<div class="rb-map-hint">${total}</div>`;
  if (hint.showButton) {
    const btn = readonly ? "" : `<button class="btn no-print" id="rbApplyOptimalBtn">🧭 一键按最优</button>`;
    return `<div class="rb-map-hint">${total} · 比最优顺序多绕约 ${Math.max(1, Math.round(hint.diffKm))} km ${btn}</div>`;
  }
  return `<div class="rb-map-hint">${total} · 已是顺路顺序</div>`;
}

// M40：分享打开的路书是「别人的只读副本」，绝不能写进本机 state.trip（会悄悄覆盖访问者自己在编的行程）——
// 渲染/文本导出/天气填充全部改为显式接收 trip/tripStart，不再隐式读 state。
function roadbookHTML(m: RoadbookModel, hint: RouteHint, tripStart: string, readonly: boolean): string {
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
  ${routeMapSVG(m)}
  ${routeHintLine(hint, m.stops.length, readonly)}
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
  const hint = tripRouteHint(trip, byId);
  $("rbBody").innerHTML = roadbookHTML(m, hint, tripStart, readonly);
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

// M79「一键按最优」：复用「顺路排序」既有的保存/重渲染链路（autoOrder 已升级为块感知精确解，
// 见 logic/routeOptimal.ts），应用后就地重渲染当前打开的路书。只读分享副本不接这个按钮
// （routeHintLine 已按 readonly 不出按钮），故这里不必再判 readonly。
export function applyOptimalToRoadbook() {
  autoOrder();
  renderRoadbookOverlay(state.trip, state.tripStart, false);
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
