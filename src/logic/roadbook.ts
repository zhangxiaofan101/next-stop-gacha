// 路书装配（design「决策机制·路书装配」）：方案匹配/就近降配、leg 整组文案、逐日骨架、纯文本导出。
// HTML 渲染在 ui/roadbook.ts；本模块只产出模型与文本。
import { ROUTE_STAY } from "./constants";
import { getOrigin } from "./origin";
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
        const from = i === 0 ? getOrigin().name : shortName(items[i - 1].d);
        const dest = it.legIn.gwName || name; // 入口门户（F31）优先作为「出发地 → X」的目标
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
        act += `，${it.legOut!.gwName ? "经" + it.legOut!.gwName : ""}${it.legOut!.mode}返回${getOrigin().name}（${fmtH(it.legOut!.hours)}）`;
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

// M55①：城市方案/leg 文本自带局部 D 编码（D1/D2…、D1-2 区间），与路书全局日序（该站从 start
// 天起算）打架——按站起始日偏移量重映射，只替换文本、不碰数据（267 城零迁移）。与是否设了出发
// 日期无关：逐日速览的 D 序号本就全局无条件展示，城市段文案必须跟它对齐，不是「有日期才对齐」。
export function remapDayCodes(route: string, start: number): string {
  const offset = start - 1;
  if (!offset) return route; // 首站 start=1，本地编号天然=全局编号，等价于不做替换
  return route.replace(/D(\d+)(?:-(\d+))?/g, (_, a: string, b?: string) =>
    b === undefined ? `D${Number(a) + offset}` : `D${Number(a) + offset}-${Number(b) + offset}`);
}

// M55②：当季文案句级过滤——只在设了出发日期时启用（未设=显示全文，即本函数不参与）。
const SEASON_MONTHS: Record<string, number[]> = { 春: [3, 4, 5], 夏: [6, 7, 8], 秋: [9, 10, 11], 冬: [12, 1, 2] };
const FESTIVAL_MONTHS: Record<string, number[]> = { 春节: [1, 2], 五一: [5], 暑假: [7, 8], 国庆: [10] };
function monthRange(a: number, b: number): number[] {
  if (a <= b) return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const out: number[] = [];
  for (let m = a; m <= 12; m++) out.push(m);
  for (let m = 1; m <= b; m++) out.push(m);
  return out; // 跨年环绕（如「12-2月」「10月至次年4月」）
}
// 一句话里提取时间语义对应的月份集合；null=完全不含时间词——这类句子（如「避开黄金周人挤人」）
// 与「当季」无关，任何停留月份都保留，不是「无法判断故保留」的兜底，是语义上确实不该被滤掉。
export function extractMonths(sentence: string): Set<number> | null {
  const months = new Set<number>();
  let found = false;
  let m: RegExpExecArray | null;
  const wrapRe = /(\d{1,2})月至次年(\d{1,2})月/g;
  while ((m = wrapRe.exec(sentence))) { found = true; monthRange(+m[1], +m[2]).forEach(x => months.add(x)); }
  // 带旬修饰的跨年区间（真实数据「12月中旬-3月上旬」「12月下旬-2月」）：两侧各自独立的
  // 「月」+ 可选「上/中/下旬」，与下面 rangeRe 的紧凑写法「7-8月」（单个末尾月）互不重叠。
  const kwRangeRe = /(\d{1,2})月(?:[上中下]旬)?[-至](\d{1,2})月(?:[上中下]旬)?/g;
  while ((m = kwRangeRe.exec(sentence))) { found = true; monthRange(+m[1], +m[2]).forEach(x => months.add(x)); }
  const rangeRe = /(\d{1,2})[-至](\d{1,2})月/g;
  while ((m = rangeRe.exec(sentence))) { found = true; monthRange(+m[1], +m[2]).forEach(x => months.add(x)); }
  const singleRe = /(\d{1,2})月/g; // 与上面几个 range 正则的匹配区间有重叠（如"7-8月"里的"8月"）——
  while ((m = singleRe.exec(sentence))) { found = true; months.add(+m[1]); } // 重复 add 到 Set 是幂等的，无害
  // 节庆词先于季节词识别，并把命中的节庆子串从副本里挖掉再匹配季节——「春节」本身包含「春」，
  // 不屏蔽会被季节表再匹配一次扩成 [3,4,5]（F61：真实数据「春节期间阆中过大年」5 月出发时因此
  // 被误判为当季保留）。只挖掉命中的节庆子串本身，句子里独立出现的「春天」「春季」不受影响。
  let rest = sentence;
  for (const [word, ms] of Object.entries(FESTIVAL_MONTHS)) {
    if (rest.includes(word)) { found = true; ms.forEach(x => months.add(x)); rest = rest.split(word).join(""); }
  }
  for (const [word, ms] of Object.entries(SEASON_MONTHS)) {
    if (rest.includes(word)) { found = true; ms.forEach(x => months.add(x)); }
  }
  return found ? months : null;
}
// 按「；。」切句：命中月份集合交集、或本身不含时间词的句子保留，原分隔符随保留句一起带出；
// 全部句子被滤掉时天然返回空串——「全滤则整行省略」由调用方检查空串决定是否渲染该行。
export function filterSeasonNote(note: string, stayMonths: Set<number>): string {
  if (!note) return "";
  const parts = note.split(/([；。])/);
  let out = "";
  for (let i = 0; i < parts.length; i += 2) {
    const sentence = parts[i];
    if (!sentence) continue;
    const delim = parts[i + 1] ?? "";
    const sm = extractMonths(sentence);
    if (sm === null || [...sm].some(x => stayMonths.has(x))) out += sentence + delim;
  }
  return out;
}
// 该站实际停留会覆盖的月份集合（跨月停留天然落进多个月）；tripStart 为空/非法时 tripDate 恒
// 返回 null，集合为空——调用方须先判断 tripStart truthy 再调用，空集合不代表「全年通配」。
export function stayMonths(start: number, end: number, tripStart: string): Set<number> {
  const months = new Set<number>();
  for (let n = start; n <= end; n++) {
    const t = tripDate(n, tripStart);
    if (t) months.add(t.getMonth() + 1);
  }
  return months;
}
// content-checklist 四节离线审计用：句子「看起来」有时间语义（含旺季/花期一类词）但 extractMonths
// 解析不出月份——运行时過滤逻辑會把这类句子当「不含时间词」无条件保留（安全默认，不会误滤），
// 但语义上其实想按时间收窄，只是数据没写成可解析的月份——产出清单交内容侧补写月份。
const TIME_HINT_RE = /旺季|淡季|花期|雨季|干季|汛期|黄金周|巅峰期|高峰期|节假日/;
export function looksTimeSpecific(sentence: string): boolean { return TIME_HINT_RE.test(sentence); }
export function sentencesOf(note: string): string[] { return note.split(/[；。]/).map(s => s.trim()).filter(Boolean); }

