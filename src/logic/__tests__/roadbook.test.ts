// 不变式：方案就近降配、leg 整组文案接管（F18/F21）、逐日骨架（M29）、
// F35 移动住宿句式、门户进出文案（F31）、日期标注与文本导出。
import { describe, expect, it } from "vitest";
import type { RoadbookItem } from "../roadbook";
import { pickPlan, roadbookModel, roadbookText, routeDaysText, shortName, skelDayLabel, skeletonRows, tripDate, fmtYMD } from "../roadbook";
import type { TripLeg } from "../types";
import { byIdOf, loadRealData, mkCity, tripOfRoute } from "./helpers";

const data = loadRealData();
const byId = byIdOf(data);

describe("pickPlan 就近降配", () => {
  const d = mkCity({
    id: "x", days: [2, 3, 5],
    plans: [{ days: 2, title: "2日", route: "" }, { days: 3, title: "3日", route: "" }, { days: 5, title: "5日", route: "" }],
  });
  it("精确命中优先", () => { expect(pickPlan(d, 5).days).toBe(5); });
  it("无精确档 → 就近向下（4→3）", () => { expect(pickPlan(d, 4).days).toBe(3); });
  it("超出最大档 → 最大档（7→5）", () => { expect(pickPlan(d, 7).days).toBe(5); });
  it("低于最小档 → 首档（1→2）", () => { expect(pickPlan(d, 1).days).toBe(2); });
});

describe("leg 整组文案接管（F18/F21）", () => {
  it("独库整条装入：站点方案用线路 leg 文案（title=线路名），不再「按 N 天版改编」", () => {
    const duku = byId("route-duku-highway")!;
    const m = roadbookModel(tripOfRoute(duku), byId);
    m.items.forEach((it, i) => {
      expect(it.plan.title).toBe(duku.name);
      expect(it.plan.route).toBe(duku.stops![i].leg!.route);
      expect(it.plan.days).toBe(it.d.chosenDays); // days 对齐 → UI 不会渲染「改编」标注
    });
  });
  it("改天数破坏整组 → 回退城市 pickPlan", () => {
    const duku = byId("route-duku-highway")!;
    const t = tripOfRoute(duku);
    t[0] = { ...t[0], days: t[0].days + 1 };
    const m = roadbookModel(t, byId);
    expect(m.items[1].plan.title).not.toBe(duku.name);
  });
});

const fakeLeg = (over: Partial<TripLeg> = {}): TripLeg => ({
  from: { name: "上海", coords: [31.23, 121.47] }, to: { name: "x", coords: [30, 120] },
  gwName: null, km: 100, mode: "高铁", icon: "🚄", hours: 2, ...over,
});

describe("逐日骨架（M29 / F35）", () => {
  it("F35：连住移动住宿（游轮）输出「游轮上继续游览沿途景点」，绝无「游游轮一带」", () => {
    const m = roadbookModel(tripOfRoute(byId("route-three-gorges-cruise")!), byId);
    const rows = skeletonRows(m.items);
    expect(rows.some(r => r.act === "游轮上继续游览沿途景点")).toBe(true);
    rows.forEach(r => expect(r.act).not.toContain("游游轮"));
  });
  it("真实地名连住仍是「游X一带」", () => {
    const items: RoadbookItem[] = [{
      d: { ...mkCity({ id: "lijiang2", name: "丽江" }), chosenDays: 2, fromRoute: false },
      start: 1, end: 2,
      plan: { days: 2, title: "t", route: "r", stays: ["丽江", "丽江"] },
      legIn: fakeLeg(), legOut: null,
    }];
    expect(skeletonRows(items)[1].act).toBe("游丽江一带");
  });
  it("换宿日输出「A → B（沿线玩过去）」，末日拼返程与到家", () => {
    const items: RoadbookItem[] = [{
      d: { ...mkCity({ id: "yili2", name: "伊犁" }), chosenDays: 2, fromRoute: false },
      start: 1, end: 2,
      plan: { days: 2, title: "t", route: "r", stays: ["伊宁", "那拉提"] },
      legIn: fakeLeg({ mode: "飞机", hours: 8 }), legOut: fakeLeg({ mode: "飞机", hours: 8.5 }),
    }];
    const rows = skeletonRows(items);
    expect(rows[0].act).toContain("上海 → 伊犁");
    expect(rows[0].act).toContain("进线到伊宁");
    expect(rows[1].act).toContain("伊宁 → 那拉提（沿线玩过去）");
    expect(rows[1].act).toContain("飞机返回上海");
    expect(rows[1].stay).toBe("🏠 回家");
  });
  it("门户文案（F31）：海南西线 D1「进线到」，末日「经海口…返回上海」", () => {
    const m = roadbookModel(tripOfRoute(byId("route-hainan-west")!), byId);
    const rows = skeletonRows(m.items);
    expect(rows[0].act).toContain("上海 → 三亚");
    expect(rows[0].act).toContain("进线到");
    const last = rows[rows.length - 1];
    expect(last.act).toContain("经海口");
    expect(last.act).toContain("返回上海");
  });
});

describe("日期标注（M29）", () => {
  it("出发日期 2026-07-07 → D1=20260707，跨天推进", () => {
    const d1 = tripDate(1, "2026-07-07")!, d3 = tripDate(3, "2026-07-07")!;
    expect(fmtYMD(d1)).toBe("20260707");
    expect(fmtYMD(d3)).toBe("20260709");
    expect(skelDayLabel(1, "2026-07-07").date).not.toBe("");
  });
  it("未设/非法出发日期 → 无日期，退回 D 序号", () => {
    expect(tripDate(1, "")).toBeNull();
    expect(tripDate(1, "垃圾输入")).toBeNull();
    expect(skelDayLabel(2, "").d).toBe("D2");
    expect(skelDayLabel(2, "").date).toBe("");
  });
});

describe("文本导出", () => {
  it("含逐日速览与估算免责；天气行只在缓存命中时出现并追加署名", () => {
    const trip = [{ id: "hangzhou", days: 2 }];
    const m = roadbookModel(trip, byId);
    const noWx = roadbookText(m, "", () => null);
    expect(noWx).toContain("【逐日速览】");
    expect(noWx).toContain("※ 时长为估算");
    expect(noWx).not.toContain("Open-Meteo");
    const wx = roadbookText(m, "2026-07-07", id => (id === "hangzhou" ? "☀️33° 🌤32°" : null));
    expect(wx).toContain("天气参考：☀️33° 🌤32°");
    expect(wx).toContain("Open-Meteo");
    expect(wx).toContain("20260707 D1");
  });
});

describe("线路天数展示（F8）与短名", () => {
  it("routeDaysText：区间 + 默认Σ天", () => {
    const duku = byId("route-duku-highway")!;
    const sum = duku.stops!.reduce((s, x) => s + x.days, 0);
    expect(routeDaysText(duku)).toBe(`约${Math.min(...duku.days)}~${Math.max(...duku.days)}天 · 默认${sum}天`);
  });
  it("shortName 截断「·」与括号", () => {
    expect(shortName({ name: "伊犁（伊宁·赛里木湖）" })).toBe("伊犁");
    expect(shortName({ name: "乐山·峨眉山" })).toBe("乐山");
    expect(shortName({ name: "杭州" })).toBe("杭州");
  });
});
