// 过滤/排序/chip 语义/空池治理（design「决策机制·过滤」「空池治理」）。
// 全部纯函数：data 与 state 显式传入，DOM 副作用（清搜索框/按钮高亮）由 UI 层按 action 描述符执行。
import { CEIL_GROUPS, DAY_BUCKETS, GROUP_NAMES } from "./constants";
import type { Destination, FilterState, GroupKey } from "./types";

const group = (state: FilterState, k: GroupKey) => state[k];

// 单条记录是否命中；okey/oset 可临时覆盖某一组条件（okey="q"/"onlyFav"/"noAlt"/"hideVisited" 时表示清掉该项），
// 供 chip 实时计数与空态定向放宽做"如果改这一个条件会怎样"的假设计算。
export function matchOne(d: Destination, state: FilterState, okey: string | null = null, oset: Set<string> | null = null): boolean {
  const g = (k: GroupKey) => (k === okey ? oset! : group(state, k));
  const q = okey === "q" ? "" : state.q;
  const fav = okey === "onlyFav" ? false : state.onlyFav;
  const noAlt = okey === "noAlt" ? false : state.noAlt;
  const hideV = okey === "hideVisited" ? false : state.hideVisited;
  if (fav && !state.favs.includes(d.id)) return false;
  if (noAlt && d.alt) return false;
  if (hideV && state.visited.includes(d.id)) return false;
  if (g("region").size && !(d.regions || [d.region]).some(r => g("region").has(r))) return false;
  if (g("season").size && !d.seasons.some(s => g("season").has(s))) return false;
  if (g("days").size && !DAY_BUCKETS.some(b => g("days").has(b.key) && b.test(d.days))) return false;
  if (g("crowd").size && !g("crowd").has(d.crowd)) return false;
  if (g("cost").size && !g("cost").has(d.cost)) return false;
  if (g("difficulty").size && !g("difficulty").has(d.difficulty)) return false;
  // 体力：偏好型多选 OR；记录 effort 为空数组 = 怎么玩都行，任何选择都命中
  if (g("effort").size && d.effort.length && !d.effort.some(x => g("effort").has(x))) return false;
  // 同行：同上口径，空数组 = 谁来都合适
  if (g("companions").size && d.companions.length && !d.companions.some(x => g("companions").has(x))) return false;
  if (g("tags").size && ![...g("tags")].every(t => d.tags.includes(t))) return false;
  if (q) {
    const hay = [d.name, d.province, d.tagline, ...d.tags, ...d.food, ...d.highlights, ...d.architecture, ...d.museums].join(" ").toLowerCase();
    if (!hay.includes(q.toLowerCase())) return false;
  }
  return true;
}

export const countWith = (data: Destination[], state: FilterState, okey: string | null, oset: Set<string> | null) =>
  data.reduce((n, d) => n + (matchOne(d, state, okey, oset) ? 1 : 0), 0);

// 模拟点击某 chip 后该组的选中集——真实点击与「点下去还剩几个」计数共用这一个语义源：
// 天花板组点第 t 档 → 选中 0..t 全部（再点当前天花板则清空）；其余组 toggle。
export function simulateChipClick(state: FilterState, key: GroupKey, v: string): Set<string> {
  const cur = group(state, key);
  const next = new Set(cur);
  const order = CEIL_GROUPS[key];
  if (order) {
    const t = order.indexOf(v);
    const curCeil = cur.size ? Math.max(...[...cur].map(x => order.indexOf(x))) : -1;
    next.clear();
    if (curCeil !== t) order.slice(0, t + 1).forEach(x => next.add(x));
  } else {
    next.has(v) ? next.delete(v) : next.add(v);
  }
  return next;
}

// 空池时的定向放宽候选：去掉单个玩法 tag / 放开整组 / 清搜索词 / 关只看收藏等开关，按救回数降序。
// action 为纯描述符，UI 层负责执行（含对应的 DOM 复位）。
export type RelaxAction =
  | { type: "dropTag"; tag: string }
  | { type: "clearGroup"; key: GroupKey }
  | { type: "clearQ" }
  | { type: "clearOnlyFav" }
  | { type: "clearNoAlt" }
  | { type: "clearHideVisited" };

export interface RelaxCandidate { label: string; n: number; action: RelaxAction; }

export function relaxCandidates(data: Destination[], state: FilterState): RelaxCandidate[] {
  const cands: RelaxCandidate[] = [];
  [...state.tags].forEach(t => {
    const s = new Set(state.tags); s.delete(t);
    cands.push({ label: `去掉「${t}」`, n: countWith(data, state, "tags", s), action: { type: "dropTag", tag: t } });
  });
  (Object.keys(GROUP_NAMES) as GroupKey[]).forEach(k => {
    if (state[k].size) cands.push({ label: `不限${GROUP_NAMES[k]}`, n: countWith(data, state, k, new Set()), action: { type: "clearGroup", key: k } });
  });
  if (state.q) cands.push({ label: `清掉搜索「${state.q}」`, n: countWith(data, state, "q", null), action: { type: "clearQ" } });
  if (state.onlyFav) cands.push({ label: "不只看收藏", n: countWith(data, state, "onlyFav", null), action: { type: "clearOnlyFav" } });
  if (state.noAlt) cands.push({ label: "不避开高海拔", n: countWith(data, state, "noAlt", null), action: { type: "clearNoAlt" } });
  if (state.hideVisited) cands.push({ label: "不隐藏去过的", n: countWith(data, state, "hideVisited", null), action: { type: "clearHideVisited" } });
  return cands.filter(c => c.n > 0).sort((a, b) => b.n - a.n);
}

export function filtered(data: Destination[], state: FilterState, curSeason: string): Destination[] {
  let list = data.filter(d => matchOne(d, state, null, null));
  const crowdRank: Record<string, number> = { "小众": 0, "适中": 1, "热门": 2 };
  if (state.sort === "hidden") list = [...list].sort((a, b) => crowdRank[a.crowd] - crowdRank[b.crowd]);
  if (state.sort === "hot") list = [...list].sort((a, b) => crowdRank[b.crowd] - crowdRank[a.crowd]);
  if (state.sort === "short") list = [...list].sort((a, b) => Math.min(...a.days) - Math.min(...b.days));
  if (state.sort === "season") list = [...list].sort((a, b) => (b.seasons.includes(curSeason) ? 1 : 0) - (a.seasons.includes(curSeason) ? 1 : 0));
  return list;
}
