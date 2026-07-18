// 路书装配（design「决策机制·路书装配」）：方案匹配/就近降配、leg 整组文案、逐日骨架、纯文本导出。
// HTML 渲染在 ui/roadbook.ts；本模块只产出模型与文本。
import { ROUTE_STAY } from "./constants";
import { tripBudget, type TripBudget } from "./budget";
import { legEligibleIndices, tripLegs, tripStops } from "./itinerary";
import { fmtH, TRANSPORT_META } from "./transport";
import type { ById, Destination, Plan, TripItem, TripLeg, TripStopX } from "./types";

// 线路天数展示（F8）：days 枚举=有对应 plan 支撑的弹性档位，Σstops=默认装入分配；名称不带日数（build 强制）
export function routeDaysText(d: Destination): string {
  const sum = d.stops!.reduce((s, x) => s + x.days, 0);
  const lo = Math.min(...d.days), hi = Math.max(...d.days);
  return lo === hi ? `约${lo}天` : `约${lo}~${hi}天 · 默认${sum}天`;
}

export function pickPlan(d: Destination, days: number): Plan {
  let best = d.plans[0];
  d.plans.forEach(p => {
    if (p.days === days) best = p;
    else if (p.days < days && p.days > best.days && best.days !== days) best = p;
  });
  const exact = d.plans.find(p => p.days === days);
  return exact || best;
}

// F18/F21：线路装入的 stop 优先用「线路视角」的逐日文案（leg={route,stays}），而非城市独立游方案——
// 城市卡 plans 描述的是"在这座城住几天放射游"，而线路要的是"这一段路怎么开、当晚睡哪"。
// legOn=该站属于完整启用的 leg 整组（legEligibleIndices 判定）。
export function planForStop(d: TripStopX, legOn: boolean, byId: ById): Plan {
  const base = pickPlan(d, d.chosenDays);
  if (!legOn) return base;
  const st = byId(d.rid!)!.stops!.find(s => s.id === d.id);
  return st && st.leg ? { days: d.chosenDays, title: byId(d.rid!)!.name, route: st.leg.route, stays: st.leg.stays } : base;
}

export interface RoadbookItem {
  d: TripStopX; start: number; end: number; plan: Plan;
  legIn: TripLeg; legOut: TripLeg | null;
}
export interface RoadbookModel {
  stops: TripStopX[]; legs: TripLeg[]; items: RoadbookItem[]; budget: TripBudget;
}

export function roadbookModel(trip: TripItem[], byId: ById): RoadbookModel {
  const stops = tripStops(trip, byId);
  const legIdx = legEligibleIndices(stops, byId);
  const legs = tripLegs(stops, byId);
  let day = 0;
  const items = stops.map((d, i) => {
    const start = day + 1, end = day + d.chosenDays;
    day = end;
    return { d, start, end, plan: planForStop(d, legIdx.has(i), byId), legIn: legs[i], legOut: i === stops.length - 1 ? legs[i + 1] : null };
  });
  return { stops, legs, items, budget: tripBudget(stops, legs) };
}

/* M29 逐日骨架：每天一行「日期/D序号 · 当日动作 · 宿地」 */
export const shortName = (d: { name: string }) => d.name.split(" · ")[0].split("·")[0].split("（")[0].split("(")[0]; // 「伊犁（伊宁·赛里木湖…）」→「伊犁」
export const WEEK_CN = ["日", "一", "二", "三", "四", "五", "六"];
export function tripDate(n: number, tripStart: string): Date | null { // 第 n 天（1-based）的日期；未设出发日期返回 null
  if (!tripStart) return null;
  const t = new Date(tripStart + "T00:00:00");
  if (isNaN(t.getTime())) return null;
  t.setDate(t.getDate() + (n - 1));
  return t;
}
export const fmtMD = (t: Date) => `${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")} 周${WEEK_CN[t.getDay()]}`;
export const fmtYMD = (t: Date) => `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, "0")}${String(t.getDate()).padStart(2, "0")}`;

export interface SkeletonRow { n: number; act: string; stay: string; }

