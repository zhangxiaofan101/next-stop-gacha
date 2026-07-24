// M79 块感知精确环线优化：单元切分（完整线路组成块/被破坏则散站）、Held-Karp 精确解
// （含"贪心会答错、精确解答对"的经典构型）、块原子性（块内原序不变且连续）、当前/最优总里程
// 与 20km 阈值、<2 站无绕路语义、几何全程 havRaw 不取整。
import { describe, expect, it } from "vitest";
import { havRaw } from "../geo";
import { tripStops } from "../itinerary";
import { getOrigin } from "../origin";
import { DETOUR_HINT_KM, optimalTripOrder, tripBlocks, tripRouteHint, tripStraightKm } from "../routeOptimal";
import type { TripItem } from "../types";
import { byIdOf, mkCity, tripOfRoute } from "./helpers";

describe("单元切分（tripBlocks）", () => {
  const route = mkCity({ id: "route-x", stops: [{ id: "r1", days: 1 }, { id: "r2", days: 1 }, { id: "r3", days: 1 }] });
  const r1 = mkCity({ id: "r1", coords: [0, 10] });
  const r2 = mkCity({ id: "r2", coords: [0, 12] });
  const r3 = mkCity({ id: "r3", coords: [0, 14] });
  const free = mkCity({ id: "free", coords: [0, 30] });
  const data = [route, r1, r2, r3, free];
  const byId = byIdOf(data);

  it("完整线路组（同 legEligibleIndices 判据）合并成一个原子块，散站各自单元", () => {
    const trip = [...tripOfRoute(route), { id: "free", days: 2 }];
    const stops = tripStops(trip, byId);
    const blocks = tripBlocks(stops, byId);
    expect(blocks).toHaveLength(2);
    const routeBlock = blocks.find(b => b.idxs.length > 1)!;
    expect(routeBlock.idxs).toEqual([0, 1, 2]);
    expect(routeBlock.entry.id).toBe("r1");
    expect(routeBlock.exit.id).toBe("r3");
    const freeBlock = blocks.find(b => b.idxs.length === 1)!;
    expect(freeBlock.entry.id).toBe("free");
    expect(freeBlock.entry).toBe(freeBlock.exit); // 单点单元 entry===exit
  });

  it("整组被破坏（改序/改天数/半装）不满足 legEligibleIndices 判据 → 自然按散站切分", () => {
    const t = tripOfRoute(route);
    const reordered = tripStops([t[1], t[0], t[2]], byId);
    expect(tripBlocks(reordered, byId).every(b => b.idxs.length === 1)).toBe(true);
    const half = tripStops([t[0], t[2]], byId);
    expect(tripBlocks(half, byId).every(b => b.idxs.length === 1)).toBe(true);
    const daysChanged = tripStops([t[0], { ...t[1], days: t[1].days + 1 }, t[2]], byId);
    expect(tripBlocks(daysChanged, byId).every(b => b.idxs.length === 1)).toBe(true);
  });
});

describe("块原子性：精确解不拆散、不打乱整组线路顺序", () => {
  it("即便把散站插进块内部会更短，输出里块内三站仍连续且原序不变", () => {
    // r1(0,10)-r2(0,12)-r3(0,14) 是方向恒定的原子块；free(0,11) 卡在 r1/r2 之间——
    // 若允许插花会更短，但整组不可拆，精确解只能把 free 整体排在块之前或之后。
    const route = mkCity({ id: "route-y", stops: [{ id: "s1", days: 1 }, { id: "s2", days: 1 }, { id: "s3", days: 1 }] });
    const s1 = mkCity({ id: "s1", coords: [0, 10] });
    const s2 = mkCity({ id: "s2", coords: [0, 12] });
    const s3 = mkCity({ id: "s3", coords: [0, 14] });
    const free = mkCity({ id: "wedge", coords: [0, 11] });
    const data = [route, s1, s2, s3, free];
    const byId = byIdOf(data);
    const trip: TripItem[] = [...tripOfRoute(route), { id: "wedge", days: 2 }];
    const optimal = optimalTripOrder(trip, byId);
    const ids = optimal.map(t => t.id);
    const pos = ["s1", "s2", "s3"].map(id => ids.indexOf(id));
    expect(pos).toEqual([...pos].sort((a, b) => a - b)); // s1→s2→s3 位置递增，块内原序不变
    expect(Math.max(...pos) - Math.min(...pos)).toBe(2); // 三站相邻连续，未被 wedge 插入中间
  });
});

