// 预算估算（design「决策机制·预算估算」）：每站消费档位×天数得住宿餐饮区间，加大交通按距离粗算，输出人均区间。
import { PER_DAY_COST } from "./constants";
import type { TripLeg, TripStopX } from "./types";

export interface TripBudget { daySum: number; lo: number; hi: number; km: number; }

export function tripBudget(stops: TripStopX[], legs: TripLeg[]): TripBudget {
  const daySum = stops.reduce((s, d) => s + d.chosenDays, 0);
  const stay = stops.reduce((s, d) => s + d.chosenDays * PER_DAY_COST[d.cost], 0);
  // M56：air 标记该段含航空运输（纯飞机/飞机+包车两档），比裸 mode==="飞机" 字符串匹配更稳健；
  // 纯飞机段只计机票价，飞机+包车在机票价外再加一段地面包车价。F64：地面价按 groundKm 而非
  // km——后者是整段大圆距离，组合档只包落地后最后一程，按 km 计价会把整段距离重复收两次钱。
  const trans = legs.reduce((s, l) => s + (l.air ? 550 + l.km * 0.35 : 0) + l.groundKm * 0.5, 0);
  const lo = Math.round((stay * 0.8 + trans) / 100) * 100;
  const hi = Math.round((stay * 1.25 + trans * 1.15) / 100) * 100;
  return { daySum, lo, hi, km: legs.reduce((s, l) => s + l.km, 0) };
}