// 宿地：路线型方案带 stays（每晚落脚点，build 校验与 plan.days 等长）；基地型=城市名。
// 就近降配（chosenDays≠plan.days）时 stays 下标截断到最后一晚。
export function skeletonRows(items: RoadbookItem[]): SkeletonRow[] {
  const rows: SkeletonRow[] = [];
  items.forEach((it, i) => {
    const name = shortName(it.d);
    const stays = it.plan.stays;
    const stayAt = (k: number) => stays ? stays[Math.min(k, stays.length - 1)] : name;
    for (let k = 0; k < it.d.chosenDays; k++) {
      const isTripLast = it.legOut && k === it.d.chosenDays - 1;
      let act: string;
      if (k === 0) {
        const from = i === 0 ? "上海" : shortName(items[i - 1].d);
        const dest = it.legIn.gwName || name; // 入口门户（F31）优先作为「上海 → X」的目标
        act = `${from} → ${dest}（${it.legIn.mode} ${fmtH(it.legIn.hours)}）`;
        if (it.legIn.gwName || (stays && stayAt(0) !== name)) act += `，进线到${stayAt(0)}`;
      } else if (stays && stayAt(k) !== stayAt(k - 1)) {
        act = `${stayAt(k - 1)} → ${stayAt(k)}（沿线玩过去）`;
      } else if (stays && (TRANSPORT_META as Record<string, unknown>)[stayAt(k)]) {
        // F35：连住同一移动住宿（游轮/轮渡/火车）不是地名，「游X一带」句式读出「游游轮一带」的胡话
        act = `${stayAt(k)}上继续游览沿途景点`;
      } else {
        act = `游${stays ? stayAt(k) + "一带" : name}`;
      }
      if (isTripLast) {
        act += `，${it.legOut!.gwName ? "经" + it.legOut!.gwName : ""}${it.legOut!.mode}返回上海（${fmtH(it.legOut!.hours)}）`;
        rows.push({ n: it.start + k, act, stay: "🏠 回家" });
      } else {
        rows.push({ n: it.start + k, act, stay: stayAt(k) });
      }
    }
  });
  return rows;
}

export const skelDayLabel = (n: number, tripStart: string) => {
  const t = tripDate(n, tripStart);
  return { d: `D${n}`, date: t ? fmtMD(t) : "" };
};

// 纯文本导出。getWxLine=按站取「已缓存的」天气行（不发请求；无缓存返回 null），由调用方注入。
export function roadbookText(m: RoadbookModel, tripStart: string, getWxLine: (id: string) => string | null): string {
  const title = m.stops.map(d => d.name).join(" → ");
  let s = `🧭 ${title}（${m.budget.daySum}天 · 上海往返${tripStart ? ` · ${tripStart} 出发` : ""}）\n`;
  let wxUsed = false;
  s += `总里程约 ${m.budget.km}km · 人均预算 ¥${m.budget.lo}~${m.budget.hi}\n\n`;
  s += `【逐日速览】\n`;
  skeletonRows(m.items).forEach(r => {
    const t = tripDate(r.n, tripStart);
    s += `${t ? fmtYMD(t) + " " : ""}D${r.n} ${r.act} ${r.stay === "🏠 回家" ? "当晚到家" : "宿" + r.stay}\n`;
  });
  s += `\n`;
  m.items.forEach((it, i) => {
    const inName = i === 0 ? "上海" : m.items[i - 1].d.name;
    const outName = (i === 0 && it.legIn.gwName) ? it.legIn.gwName : it.d.name; // 入口门户（F31）
    s += `【${inName} → ${outName}】${it.legIn.mode} ${fmtH(it.legIn.hours)}（约${it.legIn.km}km）\n`;
    s += `D${it.start}${it.end > it.start ? "–D" + it.end : ""} ${it.d.name}（${it.d.chosenDays}天 · ${it.plan.title}）\n`;
    s += `  行程：${it.plan.route}\n`;
    s += `  美食：${it.d.food.slice(0, 4).join("、")}\n`;
    if (ROUTE_STAY.has(it.d.id)) s += `  节奏：路线型玩法，沿线多点换宿（按每晚落脚点分段订房）\n`;
    s += `  住宿：${it.d.hotel || "以酒店App实查为准"}\n`;
    s += `  市内：${it.d.local || "打车/公共交通"}\n`;
    const wl = getWxLine(it.d.id); // 只读缓存，不发请求；没缓存就不加这行
    if (wl) { wxUsed = true; s += `  天气参考：${wl}\n`; }
    s += `\n`;
    if (it.legOut) s += `【${it.d.name}${it.legOut.gwName ? " → " + it.legOut.gwName : ""} → 上海】${it.legOut.mode} ${fmtH(it.legOut.hours)}（约${it.legOut.km}km）\n\n`;
  });
  s += "※ 时长为估算，请以 12306/航班动态为准。";
  if (wxUsed) s += "\n※ 天气参考数据来自 Open-Meteo（https://open-meteo.com · CC BY 4.0 https://creativecommons.org/licenses/by/4.0/），经本站整理换算。";
  return s;
}
