// 预算、足迹点亮口径、扭蛋抽样、QR 冒烟。
import { describe, expect, it } from "vitest";
import { tripBudget } from "../budget";
import { gachaPick } from "../gacha";
import { litProvinces, projectPoint } from "../map";
import { qrEncode } from "../qr";
import type { TripLeg, TripStopX } from "../types";
import { byIdOf, loadRealData, mkCity } from "./helpers";

const data = loadRealData();
const byId = byIdOf(data);

describe("预算估算", () => {
  it("住宿×天数 + 交通（飞机 550+0.35/km，其余 0.5/km），百元取整", () => {
    const stops = [
      { ...mkCity({ id: "a", cost: "¥" }), chosenDays: 2, fromRoute: false },
      { ...mkCity({ id: "b", cost: "¥" }), chosenDays: 3, fromRoute: false },
    ] as TripStopX[];
    const legs = [
      { mode: "高铁", km: 100 }, { mode: "飞机", km: 1000 }, { mode: "高铁", km: 200 },
    ] as TripLeg[];
    const b = tripBudget(stops, legs);
    expect(b.daySum).toBe(5);
    expect(b.km).toBe(1300);
    // stay=5*380=1900, trans=50+(550+350)+100=1050
    expect(b.lo).toBe(Math.round((1900 * 0.8 + 1050) / 100) * 100);
    expect(b.hi).toBe(Math.round((1900 * 1.25 + 1050 * 1.15) / 100) * 100);
  });
});

describe("足迹点亮口径（F11）", () => {
  it("province 字符串 includes 省短名——跨省交界点亮两省", () => {
    const luguhu = byId("luguhu")!; // 云南·四川交界
    const lit = litProvinces([luguhu], [{ n: "云南" }, { n: "四川" }, { n: "浙江" }]);
    expect(lit).toEqual(["云南", "四川"]);
  });
  it("撒点投影公式（coords=[lat,lng]）", () => {
    const p = projectPoint([30, 120], { lng0: 70, lat1: 55, kx: 10, ky: 12 });
    expect(p).toEqual({ x: "500.0", y: "300.0" });
  });
});

describe("扭蛋抽样", () => {
  it("均匀抽样按 rng 注入定位；空池返回 null", () => {
    const pool = ["a", "b", "c"];
    expect(gachaPick(pool, () => 0)).toBe("a");
    expect(gachaPick(pool, () => 0.34)).toBe("b");
    expect(gachaPick(pool, () => 0.999)).toBe("c");
    expect(gachaPick([], () => 0.5)).toBeNull();
  });
});

describe("QR 编码器冒烟（深度验证见 M26：与 python-qrcode 逐位交叉验证）", () => {
  it("小输入落 V1-M（21×21），矩阵完整", () => {
    const q = qrEncode("hello");
    expect(q.version).toBe(1);
    expect(q.size).toBe(21);
    expect(q.modules).toHaveLength(21);
    expect(q.modules.every((row: number[]) => row.length === 21)).toBe(true);
  });
  it("同输入确定性输出；长输入版本爬升；超容量抛错", () => {
    expect(qrEncode("hello")).toEqual(qrEncode("hello"));
    expect(qrEncode("x".repeat(500)).version).toBeGreaterThan(10);
    expect(() => qrEncode("x".repeat(3000))).toThrow();
  });
});
