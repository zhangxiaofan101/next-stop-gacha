// 不变式：方案就近降配、leg 整组文案接管（F18/F21）、逐日骨架（M29）、
// F35 移动住宿句式、门户进出文案（F31）、日期标注与文本导出。
import { describe, expect, it } from "vitest";
import type { RoadbookItem } from "../roadbook";
import {
  extractMonths, filterSeasonNote, looksTimeSpecific, pickPlan, remapDayCodes, roadbookModel,
  roadbookText, routeDaysText, sentencesOf, shortName, skelDayLabel, skeletonRows, stayMonths,
  tripDate, fmtYMD,
} from "../roadbook";
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

describe("M55①：全局日序重映射（remapDayCodes）", () => {
  it("首站 start=1（offset=0）→ 原样不变", () => {
    expect(remapDayCodes("D1 市区；D2 郊区", 1)).toBe("D1 市区；D2 郊区");
  });
  it("非首站按 start 偏移单日与区间两种写法", () => {
    expect(remapDayCodes("D1 市区，D2 郊区", 3)).toBe("D3 市区，D4 郊区");
    expect(remapDayCodes("D1-3 市区与兵马俑，D4-5 高铁", 6)).toBe("D6-8 市区与兵马俑，D9-10 高铁");
  });
  it("就近降配：三日版文本（本地 D1-3）装进四天档位站点（start=5）——偏移量只看 start，与 plan 天数是否等于 chosenDays 无关", () => {
    expect(remapDayCodes("D1-3 环线", 5)).toBe("D5-7 环线");
  });
  it("无 D 编码的文本原样返回", () => {
    expect(remapDayCodes("沿线自驾，风光绝佳", 4)).toBe("沿线自驾，风光绝佳");
  });
});

describe("M55②：extractMonths 时间词解析", () => {
  it("单月 / 区间 / 跨年环绕区间 / 至次年", () => {
    expect(extractMonths("3月来最好")).toEqual(new Set([3]));
    expect(extractMonths("7-8月草原花海")).toEqual(new Set([7, 8]));
    expect(extractMonths("12-2月看雪")).toEqual(new Set([12, 1, 2])); // 跨年环绕（真实数据 shennongjia/altay 同款写法）
    expect(extractMonths("10月至次年4月宜人")).toEqual(new Set([10, 11, 12, 1, 2, 3, 4])); // 真实数据 xiamen 同款写法
    expect(extractMonths("5至10月")).toEqual(new Set([5, 6, 7, 8, 9, 10])); // "至"作区间分隔符（真实数据 chenzhou）
  });
  it("季节词与节庆词映射到月份集合", () => {
    expect(extractMonths("春秋气候最宜")).toEqual(new Set([3, 4, 5, 9, 10, 11]));
    expect(extractMonths("冬季尤其春节前后最热闹")).toEqual(new Set([12, 1, 2, 3, 4, 5])); // 冬+春节+春 三词并集
  });
  it("不含任何时间词 → null（无关时间的句子，永远保留，不是「无法判断」的兜底）", () => {
    expect(extractMonths("海拔约3000m，是进藏适应的好起点")).toBeNull();
    expect(extractMonths("避开黄金周人挤人")).toBeNull(); // “黄金周”不在 FESTIVAL_MONTHS 显式词表内，故仍判 null
  });
});

describe("M55②：filterSeasonNote 句级过滤", () => {
  it("真实数据（design 验收原句）：林芝 9 月行程滤掉「3月底桃花季」，保留海拔提醒", () => {
    const note = byId("linzhi")!.seasonNote; // "3月底桃花季一房难求要早订；海拔约3000m，是进藏适应的好起点"
    const filtered = filterSeasonNote(note, new Set([9]));
    expect(filtered).not.toContain("桃花季");
    expect(filtered).toContain("海拔约3000m");
  });
  it("命中月份的句子保留，原分隔符随句带出", () => {
    expect(filterSeasonNote("3月适合；9月也不错。", new Set([3]))).toBe("3月适合；");
  });
  it("全部句子被滤掉 → 空串（供调用方判断整行省略）", () => {
    expect(filterSeasonNote("3月适合；9月也不错。", new Set([6]))).toBe("");
  });
  it("空 note → 空串", () => {
    expect(filterSeasonNote("", new Set([3]))).toBe("");
  });
  it("单句无分隔符（167 城常见形态）：命中即整句返回，不中则空串", () => {
    expect(filterSeasonNote("6月和9月人少海净最舒服", new Set([6]))).toBe("6月和9月人少海净最舒服");
    expect(filterSeasonNote("6月和9月人少海净最舒服", new Set([1]))).toBe("");
  });
});

