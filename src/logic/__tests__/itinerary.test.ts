// 不变式：leg 整组判定（F21）、进出门户（F31）、overland 段级禁飞（F29）、
// 顺路彩蛋两类语义与开关（M28 二~四轮）、F34 锚点后并列判据、最近邻顺路排序。
import { describe, expect, it } from "vitest";
import { bestInsertion, legEligibleIndices, nearestNeighborOrder, onwaySuggestions, tripGateway, tripLegs, tripStops } from "../itinerary";
import type { TripItem } from "../types";
import { byIdOf, loadRealData, mkState, tripOfRoute } from "./helpers";

const data = loadRealData();
const byId = byIdOf(data);
const stopsOf = (trip: TripItem[]) => tripStops(trip, byId);

describe("最近邻顺路排序（上海起点贪心）", () => {
  it("成都/杭州/南京 → 杭州→南京→成都", () => {
    const trip: TripItem[] = [{ id: "chengdu", days: 3 }, { id: "hangzhou", days: 2 }, { id: "nanjing", days: 2 }];
    expect(nearestNeighborOrder(trip, byId).map(t => t.id)).toEqual(["hangzhou", "nanjing", "chengdu"]);
  });
});

describe("F34：单站行程锚点前后并列时，插在锚点之后", () => {
  it("成都 + 乐山 → [成都, 乐山]（at=1，锚定成都）", () => {
    const trip: TripItem[] = [{ id: "chengdu", days: 3 }];
    const r = bestInsertion(byId("leshan-emeishan")!, stopsOf(trip));
    expect(r.at).toBe(1);
    expect(r.near?.name).toBe("成都");
  });
  it("多站回归：杭州→成都→南京 + 都江堰 → 插在成都之后（at=2）", () => {
    const trip: TripItem[] = [{ id: "hangzhou", days: 2 }, { id: "chengdu", days: 3 }, { id: "nanjing", days: 2 }];
    const r = bestInsertion(byId("dujiangyan-qingcheng")!, stopsOf(trip));
    expect(r.at).toBe(2);
    expect(Number.isFinite(r.add)).toBe(true);
  });
});

describe("顺路彩蛋（M28 二~四轮语义）", () => {
  it("全直飞行程（上海⇄拉萨）无廊道候选，拉萨周边无卡=诚实为空", () => {
    const s = mkState({ trip: [{ id: "lhasa", days: 3 }] });
    expect(onwaySuggestions(data, s, byId)).toHaveLength(0);
  });
  it("直飞目的地（三亚）只出落脚顺游：全部锚定三亚、≤150km", () => {
    const s = mkState({ trip: [{ id: "sanya", days: 3 }] });
    const sug = onwaySuggestions(data, s, byId);
    expect(sug.length).toBeGreaterThan(0);
    sug.forEach(x => {
      expect(x.near?.name).toBe("三亚");
      expect(x.add).toBeLessThanOrEqual(150);
    });
    const wzs = onwaySuggestions(data, s, byId, 99).find(x => x.d.id === "wuzhishan");
    expect(wzs).toBeTruthy();
    expect(wzs!.add).toBeGreaterThan(50);
    expect(wzs!.add).toBeLessThan(70);
  });
  it("陆路行程（杭州+黄山）出廊道候选（near=null，+绕Nkm<200）", () => {
    const s = mkState({ trip: [{ id: "hangzhou", days: 2 }, { id: "huangshan", days: 2 }] });
    const sug = onwaySuggestions(data, s, byId);
    expect(sug).toHaveLength(3);
    sug.forEach(x => expect(x.add).toBeLessThan(200));
    const all = onwaySuggestions(data, s, byId, 99);
    expect(all.some(x => x.d.id === "moganshan" || x.d.id === "zhouzhuang-jinxi")).toBe(true);
    expect(all.every(x => !x.d.stops)).toBe(true); // 线路卡不进彩蛋
  });
  it("尊重「避开高海拔」开关（四轮）：丽江基线含高海拔候选，开开关后全排除", () => {
    const base = onwaySuggestions(data, mkState({ trip: [{ id: "lijiang", days: 2 }] }), byId, 99);
    expect(base.some(x => x.d.alt)).toBe(true); // 泸沽湖/香格里拉一类
    const noAlt = onwaySuggestions(data, mkState({ trip: [{ id: "lijiang", days: 2 }], noAlt: true }), byId, 99);
    expect(noAlt.some(x => x.d.alt)).toBe(false);
  });
  it("尊重「隐藏去过的」开关（四轮）：打卡都江堰后不再被推", () => {
    const trip: TripItem[] = [{ id: "chengdu", days: 3 }];
    const base = onwaySuggestions(data, mkState({ trip }), byId, 99);
    expect(base.some(x => x.d.id === "dujiangyan-qingcheng")).toBe(true);
    const hidden = onwaySuggestions(data, mkState({ trip, visited: ["dujiangyan-qingcheng"], hideVisited: true }), byId, 99);
    expect(hidden.some(x => x.d.id === "dujiangyan-qingcheng")).toBe(false);
  });
});

