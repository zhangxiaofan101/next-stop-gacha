// 不变式：容忍型天花板（点一档=含所有低档）、偏好型 OR/空数组通配、玩法 AND、空池定向放宽。
import { afterEach, describe, expect, it } from "vitest";
import { countWith, filtered, matchOne, relaxCandidates, simulateChipClick } from "../filter";
import { havRaw } from "../geo";
import { BASE_ORIGIN, originById, setOrigin } from "../origin";
import { loadRealData, mkCity, mkState } from "./helpers";

describe("容忍型天花板（cost/difficulty）", () => {
  it("点第 t 档选中 0..t 全部", () => {
    const s = mkState();
    expect([...simulateChipClick(s, "cost", "¥¥")].sort()).toEqual(["¥", "¥¥"].sort());
    expect([...simulateChipClick(s, "difficulty", "一次中转")].sort()).toEqual(["直达", "一次中转"].sort());
    expect([...simulateChipClick(s, "cost", "¥¥¥")]).toHaveLength(3);
  });
  it("再点当前天花板则清空；点更高档改填充到该档", () => {
    const s = mkState({ cost: new Set(["¥", "¥¥"]) });
    expect(simulateChipClick(s, "cost", "¥¥").size).toBe(0);
    expect([...simulateChipClick(s, "cost", "¥¥¥")]).toHaveLength(3);
    expect([...simulateChipClick(s, "cost", "¥")]).toEqual(["¥"]);
  });
  it("偏好型仍是 toggle", () => {
    const s = mkState({ region: new Set(["华东"]) });
    expect([...simulateChipClick(s, "region", "西南")].sort()).toEqual(["华东", "西南"].sort());
    expect(simulateChipClick(s, "region", "华东").size).toBe(0);
  });
  it("matchOne 按天花板集合命中：选 ¥¥ 含 ¥、不含 ¥¥¥", () => {
    const s = mkState({ cost: new Set(["¥", "¥¥"]) });
    expect(matchOne(mkCity({ id: "a", cost: "¥" }), s)).toBe(true);
    expect(matchOne(mkCity({ id: "b", cost: "¥¥" }), s)).toBe(true);
    expect(matchOne(mkCity({ id: "c", cost: "¥¥¥" }), s)).toBe(false);
  });
});

describe("偏好型语义", () => {
  it("effort/companions 空数组=通配，任何选择都命中", () => {
    const s = mkState({ effort: new Set(["硬核"]), companions: new Set(["带娃"]) });
    expect(matchOne(mkCity({ id: "wild", effort: [], companions: [] }), s)).toBe(true);
    expect(matchOne(mkCity({ id: "soft", effort: ["躺平"], companions: ["独行"] }), s)).toBe(false);
  });
  it("玩法 tags 是 AND 收窄", () => {
    const s = mkState({ tags: new Set(["美食", "滑雪"]) });
    expect(matchOne(mkCity({ id: "both", tags: ["美食", "滑雪"] }), s)).toBe(true);
    expect(matchOne(mkCity({ id: "one", tags: ["美食"] }), s)).toBe(false);
  });
});

describe("M68：aka 地理别名只进搜索 hay", () => {
  it("搜索命中 aka 但字面卡面字段里没有这个词", () => {
    const s = mkState({ q: "川西" });
    const hit = mkCity({ id: "daocheng-yading", name: "稻城亚丁", aka: ["川西"] });
    const miss = mkCity({ id: "hangzhou", name: "杭州" });
    expect(matchOne(hit, s)).toBe(true);
    expect(matchOne(miss, s)).toBe(false);
  });
  it("缺 aka 字段的记录不受影响（可选字段）", () => {
    const s = mkState({ q: "杭州" });
    expect(matchOne(mkCity({ id: "hangzhou", name: "杭州" }), s)).toBe(true);
  });
});

