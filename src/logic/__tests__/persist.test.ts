// 旧持久化降级口径：F14（trip 只认城市 id + 天数界）、F18（失效线路标记降级+天数夹档）、
// F13（visited 城市 id + 去重）、tripStart 格式校验；非法形状整体抛出（调用方维持默认）。
import { describe, expect, it } from "vitest";
import { normalizePersisted, sanitizeTripItems } from "../persist";
import { byIdOf, loadRealData } from "./helpers";

const data = loadRealData();
const byId = byIdOf(data);

describe("normalizePersisted", () => {
  it("F14：trip 挡线路 id 与非法天数", () => {
    const r = normalizePersisted({
      trip: [
        { id: "route-duku-highway", days: 2 },
        { id: "hangzhou", days: 0 },
        { id: "hangzhou", days: 15 },
        { id: "chengdu", days: 3 },
      ],
    }, data);
    expect(r.trip).toEqual([{ id: "chengdu", days: 3 }]);
  });
  it("F18：失效 r 降级为独立城市站并夹到合法天数档（旧独库 yili:2→最小档）", () => {
    const yili = byId("yili")!;
    const r = normalizePersisted({ trip: [{ id: "yili", days: 2, r: "gone-route" }] }, data);
    expect(r.trip[0].r).toBeUndefined();
    expect(yili.days.includes(2)).toBe(false); // 前提：2 不是伊犁合法档
    expect(r.trip[0].days).toBe(Math.min(...yili.days));
  });
  it("现存线路的 r 标记原样保留", () => {
    const duku = byId("route-duku-highway")!;
    const trip = duku.stops!.map(s => ({ id: s.id, days: s.days, r: duku.id }));
    const r = normalizePersisted({ trip }, data);
    expect(r.trip).toEqual(trip);
  });
  it("F13：visited 挡线路 id 并去重；favs 城市+线路都行", () => {
    const r = normalizePersisted({
      visited: ["hangzhou", "hangzhou", "route-duku-highway", "bogus"],
      favs: ["hangzhou", "route-duku-highway", "bogus"],
    }, data);
    expect(r.visited).toEqual(["hangzhou"]);
    expect(r.favs).toEqual(["hangzhou", "route-duku-highway"]);
  });
  it("tripStart 只认 YYYY-MM-DD", () => {
    expect(normalizePersisted({ tripStart: "2026-07-07" }, data).tripStart).toBe("2026-07-07");
    expect(normalizePersisted({ tripStart: "垃圾" }, data).tripStart).toBe("");
    expect(normalizePersisted({}, data).tripStart).toBe("");
  });
  it("非法形状（favs 不是数组）抛出 → 调用方整体放弃维持默认（与旧版 loadLS 同径）", () => {
    expect(() => normalizePersisted({ favs: "oops" }, data)).toThrow();
  });
});

// M40：短链取回的 trip 载荷复用同一套信任边界（本地 localStorage 恢复用的是同一个函数），
// 直接测导出点本身，覆盖 normalizePersisted 测试未逐一验证过的独立调用场景。
describe("sanitizeTripItems（M40 分享短链复用同一套 trip 校验）", () => {
  it("挡线路 id 与非法天数，同 normalizePersisted 口径", () => {
    const r = sanitizeTripItems([
      { id: "route-duku-highway", days: 2 },
      { id: "hangzhou", days: 0 },
      { id: "chengdu", days: 3 },
    ], data);
    expect(r).toEqual([{ id: "chengdu", days: 3 }]);
  });
  it("失效 r 降级为独立城市站并夹到合法天数档", () => {
    const yili = byId("yili")!;
    const r = sanitizeTripItems([{ id: "yili", days: 2, r: "gone-route" }], data);
    expect(r[0].r).toBeUndefined();
    expect(r[0].days).toBe(Math.min(...yili.days));
  });
  it("非数组输入按空处理，不抛异常", () => {
    expect(sanitizeTripItems(undefined, data)).toEqual([]);
    expect(sanitizeTripItems(null, data)).toEqual([]);
  });
});
