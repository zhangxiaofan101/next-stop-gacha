// localStorage 状态的加载口径（F13/F14/F18 全部规则）。
// 注意：与旧版 loadLS 逐字同语义——非法形状（如 favs 不是数组）直接抛给调用方，
// 由调用方整体放弃并维持默认值；不做部分打捞。
import type { Destination, TripItem } from "./types";

export interface PersistedState {
  favs: string[]; cmp: string[]; trip: TripItem[]; visited: string[]; tripStart: string;
}

export function normalizePersisted(s: any, data: Destination[]): PersistedState {
  const byId = (id: string) => data.find(x => x.id === id);
  const ids = new Set(data.map(d => d.id));
  const cityIds = new Set(data.filter(d => !d.stops).map(d => d.id));
  const favs = (s.favs || []).filter((id: string) => ids.has(id));
  const cmp = (s.cmp || []).filter((id: string) => ids.has(id));
  // F14：trip 只认城市 id——旧版顺路彩蛋可能把线路 id 持久化成单站，升级加载时挡掉；天数也一并校验
  const trip: TripItem[] = (s.trip || []).filter((t: TripItem) => t && cityIds.has(t.id) && Number.isInteger(t.days) && t.days >= 1 && t.days <= 14);
  // F18：旧版把线路装入标记持久化为 r:1（线路 id 已丢失，无法安全重建原线路）。降级迁移=去掉失效的 r
  // 变回独立城市站，并把天数夹到该城市的合法方案档，避免继续吐「按 N 天版改编」（如旧独库 yili:2→5）。
  const routeIds = new Set(data.filter(d => d.stops).map(d => d.id));
  trip.forEach(t => {
    if (t.r && !routeIds.has(t.r)) {
      delete t.r;
      const c = byId(t.id);
      if (c && !c.days.includes(t.days)) t.days = Math.min(...c.days);
    }
  });
  // F13：visited 只认城市 id——schema 内合法但业务非法的线路 id 也要挡掉，并顺手去重
  const visited = [...new Set((s.visited || []).filter((id: string) => cityIds.has(id)))] as string[];
  const tripStart = /^\d{4}-\d{2}-\d{2}$/.test(s.tripStart || "") ? s.tripStart : "";
  return { favs, cmp, trip, visited, tripStart };
}
