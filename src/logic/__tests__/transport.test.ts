// 不变式：显式交通优先于启发式（F30）、overland 禁飞（F29 的段级语义）、江浙沪自驾（M30）、跨海方向判定（F10）。
import { describe, expect, it } from "vitest";
import { hav } from "../geo";
import { legInfo, seaDetour } from "../transport";
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