describe("省级地名搜索", () => {
  it("省名精确查询走 province 字段，不被普通文本子串误命中", () => {
    const s = mkState({ q: "山东" });
    const hit = mkCity({ id: "qingdao", province: "山东" });
    const falseSubstringHit = mkCity({ id: "yinchuan", province: "宁夏", highlights: ["\u8d3a\u5170\u5c71\u4e1c\u9e93酒庄"] });
    expect(matchOne(hit, s)).toBe(true);
    expect(matchOne(falseSubstringHit, s)).toBe(false);
  });

  it("跨省记录按 province 的「·」分段命中，仍不搜索其他字段", () => {
    const s = mkState({ q: "四川" });
    expect(matchOne(mkCity({ id: "border", province: "云南·四川交界" }), s)).toBe(true);
  });

  it("非省名仍保留普通全文子串搜索", () => {
    const s = mkState({ q: "酒庄" });
    expect(matchOne(mkCity({ id: "yinchuan", highlights: ["\u8d3a\u5170\u5c71\u4e1c\u9e93酒庄"] }), s)).toBe(true);
  });
});

describe("M68：distMode 按距出发地（SH）直线距离派生", () => {
  // SH 坐标 [31.23, 121.47]（constants.ts），havRaw 实算：near ≈165km（短途阈值内）、
  // far ≈2905km（拉萨附近，远超长途阈值）
  const near = mkCity({ id: "near", coords: [30.25, 120.17] });
  const far = mkCity({ id: "far", coords: [29.65, 91.13] });
  it("短途只留距出发地 ≤500km 的记录", () => {
    const s = mkState({ distMode: "short" });
    expect(matchOne(near, s)).toBe(true);
    expect(matchOne(far, s)).toBe(false);
  });
  it("长途只留距出发地 >1000km 的记录", () => {
    const s = mkState({ distMode: "long" });
    expect(matchOne(near, s)).toBe(false);
    expect(matchOne(far, s)).toBe(true);
  });
  it("distMode=null（默认）不参与过滤", () => {
    const s = mkState();
    expect(matchOne(near, s)).toBe(true);
    expect(matchOne(far, s)).toBe(true);
  });
  it("relaxCandidates 在 distMode 命中空池时给「不限短途/长途」候选", () => {
    const data = [near];
    const s = mkState({ distMode: "long" });
    expect(filtered(data, s, "春")).toHaveLength(0);
    const cands = relaxCandidates(data, s);
    expect(cands.find(c => c.action.type === "clearDistMode")).toMatchObject({ label: "不限长途", n: 1 });
  });
});

describe("空池定向放宽（relaxCandidates）", () => {
  const data = [
    mkCity({ id: "a1", crowd: "小众", tags: ["美食"] }),
    mkCity({ id: "a2", crowd: "小众", tags: ["美食"] }),
    mkCity({ id: "b", crowd: "小众", tags: ["滑雪"] }),
    mkCity({ id: "c", crowd: "热门", tags: ["美食", "滑雪"] }),
  ];
  it("按救回数降序，救回 0 的候选被过滤", () => {
    const s = mkState({ tags: new Set(["美食", "滑雪"]), crowd: new Set(["小众"]) });
    expect(filtered(data, s, "春")).toHaveLength(0); // 前提：确实空池
    const cands = relaxCandidates(data, s);
    expect(cands[0]).toMatchObject({ label: "去掉「滑雪」", n: 2, action: { type: "dropTag", tag: "滑雪" } });
    expect(cands.map(c => c.n)).toEqual([...cands.map(c => c.n)].sort((x, y) => y - x));
    expect(cands.every(c => c.n > 0)).toBe(true);
  });
  it("搜索词/开关也进入候选", () => {
    const s = mkState({ q: "不存在的词", noAlt: true });
    const cands = relaxCandidates(data, s);
    expect(cands.find(c => c.action.type === "clearQ")).toBeTruthy();
    expect(cands.find(c => c.action.type === "clearQ")!.n).toBe(4);
  });
  it("countWith 的单条件覆盖：假设清掉该组后的命中数", () => {
    const s = mkState({ crowd: new Set(["小众"]), tags: new Set(["美食"]) });
    expect(countWith(data, s, "crowd", new Set())).toBe(3); // 不限冷热 → a1/a2/c
    expect(countWith(data, s, "tags", new Set())).toBe(3); // 不限玩法 → 小众 a1/a2/b
  });
});

