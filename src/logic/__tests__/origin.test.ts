// M22 出发地机制不变式：注册表解析（脏值/未发布回基座）、视角换值往返、本城卡对偶隐藏、
// distMode 随出发地换锚、行程起点/彩蛋起点参数化。出发地是模块级环境态——每例后必须复位基座，
// 违者会横向污染整套单测（afterEach 强制）。
import { afterEach, describe, expect, it } from "vitest";
import { SH } from "../constants";
import { matchOne } from "../filter";
import { nearestNeighborOrder, onwaySuggestions, tripLegs, tripStops } from "../itinerary";
import { BASE_ORIGIN, getOrigin, ORIGINS, originById, resolveOrigin, setOrigin } from "../origin";
import { applyView, captureBaseView } from "../originView";
import { roadbookModel, roadbookText } from "../roadbook";
import { byIdOf, mkCity, mkState } from "./helpers";

const BEIJING = originById("beijing")!;
afterEach(() => setOrigin(BASE_ORIGIN));

describe("注册表与解析", () => {
  it("基座=上海；北京在注册表且带对偶城市卡 id", () => {
    expect(BASE_ORIGIN.id).toBe("shanghai");
    expect(BASE_ORIGIN.cardId).toBe("shanghai");
    expect(BEIJING.cardId).toBe("beijing");
    expect(ORIGINS.length).toBeGreaterThanOrEqual(2);
  });
  it("防漂移 pin：注册表基座条目与 SH 常量逐字段相等（两处真相物理分离，锁住不分叉）", () => {
    // SH 是行程引擎的 Place，注册表基座是出发地表——两份物理真相，pin 保证同城不分叉
    expect(BASE_ORIGIN.name).toBe(SH.name);
    expect(BASE_ORIGIN.region).toBe(SH.region);
    expect(BASE_ORIGIN.coords).toEqual(SH.coords);
  });
  it("resolveOrigin：脏值/未注册/未发布一律回基座，已发布才生效", () => {
    expect(resolveOrigin(null, {}).id).toBe("shanghai");
    expect(resolveOrigin("gibberish", { beijing: "f.json" }).id).toBe("shanghai");
    expect(resolveOrigin("beijing", {}).id).toBe("shanghai"); // 注册了但视角未发布
    expect(resolveOrigin("beijing", { beijing: "origin-beijing-abc.json" }).id).toBe("beijing");
    expect(resolveOrigin("shanghai", {}).id).toBe("shanghai"); // 基座永远可选
  });
});

describe("视角换值（applyView/captureBaseView）", () => {
  it("套视角→换值；view=null→恢复基座快照；视角缺 id 时保守回退基座值", () => {
    const data = [
      mkCity({ id: "a", transit: "高铁约1h", difficulty: "直达" }),
      mkCity({ id: "b", transit: "直飞约2h", difficulty: "一次中转" }),
    ];
    const base = captureBaseView(data);
    applyView(data, { a: { transit: "高铁约4.5h", difficulty: "一次中转" } }, base); // 缺 b
    expect(data[0].transit).toBe("高铁约4.5h");
    expect(data[0].difficulty).toBe("一次中转");
    expect(data[1].transit).toBe("直飞约2h"); // 缺失回退基座值，不清空
    applyView(data, null, base);
    expect(data[0].transit).toBe("高铁约1h");
    expect(data[0].difficulty).toBe("直达");
  });
});

describe("本城卡对偶隐藏（matchOne）", () => {
  const bj = mkCity({ id: "beijing", coords: [39.9, 116.4], region: "华北" });
  const sh = mkCity({ id: "shanghai", coords: [31.23, 121.47], region: "江浙沪" });
  it("基座（上海出发）：隐上海卡、显北京卡", () => {
    const s = mkState();
    expect(matchOne(sh, s)).toBe(false);
    expect(matchOne(bj, s)).toBe(true);
  });
  it("北京出发：隐北京卡、显上海卡；且不可被放宽假设覆盖", () => {
    setOrigin(BEIJING);
    const s = mkState();
    expect(matchOne(bj, s)).toBe(false);
    expect(matchOne(sh, s)).toBe(true);
    expect(matchOne(bj, s, "q", null)).toBe(false); // okey 假设计算也藏
  });
});

describe("distMode 随出发地换锚", () => {
  // 蓟州盘山一带：距北京约 90km，距上海约 950km——两个出发地下短/长途归属相反
  const jizhou = mkCity({ id: "jizhou", coords: [40.04, 117.4], region: "华北" });
  it("上海出发：不是短途；北京出发：是短途", () => {
    const s = mkState({ distMode: "short" });
    expect(matchOne(jizhou, s)).toBe(false);
    setOrigin(BEIJING);
    expect(matchOne(jizhou, s)).toBe(true);
  });
});

describe("行程起点参数化", () => {
  const cities = [
    mkCity({ id: "jinan", coords: [36.65, 117.0], region: "华东" }),   // 近北京
    mkCity({ id: "hangzhou", coords: [30.25, 120.17], region: "江浙沪" }), // 近上海
  ];
  const byId = byIdOf(cities);
  const trip = [{ id: "jinan", days: 2 }, { id: "hangzhou", days: 2 }];
  it("tripLegs 首末端点=当前出发地", () => {
    setOrigin(BEIJING);
    const legs = tripLegs(tripStops(trip, byId), byId);
    expect(legs[0].from.name).toBe("北京");
    expect(legs[legs.length - 1].to.name).toBe("北京");
  });
  it("最近邻贪心起点随出发地翻转", () => {
    expect(nearestNeighborOrder(trip, byId)[0].id).toBe("hangzhou"); // 上海起点先杭州
    setOrigin(BEIJING);
    expect(nearestNeighborOrder(trip, byId)[0].id).toBe("jinan");    // 北京起点先济南
  });
  it("顺路彩蛋候选排除出发地自己的城市卡（距起点 0km 不得霸榜）", () => {
    setOrigin(BEIJING);
    const bjCard = mkCity({ id: "beijing", coords: [39.9, 116.4], region: "华北" });
    const chengde = mkCity({ id: "chengde", coords: [40.97, 117.93], region: "华北" });
    const all = [bjCard, chengde, ...cities];
    const s = mkState({ trip: [{ id: "jinan", days: 2 }] });
    const eggs = onwaySuggestions(all, s, byIdOf(all));
    expect(eggs.map(e => e.d.id)).not.toContain("beijing");
  });
  it("路书标题/文本用出发地名（北京往返）", () => {
    setOrigin(BEIJING);
    const m = roadbookModel([{ id: "jinan", days: 2 }], byId);
    const text = roadbookText(m, "", () => null);
    expect(text).toContain("北京往返");
    expect(text).toContain("北京 → jinan");
    expect(text).not.toContain("上海");
  });
});
