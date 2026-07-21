// 测试基建：真实数据加载（与生产同源的 public/data chunk）+ 合成 fixture 工厂。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ById, Destination, FilterState, TripItem } from "../types";

let cache: Destination[] | null = null;
export function loadRealData(): Destination[] {
  if (!cache) {
    const dir = join(process.cwd(), "public", "data");
    const manifest: string[] = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    cache = manifest.flatMap(f => JSON.parse(readFileSync(join(dir, f), "utf8")) as Destination[]);
  }
  return cache;
}

export const byIdOf = (data: Destination[]): ById => (id: string) => data.find(d => d.id === id);

export function mkState(over: Partial<FilterState> = {}): FilterState {
  return {
    region: new Set(), season: new Set(), days: new Set(),
    crowd: new Set(), cost: new Set(), difficulty: new Set(), effort: new Set(),
    companions: new Set(), tags: new Set(), q: "", sort: "default",
    onlyFav: false, noAlt: false, hideVisited: false, distMode: null,
    favs: [], cmp: [], trip: [], visited: [], tripStart: "",
    ...over,
  };
}

export function mkCity(over: Partial<Destination> & { id: string }): Destination {
  return {
    name: over.id, emoji: "🏙", region: "华东", province: "浙江",
    coords: [30, 120], tagline: "", transit: "", difficulty: "直达",
    cost: "¥", crowd: "适中", alt: false, seasons: ["春"], seasonNote: "",
    days: [2, 3], effort: [], companions: [], tags: [],
    food: [], museums: [], architecture: [], highlights: [],
    hotel: "", local: "",
    plans: [{ days: 2, title: "两日", route: "d1-d2" }, { days: 3, title: "三日", route: "d1-d3" }],
    ...over,
  };
}

/** 按线路默认装入生成行程（与 addRouteToTrip 展开语义一致） */
export function tripOfRoute(route: Destination): TripItem[] {
  return route.stops!.map(s => ({ id: s.id, days: s.days, r: route.id }));
}
