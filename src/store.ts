// 应用状态与持久化：DATA（运行时 fetch 后注入）、可变 state 单例、localStorage 读写。
// localStorage 键名/结构不变（nextstop_v2），老用户状态无损（M37 验收口径延续）。
import { seasonForMonth } from "./logic/constants";
import { normalizePersisted } from "./logic/persist";
import type { Destination, FilterState } from "./logic/types";

export let DATA: Destination[] = [];
export function setData(d: Destination[]) { DATA = d; }
export const byId = (id: string) => DATA.find(x => x.id === id);

export const CUR_SEASON = seasonForMonth(new Date().getMonth());

export const state: FilterState = {
  region: new Set(), season: new Set(), days: new Set(),
  crowd: new Set(), cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(), tags: new Set(), q: "", sort: "default", onlyFav: false, noAlt: false, hideVisited: false,
  favs: [], cmp: [], trip: [], // trip: [{id, days}]
  visited: [], // 已打卡的城市 id
  tripStart: "", // M29 出发日期（"YYYY-MM-DD"，空=不标日期，路书退回 D1/D2 记法）
};

const LS_KEY = "nextstop_v2";
export function saveLS() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ favs: state.favs, cmp: state.cmp, trip: state.trip, visited: state.visited, tripStart: state.tripStart })); } catch (e) {}
}
export function loadLS() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    Object.assign(state, normalizePersisted(s, DATA)); // 非法形状在 normalize 内抛出 → 整体放弃，维持默认值（与旧版一致）
  } catch (e) {}
}