describe("M73：距离排序 + 视角默认序", () => {
  afterEach(() => setOrigin(BASE_ORIGIN));
  const BEIJING = originById("beijing")!;
  // 三条固定坐标记录，其中一条是线路卡（stops 存在）——验证排序不特判线路卡，同用 coords 代表点
  const recs = [
    mkCity({ id: "a", coords: [30.25, 120.17] }), // 近上海
    mkCity({ id: "b", coords: [22.3, 114.2] }), // 深圳附近，远上海也远北京
    mkCity({ id: "route-c", coords: [34.27, 108.95], stops: [{ id: "a", days: 2 }] }), // 线路卡，西安附近
  ];
  const byDist = (origin: [number, number]) =>
    [...recs].sort((x, y) => havRaw(origin, x.coords) - havRaw(origin, y.coords)).map(d => d.id);

  it("显式「距离近 → 远」按当前出发地（上海）坐标球面距离升序，线路卡同口径不特判", () => {
    const order = filtered(recs, mkState({ sort: "dist" }), "春").map(d => d.id);
    expect(order).toEqual(byDist(BASE_ORIGIN.coords));
  });

  it("切出发地到北京后即用新坐标重排，不残留上海视角距离", () => {
    setOrigin(BEIJING);
    const order = filtered(recs, mkState({ sort: "dist" }), "春").map(d => d.id);
    expect(order).toEqual(byDist(BEIJING.coords));
    expect(order).not.toEqual(byDist(BASE_ORIGIN.coords)); // 确有区分度，非巧合同序
  });

  it("基座出发地（上海）下 default 仍为数据文件序，不退化为距离序", () => {
    expect(filtered(recs, mkState(), "春").map(d => d.id)).toEqual(["a", "b", "route-c"]);
  });

  it("非基座出发地（北京）下 default 退化为距离序", () => {
    setOrigin(BEIJING);
    const order = filtered(recs, mkState(), "春").map(d => d.id); // state.sort 仍是 "default"
    expect(order).toEqual(byDist(BEIJING.coords));
  });
});

describe("真实数据回归", () => {
  const data = loadRealData();
  it("全量 348 条（295 城 + 53 线，M22 批：+12 京畿 +1 上海）", () => {
    expect(data).toHaveLength(348);
    expect(data.filter(d => !d.stops)).toHaveLength(295);
  });
  it("「江浙沪」chip 命中 49（M37 浏览器复验口径；线路按 regions 多选 OR。M22 后江浙沪 50 条，但基座出发地=上海时上海卡对偶隐藏，可见仍 49）", () => {
    const s = mkState({ region: new Set(["江浙沪"]) });
    expect(filtered(data, s, "夏")).toHaveLength(49);
  });
  it("默认无排序时保持 manifest 拼接顺序（首卡杭州）", () => {
    expect(filtered(data, mkState(), "夏")[0].id).toBe("hangzhou");
  });
  it("F76：搜「苏南」命中南京——江苏省统计局口径「苏南五市」明确列入南京，M68 批漏标", () => {
    const s = mkState({ q: "苏南" });
    expect(filtered(data, s, "夏").some(d => d.id === "nanjing")).toBe(true);
  });
  it("搜「山东」只命中 province=山东 的城市与线路卡，不误收银川", () => {
    const hits = filtered(data, mkState({ q: "山东" }), "夏");
    expect(hits.some(d => d.id === "yinchuan")).toBe(false);
    expect(hits.some(d => !d.stops && d.province === "山东")).toBe(true);
    expect(hits.some(d => !!d.stops && d.province === "山东")).toBe(true);
    expect(hits.every(d => d.province === "山东")).toBe(true);
  });
});