describe("M55②：stayMonths 跨月停留", () => {
  it("站内多天覆盖两个日历月份时，返回两个月份的并集", () => {
    // 2026-01-30 出发，第 1 天 1/30、第 2 天 1/31、第 3 天 2/1——跨 1→2 月
    expect(stayMonths(1, 3, "2026-01-30")).toEqual(new Set([1, 2]));
  });
  it("单日站点只落一个月份", () => {
    expect(stayMonths(2, 2, "2026-07-01")).toEqual(new Set([7]));
  });
});

describe("M55：路书渲染层集成——全局日序与当季过滤真正生效", () => {
  it("文本导出：设出发日期后 D 序按全局重映射、当季提示行按停留月过滤且只在有内容时出现", () => {
    const trip = [{ id: "hangzhou", days: 2 }, { id: "linzhi", days: 3 }];
    const m = roadbookModel(trip, byId);
    expect(m.items[1].start).toBe(3); // 杭州占 D1-2，林芝从 D3 起
    // 出发月=9 月：林芝段应重映射为 D3 起、且滤掉「3月底桃花季」这句
    const text9 = roadbookText(m, "2026-09-01", () => null);
    expect(text9).not.toContain("桃花季");
    expect(text9).toContain("当季提示：");
    expect(text9).toContain("海拔约3000m");
    // 出发月=3 月：桃花季那句应该保留（真按当季过滤在起作用，不是恒定滤掉）
    const text3 = roadbookText(m, "2026-03-01", () => null);
    expect(text3).toContain("桃花季");
  });
  it("未设出发日期：无「当季提示」行，季节展示与改造前等价（详情/对比页零变化的同一前提）", () => {
    const trip = [{ id: "linzhi", days: 3 }];
    const m = roadbookModel(trip, byId);
    const text = roadbookText(m, "", () => null);
    expect(text).not.toContain("当季提示：");
  });
});

describe("M55：content-checklist 四节离线审计——扫全量 seasonNote 找「像时间词但解析不出月份」的句子", () => {
  it("looksTimeSpecific 与 sentencesOf 单元行为", () => {
    expect(looksTimeSpecific("旺季人挤人")).toBe(true);
    expect(looksTimeSpecific("避开黄金周")).toBe(true);
    expect(looksTimeSpecific("3月来最好")).toBe(false); // 有明确月份不算"看起来像但解析不出"
    expect(sentencesOf("3月适合；9月也不错。")).toEqual(["3月适合", "9月也不错"]);
    expect(sentencesOf("单句无分隔符")).toEqual(["单句无分隔符"]);
  });
  it("全量扫描 267 城 seasonNote，产出待补写清单（非阻塞——数量与内容仅供 content-checklist 四节参考）", () => {
    const flagged: { id: string; sentence: string }[] = [];
    data.forEach(d => {
      if (!d.seasonNote) return;
      sentencesOf(d.seasonNote).forEach(sentence => {
        if (extractMonths(sentence) === null && looksTimeSpecific(sentence)) flagged.push({ id: d.id, sentence });
      });
    });
    // 不断言具体数量（内容随时间増补会变化）；只保证扫描本身跑得通，且找到的每一条都确实
    // 无法被 extractMonths 解析出月份——回归钉住"审计脚本自身逻辑没坏"，不是数据质量门禁。
    flagged.forEach(f => expect(extractMonths(f.sentence)).toBeNull());
    if (flagged.length) {
      console.log(`[M55 content-checklist 四节] ${flagged.length} 句待补写月份：`,
        flagged.slice(0, 20).map(f => `${f.id}:「${f.sentence}」`).join(" | "));
    }
  });
});
