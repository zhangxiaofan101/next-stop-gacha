// 预算估算（design「决策机制·预算估算」）：每站消费档位×天数得住宿餐饮区间，加大交通按距离粗算，输出人均区间。
import { PER_DAY_COST } from "./constants";
import type { TripLeg, TripStopX } from "./types";

export interface TripBudget { daySum: number; lo: number; hi: number; km: number; }

export function tripBudget(stops: TripStopX[], legs: TripLeg[]): TripBudget {
  const daySum = stops.reduce((s, d) => s + d.chosenDays, 0);
  const stay = stops.reduce((s, d) => s + d.chosenDays * PER_DAY_COST[d.cost], 0);
  const trans = legs.reduce((s, l) => s + (l.mode === "飞机" ? 550 + l.km * 0.35 : l.km * 0.5), 0);
  const lo = Math.round((stay * 0.8 + trans) / 100) * 100;
  const hi = Math.round((stay * 1.25 + trans * 1.15) / 100) * 100;
  return { daySum, lo, hi, km: legs.reduce((s, l) => s + l.km, 0) };
}
