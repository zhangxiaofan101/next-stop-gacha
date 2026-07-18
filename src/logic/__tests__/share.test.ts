// 不变式：并集合并绝不覆盖（M26/M41 同源语义）、visited 只认城市 id、favs 城市+线路都行、
// 三通道（链接/QR/JSON）payload 同源、损坏输入拒绝（F16）。
import { describe, expect, it } from "vitest";
import { mergeUnion, parseImportJSON, parseShare, serializeShare } from "../share";
import { loadRealData } from "./helpers";

const data = loadRealData();

describe("payload 序列化/解析", () => {
  it("round-trip 且非法 id 被滤掉", () => {
    const p = parseShare(serializeShare({ favs: ["hangzhou", "route-duku-highway", "bogus"], visited: ["chengdu", "bogus"] }), data)!;
    expect(p.favs).toEqual(["hangzhou", "route-duku-highway"]);
    expect(p.visited).toEqual(["chengdu"]);
  });
  it("visited 拒线路 id（打卡只认城市），favs 收线路 id", () => {
    const p = parseShare("f:route-duku-highway;v:route-duku-highway.hangzhou", data)!;
    expect(p.favs).toEqual(["route-duku-highway"]);
    expect(p.visited).toEqual(["hangzhou"]);
  });
  it("重复 id 去重；格式不符返回 null", () => {
    const p = parseShare("f:hangzhou.hangzhou;v:", data)!;
    expect(p.favs).toEqual(["hangzhou"]);
    expect(parseShare("随便什么", data)).toBeNull();
    expect(parseShare("", data)).toBeNull();
  });
});

describe("并集合并（mergeUnion）", () => {
  it("并集 + 新增计数，绝不丢本机已有", () => {
    const r = mergeUnion(
      { favs: ["a", "b"], visited: ["x"] },
      { favs: ["b", "c"], visited: ["x", "y"] },
    );
    expect(r.favs).toEqual(["a", "b", "c"]);
    expect(r.visited).toEqual(["x", "y"]);
    expect(r.addedFavs).toBe(1);
    expect(r.addedVisited).toBe(1);
  });
  it("全量重复 → 计数 0，内容不变", () => {
    const r = mergeUnion({ favs: ["a"], visited: ["x"] }, { favs: ["a"], visited: ["x"] });
    expect(r.addedFavs + r.addedVisited).toBe(0);
    expect(r.favs).toEqual(["a"]);
  });
});

describe("JSON 导入（F16）", () => {
  it("非法 JSON → parse 错误", () => {
    expect(parseImportJSON("not json", data)).toEqual({ error: "parse" });
  });
  it("合法 JSON 但非对象（null/数组/数字）→ shape 错误，不抛异常", () => {
    expect(parseImportJSON("null", data)).toEqual({ error: "shape" });
    expect(parseImportJSON("[1,2]", data)).toEqual({ error: "shape" });
    expect(parseImportJSON("5", data)).toEqual({ error: "shape" });
  });
  it("favs/visited 非数组按空处理；合法对象走 parseShare 同源过滤", () => {
    const r = parseImportJSON('{"favs":"oops","visited":["hangzhou","bogus","route-duku-highway"]}', data);
    expect(r && !("error" in r) ? r : null).toEqual({ favs: [], visited: ["hangzhou"] });
  });
});