describe("精确解正确性：贪心会答错、精确解答对（经典构型）", () => {
  // 成都/杭州/南京 + 上海出发：6 种排列的真实总里程已知，唯一最小值=杭州↔成都↔南京环
  // （3384.7km，两个方向互为镜像同值），当前给定顺序（成都在前）落在次优环（3710.8km）——
  // 若走最近邻贪心（旧实现），会从"成都"出发一路贴最近城市走，答案正是这个被本例证伪的次优解。
  const chengdu = mkCity({ id: "chengdu", coords: [30.66, 104.06] });
  const hangzhou = mkCity({ id: "hangzhou", coords: [30.25, 120.16] });
  const nanjing = mkCity({ id: "nanjing", coords: [32.06, 118.8] });
  const byId = byIdOf([chengdu, hangzhou, nanjing]);
  const trip: TripItem[] = [{ id: "chengdu", days: 3 }, { id: "hangzhou", days: 2 }, { id: "nanjing", days: 2 }];

  it("optimalTripOrder 找到全局最小总里程排列（成都居中，杭州/南京两端）", () => {
    const optimal = optimalTripOrder(trip, byId);
    const km = tripStraightKm(getOrigin(), tripStops(optimal, byId));
    expect(km).toBeCloseTo(3384.7, 0);
    const ids = optimal.map(t => t.id).join(",");
    expect(["hangzhou,chengdu,nanjing", "nanjing,chengdu,hangzhou"]).toContain(ids);
  });

  it("当前给定顺序（成都→杭州→南京）总里程明显更差，验证确有「贪心会答错」的绕路空间", () => {
    const currentKm = tripStraightKm(getOrigin(), tripStops(trip, byId));
    expect(currentKm).toBeCloseTo(3710.8, 0);
    expect(currentKm).toBeGreaterThan(3384.7 + DETOUR_HINT_KM); // 绕路远超 20km 阈值
  });

  it("并列最优保持现状：已是最优的行程再跑一次不换序（环线反向恒等长，不守卫会来回翻方向）", () => {
    const optimal = optimalTripOrder(trip, byId);
    const again = optimalTripOrder(optimal, byId);
    expect(again.map(t => t.id)).toEqual(optimal.map(t => t.id));
    const thrice = optimalTripOrder(again, byId);
    expect(thrice.map(t => t.id)).toEqual(optimal.map(t => t.id));
  });
});

describe("当前/最优总里程与 20km 阈值（tripRouteHint）", () => {
  const chengdu = mkCity({ id: "chengdu", coords: [30.66, 104.06] });
  const hangzhou = mkCity({ id: "hangzhou", coords: [30.25, 120.16] });
  const nanjing = mkCity({ id: "nanjing", coords: [32.06, 118.8] });
  const byId = byIdOf([chengdu, hangzhou, nanjing]);
  const trip: TripItem[] = [{ id: "chengdu", days: 3 }, { id: "hangzhou", days: 2 }, { id: "nanjing", days: 2 }];

  it("明显绕路（省距≥20km）：showButton=true，一键按最优的结果再算一次即已最优", () => {
    const hint = tripRouteHint(trip, byId);
    expect(hint.currentKm).toBeCloseTo(3710.8, 0);
    expect(hint.optimalKm).toBeCloseTo(3384.7, 0);
    expect(hint.diffKm).toBeGreaterThanOrEqual(DETOUR_HINT_KM);
    expect(hint.showButton).toBe(true);

    const hint2 = tripRouteHint(hint.optimalTrip, byId);
    expect(hint2.diffKm).toBeCloseTo(0, 6);
    expect(hint2.showButton).toBe(false);
  });

  it("省距<20km：视为已顺路，不出按钮", () => {
    // P(0,10)/Q(0,10.5)/S(0,20)：当前序 Q,P,S 总里程比全局最优只多约 9km，低于阈值
    const P = mkCity({ id: "p", coords: [0, 10] });
    const Q = mkCity({ id: "q", coords: [0, 10.5] });
    const S = mkCity({ id: "s", coords: [0, 20] });
    const byId2 = byIdOf([P, Q, S]);
    const trip2: TripItem[] = [{ id: "q", days: 1 }, { id: "p", days: 1 }, { id: "s", days: 1 }];
    const hint = tripRouteHint(trip2, byId2);
    expect(hint.diffKm).toBeGreaterThan(0);
    expect(hint.diffKm).toBeLessThan(DETOUR_HINT_KM);
    expect(hint.showButton).toBe(false);
  });

  it("行程 <2 站没有绕路语义：currentKm===optimalKm，恒不出按钮", () => {
    expect(tripRouteHint([], byId).showButton).toBe(false);
    const single = tripRouteHint([{ id: "chengdu", days: 2 }], byId);
    expect(single.showButton).toBe(false);
    expect(single.currentKm).toBeCloseTo(single.optimalKm, 6);
  });
});

describe("几何精度：havRaw 不取整（F17 同源坑）", () => {
  it("tripStraightKm 与逐段 havRaw 手工求和完全一致，且结果不是被取整的整数", () => {
    const a = mkCity({ id: "a", coords: [30, 120] });
    const b = mkCity({ id: "b", coords: [30.017, 120.013] }); // 相距约 2km，真实值含小数
    const byId = byIdOf([a, b]);
    const stops = tripStops([{ id: "a", days: 1 }, { id: "b", days: 1 }], byId);
    const o = getOrigin();
    const got = tripStraightKm(o, stops);
    const expected = havRaw(o.coords, a.coords) + havRaw(a.coords, b.coords) + havRaw(b.coords, o.coords);
    expect(got).toBeCloseTo(expected, 9);
    expect(Number.isInteger(got)).toBe(false);
  });
});