// 纯文本导出。getWxLine=按站取「已缓存的」天气行（不发请求；无缓存返回 null），由调用方注入。
export function roadbookText(m: RoadbookModel, tripStart: string, getWxLine: (id: string) => string | null): string {
  const title = m.stops.map(d => d.name).join(" → ");
  let s = `🧭 ${title}（${m.budget.daySum}天 · ${getOrigin().name}往返${tripStart ? ` · ${tripStart} 出发` : ""}）\n`;
  let wxUsed = false;
  s += `总里程约 ${m.budget.km}km · 人均预算 ¥${m.budget.lo}~${m.budget.hi}\n\n`;
  s += `【逐日速览】\n`;
  skeletonRows(m.items).forEach(r => {
    const t = tripDate(r.n, tripStart);
    s += `${t ? fmtYMD(t) + " " : ""}D${r.n} ${r.act} ${r.stay === "🏠 回家" ? "当晚到家" : "宿" + r.stay}\n`;
  });
  s += `\n`;
  m.items.forEach((it, i) => {
    const inName = i === 0 ? getOrigin().name : m.items[i - 1].d.name;
    const outName = (i === 0 && it.legIn.gwName) ? it.legIn.gwName : it.d.name; // 入口门户（F31）
    s += `【${inName} → ${outName}】${it.legIn.mode} ${fmtH(it.legIn.hours)}（约${it.legIn.km}km）\n`;
    s += `D${it.start}${it.end > it.start ? "–D" + it.end : ""} ${it.d.name}（${it.d.chosenDays}天 · ${it.plan.title}）\n`;
    s += `  行程：${remapDayCodes(it.plan.route, it.start)}\n`;
    s += `  美食：${it.d.food.slice(0, 4).join("、")}\n`;
    if (ROUTE_STAY.has(it.d.id)) s += `  节奏：路线型玩法，沿线多点换宿（按每晚落脚点分段订房）\n`;
    s += `  住宿：${it.d.hotel || "以酒店App实查为准"}\n`;
    s += `  市内：${it.d.local || "打车/公共交通"}\n`;
    if (tripStart) { // 未设出发日期＝现状（不加当季提示行），详情/对比页从不走这条路径不受影响
      const sn = filterSeasonNote(it.d.seasonNote, stayMonths(it.start, it.end, tripStart));
      if (sn) s += `  当季提示：${sn}\n`;
    }
    const wl = getWxLine(it.d.id); // 只读缓存，不发请求；没缓存就不加这行
    if (wl) { wxUsed = true; s += `  天气参考：${wl}\n`; }
    s += `\n`;
    if (it.legOut) s += `【${it.d.name}${it.legOut.gwName ? " → " + it.legOut.gwName : ""} → ${getOrigin().name}】${it.legOut.mode} ${fmtH(it.legOut.hours)}（约${it.legOut.km}km）\n\n`;
  });
  s += "※ 时长为估算，请以 12306/航班动态为准。";
  if (wxUsed) s += "\n※ 天气参考数据来自 Open-Meteo（https://open-meteo.com · CC BY 4.0 https://creativecommons.org/licenses/by/4.0/），经本站整理换算。";
  return s;
}
