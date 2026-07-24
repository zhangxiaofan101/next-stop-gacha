// 块感知精确环线优化（design M79）：完整线路组（与 legEligibleIndices 同判据，见 itinerary.ts）
// 视为方向恒定的原子块——组内站序不可打乱、以首站为入口/末站为出口参与排列；自由城市各自
// 独立成单点单元（entry===exit）。单元数=行程站数（TRIP_MAX=10）以内，对「出发地→各单元→
// 出发地」环跑 Held-Karp 精确求最小总里程排列，取代原最近邻贪心（贪心逐站重排会拆散整线组，
// 块原子性让 leg 整组文案天然保全）。几何一律 havRaw 不取整（F17：取整会破坏三角不等式）。
import { havRaw } from "./geo";
import { getOrigin } from "./origin";
import { legEligibleIndices, tripStops } from "./itinerary";
import type { ById, Place, TripItem, TripStopX } from "./types";

export interface RouteBlock {
  /** stops 下标，块内保持原相对顺序（不可打乱——线路组方向恒定） */
  idxs: number[];
  entry: TripStopX; // 块入口=首站
  exit: TripStopX;  // 块出口=末站（单点单元 entry===exit）
}

// 单元切分：与 legEligibleIndices 同判据的连续同源线路组各自成一个原子块；
// 被破坏/半装的线路组本就不满足该判据，自然按散站（各自独立单元）处理，无需额外分支。
export function tripBlocks(stops: TripStopX[], byId: ById): RouteBlock[] {
  const legIdx = legEligibleIndices(stops, byId);
  const blocks: RouteBlock[] = [];
  let i = 0;
  while (i < stops.length) {
    if (legIdx.has(i) && stops[i].rid) {
      const rid = stops[i].rid;
      let j = i;
      while (j + 1 < stops.length && legIdx.has(j + 1) && stops[j + 1].rid === rid) j++;
      blocks.push({ idxs: Array.from({ length: j - i + 1 }, (_, k) => i + k), entry: stops[i], exit: stops[j] });
      i = j + 1;
    } else {
      blocks.push({ idxs: [i], entry: stops[i], exit: stops[i] });
      i++;
    }
  }
  return blocks;
}

// Held-Karp：块视作有向节点（入口/出口坐标可不同），求「出发地→各块→出发地」环的最小总里程排列。
// dp[mask][j]=已访问 mask 集合、以块 j 结尾（位于其出口坐标）时的最小里程；O(2^m·m^2)，
// m≤TRIP_MAX=10（1024×100 次量级）可靠求精确解，不需要近似启发式。
function heldKarpOrder(blocks: RouteBlock[], origin: Place): RouteBlock[] {
  const m = blocks.length;
  if (m <= 1) return blocks;
  const entry = (k: number) => blocks[k].entry.coords;
  const exit = (k: number) => blocks[k].exit.coords;
  const fromOrigin = blocks.map((_, k) => havRaw(origin.coords, entry(k)));
  const toOrigin = blocks.map((_, k) => havRaw(exit(k), origin.coords));
  const FULL = (1 << m) - 1;
  const dp: number[][] = Array.from({ length: 1 << m }, () => new Array(m).fill(Infinity));
  const par: number[][] = Array.from({ length: 1 << m }, () => new Array(m).fill(-1));
  for (let j = 0; j < m; j++) dp[1 << j][j] = fromOrigin[j];
  for (let mask = 1; mask <= FULL; mask++) {
    for (let j = 0; j < m; j++) {
      if (!(mask & (1 << j)) || dp[mask][j] === Infinity) continue;
      for (let k = 0; k < m; k++) {
        if (mask & (1 << k)) continue; // 块 k 已在 mask 里，不能重复访问
        const nmask = mask | (1 << k);
        const cand = dp[mask][j] + havRaw(exit(j), entry(k));
        if (cand < dp[nmask][k]) { dp[nmask][k] = cand; par[nmask][k] = j; }
      }
    }
  }
  let bestJ = 0, bestCost = Infinity;
  for (let j = 0; j < m; j++) {
    const cand = dp[FULL][j] + toOrigin[j];
    if (cand < bestCost) { bestCost = cand; bestJ = j; }
  }
  const order: number[] = [];
  let mask = FULL, j = bestJ;
  while (j !== -1) { order.push(j); const pj = par[mask][j]; mask ^= (1 << j); j = pj; }
  order.reverse();
  return order.map(k => blocks[k]);
}

// 环线总里程：出发地→stops[0]→…→stops[n-1]→出发地，havRaw 逐段求和、不取整
// （供比较用；展示前由调用方自行取整，同 hav() 的取舍分工）。
export function tripStraightKm(origin: Place, stops: TripStopX[]): number {
  if (!stops.length) return 0;
  let s = havRaw(origin.coords, stops[0].coords);
  for (let i = 0; i < stops.length - 1; i++) s += havRaw(stops[i].coords, stops[i + 1].coords);
  return s + havRaw(stops[stops.length - 1].coords, origin.coords);
}

// 精确解：块内原相对顺序与方向不变，只对块之间的排列跑 Held-Karp；展平回 TripItem[]。
// 取代原 nearestNeighborOrder（最近邻贪心逐站重排会拆散整线组，块原子性让其天然保全）。
// 并列最优保持现状：环线反向恒等长（对称环必然并列），已是最优的行程若不设此守卫，
// 每次点「顺路排序」都可能翻个方向——重排成本一样却动了用户已有顺序，再点又翻回来。
export function optimalTripOrder(trip: TripItem[], byId: ById): TripItem[] {
  if (trip.length < 2) return trip.slice(); // 0/1 站无排列可言，直接原样返回
  const o = getOrigin();
  const stops = tripStops(trip, byId);
  const blocks = tripBlocks(stops, byId);
  const order = heldKarpOrder(blocks, o);
  const next = order.flatMap(b => b.idxs).map(i => trip[i]);
  const gain = tripStraightKm(o, stops) - tripStraightKm(o, tripStops(next, byId));
  return gain > 1e-6 ? next : trip.slice();
}

export const DETOUR_HINT_KM = 20; // design M79：省距阈值——低于此值不值得为「更优」放弃已排好的顺序

export interface RouteHint {
  currentKm: number; // 当前顺序总里程（havRaw，不取整）
  optimalKm: number; // 精确解总里程
  diffKm: number;    // 当前比最优多绕的里程，恒 ≥0
  showButton: boolean; // 非最优且省距达阈值——地图下方给「一键按最优」
  optimalTrip: TripItem[];
}

// 行程 <2 站没有绕路语义（单站/空行程不存在"顺路"排列），currentKm===optimalKm、不显示按钮。
export function tripRouteHint(trip: TripItem[], byId: ById): RouteHint {
  const o = getOrigin();
  const stops = tripStops(trip, byId);
  const currentKm = tripStraightKm(o, stops);
  if (trip.length < 2) return { currentKm, optimalKm: currentKm, diffKm: 0, showButton: false, optimalTrip: trip.slice() };
  const optimalTrip = optimalTripOrder(trip, byId);
  const optimalKm = tripStraightKm(o, tripStops(optimalTrip, byId));
  const diffKm = Math.max(0, currentKm - optimalKm); // 精确解恒为全局最小，浮点误差兜底不为负
  return { currentKm, optimalKm, diffKm, showButton: diffKm >= DETOUR_HINT_KM, optimalTrip };
}