describe("leg 整组判定（F21）", () => {
  const duku = byId("route-duku-highway")!;
  it("整条按默认装入 → 全部站启用", () => {
    const stops = stopsOf(tripOfRoute(duku));
    expect(legEligibleIndices(stops, byId)).toEqual(new Set([0, 1, 2]));
  });
  it("整组后附加散站不破坏整组（连续+齐全仍成立）", () => {
    const stops = stopsOf([...tripOfRoute(duku), { id: "hangzhou", days: 2 }]);
    expect(legEligibleIndices(stops, byId)).toEqual(new Set([0, 1, 2]));
  });
  it("改序 / 删站 / 改天数 → 整组失效", () => {
    const t = tripOfRoute(duku);
    expect(legEligibleIndices(stopsOf([t[1], t[0], t[2]]), byId).size).toBe(0);
    expect(legEligibleIndices(stopsOf([t[0], t[2]]), byId).size).toBe(0);
    const days = [t[0], { ...t[1], days: t[1].days + 1 }, t[2]];
    expect(legEligibleIndices(stopsOf(days), byId).size).toBe(0);
  });
});

describe("overland 段级禁飞（F29）与显式交通接线（F30）", () => {
  it("独库整组：站间全陆路（包车/自驾），上海往返仍飞机", () => {
    const legs = tripLegs(stopsOf(tripOfRoute(byId("route-duku-highway")!)), byId);
    expect(legs[0].mode).toBe("飞机");
    expect(legs[legs.length - 1].mode).toBe("飞机");
    legs.slice(1, -1).forEach(l => expect(l.mode).toBe("包车/自驾"));
  });
  it("阿里南线破坏整组（删日喀则）→ 拉萨→普兰回退飞机", () => {
    const ali = byId("route-ali-south")!;
    const t = tripOfRoute(ali).filter(x => x.id !== "shigatse");
    const legs = tripLegs(stopsOf(t), byId);
    expect(legs[1].mode).toBe("飞机"); // lhasa→pulan，无 leg 庇护的西藏远段
  });
  it("三峡游轮段走显式交通：重庆→宜昌 🚢，非自驾", () => {
    const legs = tripLegs(stopsOf(tripOfRoute(byId("route-three-gorges-cruise")!)), byId);
    expect(legs[1].mode).toBe("游轮");
    expect(legs[1].icon).toBe("🚢");
    expect(legs[1].hours).toBeGreaterThan(10);
  });
});

describe("进出门户（F31）", () => {
  const hw = byId("route-hainan-west")!;
  it("海南西线整组：三亚进、海口出，首末大交通端点改写", () => {
    const stops = stopsOf(tripOfRoute(hw));
    const gw = tripGateway(stops, byId);
    expect(gw?.entry?.id).toBe("sanya");
    expect(gw?.exit?.id).toBe("haikou");
    const legs = tripLegs(stops, byId);
    expect(legs[0].gwName).toBe("三亚");
    expect(legs[0].to.name).toBe("三亚");
    expect(legs[legs.length - 1].gwName).toBe("海口");
    expect(legs[legs.length - 1].from.name).toBe("海口");
  });
  it("破坏整组（删尾站）→ 门户失效，回退首末停留站", () => {
    const stops = stopsOf(tripOfRoute(hw).slice(0, -1));
    expect(tripGateway(stops, byId)).toBeNull();
    const legs = tripLegs(stops, byId);
    expect(legs[0].gwName).toBeNull();
  });
  it("无门户线路（独库）不受影响", () => {
    expect(tripGateway(stopsOf(tripOfRoute(byId("route-duku-highway")!)), byId)).toBeNull();
  });
});
