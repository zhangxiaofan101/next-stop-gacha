// M68：概念词→筛选映射的词表契约。
import { describe, expect, it } from "vitest";
import { matchIntent } from "../searchIntent";

describe("matchIntent", () => {
  it("精确匹配整条搜索词（trim 后）", () => {
    expect(matchIntent("短途")).toEqual({ label: "短途", action: { type: "setDistMode", mode: "short" } });
    expect(matchIntent("  短途  ")).toEqual({ label: "短途", action: { type: "setDistMode", mode: "short" } });
    expect(matchIntent("长途")).toEqual({ label: "长途", action: { type: "setDistMode", mode: "long" } });
  });
  it("同义词归到同一展示 label（周边→短途）", () => {
    expect(matchIntent("周边")?.label).toBe("短途");
    expect(matchIntent("周边")?.action).toEqual({ type: "setDistMode", mode: "short" });
  });
  it("映射到既有筛选组语义的概念词", () => {
    expect(matchIntent("避暑")?.action).toEqual({ type: "setGroup", key: "season", value: "夏" });
    expect(matchIntent("海岛")?.action).toEqual({ type: "setGroup", key: "tags", value: "海岛海滨" });
    expect(matchIntent("古镇")?.action).toEqual({ type: "setGroup", key: "tags", value: "古镇古村" });
    expect(matchIntent("古建")?.action).toEqual({ type: "setGroup", key: "tags", value: "古建筑" });
    expect(matchIntent("古建筑")?.action).toEqual({ type: "setGroup", key: "tags", value: "古建筑" });
    expect(matchIntent("古建")?.label).toBe("古建");
    expect(matchIntent("古建筑")?.label).toBe("古建");
    expect(matchIntent("亲子")?.action).toEqual({ type: "setGroup", key: "companions", value: "带娃" });
    expect(matchIntent("冬天")?.action).toEqual({ type: "setGroup", key: "season", value: "冬" });
  });
  it("子串不触发——「XX避暑山庄」这类普通关键词不应误判成概念词搜索", () => {
    expect(matchIntent("承德避暑山庄")).toBeNull();
  });
  it("无命中返回 null", () => {
    expect(matchIntent("这不是概念词")).toBeNull();
    expect(matchIntent("")).toBeNull();
  });
});
