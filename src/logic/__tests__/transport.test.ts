// 不变式：显式交通优先于启发式（F30）、overland 禁飞（F29 的段级语义）、江浙沪自驾（M30）、跨海方向判定（F10）。
import { describe, expect, it } from "vitest";
import { hav } from "../geo";
import { legInfo, parseTransitIcon, seaDetour } from "../transport";
import { byIdOf, loadRealData, mkCity } from "./helpers";
import { SH } from "../constants";

const data = loadRealData();
const byId = byIdOf(data);

describe("legInfo 距离分档", () => {
  it("<60km 打车/自驾", () => {
    const a = mkCity({ id: "a", coords: [30, 120] }), b = mkCity({ id: "b", coords: [30.3, 120.2] });
    expect(legInfo(a, b).mode).toBe("打车/自驾");
  });
  it("overland=true 时 60km 以上一律包车/自驾，不判高铁/飞机", () => {
    const a = mkCity({ id: "a", coords: [43.9, 88.1], province: "新疆" });
    const b = mkCity({ id: "b", coords: [43.0, 84.1], province: "新疆" });
    expect(legInfo(a, b).mode).toBe("包车/大巴"); // 对照：无 overland 时新疆省内短段走包车/大巴档
    expect(legInfo(a, b, true).mode).toBe("包车/自驾");
    const km = hav(a.coords, b.coords);
    expect(legInfo(a, b, true).hours).toBe(Math.round((km / 55) * 10) / 10);
  });
  it("显式交通（游轮）优先于一切启发式", () => {
    const cq = byId("chongqing")!, yc = byId("yichang")!;
    const l = legInfo(cq, yc, true, "游轮");
    expect(l.mode).toBe("游轮");
    expect(l.icon).toBe("🚢");
    expect(l.hours).toBeGreaterThan(10); // 重庆→宜昌 🚢≈26km/h，M35 复验口径 18.2h
    expect(l.hours).toBe(Math.round((hav(cq.coords, yc.coords) / 26) * 10) / 10);
  });
  it("M30 江浙沪自驾：沪杭段标「高铁/自驾」，非江浙沪同距段仍是「高铁」", () => {
    const hz = byId("hangzhou")!;
    expect(legInfo(SH, hz).mode).toBe("高铁/自驾");
    const hs = byId("huangshan")!; // 华东（皖），不在江浙沪自驾圈
    expect(legInfo(hz, hs).mode).toBe("高铁");
  });
  it("远程落飞机（含门到门时长模型）", () => {
    const cd = byId("chengdu")!;
    const l = legInfo(SH, cd);
    expect(l.mode).toBe("飞机");
    expect(l.hours).toBe(Math.round((hav(SH.coords, cd.coords) / 625 + 2.4) * 10) / 10);
  });
});

describe("跨海修正只对真跨海方向生效（F10）", () => {
  const qd = byId("qingdao")!;
  it("青岛南向沿海（杭州）跨黄海 → 飞", () => {
    const hz = byId("hangzhou")!;
    expect(seaDetour(qd, hz)).toBe(true);
    expect(legInfo(qd, hz).mode).toBe("飞机");
  });
  it("青岛西向内陆（郑州）走陆路 → 高铁", () => {
    const zz = mkCity({ id: "zhengzhou", coords: [34.75, 113.62], province: "河南", region: "华中" });
    expect(seaDetour(qd, zz)).toBe(false);
    expect(legInfo(qd, zz).mode).toBe("高铁");
  });
  it("大连：东北三省陆路直达，其余方向跨海", () => {
    const dl = mkCity({ id: "dalian", coords: [38.91, 121.61], province: "辽宁", region: "东北" });
    expect(seaDetour(dl, mkCity({ id: "sy", coords: [41.8, 123.4], province: "辽宁" }))).toBe(false);
    expect(seaDetour(dl, mkCity({ id: "bj", coords: [39.9, 116.4], province: "北京" }))).toBe(true);
  });
  it("烟台北向京承线跨渤海湾", () => {
    const yt = byId("yantai") || mkCity({ id: "yantai", coords: [37.46, 121.44], province: "山东" });
    expect(seaDetour(yt, mkCity({ id: "bj", coords: [39.9, 116.4], province: "北京" }))).toBe(true);
  });
});

// M59 ④：卡片交通图标解析——取文案中最先出现的方式词，而非硬编码单一图标（高铁城显✈/飞机城
// 显🚄的双向误导，用户实证截图）。
describe("parseTransitIcon（M59 ④：卡片交通图标按 transit 文案解析）", () => {
  it("单一方式词直接命中", () => {
    expect(parseTransitIcon("上海高铁2h直达")).toBe("🚄");
    expect(parseTransitIcon("上海直飞约3h")).toBe("✈️");
    expect(parseTransitIcon("上海自驾约4h")).toBe("🚐");
  });
  it("取最先出现的方式词，而非任意一个——高铁在前的文案不因后半段提到自驾就显示汽车图标", () => {
    expect(parseTransitIcon("上海高铁45min-1h直达；自驾约2.5h")).toBe("🚄");
  });
  it("自驾在前的文案（如需转车换乘）取自驾图标，不被后面的高铁字样覆盖", () => {
    expect(parseTransitIcon("上海自驾2.5h，或高铁到德清站转车30min上山")).toBe("🚐");
  });
  it("单字「飞」前缀命中「飞机/直飞」等更具体写法时，具体写法胜出（同起始下标平局）", () => {
    expect(parseTransitIcon("上海飞机约3h")).toBe("✈️");
    // 「飞乌兰浩特」这类不含「飞机」二字的写法，退到单字「飞」兜底
    expect(parseTransitIcon("飞乌兰浩特转车1.5h")).toBe("✈️");
  });
  it("轮渡/游轮区分（同为水路但图标不同，对齐 TRANSPORT_META 既有先例）", () => {
    expect(parseTransitIcon("上海坐轮渡上岛")).toBe("⛴");
    expect(parseTransitIcon("三峡游轮约2天")).toBe("🚢");
  });
  it("完全没有已知方式词的模糊转乘描述——落中性兜底图标，不猜一个可能错的具体方式", () => {
    expect(parseTransitIcon("经兰州/西安中转，多与敦煌张掖串联")).toBe("🧭");
  });
  it("真实数据回归：267 城 + 53 线全部 transit 文案都能解析出一个图标（不抛错、不返回空字符串）", () => {
    const data = loadRealData();
    for (const d of data) {
      const icon = parseTransitIcon(d.transit);
      expect(icon, `${d.id}: ${d.transit}`).toBeTruthy();
    }
  });
});
