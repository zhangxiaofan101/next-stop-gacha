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
  distMode: null, // M68：搜「短途/长途」命中概念词后设置，非离散筛选组
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

// M41：本机绑定的同步码（不是长命资产本身，只是「这台设备认哪个码」的指针，丢了不影响 favs/visited）。
const SYNC_LS_KEY = "nextstop_sync_v1";
export function getSyncCode(): string {
  try { return localStorage.getItem(SYNC_LS_KEY) || ""; } catch (e) { return ""; }
}
export function setSyncCode(code: string) {
  try { localStorage.setItem(SYNC_LS_KEY, code); } catch (e) {}
}
export function clearSyncCode() {
  try { localStorage.removeItem(SYNC_LS_KEY); } catch (e) {}
}

// M45：皮肤选择（原始值，某皮肤 id 或 "random"）。store 只管读写原始字符串，不判断合法性/
// 兜默认——缺失或读取异常一律返回 null，"选哪个是合法的/默认是谁"交给 skins/registry.ts
// 的 resolveSkinId 决定（同 SYNC_LS_KEY：store 保持哑，判断逻辑不下沉到持久化层）。
const SKIN_LS_KEY = "nextstop_skin_v1";
export function getSkinChoice(): string | null {
  try { return localStorage.getItem(SKIN_LS_KEY); } catch (e) { return null; }
}
export function setSkinChoice(choice: string) {
  try { localStorage.setItem(SKIN_LS_KEY, choice); } catch (e) {}
}
